# Warefly Android: equipes, supervisores e estoque do carro

- **Data:** 13/10/2026
- **Situação:** validada em 13/10/2026
- **Base:** `claude/warefly-contexto.md` e as decisões do Matheus em 13 e 14/10
- **Relação com outras specs:** parte da [spec de equipes por grupo](2026-10-13-equipes-por-grupo-design.md) (grupos, `equipe_locais`, cadastro da equipe), que continua valendo. Esta spec acrescenta login, membros, estoque da equipe, requisições e consumo.

## 1. Objetivo

Levar o Warefly para o celular de quem está em campo:

- **Equipe (eletricistas):** ver o estoque do próprio carro e da base, pedir material e transferir material para outra equipe.
- **Supervisor:** ver as bases e as equipes dele, analisar o que as equipes pedem e decidir se atende da base ou pede ao 211.
- **Operador do almoxarifado:** módulo compacto (saída e consulta de estoque) em fase posterior.

O app é Android, roda em celulares da empresa e só funciona com internet.

## 2. Decisões tomadas (13/10)

| # | Decisão |
|---|---|
| D1 | Cada equipe tem estoque próprio (o carro). O saldo continua sendo a soma de `movimentacoes`. |
| D2 | Há transferência entre equipes com confirmação dos dois lados: um envia, o outro confirma o recebimento no app. |
| D3 | O login é feito pela matrícula Engelmig (ex.: `27630`) ou pela matrícula CEMIG (ex.: `e252135`). O material é atribuído pela matrícula CEMIG. |
| D4 | O usuário entra com senha inicial e troca no primeiro acesso. |
| D5 | O appweb ganha uma aba de administração de colaboradores e equipes, usada pela responsável do almoxarifado (além do admin). |
| D6 | Fluxo do pedido: a equipe faz a requisição, o supervisor aprova, reduz ou recusa, e o que aprovou segue para o 211. |
| D7 | O consumo do carro vem da automação diária do almoxarifado, que lista os serviços executados por equipe com as quantidades de material. Essa é a fonte confiável de baixa. |
| D8 | O supervisor decide se atende pela base dele ou pede ao 211. A regra será refinada (ver 4.4). |
| D9 | "Almoxarifado geral" é o 211. O 3256 continua fora do sistema. |
| D10 | O supervisor pode abrir uma solicitação (SOL-) e anexar a ela as requisições das equipes. |
| D11 | Os celulares são da empresa. |
| D12 | O app só opera conectado. Não há fila offline. |
| D13 | O material é da equipe. Todos os membros veem o estoque da equipe, e cada movimento registra a matrícula de quem fez (ex.: "material X retirado pela matrícula e252135"). |
| D14 | Só o ramal pode deixar o estoque da equipe negativo, porque o consumo dele é informado por estimativa. É uma exceção à regra de ouro 2, restrita ao local de equipe, à baixa do consumo diário e aos materiais marcados para isso. O código SAP do ramal ainda será confirmado. |
| D15 | A automação diária de consumo ainda não existe. Ela vai rodar dentro do Warefly, buscar os serviços executados e baixar o material direto no estoque de cada equipe, sem planilha (4.5). |
| D16 | Todos os membros da equipe podem pedir, transferir e confirmar. |

## 3. Perfis e visibilidade

| Perfil | Como se configura | Vê | Faz |
|---|---|---|---|
| Membro de equipe (todos os membros, D16) | colaborador vinculado a uma equipe ativa | estoque da própria equipe e o histórico com a matrícula de cada movimento; consumo da própria equipe por dia e por serviço; estoque das bases liberadas para a equipe (4.2), nunca o do 211 | abre requisição (REQ-); envia e confirma transferências da própria equipe; devolve à base |
| Supervisor | atribuição `supervisor` nas bases (já existe) e `grupos.supervisor_id` apontando para ele (novo) | as bases dele; o estoque de cada equipe do grupo dele; a movimentação dessas equipes (ex.: "Equipe X enviou 20 conectores perfurantes para a Equipe Y"); as requisições dessas equipes | analisa REQ-; abre SOL- e anexa REQ-; envia material da base para equipe; altera os colaboradores das equipes dele (vincular e desvincular membros) |
| Gestora do almoxarifado | `responsavel` no 211 (já existe) | tudo | o que já faz hoje, mais a administração de colaboradores e equipes e o tratamento dos itens pendentes do consumo diário |
| Gerência | papel `gestao` | tudo | não opera |
| Admin | papel `admin` | tudo | tudo, como hoje |

A permissão nova da gestora para administrar colaboradores e equipes muda a regra atual, em que só o admin cuida de usuários.

O supervisor ganha uma permissão menor: vincula e desvincula colaboradores nas equipes do grupo dele. Criar usuário, redefinir senha e inativar colaborador continuam com a gestora e o admin.

A movimentação que o supervisor vê inclui:

- as transferências entre equipes, mesmo quando só uma delas é do grupo dele;
- os envios e as devoluções entre base e equipe;
- o consumo diário. O supervisor escolhe uma data ou um período e vê quanto de cada material foi gasto em cada dia, por equipe e no total do grupo (4.5).

Cada linha mostra origem, destino, material, quantidade, situação e a matrícula de quem fez.

## 4. Modelo de dados

Todas as mudanças entram em migrations novas. As migrations `20261001100*` ainda não foram aplicadas no remoto, mas também não são editadas: o que mudar vem por cima, em arquivo novo.

### 4.1 Colaboradores

Colaborador é um registro de `perfis` (o cadastro de usuários que já existe). `perfis` já tem `nome`, `ativo` e `matricula`. Muda isto:

- `matricula`: passa a ser a matrícula Engelmig, só dígitos, única (já era única).
- `matricula_cemig` (nova): `e` seguido de dígitos, única, gravada sempre em minúsculo. Quem digitar `E` maiúsculo, no cadastro, no login ou nos dados da automação, tem o valor convertido para minúsculo antes de gravar ou comparar. Uma restrição no banco recusa matrícula fora do formato.
- `deve_trocar_senha` e `senha_inicial_ate` (novas): senha inicial pendente e até quando ela vale.

A view `v_colaboradores` mostra nome, matrículas, papel, situação da senha e equipe atual, sem o e-mail. `perfis` continua restrito como hoje.

Para o vínculo com a equipe, entra a tabela `equipe_membros` (`equipe_id`, `colaborador_id`, `inicio`, `fim`, quem vinculou e quem desvinculou), com histórico. Ela é necessária porque o consumo é baixado depois do serviço, às vezes dias depois, e precisa achar a equipe em que a pessoa estava na data do serviço.

- Um colaborador pertence a no máximo uma equipe por vez.
- Para entrar numa equipe, o colaborador precisa estar ativo e ter matrícula CEMIG.
- Colaborador inativado sai da equipe. Equipe inativada fica sem membros.
- A coluna `equipes.integrantes`, que vem da planilha, continua como descrição. Quem acessa o app é quem está em `equipe_membros`.

**Configurações:** a tabela `configuracoes` guarda os valores ajustáveis sem mudar código. Só o admin altera. Começa com o limite de membros por equipe (2) e o prazo da senha inicial (7 dias); o prazo do alerta de transferência (12 horas) entra na fase B.

### 4.2 Equipe como local de estoque

Cada equipe ativa tem um local de estoque do tipo `equipe` em `almoxarifados`.

**O que já existe (spec de equipes por grupo):**

- **Cadastro da equipe:** código Zeus, descrição, integrantes, frota e grupo, todos obrigatórios.
- **Grupos (`grupos`):** um por supervisor e o da moto. Definem os locais padrão (`grupo_locais`).
- **Locais liberados (`equipe_locais`):** onde a equipe retira material. Nascem iguais aos do grupo, e a gestora edita a lista (ex.: moto que pede acesso a uma localidade). Toda equipe retira no 211 Geral, mas nenhuma vê o estoque do 211.

**O que muda:**

- `grupos.supervisor_id` liga o grupo ao usuário que supervisiona. O admin define. É isso que diz quais equipes são "do supervisor".
- O membro da equipe vê o estoque das bases em `equipe_locais` (sem o 211).

Assim, as views de saldo, físico e disponível continuam valendo sem regra nova. A tabela `equipes` da fase 1 passa a apontar para esse local.

A saída com equipe da fase 1, que hoje é baixa direta, vira transferência da base para a equipe (4.3). A baixa passa a vir do consumo diário (4.5).

Todo movimento no estoque da equipe grava a matrícula de quem fez:

- na TRF-, quem enviou e quem confirmou;
- na REQ-, quem pediu;
- no consumo, o número do serviço e a matrícula CEMIG de quem executou.

O histórico da equipe mostra frases como "10 un. de conector retiradas pela matrícula e252135 (TRF-2026-00012)".

### 4.3 Transferências com confirmação (TRF-)

**Tipos:**

- base → equipe
- equipe → equipe
- equipe → base (devolução)

**Estados:**

| Estado | Movimentação |
|---|---|
| `enviada` | Na criação, a saída da origem é registrada e o material fica em trânsito. Usa o mesmo mecanismo de trânsito das remessas. |
| `recebida` | Na confirmação, o material entra no destino. |
| `recebida_com_divergencia` | O destino informa a quantidade que chegou e abre uma divergência, tratada como as de hoje. |
| `recusada` | O material volta para a origem, com motivo. |
| `cancelada` | Só por quem enviou e só enquanto estiver `enviada`. O material volta para a origem. |

**Regras:**

- Quem envia não confirma. Vale também entre equipes do mesmo supervisor.
- A confirmação é digital, sem foto.
- Transferência `enviada` há mais de 12 horas aparece em destaque para o supervisor. O prazo fica numa configuração.

### 4.4 Requisição da equipe (REQ-)

**Itens:** material, quantidade pedida, quantidade aprovada, motivo de redução (de `motivos_reducao`, ou "Outro" com observação).

**Estados da requisição:**

- `aberta`: a equipe ainda pode cancelar.
- `em_analise`
- `analisada`: tem itens aprovados, reduzidos ou recusados.
- `concluida`: todos os itens aprovados chegaram à equipe.
- `cancelada`

**Decisão do supervisor, por item aprovado:**

1. **Atender da base:** gera uma TRF- da base para a equipe. Ao lado de cada item, o supervisor vê o disponível na base.
2. **Pedir ao 211:** anexa o item a uma SOL- aberta da base ou cria uma nova SOL-. Quando o despacho dessa SOL- chega à base, a REQ- mostra "na base, aguardando entrega" e o supervisor gera a TRF- para a equipe.

O supervisor também pode abrir uma SOL- sem nenhuma REQ- (reposição da base).

**A refinar (D8):** se o app deve sugerir a opção 1 quando a base tem o material, e se há limite mínimo de estoque na base abaixo do qual a sugestão é pedir ao 211. O limite mínimo e a média por base ainda não existem (ponto em aberto 1). Enquanto não forem definidos, o app mostra o disponível na base e não sugere nada.

**Dependência:** a fase 2 do web (solicitações) precisa estar pronta antes, porque a REQ- se anexa à SOL-.

### 4.5 Consumo diário (automação)

A automação roda dentro do Warefly, uma vez por dia. Ela busca os serviços executados, grava o que foi gasto em cada um e baixa o material direto no estoque de cada equipe. Não há planilha nem importação manual.

**Dados que a automação traz de cada serviço:** data de execução, número do serviço ou nota, tipo de serviço, matrícula CEMIG e, para cada material, o código SAP e a quantidade.

**Processamento:**

1. A matrícula CEMIG e a data identificam a equipe vigente, por `equipe_membros`.
2. O material é baixado do estoque da equipe por RPC, em transação única. Cada baixa aponta para o número do serviço.
3. O mesmo item não é baixado duas vezes: a chave é (serviço, material, matrícula). Assim, a automação pode buscar de novo um dia que falhou ou que ficou para trás sem duplicar nada.

**Saldo negativo (D14):** o cadastro de materiais ganha a marca `consumo_estimado`, editada só pela gestora ou pelo admin. No começo, só o ramal tem a marca.

- **Material com a marca:** a baixa do consumo é feita mesmo que o saldo do carro fique negativo.
- **Material sem a marca:** se o consumo for maior que o saldo do carro, o item não baixa e fica pendente com a diferença.
- **Outras operações:** continuam presas ao saldo para todos os materiais. Ninguém transfere nem devolve mais do que a equipe tem.

O material negativo aparece em alerta:

- para o supervisor, no Início do app;
- para a gestora, no web.

O acerto é feito por transferência que faltou registrar, por ajuste justificado (gestora ou admin) ou por contagem do carro.

**Itens pendentes:** o item não baixa e fica pendente até ser corrigido quando:

- a matrícula não for encontrada;
- o material não for encontrado;
- faltar saldo num material sem a marca `consumo_estimado`.

O tratamento é o mesmo do negativo: registrar a transferência que faltou ou fazer um ajuste justificado. Depois disso, o item é reprocessado.

A gestora vê os itens pendentes no web e trata cada um.

**Consulta do consumo por data:** uma view soma o consumo por dia de execução, equipe e material. O dia usado é a data de execução do serviço, não o dia em que a automação rodou.

Quem vê o quê:

- a equipe vê o consumo dela;
- o supervisor vê as equipes do grupo dele;
- a gestora e a gerência veem todas.

Filtros:

- data ou período;
- número do serviço;
- tipo de serviço;
- equipe ou grupo inteiro, para supervisor e gestora;
- material.

Ao tocar num dia, aparecem os serviços daquele dia. Ao tocar num serviço, aparece o que foi gasto nele: material, quantidade e matrícula CEMIG.

**Registro das execuções:** cada vez que a automação roda, o Warefly guarda quando rodou, o período buscado e quantos itens baixou, quantos ficaram pendentes e se houve erro. Esse registro é interno, sem prefixo. Ele serve para a gestora e o admin verem se a automação rodou no dia e para buscar de novo um dia com falha.

**A definir na spec da automação:** de onde os serviços são lidos, como a execução é agendada e o que acontece se o computador ou o serviço que roda a automação estiver desligado no horário.

### 4.6 Prefixos novos

`REQ-` (requisição da equipe) e `TRF-` (transferência com equipe). O consumo não tem prefixo próprio: cada baixa é identificada pelo número do serviço.

## 5. Acesso e login

- **Tela de login:** um campo "Matrícula", que aceita `27630` ou `e252135`, e a senha.
- **Edge Function `entrar`:**
  - Recebe a matrícula e devolve o e-mail do Auth daquela pessoa. O app faz o login com esse e-mail e a senha.
  - Para matrícula que não existe, devolve um e-mail inventado, no mesmo formato. A resposta é igual nos dois casos, então ninguém descobre quais matrículas existem.
  - O login em si é feito pelo celular, e não pela função. Assim, o limite de tentativas do Supabase vale por aparelho, e não para todos de uma vez (todos os logins sairiam do mesmo endereço da função).
  - A busca usa `rpc_email_para_login`, que só responde à `service_role`.
- **E-mail interno:** quem é criado pelo Warefly recebe o e-mail `<id do usuário>@colaborador.warefly.local`, que ninguém vê nem usa. Ele vem do id, e não da matrícula: corrigir uma matrícula não quebra o acesso. Os usuários atuais `@engelmig.com.br` mantêm o e-mail.
- **Senha:**
  - A senha inicial padrão é `12345678`. Ela fica numa variável de ambiente da Edge Function `colaboradores`, não no código do app.
  - A nova senha, escolhida no primeiro acesso, tem no mínimo 8 caracteres e não pode ser igual à padrão.
  - A senha padrão vale por 7 dias (`configuracoes`) a partir da criação ou da redefinição.
  - Com `deve_trocar_senha`, o app abre direto na troca de senha. Até a troca, nenhuma RPC roda: o banco responde "Troque a senha inicial antes de continuar.".
  - A troca é feita pelo app no Auth, e depois `rpc_concluir_troca_senha` tira a pendência. Com o prazo vencido, a RPC recusa.
  - "Redefinir senha" volta a senha para a padrão, liga `deve_trocar_senha` e reinicia o prazo.
- **Hook de token do Auth:** roda no banco a cada login e a cada renovação de sessão. Recusa:
  - colaborador inativo: "Acesso desativado. Procure o almoxarifado.";
  - senha inicial vencida: "Senha inicial expirada. Peça ao almoxarifado para redefinir o seu acesso.".

  Como roda também na renovação, quem é inativado perde o acesso em até 1 hora, mesmo com o app aberto.
- **Cadastro aberto:** hoje o `config.toml` deixa qualquer pessoa com a chave pública criar conta. Isso é desligado na fase A, aqui e no painel do Supabase. Usuário novo só entra pela Edge Function `colaboradores`.
- **Login no web:** passa a ser pela matrícula também. Os usuários atuais recebem matrícula no cadastro antes da troca.
- **Edge Function `colaboradores`:** faz o que mexe no Auth, com a `service_role`, que fica só na função e nunca no app. Antes de cada ação, chama uma RPC com o token de quem pediu, e é a RPC que confere a permissão e os dados.

  | Ação | RPC antes | Depois, no Auth |
  |---|---|---|
  | Criar | `rpc_validar_colaborador` devolve os dados conferidos | cria o usuário com a senha padrão e os dados em `app_metadata`; o perfil nasce pronto, com a senha inicial pendente |
  | Redefinir senha | `rpc_preparar_redefinicao_senha` liga a pendência | volta a senha para a padrão |
  | Excluir | `rpc_preparar_exclusao_colaborador` recusa quem já foi usado | apaga o usuário |

  Editar nome e matrículas e inativar não mexem no Auth: são feitos direto por `rpc_salvar_colaborador`.
- **O que a gestora mantém:** colaboradores com papel operador que não são gestão do almoxarifado. Ela não mexe em admin, gerência, outra gestora nem em si mesma, e não muda papel. O admin mantém todos.

### Aba de administração no web (gestora e admin)

**Colaboradores:**

- criar, editar, redefinir senha, vincular ou desvincular de equipe;
- inativar, o que bloqueia o login e tira a pessoa da equipe;
- excluir só quem nunca teve movimentação (regra 7: nada usado é apagado).

**Equipes:**

- criar, editar, inativar;
- definir grupo, frota e membros;
- editar os locais liberados.

**Grupos (só o admin):** definir o supervisor de cada grupo.

### Membros das equipes (supervisor, no app e no web)

- O supervisor vincula a uma equipe dele um colaborador ativo que esteja sem equipe.
- Pode desvincular um membro, com data de fim em `equipe_membros`.
- Pode mover um membro entre equipes do próprio grupo.

**Alerta de equipe com mais de 2 membros:** o padrão de trabalho é em dupla. A regra não bloqueia, só avisa:

- **Ao vincular o terceiro membro**, o app e o web mostram "Esta equipe vai ficar com 3 membros. O padrão é dupla. Confirme para continuar.".
- **Enquanto a equipe tiver mais de 2 membros**, ela aparece em destaque no Início do supervisor e na lista de equipes da gestora no web.

O limite de 2 fica em `configuracoes`, para poder mudar sem alterar código. A confirmação volta do banco com o código de erro `WF001`, que o app e o web transformam na pergunta.

- A operação é feita por RPC com checagem de permissão (erro `42501` fora do grupo). Não passa pela Edge Function, porque não mexe no Auth.
- Mudar um membro para equipe de outro grupo é só com a gestora ou o admin.

Para a carga inicial, as equipes são importadas da planilha "Atualização PO x ZEUS" (supervisor, zeus, equipe, frota). Linhas sem supervisor, com #N/A, marcadas "não lançar" ou duplicadas entram como inativas.

Uma equipe com saldo não pode ser inativada. A mensagem de erro manda transferir ou devolver o material antes.

## 6. App Android

### Técnica

- **App:** Expo (SDK estável mais recente), expo-router e TypeScript.
- **Dados:** supabase-js com a sessão guardada no `expo-secure-store`, e TanStack Query para leitura.
- **Só online:**
  - Sem conexão, as telas mostram "Sem conexão. Conecte-se à internet e toque em Tentar de novo.".
  - Nenhuma ação é guardada para depois.
  - Toda ação só aparece como feita depois que a RPC responde.
- **Distribuição:**
  - O APK é gerado pelo EAS Build com perfil interno, sem Play Store.
  - Correções de JavaScript chegam pelo EAS Update.
  - Pacote proposto: `com.engelmig.warefly`.
- **Notificações push** (Expo Notifications, disparadas por Edge Function):
  - nova REQ- para o supervisor;
  - TRF- a confirmar para quem recebe;
  - REQ- analisada para a equipe.
- **Visual:**
  - Os tokens vêm do `design-system/`. Um script gera um arquivo TS a partir do CSS, que continua sendo a fonte da verdade.
  - Fonte Manrope.

### Estrutura no repositório (npm workspaces)

| Pasta | Conteúdo |
|---|---|
| `app/` | web, como hoje |
| `mobile/` | app Expo |
| `pacotes/regras/` | regras puras hoje em `app/src/lib` (perfis, formato, id…), usadas pelo web e pelo app. A mudança é feita num passo próprio, só movendo arquivos, sem alterar código. |
| `pacotes/tokens/` | tokens gerados do design system |

### Telas: membro de equipe

| Tela | Conteúdo |
|---|---|
| Início | saldo do meu carro, transferências a confirmar, minhas requisições em andamento |
| Estoque da base | bases liberadas para a equipe, com busca |
| Nova requisição | busca de material, quantidade, observação |
| Minhas requisições | situação de cada item: aprovado, reduzido com motivo, na base, entregue |
| Meu consumo | o que a equipe gastou por dia, com busca por data, número ou tipo de serviço, e detalhe por serviço |
| Transferir | para outra equipe ou devolver à base |
| Receber | confirmar, recusar ou informar divergência |

### Telas: supervisor

| Tela | Conteúdo |
|---|---|
| Início | requisições a analisar, transferências paradas, bases com material abaixo do mínimo, equipes com mais de 2 membros |
| Bases | estoque de cada base dele |
| Equipes | estoque de cada carro, movimentação da equipe (transferências, envios, devoluções, consumo) com filtro por período e material, membros com vincular e desvincular |
| Analisar requisição | por item: aprovar, reduzir ou recusar; atender da base ou pedir ao 211 |
| Consumo | gasto de material por dia, com escolha de data ou período, por equipe ou grupo inteiro, e detalhe dos serviços do dia |
| Solicitações | SOL- abertas, anexar requisições, criar nova |
| Enviar para equipe | TRF- da base para a equipe |

### Testes

| O quê | Como |
|---|---|
| RPCs e RLS | pgTAP |
| Regras compartilhadas e lógica do app | Vitest |
| Telas novas do web | Playwright |
| Edge Functions | Deno test |
| E2E no Android | Maestro. O Playwright não roda app nativo. Precisa de aprovação. |

## 7. Fases

Cada fase tem plano próprio, testes e parada para validação.

| Fase | Conteúdo | Depende de |
|---|---|---|
| A. Colaboradores e acesso | matrículas, `equipe_membros`, supervisor do grupo, hook de token, Edge Functions `entrar` e `colaboradores`, login por matrícula no web, aba de administração no web | telas da spec de equipes por grupo (passos 2 e 3), para a parte web |
| B. Estoque da equipe | local `equipe`, TRF- (base↔equipe, equipe↔equipe) com confirmação, telas no web | A |
| C. App: base e consultas | projeto Expo, workspaces, tokens, login, troca de senha, telas de estoque, receber e transferir | B |
| D. Requisições | REQ-, análise do supervisor, anexar à SOL-, push | C e fase 2 do web |
| E. Consumo diário | RPC de baixa por serviço, registro das execuções, alertas de negativo, tela de pendências no web, consultas de consumo | B. A automação que busca os serviços tem spec própria; a fase E prepara o banco e as telas para recebê-la. |
| F. Operador | módulo compacto de saída e consulta | D |

## 8. Pontos em aberto

1. **Base ou 211 (D8), pendente:** ainda não há o limite mínimo nem a média de material que cada base deve ter. Precisa ser definido por base e por material antes de o app sugerir entre atender da base ou pedir ao 211. Até lá, o supervisor vê o disponível na base e decide sem sugestão.
2. **Automação de consumo:** ainda não foi criada. Precisa de spec própria (fonte dos serviços, agendamento, falhas).
3. **Código do ramal:** o número de material SAP do ramal, para receber a marca `consumo_estimado`.
4. **Matrículas dos atuais:** matrícula dos usuários atuais do web antes de trocar o login. As matrículas já gravadas no remoto que não forem só números precisam ser corrigidas antes de aplicar a fase A.
5. **Ferramentas:** Maestro para E2E e o nome do pacote `com.engelmig.warefly`.

## 9. Fora do escopo

- Uso offline.
- iOS.
- 3256 no sistema.
- Leitura de código de barras no app (pode entrar na fase F).
- Integração com o SAP.
