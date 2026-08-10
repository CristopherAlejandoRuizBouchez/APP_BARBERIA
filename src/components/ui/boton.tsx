import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Botón del sistema.
 *
 * Notas de diseño que no son negociables:
 *  · Esquinas casi rectas (radius-sm = 2px). Nada de burbujas.
 *  · El dorado macizo NO se usa como botón grande: se ve a publicidad de
 *    casino. El primario es marfil sobre carbón; el dorado va en el contorno.
 *  · El borgoña solo como relleno con texto marfil encima: sobre fondo oscuro
 *    su contraste es 1.5:1 y sería ilegible como texto.
 */
const variantes = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap',
    'rounded-sm text-sm font-medium',
    'transition-[background-color,color,border-color,opacity] duration-200',
    'disabled:pointer-events-none disabled:opacity-45',
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ].join(' '),
  {
    variants: {
      variante: {
        primario: 'bg-marfil text-carbon hover:bg-marfil/88 active:bg-marfil/78',
        contorno:
          'border border-dorado/55 text-marfil hover:border-dorado hover:bg-dorado/10 active:bg-dorado/16',
        acento: 'bg-dorado text-carbon hover:bg-dorado-claro active:bg-dorado/85',
        sutil:
          'bg-[var(--superficie-alta)] text-[var(--texto)] hover:bg-[var(--superficie-alta)]/70',
        fantasma:
          'text-[var(--texto-suave)] hover:bg-[var(--superficie-alta)] hover:text-[var(--texto)]',
        peligro: 'bg-borgona text-marfil hover:bg-borgona-claro active:bg-borgona/85',
        enlace: 'text-dorado underline-offset-4 hover:underline p-0 h-auto',
      },
      tamano: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-5',
        lg: 'h-12 px-7 text-base',
        // Para el POS: objetivos táctiles grandes, se usa de pie y con prisa.
        pos: 'h-16 px-4 text-base font-semibold',
        icono: 'size-9 p-0',
      },
      ancho: {
        auto: '',
        completo: 'w-full',
      },
    },
    defaultVariants: { variante: 'primario', tamano: 'md', ancho: 'auto' },
  }
);

export interface PropsBoton
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof variantes> {
  /** Renderiza el hijo en lugar de un <button>. Útil para envolver <Link>. */
  comoHijo?: boolean;
}

export const Boton = React.forwardRef<HTMLButtonElement, PropsBoton>(function Boton(
  { className, variante, tamano, ancho, comoHijo = false, ...props },
  ref
) {
  const Componente = comoHijo ? Slot : 'button';
  return (
    <Componente
      ref={ref}
      className={cn(variantes({ variante, tamano, ancho }), className)}
      {...props}
    />
  );
});

export { variantes as variantesBoton };
