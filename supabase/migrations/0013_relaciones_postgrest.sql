-- ============================================================================
-- 0013 · Relaciones inequívocas para PostgREST
-- ============================================================================
-- 0011 añadió claves foráneas compuestas (location_id, organization_id) para
-- impedir que una fila apunte a una sucursal de otra barbería. Las claves
-- antiguas de una sola columna quedaron duplicadas y PostgREST ya no podía
-- decidir cuál usar en consultas como `appointments(..., locations(nombre))`.
--
-- Se eliminan únicamente las relaciones antiguas de UNA columna. Las
-- compuestas permanecen y conservan la integridad multiempresa más estricta.
-- ============================================================================

do $$
declare
  relacion record;
begin
  for relacion in
    select c.conrelid::regclass as tabla, c.conname
      from pg_catalog.pg_constraint c
      join pg_catalog.pg_class t on t.oid = c.conrelid
      join pg_catalog.pg_namespace n on n.oid = t.relnamespace
     where c.contype = 'f'
       and c.confrelid = 'public.locations'::regclass
       and cardinality(c.conkey) = 1
       and n.nspname = 'public'
  loop
    execute format(
      'alter table %s drop constraint %I',
      relacion.tabla,
      relacion.conname
    );
  end loop;
end $$;

-- Fuerza a la API de Supabase a releer las relaciones inmediatamente.
notify pgrst, 'reload schema';

