'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AppShell, { resolverUrlFotoPerfil } from '@/components/AppShell';
import { formatoFecha } from '@/lib/formatters';

const AV_CLASSES = ['av-a', 'av-b', 'av-c', 'av-d', 'av-e'];

function UserAvatar({ fotoPerfil, nombre, avClass }) {
  const [failed, setFailed] = useState(false);
  const src = !failed ? resolverUrlFotoPerfil(fotoPerfil) : null;
  const ini = (nombre || 'U').charAt(0).toUpperCase();

  useEffect(() => {
    setFailed(false);
  }, [fotoPerfil]);

  return (
    <div className={`user-avatar ${avClass}`}>
      {src ? (
        <img
          src={src}
          alt={nombre}
          onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        ini
      )}
    </div>
  );
}

// Redimensiona y comprime una imagen seleccionada a un avatar cuadrado ligero (Data URL)
function comprimirImagenAvatar(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const size = 220;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = reject;
      img.src = ev.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function UsuariosPage() {
  const router = useRouter();
  const [usuarios, setUsuarios] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(0);
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  // Modal Crear / Editar Usuario (idéntico a usuarios.php)
  const [modalOpen, setModalOpen] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [formUser, setFormUser] = useState({
    id: 0,
    nombre: '',
    email: '',
    password: '',
    rol: 'usuario',
    foto_perfil: '',
  });

  const cargarUsuarios = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/usuarios');
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
        setUsuarios(json.usuarios || []);
        setCurrentUserId(Number(json.currentUserId || 0));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    cargarUsuarios();
  }, [cargarUsuarios]);

  const abrirNuevo = () => {
    setError('');
    setPreviewFailed(false);
    setFormUser({
      id: 0,
      nombre: '',
      email: '',
      password: '',
      rol: 'usuario',
      foto_perfil: '',
    });
    setModalOpen(true);
  };

  const abrirEditar = (u) => {
    setError('');
    setPreviewFailed(false);
    setFormUser({
      id: u.id,
      nombre: u.nombre || '',
      email: u.email || '',
      password: '',
      rol: u.rol === 'admin' ? 'admin' : 'usuario',
      foto_perfil: u.foto_perfil || '',
    });
    setModalOpen(true);
  };

  const handleSeleccionarFoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await comprimirImagenAvatar(file);
      setPreviewFailed(false);
      setFormUser((prev) => ({ ...prev, foto_perfil: dataUrl }));
    } catch {
      setError('No se pudo procesar la imagen seleccionada.');
    }
  };

  const guardarUsuario = async (e) => {
    e.preventDefault();
    setError('');
    setMensaje('');
    try {
      const res = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'guardar', ...formUser }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Error al guardar usuario');
        return;
      }
      setMensaje(json.mensaje);
      setModalOpen(false);
      cargarUsuarios();
    } catch {
      setError('Error de conexión');
    }
  };

  const handleEliminar = async (u) => {
    if (!window.confirm(`¿Eliminar al usuario "${u.nombre}"?`)) return;
    setError('');
    setMensaje('');
    try {
      const res = await fetch(`/api/usuarios?id=${u.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (res.ok) {
        setMensaje(json.mensaje);
        cargarUsuarios();
      } else {
        setError(json.error || 'Error al eliminar');
      }
    } catch {
      setError('Error de conexión');
    }
  };

  const totalAdmin = usuarios.filter((u) => u.rol === 'admin').length;
  const totalUsuarios = usuarios.filter((u) => u.rol !== 'admin').length;
  const previewSrc = !previewFailed ? resolverUrlFotoPerfil(formUser.foto_perfil) : null;

  return (
    <AppShell
      title="Usuarios"
      actions={
        <button className="btn btn-primary" onClick={abrirNuevo}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nuevo Usuario
        </button>
      }
    >
      <style jsx>{`
        .stats-row-users { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; max-width: 420px; }
        .user-cell { display: flex; align-items: center; gap: 12px; }
        :global(.user-avatar) { width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: 'Dancing Script', cursive; font-size: 20px; font-weight: 700; flex-shrink: 0; overflow: hidden; }
        .rol-badge { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 20px; font-size: 10px; font-weight: 700; }
        .rol-admin { background: var(--rose-pale); color: var(--rose-deep); }
        .rol-usuario { background: var(--teal-pale); color: var(--teal-deep); }
        .foto-preview-wrap { display: flex; align-items: center; gap: 14px; margin-bottom: 6px; }
        .foto-preview { width: 64px; height: 64px; border-radius: 50%; background: var(--rose-pale); border: 2px solid var(--rose-light); overflow: hidden; display: flex; align-items: center; justify-content: center; font-family: 'Dancing Script', cursive; font-size: 28px; color: var(--rose-deep); flex-shrink: 0; }
        .foto-preview img { width: 100%; height: 100%; object-fit: cover; }
        .rol-selector { display: flex; gap: 8px; }
        .rol-btn { padding: 8px 20px; border-radius: 20px; border: 1.5px solid var(--border); cursor: pointer; font-size: 12px; font-weight: 700; color: var(--text-mid); background: var(--surface); transition: all .2s; }
        .rol-btn.active-admin { background: var(--rose-pale); border-color: var(--rose-light); color: var(--rose-deep); }
        .rol-btn.active-user { background: var(--teal-pale); border-color: var(--teal-light); color: var(--teal-deep); }
      `}</style>

      {mensaje && <div className="alert alert-success">✓ {mensaje}</div>}
      {error && <div className="alert alert-error">✕ {error}</div>}

      {/* CONTADORES */}
      <div className="stats-row-users">
        <div className="stat-card sc1">
          <div className="stat-label">Administradores</div>
          <div className="stat-value">{totalAdmin}</div>
        </div>
        <div className="stat-card sc2">
          <div className="stat-label">Usuarios</div>
          <div className="stat-value">{totalUsuarios}</div>
        </div>
      </div>

      {/* TABLA EQUIPO DE TRABAJO */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Equipo de Trabajo</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Registro</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="empty-row">Cargando usuarios...</td>
                </tr>
              ) : usuarios.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty-row">No hay usuarios registrados.</td>
                </tr>
              ) : (
                usuarios.map((u, idx) => {
                  const esYo = Number(u.id) === currentUserId;
                  return (
                    <tr key={u.id}>
                      <td>
                        <div className="user-cell">
                          <UserAvatar
                            fotoPerfil={u.foto_perfil}
                            nombre={u.nombre}
                            avClass={AV_CLASSES[idx % 5]}
                          />
                          <div>
                            <div style={{ fontSize: '13px', color: 'var(--navy)', fontWeight: 700 }}>
                              {u.nombre}
                            </div>
                            {esYo && (
                              <div style={{ fontSize: '10px', color: 'var(--teal-deep)', fontWeight: 700 }}>
                                Tú
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>{u.email}</td>
                      <td>
                        <span className={`rol-badge ${u.rol === 'admin' ? 'rol-admin' : 'rol-usuario'}`}>
                          {u.rol === 'admin' ? '👑 Admin' : '👤 Usuario'}
                        </span>
                      </td>
                      <td style={{ fontSize: '11px' }}>{formatoFecha(u.fecha_registro)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => abrirEditar(u)}
                          >
                            Editar
                          </button>
                          {!esYo && (
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleEliminar(u)}
                            >
                              Eliminar
                            </button>
                          )}
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

      {/* MODAL CREAR / EDITAR USUARIO CON FOTO DE PERFIL */}
      <div
        className={`modal-overlay ${modalOpen ? 'open' : ''}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) setModalOpen(false);
        }}
      >
        <div className="modal" style={{ maxWidth: '480px' }}>
          <div className="modal-header">
            <div className="modal-title">
              {formUser.id > 0 ? 'Editar Usuario' : 'Nuevo Usuario'}
            </div>
            <button className="modal-close" onClick={() => setModalOpen(false)}>
              ✕
            </button>
          </div>
          <form onSubmit={guardarUsuario}>
            <div className="modal-body">
              <div className="foto-preview-wrap">
                <div className="foto-preview">
                  {previewSrc ? (
                    <img
                      src={previewSrc}
                      alt="Vista previa"
                      onError={() => setPreviewFailed(true)}
                    />
                  ) : (
                    <span>
                      {formUser.nombre ? formUser.nombre.charAt(0).toUpperCase() : '?'}
                    </span>
                  )}
                </div>
                <div>
                  <label style={{ marginBottom: '6px', display: 'block' }}>
                    Foto de perfil
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    style={{ fontSize: '11px', color: 'var(--text-mid)' }}
                    onChange={handleSeleccionarFoto}
                  />
                  <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '4px' }}>
                    JPG, PNG, WEBP (se guarda en la base de datos)
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label>Nombre completo *</label>
                <input
                  className="form-input"
                  type="text"
                  value={formUser.nombre}
                  onChange={(e) => setFormUser({ ...formUser, nombre: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Correo electrónico *</label>
                <input
                  className="form-input"
                  type="email"
                  value={formUser.email}
                  onChange={(e) => setFormUser({ ...formUser, email: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Rol *</label>
                <div className="rol-selector">
                  <button
                    type="button"
                    className={`rol-btn ${formUser.rol === 'admin' ? 'active-admin' : ''}`}
                    onClick={() => setFormUser({ ...formUser, rol: 'admin' })}
                  >
                    👑 Admin
                  </button>
                  <button
                    type="button"
                    className={`rol-btn ${formUser.rol !== 'admin' ? 'active-user' : ''}`}
                    onClick={() => setFormUser({ ...formUser, rol: 'usuario' })}
                  >
                    👤 Usuario
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>
                  Contraseña{' '}
                  <span style={{ color: 'var(--text-dim)', fontSize: '9px' }}>
                    {formUser.id === 0 ? '(obligatoria al crear)' : '(dejar vacío para no cambiar)'}
                  </span>
                </label>
                <input
                  className="form-input"
                  type="password"
                  placeholder="Dejar vacío para no cambiar"
                  value={formUser.password}
                  onChange={(e) => setFormUser({ ...formUser, password: e.target.value })}
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
