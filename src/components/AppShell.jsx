'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

export function resolverUrlFotoPerfil(fotoPerfil) {
  if (!fotoPerfil) return null;
  const str = String(fotoPerfil).trim();
  if (!str) return null;
  if (str.startsWith('data:') || str.startsWith('http://') || str.startsWith('https://') || str.startsWith('/')) {
    return str;
  }
  return `/uploads/${str}`;
}

export default function AppShell({
  title = 'Dashboard',
  usuario: usuarioProp,
  sesionesPendientes = 0,
  facturasPendientes = 0,
  actions = null,
  children,
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [usuarioInterno, setUsuarioInterno] = useState(usuarioProp || null);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (usuarioProp) {
      setUsuarioInterno(usuarioProp);
      setImgError(false);
    }
  }, [usuarioProp]);

  useEffect(() => {
    if (!usuarioProp || usuarioProp.foto_perfil === undefined) {
      fetch('/api/auth/me')
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.usuario) {
            setUsuarioInterno(data.usuario);
            setImgError(false);
          }
        })
        .catch(() => {});
    }
  }, [usuarioProp]);

  const usuario = usuarioInterno || usuarioProp;
  const esAdmin = usuario?.rol === 'admin';
  const fotoSrc = !imgError ? resolverUrlFotoPerfil(usuario?.foto_perfil) : null;

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  const fechaActual = new Date().toLocaleDateString('es-CO', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="app-shell">
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
        <div className="logo-area">
          <div className="logo-circle">
            <img src="/uploads/perfiles/logo.jpg" alt="Logo Lizdy Pineda" />
          </div>
          <div className="logo-name">Lizdy Pineda</div>
          <div className="logo-sub">Fotoestudio</div>
        </div>

        <nav>
          <div className="nav-section">Principal</div>
          <Link className={`nav-item ${pathname === '/' ? 'active' : ''}`} href="/">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
            </svg>
            Dashboard
          </Link>

          <Link className={`nav-item ${pathname.startsWith('/sesiones') ? 'active' : ''}`} href="/sesiones">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            Sesiones
            {sesionesPendientes > 0 && <span className="badge teal">{sesionesPendientes}</span>}
          </Link>

          <Link className={`nav-item ${pathname.startsWith('/clientes') ? 'active' : ''}`} href="/clientes">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
            </svg>
            Clientes
          </Link>

          <div className="nav-section">Negocio</div>
          <Link className={`nav-item ${pathname.startsWith('/productos') ? 'active' : ''}`} href="/productos">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            </svg>
            Productos / Servicios
          </Link>

          <Link className={`nav-item ${pathname.startsWith('/facturas') ? 'active' : ''}`} href="/facturas">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            Facturas
            {facturasPendientes > 0 && <span className="badge">{facturasPendientes}</span>}
          </Link>

          <Link className={`nav-item ${pathname.startsWith('/ingresos') ? 'active' : ''}`} href="/ingresos">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
            Panel de Ingresos
          </Link>

          {esAdmin && (
            <>
              <div className="nav-section">Administración</div>
              <Link className={`nav-item ${pathname.startsWith('/usuarios') ? 'active' : ''}`} href="/usuarios">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M20 21a8 8 0 1 0-16 0" />
                  <path d="M16 11l1.5 1.5L21 9" />
                </svg>
                Usuarios
              </Link>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="avatar-sm">
              {fotoSrc ? (
                <img
                  src={fotoSrc}
                  alt="Perfil"
                  onError={() => setImgError(true)}
                />
              ) : (
                (usuario?.nombre || 'U').slice(0, 1).toUpperCase()
              )}
            </div>
            <div>
              <div className="user-name">{usuario?.nombre || 'Usuario'}</div>
              <div className="user-role">{esAdmin ? 'Administrador' : 'Usuario'}</div>
            </div>
          </div>
          <button type="button" onClick={handleLogout} className="logout-btn">
            ↩ Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <button
            type="button"
            className="sidebar-toggle-btn"
            onClick={() => setCollapsed(!collapsed)}
            title="Mostrar/ocultar menú lateral"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <span className="page-title">{title}</span>
          <div className="topbar-sep" />
          <span className="topbar-date capitalize">{fechaActual}</span>
          {actions}
        </div>

        <div className="content">{children}</div>
      </div>
    </div>
  );
}
