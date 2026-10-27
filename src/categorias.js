module.exports = {
  gravidades: { leve: 1, media: 2, grave: 3 },
  // Regras cumulativas (só contam ocorrências pendentes). Podes mudar os números.
  regras: { leves_para_media: 3, medias_para_grave: 3 },
  categorias: [
    { id: 'atraso',        nome: 'Atraso',            icone: '⏰', gravidadeSugerida: 'leve'  },
    { id: 'material',      nome: 'Falta de material', icone: '📚', gravidadeSugerida: 'leve'  },
    { id: 'telemovel',     nome: 'Uso de telemóvel',  icone: '📱', gravidadeSugerida: 'media' },
    { id: 'comportamento', nome: 'Mau comportamento', icone: '⚠️', gravidadeSugerida: 'media' },
    { id: 'desrespeito',   nome: 'Desrespeito',       icone: '🗣️', gravidadeSugerida: 'grave' },
    { id: 'agressao',      nome: 'Agressão',          icone: '🚫', gravidadeSugerida: 'grave' },
    { id: 'danos',         nome: 'Danos materiais',   icone: '🔨', gravidadeSugerida: 'grave' },
    { id: 'outro',         nome: 'Outro',             icone: '📝', gravidadeSugerida: 'leve'  }
  ]
};