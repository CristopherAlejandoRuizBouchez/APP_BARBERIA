-- ============================================================================
-- 0005 · Inventario, pedidos, ventas y finanzas
-- ============================================================================
-- Dos invariantes que la base garantiza por sí sola:
--   1. El stock nunca puede quedar negativo.
--   2. La suma de los pagos de una venta completada es exactamente su total.
-- ============================================================================

-- ── Proveedores ─────────────────────────────────────────────────────────────
create table suppliers (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  nombre          text not null,
  contacto        text,
  telefono        text,
  correo          citext,
  dias_entrega    integer,
  notas           text,
  activo          boolean not null default true,
  creado_en       timestamptz not null default now(),
  unique (id, organization_id)
);

-- ── Categorías de producto ──────────────────────────────────────────────────
create table product_categories (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  slug            citext not null,
  nombre          text not null,
  orden           integer not null default 0,
  activa          boolean not null default true,
  unique (organization_id, slug),
  unique (id, organization_id)
);

-- ── Productos ───────────────────────────────────────────────────────────────
-- El stock NO vive aquí: vive en product_stock, por sucursal.
create table products (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references organizations (id) on delete cascade,
  categoria_id          uuid,
  proveedor_id          uuid,
  sku                   citext not null,
  codigo_barras         citext,
  slug                  citext not null,
  nombre                text not null,
  marca                 text,
  descripcion           text,
  imagen_url            text,
  imagenes              jsonb not null default '[]'::jsonb,
  precio_venta_centavos integer not null check (precio_venta_centavos >= 0),
  costo_centavos        integer not null default 0 check (costo_centavos >= 0),
  unidad                text not null default 'pieza',
  visible_en_tienda     boolean not null default true,
  destacado             boolean not null default false,
  activo                boolean not null default true,
  creado_en             timestamptz not null default now(),
  actualizado_en        timestamptz not null default now(),

  unique (organization_id, sku),
  unique (organization_id, slug),
  unique (id, organization_id),
  foreign key (categoria_id, organization_id) references product_categories (id, organization_id) on delete set null,
  foreign key (proveedor_id, organization_id) references suppliers (id, organization_id) on delete set null
);

-- El código de barras es único dentro de la organización cuando existe.
create unique index products_codigo_barras_unico
  on products (organization_id, codigo_barras) where codigo_barras is not null;

-- ── Existencias por sucursal ────────────────────────────────────────────────
create table product_stock (
  producto_id     uuid not null,
  location_id     uuid not null references locations (id) on delete cascade,
  organization_id uuid not null references organizations (id) on delete cascade,
  stock_actual    integer not null default 0,
  stock_minimo    integer not null default 0 check (stock_minimo >= 0),
  actualizado_en  timestamptz not null default now(),

  primary key (producto_id, location_id),
  foreign key (producto_id, organization_id) references products (id, organization_id) on delete cascade,

  -- Invariante 1: jamás negativo, en ninguna circunstancia.
  constraint stock_no_negativo check (stock_actual >= 0)
);

comment on constraint stock_no_negativo on product_stock is
  'Última línea de defensa. La lógica de negocio también valida, pero esto no se puede evadir.';

-- ── Movimientos de inventario (libro mayor inmutable) ───────────────────────
create table inventory_movements (
  id                      uuid primary key default gen_random_uuid(),
  organization_id         uuid not null references organizations (id) on delete cascade,
  location_id             uuid not null references locations (id) on delete restrict,
  producto_id             uuid not null,
  tipo                    tipo_movimiento_inventario not null,
  cantidad                integer not null check (cantidad <> 0),  -- con signo
  stock_anterior          integer not null,
  stock_nuevo             integer not null check (stock_nuevo >= 0),
  costo_unitario_centavos integer check (costo_unitario_centavos >= 0),
  referencia_tipo         text,
  referencia_id           uuid,
  motivo                  text,
  usuario_id              uuid references auth.users (id) on delete set null,
  creado_en               timestamptz not null default now(),

  foreign key (producto_id, organization_id) references products (id, organization_id) on delete restrict
);

comment on table inventory_movements is
  'Inmutable: sin políticas de UPDATE ni DELETE para ningún rol. El saldo de product_stock es siempre la suma de estos movimientos.';

-- ── Compras a proveedor ─────────────────────────────────────────────────────
create table purchases (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations (id) on delete cascade,
  location_id       uuid not null references locations (id) on delete restrict,
  proveedor_id      uuid,
  folio             text not null,
  fecha             date not null default current_date,
  subtotal_centavos integer not null default 0 check (subtotal_centavos >= 0),
  total_centavos    integer not null default 0 check (total_centavos >= 0),
  estado            text not null default 'borrador' check (estado in ('borrador', 'recibida', 'cancelada')),
  factura_url       text,
  notas             text,
  recibida_en       timestamptz,
  creado_por        uuid references auth.users (id) on delete set null,
  creado_en         timestamptz not null default now(),

  unique (organization_id, folio),
  unique (id, organization_id),
  foreign key (proveedor_id, organization_id) references suppliers (id, organization_id) on delete set null
);

create table purchase_items (
  id                      uuid primary key default gen_random_uuid(),
  organization_id         uuid not null references organizations (id) on delete cascade,
  compra_id               uuid not null,
  producto_id             uuid not null,
  cantidad                integer not null check (cantidad > 0),
  costo_unitario_centavos integer not null check (costo_unitario_centavos >= 0),
  total_centavos          integer not null check (total_centavos >= 0),

  foreign key (compra_id, organization_id) references purchases (id, organization_id) on delete cascade,
  foreign key (producto_id, organization_id) references products (id, organization_id) on delete restrict
);

-- ── Traspasos entre sucursales ──────────────────────────────────────────────
create table stock_transfers (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references organizations (id) on delete cascade,
  origen_location_id  uuid not null references locations (id) on delete restrict,
  destino_location_id uuid not null references locations (id) on delete restrict,
  folio               text not null,
  estado              text not null default 'borrador'
                        check (estado in ('borrador', 'enviado', 'recibido', 'cancelado')),
  notas               text,
  enviado_en          timestamptz,
  recibido_en         timestamptz,
  creado_por          uuid references auth.users (id) on delete set null,
  creado_en           timestamptz not null default now(),

  unique (organization_id, folio),
  unique (id, organization_id),
  constraint traspaso_entre_sucursales_distintas check (origen_location_id <> destino_location_id)
);

create table stock_transfer_items (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  traspaso_id     uuid not null,
  producto_id     uuid not null,
  cantidad        integer not null check (cantidad > 0),

  foreign key (traspaso_id, organization_id) references stock_transfers (id, organization_id) on delete cascade,
  foreign key (producto_id, organization_id) references products (id, organization_id) on delete restrict
);

-- ── Pedidos de la tienda pública ────────────────────────────────────────────
create table orders (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references organizations (id) on delete cascade,
  location_id         uuid not null references locations (id) on delete restrict,
  folio               text not null,
  cliente_id          uuid,
  cliente_nombre      text not null,
  cliente_telefono    text not null check (cliente_telefono ~ '^\+52\d{10}$'),
  estado              estado_pedido not null default 'nuevo',
  subtotal_centavos   integer not null default 0 check (subtotal_centavos >= 0),
  total_centavos      integer not null default 0 check (total_centavos >= 0),
  notas               text,
  reserva_expira_en   timestamptz,
  mensaje_whatsapp_en timestamptz,
  venta_id            uuid,
  confirmado_en       timestamptz,
  entregado_en        timestamptz,
  cancelado_en        timestamptz,
  motivo_cancelacion  text,
  creado_en           timestamptz not null default now(),

  unique (organization_id, folio),
  unique (id, organization_id),
  foreign key (cliente_id, organization_id) references customers (id, organization_id) on delete set null
);

create table order_items (
  id                      uuid primary key default gen_random_uuid(),
  organization_id         uuid not null references organizations (id) on delete cascade,
  pedido_id               uuid not null,
  producto_id             uuid not null,
  nombre_congelado        text not null,
  cantidad                integer not null check (cantidad > 0),
  precio_unitario_centavos integer not null check (precio_unitario_centavos >= 0),
  total_centavos          integer not null check (total_centavos >= 0),

  foreign key (pedido_id, organization_id) references orders (id, organization_id) on delete cascade,
  foreign key (producto_id, organization_id) references products (id, organization_id) on delete restrict
);

-- ── Reservas temporales de inventario ───────────────────────────────────────
-- El stock disponible es stock_actual menos las reservas activas no vencidas.
-- El stock FÍSICO solo baja cuando el pedido se convierte en venta.
create table inventory_reservations (
  id                      uuid primary key default gen_random_uuid(),
  organization_id         uuid not null references organizations (id) on delete cascade,
  location_id             uuid not null references locations (id) on delete cascade,
  pedido_id               uuid not null,
  producto_id             uuid not null,
  cantidad                integer not null check (cantidad > 0),
  estado                  estado_reserva_inventario not null default 'activa',
  reservada_en            timestamptz not null default now(),
  expira_en               timestamptz not null,
  liberada_en             timestamptz,
  convertida_en_venta_en  timestamptz,
  venta_id                uuid,
  creado_por              uuid references auth.users (id) on delete set null,

  foreign key (pedido_id, organization_id) references orders (id, organization_id) on delete cascade,
  foreign key (producto_id, organization_id) references products (id, organization_id) on delete restrict,

  constraint reserva_estado_coherente check (
       (estado = 'activa'     and liberada_en is null and convertida_en_venta_en is null)
    or (estado = 'liberada'   and liberada_en is not null)
    or (estado = 'cancelada'  and liberada_en is not null)
    or (estado = 'convertida' and convertida_en_venta_en is not null and venta_id is not null)
  )
);

-- Una sola reserva ACTIVA por pedido y producto. Es lo que impide, junto con
-- el UPDATE condicional de fn_convertir_pedido_en_venta, descontar dos veces.
create unique index reservas_una_activa
  on inventory_reservations (pedido_id, producto_id) where estado = 'activa';

create index reservas_vencimiento on inventory_reservations (expira_en) where estado = 'activa';
create index reservas_por_producto on inventory_reservations (producto_id, location_id) where estado = 'activa';

-- ── Cortes de caja ──────────────────────────────────────────────────────────
create table cash_registers (
  id                          uuid primary key default gen_random_uuid(),
  organization_id             uuid not null references organizations (id) on delete cascade,
  location_id                 uuid not null references locations (id) on delete restrict,
  fecha                       date not null default current_date,
  turno                       text,
  estado                      estado_caja not null default 'abierta',
  fondo_inicial_centavos      integer not null default 0 check (fondo_inicial_centavos >= 0),
  efectivo_sistema_centavos   integer not null default 0,
  efectivo_contado_centavos   integer,
  diferencia_centavos         integer,
  tarjeta_centavos            integer not null default 0,
  transferencia_centavos      integer not null default 0,
  otro_centavos               integer not null default 0,
  abierto_por                 uuid references auth.users (id) on delete set null,
  cerrado_por                 uuid references auth.users (id) on delete set null,
  abierto_en                  timestamptz not null default now(),
  cerrado_en                  timestamptz,
  notas                       text,

  unique (id, organization_id)
);

-- Una sola caja abierta por sucursal.
create unique index caja_una_abierta_por_sucursal
  on cash_registers (location_id) where estado = 'abierta';

-- ── Ventas ──────────────────────────────────────────────────────────────────
create table sales (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references organizations (id) on delete cascade,
  location_id         uuid not null references locations (id) on delete restrict,
  folio               text not null,
  tipo                text not null default 'mostrador'
                        check (tipo in ('mostrador', 'cita', 'pedido_web')),
  cliente_id          uuid,
  barbero_id          uuid,
  cajero_id           uuid references auth.users (id) on delete set null,
  cita_id             uuid,
  pedido_id           uuid,
  corte_caja_id       uuid,

  subtotal_centavos   integer not null default 0 check (subtotal_centavos >= 0),
  descuento_centavos  integer not null default 0 check (descuento_centavos >= 0),
  impuestos_centavos  integer not null default 0 check (impuestos_centavos >= 0),
  total_centavos      integer not null default 0 check (total_centavos >= 0),

  -- Denormalizados por trigger, SOLO para listados y filtros. Jamás se suman.
  es_pago_mixto       boolean not null default false,
  metodos_resumen     text,

  estado              estado_venta not null default 'completada',
  notas               text,
  cancelada_en        timestamptz,
  cancelada_por       uuid references auth.users (id) on delete set null,
  motivo_cancelacion  text,
  creado_en           timestamptz not null default now(),

  unique (organization_id, folio),
  unique (id, organization_id),
  foreign key (cliente_id, organization_id) references customers (id, organization_id) on delete set null,
  foreign key (barbero_id, organization_id) references barbers (id, organization_id) on delete set null,
  foreign key (cita_id, organization_id) references appointments (id, organization_id) on delete set null,
  foreign key (pedido_id, organization_id) references orders (id, organization_id) on delete set null,
  foreign key (corte_caja_id, organization_id) references cash_registers (id, organization_id) on delete set null,
  constraint cancelacion_venta_con_motivo
    check (estado <> 'cancelada' or motivo_cancelacion is not null)
);

-- ── Líneas de venta ─────────────────────────────────────────────────────────
-- Nombre, precio y costo se congelan. Un cambio posterior en el catálogo no
-- puede reescribir una venta pasada ni alterar la utilidad de un mes cerrado.
create table sale_items (
  id                        uuid primary key default gen_random_uuid(),
  organization_id           uuid not null references organizations (id) on delete cascade,
  venta_id                  uuid not null,
  tipo_item                 text not null check (tipo_item in ('producto', 'servicio')),
  producto_id               uuid,
  servicio_id               uuid,
  descripcion_congelada     text not null,
  cantidad                  integer not null check (cantidad > 0),
  precio_unitario_centavos  integer not null check (precio_unitario_centavos >= 0),
  costo_unitario_centavos   integer not null default 0 check (costo_unitario_centavos >= 0),
  descuento_centavos        integer not null default 0 check (descuento_centavos >= 0),
  impuesto_centavos         integer not null default 0 check (impuesto_centavos >= 0),
  total_centavos            integer not null check (total_centavos >= 0),
  barbero_id                uuid,

  foreign key (venta_id, organization_id) references sales (id, organization_id) on delete cascade,
  foreign key (producto_id, organization_id) references products (id, organization_id) on delete set null,
  foreign key (servicio_id, organization_id) references services (id, organization_id) on delete set null,
  foreign key (barbero_id, organization_id) references barbers (id, organization_id) on delete set null,

  constraint item_coherente check (
    (tipo_item = 'producto' and producto_id is not null and servicio_id is null)
    or (tipo_item = 'servicio' and servicio_id is not null and producto_id is null)
    -- Se permite que el id sea nulo si el catálogo se borró: la descripción
    -- congelada mantiene el ticket legible.
    or (producto_id is null and servicio_id is null)
  )
);

-- ── Pagos de una venta (pagos divididos) ────────────────────────────────────
create table sale_payments (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references organizations (id) on delete cascade,
  venta_id            uuid not null,
  metodo_pago         metodo_pago not null,
  monto_centavos      integer not null check (monto_centavos > 0),
  -- Texto libre que escribe el cajero: últimos 4 del voucher, folio de
  -- transferencia. NUNCA número de tarjeta ni CVV: la aplicación no procesa
  -- ni almacena datos bancarios.
  referencia          text,
  recibido_centavos   integer check (recibido_centavos >= 0),
  cambio_centavos     integer check (cambio_centavos >= 0),
  registrado_por      uuid references auth.users (id) on delete set null,
  creado_en           timestamptz not null default now(),

  foreign key (venta_id, organization_id) references sales (id, organization_id) on delete cascade,

  constraint pago_efectivo_coherente check (
    case when metodo_pago = 'efectivo'
         then recibido_centavos is not null
              and recibido_centavos >= monto_centavos
              and cambio_centavos = recibido_centavos - monto_centavos
         else recibido_centavos is null and cambio_centavos is null
    end
  )
);

comment on column sale_payments.referencia is
  'Texto libre del cajero. Prohibido almacenar PAN o CVV: la app no procesa tarjetas.';

-- ── Devoluciones ────────────────────────────────────────────────────────────
create table sale_returns (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references organizations (id) on delete cascade,
  venta_id            uuid not null,
  folio               text not null,
  monto_centavos      integer not null check (monto_centavos > 0),
  metodo_reembolso    metodo_pago not null,
  motivo              text not null,
  repone_inventario   boolean not null default true,
  registrado_por      uuid references auth.users (id) on delete set null,
  creado_en           timestamptz not null default now(),

  unique (organization_id, folio),
  unique (id, organization_id),
  foreign key (venta_id, organization_id) references sales (id, organization_id) on delete restrict
);

create table sale_return_items (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations (id) on delete cascade,
  devolucion_id     uuid not null,
  venta_item_id     uuid not null references sale_items (id) on delete restrict,
  cantidad          integer not null check (cantidad > 0),
  total_centavos    integer not null check (total_centavos >= 0),

  foreign key (devolucion_id, organization_id) references sale_returns (id, organization_id) on delete cascade
);

-- ── Gastos ──────────────────────────────────────────────────────────────────
create table expense_categories (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  nombre          text not null,
  tipo            text not null default 'variable' check (tipo in ('fijo', 'variable')),
  activa          boolean not null default true,
  unique (id, organization_id)
);

create table expenses (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  location_id     uuid references locations (id) on delete set null,
  categoria_id    uuid,
  proveedor_id    uuid,
  concepto        text not null,
  monto_centavos  integer not null check (monto_centavos > 0),
  fecha           date not null default current_date,
  metodo_pago     metodo_pago not null default 'efectivo',
  comprobante_url text,
  recurrente      boolean not null default false,
  notas           text,
  registrado_por  uuid references auth.users (id) on delete set null,
  creado_en       timestamptz not null default now(),

  foreign key (categoria_id, organization_id) references expense_categories (id, organization_id) on delete set null,
  foreign key (proveedor_id, organization_id) references suppliers (id, organization_id) on delete set null
);

-- ── Comisiones ──────────────────────────────────────────────────────────────
create table commission_payouts (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations (id) on delete cascade,
  barbero_id        uuid not null,
  periodo_inicio    date not null,
  periodo_fin       date not null,
  total_centavos    integer not null default 0 check (total_centavos >= 0),
  metodo_pago       metodo_pago,
  pagado_en         timestamptz,
  pagado_por        uuid references auth.users (id) on delete set null,
  notas             text,
  creado_en         timestamptz not null default now(),

  unique (id, organization_id),
  foreign key (barbero_id, organization_id) references barbers (id, organization_id) on delete restrict,
  constraint periodo_coherente check (periodo_fin >= periodo_inicio)
);

create table commissions (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations (id) on delete cascade,
  location_id       uuid not null references locations (id) on delete restrict,
  barbero_id        uuid not null,
  venta_id          uuid not null,
  venta_item_id     uuid references sale_items (id) on delete cascade,
  tipo_item         text not null check (tipo_item in ('producto', 'servicio')),
  base_centavos     integer not null check (base_centavos >= 0),
  tipo_calculo      tipo_comision not null,
  valor             numeric(10, 2) not null check (valor >= 0),
  monto_centavos    integer not null check (monto_centavos >= 0),
  estado            estado_comision not null default 'pendiente',
  payout_id         uuid,
  creado_en         timestamptz not null default now(),

  foreign key (barbero_id, organization_id) references barbers (id, organization_id) on delete restrict,
  foreign key (venta_id, organization_id) references sales (id, organization_id) on delete cascade,
  foreign key (payout_id, organization_id) references commission_payouts (id, organization_id) on delete set null
);

-- ── Sistema ─────────────────────────────────────────────────────────────────
create table audit_log (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid references organizations (id) on delete set null,
  tabla             text not null,
  registro_id       uuid,
  accion            accion_auditoria not null,
  descripcion       text,
  datos_anteriores  jsonb,
  datos_nuevos      jsonb,
  usuario_id        uuid references auth.users (id) on delete set null,
  creado_en         timestamptz not null default now()
);

comment on table audit_log is
  'Inmutable: no existen políticas de UPDATE ni DELETE para ningún rol, ni siquiera para el superadministrador. Una bitácora editable no sirve como evidencia.';

create table whatsapp_messages (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references organizations (id) on delete cascade,
  location_id           uuid references locations (id) on delete set null,
  cita_id               uuid,
  pedido_id             uuid,
  destinatario          text not null,
  plantilla             text not null,
  parametros            jsonb not null default '{}'::jsonb,
  texto_renderizado     text not null,
  tipo                  text not null default 'recordatorio'
                          check (tipo in ('confirmacion', 'recordatorio', 'pedido', 'otro')),
  ranura                smallint check (ranura in (1, 2)),
  -- La garantía de que un recordatorio no se manda dos veces.
  clave_idempotencia    text not null unique,
  estado                estado_mensaje_wa not null default 'pendiente',
  programado_para       timestamptz,
  enviado_en            timestamptz,
  enviado_manual_por    uuid references auth.users (id) on delete set null,
  intentos              smallint not null default 0,
  ultimo_error          text,
  wa_message_id         text,
  creado_en             timestamptz not null default now(),

  foreign key (cita_id, organization_id) references appointments (id, organization_id) on delete cascade,
  foreign key (pedido_id, organization_id) references orders (id, organization_id) on delete cascade
);

comment on column whatsapp_messages.clave_idempotencia is
  'Formato cita:<uuid>:recordatorio:<1|2>. Con ON CONFLICT DO NOTHING al encolar, es imposible duplicar un envío.';

create table public_attempts (
  id          uuid primary key default gen_random_uuid(),
  clave       text not null,
  accion      text not null,
  ventana     timestamptz not null,
  conteo      integer not null default 1,
  unique (clave, accion, ventana)
);

comment on table public_attempts is
  'Limitador de peticiones para formularios públicos. La clave es un hash: no se guarda la IP ni el teléfono en claro.';
