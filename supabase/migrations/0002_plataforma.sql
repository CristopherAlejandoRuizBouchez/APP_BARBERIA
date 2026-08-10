-- ============================================================================
-- 0002 · Tablas de la plataforma
-- ============================================================================
-- Organizaciones (barberías), sucursales, usuarios, membresías, invitaciones,
-- apariencia, planes, banderas y el cobro manual de Barbería OS.
-- ============================================================================

-- ── Configuración global de la plataforma ───────────────────────────────────
create table platform_settings (
  id                    boolean primary key default true check (id),  -- fila única
  nombre_plataforma     text        not null default 'Barbería OS',
  correo_soporte        text,
  whatsapp_soporte      text,
  -- Datos bancarios que se muestran a una barbería con adeudo.
  banco_nombre          text,
  banco_titular         text,
  banco_clabe           text,
  banco_cuenta          text,
  instrucciones_pago    text,
  dominio_base          text        not null default 'barberiaos.com',
  actualizado_en        timestamptz not null default now(),
  actualizado_por       uuid references auth.users (id) on delete set null
);

comment on table platform_settings is
  'Fila única. Datos de contacto y de transferencia de Barbería OS.';

-- ── Superadministradores de la plataforma ───────────────────────────────────
-- Tabla propia en lugar de un claim: revocar el acceso debe surtir efecto de
-- inmediato, sin esperar a que caduque un token.
create table platform_superadmins (
  usuario_id  uuid primary key references auth.users (id) on delete cascade,
  nombre      text        not null,
  creado_en   timestamptz not null default now(),
  creado_por  uuid references auth.users (id) on delete set null,
  activo      boolean     not null default true
);

comment on table platform_superadmins is
  'Propietarios de la plataforma. Se dan de alta con la clave de servicio, nunca desde la interfaz pública.';

-- ── Planes internos ─────────────────────────────────────────────────────────
create table plans (
  id                    uuid primary key default gen_random_uuid(),
  clave                 citext      not null unique,
  nombre                text        not null,
  descripcion           text,
  precio_mensual_centavos integer   not null default 0 check (precio_mensual_centavos >= 0),
  max_sucursales        integer     not null default 1 check (max_sucursales >= 1),
  max_usuarios          integer     not null default 5 check (max_usuarios >= 1),
  max_barberos          integer     not null default 5 check (max_barberos >= 1),
  funciones             jsonb       not null default '{}'::jsonb,
  orden                 integer     not null default 0,
  activo                boolean     not null default true,
  creado_en             timestamptz not null default now()
);

-- ── Organizaciones ──────────────────────────────────────────────────────────
create table organizations (
  id                    uuid primary key default gen_random_uuid(),
  slug                  citext      not null unique
                          check (slug ~ '^[a-z0-9]([a-z0-9-]{1,48}[a-z0-9])$'),
  nombre_comercial      text        not null check (length(trim(nombre_comercial)) > 0),
  razon_social          text,
  estado                estado_organizacion not null default 'onboarding',

  -- Contacto general de la barbería (cada sucursal puede sobrescribirlo).
  telefono_whatsapp     text        check (telefono_whatsapp ~ '^52\d{10}$'),
  correo_contacto       text,
  sitio_web             text,
  zona_horaria          text        not null default 'America/Mexico_City',
  moneda                text        not null default 'MXN' check (moneda = 'MXN'),

  -- Motivo y trazabilidad de la suspensión. Siempre manual.
  suspendida_en         timestamptz,
  suspendida_por        uuid references auth.users (id) on delete set null,
  motivo_suspension     text,
  reactivada_en         timestamptz,
  reactivada_por        uuid references auth.users (id) on delete set null,

  archivada_en          timestamptz,
  creado_en             timestamptz not null default now(),
  creado_por            uuid references auth.users (id) on delete set null,
  actualizado_en        timestamptz not null default now(),

  constraint suspension_con_motivo
    check (estado <> 'suspended' or (suspendida_en is not null and motivo_suspension is not null))
);

comment on column organizations.slug is
  'Segmento de la URL pública: /b/<slug>. Único en toda la plataforma.';

-- ── Sucursales ──────────────────────────────────────────────────────────────
create table locations (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid        not null references organizations (id) on delete cascade,
  slug                  citext      not null check (slug ~ '^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$'),
  nombre                text        not null,
  es_principal          boolean     not null default false,

  calle                 text,
  numero                text,
  colonia               text,
  ciudad                text        not null default 'Ciudad por definir',
  estado_pais           text,
  codigo_postal         text,
  pais                  text        not null default 'México',
  latitud               numeric(10, 7),
  longitud              numeric(10, 7),
  mapa_embed_url        text,

  telefono              text,
  telefono_whatsapp     text        check (telefono_whatsapp ~ '^52\d{10}$'),
  -- Cada sucursal puede estar en una zona distinta (Sonora, Quintana Roo…).
  zona_horaria          text        not null default 'America/Mexico_City',

  activa                boolean     not null default true,
  orden                 integer     not null default 0,
  creado_en             timestamptz not null default now(),
  actualizado_en        timestamptz not null default now(),

  unique (organization_id, slug)
);

-- Solo una sucursal principal por organización.
create unique index locations_una_principal
  on locations (organization_id) where es_principal;

-- ── Perfiles de usuario ─────────────────────────────────────────────────────
create table profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  nombre          text        not null default '',
  telefono        text,
  avatar_url      text,
  ultimo_acceso   timestamptz,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);

comment on table profiles is
  'Extiende auth.users. NO contiene el rol: el rol depende de la organización y vive en organization_members.';

-- ── Membresías ──────────────────────────────────────────────────────────────
-- Una persona puede pertenecer a varias barberías con roles distintos.
create table organization_members (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid        not null references organizations (id) on delete cascade,
  usuario_id        uuid        not null references auth.users (id) on delete cascade,
  rol               rol_organizacion not null,
  estado            estado_membresia not null default 'activa',
  -- Sucursales a las que tiene acceso. Vacío = todas las de la organización.
  sucursales        uuid[]      not null default '{}',
  creado_en         timestamptz not null default now(),
  creado_por        uuid references auth.users (id) on delete set null,
  revocada_en       timestamptz,

  unique (organization_id, usuario_id)
);

comment on column organization_members.sucursales is
  'Arreglo de location_id. Vacío significa acceso a todas las sucursales de la organización.';

-- Cada organización necesita exactamente un propietario activo.
create unique index members_un_propietario
  on organization_members (organization_id)
  where rol = 'organization_owner' and estado = 'activa';

-- ── Invitaciones ────────────────────────────────────────────────────────────
create table organization_invitations (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid        not null references organizations (id) on delete cascade,
  correo            citext      not null,
  rol               rol_organizacion not null,
  sucursales        uuid[]      not null default '{}',
  -- Se guarda solo el hash del token; el valor en claro viaja una vez por correo.
  token_hash        text        not null unique,
  estado            estado_invitacion not null default 'pendiente',
  expira_en         timestamptz not null,
  aceptada_en       timestamptz,
  aceptada_por      uuid references auth.users (id) on delete set null,
  creado_en         timestamptz not null default now(),
  creado_por        uuid references auth.users (id) on delete set null
);

comment on column organization_invitations.token_hash is
  'sha256 del token. El token en claro nunca se almacena: si se filtra la base, no sirve para entrar.';

create unique index invitaciones_una_pendiente
  on organization_invitations (organization_id, correo)
  where estado = 'pendiente';

-- ── Configuración por organización ──────────────────────────────────────────
-- Sustituye a las variables de entorno globales de la fase 0.
create table organization_settings (
  organization_id             uuid primary key references organizations (id) on delete cascade,

  -- Agenda
  intervalo_slots_minutos     integer not null default 15 check (intervalo_slots_minutos between 5 and 60),
  colchon_entre_citas_minutos integer not null default 0 check (colchon_entre_citas_minutos >= 0),
  anticipacion_minima_minutos integer not null default 60 check (anticipacion_minima_minutos >= 0),
  anticipacion_maxima_dias    integer not null default 60 check (anticipacion_maxima_dias between 1 and 365),
  cancelacion_horas_limite    integer not null default 3 check (cancelacion_horas_limite >= 0),

  -- Cita exprés
  express_activa              boolean not null default true,
  express_multiplicador       numeric(4, 2) not null default 2.00 check (express_multiplicador >= 1),
  express_anticipacion_min_minutos integer not null default 30,

  -- Pedidos y reservas de inventario
  reserva_pedido_activa       boolean not null default true,
  reserva_pedido_minutos      integer not null default 60 check (reserva_pedido_minutos between 5 and 1440),

  -- Recordatorios de WhatsApp
  recordatorio_1_activo       boolean not null default true,
  recordatorio_1_horas_antes  integer not null default 24 check (recordatorio_1_horas_antes between 1 and 168),
  recordatorio_2_activo       boolean not null default false,
  recordatorio_2_horas_antes  integer not null default 2  check (recordatorio_2_horas_antes between 1 and 168),

  -- Ventas
  impuesto_activo             boolean not null default false,
  impuesto_porcentaje         numeric(5, 2) not null default 16.00 check (impuesto_porcentaje between 0 and 100),
  descuento_max_encargado_pct numeric(5, 2) not null default 15.00 check (descuento_max_encargado_pct between 0 and 100),

  actualizado_en              timestamptz not null default now()
);

-- ── Apariencia ──────────────────────────────────────────────────────────────
create table organization_themes (
  organization_id     uuid primary key references organizations (id) on delete cascade,
  plantilla           plantilla_visual not null default 'urban_premium',

  -- Identidad
  logo_url            text,
  logo_oscuro_url     text,
  favicon_url         text,
  portada_url         text,
  portada_video_url   text,
  eslogan             text,
  descripcion         text,

  -- Color: validado como hexadecimal, nunca CSS libre.
  color_primario      text not null default '#B88942' check (color_primario ~* '^#[0-9a-f]{6}$'),
  color_secundario    text not null default '#5B1E2D' check (color_secundario ~* '^#[0-9a-f]{6}$'),
  color_fondo         text not null default '#0B0B0D' check (color_fondo ~* '^#[0-9a-f]{6}$'),
  color_superficie    text not null default '#17181C' check (color_superficie ~* '^#[0-9a-f]{6}$'),
  color_texto         text not null default '#EFE7DA' check (color_texto ~* '^#[0-9a-f]{6}$'),

  -- Tipografía: elegida de un catálogo cerrado, no texto libre.
  fuente_titulos      text not null default 'instrument-serif',
  fuente_cuerpo       text not null default 'instrument-sans',

  -- Forma
  estilo_botones      text not null default 'solido'
                        check (estilo_botones in ('solido', 'contorno', 'suave')),
  radio_bordes        text not null default 'recto'
                        check (radio_bordes in ('recto', 'suave', 'redondeado')),
  estilo_tarjetas     text not null default 'filete'
                        check (estilo_tarjetas in ('filete', 'plano', 'elevado')),
  textura_fondo       text not null default 'grano'
                        check (textura_fondo in ('ninguna', 'grano', 'lineas', 'trama')),

  -- Composición del sitio público.
  secciones_visibles  jsonb not null default
    '["hero","servicios","barberos","galeria","productos","testimonios","sucursales","contacto"]'::jsonb,
  orden_secciones     jsonb not null default
    '["hero","servicios","barberos","galeria","productos","testimonios","sucursales","contacto"]'::jsonb,

  -- Redes sociales: objeto validado con Zod en la aplicación.
  redes_sociales      jsonb not null default '{}'::jsonb,

  -- Borrador vs. publicado: el editor previsualiza sin afectar al sitio.
  borrador            jsonb,
  publicado_en        timestamptz,
  actualizado_en      timestamptz not null default now(),
  actualizado_por     uuid references auth.users (id) on delete set null
);

comment on table organization_themes is
  'Apariencia por barbería. NUNCA acepta CSS, HTML ni JavaScript arbitrario: solo valores de un catálogo cerrado, validados con CHECK aquí y con Zod en la aplicación.';

-- ── Dominios ────────────────────────────────────────────────────────────────
create table organization_domains (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid    not null references organizations (id) on delete cascade,
  tipo              text    not null check (tipo in ('ruta', 'subdominio', 'personalizado')),
  valor             citext  not null unique,
  verificado         boolean not null default false,
  verificado_en     timestamptz,
  es_principal      boolean not null default false,
  creado_en         timestamptz not null default now()
);

comment on table organization_domains is
  'tipo=ruta es /b/<slug> y siempre existe. subdominio y personalizado quedan tras la bandera NEXT_PUBLIC_FLAG_CUSTOM_DOMAINS.';

create unique index dominios_uno_principal
  on organization_domains (organization_id) where es_principal;

-- ── Plan asignado ───────────────────────────────────────────────────────────
create table organization_plan_assignments (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations (id) on delete cascade,
  plan_id           uuid not null references plans (id),
  asignado_en       timestamptz not null default now(),
  asignado_por      uuid references auth.users (id) on delete set null,
  vigente_desde     date not null default current_date,
  vigente_hasta     date,
  notas             text
);

create unique index plan_uno_vigente
  on organization_plan_assignments (organization_id) where vigente_hasta is null;

-- ── Banderas por organización ───────────────────────────────────────────────
create table organization_feature_flags (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid    not null references organizations (id) on delete cascade,
  clave             citext  not null,
  activo            boolean not null default false,
  valor             jsonb,
  actualizado_en    timestamptz not null default now(),
  actualizado_por   uuid references auth.users (id) on delete set null,
  unique (organization_id, clave)
);

-- ── Cuenta de cobro de Barbería OS ──────────────────────────────────────────
create table billing_accounts (
  organization_id       uuid primary key references organizations (id) on delete cascade,
  mensualidad_centavos  integer not null default 0 check (mensualidad_centavos >= 0),
  moneda                text    not null default 'MXN' check (moneda = 'MXN'),
  dia_corte             integer not null default 1 check (dia_corte between 1 and 28),
  proxima_fecha_pago    date,
  ultimo_pago_en        date,
  dias_gracia           integer not null default 5 check (dias_gracia between 0 and 60),
  estado_pago           estado_pago_plataforma not null default 'current',
  referencia            text,
  notas_privadas        text,
  actualizado_en        timestamptz not null default now(),
  actualizado_por       uuid references auth.users (id) on delete set null
);

comment on table billing_accounts is
  'Cobro de la barbería a Barbería OS. NO tiene relación con los pagos que los clientes hacen a la barbería (tabla ventas).';

comment on column billing_accounts.estado_pago is
  'Se recalcula con un cron y sirve para alertar. Cambiarlo NUNCA suspende la organización.';

-- ── Pagos manuales por transferencia ────────────────────────────────────────
create table manual_payments (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid    not null references organizations (id) on delete cascade,
  monto_centavos      integer not null check (monto_centavos > 0),
  moneda              text    not null default 'MXN' check (moneda = 'MXN'),
  fecha_pago          date    not null,
  periodo_inicio      date,
  periodo_fin         date,
  referencia          text,
  metodo              text    not null default 'transferencia',
  estado              estado_pago_manual not null default 'pendiente',
  notas               text,

  -- Quién y cuándo verificó. Obligatorio para pasar a verificado o rechazado.
  verificado_por      uuid references auth.users (id) on delete set null,
  verificado_en       timestamptz,
  motivo_rechazo      text,

  reportado_por       uuid references auth.users (id) on delete set null,
  creado_en           timestamptz not null default now(),

  constraint verificacion_trazable check (
    (estado = 'pendiente'  and verificado_por is null and verificado_en is null)
    or (estado = 'verificado' and verificado_por is not null and verificado_en is not null)
    or (estado = 'rechazado'  and verificado_por is not null and verificado_en is not null
        and motivo_rechazo is not null)
  )
);

-- ── Comprobantes ────────────────────────────────────────────────────────────
create table payment_proofs (
  id                uuid primary key default gen_random_uuid(),
  manual_payment_id uuid    not null references manual_payments (id) on delete cascade,
  organization_id   uuid    not null references organizations (id) on delete cascade,
  ruta_storage      text    not null,          -- bucket privado 'comprobantes'
  nombre_archivo    text    not null,
  tipo_mime         text    not null check (tipo_mime in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  tamano_bytes      integer not null check (tamano_bytes > 0 and tamano_bytes <= 10485760),
  subido_por        uuid references auth.users (id) on delete set null,
  creado_en         timestamptz not null default now()
);

comment on table payment_proofs is
  'Siempre en almacenamiento PRIVADO. Solo se sirven con URL firmada de vida corta.';
