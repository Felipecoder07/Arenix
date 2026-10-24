# Indicadores da tela Pagamentos

- API e banco mantêm valores em centavos inteiros. A tela converte para reais ao receber os dados, inclusive listas, histórico, formulários e exportação.
- Recebido hoje/na data: soma dos lançamentos de caixa na data do pagamento, com estornos negativos na data em que foram registrados. Não usa a data da reserva.
- Recebido no mês: mesma regra para o mês atual. Os limites usam o fuso APP_TIMEZONE, cujo padrão é America/Sao_Paulo.
- Cancelar uma reserva não apaga seu movimento de caixa. Somente um estorno registrado reduz o recebido.
- Pendente hoje/na data: saldo positivo das reservas não canceladas agendadas para aquela data.
- Inadimplência: saldo positivo de reservas não canceladas cujo horário de término já chegou. Reservas futuras não entram neste indicador.
- Abas, contagens e listagem usam o saldo dos lançamentos efetivos, inclusive pagamentos parciais e estornos, sem depender exclusivamente do status de pagamento armazenado.
- O filtro de data altera os dois cartões diários e a lista de reservas. Recebido no mês e inadimplência continuam globais para a arena.
- Reservas canceladas não geram pendência ou inadimplência. Cada consulta restringe os dados à arena autenticada.
- Cancelamentos aguardando estorno também não geram dívida do cliente; continuam disponíveis na listagem para concluir a devolução.

Essas correções não alteram lançamentos financeiros existentes.

## Confirmação de Pix no painel gestor

- Com Mercado Pago conectado, a tela acompanha a referência da cobrança atual. Um pagamento parcial anterior não confirma uma nova cobrança.
- A consulta verifica o provedor para cobranças online conhecidas com intervalo mínimo de cinco segundos, além do processamento de webhook. Uma confirmação válida é lançada uma única vez.
- Sem integração, o QR usa a chave Pix da arena e exige conferência do crédito no banco. A tela informa essa condição e permite registrar o recebimento manualmente como Pix após a conferência.
- QR estático não recebe confirmação automática do banco. Conectar a integração permite gerar novas cobranças online; isso não transforma um QR estático já emitido em cobrança integrada.
