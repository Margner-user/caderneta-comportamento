const $ = id => document.getElementById(id);

$('form-login').addEventListener('submit', async e => {
  e.preventDefault();
  $('erro-login').textContent = '';
  try {
    const r = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ utilizador: $('utilizador').value, senha: $('senha').value })
    });
    const d = await r.json();
    if (!r.ok) { $('erro-login').textContent = d.erro; return; }
    location.href = '/';
  } catch {
    $('erro-login').textContent = 'Não foi possível ligar ao servidor.';
  }
});