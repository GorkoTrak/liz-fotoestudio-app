import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { obtenerUsuarioActual } from '@/lib/auth';

export async function GET(request) {
  try {
    const usuario = await obtenerUsuarioActual(request);
    if (!usuario) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // 1. Estadísticas principales en una sola consulta a Neon
    const [stats] = await sql`
      SELECT
        (SELECT COUNT(*)::int FROM clientes) AS total_clientes,
        (SELECT COUNT(*)::int FROM citas WHERE EXTRACT(MONTH FROM fecha) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM fecha) = EXTRACT(YEAR FROM CURRENT_DATE)) AS citas_mes,
        (SELECT COUNT(*)::int FROM sesiones WHERE estado_entrega NOT IN ('entregada', 'entregado')) AS sesiones_pend_entrega,
        (SELECT COUNT(*)::int FROM sesiones WHERE estado_pago != 'pagado') AS sesiones_pend_pago,
        (SELECT COALESCE(SUM(monto), 0)::numeric FROM ingresos WHERE tipo = 'ingreso' AND EXTRACT(MONTH FROM fecha) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM fecha) = EXTRACT(YEAR FROM CURRENT_DATE)) AS ingresos_mes,
        (SELECT COALESCE(SUM(saldo), 0)::numeric FROM sesiones WHERE estado_pago != 'pagado') AS saldo_pendiente,
        (SELECT COUNT(*)::int FROM sesiones WHERE fecha_sesion > CURRENT_DATE) AS sesiones_proximas,
        (SELECT COALESCE(SUM(monto), 0)::numeric FROM ingresos WHERE tipo = 'ingreso' AND EXTRACT(YEAR FROM fecha) = EXTRACT(YEAR FROM CURRENT_DATE)) AS total_anio,
        (SELECT COUNT(*)::int FROM facturas WHERE estado = 'pendiente') AS facturas_pendientes
    `;

    // 2. Alertas: Cobros pendientes, Entregas pendientes, Citas mañana
    const alertasCobros = await sql`
      SELECT
        s.id AS ref_id,
        TRIM(s.cliente_nombre) AS cliente,
        s.total AS monto,
        s.saldo AS saldo,
        TO_CHAR(s.fecha_sesion, 'YYYY-MM-DD') AS fecha_ref
      FROM (
        SELECT s.id, (cl.nombre || ' ' || COALESCE(cl.apellido, '')) AS cliente_nombre, s.total, s.saldo, s.fecha_sesion
        FROM sesiones s
        JOIN clientes cl ON s.cliente_id = cl.id
        WHERE s.estado_pago != 'pagado'
        ORDER BY s.fecha_sesion ASC
        LIMIT 4
      ) s
    `;

    const alertasEntregas = await sql`
      SELECT
        s.id AS ref_id,
        TRIM(cl.nombre || ' ' || COALESCE(cl.apellido, '')) AS cliente,
        TO_CHAR(s.fecha_sesion, 'YYYY-MM-DD') AS fecha_ref
      FROM sesiones s
      JOIN clientes cl ON s.cliente_id = cl.id
      WHERE s.estado_entrega NOT IN ('entregada', 'entregado')
      ORDER BY s.fecha_sesion ASC
      LIMIT 4
    `;

    const alertasCitas = await sql`
      SELECT
        c.id AS ref_id,
        TRIM(cl.nombre || ' ' || COALESCE(cl.apellido, '')) AS cliente,
        TO_CHAR(c.fecha, 'YYYY-MM-DD') AS fecha_ref
      FROM citas c
      JOIN clientes cl ON c.cliente_id = cl.id
      WHERE c.fecha = CURRENT_DATE + INTERVAL '1 day' AND c.estado != 'cancelada'
      LIMIT 3
    `;

    // 3. Últimas 6 sesiones registradas
    const ultimasSesiones = await sql`
      SELECT
        s.id,
        TO_CHAR(s.fecha_sesion, 'YYYY-MM-DD') AS fecha_sesion,
        s.estado_pago,
        s.estado_entrega,
        cl.nombre,
        cl.apellido,
        cl.telefono,
        p.nombre AS servicio
      FROM sesiones s
      JOIN clientes cl ON s.cliente_id = cl.id
      LEFT JOIN productos p ON s.producto_id = p.id
      ORDER BY s.fecha_sesion DESC, s.id DESC
      LIMIT 6
    `;

    // 4. Ingresos por mes (últimos 7 meses)
    const ingresosPorMes = await sql`
      SELECT
        EXTRACT(MONTH FROM fecha)::int AS mes,
        EXTRACT(YEAR FROM fecha)::int AS anio,
        COALESCE(SUM(monto), 0)::numeric AS total
      FROM ingresos
      WHERE tipo = 'ingreso' AND fecha >= CURRENT_DATE - INTERVAL '7 months'
      GROUP BY EXTRACT(YEAR FROM fecha), EXTRACT(MONTH FROM fecha)
      ORDER BY anio ASC, mes ASC
    `;

    return NextResponse.json({
      usuario,
      stats,
      alertas: {
        cobros: alertasCobros,
        entregas: alertasEntregas,
        citas: alertasCitas,
      },
      ultimasSesiones,
      ingresosPorMes,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Error consultando el dashboard: ' + error.message },
      { status: 500 }
    );
  }
}

