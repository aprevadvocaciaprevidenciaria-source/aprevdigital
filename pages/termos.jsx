import Link from 'next/link'
import Head from 'next/head'
import Logo from '../components/Logo'

export default function Termos() {
  return (
    <div className="min-h-screen bg-fog">
      <Head>
        <title>Termos de Uso · SEO Local Brasil</title>
      </Head>
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-2">
          <Logo size={32} />
          <Link href="/" className="font-display font-bold text-night">
            SEO Local Brasil
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="card space-y-6 text-sm leading-relaxed text-slate-600">
          <div>
            <h1 className="text-2xl font-display font-bold text-night mb-1">Termos de Uso</h1>
            <p className="text-xs text-slate-400">Última atualização: agosto de 2026</p>
          </div>

          <p>
            Estes Termos de Uso regem o acesso ao painel de gestão de clientes da{' '}
            <strong>SEO Local Brasil</strong>, disponível em painel.seolocalbrasil.com ("Serviço"). Ao acessar o
            Serviço, você concorda com estes termos.
          </p>

          <section>
            <h2 className="font-display font-semibold text-night mb-2">1. Sobre o Serviço</h2>
            <p>
              O Serviço é uma ferramenta interna de gestão usada pela SEO Local Brasil para administrar os clientes
              da agência: cadastro de empresas, métricas de Google Business Profile, avaliações, tarefas,
              relatórios e automações de comunicação. O acesso é restrito à equipe da agência e, quando concedido
              explicitamente, aos clientes dela através de um portal somente leitura.
            </p>
          </section>

          <section>
            <h2 className="font-display font-semibold text-night mb-2">2. Contas e acesso</h2>
            <p>
              Cada conta é pessoal e intransferível. O usuário é responsável por manter a confidencialidade da sua
              senha e por qualquer atividade realizada através da sua conta. Contas de clientes recebem acesso
              somente leitura aos próprios dados; contas da agência têm acesso administrativo completo.
            </p>
          </section>

          <section>
            <h2 className="font-display font-semibold text-night mb-2">3. Integração com o Google</h2>
            <p>
              Ao autorizar a conexão com uma conta Google, você concede à SEO Local Brasil permissão para ler e,
              quando usado explicitamente pelo operador do painel, responder avaliações em nome dos perfis de
              Google Business Profile aos quais essa conta tem acesso de gerente. Essa autorização pode ser
              revogada a qualquer momento em Configurações → Integração com Google Business Profile, ou
              diretamente nas permissões de terceiros da sua Conta Google.
            </p>
          </section>

          <section>
            <h2 className="font-display font-semibold text-night mb-2">4. Uso aceitável</h2>
            <p>
              O Serviço deve ser usado apenas para fins legítimos de gestão dos clientes da agência. É proibido
              usar o Serviço para armazenar dados sem consentimento do titular, tentar acessar contas de terceiros,
              ou usar as automações de mensagens para envio de conteúdo não solicitado (spam).
            </p>
          </section>

          <section>
            <h2 className="font-display font-semibold text-night mb-2">5. Disponibilidade e alterações</h2>
            <p>
              O Serviço é fornecido "como está". A SEO Local Brasil pode alterar, suspender ou descontinuar
              funcionalidades a qualquer momento, e pode atualizar estes termos publicando a versão revisada nesta
              página.
            </p>
          </section>

          <section>
            <h2 className="font-display font-semibold text-night mb-2">6. Limitação de responsabilidade</h2>
            <p>
              O Serviço é de uso interno e não constitui garantia de resultados de marketing, ranqueamento ou
              faturamento para os clientes geridos através dele.
            </p>
          </section>

          <section>
            <h2 className="font-display font-semibold text-night mb-2">7. Contato</h2>
            <p>
              Dúvidas sobre estes termos podem ser enviadas para{' '}
              <a href="mailto:seolocalbrasil@gmail.com" className="text-primary-800 underline">
                seolocalbrasil@gmail.com
              </a>
              .
            </p>
          </section>
        </div>
      </main>
    </div>
  )
}
