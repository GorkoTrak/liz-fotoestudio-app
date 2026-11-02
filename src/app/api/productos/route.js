import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { obtenerUsuarioActual } from '@/lib/auth';

export async function GET(request) {
  try {
    const usuario = await obtenerUsuarioActual(request);
    if (!usuario) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const productos = await sql`
      SELECT id, nombre, descripcion, precio::numeric, tipo, categoria, estado
      FROM productos
      ORDER BY tipo ASC, nombre ASC
    `;

    const [resumen] = await sql`
      SELECT
        COUNT(*)::int AS total_productos,
        COUNT(*) FILTER (WHERE estado = 'activo')::int AS total_activos,
        COUNT(*) FILTER (WHERE estado = 'activo' AND tipo = 'sesion')::int AS total_sesiones,
        COUNT(*) FILTER (WHERE estado = 'activo' AND tipo = 'adicional')::int AS total_adicionales
      FROM productos
    `;

    return NextResponse.json({
      usuario,
      productos,
      resumen,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const usuario = await obtenerUsuarioActual(request);
    if (!usuario) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();

    // Acción rápida: Pausar / Activar estado
    if (body.accion === 'toggle_estado') {
      const id = parseInt(body.id || 0, 10);
      await sql`
        UPDATE productos
        SET estado = CASE WHEN estado = 'activo' THEN 'inactivo' ELSE 'activo' END
        WHERE id = ${id}
      `;
      return NextResponse.json({ ok: true, mensaje: 'Estado actualizado.' });
    }

    const id = parseInt(body.id || 0, 10);
    const nombre = (body.nombre || '').trim();
    const descripcion = (body.descripcion || '').trim();
    const precio = parseFloat(body.precio || 0);
    const tipo = body.tipo === 'adicional' ? 'adicional' : 'sesion';
    const categoria = (body.categoria || '').trim();
    const estado = body.estado === 'inactivo' ? 'inactivo' : 'activo';

    if (!nombre || precio <= 0) {
      return NextResponse.json(
        { ok: false, error: 'El nombre y el precio son obligatorios.' },
        { status: 400 }
      );
    }

    if (!categoria) {
      return NextResponse.json(
        { ok: false, error: 'Debes asignar una categoría a la sesión o adicional.' },
        { status: 400 }
      );
    }

    if (id > 0) {
      await sql`
        UPDATE productos
        SET nombre = ${nombre},
            descripcion = ${descripcion},
            precio = ${precio},
            tipo = ${tipo},
            categoria = ${categoria},
            estado = ${estado}
        WHERE id = ${id}
      `;
      return NextResponse.json({ ok: true, mensaje: 'Elemento actualizado correctamente.' });
    } else {
      await sql`
        INSERT INTO productos (nombre, descripcion, precio, tipo, categoria, estado)
        VALUES (${nombre}, ${descripcion}, ${precio}, ${tipo}, ${categoria}, ${estado})
      `;
      return NextResponse.json({ ok: true, mensaje: 'Elemento creado correctamente.' });
    }
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const usuario = await obtenerUsuarioActual(request);
    if (!usuario) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get('id') || '0', 10);
    await sql`DELETE FROM productos WHERE id = ${id}`;
    return NextResponse.json({ ok: true, mensaje: 'Elemento eliminado.' });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: 'No se puede eliminar porque tiene sesiones asociadas.' },
      { status: 400 }
    );
  }
}

