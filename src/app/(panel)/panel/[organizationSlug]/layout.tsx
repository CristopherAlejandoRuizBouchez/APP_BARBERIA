import Link from 'next/link';
import { BarraLateral } from '@/components/panel/barra-lateral';
import { BarraSuperior } from '@/components/panel/barra-superior';
import type { RolUsuario } from '@/components/panel/navegacion';
import { requerirOrganizacion } from '@/lib/auth/guardas';
import { cerrarSesion } from '@/app/(auth)/acciones';

function rolVisual(rol: string | null): RolUsuario {
  if (rol === 'barber') return 'barbero';
  if (rol !== 'organization_owner') return 'recepcion';
  return 'administrador';
}

export default async function LayoutOrganizacion({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ organizationSlug: string }>;
}) {
  const { organizationSlug } = await params;
  const { organizacion, contexto, user } = await requerirOrganizacion(organizationSlug);
  const rol = rolVisual(contexto.rol);
  const base = `/panel/${organizationSlug}`;

  return (
    <div className="flex h-dvh overflow-hidden bg-[var(--fondo)] text-[var(--texto)]">
      <BarraLateral
        rol={rol}
        nombreNegocio={organizacion.nombre_comercial}
        basePath={base}
        suspendida={!contexto.organizacionOperativa}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <BarraSuperior rol={rol} nombreUsuario={user.email ?? 'Usuario'} />
        <div className="flex items-center gap-4 overflow-x-auto border-b border-[var(--borde)] bg-[var(--superficie)] px-4 py-2 text-xs md:hidden">
          {!contexto.organizacionOperativa ? (
            <Link href={`${base}/pagos`}>Plan y pagos</Link>
          ) : rol === 'barbero' ? (
            <Link href={`${base}/mi-agenda`}>Mi agenda</Link>
          ) : (
            <>
              {rol === 'administrador' ? <Link href={base}>Inicio</Link> : null}
              <Link href={`${base}/agenda`}>Agenda</Link>
              <Link href={`${base}/pos`}>Cobrar</Link>
              <Link href={`${base}/pedidos`}>Pedidos</Link>
              <Link href={`${base}/clientes`}>Clientes</Link>
              <Link href={`${base}/caja`}>Caja</Link>
            </>
          )}
          <form action={cerrarSesion}>
            <button className="text-dorado">Salir</button>
          </form>
        </div>
        {organizacion.estado !== 'active' ? (
          <div className="border-b border-dorado/30 bg-dorado/10 px-5 py-2 text-sm text-dorado">
            La barbería está{' '}
            {organizacion.estado === 'suspended' ? 'suspendida' : 'en configuración'}. Las
            operaciones están limitadas.
          </div>
        ) : null}
        <main id="contenido" className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
