-- ============================================================================
-- 0012 · Privacidad operativa frente al superadministrador
-- ============================================================================
-- El operador de Barbería OS administra altas, planes, cobros y suspensiones.
-- No es un integrante implícito de cada barbería y no puede consultar citas,
-- clientes, ventas, caja, inventario, gastos, comisiones ni borradores internos.
-- Si la misma persona también es propietaria de una barbería, necesita una
-- membresía explícita y recibe exactamente los permisos de esa membresía.
-- ============================================================================

-- Las RPC operativas aceptan llamadas anónimas solo en la superficie pública
-- que ya tiene EXECUTE para anon. Toda llamada autenticada debe pertenecer a
-- la organización, incluso si el usuario es superadministrador de plataforma.
create or replace function public.fn_exigir_operacion(p_organization_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.fn_org_operativa(p_organization_id) then
    raise exception 'ORGANIZACION_NO_OPERATIVA'
      using detail = 'La barbería está suspendida o dada de baja. No se pueden registrar operaciones.';
  end if;

  if (select auth.uid()) is not null
     and not public.fn_es_miembro(p_organization_id) then
    raise exception 'NO_AUTORIZADO'
      using detail = 'La operación exige una membresía activa en la barbería.';
  end if;
end;
$$;

-- Sucursales: el superadministrador puede provisionar la inicial, pero no
-- leer ni administrar después el directorio privado desde su sesión.
drop policy if exists sucursal_lee on public.locations;
drop policy if exists sucursal_escribe on public.locations;
create policy sucursal_lee on public.locations for select to authenticated
  using (public.fn_es_miembro(organization_id));
create policy sucursal_escribe on public.locations for all to authenticated
  using (public.fn_es_admin_org(organization_id))
  with check (public.fn_es_admin_org(organization_id));
create policy sucursal_provisiona on public.locations for insert to authenticated
  with check (public.fn_es_superadmin());

-- Perfiles, equipo e invitaciones pertenecen a cada organización.
drop policy if exists perfil_propio on public.profiles;
create policy perfil_propio on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1
        from public.organization_members m1
        join public.organization_members m2 on m1.organization_id = m2.organization_id
       where m1.usuario_id = (select auth.uid())
         and m1.estado = 'activa'
         and m2.usuario_id = profiles.id
    )
  );

drop policy if exists membresia_lee on public.organization_members;
drop policy if exists membresia_escribe on public.organization_members;
create policy membresia_lee on public.organization_members for select to authenticated
  using (usuario_id = (select auth.uid()) or public.fn_es_miembro(organization_id));
create policy membresia_escribe on public.organization_members for all to authenticated
  using (public.fn_es_admin_org(organization_id))
  with check (public.fn_es_admin_org(organization_id));

drop policy if exists invitacion_lee on public.organization_invitations;
drop policy if exists invitacion_escribe on public.organization_invitations;
create policy invitacion_lee on public.organization_invitations for select to authenticated
  using (public.fn_es_admin_org(organization_id));
create policy invitacion_escribe on public.organization_invitations for all to authenticated
  using (public.fn_es_admin_org(organization_id))
  with check (public.fn_es_admin_org(organization_id));

-- Ajustes y borradores visuales: la plataforma solo crea la fila inicial.
drop policy if exists ajustes_lee on public.organization_settings;
drop policy if exists ajustes_escribe on public.organization_settings;
create policy ajustes_lee on public.organization_settings for select to authenticated
  using (public.fn_es_miembro(organization_id));
create policy ajustes_escribe on public.organization_settings for all to authenticated
  using (public.fn_es_admin_org(organization_id))
  with check (public.fn_es_admin_org(organization_id));
create policy ajustes_provisiona on public.organization_settings for insert to authenticated
  with check (public.fn_es_superadmin());

drop policy if exists tema_lee on public.organization_themes;
drop policy if exists tema_escribe on public.organization_themes;
create policy tema_lee on public.organization_themes for select to authenticated
  using (public.fn_es_miembro(organization_id));
create policy tema_escribe on public.organization_themes for all to authenticated
  using (public.fn_es_admin_org(organization_id))
  with check (public.fn_es_admin_org(organization_id));
create policy tema_provisiona on public.organization_themes for insert to authenticated
  with check (public.fn_es_superadmin());

-- Catálogo, personal, agenda base e inventario visible al equipo.
do $$
declare t text;
begin
  foreach t in array array[
    'barbers', 'barber_locations', 'barber_services', 'barber_schedules', 'barber_blocks',
    'non_working_days', 'service_categories', 'services', 'service_locations',
    'suppliers', 'product_categories', 'products', 'product_stock',
    'gallery_items', 'testimonials', 'faqs'
  ] loop
    execute format('drop policy if exists %1$s_lee on public.%1$I', t);
    execute format(
      'create policy %1$s_lee on public.%1$I for select to authenticated using (public.fn_es_miembro(organization_id))',
      t
    );
  end loop;
end $$;

-- Datos personales y agenda.
drop policy if exists cliente_lee on public.customers;
create policy cliente_lee on public.customers for select to authenticated
  using (
    public.fn_es_operativo(organization_id)
    or (
      public.fn_rol_en_org(organization_id) = 'barber'
      and exists (
        select 1 from public.appointments a
         where a.cliente_id = customers.id
           and a.barbero_id = public.fn_mi_barbero_id(organization_id)
      )
    )
  );

drop policy if exists cita_lee on public.appointments;
create policy cita_lee on public.appointments for select to authenticated
  using (
    public.fn_es_operativo(organization_id)
    or barbero_id = public.fn_mi_barbero_id(organization_id)
  );

drop policy if exists cita_servicio_lee on public.appointment_services;
create policy cita_servicio_lee on public.appointment_services for select to authenticated
  using (public.fn_es_miembro(organization_id));

drop policy if exists evento_cita_lee on public.appointment_events;
create policy evento_cita_lee on public.appointment_events for select to authenticated
  using (public.fn_es_miembro(organization_id));

-- Compras, movimientos y gastos.
drop policy if exists movimiento_lee on public.inventory_movements;
create policy movimiento_lee on public.inventory_movements for select to authenticated
  using (public.fn_es_gestion(organization_id));

do $$
declare t text;
begin
  foreach t in array array[
    'purchases', 'purchase_items', 'stock_transfers', 'stock_transfer_items',
    'expense_categories', 'expenses'
  ] loop
    execute format('drop policy if exists %1$s_lee on public.%1$I', t);
    execute format(
      'create policy %1$s_lee on public.%1$I for select to authenticated using (public.fn_es_gestion(organization_id))',
      t
    );
  end loop;
end $$;

-- Pedidos y reservas.
drop policy if exists pedido_lee on public.orders;
create policy pedido_lee on public.orders for select to authenticated
  using (public.fn_es_operativo(organization_id));
drop policy if exists pedido_item_lee on public.order_items;
create policy pedido_item_lee on public.order_items for select to authenticated
  using (public.fn_es_operativo(organization_id));
drop policy if exists reserva_lee on public.inventory_reservations;
create policy reserva_lee on public.inventory_reservations for select to authenticated
  using (public.fn_es_operativo(organization_id));

-- Ventas y caja.
drop policy if exists venta_lee on public.sales;
create policy venta_lee on public.sales for select to authenticated
  using (
    public.fn_es_operativo(organization_id)
    or barbero_id = public.fn_mi_barbero_id(organization_id)
  );

do $$
declare t text;
begin
  foreach t in array array[
    'sale_items', 'sale_payments', 'sale_returns', 'sale_return_items', 'cash_registers'
  ] loop
    execute format('drop policy if exists %1$s_lee on public.%1$I', t);
    execute format(
      'create policy %1$s_lee on public.%1$I for select to authenticated using (public.fn_es_operativo(organization_id))',
      t
    );
  end loop;
end $$;

-- Comisiones, auditoría y mensajes internos.
drop policy if exists comision_lee on public.commissions;
create policy comision_lee on public.commissions for select to authenticated
  using (
    public.fn_es_gestion(organization_id)
    or barbero_id = public.fn_mi_barbero_id(organization_id)
  );

drop policy if exists payout_lee on public.commission_payouts;
create policy payout_lee on public.commission_payouts for select to authenticated
  using (
    public.fn_es_gestion(organization_id)
    or barbero_id = public.fn_mi_barbero_id(organization_id)
  );

drop policy if exists auditoria_lee on public.audit_log;
create policy auditoria_lee on public.audit_log for select to authenticated
  using (public.fn_es_admin_org(organization_id));

drop policy if exists wa_lee on public.whatsapp_messages;
create policy wa_lee on public.whatsapp_messages for select to authenticated
  using (public.fn_es_operativo(organization_id));

-- Estas cuatro RPC existían antes de la guarda común. Se redefinen para que
-- una sesión de plataforma no pueda mutar operaciones adivinando identificadores.
create or replace function public.fn_cancelar_cita(
  p_organization_id uuid, p_cita_id uuid, p_motivo text,
  p_canal public.canal_cita default 'sistema'
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_ant record;
begin
  perform public.fn_exigir_operacion(p_organization_id);

  if p_motivo is null or btrim(p_motivo) = '' then
    raise exception 'DATOS_INVALIDOS' using detail = 'La cancelación exige un motivo.';
  end if;

  select * into v_ant from public.appointments
   where id = p_cita_id and organization_id = p_organization_id for update;
  if not found then raise exception 'NO_ENCONTRADO'; end if;

  update public.appointments
     set estado = 'cancelada', cancelada_en = now(),
         motivo_cancelacion = p_motivo, cancelada_por = (select auth.uid())
   where id = p_cita_id;

  insert into public.appointment_events (
    organization_id, cita_id, tipo, estado_anterior, estado_nuevo, motivo, canal, actor, usuario_id
  ) values (
    p_organization_id, p_cita_id, 'cancelada', v_ant.estado, 'cancelada', p_motivo, p_canal,
    'staff', (select auth.uid())
  );

  update public.whatsapp_messages
     set estado = 'cancelado'
   where cita_id = p_cita_id and estado in ('pendiente', 'listo_para_envio', 'manual_pendiente');
end;
$$;

create or replace function public.fn_cancelar_pedido(
  p_organization_id uuid, p_pedido_id uuid, p_motivo text
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.fn_exigir_operacion(p_organization_id);

  update public.orders
     set estado = 'cancelado', cancelado_en = now(),
         motivo_cancelacion = coalesce(p_motivo, 'Cancelado')
   where id = p_pedido_id
     and organization_id = p_organization_id
     and estado <> 'entregado';

  update public.inventory_reservations
     set estado = 'cancelada', liberada_en = now()
   where pedido_id = p_pedido_id and estado = 'activa';
end;
$$;

create or replace function public.fn_cancelar_venta(
  p_organization_id uuid, p_venta_id uuid, p_motivo text
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare r record; v_venta record;
begin
  perform public.fn_exigir_operacion(p_organization_id);

  if p_motivo is null or btrim(p_motivo) = '' then
    raise exception 'DATOS_INVALIDOS' using detail = 'La cancelación exige un motivo.';
  end if;

  select * into v_venta from public.sales
   where id = p_venta_id and organization_id = p_organization_id for update;
  if not found then raise exception 'NO_ENCONTRADO'; end if;
  if v_venta.estado = 'cancelada' then return; end if;

  for r in
    select producto_id, cantidad, costo_unitario_centavos
      from public.sale_items
     where venta_id = p_venta_id and tipo_item = 'producto' and producto_id is not null
  loop
    insert into public.inventory_movements (
      organization_id, location_id, producto_id, tipo, cantidad,
      costo_unitario_centavos, referencia_tipo, referencia_id, motivo, usuario_id
    ) values (
      p_organization_id, v_venta.location_id, r.producto_id, 'devolucion_cliente', r.cantidad,
      r.costo_unitario_centavos, 'venta_cancelada', p_venta_id, p_motivo, (select auth.uid())
    );
  end loop;

  update public.commissions set estado = 'cancelada'
   where venta_id = p_venta_id and estado = 'pendiente';

  update public.sales
     set estado = 'cancelada', cancelada_en = now(),
         cancelada_por = (select auth.uid()), motivo_cancelacion = p_motivo
   where id = p_venta_id;
end;
$$;

create or replace function public.fn_cerrar_caja(
  p_organization_id uuid, p_caja_id uuid,
  p_efectivo_contado_centavos integer, p_notas text default null
)
returns table (esperado_centavos integer, contado_centavos integer, diferencia_centavos integer)
language plpgsql security definer set search_path = ''
as $$
declare
  v_caja record;
  v_efectivo int; v_tarjeta int; v_transf int; v_otro int;
begin
  perform public.fn_exigir_operacion(p_organization_id);

  select * into v_caja from public.cash_registers
   where id = p_caja_id and organization_id = p_organization_id for update;
  if not found then raise exception 'NO_ENCONTRADO'; end if;
  if v_caja.estado = 'cerrada' then raise exception 'CAJA_CERRADA'; end if;

  select
    coalesce(sum(monto_centavos) filter (where metodo_pago = 'efectivo'), 0),
    coalesce(sum(monto_centavos) filter (where metodo_pago = 'tarjeta_fisica'), 0),
    coalesce(sum(monto_centavos) filter (where metodo_pago = 'transferencia'), 0),
    coalesce(sum(monto_centavos) filter (where metodo_pago = 'otro'), 0)
  into v_efectivo, v_tarjeta, v_transf, v_otro
  from public.sale_payments sp
  join public.sales s on s.id = sp.venta_id
 where s.corte_caja_id = p_caja_id and s.estado = 'completada';

  update public.cash_registers
     set estado = 'cerrada',
         efectivo_sistema_centavos = v_efectivo,
         efectivo_contado_centavos = p_efectivo_contado_centavos,
         diferencia_centavos = p_efectivo_contado_centavos - (v_efectivo + v_caja.fondo_inicial_centavos),
         tarjeta_centavos = v_tarjeta,
         transferencia_centavos = v_transf,
         otro_centavos = v_otro,
         cerrado_por = (select auth.uid()),
         cerrado_en = now(),
         notas = coalesce(p_notas, notas)
   where id = p_caja_id;

  return query select
    v_efectivo + v_caja.fondo_inicial_centavos,
    p_efectivo_contado_centavos,
    p_efectivo_contado_centavos - (v_efectivo + v_caja.fondo_inicial_centavos);
end;
$$;
