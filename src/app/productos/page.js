'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { formatoPeso } from '@/lib/formatters';

export default function ProductosPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState(null);
  const [productos, setProductos] = useState([]);
  const [resumen, setResumen] = useState({
    total_productos: 0,
    total_activos: 0,
    total_sesiones: 0,
    total_adicionales: 0,
  });
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  // Filtros
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('activo');
  const [filtroCategoria, setFiltroCategoria] = useState('');

  // Modal Crear / Editar
  const [modalAbierto, setModalAbierto] = useState(false);
  const [usandoNuevaCat, setUsandoNuevaCat] = useState(false);
  const [form, setForm] = useState({
    id: 0,
    tipo: 'sesion',
    nombre: '',
    descripcion: '',
    categoria: '',
    precio: '',
    estado: 'activo',
  });

  const cargarProductos = useCallback(async () => {
    setCargando(true);
    const res = await fetch('/api/productos');
    if (res.status === 401) {
      router.push('/login');
      return;
    }
    const data = await res.json();
    setUsuario(data.usuario);
    setProductos(data.productos || []);
    if (data.resumen) setResumen(data.resumen);
    setCargando(false);
  }, [router]);

  useEffect(() => {
    cargarProductos();
  }, [cargarProductos]);

  // Categorías disponibles según el filtro actual
  const categoriasFiltro = useMemo(() => {
    const set = new Set();
    for (const p of productos) {
      if (filtroTipo && p.tipo !== filtroTipo) continue;
      if (filtroEstado && p.estado !== filtroEstado) continue;
      if (p.categoria && p.categoria.trim()) set.add(p.categoria.trim());
    }
    return Array.from(set).sort();
  }, [productos, filtroTipo, filtroEstado]);

  // Categorías para el modal según el tipo elegido (sesion vs adicional)
  const categoriasModal = useMemo(() => {
    const set = new Set();
    for (const p of productos) {
      if (p.tipo === form.tipo && p.categoria && p.categoria.trim()) {
        set.add(p.categoria.trim());
      }
    }
    return Array.from(set).sort();
  }, [productos, form.tipo]);

  // Productos filtrados en pantalla
  const productosFiltrados = useMemo(() => {
    return productos.filter((p) => {
      if (filtroTipo && p.tipo !== filtroTipo) return false;
      if (filtroEstado && p.estado !== filtroEstado) return false;
      if (filtroCategoria && p.categoria !== filtroCategoria) return false;
      return true;
    });
  }, [productos, filtroTipo, filtroEstado, filtroCategoria]);

  function abrirNuevo() {
    setForm({
      id: 0,
      tipo: filtroTipo || 'sesion',
      nombre: '',
      descripcion: '',
      categoria: '',
      precio: '',
      estado: 'activo',
    });
    setUsandoNuevaCat(false);
    setModalAbierto(true);
  }

  function abrirEditar(p) {
    setForm({
      id: p.id,
      tipo: p.tipo || 'sesion',
      nombre: p.nombre || '',
      descripcion: p.descripcion || '',
      categoria: p.categoria || '',
      precio: p.precio || '',
      estado: p.estado || 'activo',
    });
    setUsandoNuevaCat(false);
    setModalAbierto(true);
  }

  async function guardarProducto(e) {
    e.preventDefault();
    setError('');
    setMensaje('');

    const res = await fetch('/api/productos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setError(data.error || 'Error al guardar.');
      return;
    }

    setMensaje(data.mensaje);
    setModalAbierto(false);
    cargarProductos();
  }

  async function toggleEstado(id) {
    const res = await fetch('/api/productos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'toggle_estado', id }),
    });
    const data = await res.json();
    if (data.ok) {
      setMensaje(data.mensaje);
      cargarProductos();
    }
  }

  async function eliminarProducto(id, nombre) {
    if (!window.confirm(`¿Eliminar "${nombre}"?\nSi tiene sesiones asociadas no se podrá eliminar.`)) return;
    const res = await fetch(`/api/productos?id=${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.ok) {
      setMensaje(data.mensaje);
      cargarProductos();
    } else {
      setError(data.error || 'No se pudo eliminar.');
    }
  }

  return (
    <AppShell
      title="Sesiones y Adicionales"
      usuario={usuario}
      actions={
        <button type="button" className="btn btn-primary" onClick={abrirNuevo}>
          + Nuevo elemento
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

      {/* 3 TARJETAS DE RESUMEN */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
        <div className="stat-card sc1">
          <div className="stat-label">Total activos</div>
          <div className="stat-value">{resumen.total_activos}</div>
          <div className="stat-sub">de {resumen.total_productos} registrados</div>
        </div>
        <div className="stat-card sc2">
          <div className="stat-label">Sesiones</div>
          <div className="stat-value">{resumen.total_sesiones}</div>
          <div className="stat-sub">servicios activos</div>
        </div>
        <div className="stat-card sc4">
          <div className="stat-label">Adicionales</div>
          <div className="stat-value">{resumen.total_adicionales}</div>
          <div className="stat-sub">adicionales activos</div>
        </div>
      </div>

      {/* BARRA DE FILTROS */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => {
            setFiltroTipo('');
            setFiltroEstado('activo');
            setFiltroCategoria('');
          }}
          style={{
            padding: '6px 14px',
            borderRadius: '20px',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
            border: '1.5px solid',
            borderColor: !filtroTipo && filtroEstado === 'activo' ? 'var(--rose)' : 'var(--border)',
            background: !filtroTipo && filtroEstado === 'activo' ? 'var(--rose)' : 'var(--surface)',
            color: !filtroTipo && filtroEstado === 'activo' ? '#fff' : 'var(--text-mid)',
          }}
        >
          Todos
        </button>

        <button
          type="button"
          onClick={() => {
            setFiltroTipo('sesion');
            setFiltroEstado('activo');
            setFiltroCategoria('');
          }}
          style={{
            padding: '6px 14px',
            borderRadius: '20px',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
            border: '1.5px solid',
            borderColor: filtroTipo === 'sesion' ? 'var(--rose)' : 'var(--border)',
            background: filtroTipo === 'sesion' ? 'var(--rose)' : 'var(--surface)',
            color: filtroTipo === 'sesion' ? '#fff' : 'var(--text-mid)',
          }}
        >
          📷 Sesiones
        </button>

        <button
          type="button"
          onClick={() => {
            setFiltroTipo('adicional');
            setFiltroEstado('activo');
            setFiltroCategoria('');
          }}
          style={{
            padding: '6px 14px',
            borderRadius: '20px',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
            border: '1.5px solid',
            borderColor: filtroTipo === 'adicional' ? 'var(--rose)' : 'var(--border)',
            background: filtroTipo === 'adicional' ? 'var(--rose)' : 'var(--surface)',
            color: filtroTipo === 'adicional' ? '#fff' : 'var(--text-mid)',
          }}
        >
          ➕ Adicionales
        </button>

        <button
          type="button"
          onClick={() => {
            setFiltroEstado(filtroEstado === 'inactivo' ? 'activo' : 'inactivo');
            setFiltroCategoria('');
          }}
          style={{
            padding: '6px 14px',
            borderRadius: '20px',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
            border: '1.5px solid',
            borderColor: filtroEstado === 'inactivo' ? 'var(--rose)' : 'var(--border)',
            background: filtroEstado === 'inactivo' ? 'var(--rose)' : 'var(--surface)',
            color: filtroEstado === 'inactivo' ? '#fff' : 'var(--text-mid)',
          }}
        >
          Inactivos
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <label style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
            Categoría
          </label>
          <select
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
            style={{
              minWidth: '190px',
              padding: '7px 12px',
              border: '1.5px solid var(--border)',
              borderRadius: '10px',
              background: 'var(--surface)',
              color: 'var(--text-mid)',
              fontWeight: 600,
              fontSize: '11px',
            }}
          >
            <option value="">Todas las categorías</option>
            {categoriasFiltro.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600, marginLeft: 'auto' }}>
          {productosFiltrados.length} resultado{productosFiltrados.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* CUADRÍCULA DE TARJETAS DE PRODUCTOS */}
      {cargando ? (
        <div style={{ textAlign: 'center', padding: '50px', color: 'var(--text-dim)' }}>Cargando catálogo...</div>
      ) : productosFiltrados.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '50px', color: 'var(--text-dim)' }}>
          Sin elementos en este filtro.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: '14px',
          }}
        >
          {productosFiltrados.map((p) => {
            const esSesion = p.tipo === 'sesion';
            return (
              <div
                key={p.id}
                className="card"
                style={{
                  opacity: p.estado === 'inactivo' ? 0.55 : 1,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div style={{ padding: '20px 20px 14px', flex: 1 }}>
                  <div
                    style={{
                      display: 'inline-flex',
                      padding: '3px 10px',
                      borderRadius: '20px',
                      fontSize: '10px',
                      fontWeight: 700,
                      marginBottom: '12px',
                      background: esSesion ? 'var(--rose-pale)' : '#fff4e0',
                      color: esSesion ? 'var(--rose-deep)' : '#b07a30',
                    }}
                  >
                    {esSesion ? 'Sesión' : 'Adicional'}
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--navy)', marginBottom: '6px' }}>
                    {p.nombre}
                  </div>
                  <div
                    style={{
                      fontSize: '11.5px',
                      color: 'var(--text-mid)',
                      lineHeight: 1.5,
                      whiteSpace: 'pre-line',
                      minHeight: '34px',
                    }}
                  >
                    {p.descripcion || 'Sin descripción.'}
                  </div>
                  {p.categoria && (
                    <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '8px', fontWeight: 700 }}>
                      Categoría: {p.categoria}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    padding: '12px 20px 14px',
                    borderTop: '1.5px dashed var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <div className="font-cursive" style={{ fontSize: '24px', fontWeight: 700, color: 'var(--rose-deep)', flex: 1 }}>
                    {formatoPeso(p.precio)}
                  </div>
                  <div
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: p.estado === 'activo' ? '#2a9d73' : 'var(--text-dim)',
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ padding: '4px 12px', fontSize: '11px' }}
                    onClick={() => toggleEstado(p.id)}
                  >
                    {p.estado === 'activo' ? 'Pausar' : 'Activar'}
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '6px', padding: '0 20px 16px' }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ flex: 1, justifyContent: 'center', padding: '5px 12px', fontSize: '11px' }}
                    onClick={() => abrirEditar(p)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{
                      padding: '5px 12px',
                      fontSize: '11px',
                      color: 'var(--rose-deep)',
                      borderColor: 'var(--rose-light)',
                    }}
                    onClick={() => eliminarProducto(p.id, p.nombre)}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL CREAR / EDITAR PRODUCTO */}
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
              maxWidth: '460px',
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
                {form.id > 0 ? 'Editar elemento' : 'Nuevo elemento'}
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

            <form onSubmit={guardarProducto}>
              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 700 }}>
                    Tipo *
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, tipo: 'sesion', categoria: '' })}
                      style={{
                        padding: '10px',
                        borderRadius: '10px',
                        border: '1.5px solid',
                        borderColor: form.tipo === 'sesion' ? 'var(--rose-light)' : 'var(--border)',
                        background: form.tipo === 'sesion' ? 'var(--rose-pale)' : 'transparent',
                        color: form.tipo === 'sesion' ? 'var(--rose-deep)' : 'var(--text-dim)',
                        fontWeight: 700,
                        fontSize: '11px',
                        cursor: 'pointer',
                      }}
                    >
                      📷 Sesión
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, tipo: 'adicional', categoria: '' })}
                      style={{
                        padding: '10px',
                        borderRadius: '10px',
                        border: '1.5px solid',
                        borderColor: form.tipo === 'adicional' ? 'var(--rose-light)' : 'var(--border)',
                        background: form.tipo === 'adicional' ? 'var(--rose-pale)' : 'transparent',
                        color: form.tipo === 'adicional' ? 'var(--rose-deep)' : 'var(--text-dim)',
                        fontWeight: 700,
                        fontSize: '11px',
                        cursor: 'pointer',
                      }}
                    >
                      ➕ Adicional
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 700 }}>
                    Nombre *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    placeholder="Ej: Quinceañera Premium"
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
                    Descripción
                  </label>
                  <textarea
                    rows={3}
                    value={form.descripcion}
                    onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                    placeholder="Qué incluye este servicio..."
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
                    Categoría *
                  </label>
                  {!usandoNuevaCat ? (
                    <select
                      required
                      value={form.categoria}
                      onChange={(e) => {
                        if (e.target.value === '__nueva__') {
                          setUsandoNuevaCat(true);
                          setForm({ ...form, categoria: '' });
                        } else {
                          setForm({ ...form, categoria: e.target.value });
                        }
                      }}
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
                    >
                      <option value="">Selecciona una categoría...</option>
                      {categoriasModal.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                      <option value="__nueva__">＋ Crear nueva categoría</option>
                    </select>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                      <input
                        type="text"
                        required
                        value={form.categoria}
                        onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                        placeholder="Nombre de la nueva categoría..."
                        style={{
                          flex: 1,
                          background: 'var(--surface2)',
                          border: '1.5px solid var(--border)',
                          borderRadius: '10px',
                          padding: '9px 13px',
                          color: 'var(--navy)',
                          fontWeight: 600,
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => setUsandoNuevaCat(false)}
                      >
                        Lista
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 700 }}>
                      Precio ($) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      required
                      value={form.precio}
                      onChange={(e) => setForm({ ...form, precio: e.target.value })}
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
                      Estado
                    </label>
                    <select
                      value={form.estado}
                      onChange={(e) => setForm({ ...form, estado: e.target.value })}
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
                    >
                      <option value="activo">Activo</option>
                      <option value="inactivo">Inactivo</option>
                    </select>
                  </div>
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
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}

