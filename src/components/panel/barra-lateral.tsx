'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, CreditCard, LogOut, PanelLeftClose, PanelLeftOpen, Wrench } from 'lucide-react';
import { navegacionPara, ETIQUETA_ROL, type RolUsuario } from './navegacion';
import { cn } from '@/lib/utils';
import { cerrarSesion } from '@/app/(auth)/acciones';

export function BarraLateral({
  rol,
  nombreNegocio,
  basePath = '/panel',
  suspendida = false,
}: {
  rol: RolUsuario;
  nombreNegocio: string;
  basePath?: string;
  suspendida?: boolean;
}) {
  const [colapsada, setColapsada] = React.useState(false);
  const [mostrarMas, setMostrarMas] = React.useState(false);
  const ruta = usePathname();
  const grupos = React.useMemo(
    () =>
      suspendida
        ? [
            {
              titulo: 'Cuenta suspendida',
              elementos: [
                {
                  href: '/panel/pagos',
                  texto: 'Plan y pagos',
                  icono: CreditCard,
                  roles: ['administrador'] as const,
                },
              ],
            },
          ]
        : navegacionPara(rol),
    [rol, suspendida]
  );

  const rutaReal = (href: string) => (href === '/panel' ? basePath : `${basePath}${href.slice(6)}`);
  const estaActiva = (href: string) => {
    const destino = rutaReal(href);
    return href === '/panel' ? ruta === destino : ruta.startsWith(destino);
  };
  const gruposDiarios = grupos.slice(0, 1);
  const gruposAdicionales = grupos.slice(1);
  const hayHerramientaActiva = gruposAdicionales.some((grupo) =>
    grupo.elementos.some((elemento) => estaActiva(elemento.href))
  );
  const mostrarHerramientas = mostrarMas || hayHerramientaActiva;

  return (
    <aside
      data-colapsada={colapsada}
      className={cn(
        'hidden shrink-0 flex-col border-r border-[var(--borde)] bg-[var(--superficie)] transition-[width] duration-200 md:flex',
        colapsada ? 'w-lateral-min' : 'w-lateral'
      )}
    >
      <div className="flex h-14 items-center gap-2 border-b border-[var(--borde)] px-3">
        {!colapsada && (
          <Link href={basePath} className="truncate font-display text-lg text-[var(--texto)]">
            {nombreNegocio}
          </Link>
        )}
        <button
          type="button"
          onClick={() => setColapsada((v) => !v)}
          className="ml-auto rounded-sm p-1.5 text-[var(--texto-tenue)] transition-colors hover:bg-[var(--superficie-alta)] hover:text-[var(--texto)]"
          aria-label={colapsada ? 'Expandir menú' : 'Colapsar menú'}
          aria-expanded={!colapsada}
        >
          {colapsada ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </button>
      </div>

      <nav aria-label="Panel de administración" className="flex-1 overflow-y-auto px-2 py-3">
        {gruposDiarios.map((grupo) => (
          <div key={grupo.titulo} className="mb-4">
            {!colapsada && (
              <p className="etiqueta px-2 py-1.5 text-[10px] text-[var(--texto-tenue)]">
                {grupo.titulo}
              </p>
            )}
            <ul className="space-y-0.5">
              {grupo.elementos.map((elemento) => {
                const Icono = elemento.icono;
                const activa = estaActiva(elemento.href);
                return (
                  <li key={elemento.href}>
                    <Link
                      href={rutaReal(elemento.href)}
                      aria-current={activa ? 'page' : undefined}
                      title={colapsada ? elemento.texto : undefined}
                      className={cn(
                        'flex items-center gap-2.5 rounded-sm px-2 py-2 text-sm transition-colors',
                        colapsada && 'justify-center',
                        activa
                          ? 'bg-[var(--superficie-alta)] text-[var(--texto)] shadow-[inset_2px_0_0_0_var(--color-dorado)]'
                          : 'text-[var(--texto-suave)] hover:bg-[var(--superficie-alta)] hover:text-[var(--texto)]'
                      )}
                    >
                      <Icono
                        className={cn('size-4 shrink-0', activa && 'text-dorado')}
                        aria-hidden="true"
                      />
                      {!colapsada && <span className="truncate">{elemento.texto}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {gruposAdicionales.length ? (
          <button
            type="button"
            onClick={() => setMostrarMas((valor) => !valor)}
            className={cn(
              'mb-3 flex w-full items-center gap-2.5 rounded-sm px-2 py-2 text-sm text-[var(--texto-suave)] transition-colors hover:bg-[var(--superficie-alta)] hover:text-[var(--texto)]',
              colapsada && 'justify-center'
            )}
            aria-expanded={mostrarHerramientas}
            title={colapsada ? 'Más herramientas' : undefined}
          >
            <Wrench className="size-4 shrink-0" />
            {!colapsada ? (
              <>
                <span>Más herramientas</span>
                <ChevronDown
                  className={cn(
                    'ml-auto size-4 transition-transform',
                    mostrarHerramientas && 'rotate-180'
                  )}
                />
              </>
            ) : null}
          </button>
        ) : null}

        {mostrarHerramientas
          ? gruposAdicionales.map((grupo) => (
              <div key={grupo.titulo} className="mb-4">
                {!colapsada && (
                  <p className="etiqueta px-2 py-1.5 text-[10px] text-[var(--texto-tenue)]">
                    {grupo.titulo}
                  </p>
                )}
                <ul className="space-y-0.5">
                  {grupo.elementos.map((elemento) => {
                    const Icono = elemento.icono;
                    const activa = estaActiva(elemento.href);
                    return (
                      <li key={elemento.href}>
                        <Link
                          href={rutaReal(elemento.href)}
                          aria-current={activa ? 'page' : undefined}
                          title={colapsada ? elemento.texto : undefined}
                          className={cn(
                            'flex items-center gap-2.5 rounded-sm px-2 py-2 text-sm transition-colors',
                            colapsada && 'justify-center',
                            activa
                              ? 'bg-[var(--superficie-alta)] text-[var(--texto)] shadow-[inset_2px_0_0_0_var(--color-dorado)]'
                              : 'text-[var(--texto-suave)] hover:bg-[var(--superficie-alta)] hover:text-[var(--texto)]'
                          )}
                        >
                          <Icono
                            className={cn('size-4 shrink-0', activa && 'text-dorado')}
                            aria-hidden="true"
                          />
                          {!colapsada && <span className="truncate">{elemento.texto}</span>}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          : null}
      </nav>

      {!colapsada && (
        <div className="border-t border-[var(--borde)] px-4 py-3">
          <p className="etiqueta text-[10px] text-dorado">Sesión</p>
          <p className="mt-1 text-xs text-[var(--texto-suave)]">{ETIQUETA_ROL[rol]}</p>
          <form action={cerrarSesion} className="mt-3">
            <button
              type="submit"
              className="flex items-center gap-2 text-xs text-[var(--texto-suave)] hover:text-dorado"
            >
              <LogOut className="size-3.5" /> Cerrar sesión
            </button>
          </form>
        </div>
      )}
    </aside>
  );
}
