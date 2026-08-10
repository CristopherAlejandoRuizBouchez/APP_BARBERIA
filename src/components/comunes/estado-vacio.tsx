import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Estado vacío.
 *
 * Una tabla sin filas nunca debe quedarse en blanco: hay que decir qué pasó y
 * qué puede hacer la persona a continuación. Es la diferencia entre "parece
 * roto" y "todavía no hay nada".
 */
export function EstadoVacio({
  titulo,
  descripcion,
  icono,
  accion,
  className,
}: {
  titulo: string;
  descripcion?: string;
  icono?: React.ReactNode;
  accion?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-sm border border-dashed',
        'border-[var(--borde)] px-6 py-14 text-center',
        className
      )}
    >
      {icono ? <div className="mb-4 text-[var(--texto-tenue)]">{icono}</div> : null}
      <p className="font-display text-lg text-[var(--texto)]">{titulo}</p>
      {descripcion ? (
        <p className="mt-1.5 max-w-sm text-sm text-[var(--texto-suave)]">{descripcion}</p>
      ) : null}
      {accion ? <div className="mt-5">{accion}</div> : null}
    </div>
  );
}

/** Bloque de carga con el mismo peso visual que el contenido que sustituye. */
export function Esqueleto({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-pulse rounded-sm bg-[var(--superficie-alta)]', className)}
      aria-hidden="true"
    />
  );
}

/** Fila de carga para tablas. */
export function EsqueletoTabla({ filas = 5, columnas = 4 }: { filas?: number; columnas?: number }) {
  return (
    <div className="space-y-2" role="status" aria-label="Cargando datos">
      {Array.from({ length: filas }, (_, f) => (
        <div key={f} className="flex gap-3">
          {Array.from({ length: columnas }, (_, c) => (
            <Esqueleto key={c} className={cn('h-9 flex-1', c === 0 && 'max-w-[30%]')} />
          ))}
        </div>
      ))}
    </div>
  );
}
