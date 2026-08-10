import { describe, it, expect } from 'vitest';
import {
  PLANTILLAS,
  DEFINICIONES,
  definicionDe,
  esPlantillaValida,
  esFuentePermitida,
  variablesCss,
  estiloInline,
  PLANTILLA_POR_DEFECTO,
} from './plantillas';
import {
  validarTema,
  validarColor,
  validarUrlImagen,
  validarTexto,
  validarSecciones,
  validarRedes,
  contraste,
  contrasteSuficiente,
  type Problema,
} from './validacion';

const HOSTS = ['abcdef.supabase.co'] as const;

describe('las cinco plantillas', () => {
  it('existen las cinco', () => {
    expect(PLANTILLAS).toHaveLength(5);
    expect([...PLANTILLAS]).toEqual([
      'urban_premium',
      'classic_gold',
      'clean_studio',
      'vintage_barber',
      'modern_luxury',
    ]);
  });

  it('la de la fase 0 se conserva como Urban Premium', () => {
    const t = DEFINICIONES.urban_premium.tokens;
    expect(t.fondo).toBe('#0B0B0D');
    expect(t.superficie).toBe('#17181C');
    expect(t.texto).toBe('#EFE7DA');
    expect(t.primario).toBe('#B88942');
    expect(t.secundario).toBe('#5B1E2D');
    expect(PLANTILLA_POR_DEFECTO).toBe('urban_premium');
  });

  // ────────────────────────────────────────────────────────────────────────
  //  Lo que distingue una plantilla de "el mismo diseño con otros colores"
  // ────────────────────────────────────────────────────────────────────────
  it('cada plantilla tiene una forma de hero distinta', () => {
    const heros = PLANTILLAS.map((p) => DEFINICIONES[p].disposicion.hero);
    expect(new Set(heros).size).toBe(5);
  });

  it('las formas de servicios y productos varían de verdad', () => {
    const servicios = new Set(PLANTILLAS.map((p) => DEFINICIONES[p].disposicion.servicios));
    const productos = new Set(PLANTILLAS.map((p) => DEFINICIONES[p].disposicion.productos));
    expect(servicios.size).toBeGreaterThan(2);
    expect(productos.size).toBeGreaterThan(2);
  });

  it('la navegación cambia entre plantillas', () => {
    const navs = new Set(PLANTILLAS.map((p) => DEFINICIONES[p].disposicion.navegacion));
    expect(navs.size).toBeGreaterThan(2);
  });

  it('el ancho y el ritmo vertical no son iguales en todas', () => {
    const anchos = new Set(PLANTILLAS.map((p) => DEFINICIONES[p].disposicion.anchoContenido));
    const ritmos = new Set(PLANTILLAS.map((p) => DEFINICIONES[p].disposicion.ritmoSecciones));
    expect(anchos.size).toBeGreaterThan(3);
    expect(ritmos.size).toBeGreaterThan(2);
  });

  it('hay al menos una plantilla clara y una oscura', () => {
    const esquemas = PLANTILLAS.map((p) => DEFINICIONES[p].esquema);
    expect(esquemas).toContain('claro');
    expect(esquemas).toContain('oscuro');
  });

  it('dos barberías con plantillas distintas no comparten ningún color de fondo', () => {
    const fondos = PLANTILLAS.map((p) => DEFINICIONES[p].tokens.fondo);
    expect(new Set(fondos).size).toBe(5);
  });

  it('todas las plantillas tienen contraste legible entre fondo y texto', () => {
    for (const p of PLANTILLAS) {
      const { fondo, texto } = DEFINICIONES[p].tokens;
      expect(contrasteSuficiente(fondo, texto), `${p}: ${contraste(fondo, texto)}:1`).toBe(true);
    }
  });
});

describe('resolución de plantilla', () => {
  it('reconoce las válidas', () => {
    expect(esPlantillaValida('classic_gold')).toBe(true);
    expect(esPlantillaValida('inventada')).toBe(false);
    expect(esPlantillaValida(null)).toBe(false);
    expect(esPlantillaValida(42)).toBe(false);
  });

  it('cae en la predeterminada ante un valor desconocido', () => {
    expect(definicionDe('inventada').clave).toBe('urban_premium');
    expect(definicionDe(null).clave).toBe('urban_premium');
  });
});

describe('variables CSS del tema', () => {
  it('cada plantilla produce variables distintas', () => {
    const urban = variablesCss({ plantilla: 'urban_premium' });
    const clean = variablesCss({ plantilla: 'clean_studio' });
    expect(urban['--tema-fondo']).not.toBe(clean['--tema-fondo']);
    expect(urban['--tema-texto']).not.toBe(clean['--tema-texto']);
  });

  it('la personalización del propietario tiene prioridad', () => {
    const v = variablesCss({ plantilla: 'urban_premium', colorPrimario: '#123456' });
    expect(v['--tema-primario']).toBe('#123456');
  });

  it('el radio de bordes se traduce a píxeles', () => {
    expect(variablesCss({ plantilla: 'urban_premium', radioBordes: 'recto' })['--tema-radio']).toBe(
      '0px'
    );
    expect(
      variablesCss({ plantilla: 'urban_premium', radioBordes: 'redondeado' })['--tema-radio']
    ).toBe('12px');
  });

  it('la fuente se resuelve a variable CSS, nunca a una familia arbitraria', () => {
    const v = variablesCss({ plantilla: 'urban_premium', fuenteTitulos: 'jetbrains-mono' });
    expect(v['--tema-fuente-titulos']).toBe('var(--fuente-mono)');
  });

  it('el estilo inline se serializa para el atributo style del html', () => {
    const s = estiloInline({ plantilla: 'classic_gold' });
    expect(s).toContain('--tema-fondo:#0A0908');
    expect(s).not.toContain('\n');
    // Sin punto y coma final: no rompe el atributo.
    expect(s.endsWith(';')).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════
//  El propietario NO puede inyectar CSS, HTML ni JavaScript
// ══════════════════════════════════════════════════════════════════════════
describe('el editor visual rechaza inyecciones', () => {
  it('un color solo puede ser un hexadecimal de 6 dígitos', () => {
    const p: Problema[] = [];
    expect(validarColor('c', '#B88942', p)).toBe('#B88942');
    expect(p).toEqual([]);

    for (const ataque of [
      'red; background:url(javascript:alert(1))',
      '#fff;}body{display:none',
      'expression(alert(1))',
      'var(--secreto)',
      '#B8894',
      '#GGGGGG',
      'rgb(1,2,3)',
    ]) {
      const problemas: Problema[] = [];
      expect(validarColor('c', ataque, problemas), ataque).toBeNull();
      expect(problemas.length, ataque).toBe(1);
    }
  });

  it('una URL de imagen solo puede ser https y del Storage del proyecto', () => {
    const ok: Problema[] = [];
    expect(
      validarUrlImagen(
        'logo',
        'https://abcdef.supabase.co/storage/v1/object/public/x.png',
        HOSTS,
        ok
      )
    ).toContain('abcdef.supabase.co');
    expect(ok).toEqual([]);

    for (const ataque of [
      'javascript:alert(1)',
      'data:text/html;base64,PHNjcmlwdD4=',
      'http://abcdef.supabase.co/x.png',
      'https://malicioso.com/x.png',
      'https://abcdef.supabase.co.malicioso.com/x.png',
      'no es una url',
    ]) {
      const problemas: Problema[] = [];
      expect(validarUrlImagen('logo', ataque, HOSTS, problemas), ataque).toBeNull();
      expect(problemas.length, ataque).toBe(1);
    }
  });

  it('los textos rechazan marcas de HTML', () => {
    const ok: Problema[] = [];
    expect(validarTexto('eslogan', 'El corte no se improvisa', 120, ok)).toBe(
      'El corte no se improvisa'
    );
    expect(ok).toEqual([]);

    for (const ataque of ['<script>alert(1)</script>', 'hola <img onerror=x>', '<b>negrita</b>']) {
      const problemas: Problema[] = [];
      expect(validarTexto('eslogan', ataque, 120, problemas), ataque).toBeNull();
      expect(problemas.length, ataque).toBe(1);
    }
  });

  it('respeta la longitud máxima', () => {
    const p: Problema[] = [];
    expect(validarTexto('eslogan', 'x'.repeat(121), 120, p)).toBeNull();
    expect(p.length).toBe(1);
  });

  it('las secciones solo pueden ser claves conocidas', () => {
    const ok: Problema[] = [];
    expect(validarSecciones('s', ['hero', 'servicios'], ok)).toEqual(['hero', 'servicios']);
    expect(ok).toEqual([]);

    const p1: Problema[] = [];
    expect(validarSecciones('s', ['hero', 'inventada'], p1)).toBeNull();
    expect(p1.length).toBe(1);

    const p2: Problema[] = [];
    expect(validarSecciones('s', ['hero', 'hero'], p2)).toBeNull();
    expect(p2[0]?.mensaje).toContain('repetida');
  });

  it('las redes sociales solo aceptan claves conocidas y https', () => {
    const ok: Problema[] = [];
    expect(validarRedes('r', { instagram: 'https://instagram.com/barberia' }, ok)).toEqual({
      instagram: 'https://instagram.com/barberia',
    });
    expect(ok).toEqual([]);

    const p1: Problema[] = [];
    expect(validarRedes('r', { myspace: 'https://x.com' }, p1)).toBeNull();

    const p2: Problema[] = [];
    expect(validarRedes('r', { instagram: 'javascript:alert(1)' }, p2)).toBeNull();
  });
});

describe('validación completa del tema', () => {
  it('acepta una configuración legítima', () => {
    const r = validarTema(
      {
        plantilla: 'classic_gold',
        colorPrimario: '#C9A227',
        eslogan: 'Tradición desde 1998',
        logoUrl: 'https://abcdef.supabase.co/storage/v1/object/public/org/logo.png',
        seccionesVisibles: ['hero', 'servicios', 'contacto'],
        redesSociales: { instagram: 'https://instagram.com/x' },
      },
      HOSTS
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.tema.plantilla).toBe('classic_gold');
      expect(r.tema.colorPrimario).toBe('#C9A227');
    }
  });

  it('reúne TODOS los problemas, no solo el primero', () => {
    const r = validarTema(
      {
        plantilla: 'inventada',
        colorPrimario: 'rojo',
        colorFondo: '#zzz',
        eslogan: '<script>x</script>',
        logoUrl: 'javascript:alert(1)',
        fuenteTitulos: 'comic-sans',
      },
      HOSTS
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.problemas.length).toBeGreaterThan(4);
      const campos = r.problemas.map((p) => p.campo);
      expect(campos).toContain('plantilla');
      expect(campos).toContain('colorPrimario');
      expect(campos).toContain('logoUrl');
      expect(campos).toContain('fuenteTitulos');
    }
  });

  it('las fuentes salen de un catálogo cerrado', () => {
    expect(esFuentePermitida('instrument-serif')).toBe(true);
    expect(esFuentePermitida('Comic Sans MS')).toBe(false);
    expect(esFuentePermitida('url(https://malicioso.com/f.woff2)')).toBe(false);
  });
});

describe('contraste', () => {
  it('coincide con los valores documentados de la fase 0', () => {
    expect(contraste('#0B0B0D', '#EFE7DA')).toBeGreaterThan(15);
    expect(contraste('#0B0B0D', '#B88942')).toBeGreaterThan(5.5);
    // El borgoña sobre carbón es ilegible: por eso solo se usa como relleno.
    expect(contraste('#0B0B0D', '#5B1E2D')).toBeLessThan(2);
    expect(contrasteSuficiente('#0B0B0D', '#5B1E2D')).toBe(false);
    expect(contrasteSuficiente('#5B1E2D', '#EFE7DA')).toBe(true);
  });
});
