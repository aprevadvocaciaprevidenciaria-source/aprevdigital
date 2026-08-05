-- Painel APREV - Central do Digital: calendário de conteúdo (posts, vídeos,
-- reels) por plataforma, com status de produção (ideia -> roteiro ->
-- gravação -> edição -> agendado -> publicado). Diferente do CRM de
-- WhatsApp, essa seção é só do dono/sócio (o "Dr." pediu explicitamente
-- pra ser só pra ele) - por isso usa pode_administrar(), não
-- sou_equipe_de().
-- Idempotente: seguro rodar em cima do schema já existente.

create table if not exists conteudo_digital (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  tipo text not null default 'post',
  plataforma text not null default 'instagram',
  titulo text not null,
  descricao text,
  status text not null default 'ideia',
  data_prevista date,
  data_publicacao date,
  link_publicado text,
  responsavel_colaborador_id uuid references colaboradores (id) on delete set null,
  created_at timestamptz not null default current_timestamp,
  updated_at timestamptz not null default current_timestamp
);

alter table conteudo_digital drop constraint if exists conteudo_digital_tipo_check;
alter table conteudo_digital add constraint conteudo_digital_tipo_check
  check (tipo in ('post', 'video', 'reels', 'story'));

alter table conteudo_digital drop constraint if exists conteudo_digital_plataforma_check;
alter table conteudo_digital add constraint conteudo_digital_plataforma_check
  check (plataforma in ('instagram', 'google_business', 'tiktok', 'facebook'));

alter table conteudo_digital drop constraint if exists conteudo_digital_status_check;
alter table conteudo_digital add constraint conteudo_digital_status_check
  check (status in ('ideia', 'roteiro', 'gravacao', 'edicao', 'agendado', 'publicado'));

create index if not exists idx_conteudo_digital_user_id on conteudo_digital (user_id);
create index if not exists idx_conteudo_digital_status on conteudo_digital (status);
create index if not exists idx_conteudo_digital_plataforma on conteudo_digital (plataforma);

alter table conteudo_digital enable row level security;

drop policy if exists "Dono/socio ve conteudo digital" on conteudo_digital;
create policy "Dono/socio ve conteudo digital"
  on conteudo_digital for select
  using (public.pode_administrar(user_id));

drop policy if exists "Dono/socio cria conteudo digital" on conteudo_digital;
create policy "Dono/socio cria conteudo digital"
  on conteudo_digital for insert
  with check (public.pode_administrar(user_id));

drop policy if exists "Dono/socio atualiza conteudo digital" on conteudo_digital;
create policy "Dono/socio atualiza conteudo digital"
  on conteudo_digital for update
  using (public.pode_administrar(user_id));

drop policy if exists "Dono/socio exclui conteudo digital" on conteudo_digital;
create policy "Dono/socio exclui conteudo digital"
  on conteudo_digital for delete
  using (public.pode_administrar(user_id));

drop trigger if exists normalizar_user_id_trigger on conteudo_digital;
create trigger normalizar_user_id_trigger before insert on conteudo_digital
  for each row execute function public.normalizar_user_id();
