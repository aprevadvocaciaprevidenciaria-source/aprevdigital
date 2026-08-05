export const STATUS_META = [
  { value: 'ativo', label: 'Ativo', badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', hex: '#10b981' },
  { value: 'pendente', label: 'Pendente', badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500', hex: '#f59e0b' },
  { value: 'pausado', label: 'Pausado', badge: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500', hex: '#a855f7' },
  { value: 'inativo', label: 'Inativo', badge: 'bg-red-100 text-red-700', dot: 'bg-red-500', hex: '#ef4444' },
]

export const STATUS_OPTIONS = STATUS_META.map((s) => s.value)

export function statusMeta(status) {
  return STATUS_META.find((s) => s.value === status) || STATUS_META[1]
}
