'use client';

import * as React from 'react';
import { CalendarDays, Scissors, UserRound } from 'lucide-react';
import {
  cancelarCitaPublica,
  consultarCitaPublica,
  type CitaPublica,
} from '@/app/b/[slug]/acciones';
import { Boton } from '@/components/ui/boton';
import { Campo, Entrada } from '@/components/ui/campo';
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
  const [citasGuardadas, setCitasGuardadas] = React.useState<CitaGuardada[]>([]);
  const [procesando, iniciar] = React.useTransition();

  React.useEffect(() => {
    setCitasGuardadas(leerCitasGuardadas(slug));
  }, [slug]);

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

  if (!cita) {
    return (
      <div
        className="mx-auto max-w-xl border p-6 sm:p-8"
        style={{ borderColor: 'var(--tema-borde)', background: 'var(--tema-superficie)' }}
      >
        {citasGuardadas.length ? (
          <div className="mb-7 border-b pb-7" style={{ borderColor: 'var(--tema-borde)' }}>
            <p className="text-sm font-medium">Citas guardadas en este dispositivo</p>
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
        <Campo
          etiqueta="Código privado de tu cita"
          htmlFor="token"
          ayuda="Está incluido en el enlace privado que guardaste o compartiste al reservar."
        >
          <Entrada
            id="token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoComplete="off"
          />
        </Campo>
        {error ? <p className="mt-3 text-sm text-peligro">{error}</p> : null}
        <Boton
          className="mt-5"
          onClick={() => consultar()}
          disabled={procesando || token.length < 40}
        >
          {procesando ? 'Consultando…' : 'Consultar cita'}
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
          {cita.estado}
        </span>
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
