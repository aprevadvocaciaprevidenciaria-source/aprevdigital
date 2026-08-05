import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Download, Copy, Check, QrCode as QrCodeIcon } from 'lucide-react'

// Mostra o QR Code + link direto de avaliação do Google do cliente (campo
// clientes.link_avaliacao, preenchido pelo admin). Gerado inteiramente no
// navegador (biblioteca `qrcode`, sem serviço externo) - sem custo.
export default function QrCodeAvaliacao({ link, nomeArquivo = 'qrcode-avaliacao' }) {
  const [dataUrl, setDataUrl] = useState(null)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    if (!link) {
      setDataUrl(null)
      return
    }
    QRCode.toDataURL(link, { width: 480, margin: 2, color: { dark: '#16233F', light: '#FFFFFF' } })
      .then(setDataUrl)
      .catch(() => setDataUrl(null))
  }, [link])

  async function handleCopiar() {
    await navigator.clipboard.writeText(link)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  if (!link) return null

  return (
    <div className="card">
      <h2 className="font-display font-semibold text-night mb-1 flex items-center gap-2">
        <QrCodeIcon className="w-5 h-5 text-primary-800" />
        Peça avaliações no Google
      </h2>
      <p className="text-sm text-slate-500 mb-4">
        Baixe o QR Code e imprima no balcão, ou copie o link e mande direto pro cliente pelo WhatsApp.
      </p>
      <div className="flex flex-col sm:flex-row items-center gap-6">
        {dataUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dataUrl} alt="QR Code de avaliação" className="w-40 h-40 rounded-lg border border-slate-200 shrink-0" />
        )}
        <div className="flex flex-col gap-2 w-full sm:w-auto">
          {dataUrl && (
            <a
              href={dataUrl}
              download={`${nomeArquivo}.png`}
              className="btn-primary flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              Baixar QR Code
            </a>
          )}
          <button onClick={handleCopiar} className="btn-secondary flex items-center justify-center gap-2">
            {copiado ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copiado ? 'Link copiado!' : 'Copiar link de avaliação'}
          </button>
        </div>
      </div>
    </div>
  )
}
