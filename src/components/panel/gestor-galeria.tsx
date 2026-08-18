'use client';

import * as React from 'react';
import { Eye, EyeOff, ImagePlus, Loader2, Save, Trash2, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Boton } from '@/components/ui/boton';
import { AreaTexto } from '@/components/ui/campo';
import {
  subirImagenPublica,
  validarArchivoPublico,
} from '@/components/panel/gestor-imagen-registro';
import { crearClienteNavegador } from '@/lib/supabase/cliente';
import type { Resultado } from '@/lib/errores';

type ElementoGaleria = {
  id: string;
  descripcion: string;
  imagenUrl: string;
  activo: boolean;
};

type AccionCrear = (entrada: {
  descripcion: string;
  imagenUrl: string;
}) => Promise<Resultado<{ id: string }>>;

type AccionActualizar = (entrada: {
  id: string;
  descripcion: string;
  activo: boolean;
}) => Promise<Resultado<{ actualizado: true }>>;

type AccionEliminar = (entrada: { id: string }) => Promise<Resultado<{ eliminado: true }>>;

function TarjetaGaleria({
  elemento,
  actualizar,
  eliminar,
}: {
  elemento: ElementoGaleria;
  actualizar: AccionActualizar;
  eliminar: AccionEliminar;
}) {
  const router = useRouter();
  const [descripcion, setDescripcion] = React.useState(elemento.descripcion);
  const [activo, setActivo] = React.useState(elemento.activo);
  const [procesando, setProcesando] = React.useState(false);
  const [mensaje, setMensaje] = React.useState('');

  async function guardar(siguienteActivo = activo) {
    setProcesando(true);
    setMensaje('');
    const resultado = await actualizar({
      id: elemento.id,
      descripcion,
      activo: siguienteActivo,
    });
    if (resultado.ok) {
      setActivo(siguienteActivo);
      setMensaje(siguienteActivo ? 'Cambios publicados.' : 'Fotografía oculta.');
      router.refresh();
    } else {
      setMensaje(resultado.mensaje);
    }
    setProcesando(false);
  }

  async function quitar() {
    if (!window.confirm('¿Eliminar esta fotografía de la galería?')) return;
    setProcesando(true);
    setMensaje('');
    const resultado = await eliminar({ id: elemento.id });
    if (resultado.ok) {
      router.refresh();
      return;
    }
    setMensaje(resultado.mensaje);
    setProcesando(false);
  }

  return (
    <article className="overflow-hidden border border-[var(--borde)] bg-[var(--superficie)]">
      <div className="relative aspect-[4/3] bg-[var(--fondo)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={elemento.imagenUrl}
          alt={descripcion || 'Trabajo de barbería'}
          className="h-full w-full object-cover"
        />
        <span
          className={`absolute left-3 top-3 border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider backdrop-blur ${
            activo
              ? 'border-exito/50 bg-exito-suave text-exito'
              : 'border-[var(--borde-fuerte)] bg-[var(--fondo)]/90 text-[var(--texto-suave)]'
          }`}
        >
          {activo ? 'Publicada' : 'Oculta'}
        </span>
      </div>
      <div className="p-4">
        <label className="text-sm font-medium" htmlFor={`galeria-${elemento.id}`}>
          Descripción corta
        </label>
        <AreaTexto
          id={`galeria-${elemento.id}`}
          value={descripcion}
          onChange={(event) => setDescripcion(event.target.value)}
          maxLength={180}
          className="mt-2 min-h-20"
          placeholder="Ejemplo: Degradado bajo con acabado natural."
        />
        <div className="mt-1 text-right text-[10px] text-[var(--texto-tenue)]">
          {descripcion.length}/180
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Boton
            type="button"
            tamano="sm"
            onClick={() => void guardar()}
            disabled={procesando || descripcion.trim().length < 2}
          >
            {procesando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Guardar
          </Boton>
          <Boton
            type="button"
            tamano="sm"
            variante="contorno"
            onClick={() => void guardar(!activo)}
            disabled={procesando || descripcion.trim().length < 2}
          >
            {activo ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            {activo ? 'Ocultar' : 'Publicar'}
          </Boton>
          <Boton
            type="button"
            tamano="icono"
            variante="peligro"
            onClick={() => void quitar()}
            disabled={procesando}
            aria-label="Eliminar fotografía"
          >
            <Trash2 className="size-4" />
          </Boton>
        </div>
        {mensaje ? (
          <p className="mt-3 text-xs text-[var(--texto-suave)]" role="status">
            {mensaje}
          </p>
        ) : null}
      </div>
    </article>
  );
}

export function GestorGaleria({
  organizationId,
  elementos,
  crear,
  actualizar,
  eliminar,
}: {
  organizationId: string;
  elementos: ElementoGaleria[];
  crear: AccionCrear;
  actualizar: AccionActualizar;
  eliminar: AccionEliminar;
}) {
  const router = useRouter();
  const input = React.useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = React.useState<File | null>(null);
  const [vistaPrevia, setVistaPrevia] = React.useState('');
  const [descripcion, setDescripcion] = React.useState('');
  const [procesando, setProcesando] = React.useState(false);
  const [mensaje, setMensaje] = React.useState('');

  React.useEffect(() => {
    if (!archivo) {
      setVistaPrevia('');
      return;
    }
    const url = URL.createObjectURL(archivo);
    setVistaPrevia(url);
    return () => URL.revokeObjectURL(url);
  }, [archivo]);

  function seleccionar(seleccionado: File | undefined) {
    if (!seleccionado) return;
    const problema = validarArchivoPublico(seleccionado);
    if (problema) {
      setMensaje(problema);
      return;
    }
    setArchivo(seleccionado);
    setMensaje('');
  }

  async function publicar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!archivo || descripcion.trim().length < 2) return;

    setProcesando(true);
    setMensaje('Subiendo fotografía…');
    let rutaNueva: string | null = null;
    try {
      const imagen = await subirImagenPublica(organizationId, 'galeria', archivo);
      rutaNueva = imagen.ruta;
      const resultado = await crear({ descripcion, imagenUrl: imagen.url });
      if (!resultado.ok) throw new Error(resultado.mensaje);

      setArchivo(null);
      setDescripcion('');
      setMensaje('Fotografía publicada correctamente.');
      if (input.current) input.current.value = '';
      router.refresh();
    } catch (error) {
      if (rutaNueva) {
        await crearClienteNavegador().storage.from('publico').remove([rutaNueva]);
      }
      setMensaje(error instanceof Error ? error.message : 'No fue posible publicar la fotografía.');
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div className="space-y-5">
      <form
        onSubmit={(event) => void publicar(event)}
        className="grid gap-5 border border-[var(--borde)] bg-[var(--superficie)] p-5 lg:grid-cols-[18rem_1fr]"
      >
        <div>
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="sr-only"
            onChange={(event) => seleccionar(event.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="grid aspect-[4/3] w-full place-items-center overflow-hidden border border-dashed border-[var(--borde-fuerte)] bg-[var(--fondo)] transition-colors hover:border-dorado"
          >
            {vistaPrevia ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={vistaPrevia} alt="Vista previa" className="h-full w-full object-cover" />
            ) : (
              <span className="flex flex-col items-center gap-2 text-sm text-[var(--texto-suave)]">
                <ImagePlus className="size-8 text-dorado" />
                Elegir fotografía
              </span>
            )}
          </button>
        </div>
        <div className="flex flex-col justify-center">
          <p className="etiqueta text-dorado">Nuevo trabajo</p>
          <h2 className="mt-2 font-display text-2xl">Agregar a la galería</h2>
          <p className="mt-2 text-sm text-[var(--texto-suave)]">
            Usa una fotografía clara del corte terminado. Formatos JPG, PNG, WEBP o AVIF, máximo 5
            MB.
          </p>
          <label className="mt-5 text-sm font-medium" htmlFor="descripcion-galeria">
            Descripción corta
          </label>
          <AreaTexto
            id="descripcion-galeria"
            value={descripcion}
            onChange={(event) => setDescripcion(event.target.value)}
            maxLength={180}
            required
            placeholder="Ejemplo: Fade medio con diseño y perfilado de barba."
            className="mt-2 min-h-24"
          />
          <div className="mt-1 text-right text-[10px] text-[var(--texto-tenue)]">
            {descripcion.length}/180
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Boton type="submit" disabled={procesando || !archivo || descripcion.trim().length < 2}>
              {procesando ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              {procesando ? 'Publicando…' : 'Publicar fotografía'}
            </Boton>
            {mensaje ? (
              <p className="text-xs text-[var(--texto-suave)]" role="status">
                {mensaje}
              </p>
            ) : null}
          </div>
        </div>
      </form>

      {elementos.length ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {elementos.map((elemento) => (
            <TarjetaGaleria
              key={elemento.id}
              elemento={elemento}
              actualizar={actualizar}
              eliminar={eliminar}
            />
          ))}
        </div>
      ) : (
        <div className="border border-[var(--borde)] bg-[var(--superficie)] px-6 py-12 text-center">
          <ImagePlus className="mx-auto size-8 text-[var(--texto-tenue)]" />
          <p className="mt-3 text-sm text-[var(--texto-suave)]">
            Todavía no hay fotografías. Publica el primer trabajo de la barbería.
          </p>
        </div>
      )}
    </div>
  );
}
