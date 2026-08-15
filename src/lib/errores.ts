/**
 * Errores de dominio con código estable.
 *
 * Las funciones de PostgreSQL lanzan excepciones con estos mismos códigos
 * (`raise exception 'STOCK_INSUFICIENTE'`). La capa de aplicación los traduce
 * a un mensaje en español y, cuando aplica, a una alternativa accionable:
 * si un horario se ocupó, no basta con decir "error", hay que ofrecer otro.
 */

export const CODIGOS_ERROR = {
  HORARIO_OCUPADO: 'HORARIO_OCUPADO',
  BARBERO_NO_DISPONIBLE: 'BARBERO_NO_DISPONIBLE',
  FUERA_DE_HORARIO: 'FUERA_DE_HORARIO',
  ANTICIPACION_INSUFICIENTE: 'ANTICIPACION_INSUFICIENTE',
  STOCK_INSUFICIENTE: 'STOCK_INSUFICIENTE',
  RESERVA_VENCIDA: 'RESERVA_VENCIDA',
  PAGOS_NO_CUADRAN: 'PAGOS_NO_CUADRAN',
  CAJA_CERRADA: 'CAJA_CERRADA',
  LIMITE_PETICIONES: 'LIMITE_PETICIONES',
  NO_AUTORIZADO: 'NO_AUTORIZADO',
  NO_ENCONTRADO: 'NO_ENCONTRADO',
  DATOS_INVALIDOS: 'DATOS_INVALIDOS',
  PRODUCTO_DUPLICADO: 'PRODUCTO_DUPLICADO',
  TELEFONO_INVALIDO: 'TELEFONO_INVALIDO',
  ORGANIZACION_NO_OPERATIVA: 'ORGANIZACION_NO_OPERATIVA',
  ERROR_INESPERADO: 'ERROR_INESPERADO',
} as const;

export type CodigoError = (typeof CODIGOS_ERROR)[keyof typeof CODIGOS_ERROR];

const MENSAJES: Record<CodigoError, string> = {
  HORARIO_OCUPADO: 'Ese horario acaba de ocuparse. Elige otro y seguimos.',
  BARBERO_NO_DISPONIBLE: 'Ese barbero no está disponible a esa hora.',
  FUERA_DE_HORARIO: 'Esa hora queda fuera del horario de atención.',
  ANTICIPACION_INSUFICIENTE: 'Se necesita más anticipación para reservar a esa hora.',
  STOCK_INSUFICIENTE: 'No hay existencias suficientes de uno de los productos.',
  RESERVA_VENCIDA: 'La reservación del pedido venció y las piezas se liberaron.',
  PAGOS_NO_CUADRAN: 'La suma de los pagos no coincide con el total de la venta.',
  CAJA_CERRADA: 'No hay una caja abierta para registrar esta venta.',
  LIMITE_PETICIONES: 'Demasiados intentos. Espera un momento antes de reintentar.',
  NO_AUTORIZADO: 'Tu cuenta no tiene permiso para hacer esto.',
  NO_ENCONTRADO: 'No encontramos lo que buscas.',
  DATOS_INVALIDOS: 'Revisa los datos: hay algo que no es válido.',
  PRODUCTO_DUPLICADO: 'Ya existe un producto con ese nombre o código.',
  TELEFONO_INVALIDO: 'Escribe un número de WhatsApp mexicano de 10 dígitos.',
  ORGANIZACION_NO_OPERATIVA: 'La barbería no está aceptando reservaciones en este momento.',
  ERROR_INESPERADO: 'Ocurrió un error inesperado. Intenta de nuevo.',
};

export class ErrorDominio extends Error {
  readonly codigo: CodigoError;
  readonly detalle?: Record<string, unknown>;

  constructor(codigo: CodigoError, detalle?: Record<string, unknown>) {
    super(MENSAJES[codigo]);
    this.name = 'ErrorDominio';
    this.codigo = codigo;
    if (detalle !== undefined) this.detalle = detalle;
  }
}

/** ¿Este código viene de PostgreSQL o de la aplicación? */
export function esCodigoConocido(valor: string): valor is CodigoError {
  return Object.prototype.hasOwnProperty.call(MENSAJES, valor);
}

/** Mensaje en español para cualquier código. */
export function mensajeDeCodigo(codigo: string): string {
  return esCodigoConocido(codigo) ? MENSAJES[codigo] : MENSAJES.ERROR_INESPERADO;
}

/**
 * Traduce lo que sea que llegue —error de Postgres, de Supabase o de JS— a un
 * ErrorDominio con mensaje presentable. Nunca deja escapar un stack al usuario.
 */
export function comoErrorDominio(error: unknown): ErrorDominio {
  if (error instanceof ErrorDominio) return error;

  // Los errores de Zod tienen una lista `issues`. Son datos inválidos, no un
  // fallo inesperado del servidor.
  if (
    typeof error === 'object' &&
    error !== null &&
    'issues' in error &&
    Array.isArray((error as { issues?: unknown }).issues)
  ) {
    return new ErrorDominio('DATOS_INVALIDOS');
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const mensaje = String((error as { message: unknown }).message);
    if (mensaje.includes('citas_sin_traslape') || mensaje.includes('exclusion constraint')) {
      return new ErrorDominio('HORARIO_OCUPADO');
    }
    const encontrado = Object.values(CODIGOS_ERROR).find((c) => mensaje.includes(c));
    if (encontrado) return new ErrorDominio(encontrado, { original: mensaje });
  }

  return new ErrorDominio('ERROR_INESPERADO');
}

/** Resultado tipado de una Server Action. Evita lanzar a través del límite. */
export type Resultado<T> =
  | { ok: true; datos: T }
  | { ok: false; codigo: CodigoError; mensaje: string; detalle?: Record<string, unknown> };

export function exito<T>(datos: T): Resultado<T> {
  return { ok: true, datos };
}

export function fallo<T>(error: unknown): Resultado<T> {
  const e = comoErrorDominio(error);
  return e.detalle !== undefined
    ? { ok: false, codigo: e.codigo, mensaje: e.message, detalle: e.detalle }
    : { ok: false, codigo: e.codigo, mensaje: e.message };
}
