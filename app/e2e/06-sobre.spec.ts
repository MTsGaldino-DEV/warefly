import { expect, test } from '@playwright/test'
import { abrirConta, entrar } from './apoio'

test('o login não mostra a autoria', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByText(/Desenvolvido por/)).toHaveCount(0)
})

test('admin vê a autoria e a versão em Administração → Sobre', async ({ page }) => {
  await entrar(page, 'admin')
  await abrirConta(page)
  await page.getByRole('button', { name: 'Administração' }).click()
  await page.getByRole('navigation', { name: 'Administração' }).getByRole('link', { name: 'Sobre' }).click()
  await expect(page).toHaveURL(/\/admin\/sobre$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sobre')
  await expect(page.getByText('Desenvolvido por Matheus Galdino', { exact: true })).toBeVisible()
  // Sem git no build, a linha de versão não aparece.
  const versao = page.getByText(/^Versão /)
  if (await versao.count()) await expect(versao).toHaveText(/^Versão [0-9a-f]{7,}$/)
})

test('quem não é admin não abre o Sobre', async ({ page }) => {
  await entrar(page, 'gestao')
  await page.goto('/admin/sobre')
  await expect(page.getByText('Acesso restrito ao administrador e à gestão do almoxarifado.')).toBeVisible()
})
