// Regras de disponibilidade do agendamento online - usado tanto pela API
// pública (pages/api/public/agendamento) quanto espelhado (versão simples,
// em JS puro) no widget embutido em public/embed/agendamento.js, já que o
// widget roda em páginas externas sem acesso a este módulo.

function paraMinutos(horaStr) {
  if (!horaStr) return null
  const [h, m] = String(horaStr).split(':').map(Number)
  return h * 60 + (m || 0)
}

function paraHoraStr(minutos) {
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// Gera os horários possíveis de um dia de funcionamento (sem descontar o
// que já está ocupado - isso é feito à parte, comparando com `ocupados`).
export function gerarSlotsDoDia(cliente) {
  const abertura = paraMinutos(cliente.horario_abertura)
  const fechamento = paraMinutos(cliente.horario_fechamento)
  const almocoInicio = paraMinutos(cliente.intervalo_almoco_inicio)
  const almocoFim = paraMinutos(cliente.intervalo_almoco_fim)
  const duracao = cliente.duracao_padrao_servico || 60

  if (abertura === null || fechamento === null) return []

  const slots = []
  for (let m = abertura; m + duracao <= fechamento; m += duracao) {
    const cruzaAlmoco = almocoInicio !== null && almocoFim !== null && m < almocoFim && m + duracao > almocoInicio
    if (!cruzaAlmoco) slots.push(paraHoraStr(m))
  }
  return slots
}

export function isoWeekday(dataStr) {
  const jsDay = new Date(`${dataStr}T00:00:00Z`).getUTCDay()
  return jsDay === 0 ? 7 : jsDay
}

export function diaEstaAberto(cliente, dataStr) {
  return (cliente.dias_funcionamento || []).includes(isoWeekday(dataStr))
}
