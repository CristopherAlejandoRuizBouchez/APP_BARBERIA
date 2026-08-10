'use client';

import * as React from 'react';
import { Trash2, X } from 'lucide-react';
import { Boton } from '@/components/ui/boton';

export function BotonEliminarBarberia({
  action,
  organizationId,
  nombre,
  slug,
  deshabilitado,
}: {
  action: (formData: FormData) => void | Promise<void>;
  organizationId: string;
  nombre: string;
  slug: string;
  deshabilitado: boolean;
}) {
  const dialogo = React.useRef<HTMLDialogElement>(null);
  const tituloId = `eliminar-${organizationId}`;

  return (
    <>
      <Boton
        type="button"
        variante="peligro"
        tamano="sm"
        disabled={deshabilitado}
        onClick={() => dialogo.current?.showModal()}
      >
        <Trash2 className="size-4" /> Eliminar barbería
      </Boton>

      <dialog
        ref={dialogo}
        aria-labelledby={tituloId}
        className="m-auto w-[min(92vw,30rem)] rounded-sm border border-peligro/45 bg-[var(--superficie)] p-0 text-[var(--texto)] shadow-2xl backdrop:bg-black/80"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--borde)] p-5">
          <div>
            <p className="etiqueta text-peligro">Acción permanente</p>
            <h2 id={tituloId} className="mt-2 font-display text-2xl">
              Eliminar {nombre}
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
            La barbería desaparecerá de la plataforma, su página pública dejará de funcionar y
            todos sus usuarios perderán el acceso.
          </p>
          <p className="border border-peligro/30 bg-peligro-suave px-3 py-2 text-xs text-peligro">
            Los registros se conservarán de forma segura en la base de datos para proteger la
            auditoría y evitar pérdidas accidentales.
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <form method="dialog">
              <Boton type="submit" variante="contorno">
                Cancelar
              </Boton>
            </form>
            <form action={action}>
              <input type="hidden" name="organization_id" value={organizationId} />
              <input type="hidden" name="confirmacion" value={slug} />
              <Boton type="submit" variante="peligro">
                <Trash2 className="size-4" /> Eliminar de la plataforma
              </Boton>
            </form>
          </div>
        </div>
      </dialog>
    </>
  );
}
