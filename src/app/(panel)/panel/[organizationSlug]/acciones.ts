'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requerirOrganizacion } from '@/lib/auth/guardas';
import { aCentavos, parsearImporte } from '@/lib/dinero';
import { comoErrorDominio, fallo, exito, type Resultado } from '@/lib/errores';
import { puede, type Permiso } from '@/lib/tenant/roles';
import { crearClienteAdmin } from '@/lib/supabase/admin';
import { env, hostsDeAlmacenamiento } from '@/lib/env';
import { contrasteSuficiente, validarTema } from '@/lib/temas/validacion';

const texto = z.string().trim().min(1).max(180);
const uuid = z.string().uuid();
const horaHorario = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

function valor(formData: FormData, clave: string): string {
  return String(formData.get(clave) ?? '').trim();
}

function slugDe(entrada: string): string {
  return entrada
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 38);
}

function centavosDe(entrada: string): number {
  const importe = parsearImporte(entrada);
  if (importe === null || importe < 0) throw new Error('DATOS_INVALIDOS');
  return importe;
}

async function contextoConPermiso(slug: string, permiso: Permiso) {
  const contexto = await requerirOrganizacion(slug);
  if (!puede(contexto.contexto, permiso)) throw new Error('NO_AUTORIZADO');
  return contexto;
}

function terminar(slug: string, modulo: string, error?: string) {
  const ruta = `/panel/${slug}/${modulo}`;
  revalidatePath(ruta);
  redirect(error ? `${ruta}?error=${encodeURIComponent(error)}` : `${ruta}?guardado=1`);
}

export async function guardarCatalogo(slug: string, formData: FormData) {
  const modulo = valor(formData, 'modulo');
  let mensajeError: string | undefined;

  try {
    const { supabase, organizacion } = await contextoConPermiso(slug, 'catalogo.editar');
    if (modulo === 'servicios') {
      const nombre = texto.parse(valor(formData, 'nombre'));
      const { error } = await supabase.from('services').insert({
        organization_id: organizacion.id,
        slug: slugDe(nombre),
        nombre,
        descripcion: valor(formData, 'descripcion') || null,
        duracion_minutos: z.coerce
          .number()
          .int()
          .min(5)
          .max(600)
          .parse(valor(formData, 'duracion')),
        precio_centavos: centavosDe(valor(formData, 'precio')),
        destacado: formData.get('destacado') === 'on',
      });
      if (error) throw error;
    } else if (modulo === 'productos') {
      const nombre = texto.parse(valor(formData, 'nombre'));
      const { error } = await supabase.from('products').insert({
        organization_id: organizacion.id,
        sku: texto.parse(valor(formData, 'sku')).toUpperCase(),
        slug: slugDe(nombre),
        nombre,
        marca: valor(formData, 'marca') || null,
        descripcion: valor(formData, 'descripcion') || null,
        precio_venta_centavos: centavosDe(valor(formData, 'precio')),
        costo_centavos: centavosDe(valor(formData, 'costo') || '0'),
        visible_en_tienda: formData.get('visible') === 'on',
        destacado: formData.get('destacado') === 'on',
      });
      if (error) throw error;
    } else {
      throw new Error('DATOS_INVALIDOS');
    }
  } catch (error) {
    mensajeError = comoErrorDominio(error).message;
  }

  terminar(slug, modulo, mensajeError);
}

export async function actualizarServicio(slug: string, formData: FormData) {
  let mensajeError: string | undefined;

  try {
    const { supabase, organizacion } = await contextoConPermiso(slug, 'catalogo.editar');
    const id = uuid.parse(valor(formData, 'id'));
    const nombre = texto.parse(valor(formData, 'nombre'));
    const { error } = await supabase
      .from('services')
      .update({
        slug: slugDe(nombre),
        nombre,
        descripcion: valor(formData, 'descripcion') || null,
        duracion_minutos: z.coerce
          .number()
          .int()
          .min(5)
          .max(600)
          .parse(valor(formData, 'duracion')),
        precio_centavos: centavosDe(valor(formData, 'precio')),
        destacado: formData.get('destacado') === 'on',
        actualizado_en: new Date().toISOString(),
      })
      .eq('organization_id', organizacion.id)
      .eq('id', id);
    if (error) throw error;
  } catch (error) {
    mensajeError = comoErrorDominio(error).message;
  }

  terminar(slug, 'servicios', mensajeError);
}

export async function cambiarDisponibilidadServicio(slug: string, formData: FormData) {
  let mensajeError: string | undefined;

  try {
    const { supabase, organizacion } = await contextoConPermiso(slug, 'catalogo.editar');
    const id = uuid.parse(valor(formData, 'id'));
    const accion = z.enum(['activar', 'desactivar']).parse(valor(formData, 'accion'));
    const { error } = await supabase
      .from('services')
      .update({
        activo: accion === 'activar',
        actualizado_en: new Date().toISOString(),
      })
      .eq('organization_id', organizacion.id)
      .eq('id', id);
    if (error) throw error;
  } catch (error) {
    mensajeError = comoErrorDominio(error).message;
  }

  terminar(slug, 'servicios', mensajeError);
}

export async function cambiarDisponibilidadBarbero(slug: string, formData: FormData) {
  let mensajeError: string | undefined;

  try {
    const { supabase, organizacion } = await contextoConPermiso(slug, 'barberos.gestionar');
    const id = uuid.parse(valor(formData, 'id'));
    const accion = z.enum(['eliminar', 'reactivar']).parse(valor(formData, 'accion'));
    const { data, error } = await supabase
      .from('barbers')
      .update({
        activo: accion === 'reactivar',
        actualizado_en: new Date().toISOString(),
      })
      .eq('organization_id', organizacion.id)
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('NO_ENCONTRADO');

    revalidatePath(`/b/${slug}`, 'layout');
  } catch (error) {
    mensajeError = comoErrorDominio(error).message;
  }

  terminar(slug, 'barberos', mensajeError);
}

export async function guardarOperacion(slug: string, formData: FormData) {
  const modulo = valor(formData, 'modulo');
  let mensajeError: string | undefined;

  try {
    const permiso: Permiso =
      modulo === 'clientes'
        ? 'clientes.editar'
        : modulo === 'gastos'
          ? 'gastos.gestionar'
          : modulo === 'inventario'
            ? 'inventario.ajustar'
            : modulo === 'proveedores'
              ? 'compras.gestionar'
              : modulo === 'barberos'
                ? 'barberos.gestionar'
                : 'sucursales.gestionar';
    const { supabase, organizacion, user } = await contextoConPermiso(slug, permiso);

    if (modulo === 'clientes') {
      const telefono = valor(formData, 'telefono').replace(/\D/g, '');
      const normalizado = telefono.startsWith('52') ? `+${telefono}` : `+52${telefono}`;
      const { error } = await supabase.from('customers').insert({
        organization_id: organizacion.id,
        nombre: texto.parse(valor(formData, 'nombre')),
        telefono: normalizado,
        whatsapp: normalizado,
        correo: valor(formData, 'correo') || null,
        notas: valor(formData, 'notas') || null,
        acepta_promociones: formData.get('promociones') === 'on',
      });
      if (error) throw error;
    } else if (modulo === 'proveedores') {
      const { error } = await supabase.from('suppliers').insert({
        organization_id: organizacion.id,
        nombre: texto.parse(valor(formData, 'nombre')),
        contacto: valor(formData, 'contacto') || null,
        telefono: valor(formData, 'telefono') || null,
        correo: valor(formData, 'correo') || null,
        notas: valor(formData, 'notas') || null,
      });
      if (error) throw error;
    } else if (modulo === 'barberos') {
      const nombre = texto.parse(valor(formData, 'nombre'));
      const { data: barbero, error } = await supabase
        .from('barbers')
        .insert({
          organization_id: organizacion.id,
          slug: slugDe(nombre),
          nombre,
          apodo: valor(formData, 'apodo') || null,
          bio: valor(formData, 'bio') || null,
          especialidades: valor(formData, 'especialidades')
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
          comision_servicio_valor: z.coerce
            .number()
            .min(0)
            .max(100)
            .parse(valor(formData, 'comision') || '0'),
        })
        .select('id')
        .single();
      if (error) throw error;
      const { data: sucursales } = await supabase
        .from('locations')
        .select('id')
        .eq('organization_id', organizacion.id)
        .eq('activa', true);
      if (sucursales?.length) {
        const { error: ubicacionesError } = await supabase.from('barber_locations').insert(
          sucursales.map((s) => ({
            organization_id: organizacion.id,
            barbero_id: barbero.id,
            location_id: s.id,
          }))
        );
        if (ubicacionesError) throw ubicacionesError;
        const { error: horariosError } = await supabase.from('barber_schedules').insert(
          sucursales.flatMap((s) =>
            [1, 2, 3, 4, 5, 6].map((dia) => ({
              organization_id: organizacion.id,
              barbero_id: barbero.id,
              location_id: s.id,
              dia_semana: dia,
              hora_inicio: '09:00',
              hora_fin: '19:00',
            }))
          )
        );
        if (horariosError) throw horariosError;
      }
    } else if (modulo === 'sucursales') {
      const nombre = texto.parse(valor(formData, 'nombre'));
      const { error } = await supabase.from('locations').insert({
        organization_id: organizacion.id,
        slug: slugDe(nombre),
        nombre,
        ciudad: texto.parse(valor(formData, 'ciudad')),
        calle: valor(formData, 'calle') || null,
        numero: valor(formData, 'numero') || null,
        colonia: valor(formData, 'colonia') || null,
        telefono_whatsapp: valor(formData, 'whatsapp').replace(/\D/g, '') || null,
      });
      if (error) throw error;
    } else if (modulo === 'gastos') {
      const locationId = valor(formData, 'location_id');
      const { error } = await supabase.from('expenses').insert({
        organization_id: organizacion.id,
        location_id: locationId || null,
        concepto: texto.parse(valor(formData, 'concepto')),
        monto_centavos: centavosDe(valor(formData, 'monto')),
        fecha: valor(formData, 'fecha') || new Date().toISOString().slice(0, 10),
        metodo_pago: valor(formData, 'metodo') || 'efectivo',
        notas: valor(formData, 'notas') || null,
        registrado_por: user.id,
      });
      if (error) throw error;
    } else if (modulo === 'inventario') {
      const cantidad = z.coerce
        .number()
        .int()
        .refine((n) => n !== 0)
        .parse(valor(formData, 'cantidad'));
      const tipo = cantidad > 0 ? 'ajuste' : valor(formData, 'tipo_salida') || 'ajuste';
      const { error } = await supabase.from('inventory_movements').insert({
        organization_id: organizacion.id,
        location_id: uuid.parse(valor(formData, 'location_id')),
        producto_id: uuid.parse(valor(formData, 'producto_id')),
        tipo,
        cantidad,
        stock_anterior: 0,
        stock_nuevo: 0,
        motivo: texto.parse(valor(formData, 'motivo')),
        usuario_id: user.id,
      });
      if (error) throw error;
    } else {
      throw new Error('DATOS_INVALIDOS');
    }
  } catch (error) {
    mensajeError = comoErrorDominio(error).message;
  }

  terminar(slug, modulo, mensajeError);
}

export async function cambiarEstado(slug: string, formData: FormData) {
  const modulo = valor(formData, 'modulo');
  let mensajeError: string | undefined;
  try {
    const permiso: Permiso = modulo === 'agenda' ? 'agenda.mover' : 'pos.cobrar';
    const { supabase, organizacion } = await contextoConPermiso(slug, permiso);
    const id = uuid.parse(valor(formData, 'id'));
    const estado = texto.parse(valor(formData, 'estado'));
    const tabla = modulo === 'agenda' ? 'appointments' : 'orders';
    const cambios =
      modulo === 'agenda'
        ? { estado, actualizado_en: new Date().toISOString() }
        : {
            estado,
            ...(estado === 'confirmado' ? { confirmado_en: new Date().toISOString() } : {}),
            ...(estado === 'entregado' ? { entregado_en: new Date().toISOString() } : {}),
            ...(estado === 'cancelado'
              ? {
                  cancelado_en: new Date().toISOString(),
                  motivo_cancelacion: 'Cancelado por personal',
                }
              : {}),
          };
    const { error } = await supabase
      .from(tabla)
      .update(cambios)
      .eq('organization_id', organizacion.id)
      .eq('id', id);
    if (error) throw error;
  } catch (error) {
    mensajeError = comoErrorDominio(error).message;
  }
  terminar(slug, modulo, mensajeError);
}

export async function guardarHorarioBarbero(slug: string, formData: FormData) {
  let mensajeError: string | undefined;

  try {
    const { supabase, organizacion } = await contextoConPermiso(slug, 'barberos.gestionar');
    const barberoId = uuid.parse(valor(formData, 'barbero_id'));

    const [{ data: barbero, error: barberoError }, { data: ubicacion, error: ubicacionError }] =
      await Promise.all([
        supabase
          .from('barbers')
          .select('id')
          .eq('organization_id', organizacion.id)
          .eq('id', barberoId)
          .maybeSingle(),
        supabase
          .from('locations')
          .select('id')
          .eq('organization_id', organizacion.id)
          .eq('activa', true)
          .order('es_principal', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

    if (barberoError || !barbero || ubicacionError || !ubicacion) {
      throw new Error('DATOS_INVALIDOS');
    }

    const horarios = [0, 1, 2, 3, 4, 5, 6]
      .filter((dia) => formData.get(`dia_${dia}`) === 'on')
      .map((dia) => {
        const inicio = horaHorario.parse(valor(formData, `inicio_${dia}`));
        const fin = horaHorario.parse(valor(formData, `fin_${dia}`));
        if (fin <= inicio) throw new Error('DATOS_INVALIDOS');
        return {
          organization_id: organizacion.id,
          barbero_id: barberoId,
          location_id: ubicacion.id,
          dia_semana: dia,
          hora_inicio: inicio,
          hora_fin: fin,
          activo: true,
        };
      });

    const { error: eliminarError } = await supabase
      .from('barber_schedules')
      .delete()
      .eq('organization_id', organizacion.id)
      .eq('barbero_id', barberoId)
      .eq('location_id', ubicacion.id);

    if (eliminarError) throw eliminarError;

    if (horarios.length) {
      const { error: insertarError } = await supabase.from('barber_schedules').insert(horarios);
      if (insertarError) throw insertarError;
    }

    revalidatePath(`/b/${slug}/reservar`);
  } catch (error) {
    mensajeError = comoErrorDominio(error).message;
  }

  terminar(slug, 'barberos', mensajeError);
}

export async function guardarApariencia(slug: string, formData: FormData) {
  let mensajeError: string | undefined;
  try {
    const { supabase, organizacion, user } = await contextoConPermiso(slug, 'apariencia.editar');
    const temaValidado = validarTema(
      {
        plantilla: valor(formData, 'plantilla'),
        eslogan: valor(formData, 'eslogan'),
        descripcion: valor(formData, 'descripcion'),
        logoUrl: valor(formData, 'logo_url'),
        portadaUrl: valor(formData, 'portada_url'),
        colorPrimario: valor(formData, 'color_primario'),
        colorSecundario: valor(formData, 'color_secundario'),
        colorFondo: valor(formData, 'color_fondo'),
        colorSuperficie: valor(formData, 'color_superficie'),
        colorTexto: valor(formData, 'color_texto'),
        fuenteTitulos: valor(formData, 'fuente_titulos'),
        fuenteCuerpo: valor(formData, 'fuente_cuerpo'),
        radioBordes: valor(formData, 'radio_bordes'),
        textura: valor(formData, 'textura'),
      },
      hostsDeAlmacenamiento()
    );
    if (!temaValidado.ok) throw new Error('DATOS_INVALIDOS');
    const tema = temaValidado.tema;
    if (
      !tema.colorFondo ||
      !tema.colorTexto ||
      !contrasteSuficiente(tema.colorFondo, tema.colorTexto)
    )
      throw new Error('DATOS_INVALIDOS');

    const mostrarNosotros = formData.get('mostrar_nosotros') === 'on';
    const nosotrosTitulo = z.string().trim().max(120).parse(valor(formData, 'nosotros_titulo'));
    const nosotrosHistoria = z
      .string()
      .trim()
      .max(2000)
      .parse(valor(formData, 'nosotros_historia'));
    const nosotrosFrase = z.string().trim().max(180).parse(valor(formData, 'nosotros_frase'));

    if (mostrarNosotros && (nosotrosTitulo.length < 2 || nosotrosHistoria.length < 20)) {
      throw new Error('DATOS_INVALIDOS');
    }

    const ubicacion = z
      .object({
        ciudad: z.string().trim().min(2).max(100),
        calle: z.string().trim().min(2).max(180),
        numero: z.string().trim().max(40),
        colonia: z.string().trim().max(120),
      })
      .parse({
        ciudad: valor(formData, 'ciudad'),
        calle: valor(formData, 'calle'),
        numero: valor(formData, 'numero'),
        colonia: valor(formData, 'colonia'),
      });

    const { error: temaError } = await supabase
      .from('organization_themes')
      .update({
        plantilla: tema.plantilla,
        eslogan: tema.eslogan,
        descripcion: tema.descripcion,
        logo_url: tema.logoUrl,
        portada_url: tema.portadaUrl,
        color_primario: tema.colorPrimario,
        color_secundario: tema.colorSecundario,
        color_fondo: tema.colorFondo,
        color_superficie: tema.colorSuperficie,
        color_texto: tema.colorTexto,
        fuente_titulos: tema.fuenteTitulos,
        fuente_cuerpo: tema.fuenteCuerpo,
        radio_bordes: tema.radioBordes,
        textura_fondo: tema.textura,
        nosotros_titulo: nosotrosTitulo || null,
        nosotros_historia: nosotrosHistoria || null,
        nosotros_frase: nosotrosFrase || null,
        mostrar_nosotros: mostrarNosotros,
        publicado_en: new Date().toISOString(),
        actualizado_por: user.id,
      })
      .eq('organization_id', organizacion.id);

    if (temaError) throw temaError;

    const { data: ubicacionActual, error: consultaUbicacionError } = await supabase
      .from('locations')
      .select('id')
      .eq('organization_id', organizacion.id)
      .eq('activa', true)
      .order('es_principal', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (consultaUbicacionError || !ubicacionActual) throw new Error('DATOS_INVALIDOS');

    const { error: ubicacionError } = await supabase
      .from('locations')
      .update({
        ciudad: ubicacion.ciudad,
        calle: ubicacion.calle,
        numero: ubicacion.numero || null,
        colonia: ubicacion.colonia || null,
      })
      .eq('organization_id', organizacion.id)
      .eq('id', ubicacionActual.id);

    if (ubicacionError) throw ubicacionError;

    revalidatePath(`/b/${slug}`, 'layout');
    revalidatePath(`/b/${slug}/contacto`);
  } catch (error) {
    mensajeError = comoErrorDominio(error).message;
  }
  terminar(slug, 'apariencia', mensajeError);
}

export async function crearAccesoRecepcion(
  slug: string,
  formData: FormData
): Promise<Resultado<{ enlace: string; nombre: string; correo: string }>> {
  try {
    const { organizacion, user } = await contextoConPermiso(slug, 'usuarios.gestionar');
    const datos = z
      .object({
        nombre: z.string().trim().min(2).max(100),
        correo: z.string().email(),
      })
      .parse({
        nombre: valor(formData, 'nombre'),
        correo: valor(formData, 'correo').toLowerCase(),
      });
    const admin = crearClienteAdmin();
    const invitacion = await admin.auth.admin.generateLink({
      type: 'invite',
      email: datos.correo,
      options: {
        data: { nombre: datos.nombre, organization_slug: slug },
      },
    });
    if (invitacion.error || !invitacion.data.user)
      throw invitacion.error ?? new Error('ERROR_INESPERADO');

    // El action_link de Supabase puede devolver la sesión en el fragmento
    // (`#access_token=...`), que un Route Handler del servidor no puede leer.
    // Usamos el token cifrado para que /auth/confirm lo valide y guarde la
    // sesión en cookies, tanto en localhost como al publicar en Vercel.
    const enlaceInvitacion = new URL('/auth/confirm', env.NEXT_PUBLIC_APP_URL);
    enlaceInvitacion.searchParams.set('token_hash', invitacion.data.properties.hashed_token);
    enlaceInvitacion.searchParams.set('type', 'invite');
    enlaceInvitacion.searchParams.set('next', '/actualizar-contrasena');

    await admin.from('profiles').upsert({ id: invitacion.data.user.id, nombre: datos.nombre });
    const { error } = await admin.from('organization_members').insert({
      organization_id: organizacion.id,
      usuario_id: invitacion.data.user.id,
      rol: 'receptionist',
      estado: 'activa',
      creado_por: user.id,
    });
    if (error) throw error;
    revalidatePath(`/panel/${slug}/equipo`);
    return exito({
      enlace: enlaceInvitacion.toString(),
      nombre: datos.nombre,
      correo: datos.correo,
    });
  } catch (error) {
    return fallo(error);
  }
}

export async function cambiarAccesoRecepcion(slug: string, formData: FormData) {
  let mensajeError: string | undefined;
  try {
    const { supabase, organizacion } = await contextoConPermiso(slug, 'usuarios.gestionar');
    const estado = z.enum(['activa', 'suspendida']).parse(valor(formData, 'estado'));
    const { error } = await supabase
      .from('organization_members')
      .update({
        estado,
        revocada_en: estado === 'suspendida' ? new Date().toISOString() : null,
      })
      .eq('id', uuid.parse(valor(formData, 'membresia_id')))
      .eq('organization_id', organizacion.id)
      .eq('rol', 'receptionist');
    if (error) throw error;
  } catch (error) {
    mensajeError = comoErrorDominio(error).message;
  }
  terminar(slug, 'equipo', mensajeError);
}

export async function gestionarCaja(slug: string, formData: FormData) {
  let mensajeError: string | undefined;
  try {
    const accion = z.enum(['abrir', 'cerrar']).parse(valor(formData, 'accion'));
    const { supabase, organizacion, user } = await contextoConPermiso(
      slug,
      accion === 'abrir' ? 'caja.abrir' : 'caja.cerrar'
    );
    if (accion === 'abrir') {
      const { error } = await supabase.from('cash_registers').insert({
        organization_id: organizacion.id,
        location_id: uuid.parse(valor(formData, 'location_id')),
        turno: valor(formData, 'turno') || null,
        fondo_inicial_centavos: centavosDe(valor(formData, 'fondo') || '0'),
        abierto_por: user.id,
      });
      if (error) throw error;
    } else {
      const { error } = await supabase.rpc('fn_cerrar_caja', {
        p_organization_id: organizacion.id,
        p_caja_id: uuid.parse(valor(formData, 'caja_id')),
        p_efectivo_contado_centavos: centavosDe(valor(formData, 'contado')),
        p_notas: valor(formData, 'notas') || null,
      });
      if (error) throw error;
    }
  } catch (error) {
    mensajeError = comoErrorDominio(error).message;
  }
  terminar(slug, 'caja', mensajeError);
}

export async function guardarConfiguracion(slug: string, formData: FormData) {
  let mensajeError: string | undefined;
  try {
    const { supabase, organizacion } = await contextoConPermiso(slug, 'configuracion.editar');
    const datos = z
      .object({
        intervalo: z.coerce.number().int().min(5).max(60),
        anticipacion: z.coerce.number().int().min(0).max(10080),
        maximoDias: z.coerce.number().int().min(1).max(365),
        cancelacion: z.coerce.number().int().min(0).max(168),
        reserva: z.coerce.number().int().min(5).max(1440),
        recordatorio: z.coerce.number().int().min(1).max(168),
      })
      .parse({
        intervalo: valor(formData, 'intervalo'),
        anticipacion: valor(formData, 'anticipacion'),
        maximoDias: valor(formData, 'maximo_dias'),
        cancelacion: valor(formData, 'cancelacion'),
        reserva: valor(formData, 'reserva'),
        recordatorio: valor(formData, 'recordatorio'),
      });
    const { error } = await supabase
      .from('organization_settings')
      .update({
        intervalo_slots_minutos: datos.intervalo,
        anticipacion_minima_minutos: datos.anticipacion,
        anticipacion_maxima_dias: datos.maximoDias,
        cancelacion_horas_limite: datos.cancelacion,
        reserva_pedido_activa: formData.get('reserva_activa') === 'on',
        reserva_pedido_minutos: datos.reserva,
        express_activa: formData.get('express_activa') === 'on',
        recordatorio_1_activo: formData.get('recordatorio_activo') === 'on',
        recordatorio_1_horas_antes: datos.recordatorio,
      })
      .eq('organization_id', organizacion.id);
    if (error) throw error;
  } catch (error) {
    mensajeError = comoErrorDominio(error).message;
  }
  terminar(slug, 'configuracion', mensajeError);
}

export async function marcarWhatsappEnviado(slug: string, formData: FormData) {
  let mensajeError: string | undefined;
  try {
    const { supabase, organizacion, user } = await contextoConPermiso(slug, 'agenda.crear');
    const { error } = await supabase
      .from('whatsapp_messages')
      .update({
        estado: 'manual_enviado',
        enviado_en: new Date().toISOString(),
        enviado_manual_por: user.id,
      })
      .eq('organization_id', organizacion.id)
      .eq('id', uuid.parse(valor(formData, 'id')))
      .in('estado', ['manual_pendiente', 'listo_para_envio']);
    if (error) throw error;
  } catch (error) {
    mensajeError = comoErrorDominio(error).message;
  }
  terminar(slug, 'whatsapp', mensajeError);
}

export type ItemPos = {
  tipo: 'producto' | 'servicio';
  id: string;
  cantidad: number;
  barbero_id?: string;
};

export async function crearVentaPos(
  slug: string,
  entrada: {
    locationId: string;
    items: ItemPos[];
    metodo: 'efectivo' | 'tarjeta_fisica' | 'transferencia' | 'otro';
    recibidoPesos?: number;
    barberoId?: string;
    clienteId?: string;
  }
): Promise<Resultado<{ folio: string; totalCentavos: number; cambioCentavos: number }>> {
  try {
    const { supabase, organizacion } = await contextoConPermiso(slug, 'pos.cobrar');
    const items = z
      .array(
        z.object({
          tipo: z.enum(['producto', 'servicio']),
          id: z.string().uuid(),
          cantidad: z.number().int().min(1).max(99),
          barbero_id: z.string().uuid().optional(),
        })
      )
      .min(1)
      .parse(entrada.items);

    const idsProductos = items.filter((i) => i.tipo === 'producto').map((i) => i.id);
    const idsServicios = items.filter((i) => i.tipo === 'servicio').map((i) => i.id);
    const [productos, servicios] = await Promise.all([
      idsProductos.length
        ? supabase
            .from('products')
            .select('id, precio_venta_centavos')
            .eq('organization_id', organizacion.id)
            .in('id', idsProductos)
        : Promise.resolve({ data: [], error: null }),
      idsServicios.length
        ? supabase
            .from('services')
            .select('id, precio_centavos')
            .eq('organization_id', organizacion.id)
            .in('id', idsServicios)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (productos.error || servicios.error) throw productos.error ?? servicios.error;
    const precios = new Map<string, number>();
    for (const p of productos.data ?? []) precios.set(p.id, p.precio_venta_centavos);
    for (const s of servicios.data ?? []) precios.set(s.id, s.precio_centavos);
    const total = items.reduce(
      (suma, item) => suma + (precios.get(item.id) ?? 0) * item.cantidad,
      0
    );
    if (total <= 0 || precios.size !== new Set(items.map((i) => i.id)).size)
      throw new Error('DATOS_INVALIDOS');

    const recibidoCentavos =
      entrada.metodo === 'efectivo' ? aCentavos(entrada.recibidoPesos ?? total / 100) : null;
    if (recibidoCentavos !== null && recibidoCentavos < total) throw new Error('DATOS_INVALIDOS');

    const pago = {
      metodo: entrada.metodo,
      monto_centavos: total,
      ...(entrada.metodo === 'efectivo' ? { recibido_centavos: recibidoCentavos } : {}),
    };
    const { data, error } = await supabase.rpc('fn_crear_venta', {
      p_organization_id: organizacion.id,
      p_location_id: uuid.parse(entrada.locationId),
      p_items: items,
      p_pagos: [pago],
      p_cliente_id: entrada.clienteId || null,
      p_barbero_id: entrada.barberoId || null,
      p_cita_id: null,
      p_pedido_id: null,
      p_descuento_centavos: 0,
      p_notas: null,
    });
    if (error) throw error;
    const venta = Array.isArray(data) ? data[0] : data;
    revalidatePath(`/panel/${slug}`);
    revalidatePath(`/panel/${slug}/ventas`);
    return exito({
      folio: String(venta?.folio ?? ''),
      totalCentavos: Number(venta?.total_centavos ?? total),
      cambioCentavos: recibidoCentavos === null ? 0 : recibidoCentavos - total,
    });
  } catch (error) {
    return fallo(error);
  }
}
