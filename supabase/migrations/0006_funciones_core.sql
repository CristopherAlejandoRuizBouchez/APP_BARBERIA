-- ============================================================================
-- 0006 · Funciones y triggers de base
-- ============================================================================

-- ── Utilidades ──────────────────────────────────────────────────────────────

/** Normaliza un teléfono mexicano a E.164 (+52 + 10 dígitos). NULL si no es válido. */
create or replace function public.fn_normalizar_telefono(p_entrada text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_digitos text;
  v_nacional text;
begin
  if p_entrada is null or btrim(p_entrada) = '' then return null; end if;

  v_digitos := regexp_replace(p_entrada, '\D', '', 'g');

  -- Lada de país explícita distinta de 52 → no es mexicano.
  if left(btrim(p_entrada), 1) = '+' and left(v_digitos, 2) <> '52' then
    return null;
  end if;

  if length(v_digitos) = 10 then
    v_nacional := v_digitos;
  elsif length(v_digitos) = 12 and left(v_digitos, 2) = '52' then
    v_nacional := right(v_digitos, 10);
  elsif length(v_digitos) = 13 and left(v_digitos, 3) = '521' then
    -- El "1" del formato antiguo de WhatsApp; México ya no lo marca.
    v_nacional := right(v_digitos, 10);
  else
    return null;
  end if;

  -- Ninguna lada mexicana empieza en 0 ni en 1.
  if left(v_nacional, 1) in ('0', '1') then return null; end if;

  return '+52' || v_nacional;
end;
$$;

/** Convierte un texto a slug: "Corte Clásico" → "corte-clasico". */
create or replace function public.fn_slug(p_texto text)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(both '-' from
    regexp_replace(
      regexp_replace(lower(public.unaccent(coalesce(p_texto, ''))), '[^a-z0-9]+', '-', 'g'),
      '-{2,}', '-', 'g'
    )
  );
$$;

/** Slug único dentro de una organización: añade -2, -3… si ya existe. */
create or replace function public.fn_slug_unico(
  p_tabla text, p_organization_id uuid, p_texto text, p_excluir_id uuid default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base text := public.fn_slug(p_texto);
  v_slug text;
  v_n int := 1;
  v_existe boolean;
begin
  if v_base = '' then v_base := 'sin-nombre'; end if;
  v_slug := v_base;

  loop
    execute format(
      'select exists (select 1 from public.%I where organization_id = $1 and slug = $2 and ($3 is null or id <> $3))',
      p_tabla
    ) into v_existe using p_organization_id, v_slug, p_excluir_id;

    exit when not v_existe;
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;

  return v_slug;
end;
$$;

/** Folio corto, legible en voz alta y NO correlativo (no se puede enumerar). */
create or replace function public.fn_generar_folio(p_prefijo text)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  -- Sin 0/O, 1/I/L ni U/V: los caracteres que se confunden al dictar.
  v_alfabeto text := '23456789ABCDEFGHJKMNPQRSTWXYZ';
  v_sufijo text := '';
  i int;
begin
  for i in 1..4 loop
    v_sufijo := v_sufijo || substr(v_alfabeto, 1 + floor(random() * length(v_alfabeto))::int, 1);
  end loop;
  return p_prefijo || '-' || v_sufijo;
end;
$$;

-- ── actualizado_en ──────────────────────────────────────────────────────────
create or replace function public.trg_actualizado_en()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

-- ══════════════════════════════════════════════════════════════════════════
--  STOCK: el saldo solo cambia asentando un movimiento
--
--  `product_stock.stock_actual` no se escribe nunca a mano. La única forma de
--  moverlo es insertar en `inventory_movements`, y este trigger aplica el
--  cambio con bloqueo de fila. Resultado: el saldo y el libro mayor no pueden
--  divergir, y un stock negativo es imposible.
-- ══════════════════════════════════════════════════════════════════════════
create or replace function public.trg_aplicar_movimiento_inventario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stock int;
begin
  -- Crea la fila de existencias si es la primera vez que se toca el producto
  -- en esa sucursal.
  insert into public.product_stock (producto_id, location_id, organization_id, stock_actual)
  values (new.producto_id, new.location_id, new.organization_id, 0)
  on conflict (producto_id, location_id) do nothing;

  select stock_actual into v_stock
    from public.product_stock
   where producto_id = new.producto_id
     and location_id = new.location_id
   for update;                                    -- bloqueo: serializa concurrentes

  new.stock_anterior := v_stock;
  new.stock_nuevo    := v_stock + new.cantidad;

  if new.stock_nuevo < 0 then
    raise exception 'STOCK_INSUFICIENTE'
      using detail = format('producto=%s sucursal=%s disponible=%s solicitado=%s',
                            new.producto_id, new.location_id, v_stock, abs(new.cantidad)),
            errcode = 'check_violation';
  end if;

  update public.product_stock
     set stock_actual = new.stock_nuevo, actualizado_en = now()
   where producto_id = new.producto_id and location_id = new.location_id;

  return new;
end;
$$;

create trigger aplicar_movimiento_inventario
  before insert on public.inventory_movements
  for each row execute function public.trg_aplicar_movimiento_inventario();

-- Los movimientos son inmutables también a nivel de trigger, no solo de RLS.
create or replace function public.trg_movimiento_inmutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'MOVIMIENTO_INMUTABLE'
    using detail = 'Los movimientos de inventario no se editan ni se borran. Registra un ajuste.';
end;
$$;

create trigger movimiento_no_editable
  before update or delete on public.inventory_movements
  for each row execute function public.trg_movimiento_inmutable();

/** Stock disponible = físico − reservas activas no vencidas. */
create or replace function public.fn_stock_disponible(
  p_producto_id uuid, p_location_id uuid, p_ahora timestamptz default now()
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select ps.stock_actual from public.product_stock ps
      where ps.producto_id = p_producto_id and ps.location_id = p_location_id), 0
  ) - coalesce(
    (select sum(r.cantidad) from public.inventory_reservations r
      where r.producto_id = p_producto_id
        and r.location_id = p_location_id
        and r.estado = 'activa'
        and r.expira_en > p_ahora), 0
  );
$$;

-- ══════════════════════════════════════════════════════════════════════════
--  PAGOS DIVIDIDOS: la suma debe cuadrar al centavo
--
--  Se usa un CONSTRAINT TRIGGER DIFERIDO: la comprobación ocurre al hacer
--  commit, no línea por línea. Así una venta puede insertar sus pagos en
--  varias sentencias dentro de la misma transacción y aun así no puede
--  confirmarse descuadrada.
-- ══════════════════════════════════════════════════════════════════════════
create or replace function public.fn_validar_pagos_venta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venta_id uuid := coalesce(new.venta_id, old.venta_id);
  v_total int;
  v_estado public.estado_venta;
  v_pagado int;
begin
  select total_centavos, estado into v_total, v_estado
    from public.sales where id = v_venta_id;

  if not found or v_estado <> 'completada' then
    return null;                                  -- borradores y canceladas exentas
  end if;

  select coalesce(sum(monto_centavos), 0) into v_pagado
    from public.sale_payments where venta_id = v_venta_id;

  if v_pagado <> v_total then
    raise exception 'PAGOS_NO_CUADRAN'
      using detail = format('venta=%s total=%s pagado=%s diferencia=%s',
                            v_venta_id, v_total, v_pagado, v_total - v_pagado);
  end if;

  return null;
end;
$$;

create constraint trigger pagos_cuadran
  after insert or update or delete on public.sale_payments
  deferrable initially deferred
  for each row execute function public.fn_validar_pagos_venta();

create or replace function public.fn_validar_venta_completada()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_pagado int;
begin
  if new.estado <> 'completada' then return null; end if;

  select coalesce(sum(monto_centavos), 0) into v_pagado
    from public.sale_payments where venta_id = new.id;

  if v_pagado <> new.total_centavos then
    raise exception 'PAGOS_NO_CUADRAN'
      using detail = format('venta=%s total=%s pagado=%s', new.id, new.total_centavos, v_pagado);
  end if;
  return null;
end;
$$;

create constraint trigger venta_completada_cuadra
  after insert or update of estado, total_centavos on public.sales
  deferrable initially deferred
  for each row execute function public.fn_validar_venta_completada();

-- Resumen denormalizado de métodos, solo para listados.
create or replace function public.trg_resumen_metodos_venta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venta_id uuid := coalesce(new.venta_id, old.venta_id);
  v_metodos text;
  v_n int;
begin
  select string_agg(distinct metodo_pago::text, '+' order by metodo_pago::text), count(distinct metodo_pago)
    into v_metodos, v_n
    from public.sale_payments where venta_id = v_venta_id;

  update public.sales
     set metodos_resumen = v_metodos,
         es_pago_mixto = coalesce(v_n, 0) > 1
   where id = v_venta_id;

  return null;
end;
$$;

create trigger resumen_metodos_venta
  after insert or update or delete on public.sale_payments
  for each row execute function public.trg_resumen_metodos_venta();

-- ── Métricas del cliente ────────────────────────────────────────────────────
create or replace function public.trg_metricas_cliente()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.cliente_id is null or new.estado <> 'completada' then return null; end if;

  update public.customers c
     set total_visitas = c.total_visitas + 1,
         total_gastado_centavos = c.total_gastado_centavos + new.total_centavos,
         ultima_visita = new.creado_en,
         primera_visita = coalesce(c.primera_visita, new.creado_en),
         actualizado_en = now()
   where c.id = new.cliente_id;

  return null;
end;
$$;

create trigger metricas_cliente_al_vender
  after insert on public.sales
  for each row execute function public.trg_metricas_cliente();

-- ── Auditoría genérica ──────────────────────────────────────────────────────
create or replace function public.trg_auditoria()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_id uuid;
begin
  begin
    v_org := coalesce(
      (to_jsonb(new) ->> 'organization_id')::uuid,
      (to_jsonb(old) ->> 'organization_id')::uuid
    );
  exception when others then v_org := null;
  end;

  v_id := coalesce((to_jsonb(new) ->> 'id')::uuid, (to_jsonb(old) ->> 'id')::uuid);

  insert into public.audit_log (
    organization_id, tabla, registro_id, accion, datos_anteriores, datos_nuevos, usuario_id
  ) values (
    v_org, tg_table_name, v_id, lower(tg_op)::public.accion_auditoria,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end,
    (select auth.uid())
  );

  return null;
end;
$$;

-- La bitácora nunca se edita ni se borra, ni siquiera por el superadministrador.
create or replace function public.trg_auditoria_inmutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'AUDITORIA_INMUTABLE'
    using detail = 'La bitácora es solo de escritura. Una bitácora editable no sirve como evidencia.';
end;
$$;

create trigger auditoria_no_editable
  before update or delete on public.audit_log
  for each row execute function public.trg_auditoria_inmutable();

-- Tablas auditadas.
do $$
declare t text;
begin
  foreach t in array array[
    'organizations', 'locations', 'organization_members', 'organization_settings',
    'organization_themes', 'billing_accounts', 'manual_payments',
    'products', 'services', 'barbers', 'sales', 'appointments', 'expenses', 'commissions'
  ] loop
    execute format(
      'create trigger auditar_%1$s after insert or update or delete on public.%1$I
         for each row execute function public.trg_auditoria()', t
    );
  end loop;
end $$;

-- actualizado_en en las tablas que lo tienen.
do $$
declare t text;
begin
  foreach t in array array[
    'organizations', 'locations', 'profiles', 'organization_settings', 'organization_themes',
    'barbers', 'services', 'products', 'customers', 'appointments', 'billing_accounts'
  ] loop
    execute format(
      'create trigger fijar_actualizado_en_%1$s before update on public.%1$I
         for each row execute function public.trg_actualizado_en()', t
    );
  end loop;
end $$;
