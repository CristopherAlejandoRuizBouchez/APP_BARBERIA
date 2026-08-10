import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { UserRound } from 'lucide-react';
import { Boton } from '@/components/ui/boton';
import { crearClientePublico } from '@/lib/supabase/servidor';
import { organizacionPorSlug } from '@/lib/tenant/resolver';

export const metadata: Metadata = { title: 'Barberos' };

export default async function BarberosPublicos({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const org = await organizacionPorSlug(slug);
  if (!org) notFound();
  const { data } = await crearClientePublico()
    .from('barbers')
    .select('id, nombre, apodo, bio, foto_url, especialidades')
    .eq('organization_id', org.id)
    .eq('activo', true)
    .order('orden')
    .order('nombre');
  return (
    <div className="mx-auto w-full px-5 py-16" style={{ maxWidth: 'var(--tema-ancho)' }}>
      <p className="etiqueta" style={{ color: 'var(--tema-primario)' }}>
        El equipo
      </p>
      <h1 className="mt-3 max-w-3xl font-[family-name:var(--tema-fuente-titulos)] text-5xl">
        Técnica, estilo y atención personal
      </h1>
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {(data ?? []).map((b) => (
          <article
            key={b.id}
            className="border"
            style={{
              borderColor: 'var(--tema-borde)',
              background: 'var(--tema-superficie)',
              borderRadius: 'var(--tema-radio)',
            }}
          >
            <div
              className="aspect-[4/3] overflow-hidden"
              style={{ background: 'var(--tema-fondo)' }}
            >
              {b.foto_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.foto_url} alt={b.nombre} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <UserRound className="size-14 opacity-20" />
                </div>
              )}
            </div>
            <div className="p-6">
              <span className="etiqueta" style={{ color: 'var(--tema-primario)' }}>
                {(b.especialidades ?? []).join(' · ') || 'Barbero'}
              </span>
              <h2 className="mt-3 font-[family-name:var(--tema-fuente-titulos)] text-3xl">
                {b.nombre}
                {b.apodo ? ` “${b.apodo}”` : ''}
              </h2>
              <p
                className="mt-3 text-sm leading-relaxed"
                style={{ color: 'var(--tema-texto-suave)' }}
              >
                {b.bio}
              </p>
              <Boton comoHijo variante="contorno" className="mt-5">
                <Link href={`/b/${slug}/reservar`}>Reservar</Link>
              </Boton>
            </div>
          </article>
        ))}
        {!data?.length ? (
          <p style={{ color: 'var(--tema-texto-suave)' }}>El equipo aparecerá pronto.</p>
        ) : null}
      </div>
    </div>
  );
}
