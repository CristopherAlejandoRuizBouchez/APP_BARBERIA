import { describe, it, expect } from 'vitest';
import {
  limpiar,
  leerBooleano,
  construirConfiguracionCliente,
  construirConfiguracionServidor,
  ErrorConfiguracion,
  type EntornoCrudo,
} from './env-parseo';

/** Lo mínimo obligatorio de la plataforma. */
const BASE: EntornoCrudo = {
  NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
};

describe('limpiar: cadenas vacías se convierten en undefined', () => {
  it('trata el vacío y los espacios como ausencia', () => {
    expect(limpiar('')).toBeUndefined();
    expect(limpiar('   ')).toBeUndefined();
    expect(limpiar('\t\n ')).toBeUndefined();
    expect(limpiar(undefined)).toBeUndefined();
  });

  it('conserva el contenido y recorta los bordes', () => {
    expect(limpiar('valor')).toBe('valor');
    expect(limpiar('  valor  ')).toBe('valor');
  });
});

describe('leerBooleano: el error que z.coerce.boolean() habría dejado pasar', () => {
  it('"false" es false — y esto es exactamente lo que se estaba rompiendo', () => {
    const problemas: string[] = [];
    expect(Boolean('false')).toBe(true); // el problema en JavaScript
    expect(leerBooleano('FLAG', 'false', true, problemas)).toBe(false); // aquí no
    expect(problemas).toEqual([]);
  });

  it('"true" es true', () => {
    const problemas: string[] = [];
    expect(leerBooleano('FLAG', 'true', false, problemas)).toBe(true);
    expect(problemas).toEqual([]);
  });

  it('ausente o vacío toma el valor predeterminado', () => {
    const problemas: string[] = [];
    expect(leerBooleano('FLAG', undefined, true, problemas)).toBe(true);
    expect(leerBooleano('FLAG', '', true, problemas)).toBe(true);
    expect(leerBooleano('FLAG', '   ', false, problemas)).toBe(false);
    expect(problemas).toEqual([]);
  });

  it('recorta los espacios alrededor del literal', () => {
    const problemas: string[] = [];
    expect(leerBooleano('FLAG', '  false  ', true, problemas)).toBe(false);
    expect(problemas).toEqual([]);
  });

  it('cualquier otro texto es un error de configuración', () => {
    for (const basura of ['1', '0', 'sí', 'no', 'yes', 'TRUE', 'False', 'on', 'off']) {
      const problemas: string[] = [];
      leerBooleano('FLAG', basura, false, problemas);
      expect(problemas.length, `"${basura}" debería fallar`).toBe(1);
      expect(problemas[0]).toContain('debe ser exactamente');
    }
  });
});

describe('banderas de plataforma apagadas con "false"', () => {
  const conFalse = {
    ...BASE,
    NEXT_PUBLIC_FLAG_WHATSAPP_CLOUD: 'false',
    NEXT_PUBLIC_FLAG_ONLINE_CUSTOMER_PAYMENTS: 'false',
    NEXT_PUBLIC_FLAG_CUSTOM_DOMAINS: 'false',
    NEXT_PUBLIC_FLAG_PUBLIC_SIGNUP: 'false',
    NEXT_PUBLIC_FLAG_MAINTENANCE: 'false',
  };

  it('WhatsApp Cloud permanece desactivado', () => {
    expect(construirConfiguracionCliente(conFalse).banderas.whatsappCloud).toBe(false);
  });

  it('los pagos en línea de clientes permanecen desactivados', () => {
    expect(construirConfiguracionCliente(conFalse).banderas.pagosOnlineClientes).toBe(false);
  });

  it('los dominios personalizados permanecen desactivados', () => {
    expect(construirConfiguracionCliente(conFalse).banderas.dominiosPersonalizados).toBe(false);
  });

  it('el registro público de barberías permanece desactivado', () => {
    expect(construirConfiguracionCliente(conFalse).banderas.registroPublicoBarberias).toBe(false);
  });

  it('el modo mantenimiento permanece desactivado', () => {
    expect(construirConfiguracionCliente(conFalse).banderas.modoMantenimiento).toBe(false);
  });
});

describe('banderas encendidas con "true"', () => {
  it('activa las que vienen apagadas de fábrica', () => {
    const c = construirConfiguracionCliente({
      ...BASE,
      NEXT_PUBLIC_FLAG_WHATSAPP_CLOUD: 'true',
      NEXT_PUBLIC_FLAG_CUSTOM_DOMAINS: 'true',
    });
    expect(c.banderas.whatsappCloud).toBe(true);
    expect(c.banderas.dominiosPersonalizados).toBe(true);
  });

  it('todo lo opcional viene apagado por defecto', () => {
    expect(construirConfiguracionCliente(BASE).banderas).toEqual({
      whatsappCloud: false,
      pagosOnlineClientes: false,
      dominiosPersonalizados: false,
      registroPublicoBarberias: false,
      modoMantenimiento: false,
    });
  });
});

describe('el proyecto arranca con todas las opcionales vacías', () => {
  /** Copia literal de .env.example: obligatorias puestas, opcionales en "". */
  const COMO_ENV_EXAMPLE: EntornoCrudo = {
    ...BASE,
    NEXT_PUBLIC_PLATFORM_NAME: 'Barbería OS',
    NEXT_PUBLIC_BASE_DOMAIN: 'localhost',
    NEXT_PUBLIC_LOCALE: 'es-MX',
    NEXT_PUBLIC_MONEDA: 'MXN',
    NEXT_PUBLIC_ZONA_HORARIA_POR_DEFECTO: 'America/Mexico_City',

    NEXT_PUBLIC_SUPABASE_URL: '',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: '',
    SUPABASE_SERVICE_ROLE_KEY: '',
    SUPABASE_DATABASE_URL: '',
    SUPABASE_PROJECT_ID: '',

    PLATFORM_SUPERADMIN_EMAIL: '',
    PLATFORM_SUPPORT_WHATSAPP: '',
    CRON_SECRET: '',
    EDGE_SHARED_SECRET: '',

    WHATSAPP_CLOUD_API_TOKEN: '',
    WHATSAPP_PHONE_NUMBER_ID: '',
    WHATSAPP_BUSINESS_ACCOUNT_ID: '',
    WHATSAPP_WEBHOOK_VERIFY_TOKEN: '',
    WHATSAPP_APP_SECRET: '',

    NEXT_PUBLIC_SENTRY_DSN: '',
    SENTRY_AUTH_TOKEN: '',
    UPSTASH_REDIS_REST_URL: '',
    UPSTASH_REDIS_REST_TOKEN: '',
  };

  it('no lanza al validar la parte pública', () => {
    expect(() => construirConfiguracionCliente(COMO_ENV_EXAMPLE)).not.toThrow();
  });

  it('no lanza al validar la parte de servidor', () => {
    expect(() => construirConfiguracionServidor(COMO_ENV_EXAMPLE)).not.toThrow();
  });

  it('las opcionales vacías quedan como undefined, no como cadena vacía', () => {
    const cliente = construirConfiguracionCliente(COMO_ENV_EXAMPLE);
    const servidor = construirConfiguracionServidor(COMO_ENV_EXAMPLE);

    expect(cliente.NEXT_PUBLIC_SUPABASE_URL).toBeUndefined();
    expect(cliente.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBeUndefined();
    expect(cliente.NEXT_PUBLIC_SENTRY_DSN).toBeUndefined();

    expect(servidor.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
    expect(servidor.SUPABASE_DATABASE_URL).toBeUndefined();
    expect(servidor.PLATFORM_SUPERADMIN_EMAIL).toBeUndefined();
    expect(servidor.PLATFORM_SUPPORT_WHATSAPP).toBeUndefined();
    expect(servidor.CRON_SECRET).toBeUndefined();
    expect(servidor.EDGE_SHARED_SECRET).toBeUndefined();
    expect(servidor.WHATSAPP_CLOUD_API_TOKEN).toBeUndefined();
    expect(servidor.UPSTASH_REDIS_REST_URL).toBeUndefined();
  });

  it('los valores con defecto se rellenan solos', () => {
    const c = construirConfiguracionCliente(BASE);
    expect(c.NEXT_PUBLIC_PLATFORM_NAME).toBe('Barbería OS');
    expect(c.NEXT_PUBLIC_LOCALE).toBe('es-MX');
    expect(c.NEXT_PUBLIC_MONEDA).toBe('MXN');
    expect(c.NEXT_PUBLIC_ZONA_HORARIA_POR_DEFECTO).toBe('America/Mexico_City');
    expect(construirConfiguracionServidor({}).WHATSAPP_API_VERSION).toBe('v23.0');
  });
});

// ══════════════════════════════════════════════════════════════════════════
//  Lo que YA NO puede estar en el entorno
// ══════════════════════════════════════════════════════════════════════════
describe('la identidad de una barbería NO viene del entorno', () => {
  it('la configuración de plataforma no expone nombre, ciudad ni WhatsApp de negocio', () => {
    const c = construirConfiguracionCliente(BASE) as unknown as Record<string, unknown>;
    // Estas claves existían en la versión de una sola barbería.
    // Ahora viven en organizations / locations / organization_themes.
    expect(c.NEXT_PUBLIC_NOMBRE_NEGOCIO).toBeUndefined();
    expect(c.NEXT_PUBLIC_CIUDAD).toBeUndefined();
    expect(c.NEXT_PUBLIC_WHATSAPP_NUMERO).toBeUndefined();
  });

  it('la zona horaria del entorno es solo un valor por defecto para sucursales nuevas', () => {
    const c = construirConfiguracionCliente(BASE);
    expect(Object.keys(c)).toContain('NEXT_PUBLIC_ZONA_HORARIA_POR_DEFECTO');
    expect(Object.keys(c)).not.toContain('NEXT_PUBLIC_ZONA_HORARIA');
  });
});

describe('WhatsApp de soporte de la plataforma', () => {
  it('acepta el formato canónico 52 + 10 dígitos', () => {
    const s = construirConfiguracionServidor({ PLATFORM_SUPPORT_WHATSAPP: '525512345678' });
    expect(s.PLATFORM_SUPPORT_WHATSAPP).toBe('525512345678');
  });

  it('es opcional', () => {
    expect(construirConfiguracionServidor({}).PLATFORM_SUPPORT_WHATSAPP).toBeUndefined();
    expect(
      construirConfiguracionServidor({ PLATFORM_SUPPORT_WHATSAPP: '' }).PLATFORM_SUPPORT_WHATSAPP
    ).toBeUndefined();
  });

  it('rechaza el formato antiguo con 521 y dice cómo corregirlo', () => {
    try {
      construirConfiguracionServidor({ PLATFORM_SUPPORT_WHATSAPP: '5215512345678' });
      throw new Error('debería haber lanzado');
    } catch (e) {
      expect(e instanceof ErrorConfiguracion).toBe(true);
      expect((e as ErrorConfiguracion).problemas[0]).toContain('525512345678');
    }
  });

  it('rechaza el signo + y los separadores', () => {
    for (const malo of ['+525512345678', '52 55 1234 5678', '5512345678']) {
      expect(
        () => construirConfiguracionServidor({ PLATFORM_SUPPORT_WHATSAPP: malo }),
        malo
      ).toThrow(ErrorConfiguracion);
    }
  });
});

describe('errores de configuración', () => {
  it('falla si falta la URL de la aplicación', () => {
    expect(() => construirConfiguracionCliente({})).toThrow(ErrorConfiguracion);
  });

  it('reporta TODOS los problemas de una vez, no solo el primero', () => {
    try {
      construirConfiguracionCliente({
        NEXT_PUBLIC_APP_URL: 'no-es-una-url',
        NEXT_PUBLIC_FLAG_CUSTOM_DOMAINS: 'quizá',
        NEXT_PUBLIC_FLAG_WHATSAPP_CLOUD: '1',
      });
      throw new Error('debería haber lanzado');
    } catch (e) {
      const problemas = (e as ErrorConfiguracion).problemas;
      expect(problemas.length).toBeGreaterThan(2);
      const texto = problemas.join('\n');
      expect(texto).toContain('NEXT_PUBLIC_APP_URL');
      expect(texto).toContain('NEXT_PUBLIC_FLAG_CUSTOM_DOMAINS');
      expect(texto).toContain('NEXT_PUBLIC_FLAG_WHATSAPP_CLOUD');
    }
  });

  it('valida la URL opcional de Supabase solo si tiene contenido', () => {
    expect(() =>
      construirConfiguracionCliente({ ...BASE, NEXT_PUBLIC_SUPABASE_URL: '' })
    ).not.toThrow();
    expect(() =>
      construirConfiguracionCliente({ ...BASE, NEXT_PUBLIC_SUPABASE_URL: 'esto-no-es-url' })
    ).toThrow(ErrorConfiguracion);
    expect(() =>
      construirConfiguracionCliente({
        ...BASE,
        NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co',
      })
    ).not.toThrow();
  });
});
