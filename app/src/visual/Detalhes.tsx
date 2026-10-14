import { AnimatePresence, motion, useDragControls, useMotionValue } from 'motion/react'
import { createContext, useContext, useEffect, useMemo, useRef, useState, type PointerEvent as EventoPonteiro, type ReactNode, type RefObject } from 'react'
import {
  aCaminho,
  atendimento,
  BASES,
  capacidade,
  emCaixas,
  estoqueDoLocal,
  GRUPOS,
  lerCodigo,
  materiaisDo211,
  MOTIVOS_REDUCAO,
  nivelDoItem,
  nivelDoLocal,
  nomeLocal,
  RESERVAS,
  basesPadrao,
  colaborador,
  COLABORADORES,
  dataOrdenavel,
  retiradaPendente,
  retiradasDaMatricula,
  equipeDe,
  equipesDaOrigem,
  estoqueDoCarro,
  normalizarPlaca,
  podeRetirar,
  RETIRAM_DO_211,
  saldoReserva,
  SOLICITACOES,
  SUPERVISORES,
  TIPOS_EQUIPE,
  validarEquipe,
  type CodigoBase,
  type CodigoLocal,
  type Decisao,
  type Despacho,
  type ItemDespacho,
  type ItemRetirada,
  type ItemSolicitacao,
  type Nivel,
  type Equipe,
  type Retirada,
  type Solicitacao,
  type Supervisor,
  type TipoEquipe,
} from './exemplo'
import { Busca, Chave, MultiSelecao, Ordenar } from './Filtros'
import type { DocumentoGuia } from './Guia'
import { MOLA } from './movimento'
import { CampoGuiaAssinada, Contador, Icone, Trilho, type ConteudoJanela } from './Paineis'
import { CLASSE_DECISAO, ROTULO_SITUACAO, SELO_CAPACIDADE, SELO_NIVEL, subtituloLocal, TEXTO_CAPACIDADE, TEXTO_NIVEL, TOM_NIVEL, TOM_SITUACAO } from './rotulos'

export type NovoDespacho = { base: CodigoBase; solicitacao?: string; solicitacaoId?: string; veiculo: string; itens: ItemDespacho[] }
export type NovaRetirada = { equipe: string; local: CodigoLocal; retiradoPor: string; itens: ItemRetirada[]; observacao?: string }

type Props = {
  conteudo: ConteudoJanela | null
  onFechar: () => void
  /** Abre uma janela no lugar da atual (sem voltar). As janelas internas usam a versão com voltar. */
  onAbrir: (j: ConteudoJanela) => void
  onGuia: (d: DocumentoGuia) => void
  palco: RefObject<HTMLDivElement | null>
  despachos: Despacho[]
  retiradas: Retirada[]
  proximoNumero: string
  /** Despachos gerados nesta sessão, por id da solicitação. */
  geradas: Record<string, Despacho>
  arquivadas: Set<string>
  onGerar: (s: Solicitacao, aprovados: Record<string, number>) => void
  onCriarDespacho: (d: NovoDespacho) => void
  onCriarRetirada: (r: NovaRetirada) => void
  equipes: Equipe[]
  onSalvarEquipe: (e: Equipe) => void
  onAnexarGuia: (id: string, arquivo: File) => void
  /** Nome do usuário logado (responsável do almoxarifado). */
  responsavel: string
}
type Acoes = Omit<Props, 'conteudo' | 'palco'>

// Cabeçalho de qualquer janela: arrastar, voltar para a janela anterior e fechar.
type Moldura = { iniciarArraste: (e: EventoPonteiro) => void; centralizar: () => void; voltar?: { rotulo: string; acao: () => void } }
const MolduraContexto = createContext<Moldura>({ iniciarArraste: () => {}, centralizar: () => {} })

function rotuloJanela(c: ConteudoJanela): string {
  switch (c.tipo) {
    case 'analise':
      return SOLICITACOES.find((s) => s.id === c.id)?.numero ?? 'solicitação'
    case 'despacho':
      return c.despacho.numero
    case 'retirada':
      return c.retirada.numero
    case 'local':
      return c.codigo === '211' ? 'estoque central' : nomeLocal(c.codigo)
    case 'reservas':
      return 'reservas'
    case 'historico':
      return 'histórico'
    case 'novoDespacho':
      return 'novo despacho'
    case 'novaRetirada':
      return 'nova retirada'
    case 'equipe':
      return c.id ? 'editar equipe' : 'nova equipe'
    case 'resumoEquipe':
      return 'equipe'
    case 'historicoRetiradas':
      return c.matricula ? `retiradas da mat. ${c.matricula}` : 'histórico de retiradas'
  }
}

/** Janela grande no centro, por cima do mapa, arrastável pelo cabeçalho. Cada janela aberta de dentro de outra ganha "voltar". */
export function JanelaDetalhe({ conteudo, onFechar, palco, ...resto }: Props) {
  const controles = useDragControls()
  const x = useMotionValue(0)
  const y = useMotionValue(0)

  // Fechou: a próxima janela abre de novo no centro.
  useEffect(() => {
    if (conteudo) return
    x.set(0)
    y.set(0)
  }, [conteudo, x, y])

  useEffect(() => {
    if (!conteudo) return
    // Fase de captura: o Esc fecha só a janela, sem fechar a gaveta atrás. Com a guia aberta, o Esc é dela.
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.body.classList.contains('com-guia')) return
      e.stopImmediatePropagation()
      onFechar()
    }
    window.addEventListener('keydown', tecla, true)
    return () => window.removeEventListener('keydown', tecla, true)
  }, [conteudo, onFechar])

  const moldura: Moldura = {
    iniciarArraste: (e) => {
      if ((e.target as Element).closest('button, input, select, textarea, a, label')) return
      controles.start(e)
    },
    centralizar: () => {
      x.set(0)
      y.set(0)
    },
    voltar: conteudo?.voltar ? { rotulo: rotuloJanela(conteudo.voltar), acao: () => conteudo.voltar && resto.onAbrir(conteudo.voltar) } : undefined,
  }
  const abrirFilho = (j: ConteudoJanela) => conteudo && resto.onAbrir({ voltar: conteudo, ...j })
  const chave = conteudo ? `${conteudo.tipo}-${rotuloJanela(conteudo)}-${'codigo' in conteudo ? conteudo.codigo : ''}` : ''

  return (
    <AnimatePresence>
      {conteudo && (
        <>
          <motion.div key="janela-veu" className="janela-veu" onClick={onFechar} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.section
            key="janela"
            className="vidro janela"
            role="dialog"
            aria-modal="true"
            aria-label={rotuloJanela(conteudo)}
            drag
            dragControls={controles}
            dragListener={false}
            dragMomentum={false}
            dragElastic={0}
            dragConstraints={palco}
            style={{ x, y }}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={MOLA}
          >
            <MolduraContexto.Provider value={moldura}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={chave} className="janela-miolo" initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -14 }} transition={{ duration: 0.16 }}>
                  <ConteudoDaJanela conteudo={conteudo} onFechar={onFechar} {...resto} onAbrir={abrirFilho} />
                </motion.div>
              </AnimatePresence>
            </MolduraContexto.Provider>
          </motion.section>
        </>
      )}
    </AnimatePresence>
  )
}

function ConteudoDaJanela({ conteudo, ...p }: Acoes & { conteudo: ConteudoJanela }) {
  switch (conteudo.tipo) {
    case 'analise': {
      const s = SOLICITACOES.find((x) => x.id === conteudo.id)
      if (!s) return <Cab icone="caixa" titulo="Solicitação não encontrada" onFechar={p.onFechar} />
      return <JanelaAnalise s={s} {...p} />
    }
    case 'despacho':
      return <JanelaDespacho d={conteudo.despacho} {...p} />
    case 'retirada':
      // A janela guarda uma cópia; a versão viva (com a guia anexada) vem da lista.
      return <JanelaRetirada r={p.retiradas.find((x) => x.id === conteudo.retirada.id) ?? conteudo.retirada} {...p} />
    case 'historicoRetiradas':
      return <JanelaHistoricoRetiradas key={conteudo.matricula ?? ''} inicialMatricula={conteudo.matricula} {...p} />
    case 'local':
      return <JanelaLocal codigo={conteudo.codigo} {...p} />
    case 'reservas':
      return <JanelaReservas inicial={conteudo.selecionadas} onFechar={p.onFechar} />
    case 'historico':
      return <JanelaHistorico {...p} />
    case 'novoDespacho':
      return <JanelaNovoDespacho baseInicial={conteudo.base} solicitacaoInicial={conteudo.solicitacaoId} {...p} />
    case 'novaRetirada':
      return <JanelaNovaRetirada inicialMatricula={conteudo.matricula} inicialLocal={conteudo.local} {...p} />
    case 'equipe':
      return <JanelaEquipe id={conteudo.id} liberar={conteudo.liberar} matricula={conteudo.matricula} {...p} />
    case 'resumoEquipe':
      return <JanelaResumoEquipe id={conteudo.id} {...p} />
  }
}

function Cab({ icone, titulo, subtitulo, selo, onFechar }: { icone: Parameters<typeof Icone>[0]['nome']; titulo: ReactNode; subtitulo?: ReactNode; selo?: ReactNode; onFechar: () => void }) {
  const m = useContext(MolduraContexto)
  return (
    <header className="janela-cab" onPointerDown={m.iniciarArraste} onDoubleClick={m.centralizar} title="Arraste para mover. Dois cliques voltam ao centro.">
      {m.voltar ? (
        <button type="button" className="botao-quadrado" aria-label={`Voltar para ${m.voltar.rotulo}`} title={`Voltar para ${m.voltar.rotulo}`} onClick={m.voltar.acao}>
          <Icone nome="voltar" />
        </button>
      ) : (
        <span className="quadro-icone grande">
          <Icone nome={icone} />
        </span>
      )}
      <div className="janela-titulo">
        <h2>
          {titulo} {selo}
        </h2>
        {(subtitulo || m.voltar) && (
          <span className="sec">
            {m.voltar && <span className="trilha-voltar">Voltar para {m.voltar.rotulo} · </span>}
            {subtitulo}
          </span>
        )}
      </div>
      <span className="alca-arraste" aria-hidden="true">
        <Icone nome="arrastar" />
      </span>
      <button type="button" className="botao-quadrado" aria-label="Fechar" onClick={onFechar} autoFocus>
        <Icone nome="fechar" />
      </button>
    </header>
  )
}

function Bloco({ rotulo, children, tom }: { rotulo: string; children: ReactNode; tom?: string }) {
  return (
    <div className="bloco-numero">
      <span className={`numero-medio${tom ? ` ${tom}` : ''}`}>{children}</span>
      <span className="sec">{rotulo}</span>
    </div>
  )
}

function Seriais({ seriais }: { seriais?: string[] }) {
  if (!seriais?.length) return null
  return (
    <details className="seriais-v2">
      <summary>{seriais.length} seriais</summary>
      <span className="mono">{seriais.join(', ')}</span>
    </details>
  )
}

// ---------------------------------------------------------------------------
// Análise da solicitação

function decisaoDe(i: ItemSolicitacao, qtd: number): Decisao {
  if (qtd >= i.solicitado) return 'Aprovado'
  if (qtd > 0) return 'Reduzido'
  return i.disponivel === 0 ? 'Sem saldo' : 'Cancelado'
}

function despachoDe(s: Solicitacao, geradas: Record<string, Despacho>, despachos: Despacho[]): Despacho | undefined {
  return geradas[s.id] ?? despachos.find((d) => d.numero === s.despacho)
}

function JanelaAnalise({ s, geradas, despachos, proximoNumero, onGerar, onGuia, onAbrir, onFechar }: Acoes & { s: Solicitacao }) {
  const gerado = geradas[s.id]
  const despacho = despachoDe(s, geradas, despachos)
  const somenteLeitura = s.situacao === 'enviada' || s.situacao === 'divergencia' || !!gerado
  const [qtds, setQtds] = useState<Record<string, number>>(() => Object.fromEntries(s.itens.map((i) => [i.codigo, i.aprovado])))
  const [motivos, setMotivos] = useState<Record<string, string>>({})
  const [obs, setObs] = useState<Record<string, string>>({})
  const [obsGeral, setObsGeral] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  const linhas = s.itens.map((i) => {
    const limite = Math.min(i.solicitado, i.disponivel)
    const qtd = qtds[i.codigo] ?? 0
    return { i, limite, qtd, decisao: decisaoDe(i, qtd) }
  })
  const pct = atendimento(linhas.map((l) => ({ solicitado: l.i.solicitado, aprovado: l.qtd })))
  const conta = (d: Decisao[]) => linhas.filter((l) => d.includes(l.decisao)).length
  const nivelBase = nivelDoLocal(estoqueDoLocal(s.base))
  const cap = capacidade(s)

  function definir(codigo: string, valor: number, limite: number) {
    setQtds((q) => ({ ...q, [codigo]: Math.max(0, Math.min(limite, Number.isFinite(valor) ? Math.round(valor) : 0)) }))
    setErro(null)
  }

  function gerar() {
    if (!linhas.some((l) => l.qtd > 0)) {
      setErro('Nenhum material aprovado. Aprove ao menos um item para gerar o despacho.')
      return
    }
    const reduzidos = linhas.filter((l) => l.decisao === 'Reduzido' || l.decisao === 'Cancelado')
    const semMotivo = reduzidos.filter((l) => !motivos[l.i.codigo])
    if (semMotivo.length) {
      setErro(`Falta o motivo da redução em: ${semMotivo.map((l) => l.i.material).join(', ')}. Escolha o motivo na coluna Motivo.`)
      return
    }
    const outroSemTexto = reduzidos.filter((l) => motivos[l.i.codigo] === 'Outro' && !obs[l.i.codigo]?.trim())
    if (outroSemTexto.length) {
      setErro(`Motivo "Outro" precisa de observação em: ${outroSemTexto.map((l) => l.i.material).join(', ')}. Escreva o motivo no campo abaixo da escolha.`)
      return
    }
    onGerar(s, qtds)
  }

  return (
    <>
      <Cab
        icone="caixa"
        titulo={
          <>
            {s.numero} · {nomeLocal(s.base)} <span className="sec mono">{s.base}</span>
          </>
        }
        subtitulo={`Aberta em ${s.aberta} · ${s.itens.length} ${s.itens.length === 1 ? 'material' : 'materiais'}`}
        selo={
          <>
            <span className={`selo ${gerado ? 'neutro' : TOM_SITUACAO[s.situacao]}`}>{gerado ? 'Despachada' : ROTULO_SITUACAO[s.situacao]}</span>
            {!somenteLeitura && <span className={`selo ${SELO_CAPACIDADE[cap]}`}>{TEXTO_CAPACIDADE[cap]}</span>}
          </>
        }
        onFechar={onFechar}
      />
      <div className="janela-corpo duas-colunas">
        <div className="janela-principal">
          <div className="tabela-detalhe analise" role="table" aria-label="Materiais da solicitação">
            <div className="linha-detalhe cab" role="row">
              <span role="columnheader">Material</span>
              <span role="columnheader" className="num">Solicitado</span>
              <span role="columnheader" className="num">Disp. no 211</span>
              <span role="columnheader" className="num">Saldo na base</span>
              <span role="columnheader" className="num">Consumo 90 d</span>
              <span role="columnheader">Aprovar</span>
              <span role="columnheader">Situação</span>
              <span role="columnheader">Motivo e observação</span>
            </div>
            {linhas.map(({ i, limite, qtd, decisao }, n) => (
              <motion.div key={i.codigo} className="linha-detalhe" role="row" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 * n }}>
                <span role="cell" className="celula-material">
                  <strong>{i.material}</strong>
                  <span className="mono sec">{i.codigo}</span>
                </span>
                <span role="cell" className="num">
                  {i.solicitado.toLocaleString('pt-BR')} <span className="sec">{i.unidade}</span>
                </span>
                <span role="cell" className={`num${i.disponivel < i.solicitado ? ' texto-alerta' : ''}`}>
                  {i.disponivel.toLocaleString('pt-BR')}
                </span>
                <span role="cell" className="num">
                  {i.saldoBase.toLocaleString('pt-BR')}
                </span>
                <span role="cell" className="num sec">
                  {i.consumo90.toLocaleString('pt-BR')}
                </span>
                <span role="cell" className="celula-qtd">
                  {somenteLeitura ? (
                    <strong>
                      {qtd.toLocaleString('pt-BR')} <span className="sec">{i.unidade}</span>
                    </strong>
                  ) : (
                    <>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={limite}
                        value={qtd}
                        aria-label={`Quantidade aprovada de ${i.material} (até ${limite})`}
                        onChange={(e) => definir(i.codigo, Number(e.target.value), limite)}
                      />
                      <button type="button" className="mini-botao" onClick={() => definir(i.codigo, limite, limite)} disabled={qtd === limite}>
                        Máx.
                      </button>
                      <button type="button" className="mini-botao" onClick={() => definir(i.codigo, 0, limite)} disabled={qtd === 0}>
                        Zerar
                      </button>
                    </>
                  )}
                </span>
                <span role="cell">
                  <span className={`selo ${CLASSE_DECISAO[decisao]}`}>{decisao}</span>
                </span>
                <span role="cell" className="celula-motivo">
                  {decisao === 'Aprovado' ? (
                    <span className="sec">—</span>
                  ) : somenteLeitura ? (
                    <span className="sec">{[motivos[i.codigo] ?? (decisao === 'Sem saldo' ? 'Sem saldo no 211' : '—'), obs[i.codigo]].filter(Boolean).join(' · ')}</span>
                  ) : (
                    <>
                      <select
                        className="seletor-v2"
                        value={motivos[i.codigo] ?? ''}
                        aria-label={`Motivo da redução de ${i.material}`}
                        onChange={(e) => {
                          setMotivos((m) => ({ ...m, [i.codigo]: e.target.value }))
                          setErro(null)
                        }}
                      >
                        <option value="">Escolha o motivo</option>
                        {MOTIVOS_REDUCAO.map((m) => (
                          <option key={m}>{m}</option>
                        ))}
                      </select>
                      <input
                        className="campo-texto"
                        type="text"
                        placeholder={motivos[i.codigo] === 'Outro' ? 'Escreva o motivo' : 'Observação (opcional)'}
                        value={obs[i.codigo] ?? ''}
                        aria-label={`Observação sobre ${i.material}`}
                        onChange={(e) => {
                          setObs((o) => ({ ...o, [i.codigo]: e.target.value }))
                          setErro(null)
                        }}
                      />
                    </>
                  )}
                </span>
              </motion.div>
            ))}
          </div>
          <p className="nota-v2">Disponível no 211 já desconta o que está separado para outras bases. Aprovar no máximo o disponível.</p>
          {!somenteLeitura && (
            <label className="campo-bloco">
              <span>Observação geral da análise</span>
              <textarea rows={2} value={obsGeral} onChange={(e) => setObsGeral(e.target.value)} placeholder="Ex.: combinar entrega com o supervisor, material chega na quinta" />
            </label>
          )}
        </div>

        <aside className="janela-lateral">
          <div className="cartao-resumo">
            <div className="rotulo-trilho">
              <span>Atendimento</span>
              <span className="sec">{pct}%</span>
            </div>
            <div className="numero-grande">
              <Contador valor={pct} />
              <span className="unidade">% do pedido</span>
            </div>
            <Trilho pct={pct} tom={pct < 50 ? 'alerta' : 'ok'} />
            <div className="contagens">
              <span>
                <span className="ponto ok" /> {conta(['Aprovado'])} aprovados
              </span>
              <span>
                <span className="ponto transito" /> {conta(['Reduzido'])} reduzidos
              </span>
              <span>
                <span className="ponto alerta" /> {conta(['Sem saldo', 'Cancelado'])} sem atendimento
              </span>
            </div>
          </div>
          <button type="button" className="linha-simples" onClick={() => onAbrir({ tipo: 'local', codigo: s.base })}>
            <span className={`bloco-mini nivel-${nivelBase}`} aria-hidden="true" />
            <span className="corta">Estoque de {nomeLocal(s.base)}</span>
            <span className={`selo ${SELO_NIVEL[nivelBase]}`}>{TEXTO_NIVEL[nivelBase]}</span>
          </button>
          <div className="campo-v2">
            Despacho: <b className="mono">{despacho?.numero ?? proximoNumero}</b>
          </div>
          <div className="campo-v2">
            Entregar para:{' '}
            <b>
              {nomeLocal(s.base)} ({s.base})
            </b>
          </div>
          <MensagemErro erro={erro} />
          {!somenteLeitura && (
            <motion.button type="button" className="botao-v2" onClick={gerar} whileTap={{ scale: 0.97 }}>
              Aprovar e gerar despacho
            </motion.button>
          )}
          {gerado && (
            <motion.div className="botao-v2 confirmado estatico" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={MOLA}>
              <span className="botao-v2-texto">
                <Icone nome="check" /> Despacho {gerado.numero} gerado
              </span>
            </motion.div>
          )}
          {despacho && (
            <div className="pilha">
              <button type="button" className="botao-v2 claro" onClick={() => onAbrir({ tipo: 'despacho', despacho })}>
                <span className="botao-v2-texto">
                  <Icone nome="documento" /> Abrir despacho {despacho.numero}
                </span>
              </button>
              <button type="button" className="botao-v2 claro" onClick={() => onGuia({ tipo: 'despacho', despacho })}>
                <span className="botao-v2-texto">
                  <Icone nome="imprimir" /> Imprimir guia do despacho
                </span>
              </button>
              {gerado && <p className="nota-v2">A solicitação saiu da fila e está no histórico.</p>}
            </div>
          )}
        </aside>
      </div>
    </>
  )
}

function MensagemErro({ erro }: { erro: string | null }) {
  return (
    <AnimatePresence initial={false}>
      {erro && (
        <motion.p key="erro" className="erro-v2" role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
          {erro}
        </motion.p>
      )}
    </AnimatePresence>
  )
}

// ---------------------------------------------------------------------------
// Despacho para base: o que leva, por quem, para onde, quem recebeu

function JanelaDespacho({ d, onGuia, onAbrir, onFechar }: Acoes & { d: Despacho }) {
  const solicitacao = SOLICITACOES.find((s) => s.numero === d.solicitacao)
  const etapas: { titulo: string; texto: string; estado: 'feito' | 'atual' | 'pendente' | 'alerta' }[] = [
    { titulo: 'Solicitação aprovada', texto: d.solicitacao || 'Despacho sem solicitação', estado: 'feito' },
    { titulo: 'Despachado', texto: `${d.saida} · ${d.enviadoPor}${d.veiculo ? ` · ${d.veiculo}` : ''}`, estado: d.veiculo ? 'feito' : 'atual' },
    { titulo: 'Recebido na base', texto: d.recebidoPor ? `${d.recebidoEm} · ${d.recebidoPor}` : 'Aguardando chegada', estado: d.recebidoPor ? 'feito' : d.veiculo ? 'atual' : 'pendente' },
    {
      titulo: 'Conferência',
      texto: d.alerta ? `${d.conferido}% · com divergência` : d.recebidoPor ? `${d.conferido}% conferido` : 'Depois do recebimento',
      estado: d.alerta ? 'alerta' : d.conferido >= 100 ? 'feito' : d.recebidoPor ? 'atual' : 'pendente',
    },
  ]
  return (
    <>
      <Cab
        icone="caminhao"
        titulo={<span className="mono">{d.numero}</span>}
        subtitulo={`211 Geral → ${nomeLocal(d.base)} (${d.base}) · ${d.itens.length} ${d.itens.length === 1 ? 'material' : 'materiais'}`}
        selo={<span className={`selo ${d.alerta ? 'alerta' : d.recebidoPor ? 'transito' : 'ok'}`}>{d.situacao}</span>}
        onFechar={onFechar}
      />
      <div className="janela-corpo">
        <ol className="linha-tempo">
          {etapas.map((e, i) => (
            <motion.li key={e.titulo} className={e.estado} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 * i, ...MOLA }}>
              <span className="marco" aria-hidden="true">
                {e.estado === 'feito' ? <Icone nome="check" /> : i + 1}
              </span>
              <strong>{e.titulo}</strong>
              <span className="sec">{e.texto}</span>
            </motion.li>
          ))}
        </ol>
        <div className="tabela-detalhe despacho" role="table" aria-label="Materiais do despacho">
          <div className="linha-detalhe cab" role="row">
            <span role="columnheader">Código</span>
            <span role="columnheader">Material</span>
            <span role="columnheader" className="num">Enviado</span>
            <span role="columnheader" className="num">Recebido</span>
            <span role="columnheader" className="num">Diferença</span>
          </div>
          {d.itens.map((i, n) => {
            const dif = i.recebido === undefined ? null : i.recebido - i.qtd
            return (
              <motion.div key={i.codigo} className="linha-detalhe" role="row" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 * n }}>
                <span role="cell" className="mono sec">
                  {i.codigo}
                </span>
                <span role="cell" className="celula-material">
                  <span>{i.material}</span>
                  <Seriais seriais={i.seriais} />
                </span>
                <span role="cell" className="num">
                  <strong>{i.qtd.toLocaleString('pt-BR')}</strong> <span className="sec">{i.unidade}</span>
                </span>
                <span role="cell" className="num">
                  {i.recebido === undefined ? <span className="sec">—</span> : i.recebido.toLocaleString('pt-BR')}
                </span>
                <span role="cell" className={`num${dif ? ' texto-alerta' : ''}`}>
                  {dif === null ? <span className="sec">—</span> : dif === 0 ? 'Confere' : `${dif > 0 ? '+' : '−'}${Math.abs(dif).toLocaleString('pt-BR')} ${i.unidade}`}
                </span>
              </motion.div>
            )
          })}
        </div>
        <div className="janela-acoes">
          {solicitacao && (
            <button type="button" className="botao-v2 claro" onClick={() => onAbrir({ tipo: 'analise', id: solicitacao.id })}>
              <span className="botao-v2-texto">
                <Icone nome="caixa" /> Abrir solicitação {solicitacao.numero}
              </span>
            </button>
          )}
          <button type="button" className="botao-v2 claro" onClick={() => onAbrir({ tipo: 'local', codigo: d.base })}>
            <span className="botao-v2-texto">
              <Icone nome="caixa" /> Estoque de {nomeLocal(d.base)}
            </span>
          </button>
          <button type="button" className="botao-v2" onClick={() => onGuia({ tipo: 'despacho', despacho: d })}>
            <span className="botao-v2-texto">
              <Icone nome="imprimir" /> Imprimir guia
            </span>
          </button>
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Retirada no balcão

function JanelaRetirada({ r, equipes, retiradas, onGuia, onAbrir, onFechar, onAnexarGuia }: Acoes & { r: Retirada }) {
  const daMesmaMatricula = retiradasDaMatricula(retiradas, r.retiradoPor).length
  const pessoa = colaborador(r.retiradoPor)
  const equipe = equipes.find((e) => e.id === r.equipe)
  return (
    <>
      <Cab
        icone="pessoa"
        titulo={<span className="mono">{r.numero}</span>}
        subtitulo={`Retirada em ${r.local === '211' ? '211 Geral' : nomeLocal(r.local)} · ${r.data}`}
        selo={
          <>
            <span className="selo neutro">{equipe?.codigo ?? 'Sem equipe'}</span> {retiradaPendente(r) ? <span className="selo atencao">Falta guia assinada</span> : <span className="selo">Concluída</span>}
          </>
        }
        onFechar={onFechar}
      />
      <div className="janela-corpo">
        <div className="blocos-numero">
          <Bloco rotulo={`retirou · mat. ${r.retiradoPor}`}>{pessoa?.nome ?? r.retiradoPor}</Bloco>
          <Bloco rotulo="supervisão">{pessoa?.supervisor ?? equipe?.supervisor ?? '—'}</Bloco>
          <Bloco rotulo="atendido por">{r.atendidoPor}</Bloco>
          <Bloco rotulo="materiais">
            <Contador valor={r.itens.length} />
          </Bloco>
        </div>
        <div className="tabela-detalhe retirada-tab" role="table" aria-label="Materiais retirados">
          <div className="linha-detalhe cab" role="row">
            <span role="columnheader">Código</span>
            <span role="columnheader">Material</span>
            <span role="columnheader" className="num">Quantidade</span>
            <span role="columnheader">Caixas</span>
          </div>
          {r.itens.map((i, n) => (
            <motion.div key={i.codigo} className="linha-detalhe" role="row" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 * n }}>
              <span role="cell" className="mono sec">
                {i.codigo}
              </span>
              <span role="cell" className="celula-material">
                <span>{i.material}</span>
                <Seriais seriais={i.seriais} />
              </span>
              <span role="cell" className="num">
                <strong>{i.qtd.toLocaleString('pt-BR')}</strong> <span className="sec">{i.unidade}</span>
              </span>
              <span role="cell" className="sec">
                {emCaixas(i.seriais) ?? '—'}
              </span>
            </motion.div>
          ))}
        </div>
        {r.observacao && <p className="nota-v2">Observação: {r.observacao}</p>}
        <CampoGuiaAssinada r={r} onAnexar={onAnexarGuia} bloco />
        <div className="janela-acoes">
          <button type="button" className="botao-v2 claro" onClick={() => onAbrir({ tipo: 'historicoRetiradas', matricula: r.retiradoPor })}>
            <span className="botao-v2-texto">
              <Icone nome="relogio" /> Retiradas da mat. {r.retiradoPor} · {daMesmaMatricula}
            </span>
          </button>
          {equipe && (
            <button type="button" className="botao-v2 claro" onClick={() => onAbrir({ tipo: 'equipe', id: equipe.id })}>
              <span className="botao-v2-texto">
                <Icone nome="pessoa" /> Equipe {equipe.codigo}
              </span>
            </button>
          )}
          <button type="button" className="botao-v2" onClick={() => onGuia({ tipo: 'retirada', retirada: r })}>
            <span className="botao-v2-texto">
              <Icone nome="imprimir" /> Imprimir termo para assinatura
            </span>
          </button>
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Estoque de um local, em tabela, com busca e ordenação

type OrdemEstoque = 'situacao' | 'material' | 'cobertura' | 'saldo'

function JanelaLocal({ codigo, onAbrir, onFechar, despachos }: Acoes & { codigo: CodigoLocal }) {
  const [filtro, setFiltro] = useState<'todos' | Nivel>('todos')
  const [busca, setBusca] = useState('')
  const [ordem, setOrdem] = useState<OrdemEstoque>('situacao')
  const linhas = estoqueDoLocal(codigo)
  const peso: Record<Nivel, number> = { abaixo: 0, proximo: 1, ok: 2 }
  const termo = busca.trim().toLowerCase()
  const visiveis = linhas
    .filter((l) => filtro === 'todos' || nivelDoItem(l) === filtro)
    .filter((l) => !termo || `${l.material} ${l.codigo}`.toLowerCase().includes(termo))
    .sort((a, b) => {
      if (ordem === 'material') return a.material.localeCompare(b.material, 'pt-BR')
      if (ordem === 'saldo') return b.saldo - a.saldo
      if (ordem === 'cobertura') return a.saldo / a.minimo - b.saldo / b.minimo
      return peso[nivelDoItem(a)] - peso[nivelDoItem(b)]
    })
  const nivel = nivelDoLocal(linhas)
  const conta = (n: Nivel) => linhas.filter((l) => nivelDoItem(l) === n).length
  return (
    <>
      <Cab
        icone="caixa"
        titulo={
          <>
            {codigo === '211' ? '211 Geral · Estoque central' : nomeLocal(codigo)} {codigo !== '211' && <span className="sec mono">{codigo}</span>}
          </>
        }
        subtitulo={subtituloLocal(codigo)}
        selo={<span className={`selo ${SELO_NIVEL[nivel]}`}>{TEXTO_NIVEL[nivel]}</span>}
        onFechar={onFechar}
      />
      <div className="janela-corpo">
        <div className="blocos-numero">
          <Bloco rotulo="materiais">
            <Contador valor={linhas.length} />
          </Bloco>
          <Bloco rotulo="abaixo do mínimo" tom={conta('abaixo') ? 'alerta' : undefined}>
            <Contador valor={conta('abaixo')} />
          </Bloco>
          <Bloco rotulo="próximos do mínimo" tom={conta('proximo') ? 'atencao' : undefined}>
            <Contador valor={conta('proximo')} />
          </Bloco>
          <Bloco rotulo="despachos a caminho">
            <Contador valor={despachos.filter((d) => d.base === codigo).length} />
          </Bloco>
        </div>
        {codigo === '211' && <p className="nota-v2">{RETIRAM_DO_211.join(' e ')} retiram direto deste estoque. Não há estoque separado para eles.</p>}
        <div className="barra-filtros">
          <Busca valor={busca} onMudar={setBusca} placeholder="Buscar material ou código" rotulo="Buscar no estoque" />
          <div className="chips-v2" role="group" aria-label="Filtrar por situação">
            {(['todos', 'abaixo', 'proximo', 'ok'] as const).map((f) => (
              <button key={f} type="button" className="chip-v2" aria-pressed={filtro === f} onClick={() => setFiltro(f)}>
                {f !== 'todos' && <span className={`ponto nivel-${f}${f === 'ok' ? ' ok' : ''}`} />}
                {f === 'todos' ? 'Todos' : TEXTO_NIVEL[f]}
              </button>
            ))}
          </div>
          <Ordenar<OrdemEstoque>
            valor={ordem}
            onMudar={setOrdem}
            opcoes={[
              { valor: 'situacao', rotulo: 'Situação' },
              { valor: 'cobertura', rotulo: 'Menor cobertura' },
              { valor: 'saldo', rotulo: 'Maior saldo' },
              { valor: 'material', rotulo: 'Material (A–Z)' },
            ]}
          />
          {codigo !== '211' && (
            <button type="button" className="botao-v2 claro baixo largura-auto" onClick={() => onAbrir({ tipo: 'novoDespacho', base: codigo })}>
              <span className="botao-v2-texto">
                <Icone nome="caminhao" /> Novo despacho para esta base
              </span>
            </button>
          )}
        </div>
        <div className="tabela-detalhe estoque" role="table" aria-label={`Estoque de ${nomeLocal(codigo)}`}>
          <div className="linha-detalhe cab" role="row">
            <span role="columnheader">Material</span>
            <span role="columnheader" className="num">Saldo</span>
            <span role="columnheader" className="num">Mínimo</span>
            <span role="columnheader">Cobertura do mínimo</span>
            <span role="columnheader" className="num">A caminho</span>
            <span role="columnheader">Situação</span>
          </div>
          {visiveis.map((l, n) => {
            const nv = nivelDoItem(l)
            const cobertura = Math.round((l.saldo / l.minimo) * 100)
            const vindo = aCaminho(codigo, l.codigo)
            return (
              <motion.div key={l.codigo} className="linha-detalhe" role="row" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 * n }}>
                <span role="cell" className="celula-material">
                  <strong>{l.material}</strong>
                  <span className="mono sec">{l.codigo}</span>
                </span>
                <span role="cell" className={`num saldo nivel-${nv}`}>
                  {l.saldo.toLocaleString('pt-BR')} <span className="sec">{l.unidade}</span>
                </span>
                <span role="cell" className="num sec">
                  {l.minimo.toLocaleString('pt-BR')}
                </span>
                <span role="cell" className="celula-trilho">
                  <Trilho pct={Math.min(100, cobertura / 2)} tom={TOM_NIVEL[nv]} />
                  <span className="sec">{cobertura}%</span>
                </span>
                <span role="cell" className="num">
                  {vindo ? vindo.toLocaleString('pt-BR') : <span className="sec">—</span>}
                </span>
                <span role="cell">
                  <span className={`selo ${SELO_NIVEL[nv]}`}>{TEXTO_NIVEL[nv]}</span>
                </span>
              </motion.div>
            )
          })}
          {visiveis.length === 0 && <p className="vazio-v2">Nenhum material com esse filtro. Limpe a busca ou escolha outra situação.</p>}
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Reservas CEMIG: o que ainda pode ser retirado no 3256, por material, somando as reservas escolhidas

type OrdemReserva = 'material' | 'maior' | 'menor' | 'retirado'

function JanelaReservas({ inicial, onFechar }: { inicial?: string[]; onFechar: () => void }) {
  const [busca, setBusca] = useState('')
  const [selecionadas, setSelecionadas] = useState<string[]>(inicial ?? [])
  const [soComSaldo, setSoComSaldo] = useState(true)
  const [ordem, setOrdem] = useState<OrdemReserva>('maior')
  const escolhidas = selecionadas.length ? RESERVAS.filter((r) => selecionadas.includes(r.numero)) : RESERVAS

  const materiais = useMemo(() => {
    const mapa = new Map<string, { material: string; codigo: string; unidade: string; autorizado: number; retirado: number; por: { numero: string; saldo: number; alerta?: boolean }[] }>()
    for (const r of escolhidas) {
      for (const x of r.itens) {
        const m = mapa.get(x.codigo) ?? { material: x.material, codigo: x.codigo, unidade: x.unidade, autorizado: 0, retirado: 0, por: [] }
        m.autorizado += x.autorizado
        m.retirado += x.retirado
        m.por.push({ numero: r.numero, saldo: saldoReserva(x), alerta: r.alerta })
        mapa.set(x.codigo, m)
      }
    }
    return [...mapa.values()]
  }, [escolhidas])

  const termo = busca.trim().toLowerCase()
  const visiveis = materiais
    .filter((m) => !soComSaldo || m.autorizado - m.retirado > 0)
    .filter((m) => !termo || `${m.material} ${m.codigo}`.toLowerCase().includes(termo))
    .sort((a, b) => {
      const sa = a.autorizado - a.retirado
      const sb = b.autorizado - b.retirado
      if (ordem === 'material') return a.material.localeCompare(b.material, 'pt-BR')
      if (ordem === 'menor') return sa - sb
      if (ordem === 'retirado') return b.retirado / b.autorizado - a.retirado / a.autorizado
      return sb - sa
    })
  const vencendo = escolhidas.filter((r) => r.alerta).length

  return (
    <>
      <Cab icone="carteira" titulo="Reservas CEMIG" subtitulo="Saldo autorizado para retirar no 3256, por material" onFechar={onFechar} />
      <div className="janela-corpo">
        <p className="explica">Reserva é uma autorização, não estoque físico: o 3256 pode não ter o material no momento. O saldo a retirar é o autorizado menos o que já foi retirado.</p>
        <div className="blocos-numero">
          <Bloco rotulo="reservas no filtro">
            <Contador valor={escolhidas.length} />
          </Bloco>
          <Bloco rotulo="materiais com saldo">
            <Contador valor={materiais.filter((m) => m.autorizado - m.retirado > 0).length} />
          </Bloco>
          <Bloco rotulo="materiais esgotados">
            <Contador valor={materiais.filter((m) => m.autorizado - m.retirado <= 0).length} />
          </Bloco>
          <Bloco rotulo="abertas há mais de 30 dias" tom={vencendo ? 'alerta' : undefined}>
            <Contador valor={vencendo} />
          </Bloco>
        </div>
        <div className="barra-filtros">
          <Busca valor={busca} onMudar={setBusca} placeholder="Buscar material ou código (ex.: medidor)" rotulo="Buscar material nas reservas" />
          <MultiSelecao
            rotulo="Reservas"
            opcoes={RESERVAS.map((r) => ({ valor: r.numero, rotulo: r.numero, detalhe: r.alerta ? `${r.dias} dias` : r.aberta }))}
            selecionadas={selecionadas}
            onMudar={setSelecionadas}
          />
          <Chave ativo={soComSaldo} onMudar={setSoComSaldo} rotulo="Só com saldo para retirar" />
          <Ordenar<OrdemReserva>
            valor={ordem}
            onMudar={setOrdem}
            opcoes={[
              { valor: 'maior', rotulo: 'Maior saldo' },
              { valor: 'menor', rotulo: 'Menor saldo' },
              { valor: 'retirado', rotulo: 'Mais retirado' },
              { valor: 'material', rotulo: 'Material (A–Z)' },
            ]}
          />
        </div>
        <div className="tabela-detalhe reserva" role="table" aria-label="Materiais nas reservas">
          <div className="linha-detalhe cab" role="row">
            <span role="columnheader">Material</span>
            <span role="columnheader" className="num">Saldo a retirar</span>
            <span role="columnheader" className="num">Autorizado</span>
            <span role="columnheader" className="num">Retirado</span>
            <span role="columnheader">Em quais reservas</span>
            <span role="columnheader">Retirado</span>
          </div>
          {visiveis.map((m, n) => {
            const saldo = m.autorizado - m.retirado
            const pct = Math.round((m.retirado / m.autorizado) * 100)
            return (
              <motion.div key={m.codigo} className="linha-detalhe" role="row" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 * n }}>
                <span role="cell" className="celula-material">
                  <strong>{m.material}</strong>
                  <span className="mono sec">{m.codigo}</span>
                </span>
                <span role="cell" className="num">
                  {saldo > 0 ? <strong>{saldo.toLocaleString('pt-BR')}</strong> : <span className="sec">Esgotado</span>} <span className="sec">{m.unidade}</span>
                </span>
                <span role="cell" className="num sec">
                  {m.autorizado.toLocaleString('pt-BR')}
                </span>
                <span role="cell" className="num sec">
                  {m.retirado.toLocaleString('pt-BR')}
                </span>
                <span role="cell" className="celula-chips">
                  {m.por.map((p) => (
                    <span key={p.numero} className={`chip-mini${p.saldo <= 0 ? ' apagado' : ''}${p.alerta ? ' alerta' : ''}`}>
                      {p.numero} · {p.saldo.toLocaleString('pt-BR')}
                    </span>
                  ))}
                </span>
                <span role="cell" className="celula-trilho">
                  <Trilho pct={pct} />
                  <span className="sec">{pct}%</span>
                </span>
              </motion.div>
            )
          })}
          {visiveis.length === 0 && <p className="vazio-v2">Nenhum material encontrado. Confira a busca, as reservas escolhidas ou desligue "Só com saldo".</p>}
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Histórico: solicitações já despachadas

type OrdemHistorico = 'recentes' | 'antigas' | 'atendimento'

function JanelaHistorico({ arquivadas, geradas, despachos, onAbrir, onFechar }: Acoes) {
  const [busca, setBusca] = useState('')
  const [bases, setBases] = useState<string[]>([])
  const [ordem, setOrdem] = useState<OrdemHistorico>('recentes')
  const termo = busca.trim().toLowerCase()
  const pctDe = (s: Solicitacao) =>
    atendimento(geradas[s.id] ? s.itens.map((i) => ({ solicitado: i.solicitado, aprovado: geradas[s.id].itens.find((x) => x.codigo === i.codigo)?.qtd ?? 0 })) : s.itens)
  const lista = SOLICITACOES.filter((s) => arquivadas.has(s.id))
    .filter((s) => !bases.length || bases.includes(s.base))
    .filter((s) => !termo || `${s.numero} ${s.base} ${nomeLocal(s.base)} ${despachoDe(s, geradas, despachos)?.numero ?? ''}`.toLowerCase().includes(termo))
    .sort((a, b) => (ordem === 'atendimento' ? pctDe(a) - pctDe(b) : ordem === 'antigas' ? dataOrdenavel(a.aberta).localeCompare(dataOrdenavel(b.aberta)) : dataOrdenavel(b.aberta).localeCompare(dataOrdenavel(a.aberta))))
  return (
    <>
      <Cab icone="relogio" titulo="Histórico de solicitações" subtitulo="Solicitações já despachadas. Saem da fila para não poluir a lista." onFechar={onFechar} />
      <div className="janela-corpo">
        <div className="barra-filtros">
          <Busca valor={busca} onMudar={setBusca} placeholder="Buscar por SOL-, DSP- ou base" rotulo="Buscar no histórico" />
          <MultiSelecao rotulo="Bases" opcoes={BASES.map((b) => ({ valor: b.codigo, rotulo: `${b.codigo} · ${b.nome}` }))} selecionadas={bases} onMudar={setBases} />
          <Ordenar<OrdemHistorico>
            valor={ordem}
            onMudar={setOrdem}
            opcoes={[
              { valor: 'recentes', rotulo: 'Mais recentes' },
              { valor: 'antigas', rotulo: 'Mais antigas' },
              { valor: 'atendimento', rotulo: 'Menor atendimento' },
            ]}
          />
        </div>
        <div className="tabela-detalhe historico" role="table" aria-label="Histórico de solicitações">
          <div className="linha-detalhe cab" role="row">
            <span role="columnheader">Solicitação</span>
            <span role="columnheader">Base</span>
            <span role="columnheader">Aberta em</span>
            <span role="columnheader">Atendimento</span>
            <span role="columnheader">Despacho</span>
            <span role="columnheader" />
          </div>
          {lista.map((s, n) => {
            const d = despachoDe(s, geradas, despachos)
            const pct = pctDe(s)
            return (
              <motion.div key={s.id} className="linha-detalhe" role="row" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 * n }}>
                <span role="cell" className="mono">
                  {s.numero}
                </span>
                <span role="cell">
                  {nomeLocal(s.base)} <span className="sec mono">{s.base}</span>
                </span>
                <span role="cell" className="sec">
                  {s.aberta}
                </span>
                <span role="cell" className="celula-trilho">
                  <Trilho pct={pct} tom={pct < 50 ? 'alerta' : 'ok'} />
                  <span className="sec">{pct}%</span>
                </span>
                <span role="cell" className="mono">
                  {d?.numero ?? s.despacho ?? '—'}
                </span>
                <span role="cell" className="celula-acoes">
                  <button type="button" className="mini-botao" onClick={() => onAbrir({ tipo: 'analise', id: s.id })}>
                    Solicitação
                  </button>
                  {d && (
                    <button type="button" className="mini-botao" onClick={() => onAbrir({ tipo: 'despacho', despacho: d })}>
                      Despacho
                    </button>
                  )}
                </span>
              </motion.div>
            )
          })}
          {lista.length === 0 && <p className="vazio-v2">Nada encontrado. Confira o número, a base ou limpe os filtros.</p>}
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Histórico de retiradas: filtra pela matrícula para ver tudo o que a pessoa já retirou

type SituacaoGuia = 'todas' | 'pendentes' | 'concluidas'
type OrdemRetiradas = 'recentes' | 'antigas'
const TEXTO_SITUACAO_GUIA: Record<SituacaoGuia, string> = { todas: 'Todas', pendentes: 'Falta guia', concluidas: 'Concluídas' }

function JanelaHistoricoRetiradas({ retiradas, equipes, onAbrir, onFechar, inicialMatricula }: Acoes & { inicialMatricula?: string }) {
  const [matricula, setMatricula] = useState(inicialMatricula ?? '')
  const [busca, setBusca] = useState('')
  const [situacao, setSituacao] = useState<SituacaoGuia>('todas')
  const [ordem, setOrdem] = useState<OrdemRetiradas>('recentes')
  const mat = matricula.replace(/\D/g, '')
  const pessoa = mat ? colaborador(mat) : undefined
  const daPessoa = mat ? retiradasDaMatricula(retiradas, mat) : retiradas
  const termo = busca.trim().toLowerCase()
  const codigoEquipe = (r: Retirada) => equipes.find((e) => e.id === r.equipe)?.codigo ?? ''
  const lista = daPessoa
    .filter((r) => situacao === 'todas' || (situacao === 'pendentes') === retiradaPendente(r))
    .filter((r) => !termo || `${r.numero} ${colaborador(r.retiradoPor)?.nome ?? ''} ${codigoEquipe(r)} ${r.local} ${r.itens.map((i) => `${i.material} ${i.codigo}`).join(' ')}`.toLowerCase().includes(termo))
    .sort((a, b) => (ordem === 'antigas' ? -1 : 1) * dataOrdenavel(b.data).localeCompare(dataOrdenavel(a.data)))
  const conta = (sit: SituacaoGuia) => daPessoa.filter((r) => sit === 'todas' || (sit === 'pendentes') === retiradaPendente(r)).length
  const unidades = daPessoa.reduce((t, r) => t + r.itens.reduce((u, i) => u + i.qtd, 0), 0)
  return (
    <>
      <Cab icone="relogio" titulo="Histórico de retiradas" subtitulo="Retiradas no balcão. Digite a matrícula para ver tudo o que a pessoa já retirou." onFechar={onFechar} />
      <div className="janela-corpo">
        <div className="barra-filtros">
          <label className="campo-matricula">
            <span className="sec">Matrícula</span>
            <input className="campo-texto mono" inputMode="numeric" value={matricula} onChange={(e) => setMatricula(e.target.value)} placeholder="Ex.: 52210" aria-label="Filtrar por matrícula" />
            {matricula && (
              <button type="button" className="mini-botao" aria-label="Limpar matrícula" onClick={() => setMatricula('')}>
                <Icone nome="fechar" />
              </button>
            )}
          </label>
          <Busca valor={busca} onMudar={setBusca} placeholder="Buscar por DSP-, nome, equipe ou material" rotulo="Buscar nas retiradas" />
          <div className="chips-v2" role="group" aria-label="Filtrar pela guia assinada">
            {(['todas', 'pendentes', 'concluidas'] as const).map((f) => (
              <button key={f} type="button" className="chip-v2" aria-pressed={situacao === f} onClick={() => setSituacao(f)}>
                {f === 'pendentes' && <span className="ponto atencao" />}
                {f === 'concluidas' && <span className="ponto ok" />}
                {TEXTO_SITUACAO_GUIA[f]} <span className="sec">{conta(f)}</span>
              </button>
            ))}
          </div>
          <Ordenar<OrdemRetiradas>
            valor={ordem}
            onMudar={setOrdem}
            opcoes={[
              { valor: 'recentes', rotulo: 'Mais recentes' },
              { valor: 'antigas', rotulo: 'Mais antigas' },
            ]}
          />
        </div>
        {mat.length >= 4 &&
          (pessoa ? (
            <motion.div className="identidade" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={MOLA}>
              <span className="avatar" aria-hidden="true">
                {pessoa.nome
                  .split(' ')
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join('')}
              </span>
              <div className="identidade-texto">
                <strong>{pessoa.nome}</strong>
                <span className="sec">
                  Mat. {mat} · supervisão {pessoa.supervisor}
                  {equipeDe(mat, equipes) ? ` · ${equipeDe(mat, equipes)?.codigo}` : ''}
                </span>
              </div>
              <div className="blocos-numero compacto">
                <Bloco rotulo="retiradas">
                  <Contador valor={daPessoa.length} />
                </Bloco>
                <Bloco rotulo="falta guia">
                  <Contador valor={conta('pendentes')} />
                </Bloco>
                <Bloco rotulo="unidades retiradas">
                  <Contador valor={unidades} />
                </Bloco>
              </div>
            </motion.div>
          ) : (
            <p className="erro-v2">Matrícula {mat} não está na lista de colaboradores. Confira o número.</p>
          ))}
        <div className="tabela-detalhe historico-retiradas" role="table" aria-label="Histórico de retiradas">
          <div className="linha-detalhe cab" role="row">
            <span role="columnheader">Retirada</span>
            <span role="columnheader">Retirou</span>
            <span role="columnheader">Equipe</span>
            <span role="columnheader">Local</span>
            <span role="columnheader">Data</span>
            <span role="columnheader">Guia assinada</span>
            <span role="columnheader" />
          </div>
          {lista.map((r, n) => (
            <motion.div key={r.id} className="linha-detalhe" role="row" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 * n }}>
              <span role="cell" className="mono">
                {r.numero}
              </span>
              <span role="cell" className="celula-material">
                <span>{colaborador(r.retiradoPor)?.nome ?? '—'}</span>
                {mat === r.retiradoPor ? (
                  <span className="sec mono">mat. {r.retiradoPor}</span>
                ) : (
                  <button type="button" className="link-matricula mono" title="Ver todas as retiradas desta matrícula" onClick={() => setMatricula(r.retiradoPor)}>
                    mat. {r.retiradoPor}
                  </button>
                )}
              </span>
              <span role="cell">{codigoEquipe(r) || '—'}</span>
              <span role="cell">{r.local === '211' ? '211 Geral' : nomeLocal(r.local)}</span>
              <span role="cell" className="sec">
                {r.data}
              </span>
              <span role="cell">{r.guiaAssinada ? <span className="selo">Anexada</span> : <span className="selo atencao">Falta guia</span>}</span>
              <span role="cell" className="celula-acoes">
                <button type="button" className="mini-botao" onClick={() => onAbrir({ tipo: 'retirada', retirada: r })}>
                  Abrir
                </button>
              </span>
            </motion.div>
          ))}
          {lista.length === 0 && <p className="vazio-v2">{mat && !daPessoa.length ? `Nenhuma retirada para a matrícula ${mat}.` : 'Nada encontrado. Confira o número ou limpe os filtros.'}</p>}
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Equipe vista pelo mapa da base: quem é, onde retira, o que está no carro e as últimas retiradas

function JanelaResumoEquipe({ id, equipes, retiradas, onAbrir, onFechar }: Acoes & { id: string }) {
  const e = equipes.find((x) => x.id === id)
  if (!e) return <Cab icone="pessoa" titulo="Equipe não encontrada" subtitulo="Ela pode ter sido removida. Feche e abra pelo menu Equipes." onFechar={onFechar} />
  const carro = estoqueDoCarro(e.id, retiradas)
  const recentes = retiradas.filter((r) => r.equipe === e.id).sort((a, b) => dataOrdenavel(b.data).localeCompare(dataOrdenavel(a.data)))
  const unidades = carro.reduce((t, i) => t + i.qtd, 0)
  const colegas = equipesDaOrigem(e.origem, equipes).length - 1
  return (
    <>
      <Cab
        icone={e.tipo === 'Moto' ? 'moto' : 'caminhao'}
        titulo={e.codigo}
        subtitulo={`${e.tipo} · supervisão ${e.supervisor} · base de origem ${e.origem === '211' ? '211 Geral' : `${e.origem} · ${nomeLocal(e.origem)}`}${colegas > 0 ? ` com mais ${colegas} ${colegas === 1 ? 'equipe' : 'equipes'}` : ''}`}
        selo={<span className="selo neutro mono">{e.placa}</span>}
        onFechar={onFechar}
      />
      <div className="janela-corpo duas-colunas">
        <div className="janela-principal">
          <div className="blocos-numero">
            <Bloco rotulo="integrantes">
              <Contador valor={e.integrantes.length} />
            </Bloco>
            <Bloco rotulo="materiais no carro">
              <Contador valor={carro.length} />
            </Bloco>
            <Bloco rotulo="unidades no carro">
              <Contador valor={unidades} />
            </Bloco>
            <Bloco rotulo="retiradas">
              <Contador valor={recentes.length} />
            </Bloco>
          </div>
          <section className="secao-janela" aria-label="Estoque do carro">
            <h3>
              Estoque do carro <span className="sec">· soma do que a equipe retirou</span>
            </h3>
            <div className="tabela-detalhe carro-tab" role="table" aria-label="Material no carro">
              <div className="linha-detalhe cab" role="row">
                <span role="columnheader">Código</span>
                <span role="columnheader">Material</span>
                <span role="columnheader" className="num">
                  Quantidade
                </span>
                <span role="columnheader">Caixas</span>
              </div>
              {carro.map((i, n) => (
                <motion.div key={i.codigo} className="linha-detalhe" role="row" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 * n }}>
                  <span role="cell" className="mono sec">
                    {i.codigo}
                  </span>
                  <span role="cell" className="celula-material">
                    <span>{i.material}</span>
                    <Seriais seriais={i.seriais} />
                  </span>
                  <span role="cell" className="num">
                    <strong>{i.qtd.toLocaleString('pt-BR')}</strong> <span className="sec">{i.unidade}</span>
                  </span>
                  <span role="cell" className="sec">
                    {emCaixas(i.seriais) ?? '—'}
                  </span>
                </motion.div>
              ))}
              {carro.length === 0 && <p className="vazio-v2">Nada no carro: a equipe ainda não retirou material.</p>}
            </div>
            <p className="nota-v2">O que foi aplicado em campo ainda não é descontado. Essa baixa entra quando ligarmos ao sistema real.</p>
          </section>
          <section className="secao-janela" aria-label="Retiradas recentes">
            <h3>Retiradas recentes</h3>
            <div className="tabela-detalhe retiradas-equipe" role="table" aria-label="Retiradas da equipe">
              {recentes.slice(0, 6).map((r) => (
                <div key={r.id} className="linha-detalhe" role="row">
                  <span role="cell" className="mono">
                    {r.numero}
                  </span>
                  <span role="cell">{colaborador(r.retiradoPor)?.nome ?? r.retiradoPor}</span>
                  <span role="cell" className="sec">
                    {r.local === '211' ? '211 Geral' : nomeLocal(r.local)} · {r.data}
                  </span>
                  <span role="cell">{r.guiaAssinada ? <span className="selo">Anexada</span> : <span className="selo atencao">Falta guia</span>}</span>
                  <span role="cell" className="celula-acoes">
                    <button type="button" className="mini-botao" onClick={() => onAbrir({ tipo: 'retirada', retirada: r })}>
                      Abrir
                    </button>
                  </span>
                </div>
              ))}
              {recentes.length === 0 && <p className="vazio-v2">Nenhuma retirada registrada para esta equipe.</p>}
            </div>
          </section>
        </div>
        <aside className="janela-lateral">
          <div className="campo-bloco">
            <span>Integrantes</span>
            <div className="lista-integrantes coluna">
              {e.integrantes.map((mt) => {
                const c = colaborador(mt)
                return (
                  <button key={mt} type="button" className="integrante clicavel" title="Ver todas as retiradas desta matrícula" onClick={() => onAbrir({ tipo: 'historicoRetiradas', matricula: mt })}>
                    <strong>{c?.nome ?? 'Não encontrado'}</strong>
                    <span className="sec mono">mat. {mt}</span>
                  </button>
                )
              })}
            </div>
          </div>
          <div className="campo-bloco">
            <span>Retira em</span>
            <div className="chips-bases">
              <span className="chip-base forte">211 Geral</span>
              {e.bases.length >= BASES.length ? (
                <span className="chip-base">todas as bases</span>
              ) : (
                e.bases.map((b) => (
                  <span key={b} className={`chip-base${b === e.origem ? ' forte' : ''}`} title={nomeLocal(b)}>
                    {b}
                  </span>
                ))
              )}
            </div>
          </div>
          <button type="button" className="botao-v2 claro" onClick={() => onAbrir({ tipo: 'equipe', id: e.id })}>
            <span className="botao-v2-texto">
              <Icone nome="lapis" /> Editar equipe
            </span>
          </button>
          <button type="button" className="botao-v2" onClick={() => onAbrir({ tipo: 'novaRetirada', matricula: e.integrantes[0], local: e.origem })}>
            <span className="botao-v2-texto">
              <Icone nome="mais" /> Nova retirada para esta equipe
            </span>
          </button>
        </aside>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Montagem de itens (novo despacho e nova retirada): busca de material, leitor de código e quantidades

type LinhaNova = { codigo: string; qtd: number; seriais: string[] }

function EditorItens({ linhas, setLinhas, usados, local = '211' }: { linhas: LinhaNova[]; setLinhas: (f: (l: LinhaNova[]) => LinhaNova[]) => void; usados: Map<string, string>; local?: CodigoLocal }) {
  const catalogo = useMemo(() => materiaisDo211(local), [local])
  const [busca, setBusca] = useState('')
  const [codigoLido, setCodigoLido] = useState('')
  const [aviso, setAviso] = useState<{ tom: 'ok' | 'erro'; texto: string } | null>(null)
  const leitor = useRef<HTMLInputElement>(null)
  const termo = busca.trim().toLowerCase()
  const sugestoes = termo ? catalogo.filter((m) => `${m.material} ${m.codigo}`.toLowerCase().includes(termo)).slice(0, 6) : []
  const temSerializado = linhas.some((l) => catalogo.find((m) => m.codigo === l.codigo)?.serializado)

  function adicionar(codigo: string) {
    setLinhas((ls) => (ls.some((l) => l.codigo === codigo) ? ls : [...ls, { codigo, qtd: 0, seriais: [] }]))
    setBusca('')
    if (catalogo.find((m) => m.codigo === codigo)?.serializado) window.setTimeout(() => leitor.current?.focus(), 50)
  }

  function ler() {
    const bruto = codigoLido.trim()
    if (!bruto) return
    const lido = lerCodigo(bruto)
    setCodigoLido('')
    if (lido.tipo === 'desconhecido') {
      setAviso({ tom: 'erro', texto: `Código ${bruto} não encontrado. Confira a etiqueta da caixa ou digite o serial.` })
      return
    }
    const novos = lido.tipo === 'caixa' ? lido.seriais : [lido.serial]
    const jaSaiu = novos.find((x) => usados.has(x))
    if (jaSaiu) {
      setAviso({ tom: 'erro', texto: `O serial ${jaSaiu} já saiu no ${usados.get(jaSaiu)}. Confira a caixa antes de entregar.` })
      return
    }
    const atual = linhas.find((l) => l.codigo === lido.codigo)?.seriais ?? []
    const adicionados = novos.filter((x) => !atual.includes(x))
    if (!adicionados.length) {
      setAviso({ tom: 'erro', texto: lido.tipo === 'caixa' ? `A caixa ${lido.caixa} já está na lista.` : `O serial ${lido.serial} já está na lista.` })
      return
    }
    setLinhas((ls) => {
      const existe = ls.some((l) => l.codigo === lido.codigo)
      const base = existe ? ls : [...ls, { codigo: lido.codigo, qtd: 0, seriais: [] }]
      return base.map((l) => (l.codigo === lido.codigo ? { ...l, seriais: [...l.seriais, ...adicionados], qtd: l.seriais.length + adicionados.length } : l))
    })
    setAviso({ tom: 'ok', texto: lido.tipo === 'caixa' ? `Caixa ${lido.caixa}: ${adicionados.length} seriais adicionados.` : `Serial ${lido.serial} adicionado.` })
  }

  return (
    <div className="editor-itens">
      <div className="barra-filtros">
        <div className="seletor-material">
          <Busca valor={busca} onMudar={setBusca} placeholder="Adicionar material: digite nome ou código" rotulo={`Buscar material no estoque de ${nomeLocal(local)}`} />
          <AnimatePresence>
            {sugestoes.length > 0 && (
              <motion.ul className="sugestoes vidro" role="listbox" aria-label="Materiais encontrados" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>
                {sugestoes.map((m) => (
                  <li key={m.codigo}>
                    <button type="button" role="option" aria-selected={false} onClick={() => adicionar(m.codigo)}>
                      <span className="corta">{m.material}</span>
                      <span className="mono sec">{m.codigo}</span>
                      <span className="sec">
                        {m.saldo.toLocaleString('pt-BR')} {m.unidade}
                      </span>
                    </button>
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
        <label className="busca-v2 leitor">
          <Icone nome="leitor" />
          <input
            ref={leitor}
            type="text"
            placeholder="Bipe a caixa de medidor ou o serial"
            value={codigoLido}
            onChange={(e) => setCodigoLido(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                ler()
              }
            }}
            aria-label="Leitor de código de barras: caixa ou serial"
          />
        </label>
      </div>
      <AnimatePresence initial={false}>
        {aviso && (
          <motion.p key={aviso.texto} className={aviso.tom === 'erro' ? 'erro-v2' : 'ok-v2'} role="status" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            {aviso.texto}
          </motion.p>
        )}
      </AnimatePresence>
      {!temSerializado && <p className="nota-v2">Medidor sai por serial: bipe a caixa (entram todos os seriais dela) ou um serial avulso. O leitor digita o código e confirma sozinho.</p>}
      <div className="tabela-detalhe novo" role="table" aria-label="Materiais desta saída">
        <div className="linha-detalhe cab" role="row">
          <span role="columnheader">Material</span>
          <span role="columnheader" className="num">Saldo no local</span>
          <span role="columnheader">Quantidade</span>
          <span role="columnheader">Caixas e seriais</span>
          <span role="columnheader" />
        </div>
        {linhas.map((l) => {
          const m = catalogo.find((x) => x.codigo === l.codigo)
          if (!m) return null
          const acima = l.qtd > m.saldo
          return (
            <motion.div key={l.codigo} className="linha-detalhe" role="row" layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <span role="cell" className="celula-material">
                <strong>{m.material}</strong>
                <span className="mono sec">{m.codigo}</span>
              </span>
              <span role="cell" className="num sec">
                {m.saldo.toLocaleString('pt-BR')} {m.unidade}
              </span>
              <span role="cell" className="celula-qtd">
                {m.serializado ? (
                  <strong>
                    {l.qtd} <span className="sec">{m.unidade} (pelos seriais)</span>
                  </strong>
                ) : (
                  <>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={l.qtd}
                      className={acima ? 'invalido' : undefined}
                      aria-label={`Quantidade de ${m.material}`}
                      onChange={(e) => setLinhas((ls) => ls.map((x) => (x.codigo === l.codigo ? { ...x, qtd: Math.max(0, Math.round(Number(e.target.value) || 0)) } : x)))}
                    />
                    <span className="sec">{m.unidade}</span>
                  </>
                )}
              </span>
              <span role="cell" className="celula-material">
                <span className="sec">{emCaixas(l.seriais) ?? (m.serializado ? 'Bipe uma caixa' : '—')}</span>
                {l.seriais.length > 0 && (
                  <span className="seriais-chips">
                    {l.seriais.slice(0, 4).map((x) => (
                      <button
                        key={x}
                        type="button"
                        className="chip-mini"
                        title="Tirar este serial"
                        onClick={() => setLinhas((ls) => ls.map((y) => (y.codigo === l.codigo ? { ...y, seriais: y.seriais.filter((z) => z !== x), qtd: y.seriais.length - 1 } : y)))}
                      >
                        {x} ×
                      </button>
                    ))}
                    {l.seriais.length > 4 && <span className="chip-mini apagado">+{l.seriais.length - 4}</span>}
                  </span>
                )}
                {acima && <span className="texto-alerta">Acima do saldo do local</span>}
              </span>
              <span role="cell">
                <button type="button" className="botao-quadrado peq" aria-label={`Tirar ${m.material}`} onClick={() => setLinhas((ls) => ls.filter((x) => x.codigo !== l.codigo))}>
                  <Icone nome="lixo" />
                </button>
              </span>
            </motion.div>
          )
        })}
        {linhas.length === 0 && <p className="vazio-v2">Nenhum material ainda. Busque pelo nome ou bipe uma caixa.</p>}
      </div>
    </div>
  )
}

function validarItens(linhas: LinhaNova[], local: CodigoLocal = '211'): string | null {
  const catalogo = materiaisDo211(local)
  if (!linhas.length) return 'Nenhum material na lista. Adicione ao menos um.'
  const zerado = linhas.find((l) => l.qtd <= 0)
  if (zerado) return `Quantidade zerada em ${catalogo.find((m) => m.codigo === zerado.codigo)?.material}. Informe a quantidade ou tire o material.`
  const acima = linhas.find((l) => l.qtd > (catalogo.find((m) => m.codigo === l.codigo)?.saldo ?? 0))
  if (acima) return `${catalogo.find((m) => m.codigo === acima.codigo)?.material} passa do saldo de ${nomeLocal(local)}. Diminua a quantidade.`
  return null
}

function paraItens(linhas: LinhaNova[], local: CodigoLocal = '211') {
  const catalogo = materiaisDo211(local)
  return linhas.map((l) => {
    const m = catalogo.find((x) => x.codigo === l.codigo)
    return { material: m?.material ?? l.codigo, codigo: l.codigo, unidade: m?.unidade ?? '', qtd: l.qtd, ...(l.seriais.length ? { seriais: l.seriais } : {}) }
  })
}

const soDigitos = (v: string) => v.replace(/\D/g, '')

function useSeriaisUsados(despachos: Despacho[], retiradas: Retirada[]) {
  return useMemo(() => {
    const m = new Map<string, string>()
    for (const d of despachos) for (const i of d.itens) for (const x of i.seriais ?? []) m.set(x, d.numero)
    for (const r of retiradas) for (const i of r.itens) for (const x of i.seriais ?? []) m.set(x, r.numero)
    return m
  }, [despachos, retiradas])
}

// ---------------------------------------------------------------------------
// Novo despacho para base

function JanelaNovoDespacho({ baseInicial, solicitacaoInicial, arquivadas, despachos, retiradas, proximoNumero, responsavel, onCriarDespacho, onFechar }: Acoes & { baseInicial?: CodigoBase; solicitacaoInicial?: string }) {
  const [base, setBase] = useState<CodigoBase | ''>(baseInicial ?? '')
  const [solicitacaoId, setSolicitacaoId] = useState(solicitacaoInicial ?? '')
  const [linhas, setLinhasEstado] = useState<LinhaNova[]>([])
  const [veiculo, setVeiculo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const usados = useSeriaisUsados(despachos, retiradas)
  const pendentes = SOLICITACOES.filter((s) => s.base === base && !arquivadas.has(s.id) && (s.situacao === 'aguardando' || s.situacao === 'aprovada'))
  const setLinhas = (f: (l: LinhaNova[]) => LinhaNova[]) => {
    setLinhasEstado(f)
    setErro(null)
  }

  function usarSolicitacao(id: string) {
    setSolicitacaoId(id)
    const s = SOLICITACOES.find((x) => x.id === id)
    if (s) setLinhasEstado(s.itens.filter((i) => i.aprovado > 0).map((i) => ({ codigo: i.codigo, qtd: i.aprovado, seriais: [] })))
  }

  function gerar() {
    if (!base) return setErro('Escolha a base de destino.')
    const e = validarItens(linhas)
    if (e) return setErro(e)
    const s = SOLICITACOES.find((x) => x.id === solicitacaoId)
    onCriarDespacho({ base, solicitacao: s?.numero, solicitacaoId: s?.id, veiculo: veiculo.trim().toUpperCase(), itens: paraItens(linhas) })
  }

  const totalItens = linhas.reduce((t, l) => t + l.qtd, 0)
  return (
    <>
      <Cab icone="caminhao" titulo="Novo despacho para base" subtitulo={`Será o ${proximoNumero}`} onFechar={onFechar} />
      <div className="janela-corpo duas-colunas">
        <div className="janela-principal">
          <div className="grade-campos">
            <label className="campo-bloco">
              <span>Base de destino</span>
              <select
                className="seletor-v2"
                value={base}
                onChange={(e) => {
                  setBase(e.target.value as CodigoBase)
                  setSolicitacaoId('')
                  setErro(null)
                }}
              >
                <option value="">Escolha a base</option>
                {GRUPOS.map((g) => (
                  <optgroup key={g.id} label={g.rotulo}>
                    {g.bases.map((b) => (
                      <option key={b} value={b}>
                        {b} · {nomeLocal(b)}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <label className="campo-bloco">
              <span>Atender uma solicitação (opcional)</span>
              <select className="seletor-v2" value={solicitacaoId} disabled={!base} onChange={(e) => usarSolicitacao(e.target.value)}>
                <option value="">{base ? (pendentes.length ? 'Sem solicitação' : 'Nenhuma solicitação na fila desta base') : 'Escolha a base primeiro'}</option>
                {pendentes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.numero} · {ROTULO_SITUACAO[s.situacao]} · {TEXTO_CAPACIDADE[capacidade(s)]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {solicitacaoId && <p className="nota-v2">Itens preenchidos com o aprovado na solicitação. Ajuste se precisar.</p>}
          <EditorItens linhas={linhas} setLinhas={setLinhas} usados={usados} />
        </div>
        <aside className="janela-lateral">
          <div className="cartao-resumo">
            <span className="sec">Resumo</span>
            <strong className="resumo-destino">{base ? `${base} · ${nomeLocal(base)}` : 'Base não escolhida'}</strong>
            <div className="contagens">
              <span>
                {linhas.length} {linhas.length === 1 ? 'material' : 'materiais'}
              </span>
              <span>{totalItens.toLocaleString('pt-BR')} itens no total</span>
            </div>
          </div>
          <label className="campo-bloco">
            <span>Veículo (placa)</span>
            <input className="campo-texto" value={veiculo} onChange={(e) => setVeiculo(e.target.value)} placeholder="Ex.: QXP-4E21" />
          </label>
          <div className="campo-v2">
            Despachado por: <b>{responsavel}</b>
          </div>
          <MensagemErro erro={erro} />
          <motion.button type="button" className="botao-v2" onClick={gerar} whileTap={{ scale: 0.97 }}>
            <span className="botao-v2-texto">
              <Icone nome="imprimir" /> Gerar despacho e imprimir guia
            </span>
          </motion.button>
        </aside>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Nova retirada: a matrícula traz o nome, a supervisão e a equipe; a equipe só retira nas bases liberadas

function JanelaNovaRetirada({ despachos, retiradas, equipes, responsavel, proximoNumero, onCriarRetirada, onAbrir, onFechar, inicialMatricula, inicialLocal }: Acoes & { inicialMatricula?: string; inicialLocal?: CodigoLocal }) {
  const [mat, setMat] = useState(inicialMatricula ?? '')
  const [local, setLocal] = useState<CodigoLocal>(inicialLocal ?? '211')
  const [observacao, setObservacao] = useState('')
  const [linhas, setLinhasEstado] = useState<LinhaNova[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const usados = useSeriaisUsados(despachos, retiradas)
  const digitos = soDigitos(mat)
  const pessoa = colaborador(digitos)
  const equipe = pessoa ? equipeDe(digitos, equipes) : undefined
  const liberado = equipe ? podeRetirar(equipe, local) : false
  const setLinhas = (f: (l: LinhaNova[]) => LinhaNova[]) => {
    setLinhasEstado(f)
    setErro(null)
  }
  // Ao sair para outra janela (cadastro ou liberação), a volta traz a matrícula e o local de novo.
  const aqui: ConteudoJanela = { tipo: 'novaRetirada', matricula: digitos, local }

  function registrar() {
    if (!pessoa) return setErro('Informe uma matrícula da lista de colaboradores.')
    if (!equipe) return setErro(`${pessoa.nome} não está em nenhuma equipe. Cadastre a equipe antes de retirar.`)
    if (!liberado) return setErro(`A equipe ${equipe.codigo} não tem acesso a ${nomeLocal(local)}. Libere a base na equipe ou retire no 211 Geral.`)
    const e = validarItens(linhas, local)
    if (e) return setErro(e)
    onCriarRetirada({ equipe: equipe.id, local, retiradoPor: digitos, itens: paraItens(linhas, local), observacao: observacao.trim() || undefined })
  }

  return (
    <>
      <Cab icone="pessoa" titulo="Nova retirada" subtitulo={`Será o ${proximoNumero} · atendido por ${responsavel}`} onFechar={onFechar} />
      <div className="janela-corpo duas-colunas">
        <div className="janela-principal">
          <div className="grade-campos">
            <label className="campo-bloco">
              <span>Matrícula de quem retira</span>
              <input
                className="campo-texto grande"
                inputMode="numeric"
                value={mat}
                onChange={(e) => {
                  setMat(e.target.value)
                  setErro(null)
                }}
                placeholder="Ex.: 52210"
                autoFocus
              />
            </label>
            <label className="campo-bloco">
              <span>Onde está retirando</span>
              <select
                className="seletor-v2 grande"
                value={local}
                onChange={(e) => {
                  setLocal(e.target.value as CodigoLocal)
                  setLinhasEstado([])
                  setErro(null)
                }}
              >
                <option value="211">211 Geral (todas as equipes)</option>
                {GRUPOS.map((g) => (
                  <optgroup key={g.id} label={g.rotulo}>
                    {g.bases.map((b) => (
                      <option key={b} value={b}>
                        {b} · {nomeLocal(b)}
                        {equipe && !equipe.bases.includes(b) ? ' (sem acesso)' : ''}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
          </div>
          <IdentidadeRetirada digitos={digitos} pessoa={pessoa} equipe={equipe} local={local} liberado={liberado} onAbrir={onAbrir} aqui={aqui} />
          <EditorItens linhas={linhas} setLinhas={setLinhas} usados={usados} local={local} />
          <label className="campo-bloco">
            <span>Observação (opcional)</span>
            <textarea rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Ex.: troca de medidor na rua X, OS 12345" />
          </label>
        </div>
        <aside className="janela-lateral">
          <div className="cartao-resumo">
            <span className="sec">Resumo</span>
            <strong className="resumo-destino">{pessoa?.nome ?? 'Matrícula não informada'}</strong>
            <div className="contagens">
              <span>{equipe ? `${equipe.codigo} · ${equipe.tipo}` : 'Sem equipe'}</span>
              <span>Retirando em {local === '211' ? '211 Geral' : nomeLocal(local)}</span>
              <span>
                {linhas.length} {linhas.length === 1 ? 'material' : 'materiais'} · {linhas.reduce((t, l) => t + l.seriais.length, 0)} seriais
              </span>
            </div>
          </div>
          <div className="campo-v2">
            Atendido por: <b>{responsavel}</b>
          </div>
          <MensagemErro erro={erro} />
          <motion.button type="button" className="botao-v2" onClick={registrar} whileTap={{ scale: 0.97 }} disabled={!!equipe && !liberado}>
            <span className="botao-v2-texto">
              <Icone nome="imprimir" /> Registrar e imprimir termo
            </span>
          </motion.button>
          <p className="nota-v2">O termo sai com os nomes preenchidos e os seriais para quem retira assinar.</p>
        </aside>
      </div>
    </>
  )
}

function IdentidadeRetirada({
  digitos,
  pessoa,
  equipe,
  local,
  liberado,
  onAbrir,
  aqui,
}: {
  digitos: string
  pessoa?: { nome: string; supervisor: Supervisor }
  equipe?: Equipe
  local: CodigoLocal
  liberado: boolean
  onAbrir: (j: ConteudoJanela) => void
  aqui: ConteudoJanela
}) {
  if (digitos.length < 4) return <p className="nota-v2">Digite a matrícula: aparecem o nome, a supervisão e a equipe da pessoa.</p>
  if (!pessoa) return <p className="erro-v2">Matrícula {digitos} não está na lista de colaboradores. Confira o número.</p>
  return (
    <motion.div className={`identidade${equipe && !liberado ? ' bloqueada' : ''}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={MOLA}>
      <span className="avatar" aria-hidden="true">
        {pessoa.nome
          .split(' ')
          .map((p) => p[0])
          .slice(0, 2)
          .join('')}
      </span>
      <div className="identidade-texto">
        <strong>{pessoa.nome}</strong>
        <span className="sec">
          Mat. {digitos} · supervisão {pessoa.supervisor}
          {equipe ? ` · ${equipe.codigo} (${equipe.tipo}) · placa ${equipe.placa}` : ''}
        </span>
        {equipe && (
          <span className={liberado ? 'texto-ok' : 'texto-alerta'}>
            {local === '211'
              ? 'Todas as equipes retiram no 211 Geral.'
              : liberado
                ? `Equipe liberada para retirar em ${nomeLocal(local)}.`
                : `Equipe sem acesso a ${nomeLocal(local)}.`}
          </span>
        )}
        {!equipe && <span className="texto-alerta">Não está em nenhuma equipe. Cadastre a equipe para poder retirar.</span>}
      </div>
      {equipe && !liberado && local !== '211' && (
        <button type="button" className="botao-v2 claro baixo largura-auto" onClick={() => onAbrir({ tipo: 'equipe', id: equipe.id, liberar: local as CodigoBase, voltar: aqui })}>
          <span className="botao-v2-texto">
            <Icone nome="check" /> Liberar acesso a {local}
          </span>
        </button>
      )}
      {!equipe && (
        <button type="button" className="botao-v2 claro baixo largura-auto" onClick={() => onAbrir({ tipo: 'equipe', matricula: digitos, voltar: aqui })}>
          <span className="botao-v2-texto">
            <Icone nome="mais" /> Cadastrar equipe
          </span>
        </button>
      )}
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Cadastro e edição de equipe: tudo obrigatório

function JanelaEquipe({ id, liberar, matricula, equipes, onSalvarEquipe, onFechar }: Acoes & { id?: string; liberar?: CodigoBase; matricula?: string }) {
  const m = useContext(MolduraContexto)
  const atual = equipes.find((e) => e.id === id)
  const [codigo, setCodigo] = useState(atual?.codigo ?? '')
  const [tipo, setTipo] = useState<TipoEquipe | ''>(atual?.tipo ?? '')
  const [supervisor, setSupervisor] = useState<Supervisor | ''>(atual?.supervisor ?? (matricula ? (colaborador(matricula)?.supervisor ?? '') : ''))
  const [integrantes, setIntegrantes] = useState<string[]>(atual?.integrantes ?? (matricula ? [matricula] : []))
  const [bases, setBases] = useState<CodigoBase[]>(() => {
    const b: CodigoBase[] = atual?.bases ?? []
    return liberar && !b.includes(liberar) ? [...b, liberar] : b
  })
  const [placa, setPlaca] = useState(atual?.placa ?? '')
  // Equipe nova começa sem base de origem: quem cadastra escolhe (obrigatório). Na edição vem a já salva.
  const [origem, setOrigem] = useState<CodigoLocal | ''>(atual?.origem ?? '')
  const [novaMat, setNovaMat] = useState('')
  const [erros, setErros] = useState<string[]>([])
  const [salvo, setSalvo] = useState(false)

  function mudarPadrao(t: TipoEquipe | '', s: Supervisor | '') {
    if (!atual && t && s) setBases(() => {
      const padrao = basesPadrao(t, s)
      return origem && origem !== '211' && !padrao.includes(origem) ? [...padrao, origem] : padrao
    })
  }
  function mudarOrigem(l: CodigoLocal | '') {
    setOrigem(l)
    // A base de origem entra nas liberadas: a equipe sempre retira na base onde inicia a jornada.
    if (l && l !== '211') setBases((b) => (b.includes(l) ? b : [...b, l]))
    setErros([])
  }
  function adicionarIntegrante() {
    const d = soDigitos(novaMat)
    if (!d) return
    if (!colaborador(d)) return setErros([`Matrícula ${d} não está na lista de colaboradores.`])
    if (!integrantes.includes(d)) setIntegrantes((l) => [...l, d])
    setNovaMat('')
    setErros([])
  }
  function alternarBase(b: CodigoBase) {
    setBases((l) => (l.includes(b) ? l.filter((x) => x !== b) : [...l, b]))
    setErros([])
  }
  function salvar() {
    const dados = { id: atual?.id, codigo: codigo.trim().toUpperCase(), tipo: tipo as TipoEquipe, supervisor: supervisor as Supervisor, integrantes, bases, placa: normalizarPlaca(placa), origem }
    const lista = validarEquipe(dados, equipes)
    if (lista.length || !origem) return setErros(lista)
    onSalvarEquipe({ ...dados, origem, id: atual?.id ?? `e-${Date.now()}` })
    setSalvo(true)
    if (m.voltar) window.setTimeout(() => m.voltar?.acao(), 600)
  }

  return (
    <>
      <Cab
        icone="pessoa"
        titulo={atual ? `Equipe ${atual.codigo}` : 'Nova equipe'}
        subtitulo="Todas as equipes retiram no 211 Geral. Nas bases, só nas liberadas. Equipe não consulta estoque."
        selo={liberar ? <span className="selo atencao">Liberando {liberar}</span> : undefined}
        onFechar={onFechar}
      />
      <div className="janela-corpo duas-colunas">
        <div className="janela-principal">
          <div className="grade-campos tres">
            <label className="campo-bloco">
              <span>Nome ou código *</span>
              <input
                className="campo-texto"
                value={codigo}
                onChange={(e) => {
                  setCodigo(e.target.value)
                  setErros([])
                }}
                placeholder="Ex.: MOTO 03"
              />
            </label>
            <label className="campo-bloco">
              <span>Tipo *</span>
              <select
                className="seletor-v2"
                value={tipo}
                onChange={(e) => {
                  const t = e.target.value as TipoEquipe
                  setTipo(t)
                  mudarPadrao(t, supervisor)
                  setErros([])
                }}
              >
                <option value="">Escolha</option>
                {TIPOS_EQUIPE.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="campo-bloco">
              <span>Supervisor *</span>
              <select
                className="seletor-v2"
                value={supervisor}
                onChange={(e) => {
                  const s = e.target.value as Supervisor
                  setSupervisor(s)
                  mudarPadrao(tipo, s)
                  setErros([])
                }}
              >
                <option value="">Escolha</option>
                {SUPERVISORES.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="campo-bloco">
            <span>Integrantes (matrícula) *</span>
            <div className="linha-adicionar">
              <input
                className="campo-texto"
                inputMode="numeric"
                value={novaMat}
                list="lista-colaboradores"
                onChange={(e) => setNovaMat(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    adicionarIntegrante()
                  }
                }}
                placeholder="Digite a matrícula e tecle Enter"
              />
              <datalist id="lista-colaboradores">
                {COLABORADORES.map((c) => (
                  <option key={c.matricula} value={c.matricula}>
                    {c.nome} · {c.supervisor}
                  </option>
                ))}
              </datalist>
              <button type="button" className="mini-botao" onClick={adicionarIntegrante}>
                Adicionar
              </button>
            </div>
            <div className="lista-integrantes">
              {integrantes.map((mt) => {
                const c = colaborador(mt)
                const outra = equipes.find((e) => e.id !== atual?.id && e.integrantes.includes(mt))
                return (
                  <span key={mt} className={`integrante${outra ? ' conflito' : ''}`}>
                    <strong>{c?.nome ?? 'Não encontrado'}</strong>
                    <span className="sec">
                      {mt} · {c?.supervisor ?? '—'}
                      {outra ? ` · já na ${outra.codigo}` : ''}
                    </span>
                    <button type="button" className="botao-quadrado peq" aria-label={`Tirar ${c?.nome ?? mt}`} onClick={() => setIntegrantes((l) => l.filter((x) => x !== mt))}>
                      <Icone nome="fechar" />
                    </button>
                  </span>
                )
              })}
              {integrantes.length === 0 && <span className="sec">Nenhum integrante ainda.</span>}
            </div>
          </div>

          <div className="campo-bloco">
            <span>
              Bases liberadas para retirada * <span className="sec">· {tipo === 'Moto' ? 'moto: todas por enquanto' : 'padrão: as do supervisor'}</span>
            </span>
            <div className="grade-bases">
              {GRUPOS.map((g) => {
                const todas = g.bases.every((b) => bases.includes(b))
                return (
                  <div key={g.id} className="grupo-bases">
                    <button
                      type="button"
                      className="grupo-bases-cab"
                      onClick={() => setBases((l) => (todas ? l.filter((b) => !g.bases.includes(b)) : [...new Set([...l, ...g.bases])]))}
                    >
                      {g.rotulo} <span className="sec">{todas ? 'desmarcar' : 'marcar'} todas</span>
                    </button>
                    {g.bases.map((b) => (
                      <label key={b} className={`base-opcao${b === liberar ? ' destaque' : ''}`}>
                        <input type="checkbox" checked={bases.includes(b)} onChange={() => alternarBase(b)} />
                        <span>
                          {b} · {nomeLocal(b)}
                        </span>
                      </label>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
        <aside className="janela-lateral">
          <label className="campo-bloco">
            <span>Base de origem (onde a equipe inicia a jornada) *</span>
            <select className="seletor-v2 grande" value={origem} onChange={(e) => mudarOrigem(e.target.value as CodigoLocal | '')}>
              <option value="">Escolha</option>
              <option value="211">211 Geral · Governador Valadares</option>
              {GRUPOS.map((g) => (
                <optgroup key={g.id} label={`Supervisão ${g.rotulo}`}>
                  {g.bases.map((b) => (
                    <option key={b} value={b}>
                      {b} · {nomeLocal(b)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="campo-bloco">
            <span>Placa do veículo *</span>
            <input
              className="campo-texto grande"
              value={placa}
              onChange={(e) => {
                setPlaca(e.target.value)
                setErros([])
              }}
              placeholder="ABC1D23"
            />
          </label>
          <div className="cartao-resumo">
            <span className="sec">Resumo</span>
            <strong className="resumo-destino">{codigo.trim().toUpperCase() || 'Sem código'}</strong>
            <div className="contagens">
              <span>
                {tipo || 'Tipo não escolhido'} · {supervisor || 'sem supervisor'}
              </span>
              <span>
                {integrantes.length} {integrantes.length === 1 ? 'integrante' : 'integrantes'}
              </span>
              <span>{bases.length === BASES.length ? 'Todas as bases' : `${bases.length} ${bases.length === 1 ? 'base liberada' : 'bases liberadas'}`} + 211 Geral</span>
              <span>{origem ? `Origem: ${nomeLocal(origem)}` : 'Sem base de origem'}</span>
            </div>
          </div>
          <AnimatePresence initial={false}>
            {erros.length > 0 && (
              <motion.ul key="erros" className="erro-v2 lista-erros" role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                {erros.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
          {salvo ? (
            <div className="botao-v2 confirmado estatico">
              <span className="botao-v2-texto">
                <Icone nome="check" /> Equipe salva{m.voltar ? ', voltando…' : ''}
              </span>
            </div>
          ) : (
            <motion.button type="button" className="botao-v2" onClick={salvar} whileTap={{ scale: 0.97 }}>
              {atual ? 'Salvar alterações' : 'Cadastrar equipe'}
            </motion.button>
          )}
        </aside>
      </div>
    </>
  )
}
