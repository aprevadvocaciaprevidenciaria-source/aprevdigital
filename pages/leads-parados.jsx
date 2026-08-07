import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { Loader2, AlertTriangle, Phone, ExternalLink, Copy, Check, Clock } from 'lucide-react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'

const ESTAGIO_TERMINAL = ['Convertido']
const DIAS_LIMITE_URGENTE = 7

function montarLinkWhatsapp(telefone) {
  const digits = (telefone || '').replace(/\D/g, '')
  if (!digits) return null
  return `https://wa.me/${digits.startsWith('55') ? digits : `55${digits}`}`
}

function montarMensagem(nome) {
  const contato = nome ? nome.split(' ')[0] : ''
  return (
    `Oi${contato ? ` ${contato}` : ''}! Tudo bem? Aqui é da APREV Advocacia Previdenciária. ` +
    `Notamos que faz um tempo que não conversamos sobre o seu caso e queríamos saber se você ainda ` +
    `tem interesse em dar continuidade, ou se ficou com alguma dúvida. Qualquer coisa, é só responder por aqui!`
  )
}

export default function LeadsParados() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [leads, setLeads] = useState([])
  const [erro, setErro] = useState('')
  const [copiadoId, setCopiadoId] = useState(null)

  useEffect(() => {
    async function init() {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session) {
        router.replace('/login')
        return
      }
      await carregarLeadsParados()
      setLoading(false)
    }
    init()
  }, [router])

  async function carregarLeadsParados() {
    const { data, error } = await supabase
      .from('leads')
      .select('id, nome, telefone, estagio, dias_parado, url_trello, atualizado_em')
      .not('dias_parado', 'is', null)
      .order('dias_parado', { ascending: false })
    if (error) {
      setErro(error.message)
      return
    }
    setLeads((data || []).filter((l) => !ESTAGIO_TERMINAL.includes(l.estagio)))
  }

  async function copiarMensagem(lead) {
    await navigator.clipboard.writeText(montarMensagem(lead.nome))
    setCopiadoId(lead.id)
    setTimeout(() => setCopiadoId(null), 2000)
  }

  if (loading) {
    return (
      <Layout title="Leads Parados">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-primary-800 animate-spin" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="Leads Parados">
      <div className="card mb-6 bg-amber-50 border-amber-200 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800">
          Leads sincronizados do Trello sem movimento no funil. Dados em tempo real, mesma fonte do funil no
          Trello - nada aqui é enviado automaticamente, você decide quando retomar.
        </p>
      </div>

      {erro && (
        <div className="card mb-6 bg-red-50 border-red-200">
          <p className="text-sm text-red-700">{erro}</p>
        </div>
      )}

      {leads.length === 0 && !erro ? (
        <div className="card text-center py-10 text-sm text-slate-400">Nenhum lead parado no momento. 🎉</div>
      ) : (
        <ul className="space-y-3">
          {leads.map((lead) => {
            const urgente = (lead.dias_parado || 0) >= DIAS_LIMITE_URGENTE
            const linkWhatsapp = montarLinkWhatsapp(lead.telefone)
            return (
              <li key={lead.id} className={`card border-l-4 ${urgente ? 'border-l-red-500' : 'border-l-amber-400'}`}>
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-medium text-slate-700">{lead.nome || 'Sem nome'}</p>
                      <span className={`badge ${urgente ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                        <Clock className="w-3 h-3 mr-1" />
                        {lead.dias_parado} dia{lead.dias_parado === 1 ? '' : 's'} parado
                      </span>
                      <span className="badge bg-slate-100 text-slate-600">{lead.estagio}</span>
                    </div>
                    {lead.telefone ? (
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <Phone className="w-3.5 h-3.5" /> {lead.telefone}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">Sem telefone cadastrado</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => copiarMensagem(lead)}
                      className="btn-secondary flex items-center gap-1.5 text-sm"
                    >
                      {copiadoId === lead.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copiadoId === lead.id ? 'Copiado!' : 'Copiar mensagem'}
                    </button>
                    {linkWhatsapp && (
                      <a href={linkWhatsapp} target="_blank" rel="noreferrer" className="btn-primary flex items-center gap-1.5 text-sm">
                        <Phone className="w-4 h-4" />
                        WhatsApp
                      </a>
                    )}
                    {lead.url_trello && (
                      <a
                        href={lead.url_trello}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 text-slate-400 hover:text-primary-800 hover:bg-primary-50 rounded-lg"
                        title="Ver no Trello"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Layout>
  )
}
