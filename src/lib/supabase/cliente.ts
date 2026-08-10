'use client';

import { createBrowserClient } from '@supabase/ssr';
import { clavePublicaSupabase, env } from '@/lib/env';

/**
 * Cliente para componentes marcados `'use client'`.
 *
 * Usa la llave anónima y está sujeto a RLS con la sesión del usuario. Nunca
 * puede leer datos de otra organización: las políticas de la base lo impiden
 * aunque el código pida lo que sea.
 */
export function crearClienteNavegador() {
  const clavePublica = clavePublicaSupabase();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !clavePublica) {
    throw new Error(
      'Supabase no está configurado. Define NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY en .env.local.'
    );
  }
  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, clavePublica);
}

/** ¿Hay credenciales de Supabase? Permite degradar con elegancia en la fase 0. */
export function supabaseConfigurado(): boolean {
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && clavePublicaSupabase());
}
