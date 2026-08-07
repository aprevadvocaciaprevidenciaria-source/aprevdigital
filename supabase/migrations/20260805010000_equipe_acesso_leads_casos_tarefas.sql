-- Painel APREV - dá acesso de equipe (qualquer colaborador vinculado ao
-- dono, não só sócio) pras telas que as secretárias agora usam no dia a
-- dia: Funil de Leads, Casos (clientes) e Tarefas. Até aqui essas 3 tabelas
-- só liberavam pode_administrar() (dono ou sócio) - uma secretária comum
-- não enxergava lead nenhum e só via tarefa/cliente atrelado à própria
-- tarefa. Agora usa sou_equipe_de() (mesma função já usada pelo CRM de
-- WhatsApp), então qualquer colaborador da equipe vê e edita tudo que é
-- do dono. Exclusão continua restrita (dono em clientes/leads, dono+sócio
-- em tarefas) - política original preservada de propósito.
-- Idempotente: seguro rodar em cima do schema já existente.

-- ============================================================
-- normalizar_user_id: antes só corrigia o user_id quando quem inseria era
-- sócio. Agora qualquer colaborador (inclusive secretária) que criar um
-- lead/caso/tarefa direto pelo painel tem o registro atribuído ao dono da
-- conta, não a si mesmo - senão o dono/outra secretária não veria o que
-- foi criado (ver nota em 20260805000000_crm_whatsapp_ia.sql).
-- ============================================================
create or replace function public.normalizar_user_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  dono uuid;
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  select user_id into dono from colaboradores where login_user_id = auth.uid() limit 1;
  if dono is not null then
    new.user_id := dono;
  else
    new.user_id := auth.uid();
  end if;
  return new;
end;
$$;

-- ============================================================
-- leads_manuais: select/insert/update liberado pra equipe toda. Delete
-- continua só pode_administrar() (dono ou sócio).
-- ============================================================
drop policy if exists "Usuarios podem ver seus leads" on leads_manuais;
create policy "Usuarios podem ver seus leads"
  on leads_manuais for select
  using (public.sou_equipe_de(user_id));

drop policy if exists "Usuarios podem criar leads" on leads_manuais;
create policy "Usuarios podem criar leads"
  on leads_manuais for insert
  with check (public.sou_equipe_de(user_id));

drop policy if exists "Usuarios podem atualizar seus leads" on leads_manuais;
create policy "Usuarios podem atualizar seus leads"
  on leads_manuais for update
  using (public.sou_equipe_de(user_id));

-- delete: mantém pode_administrar() (política já existente, não mexida aqui)

-- ============================================================
-- clientes (casos): select/insert/update liberado pra equipe toda. Mantém
-- o acesso do cliente-portal (meu_cliente_id) e a exclusão restrita ao
-- dono (política de delete original, não mexida aqui).
-- ============================================================
drop policy if exists "Usuários podem ver seus clientes" on clientes;
create policy "Usuários podem ver seus clientes"
  on clientes for select
  using (public.sou_equipe_de(user_id) or id = public.meu_cliente_id());

drop policy if exists "Usuários podem criar clientes" on clientes;
create policy "Usuários podem criar clientes"
  on clientes for insert
  with check (public.sou_equipe_de(user_id));

drop policy if exists "Usuários podem atualizar seus clientes" on clientes;
create policy "Usuários podem atualizar seus clientes"
  on clientes for update
  using (public.sou_equipe_de(user_id));

-- ============================================================
-- tarefas: select/insert/update liberado pra equipe toda (antes cada
-- colaborador via só a própria tarefa atribuída). Delete continua
-- restrita (política de delete original, não mexida aqui).
-- ============================================================
drop policy if exists "Usuários podem ver suas tarefas" on tarefas;
create policy "Usuários podem ver suas tarefas"
  on tarefas for select
  using (public.sou_equipe_de(user_id));

drop policy if exists "Usuários podem criar tarefas" on tarefas;
create policy "Usuários podem criar tarefas"
  on tarefas for insert
  with check (public.sou_equipe_de(user_id));

drop policy if exists "Usuários podem atualizar suas tarefas" on tarefas;
create policy "Usuários podem atualizar suas tarefas"
  on tarefas for update
  using (public.sou_equipe_de(user_id));
