# Liberação do ciclo de pagamentos — 29/09/2026

**Continuação do Pix:** [PIX_LIBERACAO_2026-09-29.md](PIX_LIBERACAO_2026-09-29.md)
registra o estado vigente da reserva pública somente por Pix e seus critérios
externos ainda abertos. A investigação de cartão abaixo foi adiada.

**Escopo confirmado pelo responsável em 29/09:** o atleta pagará a reserva
somente por Pix no lançamento inicial. Cartão online está inativo e sua
homologação fica adiada; as falhas de cartão abaixo não bloqueiam a versão Pix.
A conferência somente leitura do banco habitual encontrou **0 arenas com
`gateway_public_key` preenchida**; no portal atual, a opção de cartão só aparece
quando a arena fornece essa chave. Isso confirma a inatividade local observada,
sem alterar código ou configuração.
A assinatura da arena para usar o sistema também utiliza Pix. O bloqueador de
pagamentos vigente é concluir a liquidação de Pix, suas notificações,
idempotência, recuperação após falha e cancelamento/estorno do Pix pago.

Consulta somente leitura de 29/09, 13:35 BRT: Pix TEST `1328247564` ainda
`pending`, `live_mode=false`, R$ 100, recebedor correto, 1 transação, 0 créditos.
Não declarar reserva paga com base em QR gerado ou webhook de pagamento pendente.
Evidência privada atualizada: `.local-security/homologacao/payment-check.json`.

As seções seguintes registram a investigação do cartão, preservada para quando
esse meio de pagamento for ativado.

Estado: **bloqueador aberto para produção**. Correções locais validadas;
o provedor ainda não permitiu completar o ensaio externo de cartão.

**Continuação, 13:23–13:29 BRT:** tokenização pelo componente React real com
campos hospedados do MercadoPago.js confirmada para APRO e OTHE, com Visa e
Mastercard fictícios. Com emissor retornado pelo SDK, criação falha com `10111`
(BIN não configurado para o emissor); na comparação sem emissor, falha com `10113`
(método excluído por regra). Não houve pagamento criado nem solicitação de estorno.
Diagnóstico pronto para suporte em [SUPORTE_MP_SANDBOX_2026-09-29.md](SUPORTE_MP_SANDBOX_2026-09-29.md).

## Correções desta etapa

- Aprovação imediata do cartão passa a conferir ID numérico, moeda BRL,
  valor em centavos e conta recebedora antes de registrar crédito. A verificação
  é compartilhada com o webhook. Divergência não autoriza baixa.
- Estorno parcial ou total recebido antes da aprovação registra o crédito
  verificado e a reversão na mesma transação SQLite. Repetições não duplicam
  lançamentos; pagamentos legados sem crédito conciliado continuam bloqueados.
- Confirmação de estorno solicitado pela aplicação também exige `payment_id`
  correspondente ao pagamento original, além de status e valor corretos.
- Alterações anteriores no formulário, nas rotas públicas e no tratamento
  de recusa foram preservadas.

## Validação local

Antes da correção, a nova suíte reproduziu sete falhas: quatro respostas de
cartão divergentes aceitas, estorno total/parcial antes da aprovação e estorno
com referência a outro pagamento. Após a correção, **103 testes passaram** nas
cinco suítes direcionadas:

```powershell
npm.cmd run test --prefix backend -- tests/payment_lifecycle.test.js tests/gateway.test.js tests/reconciliacao_outbox.test.js tests/security_concurrency.test.js tests/pagamentos.test.js
```

Os nove casos novos de `payment_lifecycle.test.js` incluem rejeição seguida de
nova tentativa aprovada, webhooks repetidos, falha transitória, recuperação pela
outbox e perda de resposta de estorno com reutilização da chave de idempotência.
Utilizam SQLite em memória e respostas controladas, sem rede externa.

Validação completa posterior: **364 testes aprovados em 39 arquivos**, incluindo
os testes de navegador existentes com provedor simulado. Relatório:
`artifacts/homologacao/payment-release-2026-09-29.json`. Comando:

```powershell
npm.cmd run test --prefix backend -- --reporter=default --reporter=json --outputFile=../artifacts/homologacao/payment-release-2026-09-29.json
```

`npm.cmd run check:local` também passou: banco habitual íntegro, zero achados
financeiros, quatro segredos legíveis e nenhuma migração pendente. Essa consulta
foi somente leitura. O banco habitual e a instância anterior de homologação
não foram alterados. Não foram repetidos builds/lint das interfaces nesta etapa.

## Ensaio externo desta etapa

Comando: `node backend/scripts/check_payment_lifecycle_sandbox.js`.

O script usa os serviços atuais, banco em memória e apenas o Access Token
`TEST-` já fornecido em `backend/.env.homologacao`. Não lê o banco habitual,
não modifica a instância anterior de homologação, não inicia cron nem envia
e-mails. Preserva um relatório por execução em `.local-security/homologacao`.
Sem `--browser`, tokenização é feita pela API. Na continuação foi implementado
`--browser`, que usa o componente `MercadoPagoCardForm.tsx` real em uma página
local isolada, SDK oficial e campos hospedados. O callback recebe o token e o
script chama o serviço atual de cobrança. Isso valida a tokenização do componente,
mas não o checkout completo do portal, sua rota HTTP ou a entrega pública de webhook.

Resultado em 29/09/2026, 13:17 BRT:

| Operação | Resultado |
| --- | --- |
| Consulta autenticada da conta | HTTP 200 |
| Tokenização Visa fictício APRO | HTTP 201 |
| Criação do pagamento APRO | HTTP 400, `bad_request`, causa `10113` |
| Pesquisa pela referência da intenção APRO | HTTP 200, nenhuma recuperação concluída |
| Tokenização Visa fictício OTHE | HTTP 201 |
| Criação do pagamento OTHE | HTTP 400, `bad_request`, causa `10113` |
| Créditos, pagamentos criados e estornos solicitados | Nenhum |

Evidência privada:
`.local-security/homologacao/lifecycle-2026-09-29T16-17-10-089Z.json`.
As intenções desse ensaio ficaram `unknown` somente no banco em memória;
os identificadores e resultados foram preservados no relatório.

O responsável confirmou que a aplicação está configurada para Checkout API /
Checkout Transparente. O código `10113` já apareceu na homologação anterior com
a descrição `The Payment Method is excluded by a rule.` A regra exata não foi
identificada. Essa falha de criação **não comprova uma recusa bancária OTHE**.

Dados fictícios e uso de credenciais TEST conferidos com a documentação oficial:
[compra de teste](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-payments/integration-test/make-test-purchase)
e [cartões de teste](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-payments/additional-content/your-integrations/test/cards).

## Critério que permanece aberto

1. Esclarecer a regra `10113` na aplicação/conta do Mercado Pago e conseguir
   pagamento fictício aprovado e pagamento fictício recusado.
2. Executar o formulário oficial no navegador e receber webhooks públicos do
   provedor para esses pagamentos, conferindo baixa, valores e conta recebedora.
3. Confirmar repetição, recuperação após falha e estorno no sandbox. O novo
   script prepara esses cenários, mas nesta execução não alcançou essas etapas.
   Suas notificações são assinadas localmente e consultam o provedor; elas não
   substituem a entrega pública de webhook pelo Mercado Pago.

Se for necessário acionar o suporte do provedor, informar produto Payments API,
horário acima, endpoint `POST /v1/payments`, HTTP 400 e causa 10113; informar
também que a autenticação e a tokenização passaram. Não enviar tokens, segredos,
cookies nem arquivos privados. Nenhuma mensagem ao suporte foi enviada.
