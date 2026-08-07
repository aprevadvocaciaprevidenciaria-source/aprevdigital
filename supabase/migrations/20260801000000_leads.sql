-- SEO Local Brasil painel - captura de leads (prospecção) e follow-up automático
-- Idempotente: seguro rodar em cima do schema já existente.
--
-- Renomeada de "leads" pra "leads_manuais" em 2026-08-07: o nome "leads" já
-- é usado, em produção, pela tabela real de funil sincronizada do Trello via
-- n8n (colunas trello_card_id/estagio/dias_parado, criada fora deste repo).
-- As duas nunca tiveram relação nenhuma além do nome - ver PROGRESSO.md.

-- ============================================================
-- leads_manuais
-- ============================================================
create table if not exists leads_manuais (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  nome text not null,
  empresa text,
  telefone text,
  email text,
  mensagem text,
  origem text not null default 'site',
  status text not null default 'novo',
  cliente_id uuid references clientes (id) on delete set null,
  ultimo_followup_em timestamptz,
  created_at timestamptz not null default current_timestamp,
  updated_at timestamptz not null default current_timestamp
);

alter table leads_manuais drop constraint if exists leads_manuais_status_check;
alter table leads_manuais add constraint leads_manuais_status_check
  check (status in ('novo', 'contatado', 'qualificado', 'convertido', 'perdido'));

create index if not exists idx_leads_manuais_user_id on leads_manuais (user_id);
create index if not exists idx_leads_manuais_status on leads_manuais (status);
create index if not exists idx_leads_manuais_created_at on leads_manuais (created_at desc);

alter table leads_manuais enable row level security;

drop policy if exists "Usuarios podem ver seus leads" on leads_manuais;
create policy "Usuarios podem ver seus leads"
  on leads_manuais for select
  using (auth.uid() = user_id);

drop policy if exists "Usuarios podem criar leads" on leads_manuais;
create policy "Usuarios podem criar leads"
  on leads_manuais for insert
  with check (auth.uid() = user_id);

drop policy if exists "Usuarios podem atualizar seus leads" on leads_manuais;
create policy "Usuarios podem atualizar seus leads"
  on leads_manuais for update
  using (auth.uid() = user_id);

drop policy if exists "Usuarios podem excluir seus leads" on leads_manuais;
create policy "Usuarios podem excluir seus leads"
  on leads_manuais for delete
  using (auth.uid() = user_id);

-- Nota: a captura pública (formulário do site) não passa por essas políticas -
-- a rota /api/leads/capturar usa a service role, que ignora RLS, porque quem
-- preenche o formulário não está autenticado no painel.

-- ============================================================
-- users: número de WhatsApp do dono, pra receber aviso de lead novo
-- ============================================================
alter table users add column if not exists telefone_notificacao text;

-- ============================================================
-- automacao_config: configuração do follow-up automático de leads
-- ============================================================
alter table automacao_config add column if not exists leads_followup_ativo boolean default false;
alter table automacao_config add column if not exists leads_followup_dias int default 3;
alter table automacao_config add column if not exists leads_followup_template text
  default 'Olá {{nome}}! Vi que você entrou em contato com a SEO Local Brasil sobre {{empresa}} e queria saber se ainda tem interesse em conversarmos sobre como podemos ajudar. Posso te ligar essa semana?';

-- ============================================================
-- mensagens_fila: vincula opcionalmente a um lead (follow-up de lead
-- usa o mesmo fluxo de fila de aprovação já usado pra cobrança, mas
-- antes de virar cliente não tem cliente_id ainda). `tipo` já é um
-- text livre sem check constraint, então 'lead_followup' não precisa
-- de nenhuma alteração ali.
-- ============================================================
alter table mensagens_fila add column if not exists lead_id uuid references leads_manuais (id) on delete cascade;
create index if not exists idx_mensagens_fila_lead_id on mensagens_fila (lead_id);
