// Módulo server-only: nunca importar a partir de páginas/componentes que rodam no navegador.
//
// Leitura só (escopo drive.readonly, ver pages/api/google/iniciar.js). Cobre
// Google Docs/Sheets nativos e arquivos de texto puro via export/download
// direto da Drive API v3 - sem depender de nenhuma lib de parsing pesada
// (ex: PDF/imagem escaneada), que teria custo de cold start/bundle alto
// numa function serverless da Vercel sem garantia de funcionar sem mais
// testes. PDF/imagem ficam de fora por ora: a tool devolve o link
// direto do Drive pra abrir manualmente, ou a pessoa anexa o arquivo pelo
// clipe já existente em /maia (esse caminho já manda o arquivo de verdade
// pro modelo, não só texto).

const GOOGLE_DOC_MIME = 'application/vnd.google-apps.document'
const GOOGLE_SHEET_MIME = 'application/vnd.google-apps.spreadsheet'
const LIMITE_TEXTO = 15000

export function extrairIdPasta(link) {
  if (!link) return null
  const semParametros = link.trim().split('?')[0]
  const porPadraoDeUrl = semParametros.match(/\/folders\/([a-zA-Z0-9_-]+)/)
  if (porPadraoDeUrl) return porPadraoDeUrl[1]
  // Aceita também o ID colado direto, sem link completo.
  if (/^[a-zA-Z0-9_-]{10,}$/.test(semParametros)) return semParametros
  return null
}

async function chamarDrive(caminho, accessToken, { texto } = {}) {
  const res = await fetch(`https://www.googleapis.com/drive/v3/${caminho}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    const corpo = await res.text().catch(() => '')
    throw new Error(`Drive API respondeu HTTP ${res.status}: ${corpo.slice(0, 300)}`)
  }
  return texto ? res.text() : res.json()
}

export async function listarArquivosPasta(accessToken, folderId) {
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType, modifiedTime, webViewLink)',
    pageSize: '50',
    orderBy: 'modifiedTime desc',
  })
  const data = await chamarDrive(`files?${params.toString()}`, accessToken)
  return data.files || []
}

// Confirma que um arquivo/pasta (itemId) está de fato dentro da árvore da
// pasta raiz vinculada ao cliente (raizId), subindo a cadeia de `parents`
// no Drive - nunca confia num id que o modelo devolveu sozinho, porque
// nada impede a Maia de "alucinar" ou ser induzida (ex: texto de um
// arquivo pedindo pra ler outro id) a pedir um id fora da pasta do
// cliente. Sem essa checagem, o escopo readonly do token daria acesso a
// qualquer arquivo do Drive conectado, não só aos vinculados no painel.
export async function pertenceAPasta(accessToken, itemId, raizId, profundidadeMax = 10) {
  if (itemId === raizId) return true
  let atualId = itemId
  for (let i = 0; i < profundidadeMax; i++) {
    let meta
    try {
      meta = await chamarDrive(`files/${atualId}?fields=id,parents`, accessToken)
    } catch {
      return false
    }
    const pais = meta.parents || []
    if (pais.includes(raizId)) return true
    if (pais.length === 0) return false
    atualId = pais[0]
  }
  return false
}

export async function lerConteudoArquivo(accessToken, arquivo) {
  const { id, mimeType, name, webViewLink } = arquivo

  if (mimeType === GOOGLE_DOC_MIME) {
    const texto = await chamarDrive(`files/${id}/export?mimeType=text/plain`, accessToken, { texto: true })
    return { suportado: true, texto: texto.slice(0, LIMITE_TEXTO) }
  }

  if (mimeType === GOOGLE_SHEET_MIME) {
    const csv = await chamarDrive(`files/${id}/export?mimeType=text/csv`, accessToken, { texto: true })
    return { suportado: true, texto: csv.slice(0, LIMITE_TEXTO) }
  }

  if (mimeType === 'text/plain') {
    const texto = await chamarDrive(`files/${id}?alt=media`, accessToken, { texto: true })
    return { suportado: true, texto: texto.slice(0, LIMITE_TEXTO) }
  }

  return {
    suportado: false,
    motivo:
      `"${name}" é do tipo ${mimeType}, que ainda não é lido automaticamente (só Google Docs, Google Sheets e ` +
      `arquivos de texto puro por enquanto - PDF e imagem precisam ser abertos pelo link ou anexados manualmente ` +
      `pelo clipe na conversa).`,
    link: webViewLink || null,
  }
}
