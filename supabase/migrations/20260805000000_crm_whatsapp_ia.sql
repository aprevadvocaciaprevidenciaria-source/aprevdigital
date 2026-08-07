-- Painel escritório de advocacia - CRM de WhatsApp com sugestão de resposta por IA
-- Idempotente: seguro rodar em cima do schema já existente (herdado do seolocalbrasil).
--
-- Contexto: leads/mensagens_fila já existiam pra prospecção e automação de disparo,
-- mas não havia histórico bidirecional de conversa nem um espaço pra IA sugerir
-- resposta. Este arquivo adiciona isso sem alterar o que já existe.
--
-- Escopo de user_id: as tabelas novas usam a função sou_equipe_de() abaixo, que é
-- mais aberta que pode_administrar() (que só reconhece papel = 'socio') - aqui
-- QUALQUER colaborador vinculado ao dono (inclusive secretária) pode ver e mexer,
-- porque é um CRM de equipe compartilhado entre as duas secretárias. Por isso o
-- gatilho normalizar_user_id_trigger (que só reconhece sócio) NÃO foi aplicado
-- aqui de propósito - o app precisa sempre gravar o user_id correto do "dono" da
-- conta (que a secretária já conhece via colaboradores.user_id), senão a RLS abaixo
-- aceita a gravação mas isola o registro sob a conta pessoal de quem gravou.

-- ============================================================
-- Função auxiliar: o usuário logado faz parte da equipe desse "dono"?
-- (é o próprio dono, ou é QUALQUER colaborador vinculado a ele - qualquer papel,
-- diferente de pode_administrar() que só aceita sócio)
-- ============================================================
create or replace function public.sou_equipe_de(dono_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select dono_id = auth.uid() or exists (
    select 1 from colaboradores
    where user_id = dono_id and login_user_id = auth.uid()
  );
$$;

-- ============================================================
-- conversas_whatsapp: uma linha por thread de WhatsApp (lead ou cliente)
-- ============================================================
create table if not exists conversas_whatsapp (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  lead_id uuid references leads_manuais (id) on delete set null,
  cliente_id uuid references clientes (id) on delete set null,
  telefone text not null,
  nome_contato text,
  colaborador_id uuid references colaboradores (id) on delete set null,
  status text not null default 'aberta',
  ultima_mensagem_em timestamptz,
  ultima_mensagem_preview text,
  nao_lidas int not null default 0,
  created_at timestamptz not null default current_timestamp,
  updated_at timestamptz not null default current_timestamp
);

alter table conversas_whatsapp drop constraint if exists conversas_whatsapp_status_check;
alter table conversas_whatsapp add constraint conversas_whatsapp_status_check
  check (status in ('aberta', 'aguardando_resposta', 'resolvida', 'perdida'));

create unique index if not exists uniq_conversas_whatsapp_user_telefone
  on conversas_whatsapp (user_id, telefone);
create index if not exists idx_conversas_whatsapp_lead_id on conversas_whatsapp (lead_id);
create index if not exists idx_conversas_whatsapp_cliente_id on conversas_whatsapp (cliente_id);
create index if not exists idx_conversas_whatsapp_colaborador_id on conversas_whatsapp (colaborador_id);
create index if not exists idx_conversas_whatsapp_status on conversas_whatsapp (status);
create index if not exists idx_conversas_whatsapp_ultima_mensagem on conversas_whatsapp (ultima_mensagem_em desc);

alter table conversas_whatsapp enable row level security;

drop policy if exists "Equipe ve as conversas" on conversas_whatsapp;
create policy "Equipe ve as conversas"
  on conversas_whatsapp for select
  using (public.sou_equipe_de(user_id));

drop policy if exists "Equipe cria conversas" on conversas_whatsapp;
create policy "Equipe cria conversas"
  on conversas_whatsapp for insert
  with check (public.sou_equipe_de(user_id));

drop policy if exists "Equipe atualiza conversas" on conversas_whatsapp;
create policy "Equipe atualiza conversas"
  on conversas_whatsapp for update
  using (public.sou_equipe_de(user_id));

drop policy if exists "Dono exclui conversas" on conversas_whatsapp;
create policy "Dono exclui conversas"
  on conversas_whatsapp for delete
  using (public.pode_administrar(user_id));

-- ============================================================
-- Função auxiliar: o usuário logado pode ver/mexer nessa conversa?
-- ============================================================
create or replace function public.pode_ver_conversa(p_conversa_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from conversas_whatsapp c
    where c.id = p_conversa_id and public.sou_equipe_de(c.user_id)
  );
$$;

-- ============================================================
-- mensagens_conversa: histórico real (recebidas e enviadas), diferente da
-- mensagens_fila que é só fila de disparo automático (cobrança/relatório/fotos).
-- ============================================================
create table if not exists mensagens_conversa (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references conversas_whatsapp (id) on delete cascade,
  direcao text not null,
  remetente text not null default 'contato',
  texto text,
  midia_url text,
  message_id_externo text,
  enviado_em timestamptz not null default current_timestamp,
  lida boolean not null default false,
  created_at timestamptz not null default current_timestamp
);

alter table mensagens_conversa drop constraint if exists mensagens_conversa_direcao_check;
alter table mensagens_conversa add constraint mensagens_conversa_direcao_check
  check (direcao in ('recebida', 'enviada'));

alter table mensagens_conversa drop constraint if exists mensagens_conversa_remetente_check;
alter table mensagens_conversa add constraint mensagens_conversa_remetente_check
  check (remetente in ('contato', 'secretaria', 'ia', 'sistema'));

create unique index if not exists uniq_mensagens_conversa_msg_externo
  on mensagens_conversa (message_id_externo) where message_id_externo is not null;
create index if not exists idx_mensagens_conversa_conversa_id on mensagens_conversa (conversa_id);
create index if not exists idx_mensagens_conversa_enviado_em on mensagens_conversa (enviado_em desc);

alter table mensagens_conversa enable row level security;

drop policy if exists "Equipe ve mensagens" on mensagens_conversa;
create policy "Equipe ve mensagens"
  on mensagens_conversa for select
  using (public.pode_ver_conversa(conversa_id));

drop policy if exists "Equipe envia mensagens" on mensagens_conversa;
create policy "Equipe envia mensagens"
  on mensagens_conversa for insert
  with check (public.pode_ver_conversa(conversa_id));

drop policy if exists "Equipe atualiza mensagens" on mensagens_conversa;
create policy "Equipe atualiza mensagens"
  on mensagens_conversa for update
  using (public.pode_ver_conversa(conversa_id));

-- ============================================================
-- sugestoes_ia: sugestão de resposta gerada pela IA a partir da conversa,
-- com rastreio de uso pra medir se está ajudando de verdade.
-- ============================================================
create table if not exists sugestoes_ia (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references conversas_whatsapp (id) on delete cascade,
  mensagem_gatilho_id uuid references mensagens_conversa (id) on delete set null,
  sugestao_texto text not null,
  usada boolean not null default false,
  usada_em timestamptz,
  usada_por_colaborador_id uuid references colaboradores (id) on delete set null,
  created_at timestamptz not null default current_timestamp
);

create index if not exists idx_sugestoes_ia_conversa_id on sugestoes_ia (conversa_id);

alter table sugestoes_ia enable row level security;

drop policy if exists "Equipe ve sugestoes" on sugestoes_ia;
create policy "Equipe ve sugestoes"
  on sugestoes_ia for select
  using (public.pode_ver_conversa(conversa_id));

drop policy if exists "Equipe atualiza sugestoes" on sugestoes_ia;
create policy "Equipe atualiza sugestoes"
  on sugestoes_ia for update
  using (public.pode_ver_conversa(conversa_id));

-- Nota: INSERT de sugestoes_ia fica só via service role (n8n gerando a
-- sugestão), por isso não tem policy de insert pra usuário autenticado.

-- ============================================================
-- base_conhecimento_ia: playbook aprovado pelo "Dr." que alimenta o prompt
-- da IA - serviços, objeções comuns, FAQ, glossário de status processual.
-- Leitura liberada pra equipe toda; escrita só pro dono/sócio (é o Dr./gestor
-- quem aprova o conteúdo, não a secretária - mesma fronteira já mapeada antes
-- entre "informar fato" e "dar parecer").
-- ============================================================
create table if not exists base_conhecimento_ia (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  categoria text not null default 'faq',
  topico text not null,
  resposta_aprovada text not null,
  ativo boolean not null default true,
  aprovado_por text,
  created_at timestamptz not null default current_timestamp,
  updated_at timestamptz not null default current_timestamp
);

alter table base_conhecimento_ia drop constraint if exists base_conhecimento_ia_categoria_check;
alter table base_conhecimento_ia add constraint base_conhecimento_ia_categoria_check
  check (categoria in ('servico', 'objecao', 'faq', 'glossario', 'fora_do_escopo'));

create index if not exists idx_base_conhecimento_ia_user_id on base_conhecimento_ia (user_id);
create index if not exists idx_base_conhecimento_ia_categoria on base_conhecimento_ia (categoria);

alter table base_conhecimento_ia enable row level security;

drop policy if exists "Equipe le a base de conhecimento" on base_conhecimento_ia;
create policy "Equipe le a base de conhecimento"
  on base_conhecimento_ia for select
  using (public.sou_equipe_de(user_id));

drop policy if exists "Dono/socio cria conteudo da base" on base_conhecimento_ia;
create policy "Dono/socio cria conteudo da base"
  on base_conhecimento_ia for insert
  with check (public.pode_administrar(user_id));

drop policy if exists "Dono/socio atualiza conteudo da base" on base_conhecimento_ia;
create policy "Dono/socio atualiza conteudo da base"
  on base_conhecimento_ia for update
  using (public.pode_administrar(user_id));

drop policy if exists "Dono/socio exclui conteudo da base" on base_conhecimento_ia;
create policy "Dono/socio exclui conteudo da base"
  on base_conhecimento_ia for delete
  using (public.pode_administrar(user_id));

-- ============================================================
-- colaboradores: papel 'secretaria' já cabe no campo livre existente
-- (colaboradores.papel é text sem check constraint - nenhuma alteração
-- de schema necessária, só convenção de uso no app).
-- ============================================================
