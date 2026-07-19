const fs = require('fs');

let css = fs.readFileSync('master-templates/src/assets/css/tenant-login.css', 'utf8');

// Wrap everything in .tenant-login-page
css = `.tenant-login-page {
${css}
}`;

fs.writeFileSync('master-templates/src/assets/css/tenant-login.css', css);
console.log('TenantLogin CSS wrapped successfully!');
