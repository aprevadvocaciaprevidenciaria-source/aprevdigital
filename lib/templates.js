import { formatCurrency, formatDate } from './format'

// Substitui placeholders {{chave}} de um template pelos dados fornecidos.
// Usado tanto no preview (client) quanto no envio automático (server/cron).
export function applyTemplate(template, data) {
  return String(template || '').replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = data[key]
    return value === undefined || value === null || value === '' ? `{{${key}}}` : String(value)
  })
}

export function clienteTemplateData(cliente, extra = {}) {
  return {
    empresa: cliente.nome || '',
    contato: cliente.contato_nome || cliente.nome || '',
    cidade: cliente.cidade || '',
    nicho: cliente.nicho || '',
    valor: formatCurrency(cliente.plano_valor),
    vencimento: cliente.dia_vencimento ? `dia ${cliente.dia_vencimento}` : formatDate(cliente.data_inicio_contrato),
    ...extra,
  }
}

export function leadTemplateData(lead, extra = {}) {
  return {
    nome: lead.nome || '',
    empresa: lead.empresa || '',
    ...extra,
  }
}
