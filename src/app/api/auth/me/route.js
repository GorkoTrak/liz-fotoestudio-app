import { NextResponse } from 'next/server';
import { obtenerUsuarioActual } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function GET(request) {
  const sesion = await obtenerUsuarioActual(request);
  if (!sesion) {
    return NextResponse.json({ autenticado: false, usuario: null }, { status: 401 });
  }

  try {
    const filas = await sql`
      SELECT id, nombre, email, rol, foto_perfil
      FROM usuarios
      WHERE id = ${sesion.id}
      LIMIT 1
    `;
    const usuario = filas[0] || sesion;
    return NextResponse.json({ autenticado: true, usuario });
  } catch {
    return NextResponse.json({ autenticado: true, usuario: sesion });
  }
}
