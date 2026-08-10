/**
 * Roles y permisos de la plataforma.
 *
 * IMPORTANTE: este archivo describe lo que la INTERFAZ debe mostrar. La
 * barrera real son las políticas de RLS de `supabase/migrations/0009_rls.sql`.
 * Si un barbero escribe la URL de gastos a mano, la base le devuelve vacío
 * aunque el menú nunca se lo hubiera enseñado.
 *
 * Los dos deben coincidir. Las pruebas de `roles.test.ts` comprueban que la
 * matriz de aquí no conceda nada que RLS no conceda.
 */

export const ROLES = [
  'platform_superadmin',
  'organization_owner',
  'organization_admin',
  'location_manager',
  'receptionist',
  'barber',
] as const;

export type Rol = (typeof ROLES)[number];

/** Roles que existen DENTRO de una organización (el superadmin es de plataforma). */
export const ROLES_ORGANIZACION = ROLES.filter(
  (r) => r !== 'platform_superadmin'
) as readonly Exclude<Rol, 'platform_superadmin'>[];

export type RolOrganizacion = (typeof ROLES_ORGANIZACION)[number];

export const ETIQUETA_ROL: Record<Rol, string> = {
  platform_superadmin: 'Superadministrador de la plataforma',
  organization_owner: 'Propietario',
  organization_admin: 'Administrador',
  location_manager: 'Encargado de sucursal',
  receptionist: 'Recepción',
  barber: 'Barbero',
};

/**
 * Permisos por módulo. El nombre describe la capacidad, no la pantalla:
 * varias pantallas pueden compartir permiso y un permiso puede gobernar
 * acciones en distintos lugares.
 */
export const PERMISOS = [
  // Agenda
  'agenda.ver_todas',
  'agenda.ver_propias',
  'agenda.crear',
  'agenda.mover',
  'agenda.cancelar',
  // Punto de venta
  'pos.cobrar',
  'pos.descuento',
  'pos.descuento_ilimitado',
  'venta.cancelar',
  'venta.devolver',
  // Caja
  'caja.abrir',
  'caja.cerrar',
  // Catálogo
  'catalogo.ver',
  'catalogo.editar',
  'catalogo.editar_precios',
  // Inventario
  'inventario.ver',
  'inventario.ver_costos',
  'inventario.ajustar',
  'inventario.traspasar',
  'compras.gestionar',
  // Clientes
  'clientes.ver',
  'clientes.ver_propios',
  'clientes.editar',
  // Finanzas
  'gastos.gestionar',
  'comisiones.ver_todas',
  'comisiones.ver_propias',
  'comisiones.pagar',
  // Reportes
  'reportes.ver',
  'reportes.utilidad',
  // Organización
  'sucursales.gestionar',
  'barberos.gestionar',
  'usuarios.gestionar',
  'apariencia.editar',
  'configuracion.editar',
  'auditoria.ver',
  // Plataforma (solo superadministrador)
  'plataforma.organizaciones',
  'plataforma.cobros',
  'plataforma.suspender',
  'plataforma.planes',
] as const;

export type Permiso = (typeof PERMISOS)[number];

const PERMISOS_BARBER: readonly Permiso[] = [
  'agenda.ver_propias',
  'clientes.ver_propios',
  'comisiones.ver_propias',
  'catalogo.ver',
];

const PERMISOS_RECEPTIONIST: readonly Permiso[] = [
  ...PERMISOS_BARBER.filter((p) => p !== 'agenda.ver_propias' && p !== 'clientes.ver_propios'),
  'agenda.ver_todas',
  'agenda.crear',
  'agenda.mover',
  'agenda.cancelar',
  'pos.cobrar',
  'clientes.ver',
  'clientes.editar',
  'inventario.ver',
  'caja.abrir',
  'caja.cerrar',
];

// Roles heredados: en el producto de una sola ubicación se reducen al mismo
// alcance que recepción. La migración 0015 convierte sus membresías activas.
const PERMISOS_LOCATION_MANAGER: readonly Permiso[] = [...PERMISOS_RECEPTIONIST];
const PERMISOS_ORGANIZATION_ADMIN: readonly Permiso[] = [...PERMISOS_RECEPTIONIST];

const PERMISOS_ORGANIZATION_OWNER: readonly Permiso[] = [
  ...PERMISOS_RECEPTIONIST,
  'pos.descuento',
  'pos.descuento_ilimitado',
  'venta.cancelar',
  'venta.devolver',
  'catalogo.editar',
  'catalogo.editar_precios',
  'inventario.ver_costos',
  'inventario.ajustar',
  'inventario.traspasar',
  'compras.gestionar',
  'gastos.gestionar',
  'comisiones.ver_todas',
  'comisiones.pagar',
  'reportes.ver',
  'reportes.utilidad',
  'sucursales.gestionar',
  'barberos.gestionar',
  'usuarios.gestionar',
  'apariencia.editar',
  'auditoria.ver',
  'configuracion.editar',
];

// El superadministrador administra la plataforma, no la operación privada de
// las barberías. Si además pertenece a una organización, sus permisos dentro
// de ella se derivan de esa membresía (owner, admin, etc.), nunca de este rol.
const PERMISOS_SUPERADMIN: readonly Permiso[] = [
  'plataforma.organizaciones',
  'plataforma.cobros',
  'plataforma.suspender',
  'plataforma.planes',
];

export const PERMISOS_POR_ROL: Record<Rol, readonly Permiso[]> = {
  platform_superadmin: PERMISOS_SUPERADMIN,
  organization_owner: PERMISOS_ORGANIZATION_OWNER,
  organization_admin: PERMISOS_ORGANIZATION_ADMIN,
  location_manager: PERMISOS_LOCATION_MANAGER,
  receptionist: PERMISOS_RECEPTIONIST,
  barber: PERMISOS_BARBER,
};

/** Contexto de la sesión resuelto EN EL SERVIDOR, nunca desde el navegador. */
export type ContextoSesion = {
  usuarioId: string;
  esSuperadmin: boolean;
  organizationId: string | null;
  rol: Rol | null;
  /** Vacío = todas las sucursales de la organización. */
  sucursales: readonly string[];
  /** La organización está suspendida o dada de baja. */
  organizacionOperativa: boolean;
};

/**
 * ¿La sesión tiene este permiso?
 *
 * Una organización NO operativa (suspendida) pierde todos los permisos de
 * escritura. Los de lectura se conservan para que el propietario pueda
 * consultar su adeudo y subir un comprobante.
 */
export function puede(ctx: ContextoSesion, permiso: Permiso): boolean {
  if (!ctx.rol) return false;

  const concedidos = PERMISOS_POR_ROL[ctx.rol];
  if (!concedidos.includes(permiso)) return false;

  if (!ctx.organizacionOperativa && esPermisoDeEscritura(permiso)) return false;

  return true;
}

/** Permisos que implican modificar datos operativos. */
export function esPermisoDeEscritura(permiso: Permiso): boolean {
  const soloLectura: readonly Permiso[] = [
    'agenda.ver_todas',
    'agenda.ver_propias',
    'catalogo.ver',
    'inventario.ver',
    'inventario.ver_costos',
    'clientes.ver',
    'clientes.ver_propios',
    'comisiones.ver_todas',
    'comisiones.ver_propias',
    'reportes.ver',
    'reportes.utilidad',
    'auditoria.ver',
  ];
  return !soloLectura.includes(permiso);
}

/** ¿Puede tocar esta sucursal? Arreglo vacío significa todas. */
export function puedeVerSucursal(ctx: ContextoSesion, locationId: string): boolean {
  if (!ctx.rol) return false;
  if (ctx.rol === 'platform_superadmin') return false;
  if (ctx.sucursales.length === 0) return true;
  return ctx.sucursales.includes(locationId);
}

/**
 * Qué puede hacer una barbería suspendida.
 *
 * El propietario entra SOLO a la pantalla de pago: ver su adeudo, las
 * instrucciones de transferencia, el contacto de soporte y subir un
 * comprobante. Los demás empleados no entran al panel.
 */
export function accesoDuranteSuspension(
  ctx: ContextoSesion
): 'completo' | 'solo_pago' | 'bloqueado' {
  if (ctx.rol === 'platform_superadmin' && ctx.organizationId === null) return 'completo';
  if (ctx.organizacionOperativa) return 'completo';
  if (ctx.rol === 'organization_owner' || ctx.rol === 'organization_admin') return 'solo_pago';
  return 'bloqueado';
}

/** Rutas del panel accesibles con la organización suspendida. */
export const RUTAS_PERMITIDAS_SUSPENDIDA = ['/plan', '/plan/pagar', '/plan/comprobante'] as const;

export function rutaPermitidaEnSuspension(rutaRelativa: string): boolean {
  return RUTAS_PERMITIDAS_SUSPENDIDA.some(
    (r) => rutaRelativa === r || rutaRelativa.startsWith(`${r}/`)
  );
}

/** Tope de descuento en el punto de venta, en porcentaje. */
export function topeDescuento(ctx: ContextoSesion, topeConfigurado: number): number {
  if (puede(ctx, 'pos.descuento_ilimitado')) return 100;
  if (puede(ctx, 'pos.descuento')) return topeConfigurado;
  return 0;
}
