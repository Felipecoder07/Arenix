const fs = require('fs');
const transcriptPath = 'C:/Users/Mateus/.gemini/antigravity-ide/brain/59f977ed-b567-4079-8486-4d30ae8bffb5/.system_generated/logs/transcript.jsonl';
const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n');

const line3441 = lines[3441];
if (line3441) {
  const obj = JSON.parse(line3441);
  fs.writeFileSync('C:/Users/Mateus/Downloads/Volei System/scratch_notificacoes_mockup.html', obj.content);
  console.log('Saved scratch_notificacoes_mockup.html, length:', obj.content.length);
}
