const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const root = __dirname;

test('production files exist',()=>{
  for(const f of ['package.json','server.js','render.yaml','netlify.toml','README.md','public/index.html','public/style.css','public/app.js']) assert.ok(fs.existsSync(path.join(root,f)),f);
});
test('netlify publishes public',()=>{const s=fs.readFileSync(path.join(root,'netlify.toml'),'utf8');assert.match(s,/publish\s*=\s*["']public["']/)});
test('production socket url is not localhost',()=>{const s=fs.readFileSync(path.join(root,'public/app.js'),'utf8');assert.match(s,/https:\/\/gamb-eu6t\.onrender\.com/);assert.doesNotMatch(s,/localhost:3000/)});
test('server exposes health and authoritative poker phases',()=>{const s=fs.readFileSync(path.join(root,'server.js'),'utf8');for(const x of ['/health','PREFLOP','FLOP','TURN','RIVER','SHOWDOWN','HAND_COMPLETE','pokerAction','addBot','blackjackAction','rouletteBet','chessMove','quickGame','/api/history','/api/daily','/api/leaderboard'])assert.match(s,new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')))});

test('virtual-token safety and no payment rails',()=>{const s=fs.readFileSync(path.join(root,'server.js'),'utf8');assert.doesNotMatch(s,/stripe|paypal|coinbase|withdrawal.*cash|cash.*withdrawal/i);assert.match(fs.readFileSync(path.join(root,'public/app.js'),'utf8'),/Tokens are virtual|no cash value/i)});
test('server-side randomness uses crypto',()=>{const s=fs.readFileSync(path.join(root,'server.js'),'utf8');assert.match(s,/crypto\.randomInt/);});

test('live-player invitations join the exact requesting socket and reject stale requests',()=>{
  const s=fs.readFileSync(path.join(root,'server.js'),'utf8');
  assert.match(s,/socketId:socket\.id,name:a\.name,at:Date\.now\(\)/);
  assert.match(s,/io\.sockets\.sockets\.get\(req\.socketId\)/);
  assert.match(s,/That player disconnected\. Ask them to request again\./);
  assert.match(s,/p\.connected&&!p\.bot/);
});
test('abandoned rooms and expired join requests are cleaned up',()=>{
  const s=fs.readFileSync(path.join(root,'server.js'),'utf8');
  assert.match(s,/const grace=room\.status==='LOBBY'\?120000:300000/);
  assert.match(s,/now-r\.at<90000/);
});
test('return-to-lobby keeps the player in the existing room',()=>{
  const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
  const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
  assert.match(app,/\$\('#leaveBtn'\)\.onclick=returnToRoom/);
  assert.match(html,/id="leaveBtn">← ROOM LOBBY/);
});
test('immersive labels depth-test against cards and real CC0 wood maps are configured',()=>{
  const s=fs.readFileSync(path.join(root,'public/immersive-table.js'),'utf8');
  assert.match(s,/depthTest:true,depthWrite:false/);
  assert.match(s,/wood_table_001/);
  assert.match(s,/wood_floor|floorMat/);
});

test('blackjack HUD exposes total, hand state, advice and confirmed wager',()=>{
  const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
  const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
  const css=fs.readFileSync(path.join(root,'public/style.css'),'utf8');
  assert.match(app,/bj-hud-total/);
  assert.match(app,/SUGGESTION · STAND/);
  assert.match(app,/SUGGESTION · HIT/);
  assert.match(app,/WAGER CONFIRMED/);
  assert.match(app,/Bet placed · \$\{amount\.toLocaleString\(\)\} virtual tokens/);
  assert.match(html,/id="bjHud"/);
  assert.match(css,/\.bj-hud\{position:absolute;top:18px;left:18px/);
});
