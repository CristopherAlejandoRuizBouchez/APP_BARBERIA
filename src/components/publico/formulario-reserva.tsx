'use client';

import * as React from 'react';
import { CalendarDays, CheckCircle2, Clock3 } from 'lucide-react';
import { crearCitaPublica } from '@/app/b/[slug]/acciones';
import { Boton } from '@/components/ui/boton';
import { AreaTexto, Campo, Entrada, EntradaTelefono } from '@/components/ui/campo';
import { guardarCitaEnDispositivo } from '@/lib/citas-dispositivo';
import { formatearMXN } from '@/lib/dinero';

type Opcion = { id: string; nombre: string };
type Servicio = Opcion & { precio_centavos: number; duracion_minutos: number };

export function FormularioReserva({
  slug,
  sucursales,
  barberos,
  servicios,
  fechaHoy,
  fechaInicial,
  recargoAgendaCentavos,
  recargoExpressCentavos,
  expressActiva,
}: {
  slug: string;
  sucursales: Opcion[];
  barberos: Opcion[];
  servicios: Servicio[];
  fechaHoy: string;
  fechaInicial: string;
  recargoAgendaCentavos: number;
  recargoExpressCentavos: number;
  expressActiva: boolean;
}) {
  const locationId = sucursales[0]?.id ?? '';
  const [barberId, setBarberId] = React.useState(barberos[0]?.id ?? '');
  const [serviceIds, setServiceIds] = React.useState<string[]>(
    servicios[0]?.id ? [servicios[0].id] : []
  );
  const [fecha, setFecha] = React.useState(fechaInicial);
  const [slots, setSlots] = React.useState<{ inicio: string; fin: string }[]>([]);
  const [inicio, setInicio] = React.useState('');
  const [cargando, setCargando] = React.useState(false);
  const [resultado, setResultado] = React.useState<{
    ok: boolean;
    texto: string;
    token?: string;
    folio?: string;
    subtotalCentavos?: number;
    recargoCentavos?: number;
    totalCentavos?: number;
    esExpress?: boolean;
    servicios?: Array<{ id: string; nombre: string; precioCentavos: number }>;
  } | null>(null);
  const [enviando, iniciar] = React.useTransition();
  const serviciosSeleccionados = servicios.filter((servicio) => serviceIds.includes(servicio.id));
  const subtotalCentavos = serviciosSeleccionados.reduce(
    (suma, servicio) => suma + servicio.precio_centavos,
    0
  );
  const esExpress = fecha === fechaHoy;
  const recargoActualCentavos = esExpress ? recargoExpressCentavos : recargoAgendaCentavos;
  const totalCentavos = subtotalCentavos + recargoActualCentavos;
  const citaHoyNoDisponible = esExpress && !expressActiva;

  function alternarServicio(id: string) {
    setServiceIds((actuales) => {
      if (actuales.includes(id)) return actuales.filter((actual) => actual !== id);
      if (actuales.length >= 6) return actuales;
      return [...actuales, id];
    });
  }

  React.useEffect(() => {
    if (!resultado?.ok || !resultado.token || !resultado.folio) return;
    guardarCitaEnDispositivo(slug, {
      token: resultado.token,
      folio: resultado.folio,
    });
  }, [resultado, slug]);

  React.useEffect(() => {
    if (!locationId || !barberId || !serviceIds.length || !fecha || citaHoyNoDisponible) {
      setSlots([]);
      setInicio('');
      return;
    }
    const controlador = new AbortController();
    setCargando(true);
    setInicio('');
    setResultado(null);
    const query = new URLSearchParams({ locationId, barberId, fecha });
    serviceIds.forEach((serviceId) => query.append('serviceId', serviceId));
    fetch(`/api/publico/${slug}/slots?${query}`, { signal: controlador.signal })
      .then((r) => r.json())
      .then((r) => setSlots(Array.isArray(r.slots) ? r.slots : []))
      .catch(() => setSlots([]))
      .finally(() => setCargando(false));
    return () => controlador.abort();
  }, [slug, locationId, barberId, serviceIds, fecha, citaHoyNoDisponible]);

  function enviar(formData: FormData) {
    setResultado(null);
    iniciar(async () => {
      const respuesta = await crearCitaPublica(slug, {
        locationId,
        barberId,
        serviceIds,
        inicio,
        nombre: String(formData.get('nombre') ?? ''),
        telefono: String(formData.get('telefono') ?? ''),
        notas: String(formData.get('notas') ?? ''),
      });
      if (!respuesta.ok) {
        setResultado({ ok: false, texto: respuesta.mensaje });
        return;
      }
      setResultado({
        ok: true,
        texto: `Tu cita ${respuesta.datos.folio} quedó registrada correctamente.`,
        token: respuesta.datos.token,
        folio: respuesta.datos.folio,
        subtotalCentavos: respuesta.datos.subtotalCentavos,
        recargoCentavos: respuesta.datos.recargoCentavos,
        totalCentavos: respuesta.datos.totalCentavos,
        esExpress: respuesta.datos.esExpress,
        servicios: respuesta.datos.servicios,
      });
    });
  }

  if (resultado?.ok) {
    return (
      <div
        className="mx-auto max-w-xl border p-8 text-center"
        style={{ borderColor: 'var(--tema-borde)', background: 'var(--tema-superficie)' }}
      >
        <CheckCircle2 className="mx-auto size-10" style={{ color: 'var(--tema-primario)' }} />
        <h2 className="mt-5 font-[family-name:var(--tema-fuente-titulos)] text-3xl">
          Cita registrada
        </h2>
        <p className="mt-3 leading-relaxed" style={{ color: 'var(--tema-texto-suave)' }}>
          {resultado.texto}
        </p>
        <div
          className="mt-6 border p-5 text-left"
          style={{ borderColor: 'var(--tema-borde)', background: 'var(--tema-fondo)' }}
        >
          <p className="text-sm font-medium">Detalle de tu cita</p>
          <div className="mt-4 space-y-2 text-sm">
            {(resultado.servicios ?? []).map((servicio) => (
              <div key={servicio.id} className="flex justify-between gap-4">
                <span>{servicio.nombre}</span>
                <span className="cifras">{formatearMXN(servicio.precioCentavos)}</span>
              </div>
            ))}
            <div
              className="flex justify-between gap-4 border-t pt-3"
              style={{ borderColor: 'var(--tema-borde)' }}
            >
              <span>{resultado.esExpress ? 'Cargo por cita exprés' : 'Cargo por reservación'}</span>
              <span className="cifras">{formatearMXN(resultado.recargoCentavos ?? 0)}</span>
            </div>
            <div className="flex justify-between gap-4 text-base font-semibold">
              <span>Total</span>
              <span className="cifras" style={{ color: 'var(--tema-primario)' }}>
                {formatearMXN(resultado.totalCentavos ?? 0)}
              </span>
            </div>
          </div>
          <p className="mt-4 text-xs" style={{ color: 'var(--tema-texto-suave)' }}>
            El cargo se aplica una sola vez a toda la cita, aunque hayas elegido varios servicios.
          </p>
        </div>
        <p className="mt-3 text-xs" style={{ color: 'var(--tema-texto-suave)' }}>
          La guardamos automáticamente en este dispositivo. Cuando regreses, entra a “Mis citas” y
          aparecerá sin pedirte códigos ni enviar mensajes.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {resultado.token ? (
            <Boton comoHijo variante="primario">
              <a href={`/b/${slug}/mi-cita?token=${encodeURIComponent(resultado.token)}`}>
                Ver mi cita
              </a>
            </Boton>
          ) : null}
          <Boton comoHijo variante="contorno">
            <a href={`/b/${slug}`}>Volver al inicio</a>
          </Boton>
          <div className="sm:col-span-2">
            <Boton variante="sutil" ancho="completo" onClick={() => setResultado(null)}>
              Reservar otra cita
            </Boton>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form
      action={enviar}
      className="grid gap-5 border p-5 sm:grid-cols-2 sm:p-8"
      style={{ borderColor: 'var(--tema-borde)', background: 'var(--tema-superficie)' }}
    >
      <fieldset className="sm:col-span-2">
        <legend className="text-sm font-medium">¿Qué servicios necesitas?</legend>
        <p className="mt-1 text-xs" style={{ color: 'var(--tema-texto-suave)' }}>
          Puedes seleccionar hasta 6. El tiempo disponible se calcula con todos los servicios.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {servicios.map((servicio) => {
            const seleccionado = serviceIds.includes(servicio.id);
            return (
              <label
                key={servicio.id}
                className="flex cursor-pointer items-start gap-3 border p-4 transition-colors"
                style={{
                  borderColor: seleccionado ? 'var(--tema-primario)' : 'var(--tema-borde)',
                  background: seleccionado
                    ? 'color-mix(in srgb, var(--tema-primario) 12%, transparent)'
                    : 'var(--tema-fondo)',
                }}
              >
                <input
                  type="checkbox"
                  checked={seleccionado}
                  onChange={() => alternarServicio(servicio.id)}
                  className="mt-1"
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{servicio.nombre}</span>
                  <span className="mt-1 block text-xs" style={{ color: 'var(--tema-texto-suave)' }}>
                    {servicio.duracion_minutos} min
                  </span>
                </span>
                <span className="cifras text-sm">{formatearMXN(servicio.precio_centavos)}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <Campo etiqueta="Barbero" htmlFor="barber" className="sm:col-span-2">
        <select
          id="barber"
          value={barberId}
          onChange={(e) => setBarberId(e.target.value)}
          className="h-10 w-full border bg-[var(--tema-fondo)] px-3 text-sm"
        >
          {barberos.map((b) => (
            <option key={b.id} value={b.id}>
              {b.nombre}
            </option>
          ))}
        </select>
      </Campo>
      <Campo etiqueta="Fecha" htmlFor="fecha">
        <Entrada
          id="fecha"
          type="date"
          value={fecha}
          min={fechaHoy}
          onChange={(e) => setFecha(e.target.value)}
        />
      </Campo>
      <div
        className="border p-4"
        style={{ borderColor: 'var(--tema-borde)', background: 'var(--tema-fondo)' }}
      >
        <p className="text-xs" style={{ color: 'var(--tema-texto-suave)' }}>
          {esExpress ? 'Reservación para hoy' : 'Reservación programada'}
        </p>
        <p className="mt-1 font-medium">
          {esExpress ? 'Cargo por cita exprés' : 'Cargo por reservación'}:{' '}
          <span className="cifras">{formatearMXN(recargoActualCentavos)}</span>
        </p>
        {citaHoyNoDisponible ? (
          <p className="mt-2 text-xs text-peligro">
            Esta barbería no acepta reservaciones para el mismo día.
          </p>
        ) : null}
      </div>
      <div className="sm:col-span-2">
        <p className="mb-2 flex items-center gap-2 text-sm font-medium">
          <Clock3 className="size-4" /> Horario disponible
        </p>
        {cargando ? (
          <p className="text-sm" style={{ color: 'var(--tema-texto-suave)' }}>
            Consultando agenda…
          </p>
        ) : slots.length ? (
          <div className="flex flex-wrap gap-2">
            {slots.map((s) => (
              <button
                key={s.inicio}
                type="button"
                onClick={() => setInicio(s.inicio)}
                className="border px-3 py-2 text-sm"
                style={{
                  borderColor: inicio === s.inicio ? 'var(--tema-primario)' : 'var(--tema-borde)',
                  background:
                    inicio === s.inicio
                      ? 'color-mix(in srgb, var(--tema-primario) 16%, transparent)'
                      : 'transparent',
                }}
              >
                {new Date(s.inicio).toLocaleTimeString('es-MX', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm" style={{ color: 'var(--tema-texto-suave)' }}>
            No hay horarios para esta combinación. Prueba otra fecha o barbero.
          </p>
        )}
      </div>
      <div
        className="sm:col-span-2 border p-5"
        style={{ borderColor: 'var(--tema-primario)', background: 'var(--tema-fondo)' }}
      >
        <div className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <span>Servicios ({serviceIds.length})</span>
            <span className="cifras">{formatearMXN(subtotalCentavos)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span>{esExpress ? 'Cargo exprés' : 'Cargo por reservación'} (una sola vez)</span>
            <span className="cifras">{formatearMXN(recargoActualCentavos)}</span>
          </div>
          <div
            className="flex justify-between gap-4 border-t pt-3 text-lg font-semibold"
            style={{ borderColor: 'var(--tema-borde)' }}
          >
            <span>Total de la cita</span>
            <span className="cifras" style={{ color: 'var(--tema-primario)' }}>
              {formatearMXN(totalCentavos)}
            </span>
          </div>
        </div>
      </div>
      <Campo etiqueta="Tu nombre" htmlFor="nombre" requerido>
        <Entrada id="nombre" name="nombre" autoComplete="name" required />
      </Campo>
      <Campo etiqueta="WhatsApp" htmlFor="telefono" requerido>
        <EntradaTelefono id="telefono" name="telefono" required />
      </Campo>
      <Campo etiqueta="Notas" htmlFor="notas" className="sm:col-span-2">
        <AreaTexto id="notas" name="notas" placeholder="Indicaciones opcionales" />
      </Campo>
      {resultado && !resultado.ok ? (
        <p role="alert" className="sm:col-span-2 text-sm text-peligro">
          {resultado.texto}
        </p>
      ) : null}
      <div className="sm:col-span-2">
        <Boton
          type="submit"
          tamano="lg"
          disabled={!inicio || !serviceIds.length || enviando || citaHoyNoDisponible}
        >
          <CalendarDays className="size-4" />
          {enviando ? 'Reservando…' : 'Solicitar cita'}
        </Boton>
      </div>
    </form>
  );
}
