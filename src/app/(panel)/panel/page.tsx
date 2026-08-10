import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requerirUsuario } from '@/lib/auth/guardas';
import { cerrarSesion } from '@/app/(auth)/acciones';
import { Boton } from '@/components/ui/boton';
import { Tarjeta, TarjetaContenido } from '@/components/ui/tarjeta';

export default async function SelectorOrganizacion() {
  const { supabase } = await requerirUsuario();
  const { data: superadmin } = await supabase
    .from('platform_superadmins')
    .select('usuario_id')
    .maybeSingle();
  if (superadmin) redirect('/superadmin');

  const { data: organizaciones } = await supabase
    .from('organizations')
    .select('slug, nombre_comercial, estado')
    .order('nombre_comercial');
  const unicaOrganizacion = organizaciones?.length === 1 ? organizaciones[0] : null;
  if (unicaOrganizacion) redirect(`/panel/${unicaOrganizacion.slug}`);

  return (
    <main id="contenido" className="min-h-dvh bg-carbon px-5 py-16 text-marfil">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-4xl">Selecciona una barbería</h1>
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {(organizaciones ?? []).map((org) => (
            <Link key={org.slug} href={`/panel/${org.slug}`}>
              <Tarjeta className="h-full transition-colors hover:border-dorado/60">
                <TarjetaContenido className="pt-5">
                  <p className="font-display text-xl">{org.nombre_comercial}</p>
                  <p className="mt-2 text-xs uppercase text-[var(--texto-tenue)]">{org.estado}</p>
                </TarjetaContenido>
              </Tarjeta>
            </Link>
          ))}
        </div>
        {!organizaciones?.length ? (
          <p className="mt-8 text-marfil/60">No tienes una barbería asignada.</p>
        ) : null}
        <form action={cerrarSesion} className="mt-8">
          <Boton variante="contorno">Cerrar sesión</Boton>
        </form>
      </div>
    </main>
  );
}
