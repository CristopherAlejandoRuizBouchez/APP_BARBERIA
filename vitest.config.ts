import { defineConfig } from 'vitest/config';
import path from 'node:path';

/**
 * Configuración de pruebas unitarias.
 *
 * En la fase 0 solo hay pruebas de módulos puros —dinero, fechas, teléfono,
 * folios, entorno—, así que el entorno es `node` y no hacen falta ni jsdom ni
 * las utilidades de React. Se añadirán cuando existan pruebas de componentes:
 * arrastrar esas dependencias antes de usarlas solo alarga la instalación y
 * mete versiones que envejecen sin dar nada a cambio.
 */
export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'e2e'],

    // Las pruebas de fechas dependen de la zona de la barbería. Se fija
    // explícitamente para que el resultado no cambie según la máquina.
    env: { TZ: 'America/Mexico_City' },

    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/lib/**', 'src/modules/**/dominio.ts'],
      exclude: ['src/lib/fuentes.ts', 'src/lib/env.ts', 'src/lib/supabase/**'],
      thresholds: {
        // El dominio es donde los errores salen caros: dinero, horarios,
        // comisiones. Se exige cobertura alta ahí, no en la interfaz.
        lines: 80,
        functions: 80,
        branches: 75,
      },
    },
  },
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
});
