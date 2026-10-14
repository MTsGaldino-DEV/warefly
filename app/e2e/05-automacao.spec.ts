import { expect, test } from '@playwright/test'
import { abrirConta, entrar } from './apoio'

test('admin abre Administração → Automações e vê o conector desligado', async ({ page }) => {
  await entrar(page, 'admin')
  await abrirConta(page)
  await page.getByRole('button', { name: 'Administração' }).click()
  await expect(page).toHaveURL(/\/admin\/automacoes$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Automações')
  await expect(page.getByRole('navigation', { name: 'Administração' }).getByRole('link', { name: 'Automações' })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByText('Fluxo em definição')).toBeVisible()

  await page.getByRole('link', { name: 'Abrir Solicitar material no GDIS' }).click()
  await expect(page).toHaveURL(/\/admin\/automacoes\/requisicao-material$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Solicitar material no GDIS')
  await expect(page.getByText('Conector desligado.')).toBeVisible()
  await expect(page.getByText('REQUISICAO DE MATERIAIS DE MANUTENCAO PARA O PERIODO')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Montar nota no GDIS' })).toBeDisabled()

  await page.getByRole('button', { name: 'Colar lista' }).click()
  await page.getByLabel('Lista de materiais').fill('900001;2\n123456;1\nabc')
  await page.getByRole('button', { name: 'Adicionar à lista' }).click()
  await expect(page.getByText('Linha 3: use "código; quantidade" com código só de números.')).toBeVisible()
  await expect(page.getByRole('row', { name: /900001/ })).toContainText('PARAFUSO M16')
  await expect(page.getByRole('row', { name: /123456/ })).toContainText('fora do catálogo')
})

test('endereço antigo da automação leva para a Administração', async ({ page }) => {
  await entrar(page, 'admin')
  await page.goto('/automacao/requisicao-material')
  await expect(page).toHaveURL(/\/admin\/automacoes\/requisicao-material$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Solicitar material no GDIS')
})

test('quem não é admin não vê a Administração', async ({ page }) => {
  await entrar(page, 'gestao')
  await abrirConta(page)
  await expect(page.getByRole('button', { name: 'Administração' })).toHaveCount(0)
  await page.goto('/admin/automacoes')
  await expect(page.getByText('Acesso restrito ao administrador.')).toBeVisible()
})
