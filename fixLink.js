const fs = require('fs');
let tsx = fs.readFileSync('master-templates/src/screens/public/Checkout.tsx', 'utf8');
tsx = tsx.replace(/<a\s+href="#"/g, '<Link to="#"');
fs.writeFileSync('master-templates/src/screens/public/Checkout.tsx', tsx);
