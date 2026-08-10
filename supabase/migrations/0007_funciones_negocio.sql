-- ============================================================================
-- 0007 · Funciones transaccionales de negocio
-- ============================================================================
-- El cliente JavaScript de Supabase no abre transacciones de varias sentencias.
-- Como una venta toca cinco tablas, TODA operación compuesta es una función de
-- Postgres llamada con rpc(). Es la decisión estructural del proyecto.
--
-- Todas son `security definer` con `search_path` fijado, verifican la
-- pertenencia del que llama y comprueban que la organización esté operativa.
-- ============================================================================

-- ── Guarda común ────────────────────────────────────────────────────────────
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

-- Limitador transaccional para las operaciones públicas. La clave recibida se
-- convierte en SHA-256 antes de guardarse: nunca persiste el teléfono ni otro
-- identificador personal en texto plano.
create or replace function public.fn_consumir_limite_publico(
  p_accion text,
  p_clave text,
  p_maximo integer default 8,
  p_ventana_minutos integer default 15
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clave text;
  v_ventana timestamptz;
  v_conteo integer;
begin
  -- El personal autenticado ya está sujeto a permisos y auditoría.
  if (select auth.uid()) is not null then return; end if;

  if p_accion is null or p_clave is null or p_maximo < 1
     or p_ventana_minutos not between 1 and 1440 then
    raise exception 'DATOS_INVALIDOS';
  end if;

  v_clave := pg_catalog.encode(
    pg_catalog.sha256(pg_catalog.convert_to(p_accion || ':' || p_clave, 'UTF8')),
    'hex'
  );
  v_ventana := date_bin(
    make_interval(mins => p_ventana_minutos),
    now(),
    timestamptz '2020-01-01 00:00:00+00'
  );

  insert into public.public_attempts (clave, accion, ventana, conteo)
  values (v_clave, p_accion, v_ventana, 1)
  on conflict (clave, accion, ventana)
  do update set conteo = public.public_attempts.conteo + 1
  returning conteo into v_conteo;

  if v_conteo > p_maximo then
    raise exception 'LIMITE_PETICIONES'
      using detail = 'Demasiados intentos. Espera unos minutos e inténtalo nuevamente.';
  end if;
end;
$$;

-- ══════════════════════════════════════════════════════════════════════════
--  AGENDA
-- ══════════════════════════════════════════════════════════════════════════

/**
 * Horarios libres de un barbero en una fecha.
 * Resta del horario semanal: bloqueos, días no laborables, citas vigentes,
 * el colchón entre citas y la anticipación mínima.
 */
create or replace function public.fn_slots_disponibles(
  p_organization_id uuid,
  p_location_id     uuid,
  p_barbero_id      uuid,
  p_fecha           date,
  p_duracion_minutos integer,
  p_ahora           timestamptz default now()
)
returns table (inicio timestamptz, fin timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_zona text;
  v_intervalo int;
  v_colchon int;
  v_anticipacion int;
  v_dia smallint;
  r record;
  v_cursor timestamptz;
  v_fin_slot timestamptz;
begin
  select l.zona_horaria into v_zona from public.locations l where l.id = p_location_id;
  if v_zona is null then return; end if;

  select s.intervalo_slots_minutos, s.colchon_entre_citas_minutos, s.anticipacion_minima_minutos
    into v_intervalo, v_colchon, v_anticipacion
    from public.organization_settings s where s.organization_id = p_organization_id;

  v_intervalo    := coalesce(v_intervalo, 15);
  v_colchon      := coalesce(v_colchon, 0);
  v_anticipacion := coalesce(v_anticipacion, 60);

  -- Día cerrado por festivo o cierre del negocio.
  if exists (
    select 1 from public.non_working_days d
     where d.organization_id = p_organization_id
       and d.fecha = p_fecha
       and (d.location_id is null or d.location_id = p_location_id)
  ) then
    return;
  end if;

  v_dia := extract(dow from p_fecha)::smallint;

  for r in
    select bs.hora_inicio, bs.hora_fin
      from public.barber_schedules bs
     where bs.organization_id = p_organization_id
       and bs.barbero_id = p_barbero_id
       and bs.location_id = p_location_id
       and bs.dia_semana = v_dia
       and bs.activo
     order by bs.hora_inicio
  loop
    -- Hora de pared de la sucursal → instante UTC.
    v_cursor := ((p_fecha + r.hora_inicio) at time zone v_zona);

    while ((p_fecha + r.hora_fin) at time zone v_zona) >= v_cursor + make_interval(mins => p_duracion_minutos) loop
      v_fin_slot := v_cursor + make_interval(mins => p_duracion_minutos);

      if v_cursor >= p_ahora + make_interval(mins => v_anticipacion)
         and not exists (
           select 1 from public.appointments a
            where a.organization_id = p_organization_id
              and a.barbero_id = p_barbero_id
              and a.estado in ('pendiente', 'confirmada', 'en_proceso')
              and a.rango && tstzrange(
                    v_cursor - make_interval(mins => v_colchon),
                    v_fin_slot + make_interval(mins => v_colchon), '[)')
         )
         and not exists (
           select 1 from public.barber_blocks b
            where b.organization_id = p_organization_id
              and b.barbero_id = p_barbero_id
              and tstzrange(b.inicio, b.fin, '[)') && tstzrange(v_cursor, v_fin_slot, '[)')
         )
      then
        inicio := v_cursor;
        fin    := v_fin_slot;
        return next;
      end if;

      v_cursor := v_cursor + make_interval(mins => v_intervalo);
    end loop;
  end loop;
end;
$$;

/** Barberos que pueden atender a una hora concreta. Responde "¿quién más puede?". */
create or replace function public.fn_barberos_disponibles(
  p_organization_id uuid, p_location_id uuid, p_inicio timestamptz, p_duracion_minutos integer
)
returns table (barbero_id uuid, nombre text)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.nombre
    from public.barbers b
    join public.barber_locations bl on bl.barbero_id = b.id and bl.location_id = p_location_id
   where b.organization_id = p_organization_id
     and b.activo
     and not exists (
       select 1 from public.appointments a
        where a.barbero_id = b.id
          and a.estado in ('pendiente', 'confirmada', 'en_proceso')
          and a.rango && tstzrange(p_inicio, p_inicio + make_interval(mins => p_duracion_minutos), '[)')
     )
     and not exists (
       select 1 from public.barber_blocks bk
        where bk.barbero_id = b.id
          and tstzrange(bk.inicio, bk.fin, '[)')
              && tstzrange(p_inicio, p_inicio + make_interval(mins => p_duracion_minutos), '[)')
     )
   order by b.orden, b.nombre;
$$;

/** Resuelve o crea el cliente por teléfono, DENTRO de la organización. */
create or replace function public.fn_resolver_cliente(
  p_organization_id uuid, p_telefono text, p_nombre text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tel text := public.fn_normalizar_telefono(p_telefono);
  v_id uuid;
begin
  if v_tel is null then
    raise exception 'TELEFONO_INVALIDO' using detail = format('recibido: %s', p_telefono);
  end if;

  select id into v_id from public.customers
   where organization_id = p_organization_id and telefono = v_tel;

  if v_id is not null then
    update public.customers set nombre = coalesce(nullif(btrim(p_nombre), ''), nombre)
     where id = v_id;
    return v_id;
  end if;

  insert into public.customers (organization_id, telefono, whatsapp, nombre)
  values (p_organization_id, v_tel, v_tel, coalesce(nullif(btrim(p_nombre), ''), 'Cliente'))
  returning id into v_id;

  return v_id;
end;
$$;

/**
 * Crea una cita. Transaccional.
 *
 * El navegador manda IDs, no precios: el importe se recalcula aquí desde el
 * catálogo. Si el hueco se ocupó mientras el cliente decidía, el constraint de
 * exclusión aborta y la aplicación traduce el error a alternativas reales.
 */
create or replace function public.fn_crear_cita(
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
returns table (cita_id uuid, folio text, total_centavos integer, fin timestamptz, token_acceso text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cliente uuid;
  v_duracion int := 0;
  v_subtotal int := 0;
  v_multiplicador numeric := 1;
  v_folio text;
  v_cita uuid;
  v_fin timestamptz;
  v_fecha_local date;
  v_token text;
  r record;
  v_orden int := 0;
begin
  perform public.fn_exigir_operacion(p_organization_id);
  perform public.fn_consumir_limite_publico(
    'crear_cita', p_organization_id::text || ':' || coalesce(p_telefono, ''), 8, 15
  );

  if p_servicio_ids is null or cardinality(p_servicio_ids) = 0 then
    raise exception 'DATOS_INVALIDOS' using detail = 'Debe elegirse al menos un servicio.';
  end if;

  if p_es_express then
    select coalesce(s.express_multiplicador, 1) into v_multiplicador
      from public.organization_settings s where s.organization_id = p_organization_id;
    v_multiplicador := coalesce(v_multiplicador, 2.0);
  end if;

  -- Precio y duración SIEMPRE desde la tabla, nunca desde el cliente.
  for r in
    select sv.id, sv.nombre, sv.duracion_minutos, sv.precio_centavos, sv.precio_express_centavos,
           bs.precio_override_centavos, bs.duracion_override_minutos
      from unnest(p_servicio_ids) with ordinality as u(id, ord)
      join public.services sv on sv.id = u.id and sv.organization_id = p_organization_id and sv.activo
      left join public.barber_services bs
        on bs.servicio_id = sv.id and bs.barbero_id = p_barbero_id
     order by u.ord
  loop
    v_duracion := v_duracion + coalesce(r.duracion_override_minutos, r.duracion_minutos);
    v_subtotal := v_subtotal + case
      when p_es_express then coalesce(r.precio_express_centavos,
             round(coalesce(r.precio_override_centavos, r.precio_centavos) * v_multiplicador)::int)
      else coalesce(r.precio_override_centavos, r.precio_centavos)
    end;
  end loop;

  if v_duracion = 0 then
    raise exception 'DATOS_INVALIDOS' using detail = 'Ningún servicio válido para esta organización.';
  end if;

  -- No basta con mostrar horarios libres en la interfaz: el RPC vuelve a
  -- validar el hueco para impedir reservas fuera de horario o manipuladas.
  select (p_inicio at time zone l.zona_horaria)::date into v_fecha_local
    from public.locations l
   where l.id = p_location_id and l.organization_id = p_organization_id and l.activa;

  if v_fecha_local is null or not exists (
    select 1
      from public.fn_slots_disponibles(
        p_organization_id, p_location_id, p_barbero_id,
        v_fecha_local, v_duracion, now()
      ) slot
     where slot.inicio = p_inicio
  ) then
    raise exception 'BARBERO_NO_DISPONIBLE'
      using detail = 'El horario no está disponible o queda fuera de la jornada configurada.';
  end if;

  v_fin := p_inicio + make_interval(mins => v_duracion);
  v_cliente := public.fn_resolver_cliente(p_organization_id, p_telefono, p_nombre);

  loop
    v_folio := public.fn_generar_folio('BQ');
    exit when not exists (
      select 1 from public.appointments a
       where a.organization_id = p_organization_id and a.folio = v_folio
    );
  end loop;

  insert into public.appointments (
    organization_id, location_id, folio, cliente_id, barbero_id,
    fecha_hora_inicio, fecha_hora_fin, estado, es_express, canal,
    subtotal_centavos, total_centavos, notas_cliente, creado_por
  ) values (
    p_organization_id, p_location_id, v_folio, v_cliente, p_barbero_id,
    p_inicio, v_fin, 'pendiente', p_es_express, p_canal,
    v_subtotal, v_subtotal, p_notas, (select auth.uid())
  ) returning id into v_cita;

  for r in
    select sv.id, sv.nombre, sv.duracion_minutos, sv.precio_centavos, sv.precio_express_centavos,
           bs.precio_override_centavos, bs.duracion_override_minutos
      from unnest(p_servicio_ids) with ordinality as u(id, ord)
      join public.services sv on sv.id = u.id and sv.organization_id = p_organization_id
      left join public.barber_services bs on bs.servicio_id = sv.id and bs.barbero_id = p_barbero_id
     order by u.ord
  loop
    v_orden := v_orden + 1;
    insert into public.appointment_services (
      organization_id, cita_id, servicio_id, nombre_congelado, precio_centavos, duracion_minutos, orden
    ) values (
      p_organization_id, v_cita, r.id, r.nombre,
      case when p_es_express then coalesce(r.precio_express_centavos,
             round(coalesce(r.precio_override_centavos, r.precio_centavos) * v_multiplicador)::int)
           else coalesce(r.precio_override_centavos, r.precio_centavos) end,
      coalesce(r.duracion_override_minutos, r.duracion_minutos), v_orden
    );
  end loop;

  insert into public.appointment_events (
    organization_id, cita_id, tipo, estado_nuevo, fecha_nueva, barbero_nuevo_id, canal, actor, usuario_id
  ) values (
    p_organization_id, v_cita, 'creada', 'pendiente', p_inicio, p_barbero_id, p_canal,
    case when (select auth.uid()) is null then 'cliente' else 'staff' end, (select auth.uid())
  );

  -- El cliente recibe una sola vez el token de autogestión. La base guarda
  -- únicamente SHA-256, de modo que una filtración no expone enlaces útiles.
  v_token := replace(pg_catalog.gen_random_uuid()::text, '-', '')
             || replace(pg_catalog.gen_random_uuid()::text, '-', '');
  insert into public.appointment_access_tokens (
    organization_id, cita_id, token_hash, expira_en
  ) values (
    p_organization_id,
    v_cita,
    pg_catalog.encode(
      pg_catalog.sha256(pg_catalog.convert_to(v_token, 'UTF8')),
      'hex'
    ),
    greatest(v_fin + interval '7 days', now() + interval '30 days')
  );

  return query select v_cita, v_folio, v_subtotal, v_fin, v_token;
end;
$$;

/** Mueve o reasigna una cita. El constraint de exclusión valida el destino. */
create or replace function public.fn_mover_cita(
  p_organization_id uuid, p_cita_id uuid, p_nuevo_inicio timestamptz,
  p_nuevo_barbero_id uuid default null, p_motivo text default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_ant record;
  v_duracion int;
  v_barbero uuid;
begin
  perform public.fn_exigir_operacion(p_organization_id);
  perform public.fn_consumir_limite_publico(
    'crear_pedido', p_organization_id::text || ':' || coalesce(p_telefono, ''), 12, 15
  );

  select * into v_ant from public.appointments
   where id = p_cita_id and organization_id = p_organization_id for update;
  if not found then raise exception 'NO_ENCONTRADO'; end if;

  v_duracion := extract(epoch from (v_ant.fecha_hora_fin - v_ant.fecha_hora_inicio)) / 60;
  v_barbero  := coalesce(p_nuevo_barbero_id, v_ant.barbero_id);

  update public.appointments
     set fecha_hora_inicio = p_nuevo_inicio,
         fecha_hora_fin = p_nuevo_inicio + make_interval(mins => v_duracion),
         barbero_id = v_barbero
   where id = p_cita_id;

  insert into public.appointment_events (
    organization_id, cita_id, tipo, fecha_anterior, fecha_nueva,
    barbero_anterior_id, barbero_nuevo_id, motivo, actor, usuario_id
  ) values (
    p_organization_id, p_cita_id,
    case when v_barbero <> v_ant.barbero_id then 'barbero_cambiado' else 'reprogramada' end,
    v_ant.fecha_hora_inicio, p_nuevo_inicio, v_ant.barbero_id, v_barbero, p_motivo,
    case when (select auth.uid()) is null then 'cliente' else 'staff' end, (select auth.uid())
  );

  -- Los recordatorios de la fecha vieja se cancelan; los nuevos se encolarán.
  update public.whatsapp_messages
     set estado = 'cancelado'
   where cita_id = p_cita_id and estado in ('pendiente', 'listo_para_envio', 'manual_pendiente');
end;
$$;

/** Cancela una cita. El motivo es obligatorio y el hueco queda libre. */
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
    case when (select auth.uid()) is null then 'cliente' else 'staff' end, (select auth.uid())
  );

  update public.whatsapp_messages
     set estado = 'cancelado'
   where cita_id = p_cita_id and estado in ('pendiente', 'listo_para_envio', 'manual_pendiente');
end;
$$;

/** Consulta una cita sin cuenta mediante el token emitido al reservar. */
create or replace function public.fn_consultar_cita_publica(
  p_organization_id uuid, p_token text
)
returns table (
  cita_id uuid,
  folio text,
  inicio timestamptz,
  fin timestamptz,
  estado public.estado_cita,
  total_centavos integer,
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
  select a.id, a.folio, a.fecha_hora_inicio, a.fecha_hora_fin, a.estado,
         a.total_centavos, c.nombre, b.nombre, l.nombre,
         (
           a.estado in ('pendiente', 'confirmada')
           and now() < a.fecha_hora_inicio - make_interval(
             hours => coalesce(s.cancelacion_horas_limite, 3)
           )
         )
    from public.appointment_access_tokens t
    join public.appointments a
      on a.id = t.cita_id and a.organization_id = t.organization_id
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

/** Cancela una cita pública solo si presenta su token y aún está en plazo. */
create or replace function public.fn_cancelar_cita_publica(
  p_organization_id uuid, p_token text, p_motivo text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash text;
  v_cita uuid;
  v_inicio timestamptz;
  v_estado public.estado_cita;
  v_limite integer;
begin
  perform public.fn_exigir_operacion(p_organization_id);
  perform public.fn_consumir_limite_publico(
    'cancelar_cita', p_organization_id::text || ':' || coalesce(p_token, ''), 8, 15
  );
  v_hash := pg_catalog.encode(
    pg_catalog.sha256(pg_catalog.convert_to(coalesce(p_token, ''), 'UTF8')),
    'hex'
  );

  select a.id, a.fecha_hora_inicio, a.estado, coalesce(s.cancelacion_horas_limite, 3)
    into v_cita, v_inicio, v_estado, v_limite
    from public.appointment_access_tokens t
    join public.appointments a
      on a.id = t.cita_id and a.organization_id = t.organization_id
    left join public.organization_settings s on s.organization_id = a.organization_id
   where t.organization_id = p_organization_id
     and t.token_hash = v_hash
     and t.revocado_en is null
     and t.expira_en > now()
   for update of a;

  if v_cita is null then raise exception 'NO_ENCONTRADO'; end if;
  if v_estado not in ('pendiente', 'confirmada')
     or now() >= v_inicio - make_interval(hours => v_limite) then
    raise exception 'DATOS_INVALIDOS'
      using detail = 'La cita ya no puede cancelarse en línea.';
  end if;

  perform public.fn_cancelar_cita(p_organization_id, v_cita, p_motivo, 'web');
  update public.appointment_access_tokens set usado_en = now()
   where organization_id = p_organization_id and token_hash = v_hash;
end;
$$;

-- ══════════════════════════════════════════════════════════════════════════
--  PEDIDOS Y RESERVAS DE INVENTARIO
-- ══════════════════════════════════════════════════════════════════════════

/** Crea el pedido y reserva las piezas. Si una línea no alcanza, revierte todo. */
create or replace function public.fn_crear_pedido_con_reserva(
  p_organization_id uuid, p_location_id uuid, p_items jsonb,
  p_nombre text, p_telefono text, p_notas text default null
)
returns table (pedido_id uuid, folio text, total_centavos integer, expira_en timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare
  v_minutos int;
  v_activa boolean;
  v_expira timestamptz;
  v_folio text;
  v_pedido uuid;
  v_total int := 0;
  v_tel text;
  v_cliente uuid;
  r record;
  v_disponible int;
  v_precio int;
  v_nombre_prod text;
begin
  perform public.fn_exigir_operacion(p_organization_id);

  v_tel := public.fn_normalizar_telefono(p_telefono);
  if v_tel is null then raise exception 'TELEFONO_INVALIDO'; end if;

  select coalesce(reserva_pedido_minutos, 60), coalesce(reserva_pedido_activa, true)
    into v_minutos, v_activa
    from public.organization_settings where organization_id = p_organization_id;

  v_minutos := coalesce(v_minutos, 60);
  v_expira  := now() + make_interval(mins => v_minutos);

  loop
    v_folio := public.fn_generar_folio('BQ-P');
    exit when not exists (
      select 1 from public.orders o where o.organization_id = p_organization_id and o.folio = v_folio
    );
  end loop;

  v_cliente := public.fn_resolver_cliente(p_organization_id, v_tel, p_nombre);

  insert into public.orders (
    organization_id, location_id, folio, cliente_id, cliente_nombre, cliente_telefono,
    estado, notas, reserva_expira_en
  ) values (
    p_organization_id, p_location_id, v_folio, v_cliente, coalesce(nullif(btrim(p_nombre), ''), 'Cliente'),
    v_tel, 'nuevo', p_notas, case when coalesce(v_activa, true) then v_expira end
  ) returning id into v_pedido;

  for r in
    select (i ->> 'producto_id')::uuid as producto_id, (i ->> 'cantidad')::int as cantidad
      from jsonb_array_elements(p_items) as i
  loop
    if r.cantidad is null or r.cantidad <= 0 then
      raise exception 'DATOS_INVALIDOS' using detail = 'Cantidad inválida en el pedido.';
    end if;

    -- Bloqueo de la fila de existencias antes de comprobar disponibilidad.
    perform 1 from public.product_stock
      where producto_id = r.producto_id and location_id = p_location_id for update;

    select p.precio_venta_centavos, p.nombre into v_precio, v_nombre_prod
      from public.products p
     where p.id = r.producto_id and p.organization_id = p_organization_id and p.activo;

    if v_precio is null then
      raise exception 'NO_ENCONTRADO' using detail = 'Producto no disponible en esta barbería.';
    end if;

    v_disponible := public.fn_stock_disponible(r.producto_id, p_location_id);

    if v_disponible < r.cantidad then
      raise exception 'STOCK_INSUFICIENTE'
        using detail = format('producto=%s disponible=%s solicitado=%s',
                              v_nombre_prod, v_disponible, r.cantidad);
    end if;

    insert into public.order_items (
      organization_id, pedido_id, producto_id, nombre_congelado, cantidad,
      precio_unitario_centavos, total_centavos
    ) values (
      p_organization_id, v_pedido, r.producto_id, v_nombre_prod, r.cantidad,
      v_precio, v_precio * r.cantidad
    );

    if coalesce(v_activa, true) then
      insert into public.inventory_reservations (
        organization_id, location_id, pedido_id, producto_id, cantidad, expira_en, creado_por
      ) values (
        p_organization_id, p_location_id, v_pedido, r.producto_id, r.cantidad, v_expira, (select auth.uid())
      );
    end if;

    v_total := v_total + v_precio * r.cantidad;
  end loop;

  if v_total = 0 then
    raise exception 'DATOS_INVALIDOS' using detail = 'El pedido no tiene artículos.';
  end if;

  update public.orders set subtotal_centavos = v_total, total_centavos = v_total where id = v_pedido;

  return query select v_pedido, v_folio, v_total, v_expira;
end;
$$;

/** Libera las reservas vencidas. Idempotente: la ejecuta pg_cron cada 5 min. */
create or replace function public.fn_liberar_reservas_vencidas()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare v_n int;
begin
  with liberadas as (
    update public.inventory_reservations
       set estado = 'liberada', liberada_en = now()
     where estado = 'activa' and expira_en <= now()
    returning pedido_id
  )
  select count(*) into v_n from liberadas;

  -- Un pedido nuevo sin reservas activas queda vencido.
  update public.orders o
     set estado = 'vencido', cancelado_en = now(),
         motivo_cancelacion = 'La reservación de inventario expiró'
   where o.estado = 'nuevo'
     and o.reserva_expira_en is not null
     and o.reserva_expira_en <= now()
     and not exists (
       select 1 from public.inventory_reservations r
        where r.pedido_id = o.id and r.estado = 'activa'
     );

  return coalesce(v_n, 0);
end;
$$;

/** Cancela un pedido y libera sus reservas. */
create or replace function public.fn_cancelar_pedido(
  p_organization_id uuid, p_pedido_id uuid, p_motivo text
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.fn_exigir_operacion(p_organization_id);

  update public.orders
     set estado = 'cancelado', cancelado_en = now(), motivo_cancelacion = coalesce(p_motivo, 'Cancelado')
   where id = p_pedido_id and organization_id = p_organization_id and estado not in ('entregado');

  update public.inventory_reservations
     set estado = 'cancelada', liberada_en = now()
   where pedido_id = p_pedido_id and estado = 'activa';
end;
$$;

-- ══════════════════════════════════════════════════════════════════════════
--  VENTAS
-- ══════════════════════════════════════════════════════════════════════════

/**
 * Registra una venta completa en una sola transacción.
 *
 * El navegador manda IDs y cantidades. Los precios se releen del catálogo
 * DENTRO de la transacción: manipularlos desde las herramientas del navegador
 * no tiene efecto. Los pagos deben sumar exactamente el total, y el constraint
 * diferido lo comprueba al hacer commit.
 */
create or replace function public.fn_crear_venta(
  p_organization_id uuid,
  p_location_id     uuid,
  p_items           jsonb,   -- [{tipo, id, cantidad, descuento_centavos?, barbero_id?}]
  p_pagos           jsonb,   -- [{metodo, monto_centavos, referencia?, recibido_centavos?}]
  p_cliente_id      uuid default null,
  p_barbero_id      uuid default null,
  p_cita_id         uuid default null,
  p_pedido_id       uuid default null,
  p_descuento_centavos integer default 0,
  p_notas           text default null
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
begin
  perform public.fn_exigir_operacion(p_organization_id);

  select id into v_caja from public.cash_registers
   where organization_id = p_organization_id and location_id = p_location_id and estado = 'abierta'
   limit 1;

  loop
    v_folio := public.fn_generar_folio('BQ-V');
    exit when not exists (
      select 1 from public.sales s where s.organization_id = p_organization_id and s.folio = v_folio
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

    v_barbero := coalesce(r.barbero_id, p_barbero_id);

    if r.tipo = 'producto' then
      -- Bloqueo antes de leer precio y descontar.
      perform 1 from public.product_stock
        where producto_id = r.id and location_id = p_location_id for update;

      select pr.precio_venta_centavos, pr.costo_centavos, pr.nombre
        into v_precio, v_costo, v_desc
        from public.products pr
       where pr.id = r.id and pr.organization_id = p_organization_id and pr.activo;

      if v_precio is null then
        raise exception 'NO_ENCONTRADO' using detail = 'Producto no disponible.';
      end if;

    elsif r.tipo = 'servicio' then
      select sv.precio_centavos, 0, sv.nombre into v_precio, v_costo, v_desc
        from public.services sv
       where sv.id = r.id and sv.organization_id = p_organization_id and sv.activo;

      if v_precio is null then
        raise exception 'NO_ENCONTRADO' using detail = 'Servicio no disponible.';
      end if;
    else
      raise exception 'DATOS_INVALIDOS' using detail = 'tipo_item debe ser producto o servicio.';
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

    -- El descuento de stock es parte de la MISMA transacción.
    if r.tipo = 'producto' then
      insert into public.inventory_movements (
        organization_id, location_id, producto_id, tipo, cantidad,
        costo_unitario_centavos, referencia_tipo, referencia_id, usuario_id
      ) values (
        p_organization_id, p_location_id, r.id, 'salida_venta', -r.cantidad,
        v_costo, 'venta', v_venta, (select auth.uid())
      );
    end if;

    -- Comisión del barbero por línea.
    if v_barbero is not null then
      if r.tipo = 'servicio' then
        select comision_servicio_tipo, comision_servicio_valor into v_com_tipo, v_com_valor
          from public.barbers where id = v_barbero;
      else
        select comision_producto_tipo, comision_producto_valor into v_com_tipo, v_com_valor
          from public.barbers where id = v_barbero;
      end if;

      if coalesce(v_com_valor, 0) > 0 then
        v_monto_com := case
          when v_com_tipo = 'porcentaje'
            then round(greatest(0, v_precio * r.cantidad - r.descuento) * v_com_valor / 100.0)::int
          else round(v_com_valor * r.cantidad)::int
        end;

        insert into public.commissions (
          organization_id, location_id, barbero_id, venta_id, venta_item_id, tipo_item,
          base_centavos, tipo_calculo, valor, monto_centavos
        ) values (
          p_organization_id, p_location_id, v_barbero, v_venta, v_item_id, r.tipo,
          greatest(0, v_precio * r.cantidad - r.descuento), v_com_tipo, v_com_valor, v_monto_com
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

  -- Comprobación temprana con mensaje claro; el constraint diferido es la red.
  if v_pagado <> v_total then
    raise exception 'PAGOS_NO_CUADRAN'
      using detail = format('total=%s pagado=%s diferencia=%s', v_total, v_pagado, v_total - v_pagado);
  end if;

  if p_cita_id is not null then
    update public.appointments
       set estado = 'completada', venta_id = v_venta
     where id = p_cita_id and organization_id = p_organization_id;

    insert into public.appointment_events (
      organization_id, cita_id, tipo, estado_nuevo, actor, usuario_id
    ) values (p_organization_id, p_cita_id, 'completada', 'completada', 'staff', (select auth.uid()));
  end if;

  return query select v_venta, v_folio, v_total;
end;
$$;

/**
 * Convierte un pedido en venta. ÚNICO punto donde el stock físico baja por un
 * pedido web.
 *
 * La conversión no pregunta "¿ya se convirtió?": lo resuelve en la escritura.
 * El UPDATE exige `estado = 'activa'`; si otra llamada ya convirtió, afecta
 * cero filas y la función aborta sin descontar dos veces.
 */
create or replace function public.fn_convertir_pedido_en_venta(
  p_organization_id uuid, p_pedido_id uuid, p_pagos jsonb
)
returns table (venta_id uuid, folio text, total_centavos integer)
language plpgsql security definer set search_path = ''
as $$
declare
  v_pedido record;
  v_items jsonb;
  v_convertidas int;
  v_res record;
begin
  perform public.fn_exigir_operacion(p_organization_id);

  select * into v_pedido from public.orders
   where id = p_pedido_id and organization_id = p_organization_id for update;
  if not found then raise exception 'NO_ENCONTRADO'; end if;

  if v_pedido.venta_id is not null then
    raise exception 'PEDIDO_YA_CONVERTIDO'
      using detail = format('El pedido %s ya generó la venta %s', v_pedido.folio, v_pedido.venta_id);
  end if;

  if v_pedido.estado in ('cancelado', 'vencido') then
    raise exception 'RESERVA_VENCIDA'
      using detail = 'El pedido está cancelado o vencido; las piezas se liberaron.';
  end if;

  -- Marca las reservas como convertidas. Si otra transacción se adelantó,
  -- v_convertidas queda en 0 y abortamos: no se descuenta dos veces.
  with convertidas as (
    update public.inventory_reservations
       set estado = 'convertida', convertida_en_venta_en = now()
     where pedido_id = p_pedido_id and estado = 'activa'
    returning producto_id, cantidad
  )
  select count(*) into v_convertidas from convertidas;

  -- Si había reservas activas y ninguna se convirtió, otra llamada ganó.
  if v_convertidas = 0 and exists (
    select 1 from public.inventory_reservations where pedido_id = p_pedido_id
  ) then
    raise exception 'PEDIDO_YA_CONVERTIDO'
      using detail = 'Otra operación convirtió este pedido primero.';
  end if;

  -- Revalidación de disponibilidad por si la reserva había vencido.
  for v_res in
    select oi.producto_id, oi.cantidad from public.order_items oi where oi.pedido_id = p_pedido_id
  loop
    perform 1 from public.product_stock
      where producto_id = v_res.producto_id and location_id = v_pedido.location_id for update;

    if coalesce((select stock_actual from public.product_stock
                  where producto_id = v_res.producto_id and location_id = v_pedido.location_id), 0)
       < v_res.cantidad then
      raise exception 'STOCK_INSUFICIENTE'
        using detail = format('producto=%s solicitado=%s', v_res.producto_id, v_res.cantidad);
    end if;
  end loop;

  select jsonb_agg(jsonb_build_object('tipo', 'producto', 'id', oi.producto_id, 'cantidad', oi.cantidad))
    into v_items
    from public.order_items oi where oi.pedido_id = p_pedido_id;

  return query
    select * from public.fn_crear_venta(
      p_organization_id, v_pedido.location_id, v_items, p_pagos,
      v_pedido.cliente_id, null, null, p_pedido_id, 0, 'Pedido ' || v_pedido.folio
    );
end;
$$;

-- La venta enlaza de vuelta con el pedido y lo marca entregado.
create or replace function public.trg_pedido_entregado()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.pedido_id is not null then
    update public.orders
       set estado = 'entregado', venta_id = new.id, entregado_en = now()
     where id = new.pedido_id;

    update public.inventory_reservations
       set venta_id = new.id
     where pedido_id = new.pedido_id and estado = 'convertida' and venta_id is null;
  end if;
  return null;
end;
$$;

create trigger pedido_entregado_al_vender
  after insert on public.sales
  for each row execute function public.trg_pedido_entregado();

/** Cancela una venta: repone stock y revierte comisiones. */
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

/** Cierra la caja: calcula el esperado desde pagos_venta, no desde ventas. */
create or replace function public.fn_cerrar_caja(
  p_organization_id uuid, p_caja_id uuid, p_efectivo_contado_centavos integer, p_notas text default null
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
