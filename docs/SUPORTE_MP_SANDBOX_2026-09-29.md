# Diagnóstico de homologação Mercado Pago — 29/09/2026

Este texto está pronto para envio pelo responsável ao suporte de integrações.
Nenhuma mensagem foi enviada automaticamente. Não anexar `.env`, tokens ou
arquivos privados. Informar o identificador da aplicação somente no atendimento
autenticado, caso solicitado.

## Texto para o chamado

Estamos homologando Checkout API / Checkout Transparente **via Payments API**,
com credenciais TEST de conta brasileira. O produto foi conferido no painel.
A consulta autenticada `GET /users/me` retorna HTTP 200.

Usamos os cartões fictícios publicados na documentação brasileira atual,
nomes APRO e OTHE, CPF fictício informado pela documentação, vencimento 11/30,
uma parcela e R$ 100,00. E-mail sintético do comprador: `comprador@example.com`.

O componente utiliza `https://sdk.mercadopago.com/js/v2`, `cardForm` com
`iframe: true` e chave pública TEST. As consultas de métodos de pagamento,
documentos e parcelas retornam HTTP 200. A tokenização dos campos hospedados
retorna HTTP 201 para Visa e Mastercard. O Access Token não vai ao navegador.

Ao criar a cobrança via `POST /v1/payments`:

- Com o `issuer_id` retornado pelo SDK, a API responde HTTP 400, causa **10111**,
  indicando que o BIN não está configurado para o emissor enviado.
- Sem `issuer_id` (comparação diagnóstica com novo token Visa), responde HTTP 400,
  causa **10113**, informando que o método de pagamento foi excluído por regra.
- APRO e OTHE falham antes de retornar um pagamento aprovado ou recusado.
- Antes, a tokenização pela API de servidor, sem emissor, também retornava 10113.

Podem identificar a regra e a configuração de BIN/emissor aplicada ao sandbox
desta aplicação e orientar o ajuste necessário? As credenciais TEST são aceitas
e os tokens são gerados, mas não conseguimos criar os pagamentos fictícios.

### Requisições para rastreamento

Todos os horários abaixo são de 29/09/2026, UTC−03:00 (Brasília).
Os IDs são os `x-request-id` retornados pela API, não tokens de autenticação.

| Início do ensaio | Cartão/cenário | Resultado | x-request-id da criação |
| --- | --- | --- | --- |
| 13:27:01 | Visa APRO, emissor 25 do SDK | 400 / 10111 | `329268e1-9a88-4de8-a3a4-c66f89c4cde3` |
| 13:27:01 | Visa OTHE, emissor 25 do SDK | 400 / 10111 | `e79476ad-a930-47af-9d44-5a10f646d74a` |
| 13:27:50 | Mastercard APRO, emissor do SDK | 400 / 10111 | `9b2ecc16-7e50-49a4-8562-4eb9716eabbf` |
| 13:27:50 | Mastercard OTHE, emissor do SDK | 400 / 10111 | `360bd670-05c0-46c0-bbe6-fcf267c55598` |
| 13:28:38 | Visa APRO, sem emissor | 400 / 10113 | `5cfaa774-3ee0-4bc3-b9bd-030d69f5a5c8` |
| 13:28:38 | Visa OTHE, sem emissor | 400 / 10113 | `7ff19e2b-bcb8-4ee3-86be-cafec1897ee5` |

Referências utilizadas:
[cartões de teste](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-payments/additional-content/your-integrations/test/cards),
[compra de teste](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-payments/integration-test/make-test-purchase)
e [SDK oficial](https://github.com/mercadopago/sdk-js).

## Reprodução local e limites das evidências

```powershell
node backend/scripts/check_payment_lifecycle_sandbox.js --browser
node backend/scripts/check_payment_lifecycle_sandbox.js --browser --mastercard
node backend/scripts/check_payment_lifecycle_sandbox.js --browser --omit-issuer
```

Cada execução usa banco em memória, credenciais TEST existentes, abre navegador
sem janela visível e preserva relatório separado em `.local-security/homologacao`.
Não repetir sem uma mudança ou orientação que justifique nova tentativa.
Os relatórios de referência são `lifecycle-2026-09-29T16-27-01-646Z.json`,
`lifecycle-2026-09-29T16-27-50-656Z.json` e
`lifecycle-2026-09-29T16-28-38-490Z.json`.

As primeiras duas execuções de navegador pararam na seleção de campos da automação,
antes de cobrança. O seletor foi ajustado para os inputs visíveis dos iframes;
essas falhas não eram do formulário do produto.

Nenhuma alteração foi feita nas regras de cobrança do produto nesta continuação.
O parâmetro `--omit-issuer` afeta só o ensaio diagnóstico. A tokenização do componente
está comprovada; checkout completo, aprovação, recusa bancária, webhook público,
recuperação e estorno externos continuam sem aprovação. As falhas observadas não
determinam por si só se a causa final está na aplicação, nas credenciais ou no
cadastro interno do sandbox; a identificação da regra depende de evidência adicional.
