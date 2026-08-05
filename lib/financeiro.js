// Helpers do módulo Financeiro, compartilhados entre a tela /financeiro e o
// gerador de mensalidades (usado tanto pelo botão manual quanto pelo cron
// diário). Sem nada server-only aqui.

export const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export function mesReferenciaStr(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`
}

export function mesLabel(date) {
  return `${MESES[date.getUTCMonth()]}/${date.getUTCFullYear()}`
}

export const SUGESTOES_DESCRICAO = [
  'Criação de perfil',
  'Otimização de perfil',
  'Consultoria avulsa',
  'Design de posts',
  'Gestão de anúncios',
]

export const STATUS_META = {
  pago: { label: 'Pago', className: 'bg-emerald-100 text-emerald-700' },
  pendente: { label: 'Pendente', className: 'bg-amber-100 text-amber-700' },
  atrasado: { label: 'Atrasado', className: 'bg-red-100 text-red-700' },
}

// "Atrasado" não é um valor gravado no banco - é "pendente" cuja data já
// passou. Evita ter que manter um status desatualizado com um cron.
export function statusExibido(lancamento) {
  if (lancamento.status === 'pago') return 'pago'
  const hoje = new Date().toISOString().slice(0, 10)
  return lancamento.data < hoje ? 'atrasado' : 'pendente'
}
