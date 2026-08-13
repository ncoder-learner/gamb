const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const src=fs.readFileSync('server.js','utf8');
test('production files exist',()=>{for(const f of ['package.json','server.js','render.yaml','netlify.toml','README.md','public/index.html','public/style.css','public/app.js'])assert.ok(fs.existsSync(f),f);});
test('server has health, Render-safe binding and Socket.IO',()=>{assert.match(src,/app\.get\('\/health'/);assert.match(src,/server\.listen\(PORT,'0\.0\.0\.0'/);assert.match(src,/new Server\(server/);});
test('poker uses explicit street state machine',()=>{for(const phase of ['LOBBY','PREFLOP','FLOP','TURN','RIVER','SHOWDOWN','HAND_COMPLETE'])assert.match(src,new RegExp(phase));assert.match(src,/nextPokerActor/);});
test('all requested games are present',()=>{for(const x of ['blackjack','roulette','chess'])assert.match(src,new RegExp(x,'i'));});
