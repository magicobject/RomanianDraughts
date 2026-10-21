const RD = require(require('path').join(__dirname,'../src/engine.js'));
const assert = require('assert');
let b = RD.initialBoard();
assert.equal(RD.count(b,1),8); assert.equal(RD.count(b,-1),8);
let m = RD.allMoves(b,1);
console.log('opening moves dark:', m.length, 'jumps:', m.filter(x=>x.path.length>2).length);
// Own-piece jump: dark at (5,2)? set up custom
let c = new Int8Array(64);
const sq=(r,c)=>r*8+c;
c[sq(5,2)]=1; c[sq(4,3)]=1; c[sq(2,5)]=-1; c[sq(0,1)]=-1;
let mv = RD.allMoves(c,1);
const chain = mv.find(x=>x.path[0]===sq(5,2) && x.path.at(-1)===sq(1,6));
assert(chain, 'chain over own then enemy'); assert.deepEqual(chain.caps,[sq(2,5)]);
// stop early option exists
assert(mv.find(x=>x.path[0]===sq(5,2) && x.path.at(-1)===sq(3,4) && x.caps.length===0));
// win detection: capture last piece
let d=new Int8Array(64); d[sq(4,3)]=1; d[sq(3,4)]=-1;
let cap = RD.allMoves(d,1).find(x=>x.caps.length===1);
let nd=RD.applyMove(d,cap); assert.equal(RD.winnerAfter(nd,1),1);
// AI finds capture
let t=Date.now(); let ai=RD.chooseMove(d,1,'hard'); assert.equal(ai.caps.length,1);
// performance from opening
for (const lvl of ['easy','medium','hard']) { t=Date.now(); const x=RD.chooseMove(b,-1,lvl); console.log(lvl, Date.now()-t,'ms', x.path); }
// self-play game
let g=RD.initialBoard(), side=1, n=0, w=0;
while(n<300){ const mm=RD.chooseMove(g,side,n%2?'medium':'easy'); if(!mm){w=-side;break;} g=RD.applyMove(g,mm); n++; w=RD.winnerAfter(g,side); if(w)break; side=-side; }
console.log('self-play plies',n,'winner',w, RD.count(g,1), RD.count(g,-1));
console.log('all tests passed');
