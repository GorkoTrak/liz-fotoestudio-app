import fs from 'fs';
import path from 'path';
import { Pool } from '@neondatabase/serverless';

// 1. Leer .env.local automáticamente
let dbUrl = process.env.DATABASE_URL;
const envPath = new URL('./.env.local', import.meta.url);
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split(/\r?\n/)) {
    const match = line.match(/^\s*DATABASE_URL\s*=\s*["']?([^"'\r\n]+)["']?/);
    if (match) dbUrl = match[1].trim();
  }
}

if (!dbUrl) {
  console.error('❌ ERROR: No se encontró DATABASE_URL en .env.local');
  process.exit(1);
}

// 2. Ubicar el archivo liz_fotoestudio.sql (en XAMPP o en la carpeta local)
const rutasPosibles = [
  'c:/xampp/htdocs/liz-fotoestudio/liz_fotoestudio.sql',
  'C:/xampp/htdocs/liz-fotoestudio/liz_fotoestudio.sql',
  path.join(process.cwd(), 'liz_fotoestudio.sql'),
  path.join(process.cwd(), '..', 'liz-fotoestudio', 'liz_fotoestudio.sql'),
];

let sqlPath = '';
for (const p of rutasPosibles) {
  if (fs.existsSync(p)) {
    sqlPath = p;
    break;
  }
}

if (!sqlPath) {
  console.error('❌ ERROR: No se encontró el archivo "liz_fotoestudio.sql".');
  console.error('Colócalo en "c:\\xampp\\htdocs\\liz-fotoestudio\\liz_fotoestudio.sql" o en esta carpeta.');
  process.exit(1);
}

console.log(`📂 Archivo origen detectado: ${sqlPath}`);
const rawSql = fs.readFileSync(sqlPath, 'utf8');

// 3. Estructura de tablas en PostgreSQL (Neon)
const DDL = `
CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  email VARCHAR(200) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  rol VARCHAR(20) DEFAULT 'usuario' CHECK (rol IN ('admin', 'usuario')),
  foto_perfil VARCHAR(300) DEFAULT NULL,
  fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clientes (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  apellido VARCHAR(150) NOT NULL DEFAULT '',
  telefono VARCHAR(30) DEFAULT NULL,
  email VARCHAR(200) DEFAULT NULL,
  direccion VARCHAR(300) DEFAULT NULL,
  notas TEXT,
  fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS productos (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(200) NOT NULL,
  descripcion TEXT,
  precio NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  tipo VARCHAR(50) DEFAULT 'sesion',
  categoria VARCHAR(100) DEFAULT NULL,
  estado VARCHAR(20) DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS citas (
  id SERIAL PRIMARY KEY,
  cliente_id INT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  producto_id INT REFERENCES productos(id) ON DELETE SET NULL,
  fecha DATE NOT NULL,
  hora TIME DEFAULT NULL,
  duracion_min INT DEFAULT 60,
  estado VARCHAR(30) DEFAULT 'programada',
  observaciones TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sesiones (
  id SERIAL PRIMARY KEY,
  cliente_id INT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  cita_id INT REFERENCES citas(id) ON DELETE SET NULL,
  producto_id INT REFERENCES productos(id) ON DELETE SET NULL,
  fecha_sesion DATE NOT NULL,
  hora_sesion TIME DEFAULT NULL,
  total NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  abono NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  saldo NUMERIC(12,2) GENERATED ALWAYS AS (total - abono) STORED,
  estado_pago VARCHAR(20) DEFAULT 'pendiente' CHECK (estado_pago IN ('pendiente', 'abonado', 'pagado', 'reserva')),
  estado_entrega VARCHAR(30) DEFAULT 'pendiente',
  notas TEXT,
  metodo_pago VARCHAR(50) DEFAULT 'efectivo',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS facturas (
  id SERIAL PRIMARY KEY,
  sesion_id INT REFERENCES sesiones(id) ON DELETE SET NULL,
  cliente_id INT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  numero_factura VARCHAR(50) NOT NULL UNIQUE,
  total NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  abono NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  saldo NUMERIC(12,2) GENERATED ALWAYS AS (total - abono) STORED,
  metodo_pago VARCHAR(50) DEFAULT 'efectivo',
  estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'abonada', 'pagada', 'cancelada')),
  fecha_emision DATE DEFAULT CURRENT_DATE,
  fecha_vencimiento DATE DEFAULT NULL,
  notas TEXT
);

CREATE TABLE IF NOT EXISTS ingresos (
  id SERIAL PRIMARY KEY,
  factura_id INT REFERENCES facturas(id) ON DELETE SET NULL,
  sesion_id INT REFERENCES sesiones(id) ON DELETE SET NULL,
  cliente_id INT REFERENCES clientes(id) ON DELETE SET NULL,
  concepto VARCHAR(255) NOT NULL,
  monto NUMERIC(12,2) NOT NULL,
  tipo VARCHAR(20) DEFAULT 'ingreso' CHECK (tipo IN ('ingreso', 'egreso')),
  metodo_pago VARCHAR(50) DEFAULT 'efectivo',
  fecha DATE NOT NULL,
  notas TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sesion_fotos (
  id SERIAL PRIMARY KEY,
  sesion_id INT NOT NULL REFERENCES sesiones(id) ON DELETE CASCADE,
  categoria VARCHAR(50) DEFAULT 'sesion',
  grupo_desc VARCHAR(200) DEFAULT NULL,
  archivo VARCHAR(255) NOT NULL,
  descripcion VARCHAR(255) DEFAULT NULL,
  fecha_subida TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sesion_productos (
  id SERIAL PRIMARY KEY,
  sesion_id INT NOT NULL REFERENCES sesiones(id) ON DELETE CASCADE,
  producto_id INT NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
  cantidad INT NOT NULL DEFAULT 1,
  precio NUMERIC(12,2) NOT NULL DEFAULT 0.00
);
`;

const TABLAS_ORDENADAS = [
  'usuarios',
  'clientes',
  'productos',
  'citas',
  'sesiones',
  'facturas',
  'ingresos',
  'sesion_fotos',
  'sesion_productos',
];

async function importar() {
  console.log('⏳ Conectando a Neon...');
  const pool = new Pool({ connectionString: dbUrl });

  try {
    console.log('1. Asegurando estructura de tablas en Neon...');
    await pool.query(DDL);

    console.log('2. Vaciando tablas para reemplazo limpio...');
    await pool.query(`
      TRUNCATE TABLE sesion_productos, sesion_fotos, ingresos, facturas, sesiones, citas, productos, clientes, usuarios
      RESTART IDENTITY CASCADE;
    `);

    console.log(`3. Procesando datos desde "${path.basename(sqlPath)}"...`);

    for (const table of TABLAS_ORDENADAS) {
      const regex = new RegExp(
        'INSERT\\s+INTO\\s+[`"]?' + table + '[`"]?\\s*\\(([^)]+)\\)\\s*VALUES([\\s\\S]*?);',
        'gi'
      );

      let match;
      let insertsEncontrados = 0;
      while ((match = regex.exec(rawSql)) !== null) {
        const cols = match[1].replace(/[`"]/g, '').trim();
        let valuesPart = match[2].trim();

        // Convertir escapes MySQL a PostgreSQL estándar
        valuesPart = valuesPart
          .replace(/\\'/g, "''")
          .replace(/\\"/g, '"')
          .replace(/\\r\\n/g, '\\n')
          .replace(/\\n/g, '\n');

        const query = `INSERT INTO ${table} (${cols}) VALUES ${valuesPart};`;
        await pool.query(query);
        insertsEncontrados++;
      }

      // Sincronizar autoincremento (secuencias ID)
      await pool.query(`
        SELECT setval(
          pg_get_serial_sequence('${table}', 'id'),
          COALESCE((SELECT MAX(id) FROM ${table}), 1),
          true
        );
      `);

      if (insertsEncontrados > 0) {
        console.log(`   ✓ Tabla [${table}]: datos importados con éxito.`);
      }
    }

    // Mostrar resumen de conteo
    const res = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM usuarios) AS usuarios,
        (SELECT COUNT(*) FROM clientes) AS clientes,
        (SELECT COUNT(*) FROM productos) AS productos,
        (SELECT COUNT(*) FROM citas) AS citas,
        (SELECT COUNT(*) FROM sesiones) AS sesiones,
        (SELECT COUNT(*) FROM facturas) AS facturas,
        (SELECT COUNT(*) FROM ingresos) AS ingresos,
        (SELECT COUNT(*) FROM sesion_fotos) AS fotos,
        (SELECT COUNT(*) FROM sesion_productos) AS adicionales
    `);

    console.log('\n🎉 ¡MIGRACIÓN COMPLETADA CON ÉXITO EN NEON!');
    console.table(res.rows[0]);
  } catch (err) {
    console.error('❌ Error durante la importación:', err.message);
  } finally {
    await pool.end();
  }
}

importar();
