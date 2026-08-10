import type { Metadata, Viewport } from 'next';
import { variablesTipograficas } from '@/lib/fuentes';
import { env } from '@/lib/env';
import './globals.css';

/**
 * Layout raíz de la PLATAFORMA.
 *
 * Deliberadamente neutro: aquí no hay identidad de ninguna barbería. Los
 * metadatos, el favicon y los colores de cada negocio se generan en
 * `app/b/[slug]/layout.tsx`, que sí conoce la organización.
 */
export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
  title: {
    default: env.NEXT_PUBLIC_PLATFORM_NAME,
    template: `%s · ${env.NEXT_PUBLIC_PLATFORM_NAME}`,
  },
  description: 'Plataforma de administración para barberías: agenda, punto de venta e inventario.',
  applicationName: env.NEXT_PUBLIC_PLATFORM_NAME,
  formatDetection: { telephone: false, address: false, email: false },
  openGraph: { type: 'website', locale: 'es_MX', siteName: env.NEXT_PUBLIC_PLATFORM_NAME },
};

export const viewport: Viewport = {
  themeColor: '#0B0B0D',
  width: 'device-width',
  initialScale: 1,
};

export default function LayoutRaiz({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX" className={variablesTipograficas} suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        {/* Salto al contenido: primer elemento enfocable de la página. */}
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-sm focus:bg-marfil focus:px-4 focus:py-2 focus:text-sm focus:text-carbon"
        >
          Saltar al contenido
        </a>
        {children}
      </body>
    </html>
  );
}
