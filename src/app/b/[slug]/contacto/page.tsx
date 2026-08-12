import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Mail, MapPin, MessageCircle, Navigation } from 'lucide-react';
import { Boton } from '@/components/ui/boton';
import { organizacionPorSlug, sucursalesDeOrganizacion } from '@/lib/tenant/resolver';

export const metadata: Metadata = { title: 'Contacto' };

export default async function Contacto({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const org = await organizacionPorSlug(slug);
  if (!org) notFound();

  const ubicacion = (await sucursalesDeOrganizacion(org.id))[0];
  const direccionCompleta = ubicacion
    ? [ubicacion.direccionCorta, ubicacion.ciudad].filter(Boolean).join(', ')
    : '';
  const consultaMapa = encodeURIComponent(direccionCompleta);
  const urlMapa = direccionCompleta
    ? `https://www.google.com/maps?q=${consultaMapa}&output=embed`
    : '';
  const urlComoLlegar = direccionCompleta
    ? `https://www.google.com/maps/search/?api=1&query=${consultaMapa}`
    : '';
  const telefonoWhatsapp = ubicacion?.telefonoWhatsapp || org.telefonoWhatsapp;
  const wa = telefonoWhatsapp ? `https://wa.me/${telefonoWhatsapp.replace(/\D/g, '')}` : null;

  return (
    <div className="mx-auto w-full px-5 py-16" style={{ maxWidth: 'var(--tema-ancho)' }}>
      <p className="etiqueta" style={{ color: 'var(--tema-primario)' }}>
        Contacto
      </p>
      <h1 className="mt-3 font-[family-name:var(--tema-fuente-titulos)] text-5xl">Estamos cerca</h1>
      {ubicacion && direccionCompleta ? (
        <div
          className="mt-10 grid overflow-hidden border md:grid-cols-[0.8fr_1.2fr]"
          style={{
            borderColor: 'var(--tema-borde)',
            background: 'var(--tema-superficie)',
            borderRadius: 'var(--tema-radio)',
          }}
        >
          <article className="flex flex-col justify-center p-6 sm:p-8">
            <MapPin className="size-5" style={{ color: 'var(--tema-primario)' }} />
            <h2 className="mt-4 font-[family-name:var(--tema-fuente-titulos)] text-3xl">
              Ubicación
            </h2>
            <p className="mt-3 leading-relaxed" style={{ color: 'var(--tema-texto-suave)' }}>
              {direccionCompleta}
            </p>
            <Boton comoHijo variante="acento" className="mt-6 w-fit">
              <a href={urlComoLlegar} target="_blank" rel="noreferrer">
                <Navigation className="size-4" /> Cómo llegar
              </a>
            </Boton>
          </article>

          <iframe
            title={`Mapa de ${org.nombreComercial}`}
            src={urlMapa}
            className="min-h-80 w-full border-0"
            loading="lazy"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      ) : null}

      <div className="mt-8 flex flex-wrap gap-3">
        {wa ? (
          <Boton comoHijo variante="acento">
            <a href={wa} target="_blank" rel="noreferrer">
              <MessageCircle className="size-4" /> Escribir por WhatsApp
            </a>
          </Boton>
        ) : null}
        {org.correoContacto ? (
          <Boton comoHijo variante="contorno">
            <a href={`mailto:${org.correoContacto}`}>
              <Mail className="size-4" /> {org.correoContacto}
            </a>
          </Boton>
        ) : null}
      </div>
    </div>
  );
}
