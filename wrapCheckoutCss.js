const fs = require('fs');

let css = fs.readFileSync('master-templates/src/assets/css/checkout.css', 'utf8');

// Wrap everything in .scope-checkout-page
css = `.scope-checkout-page {
${css}
}`;

fs.writeFileSync('master-templates/src/assets/css/checkout.css', css);
console.log('Checkout CSS wrapped successfully!');
