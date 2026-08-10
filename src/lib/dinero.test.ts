import { describe, it, expect } from 'vitest';
import {
  aCentavos,
  aPesos,
  formatearMXN,
  formatearMXNCompacto,
  sumar,
  multiplicarPorCantidad,
  aplicarFactor,
  porcentajeDe,
  aplicarDescuentoPorcentaje,
  calcularComision,
  repartir,
  calcularCambio,
  parsearImporte,
  pagosCuadran,
  margenPorcentaje,
} from './dinero';

describe('conversión de importes', () => {
  it('convierte pesos a centavos sin arrastrar error de coma flotante', () => {
    expect(aCentavos(19.99)).toBe(1999);
    expect(aCentavos(0.1)).toBe(10);
    expect(aCentavos(1234.56)).toBe(123456);
    expect(aCentavos(0)).toBe(0);
  });

  it('redondea al centavo más cercano', () => {
    expect(aCentavos(10.005)).toBe(1001);
    expect(aCentavos(10.004)).toBe(1000);
  });

  it('rechaza valores no numéricos', () => {
    expect(() => aCentavos(Number.NaN)).toThrow(TypeError);
    expect(() => aCentavos(Number.POSITIVE_INFINITY)).toThrow(TypeError);
  });

  it('vuelve a pesos', () => {
    expect(aPesos(1999)).toBe(19.99);
  });
});

describe('el problema que motiva usar enteros', () => {
  it('sumar 200 tickets de $19.99 en centavos da exacto', () => {
    const tickets = Array.from({ length: 200 }, () => 1999);
    expect(sumar(...tickets)).toBe(399800);
  });

  it('la misma suma en coma flotante NO da exacto', () => {
    const enPesos = Array.from({ length: 200 }, () => 19.99).reduce((a, b) => a + b, 0);
    expect(enPesos).not.toBe(3998);
    expect(Math.abs(enPesos - 3998)).toBeGreaterThan(0);
  });
});

describe('formato de moneda mexicana', () => {
  it('formatea con dos decimales', () => {
    expect(formatearMXN(123450)).toContain('1,234.50');
    expect(formatearMXN(0)).toContain('0.00');
  });

  it('omite decimales cuando el importe es exacto en modo compacto', () => {
    expect(formatearMXNCompacto(35000)).not.toContain('.00');
    expect(formatearMXNCompacto(35050)).toContain('.50');
  });
});

describe('operaciones de ticket', () => {
  it('multiplica precio por cantidad', () => {
    expect(multiplicarPorCantidad(52000, 3)).toBe(156000);
    expect(multiplicarPorCantidad(52000, 0)).toBe(0);
  });

  it('rechaza cantidades no enteras o negativas', () => {
    expect(() => multiplicarPorCantidad(1000, 1.5)).toThrow(RangeError);
    expect(() => multiplicarPorCantidad(1000, -1)).toThrow(RangeError);
  });

  it('calcula un porcentaje', () => {
    expect(porcentajeDe(50000, 15)).toBe(7500);
    expect(porcentajeDe(33333, 10)).toBe(3333);
  });

  it('rechaza porcentajes fuera de rango', () => {
    expect(() => porcentajeDe(1000, -1)).toThrow(RangeError);
    expect(() => porcentajeDe(1000, 101)).toThrow(RangeError);
  });

  it('aplica descuento sin bajar de cero', () => {
    expect(aplicarDescuentoPorcentaje(50000, 10)).toBe(45000);
    expect(aplicarDescuentoPorcentaje(50000, 100)).toBe(0);
  });

  it('calcula el cambio en efectivo', () => {
    expect(calcularCambio(43500, 50000)).toBe(6500);
    expect(calcularCambio(43500, 40000)).toBe(-3500);
  });
});

describe('multiplicador de cita exprés', () => {
  it('duplica el precio con el factor 2 predeterminado', () => {
    expect(aplicarFactor(35000, 2)).toBe(70000);
  });

  it('admite factores configurables con decimales', () => {
    expect(aplicarFactor(35000, 1.5)).toBe(52500);
    expect(aplicarFactor(33333, 1.75)).toBe(58333);
  });

  it('rechaza factores inválidos', () => {
    expect(() => aplicarFactor(1000, -1)).toThrow(RangeError);
    expect(() => aplicarFactor(1000, Number.NaN)).toThrow(RangeError);
  });
});

describe('comisiones del barbero', () => {
  it('calcula la comisión sobre la base', () => {
    expect(calcularComision(35000, 40)).toBe(14000);
    expect(calcularComision(52000, 12.5)).toBe(6500);
  });
});

describe('reparto sin perder centavos', () => {
  it('reparte $100 entre 3 sin que falte nada', () => {
    const partes = repartir(10000, 3);
    expect(partes).toEqual([3334, 3333, 3333]);
    expect(sumar(...partes)).toBe(10000);
  });

  it('reparte exacto cuando es divisible', () => {
    expect(repartir(9000, 3)).toEqual([3000, 3000, 3000]);
  });

  it('rechaza un número de partes inválido', () => {
    expect(() => repartir(1000, 0)).toThrow(RangeError);
    expect(() => repartir(1000, 2.5)).toThrow(RangeError);
  });
});

describe('interpretación de lo que teclea el cajero', () => {
  it('acepta las formas habituales', () => {
    expect(parsearImporte('1,234.50')).toBe(123450);
    expect(parsearImporte('$1234.5')).toBe(123450);
    expect(parsearImporte('1234')).toBe(123400);
    expect(parsearImporte(' 350 ')).toBe(35000);
  });

  it('devuelve null en vez de NaN ante basura', () => {
    expect(parsearImporte('')).toBeNull();
    expect(parsearImporte('abc')).toBeNull();
    expect(parsearImporte('$')).toBeNull();
  });
});

describe('pagos divididos (corrección v1.1)', () => {
  it('acepta la suma que cuadra exactamente', () => {
    // $200 efectivo + $300 transferencia = $500
    expect(pagosCuadran(50000, [20000, 30000])).toBe(true);
  });

  it('rechaza por un solo centavo de diferencia', () => {
    expect(pagosCuadran(50000, [20000, 29999])).toBe(false);
    expect(pagosCuadran(50000, [20000, 30001])).toBe(false);
  });

  it('acepta el caso común de un solo método', () => {
    expect(pagosCuadran(35000, [35000])).toBe(true);
  });

  it('rechaza una venta sin pagos', () => {
    expect(pagosCuadran(35000, [])).toBe(false);
  });
});

describe('margen de producto', () => {
  it('calcula el margen sobre precio de venta', () => {
    expect(margenPorcentaje(52000, 26000)).toBe(50);
    expect(margenPorcentaje(30000, 21000)).toBe(30);
  });

  it('no divide entre cero', () => {
    expect(margenPorcentaje(0, 1000)).toBe(0);
  });
});
