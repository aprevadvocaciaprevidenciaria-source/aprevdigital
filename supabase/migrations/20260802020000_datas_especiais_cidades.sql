-- SEO Local Brasil painel - permite restringir uma data especial a
-- cidade(s)/região(ões) específicas, já que feriado municipal ou evento
-- local não vale pra todos os clientes se a agência atender mais de uma
-- cidade. Idempotente: seguro rodar em cima do schema já existente.

alter table datas_especiais add column if not exists cidades text;

comment on column datas_especiais.cidades is
  'Lista de cidades separadas por vírgula em que essa data se aplica (ex: "Parnaíba, Luís Correia"). Vazio/nulo = vale pra todas as cidades.';
