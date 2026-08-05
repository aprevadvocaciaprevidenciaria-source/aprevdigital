-- SEO Local Brasil painel - reforma completa (v2)
-- Adiciona campos de cadastro do cliente, checklist de subtarefas e a tabela de colaboradores.
-- Idempotente: seguro rodar em cima do schema já existente (20260731000000_init_schema.sql).

-- ============================================================
-- clientes: novos campos de cadastro
-- ============================================================
alter table clientes add column if not exists cnpj text;
alter table clientes add column if not exists endereco text;
alter table clientes add column if not exists cidade text;
alter table clientes add column if not exists telefone text;
alter table clientes add column if not exists email_comercial text;
alter table clientes add column if not exists data_inicio_contrato date;

-- ============================================================
-- tarefas: checklist de subtarefas (array leve, sem tabela extra)
-- cada item: { "id": uuid, "titulo": text, "concluida": boolean }
-- ============================================================
alter table tarefas add column if not exists subtarefas jsonb default '[]'::jsonb;

-- ============================================================
-- colaboradores (sócios/equipe cadastrados por usuário, sem login próprio)
-- ============================================================
create table if not exists colaboradores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  nome text not null,
  email text,
  papel text default 'colaborador',
  created_at timestamptz default current_timestamp
);

create index if not exists idx_colaboradores_user_id on colaboradores (user_id);

alter table colaboradores enable row level security;

drop policy if exists "Usuários podem ver seus colaboradores" on colaboradores;
create policy "Usuários podem ver seus colaboradores"
  on colaboradores for select
  using (auth.uid() = user_id);

drop policy if exists "Usuários podem criar colaboradores" on colaboradores;
create policy "Usuários podem criar colaboradores"
  on colaboradores for insert
  with check (auth.uid() = user_id);

drop policy if exists "Usuários podem atualizar seus colaboradores" on colaboradores;
create policy "Usuários podem atualizar seus colaboradores"
  on colaboradores for update
  using (auth.uid() = user_id);

drop policy if exists "Usuários podem excluir seus colaboradores" on colaboradores;
create policy "Usuários podem excluir seus colaboradores"
  on colaboradores for delete
  using (auth.uid() = user_id);
