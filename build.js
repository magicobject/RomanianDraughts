// Builds the deployable site into public/ (see CLAUDE.md "Layout" for what is generated and what is hand-written):
//   public/index.html, help.html, updates.html, 404.html  - src/shell.html around the page bodies
//   public/css/style.css, public/js/engine.js, public/js/game.js - from src/ (the pages link them with ?v=<content hash>)
//   public/sitemap.xml  - every indexable page
//   public/_headers     - src/_headers.template
// Hand-written and left alone: public/robots.txt, public/.well-known/security.txt, the favicon files
// (written by scripts/generate-favicons.js).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = __dirname;
const SITE = 'https://romaniandraughts.mediawright.uk';
const read = p => fs.readFileSync(path.join(root, p), 'utf8').replace(/\r\n/g, '\n');
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const hash = s => crypto.createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 10);

// Pages. `clean` is the address visitors see (Cloudflare serves /help for help.html).
const PAGES = [
  { file: 'index.html', clean: '/', title: 'Romanian Draughts', description: 'Play Romanian Draughts online: eight kings a side, jump your own pieces to travel, jump your opponent\'s to take them. Two players or against the computer.', index: true, game: true },
  { file: 'help.html', clean: '/help', title: 'Help - Romanian Draughts', description: 'How to play Romanian Draughts, what to do if something does not work, and how this site is looked after.', index: true, body: 'src/pages/help.html' },
  { file: 'updates.html', clean: '/updates', title: 'Site updates - Romanian Draughts', description: 'Every build of this site and what changed.', index: false },
  { file: '404.html', clean: null, title: 'Page not found - Romanian Draughts', description: 'There is nothing at this address.', index: false, body: 'src/pages/404.html' },
];

// ---------- changelog.md -> /updates ----------
const LINKABLE = { 'index.html': '/', 'public/index.html': '/', 'help.html': '/help', 'public/help.html': '/help', 'updates.html': '/updates', 'public/updates.html': '/updates', '404.html': '/404.html', 'public/404.html': '/404.html' };

function inline(text) {
  let out = '', last = 0;
  for (const m of text.matchAll(/\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*/g)) {
    out += esc(text.slice(last, m.index));
    last = m.index + m[0].length;
    if (m[3] !== undefined) out += `<code>${esc(m[3])}</code>`;
    else if (m[4] !== undefined) out += `<strong>${esc(m[4])}</strong>`;
    else if (/^https?:\/\//.test(m[2])) out += `<a href="${esc(m[2])}">${esc(m[1])}</a>`;
    else if (Object.hasOwn(LINKABLE, m[2])) out += `<a href="${LINKABLE[m[2]]}">${esc(m[1])}</a>`;
    else out += `<code>${esc(m[1])}</code>`; // a repo file that is not a page of the site: named, not linked
  }
  return out + esc(text.slice(last));
}

function parseChangelog(md) {
  return [...md.matchAll(/^## build-(\d{4}\.\d{2}\.\d{2}\.\d{3}) \((.+?), (.+?)\)\n([\s\S]*?)(?=^## |(?![\s\S]))/gm)]
    .map(m => ({ build: m[1], date: m[2], author: m[3], paragraphs: m[4].trim().split(/\n{2,}/).filter(Boolean) }));
}

function updatesBody() {
  const entries = parseChangelog(read('changelog.md'));
  const current = JSON.parse(read('build-number.json'));
  const currentBuild = `${current.date}.${String(current.build).padStart(3, '0')}`;
  const items = entries.map(e =>
    `    <li>\n      <div class="changelog-meta"><span class="changelog-build">${e.build}</span><span class="changelog-author">${esc(e.author)}</span><span class="changelog-date">${esc(e.date)}</span></div>\n` +
    e.paragraphs.map(p => `      <p>${inline(p.replace(/\n/g, ' '))}</p>\n`).join('') + '    </li>\n').join('');
  return `<header>
  <p class="brand"><a href="/">Romanian Draughts</a></p>
</header>
<div class="band" aria-hidden="true"></div>
<main id="main" class="doc">
  <h1>Site updates</h1>
  <p class="lede">Every build of this site and what changed, newest first. This page is not linked from the game and is kept out of search engines.</p>
  <p class="build-number">Current build: ${currentBuild}</p>
  <ul class="changelog">
${items}  </ul>
</main>
`;
}

function render(shell, page, body, scripts) {
  const canonical = page.clean === null ? '' :
    `<link rel="canonical" href="${SITE}${page.clean}">\n<meta property="og:url" content="${SITE}${page.clean}">\n`;
  return shell
    .replace(/\{\{TITLE\}\}/g, () => esc(page.title))
    .replace(/\{\{DESCRIPTION\}\}/g, () => esc(page.description))
    .replace('{{ROBOTS}}', page.index ? 'index, follow' : 'noindex, nofollow')
    .replace('{{CANONICAL}}', () => canonical)
    .replace('{{BODY}}', () => body.trimEnd())
    .replace('{{SCRIPTS}}', () => scripts);
}

function build() {
  const files = {};
  const engine = read('src/engine.js').replace("if (typeof module !== 'undefined') module.exports = RD;", '');
  files['js/engine.js'] = engine;
  files['js/game.js'] = read('src/game.js');
  files['css/style.css'] = read('src/style.css');

  const shell = read('src/shell.html');
  const gameScripts = ['engine', 'game'].map(n => `<script src="/js/${n}.js?v=${hash(files[`js/${n}.js`])}"></script>\n`).join('');
  for (const page of PAGES) {
    const body = page.game ? read('src/page.template.html') : page.body ? read(page.body) : updatesBody();
    const html = render(shell, page, body, page.game ? gameScripts : '');
    files[page.file] = html.replace('href="/css/style.css"', `href="/css/style.css?v=${hash(files['css/style.css'])}"`);
  }

  files['sitemap.xml'] = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    PAGES.filter(p => p.index).map(p => `  <url><loc>${SITE}${p.clean}</loc></url>\n`).join('') + '</urlset>\n';
  files['_headers'] = read('src/_headers.template');
  return { files };
}

if (require.main === module) {
  const { files } = build();
  for (const [rel, content] of Object.entries(files)) {
    const dest = path.join(root, 'public', rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, content);
  }
  console.log(`Wrote ${Object.keys(files).length} files into public/`);
}

module.exports = { build, parseChangelog, inline, PAGES, SITE };
