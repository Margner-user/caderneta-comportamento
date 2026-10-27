const fs = require('fs');
const path = require('path');
const FICHEIRO = path.join(__dirname, '..', 'data', 'alunos.json');

function ler() {
  try { return JSON.parse(fs.readFileSync(FICHEIRO, 'utf8').replace(/^\uFEFF/, '')); }
  catch { return []; }
}
function gravar(lista) {
  fs.writeFileSync(FICHEIRO, JSON.stringify(lista, null, 2));
}
module.exports = { ler, gravar };