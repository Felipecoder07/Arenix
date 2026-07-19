const fs = require('fs');

const variablesBlock = `
  /* Variables cloned from design system */
  --cream:        #F5F1EA;
  --charcoal:     #1C1A18;
  --charcoal-soft: #2A2724;
  --off-white:    #FCFBF8;
  --muted:        #8A847E;
  --border-warm:  #E5DFD5;
  --border-active: #C9BFB0;
  --success:      #3F6B52;
  --error:        #9B3636;
  --charcoal-83:  rgba(28,26,24,0.83);
  --charcoal-82:  rgba(28,26,24,0.82);
  --charcoal-04:  rgba(28,26,24,0.04);
  --charcoal-03:  rgba(28,26,24,0.03);
  --shadow-btn-dark:
    rgba(0,0,0,0) 0px 0px 0px 0px,
    rgba(0,0,0,0) 0px 0px 0px 0px,
    rgba(255,255,255,0.2) 0px 0.5px 0px 0px inset,
    rgba(0,0,0,0.2) 0px 0px 0px 0.5px inset,
    rgba(0,0,0,0.05) 0px 1px 2px 0px;
  --shadow-focus:  rgba(0,0,0,0.1) 0px 4px 12px;
  --s-2:  8px;  --s-3:  12px; --s-4:  16px;
  --s-5:  24px; --s-6:  32px; --s-7:  40px;
  --s-8:  56px; --s-9:  80px; --s-10: 96px;
  --s-11: 128px;
  --r-sm:   4px; --r-md:  6px; --r-card: 12px;
  --r-lg:   16px; --r-pill: 9999px;
  --font: 'Inter', ui-sans-serif, system-ui, sans-serif;
`;

// Extract original CSS from login.html style tag
const html = fs.readFileSync('frontend/login.html', 'utf8');
const start = html.indexOf('<style>');
const end = html.indexOf('</style>');
let rawCss = html.substring(start + 7, end).trim();

// Format of wrapping:
// Replace :root with variables
rawCss = rawCss.replace(/:root\s*\{([\s\S]*?)\}/, (m, p1) => {
  return `${p1}`;
});

// Change .login-page to & to apply styles to the scoped wrapper itself
rawCss = rawCss.replace(/\.login-page\s*\{/g, '& {');

// Wrap everything inside .tenant-login-page
const finalCss = `.tenant-login-page {
${variablesBlock}
  
${rawCss}
}`;

fs.writeFileSync('master-templates/src/assets/css/tenant-login.css', finalCss);
console.log('Login CSS copied, cleaned and nested successfully!');
