'use client';

import * as React from 'react';
import { Building2, Check, Copy, Link2, MessageCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Boton } from '@/components/ui/boton';
import { Campo, Entrada, EntradaImporte } from '@/components/ui/campo';
import type { Resultado } from '@/lib/errores';

type AccesoPropietario = {
  enlace: string;
  nombre: string;
  correo: string;
  barberia: string;
  slug: string;
};

export function FormularioNuevaBarberia({
  action,
}: {
  action: (formData: FormData) => Promise<Resultado<AccesoPropietario>>;
}) {
  const router = useRouter();
  const formulario = React.useRef<HTMLFormElement>(null);
  const [resultado, setResultado] = React.useState<Resultado<AccesoPropietario> | null>(null);
  const [copiado, setCopiado] = React.useState(false);
  const [procesando, iniciar] = React.useTransition();

  function enviar(formData: FormData) {
    setResultado(null);
    iniciar(async () => {
      const respuesta = await action(formData);
      setResultado(respuesta);
      if (respuesta.ok) {
        formulario.current?.reset();
        router.refresh();
      }
    });
  }

  async function copiar(enlace: string) {
    try {
      await navigator.clipboard.writeText(enlace);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2500);
    } catch {
      window.prompt('Copia el enlace privado del propietario:', enlace);
    }
  }

  return (
    <div className="space-y-5">
      <form ref={formulario} action={enviar} className="space-y-4">
        <Campo etiqueta="Nombre comercial" htmlFor="nombre" requerido>
          <Entrada id="nombre" name="nombre" required />
        </Campo>
        <Campo etiqueta="Slug" htmlFor="slug" ayuda="Opcional; se genera del nombre">
          <Entrada id="slug" name="slug" placeholder="barberia-centro" />
        </Campo>
        <Campo etiqueta="Ciudad" htmlFor="ciudad" requerido>
          <Entrada id="ciudad" name="ciudad" required />
        </Campo>
        <Campo etiqueta="Nombre del propietario" htmlFor="propietario" requerido>
          <Entrada id="propietario" name="propietario" autoComplete="name" required />
        </Campo>
        <Campo etiqueta="Correo del propietario" htmlFor="correo" requerido>
          <Entrada id="correo" name="correo" type="email" autoComplete="email" required />
        </Campo>
        <Campo etiqueta="Mensualidad" htmlFor="mensualidad" requerido>
          <EntradaImporte id="mensualidad" name="mensualidad" required />
        </Campo>
        <Campo etiqueta="Día de corte" htmlFor="dia_corte" requerido>
          <Entrada
            id="dia_corte"
            name="dia_corte"
            type="number"
            min="1"
            max="28"
            defaultValue="1"
            required
          />
        </Campo>
        <Boton type="submit" ancho="completo" disabled={procesando}>
          <Building2 className="size-4" />
          {procesando ? 'Creando barbería…' : 'Crear barbería y acceso'}
        </Boton>
      </form>

      {resultado && !resultado.ok ? (
        <p
          role="alert"
          className="border border-peligro/40 bg-peligro-suave px-4 py-3 text-sm text-peligro"
        >
          {resultado.mensaje}
        </p>
      ) : null}

      {resultado?.ok ? (
        <div className="border border-exito/40 bg-exito-suave p-4">
          <div className="flex items-start gap-3">
            <Link2 className="mt-0.5 size-5 shrink-0 text-exito" />
            <div>
              <p className="font-medium text-exito">{resultado.datos.barberia} fue creada</p>
              <p className="mt-1 text-xs text-[var(--texto-suave)]">
                Comparte este enlace solamente con {resultado.datos.nombre}. Podrá establecer su
                contraseña y entrar como propietario.
              </p>
            </div>
          </div>
          <Entrada className="mt-4" value={resultado.datos.enlace} readOnly />
          <div className="mt-3 flex flex-wrap gap-2">
            <Boton
              type="button"
              variante="contorno"
              onClick={() => copiar(resultado.datos.enlace)}
            >
              {copiado ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copiado ? 'Enlace copiado' : 'Copiar enlace'}
            </Boton>
            <Boton comoHijo variante="contorno">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  `Hola ${resultado.datos.nombre}, este es tu acceso privado como propietario de ${resultado.datos.barberia}: ${resultado.datos.enlace}`
                )}`}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle className="size-4" /> Enviar por WhatsApp
              </a>
            </Boton>
          </div>
        </div>
      ) : null}
    </div>
  );
}
