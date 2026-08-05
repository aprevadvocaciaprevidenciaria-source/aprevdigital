-- SEO Local Brasil painel - módulo financeiro: registro de vendas avulsas
-- (otimização, criação de perfil, serviços por fora) e mensalidades dos
-- clientes com plano recorrente, com controle de status de pagamento.
-- Idempotente: seguro rodar em cima do schema já existente.

create table if not exists financeiro_lancamentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  cliente_id uuid references clientes (id) on delete set null,
  descricao text not null,
  valor numeric not null,
  data date not null default current_date,
  status text not null default 'pendente',
  origem text not null default 'avulso',
  mes_referencia date,
  created_at timestamptz not null default current_timestamp,
  updated_at timestamptz not null default current_timestamp
);

alter table financeiro_lancamentos drop constraint if exists financeiro_lancamentos_status_check;
alter table financeiro_lancamentos add constraint financeiro_lancamentos_status_check
  check (status in ('pago', 'pendente'));

alter table financeiro_lancamentos drop constraint if exists financeiro_lancamentos_origem_check;
alter table financeiro_lancamentos add constraint financeiro_lancamentos_origem_check
  check (origem in ('avulso', 'mensalidade'));

create index if not exists idx_financeiro_lancamentos_user_id on financeiro_lancamentos (user_id);
create index if not exists idx_financeiro_lancamentos_cliente_id on financeiro_lancamentos (cliente_id);
create index if not exists idx_financeiro_lancamentos_data on financeiro_lancamentos (data desc);

-- Sem WHERE (não é índice parcial): cliente_id/mes_referencia nulos nunca
-- colidem entre si no Postgres, então lançamentos avulsos (mes_referencia
-- null) nunca esbarram nessa constraint - ela só evita gerar duas
-- mensalidades pro mesmo cliente no mesmo mês.
create unique index if not exists uniq_financeiro_mensalidade_cliente_mes
  on financeiro_lancamentos (cliente_id, mes_referencia);

alter table financeiro_lancamentos enable row level security;

drop trigger if exists normalizar_user_id_trigger on financeiro_lancamentos;
create trigger normalizar_user_id_trigger before insert on financeiro_lancamentos
  for each row execute function public.normalizar_user_id();

drop policy if exists "Usuarios podem ver seus lancamentos financeiros" on financeiro_lancamentos;
create policy "Usuarios podem ver seus lancamentos financeiros"
  on financeiro_lancamentos for select
  using (public.pode_administrar(user_id));

drop policy if exists "Usuarios podem criar lancamentos financeiros" on financeiro_lancamentos;
create policy "Usuarios podem criar lancamentos financeiros"
  on financeiro_lancamentos for insert
  with check (public.pode_administrar(user_id));

drop policy if exists "Usuarios podem atualizar lancamentos financeiros" on financeiro_lancamentos;
create policy "Usuarios podem atualizar lancamentos financeiros"
  on financeiro_lancamentos for update
  using (public.pode_administrar(user_id));

drop policy if exists "Usuarios podem excluir lancamentos financeiros" on financeiro_lancamentos;
create policy "Usuarios podem excluir lancamentos financeiros"
  on financeiro_lancamentos for delete
  using (public.pode_administrar(user_id));
