import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { crearClientePublico } from '@/lib/supabase/servidor';
import { organizacionPorSlug } from '@/lib/tenant/resolver';

export const metadata: Metadata = { title: 'Galería' };

export default async function Galeria({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const org = await organizacionPorSlug(slug);
  if (!org) notFound();
  const { data } = await crearClientePublico()
    .from('gallery_items')
    .select('id, titulo, imagen_url')
    .eq('organization_id', org.id)
    .eq('activo', true)
    .order('orden')
    .order('creado_en', { ascending: false });
  return (
    <div className="mx-auto w-full px-5 py-16" style={{ maxWidth: 'var(--tema-ancho)' }}>
      <p className="etiqueta" style={{ color: 'var(--tema-primario)' }}>
        Nuestro trabajo
      </p>
      <h1 className="mt-3 font-[family-name:var(--tema-fuente-titulos)] text-5xl">Galería</h1>
      <p className="mt-4 max-w-2xl" style={{ color: 'var(--tema-texto-suave)' }}>
        Conoce algunos de nuestros cortes, estilos y acabados realizados en la barbería.
      </p>
      {data?.length ? (
        <div className="mt-10 columns-1 gap-4 sm:columns-2 lg:columns-3">
          {data.map((g) => (
            <figure
              key={g.id}
              className="group mb-4 break-inside-avoid overflow-hidden border"
              style={{
                borderColor: 'var(--tema-borde)',
                background: 'var(--tema-superficie)',
                borderRadius: 'var(--tema-radio)',
              }}
            >
              <div className="overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={g.imagen_url}
                  alt={g.titulo ?? 'Trabajo de barbería'}
                  loading="lazy"
                  className="h-auto w-full transition-transform duration-500 group-hover:scale-[1.025]"
                />
              </div>
              {g.titulo ? (
                <figcaption className="p-4">
                  <span
                    className="text-[10px] font-semibold uppercase tracking-[0.18em]"
                    style={{ color: 'var(--tema-primario)' }}
                  >
                    Trabajo realizado
                  </span>
                  <p
                    className="mt-2 text-sm leading-relaxed"
                    style={{ color: 'var(--tema-texto-suave)' }}
                  >
                    {g.titulo}
                  </p>
                </figcaption>
              ) : null}
            </figure>
          ))}
        </div>
      ) : (
        <p
          className="mt-10 border p-10 text-center"
          style={{ borderColor: 'var(--tema-borde)', color: 'var(--tema-texto-suave)' }}
        >
          Aún no hay trabajos publicados en la galería.
        </p>
      )}
    </div>
  );
}
