'use client';

import * as React from 'react';
import { RotateCcw, Trash2, X } from 'lucide-react';
import { Boton } from '@/components/ui/boton';

export function BotonEliminarProducto({
  action,
  id,
  nombre,
  activo,
}: {
  action: (formData: FormData) => void | Promise<void>;
  id: string;
  nombre: string;
  activo: boolean;
}) {
  const dialogo = React.useRef<HTMLDialogElement>(null);
  const tituloId = `eliminar-producto-${id}`;

  if (!activo) {
    return (
      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="accion" value="reactivar" />
        <Boton type="submit" variante="contorno" tamano="sm">
          <RotateCcw className="size-4" /> Reactivar
        </Boton>
      </form>
    );
  }

  return (
    <>
      <Boton
        type="button"
        variante="peligro"
        tamano="sm"
        onClick={() => dialogo.current?.showModal()}
      >
        <Trash2 className="size-4" /> Eliminar
      </Boton>

      <dialog
        ref={dialogo}
        aria-labelledby={tituloId}
        className="m-auto w-[min(92vw,30rem)] rounded-sm border border-peligro/45 bg-[var(--superficie)] p-0 text-[var(--texto)] shadow-2xl backdrop:bg-black/80"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--borde)] p-5">
          <div>
            <p className="etiqueta text-peligro">Eliminar del catálogo</p>
            <h2 id={tituloId} className="mt-2 font-display text-2xl">
              ¿Eliminar {nombre}?
            </h2>
          </div>
          <form method="dialog">
            <button
              type="submit"
              className="p-1 text-[var(--texto-tenue)] hover:text-[var(--texto)]"
              aria-label="Cerrar"
            >
              <X className="size-5" />
            </button>
          </form>
        </div>

        <div className="space-y-4 p-5">
          <p className="text-sm text-[var(--texto-suave)]">
            Dejará de aparecer al cobrar y en la tienda pública.
          </p>
          <p className="border border-[var(--borde)] bg-[var(--fondo)] px-3 py-2 text-xs text-[var(--texto-suave)]">
            Sus ventas y movimientos anteriores se conservarán. Podrás reactivarlo después.
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <form method="dialog">
              <Boton type="submit" variante="contorno">
                Cancelar
              </Boton>
            </form>
            <form action={action}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="accion" value="eliminar" />
              <Boton type="submit" variante="peligro">
                <Trash2 className="size-4" /> Sí, eliminar
              </Boton>
            </form>
          </div>
        </div>
      </dialog>
    </>
  );
}
