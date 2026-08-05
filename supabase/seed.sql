-- SEO Local Brasil painel - dados de exemplo (seed)
-- Uso: supabase db reset  (roda migrations + este seed automaticamente)
-- ou cole o conteúdo direto no SQL Editor do Supabase após rodar as migrations.
--
-- Associa os dados de exemplo ao primeiro usuário existente em auth.users.

do $$
declare
  v_user_id uuid;
begin
  select id into v_user_id from auth.users order by created_at asc limit 1;

  if v_user_id is null then
    raise notice 'Nenhum usuário encontrado em auth.users - crie uma conta de login antes de rodar o seed.';
    return;
  end if;

  insert into public.users (id, nome, email)
  select v_user_id, coalesce(raw_user_meta_data ->> 'name', email), email
  from auth.users where id = v_user_id
  on conflict (id) do nothing;

  -- ============================================================
  -- clientes
  -- ============================================================
  insert into clientes (id, user_id, nome, contato_nome, contato_whatsapp, contato_email, nicho, plano_valor, status, notas, google_business_id, created_at) values
    ('a0000000-0000-4000-8000-000000000001', v_user_id, 'Padaria Sabor Real', 'Marcos Andrade', '(11) 98211-3344', 'contato@padariasaborreal.com.br', 'Padaria e Confeitaria', 890.00, 'ativo', 'Cliente desde o início do ano, bom relacionamento.', 'demo-padaria-sabor-real', now() - interval '90 days'),
    ('a0000000-0000-4000-8000-000000000002', v_user_id, 'Clínica OdontoVida', 'Dra. Renata Souza', '(11) 97744-5566', 'contato@odontovida.com.br', 'Clínica Odontológica', 1450.00, 'ativo', 'Foco em aumentar avaliações e agendamentos online.', 'demo-odontovida', now() - interval '75 days'),
    ('a0000000-0000-4000-8000-000000000003', v_user_id, 'Academia PowerFit', 'Rafael Nogueira', '(21) 96633-2211', 'atendimento@powerfit.com.br', 'Academia e Fitness', 690.00, 'pendente', 'Aguardando verificação do perfil no Google.', 'demo-powerfit-academia', now() - interval '20 days'),
    ('a0000000-0000-4000-8000-000000000004', v_user_id, 'Salão Beleza & Cia', 'Juliana Prado', '(31) 95522-7788', 'contato@belezaecia.com.br', 'Salão de Beleza', 750.00, 'ativo', 'Cliente engajado, responde rápido às demandas.', 'demo-beleza-e-cia', now() - interval '60 days'),
    ('a0000000-0000-4000-8000-000000000005', v_user_id, 'Auto Peças Silva', 'Eduardo Silva', '(41) 94411-9900', 'vendas@autopecassilva.com.br', 'Autopeças', 590.00, 'inativo', 'Contrato pausado, cliente em férias do serviço.', 'demo-autopecas-silva', now() - interval '150 days'),
    ('a0000000-0000-4000-8000-000000000006', v_user_id, 'Restaurante Sabor Caseiro', 'Patrícia Lima', '(11) 93300-1122', 'contato@saborcaseiro.com.br', 'Restaurante', 980.00, 'pendente', 'Novo cliente, onboarding em andamento.', 'demo-sabor-caseiro', now() - interval '10 days')
  on conflict (id) do nothing;

  -- ============================================================
  -- tarefas
  -- ============================================================
  insert into tarefas (id, user_id, cliente_id, titulo, descricao, status, prioridade, vencimento, created_at) values
    ('b0000000-0000-4000-8000-000000000001', v_user_id, 'a0000000-0000-4000-8000-000000000001', 'Responder avaliações negativas', 'Cliente recebeu 2 avaliações de 2 estrelas essa semana', 'a-fazer', 'alta', current_date + 1, now() - interval '2 days'),
    ('b0000000-0000-4000-8000-000000000002', v_user_id, 'a0000000-0000-4000-8000-000000000001', 'Atualizar fotos do perfil', 'Adicionar fotos novas do interior da padaria', 'em_andamento', 'media', current_date + 5, now() - interval '4 days'),
    ('b0000000-0000-4000-8000-000000000003', v_user_id, 'a0000000-0000-4000-8000-000000000001', 'Configurar horário de feriado', 'Ajustar horário de funcionamento para o feriado', 'concluida', 'baixa', current_date - 3, now() - interval '10 days'),
    ('b0000000-0000-4000-8000-000000000004', v_user_id, 'a0000000-0000-4000-8000-000000000002', 'Publicar post sobre novo tratamento', 'Divulgar o novo serviço de clareamento dental', 'a-fazer', 'media', current_date + 3, now() - interval '1 day'),
    ('b0000000-0000-4000-8000-000000000005', v_user_id, 'a0000000-0000-4000-8000-000000000002', 'Solicitar avaliações de pacientes', 'Enviar link de avaliação para os últimos 20 pacientes', 'em_andamento', 'alta', current_date + 2, now() - interval '3 days'),
    ('b0000000-0000-4000-8000-000000000006', v_user_id, 'a0000000-0000-4000-8000-000000000003', 'Completar cadastro do perfil GBP', 'Finalizar verificação do Google Business Profile', 'a-fazer', 'alta', current_date - 1, now() - interval '6 days'),
    ('b0000000-0000-4000-8000-000000000007', v_user_id, 'a0000000-0000-4000-8000-000000000003', 'Criar promoção de matrícula', 'Divulgar promoção de matrícula sem taxa', 'a-fazer', 'media', current_date + 7, now() - interval '2 days'),
    ('b0000000-0000-4000-8000-000000000008', v_user_id, 'a0000000-0000-4000-8000-000000000004', 'Revisar categorias do perfil', 'Confirmar categorias secundárias no GBP', 'concluida', 'baixa', current_date - 5, now() - interval '12 days'),
    ('b0000000-0000-4000-8000-000000000009', v_user_id, 'a0000000-0000-4000-8000-000000000004', 'Responder mensagens pendentes', '5 mensagens de clientes sem resposta', 'a-fazer', 'alta', current_date, now() - interval '1 day'),
    ('b0000000-0000-4000-8000-000000000010', v_user_id, 'a0000000-0000-4000-8000-000000000005', 'Reativar perfil no Google', 'Cliente inativo, avaliar reativação da conta', 'a-fazer', 'baixa', current_date + 14, now() - interval '20 days'),
    ('b0000000-0000-4000-8000-000000000011', v_user_id, 'a0000000-0000-4000-8000-000000000006', 'Publicar cardápio atualizado', 'Adicionar novos pratos ao perfil', 'em_andamento', 'media', current_date + 4, now() - interval '2 days'),
    ('b0000000-0000-4000-8000-000000000012', v_user_id, 'a0000000-0000-4000-8000-000000000006', 'Configurar respostas automáticas', 'Ativar resposta automática para novas avaliações', 'a-fazer', 'media', current_date + 10, now() - interval '1 day')
  on conflict (id) do nothing;

  -- ============================================================
  -- metricas_gbp (3 últimos meses por cliente)
  -- ============================================================
  insert into metricas_gbp (id, cliente_id, mes, visualizacoes, interacoes, chamadas, rotas, cliques_site, buscas, fonte) values
    -- Padaria Sabor Real
    ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', date_trunc('month', current_date)::date, 6200, 480, 180, 320, 210, 6800, 'manual'),
    ('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', (date_trunc('month', current_date) - interval '1 month')::date, 5800, 440, 165, 295, 190, 6400, 'manual'),
    ('c0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', (date_trunc('month', current_date) - interval '2 months')::date, 5400, 400, 150, 270, 175, 6000, 'manual'),

    -- Clínica OdontoVida
    ('c0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000002', date_trunc('month', current_date)::date, 9800, 720, 410, 140, 520, 10500, 'manual'),
    ('c0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000002', (date_trunc('month', current_date) - interval '1 month')::date, 9200, 690, 385, 130, 490, 9900, 'manual'),
    ('c0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000002', (date_trunc('month', current_date) - interval '2 months')::date, 8600, 650, 360, 120, 460, 9300, 'manual'),

    -- Academia PowerFit
    ('c0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000003', date_trunc('month', current_date)::date, 2600, 190, 75, 110, 90, 2900, 'manual'),
    ('c0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000003', (date_trunc('month', current_date) - interval '1 month')::date, 2400, 170, 68, 100, 82, 2700, 'manual'),
    ('c0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000003', (date_trunc('month', current_date) - interval '2 months')::date, 2200, 155, 60, 92, 75, 2500, 'manual'),

    -- Salão Beleza & Cia
    ('c0000000-0000-4000-8000-000000000010', 'a0000000-0000-4000-8000-000000000004', date_trunc('month', current_date)::date, 4300, 350, 210, 160, 140, 4700, 'manual'),
    ('c0000000-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000004', (date_trunc('month', current_date) - interval '1 month')::date, 4050, 330, 195, 148, 130, 4400, 'manual'),
    ('c0000000-0000-4000-8000-000000000012', 'a0000000-0000-4000-8000-000000000004', (date_trunc('month', current_date) - interval '2 months')::date, 3800, 310, 180, 135, 120, 4100, 'manual'),

    -- Auto Peças Silva (inativo - números baixos)
    ('c0000000-0000-4000-8000-000000000013', 'a0000000-0000-4000-8000-000000000005', date_trunc('month', current_date)::date, 520, 30, 18, 25, 20, 600, 'manual'),
    ('c0000000-0000-4000-8000-000000000014', 'a0000000-0000-4000-8000-000000000005', (date_trunc('month', current_date) - interval '1 month')::date, 560, 34, 20, 28, 22, 650, 'manual'),
    ('c0000000-0000-4000-8000-000000000015', 'a0000000-0000-4000-8000-000000000005', (date_trunc('month', current_date) - interval '2 months')::date, 600, 38, 22, 30, 24, 700, 'manual'),

    -- Restaurante Sabor Caseiro
    ('c0000000-0000-4000-8000-000000000016', 'a0000000-0000-4000-8000-000000000006', date_trunc('month', current_date)::date, 7100, 560, 300, 210, 260, 7600, 'manual'),
    ('c0000000-0000-4000-8000-000000000017', 'a0000000-0000-4000-8000-000000000006', (date_trunc('month', current_date) - interval '1 month')::date, 6700, 530, 280, 195, 240, 7200, 'manual'),
    ('c0000000-0000-4000-8000-000000000018', 'a0000000-0000-4000-8000-000000000006', (date_trunc('month', current_date) - interval '2 months')::date, 6300, 500, 265, 182, 225, 6800, 'manual')
  on conflict (id) do nothing;

end $$;
