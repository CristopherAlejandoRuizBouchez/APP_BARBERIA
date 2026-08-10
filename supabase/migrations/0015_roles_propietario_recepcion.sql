-- ============================================================================
-- 0015 · Modelo simple de acceso: propietario y recepción
-- ============================================================================
-- El propietario es el único que administra catálogo, inventario, finanzas y
-- configuración. Recepción solo opera agenda, cobros, pedidos, clientes y caja.

-- Los roles administrativos heredados ya no se ofrecen en la interfaz. Si
-- existían membresías de prueba, se convierten al alcance seguro de recepción.
update public.organization_members
   set rol = 'receptionist'
 where rol in ('organization_admin', 'location_manager');

create or replace function public.fn_es_admin_org(p_organization_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.fn_tiene_rol(
    p_organization_id,
    array['organization_owner']::public.rol_organizacion[]
  );
$$;

create or replace function public.fn_es_gestion(p_organization_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.fn_tiene_rol(
    p_organization_id,
    array['organization_owner']::public.rol_organizacion[]
  );
$$;

create or replace function public.fn_es_operativo(p_organization_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.fn_tiene_rol(
    p_organization_id,
    array['organization_owner', 'receptionist']::public.rol_organizacion[]
  );
$$;
