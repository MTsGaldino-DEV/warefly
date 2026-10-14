/**
 * Planilha de equipes ("Atualização PO x ZEUS", aba META ATUALIZADA).
 * Colunas usadas: zeus, DESCRIÇÃO, supervisor, equipe (integrantes) e frota.
 * As colunas de meta são ignoradas.
 */

export type MapaEquipes = {
  zeus: number | null
  descricao: number | null
  supervisor: number | null
  integrantes: number | null
  frota: number | null
}

export const CAMPOS_EQUIPES: { chave: keyof MapaEquipes; rotulo: string }[] = [
  { chave: 'zeus', rotulo: 'Código Zeus' },
  { chave: 'descricao', rotulo: 'Descrição' },
  { chave: 'supervisor', rotulo: 'Supervisor' },
  { chave: 'integrantes', rotulo: 'Integrantes' },
  { chave: 'frota', rotulo: 'Frota' },
]

/** Aba que a planilha mensal usa. */
export const ABA_EQUIPES = 'META ATUALIZADA'

const SINONIMOS: Record<keyof MapaEquipes, string[]> = {
  zeus: ['zeus', 'codigo zeus', 'cod zeus', 'zeus equipe'],
  descricao: ['descricao', 'descricao equipe', 'nome', 'nome da equipe'],
  supervisor: ['supervisor', 'supervisao', 'grupo'],
  integrantes: ['equipe', 'integrantes', 'componentes', 'eletricistas'],
  frota: ['frota', 'veiculo', 'prefixo'],
}

/** Linha pronta para a RPC rpc_importar_equipes. */
export type LinhaEquipePlanilha = {
  linha: number
  zeus: number
  descricao: string | null
  supervisor: string | null
  integrantes: string | null
  frota: string | null
  /** Motivo de a equipe entrar inativa; null quando a linha está completa. */
  problema: string | null
}

export type LinhaDeixada = { linha: number; zeus: string; motivo: string }

function normalizar(valor: unknown): string {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export function detectarColunasEquipes(cabecalho: unknown[]): MapaEquipes {
  const nomes = cabecalho.map(normalizar)
  const achar = (campo: keyof MapaEquipes) => {
    const i = nomes.findIndex((n) => SINONIMOS[campo].includes(n))
    return i === -1 ? null : i
  }
  return {
    zeus: achar('zeus'),
    descricao: achar('descricao'),
    supervisor: achar('supervisor'),
    integrantes: achar('integrantes'),
    frota: achar('frota'),
  }
}

/** Índice da linha de cabeçalho: a primeira com a coluna zeus. -1 se não houver. */
export function encontrarCabecalhoEquipes(linhas: unknown[][]): number {
  return linhas.findIndex((l) => detectarColunasEquipes(l).zeus !== null)
}

/** Erro de fórmula do Excel, como vem na célula (#N/A, #REF!, #VALOR!…). */
const ERRO_EXCEL = /^#(N\/?A|REF!|VALUE!|VALOR!|DIV\/0!|NAME\?|NOME\?|NUM!|NULL!|NULO!)$/i

type Celula = { texto: string | null; erro: boolean }

function celula(linha: unknown[], indice: number | null): Celula {
  if (indice === null) return { texto: null, erro: false }
  const v = linha[indice]
  if (v === null || v === undefined) return { texto: null, erro: false }
  const texto = String(v).replace(/\s+/g, ' ').trim()
  if (ERRO_EXCEL.test(texto)) return { texto: null, erro: true }
  return { texto: texto || null, erro: false }
}

function lerZeusCelula(linha: unknown[], indice: number | null): number | null {
  if (indice === null) return null
  const v = linha[indice]
  const n = typeof v === 'number' ? v : /^\s*\d+\s*$/.test(String(v ?? '')) ? Number(v) : NaN
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

const NAO_LANCAR = /n[aã]o\s+lan[cç]ar/i

/**
 * Lê as linhas da planilha.
 * - Linha sem nada nas colunas usadas, ou de totais (sem Zeus, só números), é pulada em silêncio.
 * - Linha sem Zeus válido fica de fora, com o motivo.
 * - Zeus repetido entra uma vez: vale a primeira linha.
 * - Linha sem supervisor, integrantes ou frota, com #N/A ou marcada "Não lançar"
 *   vai com `problema` preenchido: a equipe entra inativa.
 */
export function lerEquipes(
  linhas: unknown[][],
  mapa: MapaEquipes,
  primeiraLinha = 1,
): { equipes: LinhaEquipePlanilha[]; deixadas: LinhaDeixada[]; repetidas: LinhaDeixada[] } {
  const equipes: LinhaEquipePlanilha[] = []
  const deixadas: LinhaDeixada[] = []
  const repetidas: LinhaDeixada[] = []
  const porZeus = new Map<number, LinhaEquipePlanilha>()

  linhas.forEach((l, i) => {
    const linha = primeiraLinha + i
    const descricao = celula(l, mapa.descricao)
    const supervisor = celula(l, mapa.supervisor)
    const integrantes = celula(l, mapa.integrantes)
    const frota = celula(l, mapa.frota)
    const zeusTexto = celula(l, mapa.zeus)
    const campos = [descricao, supervisor, integrantes, frota, zeusTexto]
    if (campos.every((c) => c.texto === null && !c.erro)) return

    const zeus = lerZeusCelula(l, mapa.zeus)
    // Linha de totais: sem Zeus e só números nas colunas de texto
    const temTexto = [descricao, supervisor, integrantes].some((c) => c.texto !== null && !/^-?[\d.,]+$/.test(c.texto))
    if (zeus === null && zeusTexto.texto === null && !temTexto) return
    if (zeus === null) {
      deixadas.push({ linha, zeus: zeusTexto.texto ?? '', motivo: zeusTexto.texto ? 'Código Zeus inválido' : 'Sem código Zeus' })
      return
    }

    const problemas: string[] = []
    if ([descricao, supervisor, integrantes].some((c) => c.texto && NAO_LANCAR.test(c.texto))) problemas.push('Marcada "Não lançar"')
    if (campos.some((c) => c.erro)) problemas.push('Célula com #N/A')
    if (!supervisor.texto) problemas.push('Sem supervisor')
    if (!integrantes.texto) problemas.push('Sem integrantes')
    if (!frota.texto) problemas.push('Sem frota')

    const atual: LinhaEquipePlanilha = {
      linha,
      zeus,
      descricao: descricao.texto,
      supervisor: supervisor.texto,
      integrantes: integrantes.texto,
      frota: frota.texto,
      problema: problemas.length ? problemas.join('; ') : null,
    }

    const anterior = porZeus.get(zeus)
    if (anterior) {
      const igual =
        anterior.descricao === atual.descricao &&
        anterior.supervisor === atual.supervisor &&
        anterior.integrantes === atual.integrantes &&
        anterior.frota === atual.frota
      repetidas.push({
        linha,
        zeus: String(zeus),
        motivo: igual
          ? `Repetida, igual à linha ${anterior.linha}: entra uma vez`
          : `Repetida com dados diferentes: vale a linha ${anterior.linha}`,
      })
      return
    }
    porZeus.set(zeus, atual)
    equipes.push(atual)
  })

  return { equipes, deixadas, repetidas }
}

/** Corpo de p_linhas da RPC: sem o número da linha. */
export function paraRpc(equipes: LinhaEquipePlanilha[]) {
  return equipes.map(({ linha: _linha, ...resto }) => resto)
}

/** Resultado de rpc_importar_equipes: listas de códigos Zeus. */
export type Conciliacao = {
  novas: number[]
  alteradas: number[]
  sem_mudanca: number[]
  inativadas: number[]
  com_problema: number[]
}

export function lerConciliacao(json: unknown): Conciliacao {
  const o = (json ?? {}) as Record<string, unknown>
  const lista = (k: string) => (Array.isArray(o[k]) ? (o[k] as unknown[]).map(Number) : [])
  return {
    novas: lista('novas'),
    alteradas: lista('alteradas'),
    sem_mudanca: lista('sem_mudanca'),
    inativadas: lista('inativadas'),
    com_problema: lista('com_problema'),
  }
}

type EquipeAtual = { nome: string; integrantes: string | null; frota: string | null; grupo_id: string | null; ativa: boolean }
type GrupoChave = { id: string; nome: string; chave_planilha: string | null; ativo: boolean }

/** Grupo ativo cuja chave bate com o supervisor da planilha (sem diferença de maiúscula). */
export function grupoDoSupervisor<G extends GrupoChave>(supervisor: string | null, grupos: G[]): G | undefined {
  const s = supervisor?.trim().toLowerCase()
  return s ? grupos.find((g) => g.ativo && g.chave_planilha?.trim().toLowerCase() === s) : undefined
}

/**
 * O que muda numa equipe que já existe, para a conferência antes de gravar.
 * Segue as regras de rpc_importar_equipes: descrição vazia vira "Zeus N" e
 * linha com problema deixa a equipe inativa.
 */
export function diferencas(linha: LinhaEquipePlanilha, atual: EquipeAtual, grupos: GrupoChave[]): string[] {
  const vazio = (v: string | null | undefined) => v || '—'
  const nome = linha.descricao || `Zeus ${linha.zeus}`
  const grupoNovo = grupoDoSupervisor(linha.supervisor, grupos)
  const nomeGrupo = (id: string | null | undefined) => grupos.find((g) => g.id === id)?.nome ?? 'sem grupo'
  const ativa = !linha.problema
  const saida: string[] = []
  if (atual.nome !== nome) saida.push(`Descrição: ${atual.nome} → ${nome}`)
  if ((atual.integrantes ?? null) !== linha.integrantes) saida.push(`Integrantes: ${vazio(atual.integrantes)} → ${vazio(linha.integrantes)}`)
  if ((atual.frota ?? null) !== linha.frota) saida.push(`Frota: ${vazio(atual.frota)} → ${vazio(linha.frota)}`)
  if ((atual.grupo_id ?? null) !== (grupoNovo?.id ?? null))
    saida.push(`Grupo: ${nomeGrupo(atual.grupo_id)} → ${nomeGrupo(grupoNovo?.id)} (locais voltam ao padrão do grupo)`)
  if (atual.ativa !== ativa) saida.push(ativa ? 'Volta a ficar ativa' : 'Fica inativa')
  return saida
}
