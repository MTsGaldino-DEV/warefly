import { expect, test } from '@playwright/test'
import { entrar } from './apoio'

test('admin abre a automação e vê o conector desligado', async ({ page }) => {
  await entrar(page, 'admin')
  await page.getByRole('link', { name: 'Solicitar material no GDIS' }).click()
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

test('quem não é admin não vê a automação', async ({ page }) => {
  await entrar(page, 'gestao')
  await expect(page.getByRole('link', { name: 'Solicitar material no GDIS' })).toHaveCount(0)
  await page.goto('/automacao/requisicao-material')
  await expect(page.getByText('Acesso restrito ao administrador.')).toBeVisible()
})
