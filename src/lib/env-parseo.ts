/**
 * Parseo y validación de variables de entorno de la PLATAFORMA.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  Aquí solo vive lo que es común a toda la plataforma.
 *
 *  El nombre, la ciudad, el WhatsApp, los colores y la plantilla de una
 *  barbería NO son variables de entorno: viven en `organizations`,
 *  `locations` y `organization_themes`, y se resuelven por petición según el
 *  slug de la URL. Dos barberías en el mismo despliegue tienen identidades
 *  distintas, y eso es imposible de expresar con una variable global.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Este módulo NO lee `process.env`: recibe un objeto plano y devuelve la
 * configuración ya validada. Eso permite probarlo de verdad, con entradas
 * controladas, en lugar de confiar en que el entorno esté bien puesto.
 *
 * No usa Zod a propósito. Son quince variables con reglas simples, y una
 * validación a mano da tres ventajas: mensajes de error en español que dicen
 * exactamente qué arreglar, cero dependencias en el arranque, y pruebas que
 * corren sin instalar nada. Zod se sigue usando —y con razón— para formularios
 * y Server Actions a partir de la fase 2, donde las formas sí son complejas.
 */

export class ErrorConfiguracion extends Error {
  readonly problemas: string[];

  constructor(problemas: string[]) {
    super(
      `\n╭─ Variables de entorno inválidas\n` +
        problemas.map((p) => `│  · ${p}`).join('\n') +
        `\n╰─ Revisa tu .env.local contra .env.example\n`
    );
    this.name = 'ErrorConfiguracion';
    this.problemas = problemas;
  }
}

export type EntornoCrudo = Record<string, string | undefined>;

/**
 * Convierte cadenas vacías o de solo espacios en `undefined`.
 *
 * Es la diferencia entre que el proyecto arranque o no después de
 * `cp .env.example .env.local`: en esa copia TODAS las variables opcionales
 * quedan como `CLAVE=`, es decir, cadena vacía. Sin esta normalización,
 * `NEXT_PUBLIC_SUPABASE_URL=` se validaría como texto y fallaría por no ser
 * una URL, cuando lo que el usuario quiso decir es "todavía no la tengo".
 */
export function limpiar(valor: string | undefined): string | undefined {
  if (valor === undefined) return undefined;
  const recortado = valor.trim();
  return recortado === '' ? undefined : recortado;
}

/**
 * Lee una bandera booleana.
 *
 * NUNCA se usa `Boolean(cadena)` ni `z.coerce.boolean()`: en JavaScript
 * `Boolean('false')` es `true`, porque cualquier cadena no vacía es verdadera.
 * Eso significaría que poner `FLAG_MERCADO_PAGO=false` en producción
 * ENCENDERÍA la bandera. Aquí solo se aceptan los dos literales exactos.
 */
export function leerBooleano(
  clave: string,
  crudo: string | undefined,
  porDefecto: boolean,
  problemas: string[]
): boolean {
  const valor = limpiar(crudo);
  if (valor === undefined) return porDefecto;
  if (valor === 'true') return true;
  if (valor === 'false') return false;

  problemas.push(`${clave}: debe ser exactamente "true" o "false" (recibido: "${valor}")`);
  return porDefecto;
}

/** Texto obligatorio. */
function leerTexto(
  clave: string,
  crudo: string | undefined,
  problemas: string[],
  porDefecto?: string
): string {
  const valor = limpiar(crudo);
  if (valor !== undefined) return valor;
  if (porDefecto !== undefined) return porDefecto;
  problemas.push(`${clave}: es obligatoria y está vacía`);
  return '';
}

/** Texto opcional. Vacío o ausente → `undefined`. */
function leerOpcional(crudo: string | undefined): string | undefined {
  return limpiar(crudo);
}

/** URL absoluta obligatoria. */
function leerUrl(clave: string, crudo: string | undefined, problemas: string[]): string {
  const valor = limpiar(crudo);
  if (valor === undefined) {
    problemas.push(`${clave}: es obligatoria y está vacía`);
    return '';
  }
  try {
    const url = new URL(valor);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      problemas.push(`${clave}: debe empezar por http:// o https:// (recibido: "${valor}")`);
    }
  } catch {
    problemas.push(`${clave}: debe ser una URL absoluta (recibido: "${valor}")`);
  }
  return valor;
}

/** URL opcional. Si está vacía no se valida; si tiene contenido, sí. */
function leerUrlOpcional(
  clave: string,
  crudo: string | undefined,
  problemas: string[]
): string | undefined {
  const valor = limpiar(crudo);
  if (valor === undefined) return undefined;
  try {
    new URL(valor);
  } catch {
    problemas.push(`${clave}: debe ser una URL absoluta (recibido: "${valor}")`);
  }
  return valor;
}

/**
 * Número de WhatsApp de SOPORTE DE LA PLATAFORMA, en formato canónico:
 * `52` + 10 dígitos, sin el signo "+".
 *
 * Ojo: el WhatsApp de cada barbería NO está aquí. Vive en
 * `organizations.telefono_whatsapp` y en `locations.telefono_whatsapp`, porque
 * cada negocio tiene el suyo y varias barberías comparten este despliegue.
 *
 * El formato antiguo con `521` sigue siendo aceptado y normalizado cuando lo
 * escribe un cliente en el sitio —eso lo hace `src/lib/telefono.ts`—, pero la
 * configuración debe guardar el canónico.
 */
function leerWhatsAppOpcional(
  clave: string,
  crudo: string | undefined,
  problemas: string[]
): string | undefined {
  const valor = limpiar(crudo);
  if (valor === undefined) return undefined;

  if (/^521\d{10}$/.test(valor)) {
    problemas.push(
      `${clave}: usa el formato canónico sin el "1": "52${valor.slice(3)}" en lugar de "${valor}"`
    );
    return valor;
  }
  if (!/^52\d{10}$/.test(valor)) {
    problemas.push(
      `${clave}: debe ser "52" seguido de 10 dígitos, sin el signo "+" (recibido: "${valor}")`
    );
  }
  return valor;
}

function leerModo(
  crudo: string | undefined,
  problemas: string[]
): 'development' | 'test' | 'production' {
  const valor = limpiar(crudo) ?? 'development';
  if (valor === 'development' || valor === 'test' || valor === 'production') return valor;
  problemas.push(`NODE_ENV: valor no reconocido ("${valor}")`);
  return 'development';
}

export type ConfiguracionCliente = {
  NEXT_PUBLIC_APP_URL: string;
  NEXT_PUBLIC_PLATFORM_NAME: string;
  NEXT_PUBLIC_BASE_DOMAIN: string;
  NEXT_PUBLIC_LOCALE: string;
  NEXT_PUBLIC_MONEDA: string;
  NEXT_PUBLIC_ZONA_HORARIA_POR_DEFECTO: string;
  NEXT_PUBLIC_SUPABASE_URL: string | undefined;
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: string | undefined;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string | undefined;
  NEXT_PUBLIC_SENTRY_DSN: string | undefined;
  banderas: {
    whatsappCloud: boolean;
    pagosOnlineClientes: boolean;
    dominiosPersonalizados: boolean;
    registroPublicoBarberias: boolean;
    modoMantenimiento: boolean;
  };
};

export type ConfiguracionServidor = {
  NODE_ENV: 'development' | 'test' | 'production';
  SUPABASE_SERVICE_ROLE_KEY: string | undefined;
  SUPABASE_DATABASE_URL: string | undefined;
  SUPABASE_PROJECT_ID: string | undefined;
  PLATFORM_SUPERADMIN_EMAIL: string | undefined;
  PLATFORM_SUPPORT_WHATSAPP: string | undefined;
  CRON_SECRET: string | undefined;
  EDGE_SHARED_SECRET: string | undefined;
  WHATSAPP_CLOUD_API_TOKEN: string | undefined;
  WHATSAPP_PHONE_NUMBER_ID: string | undefined;
  WHATSAPP_BUSINESS_ACCOUNT_ID: string | undefined;
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: string | undefined;
  WHATSAPP_APP_SECRET: string | undefined;
  WHATSAPP_API_VERSION: string;
  SENTRY_AUTH_TOKEN: string | undefined;
  UPSTASH_REDIS_REST_URL: string | undefined;
  UPSTASH_REDIS_REST_TOKEN: string | undefined;
};

/** Valida la parte pública. Lanza `ErrorConfiguracion` con todos los problemas juntos. */
export function construirConfiguracionCliente(crudo: EntornoCrudo): ConfiguracionCliente {
  const problemas: string[] = [];

  const config: ConfiguracionCliente = {
    NEXT_PUBLIC_APP_URL: leerUrl('NEXT_PUBLIC_APP_URL', crudo.NEXT_PUBLIC_APP_URL, problemas),
    NEXT_PUBLIC_PLATFORM_NAME: leerTexto(
      'NEXT_PUBLIC_PLATFORM_NAME',
      crudo.NEXT_PUBLIC_PLATFORM_NAME,
      problemas,
      'Barbería OS'
    ),
    NEXT_PUBLIC_BASE_DOMAIN: leerTexto(
      'NEXT_PUBLIC_BASE_DOMAIN',
      crudo.NEXT_PUBLIC_BASE_DOMAIN,
      problemas,
      'localhost'
    ),
    NEXT_PUBLIC_LOCALE: leerTexto(
      'NEXT_PUBLIC_LOCALE',
      crudo.NEXT_PUBLIC_LOCALE,
      problemas,
      'es-MX'
    ),
    NEXT_PUBLIC_MONEDA: leerTexto('NEXT_PUBLIC_MONEDA', crudo.NEXT_PUBLIC_MONEDA, problemas, 'MXN'),
    // Solo un valor por defecto para sucursales nuevas: cada `locations` guarda
    // el suyo, porque Sonora y Quintana Roo no están en el centro.
    NEXT_PUBLIC_ZONA_HORARIA_POR_DEFECTO: leerTexto(
      'NEXT_PUBLIC_ZONA_HORARIA_POR_DEFECTO',
      crudo.NEXT_PUBLIC_ZONA_HORARIA_POR_DEFECTO,
      problemas,
      'America/Mexico_City'
    ),

    NEXT_PUBLIC_SUPABASE_URL: leerUrlOpcional(
      'NEXT_PUBLIC_SUPABASE_URL',
      crudo.NEXT_PUBLIC_SUPABASE_URL,
      problemas
    ),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: leerOpcional(crudo.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: leerOpcional(crudo.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    NEXT_PUBLIC_SENTRY_DSN: leerOpcional(crudo.NEXT_PUBLIC_SENTRY_DSN),

    banderas: {
      whatsappCloud: leerBooleano(
        'NEXT_PUBLIC_FLAG_WHATSAPP_CLOUD',
        crudo.NEXT_PUBLIC_FLAG_WHATSAPP_CLOUD,
        false,
        problemas
      ),
      pagosOnlineClientes: leerBooleano(
        'NEXT_PUBLIC_FLAG_ONLINE_CUSTOMER_PAYMENTS',
        crudo.NEXT_PUBLIC_FLAG_ONLINE_CUSTOMER_PAYMENTS,
        false,
        problemas
      ),
      dominiosPersonalizados: leerBooleano(
        'NEXT_PUBLIC_FLAG_CUSTOM_DOMAINS',
        crudo.NEXT_PUBLIC_FLAG_CUSTOM_DOMAINS,
        false,
        problemas
      ),
      registroPublicoBarberias: leerBooleano(
        'NEXT_PUBLIC_FLAG_PUBLIC_SIGNUP',
        crudo.NEXT_PUBLIC_FLAG_PUBLIC_SIGNUP,
        false,
        problemas
      ),
      modoMantenimiento: leerBooleano(
        'NEXT_PUBLIC_FLAG_MAINTENANCE',
        crudo.NEXT_PUBLIC_FLAG_MAINTENANCE,
        false,
        problemas
      ),
    },
  };

  if (problemas.length > 0) throw new ErrorConfiguracion(problemas);
  return config;
}

/** Valida la parte de servidor. Todo es opcional salvo el modo. */
export function construirConfiguracionServidor(crudo: EntornoCrudo): ConfiguracionServidor {
  const problemas: string[] = [];

  const config: ConfiguracionServidor = {
    NODE_ENV: leerModo(crudo.NODE_ENV, problemas),
    SUPABASE_SERVICE_ROLE_KEY: leerOpcional(crudo.SUPABASE_SERVICE_ROLE_KEY),
    SUPABASE_DATABASE_URL: leerOpcional(crudo.SUPABASE_DATABASE_URL),
    SUPABASE_PROJECT_ID: leerOpcional(crudo.SUPABASE_PROJECT_ID),
    PLATFORM_SUPERADMIN_EMAIL: leerOpcional(crudo.PLATFORM_SUPERADMIN_EMAIL),
    PLATFORM_SUPPORT_WHATSAPP: leerWhatsAppOpcional(
      'PLATFORM_SUPPORT_WHATSAPP',
      crudo.PLATFORM_SUPPORT_WHATSAPP,
      problemas
    ),
    CRON_SECRET: leerOpcional(crudo.CRON_SECRET),
    EDGE_SHARED_SECRET: leerOpcional(crudo.EDGE_SHARED_SECRET),
    WHATSAPP_CLOUD_API_TOKEN: leerOpcional(crudo.WHATSAPP_CLOUD_API_TOKEN),
    WHATSAPP_PHONE_NUMBER_ID: leerOpcional(crudo.WHATSAPP_PHONE_NUMBER_ID),
    WHATSAPP_BUSINESS_ACCOUNT_ID: leerOpcional(crudo.WHATSAPP_BUSINESS_ACCOUNT_ID),
    WHATSAPP_WEBHOOK_VERIFY_TOKEN: leerOpcional(crudo.WHATSAPP_WEBHOOK_VERIFY_TOKEN),
    WHATSAPP_APP_SECRET: leerOpcional(crudo.WHATSAPP_APP_SECRET),
    WHATSAPP_API_VERSION: leerTexto(
      'WHATSAPP_API_VERSION',
      crudo.WHATSAPP_API_VERSION,
      problemas,
      'v23.0'
    ),
    SENTRY_AUTH_TOKEN: leerOpcional(crudo.SENTRY_AUTH_TOKEN),
    UPSTASH_REDIS_REST_URL: leerOpcional(crudo.UPSTASH_REDIS_REST_URL),
    UPSTASH_REDIS_REST_TOKEN: leerOpcional(crudo.UPSTASH_REDIS_REST_TOKEN),
  };

  if (problemas.length > 0) throw new ErrorConfiguracion(problemas);
  return config;
}
