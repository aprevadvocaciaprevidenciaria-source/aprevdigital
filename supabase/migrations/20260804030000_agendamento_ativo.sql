-- SEO Local Brasil painel - trava de venda do agendamento online: só
-- funciona pra clientes com agendamento_ativo = true, marcado manualmente
-- quando o cliente contrata (mesmo padrão do plano_gestao).
alter table clientes add column if not exists agendamento_ativo boolean not null default false;
