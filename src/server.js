const http = require('http');
const fs = require('fs');
const path = require('path');
const { ler, gravar } = require('./storage');

const PUB = path.join(__dirname, '..', 'public');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript' };

const json = (res, cod, obj) => {
  res.writeHead(cod, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
};
const corpo = req => new Promise(ok => {
  let b = '';
  req.on('data', c => b += c);
  req.on('end', () => { try { ok(JSON.parse(b)); } catch { ok({}); } });
});

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;

  // Pesquisar alunos
  if (p === '/api/alunos' && req.method === 'GET') {
    const q = (url.searchParams.get('q') || '').toLowerCase();
    return json(res, 200, ler().filter(a => a.nome.toLowerCase().includes(q)));
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
    return json(res, 201, aluno);
  }

  // Adicionar ocorrência
  const m = p.match(/^\/api\/alunos\/(\d+)\/ocorrencias$/);
  if (m && req.method === 'POST') {
    const d = await corpo(req);
    const lista = ler();
    const aluno = lista.find(a => a.id === Number(m[1]));
    if (!aluno || !d.descricao) return json(res, 400, { erro: 'Dados inválidos.' });
    aluno.ocorrencias.push({
      data: new Date().toLocaleString('pt-PT'),
      descricao: String(d.descricao).trim()
    });
    gravar(lista);
    return json(res, 201, aluno);
  }

  // Ficheiros estáticos
    // Eliminar aluno
  const del = p.match(/^\/api\/alunos\/(\d+)$/);
  if (del && req.method === 'DELETE') {
    const lista = ler();
    const nova = lista.filter(a => a.id !== Number(del[1]));
    if (nova.length === lista.length) return json(res, 404, { erro: 'Aluno não encontrado.' });
    gravar(nova);
    return json(res, 200, { ok: true });
  }
  const ficheiro = path.join(PUB, p === '/' ? 'index.html' : p);
  if (!ficheiro.startsWith(PUB) || !fs.existsSync(ficheiro)) {
    res.writeHead(404); return res.end('Não encontrado');
  }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(ficheiro)] || 'text/plain' });
  fs.createReadStream(ficheiro).pipe(res);
}).listen(3000, () => console.log('http://localhost:3000'));