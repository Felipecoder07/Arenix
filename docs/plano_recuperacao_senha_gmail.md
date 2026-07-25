# Plano de Implementação - Recuperação de Senha por E-mail (MFA/SMTP)

Este documento descreve as especificações técnicas para automatizar o fluxo completo de redefinição de senha via token seguro enviado por e-mail, cobrindo o modelo de banco de dados, a lógica da API back-end, o provedor SMTP e as interfaces em React.

---

## Engenharia & Segurança (Melhores Práticas)

1.  **Segurança do Token:** O token de redefinição será gerado usando o módulo criptográfico nativo do Node.js (`crypto.randomBytes`) gerando 32 bytes em formato hexadecimal (um token altamente seguro e impossível de adivinhar).
2.  **Validade de Sessão:** O token terá expiração rígida de **1 hora**. Após esse prazo, o SQLite recusará a redefinição, exigindo uma nova solicitação.
3.  **Prevenção de Enumeração de Usuários:** A rota de solicitação de recuperação responderá sempre com a mesma mensagem de sucesso, existindo ou não o e-mail informado. Isso impede que robôs descubram e-mails cadastrados no sistema.
4.  **Uso único:** Assim que a senha for alterada com sucesso, o token correspondente será deletado do banco de dados para evitar reuso (ataques de replay).

---

## Proposta de Alterações

### 1. Banco de Dados

#### [MODIFY] [init_db.js](file:///c:/Users/Mateus/Downloads/Volei%20System/backend/src/config/init_db.js)
*   Adicionar as colunas de controle na tabela `Usuarios`:
    *   `recuperar_token TEXT NULL`
    *   `recuperar_expira DATETIME NULL`
*   Garantir a execução da migração automática ao iniciar o servidor.

---

### 2. Back-end (API & SMTP)

#### [NEW] [emailService.js](file:///c:/Users/Mateus/Downloads/Volei%20System/backend/src/utils/emailService.js)
*   Criar o utilitário de e-mail transacional usando a biblioteca `nodemailer`.
*   Carregar variáveis de ambiente do `.env`:
    *   `SMTP_HOST` (ex: `smtp.gmail.com`)
    *   `SMTP_PORT` (ex: `465`)
    *   `SMTP_USER` (e-mail do suporte/sistema)
    *   `SMTP_PASS` (senha de aplicativo gerada no painel do Google)

#### [MODIFY] [authController.js](file:///c:/Users/Mateus/Downloads/Volei%20System/backend/src/controllers/authController.js)
*   Implementar `requestPasswordRecovery`:
    *   Recebe `{ email }`.
    *   Se o usuário for encontrado, gera o token hexadecimal (`crypto.randomBytes(32).toString('hex')`) e expiração (`datetime('now', '+1 hour')`).
    *   Grava no banco.
    *   Envia o e-mail com o link contendo o token para o e-mail do usuário.
*   Implementar `resetPassword`:
    *   Recebe `{ token, nova_senha }`.
    *   Valida se a nova senha tem pelo menos 8 caracteres.
    *   Busca no banco o usuário com o token ativo e cuja expiração é superior a `datetime('now')`.
    *   Se válido, gera o novo hash da senha (`bcrypt.hash`) e limpa as colunas do token.

#### [MODIFY] [authRoutes.js](file:///c:/Users/Mateus/Downloads/Volei%20System/backend/src/routes/authRoutes.js)
*   Registrar as novas rotas públicas da API:
    *   `POST /api/auth/recuperar-senha` (Solicitação)
    *   `POST /api/auth/redefinir-senha` (Aplicação)

---

### 3. Front-end (React)

#### [MODIFY] [ForgotPassword.tsx](file:///c:/Users/Mateus/Downloads/Volei%20System/master-templates/src/screens/public/ForgotPassword.tsx)
*   Conectar o formulário existente para fazer um `fetch` real do endpoint `POST /api/auth/recuperar-senha`.
*   Tratar o status de envio para exibir as mensagens de carregamento e sucesso de forma nativa baseada na resposta da API.

#### [NEW] [ResetPassword.tsx](file:///c:/Users/Mateus/Downloads/Volei%20System/master-templates/src/screens/public/ResetPassword.tsx)
*   Criar a interface onde o usuário digita e confirma a nova senha.
*   Extrair o token da URL (`token = queryParams.get('token')`).
*   Validar no cliente se as senhas coincidem e se respeitam o limite mínimo de 8 caracteres.
*   Fazer chamada de `POST /api/auth/redefinir-senha` e exibir feedback visual de conclusão, redirecionando o usuário para `/login`.

#### [MODIFY] [App.tsx](file:///c:/Users/Mateus/Downloads/Volei%20System/master-templates/src/App.tsx)
*   Registrar a rota pública do formulário de redefinição:
    *   `Route path="/redefinir-senha" element={<ResetPassword />}`

---

## Plano de Verificação

1.  **Teste de Envio de E-mail:** Executar o fluxo informando um e-mail de teste e verificar na caixa de entrada se a mensagem de recuperação chega com o link correto.
2.  **Teste de Expiração de Token:** Gerar um token no banco e tentar redefinir a senha simulando um prazo superior a 1 hora (deve ser rejeitado com erro).
3.  **Teste de Mudança de Credenciais:** Confirmar a alteração, deslogar e tentar realizar o login com a senha antiga (deve falhar) e depois com a nova senha (deve logar com sucesso).
