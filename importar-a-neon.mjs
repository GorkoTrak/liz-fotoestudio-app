import fs from 'fs';
import { Pool } from '@neondatabase/serverless';

// Leer .env.local manualmente sin requerir librerías extra
const envPath = new URL('./.env.local', import.meta.url);
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split(/\r?\n/)) {
    const match = line.match(/^\s*DATABASE_URL\s*=\s*["']?([^"'\r\n]+)["']?/);
    if (match) process.env.DATABASE_URL = match[1].trim();
  }
}

if (!process.env.DATABASE_URL) {
  console.error('❌ ERROR: Primero pega tu DATABASE_URL="postgresql://..." dentro del archivo .env.local');
  process.exit(1);
}

const sqlContent = fs.readFileSync(new URL('./neon_migration.sql', import.meta.url), 'utf8');

async function importar() {
  console.log('⏳ Conectando a Neon y migrando todas las tablas y datos de Lizdy Fotoestudio...');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query(sqlContent);
    const res = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM usuarios) AS usuarios,
        (SELECT COUNT(*) FROM clientes) AS clientes,
        (SELECT COUNT(*) FROM productos) AS productos,
        (SELECT COUNT(*) FROM sesiones) AS sesiones,
        (SELECT COUNT(*) FROM facturas) AS facturas,
        (SELECT COUNT(*) FROM ingresos) AS ingresos
    `);
    console.log('✅ ¡MIGRACIÓN COMPLETADA CON ÉXITO EN NEON!');
    console.table(res.rows[0]);
  } catch (err) {
    console.error('❌ Error durante la migración:', err.message);
  } finally {
    await pool.end();
  }
}

importar();

