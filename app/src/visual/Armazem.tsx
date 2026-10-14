import { AnimatePresence, motion, MotionConfig } from 'motion/react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSessao } from '../auth/SessaoContext'
import { ROTA_ADMIN } from '../lib/admin'
import { Simbolo } from '../components/ui'
import './armazem.css'
import { JanelaDetalhe, type NovaRetirada, type NovoDespacho } from './Detalhes'
import { DESPACHOS, despachoDaSolicitacao, EQUIPES, numeroDespacho, RETIRADAS, SEQUENCIA_INICIAL, SOLICITACOES, validarAnexo, type AnexoGuia, type CodigoBase, type Despacho, type Equipe, type Retirada, type Solicitacao } from './exemplo'
import { GuiaImpressao, type DocumentoGuia } from './Guia'
import { Mapa } from './Mapa'
import { CartoesGraficos, Gaveta, Icone, Indicadores, PainelSaida, PopoverDespacho, type ConteudoGaveta, type ConteudoJanela } from './Paineis'

const MENU: { tipo: 'solicitacoes' | 'despachos' | 'estoque' | 'reservas' | 'equipes' | 'divergencias'; rotulo: string }[] = [
  { tipo: 'solicitacoes', rotulo: 'Solicitações' },
  { tipo: 'despachos', rotulo: 'Despachos' },
  { tipo: 'estoque', rotulo: 'Estoque' },
  { tipo: 'reservas', rotulo: 'Reservas' },
  { tipo: 'equipes', rotulo: 'Equipes' },
  { tipo: 'divergencias', rotulo: 'Divergências' },
]

/** Aba do menu que fica marcada para cada conteúdo da gaveta. */
function abaDe(c: ConteudoGaveta | null): (typeof MENU)[number]['tipo'] | null {
  if (!c) return null
  if (c.tipo === 'local') return 'estoque'
  if (c.tipo === 'reserva') return 'reservas'
  return c.tipo
}

const agora = () => new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '')
const idDocumento = (d: DocumentoGuia) => (d.tipo === 'despacho' ? d.despacho.id : d.retirada.id)

/**
 * Início no modo foco visual: cópia da referência adaptada ao 211.
 * Menus abrem numa gaveta de vidro por cima do mapa; o que precisa de mais espaço abre numa janela grande no centro.
 */
export function Armazem() {
  const { perfil, rotuloPerfil, sair, ehAdmin } = useSessao()
  const navegar = useNavigate()
  const [gaveta, setGaveta] = useState<ConteudoGaveta | null>(null)
  // Sub-base aberta no mapa (mostra as equipes com origem nela); null = mapa geral.
  const [baseAberta, setBaseAberta] = useState<CodigoBase | null>(null)
  const [janela, setJanela] = useState<ConteudoJanela | null>(null)
  const [popover, setPopover] = useState<{ despacho: Despacho; x: number; y: number } | null>(null)
  const [guia, setGuia] = useState<DocumentoGuia | null>(null)
  const palco = useRef<HTMLDivElement>(null)
  // Saídas do 211: despachos para as bases e retiradas no balcão, com a mesma numeração DSP-.
  const [despachos, setDespachos] = useState<Despacho[]>(DESPACHOS)
  const [retiradas, setRetiradas] = useState<Retirada[]>(RETIRADAS)
  const [sequencia, setSequencia] = useState(SEQUENCIA_INICIAL)
  const [equipes, setEquipes] = useState<Equipe[]>(EQUIPES)
  // Quem está logado assina como responsável do almoxarifado na guia e no termo.
  const responsavel = perfil?.nome ?? 'Almoxarifado 211'
  const salvarEquipe = useCallback((e: Equipe) => setEquipes((l) => (l.some((x) => x.id === e.id) ? l.map((x) => (x.id === e.id ? e : x)) : [...l, e])), [])
  const [contaAberta, setContaAberta] = useState(false)
  const [periodo, setPeriodo] = useState<'hoje' | 'mes'>('mes')
  // Despachadas saem da fila e vão para o histórico.
  const [arquivadas, setArquivadas] = useState<Set<string>>(() => new Set(SOLICITACOES.filter((s) => s.situacao === 'enviada').map((s) => s.id)))
  const [geradas, setGeradas] = useState<Record<string, Despacho>>({})

  const fecharGaveta = useCallback(() => setGaveta(null), [])
  const fecharJanela = useCallback(() => setJanela(null), [])
  const fecharGuia = useCallback(() => setGuia(null), [])
  const fila = useMemo(() => SOLICITACOES.filter((s) => !arquivadas.has(s.id)), [arquivadas])
  const aba = abaDe(gaveta)

  const proximoNumero = numeroDespacho(sequencia)

  const gerarDespacho = useCallback(
    (s: Solicitacao, aprovados: Record<string, number>) => {
      const d = { ...despachoDaSolicitacao(s, aprovados, numeroDespacho(sequencia)), id: `d-${sequencia}`, enviadoPor: responsavel }
      setSequencia((n) => n + 1)
      setDespachos((ds) => [d, ...ds])
      setGeradas((g) => ({ ...g, [s.id]: d }))
      setArquivadas((a) => new Set(a).add(s.id))
    },
    [sequencia, responsavel],
  )

  const criarDespacho = useCallback(
    (novo: NovoDespacho) => {
      const d: Despacho = {
        id: `d-${sequencia}`,
        numero: numeroDespacho(sequencia),
        base: novo.base,
        solicitacao: novo.solicitacao ?? '',
        situacao: novo.veiculo ? 'Em trânsito' : 'Aguardando carregamento',
        conferido: 0,
        saida: agora(),
        enviadoPor: responsavel,
        veiculo: novo.veiculo,
        itens: novo.itens,
      }
      setSequencia((n) => n + 1)
      setDespachos((ds) => [d, ...ds])
      if (novo.solicitacaoId) {
        const id = novo.solicitacaoId
        setGeradas((g) => ({ ...g, [id]: d }))
        setArquivadas((a) => new Set(a).add(id))
      }
      setJanela({ tipo: 'despacho', despacho: d })
      setGuia({ tipo: 'despacho', despacho: d })
    },
    [sequencia, responsavel],
  )

  const criarRetirada = useCallback(
    (nova: NovaRetirada) => {
      const r: Retirada = { id: `r-${sequencia}`, numero: numeroDespacho(sequencia), data: agora(), atendidoPor: responsavel, ...nova }
      setSequencia((n) => n + 1)
      setRetiradas((rs) => [r, ...rs])
      setJanela({ tipo: 'retirada', retirada: r })
      setGuia({ tipo: 'retirada', retirada: r })
    },
    [sequencia, responsavel],
  )

  // Guia assinada volta como foto ou PDF; com ela a retirada sai das pendentes. No modo visual o arquivo fica só na sessão.
  const anexarGuia = useCallback(
    (id: string, arquivo: File) => {
      const v = validarAnexo(arquivo)
      if ('erro' in v) return
      const anexo: AnexoGuia = { arquivo: arquivo.name, formato: v.formato, anexadoEm: agora(), anexadoPor: responsavel, url: URL.createObjectURL(arquivo) }
      setRetiradas((rs) =>
        rs.map((r) => {
          if (r.id !== id) return r
          if (r.guiaAssinada?.url) URL.revokeObjectURL(r.guiaAssinada.url)
          return { ...r, guiaAssinada: anexo }
        }),
      )
    },
    [responsavel],
  )

  return (
    <MotionConfig reducedMotion="user">
      <div className="armazem">
        <header className="armazem-topo">
          <div className="armazem-marca">
            <Simbolo tamanho={30} />
            <div>
              <strong>Warefly</strong>
              <span>Almoxarifado regional</span>
            </div>
          </div>
          <nav className="armazem-menu" aria-label="Menu">
            <button type="button" className="pilula" aria-pressed={aba === null} onClick={fecharGaveta}>
              {aba === null && <motion.span layoutId="pilula-ativa" className="pilula-fundo" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
              <span>Armazém</span>
            </button>
            {MENU.map((m) => {
              const ativo = aba === m.tipo
              return (
                <button key={m.tipo} type="button" className="pilula" aria-pressed={ativo} onClick={() => setGaveta({ tipo: m.tipo })}>
                  {ativo && <motion.span layoutId="pilula-ativa" className="pilula-fundo" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
                  <span>{m.rotulo}</span>
                </button>
              )
            })}
          </nav>
          <div className="armazem-acoes">
            {/* A busca antiga levava às telas da primeira versão; volta quando a busca do modo visual existir. */}
            <button type="button" className="botao-quadrado" aria-label="Buscar (em construção)" title="Busca em construção" disabled>
              <Icone nome="busca" />
            </button>
            <button type="button" className="botao-quadrado com-aviso" aria-label="Avisos: 3 divergências abertas" onClick={() => setGaveta({ tipo: 'divergencias' })}>
              <Icone nome="sino" />
              <span className="bolinha" aria-hidden="true" />
            </button>
            <div className="conta-v2">
              <button type="button" className="botao-quadrado" aria-label="Conta" aria-expanded={contaAberta} onClick={() => setContaAberta(!contaAberta)}>
                <Icone nome="pessoa" />
              </button>
              <AnimatePresence>
                {contaAberta && (
                  <motion.div className="vidro menu-conta" initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.97 }}>
                    <strong>{perfil?.nome}</strong>
                    <span className="sec peq">{rotuloPerfil}</span>
                    {ehAdmin && (
                      <button type="button" className="botao-v2 claro" onClick={() => navegar(ROTA_ADMIN)}>
                        Administração
                      </button>
                    )}
                    <button type="button" className="botao-v2 claro" onClick={() => void sair()}>
                      Sair
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        <section className="armazem-cabecalho">
          <div className="armazem-titulo">
            <button type="button" className="botao-quadrado" aria-label="Voltar" onClick={() => navegar(-1)}>
              <Icone nome="voltar" />
            </button>
            <div>
              <h1>Almoxarifado 211</h1>
              <span className="sec">211 Geral em Governador Valadares · 11 sub-bases em 4 grupos</span>
            </div>
          </div>
          <Indicadores />
          <div className="armazem-ferramentas">
            <button type="button" className="alternador" onClick={() => setPeriodo(periodo === 'hoje' ? 'mes' : 'hoje')} aria-label={`Período: ${periodo === 'hoje' ? 'hoje' : 'últimos 30 dias'}. Trocar.`}>
              <span className={periodo === 'hoje' ? 'ativo' : undefined}>Hoje</span>
              <Icone nome="troca" />
              <span className={periodo === 'mes' ? 'ativo' : undefined}>30 dias</span>
            </button>
          </div>
        </section>

        <div className="armazem-palco" ref={palco}>
          <Mapa
            despachos={despachos}
            baseAberta={baseAberta}
            equipes={equipes}
            retiradas={retiradas}
            onAbrirBase={(codigo) => {
              setPopover(null)
              setGaveta(null)
              setBaseAberta(codigo)
            }}
            onVoltar={() => {
              setGaveta(null)
              setBaseAberta(null)
            }}
            onAbrirEquipe={(id) => setJanela({ tipo: 'resumoEquipe', id })}
            onNovaEquipe={() => setJanela({ tipo: 'equipe' })}
            onAbrirLocal={(codigo) => {
              setPopover(null)
              setGaveta({ tipo: 'local', codigo })
            }}
            onAbrirDespacho={(despacho, x, y) => setPopover({ despacho, x, y })}
            onAbrirReserva={() => setGaveta({ tipo: 'reservas' })}
          />
          <PainelSaida despachos={despachos} retiradas={retiradas} equipes={equipes} filaSolicitacoes={fila.length} onAbrir={setJanela} onGuia={setGuia} onSolicitacoes={() => setGaveta({ tipo: 'solicitacoes' })} onAnexarGuia={anexarGuia} />
          <CartoesGraficos />
          <AnimatePresence>
            {popover && (
              <PopoverDespacho
                key={popover.despacho.id}
                {...popover}
                onFechar={() => setPopover(null)}
                onAbrirDespacho={() => {
                  setJanela({ tipo: 'despacho', despacho: popover.despacho })
                  setPopover(null)
                }}
                onVerGuia={() => {
                  setGuia({ tipo: 'despacho', despacho: popover.despacho })
                  setPopover(null)
                }}
              />
            )}
          </AnimatePresence>
          <Gaveta conteudo={gaveta} onFechar={fecharGaveta} onAbrir={setGaveta} onAmpliar={setJanela} onImprimirGuia={setGuia} solicitacoes={fila} despachos={despachos} retiradas={retiradas} equipes={equipes} />
          <JanelaDetalhe
            conteudo={janela}
            onFechar={fecharJanela}
            onAbrir={setJanela}
            onGuia={setGuia}
            palco={palco}
            despachos={despachos}
            retiradas={retiradas}
            proximoNumero={proximoNumero}
            geradas={geradas}
            arquivadas={arquivadas}
            onGerar={gerarDespacho}
            onCriarDespacho={criarDespacho}
            onCriarRetirada={criarRetirada}
            equipes={equipes}
            onSalvarEquipe={salvarEquipe}
            onAnexarGuia={anexarGuia}
            responsavel={responsavel}
          />
        </div>
        <AnimatePresence>{guia && <GuiaImpressao key={idDocumento(guia)} documento={guia} onFechar={fecharGuia} responsavel={responsavel} equipes={equipes} />}</AnimatePresence>
      </div>
    </MotionConfig>
  )
}
