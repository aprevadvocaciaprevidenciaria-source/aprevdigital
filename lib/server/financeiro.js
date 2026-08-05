import { mesReferenciaStr, mesLabel } from '../financeiro'

// Gera lançamentos de mensalidade (origem 'mensalidade') pros clientes
// ativos com plano_valor definido, um por cliente/mês. Usa upsert com
// ignoreDuplicates pra ser seguro de rodar mais de uma vez no mesmo mês
// (o índice único é em cliente_id + mes_referencia). Chamado tanto pela
// rota manual /api/financeiro/gerar-mensalidades quanto pelo cron diário
// (no dia de vencimento de cada cliente).
export async function gerarMensalidadesDoMes(supabaseClient, { userId, clientes, referencia }) {
  const mesReferencia = mesReferenciaStr(referencia)
  const label = mesLabel(referencia)
  const ano = referencia.getUTCFullYear()
  const mes = referencia.getUTCMonth()
  const ultimoDiaDoMes = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate()

  const elegiveis = (clientes || []).filter(
    (c) => c.status === 'ativo' && c.plano_valor && Number(c.plano_valor) > 0
  )
  if (elegiveis.length === 0) return { geradas: 0 }

  const linhas = elegiveis.map((c) => {
    // Usa o dia de vencimento do próprio cliente (clampado ao último dia do
    // mês, pra meses mais curtos); sem dia_vencimento cadastrado, cai no
    // dia 1 como padrão.
    const dia = Math.min(c.dia_vencimento || 1, ultimoDiaDoMes)
    const data = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
    return {
      user_id: userId,
      cliente_id: c.id,
      descricao: `Mensalidade - ${label}`,
      valor: c.plano_valor,
      data,
      status: 'pendente',
      origem: 'mensalidade',
      mes_referencia: mesReferencia,
    }
  })

  const { data, error } = await supabaseClient
    .from('financeiro_lancamentos')
    .upsert(linhas, { onConflict: 'cliente_id,mes_referencia', ignoreDuplicates: true })
    .select('id')

  if (error) throw error
  return { geradas: (data || []).length }
}
