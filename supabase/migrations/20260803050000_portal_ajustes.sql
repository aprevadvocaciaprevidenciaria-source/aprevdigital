-- SEO Local Brasil painel - ajustes no portal do cliente:
-- 1) cliente pode enviar as próprias fotos (Storage), pro gestor usar como
--    material pra gerar posts;
-- 2) controle de quando um relatório salvo fica visível pro cliente (evita
--    que todo "salvar" enquanto o admin ainda tá testando apareça na hora
--    pro cliente, com hora exata).
-- Idempotente: seguro rodar em cima do schema já existente.

-- O caminho do arquivo já é {user_id_dono}/{cliente_id}/arquivo - essa
-- policy confere que o segundo segmento é o próprio cliente logado, e que
-- o primeiro segmento bate com o dono real daquele cliente (não deixa o
-- cliente escrever em pasta de outro cliente nem inventar um dono).
drop policy if exists "Cliente pode enviar fotos do proprio cliente" on storage.objects;
create policy "Cliente pode enviar fotos do proprio cliente"
  on storage.objects for insert
  with check (
    bucket_id = 'fotos-clientes'
    and public.meu_cliente_id() is not null
    and (storage.foldername(name))[2] = public.meu_cliente_id()::text
    and exists (
      select 1 from clientes
      where id = public.meu_cliente_id()
      and user_id::text = (storage.foldername(name))[1]
    )
  );

-- Default true pra não esconder retroativamente relatórios que o cliente já
-- via; só a partir de agora "Salvar no histórico" grava como rascunho
-- (false) até o admin publicar de propósito.
alter table relatorios add column if not exists visivel_cliente boolean not null default true;
