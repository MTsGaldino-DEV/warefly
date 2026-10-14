import { expect, test } from '@playwright/test'
import { abrirConta, entrar, sair, xlsx } from './apoio'

test.describe.configure({ mode: 'serial' })

test('admin vê os 13 almoxarifados e as unidades da planilha', async ({ page }) => {
  await entrar(page, 'admin')
  await page.goto('/admin/almoxarifados')
  await expect(page.getByRole('row')).toHaveCount(14) // cabeçalho + 13
  await expect(page.getByRole('row', { name: /RSP.*Resplendor/ })).toContainText('Vinícius')

  await page.goto('/admin/unidades')
  await expect(page.getByRole('row', { name: /^M3/ })).toContainText('Sim')
  await expect(page.getByRole('row', { name: /^PC/ })).toContainText('Não')
  await expect(page.getByLabel('Sigla no SAP de PC', { exact: true })).toHaveValue('PEÇ')
  await page.getByLabel('Sigla no SAP de PR', { exact: true }).fill('PAR')
  await page.getByLabel('Sigla no SAP de PR', { exact: true }).press('Tab')
  await expect(page.getByText('Unidade PR atualizada.')).toBeVisible()
  await page.getByLabel('Sigla no SAP de JG', { exact: true }).fill('PEÇ')
  await page.getByLabel('Sigla no SAP de JG', { exact: true }).press('Tab')
  await expect(page.getByText('A sigla PEÇ já é da unidade PC.')).toBeVisible()
  await expect(page.getByLabel('Sigla no SAP de JG', { exact: true })).toHaveValue('')
  await page.reload()
  await expect(page.getByLabel('Sigla no SAP de PR', { exact: true })).toHaveValue('PAR')
})

test('admin importa materiais da planilha do SAP com bloqueios', async ({ page }) => {
  await entrar(page, 'admin')
  await page.goto('/admin/materiais')
  await page.getByRole('link', { name: 'Importar planilha' }).click()

  await page.getByLabel('1. Arquivo').setInputFiles(
    xlsx('materiais.xlsx', [
      [null, null, null, null, null, null],
      [null, 'LISTA BÁSICA DE MATERIAIS', null, null, null, null],
      [null, 'SEQ', 'CÓDIGO', 'DESCRIÇÃO', 'UNIDADE', 'PREÇO'],
      [null, 1, 900001, 'PARAFUSO M16', 'PC', 2.5],
      [null, 2, 900002, 'CONECTOR PERFURANTE', 'PC', 10],
      [null, 3, 900003, 'CABO MULTIPLEX 16MM', 'M', 4.2],
      [null, 4, 900004, 'ITEM UNIDADE RUIM', 'XX', 1],
      [null, 5, 900005, 'ITEM REPETIDO A', 'PC', 1],
      [null, 6, 900005, 'ITEM REPETIDO B', 'PC', 1],
      [null, 'PE/RD - Rodapé', null, null, null, null],
    ]),
  )
  await expect(page.getByText('3 prontos para importar')).toBeVisible()
  await expect(page.getByText('3 bloqueados')).toBeVisible()
  await expect(page.getByRole('row', { name: /900004.*Unidade XX não cadastrada/ })).toBeVisible()

  await page.getByRole('button', { name: 'Importar 3 materiais' }).click()
  await expect(page.getByText('3 materiais inseridos.')).toBeVisible()

  // Reimportar a mesma planilha não atualiza nada
  await page.getByLabel('1. Arquivo').setInputFiles(
    xlsx('materiais.xlsx', [['CÓDIGO', 'DESCRIÇÃO', 'UNIDADE'], [900001, 'PARAFUSO M16', 'PC']]),
  )
  await expect(page.getByText('0 prontos para importar')).toBeVisible()
  await expect(page.getByRole('row', { name: /900001.*Já cadastrado/ })).toBeVisible()
})

test('admin atribui bases ao supervisor Victor', async ({ page }) => {
  await entrar(page, 'admin')
  await page.goto('/admin/usuarios')
  await page.getByRole('row', { name: /Victor/ }).click()
  for (const base of ['Mantena', 'Itabirinha', 'Coroaci']) {
    await page.getByRole('checkbox', { name: new RegExp(base) }).check()
  }
  await page.getByRole('button', { name: 'Adicionar atribuição' }).click()
  await expect(page.getByText('Atribuição adicionada.')).toBeVisible()
  await expect(page.getByRole('row', { name: /MNT.*Mantena.*Responsável/ })).toBeVisible()
  await expect(page.getByRole('row', { name: /MNT.*Mantena.*Supervisor/ })).toBeVisible()
})

test('admin carrega o saldo inicial do 211 e de Mantena', async ({ page }) => {
  await entrar(page, 'admin')
  await page.goto('/admin/saldo-inicial')

  // Material inexistente bloqueia tudo
  await page.getByLabel('Almoxarifado').selectOption({ label: '211 · Almoxarifado regional' })
  await page.getByLabel('Planilha').setInputFiles(
    xlsx('saldo.xlsx', [['codigo_sap', 'quantidade'], [900001, 50], [999999, 1]]),
  )
  await expect(page.getByText('Linha 3: material 999999 não existe no catálogo')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Importar saldo inicial' })).toHaveCount(0)

  await page.getByLabel('Planilha').setInputFiles(
    xlsx('saldo.xlsx', [['codigo_sap', 'quantidade'], [900001, 50], [900002, 10], [900003, '100,5']]),
  )
  await expect(page.getByRole('heading', { name: '3 materiais para Almoxarifado regional' })).toBeVisible()
  await page.getByRole('button', { name: 'Importar saldo inicial' }).click()
  await expect(page.getByText(/Saldo inicial importado: AJU-\d{6} com 3 materiais/)).toBeVisible()

  await page.getByLabel('Almoxarifado').selectOption({ label: 'MNT · Mantena' })
  await page.getByLabel('Planilha').setInputFiles(xlsx('saldo.xlsx', [['codigo_sap', 'quantidade'], [900001, 5]]))
  await page.getByRole('button', { name: 'Importar saldo inicial' }).click()
  await expect(page.getByText(/Saldo inicial importado/)).toBeVisible()
})

test('supervisor não acessa os cadastros do admin', async ({ page }) => {
  await entrar(page, 'victor')
  await abrirConta(page)
  await expect(page.getByRole('button', { name: 'Administração' })).toHaveCount(0)
  await page.goto('/admin/materiais')
  await expect(page.getByText('Acesso restrito ao administrador.')).toBeVisible()
  await sair(page)
})

test('gestora mantém os motivos de redução; supervisor não acessa', async ({ page }) => {
  await entrar(page, 'carlos')
  await page.goto('/cadastros/motivos')
  await expect(page.getByRole('heading', { name: 'Motivos de redução', level: 1 })).toBeVisible()
  await expect(page.getByLabel(/^Nome do motivo/)).toHaveCount(4)
  await page.getByLabel('Novo motivo').fill('Pedido em duplicidade')
  await page.getByRole('button', { name: 'Cadastrar motivo' }).click()
  await expect(page.getByText('Motivo "Pedido em duplicidade" cadastrado.')).toBeVisible()
  // O checkbox reflete o banco: muda depois que a gravação volta
  await page.getByLabel('Pedido em duplicidade ativo').click()
  await expect(page.getByText('Motivo "Pedido em duplicidade" inativado.')).toBeVisible()
  await expect(page.getByLabel('Pedido em duplicidade ativo')).not.toBeChecked()
  await page.getByLabel('Novo motivo').fill('outro')
  await page.getByRole('button', { name: 'Cadastrar motivo' }).click()
  await expect(page.getByText('Já existe um motivo com esse nome.')).toBeVisible()
  await sair(page)

  await entrar(page, 'victor')
  await page.goto('/cadastros/motivos')
  await expect(page.getByText('Acesso restrito à gestão do almoxarifado e ao administrador.')).toBeVisible()
})
