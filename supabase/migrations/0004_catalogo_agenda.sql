-- ============================================================================
-- 0004 · Catálogo, personal y agenda
-- ============================================================================
-- Toda tabla lleva `organization_id`. Las que dependen de una sucursal llevan
-- además `location_id`. Las claves foráneas son compuestas donde hace falta,
-- para que sea imposible enlazar una fila de una organización con la de otra
-- aunque la aplicación se equivoque.
-- ============================================================================

-- ── Barberos ────────────────────────────────────────────────────────────────
create table barbers (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references organizations (id) on delete cascade,
  -- Nulo si el barbero no tiene acceso al sistema (solo aparece en la agenda).
  usuario_id            uuid references auth.users (id) on delete set null,
  slug                  citext not null check (slug ~ '^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$'),
  nombre                text not null,
  apodo                 text,
  bio                   text,
  foto_url              text,
  especialidades        text[] not null default '{}',
  comision_servicio_tipo tipo_comision not null default 'porcentaje',
  comision_servicio_valor numeric(10, 2) not null default 0 check (comision_servicio_valor >= 0),
  comision_producto_tipo tipo_comision not null default 'porcentaje',
  comision_producto_valor numeric(10, 2) not null default 0 check (comision_producto_valor >= 0),
  color_agenda          text not null default '#B88942' check (color_agenda ~* '^#[0-9a-f]{6}$'),
  orden                 integer not null default 0,
  activo                boolean not null default true,
  creado_en             timestamptz not null default now(),
  actualizado_en        timestamptz not null default now(),

  unique (organization_id, slug),
  unique (id, organization_id)          -- permite claves foráneas compuestas
);

-- Un usuario no puede ser dos barberos distintos en la misma organización.
create unique index barbers_usuario_unico
  on barbers (organization_id, usuario_id) where usuario_id is not null;

-- ── Barbero por sucursal ────────────────────────────────────────────────────
-- ── Barbero asociado a la sesión dentro de una organización ──────────────────
-- Las funciones SQL resuelven sus tablas al crearse; `barbers` debe existir.
create or replace function public.fn_mi_barbero_id(p_organization_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select b.id
    from public.barbers b
   where b.organization_id = p_organization_id
     and b.usuario_id = (select auth.uid())
     and b.activo
   limit 1;
$$;

revoke all on function public.fn_mi_barbero_id(uuid) from public;
grant execute on function public.fn_mi_barbero_id(uuid) to authenticated;

create table barber_locations (
  barbero_id      uuid not null,
  location_id     uuid not null,
  organization_id uuid not null references organizations (id) on delete cascade,
  primary key (barbero_id, location_id),
  foreign key (barbero_id, organization_id) references barbers (id, organization_id) on delete cascade,
  foreign key (location_id) references locations (id) on delete cascade
);

-- ── Categorías de servicio ──────────────────────────────────────────────────
create table service_categories (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  slug            citext not null,
  nombre          text not null,
  orden           integer not null default 0,
  activa          boolean not null default true,
  creado_en       timestamptz not null default now(),
  unique (organization_id, slug),
  unique (id, organization_id)
);

-- ── Servicios ───────────────────────────────────────────────────────────────
create table services (
  id                      uuid primary key default gen_random_uuid(),
  organization_id         uuid not null references organizations (id) on delete cascade,
  categoria_id            uuid,
  slug                    citext not null,
  nombre                  text not null,
  descripcion             text,
  duracion_minutos        integer not null check (duracion_minutos between 5 and 600),
  precio_centavos         integer not null check (precio_centavos >= 0),
  precio_express_centavos integer check (precio_express_centavos >= 0),
  imagen_url              text,
  destacado               boolean not null default false,
  orden                   integer not null default 0,
  activo                  boolean not null default true,
  creado_en               timestamptz not null default now(),
  actualizado_en          timestamptz not null default now(),

  unique (organization_id, slug),
  unique (id, organization_id),
  foreign key (categoria_id, organization_id)
    references service_categories (id, organization_id) on delete set null
);

comment on column services.precio_express_centavos is
  'Nulo → se calcula con organization_settings.express_multiplicador.';

-- ── Servicio disponible por sucursal ────────────────────────────────────────
create table service_locations (
  servicio_id     uuid not null,
  location_id     uuid not null references locations (id) on delete cascade,
  organization_id uuid not null references organizations (id) on delete cascade,
  precio_override_centavos integer check (precio_override_centavos >= 0),
  activo          boolean not null default true,
  primary key (servicio_id, location_id),
  foreign key (servicio_id, organization_id) references services (id, organization_id) on delete cascade
);

-- ── Servicio por barbero ────────────────────────────────────────────────────
create table barber_services (
  barbero_id      uuid not null,
  servicio_id     uuid not null,
  organization_id uuid not null references organizations (id) on delete cascade,
  precio_override_centavos    integer check (precio_override_centavos >= 0),
  duracion_override_minutos   integer check (duracion_override_minutos between 5 and 600),
  primary key (barbero_id, servicio_id),
  foreign key (barbero_id, organization_id) references barbers (id, organization_id) on delete cascade,
  foreign key (servicio_id, organization_id) references services (id, organization_id) on delete cascade
);

-- ── Horario semanal del barbero, por sucursal ───────────────────────────────
create table barber_schedules (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  barbero_id      uuid not null,
  location_id     uuid not null references locations (id) on delete cascade,
  dia_semana      smallint not null check (dia_semana between 0 and 6),  -- 0 = domingo
  hora_inicio     time not null,
  hora_fin        time not null,
  activo          boolean not null default true,
  creado_en       timestamptz not null default now(),

  foreign key (barbero_id, organization_id) references barbers (id, organization_id) on delete cascade,
  constraint horario_coherente check (hora_fin > hora_inicio)
);

comment on table barber_schedules is
  'Varias filas por día permiten turnos partidos: mañana, comida, tarde.';

-- ── Bloqueos: vacaciones, permisos, comidas ─────────────────────────────────
create table barber_blocks (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  barbero_id      uuid not null,
  location_id     uuid references locations (id) on delete cascade,
  inicio          timestamptz not null,
  fin             timestamptz not null,
  tipo            text not null default 'permiso'
                    check (tipo in ('vacaciones', 'permiso', 'comida', 'capacitacion', 'otro')),
  motivo          text,
  creado_por      uuid references auth.users (id) on delete set null,
  creado_en       timestamptz not null default now(),

  foreign key (barbero_id, organization_id) references barbers (id, organization_id) on delete cascade,
  constraint bloqueo_coherente check (fin > inicio)
);

-- ── Días no laborables del negocio ──────────────────────────────────────────
create table non_working_days (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  location_id     uuid references locations (id) on delete cascade,
  fecha           date not null,
  motivo          text,
  creado_en       timestamptz not null default now()
);

create unique index dias_no_laborables_unicos
  on non_working_days (organization_id, coalesce(location_id, '00000000-0000-0000-0000-000000000000'::uuid), fecha);

-- ── Clientes ────────────────────────────────────────────────────────────────
create table customers (
  id                      uuid primary key default gen_random_uuid(),
  organization_id         uuid not null references organizations (id) on delete cascade,
  telefono                text not null check (telefono ~ '^\+52\d{10}$'),
  nombre                  text not null,
  whatsapp                text check (whatsapp ~ '^\+52\d{10}$'),
  correo                  citext,
  fecha_nacimiento        date,
  notas                   text,
  etiquetas               text[] not null default '{}',
  acepta_promociones      boolean not null default false,
  barbero_preferido_id    uuid,

  -- Métricas mantenidas por trigger.
  total_visitas           integer not null default 0,
  total_gastado_centavos  bigint  not null default 0,
  primera_visita          timestamptz,
  ultima_visita           timestamptz,

  activo                  boolean not null default true,
  creado_en               timestamptz not null default now(),
  actualizado_en          timestamptz not null default now(),

  -- Un teléfono identifica a un cliente DENTRO de una barbería. El mismo
  -- número puede ser cliente de dos barberías distintas sin mezclarse.
  unique (organization_id, telefono),
  unique (id, organization_id),
  foreign key (barbero_preferido_id, organization_id)
    references barbers (id, organization_id) on delete set null
);

comment on constraint customers_organization_id_telefono_key on customers is
  'Evita duplicados por teléfono dentro de una organización, sin mezclar clientes entre barberías distintas.';

-- ── Citas ───────────────────────────────────────────────────────────────────
create table appointments (
  id                      uuid primary key default gen_random_uuid(),
  organization_id         uuid not null references organizations (id) on delete cascade,
  location_id             uuid not null references locations (id) on delete restrict,
  folio                   text not null,
  cliente_id              uuid not null,
  barbero_id              uuid not null,

  fecha_hora_inicio       timestamptz not null,
  fecha_hora_fin          timestamptz not null,
  -- Columna generada: es la que indexa el constraint de exclusión.
  rango                   tstzrange generated always as
                            (tstzrange(fecha_hora_inicio, fecha_hora_fin, '[)')) stored,

  estado                  estado_cita not null default 'pendiente',
  es_express              boolean not null default false,
  canal                   canal_cita not null default 'web',

  subtotal_centavos       integer not null default 0 check (subtotal_centavos >= 0),
  descuento_centavos      integer not null default 0 check (descuento_centavos >= 0),
  total_centavos          integer not null default 0 check (total_centavos >= 0),

  notas_cliente           text,
  notas_internas          text,
  venta_id                uuid,

  confirmada_en           timestamptz,
  cancelada_en            timestamptz,
  motivo_cancelacion      text,
  cancelada_por           uuid references auth.users (id) on delete set null,

  creado_en               timestamptz not null default now(),
  creado_por              uuid references auth.users (id) on delete set null,
  actualizado_en          timestamptz not null default now(),

  unique (organization_id, folio),
  unique (id, organization_id),
  foreign key (cliente_id, organization_id) references customers (id, organization_id) on delete restrict,
  foreign key (barbero_id, organization_id) references barbers (id, organization_id) on delete restrict,
  constraint cita_coherente check (fecha_hora_fin > fecha_hora_inicio),
  constraint cancelacion_con_motivo
    check (estado <> 'cancelada' or motivo_cancelacion is not null)
);

-- ══════════════════════════════════════════════════════════════════════════
--  EL CONSTRAINT MÁS IMPORTANTE DEL SISTEMA
--
--  Impide que un barbero tenga dos citas solapadas. Postgres lo evalúa DENTRO
--  de la transacción, con bloqueo real: dos reservas simultáneas al mismo
--  hueco no pueden coexistir aunque lleguen en el mismo milisegundo, vengan
--  de la web y del mostrador a la vez, o se inserten con un cliente SQL.
--
--  El WHERE parcial hace que una cita cancelada libere el hueco sin borrarse,
--  conservando el historial.
--
--  `organization_id` va en la clave por aislamiento y por rendimiento del
--  índice, aunque un mismo barbero nunca pertenece a dos organizaciones.
-- ══════════════════════════════════════════════════════════════════════════
alter table appointments
  add constraint citas_sin_traslape
  exclude using gist (
    organization_id with =,
    barbero_id      with =,
    rango           with &&
  ) where (estado in ('pendiente', 'confirmada', 'en_proceso'));

-- ── Servicios de cada cita ──────────────────────────────────────────────────
-- Los datos se congelan: si mañana sube el precio, la cita de ayer conserva
-- lo que se cobró ayer.
create table appointment_services (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations (id) on delete cascade,
  cita_id           uuid not null,
  servicio_id       uuid,
  nombre_congelado  text not null,
  precio_centavos   integer not null check (precio_centavos >= 0),
  duracion_minutos  integer not null check (duracion_minutos > 0),
  orden             integer not null default 0,

  foreign key (cita_id, organization_id) references appointments (id, organization_id) on delete cascade,
  foreign key (servicio_id, organization_id) references services (id, organization_id) on delete set null
);

-- ── Historial de la cita ────────────────────────────────────────────────────
-- Inmutable. No se añade un estado "reprogramada": la cita queda `confirmada`
-- en su fecha nueva y el evento guarda de dónde a dónde se movió.
create table appointment_events (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references organizations (id) on delete cascade,
  cita_id               uuid not null,
  tipo                  tipo_evento_cita not null,
  estado_anterior       estado_cita,
  estado_nuevo          estado_cita,
  fecha_anterior        timestamptz,
  fecha_nueva           timestamptz,
  barbero_anterior_id   uuid,
  barbero_nuevo_id      uuid,
  servicios_anterior    jsonb,
  servicios_nuevo       jsonb,
  motivo                text,
  canal                 canal_cita not null default 'sistema',
  actor                 text not null default 'sistema' check (actor in ('staff', 'cliente', 'sistema')),
  usuario_id            uuid references auth.users (id) on delete set null,
  creado_en             timestamptz not null default now(),

  foreign key (cita_id, organization_id) references appointments (id, organization_id) on delete cascade
);

-- ── Token de gestión para clientes sin cuenta ───────────────────────────────
-- El cliente no tiene contraseña. Para consultar, cancelar o reprogramar usa
-- un enlace firmado. Se guarda SOLO el hash: si se filtra la base, los enlaces
-- ya emitidos no sirven para nada.
create table appointment_access_tokens (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  cita_id         uuid not null,
  token_hash      text not null unique,
  expira_en       timestamptz not null,
  usado_en        timestamptz,
  revocado_en     timestamptz,
  creado_en       timestamptz not null default now(),

  foreign key (cita_id, organization_id) references appointments (id, organization_id) on delete cascade
);

comment on table appointment_access_tokens is
  'sha256 del token aleatorio. Caduca. Es lo único que permite a un cliente sin cuenta tocar su cita.';

-- ── Galería y testimonios ───────────────────────────────────────────────────
create table gallery_items (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  location_id     uuid references locations (id) on delete set null,
  titulo          text,
  imagen_url      text not null,
  barbero_id      uuid,
  servicio_id     uuid,
  orden           integer not null default 0,
  activo          boolean not null default true,
  creado_en       timestamptz not null default now(),
  foreign key (barbero_id, organization_id) references barbers (id, organization_id) on delete set null,
  foreign key (servicio_id, organization_id) references services (id, organization_id) on delete set null
);

create table testimonials (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  cliente_nombre  text not null,
  texto           text not null,
  calificacion    smallint check (calificacion between 1 and 5),
  aprobado        boolean not null default false,
  orden           integer not null default 0,
  creado_en       timestamptz not null default now()
);

-- ── Preguntas frecuentes ────────────────────────────────────────────────────
create table faqs (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  pregunta        text not null,
  respuesta       text not null,
  orden           integer not null default 0,
  activa          boolean not null default true,
  creado_en       timestamptz not null default now()
);
