'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { formatoPeso, formatoFecha } from '@/lib/formatters';

function FacturasContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const estadoInicial = searchParams.get('estado') || '';

  const [facturas, setFacturas] = useState([]);
  const [stats, setStats] = useState({ pendientes: 0, saldoPend: 0, pagadas: 0, totalFacturas: 0 });
  const [clientes, setClientes] = useState([]);
  const [sesiones, setSesiones] = useState([]);
  const [estadoFiltro, setEstadoFiltro] = useState(estadoInicial);
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [loading, setLoading] = useState(true);

  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  // Modal Nueva / Editar Factura
  const [modalFacOpen, setModalFacOpen] = useState(false);
  const [formFac, setFormFac] = useState({
    id: 0,
    cliente_id: '',
    sesion_id: '',
    total: 0,
    abono: 0,
    metodo_pago: 'efectivo',
    estado: 'pendiente',
    fecha_vencimiento: '',
    notas: '',
  });

  // Modal Registrar Pago
  const [modalPagoOpen, setModalPagoOpen] = useState(false);
  const [pagoData, setPagoData] = useState({
    id: 0,
    numero: '',
    saldo: 0,
    monto: '',
    metodo_pago: 'efectivo',
  });

  // Modal Vista PDF + Enviar por WhatsApp
  const [modalVerFactura, setModalVerFactura] = useState(null);
  const [facAviso, setFacAviso] = useState(null);
  const facIframeRef = useRef(null);
  const pdfPromiseRef = useRef(null);
  const pdfFileRef = useRef(null);

  useEffect(() => {
    const onMessage = (e) => {
      if (e.data && e.data.type === 'FACTURA_PDF_READY') {
        const win = facIframeRef.current?.contentWindow;
        if (win?.__facturaPdfFile) {
          pdfFileRef.current = win.__facturaPdfFile;
        }
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    setFacAviso(null);
    pdfFileRef.current = null;
    pdfPromiseRef.current = null;

    if (!modalVerFactura?.id) return;

    const urlPdf = `/api/facturas/${encodeURIComponent(modalVerFactura.id)}/pdf`;
    const nombreArchivo = `Factura_${String(
      modalVerFactura.numero_factura || modalVerFactura.id
    ).replace(/[^A-Za-z0-9\-]/g, '_')}.pdf`;

    pdfPromiseRef.current = fetch(urlPdf, { credentials: 'same-origin' })
      .then((r) => {
        const tipo = r.headers.get('Content-Type') || '';
        if (!r.ok || !tipo.includes('pdf')) throw new Error('No se pudo obtener el PDF');
        return r.blob();
      })
      .then((b) => {
        const file = new File([b], nombreArchivo, { type: 'application/pdf' });
        if (!pdfFileRef.current) {
          pdfFileRef.current = file;
        }
        return file;
      })
      .catch(() => null);
  }, [modalVerFactura]);

  const obtenerArchivoPdfModal = async () => {
    const win = facIframeRef.current?.contentWindow;
    if (win?.__facturaPdfFile) {
      pdfFileRef.current = win.__facturaPdfFile;
      return win.__facturaPdfFile;
    }
    if (typeof win?.__obtenerFacturaPdf === 'function') {
      const f = await win.__obtenerFacturaPdf();
      if (f) {
        pdfFileRef.current = f;
        return f;
      }
    }
    return pdfFileRef.current || (await pdfPromiseRef.current);
  };

  const descargarFacturaModal = async () => {
    if (!modalVerFactura?.id) return;
    const nombreArchivo = `Factura_${String(
      modalVerFactura.numero_factura || modalVerFactura.id
    ).replace(/[^A-Za-z0-9\-]/g, '_')}.pdf`;
    const archivo = await obtenerArchivoPdfModal();
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
      window.location.href = `/api/facturas/${modalVerFactura.id}/pdf`;
    }
  };

  const enviarFacturaWhatsApp = async () => {
    if (!modalVerFactura?.id) return;

    const telCliente = String(modalVerFactura.telefono || '').trim();
    if (telCliente && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(telCliente);
      } catch {
        // continuar
      }
    }

    const soportaCompartir =
      typeof window !== 'undefined' &&
      window.isSecureContext &&
      typeof navigator.share === 'function' &&
      typeof navigator.canShare === 'function';

    if (!soportaCompartir) {
      setFacAviso({
        tipo: 'warn',
        texto: `⚠️ Este navegador o dirección no permite adjuntar archivos directamente (requiere localhost o https://). El número (${telCliente || 'cliente'}) ya fue copiado al portapapeles. Usa ⬇ Descargar PDF.`,
      });
      return;
    }

    const archivo =
      facIframeRef.current?.contentWindow?.__facturaPdfFile ||
      pdfFileRef.current ||
      (await obtenerArchivoPdfModal());

    if (!archivo || !navigator.canShare({ files: [archivo] })) {
      setFacAviso({
        tipo: 'warn',
        texto: `⚠️ No se pudo preparar el archivo PDF para compartir en este equipo. El número (${telCliente || 'cliente'}) fue copiado. Usa ⬇ Descargar PDF.`,
      });
      return;
    }

    const total = Number(modalVerFactura.total ?? 0);
    const abono = Number(modalVerFactura.abono ?? 0);
    const saldo = Math.max(0, total - abono);
    const estadoFac = String(modalVerFactura.estado || 'pendiente');
    const estadoTexto = estadoFac.charAt(0).toUpperCase() + estadoFac.slice(1);

    const lineas = [
      `Hola ${modalVerFactura.nombre || ''}, te saludamos de *Liz Fotografía* 📸`,
      '',
      `Te compartimos la factura *${modalVerFactura.numero_factura || ''}* de tu sesión${
        modalVerFactura.fecha_sesion ? ` del ${formatoFecha(modalVerFactura.fecha_sesion)}` : ''
      }.`,
      '',
      `*Servicio:* ${modalVerFactura.servicio || 'Por definir'}`,
      `*Total:* ${formatoPeso(total)}`,
      `*Abono:* ${formatoPeso(abono)}`,
      `*Saldo pendiente:* ${formatoPeso(saldo)}`,
      `*Estado:* ${estadoTexto}`,
      '',
      'Adjuntamos el PDF de la factura. ¡Gracias por tu preferencia! 💖',
    ];

    try {
      await navigator.share({
        files: [archivo],
        title: `Factura ${modalVerFactura.numero_factura || ''}`,
        text: lineas.join('\n'),
      });
      setFacAviso({
        tipo: 'ok',
        texto: `✅ Factura compartida. Número (${telCliente || 'cliente'}) copiado: solo pégalo en el buscador de WhatsApp con Ctrl + V.`,
      });
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      setFacAviso({
        tipo: 'warn',
        texto: `⚠️ No se pudo abrir el panel de compartir (${e?.message || 'error'}). Usa ⬇ Descargar PDF.`,
      });
    }
  };

  const cargarFacturas = useCallback(
    async (est, pag) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (est) params.set('estado', est);
        params.set('p', String(pag));

        const res = await fetch(`/api/facturas?${params.toString()}`);
        if (res.status === 401) {
          router.push('/login');
          return;
        }
        const json = await res.json();
        if (res.ok) {
          setFacturas(json.facturas || []);
          setStats(json.stats || { pendientes: 0, saldoPend: 0, pagadas: 0, totalFacturas: 0 });
          setClientes(json.clientes || []);
          setSesiones(json.sesiones || []);
          setTotalPaginas(json.totalPaginas || 1);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    },
    [router]
  );

  useEffect(() => {
    cargarFacturas(estadoFiltro, pagina);
  }, [cargarFacturas, estadoFiltro, pagina]);

  const abrirModalFac = () => {
    setError('');
    setFormFac({
      id: 0,
      cliente_id: '',
      sesion_id: '',
      total: 0,
      abono: 0,
      metodo_pago: 'efectivo',
      estado: 'pendiente',
      fecha_vencimiento: '',
      notas: '',
    });
    setModalFacOpen(true);
  };

  const editarFac = (f) => {
    setError('');
    setFormFac({
      id: f.id,
      cliente_id: f.cliente_id || '',
      sesion_id: f.sesion_id || '',
      total: f.total || 0,
      abono: f.abono || 0,
      metodo_pago: f.metodo_pago || 'efectivo',
      estado: f.estado || 'pendiente',
      fecha_vencimiento: f.fecha_vencimiento ? f.fecha_vencimiento.split('T')[0] : '',
      notas: f.notas || '',
    });
    setModalFacOpen(true);
  };

  const onChangeSesion = (sesionIdStr) => {
    const sid = parseInt(sesionIdStr || '0', 10);
    const ses = sesiones.find((s) => s.id === sid);
    if (ses) {
      setFormFac((prev) => ({
        ...prev,
        sesion_id: sesionIdStr,
        total: ses.total || prev.total,
        abono: ses.abono || prev.abono,
      }));
    } else {
      setFormFac((prev) => ({ ...prev, sesion_id: sesionIdStr }));
    }
  };

  const guardarFactura = async (e) => {
    e.preventDefault();
    setError('');
    setMensaje('');
    try {
      const res = await fetch('/api/facturas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'guardar', ...formFac }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Error al guardar factura');
        return;
      }
      setMensaje(json.mensaje);
      setModalFacOpen(false);
      cargarFacturas(estadoFiltro, pagina);
    } catch (err) {
      setError('Error de conexión');
    }
  };

  const abrirPago = (f) => {
    setError('');
    setPagoData({
      id: f.id,
      numero: f.numero_factura,
      saldo: Number(f.saldo),
      monto: Number(f.saldo),
      metodo_pago: f.metodo_pago || 'efectivo',
    });
    setModalPagoOpen(true);
  };

  const registrarPago = async (e) => {
    e.preventDefault();
    setError('');
    setMensaje('');
    try {
      const res = await fetch('/api/facturas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'registrar_pago',
          id: pagoData.id,
          monto: pagoData.monto,
          metodo_pago: pagoData.metodo_pago,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Error al registrar pago');
        return;
      }
      setMensaje(json.mensaje);
      setModalPagoOpen(false);
      cargarFacturas(estadoFiltro, pagina);
    } catch (err) {
      setError('Error de conexión');
    }
  };

  const eliminarFac = async (id, num) => {
    if (!window.confirm(`¿Eliminar la factura "${num}"?`)) return;
    setError('');
    setMensaje('');
    try {
      const res = await fetch(`/api/facturas?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (res.ok) {
        setMensaje(json.mensaje || 'Factura eliminada.');
        cargarFacturas(estadoFiltro, pagina);
      } else {
        setError(json.error || 'Error al eliminar');
      }
    } catch (err) {
      setError('Error de conexión');
    }
  };

  return (
    <AppShell
      title="Facturas"
      actions={
        <button className="btn btn-primary" onClick={abrirModalFac}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nueva Factura
        </button>
      }
    >
      <style jsx>{`
        .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
        .stat-mini { background: var(--surface); border-radius: 14px; padding: 15px 18px; border: 1.5px solid var(--border); box-shadow: var(--shadow-sm); position: relative; overflow: hidden; }
        .stat-mini::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 3px; border-radius: 0 0 14px 14px; }
        .stat-mini.rose::after { background: linear-gradient(90deg, var(--rose), var(--rose-light)); }
        .stat-mini.teal::after { background: linear-gradient(90deg, var(--teal), var(--teal-light)); }
        .stat-mini.lav::after  { background: linear-gradient(90deg, var(--lavender), var(--lav-light)); }
        .stat-mini.navy::after { background: linear-gradient(90deg, var(--navy), var(--navy-mid)); }
        .sm-label { font-size: 10px; font-weight: 700; color: var(--text-dim); text-transform: uppercase; letter-spacing: .1em; margin-bottom: 6px; }
        .sm-val { font-size: 20px; font-weight: 700; color: var(--navy); line-height: 1; }
        .sm-sub { font-size: 10px; color: var(--text-dim); margin-top: 3px; }
        .filter-pills { display: flex; gap: 6px; flex-wrap: wrap; }
        .pill { padding: 5px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; cursor: pointer; border: 1.5px solid var(--border); background: var(--surface); color: var(--text-mid); text-decoration: none; transition: all .15s; }
        .pill:hover, .pill.active { background: var(--rose-pale); border-color: var(--rose-light); color: var(--rose-deep); }
        .fac-num { font-family: monospace; font-size: 12px; font-weight: 700; color: var(--navy); background: var(--navy-soft); padding: 3px 9px; border-radius: 6px; }
        .btn-pdf { background: linear-gradient(135deg, #2a1830, #4a2a58); color: #f5b8ce; border: 1px solid rgba(232,120,154,.3); padding: 5px 11px; border-radius: 8px; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; gap: 5px; text-decoration: none; transition: all .18s; white-space: nowrap; cursor: pointer; }
        .btn-pdf:hover { background: linear-gradient(135deg, var(--rose-deep), #9a3060); color: #fff; box-shadow: 0 3px 10px rgba(196,84,122,.35); transform: translateY(-1px); }
        .btn-pdf svg { width: 12px; height: 12px; stroke: currentColor; flex-shrink: 0; }
        @media (max-width: 900px) { .stats-row { grid-template-columns: repeat(2, 1fr); } }
      `}</style>

      {mensaje && <div className="alert alert-success">✓ {mensaje}</div>}
      {error && <div className="alert alert-error">✕ {error}</div>}

      {/* STATS */}
      <div className="stats-row">
        <div className="stat-mini rose">
          <div className="sm-label">Pendientes</div>
          <div className="sm-val">{stats.pendientes}</div>
          <div className="sm-sub">Por cobrar</div>
        </div>
        <div className="stat-mini lav">
          <div className="sm-label">Saldo total</div>
          <div className="sm-val" style={{ fontSize: '15px' }}>{formatoPeso(stats.saldoPend)}</div>
          <div className="sm-sub">Pendiente de cobro</div>
        </div>
        <div className="stat-mini teal">
          <div className="sm-label">Pagadas</div>
          <div className="sm-val">{stats.pagadas}</div>
          <div className="sm-sub">Completadas</div>
        </div>
        <div className="stat-mini navy">
          <div className="sm-label">Total facturas</div>
          <div className="sm-val">{stats.totalFacturas}</div>
          <div className="sm-sub">En el sistema</div>
        </div>
      </div>

      {/* LISTADO */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Listado de Facturas</div>
          <div className="filter-pills">
            {[
              { id: '', label: 'Todas' },
              { id: 'pendiente', label: 'Pendientes' },
              { id: 'abonada', label: 'Abonadas' },
              { id: 'pagada', label: 'Pagadas' },
              { id: 'cancelada', label: 'Canceladas' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                className={`pill ${estadoFiltro === f.id ? 'active' : ''}`}
                onClick={() => {
                  setEstadoFiltro(f.id);
                  setPagina(1);
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Factura</th>
                <th>Cliente</th>
                <th>Servicio / Sesión</th>
                <th>Fecha</th>
                <th>Total</th>
                <th>Abonado</th>
                <th>Saldo</th>
                <th>Método</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="empty-row">Cargando facturas...</td>
                </tr>
              ) : facturas.length === 0 ? (
                <tr>
                  <td colSpan={10} className="empty-row">No hay facturas registradas.</td>
                </tr>
              ) : (
                facturas.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <span className="fac-num">{f.numero_factura}</span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--navy)' }}>
                        {f.nombre} {f.apellido}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
                        {f.telefono || ''}
                      </div>
                    </td>
                    <td>
                      <div>{f.servicio || '—'}</div>
                      {f.fecha_sesion && (
                        <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
                          {formatoFecha(f.fecha_sesion)}
                        </div>
                      )}
                    </td>
                    <td>{formatoFecha(f.fecha_emision)}</td>
                    <td>
                      <strong style={{ color: 'var(--navy)' }}>{formatoPeso(f.total)}</strong>
                    </td>
                    <td style={{ color: 'var(--teal-deep)', fontWeight: 700 }}>
                      {formatoPeso(f.abono)}
                    </td>
                    <td
                      style={{
                        color: Number(f.saldo) > 0 ? 'var(--rose-deep)' : 'var(--teal-deep)',
                        fontWeight: 700,
                      }}
                    >
                      {formatoPeso(f.saldo)}
                    </td>
                    <td style={{ fontSize: '11px', textTransform: 'capitalize' }}>
                      {f.metodo_pago}
                    </td>
                    <td>
                      <span className={`badge badge-${f.estado}`}>
                        {f.estado ? f.estado.charAt(0).toUpperCase() + f.estado.slice(1) : ''}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <button
                          type="button"
                          className="btn-pdf"
                          onClick={() => setModalVerFactura(f)}
                          title="Ver factura / Enviar por WhatsApp / Descargar PDF"
                        >
                          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="12" y1="18" x2="12" y2="12" />
                            <line x1="9" y1="15" x2="15" y2="15" />
                          </svg>
                          PDF
                        </button>
                        {f.estado !== 'pagada' && f.estado !== 'cancelada' && (
                          <button
                            className="btn btn-teal btn-sm"
                            onClick={() => abrirPago(f)}
                          >
                            + Pago
                          </button>
                        )}
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => editarFac(f)}
                        >
                          Editar
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => eliminarFac(f.id, f.numero_factura)}
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPaginas > 1 && (
        <div className="pagination">
          {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              className={`page-btn ${p === pagina ? 'active' : ''}`}
              onClick={() => setPagina(p)}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* MODAL VISTA DE FACTURA + WHATSAPP */}
      <div
        className={`modal-overlay ${modalVerFactura ? 'open' : ''}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) setModalVerFactura(null);
        }}
      >
        <div className="modal" style={{ maxWidth: '880px', width: '95vw' }}>
          <div className="modal-header">
            <span className="modal-title" style={{ flex: '0 0 auto' }}>
              Factura {modalVerFactura?.numero_factura || ''}
            </span>
            <span style={{ flex: 1 }} />
            {modalVerFactura && (
              <Link
                href={`/facturas/${modalVerFactura.id}/pdf`}
                target="_blank"
                className="btn btn-ghost btn-sm"
                style={{ marginRight: '8px' }}
              >
                🖨️ Abrir / Imprimir
              </Link>
            )}
            <button className="modal-close" onClick={() => setModalVerFactura(null)}>
              ✕
            </button>
          </div>
          <div className="modal-body" style={{ padding: 0, background: '#eceaf0' }}>
            {modalVerFactura && (
              <iframe
                ref={facIframeRef}
                src={`/facturas/${modalVerFactura.id}/pdf?ver=1`}
                style={{ width: '100%', height: '66vh', border: 'none', display: 'block' }}
                title="Factura PDF"
              />
            )}
          </div>
          {modalVerFactura && (
            <div className="modal-footer" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
              {facAviso && (
                <div
                  style={{
                    marginRight: 'auto',
                    fontSize: '12px',
                    color: facAviso.tipo === 'warn' ? '#9a5b12' : 'var(--teal-deep)',
                    background: facAviso.tipo === 'warn' ? '#fef3e2' : 'var(--teal-pale)',
                    border: `1.5px solid ${
                      facAviso.tipo === 'warn' ? '#f3d19e' : 'var(--teal-light)'
                    }`,
                    borderRadius: '10px',
                    padding: '6px 10px',
                    lineHeight: 1.4,
                    fontWeight: 600,
                  }}
                >
                  {facAviso.texto}
                </div>
              )}
              <button
                type="button"
                className="btn btn-ghost"
                onClick={descargarFacturaModal}
              >
                ⬇ Descargar PDF
              </button>
              <button
                type="button"
                className="btn"
                style={{
                  background: 'linear-gradient(135deg, #25d366, #128c7e)',
                  color: '#fff',
                  boxShadow: '0 4px 14px rgba(18, 140, 126, 0.28)',
                }}
                onClick={enviarFacturaWhatsApp}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  style={{ marginRight: '4px' }}
                >
                  <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.23 1.36.2 1.87.12.57-.08 1.75-.72 2-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35M12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.32l-.34-.2-3.57.94.95-3.48-.22-.36a9.4 9.4 0 0 1-1.44-5.02c0-5.2 4.24-9.43 9.44-9.43 2.52 0 4.89.98 6.67 2.77a9.37 9.37 0 0 1 2.76 6.67c0 5.2-4.23 9.43-9.44 9.43m8.03-17.46A11.27 11.27 0 0 0 12.05.72C5.8.72.7 5.8.7 12.07c0 2 .52 3.95 1.52 5.67L.6 23.62l6.02-1.58a11.33 11.33 0 0 0 5.42 1.38h.01c6.26 0 11.35-5.09 11.35-11.35 0-3.03-1.18-5.88-3.32-8.03" />
                </svg>
                Enviar por WhatsApp
              </button>
            </div>
          )}
        </div>
      </div>

      {/* MODAL FACTURA */}
      <div
        className={`modal-overlay ${modalFacOpen ? 'open' : ''}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) setModalFacOpen(false);
        }}
      >
        <div className="modal">
          <div className="modal-header">
            <div className="modal-title">
              {formFac.id > 0 ? 'Editar Factura' : 'Nueva Factura'}
            </div>
            <button className="modal-close" onClick={() => setModalFacOpen(false)}>
              ✕
            </button>
          </div>
          <form onSubmit={guardarFactura}>
            <div className="modal-body">
              <div className="form-group">
                <label>Cliente *</label>
                <select
                  className="form-input"
                  value={formFac.cliente_id}
                  onChange={(e) => setFormFac({ ...formFac, cliente_id: e.target.value })}
                  required
                >
                  <option value="">Seleccionar...</option>
                  {clientes.map((cl) => (
                    <option key={cl.id} value={cl.id}>
                      {cl.nombre} {cl.apellido}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Sesión asociada (opcional)</label>
                <select
                  className="form-input"
                  value={formFac.sesion_id}
                  onChange={(e) => onChangeSesion(e.target.value)}
                >
                  <option value="">Sin sesión</option>
                  {sesiones.map((se) => (
                    <option key={se.id} value={se.id}>
                      {se.nombre} {se.apellido} – {formatoFecha(se.fecha_sesion)} (
                      {se.servicio || 'Sin servicio'})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Total ($) *</label>
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    step="1000"
                    value={formFac.total}
                    onChange={(e) => setFormFac({ ...formFac, total: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Abono inicial ($)</label>
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    step="1000"
                    value={formFac.abono}
                    onChange={(e) => setFormFac({ ...formFac, abono: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Método de pago</label>
                  <select
                    className="form-input"
                    value={formFac.metodo_pago}
                    onChange={(e) => setFormFac({ ...formFac, metodo_pago: e.target.value })}
                  >
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="nequi">Nequi</option>
                    <option value="daviplata">Daviplata</option>
                    <option value="tarjeta">Tarjeta</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Estado</label>
                  <select
                    className="form-input"
                    value={formFac.estado}
                    onChange={(e) => setFormFac({ ...formFac, estado: e.target.value })}
                  >
                    <option value="pendiente">Pendiente</option>
                    <option value="abonada">Abonada</option>
                    <option value="pagada">Pagada</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Fecha vencimiento (opcional)</label>
                <input
                  className="form-input"
                  type="date"
                  value={formFac.fecha_vencimiento}
                  onChange={(e) => setFormFac({ ...formFac, fecha_vencimiento: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Notas</label>
                <textarea
                  className="form-input"
                  placeholder="Observaciones..."
                  value={formFac.notas}
                  onChange={(e) => setFormFac({ ...formFac, notas: e.target.value })}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setModalFacOpen(false)}
              >
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary">
                Guardar Factura
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* MODAL PAGO */}
      <div
        className={`modal-overlay ${modalPagoOpen ? 'open' : ''}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) setModalPagoOpen(false);
        }}
      >
        <div className="modal" style={{ maxWidth: '380px' }}>
          <div className="modal-header">
            <div className="modal-title">Registrar Pago – {pagoData.numero}</div>
            <button className="modal-close" onClick={() => setModalPagoOpen(false)}>
              ✕
            </button>
          </div>
          <form onSubmit={registrarPago}>
            <div className="modal-body">
              <div
                style={{
                  background: 'var(--rose-pale)',
                  borderRadius: '10px',
                  padding: '12px',
                  fontSize: '12px',
                  color: 'var(--rose-deep)',
                  fontWeight: 600,
                }}
              >
                Saldo pendiente: {formatoPeso(pagoData.saldo)}
              </div>
              <div className="form-group">
                <label>Monto del pago ($) *</label>
                <input
                  className="form-input"
                  type="number"
                  min="1000"
                  step="1000"
                  value={pagoData.monto}
                  onChange={(e) => setPagoData({ ...pagoData, monto: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Método de pago</label>
                <select
                  className="form-input"
                  value={pagoData.metodo_pago}
                  onChange={(e) => setPagoData({ ...pagoData, metodo_pago: e.target.value })}
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="nequi">Nequi</option>
                  <option value="daviplata">Daviplata</option>
                  <option value="tarjeta">Tarjeta</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setModalPagoOpen(false)}
              >
                Cancelar
              </button>
              <button type="submit" className="btn btn-teal">
                Confirmar Pago
              </button>
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  );
}

export default function FacturasPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Cargando facturas...</div>}>
      <FacturasContent />
    </Suspense>
  );
}
