import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ExternalLink, MessageCircle, Pencil, Plus } from 'lucide-react';
import { Boton } from '@/components/ui/boton';
import { AreaTexto, Campo, Entrada, EntradaImporte, EntradaTelefono } from '@/components/ui/campo';
import {
  Tarjeta,
  TarjetaCabecera,
  TarjetaContenido,
  TarjetaIndicador,
  TarjetaTitulo,
} from '@/components/ui/tarjeta';
import { formatearMXN } from '@/lib/dinero';
import { requerirOrganizacion } from '@/lib/auth/guardas';
import { PuntoVenta } from '@/components/panel/punto-venta';
import { EditorApariencia } from '@/components/panel/editor-apariencia';
import { FormularioAccesoRecepcion } from '@/components/panel/formulario-acceso-recepcion';
import {
  cambiarAccesoRecepcion,
  cambiarEstado,
  cambiarDisponibilidadServicio,
  gestionarCaja,
  guardarApariencia,
  guardarCatalogo,
  guardarConfiguracion,
  guardarOperacion,
  actualizarServicio,
  crearAccesoRecepcion,
  marcarWhatsappEnviado,
} from '../acciones';

const MODULOS = new Set([
  'agenda',
  'mi-agenda',
  'pos',
  'ventas',
  'pedidos',
  'clientes',
  'servicios',
  'productos',
  'inventario',
  'compras',
  'proveedores',
  'gastos',
  'comisiones',
  'caja',
  'reportes',
  'barberos',
  'equipo',
  'apariencia',
  'whatsapp',
  'pagos',
  'configuracion',
]);

const MODULOS_RECEPCION = new Set(['agenda', 'pos', 'ventas', 'pedidos', 'clientes', 'caja']);

const ESTILO_SELECT =
  'h-10 w-full rounded-sm border border-[var(--borde)] bg-[var(--fondo)] px-3 text-sm';

function Aviso({ guardado, error }: { guardado?: string; error?: string }) {
  if (!guardado && !error) return null;
  return (
    <div
      role="status"
      className={`rounded-sm border px-4 py-3 text-sm ${
        error
          ? 'border-peligro/40 bg-peligro-suave text-peligro'
          : 'border-exito/40 bg-exito-suave text-exito'
      }`}
    >
      {error ?? 'La información se guardó correctamente.'}
    </div>
  );
}

function Encabezado({
  titulo,
  descripcion,
  publico,
}: {
  titulo: string;
  descripcion: string;
  publico?: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="etiqueta text-dorado">Administración</p>
        <h1 className="mt-2 font-display text-4xl">{titulo}</h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--texto-suave)]">{descripcion}</p>
      </div>
      {publico ? (
        <Boton comoHijo variante="contorno">
          <Link href={publico} target="_blank">
            Ver sitio público <ExternalLink className="size-4" />
          </Link>
        </Boton>
      ) : null}
    </div>
  );
}

function CeldaVacia({ texto = 'Todavía no hay registros.' }: { texto?: string }) {
  return <p className="py-10 text-center text-sm text-[var(--texto-tenue)]">{texto}</p>;
}

function Tabla({ encabezados, children }: { encabezados: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[42rem] text-left text-sm">
        <thead className="border-b border-[var(--borde)] text-xs uppercase tracking-wider text-[var(--texto-tenue)]">
          <tr>
            {encabezados.map((e) => (
              <th key={e} className="px-4 py-3 font-medium">
                {e}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--borde)]">{children}</tbody>
      </table>
    </div>
  );
}

function FormularioBase({
  titulo,
  action,
  modulo,
  textoBoton = 'Guardar',
  children,
}: {
  titulo: string;
  action: (formData: FormData) => void | Promise<void>;
  modulo: string;
  textoBoton?: string;
  children: React.ReactNode;
}) {
  return (
    <Tarjeta>
      <TarjetaCabecera>
        <TarjetaTitulo>{titulo}</TarjetaTitulo>
      </TarjetaCabecera>
      <TarjetaContenido>
        <form action={action} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="modulo" value={modulo} />
          {children}
          <div className="sm:col-span-2">
            <Boton type="submit">
              <Plus className="size-4" /> {textoBoton}
            </Boton>
          </div>
        </form>
      </TarjetaContenido>
    </Tarjeta>
  );
}

export default async function ModuloPanel({
  params,
  searchParams,
}: {
  params: Promise<{ organizationSlug: string; modulo: string }>;
  searchParams: Promise<{ guardado?: string; error?: string; editar?: string }>;
}) {
  const { organizationSlug, modulo } = await params;
  const avisos = await searchParams;
  if (!MODULOS.has(modulo)) notFound();
  const { supabase, organizacion, user, contexto } = await requerirOrganizacion(organizationSlug);
  if (!contexto.organizacionOperativa && !contexto.esSuperadmin) {
    const puedeVerPago = contexto.rol === 'organization_owner';
    if (!puedeVerPago) {
      redirect('/iniciar-sesion?error=La%20barbería%20no%20está%20operativa');
    }
    if (modulo !== 'pagos') redirect(`/panel/${organizationSlug}/pagos`);
  }
  if (contexto.rol === 'barber') {
    if (modulo !== 'mi-agenda' && modulo !== 'comisiones') {
      redirect(`/panel/${organizationSlug}/mi-agenda`);
    }
  } else if (contexto.rol !== 'organization_owner' && !MODULOS_RECEPCION.has(modulo)) {
    redirect(`/panel/${organizationSlug}/agenda`);
  }
  const orgId = organizacion.id;
  const basePublica = `/b/${organizationSlug}`;
  const guardarCatalogoOrg = guardarCatalogo.bind(null, organizationSlug);
  const actualizarServicioOrg = actualizarServicio.bind(null, organizationSlug);
  const cambiarDisponibilidadServicioOrg = cambiarDisponibilidadServicio.bind(
    null,
    organizationSlug
  );
  const guardarOperacionOrg = guardarOperacion.bind(null, organizationSlug);
  const cambiarEstadoOrg = cambiarEstado.bind(null, organizationSlug);
  const guardarAparienciaOrg = guardarApariencia.bind(null, organizationSlug);
  const crearAccesoRecepcionOrg = crearAccesoRecepcion.bind(null, organizationSlug);
  const cambiarAccesoRecepcionOrg = cambiarAccesoRecepcion.bind(null, organizationSlug);
  const gestionarCajaOrg = gestionarCaja.bind(null, organizationSlug);
  const guardarConfiguracionOrg = guardarConfiguracion.bind(null, organizationSlug);
  const marcarWhatsappOrg = marcarWhatsappEnviado.bind(null, organizationSlug);

  if (modulo === 'pos') {
    const [productos, servicios, sucursales, barberos] = await Promise.all([
      supabase
        .from('products')
        .select('id, nombre, sku, marca, precio_venta_centavos')
        .eq('organization_id', orgId)
        .eq('activo', true)
        .order('nombre'),
      supabase
        .from('services')
        .select('id, nombre, duracion_minutos, precio_centavos')
        .eq('organization_id', orgId)
        .eq('activo', true)
        .order('nombre'),
      supabase
        .from('locations')
        .select('id, nombre')
        .eq('organization_id', orgId)
        .eq('activa', true)
        .order('es_principal', { ascending: false }),
      supabase
        .from('barbers')
        .select('id, nombre')
        .eq('organization_id', orgId)
        .eq('activo', true)
        .order('nombre'),
    ]);
    return (
      <div className="space-y-5">
        <Encabezado
          titulo="Cobrar"
          descripcion="Selecciona servicios o productos y registra el pago."
        />
        <PuntoVenta
          slug={organizationSlug}
          articulos={[
            ...(servicios.data ?? []).map((s) => ({
              id: s.id,
              tipo: 'servicio' as const,
              nombre: s.nombre,
              precioCentavos: s.precio_centavos,
              detalle: `${s.duracion_minutos} min`,
            })),
            ...(productos.data ?? []).map((p) => ({
              id: p.id,
              tipo: 'producto' as const,
              nombre: p.nombre,
              precioCentavos: p.precio_venta_centavos,
              detalle: [p.marca, p.sku].filter(Boolean).join(' · '),
            })),
          ]}
          sucursales={sucursales.data ?? []}
          barberos={barberos.data ?? []}
        />
      </div>
    );
  }

  if (modulo === 'agenda' || modulo === 'mi-agenda') {
    let consulta = supabase
      .from('appointments')
      .select(
        'id, folio, fecha_hora_inicio, fecha_hora_fin, estado, total_centavos, customers(nombre, telefono), barbers(nombre)'
      )
      .eq('organization_id', orgId)
      .gte('fecha_hora_inicio', new Date(Date.now() - 86400000).toISOString())
      .order('fecha_hora_inicio')
      .limit(100);
    if (modulo === 'mi-agenda') {
      const { data: barbero } = await supabase
        .from('barbers')
        .select('id')
        .eq('organization_id', orgId)
        .eq('usuario_id', user.id)
        .maybeSingle();
      if (barbero) consulta = consulta.eq('barbero_id', barbero.id);
    }
    const { data } = await consulta;
    return (
      <div className="space-y-5">
        <Encabezado
          titulo={modulo === 'mi-agenda' ? 'Mi agenda' : 'Agenda'}
          descripcion="Consulta las próximas citas y actualiza su estado."
          publico={`${basePublica}/reservar`}
        />
        <Aviso {...avisos} />
        <Tarjeta>
          {data?.length ? (
            <Tabla encabezados={['Fecha', 'Folio / cliente', 'Barbero', 'Total', 'Estado']}>
              {data.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3">
                    {new Date(c.fecha_hora_inicio).toLocaleString('es-MX')}
                  </td>
                  <td className="px-4 py-3">
                    <strong>{c.folio}</strong>
                    <span className="block text-xs text-[var(--texto-tenue)]">
                      {(c.customers as unknown as { nombre?: string })?.nombre}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {(c.barbers as unknown as { nombre?: string })?.nombre}
                  </td>
                  <td className="cifras px-4 py-3">{formatearMXN(c.total_centavos)}</td>
                  <td className="px-4 py-3">
                    {modulo === 'agenda' ? (
                      <form action={cambiarEstadoOrg} className="flex gap-2">
                        <input type="hidden" name="modulo" value="agenda" />
                        <input type="hidden" name="id" value={c.id} />
                        <select
                          name="estado"
                          defaultValue={c.estado}
                          className="h-8 border bg-[var(--fondo)] px-2 text-xs"
                        >
                          <option value="pendiente">Pendiente</option>
                          <option value="confirmada">Confirmada</option>
                          <option value="en_proceso">En proceso</option>
                          <option value="completada">Completada</option>
                          <option value="no_asistio">No asistió</option>
                        </select>
                        <Boton tamano="sm" variante="sutil">
                          Aplicar
                        </Boton>
                      </form>
                    ) : (
                      <span className="uppercase text-dorado">{c.estado}</span>
                    )}
                  </td>
                </tr>
              ))}
            </Tabla>
          ) : (
            <CeldaVacia texto="No hay citas próximas." />
          )}
        </Tarjeta>
      </div>
    );
  }

  if (modulo === 'servicios') {
    const { data } = await supabase
      .from('services')
      .select('*')
      .eq('organization_id', orgId)
      .order('orden')
      .order('nombre');
    const servicioEditando = data?.find((servicio) => servicio.id === avisos.editar);
    return (
      <div className="space-y-5">
        <Encabezado
          titulo="Servicios"
          descripcion="Catálogo de servicios, duración, precio y visibilidad pública."
          publico={`${basePublica}/servicios`}
        />
        <Aviso {...avisos} />
        <FormularioBase
          titulo={servicioEditando ? `Editar: ${servicioEditando.nombre}` : 'Nuevo servicio'}
          action={servicioEditando ? actualizarServicioOrg : guardarCatalogoOrg}
          modulo="servicios"
          textoBoton={servicioEditando ? 'Actualizar servicio' : 'Guardar'}
        >
          {servicioEditando ? <input type="hidden" name="id" value={servicioEditando.id} /> : null}
          <Campo etiqueta="Nombre" htmlFor="nombre" requerido>
            <Entrada
              id="nombre"
              name="nombre"
              defaultValue={servicioEditando?.nombre ?? ''}
              required
            />
          </Campo>
          <Campo etiqueta="Precio" htmlFor="precio" requerido>
            <EntradaImporte
              id="precio"
              name="precio"
              defaultValue={
                servicioEditando ? (servicioEditando.precio_centavos / 100).toFixed(2) : ''
              }
              required
            />
          </Campo>
          <Campo etiqueta="Duración en minutos" htmlFor="duracion" requerido>
            <Entrada
              id="duracion"
              name="duracion"
              type="number"
              min="5"
              step="5"
              defaultValue={servicioEditando?.duracion_minutos ?? 30}
              required
            />
          </Campo>
          <Campo etiqueta="Descripción" htmlFor="descripcion">
            <Entrada
              id="descripcion"
              name="descripcion"
              defaultValue={servicioEditando?.descripcion ?? ''}
            />
          </Campo>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="destacado"
              defaultChecked={servicioEditando?.destacado ?? false}
            />{' '}
            Destacar en portada
          </label>
          {servicioEditando ? (
            <Link href={`/panel/${organizationSlug}/servicios`} className="text-sm text-dorado">
              Cancelar edición
            </Link>
          ) : null}
        </FormularioBase>
        <Tarjeta>
          {data?.length ? (
            <Tabla encabezados={['Servicio', 'Duración', 'Precio', 'Estado', 'Acciones']}>
              {data.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3">{s.nombre}</td>
                  <td className="px-4 py-3">{s.duracion_minutos} min</td>
                  <td className="cifras px-4 py-3">{formatearMXN(s.precio_centavos)}</td>
                  <td className="px-4 py-3">{s.activo ? 'Público' : 'Desactivado'}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Boton comoHijo tamano="sm" variante="contorno">
                        <Link href={`/panel/${organizationSlug}/servicios?editar=${s.id}`}>
                          <Pencil className="size-3" /> Editar
                        </Link>
                      </Boton>
                      <form action={cambiarDisponibilidadServicioOrg}>
                        <input type="hidden" name="id" value={s.id} />
                        <input
                          type="hidden"
                          name="accion"
                          value={s.activo ? 'desactivar' : 'activar'}
                        />
                        <Boton type="submit" tamano="sm" variante={s.activo ? 'peligro' : 'acento'}>
                          {s.activo ? 'Desactivar' : 'Activar'}
                        </Boton>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </Tabla>
          ) : (
            <CeldaVacia />
          )}
        </Tarjeta>
      </div>
    );
  }

  if (modulo === 'productos') {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('organization_id', orgId)
      .order('nombre');
    return (
      <div className="space-y-5">
        <Encabezado
          titulo="Productos"
          descripcion="Catálogo para venta en mostrador y en la tienda pública."
          publico={`${basePublica}/tienda`}
        />
        <Aviso {...avisos} />
        <FormularioBase titulo="Nuevo producto" action={guardarCatalogoOrg} modulo="productos">
          <Campo etiqueta="Nombre" htmlFor="nombre" requerido>
            <Entrada id="nombre" name="nombre" required />
          </Campo>
          <Campo etiqueta="SKU" htmlFor="sku" requerido>
            <Entrada id="sku" name="sku" required />
          </Campo>
          <Campo etiqueta="Marca" htmlFor="marca">
            <Entrada id="marca" name="marca" />
          </Campo>
          <Campo etiqueta="Precio de venta" htmlFor="precio" requerido>
            <EntradaImporte id="precio" name="precio" required />
          </Campo>
          <Campo etiqueta="Costo" htmlFor="costo">
            <EntradaImporte id="costo" name="costo" defaultValue="0" />
          </Campo>
          <Campo etiqueta="Descripción" htmlFor="descripcion">
            <Entrada id="descripcion" name="descripcion" />
          </Campo>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="visible" defaultChecked /> Visible en tienda
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="destacado" /> Destacado
          </label>
        </FormularioBase>
        <Tarjeta>
          {data?.length ? (
            <Tabla encabezados={['Producto', 'SKU', 'Costo', 'Precio', 'Tienda']}>
              {data.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3">
                    <strong>{p.nombre}</strong>
                    <span className="block text-xs text-[var(--texto-tenue)]">{p.marca}</span>
                  </td>
                  <td className="px-4 py-3">{p.sku}</td>
                  <td className="cifras px-4 py-3">{formatearMXN(p.costo_centavos)}</td>
                  <td className="cifras px-4 py-3">{formatearMXN(p.precio_venta_centavos)}</td>
                  <td className="px-4 py-3">{p.visible_en_tienda ? 'Visible' : 'Oculto'}</td>
                </tr>
              ))}
            </Tabla>
          ) : (
            <CeldaVacia />
          )}
        </Tarjeta>
      </div>
    );
  }

  if (modulo === 'clientes') {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('organization_id', orgId)
      .order('creado_en', { ascending: false })
      .limit(200);
    return (
      <div className="space-y-5">
        <Encabezado
          titulo="Clientes"
          descripcion="Directorio, historial de visitas y gasto acumulado sin mezclar datos entre barberías."
        />
        <Aviso {...avisos} />
        <FormularioBase titulo="Nuevo cliente" action={guardarOperacionOrg} modulo="clientes">
          <Campo etiqueta="Nombre" htmlFor="nombre" requerido>
            <Entrada id="nombre" name="nombre" required />
          </Campo>
          <Campo etiqueta="Teléfono" htmlFor="telefono" requerido>
            <EntradaTelefono id="telefono" name="telefono" required />
          </Campo>
          <Campo etiqueta="Correo" htmlFor="correo">
            <Entrada id="correo" name="correo" type="email" />
          </Campo>
          <Campo etiqueta="Notas" htmlFor="notas">
            <Entrada id="notas" name="notas" />
          </Campo>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="promociones" /> Acepta promociones
          </label>
        </FormularioBase>
        <Tarjeta>
          {data?.length ? (
            <Tabla encabezados={['Cliente', 'Teléfono', 'Visitas', 'Gastado', 'Última visita']}>
              {data.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3">
                    <strong>{c.nombre}</strong>
                    <span className="block text-xs text-[var(--texto-tenue)]">{c.correo}</span>
                  </td>
                  <td className="px-4 py-3">{c.telefono}</td>
                  <td className="cifras px-4 py-3">{c.total_visitas}</td>
                  <td className="cifras px-4 py-3">
                    {formatearMXN(Number(c.total_gastado_centavos))}
                  </td>
                  <td className="px-4 py-3">
                    {c.ultima_visita ? new Date(c.ultima_visita).toLocaleDateString('es-MX') : '—'}
                  </td>
                </tr>
              ))}
            </Tabla>
          ) : (
            <CeldaVacia />
          )}
        </Tarjeta>
      </div>
    );
  }

  if (modulo === 'barberos') {
    const { data } = await supabase
      .from('barbers')
      .select('*')
      .eq('organization_id', orgId)
      .order('orden')
      .order('nombre');
    return (
      <div className="space-y-5">
        <Encabezado
          titulo="Barberos"
          descripcion="Equipo profesional, especialidades y porcentaje de comisión por servicio."
          publico={`${basePublica}/barberos`}
        />
        <Aviso {...avisos} />
        <FormularioBase titulo="Nuevo barbero" action={guardarOperacionOrg} modulo="barberos">
          <Campo etiqueta="Nombre" htmlFor="nombre" requerido>
            <Entrada id="nombre" name="nombre" required />
          </Campo>
          <Campo etiqueta="Apodo" htmlFor="apodo">
            <Entrada id="apodo" name="apodo" />
          </Campo>
          <Campo etiqueta="Especialidades" htmlFor="especialidades" ayuda="Separadas por comas">
            <Entrada id="especialidades" name="especialidades" />
          </Campo>
          <Campo etiqueta="Comisión de servicio (%)" htmlFor="comision">
            <Entrada
              id="comision"
              name="comision"
              type="number"
              min="0"
              max="100"
              step="0.5"
              defaultValue="0"
            />
          </Campo>
          <Campo etiqueta="Biografía" htmlFor="bio" className="sm:col-span-2">
            <AreaTexto id="bio" name="bio" />
          </Campo>
        </FormularioBase>
        <Tarjeta>
          {data?.length ? (
            <Tabla encabezados={['Nombre', 'Especialidades', 'Comisión', 'Estado']}>
              {data.map((b) => (
                <tr key={b.id}>
                  <td className="px-4 py-3">
                    {b.nombre}
                    {b.apodo ? ` “${b.apodo}”` : ''}
                  </td>
                  <td className="px-4 py-3">{(b.especialidades ?? []).join(', ') || '—'}</td>
                  <td className="cifras px-4 py-3">{b.comision_servicio_valor}%</td>
                  <td className="px-4 py-3">{b.activo ? 'Activo' : 'Inactivo'}</td>
                </tr>
              ))}
            </Tabla>
          ) : (
            <CeldaVacia />
          )}
        </Tarjeta>
      </div>
    );
  }

  if (modulo === 'sucursales') {
    const { data } = await supabase
      .from('locations')
      .select('*')
      .eq('organization_id', orgId)
      .order('es_principal', { ascending: false })
      .order('orden');
    return (
      <div className="space-y-5">
        <Encabezado
          titulo="Sucursales"
          descripcion="Cada ubicación mantiene su agenda, existencias, caja y contacto propios."
        />
        <Aviso {...avisos} />
        <FormularioBase titulo="Nueva sucursal" action={guardarOperacionOrg} modulo="sucursales">
          <Campo etiqueta="Nombre" htmlFor="nombre" requerido>
            <Entrada id="nombre" name="nombre" required />
          </Campo>
          <Campo etiqueta="Ciudad" htmlFor="ciudad" requerido>
            <Entrada id="ciudad" name="ciudad" required />
          </Campo>
          <Campo etiqueta="Calle" htmlFor="calle">
            <Entrada id="calle" name="calle" />
          </Campo>
          <Campo etiqueta="Número" htmlFor="numero">
            <Entrada id="numero" name="numero" />
          </Campo>
          <Campo etiqueta="Colonia" htmlFor="colonia">
            <Entrada id="colonia" name="colonia" />
          </Campo>
          <Campo etiqueta="WhatsApp (52 + 10 dígitos)" htmlFor="whatsapp">
            <Entrada id="whatsapp" name="whatsapp" />
          </Campo>
        </FormularioBase>
        <div className="grid gap-3 md:grid-cols-2">
          {(data ?? []).map((s) => (
            <Tarjeta key={s.id} className="p-5">
              <span className="etiqueta text-dorado">
                {s.es_principal ? 'Principal' : 'Sucursal'}
              </span>
              <h2 className="mt-3 font-display text-2xl">{s.nombre}</h2>
              <p className="mt-2 text-sm text-[var(--texto-suave)]">
                {[s.calle, s.numero, s.colonia, s.ciudad].filter(Boolean).join(', ')}
              </p>
            </Tarjeta>
          ))}
        </div>
      </div>
    );
  }

  if (modulo === 'proveedores') {
    const { data } = await supabase
      .from('suppliers')
      .select('*')
      .eq('organization_id', orgId)
      .order('nombre');
    return (
      <div className="space-y-5">
        <Encabezado
          titulo="Proveedores"
          descripcion="Contactos para compras y reposición de inventario."
        />
        <Aviso {...avisos} />
        <FormularioBase titulo="Nuevo proveedor" action={guardarOperacionOrg} modulo="proveedores">
          <Campo etiqueta="Empresa" htmlFor="nombre" requerido>
            <Entrada id="nombre" name="nombre" required />
          </Campo>
          <Campo etiqueta="Contacto" htmlFor="contacto">
            <Entrada id="contacto" name="contacto" />
          </Campo>
          <Campo etiqueta="Teléfono" htmlFor="telefono">
            <Entrada id="telefono" name="telefono" />
          </Campo>
          <Campo etiqueta="Correo" htmlFor="correo">
            <Entrada id="correo" name="correo" type="email" />
          </Campo>
          <Campo etiqueta="Notas" htmlFor="notas" className="sm:col-span-2">
            <AreaTexto id="notas" name="notas" />
          </Campo>
        </FormularioBase>
        <Tarjeta>
          {data?.length ? (
            <Tabla encabezados={['Proveedor', 'Contacto', 'Teléfono', 'Correo']}>
              {data.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3">{p.nombre}</td>
                  <td className="px-4 py-3">{p.contacto ?? '—'}</td>
                  <td className="px-4 py-3">{p.telefono ?? '—'}</td>
                  <td className="px-4 py-3">{p.correo ?? '—'}</td>
                </tr>
              ))}
            </Tabla>
          ) : (
            <CeldaVacia />
          )}
        </Tarjeta>
      </div>
    );
  }

  if (modulo === 'inventario') {
    const [stock, productos, ubicaciones] = await Promise.all([
      supabase
        .from('product_stock')
        .select('producto_id, location_id, stock_actual, stock_minimo, products(nombre, sku)')
        .eq('organization_id', orgId)
        .order('stock_actual'),
      supabase
        .from('products')
        .select('id, nombre, sku')
        .eq('organization_id', orgId)
        .eq('activo', true)
        .order('nombre'),
      supabase
        .from('locations')
        .select('id')
        .eq('organization_id', orgId)
        .eq('activa', true)
        .order('es_principal', { ascending: false })
        .limit(1),
    ]);
    return (
      <div className="space-y-5">
        <Encabezado
          titulo="Inventario"
          descripcion="Controla existencias, entradas, salidas y productos que necesitan reposición."
        />
        <Aviso {...avisos} />
        <FormularioBase titulo="Registrar ajuste" action={guardarOperacionOrg} modulo="inventario">
          <Campo etiqueta="Producto" htmlFor="producto_id" requerido>
            <select id="producto_id" name="producto_id" className={ESTILO_SELECT} required>
              <option value="">Selecciona</option>
              {(productos.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} · {p.sku}
                </option>
              ))}
            </select>
          </Campo>
          <input type="hidden" name="location_id" value={ubicaciones.data?.[0]?.id ?? ''} />
          <Campo etiqueta="Cantidad (+ entrada / − salida)" htmlFor="cantidad" requerido>
            <Entrada id="cantidad" name="cantidad" type="number" required />
          </Campo>
          <Campo etiqueta="Tipo si es salida" htmlFor="tipo_salida">
            <select id="tipo_salida" name="tipo_salida" className={ESTILO_SELECT}>
              <option value="ajuste">Ajuste</option>
              <option value="merma">Merma</option>
              <option value="uso_interno">Uso interno</option>
              <option value="devolucion_proveedor">Devolución a proveedor</option>
            </select>
          </Campo>
          <Campo etiqueta="Motivo" htmlFor="motivo" className="sm:col-span-2" requerido>
            <Entrada id="motivo" name="motivo" required />
          </Campo>
        </FormularioBase>
        <Tarjeta>
          {stock.data?.length ? (
            <Tabla encabezados={['Producto', 'Actual', 'Mínimo', 'Alerta']}>
              {stock.data.map((s) => (
                <tr key={`${s.producto_id}-${s.location_id}`}>
                  <td className="px-4 py-3">
                    {(s.products as unknown as { nombre?: string })?.nombre}
                  </td>
                  <td className="cifras px-4 py-3">{s.stock_actual}</td>
                  <td className="cifras px-4 py-3">{s.stock_minimo}</td>
                  <td
                    className={`px-4 py-3 ${s.stock_actual <= s.stock_minimo ? 'text-peligro' : 'text-exito'}`}
                  >
                    {s.stock_actual <= s.stock_minimo ? 'Reponer' : 'Correcto'}
                  </td>
                </tr>
              ))}
            </Tabla>
          ) : (
            <CeldaVacia texto="Aún no hay movimientos de inventario." />
          )}
        </Tarjeta>
      </div>
    );
  }

  if (modulo === 'gastos') {
    const [gastos, ubicaciones] = await Promise.all([
      supabase
        .from('expenses')
        .select('id, concepto, monto_centavos, fecha, metodo_pago')
        .eq('organization_id', orgId)
        .order('fecha', { ascending: false })
        .limit(200),
      supabase
        .from('locations')
        .select('id')
        .eq('organization_id', orgId)
        .eq('activa', true)
        .order('es_principal', { ascending: false })
        .limit(1),
    ]);
    return (
      <div className="space-y-5">
        <Encabezado
          titulo="Gastos"
          descripcion="Egresos operativos para calcular una utilidad real, no solamente ventas."
        />
        <Aviso {...avisos} />
        <FormularioBase titulo="Registrar gasto" action={guardarOperacionOrg} modulo="gastos">
          <Campo etiqueta="Concepto" htmlFor="concepto" requerido>
            <Entrada id="concepto" name="concepto" required />
          </Campo>
          <Campo etiqueta="Monto" htmlFor="monto" requerido>
            <EntradaImporte id="monto" name="monto" required />
          </Campo>
          <Campo etiqueta="Fecha" htmlFor="fecha">
            <Entrada
              id="fecha"
              name="fecha"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
            />
          </Campo>
          <input type="hidden" name="location_id" value={ubicaciones.data?.[0]?.id ?? ''} />
          <Campo etiqueta="Método" htmlFor="metodo">
            <select id="metodo" name="metodo" className={ESTILO_SELECT}>
              <option value="efectivo">Efectivo</option>
              <option value="tarjeta_fisica">Tarjeta</option>
              <option value="transferencia">Transferencia</option>
              <option value="otro">Otro</option>
            </select>
          </Campo>
          <Campo etiqueta="Notas" htmlFor="notas">
            <Entrada id="notas" name="notas" />
          </Campo>
        </FormularioBase>
        <Tarjeta>
          {gastos.data?.length ? (
            <Tabla encabezados={['Fecha', 'Concepto', 'Método', 'Monto']}>
              {gastos.data.map((g) => (
                <tr key={g.id}>
                  <td className="px-4 py-3">
                    {new Date(`${g.fecha}T12:00:00`).toLocaleDateString('es-MX')}
                  </td>
                  <td className="px-4 py-3">{g.concepto}</td>
                  <td className="px-4 py-3">{g.metodo_pago}</td>
                  <td className="cifras px-4 py-3">{formatearMXN(g.monto_centavos)}</td>
                </tr>
              ))}
            </Tabla>
          ) : (
            <CeldaVacia />
          )}
        </Tarjeta>
      </div>
    );
  }

  if (modulo === 'ventas') {
    const { data } = await supabase
      .from('sales')
      .select(
        'id, folio, creado_en, tipo, total_centavos, estado, metodos_resumen, customers(nombre), barbers(nombre)'
      )
      .eq('organization_id', orgId)
      .order('creado_en', { ascending: false })
      .limit(250);
    return (
      <div className="space-y-5">
        <Encabezado
          titulo="Ventas"
          descripcion="Historial de tickets con método de pago, barbero y cliente."
        />
        <Tarjeta>
          {data?.length ? (
            <Tabla encabezados={['Fecha / folio', 'Cliente', 'Barbero', 'Pago', 'Total', 'Estado']}>
              {data.map((v) => (
                <tr key={v.id}>
                  <td className="px-4 py-3">
                    <strong>{v.folio}</strong>
                    <span className="block text-xs text-[var(--texto-tenue)]">
                      {new Date(v.creado_en).toLocaleString('es-MX')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {(v.customers as unknown as { nombre?: string })?.nombre ?? 'Mostrador'}
                  </td>
                  <td className="px-4 py-3">
                    {(v.barbers as unknown as { nombre?: string })?.nombre ?? '—'}
                  </td>
                  <td className="px-4 py-3">{v.metodos_resumen ?? '—'}</td>
                  <td className="cifras px-4 py-3">{formatearMXN(v.total_centavos)}</td>
                  <td className="px-4 py-3 uppercase">{v.estado}</td>
                </tr>
              ))}
            </Tabla>
          ) : (
            <CeldaVacia />
          )}
        </Tarjeta>
      </div>
    );
  }

  if (modulo === 'pedidos') {
    const { data } = await supabase
      .from('orders')
      .select(
        'id, folio, creado_en, cliente_nombre, cliente_telefono, total_centavos, estado, reserva_expira_en'
      )
      .eq('organization_id', orgId)
      .order('creado_en', { ascending: false })
      .limit(200);
    return (
      <div className="space-y-5">
        <Encabezado
          titulo="Pedidos web"
          descripcion="Apartados de la tienda pública con inventario reservado y contacto del cliente."
          publico={`${basePublica}/tienda`}
        />
        <Aviso {...avisos} />
        <Tarjeta>
          {data?.length ? (
            <Tabla encabezados={['Pedido', 'Cliente', 'Total', 'Reserva', 'Estado']}>
              {data.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3">
                    <strong>{p.folio}</strong>
                    <span className="block text-xs text-[var(--texto-tenue)]">
                      {new Date(p.creado_en).toLocaleString('es-MX')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {p.cliente_nombre}
                    <span className="block text-xs text-[var(--texto-tenue)]">
                      {p.cliente_telefono}
                    </span>
                  </td>
                  <td className="cifras px-4 py-3">{formatearMXN(p.total_centavos)}</td>
                  <td className="px-4 py-3 text-xs">
                    {p.reserva_expira_en
                      ? new Date(p.reserva_expira_en).toLocaleString('es-MX')
                      : 'Sin reserva'}
                  </td>
                  <td className="px-4 py-3">
                    <form action={cambiarEstadoOrg} className="flex gap-2">
                      <input type="hidden" name="modulo" value="pedidos" />
                      <input type="hidden" name="id" value={p.id} />
                      <select
                        name="estado"
                        defaultValue={p.estado}
                        className="h-8 border bg-[var(--fondo)] px-2 text-xs"
                      >
                        <option value="nuevo">Nuevo</option>
                        <option value="confirmado">Confirmado</option>
                        <option value="listo">Listo</option>
                        <option value="entregado">Entregado</option>
                        <option value="cancelado">Cancelado</option>
                      </select>
                      <Boton tamano="sm" variante="sutil">
                        Aplicar
                      </Boton>
                    </form>
                  </td>
                </tr>
              ))}
            </Tabla>
          ) : (
            <CeldaVacia />
          )}
        </Tarjeta>
      </div>
    );
  }

  if (modulo === 'apariencia') {
    const [{ data: tema }, { data: ubicacion }] = await Promise.all([
      supabase.from('organization_themes').select('*').eq('organization_id', orgId).maybeSingle(),
      supabase
        .from('locations')
        .select('ciudad, calle, numero, colonia')
        .eq('organization_id', orgId)
        .eq('activa', true)
        .order('es_principal', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    return (
      <div className="space-y-5">
        <Encabezado
          titulo="Apariencia"
          descripcion="Cada barbería conserva su logo, colores y composición sin aceptar CSS o scripts inseguros."
          publico={basePublica}
        />
        <Aviso {...avisos} />
        <EditorApariencia
          organizationId={orgId}
          nombreComercial={organizacion.nombre_comercial}
          sitioPublico={basePublica}
          ubicacionInicial={{
            ciudad: ubicacion?.ciudad ?? '',
            calle: ubicacion?.calle ?? '',
            numero: ubicacion?.numero ?? '',
            colonia: ubicacion?.colonia ?? '',
          }}
          action={guardarAparienciaOrg}
          temaInicial={{
            plantilla: tema?.plantilla ?? 'urban_premium',
            logoUrl: tema?.logo_url ?? '',
            portadaUrl: tema?.portada_url ?? '',
            eslogan: tema?.eslogan ?? organizacion.nombre_comercial,
            descripcion: tema?.descripcion ?? '',
            colorPrimario: tema?.color_primario ?? '#B88942',
            colorSecundario: tema?.color_secundario ?? '#5B1E2D',
            colorFondo: tema?.color_fondo ?? '#0B0B0D',
            colorSuperficie: tema?.color_superficie ?? '#17181C',
            colorTexto: tema?.color_texto ?? '#EFE7DA',
            fuenteTitulos: tema?.fuente_titulos ?? 'instrument-serif',
            fuenteCuerpo: tema?.fuente_cuerpo ?? 'instrument-sans',
            radioBordes: tema?.radio_bordes ?? 'recto',
            textura: tema?.textura_fondo ?? 'grano',
          }}
        />
      </div>
    );
  }

  if (modulo === 'reportes') {
    const inicio = new Date();
    inicio.setDate(1);
    inicio.setHours(0, 0, 0, 0);
    const [ventas, gastos, comisiones, citas] = await Promise.all([
      supabase
        .from('sales')
        .select('total_centavos')
        .eq('organization_id', orgId)
        .eq('estado', 'completada')
        .gte('creado_en', inicio.toISOString()),
      supabase
        .from('expenses')
        .select('monto_centavos')
        .eq('organization_id', orgId)
        .gte('fecha', inicio.toISOString().slice(0, 10)),
      supabase
        .from('commissions')
        .select('monto_centavos')
        .eq('organization_id', orgId)
        .gte('creado_en', inicio.toISOString()),
      supabase
        .from('appointments')
        .select('estado')
        .eq('organization_id', orgId)
        .gte('fecha_hora_inicio', inicio.toISOString()),
    ]);
    const ingreso = (ventas.data ?? []).reduce((s, v) => s + v.total_centavos, 0);
    const egreso = (gastos.data ?? []).reduce((s, g) => s + g.monto_centavos, 0);
    const comision = (comisiones.data ?? []).reduce((s, c) => s + c.monto_centavos, 0);
    const completadas = (citas.data ?? []).filter((c) => c.estado === 'completada').length;
    return (
      <div className="space-y-5">
        <Encabezado
          titulo="Reportes"
          descripcion="Resumen del mes actual calculado con ventas y egresos reales."
        />
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <TarjetaIndicador etiqueta="Ingresos" valor={formatearMXN(ingreso)} acentuado />
          <TarjetaIndicador etiqueta="Gastos" valor={formatearMXN(egreso)} />
          <TarjetaIndicador etiqueta="Comisiones" valor={formatearMXN(comision)} />
          <TarjetaIndicador
            etiqueta="Utilidad estimada"
            valor={formatearMXN(ingreso - egreso - comision)}
          />
        </section>
        <Tarjeta className="p-5">
          <p className="etiqueta text-[var(--texto-tenue)]">Citas completadas este mes</p>
          <p className="cifras mt-3 font-display text-4xl">{completadas}</p>
        </Tarjeta>
      </div>
    );
  }

  if (modulo === 'comisiones') {
    const { data } = await supabase
      .from('commissions')
      .select(
        'id, creado_en, tipo_item, base_centavos, monto_centavos, estado, barbers(nombre), sales(folio)'
      )
      .eq('organization_id', orgId)
      .order('creado_en', { ascending: false })
      .limit(250);
    return (
      <div className="space-y-5">
        <Encabezado
          titulo="Comisiones"
          descripcion="Comisiones generadas por cada línea de venta y su estado de pago."
        />
        <Tarjeta>
          {data?.length ? (
            <Tabla
              encabezados={['Fecha', 'Barbero', 'Venta', 'Tipo', 'Base', 'Comisión', 'Estado']}
            >
              {data.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3">{new Date(c.creado_en).toLocaleDateString('es-MX')}</td>
                  <td className="px-4 py-3">
                    {(c.barbers as unknown as { nombre?: string })?.nombre}
                  </td>
                  <td className="px-4 py-3">{(c.sales as unknown as { folio?: string })?.folio}</td>
                  <td className="px-4 py-3">{c.tipo_item}</td>
                  <td className="cifras px-4 py-3">{formatearMXN(c.base_centavos)}</td>
                  <td className="cifras px-4 py-3">{formatearMXN(c.monto_centavos)}</td>
                  <td className="px-4 py-3 uppercase">{c.estado}</td>
                </tr>
              ))}
            </Tabla>
          ) : (
            <CeldaVacia />
          )}
        </Tarjeta>
      </div>
    );
  }

  if (modulo === 'compras') {
    const { data } = await supabase
      .from('purchases')
      .select('id, folio, fecha, estado, total_centavos, suppliers(nombre)')
      .eq('organization_id', orgId)
      .order('fecha', { ascending: false })
      .limit(200);
    return (
      <div className="space-y-5">
        <Encabezado
          titulo="Compras"
          descripcion="Órdenes y recepciones de mercancía por proveedor."
        />
        <Tarjeta>
          {data?.length ? (
            <Tabla encabezados={['Fecha', 'Folio', 'Proveedor', 'Total', 'Estado']}>
              {data.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3">
                    {new Date(`${c.fecha}T12:00:00`).toLocaleDateString('es-MX')}
                  </td>
                  <td className="px-4 py-3">{c.folio}</td>
                  <td className="px-4 py-3">
                    {(c.suppliers as unknown as { nombre?: string })?.nombre ?? '—'}
                  </td>
                  <td className="cifras px-4 py-3">{formatearMXN(c.total_centavos)}</td>
                  <td className="px-4 py-3 uppercase">{c.estado}</td>
                </tr>
              ))}
            </Tabla>
          ) : (
            <CeldaVacia texto="No hay compras registradas. Los ajustes iniciales pueden capturarse desde Inventario." />
          )}
        </Tarjeta>
      </div>
    );
  }

  if (modulo === 'caja') {
    const [cajas, ubicaciones] = await Promise.all([
      supabase
        .from('cash_registers')
        .select(
          'id, fecha, turno, estado, fondo_inicial_centavos, efectivo_sistema_centavos, efectivo_contado_centavos, diferencia_centavos'
        )
        .eq('organization_id', orgId)
        .order('abierto_en', { ascending: false })
        .limit(100),
      supabase
        .from('locations')
        .select('id')
        .eq('organization_id', orgId)
        .eq('activa', true)
        .order('es_principal', { ascending: false })
        .limit(1),
    ]);
    const data = cajas.data;
    const idsCajasAbiertas = (data ?? [])
      .filter((caja) => caja.estado === 'abierta')
      .map((caja) => caja.id);
    const ventasCaja = idsCajasAbiertas.length
      ? await supabase
          .from('sales')
          .select('id, corte_caja_id')
          .eq('organization_id', orgId)
          .eq('estado', 'completada')
          .in('corte_caja_id', idsCajasAbiertas)
      : { data: [], error: null };
    const ventaACaja = new Map(
      (ventasCaja.data ?? [])
        .filter((venta) => Boolean(venta.corte_caja_id))
        .map((venta) => [venta.id, venta.corte_caja_id as string])
    );
    const pagosCaja = ventaACaja.size
      ? await supabase
          .from('sale_payments')
          .select('venta_id, metodo_pago, monto_centavos')
          .eq('organization_id', orgId)
          .eq('metodo_pago', 'efectivo')
          .in('venta_id', [...ventaACaja.keys()])
      : { data: [], error: null };
    const efectivoEnVivo = new Map<string, number>();
    for (const pago of pagosCaja.data ?? []) {
      const cajaId = ventaACaja.get(pago.venta_id);
      if (!cajaId) continue;
      efectivoEnVivo.set(cajaId, (efectivoEnVivo.get(cajaId) ?? 0) + pago.monto_centavos);
    }
    const cajaActual = (data ?? []).find((caja) => caja.estado === 'abierta');
    const ventasEfectivoActual = cajaActual ? (efectivoEnVivo.get(cajaActual.id) ?? 0) : 0;
    const esperadoActual = cajaActual
      ? cajaActual.fondo_inicial_centavos + ventasEfectivoActual
      : 0;
    return (
      <div className="space-y-5">
        <Encabezado
          titulo="Cortes de caja"
          descripcion="Controla el dinero recibido durante el turno y comprueba que coincida al cerrar."
        />
        <Aviso {...avisos} />
        {cajaActual ? (
          <section aria-label="Resumen de la caja abierta" className="grid gap-3 sm:grid-cols-3">
            <TarjetaIndicador
              etiqueta="Fondo inicial"
              valor={formatearMXN(cajaActual.fondo_inicial_centavos)}
            />
            <TarjetaIndicador
              etiqueta="Ventas en efectivo"
              valor={formatearMXN(ventasEfectivoActual)}
            />
            <TarjetaIndicador
              etiqueta="Efectivo esperado"
              valor={formatearMXN(esperadoActual)}
              acentuado
            />
          </section>
        ) : (
          <FormularioBase
            titulo="Abrir caja"
            action={gestionarCajaOrg}
            modulo="caja"
            textoBoton="Abrir caja"
          >
            <input type="hidden" name="accion" value="abrir" />
            <input type="hidden" name="location_id" value={ubicaciones.data?.[0]?.id ?? ''} />
            <Campo etiqueta="Turno" htmlFor="turno">
              <Entrada id="turno" name="turno" placeholder="Matutino, vespertino…" />
            </Campo>
            <Campo etiqueta="Dinero inicial en caja" htmlFor="fondo">
              <EntradaImporte id="fondo" name="fondo" defaultValue="0" />
            </Campo>
          </FormularioBase>
        )}
        <Tarjeta>
          {data?.length ? (
            <Tabla
              encabezados={[
                'Fecha',
                'Turno',
                'Fondo inicial',
                'Ventas en efectivo',
                'Efectivo esperado',
                'Dinero físico',
                'Diferencia',
                'Estado',
              ]}
            >
              {data.map((c) => {
                const ventasEfectivo =
                  c.estado === 'abierta'
                    ? (efectivoEnVivo.get(c.id) ?? 0)
                    : c.efectivo_sistema_centavos;
                const efectivoEsperado = c.fondo_inicial_centavos + ventasEfectivo;
                return (
                  <tr key={c.id}>
                    <td className="px-4 py-3">
                      {new Date(`${c.fecha}T12:00:00`).toLocaleDateString('es-MX')}
                    </td>
                    <td className="px-4 py-3">{c.turno ?? '—'}</td>
                    <td className="cifras px-4 py-3">{formatearMXN(c.fondo_inicial_centavos)}</td>
                    <td className="cifras px-4 py-3">{formatearMXN(ventasEfectivo)}</td>
                    <td className="cifras px-4 py-3 font-semibold text-dorado">
                      {formatearMXN(efectivoEsperado)}
                    </td>
                    <td className="cifras px-4 py-3">
                      {c.efectivo_contado_centavos === null
                        ? 'Pendiente'
                        : formatearMXN(c.efectivo_contado_centavos)}
                    </td>
                    <td className="cifras px-4 py-3">
                      {c.diferencia_centavos === null ? '—' : formatearMXN(c.diferencia_centavos)}
                    </td>
                    <td className="px-4 py-3">
                      {c.estado === 'abierta' ? (
                        <form action={gestionarCajaOrg} className="flex min-w-72 items-end gap-2">
                          <input type="hidden" name="accion" value="cerrar" />
                          <input type="hidden" name="caja_id" value={c.id} />
                          <div className="min-w-48">
                            <label
                              htmlFor={`contado-${c.id}`}
                              className="mb-1 block text-xs text-[var(--texto-suave)]"
                            >
                              Dinero físico en caja
                            </label>
                            <EntradaImporte
                              id={`contado-${c.id}`}
                              name="contado"
                              placeholder="Cuenta billetes y monedas"
                              required
                            />
                            <p className="mt-1 text-[10px] text-[var(--texto-tenue)]">
                              Incluye el fondo inicial.
                            </p>
                          </div>
                          <Boton tamano="sm" variante="contorno">
                            Cerrar caja
                          </Boton>
                        </form>
                      ) : (
                        <span className="uppercase">Cerrada</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </Tabla>
          ) : (
            <CeldaVacia />
          )}
        </Tarjeta>
      </div>
    );
  }

  if (modulo === 'equipo') {
    const { data } = await supabase
      .from('organization_members')
      .select('id, rol, estado, creado_en, profiles(nombre, telefono)')
      .eq('organization_id', orgId)
      .eq('rol', 'receptionist')
      .order('creado_en');
    return (
      <div className="space-y-5">
        <Encabezado
          titulo="Acceso de recepción"
          descripcion="Crea el acceso operativo de recepción. No permite modificar precios, inventario, reportes ni configuración."
        />
        <Aviso {...avisos} />
        <Tarjeta>
          <TarjetaCabecera>
            <TarjetaTitulo>Generar acceso</TarjetaTitulo>
          </TarjetaCabecera>
          <TarjetaContenido>
            <FormularioAccesoRecepcion action={crearAccesoRecepcionOrg} />
          </TarjetaContenido>
        </Tarjeta>
        <Tarjeta>
          {data?.length ? (
            <Tabla encabezados={['Nombre', 'Teléfono', 'Acceso', 'Desde', 'Acción']}>
              {data.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-3">
                    {(m.profiles as unknown as { nombre?: string })?.nombre || 'Usuario'}
                  </td>
                  <td className="px-4 py-3">
                    {(m.profiles as unknown as { telefono?: string })?.telefono ?? '—'}
                  </td>
                  <td className="px-4 py-3 uppercase">{m.estado}</td>
                  <td className="px-4 py-3">{new Date(m.creado_en).toLocaleDateString('es-MX')}</td>
                  <td className="px-4 py-3">
                    <form action={cambiarAccesoRecepcionOrg}>
                      <input type="hidden" name="membresia_id" value={m.id} />
                      <input
                        type="hidden"
                        name="estado"
                        value={m.estado === 'activa' ? 'suspendida' : 'activa'}
                      />
                      <Boton tamano="sm" variante={m.estado === 'activa' ? 'peligro' : 'contorno'}>
                        {m.estado === 'activa' ? 'Suspender acceso' : 'Reactivar acceso'}
                      </Boton>
                    </form>
                  </td>
                </tr>
              ))}
            </Tabla>
          ) : (
            <CeldaVacia texto="Todavía no hay una cuenta de recepción." />
          )}
        </Tarjeta>
      </div>
    );
  }

  if (modulo === 'whatsapp') {
    const { data } = await supabase
      .from('whatsapp_messages')
      .select(
        'id, creado_en, destinatario, tipo, texto_renderizado, estado, programado_para, ultimo_error'
      )
      .eq('organization_id', orgId)
      .order('creado_en', { ascending: false })
      .limit(200);
    return (
      <div className="space-y-5">
        <Encabezado
          titulo="WhatsApp"
          descripcion="Bandeja de confirmaciones y recordatorios. Funciona manualmente y queda preparada para Cloud API."
        />
        <Aviso {...avisos} />
        <Tarjeta>
          {data?.length ? (
            <Tabla encabezados={['Programado', 'Destino', 'Tipo', 'Mensaje', 'Estado', 'Acción']}>
              {data.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-3">
                    {new Date(m.programado_para ?? m.creado_en).toLocaleString('es-MX')}
                  </td>
                  <td className="px-4 py-3">{m.destinatario}</td>
                  <td className="px-4 py-3">{m.tipo}</td>
                  <td className="max-w-md px-4 py-3 text-xs">{m.texto_renderizado}</td>
                  <td className="px-4 py-3 uppercase">{m.estado}</td>
                  <td className="px-4 py-3">
                    {['manual_pendiente', 'listo_para_envio'].includes(m.estado) ? (
                      <div className="flex gap-2">
                        <Boton comoHijo tamano="sm" variante="contorno">
                          <a
                            href={`https://wa.me/${m.destinatario.replace(/\D/g, '')}?text=${encodeURIComponent(m.texto_renderizado)}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <MessageCircle className="size-3" /> Abrir
                          </a>
                        </Boton>
                        <form action={marcarWhatsappOrg}>
                          <input type="hidden" name="id" value={m.id} />
                          <Boton tamano="sm" variante="sutil">
                            Marcar enviado
                          </Boton>
                        </form>
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </Tabla>
          ) : (
            <CeldaVacia texto="Los recordatorios aparecerán aquí cuando se creen citas." />
          )}
        </Tarjeta>
      </div>
    );
  }

  if (modulo === 'pagos') {
    const [cuenta, pagos, plataforma] = await Promise.all([
      supabase.from('billing_accounts').select('*').eq('organization_id', orgId).maybeSingle(),
      supabase
        .from('manual_payments')
        .select('*')
        .eq('organization_id', orgId)
        .order('fecha_pago', { ascending: false })
        .limit(50),
      supabase
        .from('platform_settings')
        .select(
          'banco_nombre, banco_titular, banco_clabe, banco_cuenta, instrucciones_pago, whatsapp_soporte'
        )
        .maybeSingle(),
    ]);
    return (
      <div className="space-y-5">
        <Encabezado
          titulo="Plan y pagos"
          descripcion="Tu mensualidad se paga por transferencia. Un vencimiento solo genera aviso; el bloqueo siempre lo hace una persona."
        />
        <section className="grid gap-3 md:grid-cols-3">
          <TarjetaIndicador
            etiqueta="Mensualidad"
            valor={formatearMXN(cuenta.data?.mensualidad_centavos ?? 0)}
            acentuado
          />
          <TarjetaIndicador
            etiqueta="Próximo pago"
            valor={
              cuenta.data?.proxima_fecha_pago
                ? new Date(`${cuenta.data.proxima_fecha_pago}T12:00:00`).toLocaleDateString('es-MX')
                : 'Por definir'
            }
          />
          <TarjetaIndicador etiqueta="Estado" valor={cuenta.data?.estado_pago ?? 'current'} />
        </section>
        <Tarjeta>
          <TarjetaCabecera>
            <TarjetaTitulo>Datos de transferencia</TarjetaTitulo>
          </TarjetaCabecera>
          <TarjetaContenido className="grid gap-3 text-sm sm:grid-cols-2">
            <p>
              <span className="block text-xs text-[var(--texto-tenue)]">Banco</span>
              {plataforma.data?.banco_nombre ?? 'Por configurar'}
            </p>
            <p>
              <span className="block text-xs text-[var(--texto-tenue)]">Titular</span>
              {plataforma.data?.banco_titular ?? 'Por configurar'}
            </p>
            <p>
              <span className="block text-xs text-[var(--texto-tenue)]">CLABE</span>
              {plataforma.data?.banco_clabe ?? 'Por configurar'}
            </p>
            <p>
              <span className="block text-xs text-[var(--texto-tenue)]">Cuenta</span>
              {plataforma.data?.banco_cuenta ?? 'Por configurar'}
            </p>
            <p className="sm:col-span-2 text-[var(--texto-suave)]">
              {plataforma.data?.instrucciones_pago}
            </p>
          </TarjetaContenido>
        </Tarjeta>
        <Tarjeta>
          {pagos.data?.length ? (
            <Tabla encabezados={['Fecha', 'Referencia', 'Periodo', 'Monto', 'Estado']}>
              {pagos.data.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3">
                    {new Date(`${p.fecha_pago}T12:00:00`).toLocaleDateString('es-MX')}
                  </td>
                  <td className="px-4 py-3">{p.referencia ?? '—'}</td>
                  <td className="px-4 py-3">
                    {[p.periodo_inicio, p.periodo_fin].filter(Boolean).join(' → ') || '—'}
                  </td>
                  <td className="cifras px-4 py-3">{formatearMXN(p.monto_centavos)}</td>
                  <td className="px-4 py-3 uppercase">{p.estado}</td>
                </tr>
              ))}
            </Tabla>
          ) : (
            <CeldaVacia texto="No hay pagos registrados." />
          )}
        </Tarjeta>
      </div>
    );
  }

  if (modulo === 'configuracion') {
    const { data: ajustes } = await supabase
      .from('organization_settings')
      .select('*')
      .eq('organization_id', orgId)
      .maybeSingle();
    return (
      <div className="space-y-5">
        <Encabezado
          titulo="Configuración"
          descripcion="Parámetros de agenda, cita exprés, pedidos y recordatorios de la organización."
        />
        <Aviso {...avisos} />
        <Tarjeta>
          <TarjetaCabecera>
            <TarjetaTitulo>Operación</TarjetaTitulo>
          </TarjetaCabecera>
          <TarjetaContenido>
            <form
              action={guardarConfiguracionOrg}
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              <Campo etiqueta="Intervalo de agenda (min)" htmlFor="intervalo">
                <Entrada
                  id="intervalo"
                  name="intervalo"
                  type="number"
                  min="5"
                  max="60"
                  defaultValue={ajustes?.intervalo_slots_minutos ?? 15}
                  required
                />
              </Campo>
              <Campo etiqueta="Anticipación mínima (min)" htmlFor="anticipacion">
                <Entrada
                  id="anticipacion"
                  name="anticipacion"
                  type="number"
                  min="0"
                  defaultValue={ajustes?.anticipacion_minima_minutos ?? 60}
                  required
                />
              </Campo>
              <Campo etiqueta="Máximo para reservar (días)" htmlFor="maximo_dias">
                <Entrada
                  id="maximo_dias"
                  name="maximo_dias"
                  type="number"
                  min="1"
                  max="365"
                  defaultValue={ajustes?.anticipacion_maxima_dias ?? 60}
                  required
                />
              </Campo>
              <Campo etiqueta="Límite de cancelación (h)" htmlFor="cancelacion">
                <Entrada
                  id="cancelacion"
                  name="cancelacion"
                  type="number"
                  min="0"
                  defaultValue={ajustes?.cancelacion_horas_limite ?? 3}
                  required
                />
              </Campo>
              <Campo etiqueta="Reserva de producto (min)" htmlFor="reserva">
                <Entrada
                  id="reserva"
                  name="reserva"
                  type="number"
                  min="5"
                  max="1440"
                  defaultValue={ajustes?.reserva_pedido_minutos ?? 60}
                  required
                />
              </Campo>
              <Campo etiqueta="Recordatorio (h antes)" htmlFor="recordatorio">
                <Entrada
                  id="recordatorio"
                  name="recordatorio"
                  type="number"
                  min="1"
                  max="168"
                  defaultValue={ajustes?.recordatorio_1_horas_antes ?? 24}
                  required
                />
              </Campo>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="express_activa"
                  defaultChecked={ajustes?.express_activa ?? true}
                />{' '}
                Cita exprés activa
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="reserva_activa"
                  defaultChecked={ajustes?.reserva_pedido_activa ?? true}
                />{' '}
                Reservar inventario en pedidos
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="recordatorio_activo"
                  defaultChecked={ajustes?.recordatorio_1_activo ?? true}
                />{' '}
                Recordatorio principal activo
              </label>
              <div className="sm:col-span-2 lg:col-span-3">
                <Boton type="submit">Guardar configuración</Boton>
              </div>
            </form>
          </TarjetaContenido>
        </Tarjeta>
        <Tarjeta>
          <TarjetaCabecera>
            <TarjetaTitulo>Resumen operativo</TarjetaTitulo>
          </TarjetaCabecera>
          <TarjetaContenido className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ['Intervalo de agenda', `${ajustes?.intervalo_slots_minutos ?? 15} min`],
              ['Anticipación mínima', `${ajustes?.anticipacion_minima_minutos ?? 60} min`],
              ['Máximo para reservar', `${ajustes?.anticipacion_maxima_dias ?? 60} días`],
              [
                'Cita exprés',
                ajustes?.express_activa ? `Activa ×${ajustes.express_multiplicador}` : 'Inactiva',
              ],
              [
                'Reserva de pedidos',
                ajustes?.reserva_pedido_activa
                  ? `${ajustes.reserva_pedido_minutos} min`
                  : 'Inactiva',
              ],
              [
                'Recordatorio principal',
                ajustes?.recordatorio_1_activo
                  ? `${ajustes.recordatorio_1_horas_antes} h antes`
                  : 'Inactivo',
              ],
            ].map(([k, v]) => (
              <div key={k}>
                <span className="etiqueta text-[var(--texto-tenue)]">{k}</span>
                <p className="mt-2 font-display text-2xl">{v}</p>
              </div>
            ))}
          </TarjetaContenido>
        </Tarjeta>
      </div>
    );
  }

  notFound();
}
