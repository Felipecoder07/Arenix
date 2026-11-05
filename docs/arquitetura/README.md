# Arquitetura atual

Revisada em 05/11/2026 a partir do código.

- [Mapa navegável](architecture_map.html): abra localmente no navegador; expanda cada módulo para ver os fontes.
- [Mapa estruturado](architecture_map.json): dependências declaradas e arquivos de referência.

Para atualizar os artefatos após revisar as descrições, execute `node scripts/build-docs-map.cjs`.

O painel gestor e Master está em `frontend`; o portal do atleta em `tela cliente`. A API usa sessões por cookies e CSRF, com persistência SQLite configurável. O mapa anterior foi preservado no histórico e não descreve o estado atual.
