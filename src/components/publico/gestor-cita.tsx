'use client';

import * as React from 'react';
import { CalendarDays, CalendarPlus, Clock3, Scissors, UserRound } from 'lucide-react';
import {
  cancelarCitaPublica,
  consultarCitaPublica,
  recuperarCitaPublica,
  type CitaPublica,
} from '@/app/b/[slug]/acciones';
import { Boton } from '@/components/ui/boton';
import { Campo, Entrada, EntradaTelefono } from '@/components/ui/campo';
import {
  guardarCitaEnDispositivo,
  leerCitasGuardadas,
  type CitaGuardada,
} from '@/lib/citas-dispositivo';
import { formatearMXN } from '@/lib/dinero';

export function GestorCita({
  slug,
  tokenInicial,
  citaInicial,
}: {
  slug: string;
  tokenInicial: string;
  citaInicial: CitaPublica | null;
}) {
  const [token, setToken] = React.useState(tokenInicial);
  const [cita, setCita] = React.useState(citaInicial);
  const [error, setError] = React.useState('');
  const [motivo, setMotivo] = React.useState('Cambio de planes');
  const [folioBusqueda, setFolioBusqueda] = React.useState('');
  const [telefonoBusqueda, setTelefonoBusqueda] = React.useState('');
  const [citasGuardadas, setCitasGuardadas] = React.useState<CitaGuardada[]>([]);
  const [inicializando, setInicializando] = React.useState(!citaInicial && !tokenInicial);
  const [ahora, setAhora] = React.useState(() => Date.now());
  const [procesando, iniciar] = React.useTransition();

  React.useEffect(() => {
    const guardadas = leerCitasGuardadas(slug);
    setCitasGuardadas(guardadas);
    if (citaInicial || tokenInicial || !guardadas[0]) {
      setInicializando(false);
      return;
    }

    const guardada = guardadas[0];
    setToken(guardada.token);
    iniciar(async () => {
      const resultado = await consultarCitaPublica(slug, guardada.token);
      if (resultado.ok) {
        setCita(resultado.datos);
        setError('');
      } else {
        setError('No pudimos abrir automáticamente la cita guardada. Puedes buscarla abajo.');
      }
      setInicializando(false);
    });
  }, [citaInicial, slug, tokenInicial]);

  React.useEffect(() => {
    const intervalo = window.setInterval(() => setAhora(Date.now()), 60_000);
    return () => window.clearInterval(intervalo);
  }, []);

  React.useEffect(() => {
    if (!cita || token.length < 40) return;
    guardarCitaEnDispositivo(slug, { token, folio: cita.folio });
    setCitasGuardadas(leerCitasGuardadas(slug));
  }, [cita, slug, token]);

  function consultar(tokenElegido = token) {
    setError('');
    setToken(tokenElegido);
    iniciar(async () => {
      const resultado = await consultarCitaPublica(slug, tokenElegido);
      if (!resultado.ok) {
        setCita(null);
        setError(resultado.mensaje);
        return;
      }
      setCita(resultado.datos);
    });
  }

  function cancelar() {
    setError('');
    iniciar(async () => {
      const resultado = await cancelarCitaPublica(slug, token, motivo);
      if (!resultado.ok) return setError(resultado.mensaje);
      const actualizada = await consultarCitaPublica(slug, token);
      if (actualizada.ok) setCita(actualizada.datos);
    });
  }

  function recuperar() {
    setError('');
    iniciar(async () => {
      const resultado = await recuperarCitaPublica(slug, {
        folio: folioBusqueda,
        telefono: telefonoBusqueda,
      });
      if (!resultado.ok) {
        setError('No encontramos una cita reciente con ese folio y número de WhatsApp.');
        return;
      }
      const detalle = await consultarCitaPublica(slug, resultado.datos.token);
      if (!detalle.ok) {
        setError(detalle.mensaje);
        return;
      }
      setToken(resultado.datos.token);
      setCita(detalle.datos);
      guardarCitaEnDispositivo(slug, {
        token: resultado.datos.token,
        folio: detalle.datos.folio,
      });
      setCitasGuardadas(leerCitasGuardadas(slug));
    });
  }

  function textoCuentaRegresiva(): string {
    if (!cita) return '';
    if (cita.estado === 'completada') return 'Cita realizada';
    if (cita.estado === 'cancelada') return 'Cita cancelada';
    const diferencia = new Date(cita.inicio).getTime() - ahora;
    if (diferencia <= 0) return 'La hora de tu cita ya llegó';
    const minutos = Math.ceil(diferencia / 60_000);
    if (minutos < 60) return `Faltan ${minutos} min`;
    const horas = Math.ceil(minutos / 60);
    if (horas < 24) return `Faltan ${horas} h`;
    const dias = Math.ceil(horas / 24);
    return `Faltan ${dias} ${dias === 1 ? 'día' : 'días'}`;
  }

  function enlaceCalendario(): string {
    if (!cita) return '#';
    const fechaGoogle = (valor: string) =>
      new Date(valor)
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}/, '');
    const parametros = new URLSearchParams({
      action: 'TEMPLATE',
      text: `Cita en ${cita.sucursal}`,
      dates: `${fechaGoogle(cita.inicio)}/${fechaGoogle(cita.fin)}`,
      details: `${cita.servicios.map((servicio) => servicio.nombre).join(', ')} · Barbero: ${cita.barbero}`,
      location: cita.sucursal,
    });
    return `https://calendar.google.com/calendar/render?${parametros.toString()}`;
  }

  if (inicializando) {
    return (
      <div
        className="mx-auto max-w-xl border p-8 text-center"
        style={{ borderColor: 'var(--tema-borde)', background: 'var(--tema-superficie)' }}
      >
        <Clock3
          className="mx-auto size-8 animate-pulse"
          style={{ color: 'var(--tema-primario)' }}
        />
        <p className="mt-4 font-medium">Buscando tus citas guardadas…</p>
        <p className="mt-2 text-sm" style={{ color: 'var(--tema-texto-suave)' }}>
          No necesitas iniciar sesión ni escribir ningún código.
        </p>
      </div>
    );
  }

  if (!cita) {
    return (
      <div
        className="mx-auto max-w-xl border p-6 sm:p-8"
        style={{ borderColor: 'var(--tema-borde)', background: 'var(--tema-superficie)' }}
      >
        {citasGuardadas.length ? (
          <div className="mb-7 border-b pb-7" style={{ borderColor: 'var(--tema-borde)' }}>
            <p className="text-sm font-medium">Tus citas en este dispositivo</p>
            <div className="mt-3 flex flex-col gap-2">
              {citasGuardadas.map((guardada) => (
                <Boton
                  key={guardada.token}
                  variante="sutil"
                  ancho="completo"
                  onClick={() => consultar(guardada.token)}
                  disabled={procesando}
                >
                  Ver cita {guardada.folio}
                </Boton>
              ))}
            </div>
          </div>
        ) : null}
        <div>
          <h2 className="font-[family-name:var(--tema-fuente-titulos)] text-2xl">
            ¿Estás usando otro dispositivo?
          </h2>
          <p className="mt-2 text-sm" style={{ color: 'var(--tema-texto-suave)' }}>
            Escribe el folio y el mismo número de WhatsApp que registraste. No enviaremos ningún
            mensaje.
          </p>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Folio de la cita" htmlFor="folio-cita">
            <Entrada
              id="folio-cita"
              value={folioBusqueda}
              onChange={(e) => setFolioBusqueda(e.target.value.toUpperCase())}
              placeholder="BQ-7N39"
              autoComplete="off"
            />
          </Campo>
          <Campo etiqueta="WhatsApp registrado" htmlFor="telefono-cita">
            <EntradaTelefono
              id="telefono-cita"
              value={telefonoBusqueda}
              onChange={(e) => setTelefonoBusqueda(e.target.value)}
            />
          </Campo>
        </div>
        {error ? <p className="mt-3 text-sm text-peligro">{error}</p> : null}
        <Boton
          className="mt-5"
          onClick={recuperar}
          disabled={procesando || folioBusqueda.trim().length < 4 || telefonoBusqueda.length < 10}
        >
          {procesando ? 'Buscando…' : 'Buscar mi cita'}
        </Boton>
      </div>
    );
  }

  return (
    <div
      className="mx-auto max-w-2xl border p-6 sm:p-8"
      style={{ borderColor: 'var(--tema-borde)', background: 'var(--tema-superficie)' }}
    >
      <div
        className="flex flex-wrap items-start justify-between gap-4 border-b pb-5"
        style={{ borderColor: 'var(--tema-borde)' }}
      >
        <div>
          <span className="etiqueta" style={{ color: 'var(--tema-primario)' }}>
            Cita {cita.folio}
          </span>
          <h2 className="mt-2 font-[family-name:var(--tema-fuente-titulos)] text-3xl">
            {cita.cliente}
          </h2>
        </div>
        <span
          className="border px-3 py-1 text-xs uppercase"
          style={{ borderColor: 'var(--tema-primario)' }}
        >
          {cita.estado === 'pendiente'
            ? 'Programada'
            : cita.estado === 'completada'
              ? 'Realizada'
              : cita.estado}
        </span>
      </div>
      <div
        className="mt-5 flex items-center gap-3 border px-4 py-4"
        style={{
          borderColor: 'var(--tema-primario)',
          background: 'color-mix(in srgb, var(--tema-primario) 12%, transparent)',
        }}
      >
        <Clock3 className="size-5 shrink-0" style={{ color: 'var(--tema-primario)' }} />
        <div>
          <p className="font-medium">{textoCuentaRegresiva()}</p>
          <p className="mt-1 text-xs" style={{ color: 'var(--tema-texto-suave)' }}>
            Tu acceso quedó guardado en este dispositivo para la próxima vez.
          </p>
        </div>
      </div>
      <dl className="mt-6 grid gap-5 sm:grid-cols-2">
        <div>
          <dt
            className="flex items-center gap-2 text-xs"
            style={{ color: 'var(--tema-texto-suave)' }}
          >
            <CalendarDays className="size-4" /> Fecha y hora
          </dt>
          <dd className="mt-1">
            {new Date(cita.inicio).toLocaleString('es-MX', {
              dateStyle: 'full',
              timeStyle: 'short',
            })}
          </dd>
        </div>
        <div>
          <dt
            className="flex items-center gap-2 text-xs"
            style={{ color: 'var(--tema-texto-suave)' }}
          >
            <UserRound className="size-4" /> Barbero
          </dt>
          <dd className="mt-1">{cita.barbero}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt
            className="flex items-center gap-2 text-xs"
            style={{ color: 'var(--tema-texto-suave)' }}
          >
            <Scissors className="size-4" /> Servicios
          </dt>
          <dd className="mt-3 space-y-2">
            {cita.servicios.map((servicio) => (
              <div key={servicio.id} className="flex justify-between gap-4 text-sm">
                <span>
                  {servicio.nombre}{' '}
                  <span style={{ color: 'var(--tema-texto-suave)' }}>
                    · {servicio.duracionMinutos} min
                  </span>
                </span>
                <span className="cifras">{formatearMXN(servicio.precioCentavos)}</span>
              </div>
            ))}
          </dd>
        </div>
        <div
          className="sm:col-span-2 border p-4"
          style={{ borderColor: 'var(--tema-borde)', background: 'var(--tema-fondo)' }}
        >
          <div className="flex justify-between gap-4 text-sm">
            <span>Servicios</span>
            <span className="cifras">{formatearMXN(cita.subtotalCentavos)}</span>
          </div>
          <div className="mt-2 flex justify-between gap-4 text-sm">
            <span>{cita.esExpress ? 'Cargo por cita exprés' : 'Cargo por reservación'}</span>
            <span className="cifras">{formatearMXN(cita.recargoCentavos)}</span>
          </div>
          <div
            className="mt-3 flex justify-between gap-4 border-t pt-3 text-lg font-semibold"
            style={{ borderColor: 'var(--tema-borde)' }}
          >
            <span>Total</span>
            <span className="cifras" style={{ color: 'var(--tema-primario)' }}>
              {formatearMXN(cita.totalCentavos)}
            </span>
          </div>
        </div>
      </dl>
      {cita.cancelacionPermitida ? (
        <div className="mt-8 border-t pt-6" style={{ borderColor: 'var(--tema-borde)' }}>
          <h3 className="font-[family-name:var(--tema-fuente-titulos)] text-xl">
            ¿Necesitas cancelar?
          </h3>
          <p className="mt-1 text-xs" style={{ color: 'var(--tema-texto-suave)' }}>
            La barbería conserva el historial y el horario vuelve a quedar disponible.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Entrada value={motivo} onChange={(e) => setMotivo(e.target.value)} minLength={4} />
            <Boton
              variante="peligro"
              onClick={cancelar}
              disabled={procesando || motivo.trim().length < 4}
            >
              Cancelar cita
            </Boton>
          </div>
        </div>
      ) : null}
      {cita.estado !== 'cancelada' ? (
        <Boton comoHijo variante="contorno" className="mt-6">
          <a href={enlaceCalendario()} target="_blank" rel="noreferrer">
            <CalendarPlus className="size-4" /> Agregar a mi calendario
          </a>
        </Boton>
      ) : null}
      {error ? <p className="mt-4 text-sm text-peligro">{error}</p> : null}
      <button
        className="mt-6 text-xs underline"
        style={{ color: 'var(--tema-texto-suave)' }}
        onClick={() => {
          setCita(null);
          setToken('');
        }}
      >
        Consultar otra cita
      </button>
    </div>
  );
}
