-- Recuperación segura de una cita desde otro dispositivo.
-- El cliente demuestra que conoce el folio y el teléfono completo usado al
-- reservar. Si coinciden, recibe un token privado nuevo y temporal.

create or replace function public.fn_recuperar_cita_publica(
  p_organization_id uuid,
  p_folio text,
  p_telefono text
)
returns table (token_acceso text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_telefono text;
  v_cita_id uuid;
  v_fin timestamptz;
  v_token text;
begin
  perform public.fn_exigir_operacion(p_organization_id);

  v_telefono := public.fn_normalizar_telefono(p_telefono);
  if v_telefono is null or nullif(btrim(p_folio), '') is null then
    raise exception 'DATOS_INVALIDOS';
  end if;

  perform public.fn_consumir_limite_publico(
    'recuperar_cita',
    p_organization_id::text || ':' || v_telefono,
    8,
    15
  );

  select a.id, a.fecha_hora_fin
    into v_cita_id, v_fin
    from public.appointments a
    join public.customers c
      on c.id = a.cliente_id
     and c.organization_id = a.organization_id
   where a.organization_id = p_organization_id
     and upper(a.folio) = upper(btrim(p_folio))
     and c.telefono = v_telefono
     and a.fecha_hora_inicio >= now() - interval '30 days'
   limit 1;

  if v_cita_id is null then
    -- El mismo error para folio o teléfono incorrectos evita revelar cuál dato existe.
    raise exception 'NO_ENCONTRADO';
  end if;

  v_token := replace(pg_catalog.gen_random_uuid()::text, '-', '')
             || replace(pg_catalog.gen_random_uuid()::text, '-', '');

  insert into public.appointment_access_tokens (
    organization_id,
    cita_id,
    token_hash,
    expira_en
  ) values (
    p_organization_id,
    v_cita_id,
    pg_catalog.encode(
      pg_catalog.sha256(pg_catalog.convert_to(v_token, 'UTF8')),
      'hex'
    ),
    greatest(v_fin + interval '7 days', now() + interval '30 days')
  );

  return query select v_token;
end;
$$;

revoke all on function public.fn_recuperar_cita_publica(uuid, text, text) from public;
grant execute on function public.fn_recuperar_cita_publica(uuid, text, text)
to anon, authenticated;

notify pgrst, 'reload schema';
