import type { NextConfig } from 'next';

/**
 * Cabeceras de seguridad aplicadas a todas las rutas.
 *
 * La CSP se declara aquí en su forma base. Cuando se conecte Supabase
 * (fase 2) el host del proyecto ya está contemplado mediante el comodín
 * *.supabase.co, que cubre tanto la API como Storage y Realtime.
 */
const cabecerasSeguridad = [
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // 'unsafe-inline' en scripts es necesario mientras no exista nonce por
      // petición; se sustituye por nonce en la fase 10 (endurecimiento).
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.supabase.co",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join('; '),
  },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()',
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // El sitio público se sirve en español de México.
  // Se declara en <html lang> dentro de app/layout.tsx.

  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },

  experimental: {
    // Reduce el JavaScript enviado al navegador al importar iconos sueltos.
    optimizePackageImports: ['lucide-react', 'recharts'],
  },

  async headers() {
    return [{ source: '/:path*', headers: cabecerasSeguridad }];
  },
};

export default nextConfig;
