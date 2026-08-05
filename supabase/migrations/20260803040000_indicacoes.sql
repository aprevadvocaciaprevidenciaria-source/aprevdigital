-- SEO Local Brasil painel - "Indique e ganhe": cliente indica outro
-- empresário direto pelo portal, admin acompanha e marca quando fechar
-- negócio (desconto/mês grátis é aplicado manualmente pelo admin, sem
-- automação de cobrança).
-- Idempotente: seguro rodar em cima do schema já existente.

create table if not exists indicacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  cliente_id uuid not null references clientes (id) on delete cascade,
  nome_indicado text not null,
  whatsapp_indicado text not null,
  status text not null default 'pendente',
  observacoes text,
  created_at timestamptz not null default current_timestamp,
  updated_at timestamptz not null default current_timestamp
);

alter table indicacoes drop constraint if exists indicacoes_status_check;
alter table indicacoes add constraint indicacoes_status_check
  check (status in ('pendente', 'contatado', 'convertido', 'descartado'));

create index if not exists idx_indicacoes_user_id on indicacoes (user_id);
create index if not exists idx_indicacoes_cliente_id on indicacoes (cliente_id);

alter table indicacoes enable row level security;

-- Sem policy de insert proposital: a gravação sempre passa por
-- /api/portal/indicacoes (service role), que confirma o cliente logado e
-- grava o user_id certo (o dono da agência) - direto pela RLS o cliente não
-- teria como setar esse campo corretamente.
drop policy if exists "Ver indicacoes" on indicacoes;
create policy "Ver indicacoes" on indicacoes for select
  using (public.pode_administrar(user_id) or cliente_id = public.meu_cliente_id());

drop policy if exists "Admin atualiza indicacoes" on indicacoes;
create policy "Admin atualiza indicacoes" on indicacoes for update
  using (public.pode_administrar(user_id));

drop policy if exists "Admin exclui indicacoes" on indicacoes;
create policy "Admin exclui indicacoes" on indicacoes for delete
  using (public.pode_administrar(user_id));
