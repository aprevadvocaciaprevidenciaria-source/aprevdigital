-- SEO Local Brasil painel - notificações push do portal do cliente (nova
-- avaliação, novo relatório, nova data especial pra confirmar).
-- Idempotente: seguro rodar em cima do schema já existente.

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  cliente_id uuid not null references clientes (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default current_timestamp
);

create index if not exists idx_push_subscriptions_cliente_id on push_subscriptions (cliente_id);
create index if not exists idx_push_subscriptions_user_id on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

-- Cada login de cliente só gerencia as próprias inscrições (o portal
-- inscreve o navegador dele mesmo, não em nome de outra pessoa).
drop policy if exists "Cliente gerencia suas inscricoes de push" on push_subscriptions;
create policy "Cliente gerencia suas inscricoes de push"
  on push_subscriptions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Nota: quem ENVIA a notificação (admin adicionando avaliação, gerando
-- relatório, cadastrando data especial) roda com a service role em
-- /api/notificacoes/enviar e nos crons - não depende dessa policy, que é só
-- pro cliente gerenciar a própria inscrição do navegador dele.
