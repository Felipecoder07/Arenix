const fs = require('fs');

let c = fs.readFileSync('master-templates/src/screens/public/LandingPage.tsx', 'utf8');

if (!c.includes('import { useState')) {
  c = c.replace(/export function LandingPage\(\) \{/, `import { useState, useEffect } from 'react';\n\nexport function LandingPage() {\n  const [period, setPeriod] = useState('monthly');\n  const [animating, setAnimating] = useState(false);\n  \n  const handlePeriodChange = (p) => {\n    if (p === period) return;\n    setAnimating(true);\n    setTimeout(() => {\n      setPeriod(p);\n      setAnimating(false);\n    }, 200);\n  };\n`);
}

// Monthly/Yearly buttons
c = c.replace(/<button className="billing-btn active" data-period="monthly" id="btn-monthly">Mensal<\/button>/, '<button className={`billing-btn ${period === \'monthly\' ? \'active\' : \'\'}`} onClick={() => handlePeriodChange(\'monthly\')}>Mensal</button>');
c = c.replace(/<button className="billing-btn" data-period="yearly" id="btn-yearly">([\s\S]*?)<\/button>/, '<button className={`billing-btn ${period === \'yearly\' ? \'active\' : \'\'}`} onClick={() => handlePeriodChange(\'yearly\')}>$1</button>');

// Prices
c = c.replace(/<span className="price-amount" data-monthly="49,99" data-yearly="39,99">[\s\S]*?<\/span>/, '<span className={`price-amount ${animating ? \'fade-out\' : \'fade-in\'}`}>R$ {period === \'monthly\' ? \'49,99\' : \'39,99\'}</span>');
c = c.replace(/<span className="price-amount" data-monthly="79,99" data-yearly="63,99">[\s\S]*?<\/span>/, '<span className={`price-amount ${animating ? \'fade-out\' : \'fade-in\'}`}>R$ {period === \'monthly\' ? \'79,99\' : \'63,99\'}</span>');
c = c.replace(/<span className="price-amount" data-monthly="89,99" data-yearly="69,99">[\s\S]*?<\/span>/, '<span className={`price-amount ${animating ? \'fade-out\' : \'fade-in\'}`}>R$ {period === \'monthly\' ? \'89,99\' : \'69,99\'}</span>');
c = c.replace(/<span className="price-amount" data-monthly="Sob consulta" data-yearly="Sob consulta">[\s\S]*?<\/span>/, '<span className={`price-amount ${animating ? \'fade-out\' : \'fade-in\'}`}>Sob consulta</span>');

// Periods
c = c.replace(/<span className="period-label" data-monthly="[\s\S]*?3 quadras" data-yearly="[\s\S]*?">[\s\S]*?<\/span>/, '<span className="period-label">{period === \'monthly\' ? \'/mês — até 3 quadras\' : \'/mês — cobrado anualmente\'}</span>');
c = c.replace(/<span className="period-label" data-monthly="[\s\S]*?10 quadras" data-yearly="[\s\S]*?">[\s\S]*?<\/span>/, '<span className="period-label">{period === \'monthly\' ? \'/mês — até 10 quadras\' : \'/mês — cobrado anualmente\'}</span>');
c = c.replace(/<span className="period-label" data-monthly="[\s\S]*?8 quadras" data-yearly="[\s\S]*?">[\s\S]*?<\/span>/, '<span className="period-label">{period === \'monthly\' ? \'/mês — até 8 quadras\' : \'/mês — cobrado anualmente\'}</span>');
c = c.replace(/<span className="period-label" data-monthly="múltiplas unidades" data-yearly="múltiplas unidades">[\s\S]*?<\/span>/, '<span className="period-label">múltiplas unidades</span>');

fs.writeFileSync('master-templates/src/screens/public/LandingPage.tsx', c);
