import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { UserRound } from 'lucide-react';
import { Boton } from '@/components/ui/boton';
import { crearClientePublico } from '@/lib/supabase/servidor';
import { organizacionPorSlug } from '@/lib/tenant/resolver';

export const metadata: Metadata = { title: 'Barberos' };

function obtenerIniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase())
    .join('');
}

function mostrarApodo(nombre: string, apodo: string | null): boolean {
  if (!apodo?.trim()) return false;
  return apodo.trim().localeCompare(nombre.trim(), 'es', { sensitivity: 'base' }) !== 0;
}

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
      <h1 className="mt-3 max-w-3xl font-[family-name:var(--tema-fuente-titulos)] text-4xl sm:text-5xl">
        Técnica, estilo y atención personal
      </h1>
      <div className="mt-10 flex flex-wrap justify-center gap-6">
        {(data ?? []).map((b) => {
          const apodoVisible = mostrarApodo(b.nombre, b.apodo);
          return (
            <article
              key={b.id}
              className="flex w-full max-w-[23rem] flex-col overflow-hidden border sm:w-[calc(50%-0.75rem)] lg:w-[22rem]"
              style={{
                borderColor: 'var(--tema-borde)',
                background: 'var(--tema-superficie)',
                borderRadius: 'var(--tema-radio)',
              }}
            >
              <div
                className="h-64 overflow-hidden sm:h-72"
                style={{ background: 'var(--tema-fondo)' }}
              >
                {b.foto_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={b.foto_url}
                    alt={`Fotografía de ${b.nombre}`}
                    className="h-full w-full object-cover [object-position:center_25%]"
                  />
                ) : (
                  <div
                    className="relative flex h-full items-center justify-center overflow-hidden"
                    style={{
                      background:
                        'linear-gradient(145deg, var(--tema-superficie), var(--tema-fondo))',
                    }}
                  >
                    <UserRound className="absolute size-40 opacity-[0.04]" aria-hidden="true" />
                    <span
                      className="relative font-[family-name:var(--tema-fuente-titulos)] text-6xl"
                      style={{ color: 'var(--tema-primario)' }}
                      aria-hidden="true"
                    >
                      {obtenerIniciales(b.nombre)}
                    </span>
                    <span className="sr-only">Fotografía pendiente</span>
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col p-6">
                <span className="etiqueta" style={{ color: 'var(--tema-primario)' }}>
                  {(b.especialidades ?? []).join(' · ') || 'Barbero'}
                </span>
                <h2 className="mt-3 font-[family-name:var(--tema-fuente-titulos)] text-3xl">
                  {b.nombre}
                  {apodoVisible ? ` “${b.apodo?.trim()}”` : ''}
                </h2>
                {b.bio ? (
                  <p
                    className="mt-3 text-sm leading-relaxed"
                    style={{ color: 'var(--tema-texto-suave)' }}
                  >
                    {b.bio}
                  </p>
                ) : null}
                <div className="mt-auto pt-5">
                  <Boton comoHijo variante="contorno">
                    <Link href={`/b/${slug}/reservar`}>Reservar con {b.nombre}</Link>
                  </Boton>
                </div>
              </div>
            </article>
          );
        })}
        {!data?.length ? (
          <p style={{ color: 'var(--tema-texto-suave)' }}>El equipo aparecerá pronto.</p>
        ) : null}
      </div>
    </div>
  );
}
