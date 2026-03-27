import fs from 'node:fs';
import path from 'node:path';

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`Source directory ${src} does not exist. Skipping.`);
    return;
  }
  
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const root = process.cwd();
const standaloneDir = path.join(root, '.next', 'standalone');

if (fs.existsSync(standaloneDir)) {
  console.log('Detected standalone output. Copying public and static assets...');
  
  // Copy public folder to .next/standalone/public
  copyDir(path.join(root, 'public'), path.join(standaloneDir, 'public'));
  
  // Copy .next/static to .next/standalone/.next/static
  copyDir(path.join(root, '.next', 'static'), path.join(standaloneDir, '.next', 'static'));
  
  console.log('Successfully copied assets to standalone directory.');
} else {
  console.warn('Could not find .next/standalone directory. Ensure output: "standalone" is in your next.config.js and you just ran next build.');
}
