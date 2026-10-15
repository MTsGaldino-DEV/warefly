import { expect, test } from '@playwright/test'
import { abrirConta, entrar } from './apoio'

// Carlos é o responsável do 211 (gestora do almoxarifado): vê só o Inventário na Administração.

test('gestora lança o saldo inicial de uma base com material cadastrado na hora', async ({ page }) => {
  await entrar(page, 'carlos')
  await abrirConta(page)
  await page.getByRole('button', { name: 'Administração' }).click()
  await expect(page).toHaveURL(/\/admin\/inventario$/)
  const abas = page.getByRole('navigation', { name: 'Administração' }).getByRole('link')
  await expect(abas).toHaveText(['Inventário'])

  await page.getByLabel('Local').selectOption({ label: 'AIM · Aimorés' })
  await expect(page.getByText('Saldo inicial (implantação)')).toBeVisible()

  await page.getByRole('button', { name: 'Material fora do catálogo' }).click()
  await page.getByLabel('Código SAP').fill('990001')
  await page.getByLabel('Unidade').selectOption('PC')
  await page.getByLabel('Descrição').fill('Luva de teste do inventário')
  await page.getByRole('button', { name: 'Cadastrar e adicionar' }).click()
  await page.getByLabel('Quantidade contada de LUVA DE TESTE DO INVENTÁRIO').fill('12')
  await page.getByRole('button', { name: 'Lançar contagem' }).click()
  await expect(page.getByText(/Contagem lançada em Aimorés: AJU-\d{6} com 1 material/)).toBeVisible()
})

test('gestora não abre as automações nem o Sobre', async ({ page }) => {
  await entrar(page, 'carlos')
  await page.goto('/admin/sobre')
  await expect(page).toHaveURL(/\/admin\/inventario$/)
  await page.goto('/admin/automacoes')
  await expect(page).toHaveURL(/\/admin\/inventario$/)
})

test('operador do 211 não tem Administração', async ({ page }) => {
  await entrar(page, 'gestao')
  await abrirConta(page)
  await expect(page.getByRole('button', { name: 'Administração' })).toHaveCount(0)
  await page.goto('/admin/inventario')
  await expect(page.getByText('Acesso restrito ao administrador e à gestão do almoxarifado.')).toBeVisible()
})
