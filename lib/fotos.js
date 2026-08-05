import { supabase } from './supabase'

// Categorias da galeria de fotos, compartilhadas entre a ficha do cliente
// (admin) e o portal (cliente).
export const CATEGORIA_FOTO_LABELS = {
  semanal: 'Semanal',
  visita_mensal: 'Visita mensal',
  cliente_enviou: 'Enviada por você',
  post_publicado: 'Post publicado',
}

export function categoriaFotoLabel(categoria) {
  return CATEGORIA_FOTO_LABELS[categoria] || categoria
}

export function fotoUrl(path) {
  return supabase.storage.from('fotos-clientes').getPublicUrl(path).data.publicUrl
}
