const fs = require('fs');
const files = ['auditoria.html', 'clientes.html', 'configuracoes.html', 'pagamentos.html', 'relatorios.html', 'reservas.html'];
files.forEach(f => {
  const p = 'frontend/' + f;
  let c = fs.readFileSync(p, 'utf8');
  if (!c.includes('auth-guard.js')) {
    c = c.replace('</head>', '  <script src="js/auth-guard.js"></script>\n</head>');
    fs.writeFileSync(p, c);
    console.log('Updated ' + f);
  }
});
