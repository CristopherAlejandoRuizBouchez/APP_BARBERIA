import { NextResponse } from 'next/server';

/**
 * Sonda de salud para el monitor externo.
 *
 * FASE 0: confirma que la aplicación responde y con qué versión.
 * FASE 2: además comprueba que la base contesta con un `select 1`.
 */
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json(
    {
      estado: 'ok',
      servicio: 'barberia-os',
      fase: 0,
      momento: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
