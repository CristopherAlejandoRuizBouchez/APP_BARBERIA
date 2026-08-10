import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';
import { crearClientePublico } from '@/lib/supabase/servidor';

export const revalidate = 300;

const SUBRUTAS = [
  { ruta: '', prioridad: 0.9, frecuencia: 'weekly' as const },
  { ruta: '/servicios', prioridad: 0.8, frecuencia: 'weekly' as const },
  { ruta: '/barberos', prioridad: 0.7, frecuencia: 'weekly' as const },
  { ruta: '/reservar', prioridad: 0.9, frecuencia: 'daily' as const },
  { ruta: '/tienda', prioridad: 0.8, frecuencia: 'daily' as const },
  { ruta: '/galeria', prioridad: 0.6, frecuencia: 'weekly' as const },
  { ruta: '/contacto', prioridad: 0.6, frecuencia: 'monthly' as const },
  { ruta: '/privacidad', prioridad: 0.2, frecuencia: 'yearly' as const },
  { ruta: '/terminos', prioridad: 0.2, frecuencia: 'yearly' as const },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const ahora = new Date();
  const mapa: MetadataRoute.Sitemap = [
    {
      url: env.NEXT_PUBLIC_APP_URL,
      lastModified: ahora,
      changeFrequency: 'weekly',
      priority: 1,
    },
  ];
  try {
    const { data } = await crearClientePublico()
      .from('organizations')
      .select('slug, actualizado_en')
      .eq('estado', 'active');
    for (const org of data ?? []) {
      for (const subruta of SUBRUTAS) {
        mapa.push({
          url: `${env.NEXT_PUBLIC_APP_URL}/b/${org.slug}${subruta.ruta}`,
          lastModified: new Date(org.actualizado_en ?? ahora),
          changeFrequency: subruta.frecuencia,
          priority: subruta.prioridad,
        });
      }
    }
  } catch {
    // El build puede ejecutarse antes de configurar Supabase.
  }
  return mapa;
}
