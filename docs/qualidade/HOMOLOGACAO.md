# Validação e homologação

Guia de execução revisado em 05/11/2026 a partir dos scripts do repositório. Não registra nova execução nem aprovação de produção.

## Automação local

Instale as dependências conforme o [README](../../README.md) e execute na raiz:

```bash
npm run validate
```

O script executa dez etapas: testes do backend, painel e portal; tipos, builds e lint de ambas as interfaces; inspeção de arquivos públicos. Os testes recebem NODE_ENV=test e credenciais SMTP desabilitadas. O backend seleciona SQLite em memória no ambiente de testes.

Os logs e summary.json são gravados em artifacts/homologacao/, com commit, duração, resultado e verificação de alterações dos fontes. O processo retorna falha se alguma etapa não passar ou se os fontes mudarem durante a execução. O relatório não aprova produção automaticamente.

Para contratos de pagamento, execute npm run validate:gateway. Para navegador, consulte [testes E2E](functional-e2e.md), incluindo a preparação do browser.

## Fluxos e integrações

Em uma instância isolada, registre versão, configuração de teste, data e evidências para:

- Login, logout, recuperação e permissões de cada perfil.
- Isolamento entre arenas e tentativas de reserva concorrente.
- Reserva, cobrança Pix, confirmação única e atualização da agenda.
- Webhook repetido, timeout, retomada de pagamento e estorno.
- Assinatura e troca de plano, preservando valores e vigência.
- Entrega de e-mails e login Google, quando habilitados.

Não inferir sucesso financeiro apenas de uma credencial válida ou de um QR gerado. Conferir o estado no provedor e no sistema. Os detalhes ainda abertos estão no [índice de pendências](../README.md#pendências-preservadas).

## Ambiente de destino

Conferir HTTPS, proxy, persistência, reinício, backup e restauração seguindo o [checklist](../operacao/DEPLOYMENT_CHECKLIST.md). Registrar aprovação externa separadamente da suíte local. Dados de teste não devem ser importados como receita real.

## Evidências anteriores

- [Revisão de outubro](../historico/REVISAO_FINAL_2026-10-08.md).
- [Documento anterior de homologação](../historico/HOMOLOGACAO.md), preservado com suas limitações e resultados antigos.
