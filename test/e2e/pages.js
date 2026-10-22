// Single source of truth for the pages every browser spec covers: a new page needs an entry here.
// `path` is the address a visitor uses; `heading` is expected in the page's <h1>.
module.exports = {
  PAGES: [
    { path: '/', titleContains: 'Romanian Draughts', heading: /Romanian Draughts/ },
    { path: '/help', titleContains: 'Help', heading: /Help/ },
    { path: '/updates', titleContains: 'Site updates', heading: /Site updates/ },
  ],
  NOT_FOUND: '/no-such-page',
};
