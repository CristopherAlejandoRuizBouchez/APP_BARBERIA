import { describe, it, expect } from 'vitest';
import {
  ROLES,
  PERMISOS,
  PERMISOS_POR_ROL,
  puede,
  puedeVerSucursal,
  accesoDuranteSuspension,
  rutaPermitidaEnSuspension,
  topeDescuento,
  esPermisoDeEscritura,
  type ContextoSesion,
  type Rol,
} from './roles';

const ORG_A = '11111111-1111-1111-1111-111111111111';
const SUC_1 = 'aaaaaaaa-1111-1111-1111-111111111111';
const SUC_2 = 'aaaaaaaa-2222-2222-2222-222222222222';

function ctx(rol: Rol | null, extra: Partial<ContextoSesion> = {}): ContextoSesion {
  return {
    usuarioId: 'u1',
    esSuperadmin: rol === 'platform_superadmin',
    organizationId: ORG_A,
    rol,
    sucursales: [],
    organizacionOperativa: true,
    ...extra,
  };
}

describe('matriz de permisos', () => {
  it('cada rol declara permisos que existen', () => {
    for (const rol of ROLES) {
      for (const p of PERMISOS_POR_ROL[rol]) {
        expect(PERMISOS.includes(p), `${rol} declara "${p}"`).toBe(true);
      }
    }
  });

  it('el superadministrador solo tiene permisos de plataforma', () => {
    expect(PERMISOS_POR_ROL.platform_superadmin).toEqual([
      'plataforma.organizaciones',
      'plataforma.cobros',
      'plataforma.suspender',
      'plataforma.planes',
    ]);
    expect(puede(ctx('platform_superadmin'), 'plataforma.cobros')).toBe(true);
    expect(puede(ctx('platform_superadmin'), 'reportes.utilidad')).toBe(false);
    expect(puede(ctx('platform_superadmin'), 'clientes.ver')).toBe(false);
    expect(puede(ctx('platform_superadmin'), 'agenda.ver_todas')).toBe(false);
  });

  it('solo el propietario supera los permisos operativos de recepción', () => {
    const n = (r: Rol) => PERMISOS_POR_ROL[r].length;
    expect(n('barber')).toBeLessThan(n('receptionist'));
    expect(n('location_manager')).toBe(n('receptionist'));
    expect(n('organization_admin')).toBe(n('receptionist'));
    expect(n('organization_admin')).toBeLessThan(n('organization_owner'));
  });
});

describe('el barbero está acotado a lo suyo', () => {
  const b = ctx('barber');

  it('solo ve su agenda, nunca la de todos', () => {
    expect(puede(b, 'agenda.ver_propias')).toBe(true);
    expect(puede(b, 'agenda.ver_todas')).toBe(false);
  });

  it('solo ve sus comisiones', () => {
    expect(puede(b, 'comisiones.ver_propias')).toBe(true);
    expect(puede(b, 'comisiones.ver_todas')).toBe(false);
  });

  it('no ve costos, gastos ni utilidad', () => {
    expect(puede(b, 'inventario.ver_costos')).toBe(false);
    expect(puede(b, 'gastos.gestionar')).toBe(false);
    expect(puede(b, 'reportes.utilidad')).toBe(false);
  });

  it('no puede ajustar inventario ni cancelar ventas', () => {
    expect(puede(b, 'inventario.ajustar')).toBe(false);
    expect(puede(b, 'venta.cancelar')).toBe(false);
  });
});

describe('separación entre encargado y administración', () => {
  it('solo el propietario ve la utilidad', () => {
    expect(puede(ctx('location_manager'), 'reportes.utilidad')).toBe(false);
    expect(puede(ctx('organization_admin'), 'reportes.utilidad')).toBe(false);
    expect(puede(ctx('organization_owner'), 'reportes.utilidad')).toBe(true);
  });

  it('solo el propietario marca comisiones como pagadas', () => {
    expect(puede(ctx('organization_admin'), 'comisiones.pagar')).toBe(false);
    expect(puede(ctx('organization_owner'), 'comisiones.pagar')).toBe(true);
  });

  it('solo el propietario edita la configuración', () => {
    expect(puede(ctx('location_manager'), 'configuracion.editar')).toBe(false);
    expect(puede(ctx('organization_owner'), 'configuracion.editar')).toBe(true);
  });
});

describe('recepción solo opera el turno', () => {
  const recepcion = ctx('receptionist');

  it('confirma citas, cobra y controla la caja', () => {
    expect(puede(recepcion, 'agenda.mover')).toBe(true);
    expect(puede(recepcion, 'pos.cobrar')).toBe(true);
    expect(puede(recepcion, 'caja.abrir')).toBe(true);
    expect(puede(recepcion, 'caja.cerrar')).toBe(true);
  });

  it('no modifica el negocio ni consulta finanzas privadas', () => {
    expect(puede(recepcion, 'catalogo.editar')).toBe(false);
    expect(puede(recepcion, 'inventario.ajustar')).toBe(false);
    expect(puede(recepcion, 'gastos.gestionar')).toBe(false);
    expect(puede(recepcion, 'reportes.ver')).toBe(false);
    expect(puede(recepcion, 'usuarios.gestionar')).toBe(false);
  });
});

describe('permisos exclusivos de la plataforma', () => {
  it('ningún rol de organización puede suspender una barbería', () => {
    for (const rol of ROLES.filter((r) => r !== 'platform_superadmin')) {
      expect(puede(ctx(rol), 'plataforma.suspender'), rol).toBe(false);
      expect(puede(ctx(rol), 'plataforma.cobros'), rol).toBe(false);
    }
  });

  it('el superadministrador sí puede', () => {
    expect(puede(ctx('platform_superadmin'), 'plataforma.suspender')).toBe(true);
  });
});

describe('aislamiento por sucursal', () => {
  it('sin restricción declarada, ve todas las de su organización', () => {
    expect(puedeVerSucursal(ctx('location_manager'), SUC_1)).toBe(true);
    expect(puedeVerSucursal(ctx('location_manager'), SUC_2)).toBe(true);
  });

  it('con restricción, solo ve las suyas', () => {
    const c = ctx('location_manager', { sucursales: [SUC_1] });
    expect(puedeVerSucursal(c, SUC_1)).toBe(true);
    expect(puedeVerSucursal(c, SUC_2)).toBe(false);
  });

  it('el superadministrador no ve sucursales sin una membresía', () => {
    expect(puedeVerSucursal(ctx('platform_superadmin'), SUC_2)).toBe(false);
  });

  it('sin rol no ve ninguna', () => {
    expect(puedeVerSucursal(ctx(null), SUC_1)).toBe(false);
  });
});

describe('organización suspendida', () => {
  const suspendida = { organizacionOperativa: false };

  it('el propietario entra SOLO a la pantalla de pago', () => {
    expect(accesoDuranteSuspension(ctx('organization_owner', suspendida))).toBe('solo_pago');
  });

  it('el administrador también, para poder subir el comprobante', () => {
    expect(accesoDuranteSuspension(ctx('organization_admin', suspendida))).toBe('solo_pago');
  });

  it('el resto del personal queda bloqueado', () => {
    expect(accesoDuranteSuspension(ctx('location_manager', suspendida))).toBe('bloqueado');
    expect(accesoDuranteSuspension(ctx('receptionist', suspendida))).toBe('bloqueado');
    expect(accesoDuranteSuspension(ctx('barber', suspendida))).toBe('bloqueado');
  });

  it('el superadministrador no entra al panel de una organización suspendida', () => {
    expect(accesoDuranteSuspension(ctx('platform_superadmin', suspendida))).toBe('bloqueado');
  });

  it('el superadministrador conserva su centro de control de plataforma', () => {
    expect(
      accesoDuranteSuspension(
        ctx('platform_superadmin', {
          organizationId: null,
          organizacionOperativa: true,
        })
      )
    ).toBe('completo');
  });

  it('nadie puede crear citas, ventas ni pedidos', () => {
    for (const rol of ROLES.filter((r) => r !== 'platform_superadmin')) {
      const c = ctx(rol, suspendida);
      expect(puede(c, 'agenda.crear'), rol).toBe(false);
      expect(puede(c, 'pos.cobrar'), rol).toBe(false);
      expect(puede(c, 'inventario.ajustar'), rol).toBe(false);
    }
  });

  it('la lectura se conserva: los datos no se pierden ni se ocultan', () => {
    const c = ctx('organization_owner', suspendida);
    expect(puede(c, 'agenda.ver_todas')).toBe(true);
    expect(puede(c, 'reportes.ver')).toBe(true);
  });

  it('solo las rutas del plan son navegables', () => {
    expect(rutaPermitidaEnSuspension('/plan')).toBe(true);
    expect(rutaPermitidaEnSuspension('/plan/pagar')).toBe(true);
    expect(rutaPermitidaEnSuspension('/plan/comprobante')).toBe(true);
    expect(rutaPermitidaEnSuspension('/pos')).toBe(false);
    expect(rutaPermitidaEnSuspension('/agenda')).toBe(false);
    expect(rutaPermitidaEnSuspension('/reportes')).toBe(false);
  });
});

describe('clasificación lectura / escritura', () => {
  it('ver es lectura; crear, mover y cobrar son escritura', () => {
    expect(esPermisoDeEscritura('agenda.ver_todas')).toBe(false);
    expect(esPermisoDeEscritura('reportes.utilidad')).toBe(false);
    expect(esPermisoDeEscritura('agenda.crear')).toBe(true);
    expect(esPermisoDeEscritura('pos.cobrar')).toBe(true);
  });
});

describe('tope de descuento en el punto de venta', () => {
  it('el barbero no puede aplicar descuentos', () => {
    expect(topeDescuento(ctx('barber'), 15)).toBe(0);
  });

  it('la recepción tampoco', () => {
    expect(topeDescuento(ctx('receptionist'), 15)).toBe(0);
  });

  it('los roles heredados tampoco aplican descuentos', () => {
    expect(topeDescuento(ctx('location_manager'), 15)).toBe(0);
    expect(topeDescuento(ctx('organization_admin'), 25)).toBe(0);
  });

  it('solo el propietario no tiene tope', () => {
    expect(topeDescuento(ctx('organization_owner'), 15)).toBe(100);
  });
});

describe('sesión sin rol', () => {
  it('no puede absolutamente nada', () => {
    const anonimo = ctx(null);
    for (const p of PERMISOS) {
      expect(puede(anonimo, p), p).toBe(false);
    }
  });
});
