-- ============================================================================
-- 0016 · Baja segura de una organización
-- ============================================================================
-- Una barbería eliminada deja de operar y desaparece del centro de control,
-- pero sus registros se conservan. Esto respeta la bitácora inmutable y evita
-- que una eliminación accidental destruya ventas, citas o pagos.
-- ============================================================================

create or replace function public.fn_eliminar_organizacion(p_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org public.organizations%rowtype;
  v_slug_archivado text;
begin
  if not public.fn_es_superadmin() then
    raise exception 'NO_AUTORIZADO';
  end if;

  select * into v_org
    from public.organizations
   where id = p_organization_id
   for update;

  if not found then
    raise exception 'NO_ENCONTRADO';
  end if;
  if v_org.estado = 'active' then
    raise exception 'BARBERIA_ACTIVA'
      using detail = 'La barbería debe estar suspendida antes de eliminarla.';
  end if;

  -- Libera el slug público para que pueda reutilizarse posteriormente.
  v_slug_archivado := left(v_org.slug::text, 30)
    || '-eliminada-'
    || left(v_org.id::text, 8);

  update public.organization_members
     set estado = 'revocada',
         revocada_en = now()
   where organization_id = p_organization_id
     and estado <> 'revocada';

  update public.organizations
     set estado = 'cancelled',
         slug = v_slug_archivado,
         archivada_en = now(),
         actualizado_en = now()
   where id = p_organization_id;

  insert into public.audit_log (
    organization_id, tabla, registro_id, accion, descripcion, datos_anteriores, usuario_id
  ) values (
    p_organization_id,
    'organizations',
    p_organization_id,
    'accion',
    'Barbería eliminada de la plataforma; datos conservados por seguridad',
    jsonb_build_object('slug', v_org.slug, 'nombre', v_org.nombre_comercial),
    (select auth.uid())
  );
end;
$$;

revoke all on function public.fn_eliminar_organizacion(uuid) from public;
grant execute on function public.fn_eliminar_organizacion(uuid) to authenticated;
