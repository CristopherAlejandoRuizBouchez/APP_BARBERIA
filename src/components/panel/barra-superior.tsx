'use client';

import * as React from 'react';
import { Sun, Moon, User } from 'lucide-react';
import { ETIQUETA_ROL, type RolUsuario } from './navegacion';
import { formatearFechaLarga } from '@/lib/fechas';

export function BarraSuperior({ rol, nombreUsuario }: { rol: RolUsuario; nombreUsuario: string }) {
  const [temaClaro, setTemaClaro] = React.useState(false);
  const [hoy, setHoy] = React.useState<string>('');

  // La fecha se calcula en el cliente para evitar desajuste de hidratación
  // entre el reloj del servidor y el del navegador.
  React.useEffect(() => setHoy(formatearFechaLarga(new Date())), []);

  const alternarTema = () => {
    const siguiente = !temaClaro;
    setTemaClaro(siguiente);
    document.documentElement.classList.toggle('tema-claro', siguiente);
  };

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--borde)] bg-[var(--superficie)] px-4">
      <p className="hidden truncate text-xs capitalize text-[var(--texto-tenue)] sm:block">{hoy}</p>

      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={alternarTema}
          className="rounded-sm p-2 text-[var(--texto-suave)] transition-colors hover:bg-[var(--superficie-alta)] hover:text-[var(--texto)]"
          aria-label={temaClaro ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
        >
          {temaClaro ? <Moon className="size-4" /> : <Sun className="size-4" />}
        </button>

        <div className="ml-1 flex items-center gap-2 border-l border-[var(--borde)] pl-3">
          <div
            className="flex size-7 items-center justify-center rounded-sm bg-[var(--superficie-alta)]"
            aria-hidden="true"
          >
            <User className="size-3.5 text-[var(--texto-suave)]" />
          </div>
          <div className="hidden leading-tight sm:block">
            <p className="text-xs font-medium text-[var(--texto)]">{nombreUsuario}</p>
            <p className="text-[10px] text-[var(--texto-tenue)]">{ETIQUETA_ROL[rol]}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
