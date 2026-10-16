# Estorno Pix pelo gestor

## Causa

O formulário do gestor chamava `/api/pagamentos/estorno`, que aceitava apenas lançamentos manuais e recusava qualquer reserva com transação online. O cancelamento do gestor registrava a intenção de cancelar, sem solicitar devolução ao provedor. A interface anunciava sucesso mesmo para HTTP 202 (cancelamento pendente).

## Comportamento implementado

- As telas Pagamentos e Reservas consultam o saldo online e mostram os horários envolvidos antes da confirmação.
- O administrador pode solicitar a devolução **integral do saldo online restante**. Para pedidos agrupados, todos os pagamentos online confirmados do grupo são considerados; o valor exibido exige confirmação e é revalidado no servidor. Devolução parcial online pelo formulário não está implementada.
- A conta Mercado Pago utilizada é a da arena. O lançamento negativo só acontece após resposta aprovada com pagamento e valor correspondentes.
- Timeout ou resultado divergente deixam o pedido pendente e preservam a chave de idempotência. Uma recusa HTTP na reconciliação não autoriza trocar a chave de uma tentativa anterior ambígua.
- Duplicidade, concorrência e aprovação antiga não devem duplicar a saída nem restaurar dinheiro devolvido.
- Cancelar e devolver são ações distintas: o gestor solicita o cancelamento e usa Estornar para devolver o valor. O cancelamento pendente é concluído quando não houver valores recebidos ou cobranças em aberto. Tela e e-mail informam a pendência corretamente.
- Após devolver a parte online, um eventual saldo manual pode ser devolvido e registrado manualmente.
- O histórico financeiro converte centavos para reais na interface.

## Evidência e limites

Os testes `backend/tests/manager_refund.test.js` exercitam criação de Pix como cliente, aprovação, prévia, solicitação pelo administrador, cancelamento, grupos, isolamento entre arenas, repetição, concorrência, perda de resposta, credencial ausente, resposta divergente, devolução parcial anterior no provedor e saldo manual remanescente. O provedor é simulado; o SQLite é em memória. Os testes `frontend/tests/ManagerRefund.test.tsx` exercitam o formulário e mensagens.

Validação realizada: 13 cenários novos de backend e 4 de interface aprovados; suítes relacionadas de pagamentos, gateway, ciclo financeiro, reservas, concorrência, estatísticas de cancelamento e reconciliação também passaram. TypeScript, lint e build do frontend passaram. O build mantém o aviso de bundle acima de 500 kB. Health check da API local retornou HTTP 200.

Referência do contrato: [Mercado Pago — criação de devolução em Payments API](https://www.mercadopago.com.br/developers/en/reference/online-payments/checkout-api-payments/create-refund/post).

Ainda é necessário validar uma compra Pix e sua devolução no ambiente do provedor, conferindo o recebimento efetivo pelo pagador, webhook, lançamentos, saldo e liberação do horário. Nenhum pagamento ou estorno externo foi executado durante esta correção. Os testes locais não são evidência de homologação financeira externa. O diagnóstico anterior em `PLANO_CORRECAO_PIX_2026-10-09.md` continua relevante para a configuração do ambiente de homologação.
