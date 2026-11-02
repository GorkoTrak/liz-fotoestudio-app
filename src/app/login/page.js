'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setCargando(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setError(data.error || 'Error al iniciar sesión');
        setCargando(false);
        return;
      }

      router.push('/');
      router.refresh();
    } catch {
      setError('No se pudo conectar con el servidor.');
      setCargando(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
        position: 'relative',
        overflow: 'hidden',
        padding: '16px',
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          border: '1.5px solid var(--border)',
          borderRadius: '24px',
          padding: '44px 40px',
          width: '100%',
          maxWidth: '400px',
          boxShadow: '0 8px 40px rgba(180,120,160,.15)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '28px' }}>
          <div className="logo-circle" style={{ width: '80px', height: '80px', marginBottom: '12px' }}>
            <img src="/uploads/perfiles/logo.jpg" alt="Logo Lizdy Pineda" />
          </div>
          <div className="font-cursive" style={{ fontSize: '26px', fontWeight: 700, color: 'var(--navy)' }}>
            Lizdy Pineda
          </div>
          <div
            style={{
              fontSize: '10px',
              color: 'var(--teal)',
              letterSpacing: '.22em',
              textTransform: 'uppercase',
              fontWeight: 600,
              marginTop: '4px',
            }}
          >
            Fotoestudio
          </div>
        </div>

        <h2
          style={{
            fontSize: '14px',
            color: 'var(--text-mid)',
            fontWeight: 600,
            textAlign: 'center',
            marginBottom: '24px',
          }}
        >
          Accede a tu sistema de gestión
        </h2>

        {error && (
          <div
            style={{
              background: 'var(--rose-pale)',
              border: '1.5px solid var(--rose-light)',
              color: 'var(--rose-deep)',
              borderRadius: '10px',
              padding: '10px 14px',
              fontSize: '12px',
              fontWeight: 600,
              marginBottom: '16px',
              textAlign: 'center',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
            <label
              style={{
                fontSize: '10px',
                letterSpacing: '.12em',
                textTransform: 'uppercase',
                color: 'var(--text-dim)',
                fontWeight: 700,
              }}
            >
              Correo electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@lizfotoestudio.com"
              required
              autoFocus
              style={{
                background: '#fdf5f8',
                border: '1.5px solid var(--border)',
                borderRadius: '12px',
                padding: '11px 14px',
                color: 'var(--navy)',
                fontSize: '13px',
                fontWeight: 600,
                outline: 'none',
                width: '100%',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
            <label
              style={{
                fontSize: '10px',
                letterSpacing: '.12em',
                textTransform: 'uppercase',
                color: 'var(--text-dim)',
                fontWeight: 700,
              }}
            >
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                background: '#fdf5f8',
                border: '1.5px solid var(--border)',
                borderRadius: '12px',
                padding: '11px 14px',
                color: 'var(--navy)',
                fontSize: '13px',
                fontWeight: 600,
                outline: 'none',
                width: '100%',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={cargando}
            style={{
              width: '100%',
              padding: '13px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, var(--rose), var(--rose-deep))',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 700,
              border: 'none',
              cursor: cargando ? 'wait' : 'pointer',
              boxShadow: '0 4px 16px rgba(196,84,122,.3)',
              marginTop: '6px',
              opacity: cargando ? 0.75 : 1,
            }}
          >
            {cargando ? 'Verificando en Neon...' : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
    </div>
  );
}

