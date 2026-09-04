# 📊 Relatório Completo de Análise SonarCloud - Arenix

**Data da Coleta:** 03/09/2026, 23:43:06  
**Projeto no SonarCloud:** `Felipecoder07_Arenix`  
**Total de Problemas Encontrados:** **721**

---

## 📈 1. Resumo Geral por Categoria e Severidade

| Tipo de Problema | Quantidade | Descrição / Impacto |
| :--- | :---: | :--- |
| 🛡️ **Vulnerabilidades (Security)** | **32** | Riscos de segurança, injeção de log, sanitização e sanitização de storage |
| 🐛 **Bugs (Reliability / A11y)** | **43** | Acessibilidade (click sem teclado), duplicidades em CSS, formulários sem label |
| 🧹 **Code Smells (Maintainability)** | **646** | Complexidade cognitiva alta, ternários aninhados, padrões modernos de JS/TS |

### 🚦 Distribuição por Severidade

| Severidade | Quantidade | Percentual |
| :--- | :---: | :---: |
| 🔴 **CRITICAL** | **41** | 5.7% |
| 🟠 **MAJOR** | **261** | 36.2% |
| 🟡 **MINOR** | **418** | 58.0% |
| ⚪ **INFO** | **1** | 0.1% |

---

## 🛡️ 2. Detalhamento de Vulnerabilidades (32 encontradas)

As vulnerabilidades afetam diretamente a segurança da aplicação:

| # | Severidade | Arquivo | Linha | Regra | Descrição do SonarCloud |
| :- | :- | :- | :-: | :- | :-- |
| 1 | `MINOR` | `backend/src/controllers/saasController.js` | 550 | `jssecurity:S5145` | Change this code to not log user-controlled data. |
| 2 | `MINOR` | `frontend/src/App.tsx` | 76 | `tssecurity:S5145` | Change this code to not log user-controlled data. |
| 3 | `MINOR` | `frontend/src/screens/public/TenantLogin.tsx` | 58 | `tssecurity:S8475` | Ensure that tainted data is sanitized before being written to browser storage. |
| 4 | `MINOR` | `tela cliente/src/App.tsx` | 171 | `tssecurity:S8475` | Ensure that tainted data is sanitized before being written to browser storage. |
| 5 | `MINOR` | `backend/src/services/gatewayService.js` | 394 | `jssecurity:S5145` | Change this code to not log user-controlled data. |
| 6 | `MINOR` | `backend/src/controllers/publicController.js` | 565 | `jssecurity:S5145` | Change this code to not log user-controlled data. |
| 7 | `MAJOR` | `backend/src/controllers/publicController.js` | 911 | `javascript:S2245` | Make sure that using this pseudorandom number generator is safe here. |
| 8 | `MAJOR` | `backend/src/controllers/publicController.js` | 1379 | `javascript:S2245` | Make sure that using this pseudorandom number generator is safe here. |
| 9 | `MINOR` | `backend/src/controllers/publicController.js` | 1537 | `jssecurity:S5145` | Change this code to not log user-controlled data. |
| 10 | `MAJOR` | `tela cliente/src/components/PixModal.tsx` | 124 | `tssecurity:S7044` | Change this code to not construct the URL's path from user-controlled data. |
| 11 | `MINOR` | `tela cliente/src/components/PixModal.tsx` | 124 | `tssecurity:S8476` | Ensure that tainted data is validated before being used to construct a client-side request URL. |
| 12 | `MINOR` | `backend/src/controllers/saasController.js` | 543 | `jssecurity:S5145` | Change this code to not log user-controlled data. |
| 13 | `MAJOR` | `backend/src/controllers/saasController.js` | 569 | `jssecurity:S7044` | Change this code to not construct the URL's path from user-controlled data. |
| 14 | `MAJOR` | `backend/src/routes/gatewayRoutes.js` | 196 | `jssecurity:S7044` | Change this code to not construct the URL's path from user-controlled data. |
| 15 | `MINOR` | `backend/src/routes/gatewayRoutes.js` | 307 | `jssecurity:S5145` | Change this code to not log user-controlled data. |
| 16 | `MINOR` | `backend/src/routes/gatewayRoutes.js` | 366 | `jssecurity:S5145` | Change this code to not log user-controlled data. |
| 17 | `MINOR` | `backend/src/services/emailService.js` | 37 | `jssecurity:S5145` | Change this code to not log user-controlled data. |
| 18 | `MINOR` | `backend/src/services/gatewayService.js` | 229 | `jssecurity:S5145` | Change this code to not log user-controlled data. |
| 19 | `MINOR` | `backend/src/services/gatewayService.js` | 353 | `jssecurity:S5145` | Change this code to not log user-controlled data. |
| 20 | `MINOR` | `backend/src/services/saasBillingService.js` | 210 | `jssecurity:S5145` | Change this code to not log user-controlled data. |
| 21 | `MINOR` | `frontend/src/App.tsx` | 86 | `tssecurity:S8475` | Ensure that tainted data is sanitized before being written to browser storage. |
| 22 | `MINOR` | `frontend/src/App.tsx` | 219 | `tssecurity:S8475` | Ensure that tainted data is sanitized before being written to browser storage. |
| 23 | `MINOR` | `frontend/src/App.tsx` | 272 | `tssecurity:S8475` | Ensure that tainted data is sanitized before being written to browser storage. |
| 24 | `MINOR` | `frontend/src/screens/MasterLogin.tsx` | 47 | `tssecurity:S8475` | Ensure that tainted data is sanitized before being written to browser storage. |
| 25 | `MINOR` | `frontend/src/screens/MasterLogin.tsx` | 48 | `tssecurity:S8475` | Ensure that tainted data is sanitized before being written to browser storage. |
| 26 | `MINOR` | `frontend/src/screens/public/TenantLogin.tsx` | 52 | `tssecurity:S8475` | Ensure that tainted data is sanitized before being written to browser storage. |
| 27 | `MINOR` | `frontend/src/screens/public/TenantLogin.tsx` | 53 | `tssecurity:S8475` | Ensure that tainted data is sanitized before being written to browser storage. |
| 28 | `MINOR` | `frontend/src/screens/public/TenantLogin.tsx` | 55 | `tssecurity:S8475` | Ensure that tainted data is sanitized before being written to browser storage. |
| 29 | `MINOR` | `frontend/src/App.tsx` | 192 | `tssecurity:S8475` | Ensure that tainted data is sanitized before being written to browser storage. |
| 30 | `MINOR` | `frontend/src/App.tsx` | 195 | `tssecurity:S8475` | Ensure that tainted data is sanitized before being written to browser storage. |
| 31 | `MINOR` | `backend/src/app.js` | 6 | `javascript:S5689` | This framework implicitly discloses version information by default. Make sure it is safe here. |
| 32 | `MAJOR` | `backend/src/app.js` | 8 | `javascript:S5122` | Make sure that enabling CORS is safe here. |

### 🔍 Principais Causas das Vulnerabilidades:
1. **Log Injection / Sensitive Data Logging (CWE-117)**: Uso de `console.log` passando parâmetros da requisição (`req.body`, `paymentId`, `email`, etc.) sem sanitização.
2. **Armazenamento de Dados Não Sanitizados (CWE-79 / Storage Tainting)**: Gravando tokens/dados recebidos direto em `localStorage` sem validação de tipo/schema.
3. **Geração de Valores Pseudoaleatórios Inseguros (CWE-330)**: Uso de `Math.random()` em código que gera tokens/códigos (deve usar `crypto.randomBytes` ou `crypto.randomInt`).
4. **Construção Insegura de URLs (CWE-918 / SSRF)**: Interpolação de inputs de usuários diretamente no path da requisição sem validação.
5. **Configuração de CORS e Cabeçalhos Express**: Falta de desativação do `x-powered-by` (`app.disable('x-powered-by')`) e CORS excessivamente permissivo.

---

## 🐛 3. Detalhamento de Bugs (43 encontrados)

| # | Severidade | Arquivo | Linha | Regra | Descrição |
| :- | :- | :- | :-: | :- | :-- |
| 1 | `MINOR` | `frontend/src/screens/admin/AdminAssinatura.tsx` | 1471 | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 2 | `MINOR` | `frontend/src/screens/admin/AdminAssinatura.tsx` | 1485 | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 3 | `MINOR` | `frontend/src/screens/admin/AdminAssinatura.tsx` | 1799 | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 4 | `MINOR` | `frontend/src/screens/admin/AdminAssinatura.tsx` | 1813 | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 5 | `MINOR` | `frontend/src/screens/admin/AdminAuditoria.tsx` | 383 | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 6 | `MINOR` | `frontend/src/screens/admin/AdminAuditoria.tsx` | 425 | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 7 | `MINOR` | `frontend/src/screens/admin/AdminAuditoria.tsx` | 574 | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 8 | `MINOR` | `frontend/src/screens/admin/AdminAuditoria.tsx` | 575 | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 9 | `MINOR` | `frontend/src/screens/admin/AdminConfiguracoes.tsx` | 1436 | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 10 | `MINOR` | `frontend/src/screens/admin/AdminConfiguracoes.tsx` | 1926 | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 11 | `MINOR` | `tela cliente/src/App.tsx` | 808 | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 12 | `MINOR` | `tela cliente/src/App.tsx` | 812 | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 13 | `MINOR` | `tela cliente/src/App.tsx` | 856 | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 14 | `MINOR` | `tela cliente/src/App.tsx` | 860 | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 15 | `MINOR` | `frontend/src/components/AdminTopbar.tsx` | 131 | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 16 | `MINOR` | `frontend/src/components/AdminTopbar.tsx` | 205 | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 17 | `MINOR` | `frontend/src/screens/public/PortalNovaReserva.tsx` | 345 | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 18 | `MINOR` | `tela cliente/src/components/CheckoutDrawer.tsx` | 110 | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 19 | `MINOR` | `tela cliente/src/components/MyReservations.tsx` | 297 | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 20 | `MINOR` | `tela cliente/src/components/PixModal.tsx` | 188 | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 21 | `MINOR` | `docs/architecture_map.html` | 428 | `Web:MouseEventWithoutKeyboardEquivalentCheck` | Add a 'onKeyDown/onKeyUp' attribute to this <div> tag. |
| 22 | `MINOR` | `docs/architecture_map.html` | 429 | `Web:MouseEventWithoutKeyboardEquivalentCheck` | Add a 'onKeyDown/onKeyUp' attribute to this <div> tag. |
| 23 | `MINOR` | `docs/architecture_map.html` | 430 | `Web:MouseEventWithoutKeyboardEquivalentCheck` | Add a 'onKeyDown/onKeyUp' attribute to this <div> tag. |
| 24 | `MINOR` | `docs/architecture_map.html` | 431 | `Web:MouseEventWithoutKeyboardEquivalentCheck` | Add a 'onKeyDown/onKeyUp' attribute to this <div> tag. |
| 25 | `MINOR` | `docs/architecture_map.html` | 432 | `Web:MouseEventWithoutKeyboardEquivalentCheck` | Add a 'onKeyDown/onKeyUp' attribute to this <div> tag. |
| 26 | `MAJOR` | `docs/architecture_map.html` | 436 | `Web:InputWithoutLabelCheck` | Associate a valid label to this input field. |
| 27 | `MINOR` | `docs/architecture_map.html` | 585 | `Web:MouseEventWithoutKeyboardEquivalentCheck` | Add a 'onKeyDown/onKeyUp' attribute to this <div> tag. |
| 28 | `MINOR` | `docs/architecture_map.html` | 586 | `Web:MouseEventWithoutKeyboardEquivalentCheck` | Add a 'onKeyDown/onKeyUp' attribute to this <div> tag. |
| 29 | `MINOR` | `frontend/src/screens/public/Checkout.tsx` | 328 | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 30 | `MAJOR` | `frontend/src/assets/css/landing.css` | 667 | `css:S4656` | Duplicate property "display" |
| 31 | `MINOR` | `frontend/src/components/AdminSidebar.tsx` | 41 | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 32 | `MINOR` | `frontend/src/components/Sidebar.tsx` | 49 | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 33 | `MINOR` | `frontend/src/screens/admin/AdminConfiguracoes.tsx` | 1435 | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 34 | `MINOR` | `frontend/src/screens/admin/AdminConfiguracoes.tsx` | 1714 | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 35 | `MINOR` | `frontend/src/screens/admin/AdminConfiguracoes.tsx` | 1715 | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 36 | `MINOR` | `frontend/src/screens/admin/AdminConfiguracoes.tsx` | 1925 | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 37 | `MINOR` | `frontend/src/screens/admin/AdminConfiguracoes.tsx` | 2071 | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 38 | `MINOR` | `frontend/src/screens/admin/AdminConfiguracoes.tsx` | 2072 | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 39 | `MINOR` | `frontend/src/screens/admin/AdminPagamentos.tsx` | 977 | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 40 | `MINOR` | `frontend/src/screens/admin/AdminReservas.tsx` | 1201 | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 41 | `MINOR` | `frontend/src/screens/admin/AdminReservas.tsx` | 1229 | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 42 | `MINOR` | `frontend/src/screens/admin/AdminReservas.tsx` | 1261 | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| 43 | `MINOR` | `frontend/src/components/ui.tsx` | 30 | `typescript:S1082` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |

---

## 🔴 4. Detalhamento dos Problemas Críticos (41 itens)

A maioria dos problemas críticos do SonarCloud no projeto está ligada à **Complexidade Cognitiva Excessiva** (funções muito longas com muitos `if/else`, `try/catch` e loops aninhados) e 1 erro de `await` desnecessário:

| # | Arquivo | Linha | Mensagem |
| :- | :-- | :-: | :-- |
| 1 | `backend/src/jobs/cronSaaS.js` | 8 | Refactor this function to reduce its Cognitive Complexity from 17 to the 15 allowed. |
| 2 | `backend/src/controllers/auditoriaController.js` | 4 | Refactor this function to reduce its Cognitive Complexity from 24 to the 15 allowed. |
| 3 | `backend/src/controllers/reservasController.js` | 42 | Refactor this function to reduce its Cognitive Complexity from 29 to the 15 allowed. |
| 4 | `backend/src/routes/tenantAssinaturaRoutes.js` | 17 | Refactor this function to reduce its Cognitive Complexity from 18 to the 15 allowed. |
| 5 | `backend/src/routes/tenantAssinaturaRoutes.js` | 390 | Refactor this function to reduce its Cognitive Complexity from 18 to the 15 allowed. |
| 6 | `frontend/src/App.tsx` | 41 | Refactor this function to reduce its Cognitive Complexity from 24 to the 15 allowed. |
| 7 | `frontend/src/screens/admin/AdminAssinatura.tsx` | 106 | Refactor this function to reduce its Cognitive Complexity from 71 to the 15 allowed. |
| 8 | `frontend/src/screens/admin/AdminAssinatura.tsx` | 1587 | Refactor this function to reduce its Cognitive Complexity from 27 to the 15 allowed. |
| 9 | `frontend/src/screens/admin/AdminConfiguracoes.tsx` | 66 | Refactor this function to reduce its Cognitive Complexity from 45 to the 15 allowed. |
| 10 | `frontend/src/screens/admin/AdminPagamentos.tsx` | 61 | Refactor this function to reduce its Cognitive Complexity from 28 to the 15 allowed. |
| 11 | `frontend/src/screens/admin/AdminReservas.tsx` | 63 | Refactor this function to reduce its Cognitive Complexity from 43 to the 15 allowed. |
| 12 | `frontend/src/screens/admin/AdminReservas.tsx` | 655 | Refactor this function to reduce its Cognitive Complexity from 22 to the 15 allowed. |
| 13 | `tela cliente/src/App.tsx` | 96 | Refactor this function to reduce its Cognitive Complexity from 18 to the 15 allowed. |
| 14 | `backend/src/controllers/publicController.js` | 355 | Refactor this function to reduce its Cognitive Complexity from 84 to the 15 allowed. |
| 15 | `backend/src/controllers/publicController.js` | 1477 | Refactor this function to reduce its Cognitive Complexity from 19 to the 15 allowed. |
| 16 | `tela cliente/src/App.tsx` | 18 | Refactor this function to reduce its Cognitive Complexity from 16 to the 15 allowed. |
| 17 | `backend/src/controllers/authController.js` | 106 | Refactor this function to reduce its Cognitive Complexity from 32 to the 15 allowed. |
| 18 | `backend/src/controllers/publicController.js` | 858 | Refactor this function to reduce its Cognitive Complexity from 23 to the 15 allowed. |
| 19 | `frontend/src/screens/public/Checkout.tsx` | 82 | Refactor this function to reduce its Cognitive Complexity from 17 to the 15 allowed. |
| 20 | `tela cliente/src/components/CheckoutDrawer.tsx` | 96 | Unexpected `await` of a non-Promise (non-"Thenable") value. |
| 21 | `backend/src/controllers/publicController.js` | 1597 | Refactor this function to reduce its Cognitive Complexity from 28 to the 15 allowed. |
| 22 | `backend/src/services/gatewayService.js` | 28 | Refactor this function to reduce its Cognitive Complexity from 18 to the 15 allowed. |
| 23 | `backend/src/controllers/publicController.js` | 631 | Refactor this function to reduce its Cognitive Complexity from 33 to the 15 allowed. |
| 24 | `backend/src/controllers/publicController.js` | 1018 | Refactor this function to reduce its Cognitive Complexity from 33 to the 15 allowed. |
| 25 | `frontend/src/screens/admin/AdminClientes.tsx` | 29 | Refactor this function to reduce its Cognitive Complexity from 25 to the 15 allowed. |
| 26 | `tela cliente/src/components/LoginScreen.tsx` | 143 | Refactor this function to reduce its Cognitive Complexity from 20 to the 15 allowed. |
| 27 | `backend/src/controllers/publicController.js` | 1120 | Refactor this function to reduce its Cognitive Complexity from 29 to the 15 allowed. |
| 28 | `backend/src/controllers/publicController.js` | 1208 | Refactor this function to reduce its Cognitive Complexity from 39 to the 15 allowed. |
| 29 | `backend/src/controllers/saasController.js` | 996 | Refactor this function to reduce its Cognitive Complexity from 24 to the 15 allowed. |
| 30 | `backend/src/middlewares/auth.js` | 12 | Refactor this function to reduce its Cognitive Complexity from 18 to the 15 allowed. |
| 31 | `frontend/src/screens/MasterConfiguracoes.tsx` | 14 | Refactor this function to reduce its Cognitive Complexity from 22 to the 15 allowed. |
| 32 | `tela cliente/src/components/PixModal.tsx` | 73 | Refactor this function to reduce its Cognitive Complexity from 17 to the 15 allowed. |
| 33 | `backend/src/controllers/pagamentosController.js` | 199 | Refactor this function to reduce its Cognitive Complexity from 16 to the 15 allowed. |
| 34 | `backend/src/routes/gatewayRoutes.js` | 8 | Refactor this function to reduce its Cognitive Complexity from 16 to the 15 allowed. |
| 35 | `backend/src/routes/gatewayRoutes.js` | 174 | Refactor this function to reduce its Cognitive Complexity from 44 to the 15 allowed. |
| 36 | `backend/src/routes/tenantAssinaturaRoutes.js` | 301 | Refactor this function to reduce its Cognitive Complexity from 18 to the 15 allowed. |
| 37 | `frontend/src/screens/MasterArenaDetalhe.tsx` | 17 | Refactor this function to reduce its Cognitive Complexity from 19 to the 15 allowed. |
| 38 | `frontend/src/screens/admin/AdminReservas.tsx` | 852 | Refactor this function to reduce its Cognitive Complexity from 16 to the 15 allowed. |
| 39 | `frontend/src/screens/admin/AdminDashboard.tsx` | 182 | Refactor this function to reduce its Cognitive Complexity from 19 to the 15 allowed. |
| 40 | `frontend/src/screens/admin/AdminReservas.tsx` | 1082 | Refactor this function to reduce its Cognitive Complexity from 28 to the 15 allowed. |
| 41 | `frontend/src/screens/admin/AdminReservas.tsx` | 1180 | Refactor this function to reduce its Cognitive Complexity from 19 to the 15 allowed. |

---

## 🧹 5. Top 15 Regras Mais Frequentes (Code Smells & Padrões)

| Regra Sonar | Ocorrências | Tipo | Severidade | Exemplo de Recomendação |
| :--- | :---: | :---: | :---: | :--- |
| `typescript:S3358` | **81** | `CODE_SMELL` | `MAJOR` | Extract this nested ternary operation into an independent statement. |
| `javascript:S7773` | **72** | `CODE_SMELL` | `MINOR` | Prefer `Number.parseInt` over `parseInt`. |
| `javascript:S6582` | **69** | `CODE_SMELL` | `MINOR` | Prefer using an optional chain expression instead, as it's more concise and easier to read. |
| `typescript:S7773` | **38** | `CODE_SMELL` | `MINOR` | Prefer `Number.isNaN` over `isNaN`. |
| `typescript:S6853` | **36** | `CODE_SMELL` | `MAJOR` | A form label must be associated with a control. |
| `typescript:S1082` | **34** | `BUG` | `MINOR` | Visible, non-interactive elements with click handlers must have at least one keyboard listener. |
| `typescript:S6759` | **32** | `CODE_SMELL` | `MINOR` | Mark the props of the component as read-only. |
| `typescript:S6848` | **27** | `CODE_SMELL` | `MAJOR` | Avoid non-native interactive elements. If using native HTML is not possible, add an appropriate role and support for tabbing, mouse, keyboard, and touch inputs to an interactive content element. |
| `javascript:S7772` | **22** | `CODE_SMELL` | `MINOR` | Prefer `node:fs` over `fs`. |
| `javascript:S3776` | **21** | `CODE_SMELL` | `CRITICAL` | Refactor this function to reduce its Cognitive Complexity from 17 to the 15 allowed. |
| `typescript:S3776` | **19** | `CODE_SMELL` | `CRITICAL` | Refactor this function to reduce its Cognitive Complexity from 24 to the 15 allowed. |
| `typescript:S1128` | **19** | `CODE_SMELL` | `MINOR` | Remove this unused import of 'Sparkles'. |
| `javascript:S2486` | **17** | `CODE_SMELL` | `MINOR` | Handle this exception, don't catch it at all, or explain in a comment why it is ignored. |
| `typescript:S6582` | **17** | `CODE_SMELL` | `MINOR` | Prefer using an optional chain expression instead, as it's more concise and easier to read. |
| `tssecurity:S8475` | **12** | `VULNERABILITY` | `MINOR` | Ensure that tainted data is sanitized before being written to browser storage. |

---

## 📁 6. Top 15 Arquivos com Mais Apontamentos

| Arquivo | Total | 🐛 Bugs | 🛡️ Vulns | 🧹 Code Smells |
| :--- | :---: | :---: | :---: | :---: |
| `backend/src/controllers/publicController.js` | **58** | 0 | 4 | 54 |
| `frontend/src/screens/admin/AdminConfiguracoes.tsx` | **47** | 8 | 0 | 39 |
| `frontend/src/screens/admin/AdminReservas.tsx` | **47** | 3 | 0 | 44 |
| `backend/src/controllers/saasController.js` | **45** | 0 | 3 | 42 |
| `frontend/src/screens/admin/AdminAssinatura.tsx` | **31** | 4 | 0 | 27 |
| `tela cliente/src/App.tsx` | **29** | 4 | 1 | 24 |
| `backend/src/routes/tenantAssinaturaRoutes.js` | **23** | 0 | 0 | 23 |
| `backend/src/services/gatewayService.js` | **20** | 0 | 3 | 17 |
| `docs/architecture_map.html` | **18** | 8 | 0 | 10 |
| `frontend/src/screens/MasterFinanceiro.tsx` | **15** | 0 | 0 | 15 |
| `frontend/src/App.tsx` | **14** | 0 | 6 | 8 |
| `tela cliente/src/components/PixModal.tsx` | **14** | 1 | 2 | 11 |
| `frontend/src/screens/admin/AdminPagamentos.tsx` | **13** | 1 | 0 | 12 |
| `frontend/src/screens/public/PortalNovaReserva.tsx` | **13** | 1 | 0 | 12 |
| `frontend/src/components/ui.tsx` | **13** | 1 | 0 | 12 |

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
