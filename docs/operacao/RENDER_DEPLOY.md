# Implantação no Render

Guia do modelo presente em deploy/render-paid.yaml. A existência do modelo não comprova publicação nem homologação. Consulte o [checklist de produção](DEPLOYMENT_CHECKLIST.md).

## Persistência

O projeto usa SQLite. Escolha um serviço com disco persistente e configure APP_DATA_DIR e UPLOADS_DIR com caminhos absolutos dentro do volume. BACKUP_DIR deve apontar para o destino de backups; mantenha também cópia externa. Não use armazenamento efêmero para dados reais.

## Configuração

1. Revise o Blueprint e os custos no provedor antes de aplicá-lo.
2. Configure NODE_ENV=production, JWT_SECRET, FRONTEND_URL e CORS_ALLOWED_ORIGINS para a origem HTTPS publicada. No Render, o código também aceita RENDER_EXTERNAL_URL como fallback de origem.
3. Configure SECRETS_KEYRING e SECRETS_ACTIVE_KEY_ID. Preserve as chaves que decifram dados existentes; não use simultaneamente SECRETS_KEYRING_FILE.
4. Confira LISTEN_HOST, TRUST_PROXY, diretórios persistentes e builds das duas interfaces no modelo.
5. Para uma base nova, configure BOOTSTRAP_MASTER_EMAIL e BOOTSTRAP_MASTER_PASSWORD (12 a 72 bytes) e adapte o comando de inicialização para `node backend/scripts/bootstrap_master.cjs && node backend/src/server.js`. O Blueprint atual inicia somente o servidor. Ele não substitui um Master já existente.
6. Configure Mercado Pago, Google OAuth e SMTP apenas para os fluxos utilizados. Mantenha segredos no ambiente privado.

## Verificação

- Abrir /api/health, a raiz, /athlete/ e /master-login na origem publicada.
- Validar login, logout, upload e reinício sem perda de registros.
- Fazer backup e ensaiar restauração.
- Homologar emissão, confirmação, repetição e estorno no ambiente autorizado do provedor antes de liberar cobranças reais.

O relato anterior de configuração de teste foi preservado no [histórico do Render](../historico/RENDER_DEPLOY_ANTERIOR.md). Ele não é comprovação da disponibilidade atual do endereço citado.
