// Cria as contas de demonstração (ignora as que já existem).
// Uso: node src\contas-teste.js
const { lerUtilizadores, gravarUtilizadores } = require('./storage');
const { hash } = require('./auth');

const contas = [
  { utilizador: 'coord.joao',   nome: 'João Mendes',  perfil: 'coordenador', senha: 'Escola2026' },
  { utilizador: 'coord.ana',    nome: 'Ana Ferreira', perfil: 'coordenador', senha: 'Coord2026' },
  { utilizador: 'prof.maria',   nome: 'Maria Silva',  perfil: 'professor',   senha: 'Escola2026' },
  { utilizador: 'prof.carlos',  nome: 'Carlos Pinto', perfil: 'professor',   senha: 'Prof2026' }
];

const lista = lerUtilizadores();
let criadas = 0;
for (const c of contas) {
  if (lista.some(u => u.utilizador === c.utilizador)) { console.log('Já existe:', c.utilizador); continue; }
  lista.push({
    utilizador: c.utilizador, nome: c.nome, perfil: c.perfil,
    senha: hash(c.senha), criadoEm: new Date().toISOString(), criadoPor: 'script'
  });
  criadas++;
  console.log('Criada:', c.utilizador, `(${c.perfil})`);
}
gravarUtilizadores(lista);
console.log(`${criadas} conta(s) criada(s).`);