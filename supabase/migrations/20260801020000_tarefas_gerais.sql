-- SEO Local Brasil painel - sócio/gerente também vê e move tarefas gerais
-- (sem responsável atribuído), além das que são só dele.
-- Idempotente: seguro rodar em cima do schema já existente.

drop policy if exists "Usuários podem ver suas tarefas" on tarefas;
create policy "Usuários podem ver suas tarefas"
  on tarefas for select
  using (
    auth.uid() = user_id
    or colaborador_id = public.meu_colaborador_id()
    or (
      colaborador_id is null
      and exists (
        select 1 from colaboradores
        where login_user_id = auth.uid() and papel in ('socio', 'gerente')
      )
    )
  );

drop policy if exists "Usuários podem atualizar suas tarefas" on tarefas;
create policy "Usuários podem atualizar suas tarefas"
  on tarefas for update
  using (
    auth.uid() = user_id
    or colaborador_id = public.meu_colaborador_id()
    or (
      colaborador_id is null
      and exists (
        select 1 from colaboradores
        where login_user_id = auth.uid() and papel in ('socio', 'gerente')
      )
    )
  );
