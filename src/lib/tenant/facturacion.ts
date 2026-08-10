/**
 * Cobro de una barbería a Barbería OS.
 *
 * NO tiene ninguna relación con los pagos que los clientes hacen a la
 * barbería (eso son `sales` y `sale_payments`). Son dos procesos separados que
 * no comparten tablas ni funciones.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  REGLA QUE GOBIERNA TODO ESTE MÓDULO
 *
 *  Una fecha vencida produce una ALERTA. Nunca una suspensión.
 *
 *  `estadoPago()` es una función pura de la fecha; `estado_organizacion` solo
 *  cambia cuando una persona llama a `fn_suspender_organizacion` con un
 *  motivo escrito. No existe ningún camino de código que conecte lo primero
 *  con lo segundo, y hay pruebas que lo verifican.
 * ══════════════════════════════════════════════════════════════════════════
 */

export const ESTADOS_PAGO = ['current', 'due_soon', 'past_due'] as const;
export type EstadoPago = (typeof ESTADOS_PAGO)[number];

export const ESTADOS_ORGANIZACION = ['onboarding', 'active', 'suspended', 'cancelled'] as const;
export type EstadoOrganizacion = (typeof ESTADOS_ORGANIZACION)[number];

export const ETIQUETA_ESTADO_PAGO: Record<EstadoPago, string> = {
  current: 'Al corriente',
  due_soon: 'Vence pronto',
  past_due: 'Vencido',
};

export const ETIQUETA_ESTADO_ORG: Record<EstadoOrganizacion, string> = {
  onboarding: 'En alta',
  active: 'Activa',
  suspended: 'Suspendida',
  cancelled: 'Cancelada',
};

export type CuentaCobro = {
  mensualidadCentavos: number;
  proximaFechaPago: string | null; // 'YYYY-MM-DD'
  ultimoPagoEn: string | null;
  diasGracia: number;
};

/** Días de aviso previo al vencimiento. */
export const DIAS_AVISO_PREVIO = 5;

function aFecha(iso: string): Date {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(a ?? 1970, (m ?? 1) - 1, d ?? 1));
}

function diasEntre(desde: Date, hasta: Date): number {
  return Math.round((hasta.getTime() - desde.getTime()) / 86_400_000);
}

/**
 * Calcula el estado de cobro. Función PURA: mismos datos, mismo resultado.
 *
 * No devuelve, ni puede devolver, nada relacionado con suspender.
 */
export function estadoPago(cuenta: CuentaCobro, hoyISO: string): EstadoPago {
  if (cuenta.mensualidadCentavos <= 0) return 'current';
  if (!cuenta.proximaFechaPago) return 'current';

  const hoy = aFecha(hoyISO);
  const vence = aFecha(cuenta.proximaFechaPago);
  const limite = new Date(vence.getTime() + cuenta.diasGracia * 86_400_000);

  if (hoy.getTime() > limite.getTime()) return 'past_due';
  if (diasEntre(hoy, vence) <= DIAS_AVISO_PREVIO) return 'due_soon';
  return 'current';
}

/** Días de retraso. Cero si aún no vence. */
export function diasDeRetraso(cuenta: CuentaCobro, hoyISO: string): number {
  if (!cuenta.proximaFechaPago) return 0;
  const dias = diasEntre(aFecha(cuenta.proximaFechaPago), aFecha(hoyISO));
  return Math.max(0, dias);
}

/** Días que faltan para el vencimiento. Negativo si ya pasó. */
export function diasParaVencer(cuenta: CuentaCobro, hoyISO: string): number | null {
  if (!cuenta.proximaFechaPago) return null;
  return diasEntre(aFecha(hoyISO), aFecha(cuenta.proximaFechaPago));
}

/**
 * Lo único que produce una fecha vencida: una alerta para el panel del
 * superadministrador. Nunca una acción sobre la organización.
 */
export type Alerta = {
  nivel: 'info' | 'aviso' | 'urgente';
  clave: string;
  mensaje: string;
};

export function alertasDeCobro(
  cuenta: CuentaCobro,
  estadoOrg: EstadoOrganizacion,
  hoyISO: string
): Alerta[] {
  const alertas: Alerta[] = [];

  if (estadoOrg === 'suspended') {
    alertas.push({
      nivel: 'urgente',
      clave: 'org_suspendida',
      mensaje: 'La barbería está suspendida manualmente.',
    });
    return alertas;
  }

  const estado = estadoPago(cuenta, hoyISO);
  const faltan = diasParaVencer(cuenta, hoyISO);

  if (estado === 'past_due') {
    alertas.push({
      nivel: 'urgente',
      clave: 'pago_vencido',
      mensaje: `Pago vencido hace ${diasDeRetraso(cuenta, hoyISO)} días. Requiere decisión manual.`,
    });
  } else if (estado === 'due_soon' && faltan !== null) {
    alertas.push({
      nivel: 'aviso',
      clave: 'pago_proximo',
      mensaje:
        faltan >= 0
          ? `El pago vence en ${faltan} días.`
          : `El pago venció hace ${-faltan} días; sigue dentro del periodo de gracia.`,
    });
  }

  return alertas;
}

/**
 * Siguiente estado de la organización según el paso del tiempo.
 *
 * Devuelve SIEMPRE el estado actual, sin excepción. Existe para dejar por
 * escrito —y para que una prueba lo verifique— que ninguna función automática
 * puede suspender una barbería.
 */
export function estadoOrganizacionTrasElTiempo(
  estadoActual: EstadoOrganizacion,
  _cuenta: CuentaCobro,
  _hoyISO: string
): EstadoOrganizacion {
  return estadoActual;
}

/** Transiciones válidas del ciclo de vida, todas iniciadas por una persona. */
const TRANSICIONES: Record<EstadoOrganizacion, readonly EstadoOrganizacion[]> = {
  onboarding: ['active', 'cancelled'],
  active: ['suspended', 'cancelled'],
  suspended: ['active', 'cancelled'],
  cancelled: [],
};

export function transicionPermitida(desde: EstadoOrganizacion, hacia: EstadoOrganizacion): boolean {
  return TRANSICIONES[desde].includes(hacia);
}

export type ResultadoTransicion = { ok: true } | { ok: false; motivo: string };

/**
 * Valida una acción del superadministrador sobre el estado de una barbería.
 * Suspender exige motivo escrito; se registra en auditoría quién y cuándo.
 */
export function validarCambioDeEstado(
  desde: EstadoOrganizacion,
  hacia: EstadoOrganizacion,
  opciones: { esSuperadmin: boolean; motivo?: string }
): ResultadoTransicion {
  if (!opciones.esSuperadmin) {
    return {
      ok: false,
      motivo: 'Solo el superadministrador de la plataforma puede cambiar el estado.',
    };
  }
  if (desde === hacia) {
    return { ok: false, motivo: 'La barbería ya está en ese estado.' };
  }
  if (!transicionPermitida(desde, hacia)) {
    return {
      ok: false,
      motivo: `No se puede pasar de "${ETIQUETA_ESTADO_ORG[desde]}" a "${ETIQUETA_ESTADO_ORG[hacia]}".`,
    };
  }
  if (hacia === 'suspended' && !opciones.motivo?.trim()) {
    return { ok: false, motivo: 'La suspensión exige un motivo escrito.' };
  }
  return { ok: true };
}

/**
 * Qué ve el público cuando una barbería está suspendida.
 * Nunca se revela que existe un adeudo.
 */
export function mensajePublicoSuspension(): string {
  return 'Sitio temporalmente no disponible.';
}

/** Avanza el vencimiento un mes respetando el día de corte. */
export function siguienteFechaPago(fechaISO: string, diaCorte: number): string {
  const base = aFecha(fechaISO);
  const anio = base.getUTCFullYear();
  const mes = base.getUTCMonth() + 1;
  const ultimoDia = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
  const dia = Math.min(diaCorte, ultimoDia);
  const destino = new Date(Date.UTC(anio, mes, dia));
  return destino.toISOString().slice(0, 10);
}
