-- Painel APREV - a tabela leads (sincronizada do Trello via n8n) e
-- leads_parados foram criadas fora do fluxo de migrations desse repo,
-- direto no Supabase, com RLS ligado mas sem nenhuma política - ou seja,
-- hoje só a service_role consegue ler. Isso bloqueava o alerta de leads
-- parados no painel (pages/leads-parados.jsx), que lê com o token do
-- usuário logado. Sem user_id nessas tabelas (dado de escritório único,
-- vindo de um Trello só) - liberar leitura pra qualquer usuário autenticado
-- do painel é seguro no cenário atual (uso single-tenant). Se esse template
-- for reaproveitado pra mais de um escritório no futuro, isso precisa virar
-- um filtro por tenant de verdade. Escrita continua só via service_role
-- (n8n) - nenhuma política de insert/update/delete é criada aqui.
--
-- Atenção: existe também uma tabela "leads" DIFERENTE definida em
-- 20260801000000_leads.sql (schema de CRM manual, sem relação com o
-- Trello). As duas têm o mesmo nome mas colunas incompatíveis - nesse
-- banco em produção, a tabela que já existe de verdade é a sincronizada do
-- Trello (criada fora deste repo). Ver aviso completo dado ao usuário na
-- sessão que introduziu esta migration.
-- Idempotente: seguro rodar em cima do schema já existente.

alter table leads enable row level security;
drop policy if exists "Equipe le os leads sincronizados" on leads;
create policy "Equipe le os leads sincronizados"
  on leads for select
  using (auth.uid() is not null);

alter table leads_parados enable row level security;
drop policy if exists "Equipe le leads parados" on leads_parados;
create policy "Equipe le leads parados"
  on leads_parados for select
  using (auth.uid() is not null);
