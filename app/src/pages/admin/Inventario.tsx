import { useEffect, useMemo, useState } from 'react'
import { useCatalogo } from '../../auth/CatalogoContext'
import { useSessao } from '../../auth/SessaoContext'
import { MaterialBusca, MaterialRotulo } from '../../components/MaterialBusca'
import { Aviso, Campo, PaginaTopo, Regiao, StatusBadge, Vazio } from '../../components/ui'
import { mensagemErro } from '../../lib/erros'
import { formatarDoc, formatarQtd, hojeISO } from '../../lib/formato'
import {
  justificativaPadrao,
  rotuloDaContagem,
  tipoDaContagem,
  validarContagem,
  validarMaterialNovo,
  type LinhaContagem,
  type MaterialNovo,
  type TipoContagem,
} from '../../lib/inventario'
import { supabase } from '../../lib/supabase'

const RASCUNHO = 'warefly.inventario.rascunho'

/** Rascunho da contagem por local, para não perder o que foi digitado se a página recarregar. */
function lerRascunho(almoxId: string): LinhaContagem[] {
  try {
    const bruto = localStorage.getItem(`${RASCUNHO}.${almoxId}`)
    const linhas: unknown = bruto ? JSON.parse(bruto) : []
    return Array.isArray(linhas) ? (linhas as LinhaContagem[]) : []
  } catch {
    return []
  }
}

function gravarRascunho(almoxId: string, linhas: LinhaContagem[]) {
  try {
    if (linhas.length) localStorage.setItem(`${RASCUNHO}.${almoxId}`, JSON.stringify(linhas))
    else localStorage.removeItem(`${RASCUNHO}.${almoxId}`)
  } catch {
    // Sem armazenamento no navegador: a contagem segue só na tela.
  }
}

const NOVO_VAZIO: MaterialNovo = { codigo: '', descricao: '', unidade: '' }

/**
 * Sub-aba Inventário (admin e gestora): lança a contagem do dia D ou de um
 * inventário. Enquanto o local só tem saldo inicial, a contagem entra como
 * implantação; depois, como inventário. Só os materiais da lista mudam.
 */
export function Inventario() {
  const { almoxGeridos } = useSessao()
  const { material, unidades, aceitaFracao, recarregar } = useCatalogo()
  const [almoxId, setAlmoxId] = useState(almoxGeridos[0]?.id ?? '')
  const [data, setData] = useState(hojeISO())
  const [tipo, setTipo] = useState<TipoContagem | null>(null)
  const [justificativa, setJustificativa] = useState('')
  const [justificativaEditada, setJustificativaEditada] = useState(false)
  const [linhas, setLinhas] = useState<LinhaContagem[]>(() => (almoxId ? lerRascunho(almoxId) : []))
  const [saldos, setSaldos] = useState<Map<string, number>>(new Map())
  const [erros, setErros] = useState<string[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [feito, setFeito] = useState<{ numero: number; itens: number; local: string } | null>(null)
  const [novoAberto, setNovoAberto] = useState(false)
  const [novo, setNovo] = useState<MaterialNovo>(NOVO_VAZIO)
  const [erroNovo, setErroNovo] = useState<string | null>(null)
  const [cadastrando, setCadastrando] = useState(false)

  const local = almoxGeridos.find((a) => a.id === almoxId)
  const tipoAtual = tipo ?? 'implantacao'
  const textoJustificativa = justificativaEditada ? justificativa : justificativaPadrao(tipoAtual, data)
  const naLista = useMemo(() => new Set(linhas.map((l) => l.material_id)), [linhas])

  // Tipo da contagem e saldo atual do local escolhido.
  useEffect(() => {
    if (!almoxId) return
    let ativo = true
    void (async () => {
      const [t, s] = await Promise.all([
        supabase.rpc('fn_em_implantacao', { p_almox_id: almoxId }),
        supabase.from('v_saldo').select('material_id, saldo').eq('almox_id', almoxId),
      ])
      if (!ativo) return
      if (t.error || s.error) {
        setErro(mensagemErro(t.error ?? s.error))
        return
      }
      setTipo(tipoDaContagem(!!t.data))
      setSaldos(new Map((s.data ?? []).map((r) => [r.material_id ?? '', Number(r.saldo ?? 0)])))
    })()
    return () => {
      ativo = false
    }
  }, [almoxId])

  function trocarLocal(id: string) {
    setAlmoxId(id)
    setTipo(null)
    setSaldos(new Map())
    setLinhas(lerRascunho(id))
    setErros([])
    setErro(null)
    setFeito(null)
  }

  function mudarLinhas(novas: LinhaContagem[]) {
    setLinhas(novas)
    gravarRascunho(almoxId, novas)
    setErros([])
    setFeito(null)
  }

  async function cadastrarMaterial() {
    const problema = validarMaterialNovo(novo)
    if (problema) {
      setErroNovo(problema)
      return
    }
    setCadastrando(true)
    setErroNovo(null)
    const { data: id, error } = await supabase.rpc('rpc_cadastrar_material_rapido', {
      p_codigo_sap: novo.codigo,
      p_descricao: novo.descricao,
      p_unidade: novo.unidade,
    })
    if (error) {
      setCadastrando(false)
      setErroNovo(mensagemErro(error))
      return
    }
    await recarregar()
    setCadastrando(false)
    if (!naLista.has(id)) mudarLinhas([...linhas, { material_id: id, qtd: '' }])
    setNovo(NOVO_VAZIO)
    setNovoAberto(false)
  }

  async function lancar() {
    if (!local || !tipo) return
    const r = validarContagem(linhas, aceitaFracao, (id) => {
      const m = material(id)
      return m ? `${m.codigo_sap} ${m.descricao}` : 'Material'
    })
    if (r.erros.length) {
      setErros(r.erros)
      return
    }
    setEnviando(true)
    setErro(null)
    const { data: id, error } = await supabase.rpc('rpc_registrar_ajuste', {
      p_almox_id: local.id,
      p_tipo: tipo,
      p_justificativa: textoJustificativa,
      p_itens: r.itens,
      p_data_ocorrencia: data,
    })
    if (error) {
      setEnviando(false)
      setErro(mensagemErro(error))
      return
    }
    const { data: aj } = await supabase.from('ajustes').select('numero').eq('id', id).single()
    setEnviando(false)
    mudarLinhas([])
    setFeito({ numero: aj?.numero ?? 0, itens: r.itens.length, local: local.nome })
    // O local pode ter saído da implantação e o saldo mudou: relê.
    const s = await supabase.from('v_saldo').select('material_id, saldo').eq('almox_id', local.id)
    if (!s.error) setSaldos(new Map((s.data ?? []).map((x) => [x.material_id ?? '', Number(x.saldo ?? 0)])))
  }

  if (almoxGeridos.length === 0) {
    return <Aviso tipo="info">Você não gere nenhum local. O inventário é lançado pela gestão do almoxarifado ou pelo administrador.</Aviso>
  }

  return (
    <div className="pilha">
      <PaginaTopo
        titulo="Inventário"
        sub="Lança a contagem física de um local. O saldo de cada material da lista passa a ser a quantidade contada; o que não está na lista não muda."
      />

      <Regiao
        titulo="Local e data"
        acoes={tipo && <StatusBadge tom={tipo === 'implantacao' ? 'info' : 'neutro'}>{rotuloDaContagem(tipo)}</StatusBadge>}
      >
        <div className="grade-2">
          <Campo rotulo="Local">
            <select value={almoxId} onChange={(e) => trocarLocal(e.target.value)}>
              {almoxGeridos.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.codigo} · {a.nome}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Data da contagem">
            <input type="date" max={hojeISO()} value={data} onChange={(e) => setData(e.target.value)} />
          </Campo>
          <Campo
            rotulo="Justificativa"
            style={{ gridColumn: '1 / -1' }}
            ajuda={
              tipo === 'implantacao'
                ? 'Local ainda sem operação: a contagem entra como saldo inicial e pode ser lançada em partes.'
                : 'Local em operação: a diferença para o saldo do sistema entra como ajuste de inventário.'
            }
          >
            <input
              value={textoJustificativa}
              onChange={(e) => {
                setJustificativaEditada(true)
                setJustificativa(e.target.value)
              }}
            />
          </Campo>
        </div>
      </Regiao>

      <Regiao
        titulo="Contagem"
        sub={linhas.length ? `${linhas.length} ${linhas.length === 1 ? 'material' : 'materiais'} na lista` : undefined}
        acoes={
          <button type="button" className="botao secundario peq" onClick={() => setNovoAberto(!novoAberto)} aria-expanded={novoAberto}>
            Material fora do catálogo
          </button>
        }
      >
        <MaterialBusca
          excluir={naLista}
          onEscolher={(m) => mudarLinhas([...linhas, { material_id: m.id, qtd: '' }])}
        />

        {novoAberto && (
          <div className="cartao pilha">
            <p className="sec peq">Cadastra o material no catálogo e põe na contagem. Se o código já existir, usa o material cadastrado.</p>
            <div className="grade-2">
              <Campo rotulo="Código SAP">
                <input inputMode="numeric" value={novo.codigo} onChange={(e) => setNovo({ ...novo, codigo: e.target.value })} />
              </Campo>
              <Campo rotulo="Unidade">
                <select value={novo.unidade} onChange={(e) => setNovo({ ...novo, unidade: e.target.value })}>
                  <option value="">Escolha</option>
                  {unidades.map((u) => (
                    <option key={u.codigo} value={u.codigo}>
                      {u.codigo}
                      {u.descricao ? ` · ${u.descricao}` : ''}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="Descrição" style={{ gridColumn: '1 / -1' }}>
                <input value={novo.descricao} onChange={(e) => setNovo({ ...novo, descricao: e.target.value })} />
              </Campo>
            </div>
            <Aviso tipo="erro">{erroNovo}</Aviso>
            <div className="linha">
              <button type="button" className="botao primario" disabled={cadastrando} onClick={() => void cadastrarMaterial()}>
                {cadastrando ? 'Cadastrando…' : 'Cadastrar e adicionar'}
              </button>
              <button
                type="button"
                className="botao fantasma"
                onClick={() => {
                  setNovoAberto(false)
                  setNovo(NOVO_VAZIO)
                  setErroNovo(null)
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {linhas.length === 0 ? (
          <Vazio>Busque pelo código SAP ou pela descrição para pôr o material na contagem.</Vazio>
        ) : (
          <div className="tabela-envoltorio">
            <table>
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Unidade</th>
                  <th className="num">No sistema</th>
                  <th className="num">Contado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {linhas.map((l, i) => {
                  const m = material(l.material_id)
                  return (
                    <tr key={l.material_id}>
                      <td>
                        <MaterialRotulo id={l.material_id} compacto />
                      </td>
                      <td>{m?.unidade ?? '—'}</td>
                      <td className="num">{formatarQtd(saldos.get(l.material_id) ?? 0)}</td>
                      <td className="num">
                        <input
                          inputMode="decimal"
                          aria-label={`Quantidade contada de ${m?.descricao ?? 'material'}`}
                          value={l.qtd}
                          onChange={(e) => mudarLinhas(linhas.map((x, j) => (j === i ? { ...x, qtd: e.target.value } : x)))}
                        />
                      </td>
                      <td className="acoes-celula">
                        <button
                          type="button"
                          className="botao-mini"
                          aria-label={`Tirar ${m?.descricao ?? 'material'} da contagem`}
                          onClick={() => mudarLinhas(linhas.filter((_, j) => j !== i))}
                        >
                          Tirar
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {erros.length > 0 && (
          <Aviso tipo="erro">
            Contagem não lançada. Corrija e lance de novo:
            <ul>
              {erros.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </Aviso>
        )}
        <Aviso tipo="erro">{erro}</Aviso>

        <div className="acoes">
          <button
            type="button"
            className="botao primario"
            disabled={enviando || !tipo || linhas.length === 0 || !textoJustificativa.trim()}
            onClick={() => void lancar()}
          >
            {enviando ? 'Lançando…' : 'Lançar contagem'}
          </button>
        </div>
      </Regiao>

      {feito && (
        <Aviso tipo="sucesso">
          Contagem lançada em {feito.local}: {formatarDoc('AJU', feito.numero)} com {feito.itens}{' '}
          {feito.itens === 1 ? 'material' : 'materiais'}.
        </Aviso>
      )}
    </div>
  )
}
