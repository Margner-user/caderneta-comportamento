const $ = id => document.getElementById(id);
const esc = t => String(t).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function api(url, opcoes) {
  const r = await fetch(url, opcoes);
  if (r.status === 401) { location.href = '/login.html'; throw new Error('Sessão expirada'); }
  if (r.status === 403) { location.href = '/'; throw new Error('Sem permissão'); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.erro || 'Erro no servidor');
  return d;
}

const formatar = d => d
  ? new Date(d).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : 'Nunca entrou';

async function carregar() {
  const r = await api('/api/utilizadores');
  $('n-total').textContent = r.total;
  $('n-prof').textContent = r.professores;
  $('n-coord').textContent = r.coordenadores;
  $('n-online').textContent = r.online;
  $('corpo-tabela').innerHTML = r.lista.map(u => `
    <tr>
      <td><strong>${esc(u.nome)}</strong></td>
      <td>${esc(u.utilizador)}</td>
      <td><span class="chip">${u.perfil === 'coordenador' ? 'Coordenador' : 'Professor'}</span></td>
      <td>${u.online
        ? '<span class="selo leve">Online</span>'
        : '<span class="chip">Offline</span>'}</td>
      <td>${u.online ? 'Agora' : esc(formatar(u.ultimoAcesso))}</td>
    </tr>`).join('');
}

$('btn-novo').onclick = () => { $('erro-user').textContent = ''; $('dlg-user').showModal(); };
$('btn-cancelar').onclick = () => $('dlg-user').close();

$('form-user').addEventListener('submit', async e => {
  e.preventDefault();
  const d = Object.fromEntries(new FormData(e.target));
  if (d.senha !== d.confirmar) { $('erro-user').textContent = 'As palavras-passe não coincidem.'; return; }
  try {
    await api('/api/utilizadores', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: d.nome, utilizador: d.utilizador, perfil: d.perfil, senha: d.senha })
    });
    e.target.reset();
    $('dlg-user').close();
    carregar();
  } catch (err) { $('erro-user').textContent = err.message; }
});

$('btn-sair').onclick = async () => {
  try { await fetch('/api/logout', { method: 'POST' }); } catch { /* servidor parado */ }
  location.href = '/login.html';
};

carregar();
setInterval(carregar, 30000);