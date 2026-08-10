import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Superficie base del sistema.
 *
 * La jerarquía se construye con contraste de superficie, no con sombras
 * difusas: sobre el negro carbón una sombra no se ve, y el resultado de
 * intentarlo es el aspecto genérico de plantilla que queremos evitar.
 */

export function Tarjeta({
  className,
  destacada = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { destacada?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-sm border bg-[var(--superficie)] text-[var(--texto)]',
        destacada ? 'border-dorado/45' : 'border-[var(--borde)]',
        className
      )}
      {...props}
    />
  );
}

export function TarjetaCabecera({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1.5 p-5', className)} {...props} />;
}

export function TarjetaTitulo({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn('font-display text-xl leading-tight text-[var(--texto)]', className)}
      {...props}
    />
  );
}

export function TarjetaDescripcion({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-[var(--texto-suave)]', className)} {...props} />;
}

export function TarjetaContenido({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5 pt-0', className)} {...props} />;
}

export function TarjetaPie({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center gap-3 p-5 pt-0', className)} {...props} />;
}

/**
 * Indicador numérico del tablero.
 * El dorado se reserva para el dato que importa; si todo brilla, nada destaca.
 */
export function TarjetaIndicador({
  etiqueta,
  valor,
  detalle,
  tendencia,
  acentuado = false,
  className,
}: {
  etiqueta: string;
  valor: string;
  detalle?: string;
  tendencia?: 'sube' | 'baja' | 'neutra';
  acentuado?: boolean;
  className?: string;
}) {
  const colorTendencia =
    tendencia === 'sube'
      ? 'text-exito'
      : tendencia === 'baja'
        ? 'text-peligro'
        : 'text-[var(--texto-tenue)]';

  return (
    <Tarjeta destacada={acentuado} className={cn('p-4', className)}>
      <p className="etiqueta text-[var(--texto-tenue)]">{etiqueta}</p>
      <p
        className={cn(
          'cifras mt-2 font-display text-3xl leading-none',
          acentuado ? 'text-dorado' : 'text-[var(--texto)]'
        )}
      >
        {valor}
      </p>
      {detalle ? <p className={cn('mt-1.5 text-xs', colorTendencia)}>{detalle}</p> : null}
    </Tarjeta>
  );
}
