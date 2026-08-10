'use client';

import * as React from 'react';
import { CheckCircle2, Minus, Plus, ShoppingCart, X } from 'lucide-react';
import { crearPedidoPublico } from '@/app/b/[slug]/acciones';
import { Boton } from '@/components/ui/boton';
import { AreaTexto, Campo, Entrada, EntradaTelefono } from '@/components/ui/campo';
import { formatearMXN } from '@/lib/dinero';

type Producto = {
  id: string;
  nombre: string;
  marca: string | null;
  descripcion: string | null;
  imagen_url: string | null;
  precio_venta_centavos: number;
  disponible: boolean;
};
type Sucursal = { id: string; nombre: string };

export function TiendaProductos({
  slug,
  productos,
  sucursales,
  whatsapp,
}: {
  slug: string;
  productos: Producto[];
  sucursales: Sucursal[];
  whatsapp: string | null;
}) {
  const [carrito, setCarrito] = React.useState<Record<string, number>>({});
  const [abierto, setAbierto] = React.useState(false);
  const locationId = sucursales[0]?.id ?? '';
  const [estado, setEstado] = React.useState<{ ok: boolean; texto: string; folio?: string } | null>(
    null
  );
  const [enviando, iniciar] = React.useTransition();
  const lineas = productos.filter((p) => carrito[p.id]);
  const piezas = Object.values(carrito).reduce((a, b) => a + b, 0);
  const total = lineas.reduce((s, p) => s + p.precio_venta_centavos * (carrito[p.id] ?? 0), 0);

  function cambiar(id: string, diferencia: number) {
    setCarrito((actual) => {
      const cantidad = Math.max(0, Math.min(20, (actual[id] ?? 0) + diferencia));
      const siguiente = { ...actual, [id]: cantidad };
      if (!cantidad) delete siguiente[id];
      return siguiente;
    });
  }

  function pedir(formData: FormData) {
    setEstado(null);
    iniciar(async () => {
      const resultado = await crearPedidoPublico(slug, {
        locationId,
        items: lineas.map((p) => ({ producto_id: p.id, cantidad: carrito[p.id] ?? 0 })),
        nombre: String(formData.get('nombre') ?? ''),
        telefono: String(formData.get('telefono') ?? ''),
        notas: String(formData.get('notas') ?? ''),
      });
      if (!resultado.ok) return setEstado({ ok: false, texto: resultado.mensaje });
      setEstado({
        ok: true,
        folio: resultado.datos.folio,
        texto: `Pedido ${resultado.datos.folio} apartado por ${formatearMXN(resultado.datos.totalCentavos)}. Confírmalo por WhatsApp antes de que venza la reserva.`,
      });
      setCarrito({});
    });
  }

  const enlaceWa =
    estado?.folio && whatsapp
      ? `https://wa.me/${whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola, quiero confirmar mi pedido ${estado.folio}.`)}`
      : null;

  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {productos.map((p) => (
          <article
            key={p.id}
            className="flex flex-col border"
            style={{
              borderColor: 'var(--tema-borde)',
              background: 'var(--tema-superficie)',
              borderRadius: 'var(--tema-radio)',
            }}
          >
            <div
              className="aspect-[4/3] overflow-hidden"
              style={{
                background: 'color-mix(in srgb, var(--tema-superficie) 70%, var(--tema-fondo))',
              }}
            >
              {p.imagen_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.imagen_url} alt={p.nombre} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <ShoppingCart className="size-10 opacity-20" />
                </div>
              )}
            </div>
            <div className="flex flex-1 flex-col p-5">
              <span className="etiqueta" style={{ color: 'var(--tema-primario)' }}>
                {p.marca ?? 'Producto'}
              </span>
              <h2 className="mt-3 font-[family-name:var(--tema-fuente-titulos)] text-2xl">
                {p.nombre}
              </h2>
              <p
                className="mt-2 flex-1 text-sm leading-relaxed"
                style={{ color: 'var(--tema-texto-suave)' }}
              >
                {p.descripcion}
              </p>
              <div className="mt-5 flex items-center justify-between gap-3">
                <strong className="cifras text-xl">{formatearMXN(p.precio_venta_centavos)}</strong>
                <Boton
                  variante="contorno"
                  disabled={!p.disponible}
                  onClick={() => {
                    cambiar(p.id, 1);
                    setAbierto(true);
                  }}
                >
                  {p.disponible ? 'Agregar' : 'Agotado'}
                </Boton>
              </div>
            </div>
          </article>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="fixed bottom-5 right-5 z-30 flex items-center gap-3 border px-5 py-3"
        style={{ borderColor: 'var(--tema-primario)', background: 'var(--tema-fondo)' }}
      >
        <ShoppingCart className="size-5" />
        <span>Carrito</span>
        <strong className="cifras">{piezas}</strong>
      </button>
      {abierto ? (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/60"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setAbierto(false);
          }}
        >
          <aside
            className="h-full w-full max-w-md overflow-y-auto border-l p-6"
            style={{ borderColor: 'var(--tema-borde)', background: 'var(--tema-fondo)' }}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-[family-name:var(--tema-fuente-titulos)] text-3xl">Tu pedido</h2>
              <button aria-label="Cerrar" onClick={() => setAbierto(false)}>
                <X />
              </button>
            </div>
            {estado?.ok ? (
              <div
                className="mt-8 border p-5 text-center"
                style={{ borderColor: 'var(--tema-primario)' }}
              >
                <CheckCircle2
                  className="mx-auto size-9"
                  style={{ color: 'var(--tema-primario)' }}
                />
                <p className="mt-4 text-sm leading-relaxed">{estado.texto}</p>
                {enlaceWa ? (
                  <Boton comoHijo className="mt-5" variante="acento">
                    <a href={enlaceWa} target="_blank" rel="noreferrer">
                      Confirmar por WhatsApp
                    </a>
                  </Boton>
                ) : null}
              </div>
            ) : (
              <>
                <div className="mt-6 divide-y" style={{ borderColor: 'var(--tema-borde)' }}>
                  {lineas.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 py-4">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{p.nombre}</p>
                        <p className="cifras text-xs" style={{ color: 'var(--tema-texto-suave)' }}>
                          {formatearMXN(p.precio_venta_centavos)}
                        </p>
                      </div>
                      <button onClick={() => cambiar(p.id, -1)} className="border p-1">
                        <Minus className="size-3" />
                      </button>
                      <span className="cifras">{carrito[p.id]}</span>
                      <button onClick={() => cambiar(p.id, 1)} className="border p-1">
                        <Plus className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
                {!lineas.length ? (
                  <p
                    className="py-12 text-center text-sm"
                    style={{ color: 'var(--tema-texto-suave)' }}
                  >
                    Tu carrito está vacío.
                  </p>
                ) : (
                  <form action={pedir} className="mt-6 space-y-4">
                    <Campo etiqueta="Nombre" htmlFor="nombre">
                      <Entrada id="nombre" name="nombre" required />
                    </Campo>
                    <Campo etiqueta="WhatsApp" htmlFor="telefono">
                      <EntradaTelefono id="telefono" name="telefono" required />
                    </Campo>
                    <Campo etiqueta="Notas" htmlFor="notas">
                      <AreaTexto id="notas" name="notas" />
                    </Campo>
                    {estado && !estado.ok ? (
                      <p className="text-sm text-peligro">{estado.texto}</p>
                    ) : null}
                    <div
                      className="flex items-end justify-between border-t pt-4"
                      style={{ borderColor: 'var(--tema-borde)' }}
                    >
                      <span className="etiqueta">Total</span>
                      <strong className="cifras text-2xl">{formatearMXN(total)}</strong>
                    </div>
                    <Boton
                      type="submit"
                      variante="acento"
                      ancho="completo"
                      tamano="lg"
                      disabled={enviando || !locationId}
                    >
                      {enviando ? 'Apartando…' : 'Apartar y confirmar'}
                    </Boton>
                    <p
                      className="text-xs leading-relaxed"
                      style={{ color: 'var(--tema-texto-suave)' }}
                    >
                      No se cobra en línea. Se reserva el producto temporalmente y la barbería
                      confirma pago y entrega por WhatsApp.
                    </p>
                  </form>
                )}
              </>
            )}
          </aside>
        </div>
      ) : null}
    </>
  );
}
