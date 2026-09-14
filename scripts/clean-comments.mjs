import fs from 'fs';
import path from 'path';

function getFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(fullPath));
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx') || fullPath.endsWith('.js')) {
      results.push(fullPath);
    }
  });
  return results;
}

const targetDir = path.join(process.cwd(), 'src');
const files = getFiles(targetDir);

let modifiedCount = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  // 1. Remove block comments (/* ... */)
  // We keep the eslint/ts-ignore comments if any.
  content = content.replace(/\/\*[\s\S]*?\*\//g, (match) => {
    if (match.includes('eslint-') || match.includes('@ts-') || match.includes('prettier-ignore')) return match;
    return '';
  });

  // 2. Remove 3 or more consecutive single-line comments.
  // Match groups of 3 or more lines that start with optional whitespace and // 
  const multiLineCommentRegex = /(?:^[ \t]*\/\/.*(?:\r?\n|$)){3,}/gm;
  content = content.replace(multiLineCommentRegex, '');

  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    modifiedCount++;
    console.log(`Cleaned: ${file}`);
  }
});

console.log(`\nDone! Modified ${modifiedCount} files.`);
