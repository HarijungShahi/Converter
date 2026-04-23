const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const backendDir = path.join(rootDir, 'backend');
const frontendDir = path.join(rootDir, 'frontend');
const publicDir = path.join(rootDir, 'public');

if (!fs.existsSync(backendDir)) fs.mkdirSync(backendDir);
if (!fs.existsSync(frontendDir)) fs.mkdirSync(frontendDir);

const backendFiles = ['package.json', 'package-lock.json', '.env', 'seed-admin.js', 'src'];
for (const file of backendFiles) {
  const src = path.join(rootDir, file);
  const dest = path.join(backendDir, file);
  if (fs.existsSync(src)) {
    fs.cpSync(src, dest, { recursive: true });
    fs.rmSync(src, { recursive: true, force: true });
  }
}

if (fs.existsSync(publicDir)) {
  const publicFiles = fs.readdirSync(publicDir);
  for (const file of publicFiles) {
    const src = path.join(publicDir, file);
    const dest = path.join(frontendDir, file);
    fs.cpSync(src, dest, { recursive: true });
  }
  fs.rmSync(publicDir, { recursive: true, force: true });
}

console.log('Files moved successfully.');
