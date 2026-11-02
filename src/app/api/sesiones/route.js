import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

function formatDMY(isoDateStr) {
  if (!isoDateStr) return '';
  const parts = String(isoDateStr).split('T')[0].split('-');
  if (parts.length !== 3) return String(isoDateStr);
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export async function GET(request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const sql = getDB();
    const { searchParams } = new URL(request.url);

    // Endpoint rápido para galería de fotos de una sesión
    if (searchParams.get('accion_galeria')) {
      const sid = parseInt(searchParams.get('sesion_id') || '0', 10);
      if (!sid) return NextResponse.json([]);
      const fotos = await sql`
        SELECT id, archivo, descripcion, categoria, grupo_desc
        FROM sesion_fotos
        WHERE sesion_id = ${sid}
        ORDER BY fecha_subida DESC, id DESC
      `;
      return NextResponse.json(fotos);
    }

    const now = new Date();
    const sesionParamId = parseInt(searchParams.get('sesion_id') || searchParams.get('id') || '0', 10);
    const forzarSesion = searchParams.get('forzar_sesion') === '1';
    let anioParam = searchParams.get('anio') ? parseInt(searchParams.get('anio'), 10) : null;
    let mesParam = searchParams.get('mes') ? parseInt(searchParams.get('mes'), 10) : null;
    let diaParam = searchParams.get('dia') ? parseInt(searchParams.get('dia'), 10) : null;

    if (
      sesionParamId > 0 &&
      (forzarSesion || anioParam === null || mesParam === null || diaParam === null)
    ) {
      const sDateRows = await sql`SELECT fecha_sesion::text AS fecha_sesion FROM sesiones WHERE id = ${sesionParamId} LIMIT 1`;
      if (sDateRows.length > 0 && sDateRows[0].fecha_sesion) {
        const [y, m, d] = sDateRows[0].fecha_sesion.split('T')[0].split('-').map(Number);
        anioParam = y;
        mesParam = m;
        diaParam = d;
      }
    }

    let anioC = anioParam || now.getFullYear();
    let mesC = mesParam || now.getMonth() + 1;
    if (mesC < 1) {
      mesC = 12;
      anioC--;
    }
    if (mesC > 12) {
      mesC = 1;
      anioC++;
    }

    const diasMes = new Date(anioC, mesC, 0).getDate();
    const firstDayJs = new Date(anioC, mesC - 1, 1).getDay();
    const diaSemana = firstDayJs === 0 ? 7 : firstDayJs; // 1=Lun..7=Dom

    let diaSeleccionado = diaParam || now.getDate();
    if (diaSeleccionado > diasMes) diaSeleccionado = diasMes;
    if (diaSeleccionado < 1) diaSeleccionado = 1;

    const estadoFiltro = (searchParams.get('estado') || '').trim();
    const entregaFiltro = (searchParams.get('entrega') || '').trim();
    const pagina = Math.max(1, parseInt(searchParams.get('p') || '1', 10));
    const porPagina = 12;
    const offset = (pagina - 1) * porPagina;

    const [
      rPagosPend,
      rEntregasPend,
      rSaldoPend,
      spRows,
      abRows,
      allSesionesRows,
      clientes,
      productos,
    ] = await Promise.all([
      sql`SELECT COUNT(*)::int AS t FROM sesiones WHERE estado_pago != 'pagado'`,
      sql`SELECT COUNT(*)::int AS t FROM sesiones WHERE estado_entrega NOT IN ('entregada', 'entregado')`,
      sql`SELECT COALESCE(SUM(saldo),0)::numeric AS t FROM sesiones WHERE estado_pago != 'pagado'`,
      sql`SELECT sesion_id, producto_id, cantidad, precio FROM sesion_productos ORDER BY id ASC`,
      sql`
        SELECT id, sesion_id, factura_id, concepto, monto, metodo_pago, fecha::text AS fecha, notas
        FROM ingresos
        WHERE tipo = 'ingreso' AND (sesion_id IS NOT NULL OR factura_id IS NOT NULL)
        ORDER BY fecha ASC, id ASC
      `,
      sql`
        SELECT s.*,
               s.fecha_sesion::text AS fecha_sesion,
               s.hora_sesion::text AS hora_sesion,
               cl.nombre, cl.apellido, cl.telefono,
               p.nombre AS servicio,
               fv.id AS factura_id,
               fv.numero_factura AS factura_numero,
               fv.total AS factura_total,
               fv.abono AS factura_abono,
               fv.estado AS factura_estado
        FROM sesiones s
        JOIN clientes cl ON s.cliente_id = cl.id
        LEFT JOIN productos p ON s.producto_id = p.id
        LEFT JOIN (
          SELECT sesion_id, MAX(id) AS fid
          FROM facturas
          WHERE sesion_id IS NOT NULL
          GROUP BY sesion_id
        ) fx ON fx.sesion_id = s.id
        LEFT JOIN facturas fv ON fv.id = fx.fid
        ORDER BY s.fecha_sesion DESC, s.hora_sesion DESC, s.id DESC
      `,
      sql`SELECT id, nombre, apellido, telefono FROM clientes ORDER BY nombre ASC`,
      sql`SELECT id, nombre, descripcion, precio, tipo, categoria FROM productos WHERE estado = 'activo' ORDER BY nombre ASC`,
    ]);

    const adicionalesPorSesion = {};
    for (const row of spRows) {
      const sid = Number(row.sesion_id);
      if (!adicionalesPorSesion[sid]) adicionalesPorSesion[sid] = [];
      adicionalesPorSesion[sid].push({
        producto_id: Number(row.producto_id),
        cantidad: Math.max(1, Number(row.cantidad)),
        precio: Number(row.precio),
      });
    }

    const abonosPorSesion = {};
    const abonosPorFactura = {};
    for (const ab of abRows) {
      const sIdAb = Number(ab.sesion_id || 0);
      const fIdAb = Number(ab.factura_id || 0);
      if (sIdAb > 0) {
        if (!abonosPorSesion[sIdAb]) abonosPorSesion[sIdAb] = [];
        abonosPorSesion[sIdAb].push(ab);
      } else if (fIdAb > 0) {
        if (!abonosPorFactura[fIdAb]) abonosPorFactura[fIdAb] = [];
        abonosPorFactura[fIdAb].push(ab);
      }
    }

    const enrichedSesiones = allSesionesRows.map((row) => {
      const sid = Number(row.id);
      const fid = Number(row.factura_id || 0);
      const adicionales = adicionalesPorSesion[sid] || [];
      const abonos =
        abonosPorSesion[sid] || (fid && abonosPorFactura[fid] ? abonosPorFactura[fid] : []);
      const totalNum = Number(row.total || 0);
      const abonoNum = Number(row.abono || 0);
      const estadoPagoNormalizado =
        row.estado_pago && String(row.estado_pago).trim() !== ''
          ? row.estado_pago
          : totalNum > 0 && abonoNum >= totalNum
          ? 'pagado'
          : totalNum === 0 && abonoNum > 0
          ? 'reserva'
          : abonoNum > 0
          ? 'abonado'
          : 'pendiente';
      return {
        ...row,
        estado_pago: estadoPagoNormalizado,
        adicionales,
        abonos,
      };
    });

    // Sesiones del mes para el calendario
    const prefixMes = `${anioC}-${String(mesC).padStart(2, '0')}-`;
    const sesionesCalendario = {};
    for (const s of enrichedSesiones) {
      if (s.fecha_sesion && s.fecha_sesion.startsWith(prefixMes)) {
        const d = parseInt(s.fecha_sesion.split('-')[2], 10);
        if (!sesionesCalendario[d]) sesionesCalendario[d] = [];
        sesionesCalendario[d].push(s);
      }
    }
    // Ordenar las sesiones de cada día por hora_sesion ascendente
    for (const d of Object.keys(sesionesCalendario)) {
      sesionesCalendario[d].sort((a, b) =>
        String(a.hora_sesion || '').localeCompare(String(b.hora_sesion || ''))
      );
    }

    const sesionesDelDia = sesionesCalendario[diaSeleccionado] || [];

    // Filtrar para el listado general
    const filteredList = enrichedSesiones.filter((s) => {
      if (estadoFiltro && s.estado_pago !== estadoFiltro) return false;
      if (entregaFiltro) {
        if (entregaFiltro === 'editada') {
          if (!['editada', 'en_edicion'].includes(s.estado_entrega)) return false;
        } else if (entregaFiltro === 'entregada') {
          if (!['entregada', 'entregado'].includes(s.estado_entrega)) return false;
        } else if (s.estado_entrega !== entregaFiltro) {
          return false;
        }
      }
      return true;
    });

    const totalRegistros = filteredList.length;
    const totalPaginas = Math.ceil(totalRegistros / porPagina) || 1;
    const listadoSesiones = filteredList.slice(offset, offset + porPagina);

    return NextResponse.json({
      anioC,
      mesC,
      diaSeleccionado,
      diasMes,
      diaSemana,
      sesionParamId,
      stats: {
        pagosPend: rPagosPend[0]?.t || 0,
        entregasPend: rEntregasPend[0]?.t || 0,
        saldoPend: Number(rSaldoPend[0]?.t || 0),
      },
      sesionesCalendario,
      sesionesDelDia,
      listadoSesiones,
      todasLasSesiones: enrichedSesiones,
      totalRegistros,
      totalPaginas,
      pagina,
      clientes,
      productos,
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

    // 1. Guardar o actualizar sesión
    if (accion === 'guardar') {
      const id = parseInt(body.id || '0', 10);
      const cliente_id = parseInt(body.cliente_id || '0', 10);
      const cita_id = parseInt(body.cita_id || '0', 10) || null;
      const fecha_sesion = (body.fecha_sesion || '').trim();
      let hora_sesion = (body.hora_sesion || '').trim();
      if (hora_sesion.length === 5) hora_sesion += ':00';

      let abono = Math.max(0, parseFloat(body.abono || '0'));
      const estado_entrega = (body.estado_entrega || 'pendiente').trim();
      const notas = (body.notas || '').trim();
      const metodo_pago = (body.metodo_pago || 'efectivo').trim();
      const producto_id_principal = parseInt(body.producto_principal_id || '0', 10) || null;

      if (!cliente_id || !fecha_sesion || !hora_sesion) {
        return NextResponse.json(
          { error: 'Cliente, fecha y hora son obligatorios.' },
          { status: 400 }
        );
      }

      // Verificar disponibilidad de hora
      let chkHorario;
      if (id > 0) {
        chkHorario = await sql`
          SELECT id FROM sesiones
          WHERE fecha_sesion = ${fecha_sesion} AND hora_sesion = ${hora_sesion} AND id <> ${id}
          LIMIT 1
        `;
      } else {
        chkHorario = await sql`
          SELECT id FROM sesiones
          WHERE fecha_sesion = ${fecha_sesion} AND hora_sesion = ${hora_sesion}
          LIMIT 1
        `;
      }
      if (chkHorario.length > 0) {
        return NextResponse.json(
          { error: 'Ya hay una sesión agendada a esa hora. Elige otra hora disponible.' },
          { status: 400 }
        );
      }

      // Calcular total desde productos activos
      let total = 0;
      if (producto_id_principal) {
        const pRows = await sql`SELECT precio FROM productos WHERE id = ${producto_id_principal} LIMIT 1`;
        if (pRows.length > 0) {
          total += Number(pRows[0].precio || 0);
        }
      }

      const itemsAdicionales = Array.isArray(body.adicionales) ? body.adicionales : [];
      const adicionalesValidados = [];
      for (const item of itemsAdicionales) {
        const pid = parseInt(item.producto_id || '0', 10);
        const cant = Math.max(1, parseInt(item.cantidad || '1', 10));
        if (pid > 0) {
          const pRows = await sql`SELECT precio FROM productos WHERE id = ${pid} LIMIT 1`;
          if (pRows.length > 0) {
            const prc = Number(pRows[0].precio || 0);
            total += prc * cant;
            adicionalesValidados.push({ producto_id: pid, cantidad: cant, precio: prc });
          }
        }
      }

      if (id > 0) {
        const prevRows = await sql`SELECT estado_pago, total, abono FROM sesiones WHERE id = ${id} LIMIT 1`;
        const prev = prevRows[0] || null;

        const facRows = await sql`SELECT id FROM facturas WHERE sesion_id = ${id} LIMIT 1`;
        const facIdVinculada = facRows.length > 0 ? Number(facRows[0].id) : null;

        let rowIng;
        if (facIdVinculada) {
          const rSum = await sql`
            SELECT COUNT(*)::int AS cant, COALESCE(SUM(monto),0)::numeric AS sum_abono
            FROM ingresos
            WHERE (sesion_id = ${id} OR factura_id = ${facIdVinculada}) AND tipo = 'ingreso'
          `;
          rowIng = rSum[0];
        } else {
          const rSum = await sql`
            SELECT COUNT(*)::int AS cant, COALESCE(SUM(monto),0)::numeric AS sum_abono
            FROM ingresos
            WHERE sesion_id = ${id} AND tipo = 'ingreso'
          `;
          rowIng = rSum[0];
        }

        const cantIngresos = Number(rowIng?.cant || 0);
        if (cantIngresos > 0) {
          abono = Number(rowIng.sum_abono || 0);
        }

        const estado_pago =
          total > 0 && abono >= total
            ? 'pagado'
            : total === 0 && abono > 0
            ? 'reserva'
            : abono > 0
            ? 'abonado'
            : 'pendiente';

        await sql`
          UPDATE sesiones
          SET cliente_id = ${cliente_id},
              cita_id = ${cita_id},
              producto_id = ${producto_id_principal},
              fecha_sesion = ${fecha_sesion},
              hora_sesion = ${hora_sesion},
              total = ${total},
              abono = ${abono},
              estado_pago = ${estado_pago},
              estado_entrega = ${estado_entrega},
              notas = ${notas},
              metodo_pago = ${metodo_pago}
          WHERE id = ${id}
        `;

        await sql`DELETE FROM sesion_productos WHERE sesion_id = ${id}`;
        for (const ad of adicionalesValidados) {
          await sql`
            INSERT INTO sesion_productos (sesion_id, producto_id, cantidad, precio)
            VALUES (${id}, ${ad.producto_id}, ${ad.cantidad}, ${ad.precio})
          `;
        }

        const estadoFac =
          total > 0 && abono >= total ? 'pagada' : abono > 0 ? 'abonada' : 'pendiente';
        await sql`
          UPDATE facturas
          SET total = ${total}, abono = ${abono}, metodo_pago = ${metodo_pago}, estado = ${estadoFac}
          WHERE sesion_id = ${id}
        `;

        if (cantIngresos === 0 && prev) {
          if (prev.estado_pago !== 'pagado' && estado_pago === 'pagado') {
            const montoIngreso = total - Number(prev.abono || 0);
            if (montoIngreso > 0) {
              const concepto = `Pago saldo final – ${formatDMY(fecha_sesion)}`;
              await sql`
                INSERT INTO ingresos (sesion_id, factura_id, cliente_id, concepto, monto, tipo, metodo_pago, fecha)
                VALUES (${id}, ${facIdVinculada}, ${cliente_id}, ${concepto}, ${montoIngreso}, 'ingreso', ${metodo_pago}, ${fecha_sesion})
              `;
            }
          } else if (abono > Number(prev.abono || 0)) {
            const diff = abono - Number(prev.abono || 0);
            if (diff > 0) {
              const concepto = `Abono sesión – ${formatDMY(fecha_sesion)}`;
              await sql`
                INSERT INTO ingresos (sesion_id, factura_id, cliente_id, concepto, monto, tipo, metodo_pago, fecha)
                VALUES (${id}, ${facIdVinculada}, ${cliente_id}, ${concepto}, ${diff}, 'ingreso', ${metodo_pago}, ${fecha_sesion})
              `;
            }
          }
        }

        return NextResponse.json({ ok: true, mensaje: 'Sesión actualizada correctamente.' });
      } else {
        const estado_pago =
          total > 0 && abono >= total
            ? 'pagado'
            : total === 0 && abono > 0
            ? 'reserva'
            : abono > 0
            ? 'abonado'
            : 'pendiente';

        const insSes = await sql`
          INSERT INTO sesiones (cliente_id, cita_id, producto_id, fecha_sesion, hora_sesion, total, abono, estado_pago, estado_entrega, notas, metodo_pago)
          VALUES (${cliente_id}, ${cita_id}, ${producto_id_principal}, ${fecha_sesion}, ${hora_sesion}, ${total}, ${abono}, ${estado_pago}, ${estado_entrega}, ${notas}, ${metodo_pago})
          RETURNING id
        `;
        const nuevaSesionId = insSes[0].id;

        for (const ad of adicionalesValidados) {
          await sql`
            INSERT INTO sesion_productos (sesion_id, producto_id, cantidad, precio)
            VALUES (${nuevaSesionId}, ${ad.producto_id}, ${ad.cantidad}, ${ad.precio})
          `;
        }

        const anio = new Date().getFullYear();
        const rNum = await sql`SELECT COUNT(*)::int AS t FROM facturas WHERE EXTRACT(YEAR FROM fecha_emision) = ${anio}`;
        const numFac = (rNum[0]?.t || 0) + 1;
        const numero_factura = `FAC-${anio}-${String(numFac).padStart(4, '0')}`;
        const estadoFac =
          total > 0 && abono >= total ? 'pagada' : abono > 0 ? 'abonada' : 'pendiente';
        const hoy = new Date().toISOString().split('T')[0];

        const insFac = await sql`
          INSERT INTO facturas (sesion_id, cliente_id, numero_factura, total, abono, metodo_pago, estado, fecha_emision)
          VALUES (${nuevaSesionId}, ${cliente_id}, ${numero_factura}, ${total}, ${abono}, ${metodo_pago}, ${estadoFac}, ${hoy})
          RETURNING id
        `;
        const nuevaFacturaId = insFac[0].id;

        if (abono > 0) {
          const concepto = `${estado_pago === 'pagado' ? 'Pago sesión – ' : 'Abono #1 sesión – '}${formatDMY(fecha_sesion)}`;
          await sql`
            INSERT INTO ingresos (sesion_id, factura_id, cliente_id, concepto, monto, tipo, metodo_pago, fecha)
            VALUES (${nuevaSesionId}, ${nuevaFacturaId}, ${cliente_id}, ${concepto}, ${abono}, 'ingreso', ${metodo_pago}, ${fecha_sesion})
          `;
        }

        return NextResponse.json({ ok: true, mensaje: 'Sesión registrada correctamente.' });
      }
    }

    // 2. Actualizar estado de entrega
    if (accion === 'actualizar_entrega') {
      const id = parseInt(body.id || '0', 10);
      const estado_entrega = (body.estado_entrega || '').trim();
      if (id && estado_entrega) {
        await sql`UPDATE sesiones SET estado_entrega = ${estado_entrega} WHERE id = ${id}`;
        return NextResponse.json({ ok: true, mensaje: 'Estado de entrega actualizado.' });
      }
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }

    // 3. Registrar nuevo abono ordenado en sesión
    if (accion === 'registrar_abono_sesion') {
      const sesion_id = parseInt(body.sesion_id || '0', 10);
      const monto = parseFloat(body.monto || '0');
      const metodo_pago = (body.metodo_pago || 'efectivo').trim();
      const fecha_abono = (body.fecha || new Date().toISOString().split('T')[0]).trim();
      const notas_abono = (body.notas || '').trim();

      if (!sesion_id || monto <= 0) {
        return NextResponse.json({ error: 'Sesión y monto válido son obligatorios.' }, { status: 400 });
      }

      const rS = await sql`
        SELECT s.cliente_id, s.total, s.abono, s.fecha_sesion::text AS fecha_sesion, s.metodo_pago,
               f.id AS factura_id, f.numero_factura
        FROM sesiones s
        LEFT JOIN facturas f ON f.sesion_id = s.id
        WHERE s.id = ${sesion_id}
        LIMIT 1
      `;
      if (rS.length === 0) {
        return NextResponse.json({ error: 'Sesión no encontrada.' }, { status: 404 });
      }
      const rowS = rS[0];
      const cliente_id = Number(rowS.cliente_id);
      const totalS = Number(rowS.total || 0);
      const facId = rowS.factura_id ? Number(rowS.factura_id) : null;

      let rowCnt;
      if (facId) {
        const rc = await sql`
          SELECT COUNT(*)::int AS t, COALESCE(SUM(monto),0)::numeric AS sum_abono
          FROM ingresos
          WHERE (sesion_id = ${sesion_id} OR factura_id = ${facId}) AND tipo = 'ingreso'
        `;
        rowCnt = rc[0];
      } else {
        const rc = await sql`
          SELECT COUNT(*)::int AS t, COALESCE(SUM(monto),0)::numeric AS sum_abono
          FROM ingresos
          WHERE sesion_id = ${sesion_id} AND tipo = 'ingreso'
        `;
        rowCnt = rc[0];
      }

      let numExistentes = Number(rowCnt?.t || 0);
      let sumActual = Number(rowCnt?.sum_abono || 0);
      const abonoPrevio = Number(rowS.abono || 0);

      if (numExistentes === 0 && abonoPrevio > 0) {
        const fechaIni = rowS.fecha_sesion || new Date().toISOString().split('T')[0];
        const metodoIni = rowS.metodo_pago || 'efectivo';
        const conceptoIni = `Abono #1 sesión – ${formatDMY(fechaIni)}`;
        const notasIni = 'Abono inicial registrado con la sesión';
        await sql`
          INSERT INTO ingresos (sesion_id, factura_id, cliente_id, concepto, monto, tipo, metodo_pago, fecha, notas)
          VALUES (${sesion_id}, ${facId}, ${cliente_id}, ${conceptoIni}, ${abonoPrevio}, 'ingreso', ${metodoIni}, ${fechaIni}, ${notasIni})
        `;
        numExistentes = 1;
        sumActual = abonoPrevio;
      }

      if (totalS > 0) {
        const saldoPendiente = Math.max(0, totalS - sumActual);
        if (monto > saldoPendiente + 0.01) {
          return NextResponse.json(
            {
              error: `El abono supera el saldo pendiente de la sesión ($${saldoPendiente.toLocaleString('es-CO')}). Si el cliente adquirió adicionales, agrégalos primero a la sesión.`,
            },
            { status: 400 }
          );
        }
      }

      const numAbono = numExistentes + 1;
      const concepto = `Abono #${numAbono} sesión – ${formatDMY(fecha_abono)}`;

      await sql`
        INSERT INTO ingresos (sesion_id, factura_id, cliente_id, concepto, monto, tipo, metodo_pago, fecha, notas)
        VALUES (${sesion_id}, ${facId}, ${cliente_id}, ${concepto}, ${monto}, 'ingreso', ${metodo_pago}, ${fecha_abono}, ${notas_abono})
      `;

      const nuevoAbonoTotal = sumActual + monto;
      const nuevoEstado =
        totalS > 0 && nuevoAbonoTotal >= totalS
          ? 'pagado'
          : totalS === 0 && nuevoAbonoTotal > 0
          ? 'reserva'
          : nuevoAbonoTotal > 0
          ? 'abonado'
          : 'pendiente';

      await sql`
        UPDATE sesiones
        SET abono = ${nuevoAbonoTotal}, estado_pago = ${nuevoEstado}, metodo_pago = ${metodo_pago}
        WHERE id = ${sesion_id}
      `;

      if (facId) {
        const estFac =
          totalS > 0 && nuevoAbonoTotal >= totalS
            ? 'pagada'
            : nuevoAbonoTotal > 0
            ? 'abonada'
            : 'pendiente';
        await sql`
          UPDATE facturas
          SET abono = ${nuevoAbonoTotal}, estado = ${estFac}, metodo_pago = ${metodo_pago}
          WHERE id = ${facId}
        `;
      }

      return NextResponse.json({
        ok: true,
        mensaje: `Abono #${numAbono} registrado correctamente.`,
      });
    }

    // 4. Eliminar abono individual
    if (accion === 'eliminar_abono_sesion') {
      const abono_id = parseInt(body.abono_id || '0', 10);
      const sesion_id = parseInt(body.sesion_id || '0', 10);

      if (!abono_id || !sesion_id) {
        return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 });
      }

      await sql`DELETE FROM ingresos WHERE id = ${abono_id}`;

      const rS = await sql`
        SELECT s.total, f.id AS factura_id
        FROM sesiones s
        LEFT JOIN facturas f ON f.sesion_id = s.id
        WHERE s.id = ${sesion_id}
        LIMIT 1
      `;
      if (rS.length > 0) {
        const totalS = Number(rS[0].total || 0);
        const facId = rS[0].factura_id ? Number(rS[0].factura_id) : null;

        let rSum;
        if (facId) {
          rSum = await sql`
            SELECT COALESCE(SUM(monto),0)::numeric AS sum_abono
            FROM ingresos
            WHERE (sesion_id = ${sesion_id} OR factura_id = ${facId}) AND tipo = 'ingreso'
          `;
        } else {
          rSum = await sql`
            SELECT COALESCE(SUM(monto),0)::numeric AS sum_abono
            FROM ingresos
            WHERE sesion_id = ${sesion_id} AND tipo = 'ingreso'
          `;
        }
        const nuevoAbonoTotal = Number(rSum[0]?.sum_abono || 0);
        const nuevoEstado =
          totalS > 0 && nuevoAbonoTotal >= totalS
            ? 'pagado'
            : totalS === 0 && nuevoAbonoTotal > 0
            ? 'reserva'
            : nuevoAbonoTotal > 0
            ? 'abonado'
            : 'pendiente';

        await sql`
          UPDATE sesiones
          SET abono = ${nuevoAbonoTotal}, estado_pago = ${nuevoEstado}
          WHERE id = ${sesion_id}
        `;

        if (facId) {
          const estFac =
            totalS > 0 && nuevoAbonoTotal >= totalS
              ? 'pagada'
              : nuevoAbonoTotal > 0
              ? 'abonada'
              : 'pendiente';
          await sql`
            UPDATE facturas
            SET abono = ${nuevoAbonoTotal}, estado = ${estFac}
            WHERE id = ${facId}
          `;
        }
      }

      return NextResponse.json({
        ok: true,
        mensaje: 'Abono eliminado y saldos recalculados correctamente.',
      });
    }

    // 5. Eliminar sesión con sincronización contable
    if (accion === 'eliminar') {
      const id = parseInt(body.id || '0', 10);
      const modo = body.modo_eliminacion || 'total';

      if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

      const rS = await sql`
        SELECT s.cliente_id, s.fecha_sesion::text AS fecha_sesion, f.id AS factura_id
        FROM sesiones s
        LEFT JOIN facturas f ON f.sesion_id = s.id
        WHERE s.id = ${id}
        LIMIT 1
      `;

      if (rS.length > 0) {
        const facId = rS[0].factura_id ? Number(rS[0].factura_id) : null;
        if (facId) {
          await sql`DELETE FROM ingresos WHERE sesion_id = ${id} OR factura_id = ${facId}`;
          if (modo === 'anular_factura') {
            const notaCancel = `\n[Sesión eliminada el ${formatDMY(new Date().toISOString())}]`;
            await sql`
              UPDATE facturas
              SET estado = 'cancelada',
                  abono = 0,
                  sesion_id = NULL,
                  notas = COALESCE(notas, '') || ${notaCancel}
              WHERE id = ${facId}
            `;
          } else {
            await sql`DELETE FROM facturas WHERE id = ${facId}`;
          }
        } else {
          await sql`DELETE FROM ingresos WHERE sesion_id = ${id}`;
        }
      }

      await sql`DELETE FROM sesion_productos WHERE sesion_id = ${id}`;
      await sql`DELETE FROM sesion_fotos WHERE sesion_id = ${id}`;
      await sql`DELETE FROM sesiones WHERE id = ${id}`;

      return NextResponse.json({
        ok: true,
        mensaje:
          modo === 'anular_factura'
            ? 'Sesión eliminada. La factura quedó marcada como cancelada y los ingresos fueron retirados del balance.'
            : 'Sesión, factura e ingresos asociados eliminados correctamente.',
      });
    }

    return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

