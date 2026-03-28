import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, "electron-main.js");

if (!fs.existsSync(filePath)) {
  console.log("❌ Arquivo electron-main.js não encontrado.");
  process.exit(1);
}

let content = fs.readFileSync(filePath, "utf-8");

// Remove duplicação do require do electron
const requireRegex = /const\s*\{\s*app\s*,\s*BrowserWindow\s*\}\s*=\s*require\(['"]electron['"]\);/g;

let matches = content.match(requireRegex);

if (matches && matches.length > 1) {
  console.log(`⚠️ Encontradas ${matches.length} declarações duplicadas. Corrigindo...`);

  // mantém apenas a primeira ocorrência
  let first = true;
  content = content.replace(requireRegex, () => {
    if (first) {
      first = false;
      return matches[0];
    }
    return ""; // remove duplicadas
  });

  fs.writeFileSync(filePath, content, "utf-8");
  console.log("✅ Duplicações removidas com sucesso!");
} else {
  console.log("✔️ Nenhuma duplicação encontrada.");
}

// Extra: remove possíveis duplicações de 'app' sozinho
content = fs.readFileSync(filePath, "utf-8");

const duplicateAppRegex = /const\s+app\s*=\s*.*\n/g;
let appMatches = content.match(duplicateAppRegex);

if (appMatches && appMatches.length > 1) {
  console.log("⚠️ Removendo declarações extras de 'app'...");

  let first = true;
  content = content.replace(duplicateAppRegex, (match) => {
    if (first) {
      first = false;
      return match;
    }
    return "";
  });

  fs.writeFileSync(filePath, content, "utf-8");
  console.log("✅ Declarações duplicadas de 'app' removidas!");
}

console.log("🚀 Fix finalizado!");
