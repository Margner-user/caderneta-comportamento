const fs = require('fs');
const path = require('path');
const DATA = path.join(__dirname, '..', 'data');

function lerFicheiro(nome) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA, nome), 'utf8').replace(/^\uFEFF/, ''));
  } catch { return []; }
}
function gravarFicheiro(nome, lista) {
  fs.writeFileSync(path.join(DATA, nome), JSON.stringify(lista, null, 2));
}

module.exports = {
  ler: () => lerFicheiro('alunos.json'),
  gravar: lista => gravarFicheiro('alunos.json', lista),
  lerUtilizadores: () => lerFicheiro('utilizadores.json'),
  gravarUtilizadores: lista => gravarFicheiro('utilizadores.json', lista)
};