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
// Valida e normaliza os dados de um aluno. Devolve { erro } ou { dados }.
function validarAluno(d) {
  const nome = String(d.nome || '').trim().replace(/\s+/g, ' ');
  const classe = String(d.classe || '').trim();
  const turma = String(d.turma || '').trim().toUpperCase();
  const sala = String(d.sala || '').trim();
  const tel = v => String(v || '').replace(/[\s.-]/g, '');
  const emergencia = tel(d.emergencia), encarregado = tel(d.encarregado);

  if (nome.length < 5 || nome.length > 80 || nome.split(' ').length < 2 || !/^[\p{L}][\p{L}' -]+$/u.test(nome))
    return { erro: 'Nome inválido: escreva o nome completo, só com letras (ex.: João Vicente).' };
  if (!classes.includes(classe))
    return { erro: 'Classe inválida. Valores aceites: ' + classes.join(', ') + '.' };
  if (!/^[A-Z0-9]{1,3}$/.test(turma))
    return { erro: 'Turma inválida. Use 1 a 3 letras ou números (ex.: A, B, 2, A1).' };
  if (!/^[\p{L}\d][\p{L}\d .-]{0,9}$/u.test(sala))
    return { erro: 'Sala inválida (ex.: 12, B3, Lab 1).' };
  const telOk = /^\+?\d{9,15}$/;
  if (!telOk.test(emergencia))
    return { erro: 'Nº de emergência inválido: use só dígitos, 9 a 15 (ex.: 923456789 ou +244923456789).' };
  if (!telOk.test(encarregado))
    return { erro: 'Nº do encarregado inválido: use só dígitos, 9 a 15 (ex.: 923456789 ou +244923456789).' };

  return { dados: { nome, classe, turma, sala, emergencia, encarregado } };
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
       // Registar aluno (com validação)
    if (p === '/api/alunos' && req.method === 'POST') {
      const v = validarAluno(await corpo(req));
      if (v.erro) return json(res, 400, { erro: v.erro });
      const lista = ler();
      const repetido = lista.some(a => norm(a.nome) === norm(v.dados.nome)
        && a.classe === v.dados.classe && norm(a.turma) === norm(v.dados.turma));
      if (repetido) return json(res, 409, { erro: 'Já existe um aluno com esse nome nesta classe e turma.' });
      const aluno = { id: Date.now(), ...v.dados, ocorrencias: [] };
      lista.push(aluno);
      gravar(lista);
      return json(res, 201, paraLista(aluno));
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
    }const http = require('http');
const fs = require('fs');
const path = require('path');
const { ler, gravar } = require('./storage');
const auth = require('./auth');
const { categorias, gravidades, regras, classes } = require('./categorias');
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

const norm = s => String(s || '').trim().toLowerCase();
const unicos = arr => [...new Set(arr.map(x => String(x || '').trim()).filter(Boolean))]
  .sort((a, b) => a.localeCompare(b, 'pt', { numeric: true }));

// Contagem AUTOMÁTICA e estado cumulativo (só ocorrências pendentes).
function resumo(a) {
  const ocorrencias = (a.ocorrencias || []).map(o => ({ categoria: 'outro', gravidade: 'leve', resolvida: false, ...o }));
  const pendentesLista = ocorrencias.filter(o => !o.resolvida);
  const contagem = { leve: 0, media: 0, grave: 0 };
  pendentesLista.forEach(o => { if (contagem[o.gravidade] !== undefined) contagem[o.gravidade]++; });

  // Acumulação: leves -> médias -> graves
  const mediasEq = contagem.media + Math.floor(contagem.leve / regras.leves_para_media);
  const gravesEq = contagem.grave + Math.floor(mediasEq / regras.medias_para_grave);

  let nivel = 'baixo', motivo = 'Sem ocorrências pendentes.';
  if (contagem.grave >= 1) { nivel = 'alto'; motivo = 'Tem ocorrência grave pendente.'; }
  else if (gravesEq >= 1) { nivel = 'alto'; motivo = 'As ocorrências acumuladas equivalem a uma grave.'; }
  else if (contagem.media >= 1) { nivel = 'medio'; motivo = 'Tem ocorrência média pendente.'; }
  else if (mediasEq >= 1) { nivel = 'medio'; motivo = `${regras.leves_para_media} leves acumuladas equivalem a uma média.`; }
  else if (pendentesLista.length) { motivo = 'Poucas ocorrências leves pendentes.'; }

  return {
    ...a, ocorrencias, contagem, nivel, motivo,
    totalOcorrencias: ocorrencias.length,
    pendentes: pendentesLista.length,
    resolvidas: ocorrencias.length - pendentesLista.length
  };
}
// Versão para a lista: sem o histórico completo (o cartão só mostra o resumo)
const paraLista = a => { const { ocorrencias, ...r } = resumo(a); return r; };

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
        pendentes: lista.reduce((s, a) => s + a.pendentes, 0),
        graves: lista.reduce((s, a) => s + a.contagem.grave, 0)
      });
    }

    // Classes e turmas existentes (as turmas dependem da classe escolhida)
    if (p === '/api/filtros') {
      const todos = ler();
      const classe = norm(url.searchParams.get('classe'));
      return json(res, 200, {
        classes: unicos(todos.map(a => a.classe)),
        turmas: unicos(todos.filter(a => !classe || norm(a.classe) === classe).map(a => a.turma))
      });
    }

    // Pesquisar: texto + classe + turma
    if (p === '/api/alunos' && req.method === 'GET') {
      const q = norm(url.searchParams.get('q'));
      const classe = norm(url.searchParams.get('classe'));
      const turma = norm(url.searchParams.get('turma'));
      const r = ler()
        .filter(a => (!classe || norm(a.classe) === classe)
                  && (!turma || norm(a.turma) === turma)
                  && (!q || [a.nome, a.turma, a.sala, a.classe].some(c => norm(c).includes(q))))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt'))
        .map(paraLista);
      return json(res, 200, r);
    }

    // Registar aluno
    if (p === '/api/alunos' && req.method === 'POST') {
      const d = await corpo(req);
      const campos = ['nome', 'classe', 'sala', 'turma', 'emergencia', 'encarregado'];
      if (campos.some(c => !d[c] || !String(d[c]).trim()))
        return json(res, 400, { erro: 'Preencha todos os campos.' });
      const lista = ler();
      const aluno = { id: Date.now(), ocorrencias: [] };
      campos.forEach(c => aluno[c] = String(d[c]).trim());
      aluno.turma = aluno.turma.toUpperCase();
      lista.push(aluno);
      gravar(lista);
      return json(res, 201, paraLista(aluno));
    }

    // Perfil de um aluno (com TODAS as ocorrências) e eliminar
    const un = p.match(/^\/api\/alunos\/(\d+)$/);
    if (un && req.method === 'GET') {
      const a = ler().find(x => x.id === Number(un[1]));
      return a ? json(res, 200, resumo(a)) : json(res, 404, { erro: 'Aluno não encontrado.' });
    }
    if (un && req.method === 'DELETE') {
      if (sessao.perfil !== 'coordenador') return json(res, 403, { erro: 'Apenas coordenadores podem eliminar.' });
      const lista = ler();
      const nova = lista.filter(a => a.id !== Number(un[1]));
      if (nova.length === lista.length) return json(res, 404, { erro: 'Aluno não encontrado.' });
      gravar(nova);
      return json(res, 200, { ok: true });
    }

    // Adicionar ocorrência
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
        professor: sessao.nome,
        resolvida: false
      });
      gravar(lista);
      return json(res, 201, resumo(aluno));
    }

    // Resolver (ou reabrir) ocorrência
    const rs = p.match(/^\/api\/alunos\/(\d+)\/ocorrencias\/(\d+)\/resolver$/);
    if (rs && req.method === 'POST') {
      const d = await corpo(req);
      const lista = ler();
      const aluno = lista.find(a => a.id === Number(rs[1]));
      const oc = aluno && (aluno.ocorrencias || []).find(o => o.id === Number(rs[2]));
      if (!oc) return json(res, 404, { erro: 'Ocorrência não encontrada.' });
      if (d.resolvida === false) {
        oc.resolvida = false; delete oc.resolvidaPor; delete oc.resolvidaEm;
      } else {
        oc.resolvida = true; oc.resolvidaPor = sessao.nome; oc.resolvidaEm = new Date().toISOString();
      }
      gravar(lista);
      return json(res, 200, resumo(aluno));
    }

    return json(res, 404, { erro: 'Rota não encontrada.' });
  }

  // ---------- Ficheiros estáticos ----------
  const rel = p === '/' ? '/index.html' : p;
  if (rel === '/index.html' && !sessao) {
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