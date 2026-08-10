/**
 * Las cinco plantillas visuales.
 *
 * No son la misma página con otros colores. Cada una define su propia
 * composición: qué forma tiene el hero, cómo se navega, cómo se presentan los
 * servicios y los productos, y qué ritmo tipográfico usa.
 *
 * La implementación NO duplica la aplicación: los componentes leen
 * `disposicion` y `tokens` y se resuelven con variables CSS. Cambiar de
 * plantilla es cambiar un valor, no desplegar otro sitio.
 */

export const PLANTILLAS = [
  'urban_premium',
  'classic_gold',
  'clean_studio',
  'vintage_barber',
  'modern_luxury',
] as const;

export type Plantilla = (typeof PLANTILLAS)[number];

/** Composición del hero: cambia la estructura, no solo el estilo. */
export type FormaHero =
  | 'pantalla_completa' // imagen a sangre, texto abajo a la izquierda
  | 'dividido' // mitad texto, mitad imagen
  | 'centrado_minimo' // texto centrado sobre fondo liso, sin imagen
  | 'marco_retro' // imagen enmarcada con filete doble y sello
  | 'editorial'; // titular gigante, imagen desplazada, texto en columna

export type FormaNavegacion =
  | 'barra_fija' // sticky translúcida
  | 'barra_alta' // dos alturas: logo centrado arriba, menú debajo
  | 'lateral_minima' // menú lateral en escritorio
  | 'centrada_serif'; // logo centrado, menú en versalitas

export type FormaTarjeta = 'filete' | 'plano' | 'elevado' | 'marco' | 'lista';

export type FormaServicios =
  | 'rejilla' // tarjetas en cuadrícula
  | 'carta' // tipo menú: nombre · filete punteado · precio
  | 'lista_ancha' // filas anchas con imagen a la izquierda
  | 'columnas_editorial'; // dos columnas con numeración

export type FormaProductos = 'rejilla' | 'carrusel' | 'mosaico' | 'lista_precio';

export type DefinicionPlantilla = {
  clave: Plantilla;
  nombre: string;
  descripcion: string;
  esquema: 'oscuro' | 'claro';
  disposicion: {
    hero: FormaHero;
    navegacion: FormaNavegacion;
    tarjeta: FormaTarjeta;
    servicios: FormaServicios;
    productos: FormaProductos;
    /** Ancho máximo del contenido, en rem. */
    anchoContenido: number;
    /** Separación vertical entre secciones, en rem. */
    ritmoSecciones: number;
    /** Mayúsculas y espaciado en los títulos de sección. */
    titulosEnVersalitas: boolean;
  };
  tokens: {
    fondo: string;
    superficie: string;
    texto: string;
    textoSuave: string;
    primario: string;
    secundario: string;
    borde: string;
    radio: string;
    fuenteTitulos: string;
    fuenteCuerpo: string;
    escalaTitular: number;
    textura: 'ninguna' | 'grano' | 'lineas' | 'trama';
  };
};

export const DEFINICIONES: Record<Plantilla, DefinicionPlantilla> = {
  // ── 1 · La identidad de la fase 0, ahora una plantilla más ────────────────
  urban_premium: {
    clave: 'urban_premium',
    nombre: 'Urban Premium',
    descripcion: 'Oscura, moderna y callejera. Sastrería urbana con filete dorado.',
    esquema: 'oscuro',
    disposicion: {
      hero: 'pantalla_completa',
      navegacion: 'barra_fija',
      tarjeta: 'filete',
      servicios: 'rejilla',
      productos: 'rejilla',
      anchoContenido: 80,
      ritmoSecciones: 6,
      titulosEnVersalitas: false,
    },
    tokens: {
      fondo: '#0B0B0D',
      superficie: '#17181C',
      texto: '#EFE7DA',
      textoSuave: 'rgba(239,231,218,0.62)',
      primario: '#B88942',
      secundario: '#5B1E2D',
      borde: 'rgba(239,231,218,0.12)',
      radio: '2px',
      fuenteTitulos: 'instrument-serif',
      fuenteCuerpo: 'instrument-sans',
      escalaTitular: 1,
      textura: 'grano',
    },
  },

  // ── 2 · Clásica: logo centrado, servicios como carta, oro sobre negro ─────
  classic_gold: {
    clave: 'classic_gold',
    nombre: 'Classic Gold',
    descripcion: 'Elegante y clásica. Negro y dorado, servicios presentados como carta.',
    esquema: 'oscuro',
    disposicion: {
      hero: 'dividido',
      navegacion: 'barra_alta',
      tarjeta: 'marco',
      servicios: 'carta',
      productos: 'lista_precio',
      anchoContenido: 72,
      ritmoSecciones: 7,
      titulosEnVersalitas: true,
    },
    tokens: {
      fondo: '#0A0908',
      superficie: '#141210',
      texto: '#F2E9D8',
      textoSuave: 'rgba(242,233,216,0.6)',
      primario: '#C9A227',
      secundario: '#7A5C1E',
      borde: 'rgba(201,162,39,0.28)',
      radio: '0px',
      fuenteTitulos: 'instrument-serif',
      fuenteCuerpo: 'instrument-sans',
      escalaTitular: 0.92,
      textura: 'lineas',
    },
  },

  // ── 3 · Clara: la única de esquema claro, sin imagen en el hero ───────────
  clean_studio: {
    clave: 'clean_studio',
    nombre: 'Clean Studio',
    descripcion: 'Clara, limpia y minimalista. Sin imagen en portada; el aire es el protagonista.',
    esquema: 'claro',
    disposicion: {
      hero: 'centrado_minimo',
      navegacion: 'lateral_minima',
      tarjeta: 'plano',
      servicios: 'lista_ancha',
      productos: 'rejilla',
      anchoContenido: 64,
      ritmoSecciones: 8,
      titulosEnVersalitas: false,
    },
    tokens: {
      fondo: '#FBFAF8',
      superficie: '#FFFFFF',
      texto: '#1A1A1A',
      textoSuave: 'rgba(26,26,26,0.58)',
      primario: '#2B2B2B',
      secundario: '#8A7B6B',
      borde: 'rgba(26,26,26,0.10)',
      radio: '4px',
      fuenteTitulos: 'instrument-sans',
      fuenteCuerpo: 'instrument-sans',
      escalaTitular: 0.85,
      textura: 'ninguna',
    },
  },

  // ── 4 · Retro: marco doble, sello, tipografía con peso ────────────────────
  vintage_barber: {
    clave: 'vintage_barber',
    nombre: 'Vintage Barber',
    descripcion: 'Retro y tradicional. Marcos, sellos y una paleta de cuero y crema.',
    esquema: 'oscuro',
    disposicion: {
      hero: 'marco_retro',
      navegacion: 'centrada_serif',
      tarjeta: 'marco',
      servicios: 'carta',
      productos: 'mosaico',
      anchoContenido: 68,
      ritmoSecciones: 6,
      titulosEnVersalitas: true,
    },
    tokens: {
      fondo: '#1C1613',
      superficie: '#241C18',
      texto: '#EDE0CC',
      textoSuave: 'rgba(237,224,204,0.62)',
      primario: '#C1743A',
      secundario: '#6B2C2C',
      borde: 'rgba(237,224,204,0.20)',
      radio: '0px',
      fuenteTitulos: 'instrument-serif',
      fuenteCuerpo: 'instrument-sans',
      escalaTitular: 0.95,
      textura: 'trama',
    },
  },

  // ── 5 · Editorial: titular gigante, mucho aire, poco color ────────────────
  modern_luxury: {
    clave: 'modern_luxury',
    nombre: 'Modern Luxury',
    descripcion: 'Premium y editorial. Titulares enormes, mucho aire y color contenido.',
    esquema: 'oscuro',
    disposicion: {
      hero: 'editorial',
      navegacion: 'centrada_serif',
      tarjeta: 'elevado',
      servicios: 'columnas_editorial',
      productos: 'carrusel',
      anchoContenido: 88,
      ritmoSecciones: 9,
      titulosEnVersalitas: false,
    },
    tokens: {
      fondo: '#111014',
      superficie: '#1A1920',
      texto: '#F5F3F0',
      textoSuave: 'rgba(245,243,240,0.55)',
      primario: '#A89B87',
      secundario: '#3B3A45',
      borde: 'rgba(245,243,240,0.10)',
      radio: '6px',
      fuenteTitulos: 'instrument-serif',
      fuenteCuerpo: 'instrument-sans',
      escalaTitular: 1.25,
      textura: 'ninguna',
    },
  },
};

export const PLANTILLA_POR_DEFECTO: Plantilla = 'urban_premium';

export function definicionDe(plantilla: string | null | undefined): DefinicionPlantilla {
  const clave = (PLANTILLAS as readonly string[]).includes(plantilla ?? '')
    ? (plantilla as Plantilla)
    : PLANTILLA_POR_DEFECTO;
  return DEFINICIONES[clave];
}

export function esPlantillaValida(valor: unknown): valor is Plantilla {
  return typeof valor === 'string' && (PLANTILLAS as readonly string[]).includes(valor);
}

/** Catálogo cerrado de fuentes. Nadie puede introducir una familia arbitraria. */
export const FUENTES_PERMITIDAS = [
  'instrument-serif',
  'instrument-sans',
  'jetbrains-mono',
] as const;

export type FuentePermitida = (typeof FUENTES_PERMITIDAS)[number];

export function esFuentePermitida(valor: unknown): valor is FuentePermitida {
  return typeof valor === 'string' && (FUENTES_PERMITIDAS as readonly string[]).includes(valor);
}

export const VARIABLE_CSS_FUENTE: Record<FuentePermitida, string> = {
  'instrument-serif': 'var(--fuente-display)',
  'instrument-sans': 'var(--fuente-ui)',
  'jetbrains-mono': 'var(--fuente-mono)',
};

/** Personalización que el propietario aplica encima de la plantilla. */
export type PersonalizacionTema = {
  plantilla: Plantilla;
  colorPrimario?: string;
  colorSecundario?: string;
  colorFondo?: string;
  colorSuperficie?: string;
  colorTexto?: string;
  fuenteTitulos?: FuentePermitida;
  fuenteCuerpo?: FuentePermitida;
  radioBordes?: 'recto' | 'suave' | 'redondeado';
  textura?: 'ninguna' | 'grano' | 'lineas' | 'trama';
};

const RADIO_A_CSS: Record<'recto' | 'suave' | 'redondeado', string> = {
  recto: '0px',
  suave: '4px',
  redondeado: '12px',
};

/**
 * Convierte plantilla + personalización en variables CSS.
 *
 * Se serializa EN EL SERVIDOR y se inyecta en el `<html>` de la página, de
 * modo que el primer pintado ya lleva el tema correcto: no hay parpadeo.
 */
export function variablesCss(p: PersonalizacionTema): Record<string, string> {
  const base = definicionDe(p.plantilla);
  const t = base.tokens;

  return {
    '--tema-fondo': p.colorFondo ?? t.fondo,
    '--tema-superficie': p.colorSuperficie ?? t.superficie,
    '--tema-texto': p.colorTexto ?? t.texto,
    '--tema-texto-suave': t.textoSuave,
    '--tema-primario': p.colorPrimario ?? t.primario,
    '--tema-secundario': p.colorSecundario ?? t.secundario,
    '--tema-borde': t.borde,
    '--tema-radio': p.radioBordes ? RADIO_A_CSS[p.radioBordes] : t.radio,
    '--tema-fuente-titulos':
      VARIABLE_CSS_FUENTE[p.fuenteTitulos ?? (t.fuenteTitulos as FuentePermitida)],
    '--tema-fuente-cuerpo':
      VARIABLE_CSS_FUENTE[p.fuenteCuerpo ?? (t.fuenteCuerpo as FuentePermitida)],
    '--tema-escala-titular': String(t.escalaTitular),
    '--tema-ancho': `${base.disposicion.anchoContenido}rem`,
    '--tema-ritmo': `${base.disposicion.ritmoSecciones}rem`,
  };
}

/** Cadena `clave:valor;` lista para el atributo `style` del `<html>`. */
export function estiloInline(p: PersonalizacionTema): string {
  return Object.entries(variablesCss(p))
    .map(([k, v]) => `${k}:${v}`)
    .join(';');
}
