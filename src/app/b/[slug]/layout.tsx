import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  organizacionPorSlug,
  temaDeOrganizacion,
  sucursalesDeOrganizacion,
} from '@/lib/tenant/resolver';
import { definicionDe, variablesCss, type Plantilla } from '@/lib/temas/plantillas';
import { CabeceraPublica } from '@/components/publico/cabecera';
import { PiePublico } from '@/components/publico/pie';
import { env } from '@/lib/env';

type Props = { params: Promise<{ slug: string }>; children: React.ReactNode };

/**
 * Metadatos por barbería: título, descripción, Open Graph, favicon propio y
 * datos estructurados LocalBusiness. Dos barberías comparten despliegue pero
 * no comparten identidad.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const org = await organizacionPorSlug(slug);

  if (!org) {
    return { title: 'Sitio no disponible', robots: { index: false, follow: false } };
  }

  const tema = await temaDeOrganizacion(org.id);
  const descripcion = tema?.descripcion ?? `Reserva tu cita en ${org.nombreComercial}.`;

  return {
    title: { default: org.nombreComercial, template: `%s · ${org.nombreComercial}` },
    description: descripcion,
    applicationName: org.nombreComercial,
    alternates: { canonical: `${env.NEXT_PUBLIC_APP_URL}/b/${org.slug}` },
    icons: tema?.faviconUrl ? { icon: tema.faviconUrl } : undefined,
    openGraph: {
      type: 'website',
      locale: 'es_MX',
      siteName: org.nombreComercial,
      title: org.nombreComercial,
      description: descripcion,
      url: `${env.NEXT_PUBLIC_APP_URL}/b/${org.slug}`,
      images: tema?.portadaUrl ? [{ url: tema.portadaUrl }] : undefined,
    },
    robots: { index: true, follow: true },
  };
}

export default async function LayoutBarberia({ params, children }: Props) {
  const { slug } = await params;
  const org = await organizacionPorSlug(slug);

  // RLS solo devuelve organizaciones activas: una suspendida llega aquí como
  // null y el visitante ve la página de no disponible, sin saber por qué.
  if (!org) notFound();

  const [tema, sucursales] = await Promise.all([
    temaDeOrganizacion(org.id),
    sucursalesDeOrganizacion(org.id),
  ]);

  const plantilla: Plantilla = tema?.plantilla ?? 'urban_premium';
  const definicion = definicionDe(plantilla);

  // El tema se serializa EN EL SERVIDOR y viaja en el atributo `style`. El
  // primer pintado ya lleva los colores correctos: no hay parpadeo.
  const estilo = variablesCss({
    plantilla,
    ...(tema
      ? {
          colorPrimario: tema.colorPrimario,
          colorSecundario: tema.colorSecundario,
          colorFondo: tema.colorFondo,
          colorSuperficie: tema.colorSuperficie,
          colorTexto: tema.colorTexto,
          fuenteTitulos: tema.fuenteTitulos,
          fuenteCuerpo: tema.fuenteCuerpo,
          radioBordes: tema.radioBordes,
          textura: tema.textura,
        }
      : {}),
  });

  const datosEstructurados = {
    '@context': 'https://schema.org',
    '@type': 'HairSalon',
    name: org.nombreComercial,
    description: tema?.descripcion ?? undefined,
    url: `${env.NEXT_PUBLIC_APP_URL}/b/${org.slug}`,
    telephone: org.telefonoWhatsapp ? `+${org.telefonoWhatsapp}` : undefined,
    image: tema?.portadaUrl ?? undefined,
    address: sucursales.map((s) => ({
      '@type': 'PostalAddress',
      streetAddress: s.direccionCorta,
      addressLocality: s.ciudad,
      addressCountry: 'MX',
    })),
  };

  return (
    <div
      data-plantilla={plantilla}
      data-esquema={definicion.esquema}
      style={estilo as React.CSSProperties}
      className="flex min-h-dvh flex-col bg-[var(--tema-fondo)] text-[var(--tema-texto)]"
    >
      <script
        type="application/ld+json"
        // Solo datos generados por nosotros a partir de columnas validadas.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(datosEstructurados) }}
      />

      <CabeceraPublica
        slug={org.slug}
        nombreNegocio={org.nombreComercial}
        logoUrl={tema?.logoUrl ?? null}
        navegacion={definicion.disposicion.navegacion}
      />

      <main id="contenido" className="flex-1">
        {children}
      </main>

      <PiePublico
        slug={org.slug}
        nombreNegocio={org.nombreComercial}
        telefonoWhatsApp={org.telefonoWhatsapp}
        descripcion={tema?.descripcion ?? null}
        redesSociales={tema?.redesSociales ?? {}}
        sucursales={sucursales}
      />
    </div>
  );
}
