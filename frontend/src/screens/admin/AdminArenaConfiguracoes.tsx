import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Building2, Building, MapPin, Phone, Mail, Image as ImageIcon, Upload, Save, Clock } from 'lucide-react';
import { apiFetch } from '../../utils/apiFetch';
import { safeStorage } from '../../utils/safeStorage';

type Arena = {
  nome: string;
  endereco: string;
  telefone: string;
  email: string;
  fuso_horario: string;
  foto_capa: string;
  status: number;
};

const EMPTY_ARENA: Arena = {
  nome: '', endereco: '', telefone: '', email: '',
  fuso_horario: 'America/Sao_Paulo', foto_capa: '', status: 1,
};

const SUGESTOES = [
  { label: 'Beach tennis', src: '/arena/arena-beach-tennis.jpg' },
  { label: 'Futebol society', src: '/arena/arena-futebol-society.jpg' },
  { label: 'Quadra coberta', src: '/arena/arena-quadra-coberta.jpg' },
];

const FUSOS = [
  { value: 'America/Sao_Paulo', label: 'Horário de Brasília · UTC−3' },
  { value: 'America/Manaus', label: 'Horário de Manaus · UTC−4' },
  { value: 'America/Rio_Branco', label: 'Horário do Acre · UTC−5' },
  { value: 'America/Noronha', label: 'Fernando de Noronha · UTC−2' },
];

const inputClass = 'w-full h-[38px] min-w-0 bg-white border border-[#DED6CA] rounded-[8px] px-[10px] text-[11px] font-semibold text-[#394236] outline-none focus:border-[#6A8D31]';

function imageDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    reader.readAsDataURL(file);
  });
}

export function AdminArenaConfiguracoes() {
  const [arena, setArena] = useState<Arena>(EMPTY_ARENA);
  const [intervaloGrade, setIntervaloGrade] = useState(() => safeStorage.getItem('grade_interval') === '30' ? '30' : '60');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const response = await apiFetch('/api/arenas/minha');
        if (!response.ok) throw new Error('Não foi possível carregar os dados da arena.');
        const data = await response.json();
        if (mounted) setArena({
          nome: data.nome || '', endereco: data.endereco || '',
          telefone: data.telefone || '', email: data.email || '',
          fuso_horario: data.fuso_horario || 'America/Sao_Paulo',
          foto_capa: data.foto_capa || '', status: Number(data.status ?? 1),
        });
      } catch (error) {
        if (mounted) setMessage({ text: error instanceof Error ? error.message : 'Erro ao carregar a arena.', error: true });
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  const setField = (field: keyof Arena, value: string) => setArena(previous => ({ ...previous, [field]: value }));

  async function uploadPhoto(file: File) {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setMessage({ text: 'Escolha uma imagem PNG, JPG ou WEBP.', error: true });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ text: 'A imagem deve ter no máximo 5 MB.', error: true });
      return;
    }
    setUploading(true);
    setMessage(null);
    try {
      const image = await imageDataUrl(file);
      const response = await apiFetch('/api/arenas/upload-capa', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image }),
      });
      const result = await response.json();
      if (!response.ok || !result.foto_capa) throw new Error(result.error || 'Não foi possível enviar a imagem.');
      setField('foto_capa', result.foto_capa);
      setMessage({ text: 'Foto enviada. Salve as configurações para aplicá-la.', error: false });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'Erro ao enviar a imagem.', error: true });
    } finally {
      setUploading(false);
    }
  }

  async function choosePreset(src: string) {
    try {
      const response = await fetch(src);
      if (!response.ok) throw new Error('Não foi possível carregar a foto sugerida.');
      const blob = await response.blob();
      await uploadPhoto(new File([blob], 'capa-sugerida.jpg', { type: 'image/jpeg' }));
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'Erro ao escolher a foto.', error: true });
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!arena.nome.trim()) {
      setMessage({ text: 'Informe o nome da arena.', error: true });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const response = await apiFetch('/api/arenas/minha', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: arena.nome.trim(), endereco: arena.endereco.trim(),
          telefone: arena.telefone.trim(), email: arena.email.trim(),
          fuso_horario: arena.fuso_horario, foto_capa: arena.foto_capa,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Não foi possível salvar os dados da arena.');
      }
      safeStorage.setItem('arena_nome', arena.nome.trim());
      safeStorage.setItem('grade_interval', intervaloGrade);
      setMessage({ text: 'Configurações da arena salvas com sucesso.', error: false });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'Erro ao salvar a arena.', error: true });
    } finally {
      setSaving(false);
    }
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void uploadPhoto(file);
    event.target.value = '';
  }

  return (
    <form onSubmit={save} data-pencil-name="Painel Configurações Arena" className="box-border flex-1 w-full min-w-0 flex flex-col gap-[14px] p-[22px] bg-white outline outline-1 outline-[#E6DED2] -outline-offset-1 rounded-[18px] font-[Inter,system-ui,sans-serif]">
      <div className="w-full flex flex-wrap gap-3 justify-between items-start">
        <div>
          <h2 className="text-[18px] font-extrabold text-[#071915]">Dados da arena</h2>
          <p className="text-[11px] font-medium text-[#6F766F]">Informações exibidas para clientes, equipe e nos comprovantes.</p>
        </div>
        {!loading && <span className={`flex items-center gap-[6px] px-[10px] py-[6px] rounded-full text-[10px] font-bold ${arena.status ? 'bg-[#EAF8EF] text-[#1F7A45]' : 'bg-[#F1EDE6] text-[#6F766F]'}`}>
          <span className={`w-[7px] h-[7px] rounded-full ${arena.status ? 'bg-[#2BAE66]' : 'bg-[#8A8F88]'}`} />
          {arena.status ? 'Arena ativa' : 'Arena inativa'}
        </span>}
      </div>

      {loading ? <p className="p-5 text-sm text-[#6F766F]">Carregando dados da arena...</p> : <>
        <div className="w-full grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-[14px]">
          <section className="flex flex-col gap-[12px] p-[16px] bg-[#FAF8F4] outline outline-1 outline-[#E8E1D7] -outline-offset-1 rounded-[14px]">
            <div className="flex items-center gap-[10px]">
              <div className="w-[34px] h-[34px] flex items-center justify-center bg-[#C9FF3B] rounded-[10px]"><Building2 size={16} /></div>
              <div><h3 className="text-[13px] font-extrabold text-[#071915]">Informações principais</h3><p className="text-[9px] text-[#8A8F88]">Dados de contato e localização</p></div>
            </div>
            <label className="flex flex-col gap-[5px] text-[10px] font-bold text-[#394236]">Nome da arena *
              <span className="relative"><Building size={14} className="absolute left-3 top-3 text-[#8A9088]" /><input required value={arena.nome} onChange={e => setField('nome', e.target.value)} className={`${inputClass} pl-8`} /></span>
            </label>
            <label className="flex flex-col gap-[5px] text-[10px] font-bold text-[#394236]">Endereço
              <span className="relative"><MapPin size={14} className="absolute left-3 top-3 text-[#8A9088]" /><input value={arena.endereco} onChange={e => setField('endereco', e.target.value)} className={`${inputClass} pl-8`} /></span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[10px]">
              <label className="flex flex-col gap-[5px] text-[10px] font-bold text-[#394236]">Telefone
                <span className="relative"><Phone size={14} className="absolute left-3 top-3 text-[#8A9088]" /><input type="tel" value={arena.telefone} onChange={e => setField('telefone', e.target.value)} className={`${inputClass} pl-8`} /></span>
              </label>
              <label className="flex flex-col gap-[5px] text-[10px] font-bold text-[#394236]">E-mail
                <span className="relative"><Mail size={14} className="absolute left-3 top-3 text-[#8A9088]" /><input type="email" value={arena.email} onChange={e => setField('email', e.target.value)} className={`${inputClass} pl-8`} /></span>
              </label>
            </div>
            <label className="flex flex-col gap-[5px] text-[10px] font-bold text-[#394236]">Fuso horário
              <select value={arena.fuso_horario} onChange={e => setField('fuso_horario', e.target.value)} className={inputClass}>
                {FUSOS.map(fuso => <option key={fuso.value} value={fuso.value}>{fuso.label}</option>)}
              </select>
            </label>
          </section>

          <section className="flex flex-col gap-[11px] p-[16px] bg-[#FAF8F4] outline outline-1 outline-[#E8E1D7] -outline-offset-1 rounded-[14px]">
            <div className="flex justify-between items-center"><div><h3 className="text-[13px] font-extrabold text-[#071915]">Foto de capa</h3><p className="text-[9px] text-[#8A8F88]">Visível no portal do cliente</p></div><ImageIcon size={17} className="text-[#6F766F]" /></div>
            <img src={arena.foto_capa || '/arena/arena-capa-referencia.jpg'} alt="Prévia da capa da arena" className="w-full h-[150px] object-cover rounded-[11px]" />
            <label className="h-[38px] flex items-center justify-center gap-[7px] bg-[#071915] hover:bg-[#18332B] text-white text-[10px] font-extrabold rounded-[9px] cursor-pointer">
              <Upload size={14} className="text-[#C9FF3B]" />{uploading ? 'Enviando foto...' : 'Escolher nova foto'}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={uploading} onChange={handleFile} />
            </label>
            <p className="text-[9px] text-[#8A8F88] text-center">PNG, JPG ou WEBP · máximo 5 MB</p>
          </section>
        </div>

        <div className="w-full grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_260px] gap-[14px]">
          <section className="flex flex-col gap-[11px] p-[15px] bg-[#FAF8F4] outline outline-1 outline-[#E8E1D7] -outline-offset-1 rounded-[14px]">
            <div className="flex justify-between gap-2"><h3 className="text-[12px] font-extrabold text-[#071915]">Sugestões para sua arena</h3><span className="text-[9px] text-[#8A8F88]">Escolha uma imagem pronta</span></div>
            <div className="grid grid-cols-3 gap-[10px]">
              {SUGESTOES.map(sugestao => <button key={sugestao.src} type="button" disabled={uploading} onClick={() => void choosePreset(sugestao.src)} className="overflow-hidden rounded-[10px] bg-white border border-[#E8E1D7] hover:border-[#6A8D31] cursor-pointer disabled:opacity-50">
                <img src={sugestao.src} alt="" className="w-full h-[88px] object-cover" /><span className="block p-[7px] text-[9px] font-bold text-[#394236]">{sugestao.label}</span>
              </button>)}
            </div>
          </section>
          <section className="flex flex-col gap-[12px] p-[15px] bg-[#F4F9F0] outline outline-1 outline-[#DCE8D5] -outline-offset-1 rounded-[14px]">
            <div className="flex items-center gap-2"><Clock size={15} className="text-[#597535]" /><h3 className="text-[12px] font-extrabold text-[#071915]">Aparência do sistema</h3></div>
            <label className="flex flex-col gap-[6px] text-[10px] font-bold text-[#394236]">Intervalo da grade de horários
              <select value={intervaloGrade} onChange={e => setIntervaloGrade(e.target.value)} className={inputClass}>
                <option value="60">60 em 60 minutos</option><option value="30">30 em 30 minutos</option>
              </select>
            </label>
            <p className="text-[9px] leading-[13px] text-[#6B7960]">Define a divisão visual usada na agenda de reservas neste navegador.</p>
          </section>
        </div>
        {message && <div role="status" className={`w-full p-3 rounded-[10px] text-sm ${message.error ? 'bg-red-50 text-red-800' : 'bg-[#EAF8EF] text-[#1F7A45]'}`}>{message.text}</div>}
        <div className="w-full flex justify-end pt-[4px]"><button type="submit" disabled={saving || uploading} className="h-[42px] flex items-center gap-2 px-[17px] bg-[#071915] hover:bg-[#18332B] text-white text-[12px] font-extrabold rounded-[10px] cursor-pointer disabled:opacity-50"><Save size={15} className="text-[#C9FF3B]" />{saving ? 'Salvando...' : 'Salvar configurações'}</button></div>
      </>}
    </form>
  );
}
