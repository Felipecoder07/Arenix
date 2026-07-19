const fs = require('fs');

// Variables block to inject into pages
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

// 1. Process landing.css
// Copy original landing.css from frontend to master-templates
fs.copyFileSync('frontend/css/landing.css', 'master-templates/src/assets/css/landing.css');
let landingCss = fs.readFileSync('master-templates/src/assets/css/landing.css', 'utf8');

// Replace :root with .scope-landing-page to scope the variables
landingCss = landingCss.replace(/:root\s*\{([\s\S]*?)\}/, (m, p1) => {
  return `.scope-landing-page {${p1}\n${variablesBlock}\n}`;
});

// Replace body with .scope-landing-page body, html with .scope-landing-page html (or .scope-landing-page wrapper)
landingCss = landingCss.replace(/body\s*\{([\s\S]*?)\}/, (m, p1) => {
  return `.scope-landing-page {${p1}\n  min-height: 100vh;\n}`;
});
landingCss = landingCss.replace(/html\s*\{([\s\S]*?)\}/, (m, p1) => {
  return `.scope-landing-page-html {${p1}}`;
});

// Now wrap everything else (rules after the variables and resets) in .scope-landing-page { ... }
// We can find where the utility section starts (e.g. /* ---- Utility ---- */)
const utilityIndex = landingCss.indexOf('/* ---- Utility ---- */');
if (utilityIndex !== -1) {
  const topPart = landingCss.substring(0, utilityIndex);
  const bottomPart = landingCss.substring(utilityIndex);
  landingCss = `${topPart}

.scope-landing-page {
${bottomPart}
}`;
}

fs.writeFileSync('master-templates/src/assets/css/landing.css', landingCss);
console.log('landing.css scoped successfully!');


// 2. Process checkout.css
// Let's read the current file, unwrap it first
let checkoutCss = fs.readFileSync('master-templates/src/assets/css/checkout.css', 'utf8');
if (checkoutCss.startsWith('.scope-checkout-page {')) {
  // remove first line and last line
  const lines = checkoutCss.split('\n');
  lines.shift();
  lines.pop();
  checkoutCss = lines.join('\n');
}

// Wrap checkout.css and inject variables
checkoutCss = `.scope-checkout-page {
  ${variablesBlock}
  
${checkoutCss}
}`;
fs.writeFileSync('master-templates/src/assets/css/checkout.css', checkoutCss);
console.log('checkout.css scoped successfully!');


// 3. Process tenant-login.css
let loginCss = fs.readFileSync('master-templates/src/assets/css/tenant-login.css', 'utf8');
if (loginCss.startsWith('.tenant-login-page {')) {
  const lines = loginCss.split('\n');
  lines.shift();
  lines.pop();
  loginCss = lines.join('\n');
}

// Scope :root to .tenant-login-page
loginCss = loginCss.replace(/:root\s*\{([\s\S]*?)\}/, (m, p1) => {
  return `.tenant-login-page {${p1}\n${variablesBlock}\n}`;
});

// Wrap loginCss
loginCss = `.tenant-login-page {
  ${variablesBlock}
  
${loginCss}
}`;
fs.writeFileSync('master-templates/src/assets/css/tenant-login.css', loginCss);
console.log('tenant-login.css scoped successfully!');
