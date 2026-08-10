import localFont from 'next/font/local';

/**
 * Tipografías del sistema, autoalojadas con next/font/local.
 *
 * Autoalojadas y no vía next/font/google a propósito:
 *   · cero peticiones a servidores de terceros (privacidad y CSP estricta)
 *   · sin parpadeo de texto ni salto de maquetación
 *   · el build funciona sin acceso de red a Google Fonts
 *
 * Los archivos viven en src/fuentes/ junto con sus licencias SIL OFL 1.1.
 *
 * ─── Cómo cambiar la tipografía ────────────────────────────────────────────
 * Todo el sistema lee tres variables CSS: --fuente-display, --fuente-ui y
 * --fuente-mono. Para sustituir una familia basta con dejar los archivos en
 * src/fuentes/ y cambiar las rutas de este archivo. Ningún componente
 * referencia un nombre de fuente directamente.
 */

/** Titulares y cifras destacadas. Serif de alto contraste, registro editorial. */
export const fuenteDisplay = localFont({
  src: [
    { path: '../fuentes/InstrumentSerif-Regular.ttf', weight: '400', style: 'normal' },
    { path: '../fuentes/InstrumentSerif-Italic.ttf', weight: '400', style: 'italic' },
  ],
  variable: '--fuente-display',
  display: 'swap',
  preload: true,
  fallback: ['Iowan Old Style', 'Georgia', 'serif'],
});

/** Interfaz, cuerpo, formularios y tablas. Grotesca neutra. */
export const fuenteUi = localFont({
  src: [
    { path: '../fuentes/InstrumentSans-Regular.ttf', weight: '400', style: 'normal' },
    { path: '../fuentes/InstrumentSans-Italic.ttf', weight: '400', style: 'italic' },
    { path: '../fuentes/InstrumentSans-Bold.ttf', weight: '700', style: 'normal' },
  ],
  variable: '--fuente-ui',
  display: 'swap',
  preload: true,
  fallback: ['ui-sans-serif', 'system-ui', 'sans-serif'],
});

/** SKU, códigos de barras, folios y bloques de código. */
export const fuenteMono = localFont({
  src: [{ path: '../fuentes/JetBrainsMono-Regular.ttf', weight: '400', style: 'normal' }],
  variable: '--fuente-mono',
  display: 'swap',
  preload: false,
  fallback: ['ui-monospace', 'SFMono-Regular', 'monospace'],
});

/** Clases que se aplican al elemento <html> en el layout raíz. */
export const variablesTipograficas = [
  fuenteDisplay.variable,
  fuenteUi.variable,
  fuenteMono.variable,
].join(' ');
