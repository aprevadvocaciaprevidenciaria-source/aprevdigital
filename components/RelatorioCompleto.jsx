import { Star } from 'lucide-react'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { formatDateTime, formatCurrency } from '../lib/format'
import { buildAnaliseAvaliacoes, buildAnaliseMetricas, buildEstimativaROI } from '../lib/relatorio'

const CORES_NOTA = { 5: '#16C79A', 4: '#62e0bd', 3: '#f59e0b', 2: '#fb923c', 1: '#ef4444' }
const CORES_ACOES = ['#16233F', '#16C79A', '#3a4f72', '#94a3b8']

// Relatório completo (métricas, avaliações, engajamento, calculadora de ROI)
// - mesmo componente usado no preview do admin (pages/relatorios.jsx) e na
// visualização do cliente no portal, garantindo que os dois vejam
// exatamente a mesma coisa. `preview` é o objeto salvo em relatorios.dados:
// { cliente, metricas, avaliacoes, totais, geradoEm }.
export default function RelatorioCompleto({ preview }) {
  if (!preview) return null

  const analiseMetricas = buildAnaliseMetricas(preview.metricas)
  const analiseAvaliacoes = buildAnaliseAvaliacoes(preview.avaliacoes || [])
  const estimativaROI = buildEstimativaROI(analiseMetricas.totais, preview.cliente)

  return (
    <div id="print-area" className="p-2">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-4">
        <div>
          <h3 className="font-display text-xl font-bold text-night">{preview.cliente.nome}</h3>
          <p className="text-sm text-slate-500">
            {preview.cliente.nicho} {preview.cliente.cidade ? `· ${preview.cliente.cidade}` : ''}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400">Gerado em</p>
          <p className="text-sm text-slate-700">{formatDateTime(preview.geradoEm)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Visualizações', value: preview.totais.visualizacoes },
          { label: 'Interações', value: preview.totais.interacoes },
          { label: 'Chamadas', value: preview.totais.chamadas },
          { label: 'Solicitações de rota', value: preview.totais.rotas },
          { label: 'Cliques no site', value: preview.totais.cliques_site },
          { label: 'Buscas', value: preview.totais.buscas },
        ].map((m) => (
          <div key={m.label} className="text-center p-3 rounded-lg bg-slate-50">
            <p className="text-xl font-bold text-night">{m.value.toLocaleString('pt-BR')}</p>
            <p className="text-xs text-slate-500">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Calculadora de ROI */}
      <div className="rounded-xl border border-secondary-200 bg-secondary-50 p-4 mb-8">
        <h3 className="text-sm font-semibold text-night mb-1">Estimativa de retorno (ROI)</h3>
        {estimativaROI.configurado ? (
          <>
            <p className="text-xs text-slate-500 mb-3">
              Baseado em {estimativaROI.acoesConsideradas.toLocaleString('pt-BR')} ações (chamadas + rotas + cliques no site),
              taxa de conversão estimada de {estimativaROI.taxaConversao}% e ticket médio de {formatCurrency(estimativaROI.ticketMedio)}.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-2xl font-bold text-night">
                  {estimativaROI.clientesEstimados.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
                </p>
                <p className="text-xs text-slate-500">Clientes estimados</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-secondary-700">{formatCurrency(estimativaROI.faturamentoEstimado)}</p>
                <p className="text-xs text-slate-500">Faturamento estimado</p>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-3">
              Estimativa aproximada com base em premissas configuradas manualmente pelo seu gestor - não é um valor medido de fato.
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-500">Seu gestor ainda não configurou os parâmetros pra calcular uma estimativa de faturamento aqui.</p>
        )}
      </div>

      {/* Avaliações */}
      <div className="border-t border-slate-100 pt-4 mb-8">
        <h3 className="font-display font-semibold text-night mb-4">Avaliações</h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-3 rounded-lg bg-slate-50">
            <p className="text-xl font-bold text-night">{analiseAvaliacoes.total}</p>
            <p className="text-xs text-slate-500">Total de avaliações</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-slate-50">
            <p className="text-xl font-bold text-night flex items-center justify-center gap-1">
              {analiseAvaliacoes.mediaNota.toFixed(1)} <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
            </p>
            <p className="text-xs text-slate-500">Nota média</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-slate-50">
            <p className="text-xl font-bold text-night">{analiseAvaliacoes.isr.toFixed(1)}%</p>
            <p className="text-xs text-slate-500">Índice de saúde (ISR)</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-slate-50">
            <p className="text-xl font-bold text-night">{analiseAvaliacoes.taxaResposta.toFixed(0)}%</p>
            <p className="text-xs text-slate-500">Taxa de resposta</p>
          </div>
        </div>

        {analiseAvaliacoes.total === 0 ? (
          <p className="text-sm text-slate-400">Nenhuma avaliação lançada no período selecionado.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div>
                <h4 className="text-xs font-medium text-slate-500 mb-2">Distribuição por nota</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={analiseAvaliacoes.distribuicaoPorNota.filter((d) => d.qtd > 0)}
                      dataKey="qtd"
                      nameKey="nota"
                      innerRadius={45}
                      outerRadius={75}
                      label={({ nota, qtd }) => `${nota}★: ${qtd}`}
                    >
                      {analiseAvaliacoes.distribuicaoPorNota.map((d) => (
                        <Cell key={d.nota} fill={CORES_NOTA[d.nota]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div>
                <h4 className="text-xs font-medium text-slate-500 mb-2">Crescimento acumulado</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={analiseAvaliacoes.porMes}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Area type="monotone" dataKey="acumulado" name="Total acumulado" stroke="#16C79A" fill="#cdf7ea" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h4 className="text-xs font-medium text-slate-500 mb-2">Taxa de resposta por nota</h4>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={analiseAvaliacoes.porNota}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" />
                    <XAxis dataKey="nota" tickFormatter={(v) => `${v}★`} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} unit="%" />
                    <Tooltip formatter={(v) => `${v.toFixed(0)}%`} />
                    <Bar dataKey="taxaResposta" name="Taxa de resposta" radius={[4, 4, 0, 0]}>
                      {analiseAvaliacoes.porNota.map((d) => (
                        <Cell key={d.nota} fill={CORES_NOTA[d.nota]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div>
                <h4 className="text-xs font-medium text-slate-500 mb-2">Avaliações por dia da semana</h4>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={analiseAvaliacoes.porDiaSemana}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" />
                    <XAxis dataKey="dia" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Bar dataKey="qtd" name="Avaliações" fill="#16233F" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Engajamento */}
      <div className="border-t border-slate-100 pt-4">
        <h3 className="font-display font-semibold text-night mb-1">Engajamento no Google Business Profile</h3>
        <p className="text-xs text-slate-400 mb-4">Taxa de interesse (interações ÷ visualizações): {analiseMetricas.taxaInteresse.toFixed(1)}%</p>

        {preview.metricas.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhuma métrica lançada no período selecionado.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div>
                <h4 className="text-xs font-medium text-slate-500 mb-2">Distribuição de ações</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={analiseMetricas.distribuicaoAcoes.filter((d) => d.valor > 0)}
                      dataKey="valor"
                      nameKey="tipo"
                      innerRadius={45}
                      outerRadius={75}
                      label={({ tipo, pct }) => `${tipo}: ${pct.toFixed(0)}%`}
                    >
                      {analiseMetricas.distribuicaoAcoes.map((d, i) => (
                        <Cell key={d.tipo} fill={CORES_ACOES[i % CORES_ACOES.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div>
                <h4 className="text-xs font-medium text-slate-500 mb-2">Evolução mensal</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={analiseMetricas.porMes}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="visualizacoes" name="Visualizações" fill="#16233F" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="interacoes" name="Interações" fill="#16C79A" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="table-head">
                  <th className="px-3 py-2 font-medium">Mês</th>
                  <th className="px-3 py-2 font-medium">Visualizações</th>
                  <th className="px-3 py-2 font-medium">Variação</th>
                  <th className="px-3 py-2 font-medium">Chamadas</th>
                  <th className="px-3 py-2 font-medium">Rotas</th>
                  <th className="px-3 py-2 font-medium">Cliques no site</th>
                </tr>
              </thead>
              <tbody>
                {analiseMetricas.porMes.map((m) => (
                  <tr key={m.id || m.mes} className="border-b border-slate-50">
                    <td className="px-3 py-2">{m.mes}</td>
                    <td className="px-3 py-2">{m.visualizacoes}</td>
                    <td className="px-3 py-2">
                      {m.variacaoVisualizacoes === null ? (
                        '—'
                      ) : (
                        <span className={m.variacaoVisualizacoes >= 0 ? 'text-secondary-700' : 'text-red-600'}>
                          {m.variacaoVisualizacoes >= 0 ? '+' : ''}
                          {m.variacaoVisualizacoes}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">{m.chamadas}</td>
                    <td className="px-3 py-2">{m.rotas}</td>
                    <td className="px-3 py-2">{m.cliques_site}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  )
}
