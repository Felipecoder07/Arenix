# Plano de implementação das correções Pix

Data: 10/10/2026. Atualização de 12/10: correções locais implementadas e validação final aprovada; homologação externa e conciliação histórica pendentes.

## Registro de execução

Atualizar este registro ao concluir e validar cada tarefa. Os itens ainda não marcados abaixo continuam pendentes de conclusão ou validação.

- [x] **B1 — Contrato de erros implementado:** `paymentProviderError.js`, transporte e logger financeiro com campos permitidos. Recusa 2034 da primeira tentativa, indisponibilidade e resposta inválida possuem categorias distintas.
- [x] **C1 — Bloqueio de reemissão incerta implementado:** `paymentIntentService.js` mantém a chave original e deixa a recuperação a cargo da consulta. O tratamento de falha preserva estado confirmado.
- [x] **C2 — Persistência de criação Pix implementada:** validação de identidade/valor/referência, transação local e diagnóstico separado do cache de QR. Migração aditiva em `pixDiagnostics.js`.
- [x] **D1 — Retomada pública corrigida:** consultar Pix não chama mais emissão. A resposta de reserva criada contém estado e erro público do pagamento.
- [x] **D2 — Tentativas SaaS implementadas:** `saasPixService.js`, recuperação por referência, conta master e preservação de cobranças históricas.
- [x] **Verificação intermediária:** 73 testes passaram em `gateway`, `reconciliacao_outbox`, `manager_refund` e `saas_final_review`, após o primeiro conjunto de alterações. Alterações posteriores continuam sujeitas à validação final.
- [x] **A1 — Instância selecionável e manifesto:** código e testes de isolamento/manifesto aprovados na rodada de 10/10. Preparação efetiva registrada separadamente abaixo.
- [x] **B/C — Casos novos de regressão:** testes de erro, recusa, ambiguidade, concorrência, consulta e recuperação passam na suíte final do backend (517 testes na rodada concluída).
- [x] **D3 — Interfaces e consulta orientada ao usuário:** implementadas em 12/10 nas telas de reservas, pagamentos, assinatura e atleta; endpoints autenticados consultam a tentativa existente. Testes do componente nas duas interfaces aprovados: consulta explícita, recusa, expiração, bloqueio de consulta simultânea, preservação do QR em falha temporária e confirmação. Tipos das duas interfaces aprovados. Validação geral registrada separadamente em G1.
- [x] **F1 — Infraestrutura local de Relay/OAuth de teste:** implementada e coberta pelos testes de isolamento, destino, credencial e identidade da conta. O fluxo OAuth externo permanece pendente da configuração adiada pelo responsável.
- [x] **G1 — Validação completa:** `npm.cmd run validate` passou em `artifacts/homologacao/2026-10-12T16-52-44-449Z/summary.json`. Dez etapas passaram e `sourceUnchanged: true`; manifesto corresponde ao código validado.
- [ ] **E/F — Evidências externas:** ainda não houve nova cobrança ou estorno externo nesta implementação.
- [x] **C3 — Inventário histórico local:** auditoria somente de leitura executada em 12/10; uma tentativa Pix de reserva já paga, 14 faturas abertas (12 sem referência). Relatório `artifacts/pix/2026-10-12T16-32-55-638Z-legacy-audit.json`; hash do banco inalterado. Ausência de referência não autoriza reemissão. A conciliação financeira externa desses registros permanece pendente.
- [x] **A2 — Instância efetiva:** `pix-20261012`, porta 3120, preparada a partir dos arquivos atuais com manifesto; banco novo inicializado, integridade de chaves estrangeiras aprovada, sem cron/SMTP.
- [x] **A3 — Snapshot final:** `pix-20261012-final`, porta 3120, preparado após as correções da retomada. Manifesto inclui código, testes e configuração de build, além das dependências instaladas. Inicialização e integridade do SQLite aprovadas. O primeiro snapshot permanece preservado.
- [x] **C4 — Backup e ensaio da migração:** backup consistente pela API SQLite com origem aberta somente para leitura; migração Pix executada duas vezes em cópia privada. Integridade `ok`, nenhuma violação de chave estrangeira, registros financeiros inalterados, 25 faturas históricas preservadas e banco original inalterado. Evidência: `artifacts/pix/migration-rehearsal.json`; script repetível: `artifacts/pix/rehearse-migration.cjs`. A migração no banco usado pela aplicação ocorrerá pelo fluxo normal de inicialização; não foi forçada nesta sessão.
- [x] **G1a — Backend final:** 517 testes aprovados em 51 suítes na validação de 12/10, relatório `artifacts/homologacao/2026-10-12T16-44-27-724Z/backend-tests.log`.
- [x] **G1b — Interfaces:** 109 testes em 23 suítes no painel e 34 em 7 na tela do atleta; tipos, builds e lint das duas interfaces aprovados.
- [x] **G1c — Revalidação após o controle externo:** `npm.cmd run validate` aprovado em 13/10/2026 UTC, 10 de 10 etapas, `automatedPassed: true`, `sourceUnchanged: true` e `productionApproved: false`. Relatório: `artifacts/homologacao/2026-10-13T02-57-35-505Z/summary.json`. O controle externo HTTP 500 continua incerto e não foi convertido em aprovação de produção.

**Como ler os checklists abaixo:** em 12/10 várias caixas detalhadas ficaram desatualizadas após implementar o código. Foram sincronizadas com a evidência local. Os critérios locais e a validação automatizada completa passaram. Permanecem abertas a homologação financeira/OAuth externa, implantação em produção e conciliação financeira histórica. Não estão marcadas como concluídas tarefas sem evidência.

### Encerramento da implementação local em 12/10

O responsável pediu primeiro encerramento breve por limite de tokens. Na continuação da revisão, sincronizei as caixas detalhadas que haviam ficado desatualizadas e concluí a validação completa. A suíte do atleta teve um timeout isolado de cinco segundos; configurei execução sequencial e timeout de 15 segundos, e então as sete suítes passaram.

Validação final: **`npm.cmd run validate` aprovado**, 10 de 10 etapas, `sourceUnchanged: true`; 660 testes (517 backend, 109 painel, 34 atleta), typechecks, builds, lint e ativos públicos aprovados. Relatório: `artifacts/homologacao/2026-10-12T16-52-44-449Z/summary.json`. Snapshot validado: **`pix-20261012-final-v2`**, SHA-256 **`70efd465049c54702ff7dab573101f4bba14439edf960771c0d8f0190977b1e4`**, manifesto comparado com os arquivos atuais. Banco isolado inicializado e chaves estrangeiras válidas; migração ensaiada em cópia. Snapshots anteriores preservados. Nenhuma cobrança externa criada. Configuração master/OAuth e resolução comprovada do erro 2034 continuam adiadas; não há aprovação externa.

Checkpoint de continuidade: arquivos locais anteriores foram preservados; não houve reset, checkout ou substituição pelo Git. A nova tabela de tentativas SaaS é `SaasPixAttempts`; a tabela antiga permanece preservada. Testes usam banco em memória. Interface, outbox, validação geral e nova instância já foram concluídas. Próximos passos: investigar o erro 2034 com a configuração TEST completa, homologar o ciclo financeiro/OAuth no provedor e conciliar individualmente os registros históricos.

Na retomada de 12/10, a presença de configuração foi conferida sem exibir valores: `backend/.env.homologacao` e o snapshot `pix-20261012-final-v2` possuem a credencial TEST da arena, mas não possuem credencial TEST master, client ID/secret OAuth, URI de retorno nem IDs das contas de teste permitidas. Portanto, ainda não há como executar os cenários externos de SaaS e OAuth. Não foi iniciada nova cobrança nem alterado o banco por essa conferência. A documentação atual do Mercado Pago continua distinguindo o Pix da Payments API (`/v1/payments`) do roteiro de testes Pix da Orders API (`/v1/orders`); o segundo não comprova aprovação ou estorno da integração existente.

Continuação de 12/10: o diagnóstico do Pix da arena pode usar a credencial TEST já presente, sem esperar a credencial master/OAuth. Foi identificado que a reserva de exemplo da instância isolada usava `comprador@example.com`, que não identifica uma conta de teste do provedor. O preparo da instância agora aceita `MERCADO_PAGO_TEST_BUYER_EMAIL` de `backend/.env.homologacao` e o verificador `--pix` exige o endereço explícito antes de enviar uma criação. Os 15 testes direcionados de `homologacao_instance.test.js` passaram. A identidade de comprador deve ser obtida em **Suas integrações > Testes > Contas de teste**, com país compatível com o vendedor; um endereço apenas sintaticamente válido não comprova que é conta de teste. É preciso criar um novo snapshot após preencher essa variável, preservando os anteriores. Nenhuma cobrança externa foi criada nesta etapa.

Controle externo de 12/10 às 23:54 BRT (13/10 UTC): com a credencial TEST da arena e uma hipótese de endereço formada a partir do nome de usuário de uma conta Comprador informada pelo responsável, foi enviada **uma única** criação de Pix de R$ 1,00 à Payments API, com referência e chave de idempotência persistidas antes do envio. O endereço hipotético não foi comprovado como e-mail real da conta de teste. A primeira execução não obteve resposta por falha de rede local; a mesma operação foi repetida com a mesma chave e recebeu HTTP 500, request ID `741189c2-5e7b-4b13-a588-2b3442ae5e26`, sem código de causa. Evidência privada: `.local-security/homologacao/pix-20261012-control-v2/pix-control-operation.json` e `provider-checks.jsonl`. Duas buscas somente de leitura pela referência retornaram HTTP 200 e zero resultados; evidência em `.local-security/homologacao/pix-20261012-control-v3/pix-control-reconciliation.json`. Busca vazia não prova ausência definitiva de pagamento. A operação permanece **incerta**; nenhuma nova chave ou cobrança deve ser criada com base nesse resultado. O erro 2034 original não foi reproduzido nem resolvido por esse controle.

Este plano usa como referência os arquivos atuais da pasta de trabalho, incluindo alterações ainda não commitadas. Detalha a execução do [diagnóstico de 09/10](PLANO_CORRECAO_PIX_2026-10-09.md). A criação deste documento não significa que as correções foram implementadas.

Objetivo: tratar corretamente recusas e resultados incertos, permitir diagnóstico sem expor dados sensíveis, preservar a consistência financeira e comprovar o fluxo de reservas e assinatura SaaS no provedor.

## 1. Situação verificada

| Ponto | Código atual | Resultado esperado |
|---|---|---|
| Erro de criação Pix | `gatewayService.js` lê a resposta de erro, descarta seus detalhes e lança `Error` genérico. | Registrar diagnóstico restrito e devolver uma mensagem pública adequada. |
| Estado da tentativa | O `catch` de `paymentIntentService.js` sempre grava `unknown`. | Diferenciar recusa comprovada, criação pendente, pagamento confirmado e resultado incerto. |
| Resposta HTTP | `gatewayRoutes.js` usa 500 quando o erro não possui status; há outros consumidores no checkout público. | Contrato consistente em todos os caminhos, sem perder o contexto da reserva já criada. |
| Cobrança SaaS | `saasBillingService.js` também descarta o detalhe da recusa. | Aplicar o mesmo contrato de diagnóstico e recuperação às faturas. |
| Logs | `safeLogger.js` registra apenas módulo, nível e alguns códigos internos. | Permitir campos financeiros previamente aprovados; passar um objeto arbitrário ao logger atual não resolverá o diagnóstico. |
| Homologação | Scripts usam uma pasta fixa; há geração de manifesto, mas a inicialização não o verifica. | Executar uma instância identificada pelos arquivos efetivamente copiados e validados. |
| Provedor | O diagnóstico registra erro 2034 sem causa específica comprovada. | Identificar a configuração responsável e comprovar criação, pagamento e devolução conforme os recursos do produto usado. |

Na revisão anterior desta sessão, as suítes `gateway.test.js`, `reconciliacao_outbox.test.js` e `manager_refund.test.js` passaram: 60 testes. Essa execução usa SQLite em memória e provedor simulado; não valida as mudanças futuras nem substitui evidência externa.

## 2. Regras obrigatórias da implementação

- Uma tentativa incerta mantém sua chave de idempotência, vínculo à conta recebedora e dados originais até conciliação. A repetição da mesma tentativa não pode mudar valor, pagador ou validade silenciosamente.
- HTTP 400 isoladamente não prova ausência de cobrança. Uma recusa em uma repetição também não prova que a primeira requisição, anteriormente incerta, falhou.
- Uma pesquisa sem resultados não libera automaticamente uma nova cobrança. Considerar atraso de visibilidade, conta consultada e limitações da consulta.
- Crédito exige confirmação autenticada do provedor e correspondência de valor, moeda, recebedor e reserva/fatura. Pix estático continua dependendo de confirmação manual.
- Atualizações concorrentes não podem transformar pagamento confirmado ou estornado em `unknown`/`pending` nem gerar um segundo crédito ou uma segunda reversão.
- Diagnósticos usam campos permitidos e valores limitados. Tokens, códigos OAuth, cabeçalhos completos, corpo bruto, nome, CPF e e-mail do pagador não entram em logs, relatórios públicos ou respostas de erro.
- Preservar as tentativas históricas. Correções de dados precisam de evidência por operação e trilha de auditoria.

## 3. Etapa A — Preparar uma homologação reproduzível

Arquivos: `backend/scripts/prepare_homologacao.js`, `run_homologacao.js`, verificadores `check_homologacao_*.js`, `configure_homologacao_webhook.js`, `relay_homologacao_webhooks.js` e, quando usado, `serve_homologacao_ui.mjs`.

- [x] Criar um resolvedor compartilhado para `--instance=<nome>`; cada execução usa uma pasta própria em `.local-security/homologacao/`. Validar o caminho resolvido e impedir referências fora dessa raiz.
- [x] Criar snapshot novo sem sobrescrever a instância antiga. Configuração, banco, porta, login de teste e evidências devem corresponder à mesma instância selecionada.
- [x] Gerar manifesto dos arquivos atuais em disco, incluindo fontes, scripts relevantes, configurações de build e lockfiles. Registrar hashes, Node e dependências; commit é informação complementar, pois a pasta tem mudanças locais.
- [x] Na inicialização, recusar arquivos ausentes, extras ou alterados no snapshot; também comparar com a pasta de trabalho e identificar dependências instaladas. Testes de manifesto/divergência passaram.
- [x] Banco da instância isolado; cron/SMTP não iniciados; usuários/reservas de teste criados. A conciliação real do provedor não foi executada e segue no checklist externo.
- [x] Instalação e execução são etapas separadas; manifesto registra lockfiles e hashes das dependências instaladas.
- [x] Seleção, divergência, isolamento e preservação do snapshot antigo cobertos por testes locais.

Aceite: o relatório identifica exatamente a versão executada; alterar um arquivo do snapshot impede iniciar; nenhum cenário escreve no banco habitual.

## 4. Etapa B — Definir erros e diagnósticos seguros

Arquivos: novo `backend/src/utils/paymentProviderError.js`, `providerHttp.js`, `safeLogger.js`, `security.js`, `gatewayService.js` e `saasBillingService.js`.

- [x] Criar erro estruturado com categoria interna, status remoto, códigos permitidos do provedor, identificador remoto quando disponível, referência local da operação e classificação do resultado (`definitive_rejection` ou `ambiguous`).
- [x] Capturar e sanitizar o diagnóstico antes de criar mensagem pública; JSON inválido, corpo vazio ou incompleto e falha de leitura têm testes locais.
- [x] Preservar a categoria de timeout/transporte através dos serviços, evitando que um novo `Error` apague os dados estruturados.
- [x] Log financeiro explícito com lista fechada de campos, limites/formato; os logs gerais continuam restritivos.
- [x] Classificação implementada: 2034 só encerra a primeira tentativa quando todos os códigos e ausência de ID confirmam a recusa; desconhecidos permanecem ambíguos.
- [x] Mensagens públicas usam o contrato registrado, sem expor mensagem ou corpo bruto do provedor.

Contrato proposto para falha na emissão:

| Condição | HTTP da aplicação | Código público | Ação permitida |
|---|---|---|---|
| Dado do pedido inválido, antes de enviar | 400 | `PIX_INVALID_REQUEST` | Corrigir os dados. |
| Recusa definitiva de configuração/conta comprovada | 422 | `PIX_PROVIDER_REJECTED` | Corrigir a configuração; nova tentativa depende do backend. |
| Outra tentativa em processamento ou resultado em conciliação | 409 | `PIX_RECONCILIATION_PENDING` | Consultar a operação existente. |
| Provedor indisponível ou limitando requisições | 503 | `PIX_PROVIDER_UNAVAILABLE` | Aguardar; se houver tentativa incerta, consultar primeiro. |
| Tempo de resposta esgotado | 504 | `PIX_PROVIDER_TIMEOUT` | Consultar a operação existente. |
| Resposta remota inválida/incompleta | 502 | `PIX_PROVIDER_INVALID_RESPONSE` | Conciliar antes de outra emissão. |
| Falha interna inesperada | 500 | `PIX_INTERNAL_ERROR` | Exibir referência local para atendimento. |

O status HTTP não decide sozinho o estado financeiro. Incluir `error`, `code`, uma referência pública opaca e `next_action` (`correct_configuration`, `check_payment` ou `retry_later`), calculado pelo backend. O código remoto detalhado fica no diagnóstico restrito.

Aceite: recusa conhecida, timeout e falha interna produzem diagnósticos distintos; testes confirmam ausência de segredos e dados pessoais mesmo quando o provedor os inclui em mensagens ou cabeçalhos.

## 5. Etapa C — Corrigir tentativas, repetição e conciliação

Arquivos: `paymentIntentService.js`, `gatewayService.js`, `paymentLedgerService.js`, `reconciliacaoOutbox.js`, `securitySchema.js` e migração incremental, se necessária.

- [x] Transições com updates condicionais/transacionais preservam aprovação e estorno confirmados durante a requisição; cobertas em testes de concorrência e regressão.
- [x] Diagnóstico fica separado do cache QR; cache inválido ou estado terminal nunca é tratado como Pix utilizável.
- [x] Referência, recebedor, fingerprint e hash são persistidos; snapshot de pagador só é mantido cifrado quando há chave. Tentativa incerta é consultada pela referência e nunca reenviada automaticamente.
- [x] Exclusão mútua é persistida no banco, inclusive entre processos; idade apenas libera consulta, nunca nova emissão.
- [x] Tentativa incerta não é reenviada. A consulta primeiro procura o pagamento original e resultado vazio/múltiplo fica pendente; nenhuma suposição sobre janela de idempotência é usada para autorizar nova chave.
- [x] Resposta remota é validada por ID, BRL, valor, recebedor e referência; transação/intenção são persistidas juntas, com recuperação pela referência quando o ID local se perde.
- [x] Uma recusa em retry não pode encerrar uma tentativa anteriormente ambígua. Uma nova tentativa só é aberta após confirmação de encerramento sem crédito e nova validação de saldo e disponibilidade da reserva.
- [x] Recuperação sem referência confere conta e dados antes de associar; zero, múltiplos ou divergência ficam pendentes/bloqueados.
- [x] Diagnóstico restrito ao gestor da própria arena; estado, contagem, última e próxima consulta disponíveis. Outbox sinaliza tentativas antigas sem resolução.
- [x] Auditoria somente leitura feita nas bases local e isolada. Estados e registros antigos foram preservados; decisões financeiras individuais seguem pendentes de evidência externa.

| Evento confirmado | Transição/regra |
|---|---|
| Cobrança criada, aguardando pagamento | `creating → pending`, com referência e QR válidos. |
| Recusa definitiva da primeira tentativa, sem ambiguidade anterior | `creating → failed`, com diagnóstico preservado. |
| Timeout, resposta incompleta ou falha de persistência após envio | `creating → unknown`; conservar identidade da tentativa. |
| Provedor confirma pagamento pendente | `unknown → pending`. |
| Provedor confirma aprovação | `creating/pending/unknown → paid`, crédito único. |
| Provedor confirma rejeição/cancelamento final sem pagamento | Encerrar como `failed` após verificar estado e lançamentos. |
| Falha tardia após webhook de aprovação | Preservar `paid`. |
| Aprovação antiga depois de estorno confirmado | Preservar a reversão e impedir novo crédito. |

Aceite: nenhuma corrida ou recuperação libera segunda cobrança de resultado incerto; recusas comprovadas não ficam eternamente pendentes; falhas de persistência são recuperáveis.

## 6. Etapa D — Aplicar o contrato ao SaaS e às interfaces

Arquivos: `saasBillingService.js`, `saasSettlementService.js`, `tenantAssinaturaRoutes.js`, `gatewayRoutes.js`, `publicController.js`, `AdminPagamentos.tsx`, `AdminReservas.tsx`, `AdminAssinatura.tsx`, `tela cliente/src/App.tsx` e componentes de Pix envolvidos.

- [x] Contrato consistente nos endpoints Pix de emissão, consulta e retomada, mantendo o campo `error`.
- [x] Checkout público preserva a reserva e distingue resultado de emissão e estado de pagamento.
- [x] Interfaces oferecem consulta explícita de tentativa existente; resultado incerto não chama emissão de novo. QR transitório é mantido, QR expirado/encerrado é ocultado, confirmação exige estado pago.
- [x] Uma consulta de status deve consultar a tentativa atual. Criação ou repetição controlada precisa de ação explícita; rever os caminhos atuais de retomada que chamam emissão a partir de consulta.
- [x] QR válido permanece em falha transitória e some quando expira/encerra; gerar QR não representa confirmação.
- [x] `SaasPixAttempts` guarda a tentativa por fatura, valor, tenant e identidade do recebedor master, com migração aditiva ensaiada em cópia; a tabela histórica foi preservada.
- [x] Referências antigas não são trocadas sem conciliação; novas tentativas fixam chave, payload e validade. Tentativa incerta não é reemitida.
- [x] Cobrir resposta perdida antes de salvar `gateway_ref` também no SaaS. Usar referência persistida recuperável para novas emissões e tratamento compatível para faturas antigas.
- [x] Validar conta master, BRL e valor; impedir troca de plano/valor ou eventos concorrentes de associarem uma cobrança à fatura errada. Pagamento não remove bloqueio manual indevidamente.
- [x] Regressões de estorno do gestor, operação SaaS, reserva em grupo, saldo manual e Pix estático estão nas suítes locais. Cobertura simulada não substitui homologação financeira externa.

Aceite: administrador e atleta entendem o estado e a próxima ação; uma falha no Pix não duplica reserva/fatura nem perde o vínculo da operação anterior.

## 7. Etapa E — Identificar e resolver a origem do 2034

Dependências: etapas A–D validadas localmente e acesso à configuração do provedor correspondente ao produto utilizado.

- [ ] Conferir aplicação, titular, permissões, credenciais e dados do pagador na Payments API; registrar a comprovação sem segredos. `/users/me` com HTTP 200 sozinho não conclui esse diagnóstico.
- [ ] Confirmar quais cenários Pix são suportados em teste para a conta e a integração presentes. O guia geral de compra teste inclui passos de cartão e não comprova, sozinho, aprovação/estorno Pix de teste.
- [ ] Criar uma requisição mínima de controle e uma pela aplicação, em operações distintas, com valor e recebedor conferidos. Registrar status, códigos, identificação da requisição e resultado de cada uma.
- [ ] Se ambas falharem, identificar e corrigir a configuração demonstrada ou reunir evidências sanitizadas para atendimento do Mercado Pago. Se apenas a aplicação falhar, corrigir a diferença comprovada no pedido enviado.
- [ ] Repetir após a correção e consultar a cobrança criada; confirmar valor, BRL, recebedor e ambiente. Preservar a mesma chave ao repetir a mesma operação.
- [ ] Documentar a causa e a correção aplicada. Se o provedor não oferecer um estado necessário no ambiente de teste, registrar o bloqueio e o caminho de validação restante.

Aceite: causa demonstrada e criação Pix confirmada pelo provedor. Trocar e-mail, CPF ou token por tentativa não constitui conclusão. Dinheiro real exige autorização específica; migração para Orders exige decisão própria.

## 8. Etapa F — Comprovar o ciclo financeiro e OAuth

- [ ] No relay da instância selecionada, permitir apenas os webhooks necessários e o GET exato de callback OAuth. Conferir método, rota, destino e limites; não registrar query strings com `code` ou `state`.
- [ ] Adaptar a proteção de rede para a troca OAuth esperada e para credenciais vinculadas a identidades de teste verificadas. Validar os destinos e o vínculo da conta antes de usar o token; o prefixo do token não é validação suficiente.
- [ ] Testar consentimento, vínculo à arena correta, armazenamento cifrado, state expirado/reutilizado, código reutilizado, outra arena e redirecionamento inválido. Validar a conta conectada como recebedora.
- [ ] Para reserva e SaaS, executar separadamente: criação, aprovação, repetição de webhook, concorrência, entrega atrasada, consulta indisponível, recuperação, cancelamento, estorno e aprovação antiga depois do estorno.
- [ ] Conferir lançamentos, saldo, disponibilidade do horário e estado da assinatura após cada caso. Repetição deve manter os mesmos totais; a assinatura deve preservar bloqueios manuais.
- [ ] Registrar versão por manifesto, cenário, horários, IDs técnicos, origem da evidência e resultado. Distinguir evento entregue pelo provedor, replay controlado e simulação local.

Aceite: cada cenário suportado possui evidência externa e resultado financeiro correto. Cenário indisponível permanece pendente com motivo; simulação local não muda seu status para homologado.

## 9. Matriz mínima de testes

| Grupo | Casos obrigatórios | Evidência esperada |
|---|---|---|
| Diagnóstico | 2034 controlado, 400 desconhecido, 401/403 remoto, 429, 5xx, corpo inválido, timeout e ausência de request ID | Categoria correta; HTTP público coerente; nenhum dado sensível exposto. |
| Recusa definitiva | Primeira tentativa recusada; correção dos dados e nova tentativa | Tentativa antiga preservada como falha; nenhuma baixa falsa. |
| Ambiguidade | Resposta perdida; erro depois da criação; recusa no retry; consulta vazia | Mesma identidade; nenhuma nova chave liberada sem resolução. |
| Persistência | Falha ao salvar transação/intenção, reinício, migração repetida | Recuperação com uma única cobrança e um único crédito. |
| Concorrência | Duplo clique, dois processos, consulta durante emissão, webhook antes da resposta, erro tardio | Estado confirmado preservado; saldo correto. |
| Cache/retomada | Erro armazenado, QR ausente/expirado, cobrança recuperada sem QR, recarga do navegador | Não retornar erro como cobrança válida nem emitir novo Pix por consulta. |
| Identidade | Outro tenant, conta trocada durante pendência, moeda/valor/recebedor divergentes | Associação e crédito bloqueados; diagnóstico disponível ao perfil autorizado. |
| Estorno | Total, parcial, resposta perdida, pedido repetido, evento atrasado, saldo manual e grupos | Reversão única do valor confirmado e disponibilidade correta. |
| SaaS | Chave existente, validade, resposta perdida, ciclo/plano, fatura alterada, bloqueio manual | Fatura e saldo corretos; sem desbloqueio indevido. |
| Interface | Recusa, espera, conciliação, consulta recuperada e confirmação manual | Mensagem e ação corretas, sem reserva/fatura duplicada. |
| Ambiente/OAuth | Manifesto divergente, pasta inválida, banco isolado, rota extra, replay e vínculo de conta | Execução e acesso somente quando válidos. |

Ampliar as suítes existentes de gateway, outbox, ciclo de pagamento, estorno do gestor, SaaS e fluxo funcional. Criar testes focados para classificação de erro, concorrência de intenção, scripts de homologação e mensagens de Pix nas duas interfaces. Cobrir especificamente as transições financeiras, sem depender apenas de mocks que reproduzam o código.

Validação durante a implementação: executar os testes da etapa alterada. Ao concluir as mudanças, executar `npm.cmd run validate` pela raiz, que cobre testes, tipos, builds, lint e ativos públicos. Registrar falhas preexistentes separadamente e corrigir regressões introduzidas. Atualizar o relatório de validação para incluir o manifesto, além do commit e indicador de alterações locais.

## 10. Entregas e ordem de execução

| Entrega | Dependência | Critério para concluir |
|---|---|---|
| A — Ambiente identificado | Nenhuma | Snapshot verificável e banco isolado. |
| B — Erros e diagnóstico | Nenhuma | Contrato e sanitização testados. |
| C — Tentativas e conciliação | B | Recusa e ambiguidade corretas; concorrência validada. |
| D — SaaS e interfaces | B e C | Todos os consumidores preservam operação e estado. |
| E — Causa do 2034 | A–D e configuração externa | Causa corrigida e criação comprovada. |
| F — Homologação financeira/OAuth | E e cenários externos disponíveis | Evidências por cenário e resultado financeiro consistente. |
| G — Fechamento | A–F | Verificações concluídas e pendências explicitadas. |

Na entrega G, atualizar o diagnóstico original, `HOMOLOGACAO_EXTERNA_2026-09-22.md` e `DEPLOYMENT_CHECKLIST.md` com evidências atuais. Manter status separados: implementação local concluída, testes locais aprovados e homologação externa concluída.

Para aplicar migrações em dados existentes: gerar backup consistente, ensaiar em cópia e usar alterações aditivas compatíveis com os registros antigos. Em falha após atividade financeira, interromper novas emissões e preservar registros/chaves para conciliação; restaurar um backup antigo sem reconciliar pagamentos posteriores pode perder fatos financeiros.

O fechamento exige tratamento de falhas comprovado, ausência de duplicação nos cenários testados, recuperação de operações incertas, versão executada identificada e evidências externas exigidas. Enquanto faltar um desses resultados, registrar exatamente o item pendente.

## Referências do provedor consultadas em 10/10/2026

- A integração Pix da Payments API documenta `/v1/payments`, idempotência e dados do QR: [Integrar Pix — Payments API](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-payments/integration-configuration/integrate-pix).
- O guia geral de testes descreve credenciais de teste e pagador, mas seus passos incluem cartão; a capacidade de homologar cada estado Pix precisa de confirmação específica: [Realizar compra teste — Payments API](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-payments/integration-test/make-test-purchase).
- O roteiro de Pix via Orders usa `/v1/orders`; seus procedimentos não devem ser aplicados automaticamente à integração atual: [Compra teste Pix — Orders API](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/integration-test/pix).

### Interrupção em 10/10 e retomada em 12/10

Em 10/10 o responsável solicitou interromper devido ao limite de contexto. Em 12/10 autorizou continuar. As correções centrais estavam no código e 119 testes direcionados haviam passado. A retomada concluiu a implementação da consulta nas interfaces e iniciou `npm.cmd run validate`. Nenhuma operação financeira externa havia sido executada até esse checkpoint.

**Resultado dos testes direcionados em 10/10:** 119 testes aprovados em 7 suítes (`gateway`, `saas_critical_regression`, `pix_correction`, `homologacao_instance`, `reconciliacao_outbox`, `saas_final_review`, `manager_refund`), duração de 27,66 segundos. Na execução anterior, `functional_e2e` e `athlete_auth` também passaram. Quatro falhas de fixtures foram corrigidas para incluir a identidade OAuth/recebedor SaaS exigida e retestadas.

**Configuração externa em 12/10:** credencial TEST da arena presente; credencial TEST master e configuração OAuth de teste ausentes. Solicitada configuração local ao responsável, sem compartilhamento de segredos no chat. Esses cenários externos permanecem pendentes.

O responsável respondeu “agora n”; a configuração externa adicional fica adiada. A consulta somente de leitura `/users/me` da credencial TEST existente retornou HTTP 200 e conta brasileira em 12/10; `test_user` ausente. Isso confirma autenticação, mas não a capacidade de emitir Pix. Nenhuma cobrança foi criada por essa consulta; erro 2034 e ciclo financeiro externo continuam sem comprovação de resolução.

**Histórico isolado:** `artifacts/pix/2026-10-12T16-39-11-032Z-legacy-audit.json` confirma as reservas 20010 e 20011 em `unknown`, sem referência, e a reserva 1 em `pending`. Banco antigo preservado; não houve reclassificação sem consulta ao provedor. A migração Pix nova não foi aplicada aos bancos existentes nesta rodada; foi exercitada nos bancos de teste e na instância nova.
