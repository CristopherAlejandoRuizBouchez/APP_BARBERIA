import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { consultarCitaPublica } from '../acciones';
import { GestorCita } from '@/components/publico/gestor-cita';
import { organizacionPorSlug } from '@/lib/tenant/resolver';

export const metadata: Metadata = { title: 'Mi cita', robots: { index: false, follow: false } };

export default async function MiCita({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { slug } = await params;
  if (!(await organizacionPorSlug(slug))) notFound();
  const { token = '' } = await searchParams;
  const resultado = token ? await consultarCitaPublica(slug, token) : null;
  return (
    <div className="mx-auto w-full px-5 py-16" style={{ maxWidth: 'var(--tema-ancho)' }}>
      <div className="mx-auto mb-9 max-w-xl text-center">
        <p className="etiqueta" style={{ color: 'var(--tema-primario)' }}>
          Autogestión
        </p>
        <h1 className="mt-3 font-[family-name:var(--tema-fuente-titulos)] text-5xl">
          Consulta tu cita
        </h1>
        <p className="mt-3" style={{ color: 'var(--tema-texto-suave)' }}>
          El enlace privado permite verla o cancelarla dentro del plazo de la barbería.
        </p>
      </div>
      <GestorCita
        slug={slug}
        tokenInicial={token}
        citaInicial={resultado?.ok ? resultado.datos : null}
      />
    </div>
  );
}
