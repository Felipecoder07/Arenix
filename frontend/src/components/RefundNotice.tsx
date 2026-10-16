import type { RefundQuote } from '../hooks/useRefundQuote';

export function RefundNotice({ quote, error, loading }: { quote: RefundQuote | null; error: string; loading: boolean }) {
  if (loading) return <p role="status">Consultando saldo para devolução...</p>;
  if (error) return <p role="alert">{error}</p>;
  if (!quote?.online) return <p>Estorno manual: confirme que a devolução ao cliente foi realizada. Esta ação registra a saída no caixa.</p>;
  return <div role="status">
    <p>Devolução integral do saldo online pelo Mercado Pago: <strong>{(quote.valor_centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>. O caixa será atualizado após a confirmação do provedor.</p>
    <p>Horários envolvidos: {quote.reservas.map(row => `#${row.id} (${row.data.split('-').reverse().join('/')} ${row.inicio}–${row.fim})`).join(', ')}.</p>
    <p>O estorno não solicita o cancelamento dos horários. Se o cancelamento já estiver pendente, será concluído quando não houver saldo ou cobrança pendente.</p>
    {quote.valor_centavos <= 0 && <p>Não há saldo online confirmado para devolver.</p>}
  </div>;
}
