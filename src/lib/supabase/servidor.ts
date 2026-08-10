import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { clavePublicaSupabase, env } from '@/lib/env';

/**
 * Cliente para Server Components, Server Actions y Route Handlers.
 *
 * Lee la sesión de cookies httpOnly. Sujeto a RLS: es el que se usa el 95 %
 * del tiempo. En Next 16 `cookies()` es asíncrono, de ahí el await.
 */
export async function crearClienteServidor() {
  const clavePublica = clavePublicaSupabase();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !clavePublica) {
    throw new Error(
      'Supabase no está configurado. Define NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.'
    );
  }

  const almacen = await cookies();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, clavePublica, {
    cookies: {
      getAll() {
        return almacen.getAll();
      },
      setAll(porEscribir) {
        try {
          for (const { name, value, options } of porEscribir) {
            almacen.set(name, value, options);
          }
        } catch {
          // Un Server Component no puede escribir cookies. El refresco de
          // sesión lo hace `proxy.ts`, así que aquí se puede ignorar.
        }
      },
    },
  });
}

/** Cliente anónimo sin cookies, para el sitio público cacheable. */
export function crearClientePublico() {
  const clavePublica = clavePublicaSupabase();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !clavePublica) {
    throw new Error('Supabase no está configurado.');
  }
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, clavePublica, {
    cookies: { getAll: () => [], setAll: () => undefined },
  });
}
