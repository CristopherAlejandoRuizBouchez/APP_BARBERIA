import Link from 'next/link';
import { solicitarRecuperacion } from '../acciones';
import { Boton } from '@/components/ui/boton';
import { Campo, Entrada } from '@/components/ui/campo';
import { Tarjeta, TarjetaCabecera, TarjetaContenido, TarjetaTitulo } from '@/components/ui/tarjeta';

export default async function PaginaRecuperacion({
  searchParams,
}: {
  searchParams: Promise<{ exito?: string }>;
}) {
  const { exito } = await searchParams;
  return (
    <Tarjeta className="w-full max-w-md">
      <TarjetaCabecera>
        <TarjetaTitulo>Recuperar contraseña</TarjetaTitulo>
      </TarjetaCabecera>
      <TarjetaContenido>
        {exito ? (
          <p className="mb-4 border border-exito/40 bg-exito/10 p-3 text-sm">{exito}</p>
        ) : null}
        <form action={solicitarRecuperacion} className="space-y-4">
          <Campo etiqueta="Correo de acceso" htmlFor="correo" requerido>
            <Entrada id="correo" name="correo" type="email" required />
          </Campo>
          <Boton type="submit" ancho="completo">
            Enviar enlace
          </Boton>
        </form>
        <Link href="/iniciar-sesion" className="mt-5 block text-center text-sm text-dorado">
          Volver
        </Link>
      </TarjetaContenido>
    </Tarjeta>
  );
}
