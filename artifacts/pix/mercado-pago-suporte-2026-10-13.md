# Rascunho para suporte do Mercado Pago — Pix Payments API

Integração: Payments API (`POST /v1/payments`), credencial de teste, Brasil, Pix. Nenhum token, segredo ou dado pessoal está incluído neste rascunho.

Em 13/10/2026 às 02:54:42 UTC, uma tentativa de controle de R$ 1,00 retornou HTTP 500, sem código de causa. Request ID: `741189c2-5e7b-4b13-a588-2b3442ae5e26`. A referência externa e a chave de idempotência eram a mesma string: `cm-control-12eeecb1-a444-482a-b911-a8363db86447`. Uma primeira execução teve falha local de rede, e a repetição preservou essa chave e o mesmo corpo.

Consultas `GET /v1/payments/search` com a referência exata retornaram HTTP 200 e zero resultados às 02:55:58 e 02:56:25 UTC. Não interpretamos busca vazia como prova definitiva de ausência de cobrança; a operação está preservada como incerta. O e-mail do pagador foi uma hipótese no domínio de teste formada a partir de um nome de usuário TESTUSER, não um endereço confirmado pelo painel.

Solicitamos confirmar se o POST criou algum pagamento, explicar o HTTP 500 pelo request ID e informar o formato correto do `payer.email` para testar Pix na **Payments API** com essa combinação de credencial TEST da conta recebedora e comprador de teste. Também há duas tentativas anteriores, em 09/10/2026 às 02:38:31 e 02:39:24 UTC, recusadas com 2034 (`Invalid users involved`); precisamos identificar a combinação de contas/credenciais responsável antes de repetir a criação.

Evidências completas, com dados privados, permanecem em `.local-security/homologacao/` e não devem ser anexadas integralmente sem revisão.
