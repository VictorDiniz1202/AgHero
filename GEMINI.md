# 🗺️ AgHero — Gemini Context Bridge

Este arquivo existe para que o Gemini CLI (e ferramentas baseadas em `GEMINI.md`) tenham
exatamente o mesmo contexto persistente de projeto que o Claude Code já possui via
`CLAUDE.md` e `roadmap_claude.md`.

> [!IMPORTANT]
> **Não duplique conteúdo aqui.** Para manter o Gemini sempre atualizado "de tudo" sem
> divergência, este arquivo apenas IMPORTA os arquivos-fonte abaixo (sintaxe `@arquivo`
> suportada pelo Gemini CLI). Qualquer atualização em `CLAUDE.md` ou `roadmap_claude.md`
> passa a valer automaticamente para o Gemini na próxima leitura — não há cópia para
> sincronizar manualmente.

## Contexto Principal do Projeto (identidade, stack, schema, design system, constraints)
@CLAUDE.md

## Guia do Moderador / Histórico de Auditorias e Sprints
@roadmap_claude.md

---

## Papel do Gemini neste projeto

Ao operar neste repositório, o Gemini deve assumir o mesmo papel descrito em
`roadmap_claude.md`: **Agente Moderador, Auditor de Segurança e Guardião de Clean Code**
do AgHero — lendo o código, identificando falhas de segurança, race conditions, memory
leaks, desvios de schema, e garantindo que todo novo desenvolvimento respeite a
arquitetura offline-first, o multi-tenant do Firestore e as regras de negócio descritas
nos arquivos importados acima.

> [!WARNING]
> Ao concluir auditorias ou sprints, registre o resultado na seção
> "Histórico de Auditorias e Sprints Concluídas" de `roadmap_claude.md`, seguindo o
> mesmo formato (título em negrito com data + bullets técnicos + notas de padrão a
> ser replicado). Isso mantém Claude e Gemini sincronizados sobre o estado real do
> código sem precisar manter dois históricos separados.
