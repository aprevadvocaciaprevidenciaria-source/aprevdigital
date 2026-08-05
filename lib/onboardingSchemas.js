// Definição dos campos dos formulários de onboarding (Criação / Otimização de
// perfil). Usado tanto pela página pública que o cliente preenche
// (pages/onboarding/[clienteId]/[tipo].jsx) quanto pela tela do admin que
// mostra as respostas recebidas (pages/clientes/[id].jsx), pra manter os
// rótulos dos campos sempre iguais nos dois lugares.
export const ONBOARDING_SCHEMAS = {
  criacao: {
    title: 'Formulário de criação de perfil',
    intro: 'Preencha as informações abaixo pra criarmos o perfil do seu negócio no Google Maps do jeito certo.',
    fields: [
      { key: 'nome_negocio', label: 'Nome oficial do negócio', type: 'text', required: true },
      { key: 'categoria_principal', label: 'Categoria principal (ex: Pizzaria, Salão de beleza)', type: 'text', required: true },
      { key: 'categorias_secundarias', label: 'Outras categorias (opcional)', type: 'text' },
      { key: 'endereco_completo', label: 'Endereço completo (rua, número, bairro)', type: 'text', required: true },
      { key: 'cidade', label: 'Cidade', type: 'text', required: true },
      { key: 'cep', label: 'CEP', type: 'text' },
      {
        key: 'tipo_atendimento',
        label: 'Você atende clientes no seu endereço, ou atende em área de entrega/serviço externo?',
        type: 'radio',
        options: ['Atendo no meu endereço', 'Atendo em área de entrega/serviço', 'As duas opções'],
        required: true,
      },
      { key: 'telefone', label: 'Telefone', type: 'text', required: true },
      { key: 'whatsapp', label: 'WhatsApp (se for diferente do telefone)', type: 'text' },
      { key: 'site', label: 'Site (se tiver)', type: 'text' },
      {
        key: 'horarios',
        label: 'Horário de funcionamento (dia a dia, ex: Seg a Sex 8h-18h, Sáb 8h-12h, Dom fechado)',
        type: 'textarea',
        required: true,
      },
      { key: 'descricao', label: 'Descreva seu negócio em poucas frases', type: 'textarea', required: true },
      { key: 'observacoes', label: 'Alguma outra observação?', type: 'textarea' },
    ],
  },
  otimizacao: {
    title: 'Formulário de otimização de perfil',
    intro: 'Preencha as informações abaixo pra otimizarmos o perfil que seu negócio já tem no Google Maps.',
    fields: [
      { key: 'link_perfil', label: 'Link do seu perfil atual no Google Maps', type: 'text', required: true },
      {
        key: 'dono_verificado',
        label: 'Você é o dono verificado desse perfil no Google?',
        type: 'radio',
        options: ['Sim', 'Não', 'Não sei'],
        required: true,
      },
      { key: 'mudancas_recentes', label: 'Algo mudou recentemente (endereço, telefone, horário)?', type: 'textarea' },
      { key: 'avaliacoes_pendentes', label: 'Tem alguma avaliação negativa recente que precisa de atenção?', type: 'textarea' },
      { key: 'observacoes', label: 'Alguma outra observação?', type: 'textarea' },
    ],
  },
}

export const ONBOARDING_LABELS = {
  criacao: 'Criação de perfil',
  otimizacao: 'Otimização de perfil',
}

export function onboardingFieldLabel(tipo, key) {
  const campo = ONBOARDING_SCHEMAS[tipo]?.fields.find((f) => f.key === key)
  return campo?.label || key
}
