export type CitaGuardada = {
  token: string;
  folio: string;
  guardadaEn: string;
};

const MAXIMO_CITAS_GUARDADAS = 10;

function clave(slug: string) {
  return `barberia-os:citas:${slug}`;
}

function esCitaGuardada(valor: unknown): valor is CitaGuardada {
  if (!valor || typeof valor !== 'object') return false;
  const cita = valor as Partial<CitaGuardada>;
  return (
    typeof cita.token === 'string' &&
    cita.token.length >= 40 &&
    typeof cita.folio === 'string' &&
    cita.folio.length > 0 &&
    typeof cita.guardadaEn === 'string'
  );
}

export function leerCitasGuardadas(slug: string): CitaGuardada[] {
  if (typeof window === 'undefined') return [];
  try {
    const valor = JSON.parse(window.localStorage.getItem(clave(slug)) ?? '[]') as unknown;
    return Array.isArray(valor) ? valor.filter(esCitaGuardada) : [];
  } catch {
    return [];
  }
}

export function guardarCitaEnDispositivo(slug: string, cita: Omit<CitaGuardada, 'guardadaEn'>) {
  if (typeof window === 'undefined' || cita.token.length < 40 || !cita.folio) return;
  const anteriores = leerCitasGuardadas(slug).filter((item) => item.token !== cita.token);
  const actualizadas = [{ ...cita, guardadaEn: new Date().toISOString() }, ...anteriores].slice(
    0,
    MAXIMO_CITAS_GUARDADAS
  );
  try {
    window.localStorage.setItem(clave(slug), JSON.stringify(actualizadas));
  } catch {
    // La cita sigue disponible mediante su enlace privado aunque el navegador
    // bloquee el almacenamiento local.
  }
}
