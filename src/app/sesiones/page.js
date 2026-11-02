'use client';

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { formatoPeso, formatoFecha, formatoHora, labelEstadoEntrega } from '@/lib/formatters';

const MESES_NOMBRES = [
  '',
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];
const DIAS_NOMBRES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const AV_CLASSES = ['av-a', 'av-b', 'av-c', 'av-d', 'av-e'];
const COLORES_BLOQUE = ['', 'alt', 'alt2'];

const HORAS_OPCIONES = [];
for (let h = 6; h <= 22; h++) {
  for (const m of ['00', '30']) {
    const val = `${String(h).padStart(2, '0')}:${m}`;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    HORAS_OPCIONES.push({ value: val, label: `${String(h12).padStart(2, '0')}:${m} ${ampm}` });
  }
}

const HORAS_AGENDA = [];
for (let h = 8; h <= 20; h++) {
  HORAS_AGENDA.push(`${String(h).padStart(2, '0')}:00`);
}

function SesionesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const containerRef = useRef(null);

  const now = new Date();
  const targetSesionId = parseInt(
    searchParams.get('sesion_id') || searchParams.get('id') || '0',
    10
  );
  const autoEditarParam = searchParams.get('editar') === '1';

  const [anioC, setAnioC] = useState(
    searchParams.get('anio') ? parseInt(searchParams.get('anio'), 10) : now.getFullYear()
  );
  const [mesC, setMesC] = useState(
    searchParams.get('mes') ? parseInt(searchParams.get('mes'), 10) : now.getMonth() + 1
  );
  const [diaSeleccionado, setDiaSeleccionado] = useState(
    searchParams.get('dia') ? parseInt(searchParams.get('dia'), 10) : now.getDate()
  );
  const [navegandoManual, setNavegandoManual] = useState(false);
  const scrolledSesionRef = useRef(0);
  const [estadoFiltro, setEstadoFiltro] = useState(searchParams.get('estado') || '');
  const [entregaFiltro, setEntregaFiltro] = useState(searchParams.get('entrega') || '');
  const [pagina, setPagina] = useState(1);

  const [diasMes, setDiasMes] = useState(30);
  const [diaSemana, setDiaSemana] = useState(1);
  const [stats, setStats] = useState({ pagosPend: 0, entregasPend: 0, saldoPend: 0 });
  const [saldoOculto, setSaldoOculto] = useState(true);

  const [sesionesCalendario, setSesionesCalendario] = useState({});
  const [sesionesDelDia, setSesionesDelDia] = useState([]);
  const [listadoSesiones, setListadoSesiones] = useState([]);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [clientes, setClientes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);

  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  // ── Estado Formulario Nueva Sesión (Panel derecho) ──
  const [qClienteQuery, setQClienteQuery] = useState('');
  const [qClienteOpen, setQClienteOpen] = useState(false);
  const [qSesQuery, setQSesQuery] = useState('');
  const [qSesCat, setQSesCat] = useState('');
  const [qSesOpen, setQSesOpen] = useState(false);
  const [qAdicQuery, setQAdicQuery] = useState('');
  const [qAdicCat, setQAdicCat] = useState('');
  const [qAdicOpen, setQAdicOpen] = useState(false);

  const [qForm, setQForm] = useState({
    cliente_id: '',
    fecha_sesion: now.toISOString().split('T')[0],
    hora_sesion: '',
    producto_principal_id: '',
    adicionales: [],
    abono: '',
    metodo_pago: 'efectivo',
    estado_entrega: 'pendiente',
    notas: '',
  });

  // ── Estado Modal Editar Sesión ──
  const [modalEditOpen, setModalEditOpen] = useState(false);
  const [mClienteQuery, setMClienteQuery] = useState('');
  const [mClienteOpen, setMClienteOpen] = useState(false);
  const [mSesQuery, setMSesQuery] = useState('');
  const [mSesCat, setMSesCat] = useState('');
  const [mSesOpen, setMSesOpen] = useState(false);
  const [mAdicQuery, setMAdicQuery] = useState('');
  const [mAdicCat, setMAdicCat] = useState('');
  const [mAdicOpen, setMAdicOpen] = useState(false);

  const [mForm, setMForm] = useState({
    id: 0,
    cliente_id: '',
    fecha_sesion: '',
    hora_sesion: '',
    producto_principal_id: '',
    adicionales: [],
    abono: 0,
    metodo_pago: 'efectivo',
    estado_entrega: 'pendiente',
    notas: '',
    abonos: [],
  });

  // Formulario Nuevo Abono dentro del Modal Editar
  const [nuevoAbonoOpen, setNuevoAbonoOpen] = useState(false);
  const [nuevoAbonoForm, setNuevoAbonoForm] = useState({
    monto: '',
    metodo_pago: 'efectivo',
    fecha: now.toISOString().split('T')[0],
    notas: '',
  });

  // Modal Factura y Modal Eliminar
  const [modalFacSesion, setModalFacSesion] = useState(null);
  const [facAviso, setFacAviso] = useState(null);
  const facIframeRef = useRef(null);
  const pdfPromiseRef = useRef(null);
  const pdfFileRef = useRef(null);
  const [modalDelSesion, setModalDelSesion] = useState(null);
  const [modoEliminacion, setModoEliminacion] = useState('total');

  // Escuchar cuando el iframe de la factura termina de generar el PDF visual idéntico
  useEffect(() => {
    const onMessage = (e) => {
      if (e.data && e.data.type === 'FACTURA_PDF_READY') {
        const win = facIframeRef.current?.contentWindow;
        if (win?.__facturaPdfFile) {
          pdfFileRef.current = win.__facturaPdfFile;
        }
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Pre-cargar el archivo PDF en memoria apenas se abre el modal de factura
  // para que el botón "Enviar por WhatsApp" comparta el PDF al instante y copie el teléfono
  useEffect(() => {
    setFacAviso(null);
    pdfFileRef.current = null;
    pdfPromiseRef.current = null;

    if (!modalFacSesion?.factura_id) return;

    const urlPdf = `/api/facturas/${encodeURIComponent(modalFacSesion.factura_id)}/pdf`;
    const nombreArchivo = `Factura_${String(
      modalFacSesion.factura_numero || modalFacSesion.factura_id
    ).replace(/[^A-Za-z0-9\-]/g, '_')}.pdf`;

    pdfPromiseRef.current = fetch(urlPdf, { credentials: 'same-origin' })
      .then((r) => {
        const tipo = r.headers.get('Content-Type') || '';
        if (!r.ok || !tipo.includes('pdf')) throw new Error('No se pudo obtener el PDF');
        return r.blob();
      })
      .then((b) => {
        const file = new File([b], nombreArchivo, { type: 'application/pdf' });
        if (!pdfFileRef.current) {
          pdfFileRef.current = file;
        }
        return file;
      })
      .catch(() => null);
  }, [modalFacSesion]);

  const obtenerArchivoPdfModal = async () => {
    const win = facIframeRef.current?.contentWindow;
    if (win?.__facturaPdfFile) {
      pdfFileRef.current = win.__facturaPdfFile;
      return win.__facturaPdfFile;
    }
    if (typeof win?.__obtenerFacturaPdf === 'function') {
      const f = await win.__obtenerFacturaPdf();
      if (f) {
        pdfFileRef.current = f;
        return f;
      }
    }
    return pdfFileRef.current || (await pdfPromiseRef.current);
  };

  const descargarFacturaModal = async () => {
    if (!modalFacSesion?.factura_id) return;
    const nombreArchivo = `Factura_${String(
      modalFacSesion.factura_numero || modalFacSesion.factura_id
    ).replace(/[^A-Za-z0-9\-]/g, '_')}.pdf`;
    const archivo = await obtenerArchivoPdfModal();
    if (archivo) {
      const url = URL.createObjectURL(archivo);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombreArchivo;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } else {
      window.location.href = `/api/facturas/${modalFacSesion.factura_id}/pdf`;
    }
  };

  const enviarFacturaWhatsApp = async () => {
    if (!modalFacSesion?.factura_id) return;

    const telCliente = String(modalFacSesion.telefono || '').trim();
    // Copiar siempre el teléfono al portapapeles de inmediato tras el clic
    if (telCliente && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(telCliente);
      } catch {
        // continuar
      }
    }

    const soportaCompartir =
      typeof window !== 'undefined' &&
      window.isSecureContext &&
      typeof navigator.share === 'function' &&
      typeof navigator.canShare === 'function';

    if (!soportaCompartir) {
      setFacAviso({
        tipo: 'warn',
        texto: `⚠️ Este navegador o dirección no permite adjuntar archivos directamente (requiere localhost o https://). El número (${telCliente || 'cliente'}) ya fue copiado al portapapeles. Usa ⬇ Descargar PDF.`,
      });
      return;
    }

    const archivo =
      facIframeRef.current?.contentWindow?.__facturaPdfFile ||
      pdfFileRef.current ||
      (await obtenerArchivoPdfModal());

    if (!archivo || !navigator.canShare({ files: [archivo] })) {
      setFacAviso({
        tipo: 'warn',
        texto: `⚠️ No se pudo preparar el archivo PDF para compartir en este equipo. El número (${telCliente || 'cliente'}) fue copiado. Usa ⬇ Descargar PDF.`,
      });
      return;
    }

    const total = Number(modalFacSesion.factura_total ?? modalFacSesion.total ?? 0);
    const abono = Number(modalFacSesion.factura_abono ?? modalFacSesion.abono ?? 0);
    const saldo = Math.max(0, total - abono);
    const estadoFac = String(
      modalFacSesion.factura_estado || modalFacSesion.estado_pago || 'pendiente'
    );
    const estadoTexto = estadoFac.charAt(0).toUpperCase() + estadoFac.slice(1);

    const lineas = [
      `Hola ${modalFacSesion.nombre || ''}, te saludamos de *Liz Fotografía* 📸`,
      '',
      `Te compartimos la factura *${modalFacSesion.factura_numero || ''}* de tu sesión${
        modalFacSesion.fecha_sesion ? ` del ${formatoFecha(modalFacSesion.fecha_sesion)}` : ''
      }.`,
      '',
      `*Servicio:* ${modalFacSesion.servicio || 'Por definir'}`,
      `*Total:* ${formatoPeso(total)}`,
      `*Abono:* ${formatoPeso(abono)}`,
      `*Saldo pendiente:* ${formatoPeso(saldo)}`,
      `*Estado:* ${estadoTexto}`,
      '',
      'Adjuntamos el PDF de la factura. ¡Gracias por tu preferencia! 💖',
    ];
    const mensajeWA = lineas.join('\n');

    try {
      await navigator.share({
        files: [archivo],
        title: `Factura ${modalFacSesion.factura_numero || ''}`,
        text: mensajeWA,
      });
      setFacAviso({
        tipo: 'ok',
        texto: `✅ Factura compartida. Número (${telCliente || 'cliente'}) copiado: solo pégalo en el buscador de WhatsApp con Ctrl + V.`,
      });
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      setFacAviso({
        tipo: 'warn',
        texto: `⚠️ No se pudo abrir el panel de compartir (${e?.message || 'error'}). Usa ⬇ Descargar PDF.`,
      });
    }
  };

  // Cerrar dropdowns al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.cliente-search-wrapper')) {
        setQClienteOpen(false);
        setMClienteOpen(false);
      }
      if (!e.target.closest('.picker-sesion-q')) setQSesOpen(false);
      if (!e.target.closest('.picker-adic-q')) setQAdicOpen(false);
      if (!e.target.closest('.picker-sesion-m')) setMSesOpen(false);
      if (!e.target.closest('.picker-adic-m')) setMAdicOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      const sidParam = searchParams.get('sesion_id') || searchParams.get('id');

      if (sidParam && !navegandoManual) {
        params.set('sesion_id', sidParam);
        params.set('forzar_sesion', '1');
      } else {
        params.set('anio', String(anioC));
        params.set('mes', String(mesC));
        params.set('dia', String(diaSeleccionado));
        if (sidParam) params.set('sesion_id', sidParam);
      }
      if (estadoFiltro) params.set('estado', estadoFiltro);
      if (entregaFiltro) params.set('entrega', entregaFiltro);
      params.set('p', String(pagina));

      const res = await fetch(`/api/sesiones?${params.toString()}`);
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      const json = await res.json();
      if (res.ok) {
        if (sidParam && !navegandoManual && json.anioC && json.mesC && json.diaSeleccionado) {
          setAnioC(json.anioC);
          setMesC(json.mesC);
          setDiaSeleccionado(json.diaSeleccionado);
        }
        setDiasMes(json.diasMes || 30);
        setDiaSemana(json.diaSemana || 1);
        setStats(json.stats || { pagosPend: 0, entregasPend: 0, saldoPend: 0 });
        setSesionesCalendario(json.sesionesCalendario || {});
        setSesionesDelDia(json.sesionesDelDia || []);
        setListadoSesiones(json.listadoSesiones || []);
        setTotalPaginas(json.totalPaginas || 1);
        setClientes(json.clientes || []);
        setProductos(json.productos || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [anioC, mesC, diaSeleccionado, estadoFiltro, entregaFiltro, pagina, router, searchParams, navegandoManual]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // Enfocar y resaltar automáticamente la sesión cuando se llega desde Clientes o Dashboard
  useEffect(() => {
    if (!loading && targetSesionId > 0 && scrolledSesionRef.current !== targetSesionId) {
      const timer = setTimeout(() => {
        const blockEl = document.getElementById(`sesion-block-${targetSesionId}`);
        if (blockEl) {
          blockEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          scrolledSesionRef.current = targetSesionId;
        } else {
          const rowEl = document.getElementById(`sesion-row-${targetSesionId}`);
          if (rowEl) {
            rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            scrolledSesionRef.current = targetSesionId;
          }
        }
        if (autoEditarParam) {
          const sesObj = sesionesDelDia.find((s) => Number(s.id) === targetSesionId);
          if (sesObj) {
            abrirEditarSesion(sesObj);
            scrolledSesionRef.current = targetSesionId;
          }
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [loading, targetSesionId, sesionesDelDia, autoEditarParam]);

  useEffect(() => {
    const fechaSel = `${anioC}-${String(mesC).padStart(2, '0')}-${String(diaSeleccionado).padStart(2, '0')}`;
    setQForm((prev) => ({ ...prev, fecha_sesion: fechaSel }));
  }, [anioC, mesC, diaSeleccionado]);

  const buscarProducto = useCallback(
    (id) => productos.find((p) => Number(p.id) === Number(id)),
    [productos]
  );

  // Separación de productos y categorías igual que en sesiones.php
  const paquetes = useMemo(
    () => productos.filter((p) => ['sesion', 'combo'].includes(String(p.tipo || '').toLowerCase())),
    [productos]
  );
  const adicionalesCatalogo = useMemo(
    () =>
      productos.filter((p) =>
        ['adicional', 'producto'].includes(String(p.tipo || '').toLowerCase())
      ),
    [productos]
  );

  const categoriasSesion = useMemo(() => {
    const set = new Set();
    paquetes.forEach((p) => {
      if (p.categoria) set.add(p.categoria);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [paquetes]);

  const categoriasAdicional = useMemo(() => {
    const set = new Set();
    adicionalesCatalogo.forEach((p) => {
      if (p.categoria) set.add(p.categoria);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [adicionalesCatalogo]);

  // Agrupar agenda del día por hora igual que en sesiones.php
  const agendaDelDia = useMemo(() => {
    const porHora = {};
    const fuera = [];
    sesionesDelDia.forEach((se) => {
      if (se.hora_sesion) {
        const floor = `${se.hora_sesion.substring(0, 2)}:00`;
        if (HORAS_AGENDA.includes(floor)) {
          if (!porHora[floor]) porHora[floor] = [];
          porHora[floor].push(se);
        } else {
          fuera.push(se);
        }
      } else {
        fuera.push(se);
      }
    });
    const slots = [];
    HORAS_AGENDA.forEach((h) => {
      if (porHora[h] && porHora[h].length > 0) {
        slots.push({ hora: h, sesiones: porHora[h] });
      }
    });
    if (fuera.length > 0) {
      slots.push({ hora: 'Otras', sesiones: fuera });
    }
    return slots;
  }, [sesionesDelDia]);

  const calcularTotalForm = useCallback(
    (formState) => {
      const principal = buscarProducto(formState.producto_principal_id);
      let suma = principal ? Number(principal.precio || 0) : 0;
      (formState.adicionales || []).forEach((ad) => {
        const p = buscarProducto(ad.producto_id);
        if (p) suma += Number(p.precio || 0) * Math.max(1, Number(ad.cantidad || 1));
      });
      return Math.round(suma);
    },
    [buscarProducto]
  );

  // Cálculos en vivo para Nueva Sesión (qForm)
  const qTotal = calcularTotalForm(qForm);
  const qAbonoNum = Number(qForm.abono || 0);
  const qEstadoPago =
    qTotal > 0 && qAbonoNum >= qTotal
      ? 'Pagado'
      : qTotal === 0 && qAbonoNum > 0
      ? 'Reserva'
      : qAbonoNum > 0
      ? 'Abonado'
      : 'Pendiente';
  const qProductoSeleccionado = buscarProducto(qForm.producto_principal_id);

  // Cálculos en vivo para Modal Editar (mForm)
  const mTotal = calcularTotalForm(mForm);
  const mAbonoNum =
    mForm.abonos && mForm.abonos.length > 0
      ? mForm.abonos.reduce((acc, a) => acc + Number(a.monto || 0), 0)
      : Number(mForm.abono || 0);
  const mEstadoPago =
    mTotal > 0 && mAbonoNum >= mTotal
      ? 'Pagado'
      : mTotal === 0 && mAbonoNum > 0
      ? 'Reserva'
      : mAbonoNum > 0
      ? 'Abonado'
      : 'Pendiente';
  const mProductoSeleccionado = buscarProducto(mForm.producto_principal_id);

  const cambiarMes = (delta) => {
    setNavegandoManual(true);
    let nm = mesC + delta;
    let na = anioC;
    if (nm < 1) {
      nm = 12;
      na--;
    }
    if (nm > 12) {
      nm = 1;
      na++;
    }
    setMesC(nm);
    setAnioC(na);
    setDiaSeleccionado(1);
  };

  const irAHoy = () => {
    setNavegandoManual(true);
    const h = new Date();
    setAnioC(h.getFullYear());
    setMesC(h.getMonth() + 1);
    setDiaSeleccionado(h.getDate());
  };

  const guardarNuevaSesion = async (e) => {
    e.preventDefault();
    setError('');
    setMensaje('');
    if (!qForm.cliente_id) {
      setError('Selecciona un cliente de la lista.');
      return;
    }
    try {
      const res = await fetch('/api/sesiones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'guardar',
          id: 0,
          ...qForm,
          abono: Number(qForm.abono || 0),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Error al registrar sesión');
        return;
      }
      setMensaje(json.mensaje);
      setQClienteQuery('');
      setQSesQuery('');
      setQAdicQuery('');
      setQForm((prev) => ({
        ...prev,
        cliente_id: '',
        hora_sesion: '',
        producto_principal_id: '',
        adicionales: [],
        abono: '',
        notas: '',
      }));
      cargarDatos();
    } catch (err) {
      setError('Error de conexión');
    }
  };

  const abrirEditarSesion = (s) => {
    setError('');
    setNuevoAbonoOpen(false);
    const cli = clientes.find((c) => Number(c.id) === Number(s.cliente_id));
    setMClienteQuery(cli ? `${cli.nombre} ${cli.apellido || ''}`.trim() : s.nombre || '');
    const prodP = buscarProducto(s.producto_id);
    setMSesQuery(prodP ? prodP.nombre : '');
    setMAdicQuery('');
    let estEnt = s.estado_entrega || 'pendiente';
    if (estEnt === 'en_edicion') estEnt = 'editada';
    if (estEnt === 'entregado') estEnt = 'entregada';

    setMForm({
      id: s.id,
      cliente_id: s.cliente_id,
      fecha_sesion: s.fecha_sesion ? s.fecha_sesion.split('T')[0] : '',
      hora_sesion: s.hora_sesion ? s.hora_sesion.substring(0, 5) : '',
      producto_principal_id: s.producto_id || '',
      adicionales: Array.isArray(s.adicionales) ? [...s.adicionales] : [],
      abono: Number(s.abono || 0),
      metodo_pago: s.metodo_pago || 'efectivo',
      estado_entrega: estEnt,
      notas: s.notas || '',
      abonos: Array.isArray(s.abonos) ? [...s.abonos] : [],
    });
    setModalEditOpen(true);
  };

  const guardarEdicionSesion = async (e) => {
    e.preventDefault();
    setError('');
    setMensaje('');
    try {
      const res = await fetch('/api/sesiones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'guardar',
          ...mForm,
          abono: mAbonoNum,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Error al actualizar sesión');
        return;
      }
      setMensaje(json.mensaje);
      setModalEditOpen(false);
      cargarDatos();
    } catch (err) {
      setError('Error de conexión');
    }
  };

  const cambiarEntregaRapida = async (id, nuevoEstado) => {
    try {
      const res = await fetch('/api/sesiones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'actualizar_entrega', id, estado_entrega: nuevoEstado }),
      });
      const json = await res.json();
      if (res.ok) {
        setMensaje(json.mensaje);
        cargarDatos();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const registrarNuevoAbono = async () => {
    if (!mForm.id || Number(nuevoAbonoForm.monto) <= 0) {
      alert('Ingresa un monto válido para el abono.');
      return;
    }
    setError('');
    setMensaje('');
    try {
      const res = await fetch('/api/sesiones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'registrar_abono_sesion',
          sesion_id: mForm.id,
          monto: nuevoAbonoForm.monto,
          metodo_pago: nuevoAbonoForm.metodo_pago,
          fecha: nuevoAbonoForm.fecha,
          notas: nuevoAbonoForm.notas,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || 'Error al registrar abono');
        return;
      }
      setMensaje(json.mensaje);
      setModalEditOpen(false);
      cargarDatos();
    } catch (err) {
      alert('Error de conexión');
    }
  };

  const eliminarAbonoIndividual = async (abonoId, montoTexto) => {
    if (!window.confirm(`¿Eliminar este abono de ${montoTexto}?`)) return;
    try {
      const res = await fetch('/api/sesiones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'eliminar_abono_sesion',
          abono_id: abonoId,
          sesion_id: mForm.id,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setMensaje(json.mensaje);
        setModalEditOpen(false);
        cargarDatos();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const confirmarEliminacionSesion = async () => {
    if (!modalDelSesion) return;
    setError('');
    setMensaje('');
    try {
      const res = await fetch('/api/sesiones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'eliminar',
          id: modalDelSesion.id,
          modo_eliminacion: modoEliminacion,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setMensaje(json.mensaje);
        setModalDelSesion(null);
        cargarDatos();
      } else {
        setError(json.error || 'Error al eliminar');
      }
    } catch (e) {
      setError('Error de conexión');
    }
  };

  const renderSaldoDisplay = (totalVal, abonoVal) => {
    if (totalVal === 0 && abonoVal > 0) {
      return (
        <span style={{ color: 'var(--teal-deep)', fontWeight: 700, fontSize: '13px' }}>
          A favor (Reserva): {formatoPeso(abonoVal)}
        </span>
      );
    }
    if (totalVal > 0 && abonoVal > totalVal) {
      return (
        <span style={{ color: '#d9534f', fontWeight: 700, fontSize: '13px' }}>
          ⚠️ Excedente: +{formatoPeso(abonoVal - totalVal)}
        </span>
      );
    }
    return <span>{formatoPeso(Math.max(0, totalVal - abonoVal))}</span>;
  };

  let bloqueColorCounter = 0;

  return (
    <AppShell title="Sesiones Fotográficas">
      <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <style jsx>{`
          .stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
          .stat-card { background: var(--surface); border: 1.5px solid var(--border); border-radius: 14px; padding: 14px 18px; box-shadow: var(--shadow-sm); position: relative; overflow: hidden; }
          .stat-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; border-radius: 14px 14px 0 0; }
          .sc1::before { background: linear-gradient(90deg, var(--rose), var(--rose-light)); }
          .sc2::before { background: linear-gradient(90deg, #f0a500, #f5c842); }
          .sc3::before { background: linear-gradient(90deg, var(--teal), var(--teal-light)); }
          .stat-label { font-size: 10px; letter-spacing: .1em; color: var(--text-dim); text-transform: uppercase; font-weight: 700; margin-bottom: 4px; }
          .stat-value { font-family: 'Dancing Script', cursive; font-size: 28px; font-weight: 700; color: var(--navy); line-height: 1; }
          .stat-sub { font-size: 11px; color: var(--text-dim); margin-top: 3px; }
          .eye-btn { position: absolute; bottom: 14px; right: 14px; background: none; border: none; cursor: pointer; color: var(--text-dim); padding: 4px; border-radius: 6px; transition: color .2s; line-height: 0; }
          .eye-btn:hover { color: var(--lavender); }

          /* LAYOUT PRINCIPAL: CALENDARIO + PANEL NUEVA SESIÓN (360px) */
          .sesiones-grid { display: grid; grid-template-columns: 1fr 370px; gap: 16px; min-width: 0; align-items: start; }
          .sesiones-grid > * { min-width: 0; }

          .cal-header-inner { padding: 14px 18px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 10px; background: var(--surface2); }
          .cal-mes { font-family: 'Dancing Script', cursive; font-size: 22px; font-weight: 700; color: var(--navy); flex: 1; }
          .cal-nav { display: flex; gap: 6px; }
          .cal-nav-btn { width: 28px; height: 28px; border-radius: 50%; background: var(--rose-pale); border: 1.5px solid var(--rose-light); color: var(--rose-deep); display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; cursor: pointer; transition: background .2s; }
          .cal-nav-btn:hover { background: var(--rose-light); }
          .card-tag { font-size: 10px; font-weight: 700; color: var(--teal-deep); background: var(--teal-pale); border-radius: 20px; padding: 3px 10px; }

          .cal-grid { padding: 10px 14px 14px; display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; }
          .cal-day-name { text-align: center; font-size: 9px; font-weight: 700; letter-spacing: .08em; color: var(--text-dim); padding: 5px 0; text-transform: uppercase; }
          .cal-day { text-align: center; font-size: 12px; font-weight: 600; color: var(--text-mid); border-radius: 8px; cursor: pointer; transition: all .15s; min-height: 38px; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding-top: 5px; background: transparent; border: 1.5px solid transparent; }
          .cal-day:hover { background: var(--rose-pale); color: var(--rose-deep); }
          .cal-day.hoy { background: linear-gradient(135deg, var(--rose), var(--rose-deep)); color: #fff; font-weight: 700; }
          .cal-day.seleccionado:not(.hoy) { background: var(--rose-pale); color: var(--rose-deep); font-weight: 700; border: 1.5px solid var(--rose-light); }
          .cal-dots { display: flex; gap: 2px; justify-content: center; flex-wrap: wrap; margin-top: 3px; }
          .cal-dot { width: 5px; height: 5px; border-radius: 50%; }
          .dot-pendiente { background: var(--rose); }
          .dot-pagado { background: var(--teal-deep); }
          .dot-abonado { background: #c9943a; }
          .dot-reserva { background: #6750a4; }

          /* AGENDA DE HORAS DEL DÍA */
          .time-slots { display: flex; flex-direction: column; gap: 0; padding: 6px 20px 16px; }
          .time-slot { display: flex; gap: 14px; align-items: flex-start; min-height: 52px; padding: 4px 0; border-bottom: 1px dashed var(--border); }
          .time-slot:last-child { border-bottom: none; }
          .slot-time { width: 52px; font-size: 10.5px; color: var(--text-dim); flex-shrink: 0; padding-top: 7px; font-weight: 700; }
          .slot-line { width: 1.5px; background: var(--border); flex-shrink: 0; align-self: stretch; margin-top: 4px; }
          .slot-content { flex: 1; padding-bottom: 6px; min-width: 0; }
          .ses-block { border-radius: 10px; padding: 9px 13px; cursor: pointer; transition: all .18s; margin-bottom: 8px; background: var(--rose-pale); border: 1.5px solid var(--rose-light); border-left: 4px solid var(--rose); position: relative; }
          .ses-block:hover { transform: translateX(2px); }
          .ses-block.alt { background: var(--teal-pale); border: 1.5px solid var(--teal-light); border-left: 4px solid var(--teal); }
          .ses-block.alt2 { background: var(--lav-pale); border: 1.5px solid var(--lav-light); border-left: 4px solid var(--lavender); }
          .ses-block.highlight-sesion {
            border: 2px solid var(--rose) !important;
            border-left: 6px solid var(--rose-deep) !important;
            background: #fff4f8 !important;
            box-shadow: 0 0 0 4px rgba(232, 120, 154, 0.4), 0 8px 24px rgba(212, 85, 122, 0.25) !important;
            animation: sesionPulse 2s infinite ease-in-out;
          }
          @keyframes sesionPulse {
            0%, 100% { box-shadow: 0 0 0 4px rgba(232, 120, 154, 0.4), 0 8px 20px rgba(212, 85, 122, 0.2); }
            50% { box-shadow: 0 0 0 8px rgba(232, 120, 154, 0.7), 0 12px 28px rgba(212, 85, 122, 0.35); transform: scale(1.01); }
          }
          .ses-tag-highlight {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            background: var(--rose-deep);
            color: #fff;
            font-size: 9.5px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: .06em;
            padding: 3px 8px;
            border-radius: 6px;
            margin-bottom: 6px;
            box-shadow: 0 2px 6px rgba(212, 85, 122, 0.3);
          }
          tr.highlight-row td { background: var(--rose-pale) !important; font-weight: 600; }
          .ses-block-inner { display: flex; justify-content: space-between; gap: 16px; }
          .ses-notas-box { flex: 1; max-width: 40%; padding-left: 16px; border-left: 1px dashed rgba(0,0,0,0.1); display: flex; flex-direction: column; gap: 4px; font-size: 11.5px; color: var(--text-dim); align-self: stretch; }
          .ses-nombre { font-size: 13px; color: var(--navy); font-weight: 700; margin-bottom: 2px; }
          .ses-service { font-size: 11px; color: var(--text-mid); }
          .ses-monto { font-family: 'Dancing Script', cursive; font-size: 15px; color: var(--navy); margin-top: 3px; }
          .ses-saldo { font-size: 10px; color: var(--rose-deep); font-weight: 700; font-family: 'Nunito', sans-serif; }
          .ses-actions { display: flex; gap: 5px; margin-top: 6px; align-items: center; flex-wrap: wrap; }
          .empty-dia { padding: 36px 20px; text-align: center; color: var(--text-dim); font-size: 12px; font-style: italic; }

          /* FORMULARIO NUEVA SESIÓN Y MODAL EDITAR (ESTILO ORIGINAL ORGANIZADO) */
          .form-body { padding: 18px; }
          .form-group { display: flex; flex-direction: column; gap: 5px; margin-bottom: 13px; }
          .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
          .form-row3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; align-items: flex-start; }
          .divider { border: none; border-top: 1.5px dashed var(--border); margin: 6px 0 14px; }

          /* Buscador de cliente con ícono lupa */
          .cliente-search-wrapper { position: relative; }
          .cliente-search-input-row { position: relative; display: flex; align-items: center; }
          .cliente-search-input-row .search-icon { position: absolute; left: 12px; color: var(--text-dim); pointer-events: none; flex-shrink: 0; }
          .cliente-search-input { padding-left: 36px !important; width: 100%; }
          .cliente-dropdown { position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: var(--surface); border: 1.5px solid var(--border); border-radius: 10px; max-height: 200px; overflow-y: auto; z-index: 999; box-shadow: 0 4px 16px rgba(180,120,160,.18); }
          .cliente-option { padding: 9px 14px; cursor: pointer; font-size: 12.5px; font-weight: 600; color: var(--text); transition: background .15s; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(237,224,234,.5); }
          .cliente-option:last-child { border-bottom: none; }
          .cliente-option:hover { background: var(--rose-pale); color: var(--rose-deep); }

          /* Buscadores de sesiones y adicionales con filtro de categoría */
          .producto-picker { position: relative; display: flex; flex-direction: column; gap: 7px; }
          .producto-categoria { padding: 8px 12px !important; font-size: 11.5px !important; }
          .producto-dropdown { position: absolute; top: calc(100% - 1px); left: 0; right: 0; background: var(--surface); border: 1.5px solid var(--border); border-radius: 10px; max-height: 220px; overflow-y: auto; z-index: 1000; box-shadow: 0 6px 20px rgba(180,120,160,.18); }
          .producto-option { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 9px 12px; cursor: pointer; border-bottom: 1px solid var(--border); font-size: 11.5px; color: var(--navy); }
          .producto-option:last-child { border-bottom: none; }
          .producto-option:hover { background: var(--rose-pale); }
          .producto-option strong { display: block; font-weight: 700; }
          .producto-option small { display: block; color: var(--text-dim); font-size: 9.5px; margin-top: 2px; }
          .producto-option span { white-space: nowrap; font-weight: 700; color: var(--rose-deep); }
          .producto-empty { padding: 12px; text-align: center; color: var(--text-dim); font-size: 11px; }

          /* Paquete principal seleccionado */
          .producto-seleccionado { display: flex; align-items: center; justify-content: space-between; gap: 8px; background: var(--rose-pale); border: 1.5px solid var(--rose-light); border-radius: 10px; padding: 8px 10px; font-size: 11.5px; font-weight: 700; color: var(--navy); margin-top: 2px; }
          .producto-seleccionado b { margin-left: auto; color: var(--rose-deep); white-space: nowrap; }
          .producto-seleccionado button { width: 22px; height: 22px; border-radius: 50%; border: 0; background: var(--rose-light); color: var(--rose-deep); cursor: pointer; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }

          /* Lista de adicionales en verde agua (teal) */
          .adicionales-lista { display: flex; flex-direction: column; gap: 7px; margin-top: 6px; }
          .adicional-item { display: flex; align-items: center; gap: 7px; background: var(--teal-pale); border: 1.5px solid var(--teal-light); border-radius: 10px; padding: 7px 9px; }
          .adicional-info { flex: 1; min-width: 0; }
          .adicional-info strong { display: block; font-size: 11.5px; color: var(--navy); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .adicional-info small { display: block; font-size: 9.5px; color: var(--text-dim); margin-top: 2px; }
          .adicional-cantidad { width: 58px !important; padding: 5px 6px !important; text-align: center; background: #fff !important; }
          .btn-remove-serv { width: 22px; height: 22px; border-radius: 50%; background: var(--rose-light); border: none; color: var(--rose-deep); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex-shrink: 0; }

          /* Píldoras de estado y filtros */
          .status-pill { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 20px; font-size: 10px; font-weight: 700; }
          .status-pill::before { content: ''; width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
          .pill-pagado { background: #e8f8f4; color: #2a9d73; } .pill-pagado::before { background: #2a9d73; }
          .pill-abonado { background: #fff4e0; color: #b07a30; } .pill-abonado::before { background: #c9943a; }
          .pill-reserva { background: #e8def8; color: #6750a4; } .pill-reserva::before { background: #6750a4; }
          .pill-pendiente { background: var(--rose-pale); color: var(--rose-deep); } .pill-pendiente::before { background: var(--rose-deep); }
          .pill-sesion_realizada { background: #e3f2fd; color: #1976d2; } .pill-sesion_realizada::before { background: #1976d2; }
          .pill-editada, .pill-en_edicion { background: var(--lav-pale); color: var(--lavender); } .pill-editada::before, .pill-en_edicion::before { background: var(--lavender); }
          .pill-entregada, .pill-entregado { background: var(--teal-pale); color: var(--teal-deep); } .pill-entregada::before, .pill-entregado::before { background: var(--teal-deep); }
          .pill-impresion { background: #fff3e0; color: #e65100; } .pill-impresion::before { background: #e65100; }

          .filtros { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
          .filtro-btn { padding: 5px 14px; border-radius: 20px; font-size: 11px; font-weight: 700; border: 1.5px solid var(--border); background: var(--surface); color: var(--text-mid); cursor: pointer; transition: all .2s; }
          .filtro-btn:hover, .filtro-btn.active { background: var(--rose); border-color: var(--rose); color: #fff; }

          .client-cell { display: flex; align-items: center; gap: 10px; }
          .client-avatar { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: 'Dancing Script', cursive; font-size: 16px; font-weight: 700; flex-shrink: 0; }
          .av-a { background: var(--rose-pale); color: var(--rose-deep); }
          .av-b { background: var(--teal-pale); color: var(--teal-deep); }
          .av-c { background: var(--lav-pale); color: var(--lavender); }
          .av-d { background: var(--navy-soft); color: var(--navy-mid); }
          .av-e { background: #fef3e2; color: #b07a30; }
          .client-name { font-size: 13px; color: var(--navy); font-weight: 700; }
          .client-phone { font-size: 10px; color: var(--text-dim); }

          @media (max-width: 1100px) { .sesiones-grid { grid-template-columns: 1fr; } }
          @media (max-width: 768px) {
            .stats-row { grid-template-columns: 1fr; }
            .form-row, .form-row3 { grid-template-columns: 1fr; }
            .ses-block-inner { flex-direction: column; gap: 8px; }
            .ses-notas-box { max-width: 100%; padding-left: 0; border-left: none; border-top: 1px dashed rgba(0,0,0,0.12); padding-top: 6px; }
          }
        `}</style>

        {mensaje && <div className="alert alert-success">✓ {mensaje}</div>}
        {error && <div className="alert alert-error">✕ {error}</div>}

        {/* TARJETAS DE ESTADÍSTICAS */}
        <div className="stats-row">
          <div className="stat-card sc1">
            <div className="stat-label">Sin pagar</div>
            <div className="stat-value">{stats.pagosPend}</div>
            <div className="stat-sub">pendientes o abonadas</div>
          </div>
          <div className="stat-card sc2">
            <div className="stat-label">Saldo por cobrar</div>
            <div className="stat-value" style={{ fontSize: '22px' }}>
              {saldoOculto ? (
                <span style={{ fontFamily: 'Nunito, sans-serif', letterSpacing: '3px' }}>••••••</span>
              ) : (
                formatoPeso(stats.saldoPend)
              )}
            </div>
            <div className="stat-sub">en deuda</div>
            <button
              type="button"
              className="eye-btn"
              onClick={() => setSaldoOculto(!saldoOculto)}
              title="Mostrar/ocultar"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
                {saldoOculto ? (
                  <>
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </>
                ) : (
                  <>
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </>
                )}
              </svg>
            </button>
          </div>
          <div className="stat-card sc3">
            <div className="stat-label">Por entregar</div>
            <div className="stat-value">{stats.entregasPend}</div>
            <div className="stat-sub">sesiones</div>
          </div>
        </div>

        {/* CALENDARIO + PANEL NUEVA SESIÓN */}
        <div className="sesiones-grid">
          {/* COLUMNA IZQUIERDA: CALENDARIO Y AGENDA POR HORA */}
          <div className="card">
            <div className="cal-header-inner">
              <div className="cal-mes">
                {MESES_NOMBRES[mesC]} {anioC}
              </div>
              <div className="cal-nav">
                <button type="button" className="cal-nav-btn" onClick={() => cambiarMes(-1)}>
                  ‹
                </button>
                <button type="button" className="cal-nav-btn" onClick={irAHoy} title="Hoy">
                  ·
                </button>
                <button type="button" className="cal-nav-btn" onClick={() => cambiarMes(1)}>
                  ›
                </button>
              </div>
              <span className="card-tag">{MESES_NOMBRES[mesC]}</span>
            </div>

            <div className="cal-grid">
              {DIAS_NOMBRES.map((dn) => (
                <div key={dn} className="cal-day-name">
                  {dn}
                </div>
              ))}
              {Array.from({ length: Math.max(0, diaSemana - 1) }).map((_, i) => (
                <div key={`empty-${i}`} className="cal-day dim" />
              ))}
              {Array.from({ length: diasMes }, (_, i) => i + 1).map((d) => {
                const esHoy =
                  anioC === now.getFullYear() &&
                  mesC === now.getMonth() + 1 &&
                  d === now.getDate();
                const esSel = d === diaSeleccionado;
                const sesDia = sesionesCalendario[d] || [];
                return (
                  <button
                    key={d}
                    type="button"
                    className={`cal-day ${esHoy ? 'hoy' : ''} ${esSel ? 'seleccionado' : ''}`}
                    onClick={() => {
                      setNavegandoManual(true);
                      setDiaSeleccionado(d);
                    }}
                  >
                    {d}
                    {sesDia.length > 0 && (
                      <div className="cal-dots">
                        {sesDia.slice(0, 3).map((se) => (
                          <div key={se.id} className={`cal-dot dot-${se.estado_pago}`} />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Leyenda del calendario */}
            <div style={{ padding: '0 18px 14px', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: 'var(--text-dim)', fontWeight: 600 }}>
                <div className="cal-dot dot-pagado" style={{ display: 'inline-block' }} /> Pagada
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: 'var(--text-dim)', fontWeight: 600 }}>
                <div className="cal-dot dot-abonado" style={{ display: 'inline-block' }} /> Abonada
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: 'var(--text-dim)', fontWeight: 600 }}>
                <div className="cal-dot dot-pendiente" style={{ display: 'inline-block' }} /> Pendiente
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: 'var(--text-dim)', fontWeight: 600 }}>
                <div className="cal-dot dot-reserva" style={{ display: 'inline-block' }} /> Reserva
              </div>
            </div>

            <div style={{ borderTop: '1.5px dashed var(--border)', margin: '0 20px' }} />

            <div style={{ padding: '12px 20px 6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontFamily: "'Dancing Script', cursive", fontSize: '18px', fontWeight: 700, color: 'var(--navy)' }}>
                {diaSeleccionado} {MESES_NOMBRES[mesC]}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600, marginLeft: 'auto' }}>
                {sesionesDelDia.length} sesión{sesionesDelDia.length !== 1 ? 'es' : ''}
              </span>
            </div>

            <div className="time-slots">
              {agendaDelDia.length === 0 ? (
                <div className="empty-dia">Sin sesiones este día</div>
              ) : (
                agendaDelDia.map((slot) => (
                  <div key={slot.hora} className="time-slot">
                    <div className="slot-time">
                      {slot.hora === 'Otras' ? 'Otras' : formatoHora(`${slot.hora}:00`)}
                    </div>
                    <div className="slot-line" />
                    <div className="slot-content">
                      {slot.sesiones.map((se) => {
                        const colorCls = COLORES_BLOQUE[bloqueColorCounter % 3];
                        bloqueColorCounter++;
                        const esTarget = targetSesionId === Number(se.id);
                        return (
                          <div
                            key={se.id}
                            id={`sesion-block-${se.id}`}
                            className={`ses-block ${colorCls} ${esTarget ? 'highlight-sesion' : ''}`}
                            onClick={() => abrirEditarSesion(se)}
                          >
                            <div className="ses-block-inner">
                              <div style={{ flex: 1 }}>
                                {esTarget && (
                                  <div className="ses-tag-highlight">
                                    📍 Sesión Seleccionada
                                  </div>
                                )}
                                <div className="ses-nombre">
                                  {se.nombre} {se.apellido}
                                </div>
                                <div className="ses-service">
                                  {se.hora_sesion ? `${formatoHora(se.hora_sesion)} · ` : ''}
                                  {se.servicio || 'Por definir'}
                                </div>
                                <div className="ses-monto">
                                  {formatoPeso(se.total)}
                                  {Number(se.saldo || 0) > 0 && se.estado_pago !== 'pagado' && (
                                    <span className="ses-saldo"> · Saldo: {formatoPeso(se.saldo)}</span>
                                  )}
                                </div>
                                <div className="ses-actions" onClick={(e) => e.stopPropagation()}>
                                  <select
                                    className="form-input"
                                    style={{ padding: '3px 8px', fontSize: '11px', width: 'auto' }}
                                    value={
                                      ['editada', 'en_edicion'].includes(se.estado_entrega)
                                        ? 'editada'
                                        : ['entregada', 'entregado'].includes(se.estado_entrega)
                                        ? 'entregada'
                                        : se.estado_entrega || 'pendiente'
                                    }
                                    onChange={(e) => cambiarEntregaRapida(se.id, e.target.value)}
                                  >
                                    <option value="pendiente">Pendiente</option>
                                    <option value="sesion_realizada">Sesión realizada</option>
                                    <option value="editada">Editada</option>
                                    <option value="entregada">Entregada</option>
                                    <option value="impresion">Impresión</option>
                                  </select>
                                  <span className={`status-pill pill-${se.estado_pago}`}>
                                    {se.estado_pago
                                      ? se.estado_pago.charAt(0).toUpperCase() + se.estado_pago.slice(1)
                                      : ''}
                                  </span>
                                  <button
                                    type="button"
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => setModalFacSesion(se)}
                                  >
                                    🧾 Factura
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => abrirEditarSesion(se)}
                                  >
                                    Editar
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-danger btn-sm"
                                    onClick={() => {
                                      setModoEliminacion('total');
                                      setModalDelSesion(se);
                                    }}
                                  >
                                    Eliminar
                                  </button>
                                </div>
                              </div>

                              {se.notas && (
                                <div className="ses-notas-box">
                                  <div
                                    style={{
                                      fontWeight: 700,
                                      textTransform: 'uppercase',
                                      fontSize: '9.5px',
                                      letterSpacing: '0.05em',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      color: 'var(--navy)',
                                    }}
                                  >
                                    📝 Observaciones
                                  </div>
                                  <div style={{ lineHeight: 1.4, maxHeight: '75px', overflowY: 'auto' }}>
                                    {se.notas}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* COLUMNA DERECHA: PANEL NUEVA SESIÓN (ORGANIZADO COMO EL ORIGINAL) */}
          <div className="card" style={{ alignSelf: 'start', overflow: 'visible' }}>
            <div className="card-header">
              <div className="card-title">Nueva Sesión</div>
            </div>
            <form onSubmit={guardarNuevaSesion}>
              <div className="form-body">
                {/* 1. CLIENTE */}
                <div className="form-group">
                  <label>Cliente *</label>
                  <div className="cliente-search-wrapper">
                    <div className="cliente-search-input-row">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        width="16"
                        height="16"
                        className="search-icon"
                      >
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                      </svg>
                      <input
                        type="text"
                        className="form-input cliente-search-input"
                        placeholder="Buscar por nombre o teléfono..."
                        autoComplete="off"
                        value={qClienteQuery}
                        onFocus={() => setQClienteOpen(true)}
                        onChange={(e) => {
                          setQClienteQuery(e.target.value);
                          setQClienteOpen(true);
                          if (!e.target.value) setQForm({ ...qForm, cliente_id: '' });
                        }}
                      />
                    </div>
                    {qClienteOpen && (
                      <div className="cliente-dropdown">
                        {clientes
                          .filter((c) => {
                            const full = `${c.nombre} ${c.apellido || ''} ${c.telefono || ''}`.toLowerCase();
                            return !qClienteQuery || full.includes(qClienteQuery.toLowerCase());
                          })
                          .slice(0, 25)
                          .map((c) => (
                            <div
                              key={c.id}
                              className="cliente-option"
                              onClick={() => {
                                setQForm({ ...qForm, cliente_id: c.id });
                                setQClienteQuery(`${c.nombre} ${c.apellido || ''}`.trim());
                                setQClienteOpen(false);
                              }}
                            >
                              <span>
                                {c.nombre} {c.apellido}
                              </span>
                              {c.telefono && (
                                <small style={{ color: 'var(--text-dim)', fontSize: '10.5px' }}>
                                  {c.telefono}
                                </small>
                              )}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. FECHA Y HORA */}
                <div className="form-row">
                  <div className="form-group">
                    <label>Fecha *</label>
                    <input
                      className="form-input"
                      type="date"
                      value={qForm.fecha_sesion}
                      onChange={(e) => setQForm({ ...qForm, fecha_sesion: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Hora *</label>
                    <select
                      className="form-input"
                      value={qForm.hora_sesion}
                      onChange={(e) => setQForm({ ...qForm, hora_sesion: e.target.value })}
                      required
                    >
                      <option value="">Seleccione hora...</option>
                      {HORAS_OPCIONES.map((h) => (
                        <option key={h.value} value={h.value}>
                          {h.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 3. TIPO DE SESIÓN (BUSCADOR + FILTRO CATEGORÍA + PÍLDORA SELECCIONADA) */}
                <div className="form-group">
                  <label>Tipo de sesión *</label>
                  <div className="producto-picker picker-sesion-q">
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Buscar sesión por nombre..."
                      autoComplete="off"
                      value={qSesQuery}
                      onFocus={() => setQSesOpen(true)}
                      onChange={(e) => {
                        setQSesQuery(e.target.value);
                        setQSesOpen(true);
                      }}
                    />
                    <select
                      className="form-input producto-categoria"
                      value={qSesCat}
                      onChange={(e) => {
                        setQSesCat(e.target.value);
                        setQSesOpen(true);
                      }}
                    >
                      <option value="">Todas las categorías</option>
                      {categoriasSesion.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>

                    {qSesOpen && (
                      <div className="producto-dropdown">
                        {(() => {
                          const items = paquetes.filter(
                            (p) =>
                              (!qSesQuery ||
                                p.nombre.toLowerCase().includes(qSesQuery.toLowerCase())) &&
                              (!qSesCat || p.categoria === qSesCat)
                          );
                          if (items.length === 0) {
                            return <div className="producto-empty">No hay resultados.</div>;
                          }
                          return items.map((p) => (
                            <div
                              key={p.id}
                              className="producto-option"
                              onClick={() => {
                                setQForm({ ...qForm, producto_principal_id: p.id });
                                setQSesQuery(p.nombre);
                                setQSesOpen(false);
                              }}
                            >
                              <div>
                                <strong>{p.nombre}</strong>
                                <small>{p.categoria || 'Sin categoría'}</small>
                              </div>
                              <span>{formatoPeso(p.precio)}</span>
                            </div>
                          ));
                        })()}
                      </div>
                    )}

                    {qProductoSeleccionado && (
                      <div className="producto-seleccionado">
                        <span>{qProductoSeleccionado.nombre}</span>
                        <b>{formatoPeso(qProductoSeleccionado.precio)}</b>
                        <button
                          type="button"
                          onClick={() => {
                            setQForm({ ...qForm, producto_principal_id: '' });
                            setQSesQuery('');
                          }}
                          title="Quitar sesión"
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* 4. ADICIONALES (BUSCADOR + FILTRO CATEGORÍA + LISTA TEAL) */}
                <div className="form-group">
                  <label>Adicionales</label>
                  <div className="producto-picker picker-adic-q">
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Buscar adicional por nombre..."
                      autoComplete="off"
                      value={qAdicQuery}
                      onFocus={() => setQAdicOpen(true)}
                      onChange={(e) => {
                        setQAdicQuery(e.target.value);
                        setQAdicOpen(true);
                      }}
                    />
                    <select
                      className="form-input producto-categoria"
                      value={qAdicCat}
                      onChange={(e) => {
                        setQAdicCat(e.target.value);
                        setQAdicOpen(true);
                      }}
                    >
                      <option value="">Todas las categorías</option>
                      {categoriasAdicional.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>

                    {qAdicOpen && (
                      <div className="producto-dropdown">
                        {(() => {
                          const items = adicionalesCatalogo.filter(
                            (p) =>
                              (!qAdicQuery ||
                                p.nombre.toLowerCase().includes(qAdicQuery.toLowerCase())) &&
                              (!qAdicCat || p.categoria === qAdicCat)
                          );
                          if (items.length === 0) {
                            return <div className="producto-empty">No hay resultados.</div>;
                          }
                          return items.map((p) => (
                            <div
                              key={p.id}
                              className="producto-option"
                              onClick={() => {
                                const list = [...qForm.adicionales];
                                const ex = list.find((a) => Number(a.producto_id) === Number(p.id));
                                if (ex) ex.cantidad += 1;
                                else list.push({ producto_id: p.id, cantidad: 1 });
                                setQForm({ ...qForm, adicionales: list });
                                setQAdicQuery('');
                                setQAdicOpen(false);
                              }}
                            >
                              <div>
                                <strong>{p.nombre}</strong>
                                <small>{p.categoria || 'Sin categoría'}</small>
                              </div>
                              <span>{formatoPeso(p.precio)}</span>
                            </div>
                          ));
                        })()}
                      </div>
                    )}
                  </div>

                  {qForm.adicionales.length > 0 && (
                    <div className="adicionales-lista">
                      {qForm.adicionales.map((ad, idx) => {
                        const pr = buscarProducto(ad.producto_id);
                        if (!pr) return null;
                        return (
                          <div key={ad.producto_id} className="adicional-item">
                            <div className="adicional-info">
                              <strong>{pr.nombre}</strong>
                              <small>
                                {pr.categoria || 'Sin categoría'} · {formatoPeso(pr.precio)}
                              </small>
                            </div>
                            <input
                              className="form-input adicional-cantidad"
                              type="number"
                              min="1"
                              step="1"
                              value={ad.cantidad}
                              onChange={(e) => {
                                const list = [...qForm.adicionales];
                                list[idx].cantidad = Math.max(
                                  1,
                                  parseInt(e.target.value || '1', 10)
                                );
                                setQForm({ ...qForm, adicionales: list });
                              }}
                            />
                            <button
                              type="button"
                              className="btn-remove-serv"
                              onClick={() => {
                                const list = qForm.adicionales.filter((_, i) => i !== idx);
                                setQForm({ ...qForm, adicionales: list });
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <hr className="divider" />

                {/* 5. TOTAL, ABONO RESERVA Y SALDO PENDIENTE */}
                <div className="form-row" style={{ alignItems: 'flex-start' }}>
                  <div className="form-group">
                    <label>Total ($)</label>
                    <input
                      className="form-input"
                      type="number"
                      value={qTotal}
                      placeholder="0"
                      readOnly
                    />
                  </div>
                  <div className="form-group">
                    <label>Abono Reserva ($)</label>
                    <input
                      className="form-input"
                      type="number"
                      min="0"
                      step="1000"
                      placeholder="0"
                      value={qForm.abono}
                      onChange={(e) => setQForm({ ...qForm, abono: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '-4px' }}>
                  <label>Saldo Pendiente</label>
                  <div
                    style={{
                      fontSize: '16px',
                      fontWeight: 700,
                      color: 'var(--rose-deep)',
                      paddingTop: '2px',
                    }}
                  >
                    {renderSaldoDisplay(qTotal, qAbonoNum)}
                  </div>
                </div>

                {/* 6. ESTADO DE PAGO Y MÉTODO DE PAGO */}
                <div className="form-row">
                  <div className="form-group">
                    <label>Estado pago</label>
                    <input className="form-input" value={qEstadoPago} readOnly />
                  </div>
                  <div className="form-group">
                    <label>Método pago</label>
                    <select
                      className="form-input"
                      value={qForm.metodo_pago}
                      onChange={(e) => setQForm({ ...qForm, metodo_pago: e.target.value })}
                    >
                      <option value="efectivo">Efectivo</option>
                      <option value="transferencia">Transferencia</option>
                      <option value="nequi">Nequi</option>
                      <option value="daviplata">Daviplata</option>
                      <option value="tarjeta">Tarjeta</option>
                    </select>
                  </div>
                </div>

                {/* 7. ESTADO DE SESIÓN Y NOTAS */}
                <div className="form-group">
                  <label>Estado de sesión</label>
                  <select
                    className="form-input"
                    value={qForm.estado_entrega}
                    onChange={(e) => setQForm({ ...qForm, estado_entrega: e.target.value })}
                  >
                    <option value="pendiente">Pendiente</option>
                    <option value="sesion_realizada">Sesión realizada</option>
                    <option value="editada">Editada</option>
                    <option value="entregada">Entregada</option>
                    <option value="impresion">Impresión</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Notas</label>
                  <textarea
                    className="form-input"
                    placeholder="Observaciones..."
                    value={qForm.notas}
                    onChange={(e) => setQForm({ ...qForm, notas: e.target.value })}
                  />
                </div>

                <button
                  className="btn btn-primary"
                  type="submit"
                  style={{ width: '100%', justifyContent: 'center', borderRadius: '12px' }}
                >
                  Registrar Sesión
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* LISTADO GENERAL DE SESIONES */}
        <div className="card">
          <div
            className="card-header"
            style={{ flexDirection: 'column', alignItems: 'stretch', gap: '12px', padding: '16px 20px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div className="card-title">Todas las Sesiones</div>
              {(estadoFiltro || entregaFiltro) && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ color: 'var(--rose-deep)', fontSize: '11px', padding: '4px 12px', borderRadius: '20px', border: '1px dashed var(--rose)' }}
                  onClick={() => {
                    setEstadoFiltro('');
                    setEntregaFiltro('');
                    setPagina(1);
                  }}
                >
                  ✕ Limpiar filtros
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: '125px' }}>
                  💳 Estado de Pago:
                </span>
                <div className="filtros">
                  {[
                    { id: '', label: 'Todas' },
                    { id: 'reserva', label: 'Por definir servicio' },
                    { id: 'pendiente', label: 'Pendientes' },
                    { id: 'abonado', label: 'Abonadas' },
                    { id: 'pagado', label: 'Pagadas' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className={`filtro-btn ${estadoFiltro === f.id ? 'active' : ''}`}
                      onClick={() => {
                        setEstadoFiltro(f.id);
                        setPagina(1);
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: '125px' }}>
                  📦 Estado de Sesión:
                </span>
                <div className="filtros">
                  {[
                    { id: '', label: 'Todas' },
                    { id: 'pendiente', label: 'Pendiente' },
                    { id: 'sesion_realizada', label: 'Sesión realizada' },
                    { id: 'editada', label: 'Editada' },
                    { id: 'entregada', label: 'Entregada' },
                    { id: 'impresion', label: 'Impresión' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className={`filtro-btn ${entregaFiltro === f.id ? 'active' : ''}`}
                      onClick={() => {
                        setEntregaFiltro(f.id);
                        setPagina(1);
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Servicio</th>
                  <th>Fecha</th>
                  <th>Hora</th>
                  <th>Total / Saldo</th>
                  <th>Pago</th>
                  <th>Estado de sesión</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="empty-row">Cargando sesiones...</td>
                  </tr>
                ) : listadoSesiones.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="empty-row">No hay sesiones con ese filtro.</td>
                  </tr>
                ) : (
                  listadoSesiones.map((s, idx) => {
                    const cntAb = Array.isArray(s.abonos) ? s.abonos.length : 0;
                    const esTarget = targetSesionId === Number(s.id);
                    return (
                      <tr
                        key={s.id}
                        id={`sesion-row-${s.id}`}
                        className={esTarget ? 'highlight-row' : ''}
                      >
                        <td>
                          <div className="client-cell">
                            <div className={`client-avatar ${AV_CLASSES[idx % 5]}`}>
                              {(s.nombre || 'C').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="client-name">
                                {s.nombre} {s.apellido}
                              </div>
                              <div className="client-phone">{s.telefono || ''}</div>
                            </div>
                          </div>
                        </td>
                        <td>{s.servicio || 'Por definir'}</td>
                        <td style={{ fontSize: '11px', fontWeight: 600 }}>
                          {formatoFecha(s.fecha_sesion)}
                        </td>
                        <td style={{ fontSize: '11px', fontWeight: 600 }}>
                          {s.hora_sesion ? formatoHora(s.hora_sesion) : '—'}
                        </td>
                        <td>
                          <div
                            style={{
                              fontFamily: "'Dancing Script', cursive",
                              fontSize: '15px',
                              color: 'var(--navy)',
                            }}
                          >
                            {formatoPeso(s.total)}
                          </div>
                          {Number(s.saldo || 0) > 0 && (
                            <div style={{ fontSize: '10px', color: 'var(--rose-deep)', fontWeight: 700 }}>
                              Saldo: {formatoPeso(s.saldo)}
                            </div>
                          )}
                          {Number(s.abono || 0) > 0 && (
                            <div
                              style={{
                                fontSize: '10px',
                                color: 'var(--teal-deep)',
                                fontWeight: 700,
                                marginTop: '2px',
                                cursor: 'pointer',
                              }}
                              onClick={() => abrirEditarSesion(s)}
                              title="Ver historial de abonos"
                            >
                              💰 {formatoPeso(s.abono)}{' '}
                              {cntAb > 1 && <span style={{ fontSize: '9px' }}>({cntAb} abonos)</span>}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className={`status-pill pill-${s.estado_pago}`}>
                            {s.estado_pago
                              ? s.estado_pago.charAt(0).toUpperCase() + s.estado_pago.slice(1)
                              : ''}
                          </span>
                        </td>
                        <td>
                          <span className={`status-pill pill-${s.estado_entrega}`}>
                            {labelEstadoEntrega(s.estado_entrega)}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => setModalFacSesion(s)}
                              title="Ver Factura"
                            >
                              🧾
                            </button>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => abrirEditarSesion(s)}
                            >
                              Editar
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => {
                                setModoEliminacion('total');
                                setModalDelSesion(s);
                              }}
                            >
                              Eliminar
                            </button>
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

        {totalPaginas > 1 && (
          <div className="pagination">
            {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                className={`page-btn ${p === pagina ? 'active' : ''}`}
                onClick={() => setPagina(p)}
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {/* MODAL EDITAR SESIÓN (MISMA ESTRUCTURA ORGANIZADA) */}
        <div
          className={`modal-overlay ${modalEditOpen ? 'open' : ''}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalEditOpen(false);
          }}
        >
          <div className="modal" style={{ maxWidth: '540px' }}>
            <div className="modal-header">
              <div className="modal-title">Editar Sesión</div>
              <button className="modal-close" onClick={() => setModalEditOpen(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={guardarEdicionSesion}>
              <div className="modal-body" style={{ gap: '0' }}>
                {/* Cliente búsqueda */}
                <div className="form-group">
                  <label>Cliente *</label>
                  <div className="cliente-search-wrapper">
                    <div className="cliente-search-input-row">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        width="16"
                        height="16"
                        className="search-icon"
                      >
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                      </svg>
                      <input
                        type="text"
                        className="form-input cliente-search-input"
                        placeholder="Buscar por nombre o teléfono..."
                        autoComplete="off"
                        value={mClienteQuery}
                        onFocus={() => setMClienteOpen(true)}
                        onChange={(e) => {
                          setMClienteQuery(e.target.value);
                          setMClienteOpen(true);
                        }}
                      />
                    </div>
                    {mClienteOpen && (
                      <div className="cliente-dropdown">
                        {clientes
                          .filter((c) => {
                            const full = `${c.nombre} ${c.apellido || ''} ${c.telefono || ''}`.toLowerCase();
                            return !mClienteQuery || full.includes(mClienteQuery.toLowerCase());
                          })
                          .slice(0, 20)
                          .map((c) => (
                            <div
                              key={c.id}
                              className="cliente-option"
                              onClick={() => {
                                setMForm({ ...mForm, cliente_id: c.id });
                                setMClienteQuery(`${c.nombre} ${c.apellido || ''}`.trim());
                                setMClienteOpen(false);
                              }}
                            >
                              <span>
                                {c.nombre} {c.apellido}
                              </span>
                              <small style={{ color: 'var(--text-dim)', fontSize: '10.5px' }}>
                                {c.telefono || ''}
                              </small>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Fecha y Hora */}
                <div className="form-row">
                  <div className="form-group">
                    <label>Fecha *</label>
                    <input
                      className="form-input"
                      type="date"
                      value={mForm.fecha_sesion}
                      onChange={(e) => setMForm({ ...mForm, fecha_sesion: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Hora *</label>
                    <select
                      className="form-input"
                      value={mForm.hora_sesion}
                      onChange={(e) => setMForm({ ...mForm, hora_sesion: e.target.value })}
                      required
                    >
                      <option value="">Seleccione hora...</option>
                      {HORAS_OPCIONES.map((h) => (
                        <option key={h.value} value={h.value}>
                          {h.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Tipo de sesión en Modal */}
                <div className="form-group">
                  <label>Tipo de sesión *</label>
                  <div className="producto-picker picker-sesion-m">
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Buscar sesión por nombre..."
                      autoComplete="off"
                      value={mSesQuery}
                      onFocus={() => setMSesOpen(true)}
                      onChange={(e) => {
                        setMSesQuery(e.target.value);
                        setMSesOpen(true);
                      }}
                    />
                    <select
                      className="form-input producto-categoria"
                      value={mSesCat}
                      onChange={(e) => {
                        setMSesCat(e.target.value);
                        setMSesOpen(true);
                      }}
                    >
                      <option value="">Todas las categorías</option>
                      {categoriasSesion.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                    {mSesOpen && (
                      <div className="producto-dropdown">
                        {(() => {
                          const items = paquetes.filter(
                            (p) =>
                              (!mSesQuery ||
                                p.nombre.toLowerCase().includes(mSesQuery.toLowerCase())) &&
                              (!mSesCat || p.categoria === mSesCat)
                          );
                          if (items.length === 0) {
                            return <div className="producto-empty">No hay resultados.</div>;
                          }
                          return items.map((p) => (
                            <div
                              key={p.id}
                              className="producto-option"
                              onClick={() => {
                                setMForm({ ...mForm, producto_principal_id: p.id });
                                setMSesQuery(p.nombre);
                                setMSesOpen(false);
                              }}
                            >
                              <div>
                                <strong>{p.nombre}</strong>
                                <small>{p.categoria || 'Sin categoría'}</small>
                              </div>
                              <span>{formatoPeso(p.precio)}</span>
                            </div>
                          ));
                        })()}
                      </div>
                    )}
                    {mProductoSeleccionado && (
                      <div className="producto-seleccionado">
                        <span>{mProductoSeleccionado.nombre}</span>
                        <b>{formatoPeso(mProductoSeleccionado.precio)}</b>
                        <button
                          type="button"
                          onClick={() => {
                            setMForm({ ...mForm, producto_principal_id: '' });
                            setMSesQuery('');
                          }}
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Adicionales en Modal */}
                <div className="form-group">
                  <label>Adicionales</label>
                  <div className="producto-picker picker-adic-m">
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Buscar adicional por nombre..."
                      autoComplete="off"
                      value={mAdicQuery}
                      onFocus={() => setMAdicOpen(true)}
                      onChange={(e) => {
                        setMAdicQuery(e.target.value);
                        setMAdicOpen(true);
                      }}
                    />
                    <select
                      className="form-input producto-categoria"
                      value={mAdicCat}
                      onChange={(e) => {
                        setMAdicCat(e.target.value);
                        setMAdicOpen(true);
                      }}
                    >
                      <option value="">Todas las categorías</option>
                      {categoriasAdicional.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                    {mAdicOpen && (
                      <div className="producto-dropdown">
                        {(() => {
                          const items = adicionalesCatalogo.filter(
                            (p) =>
                              (!mAdicQuery ||
                                p.nombre.toLowerCase().includes(mAdicQuery.toLowerCase())) &&
                              (!mAdicCat || p.categoria === mAdicCat)
                          );
                          if (items.length === 0) {
                            return <div className="producto-empty">No hay resultados.</div>;
                          }
                          return items.map((p) => (
                            <div
                              key={p.id}
                              className="producto-option"
                              onClick={() => {
                                const list = [...mForm.adicionales];
                                const ex = list.find((a) => Number(a.producto_id) === Number(p.id));
                                if (ex) ex.cantidad += 1;
                                else list.push({ producto_id: p.id, cantidad: 1 });
                                setMForm({ ...mForm, adicionales: list });
                                setMAdicQuery('');
                                setMAdicOpen(false);
                              }}
                            >
                              <div>
                                <strong>{p.nombre}</strong>
                                <small>{p.categoria || 'Sin categoría'}</small>
                              </div>
                              <span>{formatoPeso(p.precio)}</span>
                            </div>
                          ));
                        })()}
                      </div>
                    )}
                  </div>

                  {mForm.adicionales.length > 0 && (
                    <div className="adicionales-lista">
                      {mForm.adicionales.map((ad, idx) => {
                        const pr = buscarProducto(ad.producto_id);
                        if (!pr) return null;
                        return (
                          <div key={ad.producto_id} className="adicional-item">
                            <div className="adicional-info">
                              <strong>{pr.nombre}</strong>
                              <small>
                                {pr.categoria || 'Sin categoría'} · {formatoPeso(pr.precio)}
                              </small>
                            </div>
                            <input
                              className="form-input adicional-cantidad"
                              type="number"
                              min="1"
                              step="1"
                              value={ad.cantidad}
                              onChange={(e) => {
                                const list = [...mForm.adicionales];
                                list[idx].cantidad = Math.max(
                                  1,
                                  parseInt(e.target.value || '1', 10)
                                );
                                setMForm({ ...mForm, adicionales: list });
                              }}
                            />
                            <button
                              type="button"
                              className="btn-remove-serv"
                              onClick={() => {
                                const list = mForm.adicionales.filter((_, i) => i !== idx);
                                setMForm({ ...mForm, adicionales: list });
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <hr className="divider" />

                <div className="form-row" style={{ alignItems: 'flex-start' }}>
                  <div className="form-group">
                    <label>Total ($)</label>
                    <input className="form-input" type="number" value={mTotal} readOnly />
                  </div>
                  <div className="form-group">
                    <label>Abono Acumulado ($)</label>
                    <input
                      className="form-input"
                      type="number"
                      value={mAbonoNum}
                      readOnly={mForm.abonos && mForm.abonos.length > 0}
                      onChange={(e) => setMForm({ ...mForm, abono: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '-4px' }}>
                  <label>Saldo Pendiente</label>
                  <div
                    style={{
                      fontSize: '16px',
                      fontWeight: 700,
                      color: 'var(--rose-deep)',
                      paddingTop: '2px',
                    }}
                  >
                    {renderSaldoDisplay(mTotal, mAbonoNum)}
                  </div>
                </div>

                {/* SECCIÓN HISTORIAL DE ABONOS ORDENADOS */}
                <div
                  style={{
                    background: 'var(--surface2)',
                    border: '1.5px solid var(--border)',
                    borderRadius: '12px',
                    padding: '14px',
                    marginBottom: '14px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '10px',
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: '12.5px',
                        color: 'var(--navy)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <span>💰 Historial de Abonos</span>
                      <span
                        style={{
                          background: 'var(--rose-pale)',
                          color: 'var(--rose-deep)',
                          fontSize: '10.5px',
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: '12px',
                        }}
                      >
                        {mForm.abonos?.length || 0} abonos
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-teal btn-sm"
                      onClick={() => setNuevoAbonoOpen(!nuevoAbonoOpen)}
                    >
                      {nuevoAbonoOpen ? '✕ Cerrar' : '+ Registrar Abono'}
                    </button>
                  </div>

                  {nuevoAbonoOpen && (
                    <div
                      style={{
                        background: '#fff',
                        border: '1.5px solid var(--teal-light)',
                        borderRadius: '10px',
                        padding: '12px',
                        marginBottom: '12px',
                      }}
                    >
                      <div className="form-row">
                        <div className="form-group">
                          <label>Monto ($) *</label>
                          <input
                            type="number"
                            className="form-input"
                            placeholder={`Saldo: ${formatoPeso(Math.max(0, mTotal - mAbonoNum))}`}
                            value={nuevoAbonoForm.monto}
                            onChange={(e) =>
                              setNuevoAbonoForm({ ...nuevoAbonoForm, monto: e.target.value })
                            }
                          />
                        </div>
                        <div className="form-group">
                          <label>Método de Pago *</label>
                          <select
                            className="form-input"
                            value={nuevoAbonoForm.metodo_pago}
                            onChange={(e) =>
                              setNuevoAbonoForm({ ...nuevoAbonoForm, metodo_pago: e.target.value })
                            }
                          >
                            <option value="efectivo">Efectivo</option>
                            <option value="transferencia">Transferencia</option>
                            <option value="nequi">Nequi</option>
                            <option value="daviplata">Daviplata</option>
                            <option value="tarjeta">Tarjeta</option>
                          </select>
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Fecha *</label>
                          <input
                            type="date"
                            className="form-input"
                            value={nuevoAbonoForm.fecha}
                            onChange={(e) =>
                              setNuevoAbonoForm({ ...nuevoAbonoForm, fecha: e.target.value })
                            }
                          />
                        </div>
                        <div className="form-group">
                          <label>Notas (Opcional)</label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Comprobante..."
                            value={nuevoAbonoForm.notas}
                            onChange={(e) =>
                              setNuevoAbonoForm({ ...nuevoAbonoForm, notas: e.target.value })
                            }
                          />
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => setNuevoAbonoOpen(false)}
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          className="btn btn-teal btn-sm"
                          onClick={registrarNuevoAbono}
                        >
                          💾 Guardar Abono
                        </button>
                      </div>
                    </div>
                  )}

                  {!mForm.abonos || mForm.abonos.length === 0 ? (
                    <div
                      style={{
                        textAlign: 'center',
                        padding: '10px',
                        fontSize: '11.5px',
                        color: 'var(--text-dim)',
                        fontStyle: 'italic',
                      }}
                    >
                      No hay abonos individuales registrados. Usa &quot;+ Registrar Abono&quot; para agregar uno.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {mForm.abonos.map((ab, i) => (
                        <div
                          key={ab.id || i}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: '#fff',
                            border: '1.5px solid var(--border)',
                            borderRadius: '10px',
                            padding: '9px 12px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span
                              style={{
                                background: 'var(--navy)',
                                color: '#fff',
                                fontSize: '10.5px',
                                fontWeight: 800,
                                padding: '2px 7px',
                                borderRadius: '6px',
                              }}
                            >
                              #{i + 1}
                            </span>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <strong style={{ fontSize: '13px', color: 'var(--navy)' }}>
                                  {formatoPeso(ab.monto)}
                                </strong>
                                <span
                                  style={{
                                    fontSize: '9.5px',
                                    fontWeight: 700,
                                    padding: '2px 6px',
                                    borderRadius: '6px',
                                    textTransform: 'uppercase',
                                    background: 'var(--navy-soft)',
                                    color: 'var(--navy-mid)',
                                  }}
                                >
                                  {ab.metodo_pago}
                                </span>
                              </div>
                              <div style={{ fontSize: '10.5px', color: 'var(--text-dim)', marginTop: '1px' }}>
                                📅 {formatoFecha(ab.fecha)} · {ab.concepto || `Abono #${i + 1}`}
                              </div>
                            </div>
                          </div>
                          {ab.id && (
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => eliminarAbonoIndividual(ab.id, formatoPeso(ab.monto))}
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Estado pago y Método */}
                <div className="form-row">
                  <div className="form-group">
                    <label>Estado pago</label>
                    <input className="form-input" value={mEstadoPago} readOnly />
                  </div>
                  <div className="form-group">
                    <label>Método pago</label>
                    <select
                      className="form-input"
                      value={mForm.metodo_pago}
                      onChange={(e) => setMForm({ ...mForm, metodo_pago: e.target.value })}
                    >
                      <option value="efectivo">Efectivo</option>
                      <option value="transferencia">Transferencia</option>
                      <option value="nequi">Nequi</option>
                      <option value="daviplata">Daviplata</option>
                      <option value="tarjeta">Tarjeta</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Estado de sesión</label>
                  <select
                    className="form-input"
                    value={mForm.estado_entrega}
                    onChange={(e) => setMForm({ ...mForm, estado_entrega: e.target.value })}
                  >
                    <option value="pendiente">Pendiente</option>
                    <option value="sesion_realizada">Sesión realizada</option>
                    <option value="editada">Editada</option>
                    <option value="entregada">Entregada</option>
                    <option value="impresion">Impresión</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Notas</label>
                  <textarea
                    className="form-input"
                    placeholder="Observaciones..."
                    value={mForm.notas}
                    onChange={(e) => setMForm({ ...mForm, notas: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setModalEditOpen(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* MODAL FACTURA DE LA SESIÓN */}
        <div
          className={`modal-overlay ${modalFacSesion ? 'open' : ''}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalFacSesion(null);
          }}
        >
          <div className="modal" style={{ maxWidth: '880px', width: '95vw' }}>
            <div className="modal-header">
              <span className="modal-title" style={{ flex: '0 0 auto' }}>
                Factura de la sesión
              </span>
              {modalFacSesion?.factura_id && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '12px', flexWrap: 'wrap' }}>
                  {modalFacSesion.factura_numero && (
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 700,
                        color: 'var(--navy-mid)',
                        background: 'var(--navy-soft)',
                        borderRadius: '20px',
                        padding: '3px 10px',
                      }}
                    >
                      {modalFacSesion.factura_numero}
                    </span>
                  )}
                  <span
                    className={`status-pill pill-${
                      modalFacSesion.factura_estado || modalFacSesion.estado_pago || 'pendiente'
                    }`}
                  >
                    {(() => {
                      const est = String(
                        modalFacSesion.factura_estado || modalFacSesion.estado_pago || 'pendiente'
                      );
                      return est.charAt(0).toUpperCase() + est.slice(1);
                    })()}
                  </span>
                </div>
              )}
              <span style={{ flex: 1 }} />
              <button className="modal-close" onClick={() => setModalFacSesion(null)}>
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ padding: 0, background: '#eceaf0' }}>
              {modalFacSesion?.factura_id ? (
                <iframe
                  ref={facIframeRef}
                  src={`/facturas/${modalFacSesion.factura_id}/pdf?ver=1`}
                  style={{ width: '100%', height: '66vh', border: 'none', display: 'block' }}
                  title="Factura PDF"
                />
              ) : (
                <div
                  style={{
                    padding: '46px 24px',
                    textAlign: 'center',
                    color: 'var(--text-mid)',
                    background: 'var(--surface)',
                    fontSize: '14px',
                  }}
                >
                  <div style={{ fontSize: '40px', marginBottom: '8px' }}>🧾</div>
                  <strong>Esta sesión no tiene una factura vinculada.</strong>
                  <br />
                  Puedes crearla desde el módulo{' '}
                  <Link href="/facturas" style={{ color: 'var(--rose-deep)', fontWeight: 700 }}>
                    Facturas
                  </Link>{' '}
                  seleccionando esta sesión.
                </div>
              )}
            </div>
            {modalFacSesion?.factura_id && (
              <div className="modal-footer" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
                {facAviso && (
                  <div
                    style={{
                      marginRight: 'auto',
                      fontSize: '12px',
                      color: facAviso.tipo === 'warn' ? '#9a5b12' : 'var(--teal-deep)',
                      background: facAviso.tipo === 'warn' ? '#fef3e2' : 'var(--teal-pale)',
                      border: `1.5px solid ${
                        facAviso.tipo === 'warn' ? '#f3d19e' : 'var(--teal-light)'
                      }`,
                      borderRadius: '10px',
                      padding: '6px 10px',
                      lineHeight: 1.4,
                      fontWeight: 600,
                    }}
                  >
                    {facAviso.texto}
                  </div>
                )}
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={descargarFacturaModal}
                >
                  ⬇ Descargar PDF
                </button>
                <button
                  type="button"
                  className="btn"
                  style={{
                    background: 'linear-gradient(135deg, #25d366, #128c7e)',
                    color: '#fff',
                    boxShadow: '0 4px 14px rgba(18, 140, 126, 0.28)',
                  }}
                  onClick={enviarFacturaWhatsApp}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    style={{ marginRight: '4px' }}
                  >
                    <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.23 1.36.2 1.87.12.57-.08 1.75-.72 2-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35M12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.32l-.34-.2-3.57.94.95-3.48-.22-.36a9.4 9.4 0 0 1-1.44-5.02c0-5.2 4.24-9.43 9.44-9.43 2.52 0 4.89.98 6.67 2.77a9.37 9.37 0 0 1 2.76 6.67c0 5.2-4.23 9.43-9.44 9.43m8.03-17.46A11.27 11.27 0 0 0 12.05.72C5.8.72.7 5.8.7 12.07c0 2 .52 3.95 1.52 5.67L.6 23.62l6.02-1.58a11.33 11.33 0 0 0 5.42 1.38h.01c6.26 0 11.35-5.09 11.35-11.35 0-3.03-1.18-5.88-3.32-8.03" />
                  </svg>
                  Enviar por WhatsApp
                </button>
              </div>
            )}
          </div>
        </div>

        {/* MODAL ELIMINAR SESIÓN */}
        <div
          className={`modal-overlay ${modalDelSesion ? 'open' : ''}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalDelSesion(null);
          }}
        >
          <div className="modal" style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <div className="modal-title">Eliminar Sesión</div>
              <button className="modal-close" onClick={() => setModalDelSesion(null)}>
                ✕
              </button>
            </div>
            {modalDelSesion && (
              <div className="modal-body">
                <div style={{ fontSize: '13px', color: 'var(--navy)' }}>
                  ¿Confirmas eliminar la sesión de{' '}
                  <strong>
                    {modalDelSesion.nombre} {modalDelSesion.apellido}
                  </strong>{' '}
                  ({formatoFecha(modalDelSesion.fecha_sesion)})?
                </div>
                {(modalDelSesion.factura_id || Number(modalDelSesion.abono) > 0) && (
                  <div
                    style={{
                      background: 'var(--rose-pale)',
                      padding: '12px',
                      borderRadius: '10px',
                      fontSize: '12px',
                    }}
                  >
                    <div style={{ fontWeight: 700, color: 'var(--rose-deep)', marginBottom: '8px' }}>
                      Opciones contables para la factura y abonos:
                    </div>
                    <label
                      style={{
                        display: 'flex',
                        gap: '8px',
                        alignItems: 'center',
                        marginBottom: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="radio"
                        name="modo_del"
                        checked={modoEliminacion === 'total'}
                        onChange={() => setModoEliminacion('total')}
                      />
                      <span>Eliminar sesión, factura e ingresos asociados</span>
                    </label>
                    <label
                      style={{ display: 'flex', gap: '8px', alignItems: 'center', cursor: 'pointer' }}
                    >
                      <input
                        type="radio"
                        name="modo_del"
                        checked={modoEliminacion === 'anular_factura'}
                        onChange={() => setModoEliminacion('anular_factura')}
                      />
                      <span>Eliminar sesión y dejar la factura como &quot;Cancelada&quot;</span>
                    </label>
                  </div>
                )}
              </div>
            )}
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setModalDelSesion(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={confirmarEliminacionSesion}
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default function SesionesPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Cargando sesiones...</div>}>
      <SesionesContent />
    </Suspense>
  );
}
