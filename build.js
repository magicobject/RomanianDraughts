// Builds the deployable site into public/:
//   public/index.html  - src/page.template.html with src/engine.js inlined
//   public/_headers    - src/_headers.template with the CSP script hashes of every inline <script>
// public/404.html is hand-written source. Everything else in public/ is generated: never hand-edit.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = __dirname;
const read = p => fs.readFileSync(path.join(root, p), 'utf8').replace(/\r\n/g, '\n');

function build() {
  const engine = read('src/engine.js')
    .replace("if (typeof module !== 'undefined') module.exports = RD;", '');
  const html = read('src/page.template.html').replace('/*@ENGINE@*/', () => engine);
  const hashes = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
    .map(m => `'sha256-${crypto.createHash('sha256').update(m[1], 'utf8').digest('base64')}'`);
  const headers = read('src/_headers.template').replace('/*@SCRIPT_HASHES@*/', hashes.join(' '));
  return { html, headers };
}

if (require.main === module) {
  const { html, headers } = build();
  fs.mkdirSync(path.join(root, 'public'), { recursive: true });
  fs.writeFileSync(path.join(root, 'public/index.html'), html);
  fs.writeFileSync(path.join(root, 'public/_headers'), headers);
  console.log('Wrote public/index.html and public/_headers');
}

module.exports = { build };
