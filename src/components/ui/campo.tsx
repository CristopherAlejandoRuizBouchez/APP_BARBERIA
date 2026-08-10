import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Campos de formulario.
 *
 * Todos comparten la misma anatomía: etiqueta, control, ayuda o error.
 * El error se anuncia con role="alert" para que un lector de pantalla lo lea
 * sin que el usuario tenga que ir a buscarlo.
 */

const baseControl = [
  'w-full rounded-sm border bg-[var(--fondo)] px-3 py-2 text-sm',
  'text-[var(--texto)] placeholder:text-[var(--texto-tenue)]',
  'border-[var(--borde)] transition-colors',
  'hover:border-[var(--borde-fuerte)]',
  'focus:border-dorado focus:outline-none',
  'disabled:cursor-not-allowed disabled:opacity-50',
  'aria-[invalid=true]:border-peligro',
].join(' ');

export const Entrada = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Entrada({ className, ...props }, ref) {
  return <input ref={ref} className={cn(baseControl, 'h-10', className)} {...props} />;
});

export const AreaTexto = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function AreaTexto({ className, ...props }, ref) {
  return (
    <textarea ref={ref} className={cn(baseControl, 'min-h-24 resize-y', className)} {...props} />
  );
});

export function Etiqueta({
  className,
  requerido = false,
  children,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement> & { requerido?: boolean }) {
  return (
    <label
      className={cn('mb-1.5 block text-sm font-medium text-[var(--texto)]', className)}
      {...props}
    >
      {children}
      {requerido ? (
        <span className="ml-1 text-dorado" aria-hidden="true">
          *
        </span>
      ) : null}
    </label>
  );
}

export function Campo({
  etiqueta,
  ayuda,
  error,
  requerido = false,
  htmlFor,
  className,
  children,
}: {
  etiqueta: string;
  ayuda?: string;
  error?: string;
  requerido?: boolean;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const idAyuda = htmlFor ? `${htmlFor}-ayuda` : undefined;
  const idError = htmlFor ? `${htmlFor}-error` : undefined;

  return (
    <div className={cn('w-full', className)}>
      <Etiqueta htmlFor={htmlFor} requerido={requerido}>
        {etiqueta}
      </Etiqueta>
      {children}
      {ayuda && !error ? (
        <p id={idAyuda} className="mt-1.5 text-xs text-[var(--texto-tenue)]">
          {ayuda}
        </p>
      ) : null}
      {error ? (
        <p id={idError} role="alert" className="mt-1.5 text-xs text-peligro">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Campo de importe. Muestra el símbolo y alinea las cifras a la derecha con
 * números tabulares, para que una columna de precios quede a plomo.
 */
export const EntradaImporte = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function EntradaImporte({ className, ...props }, ref) {
  return (
    <div className="relative">
      <span
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--texto-tenue)]"
        aria-hidden="true"
      >
        $
      </span>
      <input
        ref={ref}
        inputMode="decimal"
        className={cn(baseControl, 'cifras h-10 pl-7 text-right', className)}
        {...props}
      />
    </div>
  );
});

/** Campo de teléfono: el identificador del cliente en todo el sistema. */
export const EntradaTelefono = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function EntradaTelefono({ className, ...props }, ref) {
  return (
    <div className="relative">
      <span
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--texto-tenue)]"
        aria-hidden="true"
      >
        +52
      </span>
      <input
        ref={ref}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        maxLength={14}
        placeholder="55 1234 5678"
        className={cn(baseControl, 'cifras h-10 pl-12', className)}
        {...props}
      />
    </div>
  );
});
