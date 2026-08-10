import { describe, it, expect } from 'vitest';
import { generarFolio, normalizarFolio, esFolioValido, tipoDeFolio, PREFIJOS } from './folios';

/** Fuente determinista: siempre devuelve el mismo índice del alfabeto. */
const fija = (indice: number) => () => indice;

describe('generación de folios', () => {
  it('produce el prefijo correcto por tipo', () => {
    expect(generarFolio('cita', fija(0))).toBe('BQ-2222');
    expect(generarFolio('pedido', fija(0))).toBe('BQ-P-2222');
    expect(generarFolio('ventaMostrador', fija(0))).toBe('BQ-V-2222');
    expect(generarFolio('compra', fija(0))).toBe('BQ-C-2222');
  });

  it('usa cuatro caracteres de sufijo', () => {
    const folio = generarFolio('cita');
    expect(folio.split('-').pop()).toHaveLength(4);
  });

  it('evita caracteres que se confunden al dictar por teléfono', () => {
    const muestras = Array.from({ length: 300 }, () => generarFolio('cita'));
    const sufijos = muestras.map((f) => f.slice(3)).join('');
    for (const prohibido of ['0', 'O', '1', 'I', 'L', 'U', 'V']) {
      expect(sufijos, `contiene "${prohibido}"`).not.toContain(prohibido);
    }
  });

  it('no es correlativo: 200 folios dan muchos valores distintos', () => {
    const generados = new Set(Array.from({ length: 200 }, () => generarFolio('cita')));
    // Con 29^4 combinaciones, 200 tiradas casi nunca repiten.
    expect(generados.size).toBeGreaterThan(190);
  });
});

describe('normalización de lo que teclea el cliente', () => {
  it('acepta minúsculas, espacios y guion faltante', () => {
    expect(normalizarFolio('bq-4f7k')).toBe('BQ-4F7K');
    expect(normalizarFolio('BQ4F7K')).toBe('BQ-4F7K');
    expect(normalizarFolio('  bq 4f7k  ')).toBe('BQ-4F7K');
    expect(normalizarFolio('BQ_4F7K')).toBe('BQ-4F7K');
  });

  it('distingue un folio de cita de uno de pedido', () => {
    // "BQ-PQRS" es una cita cuyo sufijo empieza en P, no un pedido.
    expect(normalizarFolio('BQPQRS')).toBe('BQ-PQRS');
    expect(tipoDeFolio('BQPQRS')).toBe('cita');
    // "BQ-P-QRST" sí es un pedido.
    expect(normalizarFolio('BQPQRST')).toBe('BQ-P-QRST');
    expect(tipoDeFolio('BQPQRST')).toBe('pedido');
  });

  it('rechaza lo que no tiene forma de folio', () => {
    expect(normalizarFolio('')).toBeNull();
    expect(normalizarFolio(null)).toBeNull();
    expect(normalizarFolio('hola')).toBeNull();
    expect(normalizarFolio('BQ-123')).toBeNull(); // sufijo corto
    expect(normalizarFolio('BQ-4F7KX')).toBeNull(); // sufijo largo
    expect(normalizarFolio('BQ-4F7O')).toBeNull(); // la O no está en el alfabeto
    expect(normalizarFolio('XX-4F7K')).toBeNull(); // prefijo desconocido
  });

  it('expone un verificador booleano', () => {
    expect(esFolioValido('bq-4f7k')).toBe(true);
    expect(esFolioValido('nada')).toBe(false);
  });

  it('todo folio generado se vuelve a normalizar a sí mismo', () => {
    for (const tipo of Object.keys(PREFIJOS) as (keyof typeof PREFIJOS)[]) {
      for (let i = 0; i < 50; i += 1) {
        const folio = generarFolio(tipo);
        expect(normalizarFolio(folio), folio).toBe(folio);
        expect(tipoDeFolio(folio), folio).toBe(tipo);
      }
    }
  });
});
