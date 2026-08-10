import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Aviso de privacidad' };

export default function Privacidad() {
  return (
    <article className="mx-auto w-full max-w-3xl px-5 py-16">
      <p className="etiqueta" style={{ color: 'var(--tema-primario)' }}>
        Legal
      </p>
      <h1 className="mt-3 font-[family-name:var(--tema-fuente-titulos)] text-5xl">
        Aviso de privacidad
      </h1>
      <div className="mt-8 space-y-5 leading-relaxed" style={{ color: 'var(--tema-texto-suave)' }}>
        <p>
          Los datos proporcionados al reservar o realizar un pedido se usan para prestar el
          servicio, confirmar horarios, gestionar entregas y mantener el historial dentro de esta
          barbería.
        </p>
        <p>
          Cada barbería es responsable de sus datos de clientes. La plataforma mantiene la
          información separada por organización y no comparte directorios entre negocios.
        </p>
        <p>
          Puedes solicitar acceso, corrección o eliminación comunicándote con la barbería mediante
          los datos publicados en la sección de contacto.
        </p>
        <p>
          Este texto es una plantilla inicial y debe revisarse con asesoría legal para adaptarlo al
          domicilio, responsable y obligaciones concretas del negocio.
        </p>
      </div>
    </article>
  );
}
