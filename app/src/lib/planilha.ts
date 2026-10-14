import * as XLSX from 'xlsx'

/** Lê a primeira aba de um XLSX ou CSV como matriz de células. */
export async function lerPlanilha(arquivo: File): Promise<unknown[][]> {
  const dados = await arquivo.arrayBuffer()
  const livro = XLSX.read(dados, { type: 'array' })
  const aba = livro.Sheets[livro.SheetNames[0]]
  return XLSX.utils.sheet_to_json<unknown[]>(aba, { header: 1, defval: null, raw: true })
}

/**
 * Abre um XLSX com várias abas. `linhas` lê uma aba como matriz de células;
 * célula com erro de fórmula (#N/A, #REF!…) vem como o texto do erro, para a
 * importação saber que a linha tem problema.
 */
export async function lerAbas(arquivo: File): Promise<{ abas: string[]; linhas: (aba: string) => unknown[][] }> {
  const dados = await arquivo.arrayBuffer()
  const livro = XLSX.read(dados, { type: 'array' })
  return {
    abas: livro.SheetNames,
    linhas: (nome) => {
      const aba = livro.Sheets[nome]
      if (!aba) return []
      for (const [endereco, celula] of Object.entries(aba)) {
        if (endereco.startsWith('!')) continue
        const c = celula as XLSX.CellObject
        if (c.t === 'e') aba[endereco] = { t: 's', v: c.w ?? '#N/A' }
      }
      return XLSX.utils.sheet_to_json<unknown[]>(aba, { header: 1, defval: null, raw: true })
    },
  }
}

export function baixarPlanilha(nomeArquivo: string, linhas: unknown[][]) {
  const livro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(livro, XLSX.utils.aoa_to_sheet(linhas), 'Planilha')
  XLSX.writeFile(livro, nomeArquivo)
}
