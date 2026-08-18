import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { crearClientePublico } from '@/lib/supabase/servidor';
import { organizacionPorSlug } from '@/lib/tenant/resolver';

const consulta = z.object({
  locationId: z.string().uuid(),
  barberId: z.string().uuid(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

function fechaEnZona(fecha: Date, zonaHoraria: string): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: zonaHoraria,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(fecha);
  const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((parte) => parte.type === tipo)?.value ?? '';
  return `${valor('year')}-${valor('month')}-${valor('day')}`;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const parsed = consulta.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: 'Consulta inválida' }, { status: 400 });
  const serviceIds = [...new Set(request.nextUrl.searchParams.getAll('serviceId'))];
  const serviciosValidos = z.array(z.string().uuid()).min(1).max(6).safeParse(serviceIds);
  if (!serviciosValidos.success)
    return NextResponse.json({ error: 'Selecciona entre uno y seis servicios' }, { status: 400 });
  const org = await organizacionPorSlug(slug);
  if (!org) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  const supabase = crearClientePublico();
  const [servicios, ajustes, ubicacion, ajustesBarbero] = await Promise.all([
    supabase
      .from('services')
      .select('id, duracion_minutos')
      .eq('organization_id', org.id)
      .eq('activo', true)
      .in('id', serviciosValidos.data),
    supabase
      .from('organization_settings')
      .select('express_activa')
      .eq('organization_id', org.id)
      .maybeSingle(),
    supabase
      .from('locations')
      .select('zona_horaria')
      .eq('organization_id', org.id)
      .eq('id', parsed.data.locationId)
      .eq('activa', true)
      .maybeSingle(),
    supabase
      .from('barber_services')
      .select('servicio_id, duracion_override_minutos')
      .eq('organization_id', org.id)
      .eq('barbero_id', parsed.data.barberId)
      .in('servicio_id', serviciosValidos.data),
  ]);
  if (
    servicios.error ||
    ajustes.error ||
    ubicacion.error ||
    ajustesBarbero.error ||
    !ubicacion.data
  )
    return NextResponse.json({ error: 'No fue posible consultar horarios' }, { status: 400 });
  if ((servicios.data ?? []).length !== serviciosValidos.data.length)
    return NextResponse.json(
      { error: 'Uno o más servicios no están disponibles' },
      { status: 404 }
    );

  const zonaHoraria = ubicacion.data.zona_horaria || org.zonaHoraria;
  const esHoy = parsed.data.fecha === fechaEnZona(new Date(), zonaHoraria);
  if (esHoy && !(ajustes.data?.express_activa ?? true)) {
    return NextResponse.json(
      { slots: [], motivo: 'La barbería no acepta reservaciones para el mismo día' },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const duraciones = new Map(
    (ajustesBarbero.data ?? []).map((ajuste) => [
      ajuste.servicio_id,
      ajuste.duracion_override_minutos,
    ])
  );
  const duracionTotal = (servicios.data ?? []).reduce(
    (total, servicio) => total + (duraciones.get(servicio.id) ?? servicio.duracion_minutos),
    0
  );
  const { data, error } = await supabase.rpc('fn_slots_disponibles', {
    p_organization_id: org.id,
    p_location_id: parsed.data.locationId,
    p_barbero_id: parsed.data.barberId,
    p_fecha: parsed.data.fecha,
    p_duracion_minutos: duracionTotal,
  });
  if (error)
    return NextResponse.json({ error: 'No fue posible consultar horarios' }, { status: 400 });
  return NextResponse.json({ slots: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
}
