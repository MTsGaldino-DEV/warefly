import { animate, AnimatePresence, motion, useMotionValue, useTransform } from 'motion/react'
import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type ReactNode } from 'react'
import {
  atendimento,
  capacidade,
  colaborador,
  COBERTURA_BASES,
  COBERTURA_BOA,
  COBERTURA_CRITICA,
  DIVERGENCIAS,
  emCaixas,
  ENTREGAS,
  estoqueDoLocal,
  GRUPOS,
  INDICADORES,
  nivelDoItem,
  nivelDoLocal,
  nomeLocal,
  RESERVAS,
  retiradaPendente,
  saldoReserva,
  validarAnexo,
  type Capacidade,
  type CodigoBase,
  type CodigoLocal,
  type Despacho,
  type Equipe,
  type Nivel,
  type Retirada,
  type Solicitacao,
} from './exemplo'
import type { DocumentoGuia } from './Guia'
import { MOLA } from './movimento'
import { ROTULO_SITUACAO, SELO_CAPACIDADE, subtituloLocal, TEXTO_CAPACIDADE, TOM_NIVEL, TOM_SITUACAO, type TomTrilho } from './rotulos'

// ---------------------------------------------------------------------------
// Ícones de traço (16px, cor do texto). Decorativos: o nome vem do aria-label do botão.
const TRACOS = {
  busca: 'M11 17a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM20 20l-4.5-4.5',
  pino: 'M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10zM12 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  sino: 'M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0',
  pessoa: 'M12 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM5 20c1.2-3.5 4-5 7-5s5.8 1.5 7 5',
  voltar: 'M19 12H5M11 6l-6 6 6 6',
  troca: 'M4 8h14l-3-3M20 16H6l3 3',
  fechar: 'M6 6l12 12M18 6L6 18',
  abaixo: 'M6 9l6 6 6-6',
  acima: 'M6 15l6-6 6 6',
  caixa: 'M4 7h16v12H4zM4 11h16M10 7V4h4v3',
  aprovar: 'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM8.5 12.2l2.4 2.4 4.6-4.8',
  reduzir: 'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM8.5 12h7',
  separar: 'M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8',
  filtro: 'M6 4v16M12 4v16M18 4v16M4 9h4M10 15h4M16 7h4',
  abrir: 'M7 17L17 7M9 7h8v8',
  caminhao: 'M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM17 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
  moto: 'M5.5 18a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM18.5 18a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM5.5 15.5h5l3-5h3l2 5M13.5 10.5L12 7H9.5M16.5 10.5l-1-3h2.5',
  lapis: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  imprimir: 'M7 9V4h10v5M7 17H5a1 1 0 0 1-1-1v-5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5a1 1 0 0 1-1 1h-2M7 14h10v6H7z',
  relogio: 'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 8v4.2l2.8 1.8',
  ampliar: 'M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7',
  documento: 'M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5',
  carteira: 'M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4zM4 7l11-3v3M16 13.5h1',
  seguir: 'M9 6l6 6-6 6',
  mais: 'M12 5v14M5 12h14',
  leitor: 'M4 6v12M7 6v12M10.5 6v12M13 6v12M16.5 6v12M20 6v12',
  lixo: 'M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13',
  arrastar: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
  clipe: 'M15.5 7.5l-6.8 6.8a2 2 0 0 0 2.8 2.8l7-7a4 4 0 0 0-5.7-5.7l-7 7a6 6 0 0 0 8.5 8.5l6.2-6.2',
} as const

export function Icone({ nome }: { nome: keyof typeof TRACOS }) {
  return (
    <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">
      <path d={TRACOS[nome]} />
    </svg>
  )
}

/** Número que conta até o valor quando aparece. */
export function Contador({ valor, casas = 0 }: { valor: number; casas?: number }) {
  const mv = useMotionValue(0)
  const texto = useTransform(mv, (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }))
  useEffect(() => {
    const controle = animate(mv, valor, { duration: 1.2, ease: [0.16, 1, 0.3, 1] })
    return () => controle.stop()
  }, [mv, valor])
  return <motion.span>{texto}</motion.span>
}

function Barras({ valores, cor, destaque }: { valores: number[]; cor: string; destaque: number[] }) {
  const max = Math.max(...valores)
  return (
    <div className="barras" aria-hidden="true">
      {valores.map((v, i) => (
        <motion.span
          key={i}
          style={{ height: `${(v / max) * 100}%`, background: destaque.includes(i) ? cor : undefined }}
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ delay: 0.25 + i * 0.03, ...MOLA }}
        />
      ))}
    </div>
  )
}

const COR_TOM = { ok: 'var(--cor-operacao)', alerta: 'var(--st-alerta)', info: 'var(--cor-marca)', transito: 'var(--st-transito)', neutro: 'var(--st-neutro)' }

export function Indicadores() {
  return (
    <div className="indicadores">
      {INDICADORES.map((k) => (
        <div key={k.id} className="indicador">
          <div>
            <div className="indicador-valor">
              <Contador valor={k.valor} />
              <span className={`seta-tendencia ${k.tom}`} aria-label={k.subindo ? 'subindo' : 'caindo'}>
                <svg viewBox="0 0 12 12" aria-hidden="true">
                  <path d={k.subindo ? 'M3 9l6-6M4.5 3H9v4.5' : 'M3 3l6 6M9 4.5V9H4.5'} />
                </svg>
              </span>
            </div>
            <div className="indicador-legenda">{k.legenda}</div>
          </div>
          <Barras valores={k.barras} cor={COR_TOM[k.tom]} destaque={[k.barras.length - 5, k.barras.length - 4]} />
        </div>
      ))}
    </div>
  )
}

export function Trilho({ pct, tom = 'ok' }: { pct: number; tom?: TomTrilho }) {
  return (
    <div className={`trilho-v2 ${tom}`}>
      <motion.span className="preenchido" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} />
      <motion.span className="marcador" initial={{ left: 0 }} animate={{ left: `${pct}%` }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} />
    </div>
  )
}

function ListaItens({ itens }: { itens: { material: string; codigo: string; unidade: string; qtd: number; seriais?: string[] }[] }) {
  return (
    <div className="tabela-itens">
      {itens.map((it, i) => {
        const caixas = emCaixas(it.seriais)
        return (
          <motion.div key={it.codigo + i} className="linha-itens dupla" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 * i }}>
            <span className="material">
              <span className="corta">{it.material}</span>
              {(it.seriais?.length || caixas) && (
                <span className="sec peq">
                  {it.seriais?.length ? `${it.seriais.length} seriais` : ''}
                  {it.seriais?.length && caixas ? ' · ' : ''}
                  {caixas}
                </span>
              )}
            </span>
            <span className="num">
              {it.qtd.toLocaleString('pt-BR')} <span className="sec">{it.unidade}</span>
            </span>
          </motion.div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Painel da esquerda: saída de material — despachos para as bases e retiradas no balcão do 211.

type AbaSaida = 'bases' | 'local'

/** Retirada no local vem primeiro e abre por padrão (pedido do Matheus). */
const MODOS: { id: AbaSaida; titulo: string; descricao: string; icone: 'caminhao' | 'pessoa'; novo: string; vazio: string }[] = [
  { id: 'local', titulo: 'Retirada no local', descricao: 'Equipe retira no balcão', icone: 'pessoa', novo: 'Nova retirada', vazio: 'Nenhuma retirada pendente. Todas estão com a guia assinada anexada.' },
  { id: 'bases', titulo: 'Para bases', descricao: 'Caminhonete leva para a sub-base', icone: 'caminhao', novo: 'Novo despacho para base', vazio: 'Nenhum despacho ativo.' },
]

export function PainelSaida({
  despachos,
  retiradas,
  equipes,
  filaSolicitacoes,
  onAbrir,
  onGuia,
  onSolicitacoes,
  onAnexarGuia,
}: {
  despachos: Despacho[]
  retiradas: Retirada[]
  equipes: Equipe[]
  filaSolicitacoes: number
  onAbrir: (j: ConteudoJanela) => void
  onGuia: (d: DocumentoGuia) => void
  onSolicitacoes: () => void
  onAnexarGuia: (id: string, arquivo: File) => void
}) {
  const [aba, setAba] = useState<AbaSaida>('local')
  // Retirada só sai daqui quando a guia assinada é anexada; as concluídas ficam no histórico de retiradas.
  const pendentes = retiradas.filter(retiradaPendente)
  const concluidas = retiradas.length - pendentes.length
  const [aberto, setAberto] = useState<string | null>(null)
  const modo = MODOS.find((m) => m.id === aba) ?? MODOS[0]
  const total = { bases: despachos.length, local: pendentes.length }
  return (
    <motion.aside className={`vidro painel-solicitacoes painel-saida modo-${aba}`} aria-label="Saída de material" initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15, ...MOLA }}>
      <div className="painel-cab">
        <h2>Saída de material</h2>
        <div className="grupo-botoes">
          <button type="button" className="botao-quadrado" aria-label="Histórico de solicitações" title="Histórico de solicitações" onClick={() => onAbrir({ tipo: 'historico' })}>
            <Icone nome="relogio" />
          </button>
        </div>
      </div>
      <div className="modos-saida" role="tablist" aria-label="Tipo de saída">
        {MODOS.map((m) => (
          <button key={m.id} type="button" role="tab" aria-selected={aba === m.id} className={`modo-saida ${m.id}`} onClick={() => setAba(m.id)}>
            {aba === m.id && <motion.span layoutId="modo-saida-fundo" className="modo-fundo" transition={MOLA} />}
            <span className="modo-topo">
              <span className="modo-icone">
                <Icone nome={m.icone} />
              </span>
              <span className="modo-contagem">{total[m.id]}</span>
            </span>
            <strong>{m.titulo}</strong>
            <small>{m.descricao}</small>
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={aba} className="modo-corpo" initial={{ opacity: 0, x: aba === 'local' ? -12 : 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: aba === 'local' ? 12 : -12 }} transition={{ duration: 0.16 }}>
          <button type="button" className={`botao-v2 novo-${aba}`} onClick={() => onAbrir(aba === 'bases' ? { tipo: 'novoDespacho' } : { tipo: 'novaRetirada' })}>
            <span className="botao-v2-texto">
              <Icone nome="mais" /> {modo.novo}
            </span>
          </button>
          <span className="modo-legenda">{aba === 'bases' ? `${despachos.length} despachos ativos` : `${pendentes.length} aguardando guia assinada`}</span>
          <div className="painel-rolagem" role="tabpanel" aria-label={modo.titulo}>
            <AnimatePresence initial={false} mode="popLayout">
              {aba === 'bases'
                ? despachos.map((d) => <CartaoDespacho key={d.id} d={d} aberto={aberto === d.id} alternar={() => setAberto(aberto === d.id ? null : d.id)} onAbrir={onAbrir} onGuia={onGuia} />)
                : pendentes.map((r) => (
                    <CartaoRetirada key={r.id} r={r} equipe={equipes.find((e) => e.id === r.equipe)} aberto={aberto === r.id} alternar={() => setAberto(aberto === r.id ? null : r.id)} onAbrir={onAbrir} onGuia={onGuia} onAnexarGuia={onAnexarGuia} />
                  ))}
            </AnimatePresence>
            {total[aba] === 0 && <p className="vazio-v2">{modo.vazio}</p>}
          </div>
          {aba === 'local' && (
            <button type="button" className="link-concluidas" onClick={() => onAbrir({ tipo: 'historicoRetiradas' })}>
              <Icone nome="relogio" /> Histórico de retiradas · {concluidas} {concluidas === 1 ? 'concluída' : 'concluídas'}
            </button>
          )}
        </motion.div>
      </AnimatePresence>
      <button type="button" className="link-historico" onClick={onSolicitacoes}>
        <Icone nome="caixa" /> Solicitações das bases · {filaSolicitacoes} na fila
      </button>
    </motion.aside>
  )
}

function Seta({ aberto }: { aberto: boolean }) {
  return (
    <motion.span animate={{ rotate: aberto ? 180 : 0 }} transition={MOLA} style={{ display: 'grid' }}>
      <Icone nome="abaixo" />
    </motion.span>
  )
}

function CartaoDespacho({ d, aberto, alternar, onAbrir, onGuia }: { d: Despacho; aberto: boolean; alternar: () => void; onAbrir: (j: ConteudoJanela) => void; onGuia: (g: DocumentoGuia) => void }) {
  const tom = d.alerta ? 'alerta' : d.recebidoPor ? 'transito' : d.veiculo ? 'ok' : 'info'
  return (
    <motion.article layout className={`cartao-v2${aberto ? ' aberto' : ''}`} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={MOLA}>
      <motion.div layout="position" className="cartao-v2-cab">
        <span className={`quadro-icone ${d.alerta ? 'alerta' : 'ok'}`}>
          <Icone nome="caminhao" />
        </span>
        <div className="cartao-v2-titulo">
          <span className="nome">
            {nomeLocal(d.base)} · <span className="sec mono">{d.numero}</span>
          </span>
          <span className="estado">
            <span className={`ponto ${tom}`} />
            {d.situacao}
          </span>
        </div>
        <button type="button" className="botao-quadrado" aria-label={aberto ? 'Recolher' : 'Expandir'} aria-expanded={aberto} onClick={alternar}>
          <Seta aberto={aberto} />
        </button>
      </motion.div>
      <AnimatePresence initial={false}>
        {aberto && (
          <motion.div key="corpo" className="cartao-v2-corpo" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={MOLA}>
            <div className="conteudo-corpo">
              <Rastreio despacho={d} />
              <ListaItens itens={d.itens} />
              <div className="dupla-botoes">
                <button type="button" className="botao-v2 claro baixo" onClick={() => onAbrir({ tipo: 'despacho', despacho: d })}>
                  <span className="botao-v2-texto">
                    <Icone nome="documento" /> Abrir despacho
                  </span>
                </button>
                <button type="button" className="botao-quadrado" aria-label={`Guia do despacho ${d.numero}`} title="Guia" onClick={() => onGuia({ tipo: 'despacho', despacho: d })}>
                  <Icone nome="imprimir" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  )
}

function CartaoRetirada({
  r,
  equipe,
  aberto,
  alternar,
  onAbrir,
  onGuia,
  onAnexarGuia,
}: {
  r: Retirada
  equipe?: Equipe
  aberto: boolean
  alternar: () => void
  onAbrir: (j: ConteudoJanela) => void
  onGuia: (g: DocumentoGuia) => void
  onAnexarGuia: (id: string, arquivo: File) => void
}) {
  const pessoa = colaborador(r.retiradoPor)
  return (
    <motion.article layout className={`cartao-v2${aberto ? ' aberto' : ''}`} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={MOLA}>
      <motion.div layout="position" className="cartao-v2-cab">
        <span className="quadro-icone">
          <Icone nome="pessoa" />
        </span>
        <div className="cartao-v2-titulo">
          <span className="nome">
            {pessoa?.nome ?? `Mat. ${r.retiradoPor}`} · <span className="sec">{equipe?.codigo ?? '—'}</span>
          </span>
          <span className="estado">
            <span className="ponto atencao" />
            <span className="mono">{r.numero}</span> · {r.local === '211' ? '211' : r.local} · {r.data.slice(0, 5)} {r.data.slice(11)}
          </span>
        </div>
        <button type="button" className="botao-quadrado" aria-label={aberto ? 'Recolher' : 'Expandir'} aria-expanded={aberto} onClick={alternar}>
          <Seta aberto={aberto} />
        </button>
      </motion.div>
      <AnimatePresence initial={false}>
        {aberto && (
          <motion.div key="corpo" className="cartao-v2-corpo" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={MOLA}>
            <div className="conteudo-corpo">
              <ListaItens itens={r.itens} />
              <CampoGuiaAssinada r={r} onAnexar={onAnexarGuia} />
              <div className="dupla-botoes">
                <button type="button" className="botao-v2 claro baixo" onClick={() => onAbrir({ tipo: 'retirada', retirada: r })}>
                  <span className="botao-v2-texto">
                    <Icone nome="documento" /> Abrir retirada
                  </span>
                </button>
                <button type="button" className="botao-quadrado" aria-label={`Termo da retirada ${r.numero}`} title="Termo para assinatura" onClick={() => onGuia({ tipo: 'retirada', retirada: r })}>
                  <Icone nome="imprimir" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  )
}

/**
 * Anexo da guia assinada (foto ou PDF). No cartão é só o botão; na janela da retirada mostra também o arquivo, quem anexou e quando.
 * No modo visual o arquivo fica só nesta sessão do navegador.
 */
export function CampoGuiaAssinada({ r, onAnexar, bloco = false }: { r: Retirada; onAnexar: (id: string, arquivo: File) => void; bloco?: boolean }) {
  const entrada = useRef<HTMLInputElement>(null)
  const [erro, setErro] = useState<string | null>(null)
  const escolher = (e: ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0]
    e.target.value = ''
    if (!arquivo) return
    const v = validarAnexo(arquivo)
    if ('erro' in v) return setErro(v.erro)
    setErro(null)
    onAnexar(r.id, arquivo)
  }
  const g = r.guiaAssinada
  const campo = <input ref={entrada} type="file" accept="image/*,application/pdf" hidden onChange={escolher} aria-label={`Arquivo da guia assinada da ${r.numero}`} />
  const aviso = erro && (
    <p className="erro-v2" role="alert">
      {erro}
    </p>
  )
  if (!bloco)
    return (
      <>
        {campo}
        <button type="button" className="botao-v2 baixo anexar-guia" onClick={() => entrada.current?.click()}>
          <span className="botao-v2-texto">
            <Icone nome="clipe" /> Anexar guia assinada
          </span>
        </button>
        {aviso}
      </>
    )
  return (
    <section className={`anexo-guia ${g ? 'ok' : 'pendente'}`} aria-label="Guia assinada">
      {campo}
      <span className={`quadro-icone${g ? ' ok' : ''}`}>
        <Icone nome={g ? 'check' : 'clipe'} />
      </span>
      <div className="anexo-texto">
        <strong>{g ? g.arquivo : 'Falta anexar a guia assinada'}</strong>
        <span className="sec">
          {g ? `${g.formato === 'pdf' ? 'PDF' : 'Foto'} anexada por ${g.anexadoPor} em ${g.anexadoEm}` : 'A retirada fica pendente na Saída de material até a foto ou o PDF da guia assinada entrar.'}
        </span>
      </div>
      <div className="anexo-acoes">
        {g?.url && (
          <a className="botao-v2 claro baixo" href={g.url} target="_blank" rel="noreferrer">
            <span className="botao-v2-texto">
              <Icone nome="abrir" /> Ver arquivo
            </span>
          </a>
        )}
        <button type="button" className={`botao-v2 baixo${g ? ' claro' : ' anexar-guia'}`} onClick={() => entrada.current?.click()}>
          <span className="botao-v2-texto">
            <Icone nome="clipe" /> {g ? 'Trocar arquivo' : 'Anexar guia assinada'}
          </span>
        </button>
      </div>
      {aviso}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Cartões de gráfico (embaixo, por cima do mapa)

const tomCobertura = (dias: number) => (dias < COBERTURA_CRITICA ? 'critica' : dias < COBERTURA_BOA ? 'atencao' : 'boa')

/** Dias de estoque que cada base aguenta pelo consumo de 90 dias. Linha tracejada = cobertura boa. */
function GraficoCobertura() {
  const max = Math.ceil(Math.max(...COBERTURA_BASES.map((p) => p.dias), COBERTURA_BOA) / 10) * 10
  const alturaMeta = (COBERTURA_BOA / max) * 100
  return (
    <div className="grafico-v2 prazo">
      <div className="eixo-y" aria-hidden="true">
        <span>{max} d</span>
        <span>{max / 2} d</span>
        <span>0</span>
      </div>
      <div className="barras-prazo" role="img" aria-label={`Dias de cobertura por base; ${COBERTURA_BOA} dias ou mais é bom, menos de ${COBERTURA_CRITICA} é crítico`}>
        <span className="linha-meta" style={{ '--meta': String(alturaMeta / 100) } as CSSProperties}>
          <em>{COBERTURA_BOA} d</em>
        </span>
        {COBERTURA_BASES.map((p, i) => (
          <div key={p.base} className="coluna-prazo" title={`${nomeLocal(p.base)}: ${p.dias} dias`}>
            <motion.span
              className={tomCobertura(p.dias)}
              style={{ height: `${(p.dias / max) * 100}%` }}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ delay: 0.5 + i * 0.04, ...MOLA }}
            />
            <small>{p.base}</small>
          </div>
        ))}
      </div>
    </div>
  )
}

function caminhoLinha(valores: number[], largura: number, altura: number) {
  const max = 90
  return valores.map((v, i) => `${i ? 'L' : 'M'}${((i / (valores.length - 1)) * largura).toFixed(1)} ${(altura - (v / max) * altura).toFixed(1)}`).join(' ')
}

function GraficoLinhaV2() {
  const pico = ENTREGAS.entregue.indexOf(Math.max(...ENTREGAS.entregue))
  const px = (pico / (ENTREGAS.entregue.length - 1)) * 400
  const py = 96 - (ENTREGAS.entregue[pico] / 90) * 96
  return (
    <div className="grafico-v2">
      <div className="eixo-y" aria-hidden="true">
        <span>140</span>
        <span>110</span>
        <span>80</span>
        <span>50</span>
      </div>
      <svg className="linha-v2" viewBox="0 0 400 96" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 24H400M0 48H400M0 72H400" className="grade" />
        <motion.path d={caminhoLinha(ENTREGAS.solicitado, 400, 96)} className="serie-b" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.6, duration: 1.4, ease: 'easeInOut' }} />
        <motion.path d={caminhoLinha(ENTREGAS.entregue, 400, 96)} className="serie-a" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.5, duration: 1.4, ease: 'easeInOut' }} />
        <motion.circle cx={px} cy={py} r="4" className="ponto-pico" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.8, ...MOLA }} />
      </svg>
    </div>
  )
}

function CartaoGrafico({
  titulo,
  valor,
  casas = 0,
  unidade,
  rotulo,
  pct,
  tom,
  subindo = true,
  children,
}: {
  titulo: string
  valor: number
  casas?: number
  unidade: string
  rotulo: string
  pct: number
  tom: 'ok' | 'alerta'
  subindo?: boolean
  children: ReactNode
}) {
  return (
    <section className="vidro cartao-grafico" aria-label={titulo}>
      <div className="painel-cab">
        <h2>{titulo}</h2>
        <div className="grupo-botoes">
          <button type="button" className="botao-quadrado" aria-label={`Filtrar ${titulo.toLowerCase()}`}>
            <Icone nome="filtro" />
          </button>
          <button type="button" className="botao-quadrado" aria-label={`Abrir ${titulo.toLowerCase()}`}>
            <Icone nome="abrir" />
          </button>
        </div>
      </div>
      <div className="cartao-grafico-numeros">
        <div className="numero-grande">
          <span className={`seta-tendencia ${subindo ? 'ok' : 'alerta'}`}>
            <svg viewBox="0 0 12 12" aria-hidden="true">
              <path d={subindo ? 'M3 9l6-6M4.5 3H9v4.5' : 'M3 3l6 6M9 4.5V9H4.5'} />
            </svg>
          </span>
          <Contador valor={valor} casas={casas} />
          <span className="unidade">/ {unidade}</span>
        </div>
        <div className="mini-trilho">
          <div className="rotulo-trilho">
            <span>{rotulo}</span>
            <span className="sec">{pct}%</span>
          </div>
          <Trilho pct={pct} tom={tom} />
        </div>
      </div>
      {children}
    </section>
  )
}

export function CartoesGraficos() {
  const media = COBERTURA_BASES.reduce((t, p) => t + p.dias, 0) / COBERTURA_BASES.length
  const boas = Math.round((COBERTURA_BASES.filter((p) => p.dias >= COBERTURA_BOA).length / COBERTURA_BASES.length) * 100)
  return (
    <motion.div className="cartoes-graficos" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, ...MOLA }}>
      <CartaoGrafico titulo="Cobertura de estoque das bases" valor={media} casas={0} unidade="dias em média" rotulo={`Bases com ${COBERTURA_BOA} dias ou mais`} pct={boas} tom={boas < 60 ? 'alerta' : 'ok'}>
        <div className="legenda-grafico" aria-label="Legenda da cobertura">
          <span>
            <i className="critica" /> Crítica: menos de {COBERTURA_CRITICA} dias
          </span>
          <span>
            <i className="atencao" /> Atenção: {COBERTURA_CRITICA} a {COBERTURA_BOA - 1} dias
          </span>
          <span>
            <i className="boa" /> Boa: {COBERTURA_BOA} dias ou mais
          </span>
        </div>
        <GraficoCobertura />
      </CartaoGrafico>
      <CartaoGrafico titulo="Entregas às bases" valor={1284} unidade="itens entregues" rotulo="Atendido" pct={92} tom="ok">
        <GraficoLinhaV2 />
      </CartaoGrafico>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Popover do despacho (ao clicar no caminhão)

export function PopoverDespacho({
  despacho,
  x,
  y,
  onFechar,
  onAbrirDespacho,
  onVerGuia,
}: {
  despacho: Despacho
  x: number
  y: number
  onFechar: () => void
  onAbrirDespacho: () => void
  onVerGuia: () => void
}) {
  return (
    <motion.div
      className="vidro popover-v2"
      style={{ left: x + 16, top: y - 20 }}
      initial={{ opacity: 0, scale: 0.9, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 8 }}
      transition={MOLA}
      role="dialog"
      aria-label={`Despacho ${despacho.numero}`}
    >
      <div className="popover-v2-cab">
        <span className={`quadro-icone ${despacho.alerta ? 'alerta' : 'ok'}`}>
          <Icone nome="caminhao" />
        </span>
        <div className="cartao-v2-titulo">
          <span className="nome mono">{despacho.numero}</span>
          <span className="estado">
            <span className={`ponto ${despacho.alerta ? 'alerta' : 'ok'}`} />
            {despacho.situacao}
          </span>
        </div>
        <button type="button" className="botao-quadrado peq" aria-label="Fechar" onClick={onFechar}>
          <Icone nome="fechar" />
        </button>
      </div>
      <Rastreio despacho={despacho} />
      <div className="rotulo-trilho">
        <span>Conferido</span>
        <span className="sec">{despacho.conferido}%</span>
      </div>
      <Trilho pct={despacho.conferido} tom={despacho.alerta ? 'alerta' : 'ok'} />
      <div className="dupla-botoes">
        <button type="button" className="botao-v2" onClick={onAbrirDespacho}>
          <span className="botao-v2-texto">
            <Icone nome="documento" /> Abrir despacho
          </span>
        </button>
        <button type="button" className="botao-quadrado" aria-label="Guia do despacho" title="Guia" onClick={onVerGuia}>
          <Icone nome="imprimir" />
        </button>
      </div>
    </motion.div>
  )
}

/** De onde para onde, quem enviou e quem recebeu: o rastreio do despacho. */
export function Rastreio({ despacho }: { despacho: Despacho }) {
  const totalItens = despacho.itens.length
  return (
    <dl className="rastreio">
      <div>
        <dt>Destino</dt>
        <dd>
          {nomeLocal(despacho.base)} <span className="sec mono">{despacho.base}</span>
        </dd>
      </div>
      <div>
        <dt>Leva</dt>
        <dd>
          {totalItens} {totalItens === 1 ? 'material' : 'materiais'} · {despacho.solicitacao}
        </dd>
      </div>
      <div>
        <dt>Saída</dt>
        <dd>
          {despacho.saida} · {despacho.enviadoPor}
        </dd>
      </div>
      <div>
        <dt>Recebido</dt>
        <dd className={despacho.recebidoPor ? undefined : 'sec'}>{despacho.recebidoPor ? `${despacho.recebidoEm} · ${despacho.recebidoPor}` : 'Ainda não chegou'}</dd>
      </div>
    </dl>
  )
}

// ---------------------------------------------------------------------------
// Gaveta de vidro (os menus abrem por cima do mapa). `voltar` guarda de onde a pessoa veio.

type BaseGaveta =
  | { tipo: 'solicitacoes' }
  | { tipo: 'despachos' }
  | { tipo: 'estoque' }
  | { tipo: 'local'; codigo: CodigoLocal }
  | { tipo: 'reservas' }
  | { tipo: 'reserva'; numero: string }
  | { tipo: 'divergencias' }
  | { tipo: 'equipes' }
export type ConteudoGaveta = BaseGaveta & { voltar?: ConteudoGaveta }

/** O que abre na janela grande do centro (ver Detalhes.tsx). `voltar` guarda a janela anterior. */
type BaseJanela =
  | { tipo: 'analise'; id: string }
  | { tipo: 'despacho'; despacho: Despacho }
  | { tipo: 'retirada'; retirada: Retirada }
  | { tipo: 'local'; codigo: CodigoLocal }
  | { tipo: 'reservas'; selecionadas?: string[] }
  | { tipo: 'historico' }
  | { tipo: 'novoDespacho'; base?: CodigoBase; solicitacaoId?: string }
  | { tipo: 'novaRetirada'; matricula?: string; local?: CodigoLocal }
  | { tipo: 'historicoRetiradas'; matricula?: string }
  | { tipo: 'equipe'; id?: string; liberar?: CodigoBase; matricula?: string }
  | { tipo: 'resumoEquipe'; id: string }
export type ConteudoJanela = BaseJanela & { voltar?: ConteudoJanela }

const TITULOS: Record<ConteudoGaveta['tipo'], string> = {
  solicitacoes: 'Solicitações',
  despachos: 'Despachos',
  estoque: 'Estoque por local',
  local: 'Estoque',
  reservas: 'Reservas CEMIG',
  reserva: 'Reserva',
  divergencias: 'Divergências abertas',
  equipes: 'Equipes',
}

function tituloGaveta(c: ConteudoGaveta) {
  if (c.tipo === 'local') return nomeLocal(c.codigo)
  if (c.tipo === 'reserva') return c.numero
  return TITULOS[c.tipo]
}

function ampliavel(c: ConteudoGaveta): ConteudoJanela | null {
  if (c.tipo === 'local') return { tipo: 'local', codigo: c.codigo }
  if (c.tipo === 'reserva') return { tipo: 'reservas', selecionadas: [c.numero] }
  if (c.tipo === 'reservas') return { tipo: 'reservas' }
  return null
}

type AcoesGaveta = {
  onAbrir: (c: ConteudoGaveta) => void
  onAmpliar: (j: ConteudoJanela) => void
  onImprimirGuia: (d: DocumentoGuia) => void
  solicitacoes: Solicitacao[]
  despachos: Despacho[]
  retiradas: Retirada[]
  equipes: Equipe[]
}

export function Gaveta({ conteudo, onFechar, ...acoes }: { conteudo: ConteudoGaveta | null; onFechar: () => void } & AcoesGaveta) {
  useEffect(() => {
    if (!conteudo) return
    const tecla = (e: KeyboardEvent) => {
      // Com a guia de impressão aberta, o Esc é dela.
      if (e.key === 'Escape' && !document.body.classList.contains('com-guia')) onFechar()
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [conteudo, onFechar])

  const ampliar = conteudo ? ampliavel(conteudo) : null
  const subtitulo = conteudo?.tipo === 'local' ? subtituloLocal(conteudo.codigo) : conteudo?.tipo === 'reserva' ? 'Saldo autorizado para retirar no 3256' : null
  const chave = conteudo ? conteudo.tipo + ('codigo' in conteudo ? conteudo.codigo : '') + ('numero' in conteudo ? conteudo.numero : '') : ''

  return (
    <AnimatePresence>
      {conteudo && (
        <>
          <motion.div key="veu" className="gaveta-veu" onClick={onFechar} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.aside
            key="gaveta"
            className="vidro gaveta"
            role="dialog"
            aria-modal="true"
            aria-label={tituloGaveta(conteudo)}
            initial={{ x: '105%' }}
            animate={{ x: 0 }}
            exit={{ x: '105%' }}
            transition={MOLA}
          >
            <div className="painel-cab gaveta-cab">
              {conteudo.voltar && (
                <button type="button" className="botao-quadrado" aria-label={`Voltar para ${tituloGaveta(conteudo.voltar)}`} onClick={() => conteudo.voltar && acoes.onAbrir(conteudo.voltar)}>
                  <Icone nome="voltar" />
                </button>
              )}
              <div className="gaveta-titulo">
                <h2>{tituloGaveta(conteudo)}</h2>
                {subtitulo && <span className="sec peq">{subtitulo}</span>}
              </div>
              {ampliar && (
                <button type="button" className="botao-quadrado" aria-label="Abrir em tela maior" title="Abrir em tela maior" onClick={() => acoes.onAmpliar(ampliar)}>
                  <Icone nome="ampliar" />
                </button>
              )}
              <button type="button" className="botao-quadrado" aria-label="Fechar" onClick={onFechar} autoFocus>
                <Icone nome="fechar" />
              </button>
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={chave} className="gaveta-corpo" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} transition={{ duration: 0.18 }}>
                <ConteudoDaGaveta conteudo={conteudo} {...acoes} />
              </motion.div>
            </AnimatePresence>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

function LinhaLocal({ codigo, nome, indice, voltar, onAbrir }: { codigo: CodigoLocal; nome: string; indice: number; voltar: ConteudoGaveta; onAbrir: (c: ConteudoGaveta) => void }) {
  const nivel = nivelDoLocal(estoqueDoLocal(codigo))
  return (
    <motion.button type="button" className="linha-simples" onClick={() => onAbrir({ tipo: 'local', codigo, voltar })} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: indice * 0.03 }}>
      <span className={`bloco-mini nivel-${nivel}${codigo === '211' ? ' geral' : ''}`} aria-hidden="true" />
      <span className="corta">{nome}</span>
      {nivel !== 'ok' && <span className={`selo ${nivel === 'abaixo' ? 'alerta' : 'atencao'}`}>{nivel === 'abaixo' ? 'Abaixo do mínimo' : 'Próximo do mínimo'}</span>}
      <span className="mono sec">{codigo}</span>
      <Icone nome="seguir" />
    </motion.button>
  )
}

function ConteudoDaGaveta({ conteudo, onAbrir, onAmpliar, onImprimirGuia, solicitacoes, despachos, retiradas, equipes }: { conteudo: ConteudoGaveta } & AcoesGaveta) {
  switch (conteudo.tipo) {
    case 'local': {
      const linhas = estoqueDoLocal(conteudo.codigo)
      const abaixo = linhas.filter((l) => nivelDoItem(l) === 'abaixo').length
      const proximo = linhas.filter((l) => nivelDoItem(l) === 'proximo').length
      const ordem: Record<Nivel, number> = { abaixo: 0, proximo: 1, ok: 2 }
      const ordenadas = [...linhas].sort((a, b) => ordem[nivelDoItem(a)] - ordem[nivelDoItem(b)])
      return (
        <>
          <div className="resumo-base">
            <div>
              <span className={`numero-medio${abaixo ? ' alerta' : ''}`}>
                <Contador valor={abaixo} />
              </span>
              <span className="sec">abaixo do mínimo</span>
            </div>
            <div>
              <span className={`numero-medio${proximo ? ' atencao' : ''}`}>
                <Contador valor={proximo} />
              </span>
              <span className="sec">próximos do mínimo</span>
            </div>
            <div>
              <span className="numero-medio">
                <Contador valor={despachos.filter((d) => d.base === conteudo.codigo).length} />
              </span>
              <span className="sec">despachos a caminho</span>
            </div>
          </div>
          <div className="lista-estoque">
            {ordenadas.map((l, i) => {
              const pct = Math.min(100, Math.round((l.saldo / (l.minimo * 2)) * 100))
              const nivel = nivelDoItem(l)
              return (
                <motion.div key={l.codigo} className="linha-estoque" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.04, ...MOLA }}>
                  <div className="linha-estoque-topo">
                    <span className="corta">{l.material}</span>
                    <span className={`saldo nivel-${nivel}`}>
                      {l.saldo.toLocaleString('pt-BR')} <span className="sec">{l.unidade}</span>
                    </span>
                  </div>
                  <div className="linha-estoque-base">
                    <span className="mono sec">{l.codigo}</span>
                    <span className="sec">mínimo {l.minimo.toLocaleString('pt-BR')}</span>
                  </div>
                  <Trilho pct={pct} tom={TOM_NIVEL[nivel]} />
                </motion.div>
              )
            })}
          </div>
        </>
      )
    }
    case 'estoque': {
      let indice = 0
      return (
        <>
          <section className="grupo-lista">
            <h3>211 Geral</h3>
            <div className="lista-simples">
              <LinhaLocal codigo="211" nome="Estoque central" indice={indice++} voltar={conteudo} onAbrir={onAbrir} />
            </div>
          </section>
          {GRUPOS.map((g) => (
            <section key={g.id} className="grupo-lista">
              <h3>{g.rotulo}</h3>
              <div className="lista-simples">
                {g.bases.map((c) => (
                  <LinhaLocal key={c} codigo={c} nome={nomeLocal(c)} indice={indice++} voltar={conteudo} onAbrir={onAbrir} />
                ))}
              </div>
            </section>
          ))}
        </>
      )
    }
    case 'despachos':
      return (
        <>
          <section className="grupo-lista">
            <h3>Para bases</h3>
            <div className="lista-simples">
              {despachos.map((d) => (
                <div key={d.id} className="linha-cartao">
                  <div className="linha-estoque-topo">
                    <span className="mono">{d.numero}</span>
                    <span className={`selo ${d.alerta ? 'alerta' : d.recebidoPor ? 'transito' : 'ok'}`}>{d.alerta ? 'Divergência' : d.recebidoPor ? 'Em conferência' : d.veiculo ? 'Em trânsito' : 'Carregando'}</span>
                  </div>
                  <Rastreio despacho={d} />
                  <Trilho pct={d.conferido} tom={d.alerta ? 'alerta' : 'ok'} />
                  <div className="dupla-botoes">
                    <button type="button" className="botao-v2 claro baixo" onClick={() => onAmpliar({ tipo: 'despacho', despacho: d })}>
                      <span className="botao-v2-texto">
                        <Icone nome="documento" /> Abrir despacho
                      </span>
                    </button>
                    <button type="button" className="botao-quadrado" aria-label={`Guia do despacho ${d.numero}`} title="Guia" onClick={() => onImprimirGuia({ tipo: 'despacho', despacho: d })}>
                      <Icone nome="imprimir" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="grupo-lista">
            <h3>Retirada no local</h3>
            <div className="lista-simples">
              {retiradas.map((r) => (
                <div key={r.id} className="linha-cartao">
                  <div className="linha-estoque-topo">
                    <span className="mono">{r.numero}</span>
                    <span className="grupo-selos">
                      <span className="selo neutro">{equipes.find((e) => e.id === r.equipe)?.codigo ?? '—'}</span>
                      {r.guiaAssinada ? <span className="selo">Guia anexada</span> : <span className="selo atencao">Falta guia</span>}
                    </span>
                  </div>
                  <span className="sec peq">
                    {colaborador(r.retiradoPor)?.nome ?? r.retiradoPor} · {r.local === '211' ? '211 Geral' : nomeLocal(r.local)} · {r.data} · {r.itens.length} {r.itens.length === 1 ? 'material' : 'materiais'}
                  </span>
                  <div className="dupla-botoes">
                    <button type="button" className="botao-v2 claro baixo" onClick={() => onAmpliar({ tipo: 'retirada', retirada: r })}>
                      <span className="botao-v2-texto">
                        <Icone nome="documento" /> Abrir retirada
                      </span>
                    </button>
                    <button type="button" className="botao-quadrado" aria-label={`Termo da retirada ${r.numero}`} title="Termo" onClick={() => onImprimirGuia({ tipo: 'retirada', retirada: r })}>
                      <Icone nome="imprimir" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )
    case 'reservas':
      return (
        <>
          <p className="explica">Reserva é a carteira de material que a CEMIG autorizou retirar no 3256. Mostra o saldo que ainda pode ser retirado, não o que existe fisicamente lá.</p>
          <div className="lista-simples">
            {RESERVAS.map((r, i) => {
              const autorizado = r.itens.reduce((t, x) => t + x.autorizado, 0)
              const retirado = r.itens.reduce((t, x) => t + x.retirado, 0)
              const comSaldo = r.itens.filter((x) => saldoReserva(x) > 0).length
              const pct = Math.round((retirado / autorizado) * 100)
              return (
                <motion.button
                  key={r.numero}
                  type="button"
                  className="linha-cartao clicavel"
                  onClick={() => onAbrir({ tipo: 'reserva', numero: r.numero, voltar: conteudo })}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <div className="linha-estoque-topo">
                    <span className="mono">{r.numero}</span>
                    <span className={`selo ${r.alerta ? 'alerta' : 'reserva'}`}>{r.alerta ? `Aberta há ${r.dias} dias` : 'Ativa'}</span>
                  </div>
                  <span className="sec peq">
                    {comSaldo} de {r.itens.length} materiais com saldo a retirar · aprovada em {r.aberta}
                  </span>
                  <div className="rotulo-trilho">
                    <span>Retirado</span>
                    <span className="sec">{pct}%</span>
                  </div>
                  <Trilho pct={pct} tom={r.alerta ? 'alerta' : 'ok'} />
                </motion.button>
              )
            })}
          </div>
        </>
      )
    case 'reserva': {
      const r = RESERVAS.find((x) => x.numero === conteudo.numero)
      if (!r) return <p className="vazio-v2">Reserva não encontrada. Volte e escolha outra.</p>
      return (
        <>
          <div className="resumo-base">
            <div>
              <span className="numero-medio">
                <Contador valor={r.itens.length} />
              </span>
              <span className="sec">materiais</span>
            </div>
            <div>
              <span className="numero-medio">
                <Contador valor={r.itens.filter((x) => saldoReserva(x) > 0).length} />
              </span>
              <span className="sec">com saldo</span>
            </div>
            <div>
              <span className={`numero-medio${r.alerta ? ' alerta' : ''}`}>
                <Contador valor={r.dias} />
              </span>
              <span className="sec">dias aberta</span>
            </div>
          </div>
          <div className="lista-estoque">
            {r.itens.map((x, i) => {
              const saldo = saldoReserva(x)
              return (
                <motion.div key={x.codigo} className="linha-estoque" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.04, ...MOLA }}>
                  <div className="linha-estoque-topo">
                    <span className="corta">{x.material}</span>
                    <span className={saldo ? 'saldo' : 'saldo sec'}>
                      {saldo.toLocaleString('pt-BR')} <span className="sec">{x.unidade}</span>
                    </span>
                  </div>
                  <div className="linha-estoque-base">
                    <span className="mono sec">{x.codigo}</span>
                    <span className="sec">
                      autorizado {x.autorizado.toLocaleString('pt-BR')} · retirado {x.retirado.toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <Trilho pct={Math.round((x.retirado / x.autorizado) * 100)} />
                </motion.div>
              )
            })}
          </div>
        </>
      )
    }
    case 'divergencias':
      return (
        <div className="lista-simples">
          {DIVERGENCIAS.map((d, i) => (
            <div key={i} className="linha-cartao">
              <div className="linha-estoque-topo">
                <span className="corta">{d.material}</span>
                <span className="selo alerta">{d.motivo}</span>
              </div>
              <span className="sec peq">
                <span className="mono">{d.despacho}</span> · {nomeLocal(d.base)} · {d.qtd} · há {d.dias} dias
              </span>
            </div>
          ))}
        </div>
      )
    case 'solicitacoes':
      return <GavetaSolicitacoes solicitacoes={solicitacoes} onAmpliar={onAmpliar} />
    case 'equipes':
      return <GavetaEquipes equipes={equipes} onAmpliar={onAmpliar} />
  }
}

/** Fila de solicitações marcada pelo que o estoque de hoje consegue atender. */
function GavetaSolicitacoes({ solicitacoes, onAmpliar }: { solicitacoes: Solicitacao[]; onAmpliar: (j: ConteudoJanela) => void }) {
  const [filtro, setFiltro] = useState<'todas' | Capacidade>('todas')
  const conta = (c: Capacidade) => solicitacoes.filter((s) => capacidade(s) === c).length
  const lista = filtro === 'todas' ? solicitacoes : solicitacoes.filter((s) => capacidade(s) === filtro)
  return (
    <>
      <div className="chips-v2" role="group" aria-label="Filtrar pelo que dá para atender">
        <button type="button" className="chip-v2" aria-pressed={filtro === 'todas'} onClick={() => setFiltro('todas')}>
          Todas <span className="sec">{solicitacoes.length}</span>
        </button>
        {(['completo', 'parcial', 'nenhum'] as const).map((c) => (
          <button key={c} type="button" className="chip-v2" aria-pressed={filtro === c} onClick={() => setFiltro(c)}>
            <span className={`ponto ${SELO_CAPACIDADE[c] === 'atencao' ? 'nivel-proximo' : SELO_CAPACIDADE[c]}`} />
            {TEXTO_CAPACIDADE[c]} <span className="sec">{conta(c)}</span>
          </button>
        ))}
      </div>
      <p className="nota-v2">Pelo disponível no 211 agora: completo atende todos os itens, parcial atende parte, sem estoque não atende nenhum.</p>
      <div className="lista-simples">
        {lista.map((s) => {
          const cap = capacidade(s)
          return (
            <button key={s.id} type="button" className="linha-cartao clicavel" onClick={() => onAmpliar({ tipo: 'analise', id: s.id })}>
              <div className="linha-estoque-topo">
                <span>
                  {nomeLocal(s.base)} · <span className="mono sec">{s.numero}</span>
                </span>
                <span className={`selo ${SELO_CAPACIDADE[cap]}`}>{TEXTO_CAPACIDADE[cap]}</span>
              </div>
              <span className="estado">
                <span className={`ponto ${TOM_SITUACAO[s.situacao]}`} />
                {ROTULO_SITUACAO[s.situacao]} · {s.itens.length} {s.itens.length === 1 ? 'material' : 'materiais'}
              </span>
              <Trilho pct={atendimento(s.itens.map((i) => ({ solicitado: i.solicitado, aprovado: Math.min(i.solicitado, i.disponivel) })))} tom={cap === 'nenhum' ? 'alerta' : cap === 'parcial' ? 'atencao' : 'ok'} />
            </button>
          )
        })}
        {lista.length === 0 && <p className="vazio-v2">Nenhuma solicitação nesse filtro.</p>}
      </div>
      <button type="button" className="botao-v2 claro" onClick={() => onAmpliar({ tipo: 'historico' })}>
        <span className="botao-v2-texto">
          <Icone nome="relogio" /> Histórico de solicitações
        </span>
      </button>
    </>
  )
}

/** Equipes que retiram material: no 211 Geral todas; nas bases, só nas liberadas. */
function GavetaEquipes({ equipes, onAmpliar }: { equipes: Equipe[]; onAmpliar: (j: ConteudoJanela) => void }) {
  const [busca, setBusca] = useState('')
  const termo = busca.trim().toLowerCase()
  const lista = equipes.filter((e) => !termo || `${e.codigo} ${e.tipo} ${e.supervisor} ${e.placa} ${e.origem} ${nomeLocal(e.origem)} ${e.integrantes.map((m) => `${m} ${colaborador(m)?.nome ?? ''}`).join(' ')}`.toLowerCase().includes(termo))
  return (
    <>
      <p className="nota-v2">Todas as equipes retiram no 211 Geral. Nas bases, só nas liberadas. Equipe não consulta estoque.</p>
      <div className="dupla-botoes">
        <label className="busca-v2">
          <Icone nome="busca" />
          <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Equipe, nome, matrícula, placa ou base" aria-label="Buscar equipe" />
        </label>
        <button type="button" className="botao-v2 baixo largura-auto" onClick={() => onAmpliar({ tipo: 'equipe' })}>
          <span className="botao-v2-texto">
            <Icone nome="mais" /> Nova equipe
          </span>
        </button>
      </div>
      <div className="lista-simples">
        {lista.map((e, i) => (
          <motion.button key={e.id} type="button" className="linha-cartao clicavel" onClick={() => onAmpliar({ tipo: 'resumoEquipe', id: e.id })} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
            <div className="linha-estoque-topo">
              <span>
                <strong>{e.codigo}</strong> <span className="sec">· {e.tipo}</span>
              </span>
              <span className="selo neutro">{e.supervisor}</span>
            </div>
            <span className="sec peq">{e.integrantes.map((m) => colaborador(m)?.nome ?? m).join(', ')}</span>
            <span className="sec peq">
              <span className="mono">{e.placa}</span> · origem {nomeLocal(e.origem)} · retira em {e.bases.length >= 11 ? 'todas as bases' : `${e.bases.join(', ')}`} + 211 Geral
            </span>
          </motion.button>
        ))}
        {lista.length === 0 && <p className="vazio-v2">Nenhuma equipe encontrada.</p>}
      </div>
    </>
  )
}
