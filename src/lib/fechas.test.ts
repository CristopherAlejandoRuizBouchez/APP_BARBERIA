import { describe, it, expect } from 'vitest';
import {
  ZONA,
  partesEnZona,
  desfaseZonaMinutos,
  desdeHoraLocal,
  fechaISOEnZona,
  horaHHMMEnZona,
  diaSemanaEnZona,
  esMismoDia,
  sumarMinutos,
  minutosEntre,
  horasEntre,
  horaAMinutos,
  minutosAHora,
  generarIntervalos,
  seTraslapan,
} from './fechas';

describe('zona horaria de la barbería', () => {
  it('opera sobre America/Mexico_City', () => {
    expect(ZONA).toBe('America/Mexico_City');
  });

  it('el desfase es −6 h todo el año (México no aplica horario de verano)', () => {
    // Invierno y verano deben dar el mismo desfase.
    expect(desfaseZonaMinutos(new Date('2026-01-15T12:00:00Z'))).toBe(-360);
    expect(desfaseZonaMinutos(new Date('2026-07-15T12:00:00Z'))).toBe(-360);
  });

  it('descompone un instante en partes locales', () => {
    const p = partesEnZona(new Date('2026-08-10T15:30:00Z'));
    expect(p).toMatchObject({ anio: 2026, mes: 8, dia: 10, hora: 9, minuto: 30 });
  });
});

describe('hora de pared → instante UTC', () => {
  it('convierte las 9:00 de la barbería a las 15:00 UTC', () => {
    expect(desdeHoraLocal('2026-08-10', '09:00').toISOString()).toBe('2026-08-10T15:00:00.000Z');
  });

  it('es reversible', () => {
    const instante = desdeHoraLocal('2026-08-10', '19:45');
    expect(fechaISOEnZona(instante)).toBe('2026-08-10');
    expect(horaHHMMEnZona(instante)).toBe('19:45');
  });

  it('maneja la medianoche sin cambiar de día', () => {
    const medianoche = desdeHoraLocal('2026-08-10', '00:00');
    expect(fechaISOEnZona(medianoche)).toBe('2026-08-10');
    expect(horaHHMMEnZona(medianoche)).toBe('00:00');
  });

  it('el instante de las 20:00 CDMX ya es el día siguiente en UTC', () => {
    // Este es exactamente el error que evita guardar timestamptz.
    const cita = desdeHoraLocal('2026-08-10', '20:00');
    expect(cita.toISOString()).toBe('2026-08-11T02:00:00.000Z');
    expect(fechaISOEnZona(cita)).toBe('2026-08-10'); // sigue siendo cita del lunes
  });

  it('rechaza entradas inválidas', () => {
    expect(() => desdeHoraLocal('no-es-fecha', '09:00')).toThrow(RangeError);
    expect(() => desdeHoraLocal('2026-08-10', 'nueve')).toThrow(RangeError);
  });
});

describe('calendario en la zona local', () => {
  it('devuelve el día de la semana con la convención de Postgres (0 = domingo)', () => {
    expect(diaSemanaEnZona(desdeHoraLocal('2026-08-09', '12:00'))).toBe(0); // domingo
    expect(diaSemanaEnZona(desdeHoraLocal('2026-08-10', '12:00'))).toBe(1); // lunes
    expect(diaSemanaEnZona(desdeHoraLocal('2026-08-15', '12:00'))).toBe(6); // sábado
  });

  it('el día de la semana se calcula en CDMX, no en UTC', () => {
    // Domingo 20:00 CDMX = lunes 02:00 UTC. Debe seguir siendo domingo.
    const domingoNoche = desdeHoraLocal('2026-08-09', '20:00');
    expect(domingoNoche.getUTCDay()).toBe(1);
    expect(diaSemanaEnZona(domingoNoche)).toBe(0);
  });

  it('compara días de calendario locales', () => {
    const a = desdeHoraLocal('2026-08-10', '09:00');
    const b = desdeHoraLocal('2026-08-10', '21:00');
    const c = desdeHoraLocal('2026-08-11', '09:00');
    expect(esMismoDia(a, b)).toBe(true);
    expect(esMismoDia(a, c)).toBe(false);
  });
});

describe('aritmética de duración', () => {
  it('suma minutos', () => {
    const inicio = desdeHoraLocal('2026-08-10', '09:00');
    expect(horaHHMMEnZona(sumarMinutos(inicio, 45))).toBe('09:45');
  });

  it('mide minutos y horas entre instantes', () => {
    const a = desdeHoraLocal('2026-08-10', '09:00');
    const b = desdeHoraLocal('2026-08-10', '10:30');
    expect(minutosEntre(a, b)).toBe(90);
    expect(horasEntre(a, b)).toBe(1.5);
    expect(minutosEntre(b, a)).toBe(-90);
  });
});

describe('conversión hora ↔ minutos', () => {
  it('convierte en ambos sentidos', () => {
    expect(horaAMinutos('09:30')).toBe(570);
    expect(horaAMinutos('00:00')).toBe(0);
    expect(horaAMinutos('23:59')).toBe(1439);
    expect(minutosAHora(570)).toBe('09:30');
    expect(minutosAHora(0)).toBe('00:00');
  });

  it('rechaza horas imposibles', () => {
    expect(horaAMinutos('25:00')).toBeNull();
    expect(horaAMinutos('09:75')).toBeNull();
    expect(horaAMinutos('nueve')).toBeNull();
  });
});

describe('rejilla de horarios disponibles', () => {
  it('genera intervalos de 15 minutos', () => {
    const marcas = generarIntervalos('2026-08-10', '09:00', '10:00', 15);
    expect(marcas).toHaveLength(4);
    expect(marcas.map(horaHHMMEnZona)).toEqual(['09:00', '09:15', '09:30', '09:45']);
  });

  it('excluye la hora de cierre (intervalo semiabierto)', () => {
    const marcas = generarIntervalos('2026-08-10', '09:00', '10:00', 30);
    expect(marcas.map(horaHHMMEnZona)).toEqual(['09:00', '09:30']);
  });

  it('devuelve vacío ante parámetros sin sentido', () => {
    expect(generarIntervalos('2026-08-10', '10:00', '09:00', 15)).toEqual([]);
    expect(generarIntervalos('2026-08-10', '09:00', '10:00', 0)).toEqual([]);
  });
});

describe('detección de traslape (espejo del EXCLUDE de Postgres)', () => {
  const cita = (desde: string, hasta: string) =>
    [desdeHoraLocal('2026-08-10', desde), desdeHoraLocal('2026-08-10', hasta)] as const;

  it('detecta el traslape parcial', () => {
    const [a1, a2] = cita('09:00', '09:45');
    const [b1, b2] = cita('09:30', '10:15');
    expect(seTraslapan(a1, a2, b1, b2)).toBe(true);
  });

  it('detecta cuando una cita contiene a la otra', () => {
    const [a1, a2] = cita('09:00', '11:00');
    const [b1, b2] = cita('09:30', '10:00');
    expect(seTraslapan(a1, a2, b1, b2)).toBe(true);
  });

  it('NO considera traslape que una termine donde empieza la otra', () => {
    const [a1, a2] = cita('09:00', '09:45');
    const [b1, b2] = cita('09:45', '10:30');
    expect(seTraslapan(a1, a2, b1, b2)).toBe(false);
  });

  it('no marca traslape en citas separadas', () => {
    const [a1, a2] = cita('09:00', '09:45');
    const [b1, b2] = cita('11:00', '11:45');
    expect(seTraslapan(a1, a2, b1, b2)).toBe(false);
  });
});
