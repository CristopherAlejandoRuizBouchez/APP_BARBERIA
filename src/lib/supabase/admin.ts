import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

/**
 * Cliente con la llave de servicio. IGNORA RLS POR COMPLETO.
 *
 * `import 'server-only'` en la primera línea hace que el build FALLE si algún
 * componente de cliente importa este archivo por error. Es la red que evita
 * publicar en el navegador una llave capaz de leer la base entera.
 *
 * Usos legítimos, y ninguno más:
 *   · alta del primer superadministrador y de usuarios del staff
 *   · aceptación de invitaciones (antes de que exista sesión)
 *   · webhooks y tareas programadas
 *   · el seed de demostración
 */
export function crearClienteAdmin() {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'Falta SUPABASE_SERVICE_ROLE_KEY. Esta llave es solo de servidor y nunca lleva el prefijo NEXT_PUBLIC_.'
    );
  }

  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
