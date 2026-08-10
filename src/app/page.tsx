import Link from 'next/link';
import { Boton } from '@/components/ui/boton';
import { crearClientePublico } from '@/lib/supabase/servidor';
import { env } from '@/lib/env';

/**
 * Portada de la PLATAFORMA, no de ninguna barbería.
 *
 * Lista los negocios activos. Cada uno vive en /b/<slug> con su propio
 * diseño; esta página solo es el directorio.
 */
export const revalidate = 300;

export default async function PortadaPlataforma() {
  let barberias: { slug: string; nombre_comercial: string }[] = [];

  try {
    const supabase = crearClientePublico();
    const { data } = await supabase
      .from('organizations')
      .select('slug, nombre_comercial')
      .eq('estado', 'active')
      .order('nombre_comercial');
    barberias = data ?? [];
  } catch {
    // Supabase aún no está configurado: se muestra la portada sin directorio.
    barberias = [];
  }

  return (
    <div className="flex min-h-dvh flex-col bg-carbon text-marfil">
      <main id="contenido" className="contenedor-app flex flex-1 flex-col justify-center py-24">
        <p className="etiqueta text-dorado">Plataforma</p>
        <h1 className="mt-5 max-w-3xl font-display text-5xl leading-[0.95] sm:text-6xl">
          {env.NEXT_PUBLIC_PLATFORM_NAME}
        </h1>
        <p className="mt-6 max-w-md text-lg leading-relaxed text-marfil/62">
          Agenda, punto de venta, inventario y sitio web propio para cada barbería.
        </p>

        {barberias.length > 0 ? (
          <section className="mt-14" aria-labelledby="titulo-barberias">
            <h2 id="titulo-barberias" className="etiqueta text-dorado">
              Barberías en la plataforma
            </h2>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {barberias.map((b) => (
                <li key={b.slug}>
                  <Link
                    href={`/b/${b.slug}`}
                    className="block rounded-sm border border-marfil/12 bg-grafito p-5 transition-colors hover:border-dorado/45"
                  >
                    <span className="font-display text-xl">{b.nombre_comercial}</span>
                    <span className="mt-1 block font-mono text-xs text-marfil/40">/b/{b.slug}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <p className="mt-14 max-w-md text-sm text-marfil/45">
            Todavía no hay barberías publicadas. El superadministrador las da de alta desde{' '}
            <Link href="/superadmin" className="enlace-filete text-dorado">
              el panel de la plataforma
            </Link>
            .
          </p>
        )}

        <div className="mt-12 flex flex-col gap-3 sm:flex-row">
          <Boton comoHijo variante="contorno">
            <Link href="/iniciar-sesion">Iniciar sesión</Link>
          </Boton>
        </div>
      </main>
    </div>
  );
}
