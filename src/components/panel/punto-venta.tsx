'use client';

import * as React from 'react';
import { Minus, Plus, Search, ShoppingBag, Trash2 } from 'lucide-react';
import { crearVentaPos, type ItemPos } from '@/app/(panel)/panel/[organizationSlug]/acciones';
import { Boton } from '@/components/ui/boton';
import { Entrada } from '@/components/ui/campo';
import { formatearMXN } from '@/lib/dinero';

type Articulo = {
  id: string;
  tipo: 'producto' | 'servicio';
  nombre: string;
  precioCentavos: number;
  detalle: string;
};

type Linea = Articulo & { cantidad: number };

type CitaInicial = {
  id: string;
  folio: string;
  clienteId: string;
  clienteNombre: string;
  barberoId: string;
  subtotalCentavos: number;
  recargoCentavos: number;
  totalCentavos: number;
  esExpress: boolean;
  servicios: Array<{
    id: string;
    nombre: string;
    precioCentavos: number;
    duracionMinutos: number;
  }>;
};

export function PuntoVenta({
  slug,
  articulos,
  sucursales,
  barberos,
  citaInicial,
}: {
  slug: string;
  articulos: Articulo[];
  sucursales: { id: string; nombre: string }[];
  barberos: { id: string; nombre: string }[];
  citaInicial?: CitaInicial;
}) {
  const [busqueda, setBusqueda] = React.useState('');
  const [ticket, setTicket] = React.useState<Linea[]>(() =>
    (citaInicial?.servicios ?? []).map((servicio) => ({
      id: servicio.id,
      tipo: 'servicio' as const,
      nombre: servicio.nombre,
      precioCentavos: servicio.precioCentavos,
      detalle: `${servicio.duracionMinutos} min · cita ${citaInicial?.folio}`,
      cantidad: 1,
    }))
  );
  const locationId = sucursales[0]?.id ?? '';
  const [barberoId, setBarberoId] = React.useState(citaInicial?.barberoId ?? '');
  const [metodo, setMetodo] = React.useState<
    'efectivo' | 'tarjeta_fisica' | 'transferencia' | 'otro'
  >('efectivo');
  const [recibido, setRecibido] = React.useState('');
  const [estado, setEstado] = React.useState<{
    tipo: 'error' | 'ok';
    texto: string;
  } | null>(null);
  const [citaCobrada, setCitaCobrada] = React.useState(false);
  const [procesando, iniciar] = React.useTransition();

  const visibles = articulos.filter((a) =>
    `${a.nombre} ${a.detalle}`.toLowerCase().includes(busqueda.toLowerCase())
  );
  const subtotalArticulos = ticket.reduce(
    (suma, linea) => suma + linea.precioCentavos * linea.cantidad,
    0
  );
  const recargoCita = citaInicial && !citaCobrada ? citaInicial.recargoCentavos : 0;
  const total = subtotalArticulos + recargoCita;
  const recibidoNumero = Number(recibido);
  const recibidoCentavos =
    recibido !== '' && Number.isFinite(recibidoNumero) ? Math.round(recibidoNumero * 100) : null;
  const efectivoCompleto = recibidoCentavos !== null && recibidoCentavos >= total;
  const cambioCentavos = efectivoCompleto ? recibidoCentavos - total : 0;
  const faltanteCentavos =
    recibidoCentavos !== null && recibidoCentavos < total ? total - recibidoCentavos : 0;

  function agregar(articulo: Articulo) {
    setTicket((actual) => {
      const existe = actual.find(
        (linea) => linea.id === articulo.id && linea.tipo === articulo.tipo
      );
      if (existe)
        return actual.map((linea) =>
          linea === existe ? { ...linea, cantidad: linea.cantidad + 1 } : linea
        );
      return [...actual, { ...articulo, cantidad: 1 }];
    });
  }

  function cantidad(indice: number, cambio: number) {
    setTicket((actual) =>
      actual
        .map((linea, i) => (i === indice ? { ...linea, cantidad: linea.cantidad + cambio } : linea))
        .filter((linea) => linea.cantidad > 0)
    );
  }

  function cobrar() {
    setEstado(null);
    iniciar(async () => {
      const items: ItemPos[] = ticket.map((linea) => ({
        tipo: linea.tipo,
        id: linea.id,
        cantidad: linea.cantidad,
        ...(barberoId ? { barbero_id: barberoId } : {}),
      }));
      const resultado = await crearVentaPos(slug, {
        locationId,
        items,
        metodo,
        ...(barberoId ? { barberoId } : {}),
        ...(citaInicial ? { citaId: citaInicial.id, clienteId: citaInicial.clienteId } : {}),
        ...(recibido ? { recibidoPesos: Number(recibido) } : {}),
      });
      if (!resultado.ok) {
        setEstado({ tipo: 'error', texto: resultado.mensaje });
        return;
      }
      setEstado({
        tipo: 'ok',
        texto:
          resultado.datos.cambioCentavos > 0
            ? `Venta ${resultado.datos.folio} registrada. Entrega ${formatearMXN(resultado.datos.cambioCentavos)} de cambio.`
            : `Venta ${resultado.datos.folio} registrada correctamente.`,
      });
      setTicket([]);
      setRecibido('');
      setCitaCobrada(true);
    });
  }

  return (
    <div className="grid min-h-[calc(100dvh-8rem)] gap-4 xl:grid-cols-[1fr_25rem]">
      <section>
        {citaInicial ? (
          <div className="mb-4 border border-dorado/45 bg-dorado/10 px-4 py-3">
            <p className="etiqueta text-dorado">Cobrando cita {citaInicial.folio}</p>
            <p className="mt-1 text-sm text-[var(--texto-suave)]">
              Cliente: {citaInicial.clienteNombre}. Los servicios y el barbero ya están cargados.
            </p>
            <p className="cifras mt-2 text-sm text-dorado">
              Servicios {formatearMXN(citaInicial.subtotalCentavos)} +{' '}
              {citaInicial.esExpress ? 'cargo exprés' : 'cargo por reservación'}{' '}
              {formatearMXN(citaInicial.recargoCentavos)} ={' '}
              {formatearMXN(citaInicial.totalCentavos)}
            </p>
          </div>
        ) : null}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--texto-tenue)]" />
          <Entrada
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar servicio, producto, marca o código"
            className="pl-10"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {visibles.map((articulo) => (
            <button
              key={`${articulo.tipo}-${articulo.id}`}
              type="button"
              onClick={() => agregar(articulo)}
              className="min-h-28 rounded-sm border border-[var(--borde)] bg-[var(--superficie)] p-4 text-left transition-colors hover:border-dorado/60"
            >
              <span className="etiqueta text-dorado">{articulo.tipo}</span>
              <span className="mt-3 block font-display text-xl">{articulo.nombre}</span>
              <span className="mt-1 block text-xs text-[var(--texto-tenue)]">
                {articulo.detalle}
              </span>
              <span className="cifras mt-3 block text-lg">
                {formatearMXN(articulo.precioCentavos)}
              </span>
            </button>
          ))}
        </div>
      </section>

      <aside className="flex flex-col rounded-sm border border-[var(--borde)] bg-[var(--superficie)]">
        <div className="flex items-center gap-3 border-b border-[var(--borde)] p-5">
          <ShoppingBag className="size-5 text-dorado" />
          <h2 className="font-display text-2xl">Ticket actual</h2>
        </div>
        <div className="min-h-44 flex-1 divide-y divide-[var(--borde)] overflow-y-auto px-5">
          {ticket.map((linea, indice) => (
            <div key={`${linea.tipo}-${linea.id}`} className="py-4">
              <div className="flex justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{linea.nombre}</p>
                  <p className="cifras text-xs text-[var(--texto-tenue)]">
                    {formatearMXN(linea.precioCentavos)} c/u
                  </p>
                </div>
                <p className="cifras text-sm">
                  {formatearMXN(linea.precioCentavos * linea.cantidad)}
                </p>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  aria-label="Restar"
                  onClick={() => cantidad(indice, -1)}
                  className="border p-1"
                >
                  <Minus className="size-3" />
                </button>
                <span className="cifras w-5 text-center text-sm">{linea.cantidad}</span>
                <button
                  aria-label="Sumar"
                  onClick={() => cantidad(indice, 1)}
                  className="border p-1"
                >
                  <Plus className="size-3" />
                </button>
                <button
                  aria-label="Quitar"
                  onClick={() => setTicket((actual) => actual.filter((_, i) => i !== indice))}
                  className="ml-auto text-peligro"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
          {!ticket.length ? (
            <p className="py-12 text-center text-sm text-[var(--texto-tenue)]">
              Toca un artículo para agregarlo.
            </p>
          ) : null}
        </div>
        <div className="space-y-3 border-t border-[var(--borde)] p-5">
          {citaInicial && !citaCobrada ? (
            <div className="flex items-center justify-between border border-dorado/35 bg-dorado/10 px-3 py-3">
              <div>
                <p className="text-sm font-medium">
                  {citaInicial.esExpress ? 'Cargo por cita exprés' : 'Cargo por reservación'}
                </p>
                <p className="mt-1 text-[11px] text-[var(--texto-tenue)]">
                  Se cobra una sola vez por la cita.
                </p>
              </div>
              <strong className="cifras text-dorado">
                {formatearMXN(citaInicial.recargoCentavos)}
              </strong>
            </div>
          ) : null}
          <label className="block text-xs text-[var(--texto-suave)]">
            Barbero (opcional)
            <select
              value={barberoId}
              onChange={(e) => setBarberoId(e.target.value)}
              className="mt-1 h-10 w-full border bg-[var(--fondo)] px-3"
            >
              <option value="">Sin asignar</option>
              {barberos.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-[var(--texto-suave)]">
            Método de pago
            <select
              value={metodo}
              onChange={(e) => setMetodo(e.target.value as typeof metodo)}
              className="mt-1 h-10 w-full border bg-[var(--fondo)] px-3"
            >
              <option value="efectivo">Efectivo</option>
              <option value="tarjeta_fisica">Tarjeta física</option>
              <option value="transferencia">Transferencia</option>
              <option value="otro">Otro</option>
            </select>
          </label>
          {metodo === 'efectivo' ? (
            <div className="space-y-3">
              <label className="block text-xs text-[var(--texto-suave)]">
                Efectivo recibido
                <Entrada
                  type="number"
                  min={total / 100}
                  step="0.01"
                  value={recibido}
                  onChange={(e) => setRecibido(e.target.value)}
                  className="mt-1"
                />
              </label>
              {recibidoCentavos !== null && ticket.length ? (
                <div
                  className={`flex items-center justify-between border px-3 py-3 ${
                    efectivoCompleto
                      ? 'border-exito/40 bg-exito-suave text-exito'
                      : 'border-peligro/40 bg-peligro-suave text-peligro'
                  }`}
                  role="status"
                  aria-live="polite"
                >
                  <span className="text-sm font-medium">
                    {efectivoCompleto ? 'Cambio a entregar' : 'Falta por recibir'}
                  </span>
                  <strong className="cifras text-lg">
                    {formatearMXN(efectivoCompleto ? cambioCentavos : faltanteCentavos)}
                  </strong>
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="flex items-end justify-between border-t border-[var(--borde)] pt-4">
            <span className="etiqueta">Total</span>
            <strong className="cifras font-display text-3xl text-dorado">
              {formatearMXN(total)}
            </strong>
          </div>
          {estado ? (
            <p
              role="status"
              className={`text-sm ${estado.tipo === 'ok' ? 'text-exito' : 'text-peligro'}`}
            >
              {estado.texto}
            </p>
          ) : null}
          <Boton
            tamano="pos"
            ancho="completo"
            variante="acento"
            disabled={
              procesando ||
              !ticket.length ||
              !locationId ||
              (metodo === 'efectivo' && recibido !== '' && !efectivoCompleto)
            }
            onClick={cobrar}
          >
            {procesando ? 'Registrando…' : `Cobrar ${formatearMXN(total)}`}
          </Boton>
        </div>
      </aside>
    </div>
  );
}
