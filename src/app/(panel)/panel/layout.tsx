import type { Metadata } from 'next';
import { requerirUsuario } from '@/lib/auth/guardas';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Panel',
  robots: { index: false, follow: false },
};

/**
 * Layout del panel administrativo.
 *
 * ─── PENDIENTE PARA LA FASE 2 ──────────────────────────────────────────────
 * Aquí va la verificación de sesión y rol EN EL SERVIDOR:
 *
 *   const sesion = await obtenerSesion();
 *   if (!sesion) redirect('/iniciar-sesion');
 *   const rol = await rolDeSesion(sesion);
 *
 * Se comprueba aquí *además* de en `proxy.ts` a propósito. En 2025 una
 * vulnerabilidad de Next.js (CVE-2025-29927) permitió saltarse el middleware
 * con una cabecera manipulada: quien confiaba solo en él quedó expuesto, quien
 * verificaba también en el servidor, no. La navegación filtrada por rol es
 * comodidad; la barrera real son RLS y estas guardas.
 * ───────────────────────────────────────────────────────────────────────────
 */
export default async function LayoutPanel({ children }: { children: React.ReactNode }) {
  await requerirUsuario();
  return children;
}
