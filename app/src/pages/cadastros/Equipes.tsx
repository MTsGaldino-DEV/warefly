import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useSessao } from '../../auth/SessaoContext'
import { SeletorLocais } from '../../components/SeletorLocais'
import { Aviso, Campo, Carregando, PaginaTopo, Regiao, Vazio } from '../../components/ui'
import {
  agruparPorGrupo,
  erroEquipe,
  filtrarEquipes,
  lerZeus,
  limparTexto,
  mesmosLocais,
  ordenarLocais,
  rotuloEquipe,
  validarEquipe,
  type EquipeLista,
  type FormEquipe,
  type GrupoLista,
} from '../../lib/equipes'
import { supabase, type Almox } from '../../lib/supabase'
import { dadosOuErro, useConsulta } from '../../lib/useConsulta'
import { carregarEquipes } from './dadosEquipes'

const TIPO: Record<GrupoLista['tipo_equipe'], string> = { multifuncional: 'Multifuncional', moto: 'Moto' }

type Edicao = { id: string | null; titulo: string; form: FormEquipe; grupoOriginal: string }

const VAZIA: FormEquipe = { codigo_zeus: '', nome: '', integrantes: '', frota: '', grupo_id: '', locais: [], ativa: true }

export function Equipes() {
  const { veEquipes, mantemEquipes, almoxarifados, almoxGeridos } = useSessao()
  const consulta = useConsulta(carregarEquipes, [])
  const [busca, setBusca] = useState('')
  const [grupoId, setGrupoId] = useState('')
  const [mostrarInativas, setMostrarInativas] = useState(false)
  const [edicao, setEdicao] = useState<Edicao | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const formulario = useRef<HTMLFormElement>(null)

  const grupos = useMemo(() => consulta.dados?.grupos ?? [], [consulta.dados])
  const equipes = useMemo(() => consulta.dados?.equipes ?? [], [consulta.dados])
  const grupo = (id: string | null) => grupos.find((g) => g.id === id)
  const opcoesLocais = useMemo(() => ordenarLocais(almoxGeridos.map((a) => a.id), almoxarifados), [almoxGeridos, almoxarifados])
  const visiveis = filtrarEquipes(equipes, { busca, grupoId, mostrarInativas })
  const blocos = agruparPorGrupo(visiveis, grupos)
  const inativas = equipes.filter((e) => !e.ativa).length

  useEffect(() => {
    if (edicao) formulario.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [edicao?.id, edicao?.titulo]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!veEquipes) return <Vazio>As equipes aparecem para a gestão do almoxarifado, a gerência e quem é de alguma base.</Vazio>

  function limparMensagens() {
    setErro(null)
    setOk(null)
    setAviso(null)
  }

  function abrirNova() {
    limparMensagens()
    const g = grupo(grupoId)
    setEdicao({ id: null, titulo: 'Nova equipe', form: { ...VAZIA, grupo_id: g?.id ?? '', locais: g?.locais ?? [] }, grupoOriginal: '' })
  }

  function abrirEdicao(e: EquipeLista) {
    limparMensagens()
    setEdicao({
      id: e.id,
      titulo: `Editar ${rotuloEquipe(e)}`,
      form: {
        codigo_zeus: e.codigo_zeus ? String(e.codigo_zeus) : '',
        nome: e.nome,
        integrantes: e.integrantes ?? '',
        frota: e.frota ?? '',
        grupo_id: e.grupo_id ?? '',
        locais: e.locais,
        ativa: e.ativa,
      },
      grupoOriginal: e.grupo_id ?? '',
    })
  }

  function mudar(campos: Partial<FormEquipe>) {
    if (edicao) setEdicao({ ...edicao, form: { ...edicao.form, ...campos } })
  }

  /** Trocar o grupo volta os locais ao padrão do grupo novo, como o banco faz. */
  function trocarGrupo(id: string) {
    const g = grupo(id)
    mudar({ grupo_id: id, locais: g?.locais ?? [] })
    setAviso(g ? `Locais liberados trocados pelos do grupo ${g.nome}. Ajuste se a equipe retira em outro lugar.` : null)
  }

  async function salvar(ev: FormEvent) {
    ev.preventDefault()
    if (!edicao) return
    setErro(null)
    setOk(null)
    const f = edicao.form
    const problema = validarEquipe(f)
    if (problema) return setErro(problema)
    setOcupado(true)
    try {
      await dadosOuErro(
        supabase.rpc('rpc_salvar_equipe', {
          p_codigo_zeus: lerZeus(f.codigo_zeus) as number,
          p_nome: limparTexto(f.nome),
          p_integrantes: limparTexto(f.integrantes),
          p_frota: limparTexto(f.frota),
          p_grupo_id: f.grupo_id,
          p_locais: f.locais,
          p_ativa: f.ativa,
          p_id: edicao.id ?? undefined,
        }),
      )
      setOk(`Equipe ${rotuloEquipe({ codigo_zeus: lerZeus(f.codigo_zeus), nome: limparTexto(f.nome) })} ${edicao.id ? 'atualizada' : 'cadastrada'}.`)
      setEdicao(null)
      setAviso(null)
      await consulta.recarregar()
    } catch (e) {
      setErro(erroEquipe(e))
    } finally {
      setOcupado(false)
    }
  }

  async function ativar(e: EquipeLista, ativa: boolean) {
    limparMensagens()
    try {
      await dadosOuErro(supabase.rpc('rpc_ativar_equipe', { p_equipe_id: e.id, p_ativa: ativa }))
      setOk(`Equipe ${rotuloEquipe(e)} ${ativa ? 'reativada' : 'inativada'}.`)
    } catch (x) {
      setErro(erroEquipe(x))
    }
    await consulta.recarregar()
  }

  const travados = edicao
    ? ordenarLocais(
        edicao.form.locais.filter((id) => !opcoesLocais.some((a) => a.id === id)),
        almoxarifados,
      )
    : []
  const grupoEscolhido = edicao ? grupo(edicao.form.grupo_id) : undefined

  return (
    <div className="pilha">
      <PaginaTopo
        titulo="Equipes"
        trilha={['Cadastros', 'Equipes']}
        sub="Equipes do Zeus, ligadas ao grupo do supervisor, com os locais onde cada uma retira material. Retirar no 211 Geral não dá acesso ao estoque dele."
        acoes={
          mantemEquipes && (
            <>
              <Link className="botao secundario" to="/cadastros/equipes/importar">
                Importar planilha
              </Link>
              <button type="button" className="botao primario" onClick={abrirNova}>
                Nova equipe
              </button>
            </>
          )
        }
      />
      <Aviso tipo="erro">{edicao ? null : (erro ?? consulta.erro)}</Aviso>
      <Aviso tipo="sucesso">{ok}</Aviso>

      {edicao && (
        <form ref={formulario} className="cartao pilha" onSubmit={(e) => void salvar(e)} aria-label={edicao.titulo} noValidate>
          <h2>{edicao.titulo}</h2>
          <div className="grade-cartoes">
            <Campo rotulo="Código Zeus" ajuda="Não muda depois da primeira saída da equipe.">
              <input inputMode="numeric" value={edicao.form.codigo_zeus} onChange={(e) => mudar({ codigo_zeus: e.target.value })} />
            </Campo>
            <Campo rotulo="Descrição" ajuda="Como está na planilha do Zeus.">
              <input value={edicao.form.nome} onChange={(e) => mudar({ nome: e.target.value })} />
            </Campo>
            <Campo rotulo="Frota">
              <input value={edicao.form.frota} onChange={(e) => mudar({ frota: e.target.value })} />
            </Campo>
            <Campo rotulo="Grupo (supervisor)">
              <select value={edicao.form.grupo_id} onChange={(e) => trocarGrupo(e.target.value)}>
                <option value="">Escolha o grupo</option>
                {grupos
                  .filter((g) => g.ativo || g.id === edicao.grupoOriginal)
                  .map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nome} · {TIPO[g.tipo_equipe]}
                    </option>
                  ))}
              </select>
            </Campo>
            <Campo rotulo="Integrantes" ajuda="Nomes separados por barra." style={{ gridColumn: '1 / -1' }}>
              <input value={edicao.form.integrantes} onChange={(e) => mudar({ integrantes: e.target.value })} />
            </Campo>
          </div>
          <div className="pilha">
            <div>
              <h3>Locais liberados</h3>
              <p className="sec peq">
                {grupoEscolhido
                  ? `Começa igual ao grupo ${grupoEscolhido.nome}. Libere outro local quando a equipe pedir para retirar fora do grupo.`
                  : 'Escolha o grupo: os locais começam iguais aos dele.'}
              </p>
            </div>
            <SeletorLocais
              rotulo="Locais liberados"
              opcoes={opcoesLocais}
              travados={travados}
              valor={edicao.form.locais}
              onChange={(locais) => mudar({ locais })}
            />
            {grupoEscolhido && !mesmosLocais(edicao.form.locais, grupoEscolhido.locais) && (
              <div>
                <button type="button" className="botao fantasma peq" onClick={() => mudar({ locais: grupoEscolhido.locais })}>
                  Voltar ao padrão do grupo
                </button>
              </div>
            )}
          </div>
          <label className="linha">
            <input
              type="checkbox"
              style={{ width: 'auto', minHeight: 0 }}
              checked={edicao.form.ativa}
              onChange={(e) => mudar({ ativa: e.target.checked })}
            />
            Equipe ativa (aparece na saída de material)
          </label>
          <Aviso tipo="info">{aviso}</Aviso>
          <Aviso tipo="erro">{erro}</Aviso>
          <div className="acoes">
            <button
              type="button"
              className="botao secundario"
              onClick={() => {
                setEdicao(null)
                limparMensagens()
              }}
            >
              Cancelar
            </button>
            <button type="submit" className="botao primario" disabled={ocupado}>
              {ocupado ? 'Salvando…' : 'Salvar equipe'}
            </button>
          </div>
        </form>
      )}

      <div className="cartao linha-fim">
        <Campo rotulo="Buscar" style={{ flex: 2, minWidth: 220 }}>
          <input
            type="search"
            placeholder="Zeus, descrição, integrante ou frota"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </Campo>
        <Campo rotulo="Grupo" style={{ flex: 1, minWidth: 180 }}>
          <select value={grupoId} onChange={(e) => setGrupoId(e.target.value)}>
            <option value="">Todos</option>
            {grupos.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nome}
              </option>
            ))}
            <option value="sem-grupo">Sem grupo</option>
          </select>
        </Campo>
        <label className="linha" style={{ minHeight: 42 }}>
          <input
            type="checkbox"
            style={{ width: 'auto', minHeight: 0 }}
            checked={mostrarInativas}
            onChange={(e) => setMostrarInativas(e.target.checked)}
          />
          Mostrar inativas ({inativas})
        </label>
      </div>

      {consulta.carregando && !consulta.dados ? (
        <Carregando />
      ) : !blocos.length ? (
        <Vazio>{equipes.length ? 'Nenhuma equipe com esse filtro.' : 'Nenhuma equipe cadastrada.'}</Vazio>
      ) : (
        blocos.map((b) => (
          <BlocoGrupo
            key={b.grupo?.id ?? 'sem-grupo'}
            grupo={b.grupo}
            equipes={b.equipes}
            almoxarifados={almoxarifados}
            mantem={mantemEquipes}
            editandoId={edicao?.id ?? null}
            onEditar={abrirEdicao}
            onAtivar={(e, a) => void ativar(e, a)}
          />
        ))
      )}
    </div>
  )
}

function BlocoGrupo({
  grupo,
  equipes,
  almoxarifados,
  mantem,
  editandoId,
  onEditar,
  onAtivar,
}: {
  grupo: GrupoLista | null
  equipes: EquipeLista[]
  almoxarifados: Almox[]
  mantem: boolean
  editandoId: string | null
  onEditar: (e: EquipeLista) => void
  onAtivar: (e: EquipeLista, ativa: boolean) => void
}) {
  const locaisGrupo = grupo ? ordenarLocais(grupo.locais, almoxarifados) : []
  const quantas = `${equipes.length} ${equipes.length === 1 ? 'equipe' : 'equipes'}`
  return (
    <Regiao
      titulo={grupo ? grupo.nome : 'Sem grupo'}
      sub={
        grupo
          ? `${TIPO[grupo.tipo_equipe]} · ${quantas} · retira em ${locaisGrupo.map((a) => a.codigo).join(', ') || 'nenhum local'}`
          : `${quantas} · entram inativas até ter grupo, integrantes e frota`
      }
    >
      <div className="tabela-envoltorio">
        <table>
          <thead>
            <tr>
              <th>Zeus</th>
              <th>Descrição</th>
              <th>Integrantes</th>
              <th>Frota</th>
              <th>Locais liberados</th>
              <th>Situação</th>
              {mantem && <th aria-label="Ações" />}
            </tr>
          </thead>
          <tbody>
            {equipes.map((e) => (
              <tr key={e.id} aria-selected={e.id === editandoId || undefined}>
                <td className="mono">{e.codigo_zeus ?? '—'}</td>
                <td>{e.nome}</td>
                <td className="peq">{e.integrantes ?? <span className="sec">—</span>}</td>
                <td className="mono">{e.frota ?? '—'}</td>
                <td className="peq">
                  <ResumoLocais locais={e.locais} padrao={grupo?.locais ?? null} almoxarifados={almoxarifados} />
                </td>
                <td>
                  {mantem ? (
                    <label className="linha">
                      <input
                        type="checkbox"
                        style={{ width: 'auto', minHeight: 0 }}
                        aria-label={`${rotuloEquipe(e)} ativa`}
                        checked={e.ativa}
                        onChange={(x) => onAtivar(e, x.target.checked)}
                      />
                      {e.ativa ? 'Ativa' : 'Inativa'}
                    </label>
                  ) : (
                    <span className={`badge ${e.ativa ? 'ok' : 'neutro'}`}>{e.ativa ? 'Ativa' : 'Inativa'}</span>
                  )}
                </td>
                {mantem && (
                  <td className="num">
                    <button type="button" className="botao-mini" aria-label={`Editar ${rotuloEquipe(e)}`} onClick={() => onEditar(e)}>
                      Editar
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Regiao>
  )
}

function ResumoLocais({ locais, padrao, almoxarifados }: { locais: string[]; padrao: string[] | null; almoxarifados: Almox[] }) {
  if (!locais.length) return <span className="sec">Nenhum</span>
  if (padrao && mesmosLocais(locais, padrao)) return <span className="sec">Padrão do grupo</span>
  const codigos = (ids: string[]) => ordenarLocais(ids, almoxarifados).map((a) => a.codigo).join(', ')
  const nomes = ordenarLocais(locais, almoxarifados).map((a) => a.nome).join(', ')
  const mais = padrao ? locais.filter((l) => !padrao.includes(l)) : []
  const menos = padrao ? padrao.filter((l) => !locais.includes(l)) : []
  // Perto do padrão, mostra só a diferença; longe dele, a lista inteira
  if (padrao && mais.length + menos.length <= 3 && mais.length + menos.length < locais.length) {
    return (
      <span title={nomes}>
        <span className="sec">Padrão</span>
        {mais.length > 0 && <> + {codigos(mais)}</>}
        {menos.length > 0 && <> sem {codigos(menos)}</>}
      </span>
    )
  }
  return <span title={nomes}>{codigos(locais)}</span>
}
