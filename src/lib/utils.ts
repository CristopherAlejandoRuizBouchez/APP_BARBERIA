import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combina clases de Tailwind resolviendo conflictos.
 * `cn('p-2', 'p-4')` devuelve 'p-4', no las dos.
 */
export function cn(...entradas: ClassValue[]): string {
  return twMerge(clsx(entradas));
}

/** Convierte un texto a slug apto para URL: "Corte Clásico" → "corte-clasico". */
export function aSlug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/**
 * Normaliza para búsquedas sin acentos.
 * Es lo que hace que "Ramirez" encuentre a "Ramírez" en el buscador de clientes.
 */
export function sinAcentos(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/** Iniciales para el avatar: "Juan Pérez López" → "JP". */
export function iniciales(nombre: string): string {
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('');
}

/** Recorta un texto respetando palabras completas. */
export function recortar(texto: string, maximo: number): string {
  if (texto.length <= maximo) return texto;
  const corte = texto.slice(0, maximo);
  const ultimoEspacio = corte.lastIndexOf(' ');
  return `${ultimoEspacio > maximo * 0.6 ? corte.slice(0, ultimoEspacio) : corte}…`;
}

/** Pluraliza en español: `plural(1,'cita','citas')` → "1 cita". */
export function plural(cantidad: number, singular: string, pluralForma: string): string {
  return `${cantidad} ${cantidad === 1 ? singular : pluralForma}`;
}
