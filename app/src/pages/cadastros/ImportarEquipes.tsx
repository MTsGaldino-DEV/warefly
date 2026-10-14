import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useSessao } from '../../auth/SessaoContext'
import { Aviso, Campo, PaginaTopo, Regiao } from '../../components/ui'
import {
  ABA_EQUIPES,
  CAMPOS_EQUIPES,
  detectarColunasEquipes,
  diferencas,
  encontrarCabecalhoEquipes,
  grupoDoSupervisor,
  lerConciliacao,
  lerEquipes,
  paraRpc,
  type Conciliacao,
  type LinhaDeixada,
  type LinhaEquipePlanilha,
  type MapaEquipes,
} from '../../lib/equipesPlanilha'
import { erroEquipe } from '../../lib/equipes'
import { mensagemErro } from '../../lib/erros'
import { lerAbas } from '../../lib/planilha'
import { supabase } from '../../lib/supabase'
import { dadosOuErro, useConsulta } from '../../lib/useConsulta'
import { carregarEquipes } from './dadosEquipes'

const contar = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

type Arquivo = { nome: string; abas: string[]; linhas: (aba: string) => unknown[][] }

export function ImportarEquipes() {
  const { mantemEquipes } = useSessao()
  const atuais = useConsulta(carregarEquipes, [])
  const [arquivo, setArquivo] = useState<Arquivo | null>(null)
  const [aba, setAba] = useState('')
  const [mapa, setMapa] = useState<MapaEquipes | null>(null)
  const [simulacao, setSimulacao] = useState<Conciliacao | null>(null)
  const [resultado, setResultado] = useState<Conciliacao | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)

  const linhas = useMemo(() => (arquivo && aba ? arquivo.linhas(aba) : []), [arquivo, aba])
  const iCabecalho = useMemo(() => encontrarCabecalhoEquipes(linhas), [linhas])
  const cabecalho = iCabecalho >= 0 ? linhas[iCabecalho] : (linhas[0] ?? [])
  const faltaColuna = !mapa || CAMPOS_EQUIPES.some((c) => mapa[c.chave] === null)
  const leitura = useMemo(
    () => (mapa && !faltaColuna ? lerEquipes(linhas.slice(iCabecalho + 1), mapa, iCabecalho + 2) : null),
    [linhas, iCabecalho, mapa, faltaColuna],
  )

  if (!mantemEquipes) return <Aviso tipo="erro">Só a gestão do almoxarifado e o administrador importam a planilha de equipes.</Aviso>

  function escolherAba(arq: Arquivo, nome: string) {
    const l = arq.linhas(nome)
    const i = encontrarCabecalhoEquipes(l)
    setAba(nome)
    setMapa(detectarColunasEquipes(l[i === -1 ? 0 : i] ?? []))
    setSimulacao(null)
    setResultado(null)
    setErro(null)
  }

  async function abrir(f: File | undefined) {
    if (!f) return
    setErro(null)
    setSimulacao(null)
    setResultado(null)
    try {
      const { abas, linhas: ler } = await lerAbas(f)
      const arq = { nome: f.name, abas, linhas: ler }
      setArquivo(arq)
      escolherAba(arq, abas.includes(ABA_EQUIPES) ? ABA_EQUIPES : abas[0])
    } catch (e) {
      setArquivo(null)
      setErro(`Não foi possível ler a planilha: ${mensagemErro(e)}. Confira se é o arquivo .xlsx do Zeus e tente de novo.`)
    }
  }

  async function chamar(simular: boolean) {
    if (!leitura) return
    setErro(null)
    setOcupado(simular ? 'Simulando…' : 'Gravando…')
    try {
      const r = lerConciliacao(
        await dadosOuErro(supabase.rpc('rpc_importar_equipes', { p_linhas: paraRpc(leitura.equipes), p_simular: simular })),
      )
      if (simular) setSimulacao(r)
      else {
        setResultado(r)
        setSimulacao(null)
        setArquivo(null)
        setMapa(null)
        await atuais.recarregar()
      }
    } catch (e) {
      setErro(erroEquipe(e))
    } finally {
      setOcupado(null)
    }
  }

  const grupos = atuais.dados?.grupos ?? []
  const equipes = atuais.dados?.equipes ?? []
  const porZeusPlanilha = new Map((leitura?.equipes ?? []).map((e) => [e.zeus, e]))
  const porZeusAtual = new Map(equipes.map((e) => [e.codigo_zeus, e]))
  const comProblema = leitura?.equipes.filter((e) => e.problema) ?? []
  const naoEntram = [...(leitura?.repetidas ?? []), ...(leitura?.deixadas ?? [])].sort((a, b) => a.linha - b.linha)
  const semGrupo = (leitura?.equipes ?? []).filter((e) => !e.problema && !grupoDoSupervisor(e.supervisor, grupos))

  return (
    <div className="pilha">
      <PaginaTopo
        titulo="Importar planilha de equipes"
        sub="Planilha do Zeus (aba META ATUALIZADA). A importação concilia pelo código Zeus: cria as novas, atualiza as que mudaram e inativa as que saíram. Nada é apagado."
        voltar={{ para: '/cadastros/equipes', rotulo: 'Equipes' }}
        trilha={['Cadastros', { rotulo: 'Equipes', para: '/cadastros/equipes' }, 'Importar planilha']}
      />

      <div className="cartao pilha">
        <h2>1. Arquivo</h2>
        <div className="grade-cartoes">
          <Campo rotulo="Planilha" ajuda={arquivo?.nome ?? 'Arquivo .xlsx com as colunas zeus, DESCRIÇÃO, supervisor, equipe e frota.'}>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => {
                void abrir(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </Campo>
          {arquivo && arquivo.abas.length > 1 && (
            <Campo rotulo="Aba">
              <select value={aba} onChange={(e) => escolherAba(arquivo, e.target.value)}>
                {arquivo.abas.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </Campo>
          )}
        </div>
        {!arquivo && <Aviso tipo="erro">{erro}</Aviso>}
      </div>

      {arquivo && mapa && (
        <div className="cartao pilha">
          <h2>2. Colunas</h2>
          <p className="sec peq">
            {iCabecalho >= 0 ? `Cabeçalho na linha ${iCabecalho + 1}.` : 'Não achei a coluna zeus nesta aba.'} Confira a coluna de cada
            campo. As colunas de meta não entram.
          </p>
          <div className="grade-cartoes">
            {CAMPOS_EQUIPES.map((c) => (
              <Campo key={c.chave} rotulo={c.rotulo}>
                <select
                  value={mapa[c.chave] ?? ''}
                  onChange={(e) => {
                    setMapa({ ...mapa, [c.chave]: e.target.value === '' ? null : Number(e.target.value) })
                    setSimulacao(null)
                  }}
                >
                  <option value="">Escolha a coluna</option>
                  {cabecalho.map((nome, i) => (
                    <option key={i} value={i}>
                      {String(nome ?? `Coluna ${i + 1}`).trim() || `Coluna ${i + 1}`}
                    </option>
                  ))}
                </select>
              </Campo>
            ))}
          </div>
          {faltaColuna && <Aviso tipo="atencao">Escolha as cinco colunas para conferir a planilha.</Aviso>}
        </div>
      )}

      {arquivo && leitura && (
        <div className="cartao pilha">
          <h2>3. Conferência da planilha</h2>
          <div className="linha">
            <span className="badge info">{contar(leitura.equipes.length, 'equipe lida', 'equipes lidas')}</span>
            <span className={`badge ${comProblema.length ? 'transito' : 'neutro'}`}>{contar(comProblema.length, 'entra inativa', 'entram inativas')}</span>
            <span className={`badge ${naoEntram.length ? 'alerta' : 'neutro'}`}>{contar(naoEntram.length, 'linha não entra', 'linhas não entram')}</span>
          </div>
          {semGrupo.length > 0 && (
            <Aviso tipo="erro">
              Supervisor sem grupo: {[...new Set(semGrupo.map((e) => e.supervisor))].join(', ')}. Cadastre o grupo ou preencha a chave da
              planilha em Grupos de equipes antes de importar.
            </Aviso>
          )}
          {comProblema.length > 0 && (
            <TabelaLinhas
              titulo="Entram inativas"
              linhas={comProblema.map((e) => ({ linha: e.linha, zeus: String(e.zeus), descricao: e.descricao, motivo: e.problema ?? '' }))}
            />
          )}
          {naoEntram.length > 0 && <TabelaLinhas titulo="Não entram" linhas={naoEntram} />}
          <Aviso tipo="erro">{simulacao ? null : erro}</Aviso>
          <div className="acoes">
            <button
              type="button"
              className="botao primario"
              disabled={!leitura.equipes.length || !!ocupado || semGrupo.length > 0}
              onClick={() => void chamar(true)}
            >
              {ocupado === 'Simulando…' ? ocupado : 'Simular importação'}
            </button>
          </div>
        </div>
      )}

      {simulacao && leitura && (
        <div className="pilha">
          <h2>4. O que vai mudar</h2>
          <p className="sec">Simulação: nada foi gravado ainda.</p>
          <BlocosConciliacao
            dados={simulacao}
            planilha={porZeusPlanilha}
            detalhe={(z) => {
              const l = porZeusPlanilha.get(z)
              const a = porZeusAtual.get(z)
              return l && a ? diferencas(l, a, grupos).join(' · ') : null
            }}
            nomeAtual={(z) => porZeusAtual.get(z)?.nome ?? null}
          />
          <Aviso tipo="erro">{erro}</Aviso>
          <div className="acoes fixas">
            <button type="button" className="botao secundario" onClick={() => setSimulacao(null)} disabled={!!ocupado}>
              Voltar
            </button>
            <button type="button" className="botao primario" onClick={() => void chamar(false)} disabled={!!ocupado}>
              {ocupado === 'Gravando…' ? ocupado : 'Gravar importação'}
            </button>
          </div>
        </div>
      )}

      {resultado && (
        <div className="pilha">
          <Aviso tipo="sucesso">
            Importação gravada: {resultado.novas.length} novas, {resultado.alteradas.length} alteradas, {resultado.inativadas.length}{' '}
            inativadas e {resultado.sem_mudanca.length} sem mudança. <Link to="/cadastros/equipes">Ver equipes</Link>
          </Aviso>
        </div>
      )}
    </div>
  )
}

function TabelaLinhas({ titulo, linhas }: { titulo: string; linhas: (LinhaDeixada & { descricao?: string | null })[] }) {
  return (
    <div className="pilha">
      <h3>{titulo}</h3>
      <div className="tabela-envoltorio" style={{ maxHeight: 280, overflowY: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Linha</th>
              <th>Zeus</th>
              {linhas.some((l) => l.descricao !== undefined) && <th>Descrição</th>}
              <th>Motivo</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => (
              <tr key={`${l.linha}-${i}`}>
                <td className="mono">{l.linha}</td>
                <td className="mono">{l.zeus || '—'}</td>
                {l.descricao !== undefined && <td>{l.descricao ?? '—'}</td>}
                <td>{l.motivo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function BlocosConciliacao({
  dados,
  planilha,
  detalhe,
  nomeAtual,
}: {
  dados: Conciliacao
  planilha: Map<number, LinhaEquipePlanilha>
  detalhe: (zeus: number) => string | null
  nomeAtual: (zeus: number) => string | null
}) {
  const nome = (z: number) => planilha.get(z)?.descricao ?? nomeAtual(z) ?? `Zeus ${z}`
  const bloco = (titulo: string, sub: string, zeus: number[], extra?: (z: number) => ReactNode) => (
    <Regiao titulo={`${titulo} (${zeus.length})`} sub={sub} nivel={3}>
      {zeus.length ? (
        <div className="tabela-envoltorio" style={{ maxHeight: 320, overflowY: 'auto' }}>
          <table>
            <tbody>
              {zeus.map((z) => (
                <tr key={z}>
                  <td className="mono">{z}</td>
                  <td>{nome(z)}</td>
                  {extra && <td className="peq">{extra(z)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="sec peq">Nenhuma.</p>
      )}
    </Regiao>
  )
  return (
    <div className="pilha">
      {bloco('Novas', 'Entram com os locais do grupo.', dados.novas, (z) => planilha.get(z)?.supervisor ?? '')}
      {bloco('Alteradas', 'Locais liberados à mão continuam, a não ser que a equipe troque de grupo.', dados.alteradas, detalhe)}
      {bloco('Inativadas', 'Saíram da planilha. Continuam no histórico e podem ser reativadas.', dados.inativadas)}
      {bloco('Com problema', 'Entram ou ficam inativas até a planilha vir completa.', dados.com_problema, (z) => planilha.get(z)?.problema ?? '')}
      <Regiao titulo={`Sem mudança (${dados.sem_mudanca.length})`} sub="Iguais ao cadastro." nivel={3}>
        {dados.sem_mudanca.length ? (
          <details>
            <summary className="peq">Ver os códigos Zeus</summary>
            <p className="sec peq mono">{dados.sem_mudanca.join(', ')}</p>
          </details>
        ) : (
          <p className="sec peq">Nenhuma.</p>
        )}
      </Regiao>
    </div>
  )
}
