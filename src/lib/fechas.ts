/**
 * Fechas y horas en la zona de la barbería.
 *
 * REGLA ABSOLUTA DEL PROYECTO: la base guarda siempre `timestamptz`, es decir
 * instantes en UTC. La zona America/Mexico_City se aplica solo al presentar y
 * al generar horarios. Guardar horas locales sin zona es la causa número uno
 * de citas que aparecen corridas una hora.
 *
 * Implementado con Intl, sin dependencias externas: menos peso en el navegador
 * y una superficie de mantenimiento menor.
 *
 * México eliminó el horario de verano en 2022, así que el desfase es −6 h
 * estable. Aun así la conversión se calcula, nunca se asume: si la ley cambia,
 * este archivo sigue siendo correcto sin tocarlo.
 */

export const ZONA = 'America/Mexico_City';
export const LOCALE_FECHAS = 'es-MX';

export type PartesFecha = {
  anio: number;
  mes: number; // 1–12
  dia: number; // 1–31
  hora: number; // 0–23
  minuto: number;
  segundo: number;
};

const formateadorPartes = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONA,
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/** Descompone un instante en sus partes de calendario según la zona. */
export function partesEnZona(instante: Date): PartesFecha {
  const partes = formateadorPartes.formatToParts(instante);
  const valor = (tipo: Intl.DateTimeFormatPartTypes): number => {
    const encontrada = partes.find((p) => p.type === tipo);
    return encontrada ? Number(encontrada.value) : 0;
  };
  // Algunas versiones de ICU devuelven "24" para la medianoche con hour12:false.
  const hora = valor('hour') % 24;
  return {
    anio: valor('year'),
    mes: valor('month'),
    dia: valor('day'),
    hora,
    minuto: valor('minute'),
    segundo: valor('second'),
  };
}

/**
 * Minutos que la zona va por delante de UTC en ese instante.
 * Para America/Mexico_City devuelve −360.
 */
export function desfaseZonaMinutos(instante: Date): number {
  const p = partesEnZona(instante);
  const comoSiFueraUTC = Date.UTC(p.anio, p.mes - 1, p.dia, p.hora, p.minuto, p.segundo);
  // Se descartan los milisegundos: el desfase de una zona siempre es en minutos.
  const instanteSinMs = Math.floor(instante.getTime() / 1000) * 1000;
  return (comoSiFueraUTC - instanteSinMs) / 60_000;
}

/**
 * Convierte una hora de pared de la barbería a un instante UTC.
 *
 * desdeHoraLocal('2026-08-10', '09:00') → 2026-08-10T15:00:00.000Z
 *
 * Es la función que usa el motor de agenda para pasar los horarios del barbero
 * (guardados como `time` sin zona) a instantes comparables con las citas.
 */
export function desdeHoraLocal(fechaISO: string, horaHHMM: string): Date {
  const [anio, mes, dia] = fechaISO.split('-').map(Number);
  const [hora, minuto] = horaHHMM.split(':').map(Number);

  if (
    anio === undefined ||
    mes === undefined ||
    dia === undefined ||
    hora === undefined ||
    minuto === undefined ||
    Number.isNaN(anio) ||
    Number.isNaN(mes) ||
    Number.isNaN(dia) ||
    Number.isNaN(hora) ||
    Number.isNaN(minuto)
  ) {
    throw new RangeError(`Fecha u hora inválida: "${fechaISO}" "${horaHHMM}"`);
  }

  const comoUTC = Date.UTC(anio, mes - 1, dia, hora, minuto, 0);
  // Primera aproximación con el desfase en ese instante supuesto.
  const desfase1 = desfaseZonaMinutos(new Date(comoUTC));
  const candidato = new Date(comoUTC - desfase1 * 60_000);
  // Segunda pasada por si el desfase cambia en ese punto (cambio de horario).
  const desfase2 = desfaseZonaMinutos(candidato);
  return desfase2 === desfase1 ? candidato : new Date(comoUTC - desfase2 * 60_000);
}

/** Fecha de calendario en la zona, en formato ISO: "2026-08-10". */
export function fechaISOEnZona(instante: Date): string {
  const p = partesEnZona(instante);
  return `${p.anio}-${String(p.mes).padStart(2, '0')}-${String(p.dia).padStart(2, '0')}`;
}

/** Hora de pared en la zona: "09:30". */
export function horaHHMMEnZona(instante: Date): string {
  const p = partesEnZona(instante);
  return `${String(p.hora).padStart(2, '0')}:${String(p.minuto).padStart(2, '0')}`;
}

/** Día de la semana en la zona. 0 = domingo … 6 = sábado, igual que Postgres. */
export function diaSemanaEnZona(instante: Date): number {
  const p = partesEnZona(instante);
  // Se reconstruye como UTC para que getUTCDay() no reintroduzca la zona local.
  return new Date(Date.UTC(p.anio, p.mes - 1, p.dia)).getUTCDay();
}

/** ¿Ambos instantes caen el mismo día de calendario en la barbería? */
export function esMismoDia(a: Date, b: Date): boolean {
  return fechaISOEnZona(a) === fechaISOEnZona(b);
}

/** ¿Este instante cae hoy, según el reloj de la barbería? */
export function esHoy(instante: Date, ahora: Date = new Date()): boolean {
  return esMismoDia(instante, ahora);
}

export function sumarMinutos(instante: Date, minutos: number): Date {
  return new Date(instante.getTime() + minutos * 60_000);
}

export function sumarDias(instante: Date, dias: number): Date {
  return new Date(instante.getTime() + dias * 86_400_000);
}

/** Minutos de `b` menos `a`. Negativo si `b` es anterior. */
export function minutosEntre(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 60_000);
}

export function horasEntre(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / 3_600_000;
}

/** Convierte "09:30" a minutos desde medianoche. Devuelve null si es inválida. */
export function horaAMinutos(horaHHMM: string): number | null {
  const coincidencia = /^(\d{1,2}):(\d{2})$/.exec(horaHHMM.trim());
  if (!coincidencia) return null;
  const hora = Number(coincidencia[1]);
  const minuto = Number(coincidencia[2]);
  if (hora > 23 || minuto > 59) return null;
  return hora * 60 + minuto;
}

/** Inversa de la anterior: 570 → "09:30". */
export function minutosAHora(minutos: number): string {
  const total = ((minutos % 1440) + 1440) % 1440;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/* ── Presentación ───────────────────────────────────────────────────────── */

const fmtFechaLarga = new Intl.DateTimeFormat(LOCALE_FECHAS, {
  timeZone: ZONA,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const fmtFechaCorta = new Intl.DateTimeFormat(LOCALE_FECHAS, {
  timeZone: ZONA,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const fmtFechaMedia = new Intl.DateTimeFormat(LOCALE_FECHAS, {
  timeZone: ZONA,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

const fmtHora = new Intl.DateTimeFormat(LOCALE_FECHAS, {
  timeZone: ZONA,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

/** "lunes, 10 de agosto de 2026" */
export const formatearFechaLarga = (d: Date): string => fmtFechaLarga.format(d);

/** "10/08/2026" */
export const formatearFechaCorta = (d: Date): string => fmtFechaCorta.format(d);

/** "lun, 10 ago" */
export const formatearFechaMedia = (d: Date): string => fmtFechaMedia.format(d);

/** "9:00 a.m." */
export const formatearHora = (d: Date): string => fmtHora.format(d);

/** "lun, 10 ago · 9:00 a.m." */
export function formatearFechaHora(d: Date): string {
  return `${formatearFechaMedia(d)} · ${formatearHora(d)}`;
}

/** Rango de una cita: "9:00 a.m. – 9:45 a.m." */
export function formatearRangoHoras(inicio: Date, fin: Date): string {
  return `${formatearHora(inicio)} – ${formatearHora(fin)}`;
}

/** "en 2 h", "hace 3 días", "ahora". Para la agenda y la ficha del cliente. */
export function formatearRelativo(instante: Date, ahora: Date = new Date()): string {
  const rtf = new Intl.RelativeTimeFormat(LOCALE_FECHAS, { numeric: 'auto' });
  const segundos = Math.round((instante.getTime() - ahora.getTime()) / 1000);
  const abs = Math.abs(segundos);

  if (abs < 60) return 'ahora';
  if (abs < 3600) return rtf.format(Math.round(segundos / 60), 'minute');
  if (abs < 86_400) return rtf.format(Math.round(segundos / 3600), 'hour');
  if (abs < 2_592_000) return rtf.format(Math.round(segundos / 86_400), 'day');
  if (abs < 31_536_000) return rtf.format(Math.round(segundos / 2_592_000), 'month');
  return rtf.format(Math.round(segundos / 31_536_000), 'year');
}

/**
 * Genera marcas de tiempo cada N minutos entre dos horas de pared.
 * Es la base de la rejilla de horarios disponibles del sitio público.
 */
export function generarIntervalos(
  fechaISO: string,
  horaInicio: string,
  horaFin: string,
  intervaloMinutos: number
): Date[] {
  const inicio = horaAMinutos(horaInicio);
  const fin = horaAMinutos(horaFin);
  if (inicio === null || fin === null || intervaloMinutos <= 0 || fin <= inicio) return [];

  const marcas: Date[] = [];
  for (let m = inicio; m < fin; m += intervaloMinutos) {
    marcas.push(desdeHoraLocal(fechaISO, minutosAHora(m)));
  }
  return marcas;
}

/** ¿Se traslapan dos rangos? Intervalos semiabiertos [inicio, fin). */
export function seTraslapan(inicioA: Date, finA: Date, inicioB: Date, finB: Date): boolean {
  return inicioA.getTime() < finB.getTime() && inicioB.getTime() < finA.getTime();
}
