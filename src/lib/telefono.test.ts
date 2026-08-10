import { describe, it, expect } from 'vitest';
import {
  normalizarTelefono,
  esTelefonoValido,
  parteNacional,
  formatearTelefono,
  ultimosCuatro,
  enmascararTelefono,
  paraEnlaceWhatsApp,
  enlaceWhatsApp,
} from './telefono';

const CANONICO = '+525512345678';

describe('normalización a E.164', () => {
  it('acepta las formas en que la gente escribe su número', () => {
    const equivalentes = [
      '5512345678',
      '55 1234 5678',
      '55-1234-5678',
      '(55) 1234 5678',
      '525512345678',
      '+52 55 1234 5678',
      '+525512345678',
    ];
    for (const entrada of equivalentes) {
      expect(normalizarTelefono(entrada), entrada).toBe(CANONICO);
    }
  });

  it('quita el 1 del formato antiguo de WhatsApp', () => {
    expect(normalizarTelefono('5215512345678')).toBe(CANONICO);
    expect(normalizarTelefono('+521 55 1234 5678')).toBe(CANONICO);
  });

  it('es lo que evita que el mismo cliente se duplique', () => {
    const desdeElSitio = normalizarTelefono('55 1234 5678');
    const desdeElMostrador = normalizarTelefono('+52 (55) 1234-5678');
    const desdeWhatsApp = normalizarTelefono('5215512345678');
    expect(desdeElSitio).toBe(desdeElMostrador);
    expect(desdeElMostrador).toBe(desdeWhatsApp);
  });

  it('rechaza lo que no es un teléfono mexicano válido', () => {
    expect(normalizarTelefono('')).toBeNull();
    expect(normalizarTelefono(null)).toBeNull();
    expect(normalizarTelefono(undefined)).toBeNull();
    expect(normalizarTelefono('123')).toBeNull();
    expect(normalizarTelefono('55123456789012')).toBeNull();
    expect(normalizarTelefono('abcdefghij')).toBeNull();
    expect(normalizarTelefono('0512345678')).toBeNull(); // ninguna lada empieza en 0
  });

  it('rechaza números que no son mexicanos', () => {
    // Lada de país explícita distinta de 52.
    expect(normalizarTelefono('+1 415 555 0100')).toBeNull();
    expect(normalizarTelefono('+34 612 345 678')).toBeNull();
    expect(normalizarTelefono('+57 300 123 4567')).toBeNull();
  });

  it('rechaza el formato ambiguo de 11 dígitos que empieza en 1', () => {
    // "14155550100" podría ser +1 415 555 0100 (EE. UU.) o un mexicano viejo
    // guardado como "1 + 10 dígitos". Las ladas de ambos países se solapan, así
    // que no hay forma de distinguirlos: es preferible pedir que lo reescriban
    // a dar de alta un cliente con el teléfono equivocado.
    expect(normalizarTelefono('14155550100')).toBeNull();
    expect(normalizarTelefono('15512345678')).toBeNull();
  });

  it('expone un verificador booleano', () => {
    expect(esTelefonoValido('5512345678')).toBe(true);
    expect(esTelefonoValido('123')).toBe(false);
  });
});

describe('presentación', () => {
  it('extrae la parte nacional', () => {
    expect(parteNacional(CANONICO)).toBe('5512345678');
  });

  it('agrupa 2-4-4 en ladas de dos dígitos', () => {
    expect(formatearTelefono(CANONICO)).toBe('55 1234 5678');
    expect(formatearTelefono('+528112345678')).toBe('81 1234 5678');
  });

  it('agrupa 3-3-4 en ladas del interior', () => {
    expect(formatearTelefono('+524771234567')).toBe('477 123 4567');
  });

  it('devuelve cadena vacía sin número', () => {
    expect(formatearTelefono(null)).toBe('');
    expect(formatearTelefono(undefined)).toBe('');
  });

  it('da los últimos cuatro dígitos que pide "Mi cita"', () => {
    expect(ultimosCuatro(CANONICO)).toBe('5678');
  });

  it('enmascara para pantallas compartidas', () => {
    expect(enmascararTelefono(CANONICO)).toBe('•• •••• 5678');
    expect(enmascararTelefono(CANONICO)).not.toContain('1234');
  });
});

describe('enlaces de WhatsApp', () => {
  it('quita el signo + para wa.me', () => {
    expect(paraEnlaceWhatsApp('55 1234 5678')).toBe('525512345678');
    expect(paraEnlaceWhatsApp('no es un teléfono')).toBeNull();
  });

  it('construye el enlace con el mensaje codificado', () => {
    const url = enlaceWhatsApp('5512345678', 'Hola, quiero recoger mi pedido BQ-P-2841');
    expect(url).toBe(
      'https://wa.me/525512345678?text=Hola%2C%20quiero%20recoger%20mi%20pedido%20BQ-P-2841'
    );
  });

  it('codifica saltos de línea y acentos del pedido', () => {
    const url = enlaceWhatsApp('5512345678', 'Pomada mate\nTotal: $860.00');
    expect(url).toContain('%0A');
    expect(url).toContain('%24860.00');
  });

  it('devuelve null si el número no es válido', () => {
    expect(enlaceWhatsApp('123', 'hola')).toBeNull();
  });
});
