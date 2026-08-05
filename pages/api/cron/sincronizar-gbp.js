import { createClient } from '@supabase/supabase-js'
import { getValidAccessToken } from '../../../lib/server/googleAuth'
import { sendPushToCliente } from '../../../lib/server/push'

// Sincroniza métricas e avaliações do Google Business Profile pros clientes
// que já têm `google_business_id` preenchido (o resource name da location,
// ex: "locations/1234567890").
//
// IMPORTANTE: as duas chamadas marcadas com TODO abaixo ainda não foram
// validadas contra a API real do Google, porque isso exige acesso aprovado
// (que está em andamento). A estrutura (autenticação, iteração de clientes,
// gravação no banco, tratamento de erro) já está pronta - falta só conferir
// o formato exato de request/response de cada endpoint assim que tivermos
// uma conexão de verdade pra testar, e ajustar os dois trechos marcados.
export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Não autorizado.' })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada.' })
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const resumo = { usuarios_processados: 0, clientes_processados: 0, metricas_sincronizadas: 0, avaliacoes_novas: 0, erros: 0 }

  const { data: conexoes } = await supabaseAdmin
    .from('google_oauth_tokens')
    .select('user_id')
    .eq('status', 'conectado')

  for (const conexao of conexoes || []) {
    const accessToken = await getValidAccessToken(supabaseAdmin, conexao.user_id)
    if (!accessToken) {
      resumo.erros += 1
      continue
    }
    resumo.usuarios_processados += 1

    const { data: clientes } = await supabaseAdmin
      .from('clientes')
      .select('id, google_business_id')
      .eq('user_id', conexao.user_id)
      .not('google_business_id', 'is', null)

    for (const cliente of clientes || []) {
      resumo.clientes_processados += 1
      try {
        await sincronizarMetricas(supabaseAdmin, accessToken, cliente)
        resumo.metricas_sincronizadas += 1
      } catch (err) {
        resumo.erros += 1
      }

      try {
        const novas = await sincronizarAvaliacoes(supabaseAdmin, accessToken, cliente)
        resumo.avaliacoes_novas += novas
        if (novas > 0) {
          await sendPushToCliente(supabaseAdmin, cliente.id, {
            title: novas === 1 ? 'Nova avaliação recebida! ⭐' : `${novas} novas avaliações recebidas! ⭐`,
            body: 'Confira no portal o que seus clientes estão dizendo no Google.',
            url: '/portal',
          }).catch(() => {})
        }
      } catch (err) {
        resumo.erros += 1
      }
    }
  }

  return res.status(200).json({ ok: true, ...resumo })
}

async function sincronizarMetricas(supabaseAdmin, accessToken, cliente) {
  // TODO: validar contra a API real assim que tivermos acesso aprovado.
  // Endpoint: Business Profile Performance API
  //   POST https://businessprofileperformance.googleapis.com/v1/{cliente.google_business_id}:fetchMultiDailyMetricsTimeSeries
  //   Métricas de interesse: CALL_CLICKS, BUSINESS_DIRECTION_REQUESTS,
  //   WEBSITE_CLICKS, e as de impressão/visualização (BUSINESS_IMPRESSIONS_*).
  //   Precisa somar por mês a partir da série diária que a API devolve.
  const res = await fetch(
    `https://businessprofileperformance.googleapis.com/v1/${cliente.google_business_id}:fetchMultiDailyMetricsTimeSeries` +
      '?dailyMetrics=CALL_CLICKS&dailyMetrics=BUSINESS_DIRECTION_REQUESTS&dailyMetrics=WEBSITE_CLICKS',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!res.ok) {
    throw new Error(`Performance API retornou ${res.status}`)
  }
  const data = await res.json()

  // TODO: mapear `data` (formato ainda não validado) pro shape que
  // metricas_gbp espera e fazer o upsert:
  // await supabaseAdmin.from('metricas_gbp').upsert({
  //   cliente_id: cliente.id,
  //   mes: primeiroDiaDoMesAtual,
  //   visualizacoes, chamadas, rotas, cliques_site,
  //   fonte: 'api',
  // }, { onConflict: 'cliente_id,mes' })
}

async function sincronizarAvaliacoes(supabaseAdmin, accessToken, cliente) {
  // TODO: validar contra a API real assim que tivermos acesso aprovado.
  // Endpoint (My Business Business Information / Reviews):
  //   GET https://mybusiness.googleapis.com/v4/{cliente.google_business_id}/reviews
  const res = await fetch(`https://mybusiness.googleapis.com/v4/${cliente.google_business_id}/reviews`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    throw new Error(`Reviews API retornou ${res.status}`)
  }
  const data = await res.json()
  const reviews = data.reviews || []

  let novas = 0
  for (const review of reviews) {
    const { error, data: inserted } = await supabaseAdmin
      .from('avaliacoes')
      .insert({
        user_id: cliente.user_id,
        cliente_id: cliente.id,
        autor: review.reviewer?.displayName || 'Anônimo',
        // TODO: `starRating` vem como enum de texto (ex: "FIVE") na v4 -
        // converter pra número 1-5 antes de gravar.
        nota: 5,
        comentario: review.comment || null,
        data_avaliacao: (review.createTime || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
        google_review_id: review.reviewId,
        fonte: 'api',
      })
      .select('id')
      .maybeSingle()
    // Duplicata (google_review_id já existe) cai aqui e é ignorada de propósito.
    if (!error && inserted) novas += 1
  }
  return novas
}
