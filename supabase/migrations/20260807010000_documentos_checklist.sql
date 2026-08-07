-- Painel APREV - checklist de documentos por tipo de benefício (modelo,
-- editável só pelo sócio) e o registro por cliente do que já foi pedido ou
-- recebido (equipe toda usa no dia a dia). Mesmo padrão de RLS já usado em
-- base_conhecimento_ia: sou_equipe_de() pra leitura/uso do dia a dia,
-- pode_administrar() pra quem pode editar o modelo.
-- Idempotente: seguro rodar em cima do schema já existente.

-- ============================================================
-- documentos_checklist: modelo de documentos por tipo de benefício
-- ============================================================
create table if not exists documentos_checklist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  tipo_beneficio text not null,
  nome_documento text not null,
  ordem integer not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default current_timestamp
);

create index if not exists idx_documentos_checklist_user_id on documentos_checklist (user_id);
create index if not exists idx_documentos_checklist_tipo on documentos_checklist (tipo_beneficio);

alter table documentos_checklist enable row level security;

drop policy if exists "Equipe le o checklist de documentos" on documentos_checklist;
create policy "Equipe le o checklist de documentos"
  on documentos_checklist for select
  using (public.sou_equipe_de(user_id));

drop policy if exists "Socio cria itens do checklist" on documentos_checklist;
create policy "Socio cria itens do checklist"
  on documentos_checklist for insert
  with check (public.pode_administrar(user_id));

drop policy if exists "Socio atualiza itens do checklist" on documentos_checklist;
create policy "Socio atualiza itens do checklist"
  on documentos_checklist for update
  using (public.pode_administrar(user_id));

drop policy if exists "Socio exclui itens do checklist" on documentos_checklist;
create policy "Socio exclui itens do checklist"
  on documentos_checklist for delete
  using (public.pode_administrar(user_id));

-- ============================================================
-- documentos_cliente: checklist aplicado a um caso específico - gerado a
-- partir de documentos_checklist (pages/api/documentos/gerar.js), depois a
-- equipe marca cada item como recebido conforme o cliente manda (upload
-- continua indo pro Drive do caso via link_pasta_drive - isso aqui só
-- controla o status de cada item pra não pedir de novo o que já foi
-- mandado). Índice único (cliente_id, nome_documento) faz "gerar checklist"
-- de novo só acrescentar item novo do modelo, nunca duplicar nem resetar
-- status já marcado.
-- ============================================================
create table if not exists documentos_cliente (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  cliente_id uuid not null references clientes (id) on delete cascade,
  nome_documento text not null,
  status text not null default 'pendente' check (status in ('pendente', 'recebido')),
  recebido_em timestamptz,
  created_at timestamptz not null default current_timestamp
);

create index if not exists idx_documentos_cliente_cliente_id on documentos_cliente (cliente_id);
create unique index if not exists uniq_documentos_cliente_item on documentos_cliente (cliente_id, nome_documento);

alter table documentos_cliente enable row level security;

drop policy if exists "Equipe ve documentos do cliente" on documentos_cliente;
create policy "Equipe ve documentos do cliente"
  on documentos_cliente for select
  using (public.sou_equipe_de(user_id));

drop policy if exists "Equipe cria documentos do cliente" on documentos_cliente;
create policy "Equipe cria documentos do cliente"
  on documentos_cliente for insert
  with check (public.sou_equipe_de(user_id));

drop policy if exists "Equipe atualiza documentos do cliente" on documentos_cliente;
create policy "Equipe atualiza documentos do cliente"
  on documentos_cliente for update
  using (public.sou_equipe_de(user_id));

drop policy if exists "Equipe exclui documentos do cliente" on documentos_cliente;
create policy "Equipe exclui documentos do cliente"
  on documentos_cliente for delete
  using (public.sou_equipe_de(user_id));

-- ============================================================
-- Seed inicial: checklist padrão pros benefícios mais comuns. Só insere se
-- a tabela ainda estiver vazia, pra não sobrescrever edição feita pelo
-- sócio numa reaplicação da migration. Dono = primeiro usuário cadastrado
-- (mesmo critério já usado em pages/api/webhooks/zapi.js).
-- ============================================================
do $$
declare
  dono_id uuid;
begin
  if exists (select 1 from documentos_checklist) then
    return;
  end if;

  select id into dono_id from users order by created_at asc limit 1;
  if dono_id is null then
    return;
  end if;

  insert into documentos_checklist (user_id, tipo_beneficio, nome_documento, ordem) values
    (dono_id, 'auxilio-doenca', 'RG e CPF (ou CNH)', 1),
    (dono_id, 'auxilio-doenca', 'Comprovante de residência atualizado', 2),
    (dono_id, 'auxilio-doenca', 'CNIS atualizado', 3),
    (dono_id, 'auxilio-doenca', 'Procuração assinada', 4),
    (dono_id, 'auxilio-doenca', 'Atestados e laudos médicos', 5),
    (dono_id, 'auxilio-doenca', 'Exames complementares', 6),
    (dono_id, 'auxilio-doenca', 'Últimos contracheques ou carnês de contribuição', 7),

    (dono_id, 'aposentadoria-idade', 'RG e CPF (ou CNH)', 1),
    (dono_id, 'aposentadoria-idade', 'Comprovante de residência atualizado', 2),
    (dono_id, 'aposentadoria-idade', 'CNIS atualizado', 3),
    (dono_id, 'aposentadoria-idade', 'Procuração assinada', 4),
    (dono_id, 'aposentadoria-idade', 'Carteira(s) de trabalho (todas)', 5),
    (dono_id, 'aposentadoria-idade', 'Certidão de nascimento ou casamento', 6),

    (dono_id, 'aposentadoria-tempo-contribuicao', 'RG e CPF (ou CNH)', 1),
    (dono_id, 'aposentadoria-tempo-contribuicao', 'Comprovante de residência atualizado', 2),
    (dono_id, 'aposentadoria-tempo-contribuicao', 'CNIS atualizado', 3),
    (dono_id, 'aposentadoria-tempo-contribuicao', 'Procuração assinada', 4),
    (dono_id, 'aposentadoria-tempo-contribuicao', 'Carteira(s) de trabalho (todas)', 5),
    (dono_id, 'aposentadoria-tempo-contribuicao', 'PPP (Perfil Profissiográfico Previdenciário), se tempo especial', 6),

    (dono_id, 'aposentadoria-invalidez', 'RG e CPF (ou CNH)', 1),
    (dono_id, 'aposentadoria-invalidez', 'Comprovante de residência atualizado', 2),
    (dono_id, 'aposentadoria-invalidez', 'CNIS atualizado', 3),
    (dono_id, 'aposentadoria-invalidez', 'Procuração assinada', 4),
    (dono_id, 'aposentadoria-invalidez', 'Laudos médicos e exames', 5),
    (dono_id, 'aposentadoria-invalidez', 'Histórico de perícias do INSS', 6),

    (dono_id, 'pensao-morte', 'RG e CPF (ou CNH) do requerente', 1),
    (dono_id, 'pensao-morte', 'Comprovante de residência atualizado', 2),
    (dono_id, 'pensao-morte', 'CNIS do falecido', 3),
    (dono_id, 'pensao-morte', 'Procuração assinada', 4),
    (dono_id, 'pensao-morte', 'Certidão de óbito', 5),
    (dono_id, 'pensao-morte', 'Certidão de casamento ou união estável', 6),
    (dono_id, 'pensao-morte', 'Certidão de nascimento dos dependentes', 7),

    (dono_id, 'bpc-loas', 'RG e CPF (ou CNH)', 1),
    (dono_id, 'bpc-loas', 'Comprovante de residência atualizado', 2),
    (dono_id, 'bpc-loas', 'Procuração assinada', 3),
    (dono_id, 'bpc-loas', 'Comprovante de renda de todos os moradores da casa', 4),
    (dono_id, 'bpc-loas', 'Laudo médico, se por deficiência', 5),
    (dono_id, 'bpc-loas', 'Declaração de composição familiar', 6),

    (dono_id, 'salario-maternidade', 'RG e CPF (ou CNH)', 1),
    (dono_id, 'salario-maternidade', 'Comprovante de residência atualizado', 2),
    (dono_id, 'salario-maternidade', 'Procuração assinada', 3),
    (dono_id, 'salario-maternidade', 'Certidão de nascimento da criança', 4),
    (dono_id, 'salario-maternidade', 'Carteira de trabalho', 5),
    (dono_id, 'salario-maternidade', 'Últimos contracheques ou carnês de contribuição', 6),

    (dono_id, 'revisao-beneficio', 'RG e CPF (ou CNH)', 1),
    (dono_id, 'revisao-beneficio', 'Comprovante de residência atualizado', 2),
    (dono_id, 'revisao-beneficio', 'Procuração assinada', 3),
    (dono_id, 'revisao-beneficio', 'Carta de concessão do benefício', 4),
    (dono_id, 'revisao-beneficio', 'Extrato de pagamentos (HISCRE/HISMED)', 5),
    (dono_id, 'revisao-beneficio', 'CNIS atualizado', 6);
end $$;
