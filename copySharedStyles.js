const fs = require('fs');

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

// Append shared styles inside checkout.css
let checkoutCss = fs.readFileSync('master-templates/src/assets/css/checkout.css', 'utf8');
const checkoutLastBracket = checkoutCss.lastIndexOf('}');
if (checkoutLastBracket !== -1) {
  checkoutCss = checkoutCss.substring(0, checkoutLastBracket) + sharedStyles + '\n}';
}
fs.writeFileSync('master-templates/src/assets/css/checkout.css', checkoutCss);
console.log('Shared styles injected into checkout.css!');

// Append shared styles inside tenant-login.css
let loginCss = fs.readFileSync('master-templates/src/assets/css/tenant-login.css', 'utf8');
const loginLastBracket = loginCss.lastIndexOf('}');
if (loginLastBracket !== -1) {
  loginCss = loginCss.substring(0, loginLastBracket) + sharedStyles + '\n}';
}
fs.writeFileSync('master-templates/src/assets/css/tenant-login.css', loginCss);
console.log('Shared styles injected into tenant-login.css!');
