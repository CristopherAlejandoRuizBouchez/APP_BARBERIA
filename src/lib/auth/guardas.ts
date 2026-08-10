import 'server-only';

import { notFound, redirect } from 'next/navigation';
import { crearClienteServidor } from '@/lib/supabase/servidor';
import { contextoSesion } from '@/lib/tenant/resolver';

export async function requerirUsuario() {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/iniciar-sesion');
  return { supabase, user };
}

export async function requerirSuperadmin() {
  const { supabase, user } = await requerirUsuario();
  const { data } = await supabase
    .from('platform_superadmins')
    .select('usuario_id')
    .eq('usuario_id', user.id)
    .eq('activo', true)
    .maybeSingle();
  if (!data) redirect('/panel');
  return { supabase, user };
}

export async function requerirOrganizacion(slug: string) {
  const { supabase, user } = await requerirUsuario();
  const { data: organizacion } = await supabase
    .from('organizations')
    .select('id, slug, nombre_comercial, estado')
    .eq('slug', slug)
    .maybeSingle();
  if (!organizacion) notFound();

  const contexto = await contextoSesion(organizacion.id);
  if (!contexto) notFound();
  return { supabase, user, organizacion, contexto };
}
