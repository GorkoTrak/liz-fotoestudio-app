import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { sql } from '@/lib/db';
import { crearToken, COOKIE_NAME } from '@/lib/auth';

export async function POST(request) {
  try {
    const body = await request.json();
    const email = (body.email || '').trim();
    const password = body.password || '';

    if (!email || !password) {
      return NextResponse.json(
        { ok: false, error: 'Por favor completa todos los campos.' },
        { status: 400 }
      );
    }

    const filas = await sql`
      SELECT id, nombre, email, password, rol, foto_perfil
      FROM usuarios
      WHERE LOWER(email) = LOWER(${email})
      LIMIT 1
    `;

    if (filas.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'No existe una cuenta con ese correo.' },
        { status: 401 }
      );
    }

    const usuario = filas[0];
    // Compatibilidad con hashes $2y$ generados en PHP
    const hashCompatible = String(usuario.password).replace(/^\$2y\$/, '$2a$');
    const esValida = await bcrypt.compare(password, hashCompatible);

    if (!esValida) {
      return NextResponse.json(
        { ok: false, error: 'Contraseña incorrecta.' },
        { status: 401 }
      );
    }

    const datosUsuario = {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
      foto_perfil: usuario.foto_perfil,
    };

    const token = crearToken(datosUsuario);

    const response = NextResponse.json({
      ok: true,
      usuario: datosUsuario,
      token, // Listo para ser usado también desde la futura App Móvil
    });

    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 días
      sameSite: 'lax',
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: 'Error en el servidor: ' + error.message },
      { status: 500 }
    );
  }
}

