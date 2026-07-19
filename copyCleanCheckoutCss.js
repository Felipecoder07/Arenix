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

const sharedStyles = `
  /* Shared layout components */
  .nav-brand {
    display: flex;
    align-items: center;
    gap: 10px;
    text-decoration: none;
  }
  .nav-brand-icon {
    width: 32px; height: 32px;
    background: var(--charcoal);
    color: var(--off-white);
    border-radius: var(--r-md);
    font-size: 12px;
    font-weight: 600;
    display: grid;
    place-items: center;
    letter-spacing: -0.3px;
  }
  .nav-brand-name {
    font-size: 16px;
    font-weight: 600;
    color: var(--charcoal);
  }
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-family: var(--font);
    font-size: 15px;
    font-weight: 400;
    line-height: 1.5;
    padding: 9px 18px;
    border-radius: var(--r-md);
    border: none;
    cursor: pointer;
    transition: opacity 0.15s;
    text-decoration: none;
  }
  .btn:active { opacity: 0.8; }
  .btn-dark {
    background: var(--charcoal);
    color: var(--off-white);
    box-shadow: var(--shadow-btn-dark);
    border: 1px solid transparent;
  }
  .btn-dark:hover { opacity: 0.87; }
  .btn-ghost {
    background: transparent;
    color: var(--charcoal);
    border: 1px solid var(--border-active);
  }
  .btn-ghost:hover { background: var(--charcoal-04); }
  .btn-lg {
    font-size: 16px;
    padding: 12px 28px;
    border-radius: var(--r-md);
  }
  .btn-full { width: 100%; }
`;

// Extract original CSS from landing-cadastro.html style tag
const html = fs.readFileSync('frontend/landing-cadastro.html', 'utf8');
const start = html.indexOf('<style>');
const end = html.indexOf('</style>');
let rawCss = html.substring(start + 7, end).trim();

// Append the webkit-appearance override for radio buttons
rawCss = rawCss.replace(
  /\.plan-option\s+input\[type=radio\]\s*\{([\s\S]*?)\}/g,
  `.plan-option input[type=radio] {
      appearance: auto;
      -webkit-appearance: radio;
      accent-color: var(--charcoal);
      margin: 0;
      width: 16px;
      height: 16px;
    }`
);

// Replace any nested :root in rawCss to merge into variables Block
let extractedRootVars = '';
rawCss = rawCss.replace(/:root\s*\{([\s\S]*?)\}/g, (m, p1) => {
  extractedRootVars += p1 + '\n';
  return '';
});

// Wrap everything inside .scope-checkout-page
const finalCss = `.scope-checkout-page {
${variablesBlock}
${extractedRootVars}
  
${rawCss}
${sharedStyles}
}`;

fs.writeFileSync('master-templates/src/assets/css/checkout.css', finalCss);
console.log('Checkout CSS cleanly scoped with merged variables!');
