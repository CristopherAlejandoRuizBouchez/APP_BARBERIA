import { cache } from 'react';
import { crearClienteServidor, crearClientePublico } from '@/lib/supabase/servidor';
import type { ContextoSesion, Rol } from './roles';
import type { EstadoOrganizacion } from './facturacion';
import type { FuentePermitida, Plantilla } from '@/lib/temas/plantillas';

/**
 * Resolución de la organización y de la sesión. Todo ocurre EN EL SERVIDOR.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  El `organization_id` NUNCA se toma de un parámetro del navegador.
 *
 *  El slug de la URL solo sirve para BUSCAR la organización. La autorización
 *  se deriva después de `auth.uid()` y de las membresías reales, y las
 *  políticas de RLS la vuelven a comprobar en la base. Tres capas para lo
 *  mismo, a propósito.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `cache()` de React memoiza por petición: varias secciones de la misma página
 * pueden pedir la organización sin generar varias consultas.
 */

export type OrganizacionPublica = {
  id: string;
  slug: string;
  nombreComercial: string;
  estado: EstadoOrganizacion;
  telefonoWhatsapp: string | null;
  correoContacto: string | null;
  zonaHoraria: string;
};

export type TemaOrganizacion = {
  plantilla: Plantilla;
  logoUrl: string | null;
  faviconUrl: string | null;
  portadaUrl: string | null;
  eslogan: string | null;
  descripcion: string | null;
  colorPrimario: string;
  colorSecundario: string;
  colorFondo: string;
  colorSuperficie: string;
  colorTexto: string;
  fuenteTitulos: FuentePermitida;
  fuenteCuerpo: FuentePermitida;
  radioBordes: 'recto' | 'suave' | 'redondeado';
  textura: 'ninguna' | 'grano' | 'lineas' | 'trama';
  seccionesVisibles: string[];
  ordenSecciones: string[];
  redesSociales: Record<string, string>;
};

export type SucursalPublica = {
  id: string;
  slug: string;
  nombre: string;
  esPrincipal: boolean;
  ciudad: string;
  direccionCorta: string;
  telefonoWhatsapp: string | null;
  zonaHoraria: string;
  mapaEmbedUrl: string | null;
};

/**
 * Busca una barbería por su slug para el sitio público.
 *
 * Devuelve null si no existe O si está suspendida: la política de RLS
 * `org_publica` solo deja pasar las que están en estado `active`. El visitante
 * ve "Sitio temporalmente no disponible" sin enterarse de que hay un adeudo.
 */
export const organizacionPorSlug = cache(
  async (slug: string): Promise<OrganizacionPublica | null> => {
    const supabase = crearClientePublico();

    const { data, error } = await supabase
      .from('organizations')
      .select(
        'id, slug, nombre_comercial, estado, telefono_whatsapp, correo_contacto, zona_horaria'
      )
      .eq('slug', slug)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      slug: data.slug,
      nombreComercial: data.nombre_comercial,
      estado: data.estado,
      telefonoWhatsapp: data.telefono_whatsapp,
      correoContacto: data.correo_contacto,
      zonaHoraria: data.zona_horaria,
    };
  }
);

/** Apariencia publicada de una barbería. */
export const temaDeOrganizacion = cache(
  async (organizationId: string): Promise<TemaOrganizacion | null> => {
    const supabase = crearClientePublico();

    const { data, error } = await supabase
      .from('organization_themes')
      .select('*')
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (error || !data) return null;

    return {
      plantilla: data.plantilla,
      logoUrl: data.logo_url,
      faviconUrl: data.favicon_url,
      portadaUrl: data.portada_url,
      eslogan: data.eslogan,
      descripcion: data.descripcion,
      colorPrimario: data.color_primario,
      colorSecundario: data.color_secundario,
      colorFondo: data.color_fondo,
      colorSuperficie: data.color_superficie,
      colorTexto: data.color_texto,
      fuenteTitulos: data.fuente_titulos as FuentePermitida,
      fuenteCuerpo: data.fuente_cuerpo as FuentePermitida,
      radioBordes: data.radio_bordes,
      textura: data.textura_fondo,
      seccionesVisibles: data.secciones_visibles ?? [],
      ordenSecciones: data.orden_secciones ?? [],
      redesSociales: data.redes_sociales ?? {},
    };
  }
);

/** Sucursales activas de una barbería, la principal primero. */
export const sucursalesDeOrganizacion = cache(
  async (organizationId: string): Promise<SucursalPublica[]> => {
    const supabase = crearClientePublico();

    const { data, error } = await supabase
      .from('locations')
      .select(
        'id, slug, nombre, es_principal, ciudad, calle, numero, colonia, telefono_whatsapp, zona_horaria, mapa_embed_url'
      )
      .eq('organization_id', organizationId)
      .eq('activa', true)
      .order('es_principal', { ascending: false })
      .order('orden', { ascending: true });

    if (error || !data) return [];

    return data.map((l) => ({
      id: l.id,
      slug: l.slug,
      nombre: l.nombre,
      esPrincipal: l.es_principal,
      ciudad: l.ciudad,
      direccionCorta: [l.calle, l.numero, l.colonia].filter(Boolean).join(' '),
      telefonoWhatsapp: l.telefono_whatsapp,
      zonaHoraria: l.zona_horaria,
      mapaEmbedUrl: l.mapa_embed_url,
    }));
  }
);

/**
 * Contexto de la sesión: quién es, en qué organización y con qué rol.
 *
 * Se deriva de `auth.uid()`, no del slug de la URL. Si alguien cambia el slug
 * a mano, la membresía no aparece y no obtiene permisos.
 */
export const contextoSesion = cache(
  async (organizationId: string | null): Promise<ContextoSesion | null> => {
    const supabase = await crearClienteServidor();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const { data: superadmin } = await supabase
      .from('platform_superadmins')
      .select('usuario_id')
      .eq('usuario_id', user.id)
      .eq('activo', true)
      .maybeSingle();

    const esSuperadmin = Boolean(superadmin);

    if (!organizationId) {
      return {
        usuarioId: user.id,
        esSuperadmin,
        organizationId: null,
        rol: esSuperadmin ? 'platform_superadmin' : null,
        sucursales: [],
        organizacionOperativa: true,
      };
    }

    const { data: org } = await supabase
      .from('organizations')
      .select('estado')
      .eq('id', organizationId)
      .maybeSingle();

    const operativa = org?.estado === 'active';

    const { data: membresia } = await supabase
      .from('organization_members')
      .select('rol, sucursales')
      .eq('organization_id', organizationId)
      .eq('usuario_id', user.id)
      .eq('estado', 'activa')
      .maybeSingle();

    if (!membresia) return null;

    return {
      usuarioId: user.id,
      esSuperadmin,
      organizationId,
      rol: membresia.rol as Rol,
      sucursales: (membresia.sucursales ?? []) as string[],
      organizacionOperativa: operativa,
    };
  }
);

/** Organizaciones a las que pertenece la sesión, para el selector del panel. */
export const misOrganizaciones = cache(async () => {
  const supabase = await crearClienteServidor();

  const { data, error } = await supabase
    .from('organizations')
    .select('id, slug, nombre_comercial, estado')
    .order('nombre_comercial');

  if (error || !data) return [];
  return data;
});
