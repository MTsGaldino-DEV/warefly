import { expect, type Page } from '@playwright/test'
import * as XLSX from 'xlsx'

export const USUARIOS = {
  admin: { email: 'admin@warefly.test', senha: 'Senha123!', nome: 'Ana Admin' },
  // Era a gerência (perfil extinto em 15/10); agora é o operador do 211.
  gestao: { email: 'gestao@warefly.test', senha: 'Senha123!', nome: 'Gil Gestão' },
  carlos: { email: 'carlos@warefly.test', senha: 'Senha123!', nome: 'Carlos 211' },
  victor: { email: 'victor@warefly.test', senha: 'Senha123!', nome: 'Victor' },
  vinicius: { email: 'vinicius@warefly.test', senha: 'Senha123!', nome: 'Vinícius' },
} as const

export type Quem = keyof typeof USUARIOS

export async function entrar(page: Page, quem: Quem) {
  const u = USUARIOS[quem]
  await page.goto('/login')
  await page.getByLabel('Usuário').fill(u.email)
  await page.getByLabel('Senha').fill(u.senha)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Almoxarifado 211')
  // Confere quem entrou pelo menu da conta e fecha o menu.
  await abrirConta(page)
  await expect(page.getByText(u.nome, { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Conta' }).click()
}

/** Abre o menu da conta (ícone de pessoa) no Início. */
export async function abrirConta(page: Page) {
  await page.getByRole('button', { name: 'Conta' }).click()
}

export async function sair(page: Page) {
  await page.goto('/')
  await abrirConta(page)
  await page.getByRole('button', { name: 'Sair' }).click()
  await expect(page).toHaveURL(/\/login/)
}

/** Gera um XLSX em memória e devolve no formato aceito por setInputFiles. */
export function xlsx(nome: string, linhas: unknown[][]) {
  const livro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(livro, XLSX.utils.aoa_to_sheet(linhas), 'Planilha')
  const buffer = XLSX.write(livro, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  return { name: nome, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer }
}
