import { useState } from 'react';
import { Plus, Trash2, Wrench, Info } from 'lucide-react';
import { Card, Badge, Button, PageHeader, Field, Input, Textarea, ConfirmModal } from '../components/ui';
import { CANCELLATION_REASONS, SYSTEM_VERSION } from '../data/mock';

export function MasterConfiguracoes() {
  const [trialDays, setTrialDays] = useState('14');
  const [reasons, setReasons] = useState(CANCELLATION_REASONS);
  const [newReason, setNewReason] = useState('');
  const [maintenance, setMaintenance] = useState(false);
  const [maintenanceMsg, setMaintenanceMsg] = useState('Estamos em manutenção programada. Voltamos em instantes.');
  const [confirmMaint, setConfirmMaint] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader title="Configurações da plataforma" description="Parâmetros globais herdados por todas as arenas." />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Trial */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-1">Período de trial</h3>
          <p className="text-xs text-muted mb-4">Duração padrão (em dias) do trial para novas arenas cadastradas.</p>
          <Field label="Dias de trial">
            <Input type="number" min={1} max={90} value={trialDays} onChange={(e) => setTrialDays(e.target.value)} className="w-32" />
          </Field>
          <div className="flex justify-end mt-4">
            <Button variant="primary">Salvar</Button>
          </div>
        </Card>

        {/* System version */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-1">
            <Info size={14} className="text-muted" />
            <h3 className="text-sm font-semibold">Versão do sistema</h3>
          </div>
          <p className="text-xs text-muted mb-4">Somente leitura — controlada pelo deploy da plataforma.</p>
          <div className="px-4 py-3 rounded-lg bg-cream/50 border border-border-passive font-mono text-sm text-charcoal">
            {SYSTEM_VERSION}
          </div>
        </Card>
      </div>

      {/* Cancellation reasons */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-1">Motivos de cancelamento (globais)</h3>
        <p className="text-xs text-muted mb-4">Lista editável herdada por todas as arenas ao registrar um cancelamento.</p>
        <div className="space-y-2">
          {reasons.map((r, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cream/40 border border-border-passive">
              <span className="text-xs font-mono text-muted w-6">{String(i + 1).padStart(2, '0')}</span>
              <Input defaultValue={r} className="border-transparent bg-transparent hover:bg-off-white focus:bg-off-white" />
              <Button size="sm" variant="ghost" className="text-danger hover:bg-danger-soft shrink-0" onClick={() => setReasons(reasons.filter((_, idx) => idx !== i))}>
                <Trash2 size={13} />
              </Button>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-3">
          <Input placeholder="Adicionar novo motivo..." value={newReason} onChange={(e) => setNewReason(e.target.value)} />
          <Button variant="secondary" disabled={!newReason.trim()} onClick={() => { setReasons([...reasons, newReason]); setNewReason(''); }}>
            <Plus size={14} /> Adicionar
          </Button>
        </div>
      </Card>

      {/* Maintenance mode */}
      <Card className={`p-5 ${maintenance ? 'border-warning/30 bg-warning-soft/30' : ''}`}>
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${maintenance ? 'bg-warning/15 text-warning' : 'bg-cream-surface text-muted'}`}>
            <Wrench size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">Modo manutenção global</h3>
              {maintenance && <Badge status="warning">Ativo</Badge>}
            </div>
            <p className="text-xs text-muted mt-0.5 mb-4">Quando ativo, todos os tenants veem a mensagem abaixo no lugar do painel.</p>
            <Field label="Mensagem exibida aos tenants">
              <Textarea rows={2} value={maintenanceMsg} onChange={(e) => setMaintenanceMsg(e.target.value)} disabled={!maintenance} />
            </Field>
            <div className="flex items-center justify-between mt-4">
              <label className="flex items-center gap-2 text-sm text-charcoal cursor-pointer">
                <button
                  type="button"
                  role="switch"
                  aria-checked={maintenance}
                  onClick={() => { if (!maintenance) setConfirmMaint(true); else setMaintenance(false); }}
                  className={`relative w-10 h-6 rounded-full transition-colors ${maintenance ? 'bg-warning' : 'bg-charcoal/15'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-off-white shadow transition-transform ${maintenance ? 'translate-x-4' : ''}`} />
                </button>
                {maintenance ? 'Modo manutenção ativo' : 'Modo manutenção inativo'}
              </label>
            </div>
          </div>
        </div>
      </Card>

      <ConfirmModal
        open={confirmMaint}
        onClose={() => setConfirmMaint(false)}
        onConfirm={() => { setMaintenance(true); setConfirmMaint(false); }}
        title="Ativar modo manutenção global"
        destructive
        requirePassword
        confirmLabel="Ativar agora"
        message={<>Todos os tenants verão a mensagem de manutenção no lugar do painel até que o modo seja desativado. Esta ação fica registrada em auditoria.</>}
      />
    </div>
  );
}
