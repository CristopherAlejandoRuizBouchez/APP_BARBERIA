'use client';

import * as React from 'react';
import { ImagePlus, Loader2, Trash2, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { Resultado } from '@/lib/errores';
import type { TipoImagenRegistro } from '@/app/(panel)/panel/[organizationSlug]/acciones';
import { crearClienteNavegador } from '@/lib/supabase/cliente';
import { Boton } from '@/components/ui/boton';

const FORMATOS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

function validarArchivo(archivo: File): string | null {
  if (!FORMATOS[archivo.type]) return 'Usa una imagen JPG, PNG, WEBP o AVIF.';
  if (archivo.size > 5 * 1024 * 1024) return 'La imagen no puede pesar más de 5 MB.';
  return null;
}

async function subirImagen(
  organizationId: string,
  carpeta: string,
  archivo: File
): Promise<{ url: string; ruta: string }> {
  const extension = FORMATOS[archivo.type];
  if (!extension) throw new Error('FORMATO_INVALIDO');
  const ruta = `${organizationId}/${carpeta}/${crypto.randomUUID()}.${extension}`;
  const supabase = crearClienteNavegador();
  const { error } = await supabase.storage.from('publico').upload(ruta, archivo, {
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from('publico').getPublicUrl(ruta);
  return { url: data.publicUrl, ruta };
}

function VistaImagen({ url, nombre }: { url: string; nombre: string }) {
  return (
    <div className="grid size-20 shrink-0 place-items-center overflow-hidden border border-[var(--borde)] bg-[var(--fondo)]">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={nombre} className="h-full w-full object-cover" />
      ) : (
        <ImagePlus className="size-7 text-[var(--texto-tenue)]" aria-hidden="true" />
      )}
    </div>
  );
}

export function CampoImagenNueva({
  organizationId,
  nombreCampo,
  carpeta,
  etiqueta,
  ayuda,
}: {
  organizationId: string;
  nombreCampo: string;
  carpeta: 'productos' | 'barberos';
  etiqueta: string;
  ayuda: string;
}) {
  const input = React.useRef<HTMLInputElement>(null);
  const [url, setUrl] = React.useState('');
  const [subiendo, setSubiendo] = React.useState(false);
  const [mensaje, setMensaje] = React.useState<string | null>(null);

  async function seleccionar(archivo: File | undefined) {
    if (!archivo) return;
    const problema = validarArchivo(archivo);
    if (problema) return setMensaje(problema);

    setSubiendo(true);
    setMensaje(null);
    try {
      const imagen = await subirImagen(organizationId, carpeta, archivo);
      setUrl(imagen.url);
      setMensaje('Imagen lista. Ya puedes guardar el registro.');
    } catch {
      setMensaje('No fue posible subir la imagen. Intenta nuevamente.');
    } finally {
      setSubiendo(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div className="sm:col-span-2">
      <input type="hidden" name={nombreCampo} value={url} />
      <div className="flex flex-col gap-4 border border-[var(--borde)] p-4 sm:flex-row sm:items-center">
        <VistaImagen url={url} nombre={etiqueta} />
        <div className="min-w-0 flex-1">
          <strong className="block text-sm">{etiqueta}</strong>
          <p className="mt-1 text-xs text-[var(--texto-suave)]">{ayuda}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              ref={input}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              className="sr-only"
              onChange={(event) => void seleccionar(event.target.files?.[0])}
            />
            <Boton
              type="button"
              tamano="sm"
              variante="contorno"
              disabled={subiendo}
              onClick={() => input.current?.click()}
            >
              {subiendo ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              {url ? 'Cambiar fotografía' : 'Elegir fotografía'}
            </Boton>
            {url ? (
              <Boton type="button" tamano="sm" variante="fantasma" onClick={() => setUrl('')}>
                <Trash2 className="size-4" /> Quitar
              </Boton>
            ) : null}
          </div>
          {mensaje ? (
            <p className="mt-2 text-xs text-[var(--texto-suave)]" role="status">
              {mensaje}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function EditorImagenRegistro({
  organizationId,
  tipo,
  id,
  nombre,
  urlInicial,
  action,
}: {
  organizationId: string;
  tipo: TipoImagenRegistro;
  id: string;
  nombre: string;
  urlInicial: string | null;
  action: (entrada: {
    tipo: TipoImagenRegistro;
    id: string;
    url: string | null;
  }) => Promise<Resultado<{ url: string | null }>>;
}) {
  const router = useRouter();
  const input = React.useRef<HTMLInputElement>(null);
  const [url, setUrl] = React.useState(urlInicial ?? '');
  const [guardando, setGuardando] = React.useState(false);
  const [mensaje, setMensaje] = React.useState<string | null>(null);

  async function seleccionar(archivo: File | undefined) {
    if (!archivo) return;
    const problema = validarArchivo(archivo);
    if (problema) return setMensaje(problema);

    setGuardando(true);
    setMensaje(null);
    let rutaNueva: string | null = null;
    try {
      const imagen = await subirImagen(
        organizationId,
        tipo === 'producto' ? 'productos' : 'barberos',
        archivo
      );
      rutaNueva = imagen.ruta;
      const resultado = await action({ tipo, id, url: imagen.url });
      if (!resultado.ok) throw new Error(resultado.mensaje);
      setUrl(resultado.datos.url ?? '');
      setMensaje('Fotografía guardada.');
      router.refresh();
    } catch (error) {
      if (rutaNueva) {
        await crearClienteNavegador().storage.from('publico').remove([rutaNueva]);
      }
      setMensaje(error instanceof Error ? error.message : 'No fue posible guardar la fotografía.');
    } finally {
      setGuardando(false);
      if (input.current) input.current.value = '';
    }
  }

  async function quitar() {
    setGuardando(true);
    setMensaje(null);
    try {
      const resultado = await action({ tipo, id, url: null });
      if (!resultado.ok) throw new Error(resultado.mensaje);
      setUrl('');
      setMensaje('Fotografía eliminada del registro.');
      router.refresh();
    } catch (error) {
      setMensaje(error instanceof Error ? error.message : 'No fue posible quitar la fotografía.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="flex min-w-52 items-center gap-3">
      <VistaImagen url={url} nombre={nombre} />
      <div>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="sr-only"
          onChange={(event) => void seleccionar(event.target.files?.[0])}
        />
        <div className="flex flex-wrap gap-1.5">
          <Boton
            type="button"
            tamano="sm"
            variante="contorno"
            disabled={guardando}
            onClick={() => input.current?.click()}
          >
            {guardando ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            {url ? 'Cambiar' : 'Subir foto'}
          </Boton>
          {url ? (
            <Boton
              type="button"
              tamano="icono"
              variante="fantasma"
              disabled={guardando}
              aria-label={`Quitar fotografía de ${nombre}`}
              onClick={() => void quitar()}
            >
              <Trash2 className="size-4" />
            </Boton>
          ) : null}
        </div>
        {mensaje ? (
          <p className="mt-1 max-w-44 text-[10px] text-[var(--texto-suave)]" role="status">
            {mensaje}
          </p>
        ) : null}
      </div>
    </div>
  );
}
