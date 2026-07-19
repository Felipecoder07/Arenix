const fs = require('fs');
let html = fs.readFileSync('frontend/landing-cadastro.html', 'utf8');

// Strip html layout
let tsx = html.split('<body>')[1].split('</body>')[0];

// Basic replacements
tsx = tsx.replace(/class=/g, 'className=')
         .replace(/<!--.*?-->/gs, '')
         .replace(/<img(.*?)>/g, '<img$1 />')
         .replace(/<input(.*?)>/g, (m, p) => p.endsWith('/') ? m : `<input${p} />`)
         .replace(/for="/g, 'htmlFor="');

// Fix inline styles
tsx = tsx.replace(/style="(.*?)"/g, (match, p1) => {
    const parts = p1.split(';').filter(x => x.trim());
    const obj = {};
    parts.forEach(p => {
        const [k, v] = p.split(':');
        if (k && v) {
            const camelK = k.trim().replace(/-([a-z])/g, (m, c) => c.toUpperCase());
            obj[camelK] = v.trim();
        }
    });
    return `style={${JSON.stringify(obj)}}`;
});

// React component wrapper
tsx = `import { Link } from 'react-router-dom';
import { useState } from 'react';
import '../../assets/css/landing.css';
import '../../assets/css/checkout.css';

export function Checkout() {
  const [selectedPlan, setSelectedPlan] = useState('pro');

  return (
    <>
${tsx}
    </>
  );
}`;

// Fix routing and state logic
tsx = tsx.replace('href="index.html"', 'to="/"')
         .replace('href="#"', 'to="#"');

// Fix plan radio buttons state
tsx = tsx.replace(
  /<label className="plan-option selected">\s*<input type="radio" name="plano" value="pro" checked \/>/g,
  '<label className={`plan-option ${selectedPlan === \'pro\' ? \'selected\' : \'\'}`} onClick={() => setSelectedPlan(\'pro\')}>\n                <input type="radio" name="plano" value="pro" checked={selectedPlan === \'pro\'} readOnly />'
);

tsx = tsx.replace(
  /<label className="plan-option">\s*<input type="radio" name="plano" value="starter" \/>/g,
  '<label className={`plan-option ${selectedPlan === \'starter\' ? \'selected\' : \'\'}`} onClick={() => setSelectedPlan(\'starter\')}>\n                <input type="radio" name="plano" value="starter" checked={selectedPlan === \'starter\'} readOnly />'
);

tsx = tsx.replace(
  /<label className="plan-option">\s*<input type="radio" name="plano" value="enterprise" \/>/g,
  '<label className={`plan-option ${selectedPlan === \'enterprise\' ? \'selected\' : \'\'}`} onClick={() => setSelectedPlan(\'enterprise\')}>\n                <input type="radio" name="plano" value="enterprise" checked={selectedPlan === \'enterprise\'} readOnly />'
);

// Any other unclosed tags fix
tsx = tsx.replace(/autocomplete=/g, 'autoComplete=')
         .replace(/minlength=/g, 'minLength=')
         .replace(/maxlength=/g, 'maxLength=');

// One manual patch for the </a> inside <p>
tsx = tsx.replace(/<a href="#" style.*?<\/a>/g, (m) => m.replace('href=', 'to='));

fs.writeFileSync('master-templates/src/screens/public/Checkout.tsx', tsx);
