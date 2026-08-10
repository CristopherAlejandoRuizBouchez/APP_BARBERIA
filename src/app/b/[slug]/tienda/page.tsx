import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TiendaProductos } from '@/components/publico/tienda-productos';
import { crearClientePublico } from '@/lib/supabase/servidor';
import { organizacionPorSlug } from '@/lib/tenant/resolver';

export const metadata: Metadata = { title: 'Tienda' };

export default async function Tienda({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const org = await organizacionPorSlug(slug);
  if (!org) notFound();
  const supabase = crearClientePublico();
  const [productos, stock, sucursales] = await Promise.all([
    supabase
      .from('products')
      .select('id, nombre, marca, descripcion, imagen_url, precio_venta_centavos')
      .eq('organization_id', org.id)
      .eq('activo', true)
      .eq('visible_en_tienda', true)
      .order('destacado', { ascending: false })
      .order('nombre'),
    supabase
      .from('product_stock')
      .select('producto_id, stock_actual')
      .eq('organization_id', org.id)
      .gt('stock_actual', 0),
    supabase
      .from('locations')
      .select('id, nombre')
      .eq('organization_id', org.id)
      .eq('activa', true)
      .order('es_principal', { ascending: false }),
  ]);
  const disponibles = new Set((stock.data ?? []).map((s) => s.producto_id));
  return (
    <div className="mx-auto w-full px-5 py-16" style={{ maxWidth: 'var(--tema-ancho)' }}>
      <p className="etiqueta" style={{ color: 'var(--tema-primario)' }}>
        Tienda
      </p>
      <h1 className="mt-3 font-[family-name:var(--tema-fuente-titulos)] text-5xl">
        Cuidado y estilo para llevar
      </h1>
      <p className="mt-4 max-w-2xl" style={{ color: 'var(--tema-texto-suave)' }}>
        Aparta tus productos y confirma por WhatsApp. El pago se acuerda directamente con la
        barbería.
      </p>
      <div className="mt-10">
        {productos.data?.length ? (
          <TiendaProductos
            slug={slug}
            whatsapp={org.telefonoWhatsapp}
            sucursales={sucursales.data ?? []}
            productos={productos.data.map((p) => ({ ...p, disponible: disponibles.has(p.id) }))}
          />
        ) : (
          <p className="border p-10 text-center" style={{ borderColor: 'var(--tema-borde)' }}>
            La tienda está preparando su catálogo.
          </p>
        )}
      </div>
    </div>
  );
}
