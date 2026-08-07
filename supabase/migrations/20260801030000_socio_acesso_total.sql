-- SEO Local Brasil painel - sócio tem acesso igual ao dono em quase tudo
-- (exceção: excluir cliente continua só o dono).
-- Idempotente: seguro rodar em cima do schema já existente.

-- ============================================================
-- Função auxiliar: o usuário logado administra os dados desse "dono"?
-- (é o próprio dono, ou é um colaborador com papel = 'socio' ligado a ele)
-- ============================================================
create or replace function public.pode_administrar(dono_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select dono_id = auth.uid() or exists (
    select 1 from colaboradores
    where user_id = dono_id and login_user_id = auth.uid() and papel = 'socio'
  );
$$;

-- ============================================================
-- Trigger: quando um sócio insere/atualiza uma linha, o dado precisa
-- ficar sob o mesmo "dono" (user_id) da agência, não sob o próprio id
-- do sócio - senão o dono não enxergaria o que o sócio criou. A service
-- role (rotas administradas, ex. convite, cron) já manda o user_id
-- certo e não é afetada por esse gatilho.
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

  select user_id into dono from colaboradores where login_user_id = auth.uid() and papel = 'socio' limit 1;
  if dono is not null then
    new.user_id := dono;
  else
    new.user_id := auth.uid();
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'clientes', 'tarefas', 'colaboradores', 'leads_manuais', 'avaliacoes',
    'rankings_local', 'fotos_clientes', 'relatorios', 'mensagens_fila',
    'automacao_config'
  ]
  loop
    execute format('drop trigger if exists normalizar_user_id_trigger on %1$s', t);
    execute format(
      'create trigger normalizar_user_id_trigger before insert on %1$s for each row execute function public.normalizar_user_id()',
      t
    );
  end loop;
end $$;

-- ============================================================
-- clientes: sócio tem acesso igual ao dono, MENOS excluir.
-- ============================================================
drop policy if exists "Usuários podem ver seus clientes" on clientes;
create policy "Usuários podem ver seus clientes"
  on clientes for select
  using (
    public.pode_administrar(user_id)
    or id = public.meu_cliente_id()
    or id in (select cliente_id from tarefas where colaborador_id = public.meu_colaborador_id())
  );

drop policy if exists "Usuários podem criar clientes" on clientes;
create policy "Usuários podem criar clientes"
  on clientes for insert
  with check (public.pode_administrar(user_id));

drop policy if exists "Usuários podem atualizar seus clientes" on clientes;
create policy "Usuários podem atualizar seus clientes"
  on clientes for update
  using (public.pode_administrar(user_id));

-- delete: propositalmente NÃO estendido - só o dono (auth.uid() = user_id)
-- continua podendo excluir cliente. Política original permanece intacta.

-- ============================================================
-- tarefas
-- ============================================================
drop policy if exists "Usuários podem ver suas tarefas" on tarefas;
create policy "Usuários podem ver suas tarefas"
  on tarefas for select
  using (
    public.pode_administrar(user_id)
    or colaborador_id = public.meu_colaborador_id()
    or (
      colaborador_id is null
      and exists (select 1 from colaboradores where login_user_id = auth.uid() and papel in ('socio', 'gerente'))
    )
  );

drop policy if exists "Usuários podem criar tarefas" on tarefas;
create policy "Usuários podem criar tarefas"
  on tarefas for insert
  with check (public.pode_administrar(user_id));

drop policy if exists "Usuários podem atualizar suas tarefas" on tarefas;
create policy "Usuários podem atualizar suas tarefas"
  on tarefas for update
  using (
    public.pode_administrar(user_id)
    or colaborador_id = public.meu_colaborador_id()
    or (
      colaborador_id is null
      and exists (select 1 from colaboradores where login_user_id = auth.uid() and papel in ('socio', 'gerente'))
    )
  );

drop policy if exists "Usuários podem excluir suas tarefas" on tarefas;
create policy "Usuários podem excluir suas tarefas"
  on tarefas for delete
  using (public.pode_administrar(user_id));

-- ============================================================
-- colaboradores
-- ============================================================
drop policy if exists "Usuários podem ver seus colaboradores" on colaboradores;
create policy "Usuários podem ver seus colaboradores"
  on colaboradores for select
  using (public.pode_administrar(user_id) or login_user_id = auth.uid());

drop policy if exists "Usuários podem criar colaboradores" on colaboradores;
create policy "Usuários podem criar colaboradores"
  on colaboradores for insert
  with check (public.pode_administrar(user_id));

drop policy if exists "Usuários podem atualizar seus colaboradores" on colaboradores;
create policy "Usuários podem atualizar seus colaboradores"
  on colaboradores for update
  using (public.pode_administrar(user_id));

drop policy if exists "Usuários podem excluir seus colaboradores" on colaboradores;
create policy "Usuários podem excluir seus colaboradores"
  on colaboradores for delete
  using (public.pode_administrar(user_id));

-- ============================================================
-- metricas_gbp (posse via clientes.user_id, não tem user_id próprio)
-- ============================================================
drop policy if exists "Usuários podem ver métricas de seus clientes" on metricas_gbp;
create policy "Usuários podem ver métricas de seus clientes"
  on metricas_gbp for select
  using (
    cliente_id in (select id from clientes where public.pode_administrar(user_id))
    or cliente_id = public.meu_cliente_id()
  );

drop policy if exists "Usuários podem criar métricas de seus clientes" on metricas_gbp;
create policy "Usuários podem criar métricas de seus clientes"
  on metricas_gbp for insert
  with check (cliente_id in (select id from clientes where public.pode_administrar(user_id)));

drop policy if exists "Usuários podem atualizar métricas de seus clientes" on metricas_gbp;
create policy "Usuários podem atualizar métricas de seus clientes"
  on metricas_gbp for update
  using (cliente_id in (select id from clientes where public.pode_administrar(user_id)));

drop policy if exists "Usuários podem excluir métricas de seus clientes" on metricas_gbp;
create policy "Usuários podem excluir métricas de seus clientes"
  on metricas_gbp for delete
  using (cliente_id in (select id from clientes where public.pode_administrar(user_id)));

-- ============================================================
-- relatorios
-- ============================================================
drop policy if exists "Usuários podem ver seus relatórios" on relatorios;
create policy "Usuários podem ver seus relatórios"
  on relatorios for select
  using (public.pode_administrar(user_id) or cliente_id = public.meu_cliente_id());

drop policy if exists "Usuários podem criar relatórios" on relatorios;
create policy "Usuários podem criar relatórios"
  on relatorios for insert
  with check (public.pode_administrar(user_id));

drop policy if exists "Usuários podem atualizar seus relatórios" on relatorios;
create policy "Usuários podem atualizar seus relatórios"
  on relatorios for update
  using (public.pode_administrar(user_id));

drop policy if exists "Usuários podem excluir seus relatórios" on relatorios;
create policy "Usuários podem excluir seus relatórios"
  on relatorios for delete
  using (public.pode_administrar(user_id));

-- ============================================================
-- avaliacoes
-- ============================================================
drop policy if exists "Usuarios podem ver suas avaliacoes" on avaliacoes;
create policy "Usuarios podem ver suas avaliacoes"
  on avaliacoes for select
  using (public.pode_administrar(user_id) or cliente_id = public.meu_cliente_id());

drop policy if exists "Usuarios podem criar avaliacoes" on avaliacoes;
create policy "Usuarios podem criar avaliacoes"
  on avaliacoes for insert
  with check (public.pode_administrar(user_id));

drop policy if exists "Usuarios podem atualizar avaliacoes" on avaliacoes;
create policy "Usuarios podem atualizar avaliacoes"
  on avaliacoes for update
  using (public.pode_administrar(user_id));

drop policy if exists "Usuarios podem excluir avaliacoes" on avaliacoes;
create policy "Usuarios podem excluir avaliacoes"
  on avaliacoes for delete
  using (public.pode_administrar(user_id));

-- ============================================================
-- rankings_local
-- ============================================================
drop policy if exists "Usuarios podem ver seus rankings" on rankings_local;
create policy "Usuarios podem ver seus rankings"
  on rankings_local for select
  using (public.pode_administrar(user_id) or cliente_id = public.meu_cliente_id());

drop policy if exists "Usuarios podem criar rankings" on rankings_local;
create policy "Usuarios podem criar rankings"
  on rankings_local for insert
  with check (public.pode_administrar(user_id));

drop policy if exists "Usuarios podem excluir rankings" on rankings_local;
create policy "Usuarios podem excluir rankings"
  on rankings_local for delete
  using (public.pode_administrar(user_id));

-- ============================================================
-- fotos_clientes
-- ============================================================
drop policy if exists "Usuários podem ver suas fotos" on fotos_clientes;
create policy "Usuários podem ver suas fotos"
  on fotos_clientes for select
  using (public.pode_administrar(user_id) or cliente_id = public.meu_cliente_id());

drop policy if exists "Usuários podem enviar fotos" on fotos_clientes;
create policy "Usuários podem enviar fotos"
  on fotos_clientes for insert
  with check (public.pode_administrar(user_id));

drop policy if exists "Usuários podem excluir suas fotos" on fotos_clientes;
create policy "Usuários podem excluir suas fotos"
  on fotos_clientes for delete
  using (public.pode_administrar(user_id));

-- ============================================================
-- automacao_config
-- ============================================================
drop policy if exists "Usuários podem ver sua configuração de automação" on automacao_config;
create policy "Usuários podem ver sua configuração de automação"
  on automacao_config for select
  using (public.pode_administrar(user_id));

drop policy if exists "Usuários podem criar sua configuração de automação" on automacao_config;
create policy "Usuários podem criar sua configuração de automação"
  on automacao_config for insert
  with check (public.pode_administrar(user_id));

drop policy if exists "Usuários podem atualizar sua configuração de automação" on automacao_config;
create policy "Usuários podem atualizar sua configuração de automação"
  on automacao_config for update
  using (public.pode_administrar(user_id));

-- ============================================================
-- mensagens_fila
-- ============================================================
drop policy if exists "Usuários podem ver suas mensagens" on mensagens_fila;
create policy "Usuários podem ver suas mensagens"
  on mensagens_fila for select
  using (public.pode_administrar(user_id));

drop policy if exists "Usuários podem criar mensagens" on mensagens_fila;
create policy "Usuários podem criar mensagens"
  on mensagens_fila for insert
  with check (public.pode_administrar(user_id));

drop policy if exists "Usuários podem atualizar suas mensagens" on mensagens_fila;
create policy "Usuários podem atualizar suas mensagens"
  on mensagens_fila for update
  using (public.pode_administrar(user_id));

drop policy if exists "Usuários podem excluir suas mensagens" on mensagens_fila;
create policy "Usuários podem excluir suas mensagens"
  on mensagens_fila for delete
  using (public.pode_administrar(user_id));

-- ============================================================
-- leads_manuais
-- ============================================================
drop policy if exists "Usuarios podem ver seus leads" on leads_manuais;
create policy "Usuarios podem ver seus leads"
  on leads_manuais for select
  using (public.pode_administrar(user_id));

drop policy if exists "Usuarios podem criar leads" on leads_manuais;
create policy "Usuarios podem criar leads"
  on leads_manuais for insert
  with check (public.pode_administrar(user_id));

drop policy if exists "Usuarios podem atualizar seus leads" on leads_manuais;
create policy "Usuarios podem atualizar seus leads"
  on leads_manuais for update
  using (public.pode_administrar(user_id));

drop policy if exists "Usuarios podem excluir seus leads" on leads_manuais;
create policy "Usuarios podem excluir seus leads"
  on leads_manuais for delete
  using (public.pode_administrar(user_id));
