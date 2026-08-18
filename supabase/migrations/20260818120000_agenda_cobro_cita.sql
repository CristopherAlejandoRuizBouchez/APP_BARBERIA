-- Agenda simplificada y cobro ligado a la cita.
-- Al cobrar una cita se respeta el precio congelado al momento de reservar.

create or replace function public.fn_crear_venta(
  p_organization_id uuid,
  p_location_id uuid,
  p_items jsonb,
  p_pagos jsonb,
  p_cliente_id uuid default null,
  p_barbero_id uuid default null,
  p_cita_id uuid default null,
  p_pedido_id uuid default null,
  p_descuento_centavos integer default 0,
  p_notas text default null
)
returns table (venta_id uuid, folio text, total_centavos integer)
language plpgsql security definer set search_path = ''
as $$
declare
  v_folio text;
  v_venta uuid;
  v_subtotal int := 0;
  v_impuestos int := 0;
  v_total int;
  v_caja uuid;
  r record;
  p record;
  v_item_id uuid;
  v_precio int;
  v_costo int;
  v_desc text;
  v_barbero uuid;
  v_com_tipo public.tipo_comision;
  v_com_valor numeric;
  v_monto_com int;
  v_pagado int := 0;
  v_cita_cliente uuid;
  v_cita_barbero uuid;
begin
  perform public.fn_exigir_operacion(p_organization_id);

  -- Bloquea la cita durante el cobro e impide cobrarla dos veces.
  if p_cita_id is not null then
    select a.cliente_id, a.barbero_id
      into v_cita_cliente, v_cita_barbero
      from public.appointments a
     where a.id = p_cita_id
       and a.organization_id = p_organization_id
       and a.venta_id is null
       and a.estado in ('pendiente', 'confirmada', 'en_proceso')
     for update;

    if not found then
      raise exception 'DATOS_INVALIDOS'
        using detail = 'La cita ya fue cobrada o no está disponible.';
    end if;

    p_cliente_id := coalesce(p_cliente_id, v_cita_cliente);
    p_barbero_id := coalesce(p_barbero_id, v_cita_barbero);
  end if;

  select id into v_caja from public.cash_registers
   where organization_id = p_organization_id
     and location_id = p_location_id
     and estado = 'abierta'
   limit 1;

  loop
    v_folio := public.fn_generar_folio('BQ-V');
    exit when not exists (
      select 1 from public.sales s
       where s.organization_id = p_organization_id and s.folio = v_folio
    );
  end loop;

  insert into public.sales (
    organization_id, location_id, folio, tipo, cliente_id, barbero_id, cajero_id,
    cita_id, pedido_id, corte_caja_id, estado, notas
  ) values (
    p_organization_id, p_location_id, v_folio,
    case when p_cita_id is not null then 'cita'
         when p_pedido_id is not null then 'pedido_web' else 'mostrador' end,
    p_cliente_id, p_barbero_id, (select auth.uid()),
    p_cita_id, p_pedido_id, v_caja, 'completada', p_notas
  ) returning id into v_venta;

  for r in
    select (i ->> 'tipo') as tipo,
           (i ->> 'id')::uuid as id,
           (i ->> 'cantidad')::int as cantidad,
           coalesce((i ->> 'descuento_centavos')::int, 0) as descuento,
           nullif(i ->> 'barbero_id', '')::uuid as barbero_id
      from jsonb_array_elements(p_items) as i
  loop
    if r.cantidad is null or r.cantidad <= 0 then
      raise exception 'DATOS_INVALIDOS' using detail = 'Cantidad inválida en el ticket.';
    end if;

    v_precio := null;
    v_costo := null;
    v_desc := null;
    v_barbero := coalesce(r.barbero_id, p_barbero_id);

    if r.tipo = 'producto' then
      perform 1 from public.product_stock
       where producto_id = r.id and location_id = p_location_id for update;

      select pr.precio_venta_centavos, pr.costo_centavos, pr.nombre
        into v_precio, v_costo, v_desc
        from public.products pr
       where pr.id = r.id
         and pr.organization_id = p_organization_id
         and pr.activo;

      if v_precio is null then
        raise exception 'NO_ENCONTRADO' using detail = 'Producto no disponible.';
      end if;

    elsif r.tipo = 'servicio' then
      -- Primero intenta obtener el precio histórico de la cita.
      if p_cita_id is not null then
        select cs.precio_centavos, 0, cs.nombre_congelado
          into v_precio, v_costo, v_desc
          from public.appointment_services cs
         where cs.organization_id = p_organization_id
           and cs.cita_id = p_cita_id
           and cs.servicio_id = r.id
         order by cs.orden
         limit 1;
      end if;

      -- Los servicios adicionales al ticket usan el precio actual.
      if v_precio is null then
        select sv.precio_centavos, 0, sv.nombre
          into v_precio, v_costo, v_desc
          from public.services sv
         where sv.id = r.id
           and sv.organization_id = p_organization_id
           and sv.activo;
      end if;

      if v_precio is null then
        raise exception 'NO_ENCONTRADO' using detail = 'Servicio no disponible.';
      end if;
    else
      raise exception 'DATOS_INVALIDOS'
        using detail = 'tipo_item debe ser producto o servicio.';
    end if;

    insert into public.sale_items (
      organization_id, venta_id, tipo_item,
      producto_id, servicio_id, descripcion_congelada, cantidad,
      precio_unitario_centavos, costo_unitario_centavos, descuento_centavos,
      total_centavos, barbero_id
    ) values (
      p_organization_id, v_venta, r.tipo,
      case when r.tipo = 'producto' then r.id end,
      case when r.tipo = 'servicio' then r.id end,
      v_desc, r.cantidad, v_precio, v_costo, r.descuento,
      greatest(0, v_precio * r.cantidad - r.descuento), v_barbero
    ) returning id into v_item_id;

    v_subtotal := v_subtotal + greatest(0, v_precio * r.cantidad - r.descuento);

    if r.tipo = 'producto' then
      insert into public.inventory_movements (
        organization_id, location_id, producto_id, tipo, cantidad,
        costo_unitario_centavos, referencia_tipo, referencia_id, usuario_id
      ) values (
        p_organization_id, p_location_id, r.id, 'salida_venta', -r.cantidad,
        v_costo, 'venta', v_venta, (select auth.uid())
      );
    end if;

    if v_barbero is not null then
      if r.tipo = 'servicio' then
        select comision_servicio_tipo, comision_servicio_valor
          into v_com_tipo, v_com_valor
          from public.barbers where id = v_barbero;
      else
        select comision_producto_tipo, comision_producto_valor
          into v_com_tipo, v_com_valor
          from public.barbers where id = v_barbero;
      end if;

      if coalesce(v_com_valor, 0) > 0 then
        v_monto_com := case
          when v_com_tipo = 'porcentaje'
            then round(
              greatest(0, v_precio * r.cantidad - r.descuento) * v_com_valor / 100.0
            )::int
          else round(v_com_valor * r.cantidad)::int
        end;

        insert into public.commissions (
          organization_id, location_id, barbero_id, venta_id, venta_item_id, tipo_item,
          base_centavos, tipo_calculo, valor, monto_centavos
        ) values (
          p_organization_id, p_location_id, v_barbero, v_venta, v_item_id, r.tipo,
          greatest(0, v_precio * r.cantidad - r.descuento),
          v_com_tipo, v_com_valor, v_monto_com
        );
      end if;
    end if;
  end loop;

  v_total := greatest(0, v_subtotal - coalesce(p_descuento_centavos, 0)) + v_impuestos;

  update public.sales
     set subtotal_centavos = v_subtotal,
         descuento_centavos = coalesce(p_descuento_centavos, 0),
         impuestos_centavos = v_impuestos,
         total_centavos = v_total
   where id = v_venta;

  for p in
    select (i ->> 'metodo')::public.metodo_pago as metodo,
           (i ->> 'monto_centavos')::int as monto,
           nullif(i ->> 'referencia', '') as referencia,
           nullif(i ->> 'recibido_centavos', '')::int as recibido
      from jsonb_array_elements(p_pagos) as i
  loop
    insert into public.sale_payments (
      organization_id, venta_id, metodo_pago, monto_centavos, referencia,
      recibido_centavos, cambio_centavos, registrado_por
    ) values (
      p_organization_id, v_venta, p.metodo, p.monto, p.referencia,
      case when p.metodo = 'efectivo' then coalesce(p.recibido, p.monto) end,
      case when p.metodo = 'efectivo' then coalesce(p.recibido, p.monto) - p.monto end,
      (select auth.uid())
    );
    v_pagado := v_pagado + p.monto;
  end loop;

  if v_pagado <> v_total then
    raise exception 'PAGOS_NO_CUADRAN'
      using detail = format(
        'total=%s pagado=%s diferencia=%s',
        v_total, v_pagado, v_total - v_pagado
      );
  end if;

  if p_cita_id is not null then
    update public.appointments
       set estado = 'completada', venta_id = v_venta
     where id = p_cita_id and organization_id = p_organization_id;

    insert into public.appointment_events (
      organization_id, cita_id, tipo, estado_nuevo, actor, usuario_id
    ) values (
      p_organization_id, p_cita_id, 'completada', 'completada',
      'staff', (select auth.uid())
    );
  end if;

  return query select v_venta, v_folio, v_total;
end;
$$;
