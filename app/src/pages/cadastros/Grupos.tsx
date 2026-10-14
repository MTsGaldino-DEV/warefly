import { useMemo, useState, type FormEvent } from 'react'
import { useSessao } from '../../auth/SessaoContext'
import { SeletorLocais } from '../../components/SeletorLocais'
import { Aviso, Campo, Carregando, PaginaTopo, Vazio } from '../../components/ui'
import { erroEquipe, limparTexto, ordenarLocais, validarGrupo, type FormGrupo, type GrupoLista } from '../../lib/equipes'
import { supabase, type Enum } from '../../lib/supabase'
import { dadosOuErro, useConsulta } from '../../lib/useConsulta'
import { carregarEquipes } from './dadosEquipes'

type Edicao = { id: string | null; titulo: string; form: FormGrupo }

const TIPO: Record<Enum<'tipo_equipe'>, string> = { multifuncional: 'Multifuncional', moto: 'Moto' }

export function Grupos() {
  const { almoxarifados } = useSessao()
  const consulta = useConsulta(carregarEquipes, [])
  const [edicao, setEdicao] = useState<Edicao | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const operaveis = useMemo(
    () => ordenarLocais(almoxarifados.filter((a) => a.tipo !== 'externo' && a.ativo).map((a) => a.id), almoxarifados),
    [almoxarifados],
  )
  const grupos = consulta.dados?.grupos ?? []
  const equipes = consulta.dados?.equipes ?? []

  function abrir(g: GrupoLista | null) {
    setErro(null)
    setOk(null)
    setEdicao(
      g
        ? {
            id: g.id,
            titulo: `Editar ${g.nome}`,
            form: { nome: g.nome, tipo_equipe: g.tipo_equipe, chave_planilha: g.chave_planilha ?? '', locais: g.locais, ativo: g.ativo },
          }
        : { id: null, titulo: 'Novo grupo', form: { nome: '', tipo_equipe: 'multifuncional', chave_planilha: '', locais: [], ativo: true } },
    )
  }

  function mudar(campos: Partial<FormGrupo>) {
    if (edicao) setEdicao({ ...edicao, form: { ...edicao.form, ...campos } })
  }

  async function salvar(ev: FormEvent) {
    ev.preventDefault()
    if (!edicao) return
    const f = edicao.form
    const problema = validarGrupo(f)
    setOk(null)
    if (problema) return setErro(problema)
    setErro(null)
    setOcupado(true)
    try {
      await dadosOuErro(
        supabase.rpc('rpc_salvar_grupo', {
          p_nome: limparTexto(f.nome),
          p_tipo_equipe: f.tipo_equipe,
          p_locais: f.locais,
          p_chave_planilha: limparTexto(f.chave_planilha) || undefined,
          p_ativo: f.ativo,
          p_id: edicao.id ?? undefined,
        }),
      )
      setOk(`Grupo ${limparTexto(f.nome)} ${edicao.id ? 'atualizado' : 'cadastrado'}.`)
      setEdicao(null)
      await consulta.recarregar()
    } catch (e) {
      setErro(erroEquipe(e))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="pilha">
      <PaginaTopo
        titulo="Grupos de equipes"
        trilha={['Cadastros', 'Grupos de equipes']}
        sub="Um grupo por supervisor e o da moto. Os locais padrão valem para as equipes novas e para quem troca de grupo; mudar aqui não mexe nas equipes já cadastradas."
        acoes={
          <button type="button" className="botao primario" onClick={() => abrir(null)}>
            Novo grupo
          </button>
        }
      />
      <Aviso tipo="erro">{edicao ? null : (erro ?? consulta.erro)}</Aviso>
      <Aviso tipo="sucesso">{ok}</Aviso>

      {edicao && (
        <form className="cartao pilha" onSubmit={(e) => void salvar(e)} aria-label={edicao.titulo} noValidate>
          <h2>{edicao.titulo}</h2>
          <div className="grade-cartoes">
            <Campo rotulo="Nome do grupo" ajuda="Nome do supervisor, como aparece nas telas.">
              <input value={edicao.form.nome} onChange={(e) => mudar({ nome: e.target.value })} />
            </Campo>
            <Campo rotulo="Tipo das equipes">
              <select value={edicao.form.tipo_equipe} onChange={(e) => mudar({ tipo_equipe: e.target.value as Enum<'tipo_equipe'> })}>
                <option value="multifuncional">Multifuncional</option>
                <option value="moto">Moto</option>
              </select>
            </Campo>
            <Campo rotulo="Chave da planilha" ajuda='Texto da coluna "supervisor" da planilha, como vem nela. Maiúscula e minúscula não fazem diferença; acento faz.'>
              <input value={edicao.form.chave_planilha} onChange={(e) => mudar({ chave_planilha: e.target.value })} />
            </Campo>
          </div>
          <div className="pilha">
            <div>
              <h3>Locais padrão</h3>
              <p className="sec peq">Onde as equipes do grupo retiram material. Retirar no 211 Geral não dá acesso ao estoque dele.</p>
            </div>
            <SeletorLocais rotulo="Locais padrão" opcoes={operaveis} valor={edicao.form.locais} onChange={(locais) => mudar({ locais })} />
          </div>
          <label className="linha">
            <input type="checkbox" style={{ width: 'auto', minHeight: 0 }} checked={edicao.form.ativo} onChange={(e) => mudar({ ativo: e.target.checked })} />
            Grupo ativo (aparece no cadastro de equipe e na importação)
          </label>
          <Aviso tipo="erro">{erro}</Aviso>
          <div className="acoes">
            <button
              type="button"
              className="botao secundario"
              onClick={() => {
                setEdicao(null)
                setErro(null)
              }}
            >
              Cancelar
            </button>
            <button type="submit" className="botao primario" disabled={ocupado}>
              {ocupado ? 'Salvando…' : 'Salvar grupo'}
            </button>
          </div>
        </form>
      )}

      {consulta.carregando && !consulta.dados ? (
        <Carregando />
      ) : !grupos.length ? (
        <Vazio>Nenhum grupo cadastrado.</Vazio>
      ) : (
        <div className="tabela-envoltorio">
          <table>
            <thead>
              <tr>
                <th>Grupo</th>
                <th>Tipo</th>
                <th>Chave da planilha</th>
                <th>Locais padrão</th>
                <th className="num">Equipes ativas</th>
                <th>Situação</th>
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {grupos.map((g) => (
                <tr key={g.id}>
                  <td>{g.nome}</td>
                  <td>{TIPO[g.tipo_equipe]}</td>
                  <td className="mono">{g.chave_planilha ?? <span className="sec">—</span>}</td>
                  <td className="peq">{ordenarLocais(g.locais, almoxarifados).map((a) => a.codigo).join(', ') || <span className="sec">Nenhum</span>}</td>
                  <td className="num">{equipes.filter((e) => e.grupo_id === g.id && e.ativa).length}</td>
                  <td>
                    <span className={`badge ${g.ativo ? 'ok' : 'neutro'}`}>{g.ativo ? 'Ativo' : 'Inativo'}</span>
                  </td>
                  <td className="num">
                    <button type="button" className="botao-mini" aria-label={`Editar ${g.nome}`} onClick={() => abrir(g)}>
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
