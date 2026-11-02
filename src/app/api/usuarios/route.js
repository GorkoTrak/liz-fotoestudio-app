import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDB } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

let schemaChecked = false;
async function ensureUsuariosSchema(sql) {
  if (schemaChecked) return;
  try {
    await sql`ALTER TABLE usuarios ALTER COLUMN foto_perfil TYPE TEXT`;
    await sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS activo SMALLINT DEFAULT 1`;
    schemaChecked = true;
  } catch {
    // Ignorar si ya está aplicado
  }
}

export async function GET(request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    if (user.rol !== 'admin') {
      return NextResponse.json({ error: 'Acceso restringido a administradores' }, { status: 403 });
    }

    const sql = getDB();
    await ensureUsuariosSchema(sql);

    const usuarios = await sql`
      SELECT id, nombre, email, rol, foto_perfil, COALESCE(activo, 1)::int AS activo, fecha_registro::text AS fecha_registro
      FROM usuarios
      ORDER BY rol ASC, nombre ASC
    `;

    return NextResponse.json({ usuarios, currentUserId: user.id });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    if (user.rol !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const sql = getDB();
    await ensureUsuariosSchema(sql);

    const body = await request.json();
    const accion = body.accion || 'guardar';

    if (accion === 'guardar' || accion === 'crear' || accion === 'editar') {
      const uid = parseInt(body.id || '0', 10);
      const nombre = (body.nombre || '').trim();
      const email = (body.email || '').trim();
      const rol = body.rol === 'admin' ? 'admin' : 'usuario';
      const pass = body.password || '';
      const foto_perfil = body.foto_perfil || null;

      if (!nombre || !email) {
        return NextResponse.json({ error: 'Nombre y correo son obligatorios.' }, { status: 400 });
      }

      if (uid === 0 && pass.length < 4) {
        return NextResponse.json(
          { error: 'La contraseña es obligatoria al crear un usuario.' },
          { status: 400 }
        );
      }

      if (uid > 0) {
        const chk = await sql`
          SELECT id FROM usuarios WHERE LOWER(email) = LOWER(${email}) AND id <> ${uid} LIMIT 1
        `;
        if (chk.length > 0) {
          return NextResponse.json({ error: 'Ese correo ya está registrado por otro usuario.' }, { status: 400 });
        }

        if (pass !== '') {
          const hash = await bcrypt.hash(pass, 10);
          if (foto_perfil) {
            await sql`
              UPDATE usuarios
              SET nombre = ${nombre}, email = ${email}, rol = ${rol}, password = ${hash}, foto_perfil = ${foto_perfil}
              WHERE id = ${uid}
            `;
          } else {
            await sql`
              UPDATE usuarios
              SET nombre = ${nombre}, email = ${email}, rol = ${rol}, password = ${hash}
              WHERE id = ${uid}
            `;
          }
        } else {
          if (foto_perfil) {
            await sql`
              UPDATE usuarios
              SET nombre = ${nombre}, email = ${email}, rol = ${rol}, foto_perfil = ${foto_perfil}
              WHERE id = ${uid}
            `;
          } else {
            await sql`
              UPDATE usuarios
              SET nombre = ${nombre}, email = ${email}, rol = ${rol}
              WHERE id = ${uid}
            `;
          }
        }

        return NextResponse.json({ ok: true, mensaje: 'Usuario actualizado correctamente.' });
      } else {
        const chk = await sql`SELECT id FROM usuarios WHERE LOWER(email) = LOWER(${email}) LIMIT 1`;
        if (chk.length > 0) {
          return NextResponse.json({ error: 'Ese correo ya está registrado.' }, { status: 400 });
        }

        const hash = await bcrypt.hash(pass, 10);
        await sql`
          INSERT INTO usuarios (nombre, email, password, rol, foto_perfil, activo)
          VALUES (${nombre}, ${email}, ${hash}, ${rol}, ${foto_perfil}, 1)
        `;

        return NextResponse.json({ ok: true, mensaje: `Usuario "${nombre}" creado correctamente.` });
      }
    }

    if (accion === 'toggle') {
      const uid = parseInt(body.id || '0', 10);
      if (uid === Number(user.id)) {
        return NextResponse.json({ error: 'No puedes desactivar tu propia cuenta.' }, { status: 400 });
      }
      await sql`UPDATE usuarios SET activo = 1 - COALESCE(activo, 1) WHERE id = ${uid}`;
      return NextResponse.json({ ok: true, mensaje: 'Estado del usuario actualizado.' });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    if (user.rol !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const sql = getDB();
    const { searchParams } = new URL(request.url);
    const uid = parseInt(searchParams.get('id') || '0', 10);

    if (!uid) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    if (uid === Number(user.id)) {
      return NextResponse.json({ error: 'No puedes eliminar tu propia cuenta.' }, { status: 400 });
    }

    await sql`DELETE FROM usuarios WHERE id = ${uid}`;
    return NextResponse.json({ ok: true, mensaje: 'Usuario eliminado.' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
