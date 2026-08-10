import Link from 'next/link';
import { ExternalLink, ShieldCheck } from 'lucide-react';
import { requerirSuperadmin } from '@/lib/auth/guardas';
import { Boton } from '@/components/ui/boton';
import { AreaTexto, Campo, Entrada, EntradaImporte } from '@/components/ui/campo';
import {
  Tarjeta,
  TarjetaCabecera,
  TarjetaContenido,
  TarjetaIndicador,
  TarjetaTitulo,
} from '@/components/ui/tarjeta';
import { formatearMXN } from '@/lib/dinero';
import {
  accionOrganizacion,
  crearOrganizacion,
  eliminarOrganizacion,
  guardarDatosBancarios,
  registrarPago,
} from './acciones';
import { FormularioNuevaBarberia } from './formulario-nueva-barberia';
import { BotonEliminarBarberia } from './boton-eliminar-barberia';

export default async function Superadmin({
  searchParams,
}: {
  searchParams: Promise<{ guardado?: string; error?: string }>;
}) {
  const aviso = await searchParams;
  const { supabase } = await requerirSuperadmin();
  const [organizaciones, pagos, plataforma] = await Promise.all([
    supabase
      .from('organizations')
      .select(
        'id, slug, nombre_comercial, estado, creado_en, motivo_suspension, billing_accounts(mensualidad_centavos, proxima_fecha_pago, estado_pago)'
      )
      .neq('estado', 'cancelled')
      .order('creado_en', { ascending: false }),
    supabase
      .from('manual_payments')
      .select('id, fecha_pago, monto_centavos, referencia, organizations(nombre_comercial)')
      .order('fecha_pago', { ascending: false })
      .limit(20),
    supabase.from('platform_settings').select('*').maybeSingle(),
  ]);
  const orgs = organizaciones.data ?? [];
  const activas = orgs.filter((o) => o.estado === 'active').length;
  const suspendidas = orgs.filter((o) => o.estado === 'suspended').length;
  const mensual = orgs.reduce(
    (s, o) =>
      s +
      Number(
        (o.billing_accounts as unknown as { mensualidad_centavos?: number })
          ?.mensualidad_centavos ?? 0
      ),
    0
  );
  return (
    <div className="space-y-7">
      <div>
        <p className="etiqueta text-dorado">Plataforma multiempresa</p>
        <h1 className="mt-2 font-display text-5xl">Centro de control</h1>
        <p className="mt-2 text-[var(--texto-suave)]">
          Alta de barberías, cobro por transferencia y suspensión exclusivamente manual.
        </p>
      </div>
      {aviso.error || aviso.guardado ? (
        <div
          className={`border px-4 py-3 text-sm ${aviso.error ? 'border-peligro/40 text-peligro' : 'border-exito/40 text-exito'}`}
        >
          {aviso.error ?? 'Cambios guardados correctamente.'}
        </div>
      ) : null}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TarjetaIndicador etiqueta="Barberías" valor={String(orgs.length)} acentuado />
        <TarjetaIndicador etiqueta="Activas" valor={String(activas)} />
        <TarjetaIndicador
          etiqueta="Suspendidas"
          valor={String(suspendidas)}
          tendencia={suspendidas ? 'baja' : 'neutra'}
        />
        <TarjetaIndicador etiqueta="Mensualidades de la plataforma" valor={formatearMXN(mensual)} />
      </section>
      <div className="flex items-start gap-3 border border-[var(--borde)] bg-[var(--superficie)] px-4 py-3 text-sm text-[var(--texto-suave)]">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-dorado" />
        <p>
          Este centro de control administra cuentas, mensualidades y bloqueos. Las ventas, citas,
          clientes, inventario, gastos y reportes pertenecen exclusivamente a cada barbería.
        </p>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_25rem]">
        <Tarjeta>
          <TarjetaCabecera>
            <TarjetaTitulo>Barberías</TarjetaTitulo>
          </TarjetaCabecera>
          <TarjetaContenido className="space-y-3">
            {orgs.map((org) => {
              const cobro = org.billing_accounts as unknown as {
                mensualidad_centavos?: number;
                proxima_fecha_pago?: string;
                estado_pago?: string;
              } | null;
              return (
                <div key={org.id} className="border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <span className="etiqueta text-dorado">{org.estado}</span>
                      <h2 className="mt-2 font-display text-2xl">{org.nombre_comercial}</h2>
                      <p className="mt-1 text-xs text-[var(--texto-tenue)]">
                        /b/{org.slug} · {formatearMXN(cobro?.mensualidad_centavos ?? 0)} / mes ·{' '}
                        {cobro?.estado_pago ?? 'sin cuenta'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Boton comoHijo tamano="sm" variante="contorno">
                        <Link href={`/b/${org.slug}`} target="_blank">
                          <ExternalLink className="size-3" /> Sitio
                        </Link>
                      </Boton>
                    </div>
                  </div>
                  {org.estado === 'suspended' ? (
                    <p className="mt-3 text-xs text-peligro">Motivo: {org.motivo_suspension}</p>
                  ) : null}
                  <div className="mt-4 grid gap-3 border-t pt-4 md:grid-cols-2">
                    <form action={accionOrganizacion} className="flex gap-2">
                      <input type="hidden" name="organization_id" value={org.id} />
                      <input
                        type="hidden"
                        name="accion"
                        value={org.estado === 'active' ? 'suspender' : 'reactivar'}
                      />
                      <Entrada
                        name="motivo"
                        required={org.estado === 'active'}
                        placeholder={
                          org.estado === 'active'
                            ? 'Motivo obligatorio'
                            : 'Nota de activación o reactivación'
                        }
                      />
                      <Boton variante={org.estado !== 'active' ? 'primario' : 'peligro'}>
                        {org.estado === 'active'
                          ? 'Suspender'
                          : org.estado === 'suspended'
                            ? 'Reactivar'
                            : 'Activar'}
                      </Boton>
                    </form>
                    <form action={registrarPago} className="grid grid-cols-2 gap-2">
                      <input type="hidden" name="organization_id" value={org.id} />
                      <EntradaImporte name="monto" placeholder="Mensualidad" required />
                      <Entrada
                        name="fecha_pago"
                        type="date"
                        defaultValue={new Date().toISOString().slice(0, 10)}
                        required
                      />
                      <Entrada name="referencia" placeholder="Referencia" />
                      <Boton variante="acento">Registrar pago</Boton>
                    </form>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--borde)] pt-3">
                    <p className="text-xs text-[var(--texto-tenue)]">
                      Al eliminarla dejará de aparecer y sus usuarios perderán el acceso.
                    </p>
                    <BotonEliminarBarberia
                      action={eliminarOrganizacion}
                      organizationId={org.id}
                      nombre={org.nombre_comercial}
                      slug={org.slug}
                      deshabilitado={org.estado === 'active'}
                    />
                    {org.estado === 'active' ? (
                      <p className="w-full text-right text-xs text-peligro">
                        Suspende la barbería para habilitar la eliminación.
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
            {!orgs.length ? (
              <p className="py-10 text-center text-[var(--texto-tenue)]">
                Crea la primera barbería.
              </p>
            ) : null}
          </TarjetaContenido>
        </Tarjeta>
        <Tarjeta>
          <TarjetaCabecera>
            <TarjetaTitulo>Nueva barbería</TarjetaTitulo>
          </TarjetaCabecera>
          <TarjetaContenido>
            <FormularioNuevaBarberia action={crearOrganizacion} />
          </TarjetaContenido>
        </Tarjeta>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Tarjeta>
          <TarjetaCabecera>
            <TarjetaTitulo>Datos de transferencia</TarjetaTitulo>
          </TarjetaCabecera>
          <TarjetaContenido>
            <form action={guardarDatosBancarios} className="grid gap-4 sm:grid-cols-2">
              <Campo etiqueta="Banco" htmlFor="banco">
                <Entrada
                  id="banco"
                  name="banco"
                  defaultValue={plataforma.data?.banco_nombre ?? ''}
                />
              </Campo>
              <Campo etiqueta="Titular" htmlFor="titular">
                <Entrada
                  id="titular"
                  name="titular"
                  defaultValue={plataforma.data?.banco_titular ?? ''}
                />
              </Campo>
              <Campo etiqueta="CLABE" htmlFor="clabe">
                <Entrada
                  id="clabe"
                  name="clabe"
                  defaultValue={plataforma.data?.banco_clabe ?? ''}
                />
              </Campo>
              <Campo etiqueta="Cuenta" htmlFor="cuenta">
                <Entrada
                  id="cuenta"
                  name="cuenta"
                  defaultValue={plataforma.data?.banco_cuenta ?? ''}
                />
              </Campo>
              <Campo etiqueta="WhatsApp de soporte" htmlFor="whatsapp">
                <Entrada
                  id="whatsapp"
                  name="whatsapp"
                  defaultValue={plataforma.data?.whatsapp_soporte ?? ''}
                />
              </Campo>
              <Campo etiqueta="Instrucciones" htmlFor="instrucciones" className="sm:col-span-2">
                <AreaTexto
                  id="instrucciones"
                  name="instrucciones"
                  defaultValue={plataforma.data?.instrucciones_pago ?? ''}
                />
              </Campo>
              <Boton type="submit">Guardar datos</Boton>
            </form>
          </TarjetaContenido>
        </Tarjeta>
        <Tarjeta>
          <TarjetaCabecera>
            <TarjetaTitulo>Últimos pagos</TarjetaTitulo>
          </TarjetaCabecera>
          <TarjetaContenido className="divide-y divide-[var(--borde)]">
            {(pagos.data ?? []).map((p) => (
              <div key={p.id} className="flex justify-between gap-3 py-3 text-sm">
                <span>
                  {(p.organizations as unknown as { nombre_comercial?: string })?.nombre_comercial}
                  <small className="block text-[var(--texto-tenue)]">
                    {p.fecha_pago} · {p.referencia ?? 'Sin referencia'}
                  </small>
                </span>
                <strong className="cifras">{formatearMXN(p.monto_centavos)}</strong>
              </div>
            ))}
          </TarjetaContenido>
        </Tarjeta>
      </div>
    </div>
  );
}
