-- SEO Local Brasil painel - acesso de login pra colaboradores + atribuição de tarefas
-- Idempotente: seguro rodar em cima do schema já existente.

-- ============================================================
-- users: novo tipo 'colaborador' (além de 'agencia' e 'cliente')
-- ============================================================
alter table users drop constraint if exists users_tipo_check;
alter table users add constraint users_tipo_check check (tipo in ('agencia', 'cliente', 'colaborador'));

-- ============================================================
-- colaboradores: vínculo opcional com uma conta de login
-- ============================================================
alter table colaboradores add column if not exists login_user_id uuid references users (id) on delete set null;
create unique index if not exists uniq_colaboradores_login_user_id on colaboradores (login_user_id)
  where login_user_id is not null;

-- ============================================================
-- tarefas: atribuição a um colaborador
-- ============================================================
alter table tarefas add column if not exists colaborador_id uuid references colaboradores (id) on delete set null;
create index if not exists idx_tarefas_colaborador_id on tarefas (colaborador_id);

-- ============================================================
-- Função auxiliar: id do colaborador vinculado ao usuário logado
-- ============================================================
create or replace function public.meu_colaborador_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from public.colaboradores where login_user_id = auth.uid();
$$;

-- ============================================================
-- RLS: colaborador vê e atualiza só as tarefas atribuídas a ele,
-- e vê (só leitura) os clientes ligados a essas tarefas pra ter contexto.
-- ============================================================
drop policy if exists "Usuários podem ver suas tarefas" on tarefas;
create policy "Usuários podem ver suas tarefas"
  on tarefas for select
  using (auth.uid() = user_id or colaborador_id = public.meu_colaborador_id());

drop policy if exists "Usuários podem atualizar suas tarefas" on tarefas;
create policy "Usuários podem atualizar suas tarefas"
  on tarefas for update
  using (auth.uid() = user_id or colaborador_id = public.meu_colaborador_id());

-- Colaborador precisa ver o próprio registro (nome, papel) pra se
-- identificar no painel dele.
drop policy if exists "Usuários podem ver seus colaboradores" on colaboradores;
create policy "Usuários podem ver seus colaboradores"
  on colaboradores for select
  using (auth.uid() = user_id or login_user_id = auth.uid());

drop policy if exists "Usuários podem ver seus clientes" on clientes;
create policy "Usuários podem ver seus clientes"
  on clientes for select
  using (
    auth.uid() = user_id
    or id = public.meu_cliente_id()
    or id in (select cliente_id from tarefas where colaborador_id = public.meu_colaborador_id())
  );
