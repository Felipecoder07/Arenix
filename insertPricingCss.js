const fs = require('fs');

const pricingStyles = `
    /* ── Billing Toggle ── */
    .billing-toggle {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: var(--cream);
      border: 1px solid var(--border-warm);
      border-radius: var(--r-pill);
      padding: 4px;
      margin-top: 24px;
    }

    .billing-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 18px;
      border-radius: var(--r-pill);
      border: none;
      background: transparent;
      color: var(--muted);
      font-family: var(--font);
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s, color 0.2s, box-shadow 0.2s;
    }

    .billing-btn.active,
    .billing-btn:hover {
      background: var(--charcoal);
      color: var(--off-white);
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.18);
    }

    .billing-save-badge {
      font-size: 11px;
      font-weight: 600;
      background: #d1fae5;
      color: #065f46;
      padding: 2px 7px;
      border-radius: var(--r-pill);
      transition: background 0.2s, color 0.2s;
    }

    .billing-btn.active .billing-save-badge,
    .billing-btn:hover .billing-save-badge {
      background: rgba(209, 250, 229, 0.25);
      color: #6ee7b7;
    }

    /* ── Interactive Price Cards ── */
    .price-card,
    .price-card .price-plan,
    .price-card .price-value,
    .price-card .price-period,
    .price-card .price-features li,
    .price-card .price-features li::before,
    .price-card .btn-ghost,
    .price-card .btn-dark,
    .price-card .price-badge {
      transition: background 0.55s cubic-bezier(0.4, 0, 0.2, 1),
                  color 0.55s cubic-bezier(0.4, 0, 0.2, 1),
                  border-color 0.55s cubic-bezier(0.4, 0, 0.2, 1),
                  opacity 0.55s cubic-bezier(0.4, 0, 0.2, 1),
                  transform 0.4s cubic-bezier(0.4, 0, 0.2, 1),
                  box-shadow 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .price-card:hover {
      background: var(--charcoal) !important;
      border-color: var(--charcoal) !important;
      color: var(--off-white) !important;
    }

    .price-card:hover .price-plan {
      color: var(--off-white) !important;
      opacity: 0.7 !important;
    }

    .price-card:hover .price-value {
      color: var(--off-white) !important;
    }

    .price-card:hover .price-period {
      color: rgba(252, 251, 248, 0.55) !important;
    }

    .price-card:hover .price-features li {
      color: rgba(252, 251, 248, 0.7) !important;
    }

    .price-card:hover .price-features li::before {
      color: var(--off-white) !important;
    }

    .price-card:hover .btn-ghost {
      border-color: rgba(252, 251, 248, 0.3) !important;
      color: var(--off-white) !important;
    }

    .price-card:hover .btn-ghost:hover {
      background: rgba(252, 251, 248, 0.08) !important;
    }

    /* Inverter botão escuro do Enterprise */
    .price-card:hover .btn-dark {
      background: var(--off-white) !important;
      color: var(--charcoal) !important;
    }

    /* Badge Mais Popular */
    .price-card:hover .price-badge {
      background: var(--off-white) !important;
      color: var(--charcoal) !important;
    }

    /* ── Price card hover lift & Layout ── */
    .price-card {
      cursor: default;
      display: flex;
      flex-direction: column;
    }

    .price-card .btn-ghost,
    .price-card .btn-dark {
      margin-top: auto;
    }

    .price-card:hover {
      transform: translateY(-6px);
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.09);
      border-color: var(--border-active);
    }

    .price-card.featured:hover {
      transform: translateY(-6px);
      box-shadow: 0 16px 48px rgba(28, 26, 24, 0.28);
    }

    /* ── Price amount animation ── */
    .price-amount {
      display: inline-block;
      transition: opacity 0.18s ease, transform 0.18s ease;
    }

    .price-amount.fade-out {
      opacity: 0;
      transform: translateY(-6px);
    }

    .price-amount.fade-in {
      opacity: 1;
      transform: translateY(0);
    }

    /* ── Pricing note ── */
    .pricing-note {
      text-align: center;
      font-size: 13px;
      color: var(--muted);
      margin-top: 28px;
    }
`;

let css = fs.readFileSync('master-templates/src/assets/css/landing.css', 'utf8');

// Insert styles just before the last closing bracket
const lastBracketIdx = css.lastIndexOf('}');
if (lastBracketIdx !== -1) {
  css = css.substring(0, lastBracketIdx) + pricingStyles + '\n}';
}

fs.writeFileSync('master-templates/src/assets/css/landing.css', css);
console.log('Pricing styles inserted into landing.css!');
