'use client';

import * as React from 'react';
import { Check, Copy, Link2, MessageCircle, UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Boton } from '@/components/ui/boton';
import { Campo, Entrada } from '@/components/ui/campo';
import type { Resultado } from '@/lib/errores';

type AccesoCreado = { enlace: string; nombre: string; correo: string };

export function FormularioAccesoRecepcion({
  action,
}: {
  action: (formData: FormData) => Promise<Resultado<AccesoCreado>>;
}) {
  const router = useRouter();
  const formulario = React.useRef<HTMLFormElement>(null);
  const [resultado, setResultado] = React.useState<Resultado<AccesoCreado> | null>(null);
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
      window.prompt('Copia el enlace privado:', enlace);
    }
  }

  return (
    <div className="space-y-5">
      <form ref={formulario} action={enviar} className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Nombre de la recepcionista" htmlFor="nombre_recepcion" requerido>
          <Entrada id="nombre_recepcion" name="nombre" required />
        </Campo>
        <Campo etiqueta="Correo" htmlFor="correo_recepcion" requerido>
          <Entrada id="correo_recepcion" name="correo" type="email" required />
        </Campo>
        <div className="sm:col-span-2">
          <Boton type="submit" disabled={procesando}>
            <UserPlus className="size-4" />
            {procesando ? 'Generando acceso…' : 'Generar acceso de recepción'}
          </Boton>
        </div>
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
        <div className="border border-exito/40 bg-exito-suave p-5">
          <div className="flex items-start gap-3">
            <Link2 className="mt-0.5 size-5 shrink-0 text-exito" />
            <div>
              <p className="font-medium text-exito">Acceso creado para {resultado.datos.nombre}</p>
              <p className="mt-1 text-xs text-[var(--texto-suave)]">
                Comparte este enlace solamente con la recepcionista. Al abrirlo podrá establecer su
                contraseña.
              </p>
            </div>
          </div>
          <Entrada className="mt-4" value={resultado.datos.enlace} readOnly />
          <div className="mt-3 flex flex-wrap gap-2">
            <Boton variante="contorno" onClick={() => copiar(resultado.datos.enlace)}>
              {copiado ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copiado ? 'Enlace copiado' : 'Copiar enlace'}
            </Boton>
            <Boton comoHijo variante="contorno">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  `Hola ${resultado.datos.nombre}, este es tu acceso privado a la barbería: ${resultado.datos.enlace}`
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
