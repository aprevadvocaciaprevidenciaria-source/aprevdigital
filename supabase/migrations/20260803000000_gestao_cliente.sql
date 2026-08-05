-- SEO Local Brasil painel - seção "Gestão" do cliente: calendário de posts,
-- termos de busca (substitui o antigo "ranking local") e habilita datas
-- especiais/respostas pro mesmo padrão de acesso (dono + sócio) do resto do app.
-- Idempotente: seguro rodar em cima do schema já existente.

-- ============================================================
-- posts_calendario (calendário de posts do GBP, entrada manual por enquanto;
-- campos já pensados pro dia em que a API do Google Business Profile entrar)
-- ============================================================
create table if not exists posts_calendario (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  cliente_id uuid not null references clientes (id) on delete cascade,
  titulo text not null,
  descricao text,
  tipo text not null default 'novidade' check (tipo in ('novidade', 'oferta', 'evento', 'produto')),
  data_programada date not null,
  status text not null default 'planejado' check (status in ('planejado', 'publicado', 'cancelado')),
  imagem_path text,
  link_cta text,
  cta_tipo text,
  data_publicada timestamptz,
  publicado_por text,
  fonte text not null default 'manual' check (fonte in ('manual', 'api')),
  google_post_id text,
  created_at timestamptz default current_timestamp,
  updated_at timestamptz default current_timestamp
);

create index if not exists idx_posts_calendario_user_id on posts_calendario (user_id);
create index if not exists idx_posts_calendario_cliente_id on posts_calendario (cliente_id);
create index if not exists idx_posts_calendario_data on posts_calendario (data_programada);

alter table posts_calendario enable row level security;

drop policy if exists "Usuarios podem ver posts do calendario" on posts_calendario;
create policy "Usuarios podem ver posts do calendario"
  on posts_calendario for select
  using (public.pode_administrar(user_id) or cliente_id = public.meu_cliente_id());

drop policy if exists "Usuarios podem criar posts do calendario" on posts_calendario;
create policy "Usuarios podem criar posts do calendario"
  on posts_calendario for insert
  with check (public.pode_administrar(user_id));

drop policy if exists "Usuarios podem atualizar posts do calendario" on posts_calendario;
create policy "Usuarios podem atualizar posts do calendario"
  on posts_calendario for update
  using (public.pode_administrar(user_id));

drop policy if exists "Usuarios podem excluir posts do calendario" on posts_calendario;
create policy "Usuarios podem excluir posts do calendario"
  on posts_calendario for delete
  using (public.pode_administrar(user_id));

-- ============================================================
-- termos_busca_cliente (termos de pesquisa que levam até o cliente no
-- Google - dado de "Como os clientes te encontram" do Perfil da Empresa,
-- lançado manualmente. Substitui o antigo rankings_local/"ranking 3-pack",
-- que dependia de posição verificada manualmente e foi descontinuado)
-- ============================================================
create table if not exists termos_busca_cliente (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  cliente_id uuid not null references clientes (id) on delete cascade,
  termo text not null,
  mes date not null default date_trunc('month', current_date)::date,
  observacao text,
  created_at timestamptz default current_timestamp
);

create index if not exists idx_termos_busca_cliente_user_id on termos_busca_cliente (user_id);
create index if not exists idx_termos_busca_cliente_cliente_id on termos_busca_cliente (cliente_id);
create index if not exists idx_termos_busca_cliente_mes on termos_busca_cliente (mes desc);

alter table termos_busca_cliente enable row level security;

drop policy if exists "Usuarios podem ver termos de busca" on termos_busca_cliente;
create policy "Usuarios podem ver termos de busca"
  on termos_busca_cliente for select
  using (public.pode_administrar(user_id) or cliente_id = public.meu_cliente_id());

drop policy if exists "Usuarios podem criar termos de busca" on termos_busca_cliente;
create policy "Usuarios podem criar termos de busca"
  on termos_busca_cliente for insert
  with check (public.pode_administrar(user_id));

drop policy if exists "Usuarios podem excluir termos de busca" on termos_busca_cliente;
create policy "Usuarios podem excluir termos de busca"
  on termos_busca_cliente for delete
  using (public.pode_administrar(user_id));

-- ============================================================
-- datas_especiais / datas_especiais_respostas: essas tabelas já existiam
-- mas nunca tiveram tela no painel. Ao ganhar UI agora (dentro de Gestão),
-- alinhamos as políticas ao padrão pode_administrar() (dono + sócio) usado
-- em todo o resto do app, em vez do auth.uid() = user_id original.
-- ============================================================
drop policy if exists "Usuarios podem gerenciar suas datas especiais" on datas_especiais;

drop policy if exists "Usuarios podem ver datas especiais" on datas_especiais;
create policy "Usuarios podem ver datas especiais"
  on datas_especiais for select
  using (public.pode_administrar(user_id));

drop policy if exists "Usuarios podem criar datas especiais" on datas_especiais;
create policy "Usuarios podem criar datas especiais"
  on datas_especiais for insert
  with check (public.pode_administrar(user_id));

drop policy if exists "Usuarios podem atualizar datas especiais" on datas_especiais;
create policy "Usuarios podem atualizar datas especiais"
  on datas_especiais for update
  using (public.pode_administrar(user_id));

drop policy if exists "Usuarios podem excluir datas especiais" on datas_especiais;
create policy "Usuarios podem excluir datas especiais"
  on datas_especiais for delete
  using (public.pode_administrar(user_id));

drop policy if exists "Usuarios podem gerenciar respostas dos seus clientes" on datas_especiais_respostas;

drop policy if exists "Usuarios podem ver respostas de datas especiais" on datas_especiais_respostas;
create policy "Usuarios podem ver respostas de datas especiais"
  on datas_especiais_respostas for select
  using (public.pode_administrar(user_id) or cliente_id = public.meu_cliente_id());

drop policy if exists "Usuarios podem criar respostas de datas especiais" on datas_especiais_respostas;
create policy "Usuarios podem criar respostas de datas especiais"
  on datas_especiais_respostas for insert
  with check (public.pode_administrar(user_id));

drop policy if exists "Usuarios podem atualizar respostas de datas especiais" on datas_especiais_respostas;
create policy "Usuarios podem atualizar respostas de datas especiais"
  on datas_especiais_respostas for update
  using (public.pode_administrar(user_id));

drop policy if exists "Usuarios podem excluir respostas de datas especiais" on datas_especiais_respostas;
create policy "Usuarios podem excluir respostas de datas especiais"
  on datas_especiais_respostas for delete
  using (public.pode_administrar(user_id));

-- (upsert por (cliente_id, data_especial_id) já tinha uma constraint única
-- desde a migration original - nada a fazer aqui)

-- ============================================================
-- Garante que sócio insira sob o user_id do dono (mesmo padrão já aplicado
-- às demais tabelas em 20260801030000_socio_acesso_total.sql)
-- ============================================================
do $$
declare
  t text;
begin
  foreach t in array array[
    'posts_calendario', 'termos_busca_cliente', 'datas_especiais', 'datas_especiais_respostas'
  ]
  loop
    execute format('drop trigger if exists normalizar_user_id_trigger on %1$s', t);
    execute format(
      'create trigger normalizar_user_id_trigger before insert on %1$s for each row execute function public.normalizar_user_id()',
      t
    );
  end loop;
end $$;
