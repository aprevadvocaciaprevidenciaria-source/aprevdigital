-- SEO Local Brasil painel - automações WhatsApp (relatório mensal, cobrança, solicitação de fotos)
-- Idempotente: seguro rodar em cima do schema já existente.

-- ============================================================
-- clientes: dia de vencimento do plano (padrão = dia da data_inicio_contrato,
-- definido pela aplicação; aqui só a coluna)
-- ============================================================
alter table clientes add column if not exists dia_vencimento int;
alter table clientes drop constraint if exists clientes_dia_vencimento_check;
alter table clientes add constraint clientes_dia_vencimento_check
  check (dia_vencimento is null or (dia_vencimento between 1 and 31));

-- ============================================================
-- automacao_config: 1 linha por usuário/agência
-- ============================================================
create table if not exists automacao_config (
  user_id uuid primary key references users (id) on delete cascade,
  relatorio_mensal_ativo boolean default false,
  relatorio_mensal_dia int default 5,
  cobranca_ativa boolean default false,
  cobranca_dias_antecedencia int default 0,
  cobranca_template text default 'Olá {{contato}}! Passando para lembrar que o plano {{empresa}} no valor de {{valor}} vence em {{vencimento}}. Qualquer dúvida, estamos à disposição!',
  imagens_ativa boolean default false,
  imagens_dias_semana int[] default '{1}',
  imagens_qtd_minima int default 3,
  imagens_template text default 'Olá {{contato}}! Podem nos enviar de {{qtd_minima}} a 5 fotos recentes do dia a dia da {{empresa}} para atualizarmos o Google? 📸',
  relatorio_template text default 'Relatório GBP - {{empresa}}\nVisualizações: {{visualizacoes}}\nChamadas: {{chamadas}}\nSolicitações de rota: {{rotas}}\nCliques no site: {{cliques_site}}',
  updated_at timestamptz default current_timestamp
);

alter table automacao_config enable row level security;

drop policy if exists "Usuários podem ver sua configuração de automação" on automacao_config;
create policy "Usuários podem ver sua configuração de automação"
  on automacao_config for select
  using (auth.uid() = user_id);

drop policy if exists "Usuários podem criar sua configuração de automação" on automacao_config;
create policy "Usuários podem criar sua configuração de automação"
  on automacao_config for insert
  with check (auth.uid() = user_id);

drop policy if exists "Usuários podem atualizar sua configuração de automação" on automacao_config;
create policy "Usuários podem atualizar sua configuração de automação"
  on automacao_config for update
  using (auth.uid() = user_id);

-- ============================================================
-- mensagens_fila: fila/log de mensagens automáticas (WhatsApp)
-- ============================================================
create table if not exists mensagens_fila (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  cliente_id uuid references clientes (id) on delete cascade,
  tipo text not null, -- 'cobranca' | 'relatorio_mensal' | 'solicitacao_imagens'
  mensagem text not null,
  status text not null default 'pendente', -- 'pendente' | 'enviado' | 'cancelado' | 'erro'
  agendado_para date,
  enviado_em timestamptz,
  erro_detalhe text,
  created_at timestamptz default current_timestamp
);

create index if not exists idx_mensagens_fila_user_id on mensagens_fila (user_id);
create index if not exists idx_mensagens_fila_status on mensagens_fila (status);
create index if not exists idx_mensagens_fila_tipo on mensagens_fila (tipo);

alter table mensagens_fila enable row level security;

drop policy if exists "Usuários podem ver suas mensagens" on mensagens_fila;
create policy "Usuários podem ver suas mensagens"
  on mensagens_fila for select
  using (auth.uid() = user_id);

drop policy if exists "Usuários podem criar mensagens" on mensagens_fila;
create policy "Usuários podem criar mensagens"
  on mensagens_fila for insert
  with check (auth.uid() = user_id);

drop policy if exists "Usuários podem atualizar suas mensagens" on mensagens_fila;
create policy "Usuários podem atualizar suas mensagens"
  on mensagens_fila for update
  using (auth.uid() = user_id);

drop policy if exists "Usuários podem excluir suas mensagens" on mensagens_fila;
create policy "Usuários podem excluir suas mensagens"
  on mensagens_fila for delete
  using (auth.uid() = user_id);

-- ============================================================
-- fotos_clientes: galeria de fotos por cliente (upload manual)
-- ============================================================
create table if not exists fotos_clientes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  cliente_id uuid not null references clientes (id) on delete cascade,
  path text not null, -- caminho no Storage: {user_id}/{cliente_id}/arquivo
  categoria text not null default 'semanal', -- 'semanal' | 'visita_mensal'
  descricao text,
  created_at timestamptz default current_timestamp
);

create index if not exists idx_fotos_clientes_cliente_id on fotos_clientes (cliente_id);
create index if not exists idx_fotos_clientes_created_at on fotos_clientes (created_at desc);

alter table fotos_clientes enable row level security;

drop policy if exists "Usuários podem ver suas fotos" on fotos_clientes;
create policy "Usuários podem ver suas fotos"
  on fotos_clientes for select
  using (auth.uid() = user_id);

drop policy if exists "Usuários podem enviar fotos" on fotos_clientes;
create policy "Usuários podem enviar fotos"
  on fotos_clientes for insert
  with check (auth.uid() = user_id);

drop policy if exists "Usuários podem excluir suas fotos" on fotos_clientes;
create policy "Usuários podem excluir suas fotos"
  on fotos_clientes for delete
  using (auth.uid() = user_id);

-- ============================================================
-- Storage: bucket público de leitura para as fotos dos clientes
-- ============================================================
insert into storage.buckets (id, name, public)
values ('fotos-clientes', 'fotos-clientes', true)
on conflict (id) do nothing;

drop policy if exists "Leitura pública das fotos de clientes" on storage.objects;
create policy "Leitura pública das fotos de clientes"
  on storage.objects for select
  using (bucket_id = 'fotos-clientes');

drop policy if exists "Upload de fotos restrito ao dono" on storage.objects;
create policy "Upload de fotos restrito ao dono"
  on storage.objects for insert
  with check (
    bucket_id = 'fotos-clientes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Exclusão de fotos restrita ao dono" on storage.objects;
create policy "Exclusão de fotos restrita ao dono"
  on storage.objects for delete
  using (
    bucket_id = 'fotos-clientes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
