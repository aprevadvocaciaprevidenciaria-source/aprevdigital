-- Campos usados pela calculadora de ROI estimado no Relatório Avançado.
-- ticket_medio: valor médio de venda do cliente (R$), usado pra estimar faturamento.
-- taxa_conversao_estimada: % das interações (chamadas + rotas + cliques no site)
-- que a agência estima que viram cliente de verdade.
alter table clientes add column if not exists ticket_medio numeric;
alter table clientes add column if not exists taxa_conversao_estimada numeric;
