/** Crédito discreto no pé da tela de login. */
export const AUTORIA = 'Desenvolvido por Matheus Galdino'

/** Commit do build (gravado pelo vite.config.ts); null quando não há git nem WAREFLY_COMMIT. */
export const COMMIT: string | null = __WAREFLY_COMMIT__

/** Ex.: "Desenvolvido por Matheus Galdino · a1b2c3d". Sem commit, só a autoria. */
export function linhaRodape(commit: string | null): string {
  return commit ? `${AUTORIA} · ${commit}` : AUTORIA
}
