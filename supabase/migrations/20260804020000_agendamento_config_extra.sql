-- SEO Local Brasil painel - campos extras pra tela de configuração do
-- agendamento online (aba Agendamento em Gestão): lista de serviços e cor
-- de destaque do widget, pra gerar o snippet de incorporação já pronto.
-- Idempotente: seguro rodar em cima do schema já existente.

alter table clientes add column if not exists servicos_agendamento text[];
alter table clientes add column if not exists cor_agendamento text not null default '#c9a24b';
