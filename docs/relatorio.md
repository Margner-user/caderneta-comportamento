**Nome:** Mário Wagner Miguel Pereira

Nº: 20240328

**Turma:** EINF5-M1

**Relatório – Caderneta de Comportamento**

**Problema**

Era preciso criar um site de caderneta de comportamento para professores e coordenadores, onde se registam alunos (nome, classe, turma, sala, número de emergência e número do encarregado) e as suas ocorrências. Os dados são guardados em ficheiros JSON, sem base de dados. O projeto serviu também para praticar Git, com vários commits.

**Como trabalhei**

Pedi ajuda ao Claude e fomos construindo o projeto por fases, no PowerShell do VS Code. Cada fase terminou com um commit e uma tag de versão (v1, v2, v3...). Quando surgiam erros, enviava capturas de ecrã para os corrigirmos.

Organizei o projeto em quatro pastas: src (servidor), public (o site), data (ficheiros JSON) e docs (relatório e credenciais de teste).

**Passos pela** **ordem** **de execução**

- Criei a estrutura de pastas, o repositório Git e o README (v1).

- Escrevi o relatório inicial com os requisitos (v2).

- Criei o módulo que lê e grava os dados em ficheiro (v3) e o servidor com registo, pesquisa e ocorrências (v4).

- Criei a página HTML, o CSS e o JavaScript (v5 a v7) e testei com dados de exemplo (v8).

- Acrescentei a opção de eliminar aluno, num ramo separado com merge para o main (v9).

- Pedi um site mais bonito, login, contagem automática de ocorrências e categorias com gravidade. Foi criado o login com palavras-passe encriptadas e os perfis de professor e coordenador (v11 a v14).

- Pedi cartões do mesmo tamanho, perfil do aluno com todas as ocorrências, opção de resolver ocorrências, estado cumulativo (3 leves valem 1 média, 3 médias valem 1 grave), classe do aluno e pesquisa por classe e turma (v17 e v18).

- Pedi validação dos dados (classes, turmas e telefones) e um visual mais sério (v19 e v20).

- Corrigi erros do servidor e acrescentei o painel de utilizadores online (v21).

- Pedi que o coordenador pudesse criar professores e coordenadores, ver o número de professores e o último acesso, e um ficheiro com as credenciais de teste para o professor da universidade (v22).

**Bugs encontrados**

- Comandos do cmd não funcionavam no PowerShell. Passei a usar New-Item e Set-Content.

- Vários comandos colados de uma vez ficavam presos. Passei a colar um de cada vez.

- Ramo master em vez de main. Corrigi com git branch -M main.

- Tags duplicadas por numeração diferente da planeada. Apaguei as a mais com git tag -d.

- Lista de classes vazia no formulário. As opções passaram a estar escritas no HTML e o servidor valida a classe.

- Failed to fetch ao registar aluno e botão Sair sem funcionar. O servidor fechava por código colado com chavetas mal fechadas. O server.js foi reescrito.

- Lista de ocorrências muito pequena no perfil do aluno. Corrigi o CSS.

- Filtro de classes sem opções. Passou a mostrar sempre as 13 classes.

**Conclusão**

O sistema regista e pesquisa alunos, guarda ocorrências por categoria e gravidade, permite resolvê-las, tem login por perfil e gestão de utilizadores, tudo em ficheiros JSON. Aprendi a trabalhar por versões com commits, tags e ramos, e a perceber erros a partir das mensagens do terminal.
