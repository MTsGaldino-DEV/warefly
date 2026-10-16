import {
  BaseEdge,
  getSmoothStepPath,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
  type CoordinateExtent,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/base.css'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useMemo } from 'react'
import {
  BASES,
  BASES_COM_ALERTA,
  equipesDaOrigem,
  estoqueDoCarro,
  estoqueDoLocal,
  GRUPOS,
  nivelDaEquipe,
  nivelDasEquipes,
  nivelDoLocal,
  nomeLocal,
  RESERVAS,
  retiradaPendente,
  RETIRAM_DO_211,
  type CodigoBase,
  type CodigoLocal,
  type Despacho,
  type Equipe,
  type Nivel,
  type NivelItem,
  type Retirada,
} from './exemplo'
import { MOLA } from './movimento'
import { Icone } from './Paineis'

// ---------------------------------------------------------------------------
// Posições: padrão definido aqui; o que a pessoa arrasta fica salvo só neste navegador.
// v2: nova hierarquia (211 Geral + 4 grupos). Posições da v1 são ignoradas.
const CHAVE_POSICOES = 'warefly:mapa-posicoes:v2'

type Posicoes = Record<string, { x: number; y: number }>

function lerPosicoes(): Posicoes {
  try {
    const bruto = localStorage.getItem(CHAVE_POSICOES)
    return bruto ? (JSON.parse(bruto) as Posicoes) : {}
  } catch {
    return {}
  }
}

function gravarPosicoes(p: Posicoes) {
  try {
    localStorage.setItem(CHAVE_POSICOES, JSON.stringify(p))
  } catch {
    // Sem armazenamento (janela privada): as posições valem só até recarregar.
  }
}

function apagarPosicoes() {
  try {
    localStorage.removeItem(CHAVE_POSICOES)
  } catch {
    // idem
  }
}

// Geometria padrão (unidades do mapa). Cada base tem 100 de largura; grupos separados por um respiro maior.
const LARGURA_BASE = 100
const PASSO_BASE = 105
const RESPIRO_GRUPO = 60
const Y_211 = 0
const Y_TRONCO = 272
const Y_GRUPO = 338
const Y_BASE = 404
const LARGURA_211 = 600
const MEIA_JUNCAO = 8

/** Até onde a vista pode ir (não deixa o mapa sumir da tela) e até onde as peças podem ser arrastadas. */
const LIMITE_VISTA: CoordinateExtent = [
  [-900, -520],
  [2250, 1100],
]
const LIMITE_PECAS: CoordinateExtent = [
  [-260, -160],
  [1600, 620],
]

function posicoesBases() {
  const x: Partial<Record<CodigoBase, number>> = {}
  const centroGrupo: Record<string, number> = {}
  let cursor = 0
  for (const g of GRUPOS) {
    const inicio = cursor
    for (const b of g.bases) {
      x[b] = cursor
      cursor += PASSO_BASE
    }
    centroGrupo[g.id] = (inicio + cursor - PASSO_BASE) / 2 + LARGURA_BASE / 2
    cursor += RESPIRO_GRUPO
  }
  const fim = cursor - RESPIRO_GRUPO - PASSO_BASE + LARGURA_BASE
  return { x: x as Record<CodigoBase, number>, centroGrupo, centro: fim / 2 }
}

/** equipes = pior carro com origem no local (aviso no mapa geral); null quando todos estão normais. */
type Dados211 = { materiais: number; nivel: Nivel; ativo: boolean; equipes: NivelItem | null }
type DadosReserva = { alerta: boolean }
type DadosJuncao = { rotulo?: string }
type DadosBase = { codigo: CodigoBase; nome: string; nivel: Nivel; divergencia: boolean; ativo: boolean; equipes: NivelItem | null }
type NoMapa =
  | Node<Dados211, 'geral'>
  | Node<DadosReserva, 'reserva'>
  | Node<DadosJuncao, 'juncao'>
  | Node<DadosBase, 'base'>

type DadosAresta = { alerta?: boolean; reserva?: boolean; ativo?: boolean; despacho?: Despacho; atraso?: number }
type ArestaMapa = Edge<DadosAresta, 'rede'>

function nosPadrao(ativos: Set<CodigoBase>): NoMapa[] {
  const { x, centroGrupo, centro } = posicoesBases()
  const nos: NoMapa[] = [
    { id: '3256', type: 'reserva', position: { x: 40, y: 50 }, data: { alerta: RESERVAS.some((r) => r.alerta) } },
    {
      id: '211',
      type: 'geral',
      position: { x: centro - LARGURA_211 / 2, y: Y_211 },
      data: { materiais: estoqueDoLocal('211').length, nivel: nivelDoLocal(estoqueDoLocal('211')), ativo: ativos.size > 0, equipes: null },
    },
    { id: 'j0', type: 'juncao', position: { x: centro - MEIA_JUNCAO, y: Y_TRONCO }, data: {} },
    ...GRUPOS.map((g): NoMapa => ({ id: `j-${g.id}`, type: 'juncao', position: { x: centroGrupo[g.id] - MEIA_JUNCAO, y: Y_GRUPO }, data: { rotulo: g.rotulo } })),
    ...BASES.map((b): NoMapa => ({
      id: `base-${b.codigo}`,
      type: 'base',
      position: { x: x[b.codigo], y: Y_BASE },
      data: { codigo: b.codigo, nome: b.nome, nivel: nivelDoLocal(estoqueDoLocal(b.codigo)), divergencia: BASES_COM_ALERTA.includes(b.codigo), ativo: ativos.has(b.codigo), equipes: null },
    })),
  ]
  const salvas = lerPosicoes()
  return nos.map((n) => (salvas[n.id] ? { ...n, position: salvas[n.id] } : n))
}

/** Linha acesa só onde há despacho ativo; o resto da rede fica apagado. */
function arestasPadrao(despachos: Despacho[]): ArestaMapa[] {
  const ativos = new Set(despachos.map((d) => d.base))
  const grupoAtivo = (bases: CodigoBase[]) => bases.some((b) => ativos.has(b))
  const arestas: ArestaMapa[] = [
    { id: 'e-3256', source: '3256', target: '211', targetHandle: 'esq', type: 'rede', data: { reserva: true, ativo: true } },
    { id: 'e-tronco', source: '211', sourceHandle: 'baixo', target: 'j0', type: 'rede', data: { ativo: ativos.size > 0 } },
    ...GRUPOS.map((g): ArestaMapa => ({ id: `e-${g.id}`, source: 'j0', target: `j-${g.id}`, type: 'rede', data: { ativo: grupoAtivo(g.bases) } })),
  ]
  let i = 0
  for (const g of GRUPOS) {
    for (const b of g.bases) {
      arestas.push({
        id: `e-base-${b}`,
        source: `j-${g.id}`,
        target: `base-${b}`,
        type: 'rede',
        data: { alerta: BASES_COM_ALERTA.includes(b), ativo: ativos.has(b), despacho: despachos.find((d) => d.base === b), atraso: i * 0.9 },
      })
      i++
    }
  }
  return arestas
}

// ---------------------------------------------------------------------------
// Peças do desenho

function Ponto({ tipo, posicao, id, alerta, desligado }: { tipo: 'source' | 'target'; posicao: Position; id?: string; alerta?: boolean; desligado?: boolean }) {
  const classe = alerta ? 'ponto-mapa alerta' : desligado ? 'ponto-mapa desligado' : 'ponto-mapa'
  return <Handle type={tipo} position={posicao} id={id} isConnectable={false} className={classe} />
}

const TEXTO_NIVEL: Record<Nivel, string> = { ok: 'estoque normal', proximo: 'material próximo do mínimo', abaixo: 'material abaixo do mínimo', sem: 'sem inventário lançado' }
const TEXTO_CARRO: Record<Nivel, string> = { ok: 'carro normal', proximo: 'carro próximo do mínimo', abaixo: 'carro abaixo do mínimo', sem: 'sem kit mínimo' }
const TEXTO_AVISO_EQUIPES: Record<NivelItem, string> = { ok: '', proximo: 'equipe com carro próximo do mínimo', abaixo: 'equipe com carro abaixo do mínimo' }

/** Aviso no mapa geral: alguma equipe com origem no local está com o carro amarelo ou vermelho. A cor do local não muda. */
function AvisoEquipes({ nivel }: { nivel: NivelItem }) {
  return (
    <span className={`aviso-equipes nivel-${nivel}`} title={`Há ${TEXTO_AVISO_EQUIPES[nivel]}. Abra a base para ver.`} aria-hidden="true">
      <Icone nome="caminhao" />
    </span>
  )
}

/** Prateleira de caixas; algumas posições vazias (só desenho). */
function Prateleira({ colunas, total, semente }: { colunas: number; total: number; semente: number }) {
  return (
    <div className="prateleira" style={{ gridTemplateColumns: `repeat(${colunas}, minmax(0, 1fr))` }} aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={(i * 7 + semente) % 11 === 0 ? 'vazia' : undefined} />
      ))}
    </div>
  )
}

/** 211 Geral: um estoque central só. Comercial e moto retiram direto dele. */
function No211({ data }: NodeProps<Node<Dados211, 'geral'>>) {
  return (
    <div className={`no-211 nivel-${data.nivel}`} role="img" aria-label={`211 Geral, estoque central: ${TEXTO_NIVEL[data.nivel]}${data.equipes ? `, ${TEXTO_AVISO_EQUIPES[data.equipes]}` : ''}`}>
      <Ponto tipo="target" posicao={Position.Left} id="esq" />
      <div className="no-211-cab">
        <span className="selo-211">211</span>
        <div className="no-211-titulo">
          <strong>211 Geral · Estoque central</strong>
          <span>Governador Valadares · {data.materiais.toLocaleString('pt-BR')} materiais</span>
        </div>
        {data.equipes && <AvisoEquipes nivel={data.equipes} />}
        {data.nivel !== 'ok' && data.nivel !== 'sem' && <span className={`ponto nivel-${data.nivel}`} aria-hidden="true" />}
      </div>
      <div className="estoque-central">
        <Prateleira colunas={18} total={54} semente={3} />
        <span className="parte-rotulo">Estoque central</span>
      </div>
      <div className="no-211-setores">
        {RETIRAM_DO_211.map((r, i) => (
          <div key={r} className="armario-azul">
            <Prateleira colunas={6} total={18} semente={i * 5 + 2} />
            <span className="parte-rotulo">{r}</span>
            <span className="parte-sec">retira do central</span>
          </div>
        ))}
      </div>
      <div className="no-211-rodape">
        <span className="no-211-destino">Despacha para 11 sub-bases</span>
      </div>
      <Ponto tipo="source" posicao={Position.Bottom} id="baixo" desligado={!data.ativo} />
    </div>
  )
}

/** Resumo das reservas CEMIG embaixo do 3256: a mais antiga com alerta, ou quantas estão abertas. */
function textoReservas(): string {
  const antiga = RESERVAS.find((r) => r.alerta)
  if (antiga) return `Reserva ${antiga.numero} há ${antiga.dias} dias`
  if (!RESERVAS.length) return 'Nenhuma reserva CEMIG'
  return `${RESERVAS.length} ${RESERVAS.length === 1 ? 'reserva CEMIG' : 'reservas CEMIG'}`
}

function NoReserva({ data }: NodeProps<Node<DadosReserva, 'reserva'>>) {
  return (
    <div className="no-reserva">
      <div className="armario" aria-hidden="true">
        <span />
        <span />
        <span />
        {data.alerta && (
          <motion.span className="alerta-triangulo" animate={{ scale: [1, 1.18, 1] }} transition={{ duration: 1.6, repeat: Infinity }}>
            <svg viewBox="0 0 24 24">
              <path d="M12 4l9 16H3z" />
            </svg>
          </motion.span>
        )}
      </div>
      <div className="no-rotulo">
        <span>3256 · Almoxarifado geral</span>
        <span className="sec">{textoReservas()}</span>
      </div>
      <Ponto tipo="source" posicao={Position.Right} />
    </div>
  )
}

function NoJuncao({ data }: NodeProps<Node<DadosJuncao, 'juncao'>>) {
  return (
    <div className="no-juncao">
      <Ponto tipo="target" posicao={Position.Top} />
      <span aria-hidden="true" />
      {data.rotulo && <em className="rotulo-grupo">{data.rotulo}</em>}
      <Ponto tipo="source" posicao={Position.Bottom} />
    </div>
  )
}

function NoBase({ data, selected }: NodeProps<Node<DadosBase, 'base'>>) {
  return (
    <motion.div className={`no-base nivel-${data.nivel}${selected ? ' selecionada' : ''}`} whileHover={{ y: -3 }} transition={{ type: 'spring', stiffness: 400, damping: 22 }}>
      <Ponto tipo="target" posicao={Position.Top} alerta={data.divergencia} desligado={!data.ativo} />
      <div className="bloco" role="img" aria-label={`${data.nome}: ${TEXTO_NIVEL[data.nivel]}${data.divergencia ? ', divergência aberta' : ''}${data.equipes ? `, ${TEXTO_AVISO_EQUIPES[data.equipes]}` : ''}`}>
        {Array.from({ length: 30 }, (_, i) => (
          <span key={i} />
        ))}
        {data.divergencia && <span className="pulso-alerta" aria-hidden="true" />}
      </div>
      {data.equipes && <AvisoEquipes nivel={data.equipes} />}
      <div className="no-rotulo centro">
        <span>{data.codigo}</span>
        <span className="nome-base">{data.nome}</span>
      </div>
    </motion.div>
  )
}

const TIPOS_NO = { geral: No211, reserva: NoReserva, juncao: NoJuncao, base: NoBase }

/** Ligação com cantos arredondados; se houver despacho, um caminhão percorre a linha em loop. */
function ArestaRede({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data }: EdgeProps<ArestaMapa>) {
  const [caminho] = getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, borderRadius: 18 })
  const classe = data?.alerta ? 'linha-mapa alerta' : data?.reserva ? 'linha-mapa reserva' : data?.ativo ? 'linha-mapa' : 'linha-mapa desligada'
  const despacho = data?.despacho
  return (
    <>
      <BaseEdge id={id} path={caminho} className={classe} />
      {despacho && (
        <g
          className={`caminhao${despacho.alerta ? ' alerta' : ''}`}
          role="button"
          aria-label={`${despacho.numero}: ${despacho.situacao}`}
          // Alvo em movimento é difícil de clicar: com o mouse em cima, os caminhões param.
          onMouseEnter={(e) => e.currentTarget.ownerSVGElement?.pauseAnimations()}
          onMouseLeave={(e) => e.currentTarget.ownerSVGElement?.unpauseAnimations()}
        >
          <animateMotion dur="7s" repeatCount="indefinite" begin={`-${data?.atraso ?? 0}s`} path={caminho} keyPoints="0;1;1" keyTimes="0;0.85;1" calcMode="linear" />
          <rect x={-19} y={-11} width={38} height={22} rx={6} />
          <g transform="translate(-9 -9) scale(0.75)">
            <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7" />
            <circle cx="7" cy="17.5" r="1.5" />
            <circle cx="17" cy="17.5" r="1.5" />
          </g>
        </g>
      )}
    </>
  )
}

const TIPOS_ARESTA = { rede: ArestaRede }

// ---------------------------------------------------------------------------

function Controles({ onRestaurar }: { onRestaurar: () => void }) {
  const { zoomIn, zoomOut, fitView } = useReactFlow()
  return (
    <div className="controles-mapa">
      <button type="button" className="botao-quadrado" aria-label="Aproximar" onClick={() => void zoomIn({ duration: 300 })}>
        <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
      <button type="button" className="botao-quadrado" aria-label="Afastar" onClick={() => void zoomOut({ duration: 300 })}>
        <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12h14" />
        </svg>
      </button>
      <button type="button" className="botao-quadrado" aria-label="Enquadrar tudo" onClick={() => void fitView({ duration: 500, padding: AJUSTE })}>
        <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
        </svg>
      </button>
      <button type="button" className="botao-quadrado" aria-label="Restaurar posições" onClick={onRestaurar}>
        <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v5h5" />
        </svg>
      </button>
    </div>
  )
}

function Legenda() {
  return (
    <div className="legenda-mapa" aria-label="Legenda do estoque">
      <span>
        <i className="nivel-ok" /> Normal
      </span>
      <span>
        <i className="nivel-proximo" /> Próximo do mínimo
      </span>
      <span>
        <i className="nivel-abaixo" /> Abaixo do mínimo
      </span>
      <span>
        <i className="nivel-sem" /> Sem inventário
      </span>
      <span>
        <i className="aviso-equipes nivel-abaixo" /> Equipe com carro perto do mínimo
      </span>
      <span>
        <i className="linha" /> Despacho a caminho
      </span>
    </div>
  )
}

/** Espaço que os painéis de vidro ocupam por cima do mapa (esquerda e embaixo). */
const AJUSTE = { top: '4%', right: '7%', bottom: '40%', left: '33%' } as const

type PropsGeral = {
  despachos: Despacho[]
  onAbrirLocal: (codigo: CodigoLocal) => void
  onAbrirDespacho: (d: Despacho, x: number, y: number) => void
  onAbrirReserva: () => void
  /** Clique numa sub-base: abre o mapa dela com as equipes. */
  onAbrirBase: (codigo: CodigoBase) => void
}

function MapaInterno({ despachos, equipes, retiradas, onAbrirLocal, onAbrirDespacho, onAbrirReserva, onAbrirBase }: PropsGeral & { equipes: Equipe[]; retiradas: Retirada[] }) {
  const ativos = useMemo(() => new Set(despachos.map((d) => d.base)), [despachos])
  const [nos, setNos, aoMudarNos] = useNodesState<NoMapa>(nosPadrao(ativos))
  const { fitView } = useReactFlow()

  // Despacho novo acende a linha da base e põe o caminhão na rua, sem mexer nas posições arrastadas.
  const arestas = useMemo(() => arestasPadrao(despachos), [despachos])
  const nosVisiveis = useMemo(
    () =>
      nos.map((n): NoMapa => {
        if (n.type === 'base') return { ...n, data: { ...n.data, ativo: ativos.has(n.data.codigo), equipes: nivelDasEquipes(n.data.codigo, equipes, retiradas) } }
        if (n.type === 'geral') return { ...n, data: { ...n.data, ativo: ativos.size > 0, equipes: nivelDasEquipes('211', equipes, retiradas) } }
        return n
      }),
    [nos, ativos, equipes, retiradas],
  )

  const aoSoltar = useCallback((_: unknown, _no: NoMapa, todos: NoMapa[]) => {
    const atual = lerPosicoes()
    for (const n of todos) atual[n.id] = n.position
    gravarPosicoes(atual)
  }, [])
  const restaurar = useCallback(() => {
    apagarPosicoes()
    setNos(nosPadrao(ativos))
    window.setTimeout(() => void fitView({ duration: 600, padding: AJUSTE }), 50)
  }, [setNos, fitView, ativos])

  return (
    <ReactFlow<NoMapa, ArestaMapa>
      nodes={nosVisiveis}
      edges={arestas}
      onNodesChange={aoMudarNos}
      nodeTypes={TIPOS_NO}
      edgeTypes={TIPOS_ARESTA}
      onNodeDragStop={aoSoltar}
      onNodeClick={(_, n) => {
        if (n.type === 'base') onAbrirBase(n.data.codigo)
        if (n.type === 'reserva') onAbrirReserva()
        if (n.type === 'geral') onAbrirLocal('211')
      }}
      onEdgeClick={(e, a) => {
        if (!a.data?.despacho) return
        const caixa = (e.currentTarget as Element).closest('.react-flow')?.getBoundingClientRect()
        onAbrirDespacho(a.data.despacho, e.clientX - (caixa?.left ?? 0), e.clientY - (caixa?.top ?? 0))
      }}
      fitView
      fitViewOptions={{ padding: AJUSTE }}
      minZoom={0.5}
      maxZoom={1.6}
      translateExtent={LIMITE_VISTA}
      nodeExtent={LIMITE_PECAS}
      nodesConnectable={false}
      edgesFocusable={false}
      proOptions={{ hideAttribution: true }}
      aria-label="Mapa do almoxarifado: 3256, 211 Geral e as bases por grupo. Linha acesa indica despacho a caminho. Clique numa base para ver as equipes dela. Arraste as peças para reorganizar."
    >
      <Legenda />
      <Controles onRestaurar={restaurar} />
    </ReactFlow>
  )
}

// ---------------------------------------------------------------------------
// Mapa de uma sub-base: o armário em cima e uma caixinha por equipe com origem nela (o carro da equipe).

type DadosArmario = { codigo: CodigoBase; nome: string; nivel: Nivel; supervisor: string; equipes: string[] }
type DadosEquipe = { equipe: Equipe; materiais: number; unidades: number; pendentes: number; ordem: number; nivel: Nivel }
type NoFoco = Node<DadosArmario, 'armario'> | Node<DadosEquipe, 'equipe'>

const LARGURA_EQUIPE = 150
const PASSO_EQUIPE = 180
const POR_LINHA = 5
const Y_EQUIPES = 250
const PASSO_LINHA = 150

function NoArmario({ data }: NodeProps<Node<DadosArmario, 'armario'>>) {
  // Cada caixinha do armário é uma equipe com origem na base; as que sobram ficam apagadas.
  const total = Math.max(10, Math.ceil(data.equipes.length / 5) * 5)
  return (
    <div className={`no-armario no-base nivel-${data.nivel}`} role="img" aria-label={`${data.nome}: ${TEXTO_NIVEL[data.nivel]}, ${data.equipes.length} equipes com origem aqui`}>
      <div className="bloco">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={i < data.equipes.length ? 'ocupada' : undefined} title={data.equipes[i]}>
            {i < data.equipes.length ? i + 1 : ''}
          </span>
        ))}
      </div>
      <div className="no-rotulo centro">
        <span>
          {data.codigo} · {data.nome}
        </span>
        <span className="nome-base">Supervisão {data.supervisor}</span>
      </div>
      <Ponto tipo="source" posicao={Position.Bottom} />
    </div>
  )
}

function NoEquipe({ data }: NodeProps<Node<DadosEquipe, 'equipe'>>) {
  const e = data.equipe
  return (
    <motion.div
      className={`no-equipe nivel-${data.nivel}`}
      initial={{ opacity: 0, scale: 0.4, y: -60 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ ...MOLA, delay: 0.12 + data.ordem * 0.06 }}
      whileHover={{ y: -3 }}
      role="button"
      aria-label={`${e.codigo}, ${e.tipo}, placa ${e.placa}, ${TEXTO_CARRO[data.nivel]}. Abrir equipe.`}
    >
      <Ponto tipo="target" posicao={Position.Top} desligado={data.materiais === 0} />
      <span className="no-equipe-numero">{data.ordem + 1}</span>
      {data.pendentes > 0 && <span className="no-equipe-aviso" title={`${data.pendentes} retirada sem guia assinada`} />}
      <div className="no-equipe-topo">
        <span className="no-equipe-icone">
          <Icone nome={e.tipo === 'Moto' ? 'moto' : 'caminhao'} />
        </span>
        <div>
          <strong>{e.codigo}</strong>
          <span className="mono">{e.placa}</span>
        </div>
      </div>
      <span className="no-equipe-linha">
        {e.integrantes.length} {e.integrantes.length === 1 ? 'integrante' : 'integrantes'} · {e.tipo === 'Moto' ? 'moto' : 'multifuncional'}
      </span>
      <span className="no-equipe-linha">{data.materiais ? `${data.materiais} materiais · ${data.unidades.toLocaleString('pt-BR')} un no carro` : 'Carro vazio'}</span>
      {(data.nivel === 'proximo' || data.nivel === 'abaixo') && <span className="no-equipe-nivel">{data.nivel === 'abaixo' ? 'Abaixo do mínimo' : 'Próximo do mínimo'}</span>}
    </motion.div>
  )
}

const TIPOS_NO_FOCO = { armario: NoArmario, equipe: NoEquipe }

function nosDaBase(codigo: CodigoBase, equipes: Equipe[], retiradas: Retirada[]): { nos: NoFoco[]; arestas: ArestaMapa[] } {
  const daOrigem = equipesDaOrigem(codigo, equipes)
  const larguraMax = Math.min(daOrigem.length, POR_LINHA) * PASSO_EQUIPE - (PASSO_EQUIPE - LARGURA_EQUIPE)
  const grupo = GRUPOS.find((g) => g.bases.includes(codigo))
  const nos: NoFoco[] = [
    {
      id: 'armario',
      type: 'armario',
      position: { x: Math.max(larguraMax, LARGURA_EQUIPE) / 2 - 80, y: 0 },
      data: { codigo, nome: nomeLocal(codigo), nivel: nivelDoLocal(estoqueDoLocal(codigo)), supervisor: grupo?.rotulo ?? '—', equipes: daOrigem.map((e) => e.codigo) },
      draggable: false,
    },
  ]
  const arestas: ArestaMapa[] = []
  daOrigem.forEach((e, i) => {
    const linha = Math.floor(i / POR_LINHA)
    const naLinha = Math.min(POR_LINHA, daOrigem.length - linha * POR_LINHA)
    const desloc = ((Math.min(daOrigem.length, POR_LINHA) - naLinha) * PASSO_EQUIPE) / 2
    const carro = estoqueDoCarro(e.id, retiradas)
    nos.push({
      id: `equipe-${e.id}`,
      type: 'equipe',
      position: { x: desloc + (i % POR_LINHA) * PASSO_EQUIPE, y: Y_EQUIPES + linha * PASSO_LINHA },
      data: { equipe: e, materiais: carro.length, unidades: carro.reduce((t, x) => t + x.qtd, 0), pendentes: retiradas.filter((r) => r.equipe === e.id && retiradaPendente(r)).length, ordem: i, nivel: nivelDaEquipe(e, retiradas) },
    })
    arestas.push({ id: `e-${e.id}`, source: 'armario', target: `equipe-${e.id}`, type: 'rede', data: { ativo: carro.length > 0 } })
  })
  return { nos, arestas }
}

/** No mapa da base a barra de cima ocupa espaço: o armário desce para não ficar embaixo dela. */
const AJUSTE_BASE = { ...AJUSTE, top: '20%' } as const

type PropsBase = {
  codigo: CodigoBase
  equipes: Equipe[]
  retiradas: Retirada[]
  onVoltar: () => void
  onAbrirEquipe: (id: string) => void
  onEstoque: () => void
  onNovaEquipe: () => void
}

function MapaDaBaseInterno({ codigo, equipes, retiradas, onVoltar, onAbrirEquipe, onEstoque, onNovaEquipe }: PropsBase) {
  const { nos, arestas } = useMemo(() => nosDaBase(codigo, equipes, retiradas), [codigo, equipes, retiradas])
  const daOrigem = nos.length - 1
  const nivel = nos[0].type === 'armario' ? nos[0].data.nivel : 'ok'
  return (
    <ReactFlow<NoFoco, ArestaMapa>
      nodes={nos}
      edges={arestas}
      nodeTypes={TIPOS_NO_FOCO}
      edgeTypes={TIPOS_ARESTA}
      nodesDraggable={false}
      onNodeClick={(_, n) => {
        if (n.type === 'equipe') onAbrirEquipe(n.data.equipe.id)
        if (n.type === 'armario') onEstoque()
      }}
      fitView
      fitViewOptions={{ padding: AJUSTE_BASE, maxZoom: 1.2 }}
      minZoom={0.5}
      maxZoom={1.6}
      nodesConnectable={false}
      edgesFocusable={false}
      proOptions={{ hideAttribution: true }}
      aria-label={`Mapa de ${nomeLocal(codigo)}: o armário da base e as equipes com origem nela. Clique numa equipe para ver integrantes e estoque do carro.`}
    >
      <motion.div className="vidro barra-base" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={MOLA}>
        <button type="button" className="botao-quadrado" aria-label="Voltar ao mapa geral" title="Voltar ao mapa geral" onClick={onVoltar}>
          <Icone nome="voltar" />
        </button>
        <span className={`bloco-mini nivel-${nivel}`} aria-hidden="true" />
        <div className="barra-base-titulo">
          <strong>
            {codigo} · {nomeLocal(codigo)}
          </strong>
          <span className="sec">
            {daOrigem} {daOrigem === 1 ? 'equipe com origem aqui' : 'equipes com origem aqui'} · {TEXTO_NIVEL[nivel]}
          </span>
        </div>
        <button type="button" className="botao-v2 claro baixo largura-auto" onClick={onEstoque}>
          <span className="botao-v2-texto">
            <Icone nome="caixa" /> Estoque da base
          </span>
        </button>
        <button type="button" className="botao-v2 baixo largura-auto" onClick={onNovaEquipe}>
          <span className="botao-v2-texto">
            <Icone nome="mais" /> Nova equipe aqui
          </span>
        </button>
      </motion.div>
      <div className="legenda-mapa" aria-label="Legenda do mapa da base">
        <span>
          <i className="equipe" /> Equipe (origem nesta base)
        </span>
        <span>
          <i className="nivel-proximo" /> Carro próximo do mínimo
        </span>
        <span>
          <i className="nivel-abaixo" /> Carro abaixo do mínimo
        </span>
        <span>
          <i className="linha" /> Material no carro
        </span>
        <span>
          <i className="nivel-proximo redondo" /> Retirada sem guia
        </span>
      </div>
      {daOrigem === 0 && <p className="vazio-mapa">Nenhuma equipe com origem em {nomeLocal(codigo)}. Use Nova equipe aqui para cadastrar.</p>}
    </ReactFlow>
  )
}

type PropsMapa = PropsGeral & {
  baseAberta: CodigoBase | null
  equipes: Equipe[]
  retiradas: Retirada[]
  onVoltar: () => void
  onAbrirEquipe: (id: string) => void
  onNovaEquipe: (codigo: CodigoBase) => void
}

/** Mapa geral da rede; com uma sub-base aberta, troca para o mapa dela com as equipes. */
export function Mapa({ baseAberta, equipes, retiradas, onVoltar, onAbrirEquipe, onNovaEquipe, ...geral }: PropsMapa) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      {baseAberta ? (
        <motion.div key={`base-${baseAberta}`} className="mapa-camada" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.22 }}>
          <ReactFlowProvider>
            <MapaDaBaseInterno
              codigo={baseAberta}
              equipes={equipes}
              retiradas={retiradas}
              onVoltar={onVoltar}
              onAbrirEquipe={onAbrirEquipe}
              onEstoque={() => geral.onAbrirLocal(baseAberta)}
              onNovaEquipe={() => onNovaEquipe(baseAberta)}
            />
          </ReactFlowProvider>
        </motion.div>
      ) : (
        <motion.div key="geral" className="mapa-camada" initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.06 }} transition={{ duration: 0.22 }}>
          <ReactFlowProvider>
            <MapaInterno {...geral} equipes={equipes} retiradas={retiradas} />
          </ReactFlowProvider>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
