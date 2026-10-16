# Revisão final local — 08/10/2026

As correções locais estão no working tree. O responsável adiou a parte externa (domínio, hospedagem e homologação com os provedores) e confirmou que as faturas 18 a 24 da arena 1 são apenas testes. Não houve publicação, pagamento, estorno ou envio de e-mail real nesta revisão.

## Correções concluídas

- Consulta de pagamento SaaS encaminha o pagamento autenticado para validar ID, moeda e valor; a resposta respeita o estado real da arena e bloqueios manuais.
- Estornos são associados à referência do pagamento. Aprovação atrasada não desfaz estorno; repetição do estorno não desfaz regularização manual posterior.
- Pix usa a validade do provedor, recusa respostas encerradas/expiradas e verifica alterações concorrentes antes de persistir. Uma cobrança encerrada exige regularização antes de gerar outra.
- Adiantamento que reutiliza fatura informa o preço, plano e ciclo dessa fatura. Valores da auditoria são convertidos de centavos para reais.
- Cadastro, edição e exclusão de quadras aguardam confirmação HTTP. Falhas preservam o formulário e a lista, sem falso sucesso. Novas quadras recebem o ID do servidor. Preços são enviados em reais, conforme o contrato da API; a edição mantém o status existente.
- Assinatura sem data válida mostra indisponibilidade, sem o vencimento fictício de 11/10/2026.
- Os 26 erros anteriores de lint do painel foram corrigidos, sem desativar regras. Código e imports sem uso foram removidos.
- Erro de login recebe `role="alert"`. Seletores dos testes de navegador foram corrigidos, mantendo as verificações de segurança.
- Guia de implantação corrigido para o código atual: proxy na mesma origem, SQLite, variáveis e rotas reais. Segredo literal removido do guia; rotação no provedor fica na etapa externa.

## Validação

**Validação completa aprovada: 10 de 10 etapas**, pelo comando `npm.cmd run validate`. Relatório: `artifacts/homologacao/2026-10-09T02-15-56-620Z/summary.json`. Os horários dos artefatos são UTC; a data local da revisão é 08/10/2026.

- Suíte completa: **579 testes aprovados** — 450 backend (47 arquivos), 98 painel (20 arquivos) e 31 portal (6 arquivos).
- Testes direcionados desta conclusão: 20 aprovados, cobrindo datas ausentes/inválidas, quadras, notificações, erros HTTP/rede, preços, status e ID retornado pelo servidor.
- Checagens de tipos, builds e lint das duas interfaces aprovados; inspeção de arquivos públicos aprovada.
- `npm.cmd run check:local`: integridade aprovada, quatro segredos cifrados legíveis, nenhuma migração criptográfica pendente nem inconsistências nas categorias inspecionadas.
- Migração/conciliação ensaiada em cópia, repetida para conferir idempotência e aplicada localmente após backup. Integridade aprovada e comparação confirmou valores e estados das faturas preservados.
- A execução ampla anterior, que encontrou falhas posteriormente corrigidas, permanece registrada em `artifacts/homologacao/2026-10-08T12-31-03-084Z/summary.json`.

## Conciliação local concluída

- **Arena 2:** motivo `inadimplencia` registrado com base no log 293 e na fatura 4 atrasada; status bloqueado preservado.
- **Arena 4:** motivo `inadimplencia` registrado com base no log 402 e na fatura 6 atrasada; status bloqueado preservado. Conferidos os eventos anteriores de alteração manual de status.
- **Arena 1, faturas 18 a 24:** responsável confirmou “São apenas testes”. Classificação registrada na auditoria, sem alterar plano, valor, status ou referências Pix. Essa anotação não exclui os dados dos relatórios da aplicação; o banco local continua sendo uma base de testes e não deve ser importado como faturamento real.
- Coluna `FaturasSaaS.gateway_estornado_ref` adicionada. A inicialização do backend já contempla essa migração. Ela não reconstrói estornos históricos.
- As 21 faturas antigas sem `periodo_fim` continuam atendidas pela compatibilidade implementada, que fixa o período antes de alterar vencimento/recuperar cobranças. Não foram inventados contratos históricos.

Evidências em `artifacts/master-final/`:

- `local-reconciliation-rehearsal.json`: ensaio e idempotência.
- `local-reconciliation-apply.json`: aplicação e caminho do backup privado em `.local-security/`.
- `legacy-audit-before-reconciliation.json`: situação anterior preservada.
- `legacy-audit.json`: conferência posterior, somente leitura, sem colunas obrigatórias ausentes ou bloqueios sem motivo.

O script `backend/scripts/reconcile_local_review.cjs` apenas ensaia por padrão; `--apply` aplica ao banco local com backup. Recusa divergências de status, fatura, motivo e histórico de bloqueio.

## Etapa externa adiada pelo responsável

- O domínio de produção pode aguardar. É possível receber Webhooks em um túnel HTTPS temporário; o projeto já contém um relay que permite somente `POST` às duas rotas de pagamento.
- Primeiro reteste sandbox sem domínio: token autenticado, mas criação de Pix foi rejeitada pelo Mercado Pago com `2034 — Invalid users involved`. Nenhuma cobrança foi criada. Ver [registro da tentativa e próximos passos](HOMOLOGACAO_EXTERNA_2026-09-22.md).
- Confirmar a configuração de teste específica da Payments API antes de repetir Pix aprovado, notificações duplicadas e estorno. A causa exata do 2034 ainda não foi identificada. O pagamento antigo `1328247564` foi confirmado como `live_mode=false`, BRL 100, recebedor correto, mas permaneceu pendente; três Webhooks assinados recebidos em 23/09 também só confirmaram esse estado pendente.
- Diagnóstico aprofundado: instância isolada com 32 arquivos diferentes do código atual, embora a função de criação Pix coincida; rejeição remota ocultada por erro 500 e intenções deixadas como `unknown`. [Plano de correção aguardando liberação](PLANO_CORRECAO_PIX_2026-10-09.md).
- Definir domínio/hospedagem e configurar HTTPS, proxy, persistência, reinício, monitoramento e restauração no destino.
- Revogar/rotacionar o segredo presente no guia antigo, caso ainda válido; a remoção atual não elimina cópias antigas.
- Homologar assinatura SaaS e OAuth da arena; o callback OAuth precisa usar uma URL de retorno registrada para a aplicação, que pode ser o endereço temporário durante a homologação.
- Verificar entrega de convites/recuperação por SMTP com destinatário autorizado e login Google na origem publicada. Google já foi comprovado localmente em 23/09.
- Preparar a base de produção sem importar as faturas de teste como recebimentos ou contratos reais.

Lançamento previsto somente por Pix; cartão e Point permanecem adiados. Roteiro: [preparação para produção](DEPLOYMENT_CHECKLIST.md). A conclusão local não equivale à homologação externa ou à aprovação de produção.
