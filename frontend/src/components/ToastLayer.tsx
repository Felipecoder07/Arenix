import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Keep feedback above modal backdrops, outside page stacking contexts. */
export function ToastLayer({ children }: { children: ReactNode }) {
  return createPortal(
    <div data-toast-layer="" role="status" aria-live="polite" aria-atomic="true"
      className="fixed inset-0 z-[20000] pointer-events-none [&>*]:pointer-events-auto [&>*]:max-w-[calc(100vw-3rem)] [&>*]:break-words">
      {children}
    </div>,
    document.body,
  );
}
