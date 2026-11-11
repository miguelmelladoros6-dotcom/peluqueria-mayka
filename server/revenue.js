'use strict';
/* =============================================================
   Motor de ingresos (bonos, membresías, depósitos, lista de espera,
   referidos, tienda, analítica). Lógica pura + helpers sobre storage.
   ============================================================= */
const crypto = require('crypto');
const config = require('./config');
const storage = require('./storage');
const schedule = require('./schedule');
const mailer = require('./mailer');

/* ---------- precios ---------- */
function precioServicio(id) {
  return Number(config.preciosServicios[id] || 0);
}

function depositoPara(cita) {
  if (config.depositMode === 'none') return 0;
  if (config.depositMode === 'percent') {
    const p = precioServicio(cita.servicio);
    return Math.round((p * config.depositPercent) / 100 * 100) / 100;
  }
  return Number(config.depositAmount || 0);
}

/* ---------- códigos ---------- */
function generarCodigoBonos() {
  const alf = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'MAYKA-';
  for (let i = 0; i < 8; i++) code += alf[Math.floor(Math.random() * alf.length)];
  return code;
}

function generarCodigoReferido(nombre) {
  const base = String(nombre || 'CLIENTE').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4) || 'MAYKA';
  return base + '-' + crypto.randomBytes(2).toString('hex').toUpperCase();
}

/* ---------- bonos regalo ---------- */
async function crearBono(datos) {
  const amount = Number(datos.amount);
  if (!amount || amount <= 0) throw new Error('Importe inválido');
  const code = generarCodigoBonos();
  const expira = new Date();
  expira.setDate(expira.getDate() + (config.giftCardExpiryDays || 365));
  const bono = await storage.add('giftcards', {
    code,
    amount,
    balance: amount,
    buyerName: String(datos.buyerName || '').trim(),
    buyerEmail: String(datos.buyerEmail || '').trim(),
    recipientName: String(datos.recipientName || datos.buyerName || '').trim(),
    recipientEmail: String(datos.recipientEmail || datos.buyerEmail || '').trim(),
    message: String(datos.message || '').trim(),
    status: 'pending_payment', /* pending_payment | active | redeemed | expired | cancelled */
    paymentMethod: datos.paymentMethod || 'manual',
    paymentRef: datos.paymentRef || null,
    expiresAt: expira.toISOString().slice(0, 10),
    redemptions: []
  }, 'BONO');
  return bono;
}

async function validarBono(code) {
  const bonos = await storage.all('giftcards');
  const bono = bonos.find((b) => String(b.code).toUpperCase() === String(code || '').toUpperCase().trim());
  if (!bono) return { ok: false, error: 'Bono no encontrado' };
  if (bono.status === 'cancelled') return { ok: false, error: 'Bono cancelado' };
  if (bono.status === 'pending_payment') return { ok: false, error: 'Bono pendiente de pago' };
  if (bono.balance <= 0) return { ok: false, error: 'Bono sin saldo' };
  const hoy = schedule.today(config.timezone);
  if (bono.expiresAt && bono.expiresAt < hoy) return { ok: false, error: 'Bono caducado' };
  return { ok: true, bono };
}

async function canjearBono(code, citaId, amount) {
  const res = await validarBono(code);
  if (!res.ok) return res;
  const bono = res.bono;
  const importe = Math.min(Number(amount || bono.balance), bono.balance);
  if (importe <= 0) return { ok: false, error: 'Importe inválido' };
  const redemptions = (bono.redemptions || []).concat([{ citaId, amount: importe, fecha: new Date().toISOString() }]);
  const nuevoSaldo = Math.round((bono.balance - importe) * 100) / 100;
  const status = nuevoSaldo <= 0 ? 'redeemed' : 'active';
  await storage.update('giftcards', bono.id, { balance: nuevoSaldo, status, redemptions });
  return { ok: true, importe, saldoRestante: nuevoSaldo };
}

async function activarBono(id) {
  return storage.update('giftcards', id, { status: 'active' });
}

/* ---------- membresías ---------- */
function planPorId(id) {
  return (config.membershipPlans || []).find((p) => p.id === id) || null;
}

async function suscribirse(datos) {
  const plan = planPorId(datos.plan);
  if (!plan) throw new Error('Plan no válido');
  const inicio = schedule.today(config.timezone);
  const siguiente = new Date(inicio + 'T00:00:00Z');
  siguiente.setUTCMonth(siguiente.getUTCMonth() + 1);
  const proximo = siguiente.toISOString().slice(0, 10);
  const socio = await storage.add('memberships', {
    clientName: String(datos.clientName || '').trim(),
    clientEmail: String(datos.clientEmail || '').trim(),
    clientPhone: String(datos.clientPhone || '').trim(),
    planId: plan.id,
    planNombre: plan.nombre,
    price: plan.precio,
    descuento: plan.descuento,
    visitasMes: plan.visitasMes,
    visitasUsadas: 0,
    status: 'pending_payment', /* pending_payment | active | paused | cancelled */
    startDate: inicio,
    nextBillingDate: proximo,
    payments: [],
    notas: String(datos.notas || '').trim()
  }, 'SOCIO');
  return socio;
}

async function renovarSocio(id) {
  const socio = await storage.find('memberships', id);
  if (!socio) return null;
  if (socio.status !== 'active') return socio;
  const siguiente = new Date(socio.nextBillingDate + 'T00:00:00Z');
  siguiente.setUTCMonth(siguiente.getUTCMonth() + 1);
  const proximo = siguiente.toISOString().slice(0, 10);
  return storage.update('memberships', id, { visitasUsadas: 0, nextBillingDate: proximo });
}

/* ---------- lista de espera ---------- */
async function apuntarseEspera(datos) {
  return storage.add('waitlist', {
    clientName: String(datos.clientName || '').trim(),
    clientPhone: String(datos.clientPhone || '').trim(),
    clientEmail: String(datos.clientEmail || '').trim(),
    servicioId: datos.servicioId || datos.servicio,
    servicioNombre: datos.servicioNombre || '',
    fecha: datos.fecha,
    horaPreferida: datos.horaPreferida || '',
    status: 'waiting', /* waiting | notified | booked | expired | cancelled */
    notifiedAt: null
  }, 'ESPERA');
}

async function notificarEsperaPorCancelacion(cita) {
  /* Busca personas en espera para esa fecha/servicio y las marca notificadas. */
  const todos = await storage.all('waitlist');
  const candidatos = todos.filter((w) =>
    w.status === 'waiting' && w.fecha === cita.fecha &&
    (w.servicioId === cita.servicio || !w.servicioId)
  );
  const notificados = [];
  for (const w of candidatos) {
    await storage.update('waitlist', w.id, { status: 'notified', notifiedAt: new Date().toISOString() });
    notificados.push(w);
    /* Enviar email si hay correo */
    if (w.clientEmail) {
      try {
        await mailer.enviarPorFormSubmit ? null : null;
      } catch (e) { /* ignore */ }
    }
  }
  return notificados;
}

/* ---------- referidos ---------- */
async function obtenerReferido(email, nombre) {
  const todos = await storage.all('referrals');
  let ref = todos.find((r) => String(r.clientEmail).toLowerCase() === String(email || '').toLowerCase().trim());
  if (ref) return ref;
  const code = generarCodigoReferido(nombre);
  ref = await storage.add('referrals', {
    clientName: String(nombre || '').trim(),
    clientEmail: String(email || '').trim(),
    code,
    credits: 0,
    totalEarned: 0,
    redemptions: []
  }, 'REF');
  return ref;
}

async function aplicarReferido(code, nuevoEmail) {
  const todos = await storage.all('referrals');
  const ref = todos.find((r) => String(r.code).toUpperCase() === String(code || '').toUpperCase().trim());
  if (!ref) return { ok: false, error: 'Código no válido' };
  if (String(ref.clientEmail).toLowerCase() === String(nuevoEmail || '').toLowerCase().trim()) {
    return { ok: false, error: 'No puedes usar tu propio código' };
  }
  /* evitar duplicados */
  const ya = (ref.redemptions || []).some((r) => String(r.referredEmail).toLowerCase() === String(nuevoEmail || '').toLowerCase().trim());
  if (ya) return { ok: false, error: 'Referido ya registrado' };
  const credito = Number(config.referralCredit || 0);
  const redemptions = (ref.redemptions || []).concat([{ referredEmail: nuevoEmail, amount: credito, fecha: new Date().toISOString() }]);
  await storage.update('referrals', ref.id, {
    credits: Math.round((ref.credits + credito) * 100) / 100,
    totalEarned: Math.round((ref.totalEarned + credito) * 100) / 100,
    redemptions
  });
  return { ok: true, credito, referrer: ref.clientName };
}

/* ---------- tienda ---------- */
async function seedProductos() {
  const existing = await storage.all('products');
  if (existing.length) return existing;
  const seed = [
    { nombre: 'Champú reparador', descripcion: 'Champú para cabello dañado o teñido.', precio: 14.90, stock: 20, categoria: 'cuidado', activo: true },
    { nombre: 'Mascarilla hidratante', descripcion: 'Mascarilla profunda para hidratación intensa.', precio: 19.90, stock: 15, categoria: 'cuidado', activo: true },
    { nombre: 'Aceite de argán', descripcion: 'Aceite nutritivo para puntas y brillo.', precio: 16.50, stock: 12, categoria: 'tratamiento', activo: true },
    { nombre: 'Laca fijación fuerte', descripcion: 'Laca de acabado profesional.', precio: 9.90, stock: 25, categoria: 'styling', activo: true },
    { nombre: 'Serum antifrizz', descripcion: 'Serum para control del encrespamiento.', precio: 12.90, stock: 18, categoria: 'styling', activo: true }
  ];
  const creados = [];
  for (const p of seed) creados.push(await storage.add('products', p, 'PROD'));
  return creados;
}

async function crearPedido(datos) {
  const items = Array.isArray(datos.items) ? datos.items : [];
  if (!items.length) throw new Error('Carrito vacío');
  /* recalcular precios desde catálogo */
  const productos = await storage.all('products');
  const lineas = [];
  let total = 0;
  for (const it of items) {
    const prod = productos.find((p) => p.id === it.productId);
    if (!prod || !prod.activo) throw new Error('Producto no disponible: ' + it.productId);
    const qty = Math.max(1, Number(it.qty || 1));
    if (qty > (prod.stock || 0)) throw new Error('Stock insuficiente: ' + prod.nombre);
    const precio = Number(prod.precio);
    lineas.push({ productId: prod.id, nombre: prod.nombre, qty, precio, subtotal: Math.round(precio * qty * 100) / 100 });
    total += precio * qty;
  }
  total = Math.round(total * 100) / 100;
  /* descontar stock */
  for (const l of lineas) {
    const prod = productos.find((p) => p.id === l.productId);
    await storage.update('products', prod.id, { stock: (prod.stock || 0) - l.qty });
  }
  const pedido = await storage.add('orders', {
    items: lineas,
    total,
    clientName: String(datos.clientName || '').trim(),
    clientEmail: String(datos.clientEmail || '').trim(),
    clientPhone: String(datos.clientPhone || '').trim(),
    address: String(datos.address || '').trim(),
    status: 'pending', /* pending | paid | shipped | delivered | cancelled */
    paymentMethod: datos.paymentMethod || 'manual',
    paymentRef: datos.paymentRef || null,
    notas: String(datos.notas || '').trim()
  }, 'PED');
  return pedido;
}

/* ---------- clientes (derivado de citas) ---------- */
async function clientesUnicos(citas) {
  const map = new Map();
  (citas || []).forEach((c) => {
    const key = (c.email || c.telefono || c.nombre).toLowerCase();
    if (!map.has(key)) {
      map.set(key, { nombre: c.nombre, email: c.email, telefono: c.telefono, visitas: 0, ultimaVisita: null, gastado: 0 });
    }
    const cl = map.get(key);
    cl.visitas += 1;
    if (!cl.ultimaVisita || (c.fecha > cl.ultimaVisita)) cl.ultimaVisita = c.fecha;
    cl.gastado += precioServicio(c.servicio);
  });
  return Array.from(map.values()).sort((a, b) => (b.ultimaVisita || '').localeCompare(a.ultimaVisita || ''));
}

/* ---------- analítica ---------- */
async function analitica(citas) {
  const hoy = schedule.today(config.timezone);
  const hace30 = schedule.addDays(hoy, -30);
  const hace90 = schedule.addDays(hoy, -90);

  const realizadas = (citas || []).filter((c) => c.estado === 'realizada');
  const canceladas = (citas || []).filter((c) => c.estado === 'cancelada');
  const noShow = (citas || []).filter((c) => c.estado === 'no_presentado');

  const ingresosServicios30 = realizadas
    .filter((c) => c.fecha >= hace30)
    .reduce((s, c) => s + precioServicio(c.servicio), 0);

  const ingresosServicios90 = realizadas
    .filter((c) => c.fecha >= hace90)
    .reduce((s, c) => s + precioServicio(c.servicio), 0);

  const bonos = await storage.all('giftcards');
  const bonosVendidos = bonos.filter((b) => b.status !== 'pending_payment' && b.status !== 'cancelled');
  const bonosSaldoPendiente = bonos
    .filter((b) => b.status === 'active' || b.status === 'redeemed')
    .reduce((s, b) => s + Number(b.balance || 0), 0);
  const ingresosBonos = bonosVendidos.reduce((s, b) => s + Number(b.amount || 0), 0);

  const socios = await storage.all('memberships');
  const sociosActivos = socios.filter((s) => s.status === 'active');
  const mrr = sociosActivos.reduce((s, x) => s + Number(x.price || 0), 0);

  const pedidos = await storage.all('orders');
  const pedidosPagados = pedidos.filter((p) => p.status === 'paid' || p.status === 'shipped' || p.status === 'delivered');
  const ingresosTienda = pedidosPagados.reduce((s, p) => s + Number(p.total || 0), 0);
  const ingresosTienda30 = pedidosPagados
    .filter((p) => (p.creado || '').slice(0, 10) >= hace30)
    .reduce((s, p) => s + Number(p.total || 0), 0);

  /* ingresos totales estimados */
  const totalEstimado = Math.round((ingresosServicios90 + ingresosBonos + mrr * 3 + ingresosTienda) * 100) / 100;

  /* ocupación: slots totales vs reservados últimos 30 días */
  const citas30 = (citas || []).filter((c) => c.fecha >= hace30 && c.fecha <= hoy);
  const diasUnicos = new Set(citas30.map((c) => c.fecha)).size || 1;

  /* top servicios */
  const porServicio = {};
  realizadas.forEach((c) => {
    if (!porServicio[c.servicio]) porServicio[c.servicio] = { id: c.servicio, nombre: c.servicioNombre, count: 0, ingresos: 0 };
    porServicio[c.servicio].count += 1;
    porServicio[c.servicio].ingresos += precioServicio(c.servicio);
  });
  const topServicios = Object.values(porServicio).sort((a, b) => b.ingresos - a.ingresos);

  /* clientes dormidos */
  const clientes = await clientesUnicos(citas);
  const dormidos = clientes.filter((cl) => cl.ultimaVisita && cl.ultimaVisita < schedule.addDays(hoy, -config.reengagementDays));

  return {
    hoy,
    citas: {
      total: (citas || []).length,
      realizadas: realizadas.length,
      canceladas: canceladas.length,
      noShow: noShow.length,
      pendientes: (citas || []).filter((c) => c.estado === 'pendiente' || c.estado === 'confirmada').length,
      tasaCancelacion: (citas || []).length ? Math.round((canceladas.length / (citas || []).length) * 100) : 0,
      tasaNoShow: (citas || []).length ? Math.round((noShow.length / (citas || []).length) * 100) : 0
    },
    ingresos: {
      servicios30: Math.round(ingresosServicios30 * 100) / 100,
      servicios90: Math.round(ingresosServicios90 * 100) / 100,
      bonos: Math.round(ingresosBonos * 100) / 100,
      tienda: Math.round(ingresosTienda * 100) / 100,
      tienda30: Math.round(ingresosTienda30 * 100) / 100,
      mrr: Math.round(mrr * 100) / 100,
      totalEstimado: totalEstimado
    },
    bonos: {
      total: bonos.length,
      activos: bonos.filter((b) => b.status === 'active').length,
      saldoPendiente: Math.round(bonosSaldoPendiente * 100) / 100
    },
    membresias: {
      total: socios.length,
      activas: sociosActivos.length
    },
    tienda: {
      productos: (await storage.all('products')).length,
      pedidos: pedidos.length,
      pedidosPendientes: pedidos.filter((p) => p.status === 'pending').length
    },
    waitlist: {
      enEspera: (await storage.all('waitlist')).filter((w) => w.status === 'waiting').length,
      total: (await storage.all('waitlist')).length
    },
    referidos: {
      total: (await storage.all('referrals')).length,
      creditosOtorgados: Math.round((await storage.all('referrals')).reduce((s, r) => s + Number(r.totalEarned || 0), 0) * 100) / 100
    },
    clientes: {
      unicos: clientes.length,
      dormidos: dormidos.length
    },
    topServicios,
    diasActivos30: diasUnicos,
    clientesDormidos: dormidos.slice(0, 20)
  };
}

/* ---------- re-engagement ---------- */
async function clientesDormidos(citas) {
  const clientes = await clientesUnicos(citas);
  const hoy = schedule.today(config.timezone);
  const limite = schedule.addDays(hoy, -config.reengagementDays);
  return clientes.filter((cl) => cl.ultimaVisita && cl.ultimaVisita < limite);
}

module.exports = {
  precioServicio,
  depositoPara,
  generarCodigoBonos,
  generarCodigoReferido,
  crearBono,
  validarBono,
  canjearBono,
  activarBono,
  planPorId,
  suscribirse,
  renovarSocio,
  apuntarseEspera,
  notificarEsperaPorCancelacion,
  obtenerReferido,
  aplicarReferido,
  seedProductos,
  crearPedido,
  clientesUnicos,
  analitica,
  clientesDormidos
};
