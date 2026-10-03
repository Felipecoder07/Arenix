const fs = require('fs');
const transcriptPath = 'C:/Users/Mateus/.gemini/antigravity-ide/brain/59f977ed-b567-4079-8486-4d30ae8bffb5/.system_generated/logs/transcript.jsonl';
const content = fs.readFileSync(transcriptPath, 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (!line.trim()) return;
  try {
    const obj = JSON.parse(line);
    if (obj.type === 'USER_INPUT') {
      console.log(`[USER_INPUT ${idx}]:`, obj.content.slice(0, 120).replace(/\n/g, ' '));
    }
  } catch(e) {}
});
