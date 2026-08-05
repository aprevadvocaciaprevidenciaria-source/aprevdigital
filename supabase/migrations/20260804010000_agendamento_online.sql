-- SEO Local Brasil painel - base de dados pro agendamento online.
-- As páginas de agendamento (uma por cliente, com identidade visual própria
-- gerada à parte) vão embutir um widget compartilhado que fala com essas
-- tabelas via API pública (rota a ser criada depois, com service role).
-- Idempotente: seguro rodar em cima do schema já existente.

create extension if not exists pgcrypto;

-- ============================================================
-- clientes: disponibilidade pro agendamento online
-- ============================================================
alter table clientes add column if not exists slug text unique;
alter table clientes add column if not exists dias_funcionamento int[] not null default '{1,2,3,4,5,6}';
alter table clientes add column if not exists horario_abertura time not null default '08:00';
alter table clientes add column if not exists horario_fechamento time not null default '18:00';
alter table clientes add column if not exists intervalo_almoco_inicio time;
alter table clientes add column if not exists intervalo_almoco_fim time;
alter table clientes add column if not exists duracao_padrao_servico int not null default 60;

create index if not exists idx_clientes_slug on clientes (slug);

-- ============================================================
-- agendamentos
-- ============================================================
create table if not exists agendamentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  cliente_id uuid not null references clientes (id) on delete cascade,
  nome_solicitante text not null,
  whatsapp_solicitante text not null,
  veiculo_marca text,
  veiculo_modelo text,
  veiculo_placa text,
  servico text,
  data_agendada date not null,
  horario_agendado time not null,
  status text not null default 'pendente' check (status in ('pendente', 'confirmado', 'cancelado', 'concluido', 'nao_compareceu')),
  origem text not null default 'site' check (origem in ('site', 'whatsapp', 'telefone')),
  observacoes text,
  token_cancelamento text not null unique default encode(gen_random_bytes(16), 'hex'),
  created_at timestamptz default current_timestamp,
  updated_at timestamptz default current_timestamp
);

create index if not exists idx_agendamentos_user_id on agendamentos (user_id);
create index if not exists idx_agendamentos_cliente_id on agendamentos (cliente_id);
create index if not exists idx_agendamentos_data on agendamentos (data_agendada);
create index if not exists idx_agendamentos_token on agendamentos (token_cancelamento);

-- Trava dois agendamentos no mesmo horário pro mesmo cliente (cancelados não
-- contam - assume 1 atendimento por horário; se algum cliente tiver mais de
-- um elevador/box simultâneo, isso vira ajuste futuro).
create unique index if not exists idx_agendamentos_slot_unico
  on agendamentos (cliente_id, data_agendada, horario_agendado)
  where status <> 'cancelado';

alter table agendamentos enable row level security;

drop policy if exists "Usuarios podem ver agendamentos" on agendamentos;
create policy "Usuarios podem ver agendamentos"
  on agendamentos for select
  using (public.pode_administrar(user_id) or cliente_id = public.meu_cliente_id());

drop policy if exists "Usuarios podem criar agendamentos" on agendamentos;
create policy "Usuarios podem criar agendamentos"
  on agendamentos for insert
  with check (public.pode_administrar(user_id));

drop policy if exists "Usuarios podem atualizar agendamentos" on agendamentos;
create policy "Usuarios podem atualizar agendamentos"
  on agendamentos for update
  using (public.pode_administrar(user_id));

drop policy if exists "Usuarios podem excluir agendamentos" on agendamentos;
create policy "Usuarios podem excluir agendamentos"
  on agendamentos for delete
  using (public.pode_administrar(user_id));

drop trigger if exists normalizar_user_id_trigger on agendamentos;
create trigger normalizar_user_id_trigger
  before insert on agendamentos
  for each row execute function public.normalizar_user_id();
