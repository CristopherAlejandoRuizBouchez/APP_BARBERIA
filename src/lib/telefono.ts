/**
 * Normalización de teléfonos mexicanos.
 *
 * El teléfono es la identidad del cliente en Barbería OS: no hay cuentas ni
 * contraseñas. Si "55 1234 5678", "+525512345678" y "5215512345678" no se
 * reducen al mismo valor, el mismo cliente aparece tres veces en la base y el
 * historial se fragmenta.
 *
 * Formato canónico: E.164 → +52 seguido de 10 dígitos. Ejemplo: +525512345678
 */

export const LADA_MEXICO = '52';

/** Longitud de un número nacional mexicano, sin lada de país. */
const LARGO_NACIONAL = 10;

/**
 * Reduce cualquier forma de escribir un número mexicano a E.164.
 * Devuelve null si no es un número mexicano válido.
 *
 * Acepta:
 *   5512345678        → +525512345678
 *   55 1234 5678      → +525512345678
 *   (55) 1234-5678    → +525512345678
 *   525512345678      → +525512345678
 *   +52 55 1234 5678  → +525512345678
 *   5215512345678     → +525512345678   (formato antiguo de WhatsApp con el 1)
 *   +521 55 1234 5678 → +525512345678
 *
 * Rechaza a propósito:
 *   +1 415 555 0100   → null  (lada de país explícita distinta de 52)
 *   15512345678       → null  (11 dígitos con "1" al frente: indistinguible
 *                              de un número de EE. UU. o Canadá, cuyas ladas
 *                              se solapan con las mexicanas. Preferimos pedir
 *                              que lo reescriban antes que dar de alta un
 *                              cliente con un teléfono equivocado.)
 */
export function normalizarTelefono(entrada: string | null | undefined): string | null {
  if (!entrada) return null;

  const texto = entrada.trim();
  const digitos = texto.replace(/\D/g, '');
  if (digitos === '') return null;

  // Si viene con lada de país explícita, tiene que ser la de México.
  if (texto.startsWith('+') && !digitos.startsWith(LADA_MEXICO)) return null;

  let nacional: string | null = null;

  if (digitos.length === LARGO_NACIONAL) {
    // 5512345678
    nacional = digitos;
  } else if (digitos.length === 12 && digitos.startsWith(LADA_MEXICO)) {
    // 525512345678
    nacional = digitos.slice(2);
  } else if (digitos.length === 13 && digitos.startsWith(`${LADA_MEXICO}1`)) {
    // 5215512345678 — el "1" que WhatsApp usaba para móviles ya no se marca.
    nacional = digitos.slice(3);
  }

  if (nacional === null || nacional.length !== LARGO_NACIONAL) return null;
  // Ninguna lada mexicana empieza en 0 ni en 1.
  if (nacional.startsWith('0') || nacional.startsWith('1')) return null;

  return `+${LADA_MEXICO}${nacional}`;
}

/** ¿Es un teléfono mexicano que se puede normalizar? */
export function esTelefonoValido(entrada: string | null | undefined): boolean {
  return normalizarTelefono(entrada) !== null;
}

/** Los 10 dígitos nacionales de un número ya en E.164. */
export function parteNacional(e164: string): string {
  return e164.startsWith(`+${LADA_MEXICO}`) ? e164.slice(3) : e164.replace(/\D/g, '');
}

/**
 * Formato legible para pantalla: +525512345678 → "55 1234 5678".
 * Las ladas de 3 dígitos (interior) se agrupan 3-3-4: "477 123 4567".
 */
export function formatearTelefono(e164: string | null | undefined): string {
  if (!e164) return '';
  const n = parteNacional(e164);
  if (n.length !== LARGO_NACIONAL) return e164;

  // CDMX (55), Monterrey (81) y Guadalajara (33) usan lada de 2 dígitos.
  const ladasDeDos = ['55', '56', '81', '33'];
  const prefijo = n.slice(0, 2);

  return ladasDeDos.includes(prefijo)
    ? `${n.slice(0, 2)} ${n.slice(2, 6)} ${n.slice(6)}`
    : `${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;
}

/** Últimos cuatro dígitos. Es lo que pide "Mi cita" junto al folio. */
export function ultimosCuatro(e164: string | null | undefined): string {
  if (!e164) return '';
  return parteNacional(e164).slice(-4);
}

/** Versión enmascarada para pantallas compartidas: "•• •••• 5678". */
export function enmascararTelefono(e164: string | null | undefined): string {
  if (!e164) return '';
  const n = parteNacional(e164);
  if (n.length !== LARGO_NACIONAL) return '••••';
  return `•• •••• ${n.slice(-4)}`;
}

/**
 * Número tal como lo espera un enlace wa.me: dígitos, sin el signo +.
 * +525512345678 → 525512345678
 */
export function paraEnlaceWhatsApp(e164: string | null | undefined): string | null {
  const normalizado = normalizarTelefono(e164);
  return normalizado ? normalizado.slice(1) : null;
}

/**
 * Construye el enlace de WhatsApp con el mensaje ya escrito.
 * Es el mecanismo de pedidos de la v1: sin API, sin costo, sin aprobación.
 */
export function enlaceWhatsApp(telefono: string, mensaje: string): string | null {
  const numero = paraEnlaceWhatsApp(telefono);
  if (!numero) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
}
