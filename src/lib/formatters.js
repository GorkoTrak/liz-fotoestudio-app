// Funciones de formato equivalentes a las de config.php

export function formatoPeso(v) {
  const num = Number(v || 0);
  return '$' + Math.round(num).toLocaleString('es-CO');
}

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export function formatoFecha(f) {
  if (!f) return '—';
  const str = typeof f === 'string' ? f.slice(0, 10) : new Date(f).toISOString().slice(0, 10);
  const [anio, mes, dia] = str.split('-').map(Number);
  if (!anio || !mes || !dia) return '—';
  return `${String(dia).padStart(2, '0')} ${MESES[mes - 1]} ${anio}`;
}

export function formatoHora(h) {
  if (!h) return '—';
  const partes = String(h).split(':');
  if (partes.length < 2) return h;
  let horas = parseInt(partes[0], 10);
  const minutos = partes[1];
  const ampm = horas >= 12 ? 'PM' : 'AM';
  horas = horas % 12 || 12;
  return `${horas}:${minutos} ${ampm}`;
}

export function labelEstadoEntrega(e) {
  switch (e) {
    case 'sesion_realizada':
      return 'Sesión realizada';
    case 'editada':
    case 'en_edicion':
      return 'Editada';
    case 'entregada':
    case 'entregado':
      return 'Entregada';
    case 'impresion':
      return 'Impresión';
    case 'pendiente':
    default:
      return 'Pendiente';
  }
}

