-- SEO Local Brasil painel - suporte a integração OAuth com Google Business Profile
-- Idempotente: seguro rodar em cima do schema já existente.

-- ============================================================
-- google_oauth_state: guarda o "state" do fluxo OAuth por alguns
-- minutos, pra amarrar o callback do Google ao usuário certo sem
-- expor o user_id na URL (proteção contra CSRF/hijack do fluxo).
-- ============================================================
create table if not exists google_oauth_state (
  state text primary key,
  user_id uuid not null references users (id) on delete cascade,
  created_at timestamptz not null default current_timestamp
);

alter table google_oauth_state enable row level security;
-- Nenhuma política criada de propósito: só a service role (usada
-- pelas rotas /api/google/*) consegue ler/escrever aqui.

-- ============================================================
-- google_oauth_tokens: tokens de acesso ao Google Business Profile,
-- um por usuário/agência (o modelo é: a agência conecta 1 vez, e os
-- clientes dão acesso de "gerente" no perfil deles pra essa conta).
-- ============================================================
create table if not exists google_oauth_tokens (
  user_id uuid primary key references users (id) on delete cascade,
  email_google text,
  access_token text not null,
  refresh_token text,
  token_expira_em timestamptz,
  escopo text,
  status text not null default 'conectado' check (status in ('conectado', 'erro')),
  conectado_em timestamptz not null default current_timestamp,
  atualizado_em timestamptz not null default current_timestamp
);

alter table google_oauth_tokens enable row level security;
-- De novo, nenhuma política: os tokens nunca podem ser lidos direto
-- pela API do Supabase com a anon key, nem pelo próprio dono. Só a
-- service role (usada exclusivamente em rotas server-side) acessa.
-- A UI descobre status/e-mail conectado via /api/google/status, que
-- nunca devolve o token em si.

-- ============================================================
-- Campos que o job de sincronização vai precisar em `avaliacoes`
-- pra saber o que veio da API (evitar duplicar) vs. o que foi
-- lançado manualmente.
-- ============================================================
alter table avaliacoes add column if not exists fonte text not null default 'manual';
alter table avaliacoes drop constraint if exists avaliacoes_fonte_check;
alter table avaliacoes add constraint avaliacoes_fonte_check check (fonte in ('manual', 'api'));

alter table avaliacoes add column if not exists google_review_id text;
create unique index if not exists uniq_avaliacoes_google_review_id on avaliacoes (google_review_id)
  where google_review_id is not null;
