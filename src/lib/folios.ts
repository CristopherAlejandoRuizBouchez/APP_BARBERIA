/**
 * Folios legibles para citas, ventas y pedidos.
 *
 * Dos requisitos que chocan y hay que resolver a la vez:
 *
 *  1. Se dictan en voz alta por teléfono. Nada de UUID.
 *  2. No deben ser adivinables. Si el folio fuera correlativo, cualquiera
 *     podría probar BQ-0001, BQ-0002… y enumerar las citas de otros clientes
 *     en la pantalla "Mi cita".
 *
 * Solución: prefijo + 4 caracteres aleatorios de un alfabeto sin ambigüedades.
 * 32^4 = poco más de un millón de combinaciones por prefijo, con verificación
 * de unicidad en la base mediante índice único.
 */

/** Sin 0/O, 1/I/L ni U/V: los caracteres que se confunden al dictar. */
const ALFABETO = '23456789ABCDEFGHJKMNPQRSTWXYZ';
const LARGO = 4;

export const PREFIJOS = {
  cita: 'BQ',
  ventaMostrador: 'BQ-V',
  pedido: 'BQ-P',
  compra: 'BQ-C',
} as const;

export type TipoFolio = keyof typeof PREFIJOS;

/** Fuente de aleatoriedad. Se puede inyectar para hacer las pruebas deterministas. */
export type FuenteAleatoria = (max: number) => number;

const aleatorioSeguro: FuenteAleatoria = (max) => {
  // crypto.getRandomValues existe tanto en Node 22 como en el navegador.
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  const valor = buffer[0] ?? 0;
  return valor % max;
};

/**
 * Genera un folio: generarFolio('cita') → "BQ-4F7K"
 * El sufijo aleatorio evita la enumeración; el prefijo dice de qué se trata.
 */
export function generarFolio(
  tipo: TipoFolio,
  aleatorio: FuenteAleatoria = aleatorioSeguro
): string {
  let sufijo = '';
  for (let i = 0; i < LARGO; i += 1) {
    sufijo += ALFABETO[aleatorio(ALFABETO.length)] ?? ALFABETO[0];
  }
  return `${PREFIJOS[tipo]}-${sufijo}`;
}

/**
 * Normaliza lo que el cliente escribe: minúsculas, espacios, guion faltante.
 * "bq 4f7k" y "bq-4f7k" llegan al mismo folio.
 */
export function normalizarFolio(entrada: string | null | undefined): string | null {
  if (!entrada) return null;
  const limpio = entrada.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (limpio.length < 5) return null;

  // Se prueban los prefijos de más largo a más corto para que "BQV" no se
  // confunda con "BQ" seguido de una V.
  const prefijos = Object.values(PREFIJOS).sort((a, b) => b.length - a.length);
  for (const prefijo of prefijos) {
    const compacto = prefijo.replace('-', '');
    if (limpio.startsWith(compacto)) {
      const sufijo = limpio.slice(compacto.length);
      if (sufijo.length !== LARGO) continue;
      if (![...sufijo].every((c) => ALFABETO.includes(c))) continue;
      return `${prefijo}-${sufijo}`;
    }
  }
  return null;
}

/** ¿Tiene forma de folio válido? No dice si existe: eso lo responde la base. */
export function esFolioValido(entrada: string | null | undefined): boolean {
  return normalizarFolio(entrada) !== null;
}

/** Deduce el tipo a partir del folio. Útil para enrutar la búsqueda global. */
export function tipoDeFolio(entrada: string | null | undefined): TipoFolio | null {
  const folio = normalizarFolio(entrada);
  if (!folio) return null;
  const entradas = Object.entries(PREFIJOS) as [TipoFolio, string][];
  const encontrado = entradas
    .sort((a, b) => b[1].length - a[1].length)
    .find(([, prefijo]) => folio.startsWith(`${prefijo}-`));
  return encontrado ? encontrado[0] : null;
}
