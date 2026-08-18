import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Boxes,
  CalendarDays,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  Package,
  Receipt,
  Scissors,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
  Palette,
  MessageCircle,
  Images,
} from 'lucide-react';

/**
 * Navegación del panel.
 *
 * `roles` declara quién ve cada apartado. Los que un rol no puede abrir
 * **no se dibujan**; no aparecen deshabilitados. Un menú gris que no responde
 * solo genera preguntas.
 *
 * IMPORTANTE: esto es presentación, no seguridad. La barrera real son las
 * políticas de RLS de la fase 1 más las guardas de servidor de la fase 2.
 * Si un barbero escribe /panel/gastos a mano, recibe 403 aunque el menú no
 * se lo hubiera mostrado.
 */

export type RolUsuario = 'administrador' | 'recepcion' | 'barbero';

export type ElementoNav = {
  href: string;
  texto: string;
  icono: LucideIcon;
  roles: readonly RolUsuario[];
};

export type GrupoNav = {
  titulo: string;
  elementos: readonly ElementoNav[];
};

const OPERACION = ['administrador', 'recepcion'] as const;
const SOLO_ADMIN = ['administrador'] as const;
const ADMIN_O_BARBERO = ['administrador', 'barbero'] as const;

export const NAVEGACION_PANEL: readonly GrupoNav[] = [
  {
    titulo: 'Uso diario',
    elementos: [
      { href: '/panel', texto: 'Inicio', icono: LayoutDashboard, roles: SOLO_ADMIN },
      { href: '/panel/agenda', texto: 'Agenda', icono: CalendarDays, roles: OPERACION },
      { href: '/panel/mi-agenda', texto: 'Mi agenda', icono: CalendarDays, roles: ['barbero'] },
      { href: '/panel/pos', texto: 'Cobrar', icono: ShoppingCart, roles: OPERACION },
      { href: '/panel/pedidos', texto: 'Pedidos', icono: ClipboardList, roles: OPERACION },
      { href: '/panel/clientes', texto: 'Clientes', icono: Users, roles: OPERACION },
      { href: '/panel/caja', texto: 'Corte de caja', icono: Wallet, roles: OPERACION },
    ],
  },
  {
    titulo: 'Productos y servicios',
    elementos: [
      { href: '/panel/ventas', texto: 'Ventas', icono: Receipt, roles: OPERACION },
      { href: '/panel/servicios', texto: 'Servicios', icono: Scissors, roles: SOLO_ADMIN },
      { href: '/panel/productos', texto: 'Productos', icono: Package, roles: SOLO_ADMIN },
      { href: '/panel/inventario', texto: 'Inventario', icono: Boxes, roles: SOLO_ADMIN },
      { href: '/panel/compras', texto: 'Compras', icono: Truck, roles: SOLO_ADMIN },
      { href: '/panel/proveedores', texto: 'Proveedores', icono: Truck, roles: SOLO_ADMIN },
    ],
  },
  {
    titulo: 'Finanzas',
    elementos: [
      { href: '/panel/gastos', texto: 'Gastos', icono: Wallet, roles: SOLO_ADMIN },
      {
        href: '/panel/comisiones',
        texto: 'Comisiones',
        icono: CreditCard,
        roles: ADMIN_O_BARBERO,
      },
      { href: '/panel/reportes', texto: 'Reportes', icono: BarChart3, roles: SOLO_ADMIN },
    ],
  },
  {
    titulo: 'Administración',
    elementos: [
      { href: '/panel/barberos', texto: 'Barberos', icono: Users, roles: SOLO_ADMIN },
      { href: '/panel/equipo', texto: 'Acceso de recepción', icono: Users, roles: SOLO_ADMIN },
      { href: '/panel/apariencia', texto: 'Apariencia', icono: Palette, roles: SOLO_ADMIN },
      { href: '/panel/galeria', texto: 'Galería', icono: Images, roles: SOLO_ADMIN },
      { href: '/panel/whatsapp', texto: 'WhatsApp', icono: MessageCircle, roles: SOLO_ADMIN },
      { href: '/panel/pagos', texto: 'Plan y pagos', icono: CreditCard, roles: SOLO_ADMIN },
      { href: '/panel/configuracion', texto: 'Configuración', icono: Settings, roles: SOLO_ADMIN },
    ],
  },
];

/** Filtra la navegación según el rol de la sesión. */
export function navegacionPara(rol: RolUsuario): GrupoNav[] {
  return NAVEGACION_PANEL.map((grupo) => ({
    titulo: grupo.titulo,
    elementos: grupo.elementos.filter((e) => e.roles.includes(rol)),
  })).filter((grupo) => grupo.elementos.length > 0);
}

export const ETIQUETA_ROL: Record<RolUsuario, string> = {
  administrador: 'Propietario',
  recepcion: 'Recepción',
  barbero: 'Barbero',
};
