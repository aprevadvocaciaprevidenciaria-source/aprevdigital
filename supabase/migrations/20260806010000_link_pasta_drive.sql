-- Painel APREV - vincula a pasta do Google Drive de cada cliente/caso, pra
-- Maia (tools em pages/api/maia.js) conseguir listar e ler os arquivos do
-- cliente quando pedido na conversa. Guarda o link colado pelo usuário
-- (não só o ID) porque é o que dá pra copiar direto da barra de endereço do
-- Drive - o ID é extraído em runtime (lib/server/googleDrive.js).
-- Idempotente: seguro rodar em cima do schema já existente.

alter table clientes add column if not exists link_pasta_drive text;
