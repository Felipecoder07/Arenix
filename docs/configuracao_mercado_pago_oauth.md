# Conexão do Mercado Pago no ambiente local

O retorno precisa chegar ao mesmo backend que iniciou a conexão. A URL anteriormente configurada, `https://arenix.com.br/api/pagamentos/gateway/oauth/callback`, respondia 404 e não acessava o backend local.

Configuração local em `backend/.env`:

```dotenv
MERCADO_PAGO_REDIRECT_URI=http://localhost:3000/api/pagamentos/gateway/oauth/callback
FRONTEND_URL=http://localhost:5174
```

1. Em Mercado Pago Developers → Suas integrações → aplicação usada pela plataforma → URLs de redirecionamento, cadastre exatamente a mesma URL do `MERCADO_PAGO_REDIRECT_URI`.
2. Caso a aplicação exija HTTPS, use uma URL HTTPS de desenvolvimento que encaminhe o caminho de callback para o backend local na porta 3000. Cadastre essa URL no Mercado Pago e no `.env`. Não utilize o domínio antigo que retorna 404.
3. Reinicie o backend se ele não estiver sendo executado com recarga automática. Reabra o painel e clique novamente em conectar. O link anterior pode conter o endereço antigo ou um estado OAuth já utilizado.
4. Faça a autorização no próprio Mercado Pago. O sistema troca o código no servidor e retorna ao painel local. Não compartilhe códigos ou tokens na conversa.

A porta 5174 serve este painel na sessão local verificada; a porta 5173 está ocupada por outro aplicativo. O retorno acima usa diretamente a porta 3000 da API. Se a porta do painel mudar, ajuste `FRONTEND_URL`. Em produção, configure uma URL HTTPS do backend publicado e a URL real do painel, sem localhost.

Documentação oficial: https://www.mercadopago.com.br/developers/pt/docs/security/oauth/creation
