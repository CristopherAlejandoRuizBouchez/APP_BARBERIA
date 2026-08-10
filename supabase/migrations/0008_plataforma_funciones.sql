-- ============================================================================
-- 0008 · Cobro manual, suspensión, recordatorios, índices y vistas
-- ============================================================================
-- El cobro de una barbería a Barbería OS es un proceso SEPARADO de los pagos
-- que los clientes hacen a la barbería. No comparten tablas ni funciones.
-- ============================================================================

-- ── Guarda de superadministrador ────────────────────────────────────────────
create or replace function public.fn_exigir_superadmin()
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.fn_es_superadmin() then
    raise exception 'NO_AUTORIZADO'
      using detail = 'Solo el superadministrador de la plataforma puede hacer esto.';
  end if;
end;
$$;

/**
 * Suspende una barbería. SIEMPRE manual, siempre con motivo.
 *
 * No existe ninguna función automática que produzca este estado: una fecha
 * vencida genera alertas, nunca una suspensión.
 */
create or replace function public.fn_suspender_organizacion(
  p_organization_id uuid, p_motivo text
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.fn_exigir_superadmin();

  if p_motivo is null or btrim(p_motivo) = '' then
    raise exception 'DATOS_INVALIDOS' using detail = 'La suspensión exige un motivo.';
  end if;

  update public.organizations
     set estado = 'suspended',
         suspendida_en = now(),
         suspendida_por = (select auth.uid()),
         motivo_suspension = p_motivo
   where id = p_organization_id and estado <> 'suspended';

  insert into public.audit_log (organization_id, tabla, registro_id, accion, descripcion, usuario_id)
  values (p_organization_id, 'organizations', p_organization_id, 'accion',
          'Suspensión manual: ' || p_motivo, (select auth.uid()));
end;
$$;

/** Reactiva una barbería. Recupera de inmediato toda la información. */
create or replace function public.fn_reactivar_organizacion(
  p_organization_id uuid, p_nota text default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.fn_exigir_superadmin();

  update public.organizations
     set estado = 'active',
         reactivada_en = now(),
         reactivada_por = (select auth.uid()),
         suspendida_en = null,
         suspendida_por = null,
         motivo_suspension = null
   where id = p_organization_id;

  insert into public.audit_log (organization_id, tabla, registro_id, accion, descripcion, usuario_id)
  values (p_organization_id, 'organizations', p_organization_id, 'accion',
          coalesce('Reactivación manual: ' || p_nota, 'Reactivación manual'), (select auth.uid()));
end;
$$;

/** Registra y verifica un pago por transferencia. Solo superadministrador. */
create or replace function public.fn_registrar_pago_manual(
  p_organization_id uuid,
  p_monto_centavos integer,
  p_fecha_pago date,
  p_referencia text default null,
  p_periodo_inicio date default null,
  p_periodo_fin date default null,
  p_notas text default null,
  p_avanzar_vencimiento boolean default true
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_pago uuid;
  v_cuenta record;
  v_proxima date;
begin
  perform public.fn_exigir_superadmin();

  if p_monto_centavos is null or p_monto_centavos <= 0 then
    raise exception 'DATOS_INVALIDOS' using detail = 'El monto debe ser mayor que cero.';
  end if;

  insert into public.manual_payments (
    organization_id, monto_centavos, fecha_pago, referencia,
    periodo_inicio, periodo_fin, notas, estado, verificado_por, verificado_en, reportado_por
  ) values (
    p_organization_id, p_monto_centavos, p_fecha_pago, p_referencia,
    p_periodo_inicio, p_periodo_fin, p_notas, 'verificado',
    (select auth.uid()), now(), (select auth.uid())
  ) returning id into v_pago;

  select * into v_cuenta from public.billing_accounts where organization_id = p_organization_id;

  if found then
    v_proxima := case
      when p_avanzar_vencimiento then coalesce(v_cuenta.proxima_fecha_pago, p_fecha_pago) + interval '1 month'
      else v_cuenta.proxima_fecha_pago
    end;

    update public.billing_accounts
       set ultimo_pago_en = p_fecha_pago,
           proxima_fecha_pago = v_proxima,
           estado_pago = 'current',
           actualizado_en = now(),
           actualizado_por = (select auth.uid())
     where organization_id = p_organization_id;
  end if;

  insert into public.audit_log (organization_id, tabla, registro_id, accion, descripcion, usuario_id)
  values (p_organization_id, 'manual_payments', v_pago, 'accion',
          format('Pago verificado por %s centavos', p_monto_centavos), (select auth.uid()));

  return v_pago;
end;
$$;

/**
 * Recalcula el estado de cobro de todas las cuentas.
 *
 * IMPORTANTE: esta función NUNCA cambia `organizations.estado`. Solo mueve
 * `billing_accounts.estado_pago` para alimentar alertas. La suspensión es
 * siempre una decisión humana.
 */
create or replace function public.fn_recalcular_estados_pago()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare v_n int;
begin
  with actualizadas as (
    update public.billing_accounts b
       set estado_pago = case
             when b.proxima_fecha_pago is null then 'current'
             when current_date > b.proxima_fecha_pago + b.dias_gracia then 'past_due'
             when current_date >= b.proxima_fecha_pago - 5 then 'due_soon'
             else 'current'
           end::public.estado_pago_plataforma,
           actualizado_en = now()
     where b.mensualidad_centavos > 0
    returning 1
  )
  select count(*) into v_n from actualizadas;
  return coalesce(v_n, 0);
end;
$$;

comment on function public.fn_recalcular_estados_pago() is
  'Solo alerta. Jamás toca organizations.estado: la suspensión es siempre manual.';

-- ══════════════════════════════════════════════════════════════════════════
--  RECORDATORIOS DE WHATSAPP
-- ══════════════════════════════════════════════════════════════════════════

/**
 * Encola los recordatorios de las citas próximas.
 *
 * `ON CONFLICT DO NOTHING` sobre `clave_idempotencia` hace que ejecutar esto
 * mil veces produzca exactamente un mensaje por cita y ranura.
 *
 * Si la Cloud API está apagada (el estado inicial), el mensaje se crea igual,
 * con el texto ya renderizado, en `manual_pendiente`: aparece en la bandeja
 * del panel con un botón que abre wa.me. El sistema sirve desde el día uno sin
 * pagar nada.
 */
create or replace function public.fn_encolar_recordatorios(p_horizonte_horas integer default 48)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_n int := 0;
  r record;
  v_cloud boolean;
  v_estado public.estado_mensaje_wa;
begin
  for r in
    select a.id as cita_id, a.organization_id, a.location_id, a.fecha_hora_inicio, a.folio,
           c.nombre as cliente, c.telefono, o.nombre_comercial,
           s.recordatorio_1_activo, s.recordatorio_1_horas_antes,
           s.recordatorio_2_activo, s.recordatorio_2_horas_antes
      from public.appointments a
      join public.customers c on c.id = a.cliente_id
      join public.organizations o on o.id = a.organization_id
      join public.organization_settings s on s.organization_id = a.organization_id
     where a.estado in ('pendiente', 'confirmada')
       and a.fecha_hora_inicio between now() and now() + make_interval(hours => p_horizonte_horas)
       and o.estado = 'active'
  loop
    select coalesce(f.activo, false) into v_cloud
      from public.organization_feature_flags f
     where f.organization_id = r.organization_id and f.clave = 'whatsapp_cloud_api';

    v_estado := case when coalesce(v_cloud, false) then 'pendiente' else 'manual_pendiente' end;

    if r.recordatorio_1_activo then
      insert into public.whatsapp_messages (
        organization_id, location_id, cita_id, destinatario, plantilla, parametros,
        texto_renderizado, tipo, ranura, clave_idempotencia, estado, programado_para
      ) values (
        r.organization_id, r.location_id, r.cita_id, r.telefono, 'recordatorio_cita',
        jsonb_build_object('cliente', r.cliente, 'folio', r.folio, 'negocio', r.nombre_comercial),
        format('Hola %s, te recordamos tu cita en %s. Folio: %s.', r.cliente, r.nombre_comercial, r.folio),
        'recordatorio', 1,
        format('cita:%s:recordatorio:1', r.cita_id), v_estado,
        r.fecha_hora_inicio - make_interval(hours => r.recordatorio_1_horas_antes)
      ) on conflict (clave_idempotencia) do nothing;
      v_n := v_n + 1;
    end if;

    if r.recordatorio_2_activo then
      insert into public.whatsapp_messages (
        organization_id, location_id, cita_id, destinatario, plantilla, parametros,
        texto_renderizado, tipo, ranura, clave_idempotencia, estado, programado_para
      ) values (
        r.organization_id, r.location_id, r.cita_id, r.telefono, 'recordatorio_cita',
        jsonb_build_object('cliente', r.cliente, 'folio', r.folio, 'negocio', r.nombre_comercial),
        format('Hola %s, tu cita en %s es en un par de horas. Folio: %s.', r.cliente, r.nombre_comercial, r.folio),
        'recordatorio', 2,
        format('cita:%s:recordatorio:2', r.cita_id), v_estado,
        r.fecha_hora_inicio - make_interval(hours => r.recordatorio_2_horas_antes)
      ) on conflict (clave_idempotencia) do nothing;
      v_n := v_n + 1;
    end if;
  end loop;

  return v_n;
end;
$$;

/** Marca como listos los recordatorios cuya hora llegó. Idempotente. */
create or replace function public.fn_marcar_recordatorios_listos()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare v_n int;
begin
  with listos as (
    update public.whatsapp_messages
       set estado = 'listo_para_envio'
     where estado = 'pendiente' and programado_para <= now()
    returning 1
  )
  select count(*) into v_n from listos;
  return coalesce(v_n, 0);
end;
$$;

/** Mantenimiento diario. Sin efectos destructivos. */
create or replace function public.fn_mantenimiento_diario()
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.public_attempts where ventana < now() - interval '2 days';

  update public.organization_invitations
     set estado = 'expirada'
   where estado = 'pendiente' and expira_en < now();

  update public.appointment_access_tokens
     set revocado_en = now()
   where revocado_en is null and expira_en < now();

  perform public.fn_recalcular_estados_pago();
end;
$$;

-- ══════════════════════════════════════════════════════════════════════════
--  ÍNDICES
-- ══════════════════════════════════════════════════════════════════════════
create index idx_locations_org           on locations (organization_id) where activa;
create index idx_members_usuario         on organization_members (usuario_id) where estado = 'activa';
create index idx_members_org             on organization_members (organization_id);
create index idx_barbers_org             on barbers (organization_id) where activo;
create index idx_services_org            on services (organization_id) where activo;
create index idx_products_org            on products (organization_id) where activo;
create index idx_products_busqueda       on products using gin (to_tsvector('spanish', nombre || ' ' || coalesce(marca, '')));
create index idx_customers_org_tel       on customers (organization_id, telefono);
create index idx_customers_busqueda      on customers using gin (to_tsvector('spanish', nombre));
create index idx_appointments_agenda     on appointments (organization_id, location_id, fecha_hora_inicio);
create index idx_appointments_barbero    on appointments (barbero_id, fecha_hora_inicio);
create index idx_appointments_cliente    on appointments (cliente_id, fecha_hora_inicio desc);
create index idx_appointment_events_cita on appointment_events (cita_id, creado_en);
create index idx_sales_org_fecha         on sales (organization_id, creado_en desc);
create index idx_sales_location_fecha    on sales (location_id, creado_en desc);
create index idx_sale_items_venta        on sale_items (venta_id);
create index idx_sale_payments_venta     on sale_payments (venta_id);
create index idx_sale_payments_metodo    on sale_payments (organization_id, metodo_pago, creado_en);
create index idx_movements_producto      on inventory_movements (producto_id, location_id, creado_en desc);
create index idx_movements_org_fecha     on inventory_movements (organization_id, creado_en desc);
create index idx_orders_org_estado       on orders (organization_id, estado, creado_en desc);
create index idx_commissions_barbero     on commissions (barbero_id, estado, creado_en);
create index idx_expenses_org_fecha      on expenses (organization_id, fecha desc);
create index idx_audit_org_fecha         on audit_log (organization_id, creado_en desc);
create index idx_wa_bandeja              on whatsapp_messages (organization_id, estado, programado_para);
create index idx_billing_estado          on billing_accounts (estado_pago, proxima_fecha_pago);

-- ══════════════════════════════════════════════════════════════════════════
--  VISTAS
-- ══════════════════════════════════════════════════════════════════════════
-- Heredan la RLS de las tablas base: no abren ningún atajo de acceso.

create view v_stock_disponible as
  select ps.organization_id, ps.location_id, ps.producto_id,
         p.sku, p.nombre, ps.stock_actual, ps.stock_minimo,
         public.fn_stock_disponible(ps.producto_id, ps.location_id) as stock_disponible,
         (ps.stock_actual <= ps.stock_minimo) as bajo_minimo,
         ps.stock_actual * p.costo_centavos as valor_inventario_centavos
    from product_stock ps
    join products p on p.id = ps.producto_id;

create view v_ventas_diarias as
  select s.organization_id, s.location_id, date(s.creado_en) as fecha,
         count(*) as tickets,
         sum(s.total_centavos) as total_centavos,
         round(avg(s.total_centavos))::int as ticket_promedio_centavos
    from sales s
   where s.estado = 'completada'
   group by 1, 2, 3;

create view v_pagos_por_corte as
  select s.organization_id, s.corte_caja_id, sp.metodo_pago,
         sum(sp.monto_centavos) as total_centavos, count(*) as movimientos
    from sale_payments sp
    join sales s on s.id = sp.venta_id
   where s.estado = 'completada'
   group by 1, 2, 3;

create view v_utilidad_periodo as
  select s.organization_id, s.location_id, date_trunc('month', s.creado_en)::date as mes,
         sum(si.total_centavos) as ingresos_centavos,
         sum(si.costo_unitario_centavos * si.cantidad) as costo_producto_centavos,
         sum(si.total_centavos) - sum(si.costo_unitario_centavos * si.cantidad) as margen_bruto_centavos
    from sales s
    join sale_items si on si.venta_id = s.id
   where s.estado = 'completada'
   group by 1, 2, 3;

create view v_top_servicios as
  select si.organization_id, si.servicio_id, si.descripcion_congelada as nombre,
         sum(si.cantidad) as unidades, sum(si.total_centavos) as total_centavos
    from sale_items si
    join sales s on s.id = si.venta_id and s.estado = 'completada'
   where si.tipo_item = 'servicio'
   group by 1, 2, 3;

create view v_top_productos as
  select si.organization_id, si.producto_id, si.descripcion_congelada as nombre,
         sum(si.cantidad) as unidades, sum(si.total_centavos) as total_centavos
    from sale_items si
    join sales s on s.id = si.venta_id and s.estado = 'completada'
   where si.tipo_item = 'producto'
   group by 1, 2, 3;

create view v_desempeno_barbero as
  select s.organization_id, si.barbero_id, b.nombre,
         count(distinct s.id) as tickets,
         sum(si.total_centavos) as generado_centavos,
         coalesce(sum(c.monto_centavos), 0) as comision_centavos
    from sale_items si
    join sales s on s.id = si.venta_id and s.estado = 'completada'
    join barbers b on b.id = si.barbero_id
    left join commissions c on c.venta_item_id = si.id and c.estado <> 'cancelada'
   group by 1, 2, 3;

create view v_horas_pico as
  select a.organization_id, a.location_id,
         extract(dow from a.fecha_hora_inicio)::int as dia_semana,
         extract(hour from a.fecha_hora_inicio)::int as hora,
         count(*) as citas
    from appointments a
   where a.estado in ('completada', 'confirmada')
   group by 1, 2, 3, 4;

create view v_clientes_en_riesgo as
  select c.organization_id, c.id, c.nombre, c.telefono, c.ultima_visita,
         c.total_gastado_centavos,
         (current_date - c.ultima_visita::date) as dias_sin_visitar
    from customers c
   where c.activo and c.ultima_visita is not null
     and c.ultima_visita < now() - interval '60 days';

create view v_bandeja_whatsapp as
  select w.organization_id, w.id, w.destinatario, w.texto_renderizado, w.tipo,
         w.ranura, w.programado_para, w.estado, a.folio as folio_cita,
         a.fecha_hora_inicio
    from whatsapp_messages w
    left join appointments a on a.id = w.cita_id
   where w.estado in ('manual_pendiente', 'listo_para_envio');
