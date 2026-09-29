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
