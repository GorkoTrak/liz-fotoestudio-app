'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { formatoPeso, formatoFecha, labelEstadoEntrega } from '@/lib/formatters';

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const AV_CLASSES = ['av-a', 'av-b', 'av-c', 'av-d', 'av-e'];

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [tabAlerta, setTabAlerta] = useState('cobros');
  const [mostrarIngresoMes, setMostrarIngresoMes] = useState(false);
  const [mostrarGrafica, setMostrarGrafica] = useState(false);

  useEffect(() => {
    fetch('/api/dashboard')
      .then((res) => {
        if (res.status === 401) {
          router.push('/login');
          return null;
        }
        return res.json();
      })
      .then((json) => {
        if (json) setData(json);
        setCargando(false);
      })
      .catch(() => setCargando(false));
  }, [router]);

  if (cargando) {
    return (
      <div className="flex items-center justify-center h-screen text-[var(--text-mid)] font-semibold">
        Cargando Dashboard desde Neon...
      </div>
    );
  }

  if (!data || !data.stats) return null;

  const { usuario, stats, alertas, ultimasSesiones, ingresosPorMes } = data;
  const esAdmin = usuario?.rol === 'admin';

  // Cálculo del mini calendario del mes actual
  const hoy = new Date();
  const anioActual = hoy.getFullYear();
  const mesActual = hoy.getMonth(); // 0-11
  const diaHoy = hoy.getDate();
  const primerDiaSemana = (new Date(anioActual, mesActual, 1).getDay() + 6) % 7; // Lunes = 0
  const totalDiasMes = new Date(anioActual, mesActual + 1, 0).getDate();
  const nombreMesAnio = hoy.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });

  const maxIngreso = Math.max(1, ...ingresosPorMes.map((m) => Number(m.total || 0)));

  return (
    <AppShell
      title="Dashboard"
      usuario={usuario}
      sesionesPendientes={stats.sesiones_pend_entrega}
      facturasPendientes={stats.facturas_pendientes}
    >
      {/* 5 TARJETAS DE ESTADÍSTICAS */}
      <div className="stats-row">
        <div className="stat-card sc1">
          <div className="stat-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
            </svg>
          </div>
          <div className="stat-blob" />
          <div className="stat-label">Clientes</div>
          <div className="stat-value">{stats.total_clientes}</div>
          <div className="stat-sub">registrados</div>
        </div>

        <div className="stat-card sc2">
          <div className="stat-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </div>
          <div className="stat-blob" />
          <div className="stat-label">Por entregar</div>
          <div className="stat-value">{stats.sesiones_pend_entrega}</div>
          <div className="stat-sub">sesiones pendientes</div>
        </div>

        <div className="stat-card sc3">
          <div className="stat-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div className="stat-blob" />
          <div className="stat-label">Sin cobrar</div>
          <div className="stat-value">{stats.sesiones_pend_pago}</div>
          <div className="stat-sub">{formatoPeso(stats.saldo_pendiente)} pendiente</div>
        </div>

        <div className="stat-card sc4">
          <div className="stat-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <div className="stat-blob" />
          <div className="stat-label">Ingresos mes</div>
          <div className="stat-value" style={{ fontSize: mostrarIngresoMes ? '24px' : '22px' }}>
            {mostrarIngresoMes ? formatoPeso(stats.ingresos_mes) : '••••••'}
          </div>
          <div className="stat-sub">este mes</div>
          {esAdmin && (
            <button
              type="button"
              onClick={() => setMostrarIngresoMes(!mostrarIngresoMes)}
              title="Mostrar/ocultar ingresos"
              style={{
                position: 'absolute',
                bottom: '14px',
                right: '14px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-dim)',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          )}
        </div>

        <div className="stat-card sc5">
          <div className="stat-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <div className="stat-blob" />
          <div className="stat-label">Próximas</div>
          <div className="stat-value">{stats.sesiones_proximas}</div>
          <div className="stat-sub">sesiones por realizar</div>
        </div>
      </div>

      {/* TABLA ÚLTIMAS SESIONES + COLUMNA DERECHA */}
      <div className="two-col">
        <div className="card">
          <div className="card-header">
            <div className="card-title">Últimas Sesiones</div>
            <Link href="/sesiones" className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: '11px' }}>
              Ver todas →
            </Link>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Servicio</th>
                  <th>Fecha</th>
                  <th>Pago</th>
                  <th>Entrega</th>
                </tr>
              </thead>
              <tbody>
                {ultimasSesiones.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-dim)' }}>
                      No hay sesiones registradas aún.
                    </td>
                  </tr>
                ) : (
                  ultimasSesiones.map((ses, i) => (
                    <tr key={ses.id}>
                      <td>
                        <div className="client-cell">
                          <div className={`client-avatar ${AV_CLASSES[i % 5]}`}>
                            {(ses.nombre || 'C').slice(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <div className="client-name">
                              {ses.nombre} {ses.apellido}
                            </div>
                            <div className="client-phone">{ses.telefono || ''}</div>
                          </div>
                        </div>
                      </td>
                      <td>{ses.servicio || 'Por definir'}</td>
                      <td style={{ fontSize: '11px', fontWeight: 600 }}>{formatoFecha(ses.fecha_sesion)}</td>
                      <td>
                        <span className={`status-pill pill-${ses.estado_pago || 'pendiente'}`}>
                          {ses.estado_pago || 'Pendiente'}
                        </span>
                      </td>
                      <td>
                        <span className={`status-pill pill-${ses.estado_entrega || 'pendiente'}`}>
                          {labelEstadoEntrega(ses.estado_entrega)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="right-col">
          {/* MINI CALENDARIO */}
          <div className="card">
            <div className="card-header" style={{ padding: '14px 20px 10px' }}>
              <div className="card-title capitalize">{nombreMesAnio}</div>
            </div>
            <div
              style={{
                padding: '10px 14px 14px',
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: '2px',
              }}
            >
              {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'].map((d) => (
                <div
                  key={d}
                  style={{
                    textAlign: 'center',
                    fontSize: '9px',
                    fontWeight: 700,
                    color: 'var(--text-dim)',
                    padding: '5px 0',
                    textTransform: 'uppercase',
                  }}
                >
                  {d}
                </div>
              ))}
              {Array.from({ length: primerDiaSemana }).map((_, idx) => (
                <div key={`empty-${idx}`} />
              ))}
              {Array.from({ length: totalDiasMes }).map((_, idx) => {
                const dia = idx + 1;
                const esHoy = dia === diaHoy;
                return (
                  <div
                    key={dia}
                    style={{
                      textAlign: 'center',
                      padding: '5px 0',
                      fontSize: '12px',
                      fontWeight: esHoy ? 700 : 600,
                      color: esHoy ? '#fff' : 'var(--text-mid)',
                      background: esHoy ? 'linear-gradient(135deg, var(--rose), var(--rose-deep))' : 'transparent',
                      borderRadius: '50%',
                    }}
                  >
                    {dia}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ALERTAS CON PESTAÑAS */}
          <div className="card">
            <div
              style={{
                display: 'flex',
                gap: '6px',
                padding: '14px 16px 0',
                borderBottom: '1px solid var(--border)',
                background: 'var(--surface2)',
              }}
            >
              <button
                type="button"
                onClick={() => setTabAlerta('cobros')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '16px 16px 0 0',
                  fontSize: '11px',
                  fontWeight: 700,
                  border: '1.5px solid var(--border)',
                  borderBottom: 'none',
                  cursor: 'pointer',
                  background: tabAlerta === 'cobros' ? 'var(--rose)' : 'var(--surface)',
                  color: tabAlerta === 'cobros' ? '#fff' : 'var(--text-mid)',
                }}
              >
                Por cobrar ({alertas.cobros.length})
              </button>
              <button
                type="button"
                onClick={() => setTabAlerta('entregas')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '16px 16px 0 0',
                  fontSize: '11px',
                  fontWeight: 700,
                  border: '1.5px solid var(--border)',
                  borderBottom: 'none',
                  cursor: 'pointer',
                  background: tabAlerta === 'entregas' ? 'var(--teal-deep)' : 'var(--surface)',
                  color: tabAlerta === 'entregas' ? '#fff' : 'var(--text-mid)',
                }}
              >
                Entregas ({alertas.entregas.length})
              </button>
              <button
                type="button"
                onClick={() => setTabAlerta('citas')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '16px 16px 0 0',
                  fontSize: '11px',
                  fontWeight: 700,
                  border: '1.5px solid var(--border)',
                  borderBottom: 'none',
                  cursor: 'pointer',
                  background: tabAlerta === 'citas' ? 'var(--navy)' : 'var(--surface)',
                  color: tabAlerta === 'citas' ? '#fff' : 'var(--text-mid)',
                }}
              >
                Citas ({alertas.citas.length})
              </button>
            </div>

            <div>
              {tabAlerta === 'cobros' &&
                (alertas.cobros.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-dim)' }}>
                    Sin cobros pendientes
                  </div>
                ) : (
                  alertas.cobros.map((a) => (
                    <div
                      key={a.ref_id}
                      style={{
                        padding: '12px 18px',
                        borderBottom: '1px solid var(--border)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--navy)' }}>{a.cliente}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{formatoFecha(a.fecha_ref)}</div>
                        <div className="font-cursive" style={{ fontSize: '15px', color: 'var(--rose-deep)' }}>
                          Saldo: {formatoPeso(a.saldo)}
                        </div>
                      </div>
                      <Link
                        href={`/sesiones?sesion_id=${a.ref_id}`}
                        style={{ fontSize: '11px', fontWeight: 700, color: 'var(--rose-deep)' }}
                      >
                        Ver →
                      </Link>
                    </div>
                  ))
                ))}

              {tabAlerta === 'entregas' &&
                (alertas.entregas.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-dim)' }}>
                    Sin entregas pendientes
                  </div>
                ) : (
                  alertas.entregas.map((a) => (
                    <div
                      key={a.ref_id}
                      style={{
                        padding: '12px 18px',
                        borderBottom: '1px solid var(--border)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--navy)' }}>{a.cliente}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                          Sesión: {formatoFecha(a.fecha_ref)} · Fotos pendientes
                        </div>
                      </div>
                      <Link
                        href={`/sesiones?sesion_id=${a.ref_id}`}
                        style={{ fontSize: '11px', fontWeight: 700, color: 'var(--teal-deep)' }}
                      >
                        Ver →
                      </Link>
                    </div>
                  ))
                ))}

              {tabAlerta === 'citas' &&
                (alertas.citas.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-dim)' }}>
                    Sin citas para mañana
                  </div>
                ) : (
                  alertas.citas.map((a) => (
                    <div key={a.ref_id} style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontWeight: 700, color: 'var(--navy)' }}>{a.cliente}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Cita agendada para mañana</div>
                    </div>
                  ))
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* GRÁFICA DE INGRESOS MENSUALES */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Ingresos Mensuales</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {esAdmin && (
              <button
                type="button"
                onClick={() => setMostrarGrafica(!mostrarGrafica)}
                className="btn btn-ghost"
                style={{ padding: '4px 10px', fontSize: '11px' }}
              >
                {mostrarGrafica ? '🙈 Ocultar' : '👁️ Mostrar'}
              </button>
            )}
            <Link href="/ingresos" className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: '11px' }}>
              Ver detalle →
            </Link>
          </div>
        </div>

        <div
          style={{
            padding: '18px 20px',
            filter: mostrarGrafica ? 'none' : 'blur(6px)',
            pointerEvents: mostrarGrafica ? 'auto' : 'none',
            userSelect: 'none',
            transition: 'filter 0.25s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', height: '140px', paddingBottom: '22px' }}>
            {ingresosPorMes.length === 0 ? (
              <div style={{ width: '100%', textAlign: 'center', color: 'var(--text-dim)' }}>
                Sin datos de ingresos recientes.
              </div>
            ) : (
              ingresosPorMes.map((dm) => {
                const pct = Math.max(8, Math.round((Number(dm.total) / maxIngreso) * 100));
                const esActual = Number(dm.mes) === mesActual + 1;
                return (
                  <div
                    key={`${dm.anio}-${dm.mes}`}
                    style={{
                      flex: 1,
                      maxWidth: '64px',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      position: 'relative',
                    }}
                  >
                    <div
                      title={`${MESES_CORTOS[dm.mes - 1]}: ${formatoPeso(dm.total)}`}
                      style={{
                        width: '100%',
                        maxWidth: '44px',
                        height: `${pct}%`,
                        borderRadius: '6px 6px 0 0',
                        background: esActual
                          ? 'linear-gradient(180deg, var(--rose-light), var(--rose-deep))'
                          : 'linear-gradient(180deg, var(--rose-light), var(--rose))',
                        opacity: esActual ? 1 : 0.6,
                      }}
                    />
                    <div
                      style={{
                        fontSize: '10px',
                        color: 'var(--text-dim)',
                        fontWeight: 700,
                        position: 'absolute',
                        bottom: 0,
                      }}
                    >
                      {MESES_CORTOS[dm.mes - 1]}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div
            style={{
              display: 'flex',
              gap: '24px',
              paddingTop: '12px',
              borderTop: '1.5px solid var(--border)',
              marginTop: '8px',
            }}
          >
            <div>
              <div style={{ fontSize: '9px', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
                Total año
              </div>
              <div className="font-cursive" style={{ fontSize: '20px', color: 'var(--rose-deep)' }}>
                {formatoPeso(stats.total_anio)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '9px', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
                Este mes
              </div>
              <div className="font-cursive" style={{ fontSize: '20px', color: 'var(--rose-deep)' }}>
                {formatoPeso(stats.ingresos_mes)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '9px', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
                Saldo pendiente
              </div>
              <div className="font-cursive" style={{ fontSize: '20px', color: 'var(--text-mid)' }}>
                {formatoPeso(stats.saldo_pendiente)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
