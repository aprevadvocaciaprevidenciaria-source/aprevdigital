import { createClient } from '@supabase/supabase-js'
import catalogo from '../../../data/biblioteca-ia.json'

// Rótulos em português pras 22 áreas do catálogo "Escritório IA · Advocacia".
// Se um catálogo futuro trouxer área nova, cai no fallback (slug capitalizado).
const AREA_LABELS = {
  administrativo: 'Administrativo',
  aeronautico: 'Aeronáutico',
  agrario: 'Agrário',
  ambiental: 'Ambiental',
  bancario: 'Bancário',
  civel: 'Cível',
  consumidor: 'Consumidor',
  contratos: 'Contratos',
  desportivo: 'Desportivo',
  digital: 'Digital',
  eleitoral: 'Eleitoral',
  familia: 'Família',
  imobiliario: 'Imobiliário',
  internacional: 'Internacional',
  militar: 'Militar',
  penal: 'Penal',
  previdenciario: 'Previdenciário',
  regulatorio: 'Regulatório',
  saude: 'Saúde',
  societario: 'Societário',
  trabalhista: 'Trabalhista',
  tributario: 'Tributário',
}

function areaLabel(slug) {
  return AREA_LABELS[slug] || slug.charAt(0).toUpperCase() + slug.slice(1)
}

const AREAS = Object.entries(
  catalogo.reduce((acc, item) => {
    acc[item.area] = (acc[item.area] || 0) + 1
    return acc
  }, {})
)
  .map(([value, total]) => ({ value, label: areaLabel(value), total }))
  .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))

// Mesmo padrão de auth dos outros endpoints (ex: /api/clientes/excluir): confirma
// a sessão do usuário logado com o token dele. Não precisa de service role aqui -
// o conteúdo não é por usuário, só precisa garantir que quem pede está logado
// (exigência da licença do pacote "Escritório IA", não regra de dado sensível).
async function usuarioAutenticado(req) {
  const authHeader = req.headers.authorization
  if (!authHeader) return null
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido.' })
  }

  const user = await usuarioAutenticado(req)
  if (!user) {
    return res.status(401).json({ error: 'Não autenticado.' })
  }

  const { area, q } = req.query
  const termo = (q || '').trim().toLowerCase()

  let itens = catalogo
  if (area && area !== 'todas') {
    itens = itens.filter((item) => item.area === area)
  }
  if (termo) {
    itens = itens.filter(
      (item) => item.nome.toLowerCase().includes(termo) || item.descricao.toLowerCase().includes(termo)
    )
  }

  const leve = itens.map(({ id, area: itemArea, numero, nome, descricao }) => ({
    id,
    area: itemArea,
    numero,
    nome,
    descricao,
  }))

  return res.status(200).json({
    itens: leve,
    total: leve.length,
    totalGeral: catalogo.length,
    areas: AREAS,
  })
}
