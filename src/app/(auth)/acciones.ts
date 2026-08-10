'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { crearClienteServidor } from '@/lib/supabase/servidor';
import { env } from '@/lib/env';

function destinoConMensaje(ruta: string, tipo: 'error' | 'exito', mensaje: string) {
  return `${ruta}?${tipo}=${encodeURIComponent(mensaje)}`;
}

export async function iniciarSesion(formData: FormData) {
  const correo = String(formData.get('correo') ?? '')
    .trim()
    .toLowerCase();
  const contrasena = String(formData.get('contrasena') ?? '');
  if (!correo || contrasena.length < 8) {
    redirect(destinoConMensaje('/iniciar-sesion', 'error', 'Revisa el correo y la contraseña.'));
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({ email: correo, password: contrasena });
  if (error) redirect(destinoConMensaje('/iniciar-sesion', 'error', 'Credenciales incorrectas.'));

  revalidatePath('/', 'layout');
  const { data: superadmin } = await supabase
    .from('platform_superadmins')
    .select('usuario_id')
    .maybeSingle();
  if (superadmin) redirect('/superadmin');

  const { data: organizaciones } = await supabase
    .from('organizations')
    .select('slug')
    .order('nombre_comercial')
    .limit(1);
  if (organizaciones?.[0]) redirect(`/panel/${organizaciones[0].slug}`);
  redirect(
    destinoConMensaje(
      '/iniciar-sesion',
      'error',
      'Tu usuario todavía no tiene una barbería asignada.'
    )
  );
}

export async function cerrarSesion() {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/iniciar-sesion');
}

export async function solicitarRecuperacion(formData: FormData) {
  const correo = String(formData.get('correo') ?? '')
    .trim()
    .toLowerCase();
  const supabase = await crearClienteServidor();
  if (correo) {
    await supabase.auth.resetPasswordForEmail(correo, {
      redirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/confirm?next=/actualizar-contrasena`,
    });
  }
  redirect(
    destinoConMensaje(
      '/recuperar-contrasena',
      'exito',
      'Si el correo existe, recibirás un enlace para cambiar la contraseña.'
    )
  );
}

export async function actualizarContrasena(formData: FormData) {
  const contrasena = String(formData.get('contrasena') ?? '');
  const confirmar = String(formData.get('confirmar') ?? '');
  if (contrasena.length < 10 || contrasena !== confirmar) {
    redirect(
      destinoConMensaje(
        '/actualizar-contrasena',
        'error',
        'Usa al menos 10 caracteres y confirma la misma contraseña.'
      )
    );
  }
  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.updateUser({ password: contrasena });
  if (error) {
    redirect(
      destinoConMensaje('/actualizar-contrasena', 'error', 'El enlace venció. Solicita uno nuevo.')
    );
  }
  redirect(
    destinoConMensaje('/iniciar-sesion', 'exito', 'Contraseña actualizada. Ya puedes entrar.')
  );
}
