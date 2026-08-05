-- SEO Local Brasil painel - data de fim do contrato do cliente, exibida
-- pro próprio cliente no portal dele.
-- Idempotente: seguro rodar em cima do schema já existente.

alter table clientes add column if not exists data_fim_contrato date;
