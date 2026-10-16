# Admin Master — controle de correções

Atualizado em 08/10/2026. Lista consolidada dos apontamentos anteriores, sem duplicações.

**Atualização após revisão adicional:** consultar [revisão final de 08/10](docs/REVISAO_FINAL_2026-10-08.md). Foram corrigidas falhas adicionais de pagamento/estorno/adiantamento, persistência e preços de quadras, vencimento e lint. Conciliação local aplicada com backup; arena 1 confirmada como teste. A etapa externa foi adiada pelo responsável. Os totais e critérios abaixo descrevem a lista original.

**Situação: 17 correções concluídas; validação local no navegador e revisão dos dados antigos realizadas.** Os três casos antigos foram conciliados, conforme o fechamento abaixo. Pagamentos e e-mails reais não foram homologados nesta validação.

## Concluído

- [x] **C01 — Preservar Pix emitidos na troca de plano.** Faturas de outro plano, ciclo ou valor em aberto impedem a troca até a regularização. Solicitações compatíveis reutilizam a fatura e preservam a referência e o QR. Arquivo: `backend/src/routes/tenantAssinaturaRoutes.js`.
- [x] **C02 — Impedir que pagamentos antigos revertam o plano atual.** Apenas a fatura vinculada à solicitação atual aplica plano/ciclo. Uma troca pelo Master remove esse vínculo. Arquivos: `backend/src/services/saasSettlementService.js`, `backend/src/services/saasBillingService.js` e `backend/src/controllers/saasController.js`.
- [x] **C03 — Corrigir pagamento manual e liberação de acesso.** Pagamento manual e Pix compartilham as regras de atualização da arena, respeitam outras pendências e preservam bloqueios manuais ou de origem desconhecida. Baixa e atualização são transacionais. Arquivos: `backend/src/services/saasSettlementService.js`, `backend/src/controllers/saasController.js` e `backend/src/jobs/bloqueioInadimplencia.js`.
- [x] **C04 — Bloquear imediatamente após estorno/chargeback.** A confirmação do provedor valida referência, moeda e valor. A fatura fica atrasada, a data de pagamento é removida e o motivo do bloqueio é registrado. Pagar outra fatura não libera a arena enquanto essa pendência existir. Arquivos: `backend/src/services/saasSettlementService.js` e `backend/src/controllers/saasController.js`.
- [x] **C05 — Proteger arenas contra exclusão automática indevida após trial.** A limpeza exige cadastro inicial aguardando pagamento, sem trial, sem usuários já ativados, sem quadras, sem Pix emitido e sem pagamento anterior. As alterações são transacionais. Arquivos: `backend/src/jobs/limpezaFantasmas.js` e `backend/src/controllers/authController.js`.

### Validação da primeira etapa

49 testes aprovados em sete arquivos, considerando a execução final de cada arquivo:

- `backend/tests/saas_critical_regression.test.js`
- `backend/tests/tenant_assinatura_upgrade.test.js`
- `backend/tests/tenant_assinatura_adiantamento.test.js`
- `backend/tests/lote3_financeiro_saas.test.js`
- `backend/tests/lote4_saas_gateway.test.js`
- `backend/tests/master_trial.test.js`
- `backend/tests/activation.test.js`

Nenhuma cobrança real foi executada. As novas colunas são criadas pela inicialização normal do backend.

### Compatibilidade com dados antigos

Bloqueios antigos sem motivo registrado continuam bloqueados até revisão pelo Master. Solicitações antigas sem vínculo explícito com a fatura não alteram automaticamente o plano; o Master pode ajustar o plano após conciliação. Essa revisão dos dados existentes não foi realizada nesta etapa.

## Etapa 2 — concluída

- [x] **P01 — Recuperar cobranças recorrentes perdidas.** O cron percorre os períodos faltantes das arenas ativas, respeita cobertura mensal/anual e faturas antecipadas. A geração é transacional para evitar duplicação em execuções concorrentes. Intervalos que encontram uma fatura futura são proporcionais, sem sobreposição. Arquivo: `backend/src/jobs/cronSaaS.js`.
- [x] **P02 — Unificar o prazo de bloqueio da tela e do servidor.** O Financeiro lê a tolerância efetiva pela API. O aviso e o destaque seguem a regra do servidor: bloqueio na verificação diária quando o atraso ultrapassa a tolerância. Zero é aceito; valores inválidos são rejeitados. Arquivos: `frontend/src/screens/MasterFinanceiro.tsx`, `backend/src/controllers/saasController.js` e `backend/src/jobs/bloqueioInadimplencia.js`.
- [x] **P03 — Corrigir o primeiro ciclo após o trial.** O aniversário inicial acompanha o término do teste. A primeira fatura cobre um ciclo completo; arenas legadas sem primeira fatura também recebem esse ajuste. A tela deixou de enviar vencimento fixo no dia 10. Arquivos: `frontend/src/screens/MasterArenas.tsx`, `backend/src/controllers/saasController.js`, `backend/src/services/saasCalendarService.js` e `backend/src/jobs/cronSaaS.js`.
- [x] **P04 — Respeitar a configuração global de trial.** Cadastro público e Master usam a mesma política de habilitação/duração. A tela deixou de enviar 14 dias fixos e o servidor não usa esse valor antigo para sobrescrever a política global. Arquivos: `frontend/src/screens/MasterArenas.tsx`, `backend/src/controllers/authController.js`, `backend/src/controllers/saasController.js` e `backend/src/services/saasCalendarService.js`.
- [x] **P05 — Validar e tratar mudanças de vencimento.** O servidor exige inteiro de 1 a 31. O fim do período das faturas existentes é persistido antes da alteração; mudanças posteriores não recalculam esse histórico. O novo dia vale na primeira data possível após o período faturado, sem cobrança pelos dias de transição. A alteração fica disponível após a primeira fatura. Meses curtos e ciclos anuais preservam o dia alvo. Arquivos: `backend/src/services/saasCalendarService.js`, `backend/src/controllers/saasController.js`, `backend/src/routes/tenantAssinaturaRoutes.js` e `frontend/src/screens/MasterArenaDetalhe.tsx`.
- [x] **P06 — Corrigir datas e padronizar o fuso do faturamento.** Datas de calendário no Master preservam o dia informado. Cadastro/trial, geração, aviso de vencimento, pagamento, bloqueio e consultas de assinatura usam a data do SaaS (`APP_TIMEZONE`, padrão `America/Sao_Paulo`). O cron diário usa esse mesmo fuso. Arquivos: `frontend/src/data/mock.ts`, `backend/src/utils/dateUtils.js` e serviços/rotas de assinatura.

### Regras e compatibilidade da etapa 2

- O trial termina no início da data `trial_expira_em`; nessa data começa o primeiro ciclo pago. O status de trial exibido acompanha essa regra.
- A troca do vencimento não altera valor, data de vencimento ou Pix de faturas existentes. Preserva o período faturado e concede os dias de transição sem cobrança extra.
- A nova coluna `FaturasSaaS.periodo_fim` é adicionada na inicialização normal do backend. Períodos legados são fixados a partir dos dados disponíveis antes de mudar o vencimento ou recuperar cobranças; alterações históricas anteriores sem registro não podem ser reconstruídas.
- A recuperação opera sobre arenas ativas, a partir do início conhecido da assinatura ou da primeira fatura registrada. Não foi executada contra o banco real nesta etapa.

### Validação da etapa 2

- **73 testes do backend aprovados em oito arquivos:** os sete arquivos da etapa 1 e `backend/tests/saas_calendar.test.js` (24 cenários novos).
- **3 testes da interface aprovados:** `frontend/tests/MasterBilling.test.tsx`.
- **Checagem de tipos do frontend aprovada:** `npm.cmd run typecheck --prefix frontend`.
- Cobertura inclui meses perdidos, execução concorrente, pagamento antecipado, sobreposição proporcional, fevereiro bissexto, renovação anual, mudança repetida de vencimento, entradas inválidas, trial global, tolerância zero e virada de data UTC/Brasil.
- Uma execução intermediária teve encerramento inesperado de um worker de testes. A repetição completa terminou com os 73 testes aprovados e sem erros de worker.
- Não houve cobrança real nem validação visual manual no navegador; a interface foi validada por testes automatizados.

## Etapa 3 — concluída

- [x] **P07 — Tornar o cadastro consistente e completo.** Cadastro público e Master usam o mesmo serviço transacional. Arena, administrador e, quando aplicável, fatura inicial e desafio de ativação são concluídos ou revertidos juntos. O e-mail normalizado é gravado na arena e no administrador. Nomes iguais recebem slugs distintos, inclusive em cadastros concorrentes. Arquivos: `backend/src/services/arenaRegistrationService.js`, `backend/src/controllers/saasController.js` e `backend/src/controllers/authController.js`.
- [x] **P08 — Salvar dados e plano da arena atomicamente.** A tela envia uma única requisição com cadastro, vencimento e plano. A validação dos limites e a alteração do plano participam da mesma transação dos dados cadastrais e da preservação dos períodos faturados. Se qualquer etapa falhar, tudo é revertido. A rota de alteração isolada do plano reutiliza a mesma validação. Arquivos: `backend/src/services/arenaPlanService.js`, `backend/src/controllers/saasController.js` e `frontend/src/screens/MasterArenaDetalhe.tsx`.

### Envio do convite e nova tentativa

O convite é enviado após a confirmação da transação. Se o SMTP retornar falha ou lançar erro, o cadastro continua válido e a API informa `email_enviado: false`; a tela avisa que o responsável pode solicitar outro link por “Esqueci minha senha”. A recuperação existente gera novo desafio de ativação e invalida o anterior. Não é necessário cadastrar a arena novamente. O cadastro público mantém a senha definida pelo próprio usuário; o desafio de ativação é necessário no cadastro por convite do Master.

### Validação da etapa 3

- **54 testes do backend aprovados** em `arena_atomic.test.js`, `activation.test.js`, `saas_calendar.test.js`, `auth.test.js`, `recovery.test.js` e `lote3_financeiro_saas.test.js`.
- **2 testes da interface aprovados** em `frontend/tests/MasterArenaAtomic.test.tsx`, verificando a requisição única e a preservação do formulário em caso de rejeição.
- **Checagem de tipos do frontend aprovada.**
- Os testes simulam falhas de usuário, fatura, desafio e SMTP; verificam rollback, reenvio por recuperação, concorrência de slugs e rejeição de plano por inexistência ou limite excedido.
- Não foram enviados e-mails reais nem realizados testes visuais manuais no navegador.

## Etapa 4 — concluída

- [x] **P09 — Implementar agendamento real de comunicados.** A tela exige data futura e envia o instante com fuso. O servidor persiste o agendamento e valida expiração, canal e destino. A rotina executada a cada minuto publica os avisos vencidos e prepara as entregas de e-mail. Avisos futuros não aparecem no painel das arenas; cancelados e expirados não iniciam novos envios. Cada destinatário possui registro de entrega e reserva exclusiva antes do SMTP para impedir duplicação por processamentos concorrentes. Arquivos: `backend/src/services/comunicadoService.js`, `backend/src/jobs/cronSaaS.js`, `backend/src/config/init_db.js`, `backend/src/controllers/saasController.js`, `backend/src/routes/authRoutes.js` e `frontend/src/screens/MasterComunicacao.tsx`.
- [x] **P10 — Corrigir a consulta de acessos do usuário.** O ID é passado ao filtro da consulta. O teste confirma que registros de outro usuário não são retornados. Arquivo: `backend/src/controllers/saasController.js`.
- [x] **P11 — Corrigir o aviso de recuperação de senha.** Mensagem e botão informam o envio de link individual por e-mail, com validade de uma hora e encerramento das sessões. A API retorna falha quando o SMTP não envia; a tela não informa sucesso indevidamente. Arquivos: `frontend/src/screens/MasterUsuarios.tsx` e `backend/src/controllers/saasController.js`.
- [x] **P12 — Ajustar o botão superior de pagamento no Financeiro.** O botão agora se chama “Ver faturas para pagamento”, refletindo a navegação até a tabela. O registro manual continua na ação da fatura escolhida. Arquivo: `frontend/src/screens/MasterFinanceiro.tsx`.

### Operação dos comunicados

- O horário digitado usa o fuso local do navegador e é transmitido como um instante UTC. A publicação ocorre na primeira execução da rotina após o horário, normalmente em até um minuto enquanto o backend estiver ativo.
- Após uma parada, a rotina recupera comunicados vencidos que ainda não expiraram. Os registros legados não têm seus e-mails reenviados.
- Envios com falha ou sem confirmação são mostrados no Master. Se o processo cair durante o SMTP, a entrega fica sem confirmação e não é repetida automaticamente: o SMTP não garante confirmação idempotente. Esses casos exigem conferência antes de qualquer novo envio.
- Cancelar impede entregas ainda não iniciadas; e-mails já enviados ou em andamento não podem ser recolhidos.

### Validação conjunta após a etapa 4

- **99 testes do backend aprovados em 12 arquivos**, cobrindo as quatro etapas, recuperação e sessões.
- **7 testes da interface aprovados em três arquivos:** `MasterStage4.test.tsx`, `MasterBilling.test.tsx` e `MasterArenaAtomic.test.tsx`.
- Checagem de tipos do frontend e verificação de whitespace realizadas.
- Novos cenários incluem agendamento futuro, concorrência de envio, cancelamento, expiração, falha SMTP, entrega sem confirmação, validação de horários e isolamento do histórico por usuário.
- Nenhum e-mail ou cobrança real foi enviado; não houve publicação em produção nem validação visual manual no navegador.

## Critérios para finalizar tudo

- [x] Concluir P01 a P12 e registrar as respectivas validações.
- [x] Validar em conjunto cadastro, trial, faturamento, mudança de plano, pagamento manual/Pix, estorno e bloqueio por testes automatizados.
- [x] Validar no navegador os fluxos locais e revisar as capturas das telas alteradas, incluindo mensagem de erro de agendamento e confirmação de sucesso.
- [x] Registrar o resultado da revisão de bloqueios e solicitações antigas no banco local.

## Fechamento da validação local — 08/10/2026

O teste `backend/tests/master_final_browser.test.js` passou em nova execução após a retomada. Utilizou Edge headless, banco em memória, e-mail simulado e tráfego externo bloqueado. Validou criação e edição de arena com persistência, baixa manual de fatura, rejeição de agendamento sem data, agendamento válido, consulta de acessos e mensagem do modal de recuperação de senha. Não registrou erros de JavaScript. A entrega do e-mail de recuperação não foi exercitada por esse teste de navegador.

Foram revisadas oito capturas em `artifacts/master-final/`, em desktop (1440 × 1000) e na tela de comunicação mobile (390 × 844). A captura mobile usa o menu recolhido; os modais são capturados após o término das animações. O relatório está em `artifacts/master-final/browser-report.json`. Esta conferência cobre os cenários e telas descritos; não equivale à homologação de todos os fluxos externos ou de produção.

A auditoria `backend/scripts/audit_master_legacy.cjs` foi executada novamente após a conciliação, somente para leitura sobre o banco local: 13 arenas e 21 faturas. O relatório `artifacts/master-final/legacy-audit.json` confirma que o arquivo do banco permaneceu inalterado. Não encontrou colunas obrigatórias ausentes nem dias de vencimento inválidos.

### Casos antigos conciliados

- [x] **Arena 2:** registrado motivo `inadimplencia` conforme log 293 e fatura 4; bloqueio preservado.
- [x] **Arena 4:** registrado motivo `inadimplencia` conforme log 402 e fatura 6; bloqueio preservado.
- [x] **Arena 1, faturas 18 a 24:** responsável confirmou que são testes. Classificação registrada em auditoria; não representam contratação ou receita real. Plano, faturas e referências foram preservados.

Aplicação local precedida de ensaio idempotente e backup privado. Evidências: `artifacts/master-final/local-reconciliation-apply.json` e `local-reconciliation-rehearsal.json`. A coluna `gateway_estornado_ref` também foi adicionada.
As 21 faturas antigas ainda não têm `periodo_fim` persistido. A compatibilidade implementada fixa esses períodos antes da mudança de vencimento ou da recuperação de cobranças, conforme a etapa 2; a auditoria não executou esse processamento nem reconstruiu alterações históricas.

Os três casos acima estão esclarecidos e registrados. A classificação de teste não filtra os relatórios da aplicação; a preparação da base de produção deverá excluir esses dados de teste. Hospedagem e homologação externa ficam para depois por decisão do responsável.

O ajuste de vencimento para meses curtos já estava correto nos exemplos conferidos na análise original, incluindo fevereiro e ciclo anual com ano bissexto; deve ser preservado nas próximas alterações.

Validação integral de fechamento: **579 testes aprovados** (450 backend, 98 painel, 31 portal); tipos, builds, lint das duas interfaces e arquivos públicos aprovados. `npm.cmd run validate`: 10/10 etapas. Relatório: `artifacts/homologacao/2026-10-09T02-15-56-620Z/summary.json`.
