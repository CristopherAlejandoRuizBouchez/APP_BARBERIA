'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requerirSuperadmin } from '@/lib/auth/guardas';
import { crearClienteAdmin } from '@/lib/supabase/admin';
import { env } from '@/lib/env';
import { parsearImporte } from '@/lib/dinero';
import { comoErrorDominio, exito, fallo, type Resultado } from '@/lib/errores';

function valor(fd: FormData, key: string) {
  return String(fd.get(key) ?? '').trim();
}
function slugDe(v: string) {
  return v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}
function terminar(error?: string) {
  revalidatePath('/superadmin');
  redirect(error ? `/superadmin?error=${encodeURIComponent(error)}` : '/superadmin?guardado=1');
}

type AccesoPropietario = {
  enlace: string;
  nombre: string;
  correo: string;
  barberia: string;
  slug: string;
};

export async function crearOrganizacion(
  formData: FormData
): Promise<Resultado<AccesoPropietario>> {
  try {
    const { supabase, user } = await requerirSuperadmin();
    const datos = z
      .object({
        nombre: z.string().trim().min(2).max(120),
        slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/),
        ciudad: z.string().trim().min(2).max(100),
        correo: z.string().email(),
        propietario: z.string().trim().min(2).max(100),
        mensualidad: z.number().int().min(0),
        diaCorte: z.number().int().min(1).max(28),
      })
      .parse({
        nombre: valor(formData, 'nombre'),
        slug: slugDe(valor(formData, 'slug') || valor(formData, 'nombre')),
        ciudad: valor(formData, 'ciudad'),
        correo: valor(formData, 'correo'),
        propietario: valor(formData, 'propietario'),
        mensualidad: parsearImporte(valor(formData, 'mensualidad')) ?? -1,
        diaCorte: Number(valor(formData, 'dia_corte') || 1),
      });
    const { data: org, error } = await supabase
      .from('organizations')
      .insert({
        slug: datos.slug,
        nombre_comercial: datos.nombre,
        correo_contacto: datos.correo,
        estado: 'onboarding',
        creado_por: user.id,
      })
      .select('id')
      .single();
    if (error) throw error;
    const locationSlug = slugDe(`${datos.ciudad}-principal`).slice(0, 38);
    const proxima = new Date();
    proxima.setMonth(proxima.getMonth() + 1);
    const resultados = await Promise.all([
      supabase.from('organization_settings').insert({ organization_id: org.id }),
      supabase
        .from('organization_themes')
        .insert({ organization_id: org.id, eslogan: datos.nombre }),
      supabase.from('locations').insert({
        organization_id: org.id,
        slug: locationSlug,
        nombre: 'Sucursal principal',
        ciudad: datos.ciudad,
        es_principal: true,
      }),
      supabase.from('billing_accounts').insert({
        organization_id: org.id,
        mensualidad_centavos: datos.mensualidad,
        dia_corte: datos.diaCorte,
        proxima_fecha_pago: proxima.toISOString().slice(0, 10),
      }),
      supabase.from('organization_domains').insert({
        organization_id: org.id,
        tipo: 'ruta',
        valor: `/b/${datos.slug}`,
        verificado: true,
        es_principal: true,
      }),
    ]);
    const fallo = resultados.find((r) => r.error)?.error;
    if (fallo) throw fallo;

    const admin = crearClienteAdmin();
    const invitacion = await admin.auth.admin.generateLink({
      type: 'invite',
      email: datos.correo,
      options: {
        data: { nombre: datos.propietario, organization_slug: datos.slug },
      },
    });
    if (invitacion.error || !invitacion.data.user)
      throw invitacion.error ?? new Error('No fue posible invitar al propietario');

    const enlaceInvitacion = new URL('/auth/confirm', env.NEXT_PUBLIC_APP_URL);
    enlaceInvitacion.searchParams.set('token_hash', invitacion.data.properties.hashed_token);
    enlaceInvitacion.searchParams.set('type', 'invite');
    enlaceInvitacion.searchParams.set('next', '/actualizar-contrasena');

    await admin.from('profiles').upsert({ id: invitacion.data.user.id, nombre: datos.propietario });
    const { error: memberError } = await admin.from('organization_members').insert({
      organization_id: org.id,
      usuario_id: invitacion.data.user.id,
      rol: 'organization_owner',
      estado: 'activa',
      creado_por: user.id,
    });
    if (memberError) throw memberError;
    revalidatePath('/superadmin');
    return exito({
      enlace: enlaceInvitacion.toString(),
      nombre: datos.propietario,
      correo: datos.correo,
      barberia: datos.nombre,
      slug: datos.slug,
    });
  } catch (error) {
    return fallo(error);
  }
}

export async function accionOrganizacion(formData: FormData) {
  let mensaje: string | undefined;
  try {
    const { supabase } = await requerirSuperadmin();
    const id = z.string().uuid().parse(valor(formData, 'organization_id'));
    const accion = z.enum(['suspender', 'reactivar']).parse(valor(formData, 'accion'));
    const { error } =
      accion === 'suspender'
        ? await supabase.rpc('fn_suspender_organizacion', {
            p_organization_id: id,
            p_motivo: z.string().trim().min(4).max(500).parse(valor(formData, 'motivo')),
          })
        : await supabase.rpc('fn_reactivar_organizacion', {
            p_organization_id: id,
            p_nota: valor(formData, 'motivo') || null,
          });
    if (error) throw error;
  } catch (error) {
    mensaje = comoErrorDominio(error).message;
  }
  terminar(mensaje);
}

export async function eliminarOrganizacion(formData: FormData) {
  let mensaje: string | undefined;
  try {
    const { supabase } = await requerirSuperadmin();
    const id = z.string().uuid().parse(valor(formData, 'organization_id'));
    const confirmacion = valor(formData, 'confirmacion').toLowerCase();
    const { data: organizacion, error: errorOrganizacion } = await supabase
      .from('organizations')
      .select('id, slug, nombre_comercial, estado')
      .eq('id', id)
      .single();
    if (errorOrganizacion || !organizacion) throw errorOrganizacion ?? new Error('NO_ENCONTRADO');
    if (organizacion.estado === 'active') throw new Error('BARBERIA_ACTIVA');
    if (confirmacion !== String(organizacion.slug).toLowerCase()) {
      throw new Error('CONFIRMACION_INCORRECTA');
    }
    const { error } = await supabase.rpc('fn_eliminar_organizacion', {
      p_organization_id: id,
    });
    if (error) throw error;
  } catch (error) {
    const codigo = error instanceof Error ? error.message : '';
    if (codigo === 'BARBERIA_ACTIVA') {
      mensaje = 'Primero suspende la barbería antes de eliminarla.';
    } else if (codigo === 'CONFIRMACION_INCORRECTA') {
      mensaje = 'El identificador escrito no coincide con el de la barbería.';
    } else {
      mensaje = comoErrorDominio(error).message;
    }
  }
  terminar(mensaje);
}

export async function registrarPago(formData: FormData) {
  let mensaje: string | undefined;
  try {
    const { supabase } = await requerirSuperadmin();
    const monto = parsearImporte(valor(formData, 'monto'));
    if (!monto || monto <= 0) throw new Error('DATOS_INVALIDOS');
    const { error } = await supabase.rpc('fn_registrar_pago_manual', {
      p_organization_id: z.string().uuid().parse(valor(formData, 'organization_id')),
      p_monto_centavos: monto,
      p_fecha_pago: valor(formData, 'fecha_pago'),
      p_referencia: valor(formData, 'referencia') || null,
      p_periodo_inicio: valor(formData, 'periodo_inicio') || null,
      p_periodo_fin: valor(formData, 'periodo_fin') || null,
      p_notas: valor(formData, 'notas') || null,
      p_avanzar_vencimiento: true,
    });
    if (error) throw error;
  } catch (error) {
    mensaje = comoErrorDominio(error).message;
  }
  terminar(mensaje);
}

export async function guardarDatosBancarios(formData: FormData) {
  let mensaje: string | undefined;
  try {
    const { supabase, user } = await requerirSuperadmin();
    const { error } = await supabase.from('platform_settings').upsert({
      id: true,
      nombre_plataforma: env.NEXT_PUBLIC_PLATFORM_NAME,
      banco_nombre: valor(formData, 'banco') || null,
      banco_titular: valor(formData, 'titular') || null,
      banco_clabe: valor(formData, 'clabe') || null,
      banco_cuenta: valor(formData, 'cuenta') || null,
      instrucciones_pago: valor(formData, 'instrucciones') || null,
      whatsapp_soporte: valor(formData, 'whatsapp') || null,
      actualizado_por: user.id,
    });
    if (error) throw error;
  } catch (error) {
    mensaje = comoErrorDominio(error).message;
  }
  terminar(mensaje);
}
