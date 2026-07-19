const fs = require('fs');

let css = fs.readFileSync('master-templates/src/assets/css/landing.css', 'utf8');

// Wrap everything in .scope-landing-page
css = `.scope-landing-page {
${css}
}`;

fs.writeFileSync('master-templates/src/assets/css/landing.css', css);
console.log('CSS wrapped successfully!');
