import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // El panel, la autenticación y las rutas internas nunca se indexan.
        disallow: ['/panel/', '/api/', '/iniciar-sesion', '/recuperar', '/mi-cita'],
      },
    ],
    sitemap: `${env.NEXT_PUBLIC_APP_URL}/sitemap.xml`,
  };
}
