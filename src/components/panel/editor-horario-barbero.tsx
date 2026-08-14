'use client';

import * as React from 'react';
import { Clock3, Loader2, Save } from 'lucide-react';
import { useFormStatus } from 'react-dom';
import { Boton } from '@/components/ui/boton';

type Horario = {
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
  activo: boolean;
};

type DiaEditable = {
  activo: boolean;
  inicio: string;
  fin: string;
};

const DIAS = [
  { valor: 1, nombre: 'Lunes' },
  { valor: 2, nombre: 'Martes' },
  { valor: 3, nombre: 'Miércoles' },
  { valor: 4, nombre: 'Jueves' },
  { valor: 5, nombre: 'Viernes' },
  { valor: 6, nombre: 'Sábado' },
  { valor: 0, nombre: 'Domingo' },
] as const;

function horaCorta(hora: string | undefined, respaldo: string) {
  return hora ? hora.slice(0, 5) : respaldo;
}

function BotonGuardar() {
  const { pending } = useFormStatus();
  return (
    <Boton type="submit" disabled={pending}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
      {pending ? 'Guardando…' : 'Guardar horario'}
    </Boton>
  );
}

export function EditorHorarioBarbero({
  barberoId,
  horarios,
  action,
}: {
  barberoId: string;
  horarios: Horario[];
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [dias, setDias] = React.useState<Record<number, DiaEditable>>(() => {
    const iniciales: Record<number, DiaEditable> = {};
    for (const dia of DIAS) {
      const horario = horarios
        .filter((item) => item.dia_semana === dia.valor && item.activo)
        .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio))[0];
      iniciales[dia.valor] = {
        activo: Boolean(horario),
        inicio: horaCorta(horario?.hora_inicio, '09:00'),
        fin: horaCorta(horario?.hora_fin, '19:00'),
      };
    }
    return iniciales;
  });

  function actualizarDia(dia: number, cambios: Partial<DiaEditable>) {
    setDias((actuales) => ({
      ...actuales,
      [dia]: { ...actuales[dia], ...cambios },
    }));
  }

  return (
    <form action={action} className="border-t border-[var(--borde)] p-5">
      <input type="hidden" name="barbero_id" value={barberoId} />

      <div className="mb-4 flex items-start gap-3">
        <Clock3 className="mt-0.5 size-5 text-dorado" aria-hidden="true" />
        <div>
          <h4 className="font-medium">Horario semanal</h4>
          <p className="mt-1 text-xs text-[var(--texto-suave)]">
            Estos horarios determinan cuándo podrán reservar los clientes con este barbero.
          </p>
        </div>
      </div>

      <div className="grid gap-2">
        {DIAS.map((dia) => {
          const horario = dias[dia.valor];
          return (
            <div
              key={dia.valor}
              className="grid items-center gap-3 border border-[var(--borde)] p-3 sm:grid-cols-[150px_1fr_1fr]"
            >
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  name={`dia_${dia.valor}`}
                  checked={horario.activo}
                  onChange={(event) => actualizarDia(dia.valor, { activo: event.target.checked })}
                  className="size-4 accent-[var(--dorado)]"
                />
                {dia.nombre}
              </label>

              <label className="grid gap-1 text-xs text-[var(--texto-suave)]">
                Entrada
                <input
                  type="time"
                  name={`inicio_${dia.valor}`}
                  value={horario.inicio}
                  onChange={(event) => actualizarDia(dia.valor, { inicio: event.target.value })}
                  disabled={!horario.activo}
                  required={horario.activo}
                  className="h-10 border border-[var(--borde)] bg-[var(--fondo)] px-3 text-sm text-[var(--texto)] disabled:cursor-not-allowed disabled:opacity-40"
                />
              </label>

              <label className="grid gap-1 text-xs text-[var(--texto-suave)]">
                Salida
                <input
                  type="time"
                  name={`fin_${dia.valor}`}
                  value={horario.fin}
                  onChange={(event) => actualizarDia(dia.valor, { fin: event.target.value })}
                  disabled={!horario.activo}
                  required={horario.activo}
                  className="h-10 border border-[var(--borde)] bg-[var(--fondo)] px-3 text-sm text-[var(--texto)] disabled:cursor-not-allowed disabled:opacity-40"
                />
              </label>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-[var(--texto-tenue)]">
          Desmarca un día para indicar que el barbero no trabaja.
        </p>
        <BotonGuardar />
      </div>
    </form>
  );
}
