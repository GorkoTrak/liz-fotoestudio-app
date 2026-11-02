'use client';

import { useState, useEffect, useRef, useCallback, use, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { formatoPeso, formatoFecha, formatoHora } from '@/lib/formatters';

const estadoColor = {
  pagada: '#2a9d73',
  abonada: '#b07a30',
  pendiente: '#c4547a',
  cancelada: '#a899b5',
};

const estadoBg = {
  pagada: '#e8f8f4',
  abonada: '#fff4e0',
  pendiente: '#fce8f0',
  cancelada: '#e8eaf6',
};

const estadoLabel = {
  pagada: 'PAGADA',
  abonada: 'ABONADA',
  pendiente: 'PENDIENTE',
  cancelada: 'CANCELADA',
};

const metodosLabel = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  nequi: 'Nequi',
  daviplata: 'Daviplata',
  tarjeta: 'Tarjeta',
};

function crearLogoCircular(src) {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(src);
      return;
    }
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const size = 160;
        const c = document.createElement('canvas');
        c.width = size;
        c.height = size;
        const ctx = c.getContext('2d');
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        resolve(c.toDataURL('image/png'));
      } catch {
        resolve(src);
      }
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}

function FacturaPdfContent({ id }) {
  const searchParams = useSearchParams();
  const embedMode = searchParams.get('ver') === '1';

  const [data, setData] = useState(null);
  const [logoSrc, setLogoSrc] = useState('/uploads/perfiles/logo.jpg');
  const [logoReady, setLogoReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [avisoWA, setAvisoWA] = useState(null);
  const [descargando, setDescargando] = useState(false);

  const sheetRef = useRef(null);
  const pdfPromiseRef = useRef(null);
  const pdfFileRef = useRef(null);

  useEffect(() => {
    crearLogoCircular('/uploads/perfiles/logo.jpg').then((dataUrl) => {
      setLogoSrc(dataUrl);
      setLogoReady(true);
    });
  }, []);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/facturas?id=${id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) {
          setError(json.error);
        } else {
          setData(json);
        }
      })
      .catch(() => setError('Error al cargar la factura'))
      .finally(() => setLoading(false));
  }, [id]);

  // Generar el archivo PDF exactamente igual al diseño HTML (.page-sheet)
  const construirArchivoPdf = useCallback(async () => {
    if (pdfFileRef.current) return pdfFileRef.current;
    if (pdfPromiseRef.current) return pdfPromiseRef.current;

    const promise = (async () => {
      if (!sheetRef.current || !data?.factura) return null;
      try {
        const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
          import('html2canvas'),
          import('jspdf'),
        ]);

        const canvas = await html2canvas(sheetRef.current, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
          windowWidth: 900,
          onclone: (clonedDoc) => {
            const el = clonedDoc.querySelector('.page-sheet');
            if (el) {
              el.style.borderRadius = '0px';
              el.style.boxShadow = 'none';
              el.style.width = '794px';
              el.style.maxWidth = '794px';
              el.style.margin = '0';
            }
          },
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.96);
        const pdfW = 210;
        const pdfH = Math.max(100, Math.round(((canvas.height * pdfW) / canvas.width) * 10) / 10);

        const doc = new jsPDF({
          orientation: pdfH >= pdfW ? 'p' : 'l',
          unit: 'mm',
          format: [pdfW, pdfH],
        });
        doc.addImage(imgData, 'JPEG', 0, 0, pdfW, pdfH);

        const fObj = data.factura;
        const nombreArchivo = `Factura_${String(fObj.numero_factura || id).replace(
          /[^A-Za-z0-9\-]/g,
          '_'
        )}.pdf`;
        const blob = doc.output('blob');
        const file = new File([blob], nombreArchivo, { type: 'application/pdf' });
        pdfFileRef.current = file;

        if (typeof window !== 'undefined') {
          window.__facturaPdfFile = file;
          if (window.parent && window.parent !== window) {
            try {
              window.parent.postMessage({ type: 'FACTURA_PDF_READY', facturaId: Number(id) }, '*');
            } catch {
              // continuar
            }
          }
        }
        return file;
      } catch (err) {
        console.error('Error generando PDF visual:', err);
        return null;
      }
    })();

    pdfPromiseRef.current = promise;
    return promise;
  }, [data, id]);

  // Pre-generar el PDF apenas se renderiza la hoja y el logo circular
  useEffect(() => {
    if (!loading && data?.factura && logoReady && sheetRef.current) {
      const timer = setTimeout(() => {
        construirArchivoPdf();
      }, 120);
      if (typeof window !== 'undefined') {
        window.__obtenerFacturaPdf = construirArchivoPdf;
      }
      return () => clearTimeout(timer);
    }
  }, [loading, data, logoReady, construirArchivoPdf]);

  const handleDescargarPdf = async () => {
    if (!data?.factura) return;
    setDescargando(true);
    try {
      const archivo = pdfFileRef.current || (await construirArchivoPdf());
      const fObj = data.factura;
      const nombreArchivo = `Factura_${String(fObj.numero_factura || id).replace(
        /[^A-Za-z0-9\-]/g,
        '_'
      )}.pdf`;

      if (archivo) {
        const url = URL.createObjectURL(archivo);
        const a = document.createElement('a');
        a.href = url;
        a.download = nombreArchivo;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      } else {
        window.location.href = `/api/facturas/${id}/pdf`;
      }
    } finally {
      setDescargando(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'Nunito, sans-serif' }}>
        Generando factura...
      </div>
    );
  }

  if (error || !data?.factura) {
    return (
      <div
        style={{
          padding: '40px',
          textAlign: 'center',
          fontFamily: 'Nunito, sans-serif',
          color: '#c4547a',
        }}
      >
        {error || 'Factura no encontrada'}
      </div>
    );
  }

  const f = data.factura;
  const adicionales = data.adicionales || [];
  let pagosList = data.pagos || [];

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

  const eColor = estadoColor[f.estado] || '#6b5e7a';
  const eBg = estadoBg[f.estado] || '#faf8f6';
  const eLabel = estadoLabel[f.estado] || String(f.estado || '').toUpperCase();
  const metodo = metodosLabel[f.metodo_pago] || f.metodo_pago;
  const saldo = f.saldo !== undefined ? Number(f.saldo) : Number(f.total) - Number(f.abono);

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
      categoria: f.servicio_categoria || 'Paquete de Sesión',
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
      nombre: 'Servicio Fotográfico Profesional',
      categoria: 'Servicio',
      cantidad: 1,
      precio: Number(f.total),
      subtotal: Number(f.total),
    });
  }

  const totalPagos = pagosList.reduce((acc, p) => acc + Number(p.monto), 0);

  return (
    <div className="pdf-root">
      <style jsx>{`
        .pdf-root {
          background: ${embedMode ? '#fff' : '#f2edf4'};
          min-height: 100vh;
          padding: ${embedMode ? '0' : '24px 16px'};
          font-family: 'Nunito', Arial, sans-serif;
          color: #1e1e2e;
        }
        .toolbar {
          max-width: 794px;
          margin: 0 auto 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #1a1f3c;
          padding: 12px 20px;
          border-radius: 12px;
          color: #fff;
        }
        .page-sheet {
          max-width: 794px;
          margin: 0 auto;
          background: #fff;
          box-shadow: ${embedMode ? 'none' : '0 8px 30px rgba(26,31,60,.15)'};
          border-radius: ${embedMode ? '0' : '12px'};
          overflow: hidden;
        }
        table {
          border-collapse: collapse;
          width: 100%;
        }
        .header {
          background: #1a1f3c;
        }
        .header td {
          padding: 26px 32px 22px;
          vertical-align: middle;
        }
        .logo-img {
          width: 66px;
          height: 66px;
          border-radius: 50%;
          object-fit: cover;
          display: block;
        }
        .brand-name {
          font-size: 19px;
          font-weight: 700;
          color: #ffffff;
        }
        .brand-tagline {
          font-size: 9px;
          color: #9ddbd8;
          letter-spacing: 2px;
          text-transform: uppercase;
          font-weight: 700;
          margin-top: 2px;
        }
        .factura-label {
          font-size: 9px;
          color: #a899b5;
          text-transform: uppercase;
          letter-spacing: 2px;
          font-weight: 700;
        }
        .factura-num {
          font-size: 24px;
          font-weight: 700;
          color: #ffffff;
        }
        .factura-fecha {
          font-size: 10px;
          color: #9ddbd8;
          margin-top: 3px;
        }
        .estado {
          background: ${eBg};
          border-bottom: 2px solid ${eColor};
        }
        .estado td {
          padding: 9px 32px;
          vertical-align: middle;
          font-size: 11px;
          color: #6b5e7a;
        }
        .estado-pill {
          background: ${eColor};
          color: #ffffff;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 1.5px;
          padding: 3px 12px;
          border-radius: 10px;
        }
        .body-wrap {
          padding: 24px 32px 20px;
        }
        .sec-label {
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: #a899b5;
          padding-bottom: 5px;
          margin-bottom: 8px;
          border-bottom: 1px solid #f0e8f0;
        }
        .box {
          border: 1px solid #ede0ea;
          border-radius: 8px;
          background: #fdfbfd;
          padding: 12px 16px;
        }
        .box-rose {
          border-top: 3px solid #e8789a;
        }
        .box-lav {
          border-top: 3px solid #9e8bc9;
        }
        .box-title {
          font-size: 14px;
          font-weight: 700;
          color: #1a1f3c;
          margin-bottom: 6px;
        }
        .datos td.key {
          width: 78px;
          padding: 2px 0;
          font-size: 9px;
          color: #a899b5;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .datos td.val {
          padding: 2px 0;
          font-size: 11px;
          color: #2a2040;
          font-weight: 600;
        }
        .items-table,
        .pagos-table {
          margin-bottom: 20px;
        }
        .items-table th,
        .pagos-table th {
          background: #1a1f3c;
          color: #f5b8ce;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          padding: 8px 12px;
          text-align: left;
        }
        .items-table td,
        .pagos-table td {
          padding: 8px 12px;
          font-size: 11px;
          color: #4a3d5a;
          border-bottom: 1px solid #f0e8f4;
        }
        .alt td {
          background: #fdf5f8;
        }
        .cat-pill {
          display: inline-block;
          background: #f0ecfb;
          color: #9e8bc9;
          font-size: 8.5px;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: 4px;
          text-transform: uppercase;
        }
        .resumen td {
          padding: 7px 14px;
          font-size: 11.5px;
        }
        .resumen tr.total td {
          background: #1a1f3c;
          color: #ffffff;
          font-size: 12px;
          padding: 10px 14px;
        }
        .resumen tr.total td.rv {
          color: #f5b8ce;
          font-size: 17px;
          font-weight: 700;
          text-align: right;
        }
        .resumen tr.saldo td {
          background: #fce8f0;
          color: #c4547a;
          font-weight: 700;
        }
        .resumen tr.pagada td {
          background: #e8f8f4;
          color: #2a9d73;
          font-weight: 700;
          text-align: center;
        }
        .footer {
          background: #1a1f3c;
        }
        .footer td {
          padding: 13px 32px;
          vertical-align: middle;
        }
        @media print {
          .toolbar {
            display: none !important;
          }
          .pdf-root {
            background: #fff !important;
            padding: 0 !important;
          }
          .page-sheet {
            box-shadow: none !important;
            border-radius: 0 !important;
          }
        }
      `}</style>

      {!embedMode && (
        <div
          className="toolbar"
          style={{ flexDirection: 'column', gap: '10px', alignItems: 'stretch' }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '13px' }}>
              Vista de Factura: <span style={{ color: '#f5b8ce' }}>{f.numero_factura}</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.25)' }}
                onClick={handleDescargarPdf}
                disabled={descargando}
              >
                {descargando ? '⏳ Generando PDF...' : '⬇ Descargar PDF'}
              </button>
              <button
                type="button"
                className="btn btn-sm"
                style={{
                  background: 'linear-gradient(135deg, #25d366, #128c7e)',
                  color: '#fff',
                }}
                onClick={async () => {
                  const telCliente = String(f.telefono || '').trim();
                  if (telCliente && navigator.clipboard?.writeText) {
                    try {
                      await navigator.clipboard.writeText(telCliente);
                    } catch {
                      // continuar
                    }
                  }
                  const archivo = pdfFileRef.current || (await construirArchivoPdf());
                  if (
                    !archivo ||
                    !navigator.canShare ||
                    !navigator.canShare({ files: [archivo] })
                  ) {
                    setAvisoWA({
                      tipo: 'warn',
                      texto: `⚠️ Este navegador no permite compartir archivos directamente. El número (${telCliente || 'cliente'}) fue copiado al portapapeles. Usa ⬇ Descargar PDF.`,
                    });
                    return;
                  }
                  const lineas = [
                    `Hola ${f.nombre || ''}, te saludamos de *Liz Fotografía* 📸`,
                    '',
                    `Te compartimos la factura *${f.numero_factura || ''}* de tu sesión${
                      f.fecha_sesion ? ` del ${formatoFecha(f.fecha_sesion)}` : ''
                    }.`,
                    '',
                    `*Servicio:* ${f.servicio || 'Por definir'}`,
                    `*Total:* ${formatoPeso(f.total)}`,
                    `*Abono:* ${formatoPeso(f.abono)}`,
                    `*Saldo pendiente:* ${formatoPeso(saldo)}`,
                    `*Estado:* ${eLabel}`,
                    '',
                    'Adjuntamos el PDF de la factura. ¡Gracias por tu preferencia! 💖',
                  ];
                  try {
                    await navigator.share({
                      files: [archivo],
                      title: `Factura ${f.numero_factura}`,
                      text: lineas.join('\n'),
                    });
                    setAvisoWA({
                      tipo: 'ok',
                      texto: `✅ Factura compartida. Número (${telCliente || 'cliente'}) copiado: solo pégalo en el buscador de WhatsApp con Ctrl + V.`,
                    });
                  } catch (e) {
                    if (e && e.name === 'AbortError') return;
                    setAvisoWA({
                      tipo: 'warn',
                      texto: `⚠️ No se pudo abrir el panel de compartir. Usa ⬇ Descargar PDF.`,
                    });
                  }
                }}
              >
                📱 Enviar por WhatsApp
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => window.print()}>
                🖨️ Imprimir
              </button>
            </div>
          </div>
          {avisoWA && (
            <div
              style={{
                background: avisoWA.tipo === 'warn' ? '#fef3e2' : '#e0f5f4',
                color: avisoWA.tipo === 'warn' ? '#9a5b12' : '#1a1f3c',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 700,
              }}
            >
              {avisoWA.texto}
            </div>
          )}
        </div>
      )}

      <div className="page-sheet" ref={sheetRef}>
        <table className="header">
          <tbody>
            <tr>
              <td style={{ width: '60%' }}>
                <table>
                  <tbody>
                    <tr>
                      <td style={{ padding: 0, width: '70px' }}>
                        <img src={logoSrc} className="logo-img" alt="Logo" />
                      </td>
                      <td style={{ padding: '0 0 0 16px' }}>
                        <div className="brand-name">Lizdy Pineda Fotoestudio</div>
                        <div className="brand-tagline">Fotoestudio Profesional</div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
              <td style={{ textAlign: 'right' }}>
                <div className="factura-label">Factura</div>
                <div className="factura-num">{f.numero_factura}</div>
                <div className="factura-fecha">Emitida el {formatoFecha(f.fecha_emision)}</div>
              </td>
            </tr>
          </tbody>
        </table>

        <table className="estado">
          <tbody>
            <tr>
              <td>
                <span className="estado-pill">{eLabel}</span>
                &nbsp;&nbsp;Método: <strong style={{ color: '#1a1f3c' }}>{metodo}</strong>
              </td>
              <td style={{ textAlign: 'right' }}>
                {f.fecha_vencimiento && (
                  <>
                    Vence:{' '}
                    <strong style={{ color: '#1a1f3c' }}>
                      {formatoFecha(f.fecha_vencimiento)}
                    </strong>
                  </>
                )}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="body-wrap">
          <table style={{ marginBottom: '22px' }}>
            <tbody>
              <tr>
                <td style={{ width: '50%', verticalAlign: 'top', paddingRight: '9px' }}>
                  <div className="sec-label">Facturado a</div>
                  <div className="box box-rose">
                    <div className="box-title">
                      {f.nombre} {f.apellido}
                    </div>
                    <table className="datos">
                      <tbody>
                        {f.telefono && (
                          <tr>
                            <td className="key">Teléfono</td>
                            <td className="val">{f.telefono}</td>
                          </tr>
                        )}
                        {f.email && (
                          <tr>
                            <td className="key">Email</td>
                            <td className="val">{f.email}</td>
                          </tr>
                        )}
                        {!f.telefono && !f.email && (
                          <tr>
                            <td className="key">Contacto</td>
                            <td className="val">Sin datos de contacto</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </td>
                <td style={{ width: '50%', verticalAlign: 'top', paddingLeft: '9px' }}>
                  <div className="sec-label">Sesión</div>
                  <div className="box box-lav">
                    <table className="datos">
                      <tbody>
                        <tr>
                          <td className="key">Servicio</td>
                          <td className="val">{f.servicio || 'Sin servicio específico'}</td>
                        </tr>
                        <tr>
                          <td className="key">Fecha</td>
                          <td className="val">
                            {f.fecha_sesion ? formatoFecha(f.fecha_sesion) : '—'}
                          </td>
                        </tr>
                        {f.hora_sesion && (
                          <tr>
                            <td className="key">Hora</td>
                            <td className="val">{formatoHora(f.hora_sesion)}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <div className="sec-label">
            Paquetes y adicionales adquiridos ({itemsList.length})
          </div>
          <table className="items-table">
            <thead>
              <tr>
                <th style={{ width: '30px', textAlign: 'center' }}>#</th>
                <th>Descripción</th>
                <th>Categoría</th>
                <th style={{ width: '50px', textAlign: 'center' }}>Cant.</th>
                <th style={{ width: '90px', textAlign: 'right' }}>Precio unit.</th>
                <th style={{ width: '90px', textAlign: 'right' }}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {itemsList.map((it, idx) => (
                <tr key={idx} className={idx % 2 ? 'alt' : ''}>
                  <td style={{ textAlign: 'center', fontWeight: 700, color: '#3a9994' }}>
                    {idx + 1}
                  </td>
                  <td>
                    <div style={{ fontWeight: 700, color: '#1a1f3c' }}>{it.nombre}</div>
                  </td>
                  <td>
                    <span className="cat-pill">{it.categoria}</span>
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 600 }}>{it.cantidad}</td>
                  <td style={{ textAlign: 'right', color: '#6b5e7a' }}>
                    {formatoPeso(it.precio)}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#1a1f3c' }}>
                    {formatoPeso(it.subtotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="sec-label">Historial de abonos ({pagosList.length})</div>
          <table className="pagos-table">
            <thead>
              <tr>
                <th style={{ width: '30px', textAlign: 'center' }}>#</th>
                <th>Fecha</th>
                <th>Método</th>
                <th>Concepto</th>
                <th style={{ textAlign: 'right' }}>Monto</th>
              </tr>
            </thead>
            <tbody>
              {pagosList.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    style={{
                      textAlign: 'center',
                      color: '#a899b5',
                      fontStyle: 'italic',
                      padding: '14px',
                    }}
                  >
                    Aún no se han registrado abonos para esta factura.
                  </td>
                </tr>
              ) : (
                <>
                  {pagosList.map((p, idx) => (
                    <tr key={idx} className={idx % 2 ? 'alt' : ''}>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#3a9994' }}>
                        {idx + 1}
                      </td>
                      <td>{formatoFecha(p.fecha)}</td>
                      <td>{metodosLabel[p.metodo_pago] || p.metodo_pago}</td>
                      <td style={{ color: '#6b5e7a' }}>{p.concepto}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#3a9994' }}>
                        {formatoPeso(p.monto)}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ background: '#e0f5f4', fontWeight: 700, color: '#1a1f3c' }}>
                    <td colSpan={4}>Total abonado</td>
                    <td style={{ textAlign: 'right', color: '#3a9994' }}>
                      {formatoPeso(totalPagos)}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>

          <table style={{ marginTop: '18px' }}>
            <tbody>
              <tr>
                <td style={{ width: '50%' }} />
                <td style={{ width: '50%' }}>
                  <div className="sec-label">Resumen</div>
                  <table className="resumen">
                    <tbody>
                      <tr className="total">
                        <td style={{ color: '#fff' }}>Total factura</td>
                        <td className="rv">{formatoPeso(f.total)}</td>
                      </tr>
                      <tr>
                        <td style={{ color: '#6b5e7a' }}>Abonado</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#2a9d73' }}>
                          {formatoPeso(f.abono)}
                        </td>
                      </tr>
                      {saldo > 0 ? (
                        <tr className="saldo">
                          <td>Saldo pendiente</td>
                          <td style={{ textAlign: 'right' }}>{formatoPeso(saldo)}</td>
                        </tr>
                      ) : (
                        <tr className="pagada">
                          <td colSpan={2}>Completamente pagada</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>

          {f.notas && (
            <div
              style={{
                marginTop: '20px',
                borderLeft: '3px solid #e8789a',
                background: '#fdf5f8',
                padding: '10px 14px',
                fontSize: '11px',
                color: '#6b5e7a',
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  color: '#c4547a',
                  fontSize: '9px',
                  textTransform: 'uppercase',
                  letterSpacing: '1.5px',
                  marginBottom: '4px',
                }}
              >
                Notas
              </div>
              {f.notas}
            </div>
          )}
        </div>

        <table className="footer">
          <tbody>
            <tr>
              <td>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#f5b8ce' }}>
                  Lizdy Pineda Fotoestudio
                </div>
                <div style={{ fontSize: '9px', color: '#8a8fb0', marginTop: '2px' }}>
                  Gracias por confiar en nosotros
                </div>
              </td>
              <td style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '10px', color: '#b0b4cc' }}>{f.numero_factura}</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function FacturaPdfPage({ params }) {
  const resolvedParams = use(params);
  const id = resolvedParams?.id;
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>Cargando factura...</div>}>
      <FacturaPdfContent id={id} />
    </Suspense>
  );
}
