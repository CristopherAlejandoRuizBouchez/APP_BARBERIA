import Link from 'next/link';
import { iniciarSesion } from '../acciones';
import { Boton } from '@/components/ui/boton';
import { Campo, Entrada } from '@/components/ui/campo';
import { Tarjeta, TarjetaCabecera, TarjetaContenido, TarjetaTitulo } from '@/components/ui/tarjeta';

export default async function PaginaLogin({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; exito?: string }>;
}) {
  const mensaje = await searchParams;
  return (
    <Tarjeta className="w-full max-w-md">
      <TarjetaCabecera>
        <p className="etiqueta text-dorado">Barbería OS</p>
        <TarjetaTitulo className="text-3xl">Iniciar sesión</TarjetaTitulo>
        <p className="text-sm text-[var(--texto-suave)]">Acceso para propietarios y personal.</p>
      </TarjetaCabecera>
      <TarjetaContenido>
        {mensaje.error ? (
          <p className="mb-4 border border-peligro/40 bg-peligro/10 p-3 text-sm">{mensaje.error}</p>
        ) : null}
        {mensaje.exito ? (
          <p className="mb-4 border border-exito/40 bg-exito/10 p-3 text-sm">{mensaje.exito}</p>
        ) : null}
        <form action={iniciarSesion} className="space-y-4">
          <Campo etiqueta="Correo" htmlFor="correo" requerido>
            <Entrada id="correo" name="correo" type="email" autoComplete="email" required />
          </Campo>
          <Campo etiqueta="Contraseña" htmlFor="contrasena" requerido>
            <Entrada
              id="contrasena"
              name="contrasena"
              type="password"
              autoComplete="current-password"
              minLength={8}
              required
            />
          </Campo>
          <Boton type="submit" ancho="completo">
            Entrar
          </Boton>
        </form>
        <Link
          href="/recuperar-contrasena"
          className="mt-5 block text-center text-sm text-dorado hover:underline"
        >
          Olvidé mi contraseña
        </Link>
      </TarjetaContenido>
    </Tarjeta>
  );
}
