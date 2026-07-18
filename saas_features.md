# Funcionalidades do Painel SaaS Master (SuperAdmin)

## ✅ Já Implementado
- Login seguro e oculto (`master-login.html`)
- Dashboard com métricas globais básicas (total de arenas, ativas, clientes)
- Listagem de todas as arenas
- Bloqueio/desbloqueio de arena (corta o acesso de todos da arena)

---

## 📋 Gestão de Arenas (Tenants)
| Funcionalidade | Descrição |
|---|---|
| **Cadastrar nova arena manualmente** | O master cria uma arena via painel (sem precisar do formulário de cadastro público) |
| **Editar dados da arena** | Nome, e-mail, telefone, endereço |
| **Excluir arena** | Soft-delete com confirmação de senha |
| **Ver detalhes de uma arena** | Entrar em modo "inspeção" de uma arena específica |
| **Filtrar/Buscar arenas** | Por nome, status, data de criação, plano |

---

## 💰 Financeiro / Assinaturas (SaaS Billing)
| Funcionalidade | Descrição |
|---|---|
| **Planos de assinatura** | Definir planos (Basic, Pro, Enterprise) com limites de quadras/usuários |
| **Atribuir plano a uma arena** | Mudar o plano de uma arena no painel |
| **Registrar pagamento de mensalidade** | Marcar manualmente que uma arena pagou |
| **Histórico de pagamentos por arena** | Ver todas as faturas e status (pago/pendente/atrasado) |
| **Alertas de inadimplência** | Arenas com fatura atrasada X dias ficam marcadas em laranja/vermelho |
| **Bloqueio automático por inadimplência** | Sistema bloqueia arena após N dias sem pagamento |
| **Receita MRR (Monthly Recurring Revenue)** | Métrica: Quanto o SaaS está faturando por mês |

---

## 📊 Dashboard de Métricas Globais
| Funcionalidade | Descrição |
|---|---|
| **Total de arenas** | Ativas, bloqueadas, em período de teste |
| **Crescimento mensal de arenas** | Quantas arenas novas por mês (gráfico de linha) |
| **Total de quadras cadastradas** | Em toda a plataforma |
| **Total de reservas na plataforma** | Hoje, esta semana, este mês |
| **Total de jogadores (Clientes)** | Em toda a plataforma |
| **Taxa de Churn** | Arenas que cancelaram / foram desativadas |
| **Receita total estimada** | MRR da plataforma |

---

## 👤 Gestão de Usuários (Cross-Tenant)
| Funcionalidade | Descrição |
|---|---|
| **Listar todos os usuários da plataforma** | Com filtro por arena, perfil, status |
| **Ver usuários de uma arena específica** | Quem são os admins, gerentes e recepcionistas |
| **Desativar usuário específico** | Sem deletar a conta |
| **Resetar senha de um usuário** | Gerar link ou nova senha temporária |
| **Auditar logins de uma arena** | Ver os últimos acessos de uma arena |

---

## 📣 Comunicação
| Funcionalidade | Descrição |
|---|---|
| **Enviar notificação para uma arena** | E-mail ou alerta no sistema (ex: "Sua fatura vence em 3 dias") |
| **Enviar notificação para todas as arenas** | Broadcast de avisos, manutenções, novidades |
| **Área de avisos** | Banner que aparece no painel da arena com mensagem do master |

---

## 🛡️ Segurança e Auditoria Global
| Funcionalidade | Descrição |
|---|---|
| **Log de ações do próprio master** | Quais arenas foram bloqueadas, quando, quem fez |
| **Ver logs de auditoria de qualquer arena** | Inspeção cruzada de tenants |
| **Sessões ativas** | Ver quais arenas têm usuários logados agora |
| **Alterar própria senha master** | Com verificação dupla |

---

## ⚙️ Configurações da Plataforma
| Funcionalidade | Descrição |
|---|---|
| **Definir período de trial** | Quantos dias uma nova arena experimenta grátis |
| **Configurar motivos de cancelamento padrão** | Os 3 motivos globais que toda arena herda |
| **Versão do sistema** | Exibir qual versão está rodando |
| **Modo manutenção global** | Derrubar o sistema para todos os tenants com uma mensagem de manutenção |

---

## 🏷️ Prioridade Sugerida de Implementação

1. 🔴 **Alta** — Gestão de arenas completa (editar, excluir, ver detalhes)
2. 🔴 **Alta** — Financeiro/assinaturas (registrar pagamento, bloqueio automático, histórico)
3. 🟠 **Média** — Dashboard de métricas completo com gráficos
4. 🟠 **Média** — Comunicação (notificações para arenas)
5. 🟡 **Baixa** — Auditoria global cruzada
6. 🟡 **Baixa** — Configurações da plataforma
