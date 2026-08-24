# 🚀 Guia Oficial de Deploy em Produção (Arenix SaaS)

Este documento contém o checklist passo a passo para colocar o sistema **Arenix** no ar em produção utilizando **Vercel**, **Render**, **Supabase / PostgreSQL**, **Google Cloud OAuth** e a integração **Mercado Pago OAuth2**.

---

## 1. 🌐 Compra e Configuração de Domínio (Registro.br)
- [ ] Comprar o domínio oficial da plataforma (ex: `arenix.com.br`) no site [Registro.br](https://registro.br).
- [ ] Configurar os apontamentos DNS no provedor (Cloudflare ou Registro.br):
  - `arenix.com.br` / `app.arenix.com.br` → Vercel (CNAME `cname.vercel-dns.com`)
  - `api.arenix.com.br` → Render (CNAME fornecido pelo Render)

---

## 2. ⚡ Front-ends (Vercel)

### 2.1 Painel Admin & Master (`frontend`)
- [ ] Importar a pasta `frontend` na Vercel como projeto.
- [ ] Vincular o domínio customizado: `https://arenix.com.br` (ou `https://app.arenix.com.br`).
- [ ] Configurar as variáveis de ambiente na Vercel:
  ```env
  VITE_API_URL=https://api.arenix.com.br
  ```

### 2.2 Tela Cliente & Portal de Agendamentos (`tela cliente`)
- [ ] Importar a pasta `tela cliente` na Vercel como projeto.
- [ ] Vincular o domínio customizado (ex: `https://arenix.com.br` ou subdomínio de agendamentos).
- [ ] Configurar as variáveis de ambiente na Vercel:
  ```env
  VITE_API_URL=https://api.arenix.com.br
  VITE_GOOGLE_CLIENT_ID=SEU_GOOGLE_CLIENT_ID_DE_PRODUCAO.apps.googleusercontent.com
  ```

---

## 3. 🖥️ Back-end (Render / Railway / VPS)
- [ ] Importar a pasta `backend` no Render como **Web Service**.
- [ ] Vincular o subdomínio customizado: `https://api.arenix.com.br`.
- [ ] Configurar as variáveis de ambiente na aba **Environment Variables** do Render:
  ```env
  PORT=3000
  NODE_ENV=production
  APP_TIMEZONE=America/Sao_Paulo

  # 🔐 Segredo Criptográfico de Autenticação JWT (OBRIGATÓRIO: 64 caracteres aleatórios)
  # Gere com: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  JWT_SECRET=coloque_aqui_uma_chave_secreta_longa_e_aleatoria_com_64_caracteres

  # 🛡️ Segurança CORS (Restringe o acesso da API aos seus domínios oficiais)
  CORS_ORIGIN=https://arenix.com.br,https://app.arenix.com.br

  # 💳 Mercado Pago Oficial (OAuth Master & Webhooks)
  MERCADO_PAGO_CLIENT_ID=2589270084205181
  MERCADO_PAGO_CLIENT_SECRET=LgbSaY6JeSawxcoQrNLZTHRTiEpnhmmO
  MERCADO_PAGO_REDIRECT_URI=https://api.arenix.com.br/api/pagamentos/gateway/oauth/callback
  ```

---

## 4. 🗄️ Banco de Dados & Escalabilidade (SQLite vs PostgreSQL)

### 4.1 Fase Inicial (SQLite3)
- O SQLite é extremamente rápido, simples e atende com excelência a fase inicial com dezenas de arenas e milhares de agendamentos diários.
- Para produção com SQLite no Render, certifique-se de configurar um **Persistent Disk** montado em `/var/data` para que o arquivo `database.sqlite` não seja resetado a cada novo deploy.

### 4.2 Fase de Alta Escala (Supabase / PostgreSQL)
- **Quando migrar:** Quando a plataforma atingir centenas de arenas ativas gerando reservas simultâneas no mesmo segundo (eliminando qualquer risco de concorrência/lock contention de arquivo).
- [ ] Criar projeto PostgreSQL no [Supabase](https://supabase.com).
- [ ] Configurar a string de conexão no `.env`:
  ```env
  DATABASE_URL=postgresql://postgres:[SENHA]@[HOST]:5432/postgres
  ```
- [ ] Executar o script de inicialização de tabelas (`init_db.js`).

---

## 5. 🔑 Google Cloud Console (OAuth 2.0 Atletas)
- [ ] Acessar o [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
- [ ] Na credencial **ID do cliente OAuth 2.0**, em **Origens JavaScript autorizadas**, adicionar os domínios de produção:
  - `https://arenix.com.br`
  - `https://app.arenix.com.br`
- [ ] Em **URIs de redirecionamento autorizados**, adicionar:
  - `https://arenix.com.br`
  - `https://app.arenix.com.br`

---

## 6. 💳 Mercado Pago Developers (Painel de Integração)
- [ ] Acessar [mercadopago.com.br/developers/panel/app](https://www.mercadopago.com.br/developers/panel/app).
- [ ] Na aplicação **Volei System**, ir em **Configurações da aplicação**.
- [ ] Garantir que a URL de produção oficial esteja cadastrada:
  `https://api.arenix.com.br/api/pagamentos/gateway/oauth/callback`
- [ ] Em **Notificações Webhooks**, cadastrar a URL de recebimento de notificações do Master:
  `https://api.arenix.com.br/api/saas/webhook/mercadopago`
