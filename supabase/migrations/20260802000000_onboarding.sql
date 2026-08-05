-- SEO Local Brasil painel - formulários de onboarding de clientes novos
-- (Criação de perfil / Otimização de perfil), preenchidos pelo próprio
-- cliente por um link público (sem login), a partir de um ID de cliente
-- já cadastrado no painel.
-- Idempotente: seguro rodar em cima do schema já existente.

create table if not exists onboarding_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  cliente_id uuid not null references clientes (id) on delete cascade,
  tipo text not null,
  dados jsonb not null,
  created_at timestamptz not null default current_timestamp
);

alter table onboarding_submissions drop constraint if exists onboarding_submissions_tipo_check;
alter table onboarding_submissions add constraint onboarding_submissions_tipo_check
  check (tipo in ('criacao', 'otimizacao'));

create index if not exists idx_onboarding_submissions_cliente_id on onboarding_submissions (cliente_id);
create index if not exists idx_onboarding_submissions_user_id on onboarding_submissions (user_id);

alter table onboarding_submissions enable row level security;

drop policy if exists "Usuarios podem ver onboarding dos seus clientes" on onboarding_submissions;
create policy "Usuarios podem ver onboarding dos seus clientes"
  on onboarding_submissions for select
  using (auth.uid() = user_id);

-- Nota: o envio público (formulário preenchido pelo cliente, sem login no
-- painel) usa a rota /api/onboarding/enviar com a service role, que ignora
-- RLS - igual ao padrão já usado em /api/leads/capturar.
