'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { formatoPeso, formatoFecha } from '@/lib/formatters';

const MESES_CORTOS = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MESES_FULL = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const METODOS_LABEL = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  nequi: 'Nequi',
  daviplata: 'Daviplata',
  tarjeta: 'Tarjeta',
};

export default function IngresosPage() {
  const router = useRouter();
  const now = new Date();
  const [filtroMes, setFiltroMes] = useState(now.getMonth() + 1);
  const [filtroAnio, setFiltroAnio] = useState(now.getFullYear());
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroDesde, setFiltroDesde] = useState('');
  const [filtroHasta, setFiltroHasta] = useState('');
  const [pagina, setPagina] = useState(1);

  const [movimientos, setMovimientos] = useState([]);
  const [totalRegistros, setTotalRegistros] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [stats, setStats] = useState({
    ingMes: 0,
    egrMes: 0,
    utilidadMes: 0,
    ingAnio: 0,
    egrAnio: 0,
    utilidadAnio: 0,
  });
  const [graficas, setGraficas] = useState({ mes: [], semana: [], anio: [] });
  const [vistaGrafica, setVistaGrafica] = useState('anio');
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);

  const [desbloqueado, setDesbloqueado] = useState(false);
  const [ocultos, setOcultos] = useState({
    ingMes: false,
    egrMes: false,
    utilMes: false,
    ingAnio: false,
    egrAnio: false,
    utilAnio: false,
  });

  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  // Modal Movimiento
  const [modalOpen, setModalOpen] = useState(false);
  const [formMov, setFormMov] = useState({
    id: 0,
    tipo: 'ingreso',
    concepto: '',
    monto: '',
    fecha: now.toISOString().split('T')[0],
    metodo_pago: 'efectivo',
    cliente_id: '',
    notas: '',
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (sessionStorage.getItem('ingresos_desbloqueados') === '1') {
        setDesbloqueado(true);
      }
    }
  }, []);

  const desbloquearIngresos = () => {
    sessionStorage.setItem('ingresos_desbloqueados', '1');
    setDesbloqueado(true);
  };

  const bloquearIngresos = () => {
    sessionStorage.removeItem('ingresos_desbloqueados');
    setDesbloqueado(false);
  };

  const toggleCardOculto = (key) => {
    setOcultos((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const cargarIngresos = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('mes', String(filtroMes));
      params.set('anio', String(filtroAnio));
      if (filtroTipo) params.set('tipo', filtroTipo);
      if (filtroDesde) params.set('desde', filtroDesde);
      if (filtroHasta) params.set('hasta', filtroHasta);
      params.set('p', String(pagina));

      const res = await fetch(`/api/ingresos?${params.toString()}`);
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      if (res.status === 403) {
        router.push('/');
        return;
      }
      const json = await res.json();
      if (res.ok) {
        setMovimientos(json.movimientos || []);
        setTotalRegistros(json.totalRegistros || 0);
        setTotalPaginas(json.totalPaginas || 1);
        setStats(
          json.stats || {
            ingMes: 0,
            egrMes: 0,
            utilidadMes: 0,
            ingAnio: 0,
            egrAnio: 0,
            utilidadAnio: 0,
          }
        );
        setGraficas(json.graficas || { mes: [], semana: [], anio: [] });
        setClientes(json.clientes || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filtroMes, filtroAnio, filtroTipo, filtroDesde, filtroHasta, pagina, router]);

  useEffect(() => {
    cargarIngresos();
  }, [cargarIngresos]);

  const abrirModal = () => {
    setError('');
    setFormMov({
      id: 0,
      tipo: 'ingreso',
      concepto: '',
      monto: '',
      fecha: new Date().toISOString().split('T')[0],
      metodo_pago: 'efectivo',
      cliente_id: '',
      notas: '',
    });
    setModalOpen(true);
  };

  const editarMovimiento = (m) => {
    setError('');
    setFormMov({
      id: m.id,
      tipo: m.tipo || 'ingreso',
      concepto: m.concepto || '',
      monto: m.monto || '',
      fecha: m.fecha ? m.fecha.split('T')[0] : new Date().toISOString().split('T')[0],
      metodo_pago: m.metodo_pago || 'efectivo',
      cliente_id: m.cliente_id || '',
      notas: m.notas || '',
    });
    setModalOpen(true);
  };

  const guardarMovimiento = async (e) => {
    e.preventDefault();
    setError('');
    setMensaje('');
    try {
      const res = await fetch('/api/ingresos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formMov),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Error al guardar movimiento');
        return;
      }
      setMensaje(json.mensaje);
      setModalOpen(false);
      cargarIngresos();
    } catch (err) {
      setError('Error de conexión');
    }
  };

  const eliminarMovimiento = async (id, concepto) => {
    if (!window.confirm(`¿Eliminar "${concepto}"?`)) return;
    setError('');
    setMensaje('');
    try {
      const res = await fetch(`/api/ingresos?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (res.ok) {
        setMensaje(json.mensaje || 'Eliminado.');
        cargarIngresos();
      } else {
        setError(json.error || 'Error al eliminar');
      }
    } catch (err) {
      setError('Error de conexión');
    }
  };

  const hoyStr = new Date().toISOString().split('T')[0];
  const hace7Str = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toISOString().split('T')[0];
  })();
  const iniMesStr = `${filtroAnio}-${String(filtroMes).padStart(2, '0')}-01`;
  const finMesStr = (() => {
    const lastDay = new Date(filtroAnio, filtroMes, 0).getDate();
    return `${filtroAnio}-${String(filtroMes).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  })();
  const iniAnioStr = `${filtroAnio}-01-01`;
  const finAnioStr = `${filtroAnio}-12-31`;

  const datosGraficaActual = graficas[vistaGrafica] || [];
  const maxBar = Math.max(1, ...datosGraficaActual.map((d) => Math.max(d.ing || 0, d.egr || 0)));

  return (
    <AppShell
      title="Panel de Ingresos"
      actions={
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={bloquearIngresos}
            title="Ocultar y bloquear vista de ingresos"
          >
            🔒 Bloquear
          </button>
          <button className="btn btn-primary" onClick={abrirModal}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Registrar Movimiento
          </button>
        </div>
      }
    >
      <style jsx>{`
        .stats-row { display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; }
        .stat-mini { background: var(--surface); border-radius: 14px; padding: 15px 18px; border: 1.5px solid var(--border); box-shadow: var(--shadow-sm); position: relative; overflow: hidden; }
        .stat-mini::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 3px; border-radius: 0 0 14px 14px; }
        .stat-mini.rose::after { background: linear-gradient(90deg, var(--rose), var(--rose-light)); }
        .stat-mini.teal::after { background: linear-gradient(90deg, var(--teal), var(--teal-light)); }
        .stat-mini.lav::after  { background: linear-gradient(90deg, var(--lavender), var(--lav-light)); }
        .stat-mini.navy::after { background: linear-gradient(90deg, var(--navy), var(--navy-mid)); }
        .stat-mini.amber::after { background: linear-gradient(90deg, #f0a850, #f8cc88); }
        .stat-mini.green::after { background: linear-gradient(90deg, #4db896, #9ddbd8); }
        .sm-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
        .sm-label { font-size: 9.5px; font-weight: 700; color: var(--text-dim); text-transform: uppercase; letter-spacing: .09em; }
        .sm-val { font-size: 15px; font-weight: 700; color: var(--navy); line-height: 1; transition: all .2s; }
        .sm-sub { font-size: 10px; color: var(--text-dim); margin-top: 3px; }
        .eye-btn { background: none; border: none; cursor: pointer; padding: 2px; border-radius: 5px; color: var(--text-dim); display: flex; align-items: center; transition: color .15s; }
        .eye-btn:hover { color: var(--rose-deep); }
        .eye-btn svg { width: 13px; height: 13px; stroke: currentColor; fill: none; stroke-width: 2; }
        .vista-btns { display: flex; gap: 4px; background: var(--bg); padding: 3px; border-radius: 20px; border: 1.5px solid var(--border); }
        .vista-btn { padding: 4px 12px; border-radius: 16px; font-size: 11px; font-weight: 700; cursor: pointer; border: none; background: transparent; color: var(--text-mid); font-family: 'Nunito', sans-serif; transition: all .15s; }
        .vista-btn.active { background: var(--surface); color: var(--rose-deep); box-shadow: 0 1px 6px rgba(180,120,160,.18); }
        .chart-bars { display: flex; align-items: flex-end; gap: 6px; height: 110px; padding: 0 18px 16px; }
        .bar-group { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; height: 100%; justify-content: flex-end; }
        .bars-duo { display: flex; align-items: flex-end; gap: 2px; width: 100%; justify-content: center; height: 90px; }
        .bar-ing { width: 45%; background: linear-gradient(180deg, var(--teal-light), var(--teal)); border-radius: 4px 4px 0 0; min-height: 2px; transition: height .3s; }
        .bar-egr { width: 45%; background: linear-gradient(180deg, var(--rose-light), var(--rose)); border-radius: 4px 4px 0 0; min-height: 2px; transition: height .3s; }
        .bar-lbl { font-size: 9px; font-weight: 700; color: var(--text-dim); }
        .bar-mes-act .bar-lbl { color: var(--rose-deep); }
        .filter-pills { display: flex; gap: 5px; flex-wrap: wrap; align-items: center; }
        .pill { padding: 5px 11px; border-radius: 20px; font-size: 11px; font-weight: 700; cursor: pointer; border: 1.5px solid var(--border); background: var(--surface); color: var(--text-mid); transition: all .15s; }
        .pill:hover, .pill.active { background: var(--rose-pale); border-color: var(--rose-light); color: var(--rose-deep); }
        .fecha-toolbar { padding: 12px 18px; background: var(--surface2); border-bottom: 1.5px solid var(--border); }
        .fecha-filter-form { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        .fecha-presets { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .preset-lbl { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: var(--text-dim); margin-right: 2px; }
        .preset-chip { padding: 4px 10px; border-radius: 14px; font-size: 11px; font-weight: 700; color: var(--text-mid); background: var(--surface); border: 1.5px solid var(--border); cursor: pointer; transition: all .15s; }
        .preset-chip:hover, .preset-chip.active { background: var(--teal-pale); border-color: var(--teal-light); color: var(--teal-deep); }
        .fecha-inputs-wrap { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .fecha-field { display: flex; align-items: center; gap: 5px; }
        .fecha-field label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--text-mid); }
        .date-input { padding: 5px 10px; font-size: 11.5px; border-radius: 8px; width: auto; min-width: 132px; background: var(--surface); }
        .tipo-ing { color: var(--teal-deep); font-weight: 700; }
        .tipo-egr { color: var(--rose-deep); font-weight: 700; }
        .monto-ing { color: var(--teal-deep); font-weight: 700; font-size: 13px; }
        .monto-egr { color: var(--rose-deep); font-weight: 700; font-size: 13px; }
        .metodo-badge { display: inline-flex; padding: 3px 9px; border-radius: 20px; font-size: 10px; font-weight: 700; background: var(--lav-pale); color: var(--lavender); }
        .privacy-guard-overlay { position: fixed; inset: 0; background: rgba(26, 31, 60, 0.72); backdrop-filter: blur(14px); z-index: 300; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .privacy-guard-card { background: var(--surface); border: 1.5px solid var(--border); border-radius: 22px; max-width: 410px; width: 100%; padding: 30px 26px 24px; text-align: center; box-shadow: 0 20px 60px rgba(26, 31, 60, 0.35); }
        .privacy-guard-icon { width: 58px; height: 58px; border-radius: 50%; margin: 0 auto 14px; background: linear-gradient(135deg, var(--rose-pale), var(--lav-pale)); color: var(--rose-deep); display: flex; align-items: center; justify-content: center; }
        .privacy-guard-title { font-size: 18px; font-weight: 700; color: var(--navy); margin-bottom: 8px; }
        .privacy-guard-desc { font-size: 12.5px; color: var(--text-mid); line-height: 1.55; margin-bottom: 22px; }
        .privacy-guard-actions { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
        .tipo-btns { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .tipo-lbl { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px; border-radius: 10px; border: 1.5px solid var(--border); cursor: pointer; font-weight: 700; font-size: 12px; transition: all .18s; }
        .tipo-lbl.active-ing { background: var(--teal-pale); border-color: var(--teal); color: var(--teal-deep); }
        .tipo-lbl.active-egr { background: var(--rose-pale); border-color: var(--rose); color: var(--rose-deep); }
        @media (max-width: 1100px) { .stats-row { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 700px) { .stats-row { grid-template-columns: repeat(2, 1fr); } }
      `}</style>

      {/* OVERLAY DE PRIVACIDAD */}
      {!desbloqueado && (
        <div className="privacy-guard-overlay">
          <div className="privacy-guard-card">
            <div className="privacy-guard-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="26" height="26">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <div className="privacy-guard-title">Información Confidencial</div>
            <div className="privacy-guard-desc">
              Estás a punto de acceder al <strong>Panel de Ingresos y Utilidades</strong> del estudio.
              <br />
              ¿Confirmas que deseas visualizar los montos financieros en pantalla?
            </div>
            <div className="privacy-guard-actions">
              <Link href="/" className="btn btn-ghost">
                ← Volver al inicio
              </Link>
              <button type="button" className="btn btn-primary" onClick={desbloquearIngresos}>
                Sí, mostrar ingresos
              </button>
            </div>
          </div>
        </div>
      )}

      {mensaje && <div className="alert alert-success">✓ {mensaje}</div>}
      {error && <div className="alert alert-error">✕ {error}</div>}

      {/* TARJETAS DE ESTADÍSTICAS */}
      <div className="stats-row">
        <div className="stat-mini teal">
          <div className="sm-head">
            <div className="sm-label">{filtroDesde || filtroHasta ? 'Ingresos (Filtro)' : 'Ingresos mes'}</div>
            <button className="eye-btn" onClick={() => toggleCardOculto('ingMes')}>
              <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
            </button>
          </div>
          <div className="sm-val" style={{ color: 'var(--teal-deep)' }}>
            {ocultos.ingMes ? '••••••' : formatoPeso(stats.ingMes)}
          </div>
          <div className="sm-sub">{MESES_FULL[filtroMes]} {filtroAnio}</div>
        </div>

        <div className="stat-mini rose">
          <div className="sm-head">
            <div className="sm-label">{filtroDesde || filtroHasta ? 'Egresos (Filtro)' : 'Egresos mes'}</div>
            <button className="eye-btn" onClick={() => toggleCardOculto('egrMes')}>
              <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
            </button>
          </div>
          <div className="sm-val" style={{ color: 'var(--rose-deep)' }}>
            {ocultos.egrMes ? '••••••' : formatoPeso(stats.egrMes)}
          </div>
          <div className="sm-sub">{MESES_FULL[filtroMes]} {filtroAnio}</div>
        </div>

        <div className="stat-mini green">
          <div className="sm-head">
            <div className="sm-label">{filtroDesde || filtroHasta ? 'Utilidad (Filtro)' : 'Utilidad mes'}</div>
            <button className="eye-btn" onClick={() => toggleCardOculto('utilMes')}>
              <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
            </button>
          </div>
          <div
            className="sm-val"
            style={{ color: stats.utilidadMes >= 0 ? 'var(--teal-deep)' : 'var(--rose-deep)' }}
          >
            {ocultos.utilMes ? '••••••' : formatoPeso(stats.utilidadMes)}
          </div>
          <div className="sm-sub">{stats.utilidadMes >= 0 ? '✓ Positivo' : '⚠ Negativo'}</div>
        </div>

        <div className="stat-mini lav">
          <div className="sm-head">
            <div className="sm-label">Ingresos {filtroAnio}</div>
            <button className="eye-btn" onClick={() => toggleCardOculto('ingAnio')}>
              <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
            </button>
          </div>
          <div className="sm-val">{ocultos.ingAnio ? '••••••' : formatoPeso(stats.ingAnio)}</div>
          <div className="sm-sub">Acumulado anual</div>
        </div>

        <div className="stat-mini amber">
          <div className="sm-head">
            <div className="sm-label">Egresos {filtroAnio}</div>
            <button className="eye-btn" onClick={() => toggleCardOculto('egrAnio')}>
              <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
            </button>
          </div>
          <div className="sm-val" style={{ color: '#b07a30' }}>
            {ocultos.egrAnio ? '••••••' : formatoPeso(stats.egrAnio)}
          </div>
          <div className="sm-sub">Gastos del año</div>
        </div>

        <div className="stat-mini navy">
          <div className="sm-head">
            <div className="sm-label">Utilidad {filtroAnio}</div>
            <button className="eye-btn" onClick={() => toggleCardOculto('utilAnio')}>
              <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
            </button>
          </div>
          <div className="sm-val">{ocultos.utilAnio ? '••••••' : formatoPeso(stats.utilidadAnio)}</div>
          <div className="sm-sub">Neto anual</div>
        </div>
      </div>

      {/* GRÁFICA */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            {vistaGrafica === 'mes'
              ? `Flujo del Mes – ${MESES_FULL[filtroMes]} ${filtroAnio}`
              : vistaGrafica === 'semana'
              ? 'Últimos 7 Días'
              : `${filtroAnio} – Todos los Meses`}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '12px', fontSize: '11px', fontWeight: 700 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--teal-deep)' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'var(--teal)', display: 'inline-block' }} />
                Ingresos
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--rose-deep)' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'var(--rose)', display: 'inline-block' }} />
                Egresos
              </span>
            </div>
            <div className="vista-btns">
              {['mes', 'semana', 'anio'].map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`vista-btn ${vistaGrafica === v ? 'active' : ''}`}
                  onClick={() => setVistaGrafica(v)}
                >
                  {v === 'mes' ? 'Mes' : v === 'semana' ? 'Semana' : 'Año'}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="chart-bars">
          {datosGraficaActual.map((d, idx) => {
            const hI = d.ing > 0 ? Math.max(4, Math.round((d.ing / maxBar) * 90)) : 2;
            const hE = d.egr > 0 ? Math.max(4, Math.round((d.egr / maxBar) * 90)) : 2;
            return (
              <div key={idx} className={`bar-group ${d.act ? 'bar-mes-act' : ''}`}>
                <div className="bars-duo">
                  <div
                    className="bar-ing"
                    style={{ height: `${hI}px` }}
                    title={`${d.lbl} – Ing: ${formatoPeso(d.ing)}`}
                  />
                  <div
                    className="bar-egr"
                    style={{ height: `${hE}px` }}
                    title={`${d.lbl} – Egr: ${formatoPeso(d.egr)}`}
                  />
                </div>
                <div className="bar-lbl">{d.lbl}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* TABLA DE MOVIMIENTOS */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            Movimientos —{' '}
            {filtroDesde && filtroHasta
              ? `Del ${formatoFecha(filtroDesde)} al ${formatoFecha(filtroHasta)}`
              : `${MESES_FULL[filtroMes]} ${filtroAnio}`}
          </div>
          <div className="filter-pills">
            {MESES_CORTOS.slice(1).map((nm, idx) => {
              const m = idx + 1;
              return (
                <button
                  key={m}
                  type="button"
                  className={`pill ${!filtroDesde && !filtroHasta && m === filtroMes ? 'active' : ''}`}
                  onClick={() => {
                    setFiltroDesde('');
                    setFiltroHasta('');
                    setFiltroMes(m);
                    setPagina(1);
                  }}
                >
                  {nm}
                </button>
              );
            })}
            <span style={{ color: 'var(--border)' }}>|</span>
            <button
              type="button"
              className={`pill ${!filtroTipo ? 'active' : ''}`}
              onClick={() => {
                setFiltroTipo('');
                setPagina(1);
              }}
            >
              Todos
            </button>
            <button
              type="button"
              className={`pill ${filtroTipo === 'ingreso' ? 'active' : ''}`}
              onClick={() => {
                setFiltroTipo('ingreso');
                setPagina(1);
              }}
            >
              ↑ Ingresos
            </button>
            <button
              type="button"
              className={`pill ${filtroTipo === 'egreso' ? 'active' : ''}`}
              onClick={() => {
                setFiltroTipo('egreso');
                setPagina(1);
              }}
            >
              ↓ Egresos
            </button>
          </div>
        </div>

        {/* BARRA DE FECHAS */}
        <div className="fecha-toolbar">
          <div className="fecha-filter-form">
            <div className="fecha-presets">
              <span className="preset-lbl">Rango rápido:</span>
              <button
                type="button"
                className={`preset-chip ${filtroDesde === hoyStr && filtroHasta === hoyStr ? 'active' : ''}`}
                onClick={() => {
                  setFiltroDesde(hoyStr);
                  setFiltroHasta(hoyStr);
                  setPagina(1);
                }}
              >
                Hoy
              </button>
              <button
                type="button"
                className={`preset-chip ${filtroDesde === hace7Str && filtroHasta === hoyStr ? 'active' : ''}`}
                onClick={() => {
                  setFiltroDesde(hace7Str);
                  setFiltroHasta(hoyStr);
                  setPagina(1);
                }}
              >
                7 días
              </button>
              <button
                type="button"
                className={`preset-chip ${filtroDesde === iniMesStr && filtroHasta === finMesStr ? 'active' : ''}`}
                onClick={() => {
                  setFiltroDesde(iniMesStr);
                  setFiltroHasta(finMesStr);
                  setPagina(1);
                }}
              >
                Este mes
              </button>
              <button
                type="button"
                className={`preset-chip ${filtroDesde === iniAnioStr && filtroHasta === finAnioStr ? 'active' : ''}`}
                onClick={() => {
                  setFiltroDesde(iniAnioStr);
                  setFiltroHasta(finAnioStr);
                  setPagina(1);
                }}
              >
                Todo {filtroAnio}
              </button>
            </div>

            <div className="fecha-inputs-wrap">
              <div className="fecha-field">
                <label>Desde:</label>
                <input
                  type="date"
                  className="form-input date-input"
                  value={filtroDesde}
                  onChange={(e) => {
                    setFiltroDesde(e.target.value);
                    setPagina(1);
                  }}
                />
              </div>
              <div className="fecha-field">
                <label>Hasta:</label>
                <input
                  type="date"
                  className="form-input date-input"
                  value={filtroHasta}
                  onChange={(e) => {
                    setFiltroHasta(e.target.value);
                    setPagina(1);
                  }}
                />
              </div>
              {(filtroDesde || filtroHasta) && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setFiltroDesde('');
                    setFiltroHasta('');
                    setPagina(1);
                  }}
                >
                  ✕ Limpiar
                </button>
              )}
            </div>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Concepto</th>
                <th>Cliente</th>
                <th>Método</th>
                <th>Tipo</th>
                <th>Monto</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="empty-row">Cargando movimientos...</td>
                </tr>
              ) : movimientos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty-row">Sin movimientos en el período seleccionado.</td>
                </tr>
              ) : (
                movimientos.map((mov) => (
                  <tr key={mov.id}>
                    <td style={{ fontSize: '11px', fontWeight: 600 }}>{formatoFecha(mov.fecha)}</td>
                    <td style={{ color: 'var(--navy)', fontWeight: 600 }}>{mov.concepto}</td>
                    <td>
                      {mov.nombre ? (
                        `${mov.nombre} ${mov.apellido || ''}`
                      ) : (
                        <span style={{ color: 'var(--text-dim)' }}>—</span>
                      )}
                    </td>
                    <td>
                      <span className="metodo-badge">
                        {METODOS_LABEL[mov.metodo_pago] || mov.metodo_pago}
                      </span>
                    </td>
                    <td>
                      <span className={mov.tipo === 'ingreso' ? 'tipo-ing' : 'tipo-egr'}>
                        {mov.tipo === 'ingreso' ? '↑ Ingreso' : '↓ Egreso'}
                      </span>
                    </td>
                    <td>
                      <span className={mov.tipo === 'ingreso' ? 'monto-ing' : 'monto-egr'}>
                        {formatoPeso(mov.monto)}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => editarMovimiento(mov)}
                        >
                          Editar
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => eliminarMovimiento(mov.id, mov.concepto)}
                        >
                          Eliminar
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

      {/* MODAL MOVIMIENTO */}
      <div
        className={`modal-overlay ${modalOpen ? 'open' : ''}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) setModalOpen(false);
        }}
      >
        <div className="modal">
          <div className="modal-header">
            <div className="modal-title">
              {formMov.id > 0 ? 'Editar Movimiento' : 'Nuevo Movimiento'}
            </div>
            <button className="modal-close" onClick={() => setModalOpen(false)}>
              ✕
            </button>
          </div>
          <form onSubmit={guardarMovimiento}>
            <div className="modal-body">
              <div className="form-group">
                <label>Tipo *</label>
                <div className="tipo-btns">
                  <div
                    className={`tipo-lbl ${formMov.tipo === 'ingreso' ? 'active-ing' : ''}`}
                    onClick={() => setFormMov({ ...formMov, tipo: 'ingreso' })}
                  >
                    ↑ Ingreso
                  </div>
                  <div
                    className={`tipo-lbl ${formMov.tipo === 'egreso' ? 'active-egr' : ''}`}
                    onClick={() => setFormMov({ ...formMov, tipo: 'egreso' })}
                  >
                    ↓ Egreso
                  </div>
                </div>
              </div>
              <div className="form-group">
                <label>Concepto *</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="Ej: Pago sesión quinceañera"
                  value={formMov.concepto}
                  onChange={(e) => setFormMov({ ...formMov, concepto: e.target.value })}
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Monto ($) *</label>
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    step="1000"
                    placeholder="0"
                    value={formMov.monto}
                    onChange={(e) => setFormMov({ ...formMov, monto: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Fecha *</label>
                  <input
                    className="form-input"
                    type="date"
                    value={formMov.fecha}
                    onChange={(e) => setFormMov({ ...formMov, fecha: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Método de pago</label>
                  <select
                    className="form-input"
                    value={formMov.metodo_pago}
                    onChange={(e) => setFormMov({ ...formMov, metodo_pago: e.target.value })}
                  >
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="nequi">Nequi</option>
                    <option value="daviplata">Daviplata</option>
                    <option value="tarjeta">Tarjeta</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Cliente (opcional)</label>
                  <select
                    className="form-input"
                    value={formMov.cliente_id}
                    onChange={(e) => setFormMov({ ...formMov, cliente_id: e.target.value })}
                  >
                    <option value="">Sin cliente</option>
                    {clientes.map((cl) => (
                      <option key={cl.id} value={cl.id}>
                        {cl.nombre} {cl.apellido}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Notas</label>
                <textarea
                  className="form-input"
                  placeholder="Observaciones..."
                  value={formMov.notas}
                  onChange={(e) => setFormMov({ ...formMov, notas: e.target.value })}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setModalOpen(false)}
              >
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary">
                Guardar
              </button>
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  );
}

