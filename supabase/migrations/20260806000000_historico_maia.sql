-- Painel APREV - histórico persistente do chat com a Maia. Duas tabelas:
-- conversas_maia (uma linha por conversa) e mensagens_maia (uma linha por
-- mensagem). Mesmo padrão multi-tenant e mesma regra de acesso das outras
-- telas que a equipe toda usa (Funil de Leads, Casos, Conversas WhatsApp):
-- user_id é o "dono" da conta, e sou_equipe_de() libera pra qualquer
-- colaborador vinculado a ele, não só o dono/sócio - já que a aba
-- "Assistente Maia" no menu também é liberada pra equipe toda
-- (roles: ['secretaria'] em Layout.jsx).
--
-- Como nas outras tabelas com sou_equipe_de(), o gatilho
-- normalizar_user_id_trigger NÃO é usado aqui de propósito: o app já
-- resolve o user_id certo (o "dono") client-side via resolveEquipeContext()
-- antes de gravar, igual conversas_whatsapp.
--
-- Idempotente: seguro rodar em cima do schema já existente. Assume que
-- public.sou_equipe_de(uuid) já existe (criada em
-- 20260805000000_crm_whatsapp_ia.sql).

-- ============================================================
-- conversas_maia: uma linha por conversa iniciada com a Maia
-- ============================================================
create table if not exists conversas_maia (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  titulo text,
  created_at timestamptz not null default current_timestamp,
  updated_at timestamptz not null default current_timestamp
);

create index if not exists idx_conversas_maia_user_id on conversas_maia (user_id);
create index if not exists idx_conversas_maia_updated_em on conversas_maia (updated_at desc);

alter table conversas_maia enable row level security;

drop policy if exists "Equipe ve conversas maia" on conversas_maia;
create policy "Equipe ve conversas maia"
  on conversas_maia for select
  using (public.sou_equipe_de(user_id));

drop policy if exists "Equipe cria conversas maia" on conversas_maia;
create policy "Equipe cria conversas maia"
  on conversas_maia for insert
  with check (public.sou_equipe_de(user_id));

drop policy if exists "Equipe atualiza conversas maia" on conversas_maia;
create policy "Equipe atualiza conversas maia"
  on conversas_maia for update
  using (public.sou_equipe_de(user_id));

drop policy if exists "Equipe exclui conversas maia" on conversas_maia;
create policy "Equipe exclui conversas maia"
  on conversas_maia for delete
  using (public.sou_equipe_de(user_id));

-- ============================================================
-- Função auxiliar: o usuário logado pode ver/mexer nessa conversa da Maia?
-- ============================================================
create or replace function public.pode_ver_conversa_maia(p_conversa_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from conversas_maia c
    where c.id = p_conversa_id and public.sou_equipe_de(c.user_id)
  );
$$;

-- ============================================================
-- mensagens_maia: histórico de mensagens (usuário e assistente) de cada
-- conversa. Guarda só o texto - anexos (documento/imagem) não ficam
-- persistidos aqui, só a menção do nome do arquivo no texto da mensagem.
-- ============================================================
create table if not exists mensagens_maia (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references conversas_maia (id) on delete cascade,
  papel text not null,
  conteudo text not null default '',
  created_at timestamptz not null default current_timestamp
);

alter table mensagens_maia drop constraint if exists mensagens_maia_papel_check;
alter table mensagens_maia add constraint mensagens_maia_papel_check
  check (papel in ('user', 'assistant'));

create index if not exists idx_mensagens_maia_conversa_id on mensagens_maia (conversa_id);
create index if not exists idx_mensagens_maia_created_em on mensagens_maia (created_at);

alter table mensagens_maia enable row level security;

drop policy if exists "Equipe ve mensagens maia" on mensagens_maia;
create policy "Equipe ve mensagens maia"
  on mensagens_maia for select
  using (public.pode_ver_conversa_maia(conversa_id));

drop policy if exists "Equipe cria mensagens maia" on mensagens_maia;
create policy "Equipe cria mensagens maia"
  on mensagens_maia for insert
  with check (public.pode_ver_conversa_maia(conversa_id));
