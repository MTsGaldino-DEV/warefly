import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCatalogo } from '../../auth/CatalogoContext'
import { useSessao } from '../../auth/SessaoContext'
import { ItensQuantidade, validarLinhas, type LinhaQtd } from '../../components/ItensQuantidade'
import { MaterialBusca, MaterialRotulo } from '../../components/MaterialBusca'
import { Aviso, Campo, PaginaTopo, Vazio } from '../../components/ui'
import { saldosDe } from '../../lib/compartilhado'
import { mensagemErro } from '../../lib/erros'
import { formatarDoc, formatarQtd, formatarSinal, hojeISO, lerNumero, qtdValida, rotuloStatus } from '../../lib/formato'
import { novoId } from '../../lib/id'
import { validarQuemRetirou } from '../../lib/saida'
import { supabase, type Almox, type Enum } from '../../lib/supabase'
import { listaOuErro, useConsulta } from '../../lib/useConsulta'
import { SeletorAlmox } from '../Saldo'

function useSaldos(almoxId: string, versao = 0) {
  const [saldos, setSaldos] = useState<Map<string, number> | null>(null)
  useEffect(() => {
    // Trocar de almoxarifado com a consulta anterior ainda em andamento não
    // pode deixar a resposta antiga sobrescrever a nova.
    let vigente = true
    setSaldos(null)
    if (almoxId)
      void saldosDe(almoxId)
        .then((s) => vigente && setSaldos(s))
        .catch(() => vigente && setSaldos(new Map()))
    return () => {
      vigente = false
    }
  }, [almoxId, versao])
  return saldos
}

/**
 * Equipes ativas que podem retirar num almoxarifado: as da base, ou as das bases de um regional.
 * Devolve null enquanto a lista do almoxarifado atual não chegou: logo depois de trocar de
 * almoxarifado, os dados ainda são do anterior e não podem aparecer para escolha.
 */
function useEquipes(local: Almox | undefined, almoxarifados: Almox[]) {
  const ids = !local
    ? []
    : local.tipo === 'base'
      ? [local.id]
      : almoxarifados.filter((a) => a.pai_id === local.id).map((a) => a.id)
  const chave = ids.join()
  const consulta = useConsulta(
    async () => ({
      chave,
      lista: ids.length
        ? await listaOuErro(supabase.from('equipes').select('id, nome, almox_id').eq('ativa', true).in('almox_id', ids).order('nome'))
        : [],
    }),
    [chave],
  )
  return consulta.dados?.chave === chave ? consulta.dados.lista : null
}

export function Movimentar() {
  const { almoxResponsavel, almoxGeridos } = useSessao()
  const operaBase = almoxResponsavel.some((a) => a.tipo === 'base')
  if (!almoxResponsavel.length && !almoxGeridos.length) return <Vazio>Você não é responsável por nenhum almoxarifado.</Vazio>
  const opcoes = [
    { para: '/movimentar/saida', titulo: 'Registrar saída', texto: 'Aplicação em serviço, perda ou avaria.', mostrar: almoxResponsavel.length > 0 },
    { para: '/movimentar/transferencia', titulo: 'Transferir entre bases', texto: 'Só entre bases do mesmo supervisor.', mostrar: operaBase },
    { para: '/movimentar/devolucao', titulo: 'Devolver ao 211', texto: 'Material que volta ao almoxarifado regional.', mostrar: operaBase },
    {
      para: '/movimentar/ajuste',
      titulo: 'Ajuste de inventário',
      texto: 'Contagem física contra o saldo, com justificativa. Só a gestão do almoxarifado e o administrador.',
      mostrar: almoxGeridos.length > 0,
    },
  ]
  return (
    <div className="pilha">
      <PaginaTopo titulo="Movimentar" trilha={['Operação', 'Movimentar']} />
      <div className="grade-cartoes">
        {opcoes
          .filter((o) => o.mostrar)
          .map((o) => (
            <Link key={o.para} to={o.para} className="etiqueta">
              <div style={{ fontWeight: 600, fontSize: '1.05rem' }}>{o.titulo}</div>
              <div className="legenda">{o.texto}</div>
            </Link>
          ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
export function Saida() {
  const { almoxResponsavel, almoxarifados, almox } = useSessao()
  const { material, aceitaFracao } = useCatalogo()
  const [almoxId, setAlmoxId] = useState(almoxResponsavel.find((a) => a.tipo === 'base')?.id ?? almoxResponsavel[0]?.id ?? '')
  const [versao, setVersao] = useState(0)
  const saldos = useSaldos(almoxId, versao)
  const atual = almox(almoxId)
  const equipes = useEquipes(atual, almoxarifados)
  // Trocar de almoxarifado limpa a equipe (ver o SeletorAlmox abaixo)
  const [equipeId, setEquipeId] = useState('')
  const [retiradoPor, setRetiradoPor] = useState('')
  const [linhas, setLinhas] = useState<LinhaQtd[]>([])
  const [motivo, setMotivo] = useState<Enum<'motivo_saida'>>('aplicacao')
  const [data, setData] = useState(hojeISO())
  const [justificativa, setJustificativa] = useState('')
  const [observacao, setObservacao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  // Id gerado aqui: repetir o envio após uma resposta perdida não duplica a saída
  const [idRegistro, setIdRegistro] = useState(() => novoId())
  const ehBase = atual?.tipo === 'base'
  const exigeQuem = ehBase && motivo === 'aplicacao'

  if (!almoxResponsavel.length) return <Vazio>Você não é responsável por nenhum almoxarifado.</Vazio>

  async function registrar() {
    setErro(null)
    setOk(null)
    const e = validarLinhas(linhas, aceitaFracao, (id) => material(id)?.codigo_sap ?? '')
    if (e) return setErro(e)
    if (motivo !== 'aplicacao' && !justificativa.trim()) return setErro(`Informe a justificativa da ${rotuloStatus(motivo).toLowerCase()}.`)
    const quem = validarQuemRetirou({ ehBase, motivo, equipeId, retiradoPor })
    if (quem) return setErro(quem)
    setOcupado(true)
    const { data: id, error } = await supabase.rpc('rpc_registrar_saida', {
      p_almox_id: almoxId,
      p_itens: linhas.map((l) => ({ material_id: l.material_id, quantidade: lerNumero(l.qtd) })),
      p_motivo: motivo,
      p_data_ocorrencia: data,
      p_justificativa: justificativa || undefined,
      p_observacao: observacao || undefined,
      p_id: idRegistro,
      p_equipe_id: equipeId || undefined,
      p_retirado_por_nome: retiradoPor.trim() || undefined,
    })
    setOcupado(false)
    if (error) return setErro(mensagemErro(error))
    setIdRegistro(novoId())
    const { data: s } = await supabase.from('saidas').select('numero').eq('id', id).single()
    setOk(`${formatarDoc('SAI', s?.numero ?? 0)} registrada.`)
    setLinhas([])
    setJustificativa('')
    setObservacao('')
    setRetiradoPor('')
    setVersao(versao + 1)
  }

  return (
    <div className="pilha">
      <PaginaTopo
        titulo="Registrar saída"
        voltar={{ para: '/movimentar', rotulo: 'Movimentar' }}
        trilha={[{ rotulo: 'Movimentar', para: '/movimentar' }, 'Registrar saída']}
      />
      <div className="cartao pilha">
        <div className="grade-2">
          <SeletorAlmox
            valor={almoxId}
            onChange={(id) => {
              setAlmoxId(id)
              setEquipeId('')
            }}
            opcoes={almoxResponsavel}
          />
          <Campo rotulo="Motivo">
            <select value={motivo} onChange={(e) => setMotivo(e.target.value as Enum<'motivo_saida'>)}>
              <option value="aplicacao">Aplicação em serviço</option>
              <option value="perda">Perda</option>
              <option value="avaria">Avaria</option>
            </select>
          </Campo>
          <Campo rotulo="Data da saída">
            <input type="date" max={hojeISO()} value={data} onChange={(e) => setData(e.target.value)} />
          </Campo>
          <Campo rotulo="Justificativa" ajuda={motivo === 'aplicacao' ? 'Opcional na aplicação.' : 'Obrigatória para perda e avaria.'}>
            <input value={justificativa} onChange={(e) => setJustificativa(e.target.value)} />
          </Campo>
          <Campo rotulo="Equipe" ajuda={exigeQuem ? 'Obrigatória na aplicação em serviço.' : 'Opcional.'}>
            <select value={equipeId} onChange={(e) => setEquipeId(e.target.value)}>
              <option value="">{exigeQuem ? 'Escolha a equipe' : 'Nenhuma'}</option>
              {(equipes ?? []).map((q) => (
                <option key={q.id} value={q.id}>
                  {ehBase ? q.nome : `${q.nome} · ${almox(q.almox_id)?.codigo ?? ''}`}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Quem retirou" ajuda={exigeQuem ? 'Nome de quem pegou o material. Obrigatório na aplicação em serviço.' : 'Opcional.'}>
            <input value={retiradoPor} onChange={(e) => setRetiradoPor(e.target.value)} />
          </Campo>
          <Campo rotulo="Observação" ajuda="Livre: nota de serviço…" style={{ gridColumn: '1 / -1' }}>
            <input value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          </Campo>
        </div>
        {ehBase && equipes && equipes.length === 0 && (
          <Aviso tipo="atencao">
            Nenhuma equipe ativa em {atual?.nome}. <Link to={`/cadastros/equipes?base=${almoxId}`}>Cadastre as equipes</Link> antes de
            registrar aplicação em serviço.
          </Aviso>
        )}
      </div>
      <div className="cartao pilha">
        <h2>Itens</h2>
        <ItensQuantidade linhas={linhas} onChange={setLinhas} saldos={saldos} />
      </div>
      <Aviso tipo="erro">{erro}</Aviso>
      <Aviso tipo="sucesso">{ok}</Aviso>
      <div className="acoes fixas">
        <button className="botao primario" disabled={ocupado} onClick={() => void registrar()}>
          Registrar saída
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
export function RemessaAvulsa({ tipo }: { tipo: 'transferencia' | 'devolucao' }) {
  const { almoxResponsavel, almox } = useSessao()
  const { material, aceitaFracao } = useCatalogo()
  const navegar = useNavigate()
  const bases = almoxResponsavel.filter((a) => a.tipo === 'base')
  const [origemId, setOrigemId] = useState(bases[0]?.id ?? '')
  const saldos = useSaldos(origemId)
  const [destinos, setDestinos] = useState<Almox[]>([])
  const [destinoId, setDestinoId] = useState('')
  const [linhas, setLinhas] = useState<LinhaQtd[]>([])
  const [data, setData] = useState(hojeISO())
  const [observacao, setObservacao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [idRegistro] = useState(() => novoId())
  const pai = almox(almox(origemId)?.pai_id)

  useEffect(() => {
    if (tipo !== 'transferencia' || !origemId) return
    void supabase.rpc('fn_destinos_transferencia', { p_origem_id: origemId }).then(({ data }) => {
      setDestinos(data ?? [])
      setDestinoId(data?.[0]?.id ?? '')
    })
  }, [tipo, origemId])

  if (!bases.length) return <Vazio>Transferência e devolução saem de uma base. Você não é responsável por nenhuma.</Vazio>

  async function enviar() {
    setErro(null)
    const e = validarLinhas(linhas, aceitaFracao, (id) => material(id)?.codigo_sap ?? '')
    if (e) return setErro(e)
    if (tipo === 'transferencia' && !destinoId) return setErro('Escolha a base de destino.')
    setOcupado(true)
    const { data: id, error } = await supabase.rpc('rpc_criar_remessa_avulsa', {
      p_tipo: tipo,
      p_origem_id: origemId,
      p_destino_id: tipo === 'transferencia' ? destinoId : (pai?.id ?? ''),
      p_itens: linhas.map((l) => ({ material_id: l.material_id, qtd_enviada: lerNumero(l.qtd) })),
      p_data_envio: data,
      p_observacao: observacao || undefined,
      p_id: idRegistro,
    })
    setOcupado(false)
    if (error) setErro(mensagemErro(error))
    else navegar(`/remessas/${id}`)
  }

  const titulo = tipo === 'transferencia' ? 'Transferir entre bases' : 'Devolver ao 211'
  return (
    <div className="pilha">
      <PaginaTopo
        titulo={titulo}
        sub={
          tipo === 'transferencia'
            ? 'Só entre bases do mesmo supervisor. Entre supervisores diferentes, o material volta pelo 211.'
            : 'O material sai da base e só entra no 211 depois da conferência.'
        }
        voltar={{ para: '/movimentar', rotulo: 'Movimentar' }}
        trilha={[{ rotulo: 'Movimentar', para: '/movimentar' }, titulo]}
      />
      <div className="cartao pilha">
        <div className="grade-2">
          <SeletorAlmox rotulo="Origem" valor={origemId} onChange={setOrigemId} opcoes={bases} />
          {tipo === 'transferencia' ? (
            destinos.length ? (
              <SeletorAlmox rotulo="Destino" valor={destinoId} onChange={setDestinoId} opcoes={destinos} />
            ) : (
              <Aviso tipo="atencao">Nenhuma outra base com o mesmo supervisor.</Aviso>
            )
          ) : (
            <p style={{ alignSelf: 'end', paddingBottom: 10 }}>
              Destino: {pai?.codigo} · {pai?.nome}
            </p>
          )}
          <Campo rotulo="Data do envio">
            <input type="date" max={hojeISO()} value={data} onChange={(e) => setData(e.target.value)} />
          </Campo>
          <Campo rotulo="Observação">
            <input value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          </Campo>
        </div>
      </div>
      <div className="cartao pilha">
        <h2>Itens</h2>
        <ItensQuantidade linhas={linhas} onChange={setLinhas} saldos={saldos} />
      </div>
      <Aviso tipo="erro">{erro}</Aviso>
      <Aviso tipo="info">Depois de enviar, imprima a guia para acompanhar o material.</Aviso>
      <div className="acoes fixas">
        <button className="botao primario" disabled={ocupado} onClick={() => void enviar()}>
          {tipo === 'transferencia' ? 'Enviar transferência' : 'Enviar devolução'}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
type LinhaAjuste = { material_id: string; contado: string }

export function Ajuste() {
  const { almoxGeridos } = useSessao()
  const { material, aceitaFracao } = useCatalogo()
  const [almoxId, setAlmoxId] = useState(almoxGeridos.find((a) => a.tipo === 'base')?.id ?? almoxGeridos[0]?.id ?? '')
  const [versao, setVersao] = useState(0)
  const saldos = useSaldos(almoxId, versao)
  const [linhas, setLinhas] = useState<LinhaAjuste[]>([])
  const [justificativa, setJustificativa] = useState('')
  const [data, setData] = useState(hojeISO())
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [idRegistro, setIdRegistro] = useState(() => novoId())

  if (!almoxGeridos.length) return <Vazio>Ajuste de estoque é feito pela gestão do almoxarifado ou pelo administrador.</Vazio>

  async function registrar() {
    setErro(null)
    setOk(null)
    if (!linhas.length) return setErro('Informe ao menos um item.')
    for (const l of linhas) {
      const e = qtdValida(l.contado, aceitaFracao(l.material_id), { permiteZero: true })
      if (e) return setErro(`${material(l.material_id)?.codigo_sap}: ${e}`)
    }
    if (!justificativa.trim()) return setErro('Informe a justificativa do ajuste.')
    setOcupado(true)
    const { data: id, error } = await supabase.rpc('rpc_registrar_ajuste', {
      p_almox_id: almoxId,
      p_tipo: 'inventario',
      p_justificativa: justificativa,
      p_itens: linhas.map((l) => ({ material_id: l.material_id, qtd_contada: lerNumero(l.contado) })),
      p_data_ocorrencia: data,
      p_id: idRegistro,
    })
    setOcupado(false)
    if (error) return setErro(mensagemErro(error))
    setIdRegistro(novoId())
    const { data: a } = await supabase.from('ajustes').select('numero').eq('id', id).single()
    setOk(`${formatarDoc('AJU', a?.numero ?? 0)} registrado. O ajuste aparece em destaque no painel da gestão.`)
    setLinhas([])
    setJustificativa('')
    setVersao(versao + 1)
  }

  const escolhidos = new Set(linhas.map((l) => l.material_id))
  return (
    <div className="pilha">
      <PaginaTopo
        titulo="Ajuste de inventário"
        sub="Conte o material e informe a quantidade. O sistema calcula a diferença contra o saldo e lança o ajuste."
        voltar={{ para: '/movimentar', rotulo: 'Movimentar' }}
        trilha={[{ rotulo: 'Movimentar', para: '/movimentar' }, 'Ajuste de inventário']}
      />
      <div className="cartao pilha">
        <div className="grade-2">
          <SeletorAlmox valor={almoxId} onChange={setAlmoxId} opcoes={almoxGeridos} />
          <Campo rotulo="Data da contagem">
            <input type="date" max={hojeISO()} value={data} onChange={(e) => setData(e.target.value)} />
          </Campo>
          <Campo rotulo="Justificativa" style={{ gridColumn: '1 / -1' }}>
            <input value={justificativa} onChange={(e) => setJustificativa(e.target.value)} />
          </Campo>
        </div>
      </div>
      <div className="cartao pilha">
        <h2>Contagem</h2>
        <MaterialBusca excluir={escolhidos} onEscolher={(m) => setLinhas([...linhas, { material_id: m.id, contado: '' }])} />
        {linhas.length > 0 && (
          <div className="tabela-envoltorio">
            <table>
              <thead>
                <tr>
                  <th>Material</th>
                  <th className="num">Saldo no sistema</th>
                  <th className="num">Contado</th>
                  <th className="num">Diferença</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {linhas.map((l, i) => {
                  const m = material(l.material_id)
                  const saldo = saldos?.get(l.material_id) ?? 0
                  const contado = lerNumero(l.contado)
                  const dif = Number.isNaN(contado) ? null : contado - saldo
                  return (
                    <tr key={l.material_id}>
                      <td>
                        <MaterialRotulo id={l.material_id} />
                      </td>
                      <td className="num">{saldos ? formatarQtd(saldo) : '…'}</td>
                      <td style={{ width: 130 }}>
                        <input
                          inputMode="decimal"
                          aria-label={`Contado de ${m?.codigo_sap}`}
                          value={l.contado}
                          onChange={(e) => setLinhas(linhas.map((x, j) => (j === i ? { ...x, contado: e.target.value } : x)))}
                        />
                      </td>
                      <td className="num" style={dif ? { fontWeight: 600, color: 'var(--st-alerta-texto)' } : undefined}>
                        {dif === null ? '—' : formatarSinal(dif)}
                      </td>
                      <td className="acoes-celula">
                        <button className="botao fantasma peq" onClick={() => setLinhas(linhas.filter((_, j) => j !== i))}>
                          Remover
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Aviso tipo="erro">{erro}</Aviso>
      <Aviso tipo="sucesso">{ok}</Aviso>
      <div className="acoes fixas">
        <button className="botao primario" disabled={ocupado} onClick={() => void registrar()}>
          Registrar ajuste
        </button>
      </div>
    </div>
  )
}
