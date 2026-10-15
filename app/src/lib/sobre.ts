/** Crédito de autoria, mostrado na aba Sobre da Administração. */
export const AUTORIA = 'Desenvolvido por Matheus Galdino'

/** Commit do build (gravado pelo vite.config.ts); null quando não há git nem WAREFLY_COMMIT. */
export const COMMIT: string | null = __WAREFLY_COMMIT__

/** Ex.: "Versão a1b2c3d". Sem commit, null (a linha não aparece). */
export function linhaVersao(commit: string | null): string | null {
  return commit ? `Versão ${commit}` : null
}
