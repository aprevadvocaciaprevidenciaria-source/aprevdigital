# Painel Aprev Digital — Progresso e Próximos Passos

Arquivo de controle pra retomar o trabalho em qualquer computador sem perder o contexto.
Atualizado em 2026-08-07.

## Contexto

Escritório de advocacia previdenciária APREV (Parnaíba-PI). Este repositório (Next.js +
Supabase + Vercel) é o "Painel Aprev Digital": funil de leads, atendimento via WhatsApp,
casos, tarefas, checklist de documentos, base de conhecimento, e telas de gestão herdadas
de um template de agência de marketing local (GBP) que foi adaptado pro escritório.

Projeto Supabase: **Aprev Digital** (`fnrzdbcjcypacpukpaqh`).

## ✅ RESOLVIDO em 2026-08-07: schema do CRM aplicado em produção

Todas as 29 migrations do repositório (`supabase/migrations/`) foram aplicadas no banco de
produção via Supabase MCP. As 34 tabelas do CRM agora existem (`users`, `colaboradores`,
`clientes`, `tarefas`, `conversas_whatsapp`, `base_conhecimento_ia`, `documentos_checklist`,
etc.), junto com as 6 tabelas antigas do painel de Trello, que continuam intocadas.

Como parte disso, a tabela `leads` do CRM (que colidia de nome com a `leads` real do Trello)
foi **renomeada pra `leads_manuais`** - no banco e em todo o código (`pages/leads.jsx`,
`pages/conversas.jsx`, `pages/relatorios.jsx`, `pages/api/webhooks/zapi.js`,
`pages/api/leads/capturar.js`, `pages/api/cron/diario.js`, e as migrations que a referenciam).
`pages/leads-parados.jsx` e a RLS de `leads_trello_rls.sql` continuam apontando pra tabela real
do Trello, sem mudança.

**Limitação conhecida, não resolvida**: `conversas_whatsapp.lead_id` é `uuid` e referencia
`leads_manuais` (também uuid). A tabela `leads` real do Trello tem `id` `bigint` - os dois
nunca poderão se conectar por FK sem uma coluna nova. Por isso o auto-match de conversa por
telefone em `zapi.js` casa só com `leads_manuais` (hoje vazia/pouco usada), não com o funil
real do Trello. Ver comentário no próprio arquivo.

## 🚨 BLOQUEADOR ATUAL: nenhuma conta de usuário existe

Confirmado em 2026-08-07: `auth.users` está com **0 registros** - ninguém nunca criou login
nesse projeto Supabase. O painel não tem tela de "criar conta" (só login) - o desenho é o
dono ser cadastrado direto e depois convidar as secretárias por dentro do painel.

**Próximo passo obrigatório**: criar a primeira conta manualmente em
https://supabase.com/dashboard/project/fnrzdbcjcypacpukpaqh/auth/users → "Add user" →
"Create new user", com "Auto Confirm User" marcado. Isso dispara o gatilho `handle_new_user()`
(já ativo) que cria o perfil em `public.users` automaticamente. Depois disso, login normal em
`/login` já dá acesso total (dono/sócio).

## ⚠️ Pendência arquitetural importante (ainda não resolvida)

Existem **duas tabelas `leads` incompatíveis** com o mesmo nome:

- **A que já existe de verdade no banco de produção**: sincronizada do Trello via n8n
  (`trello_card_id`, `estagio`, `dias_parado`, `ordem`, `url_trello`...). É a fonte real dos
  leads hoje (confirmado com o dono do painel em 2026-08-07).
- **A que a migration `20260801000000_leads.sql` deste repo define**: um CRM manual
  (`nome`, `status` novo/contatado/qualificado/..., `origem`, `ultimo_followup_em`), usado
  por `pages/leads.jsx`. Nunca foi aplicada em produção porque a tabela real já existe com
  esse nome (`create table if not exists` vira no-op).

**Decisão pendente**: renomear uma das duas (ex: a do CRM manual pra `leads_manuais`) antes
de aplicar o restante das migrations deste repo em produção, ou decidir abandonar o CRM
manual de vez já que o Trello é a fonte real. Enquanto isso não for decidido, `pages/leads.jsx`
funciona mas não reflete o funil de verdade — quem reflete é `pages/leads-parados.jsx`.

## O que já existia antes desta sessão (não construído por mim)

- Login individual por colaborador (Configurações → Colaboradores), com convite por e-mail.
- Base de Conhecimento IA (`base-conhecimento.jsx`).
- Separação automática de conversas em Lead/Cliente por telefone (`pages/api/webhooks/zapi.js`
  já casa telefone com `clientes`/`leads` na hora que a conversa chega).
- Painel do gestor separado das secretárias, via sistema de `roles` em `components/Layout.jsx`
  (sócio vê tudo, secretária só o que tem `roles: ['secretaria']`).
- Telas herdadas do template de agência (GBP): `gestao/`, `portal.jsx`, `onboarding/`,
  métricas GBP, avaliações, fotos — não são específicas do escritório previdenciário.

## O que foi feito nesta sessão

### Limpeza
- Removido o assistente "Maia" e a "Biblioteca Jurídica IA" — ambos construídos em cima de um
  pacote de terceiros ("Escritório IA", 30 agentes fictícios) encontrado numa pasta Downloads
  do usuário, que continha instruções tentando sequestrar o comportamento de qualquer IA que
  o lesse. Removidos: `pages/maia.jsx`, `pages/api/maia.js`, `pages/biblioteca-ia.jsx`, rotas
  de API relacionadas, e todos os `data/maia-*` / `data/biblioteca-ia-*`.

### Fase 1 (concluída)
- **Login individual por secretária**: já existia; adicionado modo de criar conta com
  **senha manual** (sem enviar e-mail) em `pages/api/colaboradores/convidar.js` +
  `pages/configuracoes.jsx`, pra contornar o limite de envio de e-mail do Supabase.
- **Respostas de IA com histórico do caso**: `pages/api/conversas/sugestao.js` agora usa
  Claude diretamente (`@ai-sdk/anthropic`, sem passar mais pelo webhook n8n
  `aprevdigital-sugestao`) e, quando a conversa é de um Cliente com pasta do Drive vinculada,
  lê os documentos do caso antes de sugerir a resposta.
- **Filas Lead Novo / Clientes**: confirmado que já era automático via `zapi.js`.

### Fase 2 (parcial)
- **Drive na tela de atendimento**: painel "Documentos" em `pages/conversas.jsx` (navega
  pastas/subpastas do Drive do cliente, abre arquivo em nova aba). Rota:
  `pages/api/clientes/drive.js`.
- **Solicitador de documentos**: módulo novo completo.
  - `documentos_checklist` (modelo por tipo de benefício, editável só pelo sócio em
    `pages/documentos.jsx`) e `documentos_cliente` (checklist aplicada a um caso).
  - Seed padrão pros benefícios mais comuns (auxílio-doença, aposentadorias, pensão por
    morte, BPC/LOAS, salário-maternidade, revisão) — **revisar/ajustar os documentos
    exatos**, foi um ponto de partida razoável, não validado pelo advogado.
  - Aba "Documentos" em `pages/clientes/[id].jsx`: gera a checklist, marca item como
    recebido, copia mensagem só com os pendentes.
- **Alerta de leads parados**: `pages/leads-parados.jsx`, lendo a tabela `leads` real
  (schema Trello). Botão de copiar mensagem de retomada + link direto pro card no Trello +
  WhatsApp. **Sem envio automático** (foi decisão explícita).
- **Ranking de tarefas por secretária**: em `pages/tarefas.jsx`, visível só pro sócio, com
  filtro por período. Depende da nova coluna `tarefas.concluida_em` (`updated_at` não servia
  porque qualquer edição da tarefa também mexe nele).
- **Bug corrigido**: `pages/tarefas.jsx` gravava o `user_id` de quem criou a tarefa em vez do
  dono da conta — tarefa criada por secretária podia não aparecer pro sócio.

### Mudança direta em produção (fora do fluxo de migration do repo)
- Tabela `leads` (schema Trello) e `leads_parados` tinham RLS ligado **sem nenhuma política**
  — só a service_role conseguia ler, o que deixaria `leads-parados.jsx` sempre vazio. Adicionei
  política de leitura pra qualquer usuário autenticado. Aplicada direto via Supabase MCP e
  também registrada em `supabase/migrations/20260807020000_leads_trello_rls.sql`.

## O que ficou pra depois (adiado a pedido do usuário)

- **Lembrete de avaliação Google quando o benefício for aprovado**: adiado — "esqueça isso
  de benefício aprovado por enquanto" (2026-08-07). Quando retomar, falta decidir como marcar
  "aprovado" no painel (não existe esse conceito hoje, só o `status` genérico do cliente).

## Fase 2 — o que ainda falta

- Lembrete de avaliação Google (acima).
- Verificar a integração com o **Agente de Triagem Jurídica no n8n** (workflow
  `vAKXpiP4dt2JGJII`, `aprevadvocagia.app.n8n.cloud`) e os dois bugs conhecidos citados no
  brief original: nó "Criar Lead no Notion" quebrado (`resource: "databasePage"` inválido) e
  workflow `BwHE3pmCMqBJ23FA` em loop de erro. **Não tenho acesso ao n8n nesta sessão.**

## Fase 3 — não iniciada

- Relatórios em tempo real (tempo médio de resposta WhatsApp, funil, conversão por etapa).
- Cronograma/calendário de postagens (Instagram, TikTok, Reels, Google).
- Dashboard de métricas de tráfego pago (Meta/Google Ads).
- Central de tarefas com delegação por área — parcialmente coberto por `pages/tarefas.jsx`
  já existente, revisar se cobre "por área".

## Notas técnicas pra quem retomar

- Trabalho feito em branches (`remove-maia-biblioteca-ia`, já mergeada) + Pull Request,
  depois merge manual na `main`. Repita esse fluxo pra mudanças novas.
- A máquina usada nesta sessão não tinha `git` nem `gh` instalados (foram instalados via
  `winget`). Push exigiu Personal Access Token do GitHub colado manualmente a cada vez —
  considere configurar Git Credential Manager com login persistente numa máquina de trabalho
  fixa, pra não repetir isso.
- A maioria das migrations deste repo (schema completo do CRM: `clientes`, `tarefas`,
  `conversas_whatsapp`, `base_conhecimento_ia`, `documentos_checklist`, etc.) **ainda não foi
  aplicada** no banco de produção — só migrations pontuais relacionadas ao que foi mexido
  nesta sessão (`tarefas.concluida_em`, `documentos_checklist`/`documentos_cliente`, RLS de
  `leads`). Antes de aplicar o restante, resolver a pendência arquitetural do `leads` acima.
