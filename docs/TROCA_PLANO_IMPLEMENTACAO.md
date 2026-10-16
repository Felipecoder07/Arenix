# Troca de plano — implementação em 15/10/2026

## Regra financeira aprovada

Cobrança integral do novo ciclo: mensal ou anual (12 vezes o preço mensal do
contrato anual cadastrado no servidor). Não há desconto anual presumido nem
cálculo proporcional. A confirmação informa que o novo ciclo substitui o período
anterior, sem crédito automático pelo período já pago.

O plano, o ciclo e os limites só mudam quando o pagamento é confirmado. A vigência
começa nessa confirmação; a fatura recebe o início e o fim do novo ciclo, o dia de
vencimento é alinhado e o trial é encerrado. Confirmações repetidas não estendem o
período novamente.

## Comportamento implementado

- Catálogo obtido exclusivamente do servidor, com erro e nova tentativa quando
  indisponível ou inválido. Removidos planos de exemplo e desconto fixo de 20%.
- Confirmação com plano atual, escolhido, ciclo, total e condição de ativação.
- O total confirmado é enviado em centavos para comparação com o preço calculado
  no servidor. Alteração de preço exige consultar e confirmar novamente.
- Enterprise segue para consultor e não permite contratação pela API de troca.
- Validação de permissão, capacidade, preço e faturas em aberto. A capacidade e o
  preço são revalidados dentro da transação que cria ou reutiliza a fatura.
- Repetição reutiliza a fatura pendente; plano e ciclo já ativos não geram outra
  cobrança de troca. Pix expirado ou falha de geração permitem retomar a fatura.
- Assinatura recarrega os dados após pagamento; Quadras e Usuários consultam o
  mesmo plano atualizado no servidor ao abrir suas telas.

## Validação

- 72 testes existentes: upgrade, calendário, regressões de liquidação e Pix.
- 8 testes existentes de adiantamento de faturas.
- 11 testes novos de troca integral: mensal/anual, vigência, idempotência,
  concorrência, capacidade, downgrade, permissões, preço desatualizado,
  Enterprise, expiração e retomada após falha de geração.
- 2 testes de interface: falha e recuperação do catálogo, confirmação do total,
  ausência de contratação antes de confirmar e atualização após pagamento.
- Verificação TypeScript do frontend.

## Homologação externa pendente

A consulta de credenciais retornou HTTP 200 e confirmou a identidade configurada.
Isso não certifica o fluxo de pagamento.

Foi criada a instância isolada `troca-plano-20261015`. O controle Pix não enviou
cobrança porque falta `MERCADO_PAGO_TEST_BUYER_EMAIL` (e-mail explícito da conta de
comprador de teste). Após configurar esse dado, ainda é necessário validar
emissão, pagamento e confirmação real pelo provedor. A homologação completa não
está aprovada.
