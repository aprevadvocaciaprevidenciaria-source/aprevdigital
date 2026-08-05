import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase env vars ausentes. Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY em .env.local'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

/*
Tabelas Supabase usadas por este painel (RLS habilitado em todas):

users
  id uuid pk references auth.users(id)   -- criado automaticamente via trigger no signup
  nome text
  email text
  avatar_url text

clientes
  id uuid pk default gen_random_uuid()
  user_id uuid references users(id)      -- dono do cliente (agência/usuário logado)
  nome text                              -- nome da empresa
  cnpj text
  endereco text
  cidade text
  telefone text                          -- telefone comercial
  email_comercial text                   -- e-mail comercial (distinto do e-mail do contato)
  data_inicio_contrato date
  contato_nome text
  contato_whatsapp text
  contato_email text
  nicho text                             -- categoria do negócio
  plano_valor numeric
  status text default 'ativo'            -- 'ativo' | 'pendente' | 'pausado' | 'inativo'
  dia_vencimento int                     -- dia do mês (1-31) de vencimento do plano
  notas text                             -- observações gerais
  google_business_id text
  created_at timestamptz
  updated_at timestamptz

tarefas
  id uuid pk default gen_random_uuid()
  user_id uuid references users(id)
  cliente_id uuid references clientes(id)
  titulo text
  descricao text
  status text default 'a-fazer'          -- 'a-fazer' | 'em_andamento' | 'concluida'
  prioridade text default 'media'        -- 'baixa' | 'media' | 'alta'
  vencimento date
  subtarefas jsonb default '[]'          -- checklist: [{ id, titulo, concluida }]
  created_at timestamptz

colaboradores (sócios/equipe cadastrados pelo usuário dono da conta, sem login próprio)
  id uuid pk default gen_random_uuid()
  user_id uuid references users(id)
  nome text
  email text
  papel text default 'colaborador'       -- 'socio' | 'gerente' | 'colaborador'
  created_at timestamptz

metricas_gbp (métricas mensais do Google Business Profile por cliente)
  id uuid pk default gen_random_uuid()
  cliente_id uuid references clientes(id)
  mes date                               -- primeiro dia do mês de referência
  visualizacoes int
  interacoes int
  chamadas int
  rotas int
  cliques_site int
  buscas int
  fonte text default 'manual'

relatorios (snapshots de relatório - reservado para uso futuro)
  id uuid pk default gen_random_uuid()
  user_id uuid references users(id)
  cliente_id uuid references clientes(id)
  tipo text default 'gbp'
  mes date
  dados jsonb
  status text default 'rascunho'

automacao_config (1 linha por usuário/agência - configura os disparos automáticos de WhatsApp)
  user_id uuid pk references users(id)
  relatorio_mensal_ativo boolean
  relatorio_mensal_dia int                -- dia do mês (1-31) de envio do relatório
  cobranca_ativa boolean
  cobranca_dias_antecedencia int          -- 0 = no dia do vencimento, N = N dias antes
  cobranca_template text
  imagens_ativa boolean
  imagens_dias_semana int[]               -- 1=segunda .. 7=domingo
  imagens_qtd_minima int
  imagens_template text
  relatorio_template text
  updated_at timestamptz

mensagens_fila (fila/log de mensagens automáticas de WhatsApp)
  id uuid pk default gen_random_uuid()
  user_id uuid references users(id)
  cliente_id uuid references clientes(id)
  tipo text                              -- 'cobranca' | 'relatorio_mensal' | 'solicitacao_imagens'
  mensagem text
  status text default 'pendente'         -- 'pendente' | 'enviado' | 'cancelado' | 'erro'
  agendado_para date
  enviado_em timestamptz
  erro_detalhe text
  created_at timestamptz

fotos_clientes (galeria de fotos por cliente, upload manual - Storage bucket 'fotos-clientes')
  id uuid pk default gen_random_uuid()
  user_id uuid references users(id)
  cliente_id uuid references clientes(id)
  path text                              -- caminho no Storage: {user_id}/{cliente_id}/arquivo
  categoria text default 'semanal'       -- 'semanal' | 'visita_mensal'
  descricao text
  created_at timestamptz

Automações WhatsApp (WAME) - requer variáveis de ambiente só de servidor (NUNCA prefixo NEXT_PUBLIC_):
  WAME_API_KEY, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET
  Ver lib/server/whatsapp.js e pages/api/cron/diario.js
*/
