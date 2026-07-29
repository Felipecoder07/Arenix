# Estudo de Arquitetura — Opções de Pagamento no Balcão & Proteção Anti-Fraude (No-Show)

Este documento registra o levantamento de mercado e o plano de produto para a implementação futura da modalidade **"Pagar no Local / Balcão"** com proteção contra falsos agendamentos ("No-Show").

---

## 📊 O Problema de Negócio: "No-Show" em Agendamento Presencial

Quando uma plataforma pública permite agendamento sem pré-pagamento online:
- Existe o risco de atletas agendarem por impulso e não comparecerem à partida.
- **Consequência para a Arena**: A quadra fica bloqueada na grade, impedindo que outros clientes pagantes reservem, resultando em perda direta de faturamento.

---

## 🛡️ Modelos de Mercado Analisados

### **Modelo 1 — Pré-Pagamento Online Obrigatório (ATUALMENTE APLICADO)**
- **Como Funciona**: Toda reserva pública gera cobrança Pix instantânea com expiração em 15 minutos.
- **Nível de Risco de No-Show**: **0% (Zero)**.
- **Status no Sistema**: **Ativo e Operacional**.

---

### **Modelo 2 — Pagamento no Balcão com Chave Admin + Trava por Atleta (RECOMENDADO PARA O FUTURO)**

Para quando for necessário oferecer flexibilidade aos donos de arena sem expor o sistema a sabotagens.

#### As 4 Travas de Segurança do Modelo 2:
1. **Chave de Controle do Dono da Arena**:
   - No Painel Admin (`AdminConfiguracoes.tsx`), o dono liga ou desliga o botão `"Permitir Pagamento no Balcão no Portal Público"`.
2. **Limite de 1 Reserva no Balcão por Atleta**:
   - O atleta só pode ter no máximo **1 reserva ativa no balcão**. Para agendar a segunda, é obrigado a pagar no Pix Online.
3. **Bloqueio Automático por No-Show (Blacklist)**:
   - Se o atleta agendou no balcão e não compareceu nem pagou, o recepcionista clica em **"Marcar Falta / No-Show"** no Painel Admin.
   - O e-mail/WhatsApp do cliente entra automaticamente na lista restrita, exigindo Pix Online obrigatório em todas as próximas reservas.
4. **Exigência de Autenticação Validada**:
   - Exige login obrigatório com e-mail e WhatsApp cadastrado (sem agendamento anônimo).

---

### **Modelo 3 — Depósito de Sinal (50% Pix / 50% Balcão)**
- **Como Funciona**: O atleta paga 50% do valor total no Pix Online para garantir a reserva e os 50% restantes no balcão da arena antes ou depois de jogar.
- **Benefício**: Garante receita mínima para a arena cobrir a hora vaga em caso de falta.

---

### **Modelo 4 — Garantia por Cartão de Crédito (Tokenização)**
- **Como Funciona**: O atleta insere o cartão como garantia (estilo Booking/Uber). Se não comparecer, é cobrada uma taxa de falta automaticamente.
- **Complexidade**: Requer gateway com suporte a tokenização de cartão.

---

## 🛠️ Passo a Passo para Implementação Futura (Quando Solicitado)

1. **Banco de Dados**:
   - Adicionar coluna `permitir_pagamento_balcao INTEGER DEFAULT 0` na tabela `Arenas`.
   - Adicionar coluna `bloqueado_balcao INTEGER DEFAULT 0` na tabela `Clientes`.
2. **Backend (`publicController.js`)**:
   - Validar `permitir_pagamento_balcao` e verificar se o cliente possui mais de 1 reserva pendente no balcão ou se está na blacklist.
3. **Frontend Admin (`AdminConfiguracoes.tsx`)**:
   - Adicionar o botão Toggle Switch de liberação de balcão.
4. **Frontend Cliente (`CheckoutDrawer.tsx`)**:
   - Exibir a aba de escolha: **"Pix Online"** vs **"Pagar no Balcão"**.
