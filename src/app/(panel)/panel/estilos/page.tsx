import type { Metadata } from 'next';
import { Boton } from '@/components/ui/boton';
import { Tarjeta, TarjetaIndicador } from '@/components/ui/tarjeta';
import { Insignia, InsigniaEstadoCita, InsigniaExistencias } from '@/components/ui/insignia';
import { Campo, Entrada, AreaTexto, EntradaImporte, EntradaTelefono } from '@/components/ui/campo';
import { EstadoVacio, EsqueletoTabla } from '@/components/comunes/estado-vacio';
import { formatearMXN, formatearMXNCompacto, aplicarFactor } from '@/lib/dinero';
import { formatearTelefono, enmascararTelefono } from '@/lib/telefono';
import { generarFolio } from '@/lib/folios';
import { formatearFechaHora, desdeHoraLocal, formatearRangoHoras } from '@/lib/fechas';

export const metadata: Metadata = {
  title: 'Sistema de diseño',
  robots: { index: false, follow: false },
};

/**
 * Página interna del sistema de diseño.
 *
 * Sirve para tres cosas:
 *  · Ver todos los componentes juntos y detectar incoherencias.
 *  · Comprobar contrastes y foco de teclado en un solo lugar.
 *  · Verificar visualmente que los helpers de dinero, teléfono y fechas
 *    producen lo que se espera.
 *
 * No se indexa y no forma parte del sitio público.
 */

const COLORES = [
  {
    nombre: 'Negro carbón',
    hex: '#0B0B0D',
    clase: 'bg-carbon',
    uso: 'Fondo dominante del sitio público',
  },
  {
    nombre: 'Gris grafito',
    hex: '#17181C',
    clase: 'bg-grafito',
    uso: 'Superficies elevadas y fondo del panel',
  },
  {
    nombre: 'Marfil',
    hex: '#EFE7DA',
    clase: 'bg-marfil',
    uso: 'Texto y botón primario · 15.5:1 sobre carbón',
  },
  {
    nombre: 'Dorado envejecido',
    hex: '#B88942',
    clase: 'bg-dorado',
    uso: 'Acento, filetes y cifras · 6.2:1, pasa AA',
  },
  {
    nombre: 'Borgoña oscuro',
    hex: '#5B1E2D',
    clase: 'bg-borgona',
    uso: 'Solo relleno con marfil encima · 1.5:1 como texto',
  },
];

function Bloque({
  titulo,
  nota,
  children,
}: {
  titulo: string;
  nota?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-[var(--borde)] pt-6">
      <h2 className="font-display text-2xl">{titulo}</h2>
      {nota ? <p className="mt-1.5 max-w-2xl text-sm text-[var(--texto-suave)]">{nota}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default function PaginaSistemaDeDiseno() {
  const inicioCita = desdeHoraLocal('2026-08-10', '09:00');
  const finCita = desdeHoraLocal('2026-08-10', '09:45');

  return (
    <div className="mx-auto max-w-5xl space-y-10 pb-16">
      <header>
        <p className="etiqueta text-dorado">Interno · Fase 0</p>
        <h1 className="mt-3 font-display text-4xl leading-none">Sistema de diseño</h1>
        <p className="mt-3 max-w-2xl text-sm text-[var(--texto-suave)]">
          Concepto: sastrería urbana. Negro profundo, filete dorado finísimo, serif de alto
          contraste. Sin poste de barbero, sin degradados llamativos, sin sombras difusas.
        </p>
      </header>

      <Bloque
        titulo="Paleta"
        nota="El borgoña nunca se usa como texto sobre fondo oscuro: su contraste es 1.5:1 y sería ilegible. Va como relleno, con marfil encima (10.1:1)."
      >
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {COLORES.map((color) => (
            <div key={color.hex}>
              <div className={`h-24 rounded-sm border border-[var(--borde)] ${color.clase}`} />
              <p className="mt-2 text-sm font-medium">{color.nombre}</p>
              <p className="font-mono text-xs text-[var(--texto-tenue)]">{color.hex}</p>
              <p className="mt-1 text-xs leading-snug text-[var(--texto-tenue)]">{color.uso}</p>
            </div>
          ))}
        </div>
      </Bloque>

      <Bloque
        titulo="Tipografía"
        nota="Instrument Serif para titulares, Instrument Sans para interfaz, JetBrains Mono para SKU y folios. Autoalojadas: cero peticiones a terceros."
      >
        <div className="space-y-4">
          <p className="font-display text-5xl leading-none">El corte no se improvisa</p>
          <p className="font-display text-3xl italic leading-none text-dorado">Cita exprés</p>
          <p className="etiqueta text-dorado">Etiqueta en versalitas espaciadas</p>
          <p className="max-w-2xl text-base leading-relaxed">
            Cuerpo de texto en Instrument Sans. Se usa en párrafos, formularios y tablas del panel.
            Los números van con variante tabular para que las columnas de precios queden a plomo.
          </p>
          <p className="cifras font-mono text-sm text-[var(--texto-suave)]">
            SKU-0042 · {generarFolio('cita')} · {generarFolio('pedido')}
          </p>
        </div>
      </Bloque>

      <Bloque titulo="Botones">
        <div className="flex flex-wrap items-center gap-3">
          <Boton variante="primario">Reservar cita</Boton>
          <Boton variante="contorno">Cita exprés</Boton>
          <Boton variante="acento">Cobrar</Boton>
          <Boton variante="sutil">Editar</Boton>
          <Boton variante="fantasma">Cancelar</Boton>
          <Boton variante="peligro">Eliminar</Boton>
          <Boton variante="primario" disabled>
            Deshabilitado
          </Boton>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Boton tamano="sm">Pequeño</Boton>
          <Boton tamano="md">Mediano</Boton>
          <Boton tamano="lg">Grande</Boton>
          <Boton tamano="pos" variante="sutil">
            Tamaño POS
          </Boton>
        </div>
      </Bloque>

      <Bloque titulo="Insignias y estados">
        <div className="flex flex-wrap items-center gap-2">
          <InsigniaEstadoCita estado="pendiente" />
          <InsigniaEstadoCita estado="confirmada" />
          <InsigniaEstadoCita estado="en_proceso" />
          <InsigniaEstadoCita estado="completada" />
          <InsigniaEstadoCita estado="cancelada" />
          <InsigniaEstadoCita estado="no_asistio" />
          <Insignia tono="express">Exprés</Insignia>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <InsigniaExistencias actual={24} minimo={5} />
          <InsigniaExistencias actual={4} minimo={5} />
          <InsigniaExistencias actual={0} minimo={5} />
        </div>
      </Bloque>

      <Bloque titulo="Indicadores">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <TarjetaIndicador
            etiqueta="Ventas de hoy"
            valor={formatearMXN(1284500)}
            detalle="+12 %"
            tendencia="sube"
            acentuado
          />
          <TarjetaIndicador
            etiqueta="Citas"
            valor="18 / 23"
            detalle="5 pendientes"
            tendencia="neutra"
          />
          <TarjetaIndicador
            etiqueta="Ticket promedio"
            valor={formatearMXN(55800)}
            detalle="−3 %"
            tendencia="baja"
          />
          <TarjetaIndicador
            etiqueta="Ocupación"
            valor="78 %"
            detalle="4 barberos"
            tendencia="sube"
          />
        </div>
      </Bloque>

      <Bloque titulo="Campos de formulario">
        <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
          <Campo etiqueta="Nombre" htmlFor="d-nombre" requerido>
            <Entrada id="d-nombre" placeholder="Cristopher Ruiz" />
          </Campo>
          <Campo etiqueta="WhatsApp" htmlFor="d-tel" requerido ayuda="Así te confirmamos la cita.">
            <EntradaTelefono id="d-tel" />
          </Campo>
          <Campo etiqueta="Precio" htmlFor="d-precio">
            <EntradaImporte id="d-precio" defaultValue="350.00" />
          </Campo>
          <Campo etiqueta="Correo" htmlFor="d-mail" error="Ese correo no parece válido.">
            <Entrada id="d-mail" defaultValue="correo@" aria-invalid />
          </Campo>
          <Campo etiqueta="Nota para el barbero" htmlFor="d-nota" className="sm:col-span-2">
            <AreaTexto id="d-nota" placeholder="No le gusta la máquina en la nuca." />
          </Campo>
        </div>
      </Bloque>

      <Bloque titulo="Estados vacíos y de carga">
        <div className="grid gap-4 lg:grid-cols-2">
          <EstadoVacio
            titulo="Sin citas para este día"
            descripcion="Cuando alguien reserve aparecerá aquí. También puedes crear una cita de mostrador."
            accion={
              <Boton variante="contorno" tamano="sm">
                Nueva cita
              </Boton>
            }
          />
          <Tarjeta className="p-5">
            <EsqueletoTabla filas={4} columnas={4} />
          </Tarjeta>
        </div>
      </Bloque>

      <Bloque
        titulo="Verificación de los helpers"
        nota="Los mismos valores que cubren las pruebas unitarias, renderizados para comprobarlos a simple vista."
      >
        <Tarjeta className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--borde)] bg-[var(--superficie-alta)]">
                <th className="etiqueta px-4 py-2.5 text-left text-[10px] text-[var(--texto-tenue)]">
                  Helper
                </th>
                <th className="etiqueta px-4 py-2.5 text-left text-[10px] text-[var(--texto-tenue)]">
                  Entrada
                </th>
                <th className="etiqueta px-4 py-2.5 text-left text-[10px] text-[var(--texto-tenue)]">
                  Resultado
                </th>
              </tr>
            </thead>
            <tbody className="[&_td]:border-b [&_td]:border-[var(--borde)] [&_td]:px-4 [&_td]:py-2.5">
              <tr>
                <td className="font-mono text-xs">formatearMXN</td>
                <td className="font-mono text-xs text-[var(--texto-tenue)]">123450</td>
                <td className="cifras">{formatearMXN(123450)}</td>
              </tr>
              <tr>
                <td className="font-mono text-xs">formatearMXNCompacto</td>
                <td className="font-mono text-xs text-[var(--texto-tenue)]">35000</td>
                <td className="cifras">{formatearMXNCompacto(35000)}</td>
              </tr>
              <tr>
                <td className="font-mono text-xs">aplicarFactor (exprés ×2)</td>
                <td className="font-mono text-xs text-[var(--texto-tenue)]">35000 · 2</td>
                <td className="cifras text-dorado">{formatearMXN(aplicarFactor(35000, 2))}</td>
              </tr>
              <tr>
                <td className="font-mono text-xs">formatearTelefono</td>
                <td className="font-mono text-xs text-[var(--texto-tenue)]">+525512345678</td>
                <td className="cifras">{formatearTelefono('+525512345678')}</td>
              </tr>
              <tr>
                <td className="font-mono text-xs">enmascararTelefono</td>
                <td className="font-mono text-xs text-[var(--texto-tenue)]">+525512345678</td>
                <td className="cifras">{enmascararTelefono('+525512345678')}</td>
              </tr>
              <tr>
                <td className="font-mono text-xs">formatearFechaHora</td>
                <td className="font-mono text-xs text-[var(--texto-tenue)]">
                  2026-08-10 09:00 CDMX
                </td>
                <td>{formatearFechaHora(inicioCita)}</td>
              </tr>
              <tr>
                <td className="font-mono text-xs">formatearRangoHoras</td>
                <td className="font-mono text-xs text-[var(--texto-tenue)]">09:00 → 09:45</td>
                <td>{formatearRangoHoras(inicioCita, finCita)}</td>
              </tr>
            </tbody>
          </table>
        </Tarjeta>
      </Bloque>
    </div>
  );
}
