'use client';

import { useEffect } from 'react';
import { Boton } from '@/components/ui/boton';

/**
 * Frontera de error de la aplicación.
 *
 * Nunca se muestra el stack ni el mensaje crudo: podría revelar nombres de
 * tablas o rutas internas. Se enseña el `digest`, que es lo que permite
 * localizar el error en los registros del servidor.
 */
export default function ErrorGlobal({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Fase 10: aquí se reporta a Sentry.
    console.error('[barberia-os]', error.digest ?? error.message);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-carbon px-6 text-center text-marfil">
      <p className="etiqueta text-borgona-claro">Algo salió mal</p>
      <h1 className="mt-5 font-display text-4xl leading-none">No pudimos cargar esta página</h1>
      <p className="mt-4 max-w-sm text-marfil/55">
        Ya quedó registrado. Vuelve a intentarlo; si sigue ocurriendo, escríbenos por WhatsApp.
      </p>
      {error.digest ? (
        <p className="mt-5 font-mono text-xs text-marfil/35">Referencia: {error.digest}</p>
      ) : null}
      <Boton variante="primario" className="mt-9" onClick={reset}>
        Reintentar
      </Boton>
    </div>
  );
}
