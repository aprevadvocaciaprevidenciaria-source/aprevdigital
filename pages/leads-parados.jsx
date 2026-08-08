import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { Loader2, AlertTriangle, Phone, MessageCircle, ExternalLink, Copy, Check, Clock } from 'lucide-react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'

const ESTAGIO_TERMINAL = ['Convertido']

// Cadência de follow-up: insistente e diária, sem pular dia. Não existe
// "marcar como perdido" - quem entra em contato pelo anúncio só tem dois
// caminhos: virar cliente (vir conversar com o Dr.) ou bloquear nosso
// número de tanta insistência. Então a cadência nunca sinaliza desistência,
// só escala o tom e o CTA pra marcar a conversa.
//
// Dias 1-3: contato inicial, sempre por ligação (contato mais quente).
// Dia 4 em diante: alterna ligação/WhatsApp todo santo dia, sem intervalo,
// escalando o tom da mensagem conforme o tempo parado.
const FASES = {
  inicial: { label: 'Contato inicial', cor: 'amber' },
  acompanhamento: { label: 'Acompanhamento', cor: 'amber' },
  insistencia: { label: 'Insistência', cor: 'orange' },
  insistencia_maxima: { label: 'Insistência máxima', cor: 'red' },
}

function definirFase(diasParado) {
  const dias = diasParado || 0
  if (dias <= 3) return 'inicial'
  if (dias <= 7) return 'acompanhamento'
  if (dias <= 14) return 'insistencia'
  return 'insistencia_maxima'
}

function definirCanalDoDia(diasParado) {
  const dias = diasParado || 0
  if (dias <= 3) return 'ligacao'
  // A partir do dia 4, alterna todo dia - nunca fica sem ação sugerida.
  return dias % 2 === 0 ? 'whatsapp' : 'ligacao'
}

function montarLinkWhatsapp(telefone) {
  const digits = (telefone || '').replace(/\D/g, '')
  if (!digits) return null
  return `https://wa.me/${digits.startsWith('55') ? digits : `55${digits}`}`
}

function montarLinkLigacao(telefone) {
  const digits = (telefone || '').replace(/\D/g, '')
  if (!digits) return null
  return `tel:${digits.startsWith('55') ? digits : `55${digits}`}`
}

function montarMensagem(nome, fase) {
  const contato = nome ? nome.split(' ')[0] : ''
  const saud = `Oi${contato ? ` ${contato}` : ''}!`
  if (fase === 'inicial') {
    return (
      `${saud} Tudo bem? Aqui é da APREV Advocacia Previdenciária. Vi que você entrou em contato sobre o ` +
      `seu caso e quero te ajudar a entender seus direitos. Posso te ligar rapidinho ou já marcar um horário ` +
      `pra você conversar com o Dr. Fábio?`
    )
  }
  if (fase === 'acompanhamento') {
    return (
      `${saud} Passando pra saber se você ainda quer conversar sobre o seu caso. O Dr. Fábio pode te atender ` +
      `e explicar direitinho o que dá pra fazer - me diz o melhor dia pra você que já deixo agendado.`
    )
  }
  if (fase === 'insistencia') {
    return (
      `${saud} Ainda não conseguimos falar e não quero que você perca a chance de garantir seu direito. ` +
      `Vamos marcar um horário rapidinho com o Dr. Fábio? É só me responder aqui com o melhor dia.`
    )
  }
  return (
    `${saud} Sei que já mandei várias mensagens, mas o seu caso é importante e não quero que você fique sem ` +
    `essa orientação. Bora marcar 10 minutinhos com o Dr. Fábio? Me chama aqui quando puder.`
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

  async function copiarMensagem(lead, fase) {
    await navigator.clipboard.writeText(montarMensagem(lead.nome, fase))
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
          Leads sincronizados do Trello sem movimento no funil. Cada lead mostra a "ação de hoje" (ligar ou
          WhatsApp) - a cadência é diária e não para sozinha. Só existem dois finais: a pessoa vem conversar
          com o Dr. ou bloqueia nosso número de tanta insistência. Insista todo dia até um dos dois acontecer.
          Nada aqui é enviado automaticamente, você decide.
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
            const dias = lead.dias_parado || 0
            const fase = definirFase(dias)
            const faseInfo = FASES[fase]
            const canalDoDia = definirCanalDoDia(dias)
            const linkWhatsapp = montarLinkWhatsapp(lead.telefone)
            const linkLigacao = montarLinkLigacao(lead.telefone)

            const corBorda = { amber: 'border-l-amber-400', orange: 'border-l-orange-500', red: 'border-l-red-500' }[faseInfo.cor]
            const corBadge = {
              amber: 'bg-amber-100 text-amber-700',
              orange: 'bg-orange-100 text-orange-700',
              red: 'bg-red-100 text-red-700',
            }[faseInfo.cor]

            return (
              <li key={lead.id} className={`card border-l-4 ${corBorda}`}>
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-medium text-slate-700">{lead.nome || 'Sem nome'}</p>
                      <span className={`badge ${corBadge}`}>
                        <Clock className="w-3 h-3 mr-1" />
                        {dias} dia{dias === 1 ? '' : 's'} parado
                      </span>
                      <span className={`badge ${corBadge}`}>{faseInfo.label}</span>
                      <span className="badge bg-slate-100 text-slate-600">{lead.estagio}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-medium text-primary-800 mb-1">
                      {canalDoDia === 'ligacao' ? (
                        <>
                          <Phone className="w-3.5 h-3.5" /> Ação de hoje: ligar
                        </>
                      ) : (
                        <>
                          <MessageCircle className="w-3.5 h-3.5" /> Ação de hoje: WhatsApp
                        </>
                      )}
                    </div>
                    {lead.telefone ? (
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <Phone className="w-3.5 h-3.5" /> {lead.telefone}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">Sem telefone cadastrado</span>
                    )}
                    {fase === 'insistencia_maxima' && (
                      <p className="text-xs text-red-600 mt-1">
                        Já são {dias} dias insistindo - continue todo dia. Só pare se a pessoa bloquear o
                        número; até lá, o próximo contato é hoje.
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => copiarMensagem(lead, fase)}
                      className="btn-secondary flex items-center gap-1.5 text-sm"
                    >
                      {copiadoId === lead.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copiadoId === lead.id ? 'Copiado!' : 'Copiar mensagem'}
                    </button>
                    {linkLigacao && (
                      <a
                        href={linkLigacao}
                        className={`${canalDoDia === 'ligacao' ? 'btn-primary' : 'btn-secondary'} flex items-center gap-1.5 text-sm`}
                      >
                        <Phone className="w-4 h-4" />
                        Ligar
                      </a>
                    )}
                    {linkWhatsapp && (
                      <a
                        href={linkWhatsapp}
                        target="_blank"
                        rel="noreferrer"
                        className={`${canalDoDia === 'whatsapp' ? 'btn-primary' : 'btn-secondary'} flex items-center gap-1.5 text-sm`}
                      >
                        <MessageCircle className="w-4 h-4" />
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
