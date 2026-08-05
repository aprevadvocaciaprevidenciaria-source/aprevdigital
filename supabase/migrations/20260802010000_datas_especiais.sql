-- SEO Local Brasil painel - datas especiais (feriados/eventos locais) e
-- resposta de cada cliente do plano Gestão sobre fechar ou não naquele dia.
-- Idempotente: seguro rodar em cima do schema já existente.

-- ============================================================
-- clientes: marca se o cliente está no plano de Gestão contínua
-- (só esses clientes recebem a aba de datas especiais no portal)
-- ============================================================
alter table clientes add column if not exists plano_gestao boolean not null default false;

-- ============================================================
-- datas_especiais: cadastradas manualmente pelo admin (feriados
-- nacionais, aniversário da cidade, eventos locais, etc.)
-- ============================================================
create table if not exists datas_especiais (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  data date not null,
  nome text not null,
  created_at timestamptz not null default current_timestamp
);

create index if not exists idx_datas_especiais_user_id on datas_especiais (user_id);
create index if not exists idx_datas_especiais_data on datas_especiais (data);

alter table datas_especiais enable row level security;

drop policy if exists "Usuarios podem gerenciar suas datas especiais" on datas_especiais;
create policy "Usuarios podem gerenciar suas datas especiais"
  on datas_especiais for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Nota: o portal do cliente lê as datas especiais através da rota
-- /api/portal/datas-especiais (service role), porque a policy acima só
-- libera leitura pro dono da agência, não pro cliente logado.

-- ============================================================
-- datas_especiais_respostas: se aquele cliente vai fechar ou não em
-- cada data especial. Pode ser preenchida pelo admin (já sabe de
-- experiência) ou pelo próprio cliente no portal dele.
-- ============================================================
create table if not exists datas_especiais_respostas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  cliente_id uuid not null references clientes (id) on delete cascade,
  data_especial_id uuid not null references datas_especiais (id) on delete cascade,
  vai_fechar boolean not null,
  horario_alternativo text,
  respondido_por text not null default 'admin',
  updated_at timestamptz not null default current_timestamp,
  unique (cliente_id, data_especial_id)
);

alter table datas_especiais_respostas drop constraint if exists datas_especiais_respostas_respondido_por_check;
alter table datas_especiais_respostas add constraint datas_especiais_respostas_respondido_por_check
  check (respondido_por in ('admin', 'cliente'));

create index if not exists idx_datas_especiais_respostas_cliente_id on datas_especiais_respostas (cliente_id);

alter table datas_especiais_respostas enable row level security;

drop policy if exists "Usuarios podem gerenciar respostas dos seus clientes" on datas_especiais_respostas;
create policy "Usuarios podem gerenciar respostas dos seus clientes"
  on datas_especiais_respostas for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Nota: o cliente logado no portal dele não é o "user_id" dono (esse é a
-- agência) - por isso a leitura e o envio de resposta do lado do cliente
-- passam pela rota /api/portal/datas-especiais (service role), que checa
-- que o cliente logado (users.cliente_id) é dono daquele cliente_id antes
-- de deixar ler ou gravar.
