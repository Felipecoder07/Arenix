const fs = require('fs');

function convert(htmlFile, tsxFile, componentName) {
  let content = fs.readFileSync(htmlFile, 'utf8');
  let bodyMatch = content.match(/<body>([\s\S]*?)<\/body>/);
  if (!bodyMatch) return;
  let body = bodyMatch[1];
  
  // Strip style and script blocks from body
  body = body.replace(/<style>[\s\S]*?<\/style>/g, '');
  body = body.replace(/<script[\s\S]*?<\/script>/g, '');

  // HTML to JSX conversions
  body = body.replace(/class=/g, 'className=');
  body = body.replace(/<!--[\s\S]*?-->/g, ''); // remove comments
  body = body.replace(/<img(.*?)\/?>/g, '<img$1 />');
  body = body.replace(/<input(.*?)\/?>/g, '<input$1 />');
  body = body.replace(/<br>/g, '<br />');
  body = body.replace(/<hr>/g, '<hr />');
  body = body.replace(/style="([^"]*)"/g, (match, styleString) => {
    let rules = styleString.split(';').filter(r => r.trim() !== '');
    let jsxStyles = rules.map(rule => {
      let [key, val] = rule.split(':');
      if(!val) return '';
      key = key.trim().replace(/-([a-z])/g, (g) => g[1].toUpperCase());
      return `${key}: '${val.trim()}'`;
    }).join(', ');
    return `style={{ ${jsxStyles} }}`;
  });

  // SVG corrections
  body = body.replace(/stroke-width/g, 'strokeWidth');
  body = body.replace(/stroke-linecap/g, 'strokeLinecap');
  body = body.replace(/stroke-linejoin/g, 'strokeLinejoin');

  // Link replacements
  body = body.replace(/<a ([^>]*?)href="login\.html"([^>]*?)>([\s\S]*?)<\/a>/g, '<Link $1to="/login"$2>$3</Link>');
  body = body.replace(/<a ([^>]*?)href="landing-cadastro\.html"([^>]*?)>([\s\S]*?)<\/a>/g, '<Link $1to="/cadastro"$2>$3</Link>');
  body = body.replace(/<a ([^>]*?)href="index\.html"([^>]*?)>([\s\S]*?)<\/a>/g, '<Link $1to="/"$2>$3</Link>');
  
  body = body.replace(/ novalidate/g, ' noValidate');
  body = body.replace(/ maxlength=/g, ' maxLength=');
  body = body.replace(/ for=/g, ' htmlFor=');

  // Also remove inline event handlers which cause errors
  body = body.replace(/onmouseover="(.*?)"/g, '');
  body = body.replace(/onmouseout="(.*?)"/g, '');
  body = body.replace(/onsubmit="(.*?)"/g, 'onSubmit={(e) => e.preventDefault()}');

  let reactComp = `import { Link } from 'react-router-dom';\nimport '../../assets/css/landing.css';\n\nexport function ${componentName}() {\n  return (\n    <>\n${body}\n    </>\n  );\n}\n`;
  fs.writeFileSync(tsxFile, reactComp);
}

convert('frontend/index.html', 'master-templates/src/screens/public/LandingPage.tsx', 'LandingPage');
convert('frontend/landing-cadastro.html', 'master-templates/src/screens/public/Checkout.tsx', 'Checkout');
