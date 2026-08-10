-- ============================================================================
-- 0010 · Storage y tareas programadas
-- ============================================================================

-- ── Buckets ─────────────────────────────────────────────────────────────────
-- Convención de rutas: <organization_id>/<carpeta>/<archivo>
-- El primer segmento SIEMPRE es la organización; es lo que permite escribir
-- políticas de aislamiento sobre `storage.objects`.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('publico',      'publico',      true,   5242880,
     array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml']),
  ('comprobantes', 'comprobantes', false, 10485760,
     array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('avatares',     'avatares',     true,   2097152,
     array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- ── Bucket público: logos, portadas, galería, fotos de producto ─────────────
-- Lectura anónima; escritura solo por la administración de ESA organización.
create policy publico_lee on storage.objects for select to anon, authenticated
  using (bucket_id = 'publico');

create policy publico_escribe on storage.objects for insert to authenticated
  with check (
    bucket_id = 'publico'
    and public.fn_es_gestion((storage.foldername(name))[1]::uuid)
  );

create policy publico_actualiza on storage.objects for update to authenticated
  using (bucket_id = 'publico' and public.fn_es_gestion((storage.foldername(name))[1]::uuid));

create policy publico_borra on storage.objects for delete to authenticated
  using (bucket_id = 'publico' and public.fn_es_gestion((storage.foldername(name))[1]::uuid));

-- ── Bucket privado: comprobantes de transferencia ───────────────────────────
-- Nunca hay lectura anónima. Solo el superadministrador y la administración de
-- esa barbería, y siempre mediante URL firmada de vida corta.
create policy comprobante_lee_privado on storage.objects for select to authenticated
  using (
    bucket_id = 'comprobantes'
    and (public.fn_es_superadmin()
         or public.fn_es_admin_org((storage.foldername(name))[1]::uuid))
  );

create policy comprobante_sube_privado on storage.objects for insert to authenticated
  with check (
    bucket_id = 'comprobantes'
    and (public.fn_es_superadmin()
         or public.fn_es_admin_org((storage.foldername(name))[1]::uuid))
  );

-- Los comprobantes no se borran: son evidencia de un pago.
-- No se crea política de DELETE a propósito.

-- ── Avatares: cada quien escribe en su propia carpeta ───────────────────────
create policy avatar_lee on storage.objects for select to anon, authenticated
  using (bucket_id = 'avatares');

create policy avatar_escribe on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy avatar_actualiza on storage.objects for update to authenticated
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ══════════════════════════════════════════════════════════════════════════
--  TAREAS PROGRAMADAS — Supabase Cron (pg_cron)
--
--  NO se usa Vercel Cron: el plan Hobby limita mucho las tareas frecuentes y
--  no queremos que una funcionalidad crítica dependa del plan contratado.
--  Todo lo que solo toca la base corre aquí.
--
--  Los horarios de pg_cron son UTC. CDMX = UTC−6 todo el año, porque México
--  eliminó el horario de verano en 2022.
--
--  Todas las funciones invocadas son idempotentes: ejecutarlas dos veces no
--  duplica mensajes ni movimientos.
-- ══════════════════════════════════════════════════════════════════════════
create extension if not exists pg_cron;

do $$
begin
  -- Liberar reservas de inventario vencidas.
  perform cron.schedule('liberar-reservas', '*/5 * * * *',
    $cron$ select public.fn_liberar_reservas_vencidas() $cron$);

  -- Encolar los recordatorios de las próximas 48 h (idempotente por clave).
  perform cron.schedule('encolar-recordatorios', '0 * * * *',
    $cron$ select public.fn_encolar_recordatorios(48) $cron$);

  -- Marcar como listos los recordatorios cuya hora llegó.
  perform cron.schedule('marcar-recordatorios', '*/10 * * * *',
    $cron$ select public.fn_marcar_recordatorios_listos() $cron$);

  -- Mantenimiento diario a las 03:00 CDMX.
  perform cron.schedule('mantenimiento-diario', '0 9 * * *',
    $cron$ select public.fn_mantenimiento_diario() $cron$);

  -- Recalcular estados de cobro. NUNCA suspende: solo alimenta alertas.
  perform cron.schedule('estados-de-pago', '0 10 * * *',
    $cron$ select public.fn_recalcular_estados_pago() $cron$);
exception
  when undefined_function or insufficient_privilege then
    -- pg_cron no está disponible en este entorno (por ejemplo, en local sin
    -- la extensión). Las funciones existen y pueden invocarse a mano.
    raise notice 'pg_cron no disponible: programa las tareas desde el panel de Supabase.';
end $$;

-- ══════════════════════════════════════════════════════════════════════════
--  ENVÍOS EXTERNOS
--
--  pg_cron NO debe hacer peticiones HTTP a Meta directamente. El patrón es:
--
--    pg_cron → pg_net.http_post → Edge Function `enviar-whatsapp` → Cloud API
--
--  El secreto compartido se lee de Vault. Las migraciones referencian el
--  NOMBRE del secreto, jamás su valor: el repositorio queda limpio aunque se
--  haga público.
--
--  Se activa solo cuando exista la Edge Function y la bandera
--  whatsapp_cloud_api esté encendida. Hasta entonces, los recordatorios viven
--  en la bandeja manual del panel y el sistema funciona sin costo.
--
--    select cron.schedule('despachar-whatsapp', '*/5 * * * *', $$
--      select net.http_post(
--        url := (select decrypted_secret from vault.decrypted_secrets
--                 where name = 'edge_url_whatsapp'),
--        headers := jsonb_build_object(
--          'Content-Type', 'application/json',
--          'Authorization', 'Bearer ' || (select decrypted_secret
--             from vault.decrypted_secrets where name = 'edge_shared_secret')),
--        body := '{}'::jsonb
--      )
--    $$);
-- ══════════════════════════════════════════════════════════════════════════
