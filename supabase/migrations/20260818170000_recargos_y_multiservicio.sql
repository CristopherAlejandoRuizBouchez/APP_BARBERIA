-- Recargos fijos por reservación y citas con varios servicios.
-- El recargo se congela en la cita y se cobra una sola vez, sin importar
-- cuántos servicios haya seleccionado el cliente.

alter table public.organization_settings
  add column if not exists recargo_agenda_centavos integer not null default 3000
    check (recargo_agenda_centavos between 0 and 1000000),
  add column if not exists recargo_express_centavos integer not null default 5000
    check (recargo_express_centavos between 0 and 1000000);

alter table public.appointments
  add column if not exists recargo_centavos integer not null default 0
    check (recargo_centavos >= 0);

comment on column public.organization_settings.recargo_agenda_centavos is
  'Cargo fijo por una reservación para una fecha posterior. Se cobra una sola vez por cita.';
comment on column public.organization_settings.recargo_express_centavos is
  'Cargo fijo por una reservación para el mismo día. Se cobra una sola vez por cita.';
comment on column public.appointments.recargo_centavos is
  'Recargo congelado al crear la cita; no cambia aunque después se modifique la configuración.';

-- Cambia el resultado para devolver al cliente el desglose completo.
drop function if exists public.fn_crear_cita(
  uuid, uuid, uuid, uuid[], timestamptz, text, text, boolean, public.canal_cita, text
);

create function public.fn_crear_cita(
  p_organization_id uuid,
  p_location_id     uuid,
  p_barbero_id      uuid,
  p_servicio_ids    uuid[],
  p_inicio          timestamptz,
  p_nombre          text,
  p_telefono        text,
  p_es_express      boolean default false,
  p_canal           public.canal_cita default 'web',
  p_notas           text default null
)
returns table (
  cita_id uuid,
  folio text,
  subtotal_centavos integer,
  recargo_centavos integer,
  total_centavos integer,
  es_express boolean,
  fin timestamptz,
  token_acceso text,
  servicios jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cliente uuid;
  v_duracion int := 0;
  v_subtotal int := 0;
  v_recargo int := 0;
  v_total int := 0;
  v_folio text;
  v_cita uuid;
  v_fin timestamptz;
  v_fecha_local date;
  v_hoy_local date;
  v_zona text;
  v_es_express boolean := false;
  v_express_activa boolean := true;
  v_recargo_agenda int := 3000;
  v_recargo_express int := 5000;
  v_token text;
  v_servicios jsonb := '[]'::jsonb;
  v_encontrados int := 0;
  r record;
  v_orden int := 0;
begin
  perform public.fn_exigir_operacion(p_organization_id);
  perform public.fn_consumir_limite_publico(
    'crear_cita', p_organization_id::text || ':' || coalesce(p_telefono, ''), 8, 15
  );

  if p_servicio_ids is null
     or cardinality(p_servicio_ids) = 0
     or cardinality(p_servicio_ids) > 6 then
    raise exception 'DATOS_INVALIDOS'
      using detail = 'Deben elegirse entre uno y seis servicios.';
  end if;

  if exists (
    select 1
      from unnest(p_servicio_ids) as servicio(servicio_id)
     group by servicio.servicio_id
    having count(*) > 1
  ) then
    raise exception 'DATOS_INVALIDOS'
      using detail = 'Un servicio no puede repetirse dentro de la misma cita.';
  end if;

  select l.zona_horaria
    into v_zona
    from public.locations l
   where l.id = p_location_id
     and l.organization_id = p_organization_id
     and l.activa;

  if v_zona is null then
    raise exception 'NO_ENCONTRADO' using detail = 'Ubicación no disponible.';
  end if;

  v_fecha_local := (p_inicio at time zone v_zona)::date;
  v_hoy_local := (now() at time zone v_zona)::date;
  v_es_express := coalesce(p_es_express, false) or v_fecha_local = v_hoy_local;

  select
    coalesce(s.express_activa, true),
    coalesce(s.recargo_agenda_centavos, 3000),
    coalesce(s.recargo_express_centavos, 5000)
    into v_express_activa, v_recargo_agenda, v_recargo_express
    from public.organization_settings s
   where s.organization_id = p_organization_id;

  v_express_activa := coalesce(v_express_activa, true);
  v_recargo_agenda := coalesce(v_recargo_agenda, 3000);
  v_recargo_express := coalesce(v_recargo_express, 5000);

  if v_es_express and not v_express_activa then
    raise exception 'ANTICIPACION_INSUFICIENTE'
      using detail = 'La barbería no acepta reservaciones para el mismo día.';
  end if;

  v_recargo := case when v_es_express then v_recargo_express else v_recargo_agenda end;

  -- Precio y duración siempre salen del catálogo y de la configuración del barbero.
  for r in
    select
      sv.id,
      sv.nombre,
      coalesce(bs.duracion_override_minutos, sv.duracion_minutos) as duracion_minutos,
      coalesce(bs.precio_override_centavos, sv.precio_centavos) as precio_centavos
      from unnest(p_servicio_ids) with ordinality as u(id, ord)
      join public.services sv
        on sv.id = u.id
       and sv.organization_id = p_organization_id
       and sv.activo
      left join public.barber_services bs
        on bs.servicio_id = sv.id
       and bs.barbero_id = p_barbero_id
     order by u.ord
  loop
    v_encontrados := v_encontrados + 1;
    v_duracion := v_duracion + r.duracion_minutos;
    v_subtotal := v_subtotal + r.precio_centavos;
  end loop;

  if v_encontrados <> cardinality(p_servicio_ids) or v_duracion <= 0 then
    raise exception 'DATOS_INVALIDOS'
      using detail = 'Uno o más servicios no están disponibles para esta barbería.';
  end if;

  if not exists (
    select 1
      from public.fn_slots_disponibles(
        p_organization_id,
        p_location_id,
        p_barbero_id,
        v_fecha_local,
        v_duracion,
        now()
      ) slot
     where slot.inicio = p_inicio
  ) then
    raise exception 'BARBERO_NO_DISPONIBLE'
      using detail = 'El horario no está disponible o queda fuera de la jornada configurada.';
  end if;

  v_fin := p_inicio + make_interval(mins => v_duracion);
  v_total := v_subtotal + v_recargo;
  v_cliente := public.fn_resolver_cliente(p_organization_id, p_telefono, p_nombre);

  loop
    v_folio := public.fn_generar_folio('BQ');
    exit when not exists (
      select 1
        from public.appointments a
       where a.organization_id = p_organization_id
         and a.folio = v_folio
    );
  end loop;

  insert into public.appointments (
    organization_id,
    location_id,
    folio,
    cliente_id,
    barbero_id,
    fecha_hora_inicio,
    fecha_hora_fin,
    estado,
    es_express,
    canal,
    subtotal_centavos,
    recargo_centavos,
    total_centavos,
    notas_cliente,
    creado_por
  ) values (
    p_organization_id,
    p_location_id,
    v_folio,
    v_cliente,
    p_barbero_id,
    p_inicio,
    v_fin,
    'pendiente',
    v_es_express,
    p_canal,
    v_subtotal,
    v_recargo,
    v_total,
    p_notas,
    (select auth.uid())
  ) returning id into v_cita;

  for r in
    select
      sv.id,
      sv.nombre,
      coalesce(bs.duracion_override_minutos, sv.duracion_minutos) as duracion_minutos,
      coalesce(bs.precio_override_centavos, sv.precio_centavos) as precio_centavos
      from unnest(p_servicio_ids) with ordinality as u(id, ord)
      join public.services sv
        on sv.id = u.id
       and sv.organization_id = p_organization_id
       and sv.activo
      left join public.barber_services bs
        on bs.servicio_id = sv.id
       and bs.barbero_id = p_barbero_id
     order by u.ord
  loop
    v_orden := v_orden + 1;
    insert into public.appointment_services (
      organization_id,
      cita_id,
      servicio_id,
      nombre_congelado,
      precio_centavos,
      duracion_minutos,
      orden
    ) values (
      p_organization_id,
      v_cita,
      r.id,
      r.nombre,
      r.precio_centavos,
      r.duracion_minutos,
      v_orden
    );
  end loop;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', cs.servicio_id,
        'nombre', cs.nombre_congelado,
        'precio_centavos', cs.precio_centavos,
        'duracion_minutos', cs.duracion_minutos
      ) order by cs.orden
    ),
    '[]'::jsonb
  )
    into v_servicios
    from public.appointment_services cs
   where cs.organization_id = p_organization_id
     and cs.cita_id = v_cita;

  insert into public.appointment_events (
    organization_id,
    cita_id,
    tipo,
    estado_nuevo,
    fecha_nueva,
    barbero_nuevo_id,
    canal,
    actor,
    usuario_id
  ) values (
    p_organization_id,
    v_cita,
    'creada',
    'pendiente',
    p_inicio,
    p_barbero_id,
    p_canal,
    case when (select auth.uid()) is null then 'cliente' else 'staff' end,
    (select auth.uid())
  );

  v_token := replace(pg_catalog.gen_random_uuid()::text, '-', '')
             || replace(pg_catalog.gen_random_uuid()::text, '-', '');

  insert into public.appointment_access_tokens (
    organization_id,
    cita_id,
    token_hash,
    expira_en
  ) values (
    p_organization_id,
    v_cita,
    pg_catalog.encode(
      pg_catalog.sha256(pg_catalog.convert_to(v_token, 'UTF8')),
      'hex'
    ),
    greatest(v_fin + interval '7 days', now() + interval '30 days')
  );

  return query
  select
    v_cita,
    v_folio,
    v_subtotal,
    v_recargo,
    v_total,
    v_es_express,
    v_fin,
    v_token,
    v_servicios;
end;
$$;

revoke all on function public.fn_crear_cita(
  uuid, uuid, uuid, uuid[], timestamptz, text, text, boolean, public.canal_cita, text
) from public;
grant execute on function public.fn_crear_cita(
  uuid, uuid, uuid, uuid[], timestamptz, text, text, boolean, public.canal_cita, text
) to anon, authenticated;

-- La consulta privada devuelve también los servicios y el desglose del cargo.
drop function if exists public.fn_consultar_cita_publica(uuid, text);

create function public.fn_consultar_cita_publica(
  p_organization_id uuid,
  p_token text
)
returns table (
  cita_id uuid,
  folio text,
  inicio timestamptz,
  fin timestamptz,
  estado public.estado_cita,
  subtotal_centavos integer,
  recargo_centavos integer,
  total_centavos integer,
  es_express boolean,
  servicios jsonb,
  cliente_nombre text,
  barbero_nombre text,
  sucursal_nombre text,
  cancelacion_permitida boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash text;
begin
  if p_token is null or length(p_token) < 40 then
    raise exception 'DATOS_INVALIDOS';
  end if;

  perform public.fn_consumir_limite_publico(
    'consultar_cita', p_organization_id::text || ':' || p_token, 20, 15
  );

  v_hash := pg_catalog.encode(
    pg_catalog.sha256(pg_catalog.convert_to(p_token, 'UTF8')),
    'hex'
  );

  return query
  select
    a.id,
    a.folio,
    a.fecha_hora_inicio,
    a.fecha_hora_fin,
    a.estado,
    a.subtotal_centavos,
    a.recargo_centavos,
    a.total_centavos,
    a.es_express,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', cs.servicio_id,
            'nombre', cs.nombre_congelado,
            'precio_centavos', cs.precio_centavos,
            'duracion_minutos', cs.duracion_minutos
          ) order by cs.orden
        )
          from public.appointment_services cs
         where cs.organization_id = a.organization_id
           and cs.cita_id = a.id
      ),
      '[]'::jsonb
    ),
    c.nombre,
    b.nombre,
    l.nombre,
    (
      a.estado in ('pendiente', 'confirmada')
      and now() < a.fecha_hora_inicio - make_interval(
        hours => coalesce(s.cancelacion_horas_limite, 3)
      )
    )
    from public.appointment_access_tokens t
    join public.appointments a
      on a.id = t.cita_id
     and a.organization_id = t.organization_id
    join public.customers c on c.id = a.cliente_id
    join public.barbers b on b.id = a.barbero_id
    join public.locations l on l.id = a.location_id
    left join public.organization_settings s on s.organization_id = a.organization_id
   where t.organization_id = p_organization_id
     and t.token_hash = v_hash
     and t.revocado_en is null
     and t.expira_en > now();
end;
$$;

revoke all on function public.fn_consultar_cita_publica(uuid, text) from public;
grant execute on function public.fn_consultar_cita_publica(uuid, text) to anon, authenticated;

-- El ticket de venta incorpora el recargo congelado como una línea separada.
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
  v_cita_recargo int := 0;
  v_cita_express boolean := false;
begin
  perform public.fn_exigir_operacion(p_organization_id);

  if p_cita_id is not null then
    select
      a.cliente_id,
      a.barbero_id,
      coalesce(a.recargo_centavos, 0),
      a.es_express
      into v_cita_cliente, v_cita_barbero, v_cita_recargo, v_cita_express
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

  select id into v_caja
    from public.cash_registers
   where organization_id = p_organization_id
     and location_id = p_location_id
     and estado = 'abierta'
   limit 1;

  loop
    v_folio := public.fn_generar_folio('BQ-V');
    exit when not exists (
      select 1
        from public.sales s
       where s.organization_id = p_organization_id
         and s.folio = v_folio
    );
  end loop;

  insert into public.sales (
    organization_id,
    location_id,
    folio,
    tipo,
    cliente_id,
    barbero_id,
    cajero_id,
    cita_id,
    pedido_id,
    corte_caja_id,
    estado,
    notas
  ) values (
    p_organization_id,
    p_location_id,
    v_folio,
    case when p_cita_id is not null then 'cita'
         when p_pedido_id is not null then 'pedido_web'
         else 'mostrador' end,
    p_cliente_id,
    p_barbero_id,
    (select auth.uid()),
    p_cita_id,
    p_pedido_id,
    v_caja,
    'completada',
    p_notas
  ) returning id into v_venta;

  for r in
    select
      (i ->> 'tipo') as tipo,
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
      perform 1
        from public.product_stock
       where producto_id = r.id
         and location_id = p_location_id
       for update;

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
      organization_id,
      venta_id,
      tipo_item,
      producto_id,
      servicio_id,
      descripcion_congelada,
      cantidad,
      precio_unitario_centavos,
      costo_unitario_centavos,
      descuento_centavos,
      total_centavos,
      barbero_id
    ) values (
      p_organization_id,
      v_venta,
      r.tipo,
      case when r.tipo = 'producto' then r.id end,
      case when r.tipo = 'servicio' then r.id end,
      v_desc,
      r.cantidad,
      v_precio,
      v_costo,
      r.descuento,
      greatest(0, v_precio * r.cantidad - r.descuento),
      v_barbero
    ) returning id into v_item_id;

    v_subtotal := v_subtotal + greatest(0, v_precio * r.cantidad - r.descuento);

    if r.tipo = 'producto' then
      insert into public.inventory_movements (
        organization_id,
        location_id,
        producto_id,
        tipo,
        cantidad,
        costo_unitario_centavos,
        referencia_tipo,
        referencia_id,
        usuario_id
      ) values (
        p_organization_id,
        p_location_id,
        r.id,
        'salida_venta',
        -r.cantidad,
        v_costo,
        'venta',
        v_venta,
        (select auth.uid())
      );
    end if;

    if v_barbero is not null then
      if r.tipo = 'servicio' then
        select comision_servicio_tipo, comision_servicio_valor
          into v_com_tipo, v_com_valor
          from public.barbers
         where id = v_barbero;
      else
        select comision_producto_tipo, comision_producto_valor
          into v_com_tipo, v_com_valor
          from public.barbers
         where id = v_barbero;
      end if;

      if coalesce(v_com_valor, 0) > 0 then
        v_monto_com := case
          when v_com_tipo = 'porcentaje' then
            round(
              greatest(0, v_precio * r.cantidad - r.descuento) * v_com_valor / 100.0
            )::int
          else round(v_com_valor * r.cantidad)::int
        end;

        insert into public.commissions (
          organization_id,
          location_id,
          barbero_id,
          venta_id,
          venta_item_id,
          tipo_item,
          base_centavos,
          tipo_calculo,
          valor,
          monto_centavos
        ) values (
          p_organization_id,
          p_location_id,
          v_barbero,
          v_venta,
          v_item_id,
          r.tipo,
          greatest(0, v_precio * r.cantidad - r.descuento),
          v_com_tipo,
          v_com_valor,
          v_monto_com
        );
      end if;
    end if;
  end loop;

  if p_cita_id is not null and v_cita_recargo > 0 then
    insert into public.sale_items (
      organization_id,
      venta_id,
      tipo_item,
      producto_id,
      servicio_id,
      descripcion_congelada,
      cantidad,
      precio_unitario_centavos,
      costo_unitario_centavos,
      descuento_centavos,
      total_centavos,
      barbero_id
    ) values (
      p_organization_id,
      v_venta,
      'servicio',
      null,
      null,
      case when v_cita_express then 'Cargo por cita exprés'
           else 'Cargo por reservación' end,
      1,
      v_cita_recargo,
      0,
      0,
      v_cita_recargo,
      null
    );

    v_subtotal := v_subtotal + v_cita_recargo;
  end if;

  v_total := greatest(0, v_subtotal - coalesce(p_descuento_centavos, 0)) + v_impuestos;

  update public.sales
     set subtotal_centavos = v_subtotal,
         descuento_centavos = coalesce(p_descuento_centavos, 0),
         impuestos_centavos = v_impuestos,
         total_centavos = v_total
   where id = v_venta;

  for p in
    select
      (i ->> 'metodo')::public.metodo_pago as metodo,
      (i ->> 'monto_centavos')::int as monto,
      nullif(i ->> 'referencia', '') as referencia,
      nullif(i ->> 'recibido_centavos', '')::int as recibido
      from jsonb_array_elements(p_pagos) as i
  loop
    insert into public.sale_payments (
      organization_id,
      venta_id,
      metodo_pago,
      monto_centavos,
      referencia,
      recibido_centavos,
      cambio_centavos,
      registrado_por
    ) values (
      p_organization_id,
      v_venta,
      p.metodo,
      p.monto,
      p.referencia,
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
        v_total,
        v_pagado,
        v_total - v_pagado
      );
  end if;

  if p_cita_id is not null then
    update public.appointments
       set estado = 'completada', venta_id = v_venta
     where id = p_cita_id
       and organization_id = p_organization_id;

    insert into public.appointment_events (
      organization_id,
      cita_id,
      tipo,
      estado_nuevo,
      actor,
      usuario_id
    ) values (
      p_organization_id,
      p_cita_id,
      'completada',
      'completada',
      'staff',
      (select auth.uid())
    );
  end if;

  return query select v_venta, v_folio, v_total;
end;
$$;

revoke all on function public.fn_crear_venta(
  uuid, uuid, jsonb, jsonb, uuid, uuid, uuid, uuid, integer, text
) from public;
grant execute on function public.fn_crear_venta(
  uuid, uuid, jsonb, jsonb, uuid, uuid, uuid, uuid, integer, text
) to authenticated;

notify pgrst, 'reload schema';
