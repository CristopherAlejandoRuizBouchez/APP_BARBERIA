import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { crearClientePublico } from '@/lib/supabase/servidor';
import { organizacionPorSlug } from '@/lib/tenant/resolver';

const consulta = z.object({
  locationId: z.string().uuid(),
  barberId: z.string().uuid(),
  serviceId: z.string().uuid(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const parsed = consulta.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: 'Consulta inválida' }, { status: 400 });
  const org = await organizacionPorSlug(slug);
  if (!org) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  const supabase = crearClientePublico();
  const { data: servicio } = await supabase
    .from('services')
    .select('duracion_minutos')
    .eq('organization_id', org.id)
    .eq('id', parsed.data.serviceId)
    .eq('activo', true)
    .maybeSingle();
  if (!servicio) return NextResponse.json({ error: 'Servicio no disponible' }, { status: 404 });
  const { data, error } = await supabase.rpc('fn_slots_disponibles', {
    p_organization_id: org.id,
    p_location_id: parsed.data.locationId,
    p_barbero_id: parsed.data.barberId,
    p_fecha: parsed.data.fecha,
    p_duracion_minutos: servicio.duracion_minutos,
  });
  if (error)
    return NextResponse.json({ error: 'No fue posible consultar horarios' }, { status: 400 });
  return NextResponse.json({ slots: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
}
