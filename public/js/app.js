const $ = id => document.getElementById(id);
const campos = ['nome', 'sala', 'turma', 'emergencia', 'encarregado'];

const esc = t => String(t).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function pesquisar() {
  const r = await fetch('/api/alunos?q=' + encodeURIComponent($('pesquisa').value));
  const alunos = await r.json();
  $('resultados').innerHTML = alunos.length ? alunos.map(a => `
    <div class="aluno">
      <h3>${esc(a.nome)}</h3>
      <p>Sala: <b>${esc(a.sala)}</b> | Turma: <b>${esc(a.turma)}</b><br>
         Emergência: ${esc(a.emergencia)} | Encarregado: ${esc(a.encarregado)}</p>
      <strong>Ocorrências (${a.ocorrencias.length})</strong>
      ${a.ocorrencias.map(o => `<div class="ocorrencia">${esc(o.data)} – ${esc(o.descricao)}</div>`).join('')}
      <button onclick="novaOcorrencia(${a.id})">+ Ocorrência</button>
    </div>`).join('') : '<p>Nenhum aluno encontrado.</p>';
}

async function novaOcorrencia(id) {
  const descricao = prompt('Descreva a ocorrência:');
  if (!descricao) return;
  await fetch(`/api/alunos/${id}/ocorrencias`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ descricao })
  });
  pesquisar();
}

$('btn-registar').onclick = async () => {
  const dados = {};
  campos.forEach(c => dados[c] = $(c).value);
  const r = await fetch('/api/alunos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados)
  });
  const res = await r.json();
  $('msg').textContent = r.ok ? '' : res.erro;
  if (r.ok) { campos.forEach(c => $(c).value = ''); pesquisar(); }
};

$('pesquisa').oninput = pesquisar;
pesquisar();