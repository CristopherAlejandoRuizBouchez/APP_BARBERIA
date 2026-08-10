import Link from 'next/link';
import { Boton } from '@/components/ui/boton';

export default function NoEncontrado() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-carbon px-6 text-center text-marfil">
      <p className="etiqueta text-dorado">Error 404</p>
      <h1 className="mt-5 font-display text-5xl leading-none">Esta página no existe</h1>
      <p className="mt-4 max-w-sm text-marfil/55">
        Puede que el enlace esté mal escrito o que la página se haya movido.
      </p>
      <div className="mt-9 flex flex-col gap-3 sm:flex-row">
        <Boton comoHijo variante="primario">
          <Link href="/">Ir al inicio</Link>
        </Boton>
        <Boton comoHijo variante="contorno">
          <Link href="/reservar">Reservar una cita</Link>
        </Boton>
      </div>
    </div>
  );
}
