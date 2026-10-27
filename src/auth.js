const crypto = require('crypto');
const { lerUtilizadores } = require('./storage');

const sessoes = new Map(); // token -> dados do utilizador (em memória)

// Guarda "sal:hash". Nunca se guarda a palavra-passe original.
function hash(senha) {
  const sal = crypto.randomBytes(16).toString('hex');
  return sal + ':' + crypto.scryptSync(senha, sal, 64).toString('hex');
}

function verificar(senha, guardado) {
  const [sal, h] = String(guardado).split(':');
  const calculado = crypto.scryptSync(senha, sal, 64);
  return crypto.timingSafeEqual(calculado, Buffer.from(h, 'hex'));
}

function login(utilizador, senha) {
  const u = lerUtilizadores().find(x => x.utilizador === utilizador);
  if (!u || !verificar(senha, u.senha)) return null;
  const token = crypto.randomBytes(32).toString('hex');
  sessoes.set(token, {
    utilizador: u.utilizador, nome: u.nome, perfil: u.perfil,
    expira: Date.now() + 8 * 60 * 60 * 1000 // 8 horas
  });
  return token;
}

function tokenDe(req) {
  const m = (req.headers.cookie || '').match(/(?:^|;\s*)sid=([a-f0-9]+)/);
  return m ? m[1] : null;
}

function sessaoDe(req) {
  const t = tokenDe(req);
  const s = t && sessoes.get(t);
  if (!s) return null;
  if (s.expira < Date.now()) { sessoes.delete(t); return null; }
  return s;
}

function terminar(req) { sessoes.delete(tokenDe(req)); }

module.exports = { hash, login, sessaoDe, terminar };