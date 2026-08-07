export const TIPO_BENEFICIO_OPTIONS = [
  { value: 'auxilio-doenca', label: 'Auxílio-doença / Incapacidade temporária' },
  { value: 'aposentadoria-idade', label: 'Aposentadoria por idade' },
  { value: 'aposentadoria-tempo-contribuicao', label: 'Aposentadoria por tempo de contribuição' },
  { value: 'aposentadoria-invalidez', label: 'Aposentadoria por invalidez / Incapacidade permanente' },
  { value: 'pensao-morte', label: 'Pensão por morte' },
  { value: 'bpc-loas', label: 'BPC / LOAS' },
  { value: 'salario-maternidade', label: 'Salário-maternidade' },
  { value: 'revisao-beneficio', label: 'Revisão de benefício' },
]

export function tipoBeneficioLabel(value) {
  return TIPO_BENEFICIO_OPTIONS.find((t) => t.value === value)?.label || value
}
