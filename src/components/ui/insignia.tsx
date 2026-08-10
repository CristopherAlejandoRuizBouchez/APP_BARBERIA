import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Insignias de estado.
 *
 * Los tonos de estado son apagados a propósito: sobre negro carbón, un verde
 * o un rojo saturados rompen la identidad. Se usa el color como relleno tenue
 * con el texto en el mismo matiz pero claro.
 */
const variantes = cva(
  'inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-xs font-medium whitespace-nowrap',
  {
    variants: {
      tono: {
        neutro: 'bg-[var(--superficie-alta)] text-[var(--texto-suave)]',
        acento: 'bg-dorado/15 text-dorado',
        exito: 'bg-exito/15 text-exito',
        aviso: 'bg-aviso/15 text-aviso',
        peligro: 'bg-peligro/15 text-peligro',
        info: 'bg-info/15 text-info',
        // Relleno macizo con marfil encima: la única forma legible de usar borgoña.
        express: 'bg-borgona text-marfil',
      },
      contorno: { si: 'border bg-transparent', no: '' },
    },
    defaultVariants: { tono: 'neutro', contorno: 'no' },
  }
);

export interface PropsInsignia
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof variantes> {}

export function Insignia({ className, tono, contorno, ...props }: PropsInsignia) {
  return <span className={cn(variantes({ tono, contorno }), className)} {...props} />;
}

/** Estados de una cita, con el tono que les corresponde en la agenda. */
export const TONOS_ESTADO_CITA = {
  pendiente: { tono: 'aviso', texto: 'Pendiente' },
  confirmada: { tono: 'info', texto: 'Confirmada' },
  en_proceso: { tono: 'acento', texto: 'En proceso' },
  completada: { tono: 'exito', texto: 'Completada' },
  cancelada: { tono: 'neutro', texto: 'Cancelada' },
  no_asistio: { tono: 'peligro', texto: 'No asistió' },
} as const;

export type EstadoCita = keyof typeof TONOS_ESTADO_CITA;

export function InsigniaEstadoCita({ estado }: { estado: EstadoCita }) {
  const { tono, texto } = TONOS_ESTADO_CITA[estado];
  return <Insignia tono={tono}>{texto}</Insignia>;
}

/** Semáforo de existencias del inventario. */
export function InsigniaExistencias({ actual, minimo }: { actual: number; minimo: number }) {
  if (actual <= 0) return <Insignia tono="peligro">Agotado</Insignia>;
  if (actual <= minimo) return <Insignia tono="aviso">Quedan {actual}</Insignia>;
  return <Insignia tono="exito">{actual} en existencia</Insignia>;
}
