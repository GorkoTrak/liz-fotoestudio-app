import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { obtenerUsuarioActual } from '@/lib/auth';

export async function GET(request) {
  try {
    const usuario = await obtenerUsuarioActual(request);
    if (!usuario) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const historialId = searchParams.get('historial');

    // Si piden el historial de sesiones de un cliente específico
    if (historialId) {
      const cid = parseInt(historialId, 10);
      const sesiones = await sql`
        SELECT
          s.id,
          TO_CHAR(s.fecha_sesion, 'YYYY-MM-DD') AS fecha_sesion,
          TO_CHAR(s.hora_sesion, 'HH24:MI') AS hora_sesion,
          s.estado_pago,
          s.estado_entrega,
          p.nombre AS producto_nombre
        FROM sesiones s
        LEFT JOIN productos p ON s.producto_id = p.id
        WHERE s.cliente_id = ${cid}
        ORDER BY s.fecha_sesion DESC, s.hora_sesion DESC
      `;
      return NextResponse.json({ sesiones });
    }

    const q = (searchParams.get('q') || '').trim();
    const pagina = Math.max(1, parseInt(searchParams.get('p') || '1', 10));
    const porPagina = 10;
    const offset = (pagina - 1) * porPagina;

    let totalRegistros = 0;
    let clientes = [];

    if (q !== '') {
      const patron = `%${q}%`;
      const [conteo] = await sql`
        SELECT COUNT(*)::int AS total
        FROM clientes
        WHERE nombre ILIKE ${patron}
           OR apellido ILIKE ${patron}
           OR COALESCE(telefono, '') ILIKE ${patron}
           OR COALESCE(email, '') ILIKE ${patron}
      `;
      totalRegistros = conteo.total;

      clientes = await sql`
        SELECT
          c.*,
          (SELECT COUNT(*)::int FROM sesiones s WHERE s.cliente_id = c.id) AS total_sesiones,
          TO_CHAR((SELECT MAX(fecha_sesion) FROM sesiones s WHERE s.cliente_id = c.id), 'YYYY-MM-DD') AS ultima_cita
        FROM clientes c
        WHERE c.nombre ILIKE ${patron}
           OR c.apellido ILIKE ${patron}
           OR COALESCE(c.telefono, '') ILIKE ${patron}
           OR COALESCE(c.email, '') ILIKE ${patron}
        ORDER BY c.fecha_registro DESC, c.id DESC
        LIMIT ${porPagina} OFFSET ${offset}
      `;
    } else {
      const [conteo] = await sql`SELECT COUNT(*)::int AS total FROM clientes`;
      totalRegistros = conteo.total;

      clientes = await sql`
        SELECT
          c.*,
          (SELECT COUNT(*)::int FROM sesiones s WHERE s.cliente_id = c.id) AS total_sesiones,
          TO_CHAR((SELECT MAX(fecha_sesion) FROM sesiones s WHERE s.cliente_id = c.id), 'YYYY-MM-DD') AS ultima_cita
        FROM clientes c
        ORDER BY c.fecha_registro DESC, c.id DESC
        LIMIT ${porPagina} OFFSET ${offset}
      `;
    }

    return NextResponse.json({
      usuario,
      clientes,
      totalRegistros,
      pagina,
      totalPaginas: Math.ceil(totalRegistros / porPagina),
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
    const id = parseInt(body.id || 0, 10);
    const nombre = (body.nombre || '').trim();
    const apellido = (body.apellido || '').trim();
    const telefono = (body.telefono || '').trim();
    const email = (body.email || '').trim();
    const direccion = (body.direccion || '').trim();
    const notas = (body.notas || '').trim();

    if (!nombre) {
      return NextResponse.json(
        { ok: false, error: 'El nombre completo es obligatorio.' },
        { status: 400 }
      );
    }

    if (id > 0) {
      await sql`
        UPDATE clientes
        SET nombre = ${nombre},
            apellido = ${apellido},
            telefono = ${telefono},
            email = ${email},
            direccion = ${direccion},
            notas = ${notas}
        WHERE id = ${id}
      `;
      return NextResponse.json({ ok: true, mensaje: 'Cliente actualizado correctamente.' });
    } else {
      const [nuevo] = await sql`
        INSERT INTO clientes (nombre, apellido, telefono, email, direccion, notas)
        VALUES (${nombre}, ${apellido}, ${telefono}, ${email}, ${direccion}, ${notas})
        RETURNING *
      `;
      return NextResponse.json({
        ok: true,
        mensaje: 'Cliente registrado correctamente.',
        cliente: nuevo,
      });
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
    if (!id) {
      return NextResponse.json({ ok: false, error: 'ID inválido' }, { status: 400 });
    }

    await sql`DELETE FROM clientes WHERE id = ${id}`;
    return NextResponse.json({ ok: true, mensaje: 'Cliente eliminado.' });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

