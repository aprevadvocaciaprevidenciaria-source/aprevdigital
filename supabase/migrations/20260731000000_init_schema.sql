-- SEO Local Brasil painel - schema (reflete a estrutura já existente no projeto Supabase
-- e completa as peças que faltavam: trigger de perfil de usuário e políticas de RLS)
--
-- Tabelas: users, clientes, tarefas, metricas_gbp, relatorios

create extension if not exists pgcrypto;

-- ============================================================
-- users (perfil espelhando auth.users)
-- ============================================================
create table if not exists users (
  id uuid primary key,
  nome text,
  email text,
  avatar_url text,
  created_at timestamptz default current_timestamp,
  updated_at timestamptz default current_timestamp
);

-- ============================================================
-- clientes
-- ============================================================
create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  nome text not null,
  contato_nome text,
  contato_whatsapp text,
  contato_email text,
  nicho text,
  plano_valor numeric,
  status text default 'ativo',
  notas text,
  google_business_id text,
  created_at timestamptz default current_timestamp,
  updated_at timestamptz default current_timestamp
);

create index if not exists idx_clientes_user_id on clientes (user_id);
create index if not exists idx_clientes_status on clientes (status);
create index if not exists idx_clientes_created_at on clientes (created_at desc);

-- ============================================================
-- tarefas
-- ============================================================
create table if not exists tarefas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  cliente_id uuid references clientes (id) on delete cascade,
  titulo text not null,
  descricao text,
  status text default 'a-fazer',
  prioridade text default 'media',
  vencimento date,
  created_at timestamptz default current_timestamp,
  updated_at timestamptz default current_timestamp
);

create index if not exists idx_tarefas_user_id on tarefas (user_id);
create index if not exists idx_tarefas_cliente_id on tarefas (cliente_id);
create index if not exists idx_tarefas_status on tarefas (status);
create index if not exists idx_tarefas_vencimento on tarefas (vencimento);

-- ============================================================
-- metricas_gbp (métricas mensais do Google Business Profile por cliente)
-- ============================================================
create table if not exists metricas_gbp (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes (id) on delete cascade,
  mes date not null,
  visualizacoes int default 0,
  interacoes int default 0,
  chamadas int default 0,
  rotas int default 0,
  cliques_site int default 0,
  buscas int default 0,
  fonte text default 'manual',
  created_at timestamptz default current_timestamp,
  updated_at timestamptz default current_timestamp
);

create index if not exists idx_metricas_gbp_cliente_id on metricas_gbp (cliente_id);
create index if not exists idx_metricas_gbp_mes on metricas_gbp (mes desc);
create unique index if not exists uniq_metricas_gbp_cliente_mes on metricas_gbp (cliente_id, mes);

-- ============================================================
-- relatorios (snapshots de relatório por cliente/mês, uso futuro)
-- ============================================================
create table if not exists relatorios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  cliente_id uuid not null references clientes (id) on delete cascade,
  tipo text default 'gbp',
  mes date,
  dados jsonb,
  status text default 'rascunho',
  created_at timestamptz default current_timestamp,
  updated_at timestamptz default current_timestamp
);

create index if not exists idx_relatorios_user_id on relatorios (user_id);
create index if not exists idx_relatorios_cliente_id on relatorios (cliente_id);

-- ============================================================
-- Trigger: cria automaticamente o perfil em public.users no signup
-- ============================================================
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, nome, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', new.email), new.email)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Backfill de usuários que já existiam em auth.users antes do trigger
insert into public.users (id, nome, email)
select id, coalesce(raw_user_meta_data ->> 'name', email), email
from auth.users
on conflict (id) do nothing;

-- ============================================================
-- Row Level Security
-- ============================================================
alter table users enable row level security;
alter table clientes enable row level security;
alter table tarefas enable row level security;
alter table metricas_gbp enable row level security;
alter table relatorios enable row level security;

-- users: cada usuário só vê/edita o próprio perfil
drop policy if exists "Usuários podem ver seu perfil" on users;
create policy "Usuários podem ver seu perfil"
  on users for select
  using (auth.uid() = id);

drop policy if exists "Usuários podem atualizar seu perfil" on users;
create policy "Usuários podem atualizar seu perfil"
  on users for update
  using (auth.uid() = id);

-- clientes: CRUD completo restrito ao dono (user_id)
drop policy if exists "Usuários podem ver seus clientes" on clientes;
create policy "Usuários podem ver seus clientes"
  on clientes for select
  using (auth.uid() = user_id);

drop policy if exists "Usuários podem criar clientes" on clientes;
create policy "Usuários podem criar clientes"
  on clientes for insert
  with check (auth.uid() = user_id);

drop policy if exists "Usuários podem atualizar seus clientes" on clientes;
create policy "Usuários podem atualizar seus clientes"
  on clientes for update
  using (auth.uid() = user_id);

drop policy if exists "Usuários podem excluir seus clientes" on clientes;
create policy "Usuários podem excluir seus clientes"
  on clientes for delete
  using (auth.uid() = user_id);

-- tarefas: CRUD completo restrito ao dono (user_id)
drop policy if exists "Usuários podem ver suas tarefas" on tarefas;
create policy "Usuários podem ver suas tarefas"
  on tarefas for select
  using (auth.uid() = user_id);

drop policy if exists "Usuários podem criar tarefas" on tarefas;
create policy "Usuários podem criar tarefas"
  on tarefas for insert
  with check (auth.uid() = user_id);

drop policy if exists "Usuários podem atualizar suas tarefas" on tarefas;
create policy "Usuários podem atualizar suas tarefas"
  on tarefas for update
  using (auth.uid() = user_id);

drop policy if exists "Usuários podem excluir suas tarefas" on tarefas;
create policy "Usuários podem excluir suas tarefas"
  on tarefas for delete
  using (auth.uid() = user_id);

-- metricas_gbp: acesso via posse do cliente relacionado
drop policy if exists "Usuários podem ver métricas de seus clientes" on metricas_gbp;
create policy "Usuários podem ver métricas de seus clientes"
  on metricas_gbp for select
  using (cliente_id in (select id from clientes where user_id = auth.uid()));

drop policy if exists "Usuários podem criar métricas de seus clientes" on metricas_gbp;
create policy "Usuários podem criar métricas de seus clientes"
  on metricas_gbp for insert
  with check (cliente_id in (select id from clientes where user_id = auth.uid()));

drop policy if exists "Usuários podem atualizar métricas de seus clientes" on metricas_gbp;
create policy "Usuários podem atualizar métricas de seus clientes"
  on metricas_gbp for update
  using (cliente_id in (select id from clientes where user_id = auth.uid()));

drop policy if exists "Usuários podem excluir métricas de seus clientes" on metricas_gbp;
create policy "Usuários podem excluir métricas de seus clientes"
  on metricas_gbp for delete
  using (cliente_id in (select id from clientes where user_id = auth.uid()));

-- relatorios: CRUD completo restrito ao dono (user_id) - reservado para uso futuro
drop policy if exists "Usuários podem ver seus relatórios" on relatorios;
create policy "Usuários podem ver seus relatórios"
  on relatorios for select
  using (auth.uid() = user_id);

drop policy if exists "Usuários podem criar relatórios" on relatorios;
create policy "Usuários podem criar relatórios"
  on relatorios for insert
  with check (auth.uid() = user_id);

drop policy if exists "Usuários podem atualizar seus relatórios" on relatorios;
create policy "Usuários podem atualizar seus relatórios"
  on relatorios for update
  using (auth.uid() = user_id);

drop policy if exists "Usuários podem excluir seus relatórios" on relatorios;
create policy "Usuários podem excluir seus relatórios"
  on relatorios for delete
  using (auth.uid() = user_id);
