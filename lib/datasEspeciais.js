// Uma data especial pode valer só pra cidade(s)/região(ões) específicas
// (feriado municipal, evento local) - o campo `cidades` guarda uma lista
// separada por vírgula. Vazio/nulo = vale pra qualquer cidade.
// Usado tanto na tela do admin (pages/datas-especiais.jsx) quanto na rota
// que alimenta o portal do cliente (pages/api/portal/datas-especiais.js),
// pra manter a mesma regra nos dois lugares.
export function dataAplicaAoCliente(dataEspecial, clienteCidade) {
  const lista = String(dataEspecial?.cidades || '')
    .split(',')
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean)
  if (lista.length === 0) return true
  return lista.includes(String(clienteCidade || '').trim().toLowerCase())
}
