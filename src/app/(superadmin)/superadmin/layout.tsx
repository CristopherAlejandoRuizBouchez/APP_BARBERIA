import Link from 'next/link';
import { requerirSuperadmin } from '@/lib/auth/guardas';
import { cerrarSesion } from '@/app/(auth)/acciones';

export const dynamic = 'force-dynamic';

export default async function LayoutSuperadmin({ children }: { children: React.ReactNode }) {
  const { user } = await requerirSuperadmin();
  return (
    <div className="min-h-dvh bg-[var(--fondo)] text-[var(--texto)]">
      <header className="border-b border-[var(--borde)] bg-[var(--superficie)]">
        <div className="mx-auto flex max-w-[90rem] flex-wrap items-center justify-between gap-4 px-5 py-4">
          <Link href="/superadmin" className="font-display text-2xl">
            Barbería OS <span className="text-dorado">Control</span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <span className="hidden text-[var(--texto-tenue)] sm:inline">{user.email}</span>
            <Link href="/panel" className="text-[var(--texto-suave)]">
              Panel
            </Link>
            <form action={cerrarSesion}>
              <button className="text-dorado">Cerrar sesión</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[90rem] px-5 py-8">{children}</main>
    </div>
  );
}
