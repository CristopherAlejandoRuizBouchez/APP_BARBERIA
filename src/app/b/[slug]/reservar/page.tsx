import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FormularioReserva } from '@/components/publico/formulario-reserva';
import { crearClientePublico } from '@/lib/supabase/servidor';
import { organizacionPorSlug } from '@/lib/tenant/resolver';

export const metadata: Metadata = { title: 'Reservar cita' };

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

export default async function Reservar({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const org = await organizacionPorSlug(slug);
  if (!org) notFound();
  const supabase = crearClientePublico();
  const [sucursales, barberos, servicios, ajustes] = await Promise.all([
    supabase
      .from('locations')
      .select('id, nombre')
      .eq('organization_id', org.id)
      .eq('activa', true)
      .order('es_principal', { ascending: false }),
    supabase
      .from('barbers')
      .select('id, nombre')
      .eq('organization_id', org.id)
      .eq('activo', true)
      .order('orden'),
    supabase
      .from('services')
      .select('id, nombre, precio_centavos, duracion_minutos')
      .eq('organization_id', org.id)
      .eq('activo', true)
      .order('orden'),
    supabase
      .from('organization_settings')
      .select('recargo_agenda_centavos, recargo_express_centavos, express_activa')
      .eq('organization_id', org.id)
      .maybeSingle(),
  ]);
  const ahora = new Date();
  const fechaHoy = fechaEnZona(ahora, org.zonaHoraria);
  const fechaInicial = fechaEnZona(new Date(ahora.getTime() + 86_400_000), org.zonaHoraria);
  const listo = sucursales.data?.length && barberos.data?.length && servicios.data?.length;
  return (
    <div className="mx-auto w-full px-5 py-16" style={{ maxWidth: 'var(--tema-ancho)' }}>
      <div className="mx-auto mb-10 max-w-2xl text-center">
        <p className="etiqueta" style={{ color: 'var(--tema-primario)' }}>
          Agenda en línea
        </p>
        <h1 className="mt-3 font-[family-name:var(--tema-fuente-titulos)] text-5xl">
          Reserva tu cita
        </h1>
        <p className="mt-4" style={{ color: 'var(--tema-texto-suave)' }}>
          Escoge un horario libre en tiempo real. No necesitas crear una cuenta.
        </p>
      </div>
      {listo ? (
        <FormularioReserva
          slug={slug}
          sucursales={sucursales.data ?? []}
          barberos={barberos.data ?? []}
          servicios={servicios.data ?? []}
          fechaHoy={fechaHoy}
          fechaInicial={fechaInicial}
          recargoAgendaCentavos={ajustes.data?.recargo_agenda_centavos ?? 3000}
          recargoExpressCentavos={ajustes.data?.recargo_express_centavos ?? 5000}
          expressActiva={ajustes.data?.express_activa ?? true}
        />
      ) : (
        <p className="border p-8 text-center" style={{ borderColor: 'var(--tema-borde)' }}>
          La agenda todavía no está configurada. Comunícate directamente con la barbería.
        </p>
      )}
    </div>
  );
}
