# Preparação para produção — Arenix

Revisado em 08/10/2026 com base no código atual. O responsável adiou esta etapa externa; domínio e hospedagem ainda não foram definidos. Este roteiro não registra publicação nem aprovação para produção.

## Credencial exposta no guia anterior

- [x] Remover o valor literal de `MERCADO_PAGO_CLIENT_SECRET` deste guia.
- [ ] Revogar/rotacionar no Mercado Pago a credencial que constava neste arquivo, caso ainda esteja válida, e atualizar a configuração privada da aplicação. A remoção atual não elimina cópias ou histórico do Git. Nenhuma revogação foi executada nesta revisão.

## Destino e armazenamento

- [ ] Definir domínio, servidor e responsável operacional.
- [ ] Preparar a base de produção sem importar como receita/contratação as faturas 18 a 24 da arena 1, confirmadas pelo responsável como testes. A classificação foi registrada em auditoria local, mas não filtra os relatórios da aplicação.
- [ ] Persistir **`backend/data/courtmanager.sqlite`**, uploads e backups. O caminho SQLite é fixo no código; montar apenas `/var/data` não redireciona o banco.
- [ ] Publicar as interfaces com `/api` e `/uploads` encaminhados ao backend na própria origem. `VITE_API_URL` não configura a autenticação atual; sites separados precisam de proxy em cada origem.
- [ ] Adaptar e validar `deploy/nginx.conf.template`, `deploy/arenix.service.example` e a [topologia do proxy](proxy-topology.md) no servidor escolhido.

O código utiliza SQLite. Definir `DATABASE_URL` ou executar `init_db.js` não migra a aplicação para PostgreSQL/Supabase. Essa migração exigiria implementação própria.

## Configuração privada do serviço

Usar `backend/.env.example` como referência, sem sobrescrever as credenciais locais.

| Configuração | Exigência |
| --- | --- |
| `NODE_ENV` | `production` |
| `JWT_SECRET` | Valor aleatório próprio, sem exemplos/fixtures |
| `FRONTEND_URL` | Origem HTTPS real do painel |
| `CORS_ALLOWED_ORIGINS` | Origens HTTPS exatas; `CORS_ORIGIN` não é lida |
| `LISTEN_HOST` | IP específico; no modelo Nginx local, `127.0.0.1` |
| `TRUST_PROXY` | IPs/CIDRs reais dos proxies; no modelo local, `127.0.0.1/32` |
| `APP_TIMEZONE` | `America/Sao_Paulo`, salvo decisão operacional diferente |
| `SECRETS_KEYRING_FILE` e `SECRETS_ACTIVE_KEY_ID` | Chaves protegidas fora da aplicação; preservar as que decifram dados existentes |
| `BACKUP_DIR` | Diretório privado, fora da raiz pública |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS` | Conta transacional autorizada |
| `GOOGLE_CLIENT_ID` e `VITE_GOOGLE_CLIENT_ID` | IDs correspondentes e origens autorizadas |
| `ENABLE_PUBLIC_BOOKING_CARD` | `false` no lançamento Pix |

As credenciais Mercado Pago do Master são lidas prioritariamente do banco cifrado. Um valor vazio persistido desativa o fallback para ambiente: preencher apenas o `.env` pode não habilitar a integração. Configurar e conferir pelo painel Master, mantendo separados o token SaaS e a conta de cada arena.

## Builds e inicialização

Para o modelo de uma origem:

```powershell
npm.cmd run build --prefix frontend
npm.cmd run build --prefix "tela cliente" -- --base=/athlete/
npm.cmd run check:public
```

Publicar `frontend/dist` na raiz estática e `tela cliente/dist` em `/athlete/`. Publicar apenas os builds; banco, fontes, `.env`, keyring e backups ficam fora da raiz pública.

- [ ] Instalar dependências pelos lockfiles e iniciar uma única instância do backend no modelo atual. O cron é iniciado dentro do processo.
- [ ] Criar backup consistente e ensaiar migrações em cópia antes de atualizar o banco ativo.
- [ ] Confirmar `FaturasSaaS.gateway_estornado_ref`, adicionada pela inicialização, antes de liberar pagamentos. A proteção não reconstrói estornos anteriores à migração.
- [ ] Validar DNS, certificados, `nginx -t`, as duas interfaces e reinício automático; bloquear acesso público direto à porta Node.
- [ ] Habilitar HSTS depois de comprovar HTTPS no destino.

## Provedores e homologação

| Finalidade | Rota implementada |
| --- | --- |
| Callback OAuth da arena | `/api/pagamentos/gateway/oauth/callback` |
| Webhook das reservas | `/api/pagamentos/gateway/webhook` |
| Webhook da assinatura SaaS | `/api/saas/webhook-pagamento` |

Usar o host HTTPS que encaminha essas rotas ao backend. Configurar `MERCADO_PAGO_REDIRECT_URI` com o callback completo e o segredo de webhook correspondente. A rota `/api/saas/webhook/mercadopago` do guia antigo não existe.

- [ ] Validar OAuth da arena, retorno e conta recebedora.
- [ ] Comprovar Pix aprovado, baixa, repetição sem crédito duplicado, recuperação após falha e estorno, tanto nas reservas quanto no SaaS.
- [ ] Validar expiração/cancelamento e a orientação quando uma cobrança precisar de regularização.
- [ ] Enviar convite, recuperação e aviso a destinatário de teste autorizado; conferir entrega e links.
- [ ] Repetir login Google no domínio publicado. O fluxo local do atleta foi comprovado em 23/09; as origens de produção ainda precisam ser autorizadas.

O lançamento definido é somente Pix. Cartão e Point dependem de decisão e homologação próprias. Ver [liberação Pix](PIX_LIBERACAO_2026-09-29.md). A API Payments exige chave de idempotência e permite definir validade do Pix: [documentação oficial](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-payments/integration-configuration/integrate-pix). Testes locais com respostas controladas não comprovam pagamento aprovado pelo provedor.

## Operação e liberação

### Correção Pix — atualização de 12/10/2026

Implementação local registrada no [plano Pix](PLANO_IMPLEMENTACAO_CORRECAO_PIX_2026-10-10.md). Validação automatizada aprovada em 12/10: 660 testes, tipos, builds, lint e ativos públicos; relatório `artifacts/homologacao/2026-10-12T16-52-44-449Z/summary.json`. Snapshot identificado e banco isolado; migração ensaiada em cópia. Os bancos existentes não foram migrados nem conciliados. Homologação externa não aprovada: faltam configuração master/OAuth, investigação conclusiva do erro 2034 e evidências externas de pagamento/webhook/estorno. Configuração adicional adiada pelo responsável.

- [ ] Ensaiar restauração em cópia isolada; verificar integridade e leitura dos segredos com as chaves correspondentes, guardadas separadamente.
- [ ] Conferir cookies, CSRF, logout, permissões e proteção de arquivos privados no domínio final.
- [ ] Monitorar saúde, falhas de cobrança/webhook, filas, espaço em disco, cron e backups.
- [ ] Conciliar dados históricos; pagamentos simulados não comprovam recebimento real.
- [ ] Registrar evidências e responsável por cada critério antes de liberar clientes reais.

Detalhes: [operação de segurança](security-operations-2026-09-21.md) e [homologação](HOMOLOGACAO.md).
