// Seguridad del servicio de reportes (NB-POL-P6-08, NB-MAT-P3-07):
//  - solo un medicoAdmin con sesion vigente puede pedir reportes o gestionar archivos;
//  - las descargas usan enlaces firmados que vencen (window.open no puede enviar cabeceras);
//  - cada exportacion y descarga queda en la bitacora inmutable de la base.
const crypto = require('crypto');
const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = require('../config');

const ANON = process.env.SUPABASE_ANON_KEY;
const SECRET = process.env.REPORT_DOWNLOAD_SECRET;
const MINUTOS_ENLACE = 15;

function tokenDe(req) {
  return (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim();
}

// Valida el token contra la base (sesion vigente, 10 min de inactividad, 12 h, terminos) y exige rol medicoAdmin.
async function autenticarAdmin(req) {
  const token = tokenDe(req);
  if (!token) throw new Error('No autorizado');
  if (!ANON) throw new Error('Falta SUPABASE_ANON_KEY en el servicio de reportes');
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/estado_sesion`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!r.ok) throw new Error('No autorizado');
  const est = await r.json();
  if (!est || !est.valida || est.bloqueado || est.rol !== 'medicoAdmin') throw new Error('No autorizado');
  const sub = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).sub;
  return { id: sub, rol: est.rol };
}

function firma(archivo, exp, uid) {
  return crypto.createHmac('sha256', SECRET || '').update(`${archivo}|${exp}|${uid}`).digest('hex');
}

function firmarUrl(url, uid) {
  const base = String(url).split('?')[0];
  const archivo = decodeURIComponent(base.replace(/^\/download\//, ''));
  const exp = Date.now() + MINUTOS_ENLACE * 60 * 1000;
  return `${base}?e=${exp}&u=${uid}&t=${firma(archivo, exp, uid)}`;
}

function verificarFirma(archivo, e, u, t) {
  if (!SECRET || !e || !u || !t) return false;
  if (!Number(e) || Number(e) < Date.now()) return false;
  const a = Buffer.from(firma(archivo, e, u));
  const b = Buffer.from(String(t));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function registrar({ actor_id, actor_rol, cuenta_id = null, accion, objeto, ip = null, user_agent = null }) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/audit_log`, {
      method: 'POST',
      headers: { apikey: SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ actor_id, actor_rol, cuenta_id, accion, objeto: String(objeto).slice(0, 60), ip, user_agent: user_agent ? String(user_agent).slice(0, 300) : null }),
    });
  } catch (e) {
    console.error('No se pudo registrar en la bitacora:', e.message);
  }
}

module.exports = { autenticarAdmin, firmarUrl, verificarFirma, registrar };
