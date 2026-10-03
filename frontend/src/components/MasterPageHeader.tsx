import type { ReactNode } from 'react';

export function MasterPageHeader({ title, description, actions, context = 'Painel Master' }: Readonly<{ title: string; description?: string; actions?: ReactNode; context?: string | false }>) {
  return <div className="master-page-header">
    <div><h1>{title}</h1>{description && <p>{description}</p>}</div>
    <div className="master-header-actions">{context && <span className="master-context"><i /> {context}</span>}{actions}</div>
  </div>;
}
