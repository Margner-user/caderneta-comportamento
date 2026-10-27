const crypto = require('crypto');
const { lerUtilizadores, gravarUtilizadores } = require('./storage');

const sessoes = new Map();                 // token -> sessão (em memória)
const DURACAO = 8 * 60 * 60 * 1000;        // sessão: 8 horas
const ONLINE = 5 * 60 * 1000;              // online: atividade nos últimos 5 min
const GUARDAR_A_CADA = 60 * 1000;          // grava o último acesso no máx. 1x por minuto
const PERFIS = ['professor', 'coordenador'];

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

// Guarda no ficheiro a data do último acesso do utilizador
function registarAcesso(utilizador) {
  const lista = lerUtilizadores();
  const u = lista.find(x => x.utilizador === utilizador);
  if (!u) return;
  u.ultimoAcesso = new Date().toISOString();
  gravarUtilizadores(lista);
}

function login(utilizador, senha) {
  const nomeUtilizador = String(utilizador).toLowerCase();
  const u = lerUtilizadores().find(x => x.utilizador === nomeUtilizador);
  if (!u || !verificar(senha, u.senha)) return null;
  const token = crypto.randomBytes(32).toString('hex');
  const agora = Date.now();
  sessoes.set(token, {
    utilizador: u.utilizador, nome: u.nome, perfil: u.perfil,
    entrou: agora, ultimaAtividade: agora, guardadoEm: agora, expira: agora + DURACAO
  });
  registarAcesso(u.utilizador);
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
  const agora = Date.now();
  if (s.expira < agora) { sessoes.delete(t); return null; }
  s.ultimaAtividade = agora;
  if (agora - s.guardadoEm > GUARDAR_A_CADA) {
    s.guardadoEm = agora;
    registarAcesso(s.utilizador);
  }
  return s;
}

function terminar(req) {
  const t = tokenDe(req);
  const s = t && sessoes.get(t);
  if (s) { registarAcesso(s.utilizador); sessoes.delete(t); }
}

function estaOnline(utilizador) {
  const agora = Date.now();
  for (const s of sessoes.values()) {
    if (s.utilizador === utilizador && s.expira > agora && agora - s.ultimaAtividade <= ONLINE) return true;
  }
  return false;
}

// Painel "Utilizadores online" (uma linha por pessoa)
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

// Lista de todas as contas (NUNCA devolve a palavra-passe)
function listarUtilizadores() {
  return lerUtilizadores()
    .map(u => ({
      utilizador: u.utilizador, nome: u.nome, perfil: u.perfil,
      criadoEm: u.criadoEm || null,
      ultimoAcesso: u.ultimoAcesso || null,
      online: estaOnline(u.utilizador)
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
}

// Cria uma conta nova, com validação. Devolve { erro } ou { ok: true }
function criarUtilizador(d, criadoPor) {
  const utilizador = String(d.utilizador || '').trim().toLowerCase();
  const nome = String(d.nome || '').trim().replace(/\s+/g, ' ');
  const perfil = String(d.perfil || '');
  const senha = String(d.senha || '');

  if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(utilizador))
    return { erro: 'Utilizador inválido: 3 a 30 caracteres (letras, números, ponto, hífen), ex.: prof.ana.' };
  if (nome.length < 5 || nome.length > 80 || nome.split(' ').length < 2 || !/^[\p{L}][\p{L}' -]+$/u.test(nome))
    return { erro: 'Nome inválido: escreva o nome completo, só com letras.' };
  if (!PERFIS.includes(perfil))
    return { erro: 'Perfil inválido. Escolha professor ou coordenador.' };
  if (senha.length < 8 || !/[A-Za-z]/.test(senha) || !/\d/.test(senha))
    return { erro: 'Palavra-passe fraca: mínimo 8 caracteres, com letras e números.' };

  const lista = lerUtilizadores();
  if (lista.some(u => u.utilizador === utilizador))
    return { erro: 'Esse nome de utilizador já existe.' };

  lista.push({
    utilizador, nome, perfil, senha: hash(senha),
    criadoEm: new Date().toISOString(), criadoPor
  });
  gravarUtilizadores(lista);
  return { ok: true };
}

module.exports = { hash, login, sessaoDe, terminar, online, listarUtilizadores, criarUtilizador };  