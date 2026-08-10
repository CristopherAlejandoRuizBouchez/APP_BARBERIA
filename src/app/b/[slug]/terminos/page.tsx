import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Términos y condiciones' };

export default function Terminos() {
  return (
    <article className="mx-auto w-full max-w-3xl px-5 py-16">
      <p className="etiqueta" style={{ color: 'var(--tema-primario)' }}>
        Legal
      </p>
      <h1 className="mt-3 font-[family-name:var(--tema-fuente-titulos)] text-5xl">
        Términos y condiciones
      </h1>
      <div className="mt-8 space-y-5 leading-relaxed" style={{ color: 'var(--tema-texto-suave)' }}>
        <p>
          Las citas están sujetas a confirmación y a las políticas de puntualidad y cancelación de
          la barbería. Los horarios mostrados se actualizan en tiempo real, pero una reserva solo
          queda registrada cuando aparece su folio.
        </p>
        <p>
          Los pedidos de productos son apartados temporales. No se realiza ningún cobro en línea:
          precio, forma de pago, recolección y entrega se confirman directamente por WhatsApp.
        </p>
        <p>
          Las imágenes y descripciones son informativas. La disponibilidad definitiva depende de las
          existencias disponibles.
        </p>
        <p>
          Esta plantilla debe adaptarse a las políticas comerciales y requisitos legales de cada
          barbería antes de publicarse definitivamente.
        </p>
      </div>
    </article>
  );
}
