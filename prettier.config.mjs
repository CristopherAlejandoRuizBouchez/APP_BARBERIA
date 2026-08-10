/**
 * Configuración de Prettier.
 *
 * Sin plugins a propósito. `prettier-plugin-tailwindcss` es útil —ordena las
 * clases de Tailwind de forma canónica— pero al añadirlo, `format:check`
 * empieza a exigir ese orden y falla en cualquier archivo escrito a mano hasta
 * que se corre `pnpm format`. Sin él, el resultado de `format:check` depende
 * solo de reglas de Prettier, que son estables y verificables sin instalar nada
 * más.
 *
 * Para activarlo cuando quieras:
 *   1. pnpm add -D prettier-plugin-tailwindcss
 *   2. añade `plugins: ['prettier-plugin-tailwindcss']` aquí abajo
 *   3. corre `pnpm format` una vez y confirma el resultado
 *
 * @type {import('prettier').Config}
 */
export default {
  semi: true,
  singleQuote: true,
  jsxSingleQuote: false,
  trailingComma: 'es5',
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  arrowParens: 'always',
  endOfLine: 'lf',
};
