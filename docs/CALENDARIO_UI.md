# Calendário compartilhado

O frontend já usa React, TypeScript e Tailwind CSS 3. Os componentes ficam em `frontend/src/components` e o CSS global em `frontend/src/index.css`; estilos de telas ficam em `frontend/src/assets/css`.

Foi criada a pasta `frontend/src/components/ui` para componentes reutilizáveis, seguindo o padrão shadcn. Ela mantém os controles independentes das telas e permite que o CLI encontre o destino pelo alias `@/components/ui`. O arquivo legado `components/ui.tsx` continua com seus componentes existentes.

O `components.json` configura o projeto existente; não é necessário recriar o aplicativo nem reinstalar TypeScript/Tailwind. Vite, TypeScript e Vitest resolvem `@/` para `src/`.

## Uso

```tsx
import { Calendar } from '@/components/ui/calendar';
import { DatePicker } from '@/components/ui/date-picker';

// Calendário independente, com seleção simples, múltipla ou intervalo.
<Calendar selected={selected} onSelect={setSelected} />

// Campo de formulário: mantém strings YYYY-MM-DD e limites existentes.
<DatePicker value={data} onValueChange={setData} min="2026-01-01" required />
```

`demo.tsx` contém a prévia do componente. O calendário usa o modelo fornecido, com rótulos pt-BR, ícones Lucide, animações Framer Motion e estilos isolados em `calendar.css`. Não exige providers nem imagens. Datas reservadas são desabilitadas; eventos podem exibir um indicador. Meses e anos têm seleção rápida e a grade aceita navegação por teclado.

O popup usa um portal para não ser cortado pelos modais, ajusta a posição ao espaço disponível e limita a largura a 300px ou à largura da tela. Escape fecha somente o calendário. Campos opcionais oferecem Limpar; selecionar o dia atual confirma a data sem apagar um campo obrigatório.

Dependências: `clsx`, `framer-motion`, `tailwind-merge` v2 (compatível com Tailwind 3) e `@tabler/icons-react`, conforme o pedido. Os ícones usados na integração são os Lucide já adotados no aplicativo.
