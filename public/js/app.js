const $ = id => document.getElementById(id);
const esc = t => String(t).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const GRAV = {
  leve:  { txt: 'Leve',  cls: 'leve',  sinal: '🟢' },
  media: { txt: 'Média', cls: 'media', sinal: '🟡' },
  grave: { txt: 'Grave', cls: 'grave', sinal: '🔴' }
};
const NIVEL = { baixo: '🟢 Situação normal', medio: '🟡 Atenção', alto: '🔴 Acompanhamento' };

let sessao = null, categorias = [], alunos = [], alunoAtual = null, temporizador;

// ---------- Utilitários ----------
async function api(url, opcoes) {
  const r = await fetch(url, opcoes);
  if (r.status === 401) { location.href = '/login.html'; throw new Error('Sessão expirada'); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.erro || 'Erro no servidor');
  return d;
}
const enviar = (url, metodo, corpo) => api(url, {
  method: metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo || {})
});
const iniciais = nome => nome.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
const formatarData = d => { const x = new Date(d); return isNaN(x) ? d : x.toLocaleString('pt-PT'); };

// ---------- Desenho das fichas ----------
function ocorrenciaHtml(o) {
  const c = categorias.find(x => x.id === o.categoria) || { nome: 'Outro', icone: '📝' };
  const g = GRAV[o.gravidade] || GRAV.leve;
  return `
    <div class="ocorrencia ${g.cls}">
      <div class="oc-topo">
        <span class="oc-cat">${esc(c.icone)} ${esc(c.nome)}</span>
        <span class="selo ${g.cls}">${g.sinal} ${g.txt}</span>
      </div>
      <p>${esc(o.descricao)}</p>
      <small>${esc(formatarData(o.data))}${o.professor ? ' · ' + esc(o.professor) : ''}</small>
    </div>`;
}

function cartaoHtml(a) {
  const g = a.contagem;
  return `
    <article class="aluno nivel-${a.nivel}">
      <div class="aluno-topo">
        <div class="avatar">${esc(iniciais(a.nome))}</div>
        <div class="aluno-id">
          <h3>${esc(a.nome)}</h3>
          <p>Sala ${esc(a.sala)} · Turma ${esc(a.turma)}</p>
        </div>
        <span class="semaforo ${a.nivel}">${NIVEL[a.nivel]}</span>
      </div>

      <div class="contactos">
        <span>🚨 Emergência: <b>${esc(a.emergencia)}</b></span>
        <span>👤 Encarregado: <b>${esc(a.encarregado)}</b></span>
      </div>

      <div class="contadores">
        <div class="contador"><b>${a.totalOcorrencias}</b><small>Total</small></div>
        <div class="contador leve"><b>${g.leve}</b><small>🟢 Leves</small></div>
        <div class="contador media"><b>${g.media}</b><small>🟡 Médias</small></div>
        <div class="contador grave"><b>${g.grave}</b><small>🔴 Graves</small></div>
      </div>

      <div class="ocorrencias">
        ${a.ocorrencias.length
          ? [...a.ocorrencias].reverse().map(ocorrenciaHtml).join('')
          : '<p class="suave">Sem ocorrências registadas.</p>'}
      </div>

      <div class="acoes">
        <button class="btn" data-acao="ocorrencia" data-id="${a.id}">+ Ocorrência</button>
        ${sessao.perfil === 'coordenador'
          ? `<button class="btn btn-perigo" data-acao="eliminar" data-id="${a.id}">Eliminar</button>` : ''}
      </div>
    </article>`;
}

// ---------- Carregar dados ----------
async function pesquisar() {
  alunos = await api('/api/alunos?q=' + encodeURIComponent($('pesquisa').value));
  $('resultados').innerHTML = alunos.length
    ? alunos.map(cartaoHtml).join('')
    : '<p class="vazio">Nenhum aluno encontrado.</p>';
}
async function estatisticas() {
  const r = await api('/api/resumo');
  $('est-alunos').textContent = r.alunos;
  $('est-ocorrencias').textContent = r.ocorrencias;
  $('est-graves').textContent = r.graves;
}
const atualizar = () => Promise.all([pesquisar(), estatisticas()]);

// ---------- Eventos ----------
$('pesquisa').addEventListener('input', () => {
  clearTimeout(temporizador);
  temporizador = setTimeout(pesquisar, 250);
});

$('resultados').addEventListener('click', async e => {
  const b = e.target.closest('button[data-acao]');
  if (!b) return;
  const id = Number(b.dataset.id);
  if (b.dataset.acao === 'ocorrencia') {
    alunoAtual = alunos.find(a => a.id === id);
    $('titulo-ocorrencia').textContent = 'Nova ocorrência – ' + alunoAtual.nome;
    $('erro-ocorrencia').textContent = '';
    $('dlg-ocorrencia').showModal();
  }
  if (b.dataset.acao === 'eliminar') {
    if (!confirm('Eliminar este aluno e todas as suas ocorrências?')) return;
    try { await api('/api/alunos/' + id, { method: 'DELETE' }); atualizar(); }
    catch (err) { alert(err.message); }
  }
});

$('btn-novo-aluno').onclick = () => { $('erro-aluno').textContent = ''; $('dlg-aluno').showModal(); };
document.querySelectorAll('[data-fechar]').forEach(b =>
  b.onclick = () => $(b.dataset.fechar).close());

$('form-aluno').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    await enviar('/api/alunos', 'POST', Object.fromEntries(new FormData(e.target)));
    e.target.reset();
    $('dlg-aluno').close();
    atualizar();
  } catch (err) { $('erro-aluno').textContent = err.message; }
});

// Ao escolher a categoria, sugere a gravidade
$('categoria').addEventListener('change', () => {
  const c = categorias.find(x => x.id === $('categoria').value);
  if (c) document.querySelector(`input[name="gravidade"][value="${c.gravidadeSugerida}"]`).checked = true;
});

$('form-ocorrencia').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    await enviar(`/api/alunos/${alunoAtual.id}/ocorrencias`, 'POST', {
      categoria: $('categoria').value,
      gravidade: document.querySelector('input[name="gravidade"]:checked').value,
      descricao: $('descricao').value
    });
    e.target.reset();
    $('categoria').dispatchEvent(new Event('change'));
    $('dlg-ocorrencia').close();
    atualizar();
  } catch (err) { $('erro-ocorrencia').textContent = err.message; }
});

$('btn-sair').onclick = async () => {
  await enviar('/api/logout', 'POST');
  location.href = '/login.html';
};

// ---------- Arranque ----------
(async () => {
  sessao = await api('/api/eu');
  $('user-nome').textContent = sessao.nome;
  $('user-perfil').textContent = sessao.perfil === 'coordenador' ? 'Coordenador' : 'Professor';
  categorias = await api('/api/categorias');
  $('categoria').innerHTML = categorias.map(c => `<option value="${esc(c.id)}">${esc(c.icone)} ${esc(c.nome)}</option>`).join('');
  $('categoria').dispatchEvent(new Event('change'));
  atualizar();
})();