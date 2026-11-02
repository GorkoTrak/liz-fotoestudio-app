'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { formatoFecha, labelEstadoEntrega } from '@/lib/formatters';

const AV_CLASSES = ['av-a', 'av-b', 'av-c', 'av-d', 'av-e'];

export default function ClientesPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [totalRegistros, setTotalRegistros] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  // Modal Crear / Editar
  const [modalAbierto, setModalAbierto] = useState(false);
  const [form, setForm] = useState({
    id: 0,
    nombre: '',
    telefono: '',
    email: '',
    direccion: '',
    notas: '',
  });

  // Modal Historial
  const [modalHistorial, setModalHistorial] = useState(false);
  const [clienteHistorial, setClienteHistorial] = useState('');
  const [sesionesHistorial, setSesionesHistorial] = useState([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);

  const cargarClientes = useCallback(
    async (pag = 1, q = busqueda) => {
      setCargando(true);
      const res = await fetch(`/api/clientes?p=${pag}&q=${encodeURIComponent(q)}`);
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      const data = await res.json();
      setUsuario(data.usuario);
      setClientes(data.clientes || []);
      setTotalRegistros(data.totalRegistros || 0);
      setPagina(data.pagina || 1);
      setTotalPaginas(data.totalPaginas || 1);
      setCargando(false);
    },
    [busqueda, router]
  );

  useEffect(() => {
    cargarClientes(1, '');
  }, [cargarClientes]);

  function abrirNuevo() {
    setForm({ id: 0, nombre: '', telefono: '', email: '', direccion: '', notas: '' });
    setModalAbierto(true);
  }

  function abrirEditar(c) {
    const nombreCompleto = `${c.nombre || ''}${c.apellido ? ' ' + c.apellido : ''}`.trim();
    setForm({
      id: c.id,
      nombre: nombreCompleto,
      telefono: c.telefono || '',
      email: c.email || '',
      direccion: c.direccion || '',
      notas: c.notas || '',
    });
    setModalAbierto(true);
  }

  async function guardarCliente(e) {
    e.preventDefault();
    setError('');
    setMensaje('');

    const res = await fetch('/api/clientes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, apellido: '' }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setError(data.error || 'Error al guardar cliente.');
      return;
    }

    setMensaje(data.mensaje);
    setModalAbierto(false);
    cargarClientes(pagina, busqueda);
  }

  async function eliminarCliente(id, nombre) {
    if (!window.confirm(`¿Eliminar a ${nombre}?\nEsta acción no se puede deshacer.`)) return;
    const res = await fetch(`/api/clientes?id=${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.ok) {
      setMensaje(data.mensaje);
      cargarClientes(pagina, busqueda);
    } else {
      setError(data.error || 'No se pudo eliminar.');
    }
  }

  async function verHistorial(id, nombre) {
    setClienteHistorial(nombre);
    setModalHistorial(true);
    setCargandoHistorial(true);
    const res = await fetch(`/api/clientes?historial=${id}`);
    const data = await res.json();
    setSesionesHistorial(data.sesiones || []);
    setCargandoHistorial(false);
  }

  return (
    <AppShell
      title="Clientes"
      usuario={usuario}
      actions={
        <button type="button" className="btn btn-primary" onClick={abrirNuevo}>
          + Nuevo Cliente
        </button>
      }
    >
      {mensaje && (
        <div
          style={{
            padding: '10px 16px',
            borderRadius: '10px',
            background: 'var(--teal-pale)',
            color: 'var(--teal-deep)',
            border: '1.5px solid var(--teal-light)',
            fontWeight: 600,
          }}
        >
          {mensaje}
        </div>
      )}

      {error && (
        <div
          style={{
            padding: '10px 16px',
            borderRadius: '10px',
            background: 'var(--rose-pale)',
            color: 'var(--rose-deep)',
            border: '1.5px solid var(--rose-light)',
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      )}

      {/* BARRA DE BÚSQUEDA */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            cargarClientes(1, busqueda);
          }}
          style={{ display: 'flex', gap: '10px', alignItems: 'center', flex: 1 }}
        >
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, teléfono o correo..."
            style={{
              width: '100%',
              maxWidth: '340px',
              background: 'var(--surface)',
              border: '1.5px solid var(--border)',
              borderRadius: '20px',
              padding: '8px 16px',
              color: 'var(--navy)',
              outline: 'none',
            }}
          />
          <button type="submit" className="btn btn-ghost">
            Buscar
          </button>
          {busqueda && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setBusqueda('');
                cargarClientes(1, '');
              }}
            >
              ✕ Limpiar
            </button>
          )}
        </form>
        <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600 }}>
          {totalRegistros} cliente{totalRegistros !== 1 ? 's' : ''}
        </span>
      </div>

      {/* TABLA DE CLIENTES */}
      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Teléfono</th>
                <th>Correo</th>
                <th>Sesiones</th>
                <th>Última sesión</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)' }}>
                    Cargando clientes...
                  </td>
                </tr>
              ) : clientes.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)' }}>
                    No se encontraron clientes.
                  </td>
                </tr>
              ) : (
                clientes.map((c, i) => {
                  const nombreCompleto = `${c.nombre || ''}${c.apellido ? ' ' + c.apellido : ''}`.trim();
                  return (
                    <tr key={c.id}>
                      <td>
                        <div className="client-cell">
                          <div className={`client-avatar ${AV_CLASSES[i % 5]}`}>
                            {(c.nombre || 'C').slice(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <div className="client-name">{nombreCompleto}</div>
                            {c.direccion && (
                              <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>{c.direccion}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>{c.telefono || '—'}</td>
                      <td>{c.email || '—'}</td>
                      <td style={{ fontWeight: 700, color: 'var(--navy)' }}>{c.total_sesiones || 0}</td>
                      <td>{c.ultima_cita ? formatoFecha(c.ultima_cita) : '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            style={{ padding: '4px 12px', fontSize: '11px' }}
                            onClick={() => verHistorial(c.id, nombreCompleto)}
                          >
                            Historial
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            style={{ padding: '4px 12px', fontSize: '11px' }}
                            onClick={() => abrirEditar(c)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            style={{
                              padding: '4px 12px',
                              fontSize: '11px',
                              color: 'var(--rose-deep)',
                              borderColor: 'var(--rose-light)',
                            }}
                            onClick={() => eliminarCliente(c.id, nombreCompleto)}
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PAGINACIÓN */}
      {totalPaginas > 1 && (
        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
          {Array.from({ length: totalPaginas }).map((_, idx) => {
            const p = idx + 1;
            const activa = p === pagina;
            return (
              <button
                key={p}
                type="button"
                onClick={() => cargarClientes(p, busqueda)}
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: '1.5px solid',
                  borderColor: activa ? 'var(--rose)' : 'var(--border)',
                  background: activa ? 'var(--rose)' : 'var(--surface)',
                  color: activa ? '#fff' : 'var(--text-mid)',
                }}
              >
                {p}
              </button>
            );
          })}
        </div>
      )}

      {/* MODAL CREAR / EDITAR CLIENTE */}
      {modalAbierto && (
        <div
          onClick={(e) => e.target === e.currentTarget && setModalAbierto(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(26,31,60,0.45)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '500px',
              boxShadow: 'var(--shadow-md)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                background: 'var(--surface2)',
              }}
            >
              <div className="font-cursive" style={{ fontSize: '22px', fontWeight: 700, color: 'var(--navy)', flex: 1 }}>
                {form.id > 0 ? 'Editar Cliente' : 'Nuevo Cliente'}
              </div>
              <button
                type="button"
                onClick={() => setModalAbierto(false)}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: 'var(--rose-pale)',
                  border: 'none',
                  color: 'var(--rose-deep)',
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={guardarCliente}>
              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 700 }}>
                    Nombre completo *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    placeholder="Ej: María García"
                    style={{
                      width: '100%',
                      marginTop: '4px',
                      background: 'var(--surface2)',
                      border: '1.5px solid var(--border)',
                      borderRadius: '10px',
                      padding: '9px 13px',
                      color: 'var(--navy)',
                      fontWeight: 600,
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 700 }}>
                      Teléfono
                    </label>
                    <input
                      type="text"
                      value={form.telefono}
                      onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                      placeholder="Ej: 314 000 0001"
                      style={{
                        width: '100%',
                        marginTop: '4px',
                        background: 'var(--surface2)',
                        border: '1.5px solid var(--border)',
                        borderRadius: '10px',
                        padding: '9px 13px',
                        color: 'var(--navy)',
                        fontWeight: 600,
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 700 }}>
                      Correo
                    </label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="correo@ejemplo.com"
                      style={{
                        width: '100%',
                        marginTop: '4px',
                        background: 'var(--surface2)',
                        border: '1.5px solid var(--border)',
                        borderRadius: '10px',
                        padding: '9px 13px',
                        color: 'var(--navy)',
                        fontWeight: 600,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 700 }}>
                    Dirección
                  </label>
                  <input
                    type="text"
                    value={form.direccion}
                    onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                    placeholder="Dirección del cliente"
                    style={{
                      width: '100%',
                      marginTop: '4px',
                      background: 'var(--surface2)',
                      border: '1.5px solid var(--border)',
                      borderRadius: '10px',
                      padding: '9px 13px',
                      color: 'var(--navy)',
                      fontWeight: 600,
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 700 }}>
                    Notas
                  </label>
                  <textarea
                    rows={3}
                    value={form.notas}
                    onChange={(e) => setForm({ ...form, notas: e.target.value })}
                    placeholder="Observaciones adicionales..."
                    style={{
                      width: '100%',
                      marginTop: '4px',
                      background: 'var(--surface2)',
                      border: '1.5px solid var(--border)',
                      borderRadius: '10px',
                      padding: '9px 13px',
                      color: 'var(--navy)',
                      fontWeight: 600,
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  padding: '14px 24px',
                  borderTop: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  background: 'var(--surface2)',
                }}
              >
                <button type="button" className="btn btn-ghost" onClick={() => setModalAbierto(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Guardar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL HISTORIAL DE SESIONES */}
      {modalHistorial && (
        <div
          onClick={(e) => e.target === e.currentTarget && setModalHistorial(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(26,31,60,0.45)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '600px',
              boxShadow: 'var(--shadow-md)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                background: 'var(--surface2)',
              }}
            >
              <div className="font-cursive" style={{ fontSize: '22px', fontWeight: 700, color: 'var(--navy)', flex: 1 }}>
                Historial de {clienteHistorial}
              </div>
              <button
                type="button"
                onClick={() => setModalHistorial(false)}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: 'var(--rose-pale)',
                  border: 'none',
                  color: 'var(--rose-deep)',
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {cargandoHistorial ? (
                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-dim)' }}>Cargando...</div>
              ) : sesionesHistorial.length === 0 ? (
                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-dim)' }}>
                  No hay sesiones registradas para este cliente.
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Fecha y Hora</th>
                      <th>Sesión</th>
                      <th>Pago</th>
                      <th>Entrega</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sesionesHistorial.map((s) => {
                      const fechaLimpia = String(s.fecha_sesion || '').split('T')[0];
                      const partes = fechaLimpia.split('-');
                      const linkHref =
                        partes.length === 3
                          ? `/sesiones?anio=${parseInt(partes[0], 10)}&mes=${parseInt(partes[1], 10)}&dia=${parseInt(partes[2], 10)}&sesion_id=${s.id}`
                          : `/sesiones?sesion_id=${s.id}`;
                      return (
                        <tr key={s.id}>
                          <td>
                            <div style={{ fontWeight: 700, color: 'var(--navy)' }}>{formatoFecha(s.fecha_sesion)}</div>
                            <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
                              {s.hora_sesion ? String(s.hora_sesion).substring(0, 5) : '—'}
                            </div>
                          </td>
                          <td style={{ fontWeight: 600 }}>{s.producto_nombre || 'Sesión General'}</td>
                          <td>
                            <span className={`status-pill pill-${s.estado_pago || 'pendiente'}`}>
                              {s.estado_pago || 'Pendiente'}
                            </span>
                          </td>
                          <td>
                            <span className={`status-pill pill-${s.estado_entrega || 'pendiente'}`}>
                              {labelEstadoEntrega(s.estado_entrega)}
                            </span>
                          </td>
                          <td>
                            <Link
                              href={linkHref}
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '4px 10px', fontSize: '11px' }}
                            >
                              Ver en Calendario
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

