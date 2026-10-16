import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const project = path.resolve(here, '../..');
const outputDir = path.join(here, 'frames');
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const ffmpeg = 'C:/Program Files/BlueStacks_nxt/ffmpeg.exe';
const lime = '#C8F04B';
const bg = '#0B130F';
const white = '#F2F6F0';
const muted = '#8E9F94';

mkdirSync(outputDir, { recursive: true });

function ball(cx, cy, r) {
  return `<g opacity=".92"><circle cx="${cx}" cy="${cy}" r="${r}" fill="${lime}"/><path d="M${cx-r*.78} ${cy-r*.1} Q${cx} ${cy-r*.9} ${cx+r*.75} ${cy-r*.42} M${cx-r*.5} ${cy+r*.68} Q${cx+r*.15} ${cy} ${cx+r*.38} ${cy-r*.84} M${cx-r*.86} ${cy+r*.2} Q${cx} ${cy+r*.2} ${cx+r*.83} ${cy+r*.75}" fill="none" stroke="${bg}" stroke-width="${r*.07}" opacity=".7"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#F2F6F0" stroke-width="3" opacity=".18"/></g>`;
}

function mockDashboard(kind) {
  const isSchedule = kind === 'schedule';
  const labels = isSchedule ? ['18:00  QUADRA 1', '19:00  QUADRA 2', '20:00  QUADRA 1'] : ['PIX RECEBIDO', 'RESERVAS HOJE', 'OCUPAÇÃO'];
  const values = isSchedule ? ['Ana + equipe', 'Turma noturna', 'Jogo confirmado'] : ['R$ 840,00', '18', '87%'];
  return `<g transform="translate(100 1070)"><rect width="880" height="430" rx="34" fill="#F2F6F0"/><rect x="0" y="0" width="880" height="82" rx="34" fill="#13241A"/><path d="M0 48h880v34H0z" fill="#13241A"/><circle cx="42" cy="41" r="8" fill="${lime}"/><text font-family="Arial, sans-serif" x="68" y="49" font-size="25" font-weight="700" fill="${white}">CourtManager</text><text font-family="Arial, sans-serif" x="792" y="49" text-anchor="end" font-size="18" fill="#B9C8BC">PAINEL</text>${labels.map((label,i)=>`<g transform="translate(30 ${112+i*94})"><rect width="820" height="72" rx="16" fill="#FFFFFF"/><rect x="18" y="20" width="32" height="32" rx="10" fill="${lime}"/><text font-family="Arial, sans-serif" x="72" y="31" font-size="17" font-weight="700" fill="#425248">${label}</text><text font-family="Arial, sans-serif" x="72" y="56" font-size="22" font-weight="700" fill="#0B130F">${values[i]}</text><text font-family="Arial, sans-serif" x="790" y="46" text-anchor="end" font-size="22" fill="#218451">✓</text></g>`).join('')}</g>`;
}

const scenes = [
  { tag:'GESTÃO PARA ARENAS DE VÔLEI', lines:['Sua arena', 'merece jogar', 'em outro nível.'], sub:'Menos burocracia. Mais tempo para o esporte.', art:ball(930,690,190), panel:'' },
  { tag:'RESERVAS 24 HORAS', lines:['Quadras', 'organizadas.', 'Jogo marcado.'], sub:'Veja horários e acompanhe cada reserva em um só lugar.', art:'', panel:mockDashboard('schedule') },
  { tag:'PAGAMENTOS SIMPLES', lines:['Receba por', 'Pix, cartão e', 'dinheiro.'], sub:'Saiba o que entrou e o que ainda está pendente.', art:`<g transform="translate(190 1080)"><rect width="700" height="310" rx="36" fill="#F2F6F0"/><text font-family="Arial, sans-serif" x="54" y="83" font-size="20" font-weight="700" fill="#566E60">RECEBIMENTOS DO DIA</text><text font-family="Arial, sans-serif" x="54" y="178" font-size="66" font-weight="700" fill="#0B130F">R$ 1.240,00</text><rect x="54" y="220" width="174" height="54" rx="27" fill="${lime}"/><text font-family="Arial, sans-serif" x="141" y="255" text-anchor="middle" font-size="19" font-weight="700" fill="#0B130F">PIX  ✓</text><rect x="248" y="220" width="190" height="54" rx="27" fill="#DDE5DC"/><text font-family="Arial, sans-serif" x="343" y="255" text-anchor="middle" font-size="19" font-weight="700" fill="#33433A">CARTÃO</text><rect x="458" y="220" width="188" height="54" rx="27" fill="#DDE5DC"/><text font-family="Arial, sans-serif" x="552" y="255" text-anchor="middle" font-size="19" font-weight="700" fill="#33433A">DINHEIRO</text></g>`, panel:'' },
  { tag:'CLIENTES E INDICADORES', lines:['Tudo que você', 'precisa saber,', 'num só painel.'], sub:'Histórico de clientes, ocupação e faturamento juntos.', art:'', panel:mockDashboard('metrics') },
  { tag:'COURTMANAGER', lines:['Mais jogo.', 'Menos', 'planilha.'], sub:'Experimente 14 dias grátis e organize sua arena.', art:ball(820,720,210), panel:`<g transform="translate(180 1250)"><rect width="720" height="104" rx="26" fill="${lime}"/><text font-family="Arial, sans-serif" x="360" y="66" text-anchor="middle" font-size="30" font-weight="700" fill="#0B130F">COMECE SEU TESTE GRÁTIS  →</text></g>` },
];

for (const [i, scene] of scenes.entries()) {
  const lines = scene.lines.map((line, n) => `<text x="92" y="${574+n*108}" font-family="Arial, sans-serif" font-size="82" font-weight="700" letter-spacing="-2" fill="${n === 1 ? lime : white}">${line}</text>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920"><defs><radialGradient id="glow"><stop stop-color="#1A3828"/><stop offset="1" stop-color="${bg}"/></radialGradient><pattern id="dots" width="44" height="44" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.5" fill="#8E9F94" opacity=".16"/></pattern></defs><rect width="1080" height="1920" fill="url(#glow)"/><rect width="1080" height="1920" fill="url(#dots)"/><circle cx="920" cy="310" r="350" fill="${lime}" opacity=".035"/><path d="M0 1600 Q540 1480 1080 1600 V1920 H0Z" fill="#101C14" opacity=".75"/><rect x="72" y="92" width="12" height="42" rx="6" fill="${lime}"/><text x="108" y="123" font-family="Arial, sans-serif" font-size="23" font-weight="700" letter-spacing="3" fill="${white}">COURTMANAGER</text><text x="92" y="430" font-family="Arial, sans-serif" font-size="19" font-weight="700" letter-spacing="4" fill="${lime}">${scene.tag}</text>${lines}<text x="96" y="940" font-family="Arial, sans-serif" font-size="27" fill="${muted}">${scene.sub}</text>${scene.art}${scene.panel}<g transform="translate(92 1790)"><rect width="896" height="2" fill="#294331"/><text y="54" font-family="Arial, sans-serif" font-size="17" letter-spacing="2" fill="#8E9F94">GESTÃO DE QUADRAS SEM COMPLICAÇÃO</text><text x="896" y="54" text-anchor="end" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="${lime}">0${i+1} / 05</text></g></svg>`;
  const svgPath = path.join(outputDir, `scene-${String(i+1).padStart(2,'0')}.svg`);
  const pngPath = path.join(outputDir, `scene-${String(i+1).padStart(2,'0')}.png`);
  writeFileSync(svgPath, svg, 'utf8');
  execFileSync(edge, ['--headless=new','--disable-gpu','--hide-scrollbars','--force-device-scale-factor=1','--window-size=1080,1920',`--screenshot=${pngPath}`,`file:///${svgPath.replaceAll('\\','/')}`], { stdio:'ignore' });
}

const ps = `$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Drawing; $files=@(${scenes.map((_,i)=>`'${path.join(outputDir,`scene-${String(i+1).padStart(2,'0')}.png`)}'`).join(',')}); foreach($file in $files){ $bmp=[System.Drawing.Bitmap]::FromFile($file); try { $rect=New-Object System.Drawing.Rectangle(0,0,$bmp.Width,$bmp.Height); $data=$bmp.LockBits($rect,[System.Drawing.Imaging.ImageLockMode]::ReadOnly,[System.Drawing.Imaging.PixelFormat]::Format24bppRgb); try { $bytes=New-Object byte[] ($data.Stride*$data.Height); [System.Runtime.InteropServices.Marshal]::Copy($data.Scan0,$bytes,0,$bytes.Length); [System.IO.File]::WriteAllBytes([System.IO.Path]::ChangeExtension($file,'.bgr'),$bytes) } finally { $bmp.UnlockBits($data) } } finally { $bmp.Dispose() } }`;
execFileSync('powershell.exe',['-NoProfile','-Command',ps],{stdio:'inherit'});

const args = ['-y'];
for (let i=1; i<=scenes.length; i++) args.push('-f','rawvideo','-pixel_format','bgr24','-video_size','1080x1920','-framerate','30','-i',path.join(outputDir,`scene-${String(i).padStart(2,'0')}.bgr`));
const chains = scenes.map((_,i)=>`[${i}:v]zoompan=z='min(zoom+0.00035,1.06)':d=120:s=1080x1920:fps=30,setsar=1,format=yuv420p[v${i}]`).join(';');
const joined = scenes.map((_,i)=>`[v${i}]`).join('');
args.push('-filter_complex',`${chains};${joined}concat=n=${scenes.length}:v=1:a=0[outv]`,'-map','[outv]','-an','-c:v','mpeg4','-q:v','3','-r','30','-movflags','+faststart',path.join(project,'artifacts','video-promo-courtmanager.mp4'));
execFileSync(ffmpeg,args,{stdio:'inherit'});
console.log(`Created ${path.join(project,'artifacts','video-promo-courtmanager.mp4')}`);
