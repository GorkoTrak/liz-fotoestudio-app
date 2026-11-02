import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const sql = getDB();
    const { searchParams } = new URL(request.url);
    const singleId = parseInt(searchParams.get('id') || '0', 10);

    // Detalle individual de una factura (para vista PDF / Impresión)
    if (singleId > 0) {
      const fRows = await sql`
        SELECT f.*,
               cl.nombre, cl.apellido, cl.telefono, cl.email,
               s.fecha_sesion::text AS fecha_sesion, s.hora_sesion::text AS hora_sesion,
               p.nombre AS servicio, p.precio AS servicio_precio, p.categoria AS servicio_categoria
        FROM facturas f
        JOIN clientes cl ON f.cliente_id = cl.id
        LEFT JOIN sesiones s ON f.sesion_id = s.id
        LEFT JOIN productos p ON s.producto_id = p.id
        WHERE f.id = ${singleId}
        LIMIT 1
      `;
      if (fRows.length === 0) {
        return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });
      }
      const factura = fRows[0];
      const sesionId = Number(factura.sesion_id || 0);

      let pagos = [];
      if (sesionId > 0) {
        pagos = await sql`
          SELECT id, monto, metodo_pago, fecha::text AS fecha, concepto
          FROM ingresos
          WHERE tipo = 'ingreso' AND (factura_id = ${singleId} OR sesion_id = ${sesionId})
          ORDER BY fecha ASC, id ASC
        `;
      } else {
        pagos = await sql`
          SELECT id, monto, metodo_pago, fecha::text AS fecha, concepto
          FROM ingresos
          WHERE tipo = 'ingreso' AND factura_id = ${singleId}
          ORDER BY fecha ASC, id ASC
        `;
      }

      let adicionales = [];
      if (sesionId > 0) {
        adicionales = await sql`
          SELECT sp.cantidad, sp.precio, p.nombre, p.categoria
          FROM sesion_productos sp
          JOIN productos p ON sp.producto_id = p.id
          WHERE sp.sesion_id = ${sesionId}
          ORDER BY sp.id ASC
        `;
      }

      return NextResponse.json({ factura, pagos, adicionales });
    }

    const estado = (searchParams.get('estado') || '').trim();
    const pagina = Math.max(1, parseInt(searchParams.get('p') || '1', 10));
    const porPagina = 12;
    const offset = (pagina - 1) * porPagina;

    let countRes;
    let facturas;

    if (estado) {
      countRes = await sql`SELECT COUNT(*)::int AS total FROM facturas f WHERE f.estado = ${estado}`;
      facturas = await sql`
        SELECT f.*, f.fecha_emision::text AS fecha_emision, f.fecha_vencimiento::text AS fecha_vencimiento,
               cl.nombre, cl.apellido, cl.telefono,
               s.fecha_sesion::text AS fecha_sesion, p.nombre AS servicio
        FROM facturas f
        JOIN clientes cl ON f.cliente_id = cl.id
        LEFT JOIN sesiones s ON f.sesion_id = s.id
        LEFT JOIN productos p ON s.producto_id = p.id
        WHERE f.estado = ${estado}
        ORDER BY f.fecha_emision DESC, f.id DESC
        LIMIT ${porPagina} OFFSET ${offset}
      `;
    } else {
      countRes = await sql`SELECT COUNT(*)::int AS total FROM facturas f`;
      facturas = await sql`
        SELECT f.*, f.fecha_emision::text AS fecha_emision, f.fecha_vencimiento::text AS fecha_vencimiento,
               cl.nombre, cl.apellido, cl.telefono,
               s.fecha_sesion::text AS fecha_sesion, p.nombre AS servicio
        FROM facturas f
        JOIN clientes cl ON f.cliente_id = cl.id
        LEFT JOIN sesiones s ON f.sesion_id = s.id
        LEFT JOIN productos p ON s.producto_id = p.id
        ORDER BY f.fecha_emision DESC, f.id DESC
        LIMIT ${porPagina} OFFSET ${offset}
      `;
    }

    const totalRegistros = countRes[0]?.total || 0;
    const totalPaginas = Math.ceil(totalRegistros / porPagina) || 1;

    const [rPend, rSaldo, rPag, rTot, clientes, sesiones] = await Promise.all([
      sql`SELECT COUNT(*)::int AS t FROM facturas WHERE estado IN ('pendiente','abonada')`,
      sql`SELECT COALESCE(SUM(saldo),0)::numeric AS t FROM facturas WHERE estado IN ('pendiente','abonada')`,
      sql`SELECT COUNT(*)::int AS t FROM facturas WHERE estado = 'pagada'`,
      sql`SELECT COUNT(*)::int AS t FROM facturas`,
      sql`SELECT id, nombre, apellido FROM clientes ORDER BY nombre ASC`,
      sql`
        SELECT s.id, s.fecha_sesion::text AS fecha_sesion, s.total, s.abono,
               cl.nombre, cl.apellido, p.nombre AS servicio
        FROM sesiones s
        JOIN clientes cl ON s.cliente_id = cl.id
        LEFT JOIN productos p ON s.producto_id = p.id
        ORDER BY s.fecha_sesion DESC, s.id DESC
        LIMIT 60
      `,
    ]);

    return NextResponse.json({
      facturas,
      totalRegistros,
      totalPaginas,
      pagina,
      stats: {
        pendientes: rPend[0]?.t || 0,
        saldoPend: Number(rSaldo[0]?.t || 0),
        pagadas: rPag[0]?.t || 0,
        totalFacturas: rTot[0]?.t || 0,
      },
      clientes,
      sesiones,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const sql = getDB();
    const body = await request.json();
    const accion = body.accion || 'guardar';

    if (accion === 'guardar') {
      const id = parseInt(body.id || '0', 10);
      const cliente_id = parseInt(body.cliente_id || '0', 10);
      const sesion_id = parseInt(body.sesion_id || '0', 10) || null;
      const total = parseFloat(body.total || '0');
      const abono = parseFloat(body.abono || '0');
      const metodo_pago = (body.metodo_pago || 'efectivo').trim();
      const estado = (body.estado || 'pendiente').trim();
      const fecha_vencimiento = body.fecha_vencimiento ? body.fecha_vencimiento.trim() : null;
      const notas = (body.notas || '').trim();

      if (!cliente_id || total <= 0) {
        return NextResponse.json({ error: 'Cliente y monto total son obligatorios.' }, { status: 400 });
      }

      if (id > 0) {
        await sql`
          UPDATE facturas
          SET cliente_id = ${cliente_id},
              sesion_id = ${sesion_id},
              total = ${total},
              abono = ${abono},
              metodo_pago = ${metodo_pago},
              estado = ${estado},
              fecha_vencimiento = ${fecha_vencimiento},
              notas = ${notas}
          WHERE id = ${id}
        `;
        return NextResponse.json({ ok: true, mensaje: 'Factura actualizada.' });
      } else {
        const anio = new Date().getFullYear();
        const rNum = await sql`SELECT COUNT(*)::int AS t FROM facturas WHERE EXTRACT(YEAR FROM fecha_emision) = ${anio}`;
        const num = (rNum[0]?.t || 0) + 1;
        const numero = `FAC-${anio}-${String(num).padStart(4, '0')}`;
        const hoy = new Date().toISOString().split('T')[0];

        const inserted = await sql`
          INSERT INTO facturas (sesion_id, cliente_id, numero_factura, total, abono, metodo_pago, estado, fecha_emision, fecha_vencimiento, notas)
          VALUES (${sesion_id}, ${cliente_id}, ${numero}, ${total}, ${abono}, ${metodo_pago}, ${estado}, ${hoy}, ${fecha_vencimiento}, ${notas})
          RETURNING id
        `;
        const fId = inserted[0].id;

        if (abono > 0) {
          const concepto = `Pago factura ${numero}`;
          await sql`
            INSERT INTO ingresos (sesion_id, factura_id, cliente_id, concepto, monto, tipo, metodo_pago, fecha)
            VALUES (${sesion_id}, ${fId}, ${cliente_id}, ${concepto}, ${abono}, 'ingreso', ${metodo_pago}, ${hoy})
          `;
        }

        return NextResponse.json({ ok: true, mensaje: `Factura ${numero} creada correctamente.` });
      }
    }

    if (accion === 'registrar_pago') {
      const id = parseInt(body.id || '0', 10);
      const monto = parseFloat(body.monto || '0');
      const metodo = (body.metodo_pago || 'efectivo').trim();

      if (!id || monto <= 0) {
        return NextResponse.json({ error: 'ID de factura y monto válido son obligatorios.' }, { status: 400 });
      }

      const fRows = await sql`SELECT * FROM facturas WHERE id = ${id} LIMIT 1`;
      if (fRows.length === 0) {
        return NextResponse.json({ error: 'Factura no encontrada.' }, { status: 404 });
      }
      const f = fRows[0];
      const nuevoAbono = Number(f.abono) + monto;
      const nuevoEstado = nuevoAbono >= Number(f.total) ? 'pagada' : 'abonada';
      const hoy = new Date().toISOString().split('T')[0];

      await sql`
        UPDATE facturas
        SET abono = ${nuevoAbono}, estado = ${nuevoEstado}, metodo_pago = ${metodo}
        WHERE id = ${id}
      `;

      if (f.sesion_id) {
        const sRows = await sql`SELECT total FROM sesiones WHERE id = ${f.sesion_id} LIMIT 1`;
        if (sRows.length > 0) {
          const totalSesion = Number(sRows[0].total || 0);
          const estadoSesion = nuevoAbono >= totalSesion ? 'pagado' : nuevoAbono > 0 ? 'abonado' : 'pendiente';
          await sql`
            UPDATE sesiones
            SET abono = ${nuevoAbono}, estado_pago = ${estadoSesion}, metodo_pago = ${metodo}
            WHERE id = ${f.sesion_id}
          `;
        }
      }

      const concepto = `Abono factura ${f.numero_factura}`;
      await sql`
        INSERT INTO ingresos (sesion_id, factura_id, cliente_id, concepto, monto, tipo, metodo_pago, fecha)
        VALUES (${f.sesion_id || null}, ${id}, ${f.cliente_id}, ${concepto}, ${monto}, 'ingreso', ${metodo}, ${hoy})
      `;

      return NextResponse.json({ ok: true, mensaje: 'Pago registrado correctamente.' });
    }

    return NextResponse.json({ error: 'Acción no reconocida.' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const sql = getDB();
    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get('id') || '0', 10);

    if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    const fRows = await sql`SELECT sesion_id FROM facturas WHERE id = ${id} LIMIT 1`;
    if (fRows.length > 0) {
      const sesionId = fRows[0].sesion_id;
      await sql`DELETE FROM ingresos WHERE factura_id = ${id}`;
      if (sesionId) {
        await sql`DELETE FROM ingresos WHERE sesion_id = ${sesionId}`;
        await sql`UPDATE sesiones SET abono = 0, estado_pago = 'pendiente' WHERE id = ${sesionId}`;
      }
      await sql`DELETE FROM facturas WHERE id = ${id}`;
    }

    return NextResponse.json({ ok: true, mensaje: 'Factura e ingresos asociados eliminados correctamente.' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

