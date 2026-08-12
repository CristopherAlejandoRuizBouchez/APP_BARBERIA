-- Sección pública "Nosotros" para cada barbería.
-- Los datos pertenecen al tema de la organización y respetan sus políticas RLS existentes.

alter table public.organization_themes
  add column if not exists nosotros_titulo text,
  add column if not exists nosotros_historia text,
  add column if not exists nosotros_frase text,
  add column if not exists mostrar_nosotros boolean not null default false;

comment on column public.organization_themes.nosotros_titulo is
  'Título de la sección pública Nosotros.';
comment on column public.organization_themes.nosotros_historia is
  'Historia y presentación pública de la barbería.';
comment on column public.organization_themes.nosotros_frase is
  'Frase breve destacada dentro de la sección Nosotros.';
comment on column public.organization_themes.mostrar_nosotros is
  'Indica si la sección Nosotros se muestra en el sitio público.';
