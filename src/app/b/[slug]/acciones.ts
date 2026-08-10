'use server';

import { z } from 'zod';
import { crearClientePublico } from '@/lib/supabase/servidor';
import { organizacionPorSlug } from '@/lib/tenant/resolver';
import { fallo, exito, type Resultado } from '@/lib/errores';

const uuid = z.string().uuid();
const telefono = z.string().trim().min(10).max(18);
const nombre = z.string().trim().min(2).max(100);

export async function crearCitaPublica(
  slug: string,
  entrada: {
    locationId: string;
    barberId: string;
    serviceIds: string[];
    inicio: string;
    nombre: string;
    telefono: string;
    notas?: string;
  }
): Promise<Resultado<{ folio: string; totalCentavos: number; fin: string; token: string }>> {
  try {
    const org = await organizacionPorSlug(slug);
    if (!org) throw new Error('NO_ENCONTRADO');
    const datos = z
      .object({
        locationId: uuid,
        barberId: uuid,
        serviceIds: z.array(uuid).min(1).max(6),
        // PostgREST serializa timestamptz como +00:00; Zod exige habilitar
        // explícitamente los offsets además del formato terminado en Z.
        inicio: z.string().datetime({ offset: true }),
        nombre,
        telefono,
        notas: z.string().trim().max(500).optional(),
      })
      .parse(entrada);
    const supabase = crearClientePublico();
    const { data, error } = await supabase.rpc('fn_crear_cita', {
      p_organization_id: org.id,
      p_location_id: datos.locationId,
      p_barbero_id: datos.barberId,
      p_servicio_ids: datos.serviceIds,
      p_inicio: datos.inicio,
      p_nombre: datos.nombre,
      p_telefono: datos.telefono,
      p_es_express: false,
      p_canal: 'web',
      p_notas: datos.notas || null,
    });
    if (error) throw error;
    const cita = Array.isArray(data) ? data[0] : data;
    return exito({
      folio: String(cita?.folio ?? ''),
      totalCentavos: Number(cita?.total_centavos ?? 0),
      fin: String(cita?.fin ?? ''),
      token: String(cita?.token_acceso ?? ''),
    });
  } catch (error) {
    return fallo(error);
  }
}

export type CitaPublica = {
  citaId: string;
  folio: string;
  inicio: string;
  fin: string;
  estado: string;
  totalCentavos: number;
  cliente: string;
  barbero: string;
  sucursal: string;
  cancelacionPermitida: boolean;
};

export async function consultarCitaPublica(
  slug: string,
  token: string
): Promise<Resultado<CitaPublica>> {
  try {
    const org = await organizacionPorSlug(slug);
    if (!org) throw new Error('NO_ENCONTRADO');
    const tokenValido = z.string().min(40).max(160).parse(token);
    const { data, error } = await crearClientePublico().rpc('fn_consultar_cita_publica', {
      p_organization_id: org.id,
      p_token: tokenValido,
    });
    if (error) throw error;
    const cita = Array.isArray(data) ? data[0] : data;
    if (!cita) throw new Error('NO_ENCONTRADO');
    return exito({
      citaId: String(cita.cita_id),
      folio: String(cita.folio),
      inicio: String(cita.inicio),
      fin: String(cita.fin),
      estado: String(cita.estado),
      totalCentavos: Number(cita.total_centavos),
      cliente: String(cita.cliente_nombre),
      barbero: String(cita.barbero_nombre),
      sucursal: String(cita.sucursal_nombre),
      cancelacionPermitida: Boolean(cita.cancelacion_permitida),
    });
  } catch (error) {
    return fallo(error);
  }
}

export async function cancelarCitaPublica(
  slug: string,
  token: string,
  motivo: string
): Promise<Resultado<{ cancelada: true }>> {
  try {
    const org = await organizacionPorSlug(slug);
    if (!org) throw new Error('NO_ENCONTRADO');
    const { error } = await crearClientePublico().rpc('fn_cancelar_cita_publica', {
      p_organization_id: org.id,
      p_token: z.string().min(40).max(160).parse(token),
      p_motivo: z.string().trim().min(4).max(300).parse(motivo),
    });
    if (error) throw error;
    return exito({ cancelada: true });
  } catch (error) {
    return fallo(error);
  }
}

export async function crearPedidoPublico(
  slug: string,
  entrada: {
    locationId: string;
    items: { producto_id: string; cantidad: number }[];
    nombre: string;
    telefono: string;
    notas?: string;
  }
): Promise<Resultado<{ folio: string; totalCentavos: number; expiraEn: string }>> {
  try {
    const org = await organizacionPorSlug(slug);
    if (!org) throw new Error('NO_ENCONTRADO');
    const datos = z
      .object({
        locationId: uuid,
        items: z
          .array(z.object({ producto_id: uuid, cantidad: z.number().int().min(1).max(20) }))
          .min(1)
          .max(30),
        nombre,
        telefono,
        notas: z.string().trim().max(500).optional(),
      })
      .parse(entrada);
    const supabase = crearClientePublico();
    const { data, error } = await supabase.rpc('fn_crear_pedido_con_reserva', {
      p_organization_id: org.id,
      p_location_id: datos.locationId,
      p_items: datos.items,
      p_nombre: datos.nombre,
      p_telefono: datos.telefono,
      p_notas: datos.notas || null,
    });
    if (error) throw error;
    const pedido = Array.isArray(data) ? data[0] : data;
    return exito({
      folio: String(pedido?.folio ?? ''),
      totalCentavos: Number(pedido?.total_centavos ?? 0),
      expiraEn: String(pedido?.expira_en ?? ''),
    });
  } catch (error) {
    return fallo(error);
  }
}
