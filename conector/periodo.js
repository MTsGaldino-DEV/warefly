/** "2026-05" → "0105 3005": do dia 01 ao dia 30 do mês, sem barras. */
function codigosPeriodo(periodo) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(periodo ?? ''))
  const mes = m ? Number(m[2]) : 0
  if (mes < 1 || mes > 12) throw new Error(`Período inválido: "${periodo ?? ''}". Use AAAA-MM.`)
  return `01${m[2]} 30${m[2]}`
}

function frasePeriodo(periodo) {
  return `REQUISICAO DE MATERIAIS DE MANUTENCAO PARA O PERIODO ${codigosPeriodo(periodo)}`
}

module.exports = { codigosPeriodo, frasePeriodo }
