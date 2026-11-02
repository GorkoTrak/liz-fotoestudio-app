import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

const MESES_CORTOS = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MESES_FULL = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export async function GET(request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    if (user.rol !== 'admin') return NextResponse.json({ error: 'Acceso restringido a administradores' }, { status: 403 });

    const sql = getDB();
    const { searchParams } = new URL(request.url);

    const now = new Date();
    const filtroMes = parseInt(searchParams.get('mes') || String(now.getMonth() + 1), 10);
    const filtroAnio = parseInt(searchParams.get('anio') || String(now.getFullYear()), 10);
    const filtroTipo = (searchParams.get('tipo') || '').trim();
    let filtroDesde = (searchParams.get('desde') || '').trim();
    let filtroHasta = (searchParams.get('hasta') || '').trim();

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (filtroDesde && !dateRegex.test(filtroDesde)) filtroDesde = '';
    if (filtroHasta && !dateRegex.test(filtroHasta)) filtroHasta = '';
    if (filtroDesde && filtroHasta && filtroDesde > filtroHasta) {
      const tmp = filtroDesde;
      filtroDesde = filtroHasta;
      filtroHasta = tmp;
    }

    const pagina = Math.max(1, parseInt(searchParams.get('p') || '1', 10));
    const porPag = 15;
    const offset = (pagina - 1) * porPag;

    // Obtener todos los movimientos que cumplan el período para paginar y calcular totales de forma limpia
    let baseRows;
    if (filtroDesde && filtroHasta) {
      baseRows = await sql`
        SELECT i.*, i.fecha::text AS fecha, cl.nombre, cl.apellido
        FROM ingresos i
        LEFT JOIN clientes cl ON i.cliente_id = cl.id
        WHERE i.fecha >= ${filtroDesde} AND i.fecha <= ${filtroHasta}
        ORDER BY i.fecha DESC, i.id DESC
      `;
    } else if (filtroDesde) {
      baseRows = await sql`
        SELECT i.*, i.fecha::text AS fecha, cl.nombre, cl.apellido
        FROM ingresos i
        LEFT JOIN clientes cl ON i.cliente_id = cl.id
        WHERE i.fecha >= ${filtroDesde}
        ORDER BY i.fecha DESC, i.id DESC
      `;
    } else if (filtroHasta) {
      baseRows = await sql`
        SELECT i.*, i.fecha::text AS fecha, cl.nombre, cl.apellido
        FROM ingresos i
        LEFT JOIN clientes cl ON i.cliente_id = cl.id
        WHERE i.fecha <= ${filtroHasta}
        ORDER BY i.fecha DESC, i.id DESC
      `;
    } else {
      baseRows = await sql`
        SELECT i.*, i.fecha::text AS fecha, cl.nombre, cl.apellido
        FROM ingresos i
        LEFT JOIN clientes cl ON i.cliente_id = cl.id
        WHERE EXTRACT(MONTH FROM i.fecha) = ${filtroMes}
          AND EXTRACT(YEAR FROM i.fecha) = ${filtroAnio}
        ORDER BY i.fecha DESC, i.id DESC
      `;
    }

    let ingMes = 0;
    let egrMes = 0;
    for (const r of baseRows) {
      if (r.tipo === 'ingreso') ingMes += Number(r.monto || 0);
      else if (r.tipo === 'egreso') egrMes += Number(r.monto || 0);
    }
    const utilidadMes = ingMes - egrMes;

    const filteredRows = filtroTipo ? baseRows.filter((r) => r.tipo === filtroTipo) : baseRows;
    const totalRegistros = filteredRows.length;
    const totalPaginas = Math.ceil(totalRegistros / porPag) || 1;
    const movimientos = filteredRows.slice(offset, offset + porPag);

    // Totales del año y gráficas
    const [anioRows, semanaRows, clientes] = await Promise.all([
      sql`
        SELECT EXTRACT(MONTH FROM fecha)::int AS m, tipo, COALESCE(SUM(monto),0)::numeric AS t
        FROM ingresos
        WHERE EXTRACT(YEAR FROM fecha) = ${filtroAnio}
        GROUP BY EXTRACT(MONTH FROM fecha), tipo
      `,
      sql`
        SELECT fecha::text AS dia, tipo, COALESCE(SUM(monto),0)::numeric AS t
        FROM ingresos
        WHERE fecha >= CURRENT_DATE - INTERVAL '6 days'
        GROUP BY fecha, tipo
        ORDER BY fecha ASC
      `,
      sql`SELECT id, nombre, apellido FROM clientes ORDER BY nombre ASC`,
    ]);

    let ingAnio = 0;
    let egrAnio = 0;
    const mapAnio = {};
    for (let m = 1; m <= 12; m++) {
      mapAnio[m] = { ingreso: 0, egreso: 0 };
    }
    for (const row of anioRows) {
      const m = Number(row.m);
      const val = Number(row.t || 0);
      if (row.tipo === 'ingreso') {
        ingAnio += val;
        if (mapAnio[m]) mapAnio[m].ingreso = val;
      } else if (row.tipo === 'egreso') {
        egrAnio += val;
        if (mapAnio[m]) mapAnio[m].egreso = val;
      }
    }
    const utilidadAnio = ingAnio - egrAnio;

    const datosAnio = [];
    for (let m = 1; m <= 12; m++) {
      datosAnio.push({
        lbl: MESES_CORTOS[m],
        ing: mapAnio[m].ingreso,
        egr: mapAnio[m].egreso,
        act: m === filtroMes,
      });
    }

    const datosMes = [
      {
        lbl: MESES_CORTOS[filtroMes] || '',
        ing: mapAnio[filtroMes]?.ingreso || 0,
        egr: mapAnio[filtroMes]?.egreso || 0,
        act: true,
      },
    ];

    const mapSemana = {};
    const hoyIso = new Date().toISOString().split('T')[0];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().split('T')[0];
      mapSemana[iso] = { ingreso: 0, egreso: 0 };
    }
    for (const r of semanaRows) {
      if (mapSemana[r.dia]) {
        mapSemana[r.dia][r.tipo] = Number(r.t || 0);
      }
    }
    const datosSemana = Object.entries(mapSemana).map(([fechaIso, vals]) => {
      const [y, m, d] = fechaIso.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      const lbl = `${DIAS_SEMANA[dt.getDay()]} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
      return {
        lbl,
        ing: vals.ingreso,
        egr: vals.egreso,
        act: fechaIso === hoyIso,
      };
    });

    return NextResponse.json({
      movimientos,
      totalRegistros,
      totalPaginas,
      pagina,
      filtroMes,
      filtroAnio,
      stats: {
        ingMes,
        egrMes,
        utilidadMes,
        ingAnio,
        egrAnio,
        utilidadAnio,
        mesNombreFull: MESES_FULL[filtroMes] || '',
      },
      graficas: {
        mes: datosMes,
        semana: datosSemana,
        anio: datosAnio,
      },
      clientes,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    if (user.rol !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const sql = getDB();
    const body = await request.json();

    const id = parseInt(body.id || '0', 10);
    const cliente_id = parseInt(body.cliente_id || '0', 10) || null;
    const concepto = (body.concepto || '').trim();
    const monto = parseFloat(body.monto || '0');
    const tipo = (body.tipo || 'ingreso').trim();
    const metodo_pago = (body.metodo_pago || 'efectivo').trim();
    const fecha = (body.fecha || new Date().toISOString().split('T')[0]).trim();
    const notas = (body.notas || '').trim();

    if (!concepto || monto <= 0) {
      return NextResponse.json({ error: 'Concepto y monto son obligatorios.' }, { status: 400 });
    }

    if (id > 0) {
      await sql`
        UPDATE ingresos
        SET cliente_id = ${cliente_id},
            concepto = ${concepto},
            monto = ${monto},
            tipo = ${tipo},
            metodo_pago = ${metodo_pago},
            fecha = ${fecha},
            notas = ${notas}
        WHERE id = ${id}
      `;
      return NextResponse.json({ ok: true, mensaje: 'Movimiento actualizado.' });
    } else {
      await sql`
        INSERT INTO ingresos (cliente_id, concepto, monto, tipo, metodo_pago, fecha, notas)
        VALUES (${cliente_id}, ${concepto}, ${monto}, ${tipo}, ${metodo_pago}, ${fecha}, ${notas})
      `;
      return NextResponse.json({ ok: true, mensaje: 'Movimiento registrado correctamente.' });
    }
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    if (user.rol !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const sql = getDB();
    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get('id') || '0', 10);
    if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    await sql`DELETE FROM ingresos WHERE id = ${id}`;
    return NextResponse.json({ ok: true, mensaje: 'Registro eliminado.' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

