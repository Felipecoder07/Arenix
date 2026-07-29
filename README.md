# Arenix CourtManager SaaS 🎾

Plataforma SaaS Multi-Tenant completa para Gestão de Arenas Esportivas (Beach Tennis, Vôlei de Praia, Futevôlei), com faturamento mensal automatizado e integração nativa com o Mercado Pago.

---

## 📂 Estrutura do Repositório

```text
Volei System/
├── 📁 backend/                 # API Node.js Express + SQLite3
│   ├── src/                    # Controllers, Routes, Middlewares, Services, Jobs
│   ├── database.sqlite         # Banco de Dados
│   └── package.json
│
├── 📁 frontend/                # Aplicação React + Vite + TypeScript (Frontend Oficial)
│   ├── src/                    # Screens (Public, Tenant Admin, Master Admin), Layouts, Assets
│   └── package.json
│
├── 📁 docs/                    # Documentações Técnicas e Checklists
│   ├── CourtManager_PRD.md
│   ├── DEPLOYMENT_CHECKLIST.md
│   ├── saas_features.md
│   ├── architecture_map.html   # Mapa Visual Interativo da Arquitetura
│   └── architecture_map.json   # Mapeamento Estruturado para IAs
│
└── 📁 scripts/                 # Scripts Utilitários e Ferramentas Dev
    └── dev-tools/              # Scripts de simulação Pix, verificação MRR e testes
```

---

## 🚀 Como Executar o Projeto Localmente

### 1. Inicializar o Backend (API Node.js)
```bash
cd backend
npm install
npm run dev
```
- A API estará rodando em: `http://localhost:3000`

### 2. Inicializar o Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
```
- A aplicação estará rodando em: `http://localhost:5173`

---

## 🗺️ Mapa de Arquitetura Interativo

Para entender a arquitetura completa dos módulos, componentes e fluxos do sistema, abra o arquivo:
👉 **[docs/architecture_map.html](docs/architecture_map.html)** no seu navegador.
