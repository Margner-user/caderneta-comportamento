const { lerUtilizadores, gravarUtilizadores } = require('./storage');
const { hash } = require('./auth');

const [, , utilizador, senha, perfil, ...resto] = process.argv;
const nome = resto.join(' ');

if (!utilizador || !senha || !nome || !['professor', 'coordenador'].includes(perfil) || senha.length < 6) {
  console.log('Uso: node src\\criar-utilizador.js <utilizador> <senha(min 6)> <professor|coordenador> <Nome Completo>');
  process.exit(1);
}

const lista = lerUtilizadores();
if (lista.some(u => u.utilizador === utilizador)) {
  console.log('Esse utilizador já existe.');
  process.exit(1);
}
lista.push({ utilizador, nome, perfil, senha: hash(senha) });
gravarUtilizadores(lista);
console.log(`Utilizador "${utilizador}" (${perfil}) criado.`);