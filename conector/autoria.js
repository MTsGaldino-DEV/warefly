/**
 * Autoria do conector. Aparece ao ligar, a cada tarefa iniciada e no /ping.
 * Toda automação nova do conector deve chamar registrarAutoria() ao começar.
 */
const { version } = require('./package.json')

const AUTORIA = {
  sistema: 'Warefly',
  autor: 'Matheus De Oliveira Galdino',
  contato: 'devmatheus94@gmail.com',
  ano: 2026,
}

function linhaAutoria() {
  return `${AUTORIA.sistema} · conector v${version} · Desenvolvido por ${AUTORIA.autor}, ${AUTORIA.ano} · ${AUTORIA.contato}`
}

/** Assinatura curta do quadro de abertura (npm start). */
const ASSINATURA = 'Desenvolvido por Matheus Galdino'

/** Quadro mostrado no terminal ao ligar o conector. */
function bannerInicio(porta) {
  const largura = 46
  const linha = (texto = '') => `║   ${texto.padEnd(largura - 3)}║`
  return [
    '',
    `╔${'═'.repeat(largura)}╗`,
    linha('Conector Warefly × GDIS'),
    linha(`Rodando em http://localhost:${porta}`),
    linha(),
    linha(ASSINATURA),
    linha(),
    linha('Deixe esta janela aberta enquanto usa.'),
    linha('Para parar: Ctrl + C'),
    `╚${'═'.repeat(largura)}╝`,
    `  ${linhaAutoria()}`,
    '',
  ].join('\n')
}

/** Linha de log com data e hora, para o início de cada tarefa. */
function registrarAutoria(tarefa, agora = new Date(), log = console.log) {
  const quando = agora.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  const linha = `[autoria] ${quando} · ${tarefa} · ${linhaAutoria()}`
  log(linha)
  return linha
}

module.exports = { AUTORIA, ASSINATURA, bannerInicio, linhaAutoria, registrarAutoria }
