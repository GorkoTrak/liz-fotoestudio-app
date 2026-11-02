import crypto from 'crypto';
import { cookies } from 'next/headers';

const SECRET = process.env.AUTH_SECRET || process.env.DATABASE_URL || 'liz-fotoestudio-secret-key-2026';
export const COOKIE_NAME = 'liz_session';

export function crearToken(usuario) {
  const payload = {
    id: usuario.id,
    nombre: usuario.nombre,
    email: usuario.email,
    rol: usuario.rol,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 días
  };
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const firma = crypto.createHmac('sha256', SECRET).update(base64Payload).digest('base64url');
  return `${base64Payload}.${firma}`;
}

export function verificarToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [base64Payload, firma] = token.split('.');
  const firmaEsperada = crypto.createHmac('sha256', SECRET).update(base64Payload).digest('base64url');
  if (firma !== firmaEsperada) return null;
  try {
    const payload = JSON.parse(Buffer.from(base64Payload, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function obtenerUsuarioActual(request = null) {
  // 1. Soporte para App Móvil (Header Authorization: Bearer <token>)
  if (request) {
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const tokenMovil = authHeader.slice(7);
      const user = verificarToken(tokenMovil);
      if (user) return user;
    }
  }

  // 2. Soporte para Navegador Web (Cookie HTTP-only)
  const cookieStore = await cookies();
  const tokenCookie = cookieStore.get(COOKIE_NAME)?.value;
  if (!tokenCookie) return null;
  return verificarToken(tokenCookie);
}

export const getCurrentUser = obtenerUsuarioActual;


