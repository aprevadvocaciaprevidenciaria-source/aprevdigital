-- SEO Local Brasil painel - avaliações do Google, ranking local e suporte ao portal do cliente
-- Idempotente: seguro rodar em cima do schema já existente.

-- ============================================================
-- avaliacoes (avaliações do Google, entrada manual)
-- ============================================================
create table if not exists avaliacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  cliente_id uuid not null references clientes (id) on delete cascade,
  autor text not null,
  nota smallint not null check (nota between 1 and 5),
  comentario text,
  data_avaliacao date not null default current_date,
  resposta text,
  respondida_em timestamptz,
  created_at timestamptz default current_timestamp
);

create index if not exists idx_avaliacoes_user_id on avaliacoes (user_id);
create index if not exists idx_avaliacoes_cliente_id on avaliacoes (cliente_id);
create index if not exists idx_avaliacoes_data on avaliacoes (data_avaliacao desc);

alter table avaliacoes enable row level security;

drop policy if exists "Usuarios podem ver suas avaliacoes" on avaliacoes;
create policy "Usuarios podem ver suas avaliacoes"
  on avaliacoes for select
  using (auth.uid() = user_id);

drop policy if exists "Usuarios podem criar avaliacoes" on avaliacoes;
create policy "Usuarios podem criar avaliacoes"
  on avaliacoes for insert
  with check (auth.uid() = user_id);

drop policy if exists "Usuarios podem atualizar avaliacoes" on avaliacoes;
create policy "Usuarios podem atualizar avaliacoes"
  on avaliacoes for update
  using (auth.uid() = user_id);

drop policy if exists "Usuarios podem excluir avaliacoes" on avaliacoes;
create policy "Usuarios podem excluir avaliacoes"
  on avaliacoes for delete
  using (auth.uid() = user_id);

-- ============================================================
-- rankings_local (posição no pacote local / 3-pack, entrada manual)
-- ============================================================
create table if not exists rankings_local (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  cliente_id uuid not null references clientes (id) on delete cascade,
  palavra_chave text not null,
  posicao int,
  verificado_em timestamptz not null default current_timestamp,
  created_at timestamptz default current_timestamp
);

create index if not exists idx_rankings_local_user_id on rankings_local (user_id);
create index if not exists idx_rankings_local_cliente_id on rankings_local (cliente_id);

alter table rankings_local enable row level security;

drop policy if exists "Usuarios podem ver seus rankings" on rankings_local;
create policy "Usuarios podem ver seus rankings"
  on rankings_local for select
  using (auth.uid() = user_id);

drop policy if exists "Usuarios podem criar rankings" on rankings_local;
create policy "Usuarios podem criar rankings"
  on rankings_local for insert
  with check (auth.uid() = user_id);

drop policy if exists "Usuarios podem excluir rankings" on rankings_local;
create policy "Usuarios podem excluir rankings"
  on rankings_local for delete
  using (auth.uid() = user_id);

-- ============================================================
-- Portal do cliente: tipo de usuário e vínculo com um cliente
-- ============================================================
alter table users add column if not exists tipo text not null default 'agencia';
alter table users drop constraint if exists users_tipo_check;
alter table users add constraint users_tipo_check check (tipo in ('agencia', 'cliente'));

alter table users add column if not exists cliente_id uuid references clientes (id) on delete set null;

-- Função auxiliar: cliente_id do usuário logado, só quando ele é do tipo 'cliente'.
-- security definer pra poder ser usada dentro das próprias políticas de RLS de "users"
-- sem recursão.
create or replace function public.meu_cliente_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select cliente_id from public.users where id = auth.uid() and tipo = 'cliente';
$$;

-- Trava de segurança: só a service role (usada pelo convite administrado pelo dono
-- da conta) pode alterar tipo/cliente_id. Sem isso, um usuário logado poderia se
-- promover a 'agencia' ou trocar de cliente_id direto pela API do Supabase.
create or replace function public.prevent_tipo_escalation()
returns trigger
language plpgsql
as $$
begin
  if auth.role() <> 'service_role' then
    if new.tipo is distinct from old.tipo or new.cliente_id is distinct from old.cliente_id then
      raise exception 'Não é permitido alterar tipo ou cliente_id diretamente.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_tipo_escalation_trigger on users;
create trigger prevent_tipo_escalation_trigger
  before update on users
  for each row execute function public.prevent_tipo_escalation();

-- ============================================================
-- Atualiza políticas de SELECT para dar acesso de leitura ao cliente
-- (dono da agência continua com acesso total, inalterado)
-- ============================================================

drop policy if exists "Usuários podem ver seus clientes" on clientes;
create policy "Usuários podem ver seus clientes"
  on clientes for select
  using (auth.uid() = user_id or id = public.meu_cliente_id());

drop policy if exists "Usuários podem ver métricas de seus clientes" on metricas_gbp;
create policy "Usuários podem ver métricas de seus clientes"
  on metricas_gbp for select
  using (
    cliente_id in (select id from clientes where user_id = auth.uid())
    or cliente_id = public.meu_cliente_id()
  );

drop policy if exists "Usuários podem ver seus relatórios" on relatorios;
create policy "Usuários podem ver seus relatórios"
  on relatorios for select
  using (auth.uid() = user_id or cliente_id = public.meu_cliente_id());

drop policy if exists "Usuários podem ver suas fotos" on fotos_clientes;
create policy "Usuários podem ver suas fotos"
  on fotos_clientes for select
  using (auth.uid() = user_id or cliente_id = public.meu_cliente_id());

drop policy if exists "Usuarios podem ver suas avaliacoes" on avaliacoes;
create policy "Usuarios podem ver suas avaliacoes"
  on avaliacoes for select
  using (auth.uid() = user_id or cliente_id = public.meu_cliente_id());

drop policy if exists "Usuarios podem ver seus rankings" on rankings_local;
create policy "Usuarios podem ver seus rankings"
  on rankings_local for select
  using (auth.uid() = user_id or cliente_id = public.meu_cliente_id());

-- O dono da agência também precisa ver quem já tem acesso de cliente
-- vinculado aos próprios clientes (tela "dar acesso ao cliente").
drop policy if exists "Usuários podem ver seu perfil" on users;
create policy "Usuários podem ver seu perfil"
  on users for select
  using (
    auth.uid() = id
    or cliente_id in (select id from clientes where user_id = auth.uid())
  );
