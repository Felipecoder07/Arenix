const fs = require('fs');
const readline = require('readline');

async function getLine(lineNumber, outPath) {
  const fileStream = fs.createReadStream('C:/Users/Mateus/.gemini/antigravity-ide/brain/59f977ed-b567-4079-8486-4d30ae8bffb5/.system_generated/logs/transcript_full.jsonl');
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
  let current = 0;
  for await (const line of rl) {
    if (current === lineNumber) {
      const obj = JSON.parse(line);
      fs.writeFileSync(outPath, obj.content);
      console.log(`Line ${lineNumber} written to ${outPath}, size: ${obj.content.length}`);
      return;
    }
    current++;
  }
}

getLine(3441, 'C:/Users/Mateus/Downloads/Volei System/full_notificacoes_mockup.html');
getLine(3584, 'C:/Users/Mateus/Downloads/Volei System/full_cancelamentos_mockup.html');
