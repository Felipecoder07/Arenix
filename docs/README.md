# Documentação do Arenix

Reorganizada em 05/11/2026. Os guias abaixo distinguem implementação, critérios de verificação e evidências históricas. A reorganização não equivale a nova homologação do produto.

## Comece aqui

- [Apresentação e execução local](../README.md)
- [Arquitetura atual](arquitetura/README.md)
- [Validação e homologação](qualidade/HOMOLOGACAO.md)
- [Preparação para produção](operacao/DEPLOYMENT_CHECKLIST.md)
- [Implantação no Render](operacao/RENDER_DEPLOY.md)

## Produto e desenvolvimento

- [Minha contribuição e construção com IA](desenvolvimento/construcao-com-ia.md): processo de trabalho e estudo de caso com referências técnicas.
- [Requisitos originais](produto/CourtManager_PRD.md): referência de escopo, não inventário certificado da versão atual.
- [Funcionalidades SaaS](produto/saas_features.md): visão de produto a conferir contra a implementação.
- [Regras de pagamentos](produto/regras_pagamentos.md).
- [Troca de plano](produto/TROCA_PLANO_IMPLEMENTACAO.md): implementação registrada em 15/10, com homologação externa pendente.
- [Calendário compartilhado](desenvolvimento/CALENDARIO_UI.md).
- [Testes E2E](qualidade/functional-e2e.md).

## Operação e integrações

- [Topologia do proxy](operacao/proxy-topology.md).
- [Google OAuth](operacao/configuracao_google_oauth.md).
- [Mercado Pago OAuth local](operacao/configuracao_mercado_pago_oauth.md).

## Pendências preservadas

Estes registros incluem diagnósticos datados. Os itens abertos precisam ser revalidados; nenhuma pendência foi encerrada por esta organização.

- [Execução das correções Pix](planejamento/PLANO_IMPLEMENTACAO_CORRECAO_PIX_2026-10-10.md): correções locais registradas; homologação externa e conciliação histórica ainda abertas no documento.
- [Liberação Pix](planejamento/PIX_LIBERACAO_2026-09-29.md).
- [Roteiro externo](planejamento/HOMOLOGACAO_EXTERNA_2026-09-22.md).
- [Acompanhamento de segurança](planejamento/PENDENCIAS_SEGURANCA_2026-09-21.md).
- [Diagnóstico para suporte Mercado Pago](planejamento/SUPORTE_MP_SANDBOX_2026-09-29.md).
- [Proposta futura de pagamento no balcão](planejamento/opcoes_pagamento_balcao_futuro.md).

## Histórico e evidências

[Histórico completo](historico/README.md) reúne revisões, incidentes, planos antigos e mapas substituídos. Resultados de testes valem para a execução e versão registradas. Relatórios antigos com expressões como “100% funcional” não certificam a versão atual.

Os dados de coleta do Sonar ficam em [artifacts/sonar](../artifacts/sonar/README.md). O relatório de setembro foi preservado no histórico; novas gerações não o sobrescrevem.

## Convenções

- Guias operacionais descrevem procedimentos; relatórios datados registram o que foi verificado.
- Propostas e itens ainda abertos ficam em planejamento, sem serem apresentados como funcionalidades entregues.
- Links entre documentos são relativos. Caminhos de código em crases partem da raiz do repositório.
- Antes de mover uma referência, atualize também seus consumidores em scripts e no README.

## Exceção: evidências imutáveis

[Revisão original de segurança](security-review-2026-09-13.md) e [evidência JSON](security-audit-evidence.json) permanecem na raiz de docs, byte a byte como no registro original. Seus hashes e o script de auditoria são protegidos pelos testes. São registros históricos, não guias vigentes; o script original não deve ser executado para atualizar essas evidências.
