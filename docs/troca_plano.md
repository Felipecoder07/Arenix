O objetivo é deixar a troca de plano coerente entre a oferta exibida, a cobrança e os limites liberados para a arena.

1. Definir a regra de cobrança
   Minha recomendação é manter inicialmente a cobrança integral do novo ciclo, informando o valor e a vigência antes da confirmação. Se quisermos cobrar somente a diferença proporcional, será necessário implementar o cálculo e definir como aproveitar o período já pago.
2. Remover os dados de exemplo
   Buscar preços, nomes e limites exclusivamente no servidor. Se a consulta falhar, mostrar uma mensagem com “Tentar novamente” e impedir a contratação até carregar os dados reais.
3. Ajustar a confirmação da troca
   Exibir plano atual, plano escolhido, ciclo, valor total e quando a mudança entra em vigor. Corrigir a promessa de liberação imediata: os novos limites só serão aplicados após a confirmação do pagamento. Manter Enterprise claramente identificado como contratação por consultor.
4. Validar as regras no servidor
   Conferir permissões, capacidade da arena e faturas pendentes. Garantir que tentativas repetidas reutilizem a cobrança válida, sem duplicar faturas, e que o valor seja sempre calculado pelo servidor.
5. Concluir o fluxo de pagamento
   Tratar Pix expirado, falha na geração, nova tentativa e retomada de uma cobrança pendente. Após o pagamento confirmado, atualizar plano, vigência e limites, refletindo os dados nas telas de Assinatura, Quadras e Usuários.
6. Validar antes de liberar
   Testar upgrade, downgrade permitido e bloqueado, ciclo mensal/anual, falhas de consulta, cobrança duplicada e confirmação repetida do pagamento. Fazer também uma validação em ambiente de homologação do provedor.

Critério de conclusão: o preço confirmado deve corresponder à cobrança; o plano só deve mudar após pagamento confirmado; os limites devem refletir essa mudança; nenhuma falha pode apresentar dados fictícios ou gerar cobrança duplicada.

A primeira decisão é a regra financeira: cobrança integral do novo ciclo ou diferença proporcional. Ela precisa ficar definida antes de alterar o cálculo.