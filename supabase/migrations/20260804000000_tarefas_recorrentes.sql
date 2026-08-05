-- SEO Local Brasil painel - checklist recorrente de tarefas pro plano Gestão.
-- O dono cadastra "modelos" de tarefa (diária/semanal/mensal); o cron diário
-- gera a tarefa de verdade pra cada cliente do plano Gestão quando o dia bate.
-- Idempotente: seguro rodar em cima do schema já existente.

create table if not exists tarefa_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  titulo text not null,
  descricao text,
  prioridade text not null default 'media' check (prioridade in ('baixa', 'media', 'alta')),
  periodicidade text not null check (periodicidade in ('diaria', 'semanal', 'mensal')),
  dias_semana int[],
  dia_mes int check (dia_mes between 1 and 28),
  ativo boolean not null default true,
  created_at timestamptz default current_timestamp
);

create index if not exists idx_tarefa_templates_user_id on tarefa_templates (user_id);

alter table tarefa_templates enable row level security;

drop policy if exists "Usuarios podem ver modelos de tarefa" on tarefa_templates;
create policy "Usuarios podem ver modelos de tarefa"
  on tarefa_templates for select
  using (public.pode_administrar(user_id));

drop policy if exists "Usuarios podem criar modelos de tarefa" on tarefa_templates;
create policy "Usuarios podem criar modelos de tarefa"
  on tarefa_templates for insert
  with check (public.pode_administrar(user_id));

drop policy if exists "Usuarios podem atualizar modelos de tarefa" on tarefa_templates;
create policy "Usuarios podem atualizar modelos de tarefa"
  on tarefa_templates for update
  using (public.pode_administrar(user_id));

drop policy if exists "Usuarios podem excluir modelos de tarefa" on tarefa_templates;
create policy "Usuarios podem excluir modelos de tarefa"
  on tarefa_templates for delete
  using (public.pode_administrar(user_id));

drop trigger if exists normalizar_user_id_trigger on tarefa_templates;
create trigger normalizar_user_id_trigger
  before insert on tarefa_templates
  for each row execute function public.normalizar_user_id();

-- Vínculo da tarefa gerada de volta pro modelo que a originou - usado pelo
-- cron pra não duplicar a mesma tarefa recorrente no mesmo dia.
alter table tarefas add column if not exists template_id uuid references tarefa_templates (id) on delete set null;
create index if not exists idx_tarefas_template_id on tarefas (template_id);
