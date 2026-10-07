const { codigosPeriodo } = require('./periodo')

/** Erros do pedido de requisição; lista vazia quando está tudo certo. */
function validarPedido(pedido) {
  const { periodo, instalacao, itens } = pedido || {}
  const erros = []
  try {
    codigosPeriodo(periodo)
  } catch (e) {
    erros.push(e.message)
  }
  if (!/^\d{10}$/.test(String(instalacao ?? ''))) erros.push('A instalação deve ter 10 dígitos.')
  if (!Array.isArray(itens) || itens.length === 0) {
    erros.push('Informe ao menos um item.')
    return erros
  }
  const vistos = new Set()
  itens.forEach((item, i) => {
    const n = i + 1
    const codigo = String(item?.codigo ?? '')
    const qtd = item?.quantidade
    if (!/^\d+$/.test(codigo)) erros.push(`Item ${n}: o código "${codigo}" deve ter só números.`)
    else if (vistos.has(codigo)) erros.push(`Item ${n}: código ${codigo} repetido.`)
    vistos.add(codigo)
    if (!Number.isInteger(qtd) || qtd < 1 || qtd > 999) erros.push(`Item ${n}: a quantidade deve ser inteira, de 1 a 999.`)
  })
  return erros
}

module.exports = { validarPedido }
