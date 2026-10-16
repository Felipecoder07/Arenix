# Diagnóstico e plano de correção do Pix

**Detalhamento da implementação, 10/10/2026:** ver [plano por etapa, arquivos, testes e critérios de aceite](PLANO_IMPLEMENTACAO_CORRECAO_PIX_2026-10-10.md), baseado no código atual da pasta de trabalho. As etapas abaixo permanecem como diagnóstico e escopo original; a criação do novo plano não significa que as correções foram executadas.

Status atualizado em 12/10/2026: **implementação local aplicada e validação final aprovada; homologação externa, causa do erro 2034 e conciliação histórica pendentes**. O diagnóstico abaixo é histórico, feito em 08/10 no horário de Brasília (registros técnicos de 09/10 em UTC). O registro atualizado de tarefas e evidências está no plano de implementação vinculado acima. Nenhuma cobrança ou devolução externa foi executada na retomada de 12/10.

## O que está comprovado

| Achado | Evidência e consequência |
|---|---|
| Mercado Pago recusou duas criações de Pix | `POST /v1/payments`: HTTP 400, causa `2034 — Invalid users involved`, às 02:38:31 e 02:39:24 UTC. Reservas isoladas 20010 e 20011, ambas de R$ 100. Nenhuma transação ou pagamento local foi registrado para elas. |
| A aplicação esconde a rejeição | `gatewayService.js` descarta os detalhes do erro remoto; a rota responde 500 genérico. Isso dificulta distinguir configuração recusada de indisponibilidade. |
| As intenções ficam ambíguas | `paymentIntentService.js` marca qualquer exceção como `unknown`, inclusive a rejeição 400 observada. As duas intenções continuam nesse estado. |
| A instância isolada está desatualizada | Cópia criada em 22/09: 32 arquivos diferem do backend atual, incluindo rotas e serviços financeiros. Entretanto, a função de criação Pix é idêntica nas duas versões; a rejeição 2034 continua sendo evidência válida dessa requisição. |
| As credenciais locais coincidem | Access token e public key do arquivo de homologação coincidem com os da instância. A autenticação anterior em `/users/me` retornou 200. Isso comprova autenticação, não aprovação da integração Pix. |
| O ensaio OAuth ainda não está preparado | Configuração isolada sem o par client ID/secret; relay aceita somente POST de Webhooks. A proteção de rede atual exige o token fixo existente e impede a troca OAuth e o uso de outro token conectado. |

A reserva antiga 1 está em cancelamento/conciliação pendente e não serve como nova fixture de criação. Sua rejeição local foi uma proteção esperada.

Evidências privadas: `.local-security/homologacao/instance/provider-checks.jsonl`, `.local-security/homologacao/flow-check.json` e SQLite isolado. Não publicar arquivos de configuração, credenciais ou dados pessoais.

## O que ainda não está comprovado

O código 2034 indica incompatibilidade entre usuários/ambientes envolvidos, conforme a [referência do Mercado Pago](https://www.mercadopago.com.br/developers/en/reference/online-payments/subscriptions/create-payment/post). A identificação exata da conta ou configuração incorreta permanece aberta. Trocar um e-mail por um nome com aparência de usuário de teste não comprova que esse pagador exista ou seja adequado.

Corrige-se aqui a orientação anterior de simplesmente criar duas contas “na mesma aplicação”: a [documentação de testes da Payments API](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-payments/integration-test/make-test-purchase) descreve credenciais de teste do usuário de produção e e-mail do pagador diferente do titular. É necessário confirmar a configuração correspondente ao produto utilizado. Prefixo `TEST-` ou ausência da etiqueta `test_user`, isoladamente, não determinam a validade do ambiente.

O aplicativo usa **Payments API, `/v1/payments`**. O [roteiro Pix com aprovação APRO da Orders API](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/integration-test/pix) usa `/v1/orders`, outro formato de requisição e outros identificadores. Esse roteiro não comprova aprovação automática no produto atual. Também não há evidência de que adicionar CPF, trocar domínio ou trocar arbitrariamente o token resolva o erro observado.

## Ordem de execução após a liberação

### 1. Preparar uma instância com o código atual

Criar outra pasta de execução isolada, preservando banco, registros e configuração antigos. Adaptar `prepare_homologacao.js`, `run_homologacao.js` e verificadores para selecionar essa pasta. Gerar manifesto dos arquivos atuais e recusar iniciar com divergências. Manter banco separado, cron e SMTP desligados. Criar reservas e faturas próprias para cada caso, sem reaproveitar a reserva cancelada.

**Conclusão:** versão testada identificada, banco isolado íntegro e nenhuma escrita no banco habitual.

### 2. Identificar a origem do 2034

Confirmar no painel/documentação do provedor a aplicação, titular, credenciais e regras do pagador para a Payments API. Conferir identidade e permissões sem exibir segredos. Manter separados token da arena e token master que recebe o SaaS.

Com configuração de teste confirmada, executar uma requisição mínima de controle conforme o produto correto e compará-la à requisição da aplicação. Usar chaves de idempotência distintas por cobrança pretendida e preservar a chave ao repetir a mesma operação. Registrar HTTP, código do provedor, identificação da requisição e resultado; conferir valor, moeda, recebedor e `live_mode` quando houver pagamento.

- Se ambas retornarem 2034, corrigir a configuração identificada ou preparar evidências sanitizadas para suporte do Mercado Pago.
- Se o controle funcionar e o aplicativo falhar, comparar os campos enviados e corrigir somente a divergência demonstrada.
- Se aprovação/estorno Pix de teste não forem suportados na Payments API, registrar essa limitação. Eventual migração para Orders exige uma decisão separada, incluindo criação, consultas, notificações, estornos e SaaS.

**Conclusão:** causa reproduzida e corrigida, com criação de cobrança de teste comprovada. Autenticação 200 sozinha não encerra esta etapa. Operações com dinheiro real precisam de autorização específica.

### 3. Corrigir o tratamento de falhas

Em `gatewayService.js` e `gatewayRoutes.js`, preservar internamente status/código remoto e identificação da requisição, sem registrar token ou dados do pagador. Devolver mensagem útil e status apropriado para rejeição conhecida; manter distinção de timeout/indisponibilidade.

Em `paymentIntentService.js`, distinguir rejeição definitiva sem criação de resultado ambíguo. Usar estado terminal somente quando a resposta justificar que não houve pagamento; não transformar indiscriminadamente todo 400 em falha terminal. Timeout, resposta ambígua e falha de persistência após criação exigem conciliação e preservação da idempotência antes de nova cobrança. Não apagar as intenções históricas nem liberar repetição sem verificar o resultado.

**Conclusão:** testes direcionados para 2034, timeout, repetição e falha após criação passam; nenhum caso permite pagamento duplicado ou crédito falso.

### 4. Homologar reserva e SaaS sem domínio definitivo

Publicar somente as rotas necessárias por túnel HTTPS temporário. Conferir assinatura, consulta autenticada ao provedor e correspondência de pagamento/arena/fatura. Executar Pix criado, aprovado, notificações repetidas e concorrentes, entrega atrasada, consulta temporariamente indisponível, cancelamento e estorno. Repetir separadamente para a fatura SaaS, conferindo valor, ciclo e bloqueios manuais.

Antes desses casos, confirmar como o provedor permite gerar cada estado de teste na Payments API. Simulações locais complementam a cobertura, mas não serão registradas como homologação do provedor.

**Conclusão:** aprovação gera uma única baixa/crédito; repetição não altera o saldo; estorno confirmado gera uma única reversão; evento atrasado não desfaz estorno. SaaS não quita outra fatura nem altera bloqueio manual indevidamente.

### 5. Homologar OAuth da arena

Preparar client ID/secret privados e URI temporária registrada. Ampliar o relay apenas para o GET do callback necessário e ajustar a proteção de rede para permitir a troca OAuth prevista, validando a identidade conectada antes de utilizá-la. Não liberar qualquer token pelo prefixo nem registrar códigos/segredos da troca. Seguir a [configuração oficial de OAuth](https://www.mercadopago.com.br/developers/pt/docs/security/oauth/creation).

Testar consentimento, vínculo à arena correta, armazenamento cifrado, recebedor e rejeição de state/callback reutilizado ou de outra arena. A conexão manual de credencial realizada anteriormente não comprova OAuth.

**Conclusão:** arena conecta pelo fluxo completo e nenhuma tentativa indevida troca sua credencial.

### 6. Fechar a revisão

Rodar os testes direcionados às alterações e as checagens exigidas pelo projeto. Registrar versão, cenário, IDs, resultado e evidências sanitizadas. A validação local anterior teve 579 testes aprovados; ela não comprova os estados financeiros no provedor.

| Cenário | Evidência para encerrar |
|---|---|
| Criação Pix | Resposta do provedor, QR válido, BRL/valor/recebedor corretos e ambiente de teste confirmado. |
| Aprovação e repetição | Provedor aprovado; uma baixa/crédito após entregas sequenciais e concorrentes. |
| Estorno e evento atrasado | Estorno confirmado; uma reversão, sem reativação por aprovação antiga. |
| SaaS | Fatura/ciclo corretos e repetição sem quitação ou desbloqueio indevido. |
| OAuth | Callback registrado, credencial cifrada, arena correta e rejeição de reutilização. |

Domínio/hospedagem definitivos e testes SMTP permanecem para depois, conforme decisão do responsável. Qualquer cenário sem evidência fica pendente, com o motivo registrado. Esta preparação não aprova publicação em produção.
