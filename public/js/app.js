const $ = id => document.getElementById(id);
const esc = t => String(t).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const GRAV = {
  leve:  { txt: 'Leve',  cls: 'leve',  sinal: '' },
  media: { txt: 'Média', cls: 'media', sinal: '' },
  grave: { txt: 'Grave', cls: 'grave', sinal: '' }
};
const NIVEL = { baixo: 'Situação normal', medio: 'Atenção', alto: 'Acompanhamento' };

let sessao = null, categorias = [], alunos = [], perfil = null, abaAtual = 'todas', alunoOc = null, temporizador;

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
const infoTurma = a => `${esc(a.classe || 'Sem classe')} · Turma ${esc(a.turma)} · Sala ${esc(a.sala)}`;

// ---------- Cartão compacto (tamanho fixo) ----------
function cartaoHtml(a) {
  const c = a.contagem;
  return `
    <article class="aluno nivel-${a.nivel}" data-acao="perfil" data-id="${a.id}" title="Abrir perfil">
      <div class="aluno-topo">
        <div class="avatar">${esc(iniciais(a.nome))}</div>
        <div class="aluno-id"><h3>${esc(a.nome)}</h3><p>${infoTurma(a)}</p></div>
      </div>
      <div><span class="semaforo ${a.nivel}">${NIVEL[a.nivel]}</span></div>
      <div class="chips">
        <span class="chip">${a.totalOcorrencias} total</span>
        <span class="chip">${a.pendentes} pendentes</span>
        <span class="chip">${c.leve} leve · ${c.media} média · ${c.grave} grave</span>
      </div>
      <div class="acoes">
        <button class="btn btn-pequeno" data-acao="ocorrencia" data-id="${a.id}">+ Ocorrência</button>
        <span class="ver">Ver perfil →</span>
      </div>
    </article>`;
}

// ---------- Perfil completo ----------
function ocorrenciaHtml(o) {
  const c = categorias.find(x => x.id === o.categoria) || { nome: 'Outro', icone: '📝' };
  const g = GRAV[o.gravidade] || GRAV.leve;
  const res = o.resolvida;
  return `
    <div class="ocorrencia ${g.cls} ${res ? 'resolvida' : ''}">
      <div class="oc-topo">
        <span class="oc-cat">${esc(c.nome)}</span>
        <span class="oc-selos">
          ${res ? '<span class="selo ok">Resolvida</span>' : ''}
          <span class="selo ${g.cls}">${g.sinal} ${g.txt}</span>
        </span>
      </div>
      <p>${esc(o.descricao)}</p>
      <div class="oc-rodape">
        <small>${esc(formatarData(o.data))}${o.professor ? ' · ' + esc(o.professor) : ''}
          ${res && o.resolvidaPor ? `<br>Resolvida por ${esc(o.resolvidaPor)} em ${esc(formatarData(o.resolvidaEm))}` : ''}</small>
        ${o.id ? `<button class="btn btn-pequeno ${res ? 'btn-claro-esc' : 'btn-ok'}"
          data-acao="resolver" data-oc="${o.id}" data-estado="${res ? 0 : 1}">${res ? 'Reabrir' : 'Resolver'}</button>` : ''}
      </div>
    </div>`;
}

function renderPerfil() {
  const a = perfil, c = a.contagem;
  const lista = [...a.ocorrencias].reverse().filter(o =>
    abaAtual === 'todas' || (abaAtual === 'pendentes' ? !o.resolvida : o.resolvida));
  const aba = (id, txt) => `<button class="aba ${abaAtual === id ? 'ativa' : ''}" data-acao="aba" data-aba="${id}">${txt}</button>`;

  $('perfil-conteudo').innerHTML = `
    <div class="perfil-topo">
      <div class="avatar avatar-grande">${esc(iniciais(a.nome))}</div>
      <div class="aluno-id"><h2>${esc(a.nome)}</h2><p>${infoTurma(a)}</p></div>
      <span class="semaforo ${a.nivel}">${NIVEL[a.nivel]}</span>
    </div>
    <p class="motivo">${esc(a.motivo)}</p>

    <div class="contactos">
      <span>Emergência: <b>${esc(a.emergencia)}</b></span>
      <span>Encarregado: <b>${esc(a.encarregado)}</b></span>
    </div>

    <div class="contadores tres">
      <div class="contador"><b>${a.totalOcorrencias}</b><small>Total</small></div>
      <div class="contador media"><b>${a.pendentes}</b><small>Pendentes</small></div>
      <div class="contador leve"><b>${a.resolvidas}</b><small>Resolvidas</small></div>
    </div>
    <div class="chips">
      <span class="chip">Pendentes por gravidade:</span>
      <span class="chip">sinal: '' ${c.leve} leves</span><span class="chip">${c.media} médias</span><span class="chip">${c.grave} graves</span>
    </div>

    <div class="abas">
      ${aba('todas', `Todas (${a.totalOcorrencias})`)}
      ${aba('pendentes', `Pendentes (${a.pendentes})`)}
      ${aba('resolvidas', `Resolvidas (${a.resolvidas})`)}
    </div>

    <div class="perfil-lista">
      ${lista.length ? lista.map(ocorrenciaHtml).join('') : '<p class="suave">Nenhuma ocorrência nesta lista.</p>'}
    </div>

    <div class="dialogo-acoes">
      ${sessao.perfil === 'coordenador' ? '<button class="btn btn-perigo" data-acao="eliminar">Eliminar aluno</button>' : ''}
      <button class="btn" data-acao="ocorrencia">+ Ocorrência</button>
      <button class="btn btn-claro-esc" data-acao="fechar">Fechar</button>
    </div>`;
}

async function abrirPerfil(id, resetAba = true) {
  perfil = await api('/api/alunos/' + id);
  if (resetAba) abaAtual = 'todas';
  renderPerfil();
  if (!$('dlg-perfil').open) $('dlg-perfil').showModal();
}

// ---------- Carregar dados ----------
async function carregarFiltros() {
  const classe = $('f-classe').value, turma = $('f-turma').value;
  const f = await api('/api/filtros?classe=' + encodeURIComponent(classe));
  $('f-classe').innerHTML = '<option value="">Todas as classes</option>' +
    f.classes.map(c => `<option>${esc(c)}</option>`).join('');
  $('f-turma').innerHTML = '<option value="">Todas as turmas</option>' +
    f.turmas.map(t => `<option>${esc(t)}</option>`).join('');
  $('f-classe').value = classe;
  $('f-turma').value = turma;
}

async function pesquisar() {
  const params = new URLSearchParams({
    q: $('pesquisa').value, classe: $('f-classe').value, turma: $('f-turma').value
  });
  alunos = await api('/api/alunos?' + params);
  $('resultados').innerHTML = alunos.length
    ? alunos.map(cartaoHtml).join('')
    : '<p class="vazio">Nenhum aluno encontrado.</p>';
  const partes = [`${alunos.length} aluno(s)`];
  if ($('f-classe').value) partes.push($('f-classe').value);
  if ($('f-turma').value) partes.push('Turma ' + $('f-turma').value);
  $('info-lista').textContent = partes.join(' · ');
}

async function estatisticas() {
  const r = await api('/api/resumo');
  $('est-alunos').textContent = r.alunos;
  $('est-ocorrencias').textContent = r.pendentes;
  $('est-graves').textContent = r.graves;
}
const atualizar = () => Promise.all([pesquisar(), estatisticas()]);

// ---------- Eventos ----------
$('pesquisa').addEventListener('input', () => {
  clearTimeout(temporizador);
  temporizador = setTimeout(pesquisar, 250);
});
$('f-classe').addEventListener('change', async () => {
  $('f-turma').value = '';              // ao mudar de classe, volta a "todas as turmas"
  await carregarFiltros();
  pesquisar();
});
$('f-turma').addEventListener('change', pesquisar);

function abrirOcorrencia(aluno) {
  alunoOc = aluno;
  $('titulo-ocorrencia').textContent = 'Nova ocorrência – ' + aluno.nome;
  $('erro-ocorrencia').textContent = '';
  $('dlg-ocorrencia').showModal();
}

// Cliques na lista: o elemento com data-acao mais próximo manda
$('resultados').addEventListener('click', e => {
  const el = e.target.closest('[data-acao]');
  if (!el) return;
  const id = Number(el.dataset.id);
  if (el.dataset.acao === 'ocorrencia') abrirOcorrencia(alunos.find(a => a.id === id));
  if (el.dataset.acao === 'perfil') abrirPerfil(id).catch(err => alert(err.message));
});

// Cliques dentro do perfil
$('perfil-conteudo').addEventListener('click', async e => {
  const el = e.target.closest('[data-acao]');
  if (!el) return;
  try {
    switch (el.dataset.acao) {
      case 'aba':
        abaAtual = el.dataset.aba; renderPerfil(); break;
      case 'resolver':
        perfil = await enviar(`/api/alunos/${perfil.id}/ocorrencias/${el.dataset.oc}/resolver`, 'POST',
          { resolvida: el.dataset.estado === '1' });
        renderPerfil(); atualizar(); break;
      case 'ocorrencia':
        abrirOcorrencia(perfil); break;
      case 'eliminar':
        if (!confirm('Eliminar este aluno e todas as suas ocorrências?')) return;
        await api('/api/alunos/' + perfil.id, { method: 'DELETE' });
        $('dlg-perfil').close();
        await carregarFiltros(); atualizar(); break;
      case 'fechar':
        $('dlg-perfil').close(); break;
    }
  } catch (err) { alert(err.message); }
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
    await carregarFiltros();
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
    const atualizado = await enviar(`/api/alunos/${alunoOc.id}/ocorrencias`, 'POST', {
      categoria: $('categoria').value,
      gravidade: document.querySelector('input[name="gravidade"]:checked').value,
      descricao: $('descricao').value
    });
    e.target.reset();
    $('categoria').dispatchEvent(new Event('change'));
    $('dlg-ocorrencia').close();
    if ($('dlg-perfil').open && perfil && perfil.id === atualizado.id) { perfil = atualizado; renderPerfil(); }
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
  $('categoria').innerHTML = categorias.map(c => `<option value="${esc(c.id)}">${esc(c.nome)}</option>`).join('');
  $('categoria').dispatchEvent(new Event('change'));
  $('sel-classe-novo').innerHTML = '<option value="">Escolha...</option>' +
    Array.from({ length: 13 }, (_, i) => `<option>${i + 1}ª Classe</option>`).join('');
  await carregarFiltros();
  atualizar();
})();