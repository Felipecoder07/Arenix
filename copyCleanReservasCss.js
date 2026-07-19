const fs = require('fs');

const html = fs.readFileSync('frontend/reservas.html', 'utf8');
const start = html.indexOf('<style>');
const end = html.indexOf('</style>');
const rawCss = html.substring(start + 7, end).trim();

const finalCss = `.admin-reservas-page {
${rawCss}
}`;

fs.writeFileSync('master-templates/src/assets/css/reservas.css', finalCss);
console.log('Reservas CSS extracted, scoped, and written successfully!');
