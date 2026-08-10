import {
  TarjetaIndicador,
  Tarjeta,
  TarjetaCabecera,
  TarjetaContenido,
  TarjetaTitulo,
} from '@/components/ui/tarjeta';
import Link from 'next/link';
import { CalendarPlus, ExternalLink, PackagePlus, ShoppingCart } from 'lucide-react';
import { formatearMXN } from '@/lib/dinero';
import { requerirOrganizacion } from '@/lib/auth/guardas';
import { redirect } from 'next/navigation';

export default async function DashboardOrganizacion({
  params,
}: {
  params: Promise<{ organizationSlug: string }>;
}) {
  const { organizationSlug } = await params;
  const { supabase, organizacion, contexto } = await requerirOrganizacion(organizationSlug);
  if (contexto.rol === 'barber') redirect(`/panel/${organizationSlug}/mi-agenda`);
  if (contexto.rol !== 'organization_owner') redirect(`/panel/${organizationSlug}/agenda`);
  if (!contexto.organizacionOperativa && !contexto.esSuperadmin) {
    if (contexto.rol === 'organization_owner' || contexto.rol === 'organization_admin') {
      redirect(`/panel/${organizationSlug}/pagos`);
    }
    redirect('/iniciar-sesion?error=La%20barbería%20no%20está%20operativa');
  }
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const [ventas, citas, stock, pedidos, proximas] = await Promise.all([
    supabase
      .from('sales')
      .select('total_centavos')
      .eq('organization_id', organizacion.id)
      .gte('creado_en', hoy.toISOString())
      .eq('estado', 'completada'),
    supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizacion.id)
      .gte('fecha_hora_inicio', hoy.toISOString())
      .lt('fecha_hora_inicio', new Date(hoy.getTime() + 86400000).toISOString()),
    supabase
      .from('product_stock')
      .select('stock_actual, stock_minimo')
      .eq('organization_id', organizacion.id),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizacion.id)
      .in('estado', ['nuevo', 'confirmado', 'listo']),
    supabase
      .from('appointments')
      .select('id, fecha_hora_inicio, estado, customers(nombre), barbers(nombre)')
      .eq('organization_id', organizacion.id)
      .gte('fecha_hora_inicio', new Date().toISOString())
      .order('fecha_hora_inicio')
      .limit(6),
  ]);

  const totalVentas = (ventas.data ?? []).reduce((s, v) => s + Number(v.total_centavos), 0);
  const bajoMinimo = (stock.data ?? []).filter((s) => s.stock_actual <= s.stock_minimo).length;
  const base = `/panel/${organizationSlug}`;

  const acciones = [
    {
      href: `/b/${organizationSlug}/reservar`,
      texto: 'Nueva cita',
      detalle: 'Abrir formulario de reservación',
      icono: CalendarPlus,
      externa: true,
    },
    {
      href: `${base}/pos`,
      texto: 'Cobrar',
      detalle: 'Registrar servicio o producto',
      icono: ShoppingCart,
    },
    {
      href: `${base}/productos`,
      texto: 'Agregar producto',
      detalle: 'Actualizar el catálogo',
      icono: PackagePlus,
    },
    {
      href: `/b/${organizationSlug}`,
      texto: 'Ver mi página',
      detalle: 'Abrir el sitio para clientes',
      icono: ExternalLink,
      externa: true,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="etiqueta text-dorado">Inicio</p>
        <h1 className="mt-2 font-display text-4xl">{organizacion.nombre_comercial}</h1>
        <p className="mt-2 text-sm text-[var(--texto-suave)]">¿Qué necesitas hacer?</p>
      </div>
      <section aria-label="Acciones rápidas" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {acciones.map((accion) => {
          const Icono = accion.icono;
          return (
            <Link
              key={accion.texto}
              href={accion.href}
              target={accion.externa ? '_blank' : undefined}
              rel={accion.externa ? 'noreferrer' : undefined}
              className="group rounded-sm border border-[var(--borde)] bg-[var(--superficie)] p-4 transition-colors hover:border-dorado/60 hover:bg-[var(--superficie-alta)]"
            >
              <Icono className="size-5 text-dorado" />
              <span className="mt-4 block font-medium">{accion.texto}</span>
              <span className="mt-1 block text-xs text-[var(--texto-tenue)]">{accion.detalle}</span>
            </Link>
          );
        })}
      </section>
      <section
        aria-label="Indicadores del día"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <TarjetaIndicador etiqueta="Ventas de hoy" valor={formatearMXN(totalVentas)} acentuado />
        <TarjetaIndicador etiqueta="Citas de hoy" valor={String(citas.count ?? 0)} />
        <TarjetaIndicador etiqueta="Pedidos abiertos" valor={String(pedidos.count ?? 0)} />
        <TarjetaIndicador
          etiqueta="Stock bajo"
          valor={String(bajoMinimo)}
          tendencia={bajoMinimo ? 'baja' : 'neutra'}
        />
      </section>
      <Tarjeta>
        <TarjetaCabecera>
          <TarjetaTitulo>Próximas citas</TarjetaTitulo>
        </TarjetaCabecera>
        <TarjetaContenido>
          <div className="divide-y divide-[var(--borde)]">
            {(proximas.data ?? []).map((cita) => (
              <div key={cita.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                <span>{new Date(cita.fecha_hora_inicio).toLocaleString('es-MX')}</span>
                <span className="text-[var(--texto-suave)]">
                  {(cita.customers as unknown as { nombre?: string } | null)?.nombre ?? 'Cliente'} ·{' '}
                  {(cita.barbers as unknown as { nombre?: string } | null)?.nombre ?? 'Barbero'}
                </span>
                <span className="uppercase text-dorado">{cita.estado}</span>
              </div>
            ))}
            {!proximas.data?.length ? (
              <p className="py-8 text-center text-[var(--texto-tenue)]">No hay citas próximas.</p>
            ) : null}
          </div>
        </TarjetaContenido>
      </Tarjeta>
    </div>
  );
}
