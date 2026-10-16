import { useState } from 'react';
import { PixRecovery, type PixIssue } from '../components/PixRecovery';

export function usePixRecovery() {
  const [recovery, setRecovery] = useState<{ issue: PixIssue; url: string; revision: number } | null>(null);
  return {
    show: (issue: PixIssue, url: string) => setRecovery(previous => ({ issue, url, revision: (previous?.revision || 0) + 1 })),
    notice: recovery ? <PixRecovery key={`${recovery.url}:${recovery.revision}`} recovery={recovery} onClose={() => setRecovery(null)} /> : null,
  };
}
