# Reserva do atleta com Pix — estado para liberação

Decisão do responsável em 29/09/2026: **reserva pública somente por Pix**.
A arena pode escolher nas configurações entre Pix pelo Mercado Pago e Pix pela
chave cadastrada. No modo automático, o Mercado Pago tem preferência quando
está conectado; caso contrário, a chave cadastrada gera o QR no checkout.
O Pix pela chave exige conferência e confirmação manual pela arena.
Cartão online fica adiado. O pagamento da assinatura da arena também já usa
Pix, mas sua homologação externa é uma etapa separada.

## Ajustes aplicados

- O formulário da reserva não mostra cartão por padrão, inclusive após a arena
  receber uma chave pública do Mercado Pago. Para ativá-lo futuramente serão
  necessárias duas configurações explícitas:
  `VITE_ENABLE_PUBLIC_BOOKING_CARD=true` no portal e
  `ENABLE_PUBLIC_BOOKING_CARD=true` na API, depois de homologação própria.
- A API recusa `payment_method=card` antes de criar qualquer reserva pública e
  bloqueia a rota de cobrança de cartão da reserva enquanto a opção estiver
  desativada. O registro administrativo de pagamentos presenciais não foi
  alterado.
- A API recusa reserva online antes de gravá-la se a forma de Pix escolhida
  não estiver configurada. O QR por chave Pix usa o valor e o identificador da
  reserva e fica salvo nela para permanecer igual mesmo se a arena trocar a
  chave depois; ele não gera webhook nem baixa automática.
- Se uma arena no modo Mercado Pago falhar ao gerar o Pix dinâmico, a API não
  troca de modo sem escolha da arena. Ela responde 202 com o ID da
  reserva e estado de cobrança em verificação; o portal mostra essa informação
  ao atleta. Ao reabrir uma reserva pendente, a API preserva o modo original.
  A reserva com Pix por chave permanece pendente até confirmação manual ou
  cancelamento pela arena; o prazo automático de 15 minutos vale para o gateway.

## Evidência disponível

- Testes dirigidos de checkout público, gateway, ciclo financeiro e outbox:
  **60 aprovados em 4 arquivos** em 29/09. Incluem uma arena com chave de cartão,
  reserva recusada antes da escrita e falha do Pix dinâmico sem QR substituto.
- TypeScript e build de produção do portal do atleta passaram. O teste de
  navegador do checkout Pix está registrado separadamente nesta execução.
- A verificação anterior, quando o checkout exigia Mercado Pago, passou em 21
  cenários dirigidos de API e navegador, 13 cenários de segurança e no typecheck
  do portal. A escolha por chave Pix desta revisão ainda não foi executada
  nesses cenários.
- Consulta GET ao pagamento TEST `1328247564` em 29/09, 13:40 BRT:
  `live_mode=false`, BRL, R$ 100, recebedor correto, status `pending`, uma
  transação, nenhuma baixa. Banco isolado íntegro, sem violação de chave
  estrangeira. Evidência privada atualizada:
  `.local-security/homologacao/payment-check.json`.
- Notificações públicas assinadas desse Pix foram recebidas e consultaram o
  provedor três vezes em 23/09. O pagamento já estava e continua pendente;
  esse ensaio não comprova liquidação.

## O que ainda falta para marcar o Pix como aprovado

1. Obter **um pagamento Pix aprovado** no mesmo modelo integrado pelo sistema,
   `POST /v1/payments`, e confirmar a baixa de valor e reserva corretos após
   consulta autenticada ao provedor.
2. Repetir a notificação de pagamento aprovado e provar que não cria segundo
   crédito. Ensaiar indisponibilidade temporária e recuperação da outbox.
3. Cancelar uma reserva paga com pagamento Pix fictício aprovado, verificar
   estorno confirmado pelo provedor e repetição sem segundo débito.
4. Validar esses fluxos com a implantação e os webhooks de produção no destino
   escolhido. A assinatura do SaaS precisa de ensaio externo próprio.

Os testes locais cobrem aprovação, repetição, falhas temporárias e estorno com
respostas controladas. Eles não criam um pagamento aprovado no Mercado Pago.
O ensaio oficial que aprova Pix automaticamente pela API de Orders usa
`/v1/orders` e credenciais `APP_USR`; o sistema atual usa `/v1/payments` e a
credencial TEST fornecida. Trocar apenas o script de teste não comprovaria o
fluxo de reservas deste código. Referências oficiais:
[Pix via Payments API](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-payments/integration-configuration/integrate-pix)
e [ensaio Pix via Orders](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/integration-test/pix).

Não pagar o QR TEST com banco real nem registrar aprovação por webhook simulado.
Sem pagamento aprovado no provedor, o critério externo de liquidação e estorno permanece aberto.
