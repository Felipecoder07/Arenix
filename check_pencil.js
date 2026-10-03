const fs = require('fs');
const transcriptPath = 'C:/Users/Mateus/.gemini/antigravity-ide/brain/59f977ed-b567-4079-8486-4d30ae8bffb5/.system_generated/logs/transcript.jsonl';
const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n');

function inspectInput(idx) {
  const line = lines[idx];
  if (!line) return;
  const obj = JSON.parse(line);
  console.log(`=== INPUT ${idx} ===`);
  const text = obj.content;
  const match = text.match(/data-pencil-name="([^"]+)"/g);
  console.log('Pencil names found:', match ? match.slice(0, 10) : 'none');
}

inspectInput(3441);
inspectInput(3584);
inspectInput(3599);
