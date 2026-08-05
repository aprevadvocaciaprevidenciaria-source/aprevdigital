-- SEO Local Brasil painel - conteúdo editorial do portal do cliente:
-- novidades do Google, vitrine de upsell e pílulas de conhecimento (vídeos).
-- Não é por cliente - o mesmo conteúdo aparece pra todos os clientes de um
-- dono de agência, então a leitura libera pra qualquer usuário autenticado
-- (cliente ou admin), e a escrita fica restrita a quem administra a conta.
-- Idempotente: seguro rodar em cima do schema já existente.

create table if not exists novidades_google (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  titulo text not null,
  texto text not null,
  created_at timestamptz not null default current_timestamp
);

create table if not exists upsells (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  titulo text not null,
  descricao text,
  link text,
  ativo boolean not null default true,
  ordem int not null default 0,
  created_at timestamptz not null default current_timestamp
);

create table if not exists pilulas_conhecimento (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  titulo text not null,
  video_url text not null,
  descricao text,
  ordem int not null default 0,
  created_at timestamptz not null default current_timestamp
);

create index if not exists idx_novidades_google_user_id on novidades_google (user_id);
create index if not exists idx_upsells_user_id on upsells (user_id);
create index if not exists idx_pilulas_conhecimento_user_id on pilulas_conhecimento (user_id);

alter table novidades_google enable row level security;
alter table upsells enable row level security;
alter table pilulas_conhecimento enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['novidades_google', 'upsells', 'pilulas_conhecimento']
  loop
    execute format('drop policy if exists "Autenticados podem ver %1$s" on %1$s', t);
    execute format(
      'create policy "Autenticados podem ver %1$s" on %1$s for select using (auth.uid() is not null)',
      t
    );

    execute format('drop policy if exists "Admin cria %1$s" on %1$s', t);
    execute format(
      'create policy "Admin cria %1$s" on %1$s for insert with check (public.pode_administrar(user_id))',
      t
    );

    execute format('drop policy if exists "Admin atualiza %1$s" on %1$s', t);
    execute format(
      'create policy "Admin atualiza %1$s" on %1$s for update using (public.pode_administrar(user_id))',
      t
    );

    execute format('drop policy if exists "Admin exclui %1$s" on %1$s', t);
    execute format(
      'create policy "Admin exclui %1$s" on %1$s for delete using (public.pode_administrar(user_id))',
      t
    );

    execute format('drop trigger if exists normalizar_user_id_trigger on %1$s', t);
    execute format(
      'create trigger normalizar_user_id_trigger before insert on %1$s for each row execute function public.normalizar_user_id()',
      t
    );
  end loop;
end $$;
