import {
  construirConfiguracionCliente,
  construirConfiguracionServidor,
  type ConfiguracionCliente,
  type ConfiguracionServidor,
} from './env-parseo';

/**
 * Único punto del proyecto autorizado para leer `process.env`.
 *
 * ESLint bloquea `process.env` en cualquier otro archivo. Toda la lógica de
 * validación vive en `env-parseo.ts`, que no toca `process.env` y por tanto se
 * puede probar de verdad.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  Aquí solo hay configuración de PLATAFORMA.
 *
 *  Nombre, ciudad, WhatsApp, colores y plantilla de cada barbería se resuelven
 *  por petición desde Supabase (`src/lib/tenant/resolver.ts`). Una variable de
 *  entorno no puede tener dos valores a la vez, y este despliegue sirve a
 *  varias barberías distintas.
 * ══════════════════════════════════════════════════════════════════════════
 */

/**
 * Next.js sustituye `process.env.NEXT_PUBLIC_X` en compilación solo cuando se
 * escribe literalmente. Por eso el objeto se construye a mano.
 */
const crudoCliente = {
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_PLATFORM_NAME: process.env.NEXT_PUBLIC_PLATFORM_NAME,
  NEXT_PUBLIC_BASE_DOMAIN: process.env.NEXT_PUBLIC_BASE_DOMAIN,
  NEXT_PUBLIC_LOCALE: process.env.NEXT_PUBLIC_LOCALE,
  NEXT_PUBLIC_MONEDA: process.env.NEXT_PUBLIC_MONEDA,
  NEXT_PUBLIC_ZONA_HORARIA_POR_DEFECTO: process.env.NEXT_PUBLIC_ZONA_HORARIA_POR_DEFECTO,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  NEXT_PUBLIC_FLAG_WHATSAPP_CLOUD: process.env.NEXT_PUBLIC_FLAG_WHATSAPP_CLOUD,
  NEXT_PUBLIC_FLAG_ONLINE_CUSTOMER_PAYMENTS: process.env.NEXT_PUBLIC_FLAG_ONLINE_CUSTOMER_PAYMENTS,
  NEXT_PUBLIC_FLAG_CUSTOM_DOMAINS: process.env.NEXT_PUBLIC_FLAG_CUSTOM_DOMAINS,
  NEXT_PUBLIC_FLAG_PUBLIC_SIGNUP: process.env.NEXT_PUBLIC_FLAG_PUBLIC_SIGNUP,
  NEXT_PUBLIC_FLAG_MAINTENANCE: process.env.NEXT_PUBLIC_FLAG_MAINTENANCE,
};

const cliente: ConfiguracionCliente = construirConfiguracionCliente(crudoCliente);

/** Las variables de servidor solo se validan en el servidor. */
const servidor: ConfiguracionServidor =
  typeof window === 'undefined'
    ? construirConfiguracionServidor(process.env)
    : construirConfiguracionServidor({});

export const env = { ...cliente, ...servidor } as const;

export type Env = typeof env;

export const esProduccion = env.NODE_ENV === 'production';
export const esDesarrollo = env.NODE_ENV === 'development';

/** Acepta la clave publicable actual y mantiene compatibilidad con anon. */
export function clavePublicaSupabase(): string | undefined {
  return env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

/** Host del Storage, para validar que las imágenes del tema sean nuestras. */
export function hostsDeAlmacenamiento(): string[] {
  if (!env.NEXT_PUBLIC_SUPABASE_URL) return [];
  try {
    return [new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname];
  } catch {
    return [];
  }
}
