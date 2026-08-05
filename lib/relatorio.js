// Lógica pura de agregação de métricas GBP, compartilhada entre o preview manual
// (pages/relatorios.jsx) e o envio automático (pages/api/cron/diario.js).
export function buildTotaisMetricas(metricas) {
  return (metricas || []).reduce(
    (acc, m) => ({
      visualizacoes: acc.visualizacoes + (m.visualizacoes || 0),
      interacoes: acc.interacoes + (m.interacoes || 0),
      chamadas: acc.chamadas + (m.chamadas || 0),
      rotas: acc.rotas + (m.rotas || 0),
      cliques_site: acc.cliques_site + (m.cliques_site || 0),
      buscas: acc.buscas + (m.buscas || 0),
    }),
    { visualizacoes: 0, interacoes: 0, chamadas: 0, rotas: 0, cliques_site: 0, buscas: 0 }
  )
}

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

// Parseia 'YYYY-MM-DD' como UTC pra não sofrer o mesmo problema de fuso horário
// que já corrigimos em outros pontos do painel (ver monthStr/currentMonthStr).
function weekdayFromDateStr(dataStr) {
  return new Date(`${dataStr}T00:00:00Z`).getUTCDay()
}

// Análise avançada de avaliações pro Relatório Avançado: ISR, distribuição por
// nota, crescimento acumulado por mês, taxa de resposta por nota e padrão por
// dia da semana. Tudo calculado só com o que já é lançado em `avaliacoes`.
export function buildAnaliseAvaliacoes(avaliacoes) {
  const lista = avaliacoes || []
  const total = lista.length

  const positivas = lista.filter((a) => a.nota >= 4).length
  const negativas = lista.filter((a) => a.nota <= 2).length
  const neutras = total - positivas - negativas
  const mediaNota = total ? lista.reduce((s, a) => s + a.nota, 0) / total : 0
  const isr = total ? ((positivas - negativas) / total) * 100 : 0
  const comResposta = lista.filter((a) => a.resposta).length
  const comComentario = lista.filter((a) => a.comentario).length
  const taxaResposta = total ? (comResposta / total) * 100 : 0
  const taxaComentario = total ? (comComentario / total) * 100 : 0

  const distribuicaoPorNota = [5, 4, 3, 2, 1].map((nota) => {
    const qtd = lista.filter((a) => a.nota === nota).length
    return { nota, qtd, pct: total ? (qtd / total) * 100 : 0 }
  })

  const porNota = [1, 2, 3, 4, 5].map((nota) => {
    const doNota = lista.filter((a) => a.nota === nota)
    const comComent = doNota.filter((a) => a.comentario)
    const caracteres = comComent.reduce((s, a) => s + a.comentario.length, 0)
    const palavras = comComent.reduce((s, a) => s + a.comentario.trim().split(/\s+/).filter(Boolean).length, 0)
    return {
      nota,
      total: doNota.length,
      comComentario: comComent.length,
      comResposta: doNota.filter((a) => a.resposta).length,
      taxaResposta: doNota.length ? (doNota.filter((a) => a.resposta).length / doNota.length) * 100 : 0,
      mediaCaracteres: comComent.length ? Math.round(caracteres / comComent.length) : 0,
      mediaPalavras: comComent.length ? Math.round(palavras / comComent.length) : 0,
    }
  })

  const porMesMap = {}
  lista.forEach((a) => {
    const mes = (a.data_avaliacao || '').slice(0, 7)
    if (!mes) return
    porMesMap[mes] = (porMesMap[mes] || 0) + 1
  })
  const mesesOrdenados = Object.keys(porMesMap).sort()
  let acumulado = 0
  const porMes = mesesOrdenados.map((mes) => {
    acumulado += porMesMap[mes]
    return { mes, qtd: porMesMap[mes], acumulado }
  })
  const mediaMensal = porMes.length ? porMes.reduce((s, m) => s + m.qtd, 0) / porMes.length : 0
  const melhorMes = porMes.reduce((melhor, m) => (m.qtd > (melhor?.qtd || 0) ? m : melhor), null)

  const porDiaSemanaMap = {}
  lista.forEach((a) => {
    if (!a.data_avaliacao) return
    const dia = weekdayFromDateStr(a.data_avaliacao)
    porDiaSemanaMap[dia] = (porDiaSemanaMap[dia] || 0) + 1
  })
  const porDiaSemana = DIAS_SEMANA.map((label, i) => ({ dia: label, qtd: porDiaSemanaMap[i] || 0 }))

  return {
    total,
    mediaNota,
    isr,
    positivas,
    negativas,
    neutras,
    taxaResposta,
    taxaComentario,
    distribuicaoPorNota,
    porNota,
    porMes,
    mediaMensal,
    melhorMes,
    porDiaSemana,
  }
}

// Análise avançada de métricas GBP pro Relatório Avançado: taxa de interesse,
// distribuição de ações, evolução mensal com variação e melhor mês. Tudo a
// partir dos totais mensais já lançados em `metricas_gbp`.
export function buildAnaliseMetricas(metricas) {
  const lista = [...(metricas || [])].sort((a, b) => a.mes.localeCompare(b.mes))
  const totais = buildTotaisMetricas(lista)
  const taxaInteresse = totais.visualizacoes ? (totais.interacoes / totais.visualizacoes) * 100 : 0

  const distribuicaoAcoes = [
    { tipo: 'Chamadas', valor: totais.chamadas },
    { tipo: 'Solicitações de rota', valor: totais.rotas },
    { tipo: 'Cliques no site', valor: totais.cliques_site },
    { tipo: 'Buscas', valor: totais.buscas },
  ]
  const totalAcoes = distribuicaoAcoes.reduce((s, a) => s + a.valor, 0)
  distribuicaoAcoes.forEach((a) => {
    a.pct = totalAcoes ? (a.valor / totalAcoes) * 100 : 0
  })

  const porMes = lista.map((m, i) => {
    const anterior = lista[i - 1]
    return {
      ...m,
      variacaoVisualizacoes: anterior ? m.visualizacoes - anterior.visualizacoes : null,
    }
  })
  const mediaMensalVisualizacoes = lista.length ? totais.visualizacoes / lista.length : 0
  const melhorMes = lista.reduce((melhor, m) => (m.visualizacoes > (melhor?.visualizacoes || 0) ? m : melhor), null)

  return {
    totais,
    taxaInteresse,
    distribuicaoAcoes,
    porMes,
    mediaMensalVisualizacoes,
    melhorMes,
  }
}

// Estimativa de ROI: quanto das ligações/rotas/cliques no site pode ter virado
// venda de verdade, a partir de premissas que a própria agência define por
// cliente (ticket médio e taxa de conversão estimada). "Buscas" fica de fora
// por não ser uma ação de intenção direta como as outras três.
export function buildEstimativaROI(totais, cliente) {
  const ticketMedio = Number(cliente?.ticket_medio) || 0
  const taxaConversao = Number(cliente?.taxa_conversao_estimada) || 0
  const acoesConsideradas = (totais?.chamadas || 0) + (totais?.rotas || 0) + (totais?.cliques_site || 0)
  const clientesEstimados = acoesConsideradas * (taxaConversao / 100)
  const faturamentoEstimado = clientesEstimados * ticketMedio

  return {
    configurado: ticketMedio > 0 && taxaConversao > 0,
    ticketMedio,
    taxaConversao,
    acoesConsideradas,
    clientesEstimados,
    faturamentoEstimado,
  }
}
