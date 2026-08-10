import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Mail, MapPin, MessageCircle } from 'lucide-react';
import { Boton } from '@/components/ui/boton';
import { organizacionPorSlug, sucursalesDeOrganizacion } from '@/lib/tenant/resolver';

export const metadata: Metadata = { title: 'Contacto' };

export default async function Contacto({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const org = await organizacionPorSlug(slug);
  if (!org) notFound();
  const ubicacion = (await sucursalesDeOrganizacion(org.id))[0];
  const wa = org.telefonoWhatsapp
    ? `https://wa.me/${org.telefonoWhatsapp.replace(/\D/g, '')}`
    : null;
  return (
    <div className="mx-auto w-full px-5 py-16" style={{ maxWidth: 'var(--tema-ancho)' }}>
      <p className="etiqueta" style={{ color: 'var(--tema-primario)' }}>
        Contacto
      </p>
      <h1 className="mt-3 font-[family-name:var(--tema-fuente-titulos)] text-5xl">Estamos cerca</h1>
      <div className="mt-10 grid gap-5 md:grid-cols-2">
        {ubicacion ? (
          <article
            className="border p-6"
            style={{ borderColor: 'var(--tema-borde)', background: 'var(--tema-superficie)' }}
          >
            <MapPin className="size-5" style={{ color: 'var(--tema-primario)' }} />
            <h2 className="mt-4 font-[family-name:var(--tema-fuente-titulos)] text-3xl">
              Ubicación
            </h2>
            <p className="mt-2" style={{ color: 'var(--tema-texto-suave)' }}>
              {ubicacion.direccionCorta}, {ubicacion.ciudad}
            </p>
            {ubicacion.telefonoWhatsapp ? (
              <Boton comoHijo variante="contorno" className="mt-5">
                <a
                  href={`https://wa.me/${ubicacion.telefonoWhatsapp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle className="size-4" /> WhatsApp
                </a>
              </Boton>
            ) : null}
          </article>
        ) : null}
      </div>
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
