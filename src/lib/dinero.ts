/**
 * Manejo de importes.
 *
 * REGLA ABSOLUTA DEL PROYECTO: todo importe se representa como un entero de
 * centavos. Nunca un número con decimales.
 *
 * En coma flotante, 19.99 se almacena como 19.989999999999998. Sumar 200
 * tickets así produce una diferencia que alguien tiene que explicar en el
 * corte de caja. Con enteros eso no puede pasar.
 *
 * Las columnas de la base llevan el sufijo `_centavos` para que la convención
 * sea visible en cada consulta.
 */

export const MONEDA = 'MXN';
export const LOCALE = 'es-MX';

/** Un importe en centavos. Alias documental: sigue siendo `number`. */
export type Centavos = number;

const formateador = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: MONEDA,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formateadorCompacto = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: MONEDA,
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Convierte pesos (posiblemente con decimales) a centavos enteros. */
export function aCentavos(pesos: number): Centavos {
  if (!Number.isFinite(pesos)) {
    throw new TypeError(`Importe no numérico: ${String(pesos)}`);
  }
  return Math.round(pesos * 100);
}

/** Convierte centavos a pesos. Úsalo solo para mostrar, nunca para sumar. */
export function aPesos(centavos: Centavos): number {
  return centavos / 100;
}

/** Formatea centavos como moneda mexicana: 123450 → "$1,234.50". */
export function formatearMXN(centavos: Centavos): string {
  return formateador.format(aPesos(centavos));
}

/**
 * Formatea sin decimales cuando el importe es exacto.
 * Útil en tarjetas del catálogo, donde "$350" se lee mejor que "$350.00".
 */
export function formatearMXNCompacto(centavos: Centavos): string {
  return centavos % 100 === 0
    ? formateadorCompacto.format(aPesos(centavos))
    : formateador.format(aPesos(centavos));
}

/** Suma importes en centavos. Nunca uses `reduce` con pesos sueltos. */
export function sumar(...importes: Centavos[]): Centavos {
  return importes.reduce((total, actual) => total + actual, 0);
}

/** Multiplica un precio unitario por una cantidad entera. */
export function multiplicarPorCantidad(precioUnitario: Centavos, cantidad: number): Centavos {
  if (!Number.isInteger(cantidad) || cantidad < 0) {
    throw new RangeError(`Cantidad inválida: ${String(cantidad)}`);
  }
  return precioUnitario * cantidad;
}

/**
 * Aplica un factor multiplicador. Es lo que usa la cita exprés:
 * el multiplicador arranca en 2.0 y es configurable desde el panel.
 */
export function aplicarFactor(centavos: Centavos, factor: number): Centavos {
  if (!Number.isFinite(factor) || factor < 0) {
    throw new RangeError(`Factor inválido: ${String(factor)}`);
  }
  return Math.round(centavos * factor);
}

/** Calcula el monto de un porcentaje: base 50000 al 15 % → 7500. */
export function porcentajeDe(base: Centavos, porcentaje: number): Centavos {
  if (!Number.isFinite(porcentaje) || porcentaje < 0 || porcentaje > 100) {
    throw new RangeError(`Porcentaje fuera de rango (0–100): ${String(porcentaje)}`);
  }
  return Math.round((base * porcentaje) / 100);
}

/** Resta un descuento porcentual. Nunca baja de cero. */
export function aplicarDescuentoPorcentaje(base: Centavos, porcentaje: number): Centavos {
  return Math.max(0, base - porcentajeDe(base, porcentaje));
}

/** Comisión del barbero sobre una línea de venta. */
export function calcularComision(base: Centavos, porcentaje: number): Centavos {
  return porcentajeDe(base, porcentaje);
}

/**
 * Reparte un importe entre N partes sin perder ni un centavo.
 *
 * Repartir $100 entre 3 da 33.34 + 33.33 + 33.33, no 33.33 × 3 = 99.99.
 * Los centavos sobrantes se asignan a las primeras partes.
 */
export function repartir(total: Centavos, partes: number): Centavos[] {
  if (!Number.isInteger(partes) || partes <= 0) {
    throw new RangeError(`Número de partes inválido: ${String(partes)}`);
  }
  const base = Math.floor(total / partes);
  const sobrante = total - base * partes;
  return Array.from({ length: partes }, (_, i) => base + (i < sobrante ? 1 : 0));
}

/** Cambio a devolver en efectivo. Negativo significa que falta dinero. */
export function calcularCambio(totalVenta: Centavos, recibido: Centavos): Centavos {
  return recibido - totalVenta;
}

/**
 * Interpreta lo que un cajero escribe: "1,234.50", "$1234.5", "1234".
 * Devuelve null si no se puede interpretar, nunca NaN.
 */
export function parsearImporte(texto: string): Centavos | null {
  const limpio = texto.replace(/[\s$,]/g, '').replace(/[^\d.-]/g, '');
  if (limpio === '' || limpio === '-' || limpio === '.') return null;
  const valor = Number(limpio);
  if (!Number.isFinite(valor)) return null;
  return aCentavos(valor);
}

/** Verifica que la suma de pagos cuadre exactamente con el total de la venta. */
export function pagosCuadran(totalVenta: Centavos, pagos: Centavos[]): boolean {
  return sumar(...pagos) === totalVenta;
}

/** Margen sobre precio de venta, en porcentaje con un decimal. */
export function margenPorcentaje(precioVenta: Centavos, costo: Centavos): number {
  if (precioVenta <= 0) return 0;
  return Math.round(((precioVenta - costo) / precioVenta) * 1000) / 10;
}
