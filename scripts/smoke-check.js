const fs = require('fs');
const path = require('path');

const root = path.join(process.cwd(), 'src');
const files = [];

const walk = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(fullPath);
    else if (entry.isFile() && entry.name.endsWith('.js')) files.push(fullPath);
  }
};

walk(root);

for (const file of files) {
  require(file);
}

require(path.join(root, 'app.js'));
console.log(`Smoke check passed: loaded ${files.length} source modules.`);
