import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useCatalogo } from '../../auth/CatalogoContext'
import { useSessao } from '../../auth/SessaoContext'
import { CamposConferencia, paraRpc, TabelaConferencia, validarConferencia, type LinhaConferencia } from '../../components/Conferencia'
import { Aviso, Campo, Carregando, PaginaTopo, Vazio } from '../../components/ui'
import { enviarFoto } from '../../lib/compartilhado'
import { mensagemErro } from '../../lib/erros'
import { formatarDoc, hojeISO } from '../../lib/formato'
import { novoId } from '../../lib/id'
import { supabase } from '../../lib/supabase'
import { umOuErro, listaOuErro, useConsulta } from '../../lib/useConsulta'

export function ReceberExterno() {
  const [params] = useSearchParams()
  const pedidoId = params.get('pedido')
  const consulta = useConsulta(async () => {
    if (!pedidoId) return null
    const [pedido, itens] = await Promise.all([
      umOuErro(supabase.from('pedidos').select('id, numero, solicitante_id, status').eq('id', pedidoId).single()),
      listaOuErro(supabase.from('pedido_itens').select('material_id').eq('pedido_id', pedidoId)),
    ])
    return { pedido, itens }
  }, [pedidoId])

  if (consulta.carregando) return <Carregando />
  if (consulta.erro) return <Aviso tipo="erro">{consulta.erro}</Aviso>
  return <Form pedido={consulta.dados?.pedido ?? null} itens={consulta.dados?.itens ?? []} />
}

function Form({
  pedido,
  itens,
}: {
  pedido: { id: string; numero: number; solicitante_id: string; status: string } | null
  itens: { material_id: string }[]
}) {
  const { almoxResponsavel } = useSessao()
  const { material, aceitaFracao } = useCatalogo()
  const navegar = useNavigate()
  const regional = almoxResponsavel.find((a) => a.tipo === 'regional')
  // O id sai daqui porque a foto sobe antes, na pasta da remessa
  const [remessaId] = useState(() => novoId())
  const [documento, setDocumento] = useState('')
  const [dataDoc, setDataDoc] = useState(hojeISO())
  const [linhas, setLinhas] = useState<LinhaConferencia[]>(() =>
    itens.map((i) => ({ material_id: i.material_id, enviada: '', contado: '', motivo: '', observacao: '' })),
  )
  const [quemContou, setQuemContou] = useState('')
  const [data, setData] = useState(hojeISO())
  const [foto, setFoto] = useState<File | null>(null)
  const [observacao, setObservacao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [etapa, setEtapa] = useState<string | null>(null)

  if (!regional) return <Vazio>Só o responsável do almoxarifado regional registra entradas do 3256.</Vazio>
  if (pedido && pedido.status !== 'solicitado') return <Aviso tipo="info">Este pedido não está aguardando entrega.</Aviso>

  async function registrar() {
    setErro(null)
    if (!documento.trim()) return setErro('Informe o número do documento SAP.')
    const e = validarConferencia(linhas, aceitaFracao, (id) => material(id)?.codigo_sap ?? '')
    if (e) return setErro(e)
    if (!quemContou.trim()) return setErro('Informe o nome de quem contou o material.')
    if (!foto) return setErro('Anexe a foto da guia assinada ou da carga.')
    try {
      setEtapa('Enviando foto…')
      const caminho = await enviarFoto(remessaId, foto)
      setEtapa('Registrando entrada…')
      const { error } = await supabase.rpc('rpc_registrar_recebimento_externo', {
        p_remessa_id: remessaId,
        p_destino_id: regional!.id,
        p_documento_ref: documento,
        p_data_recebimento: data,
        p_conferido_por_nome: quemContou,
        p_foto_path: caminho,
        p_itens: paraRpc(linhas, true),
        p_pedido_id: pedido?.id,
        p_data_envio: dataDoc,
        p_observacao: observacao || undefined,
      })
      if (error) throw error
      navegar(`/remessas/${remessaId}`, { replace: true })
    } catch (e) {
      setErro(mensagemErro(e))
      setEtapa(null)
    }
  }

  return (
    <div className="pilha">
      <PaginaTopo
        titulo={pedido ? `Recebimento do ${formatarDoc('PED', pedido.numero)}` : 'Entrada avulsa'}
        sub={pedido ? 'Material do pedido externo chegando do 3256.' : 'Material que chegou do 3256 sem pedido no sistema.'}
        voltar={{ para: '/entradas', rotulo: 'Entradas do 3256' }}
        trilha={[{ rotulo: 'Entradas do 3256', para: '/entradas' }, pedido ? formatarDoc('PED', pedido.numero) : 'Entrada avulsa']}
      />
      <div className="cartao pilha">
        <h2>Documento</h2>
        <div className="grade-2">
          <Campo rotulo="Documento SAP">
            <input className="mono" value={documento} onChange={(e) => setDocumento(e.target.value)} />
          </Campo>
          <Campo rotulo="Data do documento">
            <input type="date" max={data} value={dataDoc} onChange={(e) => setDataDoc(e.target.value)} />
          </Campo>
        </div>
      </div>
      <div className="cartao pilha">
        <h2>Itens</h2>
        <p className="sec peq">Para cada item: a quantidade que consta no documento SAP e a que foi contada. Use 0 no documento para item que veio sem constar.</p>
        <TabelaConferencia linhas={linhas} onChange={setLinhas} enviadaEditavel rotuloEnviada="No documento" />
      </div>
      <div className="cartao pilha">
        <h2>Conferência</h2>
        <CamposConferencia
          quemContou={quemContou}
          setQuemContou={setQuemContou}
          data={data}
          setData={setData}
          dataMin={dataDoc}
          dataMax={hojeISO()}
          onFoto={setFoto}
          fotoNome={foto?.name ?? null}
        />
        <Campo rotulo="Observação (opcional)">
          <input value={observacao} onChange={(e) => setObservacao(e.target.value)} />
        </Campo>
      </div>
      <Aviso tipo="erro">{erro}</Aviso>
      <Aviso tipo="info">{etapa}</Aviso>
      <div className="acoes fixas">
        <button className="botao primario" disabled={!!etapa} onClick={() => void registrar()}>
          Registrar entrada
        </button>
      </div>
    </div>
  )
}
