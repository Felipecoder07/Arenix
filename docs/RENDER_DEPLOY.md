# Publicação no Render (quando houver orçamento)

O arquivo `deploy/render-paid.yaml` é um modelo futuro para criar um único Web Service
para painel, portal do atleta e API. Ele não é aplicado automaticamente.
O Render fornece a URL HTTPS `*.onrender.com`; não é necessário comprar domínio.
Este projeto usa SQLite, por isso o serviço precisa de um plano pago com disco
persistente. A opção Free não conserva o banco nem as imagens após reinícios.
Não crie esse Blueprint enquanto quiser permanecer sem custo. Uma publicação
gratuita do sistema completo perderia reservas, contas e histórico de pagamentos
quando o serviço reiniciar ou for atualizado. O PostgreSQL gratuito do Render
também não resolve este projeto sem migração de banco e expira após 30 dias.

## Antes de criar o serviço

1. Enviar as mudanças revisadas deste repositório para o GitHub. Arquivos `.env`,
   bancos SQLite e `.local-security` não devem ser enviados.
2. No Render, conectar a conta GitHub e criar um **Blueprint** a partir do
   `deploy/render-paid.yaml`. Conferir o plano pago e o disco de 1 GB antes de aceitar a cobrança.
3. Quando solicitado, preencher `SECRETS_KEYRING` com JSON contendo uma chave
   aleatória hexadecimal de 64 caracteres, por exemplo
   `{"render1":"<64 caracteres hex gerados localmente>"}`. Guardar uma cópia
   segura fora do Render. Não enviar a chave pelo chat nem trocar o valor após
   cifrar credenciais no banco.
4. Confirmar que o serviço recebeu `RENDER_EXTERNAL_URL`, `JWT_SECRET` e o disco
   montado em `/var/data`. `FRONTEND_URL` e CORS usam automaticamente essa URL.

O primeiro deploy usa banco novo. Não copiar o banco local de desenvolvimento:
ele contém dados de teste e precisa de uma migração e conciliação separadas.
O deploy automático fica desligado no Blueprint para proteger mudanças financeiras.

## Verificação antes de pagamentos reais

- Abrir `/api/health`, a página inicial e `/athlete/` na URL HTTPS criada.
- Criar uma conta administradora de teste e verificar login, logout e reinício
  do serviço sem perda de dados. Conferir também um upload de imagem.
- Configurar credenciais produtivas do Mercado Pago no Render/painel Master,
  nunca no GitHub. Cadastrar a URL definitiva de webhook de pagamentos e sua
  assinatura secreta no Mercado Pago.
- Configurar Google OAuth e SMTP se esses recursos forem usados no ensaio.
- Fazer backup externo do banco antes de cobrar dinheiro real; o diretório de
  backup no mesmo disco não protege contra perda do disco inteiro.
- Só então fazer um Pix real de valor pequeno, conferir aprovação, baixa única e
  estorno. O serviço publicado não é considerado homologado até esse teste.


O banco novo não tinha um Master. Já enviei a criação desse acesso, no commit 6d25a51, e os testes passaram.

No Render:

1. Em Environment, adicione:

   | Key | Value |
   |---|---|
   | BOOTSTRAP_MASTER_EMAIL | Seu e-mail para acessar o Master |
   | BOOTSTRAP_MASTER_PASSWORD | Uma senha exclusiva com pelo menos 12 caracteres |

   Use um e-mail diferente da conta de dono de arena. Preencha a senha diretamente no Render.
2. Em Settings → Start Command, coloque:

   node backend/scripts/bootstrap_master.cjs && node backend/src/server.js
3. Salve e faça Manual Deploy → Deploy latest commit.
4. Quando estiver Live, acesse https://arenix-teste.onrender.com/master-login e entre com o e-mail e a senha definidos.

Mantenha essas variáveis durante os testes: se o Render gratuito apagar o banco, elas permitirão recriar o Master. Se ele já existir, a inicialização preserva a conta.