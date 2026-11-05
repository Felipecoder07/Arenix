# 📊 Relatório Completo de Análise SonarCloud - Arenix

**Data de geração do relatório:** 05/11/2026, 09:41:49
**Fonte:** arquivos locais em artifacts/sonar. Gerar este relatório não consulta o SonarCloud nem comprova o estado atual do projeto; a data acima não é a data da coleta.
**Projeto no SonarCloud:** `Felipecoder07_avalie-papai`
**Total de Problemas Encontrados:** **814**

---

## 📈 1. Resumo Geral por Categoria e Severidade

| Tipo de Problema | Quantidade | Descrição / Impacto |
| :--- | :---: | :--- |
| 🛡️ **Vulnerabilidades (Security)** | **15** | Riscos de segurança, injeção de log, sanitização e sanitização de storage |
| 🐛 **Bugs (Reliability / A11y)** | **50** | Acessibilidade (click sem teclado), duplicidades em CSS, formulários sem label |
| 🧹 **Code Smells (Maintainability)** | **749** | Complexidade cognitiva alta, ternários aninhados, padrões modernos de JS/TS |

### 🚦 Distribuição por Severidade

| Severidade | Quantidade | Percentual |
| :--- | :---: | :---: |
| 🔴 **CRITICAL** | **28** | 3.4% |
| 🟠 **MAJOR** | **339** | 41.6% |
| 🟡 **MINOR** | **438** | 53.8% |
| ⚪ **INFO** | **1** | 0.1% |

---

## 🛡️ 2. Detalhamento de Vulnerabilidades (15 encontradas)

As vulnerabilidades afetam diretamente a segurança da aplicação:

| # | Severidade | Arquivo | Linha | Regra | Descrição do SonarCloud |
| :- | :- | :- | :-: | :- | :-- |
| 1 | `BLOCKER` | `Felipecoder07_avalie-papai:backend/tests/security_audit_review.cjs` | 59 | `javascript:S6437` | Revoke and change this password, as it is compromised. |
| 2 | `MAJOR` | `Felipecoder07_avalie-papai:.github/workflows/build.yml` | undefined | `githubactions:S7637` | Use full commit SHA hash for this dependency. |
| 3 | `MINOR` | `Felipecoder07_avalie-papai:frontend/src/App.tsx` | undefined | `tssecurity:S8475` | Ensure that tainted data is sanitized before being written to browser storage. |
| 4 | `MINOR` | `Felipecoder07_avalie-papai:frontend/src/App.tsx` | undefined | `tssecurity:S8475` | Ensure that tainted data is sanitized before being written to browser storage. |
| 5 | `MINOR` | `Felipecoder07_avalie-papai:frontend/src/App.tsx` | undefined | `tssecurity:S8475` | Ensure that tainted data is sanitized before being written to browser storage. |
| 6 | `MINOR` | `Felipecoder07_avalie-papai:frontend/src/App.tsx` | undefined | `tssecurity:S8475` | Ensure that tainted data is sanitized before being written to browser storage. |
| 7 | `MINOR` | `Felipecoder07_avalie-papai:frontend/src/App.tsx` | undefined | `tssecurity:S8475` | Ensure that tainted data is sanitized before being written to browser storage. |
| 8 | `MINOR` | `Felipecoder07_avalie-papai:frontend/src/screens/MasterLogin.tsx` | undefined | `tssecurity:S8475` | Ensure that tainted data is sanitized before being written to browser storage. |
| 9 | `MINOR` | `Felipecoder07_avalie-papai:frontend/src/screens/MasterLogin.tsx` | undefined | `tssecurity:S8475` | Ensure that tainted data is sanitized before being written to browser storage. |
| 10 | `MINOR` | `Felipecoder07_avalie-papai:frontend/src/screens/public/TenantLogin.tsx` | undefined | `tssecurity:S8475` | Ensure that tainted data is sanitized before being written to browser storage. |
| 11 | `MINOR` | `Felipecoder07_avalie-papai:frontend/src/screens/public/TenantLogin.tsx` | undefined | `tssecurity:S8475` | Ensure that tainted data is sanitized before being written to browser storage. |
| 12 | `MINOR` | `Felipecoder07_avalie-papai:frontend/src/screens/public/TenantLogin.tsx` | undefined | `tssecurity:S8475` | Ensure that tainted data is sanitized before being written to browser storage. |
| 13 | `MINOR` | `Felipecoder07_avalie-papai:frontend/src/screens/public/TenantLogin.tsx` | undefined | `tssecurity:S8475` | Ensure that tainted data is sanitized before being written to browser storage. |
| 14 | `MINOR` | `Felipecoder07_avalie-papai:scripts/fetch_sonar_issues.js` | undefined | `jssecurity:S5145` | Change this code to not log user-controlled data. |
| 15 | `MINOR` | `Felipecoder07_avalie-papai:tela cliente/src/App.tsx` | undefined | `tssecurity:S8475` | Ensure that tainted data is sanitized before being written to browser storage. |

### 🔍 Principais Causas das Vulnerabilidades:
1. **Log Injection / Sensitive Data Logging (CWE-117)**: Uso de `console.log` passando parâmetros da requisição (`req.body`, `paymentId`, `email`, etc.) sem sanitização.
2. **Armazenamento de Dados Não Sanitizados (CWE-79 / Storage Tainting)**: Gravando tokens/dados recebidos direto em `localStorage` sem validação de tipo/schema.
3. **Geração de Valores Pseudoaleatórios Inseguros (CWE-330)**: Uso de `Math.random()` em código que gera tokens/códigos (deve usar `crypto.randomBytes` ou `crypto.randomInt`).
4. **Construção Insegura de URLs (CWE-918 / SSRF)**: Interpolação de inputs de usuários diretamente no path da requisição sem validação.
5. **Configuração de CORS e Cabeçalhos Express**: Falta de desativação do `x-powered-by` (`app.disable('x-powered-by')`) e CORS excessivamente permissivo.

---

## 🐛 3. Detalhamento de Bugs (50 encontrados)

| # | Severidade | Arquivo | Linha | Regra | Descrição |
| :- | :- | :- | :-: | :- | :-- |
| 1 | `BLOCKER` | `Felipecoder07_avalie-papai:backend/src/config/migrations/002_finance_cents.sql` | 5 | `plsql:DeleteOrUpdateWithoutWhereCheck` | Ensure that the WHERE clause is not missing in this UPDATE query. |
| 2 | `BLOCKER` | `Felipecoder07_avalie-papai:backend/src/config/migrations/002_finance_cents.sql` | 16 | `plsql:DeleteOrUpdateWithoutWhereCheck` | Ensure that the WHERE clause is not missing in this UPDATE query. |
| 3 | `BLOCKER` | `Felipecoder07_avalie-papai:backend/src/config/migrations/002_finance_cents.sql` | 19 | `plsql:DeleteOrUpdateWithoutWhereCheck` | Ensure that the WHERE clause is not missing in this UPDATE query. |
| 4 | `BLOCKER` | `Felipecoder07_avalie-papai:backend/src/config/migrations/002_finance_cents.sql` | 22 | `plsql:DeleteOrUpdateWithoutWhereCheck` | Ensure that the WHERE clause is not missing in this UPDATE query. |
| 5 | `BLOCKER` | `Felipecoder07_avalie-papai:backend/src/config/migrations/002_finance_cents.sql` | 25 | `plsql:DeleteOrUpdateWithoutWhereCheck` | Ensure that the WHERE clause is not missing in this UPDATE query. |
| 6 | `BLOCKER` | `Felipecoder07_avalie-papai:backend/src/config/migrations/002_finance_cents.sql` | 26 | `plsql:DeleteOrUpdateWithoutWhereCheck` | Ensure that the WHERE clause is not missing in this UPDATE query. |
| 7 | `BLOCKER` | `Felipecoder07_avalie-papai:backend/src/config/migrations/002_finance_cents.sql` | 29 | `plsql:DeleteOrUpdateWithoutWhereCheck` | Ensure that the WHERE clause is not missing in this UPDATE query. |
| 8 | `MINOR` | `Felipecoder07_avalie-papai:frontend/src/screens/admin/AdminClientes.tsx` | 617 | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 9 | `MINOR` | `Felipecoder07_avalie-papai:frontend/src/screens/admin/AdminReservas.tsx` | undefined | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 10 | `MINOR` | `Felipecoder07_avalie-papai:frontend/src/screens/admin/AdminReservas.tsx` | undefined | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 11 | `MINOR` | `Felipecoder07_avalie-papai:frontend/src/screens/admin/AdminReservas.tsx` | undefined | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 12 | `MINOR` | `Felipecoder07_avalie-papai:frontend/src/screens/admin/AdminAssinatura.tsx` | undefined | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 13 | `MINOR` | `Felipecoder07_avalie-papai:frontend/src/screens/admin/AdminAssinatura.tsx` | undefined | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 14 | `MINOR` | `Felipecoder07_avalie-papai:frontend/src/screens/admin/AdminAssinatura.tsx` | undefined | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 15 | `MINOR` | `Felipecoder07_avalie-papai:frontend/src/screens/admin/AdminAssinatura.tsx` | undefined | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 16 | `MINOR` | `Felipecoder07_avalie-papai:frontend/src/screens/admin/AdminAuditoria.tsx` | undefined | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 17 | `MINOR` | `Felipecoder07_avalie-papai:frontend/src/screens/admin/AdminAuditoria.tsx` | undefined | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 18 | `MINOR` | `Felipecoder07_avalie-papai:frontend/src/screens/admin/AdminAuditoria.tsx` | undefined | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 19 | `MINOR` | `Felipecoder07_avalie-papai:frontend/src/screens/admin/AdminAuditoria.tsx` | undefined | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 20 | `MINOR` | `Felipecoder07_avalie-papai:frontend/src/screens/admin/AdminConfiguracoes.tsx` | undefined | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 21 | `MINOR` | `Felipecoder07_avalie-papai:frontend/src/screens/admin/AdminConfiguracoes.tsx` | undefined | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 22 | `MINOR` | `Felipecoder07_avalie-papai:tela cliente/src/App.tsx` | undefined | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 23 | `MINOR` | `Felipecoder07_avalie-papai:tela cliente/src/App.tsx` | undefined | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 24 | `MINOR` | `Felipecoder07_avalie-papai:tela cliente/src/App.tsx` | undefined | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 25 | `MINOR` | `Felipecoder07_avalie-papai:tela cliente/src/App.tsx` | undefined | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 26 | `MINOR` | `Felipecoder07_avalie-papai:frontend/src/components/AdminTopbar.tsx` | undefined | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 27 | `MINOR` | `Felipecoder07_avalie-papai:frontend/src/components/AdminTopbar.tsx` | undefined | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 28 | `MINOR` | `Felipecoder07_avalie-papai:frontend/src/screens/public/PortalNovaReserva.tsx` | undefined | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 29 | `MINOR` | `Felipecoder07_avalie-papai:tela cliente/src/components/CheckoutDrawer.tsx` | undefined | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 30 | `MINOR` | `Felipecoder07_avalie-papai:tela cliente/src/components/MyReservations.tsx` | undefined | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 31 | `MINOR` | `Felipecoder07_avalie-papai:docs/architecture_map.html` | undefined | `Web:MouseEventWithoutKeyboardEquivalentCheck` | Add a 'onKeyDown/onKeyUp' attribute to this <div> tag. |
| 32 | `MINOR` | `Felipecoder07_avalie-papai:docs/architecture_map.html` | undefined | `Web:MouseEventWithoutKeyboardEquivalentCheck` | Add a 'onKeyDown/onKeyUp' attribute to this <div> tag. |
| 33 | `MINOR` | `Felipecoder07_avalie-papai:docs/architecture_map.html` | undefined | `Web:MouseEventWithoutKeyboardEquivalentCheck` | Add a 'onKeyDown/onKeyUp' attribute to this <div> tag. |
| 34 | `MINOR` | `Felipecoder07_avalie-papai:docs/architecture_map.html` | undefined | `Web:MouseEventWithoutKeyboardEquivalentCheck` | Add a 'onKeyDown/onKeyUp' attribute to this <div> tag. |
| 35 | `MINOR` | `Felipecoder07_avalie-papai:docs/architecture_map.html` | undefined | `Web:MouseEventWithoutKeyboardEquivalentCheck` | Add a 'onKeyDown/onKeyUp' attribute to this <div> tag. |
| 36 | `MAJOR` | `Felipecoder07_avalie-papai:docs/architecture_map.html` | undefined | `Web:InputWithoutLabelCheck` | Associate a valid label to this input field. |
| 37 | `MINOR` | `Felipecoder07_avalie-papai:docs/architecture_map.html` | undefined | `Web:MouseEventWithoutKeyboardEquivalentCheck` | Add a 'onKeyDown/onKeyUp' attribute to this <div> tag. |
| 38 | `MINOR` | `Felipecoder07_avalie-papai:docs/architecture_map.html` | undefined | `Web:MouseEventWithoutKeyboardEquivalentCheck` | Add a 'onKeyDown/onKeyUp' attribute to this <div> tag. |
| 39 | `MINOR` | `Felipecoder07_avalie-papai:frontend/src/screens/public/Checkout.tsx` | undefined | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 40 | `MAJOR` | `Felipecoder07_avalie-papai:frontend/src/assets/css/landing.css` | undefined | `css:S4656` | Duplicate property "display" |
| 41 | `MINOR` | `Felipecoder07_avalie-papai:frontend/src/components/AdminSidebar.tsx` | undefined | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 42 | `MINOR` | `Felipecoder07_avalie-papai:frontend/src/components/Sidebar.tsx` | undefined | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 43 | `MINOR` | `Felipecoder07_avalie-papai:frontend/src/screens/admin/AdminConfiguracoes.tsx` | undefined | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 44 | `MINOR` | `Felipecoder07_avalie-papai:frontend/src/screens/admin/AdminConfiguracoes.tsx` | undefined | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 45 | `MINOR` | `Felipecoder07_avalie-papai:frontend/src/screens/admin/AdminConfiguracoes.tsx` | undefined | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 46 | `MINOR` | `Felipecoder07_avalie-papai:frontend/src/screens/admin/AdminConfiguracoes.tsx` | undefined | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 47 | `MINOR` | `Felipecoder07_avalie-papai:frontend/src/screens/admin/AdminConfiguracoes.tsx` | undefined | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 48 | `MINOR` | `Felipecoder07_avalie-papai:frontend/src/screens/admin/AdminConfiguracoes.tsx` | undefined | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 49 | `MINOR` | `Felipecoder07_avalie-papai:frontend/src/screens/admin/AdminPagamentos.tsx` | undefined | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 50 | `MINOR` | `Felipecoder07_avalie-papai:frontend/src/components/ui.tsx` | undefined | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |

---

## 🔴 4. Detalhamento dos Problemas Críticos (28 itens)

A maioria dos problemas críticos do SonarCloud no projeto está ligada à **Complexidade Cognitiva Excessiva** (funções muito longas com muitos `if/else`, `try/catch` e loops aninhados) e 1 erro de `await` desnecessário:

| # | Arquivo | Linha | Mensagem |
| :- | :-- | :-: | :-- |
| 1 | `Felipecoder07_avalie-papai:backend/src/services/bookingCancellationService.js` | 12 | Refactor this function to reduce its Cognitive Complexity from 17 to the 15 allowed. |
| 2 | `Felipecoder07_avalie-papai:backend/src/services/bookingService.js` | 41 | Refactor this function to reduce its Cognitive Complexity from 31 to the 15 allowed. |
| 3 | `Felipecoder07_avalie-papai:backend/src/services/gatewayService.js` | 310 | Refactor this function to reduce its Cognitive Complexity from 17 to the 15 allowed. |
| 4 | `Felipecoder07_avalie-papai:backend/src/services/paymentLedgerService.js` | 4 | Refactor this function to reduce its Cognitive Complexity from 16 to the 15 allowed. |
| 5 | `Felipecoder07_avalie-papai:backend/src/services/paymentLedgerService.js` | 26 | Refactor this function to reduce its Cognitive Complexity from 22 to the 15 allowed. |
| 6 | `Felipecoder07_avalie-papai:frontend/src/screens/MasterLogin.tsx` | 19 | Refactor this function to reduce its Cognitive Complexity from 16 to the 15 allowed. |
| 7 | `Felipecoder07_avalie-papai:backend/src/routes/gatewayRoutes.js` | 275 | Refactor this function to reduce its Cognitive Complexity from 18 to the 15 allowed. |
| 8 | `Felipecoder07_avalie-papai:frontend/src/App.tsx` | undefined | Refactor this function to reduce its Cognitive Complexity from 19 to the 15 allowed. |
| 9 | `Felipecoder07_avalie-papai:scripts/fetch_sonar_issues.js` | undefined | Refactor this function to reduce its Cognitive Complexity from 19 to the 15 allowed. |
| 10 | `Felipecoder07_avalie-papai:backend/src/controllers/publicController.js` | 310 | Refactor this function to reduce its Cognitive Complexity from 18 to the 15 allowed. |
| 11 | `Felipecoder07_avalie-papai:backend/src/controllers/publicController.js` | undefined | Refactor this function to reduce its Cognitive Complexity from 20 to the 15 allowed. |
| 12 | `Felipecoder07_avalie-papai:backend/src/controllers/publicController.js` | undefined | Refactor this function to reduce its Cognitive Complexity from 21 to the 15 allowed. |
| 13 | `Felipecoder07_avalie-papai:backend/src/controllers/publicController.js` | undefined | Refactor this function to reduce its Cognitive Complexity from 16 to the 15 allowed. |
| 14 | `Felipecoder07_avalie-papai:backend/src/controllers/publicController.js` | undefined | Refactor this function to reduce its Cognitive Complexity from 21 to the 15 allowed. |
| 15 | `Felipecoder07_avalie-papai:backend/src/controllers/publicController.js` | undefined | Refactor this function to reduce its Cognitive Complexity from 17 to the 15 allowed. |
| 16 | `Felipecoder07_avalie-papai:backend/src/controllers/publicController.js` | undefined | Refactor this function to reduce its Cognitive Complexity from 16 to the 15 allowed. |
| 17 | `Felipecoder07_avalie-papai:frontend/src/screens/admin/AdminAssinatura.tsx` | 116 | Refactor this function to reduce its Cognitive Complexity from 27 to the 15 allowed. |
| 18 | `Felipecoder07_avalie-papai:frontend/src/screens/admin/AdminAssinatura.tsx` | 326 | Refactor this function to reduce its Cognitive Complexity from 76 to the 15 allowed. |
| 19 | `Felipecoder07_avalie-papai:frontend/src/screens/admin/AdminConfiguracoes.tsx` | 70 | Refactor this function to reduce its Cognitive Complexity from 17 to the 15 allowed. |
| 20 | `Felipecoder07_avalie-papai:tela cliente/src/App.tsx` | 165 | Refactor this function to reduce its Cognitive Complexity from 18 to the 15 allowed. |
| 21 | `Felipecoder07_avalie-papai:tela cliente/src/components/PixModal.tsx` | 122 | Refactor this function to reduce its Cognitive Complexity from 17 to the 15 allowed. |
| 22 | `Felipecoder07_avalie-papai:frontend/src/screens/admin/AdminConfiguracoes.tsx` | 112 | Refactor this function to reduce its Cognitive Complexity from 46 to the 15 allowed. |
| 23 | `Felipecoder07_avalie-papai:frontend/src/screens/admin/AdminPagamentos.tsx` | 150 | Refactor this function to reduce its Cognitive Complexity from 26 to the 15 allowed. |
| 24 | `Felipecoder07_avalie-papai:frontend/src/screens/admin/AdminReservas.tsx` | 224 | Refactor this function to reduce its Cognitive Complexity from 43 to the 15 allowed. |
| 25 | `Felipecoder07_avalie-papai:frontend/src/screens/admin/AdminReservas.tsx` | 781 | Refactor this function to reduce its Cognitive Complexity from 22 to the 15 allowed. |
| 26 | `Felipecoder07_avalie-papai:backend/src/controllers/publicController.js` | undefined | Refactor this function to reduce its Cognitive Complexity from 39 to the 15 allowed. |
| 27 | `Felipecoder07_avalie-papai:frontend/src/screens/admin/AdminReservas.tsx` | 974 | Refactor this function to reduce its Cognitive Complexity from 16 to the 15 allowed. |
| 28 | `Felipecoder07_avalie-papai:frontend/src/screens/admin/AdminReservas.tsx` | 1200 | Refactor this function to reduce its Cognitive Complexity from 28 to the 15 allowed. |

---

## 🧹 5. Top 15 Regras Mais Frequentes (Code Smells & Padrões)

| Regra Sonar | Ocorrências | Tipo | Severidade | Exemplo de Recomendação |
| :--- | :---: | :---: | :---: | :--- |
| `typescript:S3358` | **84** | `CODE_SMELL` | `MAJOR` | Extract this nested ternary operation into an independent statement. |
| `javascript:S6582` | **74** | `CODE_SMELL` | `MINOR` | Prefer using an optional chain expression instead, as it's more concise and easier to read. |
| `javascript:S7773` | **55** | `CODE_SMELL` | `MINOR` | Prefer `Number.parseInt` over `parseInt`. |
| `typescript:S6819` | **39** | `CODE_SMELL` | `MAJOR` | Use <dialog> instead of the "dialog" role to ensure accessibility across all devices. |
| `typescript:S7773` | **38** | `CODE_SMELL` | `MINOR` | Prefer `Number.parseFloat` over `parseFloat`. |
| `typescript:S6853` | **36** | `CODE_SMELL` | `MAJOR` | A form label must be associated with a control. |
| `typescript:S6759` | **34** | `CODE_SMELL` | `MINOR` | Mark the props of the component as read-only. |
| `typescript:S1082` | **34** | `BUG` | `MINOR` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| `javascript:S7772` | **29** | `CODE_SMELL` | `MINOR` | Prefer `node:fs` over `fs`. |
| `typescript:S6848` | **27** | `CODE_SMELL` | `MAJOR` | Avoid non-native interactive elements. If using native HTML is not possible, add an appropriate role and support for tabbing, mouse, keyboard, and touch inputs to an interactive content element. |
| `javascript:S2486` | **24** | `CODE_SMELL` | `MINOR` | Handle this exception, don't catch it at all, or explain in a comment why it is ignored. |
| `javascript:S1854` | **23** | `CODE_SMELL` | `MAJOR` | Remove this useless assignment to variable "decoded". |
| `typescript:S1128` | **21** | `CODE_SMELL` | `MINOR` | Remove this unused import of 'logout'. |
| `javascript:S1481` | **19** | `CODE_SMELL` | `MINOR` | Remove the declaration of the unused 'decoded' variable. |
| `typescript:S6847` | **17** | `CODE_SMELL` | `MAJOR` | Non-interactive elements should not be assigned mouse or keyboard event listeners. |

---

## 📁 6. Top 15 Arquivos com Mais Apontamentos

| Arquivo | Total | 🐛 Bugs | 🛡️ Vulns | 🧹 Code Smells |
| :--- | :---: | :---: | :---: | :---: |
| `Felipecoder07_avalie-papai:backend/src/controllers/publicController.js` | **64** | 0 | 0 | 64 |
| `Felipecoder07_avalie-papai:frontend/src/screens/admin/AdminConfiguracoes.tsx` | **62** | 8 | 0 | 54 |
| `Felipecoder07_avalie-papai:frontend/src/screens/admin/AdminReservas.tsx` | **50** | 3 | 0 | 47 |
| `Felipecoder07_avalie-papai:backend/src/controllers/saasController.js` | **39** | 0 | 0 | 39 |
| `Felipecoder07_avalie-papai:frontend/src/screens/admin/AdminAssinatura.tsx` | **37** | 4 | 0 | 33 |
| `Felipecoder07_avalie-papai:tela cliente/src/App.tsx` | **30** | 4 | 1 | 25 |
| `Felipecoder07_avalie-papai:backend/src/services/gatewayService.js` | **21** | 0 | 0 | 21 |
| `Felipecoder07_avalie-papai:backend/src/routes/gatewayRoutes.js` | **19** | 0 | 0 | 19 |
| `Felipecoder07_avalie-papai:docs/architecture_map.html` | **18** | 8 | 0 | 10 |
| `Felipecoder07_avalie-papai:frontend/src/screens/admin/AdminAuditoria.tsx` | **17** | 4 | 0 | 13 |
| `Felipecoder07_avalie-papai:frontend/src/App.tsx` | **15** | 0 | 5 | 10 |
| `Felipecoder07_avalie-papai:frontend/src/components/ui.tsx` | **15** | 1 | 0 | 14 |
| `Felipecoder07_avalie-papai:frontend/src/screens/MasterFinanceiro.tsx` | **15** | 0 | 0 | 15 |
| `Felipecoder07_avalie-papai:frontend/src/screens/public/PortalNovaReserva.tsx` | **14** | 1 | 0 | 13 |
| `Felipecoder07_avalie-papai:frontend/src/screens/admin/AdminPagamentos.tsx` | **14** | 1 | 0 | 13 |

---

## 🛠️ 7. Plano de Ação Recomendado para Correção

1. **Fase 1 - Segurança Imediata (32 Vulnerabilidades)**
   - Trocar logs com dados brutos por logs parametrizados/sanitizados.
   - Substituir `Math.random()` em `publicController.js` por `crypto.randomBytes` / `crypto.randomInt`.
   - Adicionar `app.disable('x-powered-by')` e ajustar política de CORS em `backend/src/app.js`.
   - Sanitizar dados antes de salvar no `localStorage`.

2. **Fase 2 - Correção de Bugs e Acessibilidade (43 Bugs)**
   - Corrigir `tela cliente/src/components/CheckoutDrawer.tsx:96` (remover `await` de valor não-Promise).
   - Adicionar `onKeyDown` / `role="button"` / `tabIndex={0}` ou converter `div` clicáveis em `<button>` nos componentes React.
   - Corrigir CSS duplicado em `landing.css:667`.

3. **Fase 3 - Refatoração de Complexidade Crítica (41 Críticos)**
   - Quebrar funções gigantes em controllers (`publicController.js:355` com complexidade 84, `AdminAssinatura.tsx:106` com 71) em funções auxiliares menores (helpers/services).

4. **Fase 4 - Modernização e Limpeza Automatizável (646 Code Smells)**
   - Trocar `parseInt` -> `Number.parseInt` e `isNaN` -> `Number.isNaN`.
   - Aplicar optional chaining (`a?.b`).
   - Trocar `require('fs')` por `require('node:fs')` / `node:path`.
   - Extrair ternários aninhados em variáveis ou funções auxiliares.
