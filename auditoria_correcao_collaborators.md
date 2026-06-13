# Correção — Auto-vínculo de Colaboradores (`/collaborators`)

> Complementa `auditoria_codigo_completa.txt`. Resolve a pendência crítica
> deixada pelo "Fix A" da rodada anterior (vulnerabilidade de escalonamento
> de privilégio / acesso cross-tenant via auto-criação de `/collaborators/{uid}`).

## Problema encontrado

A regra de `allow create` em `/collaborators/{uid}` ganhou uma terceira
condição para destravar o primeiro login de peões/veterinários convidados,
mas essa condição só validava campos que o **próprio requisitante** preenche
no documento que está criando:

```javascript
(request.auth.uid == uid &&
 request.resource.data.role in ['operator', 'veterinarian'] &&
 request.resource.data.uid == request.auth.uid &&
 request.resource.data.email == request.auth.token.email &&
 exists(/databases/$(database)/documents/fazendas/$(request.resource.data.farmId)))
```

Como nada disso depende de um convite real existir, **qualquer usuário
autenticado** podia se autodeclarar `operator`/`veterinarian` de **qualquer
fazenda existente** apenas escrevendo:

```js
await setDoc(doc(db, 'collaborators', meuUid), {
  uid: meuUid,
  role: 'operator',
  email: meuEmail,             // sempre bate com o próprio token
  farmId: 'fazenda_<qualquer>', // qualquer fazenda existente
  nome: 'x'
});
```

Isso fazia `isMemberOfFarm(farmId)` retornar `true` para o atacante,
liberando leitura permanente de `/fazendas/{id}`, `/lotes`,
`/registros_diarios`, `/sanidade`, `/cargas_silo`, `/pesagens`,
`/alertas_enviados`, `/limites_bi` e (se `plano == 'Pro'`) `/chat_agboy` da
fazenda alheia — quebra total do isolamento multi-tenant. Como
`/collaborators` tem `allow read: if request.auth != null` sem filtro,
qualquer usuário também conseguia listar todos os `farmId` cadastrados para
escolher o alvo.

## Correção aplicada

Modelo de "convite verificável", criado pelo dono e checado pelas rules no
momento do auto-vínculo:

1. **`agtech-hero/src/firebase/services.js` — `adicionarColaborador`**
   Além do registro em `/collaborators` (com `uid: null`), grava um
   marcador em `/fazendas/{id_fazenda}/convites_pendentes/{email}` com
   `{ role, email }`.

2. **`firestore.rules` — nova subcoleção `convites_pendentes`**
   ```javascript
   match /convites_pendentes/{email} {
     allow read: if request.auth != null;
     allow create, delete: if isOwnerOfFarm(id_fazenda);
     allow update: if false;
   }
   ```
   Só o dono da fazenda pode criar/remover o marcador.

3. **`firestore.rules` — branch 3 de `allow create` em `/collaborators/{uid}`**
   Agora exige, além dos campos já validados, que exista
   `convites_pendentes/{email_do_token}` na fazenda destino **e** que o
   `role` do convite seja igual ao `role` que está sendo gravado:
   ```javascript
   exists(/databases/$(database)/documents/fazendas/$(request.resource.data.farmId)/convites_pendentes/$(request.auth.token.email)) &&
   get(/databases/$(database)/documents/fazendas/$(request.resource.data.farmId)/convites_pendentes/$(request.auth.token.email)).data.role == request.resource.data.role
   ```
   Sem um convite real criado pelo dono, a escrita é negada — fecha o vetor
   de auto-promoção a colaborador de fazenda alheia.

4. **`agtech-hero/src/firebase/services.js` — `vincularColaboradorSePendente`**
   Após concluir o vínculo (criar `/collaborators/{uid}` e remover o doc
   temporário com `uid: null`), apaga
   `/fazendas/{farmId}/convites_pendentes/{email}` para evitar reuso do
   mesmo convite.

## Fluxo resultante

1. Dono chama `adicionarColaborador(farmId, email, role, nome)` →
   cria `/collaborators/{auto-id}` (`uid: null`) **e**
   `/fazendas/{farmId}/convites_pendentes/{email}` com o `role`.
2. Convidado faz login → `vincularColaboradorSePendente(uid, email, ...)`
   encontra o doc pendente por `email`, cria `/collaborators/{uid}` com
   `uid`, `farmId`, `role`, `email` — agora aceito pela rule porque o
   convite em `convites_pendentes/{email}` existe e o `role` confere — e
   remove ambos os marcadores temporários.
3. Tentativa de auto-registro sem convite (`farmId` arbitrário) falha:
   `convites_pendentes/{email_do_atacante}` não existe na fazenda alvo →
   `permission-denied`.

## Pendências/observações remanescentes (fora do escopo desta correção)

- A divergência de nomenclatura de `plano` (`'Pro'` vs `'Inteligente'`) entre
  `firestore.rules` (`chat_agboy`), `agboyWebhook` e `FormularioManejo.jsx`,
  apontada na rodada anterior, **não foi tratada** aqui e segue pendente.

## Regressão adicional encontrada e corrigida (leitura de `/collaborators`)

A regra de leitura de `/collaborators/{uid}` havia sido restringida (em
paralelo a esta correção) para:

```javascript
allow read: if request.auth != null && (
  request.auth.uid == uid ||
  isMemberOfFarm(resource.data.farmId)
);
```

Isso fechou a exposição de privacidade (LGPD) da leitura irrestrita anterior,
mas **quebrou `vincularColaboradorSePendente`**: a query
`where('email', '==', email)` (services.js:726) precisa ler o documento de
convite pendente (`uid: null`, ID auto-gerado, `farmId` = fazenda destino).
Para o convidado novo, nem `request.auth.uid == uid` (o doc id é um id
aleatório, não o uid do usuário) nem `isMemberOfFarm(farmId)` (ele ainda não
é membro daquela fazenda — esse é o problema que o convite resolve) são
verdadeiros. Como o Firestore rejeita a **query inteira** com
`permission-denied` se qualquer documento do resultado potencial falhar na
regra, `getDocs(q)` lança, o `try/catch` engole o erro e o convidado nunca é
vinculado — reabrindo o bug de onboarding original por um caminho diferente
(leitura, não escrita).

**Correção aplicada** — adicionado um terceiro ramo que permite ao usuário
ler **apenas** convites pendentes endereçados ao próprio e-mail:

```javascript
allow read: if request.auth != null && (
  request.auth.uid == uid ||
  isMemberOfFarm(resource.data.farmId) ||
  (resource.data.uid == null && resource.data.email == request.auth.token.email)
);
```

Não reabre a exposição original: só expõe `role`/`farmId`/`nome`/`email` de
convites (`uid == null`) cujo `email` bate com o e-mail do próprio token —
nenhum dado de colaboradores já vinculados de outras fazendas é exposto.
