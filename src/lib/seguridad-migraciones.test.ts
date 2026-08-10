import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function migracion(nombre: string) {
  return readFileSync(join(process.cwd(), 'supabase', 'migrations', nombre), 'utf8');
}

function archivo(...ruta: string[]) {
  return readFileSync(join(process.cwd(), ...ruta), 'utf8');
}

describe('contratos de seguridad de las migraciones', () => {
  it('vuelve a validar el horario dentro del RPC de creación de citas', () => {
    const sql = migracion('0007_funciones_negocio.sql');
    expect(sql).toContain('from public.fn_slots_disponibles(');
    expect(sql).toContain("raise exception 'BARBERO_NO_DISPONIBLE'");
  });

  it('guarda solo el hash del token de autogestión', () => {
    const sql = migracion('0007_funciones_negocio.sql');
    const esquema = migracion('0004_catalogo_agenda.sql');
    expect(sql).toContain('insert into public.appointment_access_tokens');
    expect(sql).toContain("pg_catalog.sha256(pg_catalog.convert_to(v_token, 'UTF8'))");
    expect(esquema).toContain('token_hash      text not null unique');
    expect(esquema).not.toContain('token           text');
  });

  it('no expone la cancelación por UUID al rol anónimo', () => {
    const sql = migracion('0011_integridad_multitenant.sql');
    const bloqueAnon = sql
      .split('to anon, authenticated;')[0]
      ?.split('grant execute on function')
      .at(-1);
    expect(bloqueAnon).toContain('fn_cancelar_cita_publica(uuid, text, text)');
    expect(bloqueAnon).not.toContain('fn_cancelar_cita(uuid, uuid');
  });

  it('refuerza las sucursales con claves foráneas compuestas', () => {
    const sql = migracion('0011_integridad_multitenant.sql');
    expect(sql).toContain('locations_id_organization_unique unique (id, organization_id)');
    expect(
      sql.match(/references public\.locations \(id, organization_id\)/g)?.length
    ).toBeGreaterThanOrEqual(15);
  });

  it('separa al superadministrador de los datos privados de las barberías', () => {
    const sql = migracion('0012_privacidad_operativa.sql');

    expect(sql).toContain('and not public.fn_es_miembro(p_organization_id)');
    expect(sql).toContain('drop policy if exists cliente_lee on public.customers');
    expect(sql).toContain('drop policy if exists cita_lee on public.appointments');
    expect(sql).toContain('drop policy if exists venta_lee on public.sales');
    expect(sql).toContain('using (public.fn_es_admin_org(organization_id))');
    expect(sql).not.toContain(
      'public.fn_es_superadmin() or public.fn_es_operativo(organization_id)'
    );
    expect(sql).not.toContain('public.fn_es_superadmin() or public.fn_es_miembro(organization_id)');
  });

  it('elimina las relaciones simples a sucursales y conserva las compuestas', () => {
    const sql = migracion('0013_relaciones_postgrest.sql');

    expect(sql).toContain("c.confrelid = 'public.locations'::regclass");
    expect(sql).toContain('cardinality(c.conkey) = 1');
    expect(sql).toContain('alter table %s drop constraint %I');
    expect(sql).toContain("notify pgrst, 'reload schema'");
    expect(sql).not.toContain('drop constraint appointments_location_org_fk');
  });

  it('valida los pagos contra el total final de la venta', () => {
    const sql = migracion('0014_validacion_pagos_venta.sql');

    expect(sql).toContain('from public.sales s');
    expect(sql).toContain('where s.id = new.id');
    expect(sql).toContain('v_pagado <> v_total');
    expect(sql).not.toContain("if new.estado <> 'completada'");
    expect(sql).not.toContain('v_pagado <> new.total_centavos');
  });

  it('reserva la administración al propietario y limita recepción a operación', () => {
    const sql = migracion('0015_roles_propietario_recepcion.sql');

    expect(sql).toContain("array['organization_owner']::public.rol_organizacion[]");
    expect(sql).toContain("array['organization_owner', 'receptionist']::public.rol_organizacion[]");
    expect(sql).toContain("set rol = 'receptionist'");
  });

  it('crea el acceso del propietario sin depender del correo automático', () => {
    const accion = archivo('src', 'app', '(superadmin)', 'superadmin', 'acciones.ts');

    expect(accion).toContain("type: 'invite'");
    expect(accion).toContain('invitacion.data.properties.hashed_token');
    expect(accion).toContain("enlaceInvitacion.searchParams.set('type', 'invite')");
    expect(accion).not.toContain('inviteUserByEmail');
  });

  it('elimina una barbería de forma segura sin destruir su historial', () => {
    const accion = archivo('src', 'app', '(superadmin)', 'superadmin', 'acciones.ts');
    const sql = migracion('0016_eliminar_organizacion_seguro.sql');

    expect(accion).toContain("if (organizacion.estado === 'active')");
    expect(accion).toContain('confirmacion !== String(organizacion.slug).toLowerCase()');
    expect(accion).toContain("supabase.rpc('fn_eliminar_organizacion'");
    expect(accion).not.toContain("from('organizations').delete()");
    expect(sql).toContain("if v_org.estado = 'active'");
    expect(sql).toContain("set estado = 'revocada'");
    expect(sql).toContain("set estado = 'cancelled'");
    expect(sql).toContain("'-eliminada-'");
    expect(sql).toContain('datos conservados por seguridad');
  });
});
