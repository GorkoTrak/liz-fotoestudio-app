import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  console.warn('⚠️ Falta configurar DATABASE_URL en el archivo .env.local');
}

export const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;

export function getDB() {
  return sql;
}


