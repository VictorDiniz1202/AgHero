# Prompts para o Claude: Sprint 1 (Base, Multi-tenant e Offline-First)

Este documento contém os prompts otimizados sob o framework **PREP-C** para guiar o Claude no desenvolvimento da base de dados do Agtech.

---

## Sub-Prompt 1: Setup do Firebase e Persistência Offline
**Objetivo:** Instalar e configurar o SDK do Firebase v9/v10 habilitando o cache local IndexedDB explicitamente no React.

```markdown
### PERSONA & CONTEXTO (P)
Você é um desenvolvedor frontend React sênior especializado em arquitetura Offline-First (Local-First) e Firebase. Estamos desenvolvendo o "Agtech", um SaaS premium para produtores rurais que operam em locais com conexão altamente instável.

### REQUISITOS DE NEGÓCIO (R)
O app deve registrar manejos diários localmente de forma instantânea. O usuário não pode ver telas travadas ou loadings infinitos enquanto aguarda a rede sincronizar com a nuvem. O cache offline deve estar ativado desde a inicialização.

### ESPECIFICAÇÕES TÉCNICAS (E)
1. Instale e configure o Firebase SDK v9+ ou v10+ no projeto React (Vite).
2. Crie um arquivo `src/firebase/config.js` (ou `.ts`) para inicializar o app.
3. Configure a persistência offline explicitamente no Firestore. Use `initializeFirestore` com `localCache: persistentLocalCache(...)` para garantir suporte a IndexedDB (SDK v10+). Trate falhas de inicialização (ex: abas abertas simultaneamente impedem a trava do cache IndexedDB).
4. Exporte as instâncias de `auth` e `db` prontas para consumo.

### PADRÃO DE OUTPUT (P)
Forneça:
- O comando npm para instalação da dependência.
- O código do arquivo `src/firebase/config.js` limpo, bem documentado e com tratamento de exceções robusto para inicialização offline.

### CENÁRIOS DE TESTE (C)
1. Conexão inativa no primeiro load: o app deve instanciar o banco local sem travar.
2. Abertura do app em duas abas do navegador: tratar o erro `failed-precondition` (pois apenas uma aba pode ter o cache IndexedDB persistente ativado por vez caso a configuração multi-tab não esteja ativada).
```

---

## Sub-Prompt 2: Firestore Security Rules (`firestore.rules`)
**Objetivo:** Implementar isolamento absoluto de dados (Multi-tenancy) e segurança no banco.

```markdown
### PERSONA & CONTEXTO (P)
Você é um Engenheiro de Segurança de Cloud e Administrador de Banco de Dados Firebase. Sua missão é garantir o isolamento estrito de dados multi-tenant no Firestore para o SaaS Agtech.

### REQUISITOS DE NEGÓCIO (R)
Os dados de uma fazenda jamais podem vazar para outra. Um produtor ou peão cadastrado em uma fazenda só pode ler e escrever nos lotes e registros correspondentes à sua própria fazenda.

### ESPECIFICAÇÕES TÉCNICAS (E)
1. Estrutura do Banco:
   - `/fazendas/{id_fazenda}`
     - Campo `membros` (mapa: `{ [uid]: "dono" | "peao" }`)
     - Subcoleção: `/lotes/{id_lote}`
     - Subcoleção: `/registros_diarios/{id_registro}`
2. Regras de Segurança (`firestore.rules`):
   - Valide que o usuário está autenticado (`request.auth != null`).
   - Coleção `/fazendas/{id_fazenda}`:
     - Leitura/Escrita permitida se o `request.auth.uid` constar no mapa `membros` do documento atual (`resource.data.membros` ou `request.resource.data.membros`).
   - Subcoleções `/lotes` e `/registros_diarios`:
     - Leitura/Escrita permitida se a função auxiliar `isMemberOfFarm(id_fazenda)` for verdadeira.
     - Crie a função `isMemberOfFarm` usando `get()` para ler a fazenda pai `/fazendas/{id_fazenda}` e checar se `request.auth.uid` está no mapa `membros`.

### PADRÃO DE OUTPUT (P)
Forneça o arquivo `firestore.rules` completo pronto para deploy, com comentários explicando a lógica de isolamento.

### CENÁRIOS DE TESTE (C)
1. Usuário não autenticado tentando ler dados (deve ser rejeitado).
2. Usuário autenticado da Fazenda A tentando ler `/fazendas/Fazenda_B/lotes/Lote_1` (deve ser rejeitado).
3. Criação de nova fazenda por um usuário (validar se ele se define como dono no mapa de membros).
```

---

## Sub-Prompt 3: Camada de Serviços do Firestore (CRUD com IDs Determinísticos)
**Objetivo:** Criar as operações de escrita e leitura de lotes e registros diários com foco em offline-first e prevenção de duplicidade.

```markdown
### PERSONA & CONTEXTO (P)
Você é um desenvolvedor frontend React especialista em Firebase e Local-First. Sua tarefa é criar a camada de integração/serviços que o frontend usará para persistir dados.

### REQUISITOS DE NEGÓCIO (R)
Os registros diários são de alta frequência (água, ração, mortalidade). Se o peão estiver sem internet no galpão, ele pode clicar várias vezes para registrar o mesmo dia por engano, ou outro peão pode registrar no mesmo dia. Para evitar duplicidade offline, usaremos IDs determinísticos baseados na data e no lote.

### ESPECIFICAÇÕES TÉCNICAS (E)
1. Crie o arquivo `src/firebase/services.js`.
2. Implemente funções assíncronas para as seguintes operações:
   - `criarFazenda(nome, donoUid)`: Cria o doc `/fazendas/{id_fazenda}` definindo `donoUid` no mapa de `membros`.
   - `adicionarLote(id_fazenda, loteData)`: Adiciona um lote na subcoleção `/fazendas/{id_fazenda}/lotes` (usa ID aleatório).
   - `salvarRegistroDiario(id_fazenda, id_lote, registroData)`: Salva um registro em `/fazendas/{id_fazenda}/registros_diarios/{id_registro}`.
     - **Regra do ID:** O `id_registro` DEVE ser determinístico: `${id_lote}_${registroData.data_registro_str}` (ex: `LOTE45_2026-06-10`).
     - Utilize `setDoc` com `{ merge: true }` para salvar, garantindo que escritas offline repetidas não gerem duplicatas.
     - O campo `data_registro_str` deve ser salvo no formato `YYYY-MM-DD` para evitar problemas de fuso horário.
3. Garanta que as escritas não usem loaders bloqueantes de rede (utilize chamadas assíncronas normais sem dar `await` se o objetivo for apenas enfileirar no cache local, ou trate a promise de forma a não travar a UI).

### PADRÃO DE OUTPUT (P)
O arquivo `src/firebase/services.js` modular e limpo, pronto para ser importado nos componentes React.

### CENÁRIOS DE TESTE (C)
1. Salvar o registro do Lote A para a data "2026-06-10" duas vezes consecutivas: o banco local deve ter apenas 1 documento gravado.
2. Salvar dados totalmente offline: a função deve resolver imediatamente para a UI continuar fluida.
```
