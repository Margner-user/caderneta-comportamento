const http = require('http');
const fs = require('fs');
const path = require('path');
const { ler, gravar } = require('./storage');
const auth = require('./auth');
const { categorias, gravidades } = require('./categorias');

const PUB = path.join(__dirname, '..', 'public');
const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8'
};

const json = (res, cod, obj, extra = {}) => {
  res.writeHead(cod, { 'Content-Type': 'application/json; charset=utf-8', ...extra });
  res.end(JSON.stringify(obj));
};
const corpo = req => new Promise(ok => {
  let b = '';
  req.on('data', c => b += c);
  req.on('end', () => { try { ok(JSON.parse(b)); } catch { ok({}); } });
});

// Contagem AUTOMÁTICA: calculada aqui, a cada pedido, nunca escrita à mão.
function resumo(a) {
  const ocorrencias = (a.ocorrencias || []).map(o => ({ categoria: 'outro', gravidade: 'leve', ...o }));
  const contagem = { leve: 0, media: 0, grave: 0 };
  ocorrencias.forEach(o => { if (contagem[o.gravidade] !== undefined) contagem[o.gravidade]++; });
  const pontos = contagem.leve * gravidades.leve + contagem.media * gravidades.media + contagem.grave * gravidades.grave;
  const nivel = contagem.grave >= 1 || pontos >= 8 ? 'alto' : pontos >= 4 ? 'medio' : 'baixo';
  return { ...a, ocorrencias, totalOcorrencias: ocorrencias.length, contagem, pontos, nivel };
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;
  const sessao = auth.sessaoDe(req);

  // ---------- Login / logout (públicos) ----------
  if (p === '/api/login' && req.method === 'POST') {
    const d = await corpo(req);
    const token = auth.login(String(d.utilizador || '').trim(), String(d.senha || ''));
    if (!token) return json(res, 401, { erro: 'Utilizador ou palavra-passe incorretos.' });
    return json(res, 200, { ok: true },
      { 'Set-Cookie': `sid=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800` });
  }
  if (p === '/api/logout' && req.method === 'POST') {
    auth.terminar(req);
    return json(res, 200, { ok: true }, { 'Set-Cookie': 'sid=; HttpOnly; Path=/; Max-Age=0' });
  }

  // ---------- API protegida ----------
  if (p.startsWith('/api/')) {
    if (!sessao) return json(res, 401, { erro: 'Sessão expirada. Faça login.' });

    if (p === '/api/eu') return json(res, 200, { nome: sessao.nome, perfil: sessao.perfil });
    if (p === '/api/categorias') return json(res, 200, categorias);

    if (p === '/api/resumo') {
      const lista = ler().map(resumo);
      return json(res, 200, {
        alunos: lista.length,
        ocorrencias: lista.reduce((s, a) => s + a.totalOcorrencias, 0),
        graves: lista.reduce((s, a) => s + a.contagem.grave, 0)
      });
    }

    // Pesquisar (nome, turma ou sala)
    if (p === '/api/alunos' && req.method === 'GET') {
      const q = (url.searchParams.get('q') || '').toLowerCase();
      const r = ler().filter(a =>
        [a.nome, a.turma, a.sala].some(c => String(c).toLowerCase().includes(q))).map(resumo);
      return json(res, 200, r);
    }

    // Registar aluno
    if (p === '/api/alunos' && req.method === 'POST') {
      const d = await corpo(req);
      const campos = ['nome', 'sala', 'turma', 'emergencia', 'encarregado'];
      if (campos.some(c => !d[c] || !String(d[c]).trim()))
        return json(res, 400, { erro: 'Preencha todos os campos.' });
      const lista = ler();
      const aluno = { id: Date.now(), ocorrencias: [] };
      campos.forEach(c => aluno[c] = String(d[c]).trim());
      lista.push(aluno);
      gravar(lista);
      return json(res, 201, resumo(aluno));
    }

    // Adicionar ocorrência (com categoria e gravidade)
    const m = p.match(/^\/api\/alunos\/(\d+)\/ocorrencias$/);
    if (m && req.method === 'POST') {
      const d = await corpo(req);
      const lista = ler();
      const aluno = lista.find(a => a.id === Number(m[1]));
      if (!aluno) return json(res, 404, { erro: 'Aluno não encontrado.' });
      if (!categorias.some(c => c.id === d.categoria)) return json(res, 400, { erro: 'Categoria inválida.' });
      if (!(d.gravidade in gravidades)) return json(res, 400, { erro: 'Gravidade inválida.' });
      if (!d.descricao || !String(d.descricao).trim()) return json(res, 400, { erro: 'Escreva a descrição.' });
      aluno.ocorrencias.push({
        id: Date.now(),
        data: new Date().toISOString(),
        categoria: d.categoria,
        gravidade: d.gravidade,
        descricao: String(d.descricao).trim(),
        professor: sessao.nome
      });
      gravar(lista);
      return json(res, 201, resumo(aluno));
    }

    // Eliminar aluno (só coordenador)
    const del = p.match(/^\/api\/alunos\/(\d+)$/);
    if (del && req.method === 'DELETE') {
      if (sessao.perfil !== 'coordenador') return json(res, 403, { erro: 'Apenas coordenadores podem eliminar.' });
      const lista = ler();
      const nova = lista.filter(a => a.id !== Number(del[1]));
      if (nova.length === lista.length) return json(res, 404, { erro: 'Aluno não encontrado.' });
      gravar(nova);
      return json(res, 200, { ok: true });
    }

    return json(res, 404, { erro: 'Rota não encontrada.' });
  }

  // ---------- Ficheiros estáticos ----------
  const rel = p === '/' ? '/index.html' : p;
  if (rel === '/index.html' && !sessao) {          // página principal exige login
    res.writeHead(302, { Location: '/login.html' });
    return res.end();
  }
  const ficheiro = path.join(PUB, rel);
  if (!ficheiro.startsWith(PUB) || !fs.existsSync(ficheiro) || fs.statSync(ficheiro).isDirectory()) {
    res.writeHead(404); return res.end('Não encontrado');
  }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(ficheiro)] || 'text/plain' });
  fs.createReadStream(ficheiro).pipe(res);
}).listen(3000, () => console.log('http://localhost:3000'));