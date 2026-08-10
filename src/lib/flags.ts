import { env } from './env';

/**
 * Banderas de la PLATAFORMA.
 *
 * Cada barbería tiene además las suyas en `organization_feature_flags`, que se
 * consultan con `banderaDeOrganizacion()`. Una funcionalidad está activa solo
 * si lo está en los dos niveles: la plataforma pone el techo, la barbería
 * decide dentro de él.
 */

export const BANDERAS_PLATAFORMA = {
  whatsappCloud: 'whatsapp_cloud_api',
  pagosOnlineClientes: 'online_customer_payments',
  dominiosPersonalizados: 'custom_domains',
  registroPublicoBarberias: 'public_signup',
  modoMantenimiento: 'maintenance',
} as const;

export type BanderaPlataforma = keyof typeof BANDERAS_PLATAFORMA;

export function banderaPlataforma(nombre: BanderaPlataforma): boolean {
  return env.banderas[nombre];
}

export function todasLasBanderasPlataforma(): Record<BanderaPlataforma, boolean> {
  return { ...env.banderas };
}

/** Banderas que cada barbería puede encender dentro de su propio panel. */
export const BANDERAS_ORGANIZACION = [
  'tienda_online',
  'citas_express',
  'reservas_publicas',
  'recordatorios',
  'whatsapp_cloud_api',
  'mercado_pago',
] as const;

export type BanderaOrganizacion = (typeof BANDERAS_ORGANIZACION)[number];

/** Valores por defecto cuando la barbería no ha declarado la bandera. */
export const VALOR_POR_DEFECTO_ORG: Record<BanderaOrganizacion, boolean> = {
  tienda_online: true,
  citas_express: true,
  reservas_publicas: true,
  recordatorios: true,
  whatsapp_cloud_api: false,
  mercado_pago: false,
};

/**
 * Resuelve una bandera combinando los dos niveles.
 *
 * La plataforma pone el techo: si `whatsapp_cloud_api` está apagada a nivel
 * plataforma, ninguna barbería puede encenderla, por mucho que su fila diga
 * `true`. Al revés sí funciona: la plataforma la permite y cada barbería
 * decide.
 */
export function resolverBandera(
  clave: BanderaOrganizacion,
  valorOrganizacion: boolean | undefined
): boolean {
  const valor = valorOrganizacion ?? VALOR_POR_DEFECTO_ORG[clave];

  if (clave === 'whatsapp_cloud_api' && !banderaPlataforma('whatsappCloud')) return false;
  if (clave === 'mercado_pago' && !banderaPlataforma('pagosOnlineClientes')) return false;

  return valor;
}
