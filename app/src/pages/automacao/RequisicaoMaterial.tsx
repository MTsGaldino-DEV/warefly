import { useEffect, useMemo, useState } from 'react'
import { useCatalogo } from '../../auth/CatalogoContext'
import { MaterialBusca } from '../../components/MaterialBusca'
import { Aviso, Campo, PaginaTopo, Regiao, StatusBadge, Vazio } from '../../components/ui'
import {
  ANDAMENTO_VAZIO,
  aplicarEvento,
  chamarConector,
  ouvirConector,
  pingConector,
  type EstadoConector,
  type EstadoPasso,
} from '../../lib/conector'
import {
  INSTALACAO_PADRAO,
  frasePeriodo,
  lerLista,
  mesSeguinte,
  paraEnvio,
  validarRequisicao,
  type ItemRequisicao,
} from '../../lib/requisicaoGdis'

const CHAVE = 'warefly.requisicaoGdis'

type Guardado = { periodo: string; instalacao: string; itens: ItemRequisicao[] }

function lerGuardado(): Guardado | null {
  try {
    const bruto = localStorage.getItem(CHAVE)
    return bruto ? (JSON.parse(bruto) as Guardado) : null
  } catch {
    return null
  }
}

function guardar(g: Guardado) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(g))
  } catch {
    // sem armazenamento: a tela só não lembra a lista
  }
}

const TOM: Record<EstadoPasso, 'info' | 'ok' | 'alerta'> = { andamento: 'info', ok: 'ok', erro: 'alerta' }
const ROTULO: Record<EstadoPasso, string> = { andamento: 'Em andamento', ok: 'Feito', erro: 'Erro' }

export function RequisicaoMaterial() {
  const { material, materiais } = useCatalogo()
  const [inicial] = useState(lerGuardado)
  const [periodo, setPeriodo] = useState(inicial?.periodo ?? mesSeguinte())
  const [instalacao, setInstalacao] = useState(inicial?.instalacao ?? INSTALACAO_PADRAO)
  const [itens, setItens] = useState<ItemRequisicao[]>(inicial?.itens ?? [])
  const [colando, setColando] = useState(false)
  const [textoLista, setTextoLista] = useState('')
  const [errosLista, setErrosLista] = useState<string[]>([])

  // O conector guarda login pendente e andamento; a aba relê tudo pelo /ping
  // e os eventos só adiantam o que o próximo /ping traria.
  const [conector, setConector] = useState<EstadoConector | null | undefined>(undefined)
  const [mensagem, setMensagem] = useState<{ tipo: 'erro' | 'info' | 'sucesso'; texto: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const aguardandoLogin = !!conector?.aguardandoLogin
  const andamento = conector?.andamento ?? ANDAMENTO_VAZIO

  useEffect(() => guardar({ periodo, instalacao, itens }), [periodo, instalacao, itens])

  // Estado do conector: consulta a cada 3 s enquanto a tela está aberta.
  useEffect(() => {
    let vivo = true
    const consultar = () => void pingConector().then((e) => vivo && setConector(e))
    consultar()
    const t = setInterval(consultar, 3000)
    return () => {
      vivo = false
      clearInterval(t)
    }
  }, [])

  const ligado = !!conector
  useEffect(() => {
    if (!ligado) return
    return ouvirConector((e) => {
      if (e.tipo === 'sessao_perdida') setMensagem({ tipo: 'erro', texto: e.msg })
      setConector((c) => {
        if (!c) return c
        if (e.tipo === 'aguardando_login') return { ...c, aguardandoLogin: true }
        if (e.tipo === 'sessao_ok') return { ...c, sessaoOk: true, aguardandoLogin: false }
        if (e.tipo === 'sessao_perdida') return { ...c, sessaoOk: false, aguardandoLogin: false }
        if (e.tipo === 'fim') return { ...c, tarefaAtiva: false, andamento: aplicarEvento(c.andamento, e) }
        return { ...c, andamento: aplicarEvento(c.andamento, e) }
      })
    })
  }, [ligado])

  const idDoCodigo = useMemo(() => {
    const mapa = new Map(materiais.map((m) => [m.codigo_sap, m.id]))
    return (codigo: string) => mapa.get(codigo) ?? null
  }, [materiais])

  let frase = ''
  try {
    frase = frasePeriodo(periodo)
  } catch {
    frase = ''
  }
  const erros = validarRequisicao(periodo, instalacao, itens)
  const rodando = !!conector?.tarefaAtiva
  const podeMontar = !!conector?.sessaoOk && !rodando && !ocupado && erros.length === 0

  async function acao(fn: () => Promise<void>) {
    setMensagem(null)
    setOcupado(true)
    try {
      await fn()
    } catch (e) {
      setMensagem({ tipo: 'erro', texto: (e as Error).message })
    } finally {
      setOcupado(false)
    }
  }

  function adicionarColados() {
    const r = lerLista(textoLista, new Set(itens.map((i) => i.codigo)), idDoCodigo)
    setItens([...itens, ...r.itens])
    setErrosLista(r.erros)
    if (!r.erros.length) {
      setTextoLista('')
      setColando(false)
    }
  }

  function montar() {
    void acao(async () => {
      await chamarConector('/requisicao-material', paraEnvio(periodo, instalacao, itens))
      setConector((c) => (c ? { ...c, tarefaAtiva: true, andamento: ANDAMENTO_VAZIO } : c))
    })
  }

  return (
    <div className="pilha">
      <PaginaTopo
        titulo="Solicitar material no GDIS"
        trilha={[{ rotulo: 'Automações', para: '/admin/automacoes' }, 'Solicitar material no GDIS']}
        sub="Monta no GDIS a nota corretiva de requisição de material. O robô para antes de salvar: você revisa e clica em Salvar no GDIS."
      />

      <Regiao titulo="Conector">
        {conector === undefined ? (
          <p className="sec">Procurando o conector…</p>
        ) : conector === null ? (
          <Aviso tipo="atencao">
            Conector desligado. Rode <span className="mono">npm start</span> na pasta <span className="mono">conector</span>{' '}
            desta máquina.
          </Aviso>
        ) : conector.sessaoOk ? (
          <p>
            <StatusBadge tom="ok">Sessão GDIS ativa</StatusBadge>
          </p>
        ) : (
          <div className="linha">
            <button
              type="button"
              className={aguardandoLogin ? 'botao secundario' : 'botao'}
              disabled={ocupado || rodando}
              onClick={() =>
                void acao(async () => {
                  await chamarConector('/sessao/iniciar')
                  setConector((c) => (c ? { ...c, aguardandoLogin: true } : c))
                })
              }
            >
              Abrir login do GDIS
            </button>
            {aguardandoLogin && (
              <button
                type="button"
                className="botao"
                disabled={ocupado}
                onClick={() =>
                  void acao(async () => {
                    await chamarConector('/sessao/confirmar')
                    setConector((c) => (c ? { ...c, sessaoOk: true, aguardandoLogin: false } : c))
                  })
                }
              >
                Já entrei
              </button>
            )}
            {aguardandoLogin && (
              <span className="sec peq">Entre no GDIS no Edge (senha e reCAPTCHA) e depois clique em “Já entrei”.</span>
            )}
          </div>
        )}
      </Regiao>

      <Aviso tipo={mensagem?.tipo ?? 'info'}>{mensagem?.texto}</Aviso>

      <Regiao titulo="Dados da nota">
        <div className="linha">
          <Campo rotulo="Mês da requisição">
            <input type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
          </Campo>
          <Campo rotulo="P. de Instalação" erro={/^\d{10}$/.test(instalacao) ? null : 'Use os 10 dígitos.'}>
            <input
              inputMode="numeric"
              maxLength={10}
              value={instalacao}
              onChange={(e) => setInstalacao(e.target.value.trim())}
            />
          </Campo>
        </div>
        <Campo rotulo="Outras informações (vai assim para o GDIS)">
          <output className="mono">{frase || '—'}</output>
        </Campo>
        <p className="sec peq">Motivo/Causa 22 · Rede BT/MT · Serviço 291 · Componente Material.</p>
      </Regiao>

      <Regiao
        titulo="Materiais"
        sub="O código vai para o GDIS como está: é o código SAP do catálogo."
        acoes={
          <>
            <button type="button" className="botao secundario" onClick={() => setColando(!colando)}>
              Colar lista
            </button>
            {itens.length > 0 && (
              <button type="button" className="botao secundario" disabled={rodando} onClick={() => setItens([])}>
                Limpar
              </button>
            )}
          </>
        }
      >
        {colando && (
          <div className="pilha">
            <Campo rotulo="Lista de materiais" ajuda="Uma linha por item: código e quantidade, separados por ; tab ou espaço.">
              <textarea rows={6} value={textoLista} onChange={(e) => setTextoLista(e.target.value)} />
            </Campo>
            <div className="linha">
              <button type="button" className="botao" onClick={adicionarColados}>
                Adicionar à lista
              </button>
            </div>
            {errosLista.length > 0 && (
              <Aviso tipo="erro">
                {errosLista.map((e) => (
                  <div key={e}>{e}</div>
                ))}
              </Aviso>
            )}
          </div>
        )}
        <MaterialBusca
          excluir={new Set(itens.map((i) => i.materialId).filter((x): x is string => !!x))}
          onEscolher={(m) =>
            itens.some((i) => i.codigo === m.codigo_sap)
              ? undefined
              : setItens([...itens, { codigo: m.codigo_sap, quantidade: '', materialId: m.id }])
          }
        />
        {itens.length === 0 ? (
          <Vazio>Busque no catálogo ou cole uma lista para montar a requisição.</Vazio>
        ) : (
          <div className="tabela-envoltorio">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Material</th>
                  <th>Quantidade</th>
                  <th>No GDIS</th>
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {itens.map((item, i) => {
                  const m = material(item.materialId)
                  const estado = andamento.itens[item.codigo]
                  return (
                    <tr key={item.codigo}>
                      <td className="mono">{item.codigo}</td>
                      <td>{m ? m.descricao : <span className="sec">fora do catálogo</span>}</td>
                      <td>
                        <input
                          aria-label={`Quantidade de ${item.codigo}`}
                          inputMode="numeric"
                          maxLength={3}
                          style={{ width: '6em' }}
                          value={item.quantidade}
                          disabled={rodando}
                          onChange={(e) =>
                            setItens(itens.map((x, j) => (j === i ? { ...x, quantidade: e.target.value.trim() } : x)))
                          }
                        />
                      </td>
                      <td>
                        {estado ? (
                          <>
                            <StatusBadge tom={TOM[estado.estado]}>{ROTULO[estado.estado]}</StatusBadge>
                            {estado.msg && <div className="sec peq">{estado.msg}</div>}
                          </>
                        ) : (
                          <span className="sec">—</span>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="botao-mini"
                          disabled={rodando}
                          aria-label={`Remover ${item.codigo}`}
                          onClick={() => setItens(itens.filter((_, j) => j !== i))}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Regiao>

      {erros.length > 0 && itens.length > 0 && (
        <Aviso tipo="atencao">
          {erros.map((e) => (
            <div key={e}>{e}</div>
          ))}
        </Aviso>
      )}

      <div className="linha">
        <button type="button" className="botao" disabled={!podeMontar} onClick={montar}>
          Montar nota no GDIS
        </button>
        {rodando && (
          <button type="button" className="botao secundario" onClick={() => void acao(() => chamarConector('/cancelar'))}>
            Cancelar
          </button>
        )}
        {!conector?.sessaoOk && <span className="sec peq">Confirme a sessão do GDIS para montar a nota.</span>}
      </div>

      {(andamento.etapas.length > 0 || andamento.fim) && (
        <Regiao titulo="Andamento">
          <ol className="pilha">
            {andamento.etapas.map((e) => (
              <li key={e.id}>
                <StatusBadge tom={TOM[e.estado]}>{ROTULO[e.estado]}</StatusBadge> {e.msg}
              </li>
            ))}
          </ol>
          {andamento.fim && <Aviso tipo={andamento.fim.ok ? 'sucesso' : 'erro'}>{andamento.fim.msg}</Aviso>}
        </Regiao>
      )}
    </div>
  )
}
