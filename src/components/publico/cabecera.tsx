'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { Boton } from '@/components/ui/boton';
import { cn } from '@/lib/utils';
import type { FormaNavegacion } from '@/lib/temas/plantillas';

/**
 * Cabecera del sitio público de una barbería.
 *
 * La forma cambia según la plantilla: `barra_fija` es una barra translúcida
 * pegada arriba; `barra_alta` pone el logo centrado en una primera altura y el
 * menú debajo; `centrada_serif` usa versalitas y centra todo. No es el mismo
 * componente con otro color.
 */
export function CabeceraPublica({
  slug,
  nombreNegocio,
  logoUrl,
  navegacion,
}: {
  slug: string;
  nombreNegocio: string;
  logoUrl: string | null;
  navegacion: FormaNavegacion;
}) {
  const [abierto, setAbierto] = React.useState(false);
  const [desplazado, setDesplazado] = React.useState(false);
  const ruta = usePathname();

  const base = `/b/${slug}`;
  const enlaces = [
    { href: `${base}/servicios`, texto: 'Servicios' },
    { href: `${base}/barberos`, texto: 'Barberos' },
    { href: `${base}/tienda`, texto: 'Tienda' },
    { href: `${base}/galeria`, texto: 'Galería' },
    { href: `${base}/contacto`, texto: 'Contacto' },
  ];

  React.useEffect(() => {
    const alDesplazar = () => setDesplazado(window.scrollY > 16);
    alDesplazar();
    window.addEventListener('scroll', alDesplazar, { passive: true });
    return () => window.removeEventListener('scroll', alDesplazar);
  }, []);

  React.useEffect(() => setAbierto(false), [ruta]);

  React.useEffect(() => {
    document.body.style.overflow = abierto ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [abierto]);

  const centrada = navegacion === 'barra_alta' || navegacion === 'centrada_serif';
  const versalitas = navegacion === 'centrada_serif';

  const Marca = (
    <Link
      href={base}
      className="group flex items-center gap-2"
      aria-label={`${nombreNegocio}, inicio`}
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt={nombreNegocio} className="h-8 w-auto object-contain" />
      ) : (
        <span
          className="font-[family-name:var(--tema-fuente-titulos)] text-xl leading-none transition-colors group-hover:text-[var(--tema-primario)]"
          style={{ color: 'var(--tema-texto)' }}
        >
          {nombreNegocio}
        </span>
      )}
    </Link>
  );

  const Menu_ = (
    <nav
      aria-label="Principal"
      className={cn('hidden items-center gap-8 md:flex', centrada && 'justify-center')}
    >
      {enlaces.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={ruta.startsWith(item.href) ? 'page' : undefined}
          className={cn(
            'enlace-filete text-sm transition-colors',
            versalitas && 'text-xs font-bold uppercase tracking-[0.2em]'
          )}
          style={{
            color: ruta.startsWith(item.href) ? 'var(--tema-texto)' : 'var(--tema-texto-suave)',
          }}
        >
          {item.texto}
        </Link>
      ))}
    </nav>
  );

  return (
    <header
      className={cn(
        'sticky top-0 z-40 w-full transition-colors duration-300',
        desplazado && 'border-b backdrop-blur-md'
      )}
      style={{
        borderColor: desplazado ? 'var(--tema-borde)' : 'transparent',
        backgroundColor: desplazado
          ? 'color-mix(in srgb, var(--tema-fondo) 92%, transparent)'
          : 'transparent',
      }}
    >
      <div
        className={cn(
          'mx-auto w-full px-5',
          centrada ? 'py-4' : 'flex h-18 items-center justify-between gap-6 py-4'
        )}
        style={{ maxWidth: 'var(--tema-ancho)' }}
      >
        {centrada ? (
          <>
            <div className="flex items-center justify-between">
              <span className="w-24 md:hidden" />
              <div className="flex flex-1 justify-center md:justify-start">{Marca}</div>
              <div className="flex items-center gap-3">
                <Boton comoHijo variante="contorno" tamano="sm" className="hidden sm:inline-flex">
                  <Link href={`${base}/reservar`}>Reservar</Link>
                </Boton>
                <button
                  type="button"
                  onClick={() => setAbierto((v) => !v)}
                  className="rounded-sm p-2 md:hidden"
                  aria-expanded={abierto}
                  aria-controls="menu-movil"
                  aria-label={abierto ? 'Cerrar menú' : 'Abrir menú'}
                >
                  {abierto ? <X className="size-5" /> : <Menu className="size-5" />}
                </button>
              </div>
            </div>
            <div className="mt-3 hidden justify-center md:flex">{Menu_}</div>
          </>
        ) : (
          <>
            {Marca}
            {Menu_}
            <div className="flex items-center gap-3">
              <Boton comoHijo variante="contorno" tamano="sm" className="hidden sm:inline-flex">
                <Link href={`${base}/reservar`}>Reservar</Link>
              </Boton>
              <button
                type="button"
                onClick={() => setAbierto((v) => !v)}
                className="rounded-sm p-2 md:hidden"
                aria-expanded={abierto}
                aria-controls="menu-movil"
                aria-label={abierto ? 'Cerrar menú' : 'Abrir menú'}
              >
                {abierto ? <X className="size-5" /> : <Menu className="size-5" />}
              </button>
            </div>
          </>
        )}
      </div>

      <div
        id="menu-movil"
        hidden={!abierto}
        className="fixed inset-0 top-18 z-40 px-5 pb-10 pt-8 md:hidden"
        style={{ backgroundColor: 'var(--tema-fondo)' }}
      >
        <nav aria-label="Principal, móvil" className="flex flex-col">
          {enlaces.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="border-b py-4 font-[family-name:var(--tema-fuente-titulos)] text-2xl"
              style={{ borderColor: 'var(--tema-borde)' }}
            >
              {item.texto}
            </Link>
          ))}
        </nav>
        <div className="mt-8 flex flex-col gap-3">
          <Boton comoHijo variante="primario" tamano="lg" ancho="completo">
            <Link href={`${base}/reservar`}>Reservar cita</Link>
          </Boton>
        </div>
      </div>
    </header>
  );
}
