// Inlines src/engine.js into src/page.template.html and writes index.html.
const fs = require('fs');
const path = require('path');

const root = __dirname;
const engine = fs.readFileSync(path.join(root, 'src/engine.js'), 'utf8')
  .replace("if (typeof module !== 'undefined') module.exports = RD;", '');
const page = fs.readFileSync(path.join(root, 'src/page.template.html'), 'utf8')
  .replace('/*@ENGINE@*/', () => engine);

fs.writeFileSync(path.join(root, 'index.html'), page);
console.log('Wrote index.html');
