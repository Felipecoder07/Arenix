# Artefatos SonarCloud

sonar_issues_raw.json e sonar_summary.json são dados de coleta, não a situação atual garantida do projeto.

Da raiz, execute em ordem quando quiser atualizar:

```bash
node scripts/fetch_sonar_issues.js
node scripts/analyze_sonar_issues.js
node scripts/generate_sonar_report.js
```

A primeira etapa consulta o serviço externo. As demais processam os arquivos locais. Todos gravam nesta pasta, independentemente do diretório de execução. O projeto Sonar configurado nos scripts permanece Felipecoder07_avalie-papai.

Novos relatórios são gravados aqui. O [relatório original de setembro](../../docs/historico/RELATORIO_SONARCLOUD.md) permanece preservado.
