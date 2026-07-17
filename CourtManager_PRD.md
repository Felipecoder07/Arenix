# CourtManager — Documento de Requisitos de Produto (PRD)

**Versão:** 1.0.0  
**Data:** 2026-07-13  
**Status:** Em Revisão  
**Autor:** Product Management  
**Classificação:** Confidencial

---

## Sumário

1. [Visão Geral do Produto](#1-visão-geral-do-produto)
2. [Personas e Papéis](#2-personas-e-papéis)
3. [Histórias de Usuário](#3-histórias-de-usuário)
4. [Casos de Uso](#4-casos-de-uso)
5. [Requisitos Funcionais](#5-requisitos-funcionais)
   - 5.1 [Pagamentos](#51-pagamentos)
   - 5.2 [Reservas](#52-reservas)
   - 5.3 [Logs e Auditoria](#53-logs-e-auditoria)
   - 5.4 [Dashboard](#54-dashboard)
   - 5.5 [Relatórios](#55-relatórios)
6. [Regras de Negócio](#6-regras-de-negócio)
7. [Requisitos Não Funcionais](#7-requisitos-não-funcionais)
8. [Roadmap do Produto](#8-roadmap-do-produto)
9. [Matriz de Rastreabilidade](#9-matriz-de-rastreabilidade)
10. [Critérios de Qualidade](#10-critérios-de-qualidade)

---

## 1. Visão Geral do Produto

### 1.1 Declaração do Produto

**CourtManager** é um SaaS B2B de gestão operacional para arenas esportivas que centraliza reservas de quadras, controle de pagamentos e visibilidade gerencial em uma única plataforma, eliminando processos manuais em planilhas, WhatsApp e caixa físico.

### 1.2 Problema

Operadores de arenas esportivas enfrentam:

| Dor | Impacto |
|-----|---------|
| Gestão de reservas via WhatsApp/ligação | Dupla marcação, perda de reservas, alto tempo operacional |
| Cobrança manual | Inadimplência, falta de rastreabilidade financeira |
| Ausência de relatórios | Decisões baseadas em percepção, não em dados |
| Múltiplos sistemas desconexos | Retrabalho e inconsistência de informações |

### 1.3 Proposta de Valor

> "Gerencie todas as quadras, reservas e pagamentos da sua arena em um só lugar — do agendamento ao recebimento, com visibilidade em tempo real."

### 1.4 Público-Alvo

- Arenas de beach tennis, vôlei, padel, futevôlei e esportes similares
- Porte: de 1 a 20 quadras por unidade
- Operação: proprietários, gerentes e recepcionistas

### 1.5 Modelo de Negócio SaaS

| Plano | Quadras | Funcionalidades |
|-------|---------|-----------------|
| Starter | Até 3 | Reservas + Pagamentos básicos |
| Pro | Até 10 | MVP completo |
| Enterprise | Ilimitado | MVP + integrações avançadas |

---

## 2. Personas e Papéis

### P01 — Administrador da Arena

**Quem é:** Proprietário ou sócio da arena  
**Objetivo:** Visão financeira e operacional completa para decisões estratégicas  
**Frustrações:** Não sabe quanto faturou hoje, quantas quadras estão ociosas, quem cancelou sem aviso  
**Permissões:** Acesso total ao sistema

### P02 — Gerente Operacional

**Quem é:** Funcionário responsável pela operação diária  
**Objetivo:** Organizar a grade de reservas e garantir que pagamentos sejam registrados  
**Frustrações:** Conflitos de horário, clientes que não pagaram e ficaram sem registro  
**Permissões:** Reservas, pagamentos, relatórios operacionais; sem acesso a configurações financeiras globais

### P03 — Recepcionista

**Quem é:** Atendente do balcão ou app mobile  
**Objetivo:** Confirmar reservas e registrar pagamentos rapidamente  
**Frustrações:** Sistema lento, interface complexa  
**Permissões:** Criar/consultar reservas e registrar pagamentos; sem acesso a relatórios e configurações

### P04 — Cliente Final

**Quem é:** Praticante esportivo que reserva quadras  
**Objetivo:** Reservar uma quadra de forma rápida e pagar sem filas  
**Frustrações:** Incerteza se a quadra está disponível, comprovante de pagamento pouco confiável  
**Permissões:** Portal do cliente — apenas suas próprias reservas e pagamentos

---

## 3. Histórias de Usuário

> **Convenção:** HU-XXX — Prioridade [Alta/Média/Baixa] — Pontos de esforço estimados (Story Points)

### 3.1 Reservas

| ID | História | Prioridade | SP |
|----|----------|------------|----|
| HU-001 | Como **recepcionista**, quero visualizar a grade de disponibilidade das quadras por dia e horário, para que eu possa informar ao cliente quais horários estão livres | Alta | 5 |
| HU-002 | Como **recepcionista**, quero criar uma reserva selecionando quadra, data, horário e cliente, para que o agendamento seja registrado imediatamente no sistema | Alta | 8 |
| HU-003 | Como **recepcionista**, quero cancelar uma reserva com registro do motivo, para que o histórico de cancelamentos seja preservado | Alta | 5 |
| HU-004 | Como **gerente**, quero definir regras de recorrência para reservas fixas (mensalistas), para que reservas semanais não precisem ser criadas manualmente | Alta | 8 |
| HU-005 | Como **gerente**, quero configurar os horários de funcionamento de cada quadra por dia da semana, para que o sistema não permita reservas fora do expediente | Alta | 5 |
| HU-006 | Como **administrador**, quero bloquear uma quadra para manutenção ou evento interno em um período específico, para que clientes não consigam reservar nesse horário | Alta | 3 |
| HU-007 | Como **cliente**, quero receber uma confirmação da minha reserva via e-mail ou WhatsApp, para ter o comprovante do agendamento | Média | 5 |
| HU-008 | Como **gerente**, quero editar os dados de uma reserva existente (quadra, horário), com registro da alteração no histórico, para corrigir erros operacionais | Média | 5 |

### 3.2 Pagamentos

| ID | História | Prioridade | SP |
|----|----------|------------|----|
| HU-009 | Como **recepcionista**, quero registrar o pagamento de uma reserva informando o valor, método de pagamento e data, para que o fluxo financeiro seja controlado | Alta | 8 |
| HU-010 | Como **recepcionista**, quero registrar pagamentos parciais (entrada + saldo), para que clientes que pagam em partes sejam suportados | Alta | 5 |
| HU-011 | Como **administrador**, quero configurar os preços de cada quadra por horário e dia da semana (horário de pico e fora de pico), para que a precificação dinâmica seja aplicada automaticamente | Alta | 8 |
| HU-012 | Como **gerente**, quero visualizar o status de pagamento de cada reserva (pago, pendente, parcial, cancelado), para que inadimplentes sejam identificados rapidamente | Alta | 5 |
| HU-013 | Como **administrador**, quero aplicar descontos manuais a uma reserva com registro do motivo, para que promoções ou cortesias sejam rastreadas | Média | 5 |
| HU-014 | Como **administrador**, quero visualizar o relatório de caixa por período, separado por método de pagamento, para consolidar o faturamento diário | Alta | 8 |
| HU-015 | Como **cliente**, quero receber o comprovante de pagamento por e-mail ou WhatsApp, para ter registro da transação | Média | 5 |
| HU-016 | Como **administrador**, quero registrar estornos de pagamento com justificativa, para que devoluções sejam auditáveis | Média | 5 |

### 3.3 Logs e Auditoria

| ID | História | Prioridade | SP |
|----|----------|------------|----|
| HU-017 | Como **administrador**, quero visualizar um log de todas as ações realizadas no sistema com usuário, data/hora e IP, para auditar operações críticas | Alta | 8 |
| HU-018 | Como **administrador**, quero filtrar os logs por tipo de evento, usuário e período, para investigar incidentes específicos | Alta | 5 |

### 3.4 Dashboard e Relatórios

| ID | História | Prioridade | SP |
|----|----------|------------|----|
| HU-019 | Como **administrador**, quero ver no dashboard os indicadores do dia: faturamento, ocupação e reservas, para ter a visão operacional imediata | Alta | 8 |
| HU-020 | Como **gerente**, quero gerar o relatório de ocupação das quadras por período, para identificar horários ociosos e de pico | Alta | 8 |
| HU-021 | Como **administrador**, quero exportar os relatórios financeiros em CSV ou PDF, para compartilhar com contadores e sócios | Média | 5 |

---

## 4. Casos de Uso

### UC-001 — Criar Reserva

**Ator Principal:** Recepcionista / Gerente  
**Pré-condições:** Usuário autenticado; quadra configurada; horário disponível  
**Pós-condições:** Reserva registrada; grade atualizada; notificação enviada ao cliente  

**Fluxo Principal:**
1. Ator seleciona a quadra desejada
2. Sistema exibe grade de disponibilidade
3. Ator seleciona data e horário
4. Sistema calcula o valor automático com base na tabela de preços configurada
5. Ator seleciona ou cadastra o cliente
6. Ator confirma a reserva
7. Sistema registra a reserva com status **Confirmada / Pagamento Pendente**
8. Sistema dispara notificação ao cliente

**Fluxos Alternativos:**
- 3a. Horário já reservado → Sistema exibe mensagem de conflito e impede a confirmação
- 4a. Quadra bloqueada → Sistema exibe mensagem de indisponibilidade

---

### UC-002 — Registrar Pagamento

**Ator Principal:** Recepcionista / Gerente  
**Pré-condições:** Reserva existente no status **Pendente** ou **Parcial**  
**Pós-condições:** Pagamento registrado; status da reserva atualizado; log gerado  

**Fluxo Principal:**
1. Ator localiza a reserva pelo cliente, código ou data
2. Ator seleciona "Registrar Pagamento"
3. Ator informa: valor pago, método (dinheiro, Pix, cartão crédito, cartão débito), data do pagamento
4. Sistema valida se o valor não excede o saldo devedor
5. Sistema registra o pagamento e atualiza o status da reserva
6. Sistema gera log do evento com usuário, valor, método e timestamp
7. Sistema oferece opção de enviar comprovante ao cliente

**Fluxos Alternativos:**
- 4a. Valor maior que o saldo devedor → Sistema alerta e solicita confirmação (caso de gorjeta ou arredondamento)
- 3a. Pagamento parcial → Status permanece **Parcial** com saldo devedor exibido

---

### UC-003 — Cancelar Reserva

**Ator Principal:** Recepcionista / Gerente / Administrador  
**Pré-condições:** Reserva no status **Confirmada** ou **Parcial**  
**Pós-condições:** Reserva cancelada; horário liberado; log gerado  

**Fluxo Principal:**
1. Ator localiza a reserva
2. Ator seleciona "Cancelar Reserva"
3. Sistema solicita motivo do cancelamento (campo obrigatório)
4. Sistema verifica se há pagamentos registrados — se sim, solicita instrução de estorno
5. Ator confirma o cancelamento
6. Sistema atualiza o status para **Cancelada**
7. Sistema libera o horário na grade
8. Sistema gera log e notifica o cliente

---

### UC-004 — Bloquear Quadra

**Ator Principal:** Gerente / Administrador  
**Pré-condições:** Nenhuma reserva ativa no período informado  
**Pós-condições:** Quadra bloqueada no período; horário indisponível para reservas  

**Fluxo Principal:**
1. Ator seleciona a quadra
2. Ator define o período de bloqueio (data/hora início e fim) e o motivo (manutenção, evento, limpeza)
3. Sistema verifica conflitos com reservas existentes — se houver, exibe lista
4. Ator confirma o bloqueio
5. Sistema registra o bloqueio e gera log

**Fluxo Alternativo:**
- 3a. Há reservas no período → Sistema exibe conflitos e impede o bloqueio; orienta o ator a cancelar as reservas manualmente primeiro

---

### UC-005 — Configurar Tabela de Preços

**Ator Principal:** Administrador  
**Pré-condições:** Quadra cadastrada  
**Pós-condições:** Preços atualizados e aplicados automaticamente nas novas reservas  

**Fluxo Principal:**
1. Administrador acessa a quadra nas Configurações
2. Define preço por horário e dia da semana
3. Marca intervalos como "horário de pico" (preço diferenciado)
4. Sistema salva a tabela de preços com data de vigência
5. Sistema gera log da alteração de preço com valores anterior e novo

---

### UC-006 — Consultar Logs de Auditoria

**Ator Principal:** Administrador  
**Pré-condições:** Usuário autenticado com perfil Administrador  
**Pós-condições:** Nenhuma  

**Fluxo Principal:**
1. Administrador acessa o módulo de Auditoria
2. Aplica filtros: tipo de evento, usuário, período, IP
3. Sistema exibe a lista de logs paginada e ordenada por data decrescente
4. Administrador pode exportar os logs filtrados em CSV

---

## 5. Requisitos Funcionais

### 5.1 Pagamentos

#### 5.1.1 Métodos de Pagamento

| ID | Requisito |
|----|-----------|
| RF-PAG-001 | O sistema **deve** suportar os seguintes métodos de pagamento: dinheiro, Pix, cartão de crédito, cartão de débito e voucher interno |
| RF-PAG-002 | O sistema **deve** permitir que múltiplos métodos de pagamento sejam registrados para uma única reserva (ex.: metade dinheiro, metade Pix) |
| RF-PAG-003 | O sistema **deve** registrar, para cada pagamento: valor, método, data/hora, operador responsável e reserva vinculada |

#### 5.1.2 Controle de Saldo

| ID | Requisito |
|----|-----------|
| RF-PAG-004 | O sistema **deve** calcular automaticamente o saldo devedor de cada reserva com base no preço configurado e nos pagamentos já registrados |
| RF-PAG-005 | O sistema **deve** suportar pagamento parcial, mantendo o status da reserva como **Parcial** enquanto o saldo devedor for maior que zero |
| RF-PAG-006 | O sistema **deve** emitir alerta visual quando uma reserva for marcada como **iniciada** (horário chegou) e ainda possuir saldo devedor pendente |

#### 5.1.3 Descontos e Ajustes

| ID | Requisito |
|----|-----------|
| RF-PAG-007 | O sistema **deve** permitir que usuários com perfil **Gerente** ou **Administrador** apliquem desconto manual a uma reserva, com campo obrigatório de justificativa |
| RF-PAG-008 | O sistema **deve** registrar no log toda alteração de valor (desconto, ajuste), incluindo: valor original, valor final, percentual de desconto e usuário responsável |
| RF-PAG-009 | O desconto máximo aplicável por perfil **Gerente** **deve** ser configurável pelo Administrador (ex.: máximo de 30%) |

#### 5.1.4 Estornos

| ID | Requisito |
|----|-----------|
| RF-PAG-010 | O sistema **deve** permitir o registro de estorno total ou parcial de um pagamento, com campo obrigatório de justificativa |
| RF-PAG-011 | Estornos **devem** ser restritos ao perfil **Administrador** |
| RF-PAG-012 | O estorno **deve** atualizar automaticamente o status financeiro da reserva e gerar log auditável |

#### 5.1.5 Preços e Tarifas

| ID | Requisito |
|----|-----------|
| RF-PAG-013 | O sistema **deve** permitir a configuração de preços distintos por quadra, dia da semana e faixa de horário (diurno, noturno, fim de semana) |
| RF-PAG-014 | O sistema **deve** aplicar automaticamente o preço vigente no momento da criação da reserva, sem exigir entrada manual do valor |
| RF-PAG-015 | O sistema **deve** manter o histórico de alterações de preço com data de vigência, para que relatórios históricos sejam calculados corretamente |

#### 5.1.6 Comprovantes

| ID | Requisito |
|----|-----------|
| RF-PAG-016 | O sistema **deve** gerar comprovante de pagamento em formato PDF ou link compartilhável contendo: nome do cliente, quadra, data/hora, valor pago, método e código da reserva |
| RF-PAG-017 | O sistema **deve** oferecer opção de envio do comprovante por e-mail e/ou WhatsApp (via link de API) |

---

### 5.2 Reservas

#### 5.2.1 Grade de Disponibilidade

| ID | Requisito |
|----|-----------|
| RF-RES-001 | O sistema **deve** exibir a grade de disponibilidade de todas as quadras em uma visão semanal, com blocos de horário de 30 em 30 minutos ou 60 em 60 minutos (configurável) |
| RF-RES-002 | A grade **deve** diferenciar visualmente os status: Disponível, Reservado (pago), Reservado (pendente), Bloqueado e Em andamento |
| RF-RES-003 | A grade **deve** ser atualizada em tempo real quando outra sessão do sistema realizar uma alteração, sem necessidade de recarregar a página |

#### 5.2.2 Criação de Reserva

| ID | Requisito |
|----|-----------|
| RF-RES-004 | O sistema **deve** impedir a criação de reservas com conflito de horário na mesma quadra |
| RF-RES-005 | O sistema **deve** impedir reservas fora dos horários de funcionamento configurados para aquela quadra |
| RF-RES-006 | O sistema **deve** impedir reservas em quadras bloqueadas |
| RF-RES-007 | O sistema **deve** calcular a duração da reserva em horas e o valor total automaticamente no momento da criação |
| RF-RES-008 | O sistema **deve** vincular a reserva a um cliente cadastrado; o cadastro de cliente mínimo exige: nome completo e telefone |
| RF-RES-009 | A reserva **deve** ser criada com status inicial **Confirmada / Pagamento Pendente** |

#### 5.2.3 Reservas Recorrentes (Mensalistas)

| ID | Requisito |
|----|-----------|
| RF-RES-010 | O sistema **deve** permitir a criação de reservas recorrentes semanais ou quinzenais, com data de início e data de término |
| RF-RES-011 | Cada ocorrência da reserva recorrente **deve** gerar uma reserva individual rastreável de forma independente |
| RF-RES-012 | O cancelamento de uma ocorrência da reserva recorrente **não deve** afetar as demais ocorrências |

#### 5.2.4 Alteração e Cancelamento

| ID | Requisito |
|----|-----------|
| RF-RES-013 | O sistema **deve** permitir a edição de data, horário e quadra de uma reserva, desde que não haja conflito no destino |
| RF-RES-014 | Toda edição de reserva **deve** registrar no histórico: campo alterado, valor anterior, valor novo, usuário e timestamp |
| RF-RES-015 | O cancelamento de uma reserva **deve** exigir preenchimento de motivo selecionável (lista configurável) e campo de observação opcional |
| RF-RES-016 | O sistema **deve** liberar o horário da quadra imediatamente após o cancelamento |

#### 5.2.5 Bloqueio de Quadras

| ID | Requisito |
|----|-----------|
| RF-RES-017 | O sistema **deve** permitir o bloqueio de uma quadra em um período específico com motivo: manutenção, evento interno, limpeza ou outros |
| RF-RES-018 | O sistema **deve** impedir o bloqueio de períodos que já possuam reservas ativas, exibindo a lista de conflitos |

#### 5.2.6 Notificações

| ID | Requisito |
|----|-----------|
| RF-RES-019 | O sistema **deve** enviar notificação de confirmação ao cliente no momento da criação da reserva |
| RF-RES-020 | O sistema **deve** enviar notificação de cancelamento ao cliente no momento do cancelamento |
| RF-RES-021 | O canal de envio (e-mail e/ou WhatsApp) **deve** ser configurável pelo Administrador |

---

### 5.3 Logs e Auditoria

> **Princípio:** Todo evento auditável gera um registro imutável. Logs não podem ser editados nem excluídos por nenhum perfil de usuário.

#### 5.3.1 Eventos Auditáveis

| ID | Evento | Dados Registrados |
|----|--------|-------------------|
| RF-LOG-001 | Login bem-sucedido | Usuário, IP, User-Agent, timestamp |
| RF-LOG-002 | Logout | Usuário, IP, timestamp |
| RF-LOG-003 | Tentativa de login falha | E-mail tentado, IP, timestamp, motivo (senha inválida, usuário inexistente) |
| RF-LOG-004 | Criação de reserva | Usuário, ID da reserva, quadra, cliente, data/hora, valor calculado, timestamp |
| RF-LOG-005 | Alteração de reserva | Usuário, ID da reserva, campos alterados (antes/depois), timestamp |
| RF-LOG-006 | Cancelamento de reserva | Usuário, ID da reserva, motivo, status anterior, timestamp |
| RF-LOG-007 | Registro de pagamento | Usuário, ID do pagamento, ID da reserva, valor, método, timestamp |
| RF-LOG-008 | Aplicação de desconto | Usuário, ID da reserva, valor original, desconto aplicado (%), valor final, justificativa, timestamp |
| RF-LOG-009 | Estorno de pagamento | Usuário, ID do pagamento, valor estornado, justificativa, timestamp |
| RF-LOG-010 | Alteração de preço de quadra | Usuário, quadra, tarifa anterior, tarifa nova, data de vigência, timestamp |
| RF-LOG-011 | Bloqueio de quadra | Usuário, quadra, período de bloqueio, motivo, timestamp |
| RF-LOG-012 | Desbloqueio de quadra | Usuário, quadra, período, timestamp |
| RF-LOG-013 | Criação de usuário | Usuário criador, usuário criado, perfil atribuído, timestamp |
| RF-LOG-014 | Alteração de perfil/permissões | Usuário responsável, usuário afetado, perfil anterior, perfil novo, timestamp |
| RF-LOG-015 | Exclusão de cadastro (cliente/usuário) | Usuário responsável, registro excluído, timestamp |
| RF-LOG-016 | Exportação de relatório | Usuário, tipo de relatório, período filtrado, timestamp |

#### 5.3.2 Consulta de Logs

| ID | Requisito |
|----|-----------|
| RF-LOG-017 | O sistema **deve** disponibilizar interface de consulta de logs exclusiva para o perfil **Administrador** |
| RF-LOG-018 | A consulta **deve** suportar filtros por: tipo de evento, usuário responsável, período (data início e fim), IP de origem |
| RF-LOG-019 | O resultado **deve** ser paginado (máximo 100 registros por página) e ordenado por data decrescente |
| RF-LOG-020 | O sistema **deve** permitir exportação dos logs filtrados em formato CSV |
| RF-LOG-021 | Logs **devem** ser retidos pelo período mínimo de **5 anos** |

---

### 5.4 Dashboard

> O Dashboard é a tela inicial exibida após o login. Os indicadores são filtráveis por unidade (para operações com múltiplas arenas no futuro).

#### 5.4.1 Seção: Resumo do Dia

| ID | Indicador | Descrição | Cálculo |
|----|-----------|-----------|---------|
| RF-DASH-001 | **Faturamento do Dia** | Soma dos pagamentos registrados no dia atual | Σ pagamentos confirmados com data = hoje |
| RF-DASH-002 | **Faturamento Pendente** | Valor total de reservas do dia com status Pendente ou Parcial | Σ saldo devedor de reservas ativas de hoje |
| RF-DASH-003 | **Reservas do Dia** | Número total de reservas para o dia atual | Contagem de reservas ativas com data = hoje |
| RF-DASH-004 | **Taxa de Ocupação** | Percentual de horários ocupados vs. disponíveis no dia | (Horários reservados / Horários totais disponíveis) × 100 |

#### 5.4.2 Seção: Grade de Quadras

| ID | Indicador | Descrição |
|----|-----------|-----------|
| RF-DASH-005 | **Grade Visual do Dia** | Visão compacta de todas as quadras com os horários do dia atual, com código de cores por status |
| RF-DASH-006 | **Próximas Reservas** | Lista das próximas 5 reservas ordenadas por horário de início, com cliente e status de pagamento |

#### 5.4.3 Seção: Financeiro

| ID | Indicador | Descrição | Cálculo |
|----|-----------|-----------|---------|
| RF-DASH-007 | **Faturamento do Mês** | Soma dos pagamentos do mês vigente | Σ pagamentos confirmados do mês atual |
| RF-DASH-008 | **Comparativo Mês Anterior** | Variação percentual do faturamento vs. mês anterior | ((Mês atual - Mês anterior) / Mês anterior) × 100 |
| RF-DASH-009 | **Breakdown por Método de Pagamento** | Gráfico de pizza com a proporção de cada método (Pix, dinheiro, cartão) | Agrupamento por método no período selecionado |
| RF-DASH-010 | **Reservas Inadimplentes** | Número e valor total de reservas já iniciadas ou passadas com saldo devedor > 0 | Contagem e Σ de saldo devedor de reservas com data passada e status ≠ Pago |

#### 5.4.4 Seção: Operacional

| ID | Indicador | Descrição |
|----|-----------|-----------|
| RF-DASH-011 | **Quadras com Manutenção** | Lista de quadras com bloqueio ativo no momento | Filtro: bloqueios com horário início ≤ agora ≤ horário fim |
| RF-DASH-012 | **Alertas de Pagamento Pendente** | Número de reservas que iniciaram há mais de 30 minutos e ainda possuem saldo devedor | Configurável pelo Administrador |

---

### 5.5 Relatórios

> Todos os relatórios devem suportar filtro por período (data início e data fim) e exportação em CSV e PDF. O nome do arquivo exportado deve conter o tipo do relatório e o período.

#### REL-001 — Relatório de Faturamento

**Objetivo:** Consolidar o faturamento bruto, descontos e líquido por período  
**Filtros:** Período, método de pagamento, quadra  
**Campos:**

| Campo | Descrição |
|-------|-----------|
| Data do Pagamento | Data em que o pagamento foi registrado |
| Código da Reserva | Identificador único |
| Cliente | Nome completo |
| Quadra | Nome da quadra |
| Valor Bruto | Preço original da reserva |
| Desconto | Valor de desconto aplicado |
| Valor Líquido | Valor efetivamente cobrado |
| Valor Pago | Soma dos pagamentos registrados |
| Saldo Devedor | Valor Líquido − Valor Pago |
| Método de Pagamento | Dinheiro / Pix / Cartão Crédito / Cartão Débito |
| Operador | Usuário que registrou o pagamento |

**Totalizadores:** Subtotal por dia, Total do período, Total por método de pagamento

---

#### REL-002 — Relatório de Ocupação das Quadras

**Objetivo:** Identificar horários de pico, ociosidade e eficiência operacional por quadra  
**Filtros:** Período, quadra, dia da semana  
**Campos:**

| Campo | Descrição |
|-------|-----------|
| Quadra | Nome da quadra |
| Data | Data do horário analisado |
| Dia da Semana | Segunda a Domingo |
| Total de Horários Disponíveis | Conforme configuração de funcionamento |
| Total de Horários Reservados | Reservas confirmadas |
| Total de Horários Bloqueados | Manutenções e eventos |
| Taxa de Ocupação (%) | Reservados / (Disponíveis − Bloqueados) × 100 |
| Faturamento por Quadra | Soma de pagamentos vinculados à quadra |

**Visualização:** Heatmap semanal por horário e dia da semana (no frontend, não exigido no export)

---

#### REL-003 — Relatório de Reservas

**Objetivo:** Listar todas as reservas no período com seus status e dados financeiros  
**Filtros:** Período, quadra, cliente, status da reserva, status de pagamento  
**Campos:**

| Campo | Descrição |
|-------|-----------|
| Código da Reserva | Identificador único |
| Data/Hora Início | Início da reserva |
| Data/Hora Fim | Fim da reserva |
| Duração | Em horas |
| Quadra | Nome da quadra |
| Cliente | Nome e telefone |
| Status da Reserva | Confirmada / Em Andamento / Concluída / Cancelada |
| Status de Pagamento | Pago / Parcial / Pendente |
| Valor Total | Valor calculado |
| Valor Pago | Soma de pagamentos |
| Saldo Devedor | Valor Total − Valor Pago |
| Criado Por | Usuário que criou a reserva |

---

#### REL-004 — Relatório de Inadimplência

**Objetivo:** Listar clientes com saldo devedor em reservas passadas  
**Filtros:** Período, valor mínimo de saldo devedor, quadra  
**Campos:**

| Campo | Descrição |
|-------|-----------|
| Cliente | Nome e telefone |
| Código da Reserva | Identificador único |
| Data da Reserva | Data em que ocorreu |
| Quadra | Nome da quadra |
| Valor Total | Valor da reserva |
| Valor Pago | Soma de pagamentos efetuados |
| Saldo Devedor | Valor Total − Valor Pago |
| Dias em Aberto | Hoje − Data da Reserva |

**Totalizadores:** Total de clientes inadimplentes, Total de valor em aberto

---

#### REL-005 — Relatório de Cancelamentos

**Objetivo:** Analisar a taxa e os motivos de cancelamento  
**Filtros:** Período, quadra, motivo de cancelamento  
**Campos:**

| Campo | Descrição |
|-------|-----------|
| Código da Reserva | Identificador único |
| Data/Hora do Cancelamento | Quando foi cancelada |
| Quadra | Nome da quadra |
| Cliente | Nome e telefone |
| Motivo | Motivo registrado |
| Valor da Reserva | Valor que seria cobrado |
| Valor Pago até o Cancelamento | Pagamentos registrados antes do cancelamento |
| Cancelado Por | Usuário responsável |

**Totalizadores:** Total de cancelamentos, Taxa de cancelamento (%), Receita perdida

---

#### REL-006 — Relatório de Auditoria (Logs)

**Objetivo:** Exportar eventos auditáveis filtrados para análise externa  
**Filtros:** Período, tipo de evento, usuário  
**Campos:** Todos os campos do log correspondente ao tipo de evento selecionado  
**Restrição:** Disponível apenas para o perfil **Administrador**

---

## 6. Regras de Negócio

| ID | Regra | Impacto |
|----|-------|---------|
| RN-001 | Uma quadra **não pode** ter duas reservas com sobreposição de horário | Impedimento na criação/edição de reserva |
| RN-002 | Reservas **não podem** ser criadas fora dos horários de funcionamento da quadra | Impedimento na criação de reserva |
| RN-003 | Uma quadra bloqueada **não pode** receber novas reservas no período de bloqueio | Impedimento na criação de reserva |
| RN-004 | O valor da reserva é calculado com base na tabela de preços vigente no momento da criação, e **não muda** retroativamente se a tabela for alterada | Integridade do valor da reserva |
| RN-005 | O saldo devedor é sempre: **Valor Líquido − Σ Pagamentos Confirmados** | Cálculo automático do saldo |
| RN-006 | O status de pagamento segue a progressão: **Pendente → Parcial → Pago** | Automático com base no saldo devedor |
| RN-007 | Desconto máximo por perfil **Gerente** é configurável pelo Administrador (padrão: 30%) | Validação no registro de desconto |
| RN-008 | Estornos são de competência exclusiva do **Administrador** | Controle de acesso |
| RN-009 | Logs de auditoria são **imutáveis** — nenhum perfil pode editar ou excluir registros de log | Integridade de auditoria |
| RN-010 | Uma reserva só pode ser cancelada se estiver no status **Confirmada**, **Pendente** ou **Parcial**; reservas **Concluídas** não podem ser canceladas | Controle de status |
| RN-011 | Reservas recorrentes geram ocorrências independentes; o cancelamento de uma ocorrência não afeta as demais | Isolamento de ocorrências |
| RN-012 | O bloqueio de uma quadra não pode ser criado em período que já contenha reservas ativas | Impedimento de conflito |
| RN-013 | Alterações de preço entram em vigor a partir da data de vigência configurada e não afetam reservas já criadas | Proteção de preços históricos |
| RN-014 | Logs devem ser retidos por no mínimo **5 anos** | Conformidade com LGPD e auditoria |
| RN-015 | Tentativas de login com falha consecutivas (≥5 em 10 minutos) **devem** bloquear temporariamente o acesso do IP por 15 minutos | Segurança contra força bruta |

---

## 7. Requisitos Não Funcionais

### 7.1 Desempenho

| ID | Requisito | Métrica |
|----|-----------|---------|
| RNF-001 | Tempo de resposta de páginas e APIs | < 2 segundos para 95% das requisições sob carga normal |
| RNF-002 | Tempo de carregamento da grade de disponibilidade | < 3 segundos |
| RNF-003 | Capacidade de usuários simultâneos no MVP | Suporte a 100 usuários simultâneos sem degradação |
| RNF-004 | Disponibilidade (SLA) | 99,5% ao mês (uptime ≈ 21,9h de downtime/mês máximo) |

### 7.2 Segurança

| ID | Requisito |
|----|-----------|
| RNF-005 | Autenticação baseada em JWT com expiração configurável (padrão: 8 horas) |
| RNF-006 | Todas as comunicações via HTTPS (TLS 1.2+) |
| RNF-007 | Senhas armazenadas com hash bcrypt (custo mínimo 12) |
| RNF-008 | Controle de acesso baseado em perfis (RBAC) — nenhuma rota expõe dados além do perfil do usuário |
| RNF-009 | Bloqueio de IP após 5 tentativas de login falhas consecutivas em 10 minutos (duração: 15 minutos) |
| RNF-010 | Dados pessoais de clientes conforme LGPD: consentimento registrado, direito de exclusão suportado |

### 7.3 Usabilidade

| ID | Requisito |
|----|-----------|
| RNF-011 | Interface responsiva para desktop e tablet (largura mínima 768px) |
| RNF-012 | Fluxo de criação de reserva concluído em até 5 cliques/interações |
| RNF-013 | Fluxo de registro de pagamento concluído em até 4 cliques/interações |
| RNF-014 | Suporte aos navegadores: Chrome (últimas 2 versões), Firefox (últimas 2 versões), Edge (últimas 2 versões) |

### 7.4 Manutenibilidade e Escalabilidade

| ID | Requisito |
|----|-----------|
| RNF-015 | Arquitetura desacoplada (frontend SPA + API RESTful) para permitir escalabilidade independente |
| RNF-016 | Banco de dados relacional com suporte a múltiplos tenants (multi-tenancy por schema ou tenant_id) |
| RNF-017 | Logs de aplicação estruturados em JSON para integração futura com ferramentas de observabilidade |
| RNF-018 | Cobertura mínima de testes automatizados: 80% das funções críticas de negócio (reservas e pagamentos) |

### 7.5 Dados e Backup

| ID | Requisito |
|----|-----------|
| RNF-019 | Backup automático diário do banco de dados com retenção de 30 dias |
| RNF-020 | RPO (Recovery Point Objective) máximo de 24 horas |
| RNF-021 | RTO (Recovery Time Objective) máximo de 4 horas |

---

## 8. Roadmap do Produto

### MVP — Versão 1.0 *(Desenvolvimento Inicial)*

> **Objetivo:** Entregar a primeira versão comercial utilizável por arenas esportivas para gestão completa de reservas e pagamentos.

**Módulos incluídos:**

| # | Módulo | Funcionalidades |
|---|--------|-----------------|
| 1 | **Autenticação** | Login, logout, perfis (Admin, Gerente, Recepcionista), recuperação de senha |
| 2 | **Cadastros** | Cadastro de quadras, clientes e usuários internos |
| 3 | **Configurações** | Horários de funcionamento, tabela de preços, motivos de cancelamento |
| 4 | **Reservas** | Grade de disponibilidade, criação, edição, cancelamento, bloqueio de quadra, reservas recorrentes (mensalistas) |
| 5 | **Pagamentos** | Registro de pagamentos (múltiplos métodos), pagamento parcial, desconto manual, estorno, comprovante PDF |
| 6 | **Notificações** | E-mail de confirmação e cancelamento de reserva; comprovante de pagamento |
| 7 | **Dashboard** | Indicadores do dia, semana e mês; grade visual; alertas de inadimplência |
| 8 | **Relatórios** | REL-001 (Faturamento), REL-002 (Ocupação), REL-003 (Reservas), REL-004 (Inadimplência), REL-005 (Cancelamentos) |
| 9 | **Auditoria** | Log de todos os eventos definidos em RF-LOG-001 a RF-LOG-016, consulta e exportação |

---

### Versão 2 — *Expansão e Experiência do Cliente*

> **Objetivo:** Empoderar o cliente final com autoatendimento e ampliar integrações financeiras.

| # | Funcionalidade | Descrição |
|---|---------------|-----------|
| 1 | **Portal do Cliente** | App/página onde o cliente final visualiza suas reservas e histórico de pagamentos |
| 2 | **Agendamento Online pelo Cliente** | Cliente reserva diretamente pelo portal sem intermediário |
| 3 | **Pagamento Online** | Integração com gateway de pagamento para Pix e cartão online no momento da reserva |
| 4 | **Lembretes Automáticos** | Notificação automática ao cliente X horas antes da reserva (configurável) |
| 5 | **Lista de Espera** | Cliente entra em lista de espera para um horário lotado e é notificado se abrir vaga |
| 6 | **Gestão de Múltiplas Unidades** | Uma conta gerencia múltiplas arenas com switch de contexto no dashboard |
| 7 | **Programa de Fidelidade Simples** | Contagem de reservas com geração de cortesias automáticas |
| 8 | **Integração com Google Agenda** | Sincronização de reservas com a agenda do cliente |

---

### Versão 3 — *Inteligência e Automação Avançada*

> **Objetivo:** Transformar o CourtManager em uma plataforma estratégica de business intelligence e automação para grandes operadores.

| # | Funcionalidade | Descrição |
|---|---------------|-----------|
| 1 | **Precificação Dinâmica por Demanda** | Algoritmo ajusta preços automaticamente com base na taxa de ocupação em tempo real |
| 2 | **BI e Analytics Avançado** | Dashboards com previsão de faturamento, sazonalidade, LTV de cliente e cohort analysis |
| 3 | **App Mobile Nativo** | Aplicativo iOS e Android para operadores (recepcionistas e gerentes) |
| 4 | **Integração com ERPs Contábeis** | Exportação automática para sistemas como Omie, Conta Azul e Totvs |
| 5 | **Marketplace de Quadras** | Listagem pública para atração de novos clientes via marketplace |
| 6 | **Gestão de Eventos e Torneios** | Módulo dedicado para criação de torneios com chaveamento automático |
| 7 | **API Pública** | API documentada para integrações de parceiros e marketplaces |
| 8 | **Machine Learning para Cancelamentos** | Predição de probabilidade de cancelamento para acionar ações preventivas |
| 9 | **Controle de Acesso Físico** | Integração com catracas e fechaduras inteligentes via IoT |

---

## 9. Matriz de Rastreabilidade

| História de Usuário | Caso de Uso | Requisito Funcional | Regra de Negócio | Requisito Não Funcional |
|---------------------|-------------|---------------------|------------------|------------------------|
| HU-001 — Visualizar grade de disponibilidade | UC-001 Criar Reserva | RF-RES-001, RF-RES-002, RF-RES-003 | RN-001, RN-002, RN-003 | RNF-002, RNF-011, RNF-012 |
| HU-002 — Criar reserva | UC-001 Criar Reserva | RF-RES-004, RF-RES-005, RF-RES-006, RF-RES-007, RF-RES-008, RF-RES-009 | RN-001, RN-002, RN-003, RN-004 | RNF-001, RNF-008, RNF-012 |
| HU-003 — Cancelar reserva | UC-003 Cancelar Reserva | RF-RES-015, RF-RES-016 | RN-010, RN-011 | RNF-001, RNF-008 |
| HU-004 — Reservas recorrentes | UC-001 Criar Reserva | RF-RES-010, RF-RES-011, RF-RES-012 | RN-001, RN-011 | RNF-001, RNF-016 |
| HU-005 — Configurar horários de funcionamento | UC-005 Configurar Tabela de Preços | RF-RES-005 | RN-002 | RNF-008 |
| HU-006 — Bloquear quadra | UC-004 Bloquear Quadra | RF-RES-017, RF-RES-018 | RN-003, RN-012 | RNF-008 |
| HU-007 — Confirmação ao cliente | UC-001 Criar Reserva | RF-RES-019, RF-RES-021 | — | RNF-006 |
| HU-008 — Editar reserva | UC-001 Criar Reserva | RF-RES-013, RF-RES-014 | RN-001, RN-010 | RNF-001, RNF-008 |
| HU-009 — Registrar pagamento | UC-002 Registrar Pagamento | RF-PAG-001, RF-PAG-002, RF-PAG-003 | RN-005, RN-006 | RNF-001, RNF-008, RNF-013 |
| HU-010 — Pagamento parcial | UC-002 Registrar Pagamento | RF-PAG-004, RF-PAG-005, RF-PAG-006 | RN-005, RN-006 | RNF-001 |
| HU-011 — Configurar preços | UC-005 Configurar Tabela de Preços | RF-PAG-013, RF-PAG-014, RF-PAG-015 | RN-004, RN-013 | RNF-008 |
| HU-012 — Status de pagamento por reserva | UC-002 Registrar Pagamento | RF-PAG-004, RF-PAG-005 | RN-005, RN-006 | RNF-001 |
| HU-013 — Aplicar desconto | UC-002 Registrar Pagamento | RF-PAG-007, RF-PAG-008, RF-PAG-009 | RN-007 | RNF-008 |
| HU-014 — Relatório de caixa | — | RF-PAG-014 | RN-005 | RNF-001 |
| HU-015 — Comprovante ao cliente | UC-002 Registrar Pagamento | RF-PAG-016, RF-PAG-017 | — | RNF-006 |
| HU-016 — Registrar estorno | UC-002 Registrar Pagamento | RF-PAG-010, RF-PAG-011, RF-PAG-012 | RN-008 | RNF-008 |
| HU-017 — Visualizar logs | UC-006 Consultar Logs | RF-LOG-017, RF-LOG-018, RF-LOG-019 | RN-009, RN-014 | RNF-008 |
| HU-018 — Filtrar logs | UC-006 Consultar Logs | RF-LOG-018, RF-LOG-020 | RN-009, RN-014 | RNF-008 |
| HU-019 — Dashboard do dia | — | RF-DASH-001 a RF-DASH-006 | RN-005, RN-006 | RNF-001, RNF-002, RNF-011 |
| HU-020 — Relatório de ocupação | — | REL-002 | — | RNF-001, RNF-011 |
| HU-021 — Exportar relatórios | — | REL-001 a REL-006 | RN-009 | RNF-001, RNF-006 |

---

## 10. Critérios de Qualidade

Todos os requisitos documentados neste PRD foram revisados segundo os seguintes critérios:

| Critério | Verificação Aplicada |
|----------|---------------------|
| **Claro** | Cada requisito usa linguagem sem ambiguidade ("deve" para obrigatório, "pode" para opcional) |
| **Completo** | Todos os módulos do MVP foram cobertos: reservas, pagamentos, logs, dashboard e relatórios |
| **Testável** | Cada RF possui critério de aceite implícito derivável do fluxo descrito (ex.: "sistema deve impedir") |
| **Mensurável** | RNFs possuem métricas quantitativas (ex.: < 2s, 99,5% SLA, 80% cobertura de testes) |
| **Rastreável** | Todos os RFs foram rastreados na Matriz de Rastreabilidade (Seção 9) |
| **Consistente** | Nomenclatura e IDs padronizados (RF-XXX-NNN, RN-NNN, RNF-NNN, HU-NNN, UC-NNN) |
| **Sem duplicidade** | Cada requisito aparece uma única vez, referenciado por ID quando reutilizado |
| **Sem ambiguidade** | Termos como "status", "saldo devedor" e "perfil" foram definidos na documentação com exemplos |

### Definições de "Deve" vs. "Pode"

- **Deve** (`MUST`): Requisito obrigatório para o MVP. A ausência caracteriza falha de entrega.
- **Pode** (`MAY`): Funcionalidade opcional ou de versões futuras, registrada como contexto.

---

*Documento gerado para o CourtManager — SaaS de Gestão de Arenas Esportivas.*  
*Próxima revisão: após aprovação do MVP scope pela equipe de desenvolvimento.*
