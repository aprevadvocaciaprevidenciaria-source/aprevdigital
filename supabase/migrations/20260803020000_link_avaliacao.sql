-- SEO Local Brasil painel - link direto de avaliação do Google (o cliente
-- pega esse link no próprio app do Google Business Profile, em "Compartilhar
-- formulário de avaliação" / "Receber mais avaliações"). É diferente do
-- google_business_id (esse é o ID do local na Business Profile API, não dá
-- pra construir o link de avaliação a partir dele sem chamar a Places API,
-- que é paga - por isso o admin cola o link pronto aqui).
-- Idempotente: seguro rodar em cima do schema já existente.

alter table clientes add column if not exists link_avaliacao text;
