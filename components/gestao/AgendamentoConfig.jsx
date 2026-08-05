import { useEffect, useState } from 'react'
import { Loader2, Save, Copy, Check, CalendarClock } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const DIAS_SEMANA = [
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
  { value: 7, label: 'Dom' },
]

function slugify(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const EMBED_BASE_URL = 'https://painel.seolocalbrasil.com'

export default function AgendamentoConfig({ clienteId }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(null)
  const [servicosTexto, setServicosTexto] = useState('')
  const [slugStatus, setSlugStatus] = useState(null) // null | 'checando' | 'livre' | 'em_uso'
  const [msg, setMsg] = useState('')
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    load()
  }, [clienteId])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('clientes')
      .select(
        'id, nome, slug, agendamento_ativo, dias_funcionamento, horario_abertura, horario_fechamento, intervalo_almoco_inicio, intervalo_almoco_fim, duracao_padrao_servico, servicos_agendamento, cor_agendamento'
      )
      .eq('id', clienteId)
      .single()

    if (data) {
      setForm({
        slug: data.slug || '',
        agendamento_ativo: !!data.agendamento_ativo,
        dias_funcionamento: data.dias_funcionamento || [1, 2, 3, 4, 5, 6],
        horario_abertura: (data.horario_abertura || '08:00').slice(0, 5),
        horario_fechamento: (data.horario_fechamento || '18:00').slice(0, 5),
        intervalo_almoco_inicio: data.intervalo_almoco_inicio ? data.intervalo_almoco_inicio.slice(0, 5) : '',
        intervalo_almoco_fim: data.intervalo_almoco_fim ? data.intervalo_almoco_fim.slice(0, 5) : '',
        duracao_padrao_servico: data.duracao_padrao_servico || 60,
        cor_agendamento: data.cor_agendamento || '#c9a24b',
        nome: data.nome,
      })
      setServicosTexto((data.servicos_agendamento || []).join(', '))
    }
    setLoading(false)
  }

  function toggleDia(dia) {
    const atual = form.dias_funcionamento || []
    const novo = atual.includes(dia) ? atual.filter((d) => d !== dia) : [...atual, dia].sort()
    setForm({ ...form, dias_funcionamento: novo })
  }

  async function checarSlug(slug) {
    if (!slug) {
      setSlugStatus(null)
      return
    }
    setSlugStatus('checando')
    const { data } = await supabase.from('clientes').select('id').eq('slug', slug).neq('id', clienteId).maybeSingle()
    setSlugStatus(data ? 'em_uso' : 'livre')
  }

  async function handleSalvar(e) {
    e.preventDefault()
    setSaving(true)
    setMsg('')

    const slugFinal = slugify(form.slug)
    const servicos = servicosTexto
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    const { error } = await supabase
      .from('clientes')
      .update({
        slug: slugFinal || null,
        agendamento_ativo: form.agendamento_ativo,
        dias_funcionamento: form.dias_funcionamento,
        horario_abertura: form.horario_abertura,
        horario_fechamento: form.horario_fechamento,
        intervalo_almoco_inicio: form.intervalo_almoco_inicio || null,
        intervalo_almoco_fim: form.intervalo_almoco_fim || null,
        duracao_padrao_servico: Number(form.duracao_padrao_servico) || 60,
        cor_agendamento: form.cor_agendamento,
        servicos_agendamento: servicos.length ? servicos : null,
      })
      .eq('id', clienteId)

    setSaving(false)
    if (error) {
      setMsg(error.message.includes('duplicate') ? 'Esse endereço já está em uso por outro cliente.' : 'Não foi possível salvar.')
      return
    }
    setForm({ ...form, slug: slugFinal })
    setMsg('Salvo!')
    setTimeout(() => setMsg(''), 2500)
  }

  function snippet() {
    if (!form?.slug) return null
    const servicosAttr = servicosTexto.trim()
    return (
      `<div data-agendamento-slug="${form.slug}" data-agendamento-accent="${form.cor_agendamento}"` +
      (servicosAttr ? `\n     data-agendamento-servicos="${servicosAttr}"` : '') +
      `></div>\n<script src="${EMBED_BASE_URL}/embed/agendamento.js" defer></script>`
    )
  }

  function handleCopiar() {
    const texto = snippet()
    if (!texto) return
    navigator.clipboard.writeText(texto)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  if (loading || !form) {
    return (
      <div className="card flex justify-center py-10">
        <Loader2 className="w-6 h-6 text-primary-800 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-primary-800" />
            <h2 className="font-display font-semibold text-night">Configuração do agendamento online</h2>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.agendamento_ativo}
              onChange={(e) => setForm({ ...form, agendamento_ativo: e.target.checked })}
            />
            Cliente contratou o agendamento
          </label>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          Define a disponibilidade real usada pelo widget de agendamento na página pública deste cliente.
        </p>
        {!form.agendamento_ativo && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
            Desativado: mesmo com o link publicado, a página pública deste cliente não vai funcionar até você marcar
            "Cliente contratou o agendamento" e salvar. Dá pra configurar tudo com calma antes de ativar.
          </p>
        )}

        <form onSubmit={handleSalvar} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Endereço da página (slug)</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400 whitespace-nowrap">slug:</span>
              <input
                value={form.slug}
                onChange={(e) => {
                  const v = slugify(e.target.value)
                  setForm({ ...form, slug: v })
                  setSlugStatus(null)
                }}
                onBlur={(e) => checarSlug(slugify(e.target.value))}
                placeholder={slugify(form.nome) || 'nome-do-cliente'}
                className="input-field flex-1"
              />
            </div>
            {slugStatus === 'checando' && <p className="text-xs text-slate-400 mt-1">Checando disponibilidade...</p>}
            {slugStatus === 'livre' && <p className="text-xs text-emerald-600 mt-1">Disponível ✓</p>}
            {slugStatus === 'em_uso' && <p className="text-xs text-red-600 mt-1">Esse endereço já está em uso por outro cliente.</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Dias de funcionamento</label>
            <div className="flex gap-2 flex-wrap">
              {DIAS_SEMANA.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleDia(d.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
                    (form.dias_funcionamento || []).includes(d.value)
                      ? 'bg-primary-800 text-white border-primary-800'
                      : 'bg-white text-slate-600 border-slate-300'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Abertura</label>
              <input type="time" value={form.horario_abertura} onChange={(e) => setForm({ ...form, horario_abertura: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Fechamento</label>
              <input type="time" value={form.horario_fechamento} onChange={(e) => setForm({ ...form, horario_fechamento: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Almoço - início</label>
              <input type="time" value={form.intervalo_almoco_inicio} onChange={(e) => setForm({ ...form, intervalo_almoco_inicio: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Almoço - fim</label>
              <input type="time" value={form.intervalo_almoco_fim} onChange={(e) => setForm({ ...form, intervalo_almoco_fim: e.target.value })} className="input-field" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Duração de cada atendimento (min)</label>
              <input
                type="number"
                min={15}
                step={15}
                value={form.duracao_padrao_servico}
                onChange={(e) => setForm({ ...form, duracao_padrao_servico: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cor de destaque do widget</label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.cor_agendamento} onChange={(e) => setForm({ ...form, cor_agendamento: e.target.value })} className="h-10 w-12 border border-slate-300 rounded-lg" />
                <input value={form.cor_agendamento} onChange={(e) => setForm({ ...form, cor_agendamento: e.target.value })} className="input-field flex-1" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Serviços oferecidos (separados por vírgula)</label>
            <textarea
              value={servicosTexto}
              onChange={(e) => setServicosTexto(e.target.value)}
              rows={2}
              placeholder="Ex: Troca de óleo e filtros, Revisão geral, Alinhamento e balanceamento, Outro"
              className="input-field"
            />
            <p className="text-xs text-slate-400 mt-1">Aparecem como opções no campo "Serviço desejado" do formulário de agendamento.</p>
          </div>

          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar
            </button>
            {msg && <span className="text-sm text-slate-500">{msg}</span>}
          </div>
        </form>
      </div>

      {form.slug && (
        <div className="card">
          <h3 className="font-display font-semibold text-night mb-1">Código pra incorporar na página</h3>
          <p className="text-xs text-slate-400 mb-3">
            Cola esse trecho no lugar do widget na página de agendamento gerada (ex: no Claude Design), ou passa
            pra quem estiver montando o site do cliente.
          </p>
          <div className="relative">
            <pre className="bg-slate-900 text-slate-100 text-xs rounded-lg p-4 overflow-x-auto whitespace-pre-wrap">{snippet()}</pre>
            <button
              onClick={handleCopiar}
              className="absolute top-2 right-2 p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white"
              title="Copiar"
            >
              {copiado ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
