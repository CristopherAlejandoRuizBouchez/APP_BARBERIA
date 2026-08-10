import { actualizarContrasena } from '../acciones';
import { Boton } from '@/components/ui/boton';
import { Campo, Entrada } from '@/components/ui/campo';
import { Tarjeta, TarjetaCabecera, TarjetaContenido, TarjetaTitulo } from '@/components/ui/tarjeta';

export default async function PaginaNuevaContrasena({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <Tarjeta className="w-full max-w-md">
      <TarjetaCabecera>
        <TarjetaTitulo>Nueva contraseña</TarjetaTitulo>
      </TarjetaCabecera>
      <TarjetaContenido>
        {error ? (
          <p className="mb-4 border border-peligro/40 bg-peligro/10 p-3 text-sm">{error}</p>
        ) : null}
        <form action={actualizarContrasena} className="space-y-4">
          <Campo
            etiqueta="Nueva contraseña"
            htmlFor="contrasena"
            ayuda="Mínimo 10 caracteres"
            requerido
          >
            <Entrada id="contrasena" name="contrasena" type="password" minLength={10} required />
          </Campo>
          <Campo etiqueta="Confirmar contraseña" htmlFor="confirmar" requerido>
            <Entrada id="confirmar" name="confirmar" type="password" minLength={10} required />
          </Campo>
          <Boton type="submit" ancho="completo">
            Guardar contraseña
          </Boton>
        </form>
      </TarjetaContenido>
    </Tarjeta>
  );
}
