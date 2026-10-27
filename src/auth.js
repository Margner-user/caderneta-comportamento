const crypto = require('crypto');
const { lerUtilizadores } = require('./storage');

const sessoes = new Map(); // token -> dados do utilizador (em memória)
const DURACAO = 8 * 60 * 60 * 1000;   // sessão: 8 horas
const ONLINE = 5 * 60 * 1000;         // "online": atividade nos últimos 5 minutos

function hash(senha) {
  const sal = crypto.randomBytes(16).toString('hex');
  return sal + ':' + crypto.scryptSync(senha, sal, 64).toString('hex');
}

function verificar(senha, guardado) {
  const [sal, h] = String(guardado).split(':');
  if (!sal || !h) return false;
  const calculado = crypto.scryptSync(senha, sal, 64);
  const esperado = Buffer.from(h, 'hex');
  return calculado.length === esperado.length && crypto.timingSafeEqual(calculado, esperado);
}

function login(utilizador, senha) {
  const u = lerUtilizadores().find(x => x.utilizador === utilizador);
  if (!u || !verificar(senha, u.senha)) return null;
  const token = crypto.randomBytes(32).toString('hex');
  const agora = Date.now();
  sessoes.set(token, {
    utilizador: u.utilizador, nome: u.nome, perfil: u.perfil,
    entrou: agora, ultimaAtividade: agora, expira: agora + DURACAO
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
  s.ultimaAtividade = Date.now();
  return s;
}

function terminar(req) {
  const t = tokenDe(req);
  if (t) sessoes.delete(t);
}

// Lista de utilizadores online (uma linha por pessoa, mesmo com várias sessões)
function online() {
  const agora = Date.now();
  const porUtilizador = new Map();
  for (const [token, s] of sessoes) {
    if (s.expira < agora) { sessoes.delete(token); continue; }
    if (agora - s.ultimaAtividade > ONLINE) continue;
    const atual = porUtilizador.get(s.utilizador);
    if (!atual || s.ultimaAtividade > atual.ultimaAtividade) porUtilizador.set(s.utilizador, s);
  }
  return [...porUtilizador.values()]
    .map(s => ({
      utilizador: s.utilizador, nome: s.nome, perfil: s.perfil,
      entrou: new Date(s.entrou).toISOString(),
      ultimaAtividade: new Date(s.ultimaAtividade).toISOString()
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
}

module.exports = { hash, login, sessaoDe, terminar, online };