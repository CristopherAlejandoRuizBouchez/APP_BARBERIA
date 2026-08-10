-- ============================================================================
-- 0003 · Funciones de autorización
-- ============================================================================
-- Toda política de RLS se apoya en estas funciones. Reglas que cumplen todas:
--
--   · `security definer` con `set search_path = ''` y nombres calificados.
--     Sin esto, un usuario podría crear un esquema propio con funciones que
--     suplanten a las del sistema y escalar privilegios.
--   · `stable`, para que el planificador las evalúe una vez por consulta y no
--     una vez por fila.
--   · Permisos revocados a `public` y concedidos explícitamente.
--
-- El principio: la organización autorizada NUNCA se toma de un parámetro que
-- venga del navegador. Se deriva siempre de `auth.uid()` y de las membresías.
-- ============================================================================

-- ── ¿Quien llama es superadministrador de la plataforma? ────────────────────
create or replace function public.fn_es_superadmin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.platform_superadmins s
     where s.usuario_id = (select auth.uid())
       and s.activo
  );
$$;

-- ── Membresía activa en una organización ────────────────────────────────────
create or replace function public.fn_es_miembro(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.organization_members m
     where m.organization_id = p_organization_id
       and m.usuario_id = (select auth.uid())
       and m.estado = 'activa'
  );
$$;

-- ── Rol dentro de una organización ──────────────────────────────────────────
create or replace function public.fn_rol_en_org(p_organization_id uuid)
returns public.rol_organizacion
language sql
stable
security definer
set search_path = ''
as $$
  select m.rol
    from public.organization_members m
   where m.organization_id = p_organization_id
     and m.usuario_id = (select auth.uid())
     and m.estado = 'activa'
   limit 1;
$$;

-- ── ¿Tiene alguno de estos roles? ───────────────────────────────────────────
create or replace function public.fn_tiene_rol(
  p_organization_id uuid,
  p_roles public.rol_organizacion[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.fn_rol_en_org(p_organization_id) = any (p_roles);
$$;

-- ── Atajos por nivel ────────────────────────────────────────────────────────
create or replace function public.fn_es_admin_org(p_organization_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.fn_tiene_rol(
    p_organization_id,
    array['organization_owner', 'organization_admin']::public.rol_organizacion[]
  );
$$;

create or replace function public.fn_es_gestion(p_organization_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.fn_tiene_rol(
    p_organization_id,
    array['organization_owner', 'organization_admin', 'location_manager']::public.rol_organizacion[]
  );
$$;

create or replace function public.fn_es_operativo(p_organization_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.fn_tiene_rol(
    p_organization_id,
    array['organization_owner', 'organization_admin', 'location_manager', 'receptionist']::public.rol_organizacion[]
  );
$$;

-- ── Acceso a una sucursal concreta ──────────────────────────────────────────
-- Un `location_manager` puede estar limitado a una sucursal; un `barber`
-- también. Un arreglo vacío significa "todas las de la organización".
create or replace function public.fn_puede_ver_sucursal(p_location_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.locations l
      join public.organization_members m
        on m.organization_id = l.organization_id
     where l.id = p_location_id
       and m.usuario_id = (select auth.uid())
       and m.estado = 'activa'
       and (cardinality(m.sucursales) = 0 or l.id = any (m.sucursales))
  );
$$;

-- ── Barbero asociado a la sesión dentro de una organización ─────────────────
-- ── ¿La organización puede OPERAR? ──────────────────────────────────────────
-- Esta es la función que hace real la suspensión. Las políticas de escritura
-- de todas las tablas operativas la exigen, así que una barbería suspendida no
-- puede crear citas, ventas ni pedidos ni siquiera llamando a la API con un
-- token válido. No es un botón oculto en la interfaz: es la base de datos.
create or replace function public.fn_org_operativa(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.organizations o
     where o.id = p_organization_id
       and o.estado = 'active'
  );
$$;

-- ── ¿La organización es visible al público? ─────────────────────────────────
-- Una barbería suspendida muestra "Sitio temporalmente no disponible" y no
-- revela que existe un adeudo.
create or replace function public.fn_org_publica(p_organization_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.fn_org_operativa(p_organization_id);
$$;

-- ── Organizaciones visibles para la sesión ──────────────────────────────────
-- Se usa en listados del panel. El superadministrador las ve todas.
create or replace function public.fn_mis_organizaciones()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select o.id from public.organizations o where public.fn_es_superadmin()
  union
  select m.organization_id
    from public.organization_members m
   where m.usuario_id = (select auth.uid())
     and m.estado = 'activa';
$$;

-- ── Permisos ────────────────────────────────────────────────────────────────
revoke all on function
  public.fn_es_superadmin(),
  public.fn_es_miembro(uuid),
  public.fn_rol_en_org(uuid),
  public.fn_tiene_rol(uuid, public.rol_organizacion[]),
  public.fn_es_admin_org(uuid),
  public.fn_es_gestion(uuid),
  public.fn_es_operativo(uuid),
  public.fn_puede_ver_sucursal(uuid),
  public.fn_org_operativa(uuid),
  public.fn_org_publica(uuid),
  public.fn_mis_organizaciones()
from public;

grant execute on function
  public.fn_es_superadmin(),
  public.fn_es_miembro(uuid),
  public.fn_rol_en_org(uuid),
  public.fn_tiene_rol(uuid, public.rol_organizacion[]),
  public.fn_es_admin_org(uuid),
  public.fn_es_gestion(uuid),
  public.fn_es_operativo(uuid),
  public.fn_puede_ver_sucursal(uuid),
  public.fn_org_operativa(uuid),
  public.fn_org_publica(uuid),
  public.fn_mis_organizaciones()
to authenticated;

-- El público anónimo solo necesita saber si un sitio está visible.
grant execute on function public.fn_org_publica(uuid), public.fn_org_operativa(uuid) to anon;
