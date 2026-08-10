import { describe, it, expect } from 'vitest';
import {
  estadoPago,
  diasDeRetraso,
  diasParaVencer,
  alertasDeCobro,
  estadoOrganizacionTrasElTiempo,
  transicionPermitida,
  validarCambioDeEstado,
  mensajePublicoSuspension,
  siguienteFechaPago,
  ESTADOS_ORGANIZACION,
  type CuentaCobro,
  type EstadoOrganizacion,
} from './facturacion';

const CUENTA: CuentaCobro = {
  mensualidadCentavos: 89900,
  proximaFechaPago: '2026-08-10',
  ultimoPagoEn: '2026-07-10',
  diasGracia: 5,
};

describe('estado de cobro', () => {
  it('al corriente cuando falta más de la ventana de aviso', () => {
    expect(estadoPago(CUENTA, '2026-08-01')).toBe('current');
  });

  it('vence pronto dentro de los 5 días previos', () => {
    expect(estadoPago(CUENTA, '2026-08-06')).toBe('due_soon');
    expect(estadoPago(CUENTA, '2026-08-10')).toBe('due_soon');
  });

  it('sigue en due_soon durante el periodo de gracia', () => {
    expect(estadoPago(CUENTA, '2026-08-13')).toBe('due_soon');
    expect(estadoPago(CUENTA, '2026-08-15')).toBe('due_soon');
  });

  it('pasa a vencido al agotarse la gracia', () => {
    expect(estadoPago(CUENTA, '2026-08-16')).toBe('past_due');
    expect(estadoPago(CUENTA, '2026-09-01')).toBe('past_due');
  });

  it('una cuenta sin mensualidad siempre está al corriente', () => {
    expect(estadoPago({ ...CUENTA, mensualidadCentavos: 0 }, '2026-12-31')).toBe('current');
  });

  it('sin fecha de vencimiento no hay adeudo', () => {
    expect(estadoPago({ ...CUENTA, proximaFechaPago: null }, '2026-12-31')).toBe('current');
  });
});

describe('cálculo de días', () => {
  it('cuenta el retraso', () => {
    expect(diasDeRetraso(CUENTA, '2026-08-20')).toBe(10);
    expect(diasDeRetraso(CUENTA, '2026-08-01')).toBe(0);
  });

  it('cuenta lo que falta', () => {
    expect(diasParaVencer(CUENTA, '2026-08-01')).toBe(9);
    expect(diasParaVencer(CUENTA, '2026-08-20')).toBe(-10);
  });
});

// ══════════════════════════════════════════════════════════════════════════
//  El requisito central del cobro manual
// ══════════════════════════════════════════════════════════════════════════
describe('una cuenta vencida NUNCA suspende sola', () => {
  const vencidaHace60 = { ...CUENTA, proximaFechaPago: '2026-06-01' };

  it('con 67 días de retraso, la organización sigue activa', () => {
    expect(estadoPago(vencidaHace60, '2026-08-07')).toBe('past_due');
    expect(estadoOrganizacionTrasElTiempo('active', vencidaHace60, '2026-08-07')).toBe('active');
  });

  it('ni con un año de retraso', () => {
    expect(estadoOrganizacionTrasElTiempo('active', vencidaHace60, '2027-08-07')).toBe('active');
  });

  it('el paso del tiempo no altera NINGÚN estado', () => {
    for (const estado of ESTADOS_ORGANIZACION) {
      expect(estadoOrganizacionTrasElTiempo(estado, vencidaHace60, '2030-01-01'), estado).toBe(
        estado
      );
    }
  });

  it('lo único que produce el vencimiento es una alerta', () => {
    const alertas = alertasDeCobro(vencidaHace60, 'active', '2026-08-07');
    expect(alertas).toHaveLength(1);
    expect(alertas[0]?.nivel).toBe('urgente');
    expect(alertas[0]?.clave).toBe('pago_vencido');
    expect(alertas[0]?.mensaje).toContain('decisión manual');
  });

  it('avisa antes de vencer, sin urgencia', () => {
    const alertas = alertasDeCobro(CUENTA, 'active', '2026-08-07');
    expect(alertas[0]?.nivel).toBe('aviso');
    expect(alertas[0]?.clave).toBe('pago_proximo');
  });

  it('al corriente no genera alertas', () => {
    expect(alertasDeCobro(CUENTA, 'active', '2026-07-15')).toEqual([]);
  });
});

describe('transiciones del ciclo de vida', () => {
  it('las válidas', () => {
    expect(transicionPermitida('onboarding', 'active')).toBe(true);
    expect(transicionPermitida('active', 'suspended')).toBe(true);
    expect(transicionPermitida('suspended', 'active')).toBe(true);
    expect(transicionPermitida('active', 'cancelled')).toBe(true);
  });

  it('una barbería cancelada no vuelve', () => {
    for (const destino of ESTADOS_ORGANIZACION) {
      expect(transicionPermitida('cancelled', destino), destino).toBe(false);
    }
  });

  it('no se salta el alta', () => {
    expect(transicionPermitida('onboarding', 'suspended')).toBe(false);
  });
});

describe('quién y cómo puede suspender', () => {
  const superadmin = { esSuperadmin: true };

  it('un propietario NO puede suspender su barbería', () => {
    const r = validarCambioDeEstado('active', 'suspended', {
      esSuperadmin: false,
      motivo: 'lo que sea',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toContain('superadministrador');
  });

  it('suspender exige un motivo escrito', () => {
    expect(validarCambioDeEstado('active', 'suspended', superadmin).ok).toBe(false);
    expect(validarCambioDeEstado('active', 'suspended', { ...superadmin, motivo: '   ' }).ok).toBe(
      false
    );
  });

  it('con motivo y superadministrador, procede', () => {
    expect(
      validarCambioDeEstado('active', 'suspended', {
        ...superadmin,
        motivo: 'Tres meses sin pago tras contacto por WhatsApp',
      }).ok
    ).toBe(true);
  });

  it('reactivar no exige motivo', () => {
    expect(validarCambioDeEstado('suspended', 'active', superadmin).ok).toBe(true);
  });

  it('no se cambia al mismo estado', () => {
    expect(validarCambioDeEstado('active', 'active', superadmin).ok).toBe(false);
  });

  it('rechaza una transición imposible con mensaje legible', () => {
    const r = validarCambioDeEstado('cancelled', 'active', superadmin);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toContain('Cancelada');
  });
});

describe('el público no se entera del adeudo', () => {
  it('el mensaje no menciona pagos, deudas ni suspensión', () => {
    const mensaje = mensajePublicoSuspension().toLowerCase();
    for (const palabra of ['pago', 'deuda', 'adeudo', 'suspend', 'mensualidad', 'factura']) {
      expect(mensaje, palabra).not.toContain(palabra);
    }
    expect(mensaje).toContain('temporalmente no disponible');
  });
});

describe('avance del vencimiento', () => {
  it('suma un mes respetando el día de corte', () => {
    expect(siguienteFechaPago('2026-08-10', 10)).toBe('2026-09-10');
    expect(siguienteFechaPago('2026-01-15', 15)).toBe('2026-02-15');
  });

  it('ajusta el día cuando el mes es más corto', () => {
    expect(siguienteFechaPago('2026-01-28', 28)).toBe('2026-02-28');
  });

  it('cruza el año correctamente', () => {
    expect(siguienteFechaPago('2026-12-05', 5)).toBe('2027-01-05');
  });
});

describe('alertas de una barbería ya suspendida', () => {
  it('solo informa de la suspensión, sin duplicar la del cobro', () => {
    const alertas = alertasDeCobro(
      { ...CUENTA, proximaFechaPago: '2026-01-01' },
      'suspended',
      '2026-08-07'
    );
    expect(alertas).toHaveLength(1);
    expect(alertas[0]?.clave).toBe('org_suspendida');
  });
});

describe('tipos exhaustivos', () => {
  it('los cuatro estados de organización están cubiertos', () => {
    const todos: EstadoOrganizacion[] = ['onboarding', 'active', 'suspended', 'cancelled'];
    expect([...ESTADOS_ORGANIZACION].sort()).toEqual([...todos].sort());
  });
});
