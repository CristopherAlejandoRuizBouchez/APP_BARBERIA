import Link from 'next/link';
import { formatearTelefono } from '@/lib/telefono';
import type { SucursalPublica } from '@/lib/tenant/resolver';

const ETIQUETA_RED: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  x: 'X',
};

export function PiePublico({
  slug,
  nombreNegocio,
  telefonoWhatsApp,
  descripcion,
  redesSociales,
  sucursales,
}: {
  slug: string;
  nombreNegocio: string;
  telefonoWhatsApp: string | null;
  descripcion: string | null;
  redesSociales: Record<string, string>;
  sucursales: SucursalPublica[];
}) {
  const anio = new Date().getFullYear();
  const base = `/b/${slug}`;

  const columnas = [
    {
      titulo: 'Servicios',
      enlaces: [
        { href: `${base}/servicios`, texto: 'Todos los servicios' },
        { href: `${base}/reservar`, texto: 'Reservar cita' },
        { href: `${base}/mi-cita`, texto: 'Consultar mi cita' },
      ],
    },
    {
      titulo: 'La barbería',
      enlaces: [
        { href: `${base}/barberos`, texto: 'Nuestros barberos' },
        { href: `${base}/galeria`, texto: 'Galería' },
        { href: `${base}/tienda`, texto: 'Tienda' },
        { href: `${base}/contacto`, texto: 'Contacto' },
      ],
    },
    {
      titulo: 'Legal',
      enlaces: [
        { href: `${base}/privacidad`, texto: 'Aviso de privacidad' },
        { href: `${base}/terminos`, texto: 'Términos y condiciones' },
      ],
    },
  ];

  const redes = Object.entries(redesSociales).filter(([, url]) => Boolean(url));

  return (
    <footer className="border-t" style={{ borderColor: 'var(--tema-borde)' }}>
      <div className="mx-auto w-full px-5 py-14" style={{ maxWidth: 'var(--tema-ancho)' }}>
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <p className="font-[family-name:var(--tema-fuente-titulos)] text-2xl">
              {nombreNegocio}
            </p>
            {descripcion ? (
              <p
                className="mt-3 max-w-xs text-sm leading-relaxed"
                style={{ color: 'var(--tema-texto-suave)' }}
              >
                {descripcion}
              </p>
            ) : null}

            {telefonoWhatsApp ? (
              <p className="mt-5">
                <a
                  href={`https://wa.me/${telefonoWhatsApp}`}
                  className="enlace-filete cifras text-sm"
                  style={{ color: 'var(--tema-primario)' }}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {formatearTelefono(`+${telefonoWhatsApp}`)}
                </a>
              </p>
            ) : null}

            {redes.length > 0 ? (
              <ul className="mt-4 flex flex-wrap gap-4">
                {redes.map(([red, url]) => (
                  <li key={red}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="enlace-filete text-xs uppercase tracking-[0.16em]"
                      style={{ color: 'var(--tema-texto-suave)' }}
                    >
                      {ETIQUETA_RED[red] ?? red}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {columnas.map((columna) => (
            <nav key={columna.titulo} aria-label={columna.titulo}>
              <p className="etiqueta" style={{ color: 'var(--tema-primario)' }}>
                {columna.titulo}
              </p>
              <ul className="mt-4 space-y-2.5">
                {columna.enlaces.map((enlace) => (
                  <li key={enlace.href}>
                    <Link
                      href={enlace.href}
                      className="enlace-filete text-sm transition-colors"
                      style={{ color: 'var(--tema-texto-suave)' }}
                    >
                      {enlace.texto}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {sucursales[0] ? (
          <div className="mt-12 border-t pt-8" style={{ borderColor: 'var(--tema-borde)' }}>
            <p className="etiqueta" style={{ color: 'var(--tema-primario)' }}>
              Visítanos
            </p>
            <p className="mt-2 text-sm" style={{ color: 'var(--tema-texto-suave)' }}>
              {sucursales[0].direccionCorta}
              {sucursales[0].direccionCorta ? ', ' : ''}
              {sucursales[0].ciudad}
            </p>
          </div>
        ) : null}

        <div
          className="mt-12 flex flex-col gap-3 border-t pt-6 text-xs sm:flex-row sm:items-center sm:justify-between"
          style={{ borderColor: 'var(--tema-borde)', color: 'var(--tema-texto-suave)' }}
        >
          <p>
            © {anio} {nombreNegocio}. Todos los derechos reservados.
          </p>
          <p>Precios en pesos mexicanos (MXN)</p>
        </div>
      </div>
    </footer>
  );
}
