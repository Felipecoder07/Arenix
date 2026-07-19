const fs = require('fs');
const content = fs.readFileSync('frontend/reservas.html', 'utf8');

// Find all HTML blocks starting with <!-- Modal and ending with --> (or find divs with class="modal")
const regex = /<!--[^>]*Modal[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi;
let match;
while ((match = regex.exec(content)) !== null) {
  console.log('========================================');
  console.log(match[0].substring(0, 1500)); // print first 1500 chars of each match
}
