# Credenciais de teste – Caderneta de Comportamento

Contas **de demonstração**, criadas só para avaliação. Não contêm dados reais.

## Como arrancar

1. `node src\contas-teste.js` (cria as contas abaixo)
2. `node src\server.js`
3. Abrir http://localhost:3000

## Contas

| Perfil      | Utilizador  | Palavra-passe |
| ----------- | ----------- | ------------- |
| Coordenador | coord.joao  | Escola2026    |
| Coordenador | coord.ana   | Coord2026     |
| Professor   | prof.maria  | Escola2026    |
| Professor   | prof.carlos | Prof2026      |

## O que cada perfil pode fazer

| Funcionalidade                            | Professor | Coordenador |
| ----------------------------------------- | --------- | ----------- |
| Pesquisar alunos e ver o perfil           | Sim       | Sim         |
| Registar alunos e ocorrências             | Sim       | Sim         |
| Resolver / reabrir ocorrências            | Sim       | Sim         |
| Eliminar alunos                           | Não       | Sim         |
| Ver utilizadores online                   | Não       | Sim         |
| Criar professores e coordenadores         | Não       | Sim         |
| Ver número de professores e último acesso | Não       | Sim         |

## Segurança das palavras-passe

As palavras-passe acima só aparecem neste documento de demonstração.
No sistema são guardadas **encriptadas** (scrypt com sal aleatório) em
`data/utilizadores.json`, no formato `sal:hash`, e não podem ser revertidas:

    {
      "utilizador": "prof.maria",
      "nome": "Maria Silva",
      "perfil": "professor",
      "senha": "9f2c...:b41e...",
      "ultimoAcesso": "2026-10-27T22:22:10.000Z"
    }

O ficheiro `data/utilizadores.json` está no `.gitignore`, por isso não é enviado para o GitHub.
