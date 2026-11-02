import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { jsPDF } from 'jspdf';
import { getDB } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { formatoPeso, formatoFecha, formatoHora } from '@/lib/formatters';

const ESTADO_COLOR = {
  pagada: [42, 157, 115],
  abonada: [176, 122, 48],
  pendiente: [196, 84, 122],
  cancelada: [168, 153, 181],
};

const ESTADO_BG = {
  pagada: [232, 248, 244],
  abonada: [255, 244, 224],
  pendiente: [252, 232, 240],
  cancelada: [232, 234, 246],
};

const METODOS_LABEL = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  nequi: 'Nequi',
  daviplata: 'Daviplata',
  tarjeta: 'Tarjeta',
};

export async function GET(request, context) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const resolvedParams = await context.params;
    const id = parseInt(resolvedParams?.id || '0', 10);
    if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    const { searchParams } = new URL(request.url);
    const inline = searchParams.get('ver') === '1';

    const sql = getDB();
    const fRows = await sql`
      SELECT f.*,
             f.fecha_emision::text AS fecha_emision,
             f.fecha_vencimiento::text AS fecha_vencimiento,
             cl.nombre, cl.apellido, cl.telefono, cl.email,
             s.fecha_sesion::text AS fecha_sesion, s.hora_sesion::text AS hora_sesion,
             p.nombre AS servicio, p.precio AS servicio_precio, p.categoria AS servicio_categoria
      FROM facturas f
      JOIN clientes cl ON f.cliente_id = cl.id
      LEFT JOIN sesiones s ON f.sesion_id = s.id
      LEFT JOIN productos p ON s.producto_id = p.id
      WHERE f.id = ${id}
      LIMIT 1
    `;

    if (fRows.length === 0) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });
    }

    const f = fRows[0];
    const sesionId = Number(f.sesion_id || 0);

    let pagosList = [];
    if (sesionId > 0) {
      pagosList = await sql`
        SELECT monto, metodo_pago, fecha::text AS fecha, concepto
        FROM ingresos
        WHERE tipo = 'ingreso' AND (factura_id = ${id} OR sesion_id = ${sesionId})
        ORDER BY fecha ASC, id ASC
      `;
    } else {
      pagosList = await sql`
        SELECT monto, metodo_pago, fecha::text AS fecha, concepto
        FROM ingresos
        WHERE tipo = 'ingreso' AND factura_id = ${id}
        ORDER BY fecha ASC, id ASC
      `;
    }

    if (pagosList.length === 0 && Number(f.abono) > 0) {
      pagosList = [
        {
          monto: f.abono,
          metodo_pago: f.metodo_pago,
          fecha: f.fecha_sesion || f.fecha_emision,
          concepto: 'Abono registrado con la sesión',
        },
      ];
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

    const sumaAdicionales = adicionales.reduce(
      (acc, ad) => acc + Number(ad.precio) * Math.max(1, Number(ad.cantidad)),
      0
    );

    const itemsList = [];
    if (f.servicio) {
      const precioBase = f.servicio_precio
        ? Number(f.servicio_precio)
        : Math.max(0, Number(f.total) - sumaAdicionales);
      itemsList.push({
        nombre: `Paquete ${f.servicio}`,
        categoria: f.servicio_categoria || 'Paquete de Sesion',
        cantidad: 1,
        precio: precioBase,
        subtotal: precioBase,
      });
    }

    adicionales.forEach((ad) => {
      const qty = Math.max(1, Number(ad.cantidad));
      const prc = Number(ad.precio);
      itemsList.push({
        nombre: ad.nombre,
        categoria: ad.categoria || 'Foto / Adicional',
        cantidad: qty,
        precio: prc,
        subtotal: qty * prc,
      });
    });

    if (itemsList.length === 0) {
      itemsList.push({
        nombre: 'Servicio Fotografico Profesional',
        categoria: 'Servicio',
        cantidad: 1,
        precio: Number(f.total),
        subtotal: Number(f.total),
      });
    }

    // ─── Construir PDF A4 con jsPDF (210mm x 297mm) ───
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = 210;
    const pageH = 297;
    const marginX = 14;
    const contentW = pageW - marginX * 2;

    // 1. Cabecera Navy (#1a1f3c)
    doc.setFillColor(26, 31, 60);
    doc.rect(0, 0, pageW, 34, 'F');

    // Logo
    const logoPath = path.join(process.cwd(), 'public', 'uploads', 'perfiles', 'logo_header.jpg');
    let logoLoaded = false;
    if (fs.existsSync(/*turbopackIgnore: true*/ logoPath)) {
      try {
        const base64Logo = fs.readFileSync(/*turbopackIgnore: true*/ logoPath).toString('base64');
        doc.addImage(`data:image/jpeg;base64,${base64Logo}`, 'JPEG', marginX, 6, 22, 22);
        logoLoaded = true;
      } catch {
        // continuar si falla lectura de imagen
      }
    }
    if (!logoLoaded) {
      doc.setFillColor(245, 184, 206);
      doc.circle(marginX + 11, 17, 11, 'F');
      doc.setTextColor(26, 31, 60);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('L', marginX + 11, 19.5, { align: 'center' });
    }

    // Nombre de marca
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('Lizdy Pineda Fotoestudio', marginX + 27, 16);

    doc.setTextColor(157, 219, 216);
    doc.setFontSize(7.5);
    doc.text('FOTOESTUDIO PROFESIONAL', marginX + 27, 21);

    // Datos de Factura a la derecha
    doc.setTextColor(168, 153, 181);
    doc.setFontSize(7.5);
    doc.text('FACTURA', pageW - marginX, 11, { align: 'right' });

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(17);
    doc.text(String(f.numero_factura || ''), pageW - marginX, 19, { align: 'right' });

    doc.setTextColor(157, 219, 216);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Emitida el ${formatoFecha(f.fecha_emision)}`, pageW - marginX, 25, { align: 'right' });

    // 2. Barra de Estado
    const eColor = ESTADO_COLOR[f.estado] || [107, 94, 122];
    const eBg = ESTADO_BG[f.estado] || [250, 248, 246];
    const eLabel = String(f.estado || 'pendiente').toUpperCase();
    const metodo = METODOS_LABEL[f.metodo_pago] || String(f.metodo_pago || 'Efectivo');

    doc.setFillColor(...eBg);
    doc.rect(0, 34, pageW, 10, 'F');
    doc.setDrawColor(...eColor);
    doc.setLineWidth(0.6);
    doc.line(0, 44, pageW, 44);

    // Píldora de estado
    doc.setFillColor(...eColor);
    doc.roundedRect(marginX, 36.2, 24, 5.5, 2.5, 2.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text(eLabel, marginX + 12, 39.9, { align: 'center' });

    doc.setTextColor(107, 94, 122);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(`Metodo: `, marginX + 28, 40.2);
    doc.setTextColor(26, 31, 60);
    doc.setFont('helvetica', 'bold');
    doc.text(metodo, marginX + 41, 40.2);

    if (f.fecha_vencimiento) {
      doc.setTextColor(107, 94, 122);
      doc.setFont('helvetica', 'normal');
      doc.text(`Vence: ${formatoFecha(f.fecha_vencimiento)}`, pageW - marginX, 40.2, { align: 'right' });
    }

    // 3. Cajas de Cliente y Sesión
    let y = 52;
    const colW = (contentW - 6) / 2;

    doc.setTextColor(168, 153, 181);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('FACTURADO A', marginX, y);
    doc.text('SESION', marginX + colW + 6, y);

    y += 3;
    // Caja Cliente
    doc.setFillColor(253, 251, 253);
    doc.setDrawColor(237, 224, 234);
    doc.setLineWidth(0.3);
    doc.roundedRect(marginX, y, colW, 24, 2, 2, 'FD');
    doc.setFillColor(232, 120, 154);
    doc.rect(marginX, y, colW, 1.2, 'F');

    const nombreCompleto = `${f.nombre || ''} ${f.apellido || ''}`.trim();
    doc.setTextColor(26, 31, 60);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text(nombreCompleto, marginX + 4, y + 7);

    doc.setFontSize(8.5);
    doc.setTextColor(168, 153, 181);
    doc.text('TELEFONO:', marginX + 4, y + 13.5);
    doc.setTextColor(42, 32, 64);
    doc.text(String(f.telefono || 'Sin telefono'), marginX + 25, y + 13.5);

    if (f.email) {
      doc.setTextColor(168, 153, 181);
      doc.text('EMAIL:', marginX + 4, y + 19);
      doc.setTextColor(42, 32, 64);
      doc.text(String(f.email), marginX + 25, y + 19);
    }

    // Caja Sesión
    const xSes = marginX + colW + 6;
    doc.setFillColor(253, 251, 253);
    doc.setDrawColor(237, 224, 234);
    doc.roundedRect(xSes, y, colW, 24, 2, 2, 'FD');
    doc.setFillColor(158, 139, 201);
    doc.rect(xSes, y, colW, 1.2, 'F');

    doc.setFontSize(8.5);
    doc.setTextColor(168, 153, 181);
    doc.text('SERVICIO:', xSes + 4, y + 7.5);
    doc.setTextColor(42, 32, 64);
    doc.text(String(f.servicio || 'Sin servicio especifico').substring(0, 32), xSes + 24, y + 7.5);

    doc.setTextColor(168, 153, 181);
    doc.text('FECHA:', xSes + 4, y + 13.5);
    doc.setTextColor(42, 32, 64);
    doc.text(f.fecha_sesion ? formatoFecha(f.fecha_sesion) : '—', xSes + 24, y + 13.5);

    if (f.hora_sesion) {
      doc.setTextColor(168, 153, 181);
      doc.text('HORA:', xSes + 4, y + 19.5);
      doc.setTextColor(42, 32, 64);
      doc.text(formatoHora(f.hora_sesion), xSes + 24, y + 19.5);
    }

    // 4. Tabla Paquetes y Adicionales
    y += 32;
    doc.setTextColor(168, 153, 181);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(`PAQUETES Y ADICIONALES ADQUIRIDOS (${itemsList.length})`, marginX, y);
    y += 3;

    // Encabezado tabla items
    doc.setFillColor(26, 31, 60);
    doc.rect(marginX, y, contentW, 7.5, 'F');
    doc.setTextColor(245, 184, 206);
    doc.setFontSize(7.5);
    doc.text('#', marginX + 4, y + 5);
    doc.text('DESCRIPCION', marginX + 12, y + 5);
    doc.text('CATEGORIA', marginX + 92, y + 5);
    doc.text('CANT.', marginX + 128, y + 5, { align: 'center' });
    doc.text('PRECIO UNIT.', marginX + 155, y + 5, { align: 'right' });
    doc.text('SUBTOTAL', marginX + contentW - 3, y + 5, { align: 'right' });
    y += 7.5;

    itemsList.forEach((it, idx) => {
      if (idx % 2 === 1) {
        doc.setFillColor(253, 245, 248);
        doc.rect(marginX, y, contentW, 7.5, 'F');
      }
      doc.setDrawColor(240, 232, 244);
      doc.line(marginX, y + 7.5, marginX + contentW, y + 7.5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(58, 153, 148);
      doc.text(String(idx + 1), marginX + 4, y + 5);

      doc.setTextColor(26, 31, 60);
      doc.text(String(it.nombre || '').substring(0, 44), marginX + 12, y + 5);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(158, 139, 201);
      doc.setFontSize(7.5);
      doc.text(String(it.categoria || '').toUpperCase().substring(0, 20), marginX + 92, y + 5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(42, 32, 64);
      doc.text(String(it.cantidad), marginX + 128, y + 5, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(107, 94, 122);
      doc.text(formatoPeso(it.precio), marginX + 155, y + 5, { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(26, 31, 60);
      doc.text(formatoPeso(it.subtotal), marginX + contentW - 3, y + 5, { align: 'right' });
      y += 7.5;
    });

    // 5. Tabla Historial de Abonos
    y += 8;
    doc.setTextColor(168, 153, 181);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(`HISTORIAL DE ABONOS (${pagosList.length})`, marginX, y);
    y += 3;

    doc.setFillColor(26, 31, 60);
    doc.rect(marginX, y, contentW, 7.5, 'F');
    doc.setTextColor(245, 184, 206);
    doc.setFontSize(7.5);
    doc.text('#', marginX + 4, y + 5);
    doc.text('FECHA', marginX + 14, y + 5);
    doc.text('METODO', marginX + 42, y + 5);
    doc.text('CONCEPTO', marginX + 75, y + 5);
    doc.text('MONTO', marginX + contentW - 3, y + 5, { align: 'right' });
    y += 7.5;

    let totalPagos = 0;
    if (pagosList.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.setTextColor(168, 153, 181);
      doc.text('Aun no se han registrado abonos para esta factura.', pageW / 2, y + 5.5, {
        align: 'center',
      });
      y += 8;
    } else {
      pagosList.forEach((p, idx) => {
        totalPagos += Number(p.monto || 0);
        if (idx % 2 === 1) {
          doc.setFillColor(253, 245, 248);
          doc.rect(marginX, y, contentW, 7.2, 'F');
        }
        doc.setDrawColor(240, 232, 244);
        doc.line(marginX, y + 7.2, marginX + contentW, y + 7.2);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(58, 153, 148);
        doc.text(String(idx + 1), marginX + 4, y + 4.8);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(74, 61, 90);
        doc.text(formatoFecha(p.fecha), marginX + 14, y + 4.8);
        doc.text(METODOS_LABEL[p.metodo_pago] || String(p.metodo_pago || ''), marginX + 42, y + 4.8);
        doc.setTextColor(107, 94, 122);
        doc.text(String(p.concepto || '').substring(0, 48), marginX + 75, y + 4.8);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(58, 153, 148);
        doc.text(formatoPeso(p.monto), marginX + contentW - 3, y + 4.8, { align: 'right' });
        y += 7.2;
      });

      // Fila Total Abonado
      doc.setFillColor(224, 245, 244);
      doc.rect(marginX, y, contentW, 8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(26, 31, 60);
      doc.text('Total abonado', marginX + 4, y + 5.3);
      doc.setTextColor(58, 153, 148);
      doc.text(formatoPeso(totalPagos), marginX + contentW - 3, y + 5.3, { align: 'right' });
      y += 8;
    }

    // 6. Resumen Contable a la derecha
    y += 8;
    const resX = marginX + contentW / 2;
    const resW = contentW / 2;
    const saldo = f.saldo !== undefined ? Number(f.saldo) : Number(f.total) - Number(f.abono);

    doc.setTextColor(168, 153, 181);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('RESUMEN', resX, y);
    y += 3;

    // Total Factura
    doc.setFillColor(26, 31, 60);
    doc.rect(resX, y, resW, 9.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9.5);
    doc.text('Total factura', resX + 4, y + 6.2);
    doc.setTextColor(245, 184, 206);
    doc.setFontSize(12);
    doc.text(formatoPeso(f.total), resX + resW - 4, y + 6.4, { align: 'right' });
    y += 9.5;

    // Abonado
    doc.setFillColor(253, 251, 253);
    doc.rect(resX, y, resW, 8, 'F');
    doc.setFontSize(9.5);
    doc.setTextColor(107, 94, 122);
    doc.text('Abonado', resX + 4, y + 5.4);
    doc.setTextColor(42, 157, 115);
    doc.text(formatoPeso(f.abono), resX + resW - 4, y + 5.4, { align: 'right' });
    y += 8;

    // Saldo o Pagada
    if (saldo > 0) {
      doc.setFillColor(252, 232, 240);
      doc.rect(resX, y, resW, 8.5, 'F');
      doc.setTextColor(196, 84, 122);
      doc.setFontSize(9.5);
      doc.text('Saldo pendiente', resX + 4, y + 5.6);
      doc.text(formatoPeso(saldo), resX + resW - 4, y + 5.6, { align: 'right' });
    } else {
      doc.setFillColor(232, 248, 244);
      doc.rect(resX, y, resW, 8.5, 'F');
      doc.setTextColor(42, 157, 115);
      doc.setFontSize(9.5);
      doc.text('Completamente pagada', resX + resW / 2, y + 5.6, { align: 'center' });
    }

    // 7. Pie de página Navy
    doc.setFillColor(26, 31, 60);
    doc.rect(0, pageH - 16, pageW, 16, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(245, 184, 206);
    doc.text('Lizdy Pineda Fotoestudio', marginX, pageH - 9);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(138, 143, 176);
    doc.text('Gracias por confiar en nosotros', marginX, pageH - 4.5);

    doc.setTextColor(176, 180, 204);
    doc.setFontSize(8);
    doc.text(String(f.numero_factura || ''), pageW - marginX, pageH - 9, { align: 'right' });

    const pdfArrayBuffer = doc.output('arraybuffer');
    const safeName = `Factura_${String(f.numero_factura || id).replace(/[^A-Za-z0-9\-]/g, '_')}.pdf`;

    return new NextResponse(pdfArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${safeName}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
