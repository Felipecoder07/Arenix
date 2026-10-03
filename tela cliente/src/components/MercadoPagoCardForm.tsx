import { useEffect, useRef, useState } from 'react';

export interface CardPaymentData {
  token: string;
  payment_method_id: string;
  issuerId?: string;
  installments: number;
  cardholderEmail: string;
  identificationType: string;
  identificationNumber: string;
}

interface CardFormData {
  token?: string;
  paymentMethodId?: string;
  issuerId?: string;
  installments?: string | number;
  cardholderEmail?: string;
  identificationType?: string;
  identificationNumber?: string;
}

interface CardFormController {
  getCardFormData: () => CardFormData;
  unmount?: () => void;
}

interface MercadoPagoClient {
  cardForm: (options: Record<string, unknown>) => CardFormController;
}

declare global {
  interface Window { MercadoPago?: new (key: string, options: { locale: string }) => MercadoPagoClient; }
}

interface Props {
  publicKey: string;
  amount: number;
  onSubmit: (data: CardPaymentData) => Promise<void>;
  onBusyChange: (busy: boolean) => void;
}

export default function MercadoPagoCardForm({ publicKey, amount, onSubmit, onBusyChange }: Readonly<Props>) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const submitRef = useRef(onSubmit);
  const busyRef = useRef(onBusyChange);
  submitRef.current = onSubmit;
  busyRef.current = onBusyChange;

  useEffect(() => {
    let active = true;
    let cardForm: CardFormController | undefined;
    const mount = () => {
      const MercadoPago = window.MercadoPago;
      if (!active || !MercadoPago) return false;
      try {
        const mp = new MercadoPago(publicKey, { locale: 'pt-BR' });
        cardForm = mp.cardForm({
          amount: amount.toFixed(2),
          iframe: true,
          form: {
            id: 'mercado-pago-card-form',
            cardNumber: { id: 'mp-card-number', placeholder: 'Número do cartão' },
            expirationDate: { id: 'mp-card-expiration', placeholder: 'MM/AA' },
            securityCode: { id: 'mp-card-security', placeholder: 'CVV' },
            cardholderName: { id: 'mp-cardholder-name', placeholder: 'Nome impresso no cartão' },
            issuer: { id: 'mp-card-issuer', placeholder: 'Banco emissor' },
            installments: { id: 'mp-card-installments', placeholder: 'Parcelas' },
            identificationType: { id: 'mp-card-id-type', placeholder: 'Tipo de documento' },
            identificationNumber: { id: 'mp-card-id-number', placeholder: 'CPF do titular' },
            cardholderEmail: { id: 'mp-card-email', placeholder: 'E-mail do titular' }
          },
          callbacks: {
            onFormMounted: (formError?: unknown) => {
              if (!active) return;
              if (formError) setError('Não foi possível carregar o formulário do Mercado Pago.');
              else setReady(true);
            },
            onSubmit: (event: Event) => {
              event.preventDefault();
              const data = cardForm?.getCardFormData();
              if (!data?.token || !data.paymentMethodId || !data.cardholderEmail || !data.identificationType || !data.identificationNumber) {
                setError('Confira os dados do cartão e do titular.');
                return;
              }
              setError('');
              busyRef.current(true);
              void submitRef.current({
                token: data.token,
                payment_method_id: data.paymentMethodId,
                issuerId: data.issuerId,
                installments: Number(data.installments) || 1,
                cardholderEmail: data.cardholderEmail,
                identificationType: data.identificationType,
                identificationNumber: data.identificationNumber
              }).catch(() => setError('Não foi possível concluir o pagamento. Confira o status antes de tentar novamente.'))
                .finally(() => busyRef.current(false));
            }
          }
        });
        return true;
      } catch {
        setError('Não foi possível iniciar o formulário do Mercado Pago.');
        return true;
      }
    };
    if (mount()) return () => { active = false; cardForm?.unmount?.(); };
    const timer = window.setInterval(() => { if (mount()) window.clearInterval(timer); }, 250);
    const timeout = window.setTimeout(() => {
      window.clearInterval(timer);
      if (active && !window.MercadoPago) setError('O SDK do Mercado Pago não carregou. Verifique a conexão e tente novamente.');
    }, 10000);
    return () => { active = false; window.clearInterval(timer); window.clearTimeout(timeout); cardForm?.unmount?.(); };
  }, [publicKey, amount]);

  return (
    <form id="mercado-pago-card-form" className="space-y-3" onSubmit={(event) => event.preventDefault()}>
      <div className="rounded-xl border border-edge p-3 space-y-3">
        <label className="block text-xs font-medium text-charcoal">Número do cartão<div id="mp-card-number" className="mp-secure-field mt-1" /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-medium text-charcoal">Validade<div id="mp-card-expiration" className="mp-secure-field mt-1" /></label>
          <label className="block text-xs font-medium text-charcoal">Código de segurança<div id="mp-card-security" className="mp-secure-field mt-1" /></label>
        </div>
        <label className="block text-xs font-medium text-charcoal">Nome no cartão<input id="mp-cardholder-name" autoComplete="cc-name" className="mp-card-input mt-1" /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-medium text-charcoal">Banco emissor<select id="mp-card-issuer" className="mp-card-input mt-1" /></label>
          <label className="block text-xs font-medium text-charcoal">Parcelas<select id="mp-card-installments" className="mp-card-input mt-1" /></label>
        </div>
        <label className="block text-xs font-medium text-charcoal">Documento<select id="mp-card-id-type" className="mp-card-input mt-1" /></label>
        <label className="block text-xs font-medium text-charcoal">Número do documento<input id="mp-card-id-number" inputMode="numeric" autoComplete="off" className="mp-card-input mt-1" /></label>
        <label className="block text-xs font-medium text-charcoal">E-mail do titular<input id="mp-card-email" type="email" autoComplete="email" className="mp-card-input mt-1" /></label>
      </div>
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      {!ready && !error && <p className="text-xs text-muted">Carregando pagamento seguro…</p>}
    </form>
  );
}
