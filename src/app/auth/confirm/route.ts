import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { crearClienteServidor } from '@/lib/supabase/servidor';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const siguiente = url.searchParams.get('next')?.startsWith('/')
    ? url.searchParams.get('next')!
    : '/panel';
  const codigo = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const tipo = url.searchParams.get('type') as EmailOtpType | null;
  const supabase = await crearClienteServidor();

  if (codigo) {
    const { error } = await supabase.auth.exchangeCodeForSession(codigo);
    if (!error) return NextResponse.redirect(new URL(siguiente, url.origin));
  }
  if (tokenHash && tipo) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: tipo });
    if (!error) return NextResponse.redirect(new URL(siguiente, url.origin));
  }
  return NextResponse.redirect(
    new URL('/iniciar-sesion?error=Enlace%20inválido%20o%20vencido', url.origin)
  );
}
