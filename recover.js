const fs = require('fs');
const readline = require('readline');

async function recover() {
  const logPath = 'C:\\Users\\Gerald\\.gemini\\antigravity-ide\\brain\\c7c7568c-3700-4662-b314-1bd20cdf680c\\.system_generated\\logs\\transcript.jsonl';
  const fileStream = fs.createReadStream(logPath);
  const rl = readline.createInterface({ input: fileStream });

  let targetContent = null;

  for await (const line of rl) {
    if (line.includes('multi_replace_file_content') && line.includes('We did our best to apply changes despite some inaccuracies')) {
      const obj = JSON.parse(line);
      if (obj.content && obj.content.includes('@@ -1697,437 +1697,6 @@')) {
        targetContent = obj.content;
      }
    }
  }

  if (targetContent) {
    fs.writeFileSync('C:\\Users\\Gerald\\.gemini\\antigravity-ide\\brain\\c7c7568c-3700-4662-b314-1bd20cdf680c\\scratch\\diff_output.txt', targetContent);
    console.log('Saved diff to scratch');
  } else {
    console.log('Not found');
  }
}

recover();
