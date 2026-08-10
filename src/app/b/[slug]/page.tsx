import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, MapPin, Scissors } from 'lucide-react';
import { Boton } from '@/components/ui/boton';
import { formatearMXNCompacto } from '@/lib/dinero';
import { crearClientePublico } from '@/lib/supabase/servidor';
import {
  organizacionPorSlug,
  temaDeOrganizacion,
  sucursalesDeOrganizacion,
} from '@/lib/tenant/resolver';
import { definicionDe } from '@/lib/temas/plantillas';
import { cn } from '@/lib/utils';

/**
 * Portada de una barbería.
 *
 * Todos los datos vienen de Supabase, filtrados por `organization_id` mediante
 * RLS. La composición la decide la plantilla: el mismo componente se dibuja
 * distinto según `disposicion.hero` y `disposicion.servicios`.
 */
export default async function PortadaBarberia({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const org = await organizacionPorSlug(slug);
  if (!org) notFound();

  const supabase = crearClientePublico();

  const [tema, sucursales, servicios, barberos] = await Promise.all([
    temaDeOrganizacion(org.id),
    sucursalesDeOrganizacion(org.id),
    supabase
      .from('services')
      .select('id, slug, nombre, descripcion, duracion_minutos, precio_centavos')
      .eq('organization_id', org.id)
      .eq('activo', true)
      .eq('destacado', true)
      .order('orden')
      .limit(6),
    supabase
      .from('barbers')
      .select('id, slug, nombre, apodo, especialidades, foto_url')
      .eq('organization_id', org.id)
      .eq('activo', true)
      .order('orden')
      .limit(8),
  ]);

  const definicion = definicionDe(tema?.plantilla);
  const { hero, servicios: formaServicios } = definicion.disposicion;
  const textura = tema?.textura ?? definicion.tokens.textura;
  const base = `/b/${slug}`;
  const listaServicios = servicios.data ?? [];
  const listaBarberos = barberos.data ?? [];

  const contenedor = 'mx-auto w-full px-5';
  const anchoEstilo = { maxWidth: 'var(--tema-ancho)' } as React.CSSProperties;

  return (
    <>
      {/* ── HERO — la forma la decide la plantilla ─────────────────────── */}
      <section
        className={cn(
          'relative overflow-hidden border-b',
          textura === 'grano' && 'grano',
          textura === 'lineas' && 'textura-lineas',
          textura === 'trama' && 'textura-trama',
          hero === 'pantalla_completa' && 'flex min-h-[88svh] items-end',
          hero === 'dividido' && 'grid items-stretch md:grid-cols-2',
          hero === 'centrado_minimo' && 'flex min-h-[60svh] items-center text-center',
          hero === 'marco_retro' && 'py-16',
          hero === 'editorial' && 'py-24'
        )}
        style={{ borderColor: 'var(--tema-borde)' }}
      >
        {tema?.portadaUrl && hero !== 'centrado_minimo' && hero !== 'dividido' ? (
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-cover bg-center opacity-45"
            style={{ backgroundImage: `url("${tema.portadaUrl}")` }}
          />
        ) : null}
        {hero === 'pantalla_completa' ? (
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background: tema?.portadaUrl
                ? 'linear-gradient(90deg, color-mix(in srgb, var(--tema-fondo) 96%, transparent) 0%, color-mix(in srgb, var(--tema-fondo) 62%, transparent) 58%, color-mix(in srgb, var(--tema-fondo) 30%, transparent) 100%)'
                : 'radial-gradient(120% 90% at 75% 10%, var(--tema-superficie) 0%, var(--tema-fondo) 58%)',
            }}
          />
        ) : null}

        <div
          className={cn(
            contenedor,
            'relative z-10',
            hero === 'pantalla_completa' && 'pb-20 pt-32',
            hero === 'dividido' && 'flex flex-col justify-center py-20',
            hero === 'marco_retro' && 'py-4',
            hero === 'editorial' && 'py-4'
          )}
          style={anchoEstilo}
        >
          <div
            className={cn(
              hero === 'marco_retro' && 'border-2 p-10 md:p-16',
              hero === 'centrado_minimo' && 'mx-auto max-w-2xl'
            )}
            style={hero === 'marco_retro' ? { borderColor: 'var(--tema-primario)' } : undefined}
          >
            <p
              className={cn(
                'etiqueta flex items-center gap-2',
                hero === 'centrado_minimo' && 'justify-center'
              )}
              style={{ color: 'var(--tema-primario)' }}
            >
              <span
                className="inline-block h-px w-8"
                style={{ background: 'var(--tema-primario)' }}
                aria-hidden="true"
              />
              {sucursales[0]?.ciudad ?? 'Barbería'}
            </p>

            <h1
              className={cn(
                'mt-6 font-[family-name:var(--tema-fuente-titulos)] leading-[0.95]',
                hero === 'editorial'
                  ? 'text-6xl sm:text-7xl lg:text-8xl'
                  : 'text-5xl sm:text-6xl lg:text-7xl',
                hero === 'centrado_minimo' && 'text-4xl sm:text-5xl'
              )}
            >
              {tema?.eslogan ?? org.nombreComercial}
            </h1>

            {tema?.descripcion ? (
              <p
                className={cn(
                  'mt-6 max-w-md text-lg leading-relaxed',
                  hero === 'centrado_minimo' && 'mx-auto'
                )}
                style={{ color: 'var(--tema-texto-suave)' }}
              >
                {tema.descripcion}
              </p>
            ) : null}

            <div
              className={cn(
                'mt-10 flex flex-col gap-3 sm:flex-row sm:items-center',
                hero === 'centrado_minimo' && 'sm:justify-center'
              )}
            >
              <Boton comoHijo variante="primario" tamano="lg">
                <Link href={`${base}/reservar`}>
                  Reservar cita
                  <ArrowRight className="size-4" />
                </Link>
              </Boton>
              <Boton comoHijo variante="contorno" tamano="lg">
                <Link href={`${base}/servicios`}>Ver servicios</Link>
              </Boton>
            </div>
          </div>
        </div>

        {hero === 'dividido' ? (
          <div
            className="hidden bg-cover bg-center md:block"
            style={{
              backgroundColor: 'var(--tema-superficie)',
              backgroundImage: tema?.portadaUrl
                ? `linear-gradient(color-mix(in srgb, var(--tema-fondo) 12%, transparent), color-mix(in srgb, var(--tema-fondo) 12%, transparent)), url("${tema.portadaUrl}")`
                : undefined,
            }}
            aria-hidden="true"
          />
        ) : null}
      </section>

      {/* ── SERVICIOS — rejilla, carta, lista o columnas ────────────────── */}
      {listaServicios.length > 0 ? (
        <section
          className={contenedor}
          style={{ ...anchoEstilo, paddingBlock: 'var(--tema-ritmo)' }}
          aria-labelledby="titulo-servicios"
        >
          <div
            className="flex flex-wrap items-end justify-between gap-4 border-b pb-5"
            style={{ borderColor: 'var(--tema-borde)' }}
          >
            <div>
              <p className="etiqueta" style={{ color: 'var(--tema-primario)' }}>
                Lo que hacemos
              </p>
              <h2
                id="titulo-servicios"
                className="mt-3 font-[family-name:var(--tema-fuente-titulos)] text-4xl"
              >
                Servicios
              </h2>
            </div>
            <Link
              href={`${base}/servicios`}
              className="enlace-filete text-sm"
              style={{ color: 'var(--tema-texto-suave)' }}
            >
              Ver todos
            </Link>
          </div>

          {formaServicios === 'carta' ? (
            <ul className="mt-10 space-y-5">
              {listaServicios.map((s) => (
                <li key={s.id} className="flex items-baseline gap-3">
                  <Link href={`${base}/servicios`} className="enlace-filete text-lg">
                    {s.nombre}
                  </Link>
                  <span
                    className="h-px flex-1 border-b border-dotted"
                    style={{ borderColor: 'var(--tema-borde)' }}
                    aria-hidden="true"
                  />
                  <span className="cifras text-xs" style={{ color: 'var(--tema-texto-suave)' }}>
                    {s.duracion_minutos} min
                  </span>
                  <span
                    className="cifras font-[family-name:var(--tema-fuente-titulos)] text-xl"
                    style={{ color: 'var(--tema-primario)' }}
                  >
                    {formatearMXNCompacto(s.precio_centavos)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div
              className={cn(
                'mt-10 grid gap-5',
                formaServicios === 'lista_ancha' ? 'grid-cols-1' : 'md:grid-cols-3',
                formaServicios === 'columnas_editorial' && 'md:grid-cols-2'
              )}
            >
              {listaServicios.map((s, i) => (
                <article
                  key={s.id}
                  className="flex flex-col border p-6 transition-colors"
                  style={{
                    borderColor: 'var(--tema-borde)',
                    background: 'var(--tema-superficie)',
                    borderRadius: 'var(--tema-radio)',
                  }}
                >
                  {formaServicios === 'columnas_editorial' ? (
                    <span className="cifras text-sm" style={{ color: 'var(--tema-primario)' }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                  ) : (
                    <Scissors
                      className="size-5"
                      style={{ color: 'var(--tema-primario)' }}
                      aria-hidden="true"
                    />
                  )}
                  <h3 className="mt-5 font-[family-name:var(--tema-fuente-titulos)] text-2xl">
                    {s.nombre}
                  </h3>
                  {s.descripcion ? (
                    <p
                      className="mt-2 flex-1 text-sm leading-relaxed"
                      style={{ color: 'var(--tema-texto-suave)' }}
                    >
                      {s.descripcion}
                    </p>
                  ) : null}
                  <div
                    className="mt-6 flex items-baseline justify-between border-t pt-4"
                    style={{ borderColor: 'var(--tema-borde)' }}
                  >
                    <span className="cifras text-xs" style={{ color: 'var(--tema-texto-suave)' }}>
                      {s.duracion_minutos} min
                    </span>
                    <span
                      className="cifras font-[family-name:var(--tema-fuente-titulos)] text-2xl"
                      style={{ color: 'var(--tema-primario)' }}
                    >
                      {formatearMXNCompacto(s.precio_centavos)}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {/* ── EQUIPO ──────────────────────────────────────────────────────── */}
      {listaBarberos.length > 0 ? (
        <section
          className="border-y"
          style={{ background: 'var(--tema-superficie)', borderColor: 'var(--tema-borde)' }}
          aria-labelledby="titulo-equipo"
        >
          <div className={contenedor} style={{ ...anchoEstilo, paddingBlock: 'var(--tema-ritmo)' }}>
            <p className="etiqueta" style={{ color: 'var(--tema-primario)' }}>
              Quién te atiende
            </p>
            <h2
              id="titulo-equipo"
              className="mt-3 font-[family-name:var(--tema-fuente-titulos)] text-4xl"
            >
              El equipo
            </h2>

            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {listaBarberos.map((b) => (
                <article key={b.id}>
                  <div
                    className="aspect-[3/4] w-full border"
                    style={{
                      borderColor: 'var(--tema-borde)',
                      background: 'var(--tema-fondo)',
                      borderRadius: 'var(--tema-radio)',
                      backgroundImage: b.foto_url ? `url(${b.foto_url})` : undefined,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                    role={b.foto_url ? 'img' : undefined}
                    aria-label={b.foto_url ? `Retrato de ${b.nombre}` : undefined}
                  />
                  <p className="mt-4 font-[family-name:var(--tema-fuente-titulos)] text-xl">
                    {b.nombre}
                  </p>
                  {b.apodo ? (
                    <p className="cifras text-xs" style={{ color: 'var(--tema-primario)' }}>
                      «{b.apodo}»
                    </p>
                  ) : null}
                  {b.especialidades?.length ? (
                    <p className="mt-1.5 text-sm" style={{ color: 'var(--tema-texto-suave)' }}>
                      {b.especialidades.join(' · ')}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ── SUCURSALES ──────────────────────────────────────────────────── */}
      {sucursales.length > 1 ? (
        <section
          className={contenedor}
          style={{ ...anchoEstilo, paddingBlock: 'var(--tema-ritmo)' }}
        >
          <p className="etiqueta" style={{ color: 'var(--tema-primario)' }}>
            Dónde estamos
          </p>
          <h2 className="mt-3 font-[family-name:var(--tema-fuente-titulos)] text-4xl">
            Sucursales
          </h2>

          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {sucursales.map((s) => (
              <article
                key={s.id}
                className="border p-6"
                style={{
                  borderColor: 'var(--tema-borde)',
                  background: 'var(--tema-superficie)',
                  borderRadius: 'var(--tema-radio)',
                }}
              >
                <MapPin
                  className="size-5"
                  style={{ color: 'var(--tema-primario)' }}
                  aria-hidden="true"
                />
                <h3 className="mt-4 font-[family-name:var(--tema-fuente-titulos)] text-xl">
                  {s.nombre}
                </h3>
                <p className="mt-2 text-sm" style={{ color: 'var(--tema-texto-suave)' }}>
                  {s.direccionCorta}
                  {s.direccionCorta ? ', ' : ''}
                  {s.ciudad}
                </p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {/* ── CIERRE ──────────────────────────────────────────────────────── */}
      <section
        className={cn(
          'border-t',
          textura === 'grano' && 'grano',
          textura === 'lineas' && 'textura-lineas',
          textura === 'trama' && 'textura-trama',
          'relative overflow-hidden'
        )}
        style={{ borderColor: 'var(--tema-borde)' }}
      >
        <div
          className={cn(contenedor, 'relative z-10 text-center')}
          style={{ ...anchoEstilo, paddingBlock: 'var(--tema-ritmo)' }}
        >
          <h2 className="mx-auto max-w-2xl font-[family-name:var(--tema-fuente-titulos)] text-4xl leading-tight sm:text-5xl">
            Reserva en menos de un minuto.
          </h2>
          <p className="mx-auto mt-5 max-w-md" style={{ color: 'var(--tema-texto-suave)' }}>
            Sin crear cuenta, sin contraseñas. Solo tu nombre y tu WhatsApp.
          </p>
          <Boton comoHijo variante="acento" tamano="lg" className="mt-9">
            <Link href={`${base}/reservar`}>Reservar en {org.nombreComercial}</Link>
          </Boton>
        </div>
      </section>
    </>
  );
}
