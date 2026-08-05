import Link from 'next/link'
import Head from 'next/head'
import Logo from '../components/Logo'

export default function Privacidade() {
  return (
    <div className="min-h-screen bg-fog">
      <Head>
        <title>Política de Privacidade · SEO Local Brasil</title>
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
            <h1 className="text-2xl font-display font-bold text-night mb-1">Política de Privacidade</h1>
            <p className="text-xs text-slate-400">Última atualização: agosto de 2026</p>
          </div>

          <p>
            Esta Política de Privacidade descreve como a <strong>SEO Local Brasil</strong> ("nós") coleta, usa e
            protege dados no painel de gestão de clientes disponível em painel.seolocalbrasil.com ("Serviço"). Ela
            segue os princípios da Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).
          </p>

          <section>
            <h2 className="font-display font-semibold text-night mb-2">1. Quem somos</h2>
            <p>
              A SEO Local Brasil é uma agência de marketing local que usa este painel internamente para gerenciar
              seus próprios clientes (empresas atendidas pela agência). O Serviço não é um produto vendido a
              terceiros de forma independente; o controlador dos dados aqui descritos é a própria SEO Local Brasil.
            </p>
          </section>

          <section>
            <h2 className="font-display font-semibold text-night mb-2">2. Quais dados coletamos</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Dados de conta: e-mail e senha (armazenada de forma criptografada) de quem acessa o painel.</li>
              <li>
                Dados dos clientes da agência cadastrados no painel: nome da empresa, CNPJ, endereço, telefone,
                e-mail comercial, dados de contato, plano contratado e observações internas.
              </li>
              <li>
                Métricas e avaliações do Google Business Profile de cada cliente, lançadas manualmente ou (quando
                a integração estiver ativa) sincronizadas automaticamente via autorização OAuth do Google.
              </li>
              <li>Fotos enviadas para a galeria de cada cliente.</li>
              <li>Registros de tarefas e mensagens automáticas de WhatsApp relacionadas ao atendimento dos clientes.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display font-semibold text-night mb-2">3. Uso da integração com o Google</h2>
            <p>
              Quando a SEO Local Brasil conecta uma conta Google ao painel, usamos o escopo{' '}
              <code className="bg-slate-100 px-1 rounded">business.manage</code> exclusivamente para: (a) ler
              métricas de desempenho e avaliações dos perfis do Google Business Profile dos clientes que
              autorizaram acesso de "Gerente" a essa conta, e (b) publicar respostas a avaliações quando a agência
              usa essa função dentro do painel. Não usamos esse acesso pra nenhuma outra finalidade, não
              publicamos conteúdo sem ação explícita do usuário do painel, e não compartilhamos os dados obtidos
              com terceiros.
            </p>
          </section>

          <section>
            <h2 className="font-display font-semibold text-night mb-2">4. Como protegemos os dados</h2>
            <p>
              Os dados ficam armazenados no Supabase (infraestrutura na nuvem com criptografia em trânsito e em
              repouso), com controle de acesso por linha (Row Level Security) restringindo cada usuário aos seus
              próprios dados. Tokens de acesso ao Google nunca ficam acessíveis pela API pública do painel — só
              por processos internos do servidor.
            </p>
          </section>

          <section>
            <h2 className="font-display font-semibold text-night mb-2">5. Compartilhamento com terceiros</h2>
            <p>
              Não vendemos nem compartilhamos dados pessoais com terceiros para fins de marketing. Dados podem ser
              processados por prestadores de infraestrutura estritamente necessários ao funcionamento do Serviço
              (hospedagem na Vercel, banco de dados no Supabase, envio de mensagens via Z-API quando configurado),
              sempre sob obrigação de confidencialidade.
            </p>
          </section>

          <section>
            <h2 className="font-display font-semibold text-night mb-2">6. Seus direitos</h2>
            <p>
              Qualquer pessoa cujos dados estejam cadastrados no painel pode solicitar acesso, correção ou exclusão
              das informações entrando em contato pelo e-mail abaixo.
            </p>
          </section>

          <section>
            <h2 className="font-display font-semibold text-night mb-2">7. Contato</h2>
            <p>
              Dúvidas sobre esta política podem ser enviadas para{' '}
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
