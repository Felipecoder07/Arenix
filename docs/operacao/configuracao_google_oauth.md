# Guia Passo a Passo: Configuração do Google OAuth 2.0 (Tela do Cliente)

Este guia documenta as etapas para ativar a seleção de contas reais do Google na **Tela do Cliente** (`tela cliente`).

---

## 📋 Passo 1: Obter o Client ID no Google Cloud Console

1. Acesse o [Google Cloud Console - Credentials](https://console.cloud.google.com/apis/credentials).
2. Se ainda não tiver um projeto criado, selecione ou crie um projeto (ex: `Arenix` ou `CourtManager`).
3. Clique em **+ Criar credenciais** > **ID do cliente OAuth**.
4. Se solicitado a configurar a *Tela de consentimento OAuth*:
   - Escolha **Externo**.
   - Preencha o nome do app (`Arenix`) e seu e-mail de suporte.
   - Salve e continue.
5. Em **Tipo de aplicativo**, selecione: **Aplicativo da Web**.
6. Em **Origens JavaScript autorizadas**, adicione as URLs:
   - `http://localhost:5176` *(Tela do Cliente local)*
   - `http://localhost:5173` *(Painel do Gestor local)*
   - `http://192.168.0.5:5176` *(Acesso na rede local via celular)*
   - `http://192.168.0.5:5173`
   - *(Adicione também o seu domínio oficial de produção quando estiver no ar, ex: `https://arenix.com.br`)*
7. Clique em **Criar**.
8. Copie o **ID do cliente** gerado (formato: `xxxxxxxxxxxx-xxxxxxxxxxxxxxxx.apps.googleusercontent.com`).

---

## 📋 Passo 2: Inserir a Chave no `.env` da Tela do Cliente

1. Crie ou abra o arquivo `.env` dentro da pasta `tela cliente/`:
   ```bash
   tela cliente/.env
   ```

2. Adicione a seguinte linha substituindo pelo seu Client ID real:
   ```env
   VITE_GOOGLE_CLIENT_ID=SEU_CLIENT_ID_AQUI.apps.googleusercontent.com
   ```

3. Reinicie o servidor da tela do cliente no terminal:
   ```bash
   cd "tela cliente"
   npm run dev
   ```

---

## 🎯 Resultado Esperado
* Ao clicar no botão **"Continuar com o Google"**, abrirá o popup oficial do Google para você selecionar sua conta pessoal/profissional.
* Seu nome, e-mail e foto de perfil do Google serão importados automaticamente para o perfil de atleta.
