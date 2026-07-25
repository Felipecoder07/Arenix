# 🚀 Guia Oficial de Deploy em Produção (Arenix SaaS)

Este documento contém o checklist passo a passo para colocar o sistema **Arenix** no ar em produção utilizando **Vercel**, **Render**, **Supabase** e a integração **Mercado Pago OAuth2**.

---

## 1. 🌐 Compra do Domínio (Registro.br)
- [ ] Comprar o domínio oficial da plataforma (ex: `arenix.com.br`) no site [Registro.br](https://registro.br).

---

## 2. ⚡ Front-end (Vercel)
- [ ] Importar a pasta `master-templates` na Vercel.
- [ ] Vincular o domínio customizado: `https://arenix.com.br` (ou `https://app.arenix.com.br`).
- [ ] Configurar a variável de ambiente no Vercel:
  ```env
  VITE_API_URL=https://api.arenix.com.br
  ```

---

## 3. 🖥️ Back-end (Render)
- [ ] Importar a pasta `backend` no Render como **Web Service**.
- [ ] Vincular o subdomínio customizado: `https://api.arenix.com.br`.
- [ ] Configurar as variáveis de ambiente na aba **Environment Variables** do Render:
  ```env
  PORT=3000
  APP_TIMEZONE=America/Sao_Paulo
  MERCADO_PAGO_CLIENT_ID=2589270084205181
  MERCADO_PAGO_CLIENT_SECRET=LgbSaY6JeSawxcoQrNLZTHRTiEpnhmmO
  MERCADO_PAGO_REDIRECT_URI=https://api.arenix.com.br/api/pagamentos/gateway/oauth/callback
  ```

---

## 4. 🗄️ Banco de Dados (Supabase)
- [ ] Criar projeto PostgreSQL no Supabase.
- [ ] Executar o script de inicialização de tabelas (`init_db.js`).

---

## 5. 🔑 Mercado Pago Developers (Painel de Integração)
- [ ] Acessar [mercadopago.com.br/developers/panel/app](https://www.mercadopago.com.br/developers/panel/app).
- [ ] Na aplicação **Volei System**, ir em **Configurações da aplicação**.
- [ ] Garantir que a URL de produção oficial esteja cadastrada:
  `https://api.arenix.com.br/api/pagamentos/gateway/oauth/callback`
