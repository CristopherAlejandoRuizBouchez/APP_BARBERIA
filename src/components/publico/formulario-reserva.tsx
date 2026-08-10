'use client';

import * as React from 'react';
import { CalendarDays, Check, CheckCircle2, Clock3, Copy, MessageCircle } from 'lucide-react';
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
}: {
  slug: string;
  sucursales: Opcion[];
  barberos: Opcion[];
  servicios: Servicio[];
}) {
  const locationId = sucursales[0]?.id ?? '';
  const [barberId, setBarberId] = React.useState(barberos[0]?.id ?? '');
  const [serviceId, setServiceId] = React.useState(servicios[0]?.id ?? '');
  const [fecha, setFecha] = React.useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [slots, setSlots] = React.useState<{ inicio: string; fin: string }[]>([]);
  const [inicio, setInicio] = React.useState('');
  const [cargando, setCargando] = React.useState(false);
  const [resultado, setResultado] = React.useState<{
    ok: boolean;
    texto: string;
    token?: string;
    folio?: string;
  } | null>(null);
  const [copiado, setCopiado] = React.useState(false);
  const [enviando, iniciar] = React.useTransition();

  React.useEffect(() => {
    if (!resultado?.ok || !resultado.token || !resultado.folio) return;
    guardarCitaEnDispositivo(slug, {
      token: resultado.token,
      folio: resultado.folio,
    });
  }, [resultado, slug]);

  React.useEffect(() => {
    if (!locationId || !barberId || !serviceId || !fecha) return;
    const controlador = new AbortController();
    setCargando(true);
    setInicio('');
    setResultado(null);
    const query = new URLSearchParams({ locationId, barberId, serviceId, fecha });
    fetch(`/api/publico/${slug}/slots?${query}`, { signal: controlador.signal })
      .then((r) => r.json())
      .then((r) => setSlots(Array.isArray(r.slots) ? r.slots : []))
      .catch(() => setSlots([]))
      .finally(() => setCargando(false));
    return () => controlador.abort();
  }, [slug, locationId, barberId, serviceId, fecha]);

  function enviar(formData: FormData) {
    setResultado(null);
    iniciar(async () => {
      const respuesta = await crearCitaPublica(slug, {
        locationId,
        barberId,
        serviceIds: [serviceId],
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
        texto: `Tu cita ${respuesta.datos.folio} quedó solicitada por ${formatearMXN(respuesta.datos.totalCentavos)}. La barbería confirmará contigo.`,
        token: respuesta.datos.token,
        folio: respuesta.datos.folio,
      });
    });
  }

  function enlacePrivado(token: string) {
    return `${window.location.origin}/b/${slug}/mi-cita?token=${encodeURIComponent(token)}`;
  }

  async function copiarEnlace(token: string) {
    try {
      await navigator.clipboard.writeText(enlacePrivado(token));
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2500);
    } catch {
      window.prompt('Copia el enlace privado de tu cita:', enlacePrivado(token));
    }
  }

  if (resultado?.ok) {
    return (
      <div
        className="mx-auto max-w-xl border p-8 text-center"
        style={{ borderColor: 'var(--tema-borde)', background: 'var(--tema-superficie)' }}
      >
        <CheckCircle2 className="mx-auto size-10" style={{ color: 'var(--tema-primario)' }} />
        <h2 className="mt-5 font-[family-name:var(--tema-fuente-titulos)] text-3xl">
          Cita solicitada
        </h2>
        <p className="mt-3 leading-relaxed" style={{ color: 'var(--tema-texto-suave)' }}>
          {resultado.texto}
        </p>
        <p className="mt-3 text-xs" style={{ color: 'var(--tema-texto-suave)' }}>
          Esta cita quedó guardada en este dispositivo. Conserva el enlace privado para consultarla
          desde otro teléfono o computadora.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {resultado.token ? (
            <Boton comoHijo variante="primario">
              <a href={`/b/${slug}/mi-cita?token=${encodeURIComponent(resultado.token)}`}>
                Ver y administrar cita
              </a>
            </Boton>
          ) : null}
          {resultado.token ? (
            <Boton variante="contorno" onClick={() => copiarEnlace(resultado.token!)}>
              {copiado ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copiado ? 'Enlace copiado' : 'Copiar enlace'}
            </Boton>
          ) : null}
          {resultado.token ? (
            <Boton comoHijo variante="contorno">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  `Mi cita ${resultado.folio ?? ''}: ${enlacePrivado(resultado.token)}`
                )}`}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle className="size-4" />
                Enviar por WhatsApp
              </a>
            </Boton>
          ) : null}
          <Boton variante="contorno" onClick={() => setResultado(null)}>
            Reservar otra
          </Boton>
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
      <Campo etiqueta="Servicio" htmlFor="service">
        <select
          id="service"
          value={serviceId}
          onChange={(e) => setServiceId(e.target.value)}
          className="h-10 w-full border bg-[var(--tema-fondo)] px-3 text-sm"
        >
          {servicios.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre} · {formatearMXN(s.precio_centavos)}
            </option>
          ))}
        </select>
      </Campo>
      <Campo etiqueta="Barbero" htmlFor="barber">
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
          min={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setFecha(e.target.value)}
        />
      </Campo>
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
        <Boton type="submit" tamano="lg" disabled={!inicio || enviando}>
          <CalendarDays className="size-4" />
          {enviando ? 'Reservando…' : 'Solicitar cita'}
        </Boton>
      </div>
    </form>
  );
}
