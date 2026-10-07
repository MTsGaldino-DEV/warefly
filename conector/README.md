# Conector Warefly × GDIS

Roda na sua máquina e faz automações no GDIS (rede interna da Cemig) a pedido da aba **Automação** do Warefly.

## Instalar

    cd conector
    npm install

Usa o Microsoft Edge instalado na máquina.

## Usar

    npm start

Deixe a janela aberta. No Warefly, abra **Automação → Solicitar material no GDIS**, clique em **Abrir login do GDIS**, entre no GDIS (senha e reCAPTCHA) e clique em **Já entrei**.

O robô preenche a nota e **não salva**: revise no GDIS e clique em Salvar.

## Produção

Por segurança o conector só aceita chamadas do Warefly rodando local. Para o Warefly publicado, informe o endereço:

    set WAREFLY_ORIGENS=https://seu-warefly.vercel.app
    npm start

## Testes

    npm test

Os testes do fluxo rodam contra um GDIS falso em `teste/gdis-falso/`.
