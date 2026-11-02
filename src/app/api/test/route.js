import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET() {
  try {
    if (!sql) {
      return NextResponse.json(
        {
          conectado: false,
          mensaje: 'Falta pegar tu DATABASE_URL de Neon dentro del archivo .env.local',
        },
        { status: 400 }
      );
    }

    const conteos = await sql`
      SELECT
        (SELECT COUNT(*)::int FROM usuarios) AS usuarios,
        (SELECT COUNT(*)::int FROM clientes) AS clientes,
        (SELECT COUNT(*)::int FROM productos) AS productos,
        (SELECT COUNT(*)::int FROM sesiones) AS sesiones,
        (SELECT COUNT(*)::int FROM facturas) AS facturas,
        (SELECT COUNT(*)::int FROM ingresos) AS ingresos
    `;

    return NextResponse.json({
      conectado: true,
      mensaje: '¡Base de datos de Lizdy Fotoestudio conectada en Neon!',
      resumen_tablas: conteos[0],
    });
  } catch (error) {
    return NextResponse.json(
      {
        conectado: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}

