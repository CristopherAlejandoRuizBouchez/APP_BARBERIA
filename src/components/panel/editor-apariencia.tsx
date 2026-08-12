'use client';

import * as React from 'react';
import {
  Check,
  ExternalLink,
  ImagePlus,
  Loader2,
  MapPin,
  RotateCcw,
  Upload,
  X,
} from 'lucide-react';
import { useFormStatus } from 'react-dom';
import { Boton } from '@/components/ui/boton';
import { AreaTexto, Campo, Entrada } from '@/components/ui/campo';
import { crearClienteNavegador } from '@/lib/supabase/cliente';
import {
  DEFINICIONES,
  PLANTILLAS,
  type FuentePermitida,
  type Plantilla,
} from '@/lib/temas/plantillas';
import { contraste } from '@/lib/temas/validacion';
import { cn } from '@/lib/utils';

type RadioBordes = 'recto' | 'suave' | 'redondeado';
type Textura = 'ninguna' | 'grano' | 'lineas' | 'trama';

export type TemaInicialEditor = {
  plantilla: Plantilla;
  logoUrl: string;
  portadaUrl: string;
  eslogan: string;
  descripcion: string;
  colorPrimario: string;
  colorSecundario: string;
  colorFondo: string;
  colorSuperficie: string;
  colorTexto: string;
  fuenteTitulos: FuentePermitida;
  fuenteCuerpo: FuentePermitida;
  radioBordes: RadioBordes;
  textura: Textura;
};

type UbicacionInicialEditor = {
  ciudad: string;
  calle: string;
  numero: string;
  colonia: string;
};

type Colores = Pick<
  TemaInicialEditor,
  'colorPrimario' | 'colorSecundario' | 'colorFondo' | 'colorSuperficie' | 'colorTexto'
>;

const CAMPOS_COLOR: Array<{
  clave: keyof Colores;
  nombre: string;
  etiqueta: string;
}> = [
  {
    clave: 'colorPrimario',
    nombre: 'color_primario',
    etiqueta: 'Acento principal',
  },
  {
    clave: 'colorSecundario',
    nombre: 'color_secundario',
    etiqueta: 'Acento secundario',
  },
  { clave: 'colorFondo', nombre: 'color_fondo', etiqueta: 'Fondo general' },
  {
    clave: 'colorSuperficie',
    nombre: 'color_superficie',
    etiqueta: 'Tarjetas',
  },
  { clave: 'colorTexto', nombre: 'color_texto', etiqueta: 'Texto' },
];

function radioDesdeCss(valor: string): RadioBordes {
  if (valor === '0px') return 'recto';
  if (valor === '4px') return 'suave';
  return 'redondeado';
}

function radioCss(valor: RadioBordes) {
  return valor === 'recto' ? '0px' : valor === 'suave' ? '4px' : '12px';
}

function BotonPublicar({ subiendo }: { subiendo: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Boton type="submit" tamano="lg" disabled={pending || subiendo}>
      {pending || subiendo ? <Loader2 className="size-4 animate-spin" /> : null}
      {subiendo ? 'Subiendo imagen…' : pending ? 'Publicando…' : 'Publicar cambios'}
    </Boton>
  );
}

export function EditorApariencia({
  organizationId,
  nombreComercial,
  sitioPublico,
  temaInicial,
  ubicacionInicial,
  action,
}: {
  organizationId: string;
  nombreComercial: string;
  sitioPublico: string;
  temaInicial: TemaInicialEditor;
  ubicacionInicial: UbicacionInicialEditor;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [plantilla, setPlantilla] = React.useState<Plantilla>(temaInicial.plantilla);
  const [colores, setColores] = React.useState<Colores>({
    colorPrimario: temaInicial.colorPrimario,
    colorSecundario: temaInicial.colorSecundario,
    colorFondo: temaInicial.colorFondo,
    colorSuperficie: temaInicial.colorSuperficie,
    colorTexto: temaInicial.colorTexto,
  });
  const [eslogan, setEslogan] = React.useState(temaInicial.eslogan);
  const [descripcion, setDescripcion] = React.useState(temaInicial.descripcion);
  const [logoUrl, setLogoUrl] = React.useState(temaInicial.logoUrl);
  const [portadaUrl, setPortadaUrl] = React.useState(temaInicial.portadaUrl);
  const [fuenteTitulos, setFuenteTitulos] = React.useState(temaInicial.fuenteTitulos);
  const [fuenteCuerpo, setFuenteCuerpo] = React.useState(temaInicial.fuenteCuerpo);
  const [radioBordes, setRadioBordes] = React.useState<RadioBordes>(temaInicial.radioBordes);
  const [textura, setTextura] = React.useState<Textura>(temaInicial.textura);
  const [subiendo, setSubiendo] = React.useState<'logo' | 'portada' | null>(null);
  const [errorImagen, setErrorImagen] = React.useState<string | null>(null);
  const [ciudad, setCiudad] = React.useState(ubicacionInicial.ciudad);
  const [calle, setCalle] = React.useState(ubicacionInicial.calle);
  const [numero, setNumero] = React.useState(ubicacionInicial.numero);
  const [colonia, setColonia] = React.useState(ubicacionInicial.colonia);

  const definicion = DEFINICIONES[plantilla];
  const contrasteActual = contraste(colores.colorFondo, colores.colorTexto);

  function aplicarPlantilla(nueva: Plantilla) {
    const base = DEFINICIONES[nueva];
    setPlantilla(nueva);
    setColores({
      colorPrimario: base.tokens.primario,
      colorSecundario: base.tokens.secundario,
      colorFondo: base.tokens.fondo,
      colorSuperficie: base.tokens.superficie,
      colorTexto: base.tokens.texto,
    });
    setFuenteTitulos(base.tokens.fuenteTitulos as FuentePermitida);
    setFuenteCuerpo(base.tokens.fuenteCuerpo as FuentePermitida);
    setRadioBordes(radioDesdeCss(base.tokens.radio));
    setTextura(base.tokens.textura);
  }

  function restablecerColores() {
    aplicarPlantilla(plantilla);
  }

  async function subirImagen(tipo: 'logo' | 'portada', archivo: File | undefined) {
    if (!archivo) return;
    setErrorImagen(null);

    const formatos = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
    if (!formatos.includes(archivo.type)) {
      setErrorImagen('Usa una imagen JPG, PNG, WEBP o AVIF.');
      return;
    }
    if (archivo.size > 5 * 1024 * 1024) {
      setErrorImagen('La imagen no puede pesar más de 5 MB.');
      return;
    }

    setSubiendo(tipo);
    try {
      const extension: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/avif': 'avif',
      };
      const ruta = `${organizationId}/apariencia/${tipo}-${crypto.randomUUID()}.${extension[archivo.type]}`;
      const supabase = crearClienteNavegador();
      const { error } = await supabase.storage.from('publico').upload(ruta, archivo, {
        cacheControl: '31536000',
        upsert: false,
      });
      if (error) throw error;
      const { data } = supabase.storage.from('publico').getPublicUrl(ruta);
      if (tipo === 'logo') setLogoUrl(data.publicUrl);
      else setPortadaUrl(data.publicUrl);
    } catch {
      setErrorImagen('No fue posible subir la imagen. Intenta nuevamente.');
    } finally {
      setSubiendo(null);
    }
  }

  const estiloPreview = {
    '--preview-fondo': colores.colorFondo,
    '--preview-superficie': colores.colorSuperficie,
    '--preview-texto': colores.colorTexto,
    '--preview-primario': colores.colorPrimario,
    '--preview-secundario': colores.colorSecundario,
    '--preview-radio': radioCss(radioBordes),
  } as React.CSSProperties;

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_28rem]">
      <form action={action} className="space-y-6">
        <input type="hidden" name="plantilla" value={plantilla} />
        <input type="hidden" name="logo_url" value={logoUrl} />
        <input type="hidden" name="portada_url" value={portadaUrl} />

        <section className="border border-[var(--borde)] bg-[var(--superficie)] p-5">
          <div className="mb-5">
            <p className="etiqueta text-dorado">Paso 1</p>
            <h2 className="mt-2 font-display text-2xl">Elige un estilo</h2>
            <p className="mt-1 text-sm text-[var(--texto-suave)]">
              Cada plantilla cambia la portada, navegación y presentación del catálogo.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {PLANTILLAS.map((clave) => {
              const opcion = DEFINICIONES[clave];
              const seleccionada = plantilla === clave;
              return (
                <button
                  key={clave}
                  type="button"
                  onClick={() => aplicarPlantilla(clave)}
                  className={cn(
                    'relative border p-4 text-left transition-colors',
                    seleccionada
                      ? 'border-dorado bg-dorado/8'
                      : 'border-[var(--borde)] hover:border-[var(--borde-fuerte)]'
                  )}
                >
                  {seleccionada ? (
                    <span className="absolute right-3 top-3 grid size-6 place-items-center bg-dorado text-carbon">
                      <Check className="size-4" />
                    </span>
                  ) : null}
                  <div className="mb-3 flex gap-1.5">
                    {[
                      opcion.tokens.fondo,
                      opcion.tokens.superficie,
                      opcion.tokens.primario,
                      opcion.tokens.secundario,
                    ].map((color) => (
                      <span
                        key={color}
                        className="size-5 border border-white/15"
                        style={{ background: color }}
                      />
                    ))}
                  </div>
                  <strong className="block pr-7">{opcion.nombre}</strong>
                  <span className="mt-1 block text-xs leading-relaxed text-[var(--texto-suave)]">
                    {opcion.descripcion}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="border border-[var(--borde)] bg-[var(--superficie)] p-5">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="etiqueta text-dorado">Paso 2</p>
              <h2 className="mt-2 font-display text-2xl">Colores de la marca</h2>
              <p className="mt-1 text-sm text-[var(--texto-suave)]">
                Pulsa cada color para cambiarlo. La vista previa se actualiza al instante.
              </p>
            </div>
            <Boton type="button" variante="fantasma" tamano="sm" onClick={restablecerColores}>
              <RotateCcw className="size-3" /> Restablecer
            </Boton>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CAMPOS_COLOR.map((campo) => (
              <label
                key={campo.clave}
                className="flex cursor-pointer items-center gap-3 border border-[var(--borde)] p-3"
              >
                <input
                  type="color"
                  name={campo.nombre}
                  value={colores[campo.clave]}
                  onChange={(event) =>
                    setColores((actuales) => ({
                      ...actuales,
                      [campo.clave]: event.target.value.toUpperCase(),
                    }))
                  }
                  className="size-11 cursor-pointer border-0 bg-transparent p-0"
                />
                <span>
                  <strong className="block text-sm">{campo.etiqueta}</strong>
                  <small className="cifras text-[var(--texto-tenue)]">{colores[campo.clave]}</small>
                </span>
              </label>
            ))}
          </div>
          <p className={cn('mt-4 text-xs', contrasteActual >= 4.5 ? 'text-exito' : 'text-peligro')}>
            {contrasteActual >= 4.5
              ? `Texto legible · contraste ${contrasteActual}:1`
              : `El fondo y el texto tienen poco contraste (${contrasteActual}:1). Elige colores más diferentes.`}
          </p>
        </section>

        <section className="border border-[var(--borde)] bg-[var(--superficie)] p-5">
          <div className="mb-5">
            <p className="etiqueta text-dorado">Paso 3</p>
            <h2 className="mt-2 font-display text-2xl">Logo y fotografía de portada</h2>
            <p className="mt-1 text-sm text-[var(--texto-suave)]">
              Selecciona las imágenes desde tu computadora; ya no necesitas pegar enlaces.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {(
              [
                {
                  tipo: 'logo' as const,
                  titulo: 'Logo',
                  ayuda: 'PNG o WEBP con fondo transparente funciona mejor.',
                  url: logoUrl,
                  cambiar: setLogoUrl,
                },
                {
                  tipo: 'portada' as const,
                  titulo: 'Portada',
                  ayuda: 'Recomendado: fotografía horizontal de al menos 1600 × 900 px.',
                  url: portadaUrl,
                  cambiar: setPortadaUrl,
                },
              ] as const
            ).map((imagen) => (
              <div key={imagen.tipo} className="border border-[var(--borde)] p-4">
                <div
                  className="mb-4 grid h-36 place-items-center overflow-hidden bg-[var(--fondo)] bg-cover bg-center"
                  style={imagen.url ? { backgroundImage: `url("${imagen.url}")` } : undefined}
                >
                  {!imagen.url ? <ImagePlus className="size-8 text-[var(--texto-tenue)]" /> : null}
                </div>
                <strong className="block">{imagen.titulo}</strong>
                <p className="mt-1 min-h-8 text-xs text-[var(--texto-tenue)]">{imagen.ayuda}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <label className="inline-flex h-9 cursor-pointer items-center gap-2 border border-dorado/55 px-3 text-xs text-marfil hover:bg-dorado/10">
                    {subiendo === imagen.tipo ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Upload className="size-3" />
                    )}
                    {imagen.url ? 'Cambiar' : 'Subir imagen'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/avif"
                      className="sr-only"
                      disabled={Boolean(subiendo)}
                      onChange={(event) => subirImagen(imagen.tipo, event.target.files?.[0])}
                    />
                  </label>
                  {imagen.url ? (
                    <Boton
                      type="button"
                      tamano="sm"
                      variante="fantasma"
                      onClick={() => imagen.cambiar('')}
                    >
                      <X className="size-3" /> Quitar
                    </Boton>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          {errorImagen ? <p className="mt-4 text-sm text-peligro">{errorImagen}</p> : null}
        </section>

        <section className="border border-[var(--borde)] bg-[var(--superficie)] p-5">
          <div className="mb-5">
            <p className="etiqueta text-dorado">Paso 4</p>
            <h2 className="mt-2 font-display text-2xl">Texto y detalles</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Eslogan principal" htmlFor="eslogan">
              <Entrada
                id="eslogan"
                name="eslogan"
                value={eslogan}
                onChange={(event) => setEslogan(event.target.value)}
                placeholder={nombreComercial}
                maxLength={120}
              />
            </Campo>
            <Campo etiqueta="Forma de las esquinas" htmlFor="radio_bordes">
              <select
                id="radio_bordes"
                name="radio_bordes"
                value={radioBordes}
                onChange={(event) => setRadioBordes(event.target.value as RadioBordes)}
                className="h-10 w-full border border-[var(--borde)] bg-[var(--fondo)] px-3 text-sm"
              >
                <option value="recto">Rectas</option>
                <option value="suave">Suaves</option>
                <option value="redondeado">Redondeadas</option>
              </select>
            </Campo>
            <Campo etiqueta="Descripción" htmlFor="descripcion" className="sm:col-span-2">
              <AreaTexto
                id="descripcion"
                name="descripcion"
                value={descripcion}
                onChange={(event) => setDescripcion(event.target.value)}
                maxLength={600}
                placeholder="Cuenta brevemente qué hace especial a esta barbería."
              />
            </Campo>
            <Campo etiqueta="Tipografía de títulos" htmlFor="fuente_titulos">
              <select
                id="fuente_titulos"
                name="fuente_titulos"
                value={fuenteTitulos}
                onChange={(event) => setFuenteTitulos(event.target.value as FuentePermitida)}
                className="h-10 w-full border border-[var(--borde)] bg-[var(--fondo)] px-3 text-sm"
              >
                <option value="instrument-serif">Elegante con remates</option>
                <option value="instrument-sans">Moderna y limpia</option>
                <option value="jetbrains-mono">Urbana y técnica</option>
              </select>
            </Campo>
            <Campo etiqueta="Tipografía del contenido" htmlFor="fuente_cuerpo">
              <select
                id="fuente_cuerpo"
                name="fuente_cuerpo"
                value={fuenteCuerpo}
                onChange={(event) => setFuenteCuerpo(event.target.value as FuentePermitida)}
                className="h-10 w-full border border-[var(--borde)] bg-[var(--fondo)] px-3 text-sm"
              >
                <option value="instrument-sans">Moderna y limpia</option>
                <option value="instrument-serif">Elegante con remates</option>
                <option value="jetbrains-mono">Urbana y técnica</option>
              </select>
            </Campo>
            <Campo etiqueta="Textura del fondo" htmlFor="textura">
              <select
                id="textura"
                name="textura"
                value={textura}
                onChange={(event) => setTextura(event.target.value as Textura)}
                className="h-10 w-full border border-[var(--borde)] bg-[var(--fondo)] px-3 text-sm"
              >
                <option value="ninguna">Sin textura</option>
                <option value="grano">Grano fotográfico</option>
                <option value="lineas">Líneas finas</option>
                <option value="trama">Trama clásica</option>
              </select>
            </Campo>
          </div>
        </section>

        <section className="border border-[var(--borde)] bg-[var(--superficie)] p-5">
          <div className="mb-5">
            <p className="etiqueta text-dorado">Paso 5</p>
            <div className="mt-2 flex items-center gap-3">
              <MapPin className="size-5 text-dorado" aria-hidden="true" />
              <h2 className="font-display text-2xl">Ubicación</h2>
            </div>
            <p className="mt-2 text-sm text-[var(--texto-suave)]">
              Esta dirección aparecerá en la página pública con un mapa y un botón para llegar.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Ciudad" htmlFor="ciudad">
              <Entrada
                id="ciudad"
                name="ciudad"
                value={ciudad}
                onChange={(event) => setCiudad(event.target.value)}
                placeholder="Xalapa, Veracruz"
                maxLength={100}
                required
              />
            </Campo>

            <Campo etiqueta="Colonia" htmlFor="colonia">
              <Entrada
                id="colonia"
                name="colonia"
                value={colonia}
                onChange={(event) => setColonia(event.target.value)}
                placeholder="Colonia Centro"
                maxLength={120}
              />
            </Campo>

            <Campo etiqueta="Calle" htmlFor="calle">
              <Entrada
                id="calle"
                name="calle"
                value={calle}
                onChange={(event) => setCalle(event.target.value)}
                placeholder="Avenida, calle o carretera"
                maxLength={180}
                required
              />
            </Campo>

            <Campo etiqueta="Número" htmlFor="numero">
              <Entrada
                id="numero"
                name="numero"
                value={numero}
                onChange={(event) => setNumero(event.target.value)}
                placeholder="123, interior 2"
                maxLength={40}
              />
            </Campo>
          </div>

          <div className="mt-4 border border-dorado/30 bg-dorado/5 p-4 text-sm">
            <strong className="block text-dorado">Así aparecerá</strong>
            <p className="mt-1 text-[var(--texto-suave)]">
              {[calle, numero, colonia, ciudad].filter(Boolean).join(', ') ||
                'Agrega la dirección de la barbería.'}
            </p>
            <p className="mt-2 text-xs text-[var(--texto-tenue)]">
              Google Maps localizará la barbería usando esta dirección. No requiere una API de pago.
            </p>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-3 border-t border-[var(--borde)] pt-5">
          <BotonPublicar subiendo={Boolean(subiendo)} />
          <Boton comoHijo variante="contorno" tamano="lg">
            <a href={sitioPublico} target="_blank" rel="noreferrer">
              Ver sitio actual <ExternalLink className="size-4" />
            </a>
          </Boton>
        </div>
      </form>

      <aside className="xl:sticky xl:top-6">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="etiqueta text-dorado">Vista previa</p>
            <p className="mt-1 text-xs text-[var(--texto-tenue)]">Así se combinará tu identidad</p>
          </div>
          <span className="border border-[var(--borde)] px-2 py-1 text-[10px] uppercase tracking-wider">
            {definicion.nombre}
          </span>
        </div>
        <div
          className="overflow-hidden border border-[var(--borde)] shadow-2xl"
          style={estiloPreview}
        >
          <div
            className="flex h-14 items-center justify-between border-b px-4"
            style={{
              background: 'var(--preview-fondo)',
              color: 'var(--preview-texto)',
              borderColor: 'color-mix(in srgb, var(--preview-texto) 14%, transparent)',
            }}
          >
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Logo" className="h-8 max-w-28 object-contain" />
            ) : (
              <strong className="font-display">{nombreComercial}</strong>
            )}
            <span className="text-[10px] uppercase tracking-widest opacity-60">Menú</span>
          </div>
          <div
            className="relative flex min-h-80 items-end overflow-hidden bg-cover bg-center p-6"
            style={{
              backgroundColor: 'var(--preview-fondo)',
              backgroundImage: portadaUrl
                ? `linear-gradient(180deg, transparent 5%, var(--preview-fondo) 96%), url("${portadaUrl}")`
                : `radial-gradient(circle at 80% 10%, var(--preview-superficie), var(--preview-fondo) 68%)`,
              color: 'var(--preview-texto)',
            }}
          >
            <div className="relative z-10">
              <p
                className="text-[10px] font-semibold uppercase tracking-[0.24em]"
                style={{ color: 'var(--preview-primario)' }}
              >
                Barbería profesional
              </p>
              <h3 className="mt-3 max-w-sm font-display text-4xl leading-none">
                {eslogan || nombreComercial}
              </h3>
              <p className="mt-3 max-w-sm text-xs leading-relaxed opacity-65">
                {descripcion || 'Tu descripción aparecerá aquí para presentar la barbería.'}
              </p>
              <div className="mt-5 flex gap-2">
                <span
                  className="px-3 py-2 text-xs font-medium"
                  style={{
                    background: 'var(--preview-primario)',
                    color: 'var(--preview-fondo)',
                    borderRadius: 'var(--preview-radio)',
                  }}
                >
                  Reservar cita
                </span>
                <span
                  className="border px-3 py-2 text-xs"
                  style={{
                    borderColor: 'var(--preview-primario)',
                    borderRadius: 'var(--preview-radio)',
                  }}
                >
                  Servicios
                </span>
              </div>
            </div>
          </div>
          <div
            className="grid grid-cols-2 gap-3 p-4"
            style={{
              background: 'var(--preview-fondo)',
              color: 'var(--preview-texto)',
            }}
          >
            {['Corte clásico', 'Barba premium'].map((servicio, indice) => (
              <div
                key={servicio}
                className="border p-3"
                style={{
                  background: 'var(--preview-superficie)',
                  borderColor: 'color-mix(in srgb, var(--preview-texto) 14%, transparent)',
                  borderRadius: 'var(--preview-radio)',
                }}
              >
                <span className="text-[10px]" style={{ color: 'var(--preview-primario)' }}>
                  0{indice + 1}
                </span>
                <strong className="mt-2 block text-sm">{servicio}</strong>
                <small className="mt-1 block opacity-55">30 min</small>
              </div>
            ))}
          </div>
          <div className="h-1" style={{ background: 'var(--preview-secundario)' }} />
        </div>
        <p className="mt-3 text-xs leading-relaxed text-[var(--texto-tenue)]">
          La vista es una representación compacta. Pulsa “Publicar cambios” y abre el sitio para
          revisar la página completa.
        </p>
      </aside>
    </div>
  );
}
