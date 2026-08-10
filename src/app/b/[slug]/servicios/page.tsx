import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Clock3 } from 'lucide-react';
import { Boton } from '@/components/ui/boton';
import { formatearMXN } from '@/lib/dinero';
import { crearClientePublico } from '@/lib/supabase/servidor';
import { organizacionPorSlug } from '@/lib/tenant/resolver';

export const metadata: Metadata = { title: 'Servicios' };

export default async function ServiciosPublicos({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const org = await organizacionPorSlug(slug);
  if (!org) notFound();
  const { data } = await crearClientePublico()
    .from('services')
    .select(
      'id, nombre, descripcion, duracion_minutos, precio_centavos, service_categories(nombre)'
    )
    .eq('organization_id', org.id)
    .eq('activo', true)
    .order('orden')
    .order('nombre');
  return (
    <div className="mx-auto w-full px-5 py-16" style={{ maxWidth: 'var(--tema-ancho)' }}>
      <p className="etiqueta" style={{ color: 'var(--tema-primario)' }}>
        Carta de servicios
      </p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-[family-name:var(--tema-fuente-titulos)] text-5xl">
          Elige tu próximo look
        </h1>
        <Boton comoHijo variante="contorno">
          <Link href={`/b/${slug}/reservar`}>Reservar ahora</Link>
        </Boton>
      </div>
      <div className="mt-10 divide-y" style={{ borderColor: 'var(--tema-borde)' }}>
        {(data ?? []).map((s) => (
          <article key={s.id} className="grid gap-4 py-6 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <span className="etiqueta" style={{ color: 'var(--tema-primario)' }}>
                {(s.service_categories as unknown as { nombre?: string })?.nombre ?? 'Servicio'}
              </span>
              <h2 className="mt-2 font-[family-name:var(--tema-fuente-titulos)] text-3xl">
                {s.nombre}
              </h2>
              <p
                className="mt-2 max-w-2xl text-sm leading-relaxed"
                style={{ color: 'var(--tema-texto-suave)' }}
              >
                {s.descripcion}
              </p>
            </div>
            <div className="flex items-center gap-5 sm:text-right">
              <span
                className="flex items-center gap-1 text-sm"
                style={{ color: 'var(--tema-texto-suave)' }}
              >
                <Clock3 className="size-4" /> {s.duracion_minutos} min
              </span>
              <strong
                className="cifras font-[family-name:var(--tema-fuente-titulos)] text-2xl"
                style={{ color: 'var(--tema-primario)' }}
              >
                {formatearMXN(s.precio_centavos)}
              </strong>
            </div>
          </article>
        ))}
        {!data?.length ? (
          <p className="py-16 text-center" style={{ color: 'var(--tema-texto-suave)' }}>
            El catálogo se está preparando.
          </p>
        ) : null}
      </div>
    </div>
  );
}
