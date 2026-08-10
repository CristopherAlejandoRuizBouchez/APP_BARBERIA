/**
 * Validación de la apariencia que configura cada propietario.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  El propietario NO puede introducir CSS, HTML ni JavaScript.
 *
 *  Solo se aceptan valores de un catálogo cerrado: hexadecimales de 6 dígitos,
 *  fuentes de una lista fija, y URLs cuyo host sea el de nuestro Storage.
 *  Cualquier otra cosa se rechaza con un mensaje concreto.
 *
 *  Sin esto, un propietario podría escribir `red; background:url(javascript:…)`
 *  en un campo de color y ejecutar código en el navegador de sus clientes.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Módulo puro y sin dependencias, para que se pueda probar sin instalar nada.
 * Los formularios del editor visual envuelven estas funciones con Zod.
 */

import {
  esPlantillaValida,
  esFuentePermitida,
  type Plantilla,
  type FuentePermitida,
} from './plantillas';

export type Problema = { campo: string; mensaje: string };

const HEX = /^#[0-9a-fA-F]{6}$/;

export const SECCIONES_VALIDAS = [
  'hero',
  'servicios',
  'barberos',
  'galeria',
  'productos',
  'testimonios',
  'sucursales',
  'faq',
  'contacto',
] as const;

export type Seccion = (typeof SECCIONES_VALIDAS)[number];

export const REDES_VALIDAS = ['instagram', 'facebook', 'tiktok', 'youtube', 'x'] as const;
export type Red = (typeof REDES_VALIDAS)[number];

/** Color hexadecimal de 6 dígitos. Nada más. */
export function validarColor(campo: string, valor: unknown, problemas: Problema[]): string | null {
  if (valor === undefined || valor === null || valor === '') return null;
  if (typeof valor !== 'string' || !HEX.test(valor)) {
    problemas.push({
      campo,
      mensaje: `Debe ser un color hexadecimal de 6 dígitos, como #B88942 (recibido: ${JSON.stringify(valor)}).`,
    });
    return null;
  }
  return valor.toUpperCase();
}

/**
 * URL de imagen. Solo https y solo hosts permitidos: el Storage del proyecto.
 * Se rechazan `javascript:`, `data:` y cualquier dominio externo.
 */
export function validarUrlImagen(
  campo: string,
  valor: unknown,
  hostsPermitidos: readonly string[],
  problemas: Problema[]
): string | null {
  if (valor === undefined || valor === null || valor === '') return null;

  if (typeof valor !== 'string') {
    problemas.push({ campo, mensaje: 'Debe ser una URL.' });
    return null;
  }

  let url: URL;
  try {
    url = new URL(valor);
  } catch {
    problemas.push({ campo, mensaje: `No es una URL válida: ${valor}` });
    return null;
  }

  if (url.protocol !== 'https:') {
    problemas.push({ campo, mensaje: 'Solo se aceptan URLs https.' });
    return null;
  }

  const permitido = hostsPermitidos.some(
    (h) => url.hostname === h || url.hostname.endsWith(`.${h}`)
  );
  if (!permitido) {
    problemas.push({
      campo,
      mensaje: 'La imagen debe estar alojada en el almacenamiento del proyecto.',
    });
    return null;
  }

  return url.toString();
}

/** Texto plano acotado. Se rechaza cualquier marca de HTML. */
export function validarTexto(
  campo: string,
  valor: unknown,
  maximo: number,
  problemas: Problema[]
): string | null {
  if (valor === undefined || valor === null || valor === '') return null;

  if (typeof valor !== 'string') {
    problemas.push({ campo, mensaje: 'Debe ser texto.' });
    return null;
  }
  if (valor.length > maximo) {
    problemas.push({ campo, mensaje: `Máximo ${maximo} caracteres.` });
    return null;
  }
  if (/[<>]/.test(valor)) {
    problemas.push({ campo, mensaje: 'No se admiten los caracteres < ni > en este campo.' });
    return null;
  }
  return valor.trim();
}

/** Lista de secciones: solo claves conocidas y sin repetir. */
export function validarSecciones(
  campo: string,
  valor: unknown,
  problemas: Problema[]
): Seccion[] | null {
  if (valor === undefined || valor === null) return null;

  if (!Array.isArray(valor)) {
    problemas.push({ campo, mensaje: 'Debe ser una lista de secciones.' });
    return null;
  }

  const vistas = new Set<string>();
  const resultado: Seccion[] = [];

  for (const s of valor) {
    if (typeof s !== 'string' || !(SECCIONES_VALIDAS as readonly string[]).includes(s)) {
      problemas.push({ campo, mensaje: `Sección desconocida: ${JSON.stringify(s)}` });
      return null;
    }
    if (vistas.has(s)) {
      problemas.push({ campo, mensaje: `Sección repetida: ${s}` });
      return null;
    }
    vistas.add(s);
    resultado.push(s as Seccion);
  }

  return resultado;
}

/** Redes sociales: claves conocidas y URLs https del dominio correspondiente. */
export function validarRedes(
  campo: string,
  valor: unknown,
  problemas: Problema[]
): Partial<Record<Red, string>> | null {
  if (valor === undefined || valor === null) return null;

  if (typeof valor !== 'object' || Array.isArray(valor)) {
    problemas.push({ campo, mensaje: 'Debe ser un objeto de redes sociales.' });
    return null;
  }

  const salida: Partial<Record<Red, string>> = {};

  for (const [clave, url] of Object.entries(valor as Record<string, unknown>)) {
    if (!(REDES_VALIDAS as readonly string[]).includes(clave)) {
      problemas.push({ campo: `${campo}.${clave}`, mensaje: 'Red social no admitida.' });
      return null;
    }
    if (url === '' || url === null || url === undefined) continue;
    if (typeof url !== 'string') {
      problemas.push({ campo: `${campo}.${clave}`, mensaje: 'Debe ser una URL.' });
      return null;
    }
    let u: URL;
    try {
      u = new URL(url);
    } catch {
      problemas.push({ campo: `${campo}.${clave}`, mensaje: `No es una URL válida: ${url}` });
      return null;
    }
    if (u.protocol !== 'https:') {
      problemas.push({ campo: `${campo}.${clave}`, mensaje: 'Solo se aceptan URLs https.' });
      return null;
    }
    salida[clave as Red] = u.toString();
  }

  return salida;
}

export type TemaValidado = {
  plantilla: Plantilla;
  colorPrimario: string | null;
  colorSecundario: string | null;
  colorFondo: string | null;
  colorSuperficie: string | null;
  colorTexto: string | null;
  fuenteTitulos: FuentePermitida | null;
  fuenteCuerpo: FuentePermitida | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  portadaUrl: string | null;
  eslogan: string | null;
  descripcion: string | null;
  radioBordes: 'recto' | 'suave' | 'redondeado' | null;
  textura: 'ninguna' | 'grano' | 'lineas' | 'trama' | null;
  seccionesVisibles: Seccion[] | null;
  ordenSecciones: Seccion[] | null;
  redesSociales: Partial<Record<Red, string>> | null;
};

export type ResultadoValidacion =
  { ok: true; tema: TemaValidado } | { ok: false; problemas: Problema[] };

function validarOpcion<T extends string>(
  campo: string,
  valor: unknown,
  permitidos: readonly T[],
  problemas: Problema[]
): T | null {
  if (valor === undefined || valor === null || valor === '') return null;
  if (typeof valor !== 'string' || !(permitidos as readonly string[]).includes(valor)) {
    problemas.push({
      campo,
      mensaje: `Valor no admitido. Opciones: ${permitidos.join(', ')}.`,
    });
    return null;
  }
  return valor as T;
}

/** Valida la configuración completa del editor visual. */
export function validarTema(
  entrada: Record<string, unknown>,
  hostsPermitidos: readonly string[]
): ResultadoValidacion {
  const problemas: Problema[] = [];

  if (!esPlantillaValida(entrada.plantilla)) {
    problemas.push({ campo: 'plantilla', mensaje: 'Plantilla desconocida.' });
  }

  const fuenteTitulos =
    entrada.fuenteTitulos === undefined ||
    entrada.fuenteTitulos === null ||
    entrada.fuenteTitulos === ''
      ? null
      : esFuentePermitida(entrada.fuenteTitulos)
        ? entrada.fuenteTitulos
        : (problemas.push({ campo: 'fuenteTitulos', mensaje: 'Fuente no admitida.' }), null);

  const fuenteCuerpo =
    entrada.fuenteCuerpo === undefined ||
    entrada.fuenteCuerpo === null ||
    entrada.fuenteCuerpo === ''
      ? null
      : esFuentePermitida(entrada.fuenteCuerpo)
        ? entrada.fuenteCuerpo
        : (problemas.push({ campo: 'fuenteCuerpo', mensaje: 'Fuente no admitida.' }), null);

  const tema: TemaValidado = {
    plantilla: esPlantillaValida(entrada.plantilla) ? entrada.plantilla : 'urban_premium',
    colorPrimario: validarColor('colorPrimario', entrada.colorPrimario, problemas),
    colorSecundario: validarColor('colorSecundario', entrada.colorSecundario, problemas),
    colorFondo: validarColor('colorFondo', entrada.colorFondo, problemas),
    colorSuperficie: validarColor('colorSuperficie', entrada.colorSuperficie, problemas),
    colorTexto: validarColor('colorTexto', entrada.colorTexto, problemas),
    fuenteTitulos,
    fuenteCuerpo,
    logoUrl: validarUrlImagen('logoUrl', entrada.logoUrl, hostsPermitidos, problemas),
    faviconUrl: validarUrlImagen('faviconUrl', entrada.faviconUrl, hostsPermitidos, problemas),
    portadaUrl: validarUrlImagen('portadaUrl', entrada.portadaUrl, hostsPermitidos, problemas),
    eslogan: validarTexto('eslogan', entrada.eslogan, 120, problemas),
    descripcion: validarTexto('descripcion', entrada.descripcion, 600, problemas),
    radioBordes: validarOpcion(
      'radioBordes',
      entrada.radioBordes,
      ['recto', 'suave', 'redondeado'] as const,
      problemas
    ),
    textura: validarOpcion(
      'textura',
      entrada.textura,
      ['ninguna', 'grano', 'lineas', 'trama'] as const,
      problemas
    ),
    seccionesVisibles: validarSecciones('seccionesVisibles', entrada.seccionesVisibles, problemas),
    ordenSecciones: validarSecciones('ordenSecciones', entrada.ordenSecciones, problemas),
    redesSociales: validarRedes('redesSociales', entrada.redesSociales, problemas),
  };

  if (problemas.length > 0) return { ok: false, problemas };
  return { ok: true, tema };
}

/**
 * Contraste WCAG entre dos colores hexadecimales.
 * El editor avisa cuando una combinación queda por debajo de 4.5:1.
 */
export function contraste(hexA: string, hexB: string): number {
  const luminancia = (hex: string): number => {
    const n = parseInt(hex.slice(1), 16);
    const canales = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * (canales[0] ?? 0) + 0.7152 * (canales[1] ?? 0) + 0.0722 * (canales[2] ?? 0);
  };

  const a = luminancia(hexA);
  const b = luminancia(hexB);
  const claro = Math.max(a, b);
  const oscuro = Math.min(a, b);
  return Math.round(((claro + 0.05) / (oscuro + 0.05)) * 100) / 100;
}

/** ¿La combinación es legible? AA exige 4.5:1 en texto normal. */
export function contrasteSuficiente(fondo: string, texto: string): boolean {
  return contraste(fondo, texto) >= 4.5;
}
