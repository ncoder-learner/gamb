const express = require('express');
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');
const { Chess } = require('chess.js');

const app = express();
app.use(express.json({limit:'32kb'}));
const CLIENT_ORIGIN = [...new Set([...(process.env.CLIENT_ORIGIN || '').split(','), 'https://gamb-mu.vercel.app', 'https://gamehunk.netlify.app', 'https://gamehunky.netlify.app'].map(x=>x.trim()).filter(Boolean))];
app.use((req,res,next)=>{
  const origin = req.headers.origin;
  if (origin && CLIENT_ORIGIN.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const DATA_FILE = path.join(__dirname, 'data.json');
let accounts = {};
try { if (fs.existsSync(DATA_FILE)) accounts = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch {}
const sessions = new Map();
const adminSessions = new Map();
const devLoginAttempts = new Map();
const SHOP = [
  {id:'lucky-chip',name:'Lucky Chip',rarity:'Common',price:500,slot:'chip',description:'A polished lucky chip for your table.'},
  {id:'neon-back',name:'Neon Card Back',rarity:'Uncommon',price:2500,slot:'cardBack',description:'Electric neon card backs.'},
  {id:'gold-button',name:'Golden Dealer Button',rarity:'Rare',price:10000,slot:'button',description:'A gold dealer button.'},
  {id:'dragon-back',name:'Dragon Card Back',rarity:'Epic',price:50000,slot:'cardBack',description:'A fiery dragon card back.'},
  {id:'hunk-crown',name:'Hunk Crown',rarity:'Legendary',price:250000,slot:'frame',description:'A legendary golden crown frame.'},
  {id:'royal-frame',name:'Royal Frame',rarity:'Legendary',price:500000,slot:'frame',description:'A premium animated profile frame.'}
];
function ensureAccount(a){if(!a)return a;a.tokens=Number.isFinite(a.tokens)?Math.max(0,Math.floor(a.tokens)):1000;a.inventory=Array.isArray(a.inventory)?a.inventory:[];a.equipped=a.equipped&&typeof a.equipped==='object'?a.equipped:{};a.sessions=Array.isArray(a.sessions)?a.sessions:[];a.history=Array.isArray(a.history)?a.history:[];a.stats=a.stats&&typeof a.stats==='object'?a.stats:{gamesPlayed:0,wins:0,losses:0,largestWin:0,byGame:{}};a.daily=a.daily&&typeof a.daily==='object'?a.daily:{lastClaim:null,streak:0};a.refill=a.refill&&typeof a.refill==='object'?a.refill:{lastClaim:0};return a}
function tokenHash(token){return crypto.createHash('sha256').update(String(token)).digest('hex')}
function issueSession(a){ensureAccount(a);const token=uid('sess');a.sessions.push(tokenHash(token));a.sessions=a.sessions.slice(-8);sessions.set(token,a.id);return token}
function accountFromToken(token){const raw=String(token||'');if(!raw)return null;const id=sessions.get(raw);if(id&&accounts[id])return ensureAccount(accounts[id]);const h=tokenHash(raw);for(const a of Object.values(accounts)){ensureAccount(a);if(a.sessions.includes(h)){sessions.set(raw,a.id);return a}}return null}
function revokeSession(token){const raw=String(token||'');const id=sessions.get(raw);sessions.delete(raw);const h=tokenHash(raw);if(id&&accounts[id])accounts[id].sessions=accounts[id].sessions.filter(x=>x!==h);else for(const a of Object.values(accounts))a.sessions=(a.sessions||[]).filter(x=>x!==h)}
function recordTransaction(a,amount,type,game=null,meta=null){ensureAccount(a);a.history.unshift({id:uid('txn'),amount:Math.trunc(amount),type,game,meta,timestamp:Date.now()});a.history=a.history.slice(0,250)}
function recordGame(a,game,net,result,payout=0){ensureAccount(a);const g=a.stats.byGame[game]||{played:0,wins:0,losses:0,net:0};g.played++;g.net+=Math.trunc(net);if(result==='win'){a.stats.wins++;g.wins++;a.stats.largestWin=Math.max(a.stats.largestWin,Math.max(0,Math.trunc(payout)))}if(result==='loss'){a.stats.losses++;g.losses++}a.stats.gamesPlayed++;a.stats.byGame[game]=g;recordTransaction(a,net,result==='win'?'game_payout':result==='loss'?'game_loss':'game_push',game,{result,payout:Math.trunc(payout)})}
function dayKey(){return new Date().toISOString().slice(0,10)}
function claimDaily(a){ensureAccount(a);const today=dayKey();if(a.daily.lastClaim===today)return {ok:false,error:'Daily reward already claimed.',daily:a.daily};const prev=new Date();prev.setUTCDate(prev.getUTCDate()-1);const yesterday=prev.toISOString().slice(0,10);a.daily.streak=a.daily.lastClaim===yesterday?Math.min(30,(a.daily.streak||0)+1):1;const amount=200+Math.min(800,a.daily.streak*50);a.tokens+=amount;a.daily.lastClaim=today;recordTransaction(a,amount,'daily_reward',null,{streak:a.daily.streak});saveAccounts();return {ok:true,amount,daily:a.daily,account:accountResponse(a)}}
function publicStats(a){ensureAccount(a);return {gamesPlayed:a.stats.gamesPlayed,wins:a.stats.wins,losses:a.stats.losses,winRate:a.stats.gamesPlayed?Math.round(a.stats.wins/a.stats.gamesPlayed*100):0,largestWin:a.stats.largestWin,byGame:a.stats.byGame}}
function saveAccounts(){try{fs.writeFileSync(DATA_FILE,JSON.stringify(accounts,null,2));}catch{}}
function hashPassword(password,salt=crypto.randomBytes(16).toString('hex')){return {salt,hash:crypto.scryptSync(String(password),salt,64).toString('hex')}}
function verifyPassword(password,a){try{return crypto.timingSafeEqual(Buffer.from(hashPassword(password,a.salt).hash,'hex'),Buffer.from(a.passwordHash,'hex'));}catch{return false}}
function accountResponse(a){ensureAccount(a);return {id:a.id,name:a.name,tokens:a.tokens,inventory:a.inventory,equipped:a.equipped,createdAt:a.createdAt,stats:publicStats(a),daily:a.daily}}
function cleanUsername(s){return String(s||'').replace(/[^a-zA-Z0-9_ -]/g,'').trim().slice(0,18)}
app.post('/api/register',(req,res)=>{const name=cleanUsername(req.body?.name);const password=String(req.body?.password||'');if(name.length<3)return res.status(400).json({error:'Username must be at least 3 characters.'});if(password.length<6)return res.status(400).json({error:'Password must be at least 6 characters.'});if(Object.values(accounts).some(a=>a.name.toLowerCase()===name.toLowerCase()))return res.status(409).json({error:'That username is already taken.'});const id=uid('acct');const hp=hashPassword(password);accounts[id]={id,name,passwordHash:hp.hash,salt:hp.salt,tokens:1000,inventory:[],equipped:{},sessions:[],history:[],stats:{gamesPlayed:0,wins:0,losses:0,largestWin:0,byGame:{}},daily:{lastClaim:null,streak:0},createdAt:Date.now()};const token=issueSession(accounts[id]);recordTransaction(accounts[id],1000,'account_grant',null,{reason:'new_account'});saveAccounts();res.json({ok:true,token,account:accountResponse(accounts[id])})});
app.post('/api/login',(req,res)=>{const name=cleanUsername(req.body?.name);const password=String(req.body?.password||'');const a=Object.values(accounts).find(x=>x.name.toLowerCase()===name.toLowerCase());if(!a||!verifyPassword(password,a))return res.status(401).json({error:'Invalid username or password.'});const token=issueSession(a);saveAccounts();res.json({ok:true,token,account:accountResponse(a)})});
app.post('/api/logout',(req,res)=>{const t=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');const a=accountFromToken(t);if(a){revokeSession(t);saveAccounts()}res.json({ok:true})});
app.get('/api/history',(req,res)=>{const a=accountFromToken(String(req.headers.authorization||'').replace(/^Bearer\s+/i,''));if(!a)return res.status(401).json({error:'Not signed in.'});const game=String(req.query.game||'');const limit=Math.min(100,Math.max(1,Number(req.query.limit)||50));res.json({ok:true,history:a.history.filter(x=>!game||x.game===game).slice(0,limit)})});
app.get('/api/profile',(req,res)=>{const a=accountFromToken(String(req.headers.authorization||'').replace(/^Bearer\s+/i,''));if(!a)return res.status(401).json({error:'Not signed in.'});res.json({ok:true,profile:{id:a.id,name:a.name,createdAt:a.createdAt,stats:publicStats(a),daily:a.daily,tokens:a.tokens}})});
app.post('/api/profile',(req,res)=>{const a=accountFromToken(String(req.headers.authorization||'').replace(/^Bearer\s+/i,''));if(!a)return res.status(401).json({error:'Not signed in.'});const name=cleanUsername(req.body?.name);if(name.length<3)return res.status(400).json({error:'Username must be at least 3 characters.'});if(Object.values(accounts).some(x=>x.id!==a.id&&x.name.toLowerCase()===name.toLowerCase()))return res.status(409).json({error:'That username is already taken.'});a.name=name;saveAccounts();res.json({ok:true,account:accountResponse(a)})});
app.post('/api/daily',(req,res)=>{const a=accountFromToken(String(req.headers.authorization||'').replace(/^Bearer\s+/i,''));if(!a)return res.status(401).json({error:'Not signed in.'});res.json(claimDaily(a))});
app.get('/api/leaderboard',(req,res)=>{const rows=Object.values(accounts).map(ensureAccount).map(a=>({name:a.name,stats:publicStats(a)})).sort((x,y)=>y.stats.largestWin-x.stats.largestWin).slice(0,50);res.json({ok:true,rows})});
app.get('/api/rooms',(req,res)=>{const rows=[...rooms.values()].filter(r=>{const host=r.players.find(p=>p.id===r.hostId);const hostSocket=host?.socketId&&io.sockets.sockets.get(host.socketId);return r.status==='LOBBY'&&r.players.length<MAX_PLAYERS&&host?.connected&&!host.bot&&!!hostSocket?.connected&&hostSocket.data.room===r.code&&hostSocket.data.player===host.id}).map(r=>({code:r.code,game:r.game,players:r.players.filter(p=>p.connected&&!p.bot).length,maxPlayers:MAX_PLAYERS,host:r.players.find(p=>p.id===r.hostId)?.name||'Host'}));res.json({ok:true,rooms:rows})});
app.get('/api/me',(req,res)=>{const a=accountFromToken(String(req.headers.authorization||'').replace(/^Bearer\s+/i,''));if(!a)return res.status(401).json({error:'Not signed in.'});res.json({ok:true,account:accountResponse(a),shop:SHOP})});
app.post('/api/wallet/transfer',(req,res)=>{const a=accountFromToken(String(req.headers.authorization||'').replace(/^Bearer\s+/i,''));if(!a)return res.status(401).json({error:'Not signed in.'});const amount=Math.floor(Number(req.body?.amount));const dir=req.body?.direction;if(!Number.isFinite(amount)||amount<1)return res.status(400).json({error:'Invalid amount.'});const room=rooms.get(String(req.body?.room||'').toUpperCase());if(!room)return res.status(404).json({error:'Room not found.'});const p=room.players.find(x=>x.accountId===a.id);if(!p)return res.status(403).json({error:'You are not in that room.'});if(dir==='withdraw'){if(a.tokens<amount)return res.status(400).json({error:'Not enough vault tokens.'});a.tokens-=amount;p.chips+=amount;recordTransaction(a,-amount,'table_buyin',room.game,{room:room.code})}else if(dir==='deposit'){if(p.chips<amount)return res.status(400).json({error:'Not enough table chips.'});p.chips-=amount;a.tokens+=amount;recordTransaction(a,amount,'table_deposit',room.game,{room:room.code})}else return res.status(400).json({error:'Invalid transfer.'});saveAccounts();broadcast(room);res.json({ok:true,account:accountResponse(a),chips:p.chips})});
app.get('/api/shop',(req,res)=>res.json({ok:true,shop:SHOP}));
app.post('/api/shop/buy',(req,res)=>{const a=accountFromToken(String(req.headers.authorization||'').replace(/^Bearer\s+/i,''));if(!a)return res.status(401).json({error:'Not signed in.'});const item=SHOP.find(x=>x.id===req.body?.id);if(!item)return res.status(404).json({error:'Item not found.'});if(a.inventory.includes(item.id))return res.status(400).json({error:'You already own this item.'});if(a.tokens<item.price)return res.status(400).json({error:'Not enough tokens.'});a.tokens-=item.price;a.inventory.push(item.id);saveAccounts();res.json({ok:true,account:accountResponse(a)})});
app.post('/api/shop/equip',(req,res)=>{const a=accountFromToken(String(req.headers.authorization||'').replace(/^Bearer\s+/i,''));if(!a)return res.status(401).json({error:'Not signed in.'});const item=SHOP.find(x=>x.id===req.body?.id);if(!item||!a.inventory.includes(item.id))return res.status(400).json({error:'You do not own that item.'});a.equipped[item.slot]=item.id;saveAccounts();res.json({ok:true,account:accountResponse(a)})});
app.post('/api/refill',(req,res)=>{const a=accountFromToken(String(req.headers.authorization||'').replace(/^Bearer\s+/i,''));if(!a)return res.status(401).json({error:'Not signed in.'});ensureAccount(a);if(a.tokens!==0)return res.status(400).json({error:'Refill is available only when your vault reaches 0 tokens.'});const amount=500;a.tokens=amount;recordTransaction(a,amount,'token_refill',null,{reason:'empty_vault',amount:500});saveAccounts();res.json({ok:true,amount,account:accountResponse(a)});});
app.post('/api/reward-ad',(req,res)=>{const a=accountFromToken(String(req.headers.authorization||'').replace(/^Bearer\s+/i,''));if(!a)return res.status(401).json({error:'Not signed in.'});return res.status(501).json({error:'Rewarded ads are not verified on this server yet. Configure a supported rewarded-ad callback before enabling token grants.'})});
app.get('/health', (_req,res)=>res.json({ok:true,service:'game-hunk'}));
const server = http.createServer(app);
const io = new Server(server,{cors:{origin:CLIENT_ORIGIN,methods:['GET','POST']}});
function adminFromRequest(req){
 const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
 const expires=adminSessions.get(token);
 if(!token||!expires||expires<Date.now()){adminSessions.delete(token);return false}
 return true;
}
app.post('/api/dev/login',(req,res)=>{
 const ip=String(req.ip||req.socket?.remoteAddress||'unknown'),now=Date.now(),attempt=devLoginAttempts.get(ip)||{count:0,until:0};
 if(attempt.until>now&&attempt.count>=6)return res.status(429).json({error:'Too many attempts. Try again in 10 minutes.'});
 const expectedUser=String(process.env.DEV_USERNAME||'dev'),expectedPass=String(process.env.DEV_PASSWORD||'');
 const username=String(req.body?.username||''),password=String(req.body?.password||'');
 const userOk=crypto.timingSafeEqual(crypto.createHash('sha256').update(username).digest(),crypto.createHash('sha256').update(expectedUser).digest());
 const passA=crypto.createHash('sha256').update(password).digest(),passB=crypto.createHash('sha256').update(expectedPass||crypto.randomBytes(32).toString('hex')).digest();
 const passOk=crypto.timingSafeEqual(passA,passB);
 if(!expectedPass||!userOk||!passOk){attempt.count=attempt.until>now?attempt.count+1:1;attempt.until=now+600000;devLoginAttempts.set(ip,attempt);return res.status(401).json({error:'Invalid developer credentials or developer access is not configured.'})}
 devLoginAttempts.delete(ip);
 const token=crypto.randomBytes(32).toString('hex');adminSessions.set(token,Date.now()+3600000);
 res.json({ok:true,token,expiresIn:3600});
});
app.get('/api/dev/status',(req,res)=>res.json({ok:true,configured:!!process.env.DEV_PASSWORD}));
app.post('/api/dev/reset-leaderboard',(req,res)=>{
 if(!adminFromRequest(req))return res.status(401).json({error:'Developer sign-in required.'});
 for(const a of Object.values(accounts)){ensureAccount(a);a.stats={gamesPlayed:0,wins:0,losses:0,largestWin:0,byGame:{}};a.history=[]}
 saveAccounts();res.json({ok:true,message:'Leaderboard stats and game history reset. Accounts and token balances were preserved.'});
});
app.post('/api/dev/reset-rooms',(req,res)=>{
 if(!adminFromRequest(req))return res.status(401).json({error:'Developer sign-in required.'});
 for(const room of rooms.values()){
  clearTimer(room);
  if(room.blackjack?.dealTimer)clearTimeout(room.blackjack.dealTimer);
  for(const p of room.players){if(!p.socketId)continue;const client=io.sockets.sockets.get(p.socketId);if(client){client.leave(room.code);client.data.room=null;client.data.player=null;client.emit('devRoomReset',{message:'Developer reset live rooms. Return to the floor and create a new table.'})}}
 }
 rooms.clear();res.json({ok:true,message:'All live rooms cleared.'});
});
setInterval(()=>{const now=Date.now();for(const [token,exp] of adminSessions)if(exp<now)adminSessions.delete(token);for(const [ip,a] of devLoginAttempts)if(a.until<now)devLoginAttempts.delete(ip)},60000).unref();

const PORT = Number(process.env.PORT || 3000);
const MAX_PLAYERS = 8;
const STARTING_CHIPS = 1000;
const SMALL_BLIND = 25;
const BIG_BLIND = 50;
const TURN_MS = 25000;
const rooms = new Map();

const BOT_TYPES = {
  Ace:{tight:.82,aggression:.42,bluff:.04}, Shark:{tight:.38,aggression:.88,bluff:.20},
  Bluff:{tight:.38,aggression:.64,bluff:.58}, Lucky:{tight:.22,aggression:.34,bluff:.32},
  Dealer:{tight:.80,aggression:.28,bluff:.02}, River:{tight:.52,aggression:.52,bluff:.16},
  Pocket:{tight:.84,aggression:.70,bluff:.05}, Wildcard:{tight:.35,aggression:.72,bluff:.50}
};
const SUITS=['♠','♥','♦','♣'];
const RANKS=['2','3','4','5','6','7','8','9','T','J','Q','K','A'];
const RED=new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const HAND_NAMES=['High Card','Pair','Two Pair','Three of a Kind','Straight','Flush','Full House','Four of a Kind','Straight Flush'];
function handName(rank){return rank?.[0]===8&&rank?.[1]===14?'Royal Flush':HAND_NAMES[rank?.[0]]||'High Card'}

const uid=(p='id')=>`${p}_${crypto.randomBytes(8).toString('hex')}`;
const cleanName=s=>String(s||'Player').replace(/[<>]/g,'').trim().slice(0,18)||'Player';
const cleanChat=s=>String(s||'').replace(/[<>]/g,'').replace(/[\u0000-\u001F\u007F]/g,'').trim().slice(0,180);
function roomCode(){let c='';const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';do{c='';for(let i=0;i<6;i++)c+=chars[crypto.randomInt(chars.length)]}while(rooms.has(c));return c;}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=crypto.randomInt(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
function makeDeck(){return shuffle(SUITS.flatMap(s=>RANKS.map(r=>({r,s}))));}
function cardText(c){return c?`${c.r}${c.s}`:'';}
function rv(r){return {2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:9,T:10,J:11,Q:12,K:13,A:14}[r];}
function combos(a,k){const out=[];function rec(i,c){if(c.length===k){out.push(c.slice());return;}for(let j=i;j<=a.length-(k-c.length);j++){c.push(a[j]);rec(j+1,c);c.pop();}}rec(0,[]);return out;}
function eval5(cards){
  const vals=cards.map(c=>rv(c.r)).sort((a,b)=>b-a), counts={}; vals.forEach(v=>counts[v]=(counts[v]||0)+1);
  const flush=cards.every(c=>c.s===cards[0].s); const u=[...new Set(vals)];
  let sh=0;if(u.length===5){if(u[0]-u[4]===4)sh=u[0];else if(u.join(',')==='14,5,4,3,2')sh=5;}
  const groups=Object.entries(counts).map(([v,n])=>({v:+v,n})).sort((a,b)=>b.n-a.n||b.v-a.v);
  if(flush&&sh)return [8,sh]; if(groups[0].n===4)return [7,groups[0].v,groups[1].v];
  if(groups[0].n===3&&groups[1].n===2)return [6,groups[0].v,groups[1].v]; if(flush)return [5,...vals];
  if(sh)return [4,sh]; if(groups[0].n===3)return [3,groups[0].v,...groups.filter(g=>g.n===1).map(g=>g.v).sort((a,b)=>b-a)];
  const pairs=groups.filter(g=>g.n===2).sort((a,b)=>b.v-a.v); if(pairs.length===2)return [2,pairs[0].v,pairs[1].v,groups.find(g=>g.n===1).v];
  if(pairs.length===1)return [1,pairs[0].v,...groups.filter(g=>g.n===1).map(g=>g.v).sort((a,b)=>b-a)]; return [0,...vals];
}
function eval7(cards){let best=[0];for(const hand of combos(cards,5)){const score=eval5(hand);if(cmp(score,best)>0)best=score;}return best;}
function cmp(a,b){for(let i=0;i<Math.max(a.length,b.length);i++){const d=(a[i]||0)-(b[i]||0);if(d)return d;}return 0;}
function player({id=uid(),name='Player',bot=false,botType=null,socketId=null,accountId=null}){return {id,name:cleanName(name),accountId,bot,botType,socketId,connected:!!socketId,disconnectedAt:null,host:false,chips:STARTING_CHIPS,folded:false,allIn:false,bet:0,totalBet:0,hole:[],action:'',lastAction:'',reconnectToken:uid('rt')}}
function newRoom(host){host.host=true;return {code:roomCode(),hostId:host.id,players:[host],abandonedAt:null,game:'poker',status:'LOBBY',chat:[],joinRequests:[],turnPlayerId:null,turnEndsAt:null,timer:null,poker:{phase:'LOBBY',deck:[],community:[],pot:0,highestBet:0,minRaise:BIG_BLIND,dealerIndex:0,needsAction:new Set(),winners:[],showdown:[],handNo:0},blackjack:{phase:'BETTING',deck:[],hands:{},dealer:[],hidden:true},roulette:{phase:'BETTING',bets:[],result:null},chess:{game:null,white:null,black:null,wagerPot:0,entryBet:0,winners:[]}}}
function say(room,text){room.chat.push({id:uid('m'),name:'SYSTEM',text,system:true,at:Date.now()});room.chat=room.chat.slice(-80);}
function connected(room){return room.players.filter(p=>p.connected||p.bot)}
function publicPlayer(p,i){return {id:p.id,name:p.name,accountId:p.accountId,bot:p.bot,botType:p.botType,connected:p.connected||p.bot,host:p.host,chips:p.chips,folded:p.folded,allIn:p.allIn,bet:p.bet,lastAction:p.lastAction,action:p.action,seat:i}}
function bjPublic(room){return {phase:room.blackjack.phase,dealer:room.blackjack.dealer.map((c,i)=>i===1&&room.blackjack.hidden?'??':cardText(c)),hands:Object.fromEntries(Object.entries(room.blackjack.hands).map(([id,h])=>[id,{bet:h.bet,cards:h.cards.map(cardText),done:h.done,doubled:h.doubled,result:h.result,total:bjValue(h.cards).total}]))}}
function roulettePublic(room){return {phase:room.roulette.phase,bets:room.roulette.bets.map(b=>({...b})),result:room.roulette.result}}
function chessPublic(room){return {fen:room.chess.game?.fen()||null,turn:room.chess.game?.turn()||null,white:room.chess.white,black:room.chess.black,winners:room.chess.winners,wagerPot:room.chess.wagerPot||0,entryBet:room.chess.entryBet||0}}
function publicState(room){return {code:room.code,game:room.game,status:room.status,hostId:room.hostId,players:room.players.map(publicPlayer),chat:room.chat,joinRequests:room.joinRequests||[],turnPlayerId:room.turnPlayerId,turnEndsAt:room.turnEndsAt,poker:{phase:room.poker.phase,community:room.poker.community.map(cardText),pot:room.poker.pot,highestBet:room.poker.highestBet,minRaise:room.poker.minRaise,dealerIndex:room.poker.dealerIndex,winners:room.poker.winners,showdown:room.poker.showdown||[],handNo:room.poker.handNo},blackjack:bjPublic(room),roulette:roulettePublic(room),chess:chessPublic(room),serverNow:Date.now()}}
function handName(score){
  const names=['High Card','Pair','Two Pair','Three of a Kind','Straight','Flush','Full House','Four of a Kind','Straight Flush'];
  return names[score?.[0] ?? 0] || 'High Card';
}
function privateState(room,p){const s=publicState(room);let currentHand=null;if(room.game==='poker'&&p.hole.length){const cards=[...p.hole,...room.poker.community];if(cards.length>=5){currentHand=handName(eval7(cards))}else{const ranks=p.hole.map(x=>x.r);const counts={};ranks.forEach(x=>counts[x]=(counts[x]||0)+1);currentHand=Object.values(counts).some(n=>n===2)?'Pair':'High Card'}}s.me={id:p.id,reconnectToken:p.reconnectToken,hole:p.hole.map(cardText),name:p.name,accountId:p.accountId,currentHand};return s}
function broadcast(room){io.to(room.code).emit('state',publicState(room));for(const p of room.players)if(p.socketId)io.to(p.socketId).emit('state',privateState(room,p));}
function clearTimer(room){if(room.timer)clearTimeout(room.timer);room.timer=null;room.turnEndsAt=null;}
function setTurn(room,p,cb){clearTimer(room);room.turnPlayerId=p?.id||null;if(p){room.turnEndsAt=Date.now()+TURN_MS;room.timer=setTimeout(cb,TURN_MS)}}
function seatFrom(room,start,offset){const n=room.players.length;for(let k=1;k<=n;k++){const p=room.players[(start+offset*k+n*2)%n];if(p)return p;}return null}
function eligiblePoker(room){return room.players.filter(p=>!p.folded&&p.chips+p.bet>0)}
function actors(room){return room.players.filter(p=>!p.folded&&!p.allIn&&p.chips+p.bet>0&&(p.connected||p.bot))}
function nextActor(room,from){const n=room.players.length;for(let k=1;k<=n;k++){const p=room.players[(from+k+n)%n];if(p&&room.poker.needsAction.has(p.id)&&!p.folded&&!p.allIn&&p.chips+p.bet>0&&(p.connected||p.bot))return p;}return null}
function put(room,p,amount){amount=Math.max(0,Math.min(amount,p.chips));p.chips-=amount;p.bet+=amount;p.totalBet+=amount;room.poker.pot+=amount;if(p.chips===0)p.allIn=true;return amount}
function required(room,p){return Math.max(0,room.poker.highestBet-p.bet)}
function resetStreet(room){room.players.forEach(p=>p.bet=0);room.poker.highestBet=0;room.poker.minRaise=BIG_BLIND;room.poker.needsAction=new Set(actors(room).map(p=>p.id));room.players.forEach(p=>{p.lastAction='';p.action=''});}
function activeCount(room){return eligiblePoker(room).length}
function awardFold(room){const w=eligiblePoker(room)[0];if(!w)return;const pot=room.poker.pot;w.chips+=pot;if(w.accountId&&accounts[w.accountId]){const a=ensureAccount(accounts[w.accountId]);recordGame(a,'poker',pot-w.totalBet,'win',pot);saveAccounts()}w.lastAction='WIN';room.poker.winners=[{id:w.id,amount:pot,hand:'Uncontested pot'}];room.poker.showdown=room.players.filter(p=>p.totalBet>0&&p.hole.length).map(p=>({id:p.id,name:p.name,cards:p.hole.map(cardText),folded:p.folded}));room.poker.pot=0;room.poker.phase='HAND_COMPLETE';room.turnPlayerId=null;clearTimer(room);room.turnEndsAt=Date.now()+9000;room.timer=setTimeout(()=>nextHand(room),9000);say(room,`${w.name} wins ${pot} chips — everyone else folded.`);broadcast(room)}
function dealStreet(room){const p=room.poker.phase;if(p==='PREFLOP'){room.poker.community.push(room.poker.deck.pop(),room.poker.deck.pop(),room.poker.deck.pop());room.poker.phase='FLOP'}else if(p==='FLOP'){room.poker.community.push(room.poker.deck.pop());room.poker.phase='TURN'}else if(p==='TURN'){room.poker.community.push(room.poker.deck.pop());room.poker.phase='RIVER'}else if(p==='RIVER'){room.poker.phase='SHOWDOWN';showdown(room);return}resetStreet(room);advancePoker(room)}
function advancePoker(room){
  clearTimer(room); if(activeCount(room)<=1){awardFold(room);return}
  const liveActors=actors(room);
  if(room.poker.needsAction.size===0 || liveActors.length===0){dealStreet(room);return}
  const current=room.turnPlayerId?room.players.findIndex(p=>p.id===room.turnPlayerId):room.poker.dealerIndex;
  const p=nextActor(room,current<0?room.poker.dealerIndex:current);
  if(!p){dealStreet(room);return} setTurn(room,p,()=>timeoutPoker(room));broadcast(room);botTick(room)
}
function startPokerHand(room){
  clearTimer(room);const seats=room.players.filter(p=>p.chips>0&&(p.connected||p.bot));if(seats.length<2){room.status='LOBBY';room.poker.phase='LOBBY';broadcast(room);return}
  room.status='IN_GAME';room.poker.handNo++;room.poker.phase='PREFLOP';room.poker.deck=makeDeck();room.poker.community=[];room.poker.pot=0;room.poker.highestBet=BIG_BLIND;room.poker.minRaise=BIG_BLIND;room.poker.winners=[];room.poker.needsAction=new Set();
  room.players.forEach(p=>{p.folded=!(p.chips>0&&(p.connected||p.bot));p.allIn=false;p.bet=0;p.totalBet=0;p.hole=[];p.action='';p.lastAction=''});
  let d=room.poker.dealerIndex;for(let k=0;k<room.players.length;k++){const p=room.players[(d+k)%room.players.length];if(!p.folded){d=(d+k)%room.players.length;break}}
  room.poker.dealerIndex=d;const sb=seatFrom(room,d,1),bb=seatFrom(room,d,2);for(const p of room.players)if(!p.folded)p.hole=[room.poker.deck.pop(),room.poker.deck.pop()];
  put(room,sb,SMALL_BLIND);put(room,bb,BIG_BLIND);room.poker.highestBet=Math.min(BIG_BLIND,bb.bet);
  room.poker.needsAction=new Set(room.players.filter(p=>!p.folded&&!p.allIn).map(p=>p.id));room.poker.needsAction.delete(bb.id);
  if(sb.allIn)room.poker.needsAction.delete(sb.id);
  say(room,`Hand #${room.poker.handNo}. Blinds ${SMALL_BLIND}/${BIG_BLIND}.`);
  const first=nextActor(room,room.players.indexOf(bb));if(!first){advancePoker(room)}else{setTurn(room,first,()=>timeoutPoker(room));broadcast(room);botTick(room)}
}
function pokerAction(room,p,action,amount){
  if(room.game!=='poker'||!['PREFLOP','FLOP','TURN','RIVER'].includes(room.poker.phase))return {ok:false,error:'The poker hand is not accepting actions.'};
  if(room.turnPlayerId!==p.id||!room.poker.needsAction.has(p.id))return {ok:false,error:'It is not your turn.'};
  const call=required(room,p);let raised=false;
  if(action==='fold'){p.folded=true;p.action=p.lastAction='FOLD';room.poker.needsAction.delete(p.id)}
  else if(action==='check'){if(call!==0)return {ok:false,error:`You need ${call} more to call.`};p.action=p.lastAction='CHECK';room.poker.needsAction.delete(p.id)}
  else if(action==='call'){if(call===0)return {ok:false,error:'You can check instead.'};put(room,p,call);p.action=p.lastAction='CALL';room.poker.needsAction.delete(p.id)}
  else if(action==='allin'){const before=room.poker.highestBet;const minTo=before+room.poker.minRaise;put(room,p,p.chips);p.action=p.lastAction='ALL-IN';room.poker.needsAction.delete(p.id);if(p.bet>=minTo){const raiseBy=p.bet-before;room.poker.highestBet=p.bet;room.poker.minRaise=Math.max(BIG_BLIND,raiseBy);raised=true}}
  else if(action==='raise'){const to=Number(amount);const minTo=room.poker.highestBet+room.poker.minRaise;const maxTo=p.bet+p.chips;if(!Number.isFinite(to)||to<minTo)return {ok:false,error:`Minimum raise-to is ${minTo}.`};if(to>maxTo)return {ok:false,error:`You only have ${maxTo} available.`};const old=room.poker.highestBet;put(room,p,to-p.bet);room.poker.highestBet=to;room.poker.minRaise=Math.max(BIG_BLIND,to-old);p.action=p.lastAction='RAISE';raised=true;room.poker.needsAction=new Set(actors(room).filter(x=>x.id!==p.id).map(x=>x.id))}
  else return {ok:false,error:'Unknown poker action.'};
  if(activeCount(room)<=1){awardFold(room);return {ok:true}}
  if(raised && action==='allin')room.poker.needsAction=new Set(actors(room).filter(x=>x.id!==p.id).map(x=>x.id));
  const n=nextActor(room,room.players.indexOf(p));if(n)setTurn(room,n,()=>timeoutPoker(room));else advancePoker(room);
  broadcast(room);botTick(room);return {ok:true}
}
function timeoutPoker(room){const p=room.players.find(x=>x.id===room.turnPlayerId);if(!p)return advancePoker(room);const call=required(room,p);if(call>0){p.folded=true;p.action=p.lastAction='FOLD';say(room,`${p.name} timed out and folded.`)}else{p.action=p.lastAction='CHECK';say(room,`${p.name} timed out and checked.`)}room.poker.needsAction.delete(p.id);advancePoker(room);broadcast(room);botTick(room)}
function showdown(room){
  clearTimer(room);const levels=[...new Set(room.players.filter(p=>p.totalBet>0).map(p=>p.totalBet))].sort((a,b)=>a-b);let prev=0;const payouts=new Map();const details=[];
  for(const level of levels){const contributors=room.players.filter(p=>p.totalBet>=level);const pot=(level-prev)*contributors.length;const eligible=contributors.filter(p=>!p.folded);if(pot>0&&eligible.length){let best=null,winners=[];for(const p of eligible){const r=eval7([...p.hole,...room.poker.community]);if(!best||cmp(r,best)>0){best=r;winners=[p]}else if(cmp(r,best)===0)winners.push(p)}const share=Math.floor(pot/winners.length),rem=pot%winners.length;winners.forEach((p,i)=>{const pay=share+(i===0?rem:0);p.chips+=pay;payouts.set(p.id,(payouts.get(p.id)||0)+pay);details.push({id:p.id,amount:pay,hand:handName(best),pot})})}prev=level}
  room.poker.pot=0;room.poker.phase='HAND_COMPLETE';room.turnPlayerId=null;room.poker.winners=[...payouts.entries()].map(([id,amount])=>{const d=details.find(x=>x.id===id);return {id,amount,hand:d?.hand||'Winner'}});room.poker.showdown=room.players.filter(p=>p.hole.length).map(p=>{let hand='Folded';if(!p.folded){const r=eval7([...p.hole,...room.poker.community]);hand=handName(r)}return {id:p.id,name:p.name,cards:p.hole.map(cardText),folded:p.folded,hand}});room.players.forEach(p=>{if(p.accountId&&accounts[p.accountId]&&p.totalBet>0){const a=ensureAccount(accounts[p.accountId]);const pay=payouts.get(p.id)||0;recordGame(a,'poker',pay-p.totalBet,pay>0?'win':'loss',pay)} });saveAccounts();room.players.forEach(p=>{if(p.hole.length)p.lastAction=room.poker.winners.some(w=>w.id===p.id)?'WIN':'SHOWDOWN'});say(room,room.poker.winners.map(w=>`${room.players.find(p=>p.id===w.id)?.name} wins ${w.amount} (${w.hand})`).join(' • ')||'Showdown complete.');room.turnEndsAt=Date.now()+9000;room.timer=setTimeout(()=>nextHand(room),9000);broadcast(room)}
function nextHand(room){if(!rooms.has(room.code))return;const n=room.players.filter(p=>p.chips>0&&(p.connected||p.bot)).length;if(n>=2){room.poker.dealerIndex=(room.poker.dealerIndex+1)%room.players.length;startPokerHand(room)}else{room.status='LOBBY';room.poker.phase='LOBBY';broadcast(room)}}
function preflopStrength(hole){
  if(!hole||hole.length!==2)return .5;
  const value=c=>rv(c.r), a=value(hole[0]),b=value(hole[1]),hi=Math.max(a,b),lo=Math.min(a,b);
  const pair=a===b, suited=hole[0].s===hole[1].s, gap=hi-lo;
  let score=pair?.48+(hi-2)*.035:.12+(hi-2)*.025+(lo-2)*.012;
  if(suited)score+=.055;
  if(gap===1)score+=.045;else if(gap===2)score+=.02;else if(gap>=5)score-=.08;
  if(hi>=12&&lo>=10)score+=.07;
  return Math.max(.05,Math.min(.97,score));
}
function boardTexture(board){
  if(!board.length)return {paired:false,flushDraw:false,straightDraw:false,wet:false};
  const ranks=board.map(c=>rv(c.r)),suits={};board.forEach(c=>suits[c.s]=(suits[c.s]||0)+1);
  const paired=new Set(ranks).size<ranks.length,flushDraw=Object.values(suits).some(n=>n>=3);
  const uniq=[...new Set([...ranks,...(ranks.includes(14)?[1]:[])])].sort((a,b)=>a-b);
  let straightDraw=false;for(let i=0;i<uniq.length;i++){const window=uniq.filter(v=>v>=uniq[i]&&v<=uniq[i]+4);if(window.length>=3){straightDraw=true;break}}
  return {paired,flushDraw,straightDraw,wet:flushDraw||straightDraw};
}
function estimateEquity(p,room,trials=160){
  const opponents=room.players.filter(q=>q.id!==p.id&&!q.folded&&!q.allIn&&(q.chips+q.bet>0)&&(q.connected||q.bot));
  if(!p.hole.length||!opponents.length)return .5;
  const board=room.poker.community.slice(),known=new Set([...p.hole,...board].map(cardText));
  const unseen=SUITS.flatMap(s=>RANKS.map(r=>({r,s}))).filter(c=>!known.has(cardText(c)));
  let share=0;
  for(let t=0;t<trials;t++){
    const deck=unseen.slice(),draw=()=>deck.splice(crypto.randomInt(deck.length),1)[0];
    const opponentHands=opponents.map(()=>[draw(),draw()]);
    const runout=board.slice();while(runout.length<5)runout.push(draw());
    const hero=eval7([...p.hole,...runout]);let best=hero,heroWins=true,ties=1;
    for(const cards of opponentHands){
      const score=eval7([...cards,...runout]),c=cmp(score,best);
      if(c>0){best=score;heroWins=false;ties=1}
      else if(c===0)ties++;
    }
    if(heroWins)share+=1/ties;
  }
  return share/trials;
}
function botTick(room){
  if(!rooms.has(room.code))return;
  if(room.game==='poker'&&room.turnPlayerId){
    const p=room.players.find(x=>x.id===room.turnPlayerId);
    if(p?.bot&&!p._botPending){
      p._botPending=true;
      setTimeout(()=>{
        p._botPending=false;
        if(!rooms.has(room.code)||room.turnPlayerId!==p.id||!room.poker.needsAction.has(p.id))return;
        const cfg=BOT_TYPES[p.botType]||BOT_TYPES.River;
        const call=required(room,p),pot=Math.max(1,room.poker.pot),potOdds=call/(pot+call);
        const preflop=room.poker.community.length===0;
        const equity=estimateEquity(p,room,preflop?110:190);
        const strength=preflop?preflopStrength(p.hole):equity;
        const texture=boardTexture(room.poker.community);
        const r=crypto.randomInt(10000)/10000;
        const minTo=room.poker.highestBet+room.poker.minRaise,maxTo=p.bet+p.chips;
        const canRaise=maxTo>=minTo&&p.chips>0;
        const position=(room.players.indexOf(p)-room.poker.dealerIndex+room.players.length)%Math.max(1,room.players.length);
        const positionalBonus=position<=1?.035:position>=room.players.length-2?-.015:0;
        const adjusted=strength+positionalBonus;
        const riskTolerance=(cfg.aggression-.5)*.12+(cfg.tight<.5?.035:-.025);
        const foldThreshold=Math.max(.08,potOdds+.025-riskTolerance);
        const bluffChance=cfg.bluff*(preflop?.12:.30)*(texture.wet?.65:1);
        let action=call?'call':'check',amount;
        const strong=adjusted>=Math.max(.60,potOdds+.22);
        const medium=adjusted>=Math.max(.30,potOdds-.06);
        const facingLargeBet=call>pot*.72;
        if(call>0){
          if(adjusted<foldThreshold&&r>bluffChance)action='fold';
          else if(canRaise&&strong&&r<cfg.aggression*.72){action='raise';amount=Math.min(maxTo,Math.max(minTo,room.poker.highestBet+Math.max(room.poker.minRaise,Math.floor(pot*(adjusted>.82?.78:.52)))))}
          else if(canRaise&&adjusted>.52&&r<cfg.aggression*.13){action='raise';amount=minTo}
          else if(facingLargeBet&&adjusted<potOdds+.10&&r>bluffChance*.5)action='fold';
          else if(medium||r<bluffChance)action='call';
          else action='fold';
        }else{
          const valueBet=adjusted>=.57&&r<(.24+cfg.aggression*.52);
          const semiBluff=texture.wet&&adjusted>=.28&&r<bluffChance;
          const pressureBluff=!preflop&&adjusted>=.18&&r<bluffChance*.55&&room.poker.phase!=='RIVER';
          if(canRaise&&(valueBet||semiBluff||pressureBluff)){
            action='raise';
            const fraction=adjusted>.82?.72:adjusted>.65?.55:.42;
            amount=Math.min(maxTo,Math.max(minTo,room.poker.highestBet+Math.max(room.poker.minRaise,Math.floor(pot*fraction))));
          }
        }
        if(action==='raise'&&(!Number.isFinite(amount)||amount<minTo||amount>maxTo))action=call?'call':'check';
        pokerAction(room,p,action,amount);
      },650+crypto.randomInt(1200));
    }
  }
  if(room.game==='blackjack'&&room.turnPlayerId){
    const p=room.players.find(x=>x.id===room.turnPlayerId);
    if(p?.bot&&!p._botPending){
      p._botPending=true;
      setTimeout(()=>{p._botPending=false;const h=room.blackjack.hands[p.id];if(h&&!h.done){const total=bjValue(h.cards).total,soft=bjValue(h.cards).soft,dealerUp=room.blackjack.dealer[0]?rv(room.blackjack.dealer[0].r):7;const action=total<12?'hit':total<17?(soft||dealerUp>=7?'hit':'stand'):total===17&&soft&&dealerUp>=9?'hit':'stand';bjAction(room,p,action)}},900+crypto.randomInt(700));
    }
  }
}

// Blackjack
function bjValue(cards){let total=0,aces=0;for(const c of cards){if(c.r==='A'){aces++;total+=11}else total+=Math.min(10,rv(c.r))}while(total>21&&aces){total-=10;aces--}return {total,soft:aces>0}}
function bjReset(room){room.blackjack={phase:'BETTING',deck:makeDeck(),hands:{},dealer:[],hidden:true};for(const p of room.players)room.blackjack.hands[p.id]={bet:0,cards:[],done:false,doubled:false,result:null}}
function bjStart(room){room.status='IN_GAME';bjReset(room);for(const p of room.players){if(p.bot&&p.chips>=25) {p.chips-=25;room.blackjack.hands[p.id].bet=25;}}say(room,'Place your blackjack bet. Bots automatically wager 25 chips.');broadcast(room);setTimeout(()=>{const bettors=room.players.filter(p=>p.chips>0&&(p.connected||p.bot)&&room.blackjack.hands[p.id].bet>0);if(!bettors.length){say(room,'No bets were placed.');room.status='LOBBY';broadcast(room);return}for(const p of bettors)room.blackjack.hands[p.id].cards=[room.blackjack.deck.pop(),room.blackjack.deck.pop()];room.blackjack.dealer=[room.blackjack.deck.pop(),room.blackjack.deck.pop()];room.blackjack.phase='PLAYING';room.blackjack.hidden=true;room.turnPlayerId=null;bjAdvance(room);broadcast(room)},10000)}
function bjAdvance(room){const p=room.players.find(x=>{const h=room.blackjack.hands[x.id];return h?.bet>0&&!h.done&&bjValue(h.cards).total<21});if(p){setTurn(room,p,()=>{p._botPending=false;const h=room.blackjack.hands[p.id];if(h&&!h.done){h.done=true;bjAdvance(room);broadcast(room)}});broadcast(room);botTick(room);return}clearTimer(room);room.blackjack.hidden=false;while(bjValue(room.blackjack.dealer).total<17)room.blackjack.dealer.push(room.blackjack.deck.pop());const dv=bjValue(room.blackjack.dealer).total;for(const p2 of room.players){const h=room.blackjack.hands[p2.id];if(!h?.bet)continue;const v=bjValue(h.cards).total;if(v>21){h.result='BUST'}else if(v===21&&h.cards.length===2&&dv!==21){h.result='BLACKJACK';p2.chips+=Math.floor(h.bet*2.5)}else if(dv>21||v>dv){h.result='WIN';p2.chips+=h.bet*2}else if(v===dv){h.result='PUSH';p2.chips+=h.bet}else h.result='LOSE';if(p2.accountId&&accounts[p2.accountId]){const a=ensureAccount(accounts[p2.accountId]);const payout=h.result==='BLACKJACK'?Math.floor(h.bet*2.5):h.result==='WIN'?h.bet*2:h.result==='PUSH'?h.bet:0;recordGame(a,'blackjack',payout-h.bet,h.result==='PUSH'?'push':payout>0?'win':'loss',payout)}h.done=true}room.blackjack.phase='RESULT';saveAccounts();say(room,'Dealer reveals. Round complete.');broadcast(room);setTimeout(()=>{room.status='IN_GAME';room.blackjack={phase:'BETTING',deck:makeDeck(),hands:{},dealer:[],hidden:true};for(const p3 of room.players)room.blackjack.hands[p3.id]={bet:0,cards:[],done:false,doubled:false,result:null};say(room,'New blackjack round — place your bets.');broadcast(room)},3500)}
function bjAction(room,p,action){const h=room.blackjack.hands[p.id];if(room.blackjack.phase!=='PLAYING'||room.turnPlayerId!==p.id||!h||h.done)return {ok:false,error:'It is not your blackjack turn.'};if(action==='hit'){h.cards.push(room.blackjack.deck.pop());if(bjValue(h.cards).total>=21)h.done=true}else if(action==='stand'){h.done=true}else if(action==='double'){if(h.cards.length!==2||h.doubled||p.chips<h.bet)return {ok:false,error:'Double down requires enough chips and your first two cards.'};p.chips-=h.bet;h.bet*=2;h.doubled=true;h.cards.push(room.blackjack.deck.pop());h.done=true}else return {ok:false,error:'Unknown action.'};bjAdvance(room);broadcast(room);return {ok:true}}
function blackjackBet(room,p,amount){if(room.game!=='blackjack'||room.blackjack.phase!=='BETTING')return {ok:false,error:'Betting is closed.'};amount=Number(amount);if(!Number.isFinite(amount)||amount<1||amount>p.chips)return {ok:false,error:'Invalid bet.'};const h=room.blackjack.hands[p.id]||(room.blackjack.hands[p.id]={bet:0,cards:[],done:false,doubled:false,result:null});p.chips-=amount;h.bet+=amount;if(!room.blackjack.dealTimer){room.blackjack.dealTimer=setTimeout(()=>{room.blackjack.dealTimer=null;if(room.blackjack.phase!=='BETTING')return;const bettors=room.players.filter(x=>room.blackjack.hands[x.id]?.bet>0&&x.chips>=0);if(!bettors.length)return;for(const x of bettors){const hand=room.blackjack.hands[x.id];hand.cards=[room.blackjack.deck.pop(),room.blackjack.deck.pop()];hand.done=false;hand.doubled=false;hand.result=null}room.blackjack.dealer=[room.blackjack.deck.pop(),room.blackjack.deck.pop()];room.blackjack.phase='PLAYING';room.blackjack.hidden=true;room.turnPlayerId=null;bjAdvance(room);broadcast(room)},2500)}broadcast(room);return {ok:true}}

// Roulette
function rouletteStart(room){room.status='IN_GAME';room.roulette={phase:'BETTING',bets:[],result:null};say(room,'Place roulette bets. Host spins the wheel.');broadcast(room)}
function rouletteBet(room,p,type,value,amount){if(room.game!=='roulette'||room.roulette.phase!=='BETTING')return {ok:false,error:'Betting is closed.'};amount=Number(amount);if(!Number.isFinite(amount)||amount<1||amount>p.chips)return {ok:false,error:'Invalid bet.'};p.chips-=amount;room.roulette.bets.push({playerId:p.id,type,value:String(value??''),amount});broadcast(room);return {ok:true}}
function rouletteSpin(room){if(room.roulette.phase!=='BETTING')return;room.roulette.phase='SPINNING';broadcast(room);setTimeout(()=>{const n=crypto.randomInt(38);const result=n===37?'00':n===0?'0':String(n);room.roulette.result=result;room.roulette.phase='RESULT';for(const b of room.roulette.bets){const p=room.players.find(x=>x.id===b.playerId);if(!p)continue;let win=false,pay=0;const num=result==='00'?37:Number(result);if(b.type==='number')win=result===String(b.value);if(b.type==='red')win=result!=='0'&&result!=='00'&&RED.has(num);if(b.type==='black')win=result!=='0'&&result!=='00'&&!RED.has(num);if(b.type==='odd')win=num>0&&num<37&&num%2===1;if(b.type==='even')win=num>0&&num<37&&num%2===0;if(b.type==='low')win=num>=1&&num<=18;if(b.type==='high')win=num>=19&&num<=36;if(win){const mult=b.type==='number'?35:1;pay=b.amount*(mult+1);p.chips+=pay}if(p.accountId&&accounts[p.accountId]){const a=ensureAccount(accounts[p.accountId]);recordGame(a,'roulette',pay-b.amount,pay>0?'win':'loss',pay)}}saveAccounts();say(room,`Roulette result: ${result}.`);broadcast(room);setTimeout(()=>{room.status='IN_GAME';room.roulette={phase:'BETTING',bets:[],result:null};say(room,'Next roulette round — place your bets.');broadcast(room)},3500)},3500)}

// Chess
function chessStart(room,entryBet=0){const ps=room.players.filter(p=>p.connected||p.bot);if(ps.length<2)return;entryBet=Math.max(0,Math.floor(Number(entryBet)||0));const duelists=ps.slice(0,2);if(entryBet>0&&duelists.some(p=>p.chips<entryBet)){say(room,'Both chess players must have enough table chips for the wager.');room.status='LOBBY';broadcast(room);return}room.status='IN_GAME';room.chess={game:new Chess(),white:duelists[0].id,black:duelists[1].id,wagerPot:entryBet*duelists.length,entryBet,winners:[]};for(const p of duelists)p.chips-=entryBet;say(room,`${duelists[0].name} is White. ${duelists[1].name} is Black${entryBet>0?` — ${entryBet.toLocaleString()} each in the pot.`:'.'}`);broadcast(room);botChessTick(room)}
function chessMove(room,p,move){const g=room.chess.game;if(!g)return {ok:false,error:'Chess has not started.'};const side=g.turn()==='w'?room.chess.white:room.chess.black;if(side!==p.id)return {ok:false,error:'It is not your turn.'};try{g.move(move)}catch{return {ok:false,error:'Illegal chess move.'}}if(g.isGameOver()){let winner=null;if(g.isCheckmate())winner=g.turn()==='w'?room.chess.black:room.chess.white;if(winner){const wp=room.players.find(x=>x.id===winner);wp.chips+=room.chess.wagerPot;room.chess.winners=[{id:winner,amount:room.chess.wagerPot}]}if(!winner&&room.chess.wagerPot>0){const w=room.players.find(x=>x.id===room.chess.white),b=room.players.find(x=>x.id===room.chess.black);const half=Math.floor(room.chess.wagerPot/2);if(w)w.chips+=half;if(b)b.chips+=room.chess.wagerPot-half}room.chess.wagerPot=0;say(room,g.isCheckmate()?`${room.players.find(x=>x.id===winner)?.name} wins the wager by checkmate.`:'Draw — wager returned.');}broadcast(room);botChessTick(room);return {ok:true}}
function botChessTick(room){const g=room.chess.game;if(!g)return;const id=g.turn()==='w'?room.chess.white:room.chess.black;const p=room.players.find(x=>x.id===id);if(!p?.bot||p._botPending||g.isGameOver())return;p._botPending=true;setTimeout(()=>{p._botPending=false;const moves=g.moves({verbose:true});if(!moves.length)return;const m=moves[crypto.randomInt(moves.length)];chessMove(room,p,{from:m.from,to:m.to,promotion:m.promotion||'q'})},800+crypto.randomInt(1000))}

function addBot(room,type){if(!BOT_TYPES[type])return {ok:false,error:'Unknown bot personality.'};if(room.players.length>=MAX_PLAYERS)return {ok:false,error:'Room is full.'};const p=player({name:type,bot:true,botType:type});p.connected=true;room.players.push(p);say(room,`${type} joined the room as a bot.`);broadcast(room);return {ok:true}}
function removePlayer(room,p){
  const wasHost=room.hostId===p.id;
  let refunded=0;
  if(p.accountId&&accounts[p.accountId]){
    const a=ensureAccount(accounts[p.accountId]);
    let refund=Math.max(0,Math.floor(p.chips||0));
    if(room.game==='poker' && room.poker.phase!=='HAND_COMPLETE' && p.totalBet>0){
      const committed=Math.max(0,Math.floor(p.totalBet||0));
      room.poker.pot=Math.max(0,room.poker.pot-committed);
      refund+=committed; p.bet=0; p.totalBet=0;
    }
    const bh=room.blackjack?.hands?.[p.id];
    if(room.game==='blackjack' && bh && room.blackjack.phase!=='RESULT'){
      refund+=Math.max(0,Math.floor(bh.bet||0));
      delete room.blackjack.hands[p.id];
    }
    if(room.game==='roulette' && room.roulette?.phase!=='RESULT'){
      const remaining=(room.roulette.bets||[]).filter(b=>b.playerId===p.id);
      refund+=remaining.reduce((sum,b)=>sum+Math.max(0,Math.floor(b.amount||0)),0);
      room.roulette.bets=(room.roulette.bets||[]).filter(b=>b.playerId!==p.id);
    }
    if(refund>0){
      a.tokens+=refund; refunded=refund;
      recordTransaction(a,refund,'table_return',room.game,{room:room.code,reason:'leave_table'});
      saveAccounts();
    }
  }
  room.players=room.players.filter(x=>x.id!==p.id);
  if(wasHost){
    const n=room.players.find(x=>x.connected||x.bot);
    room.hostId=n?.id||null; room.players.forEach(x=>x.host=x.id===room.hostId);
  }
  if(room.game==='poker'&&room.status==='IN_GAME'){
    if(room.players.filter(x=>!x.folded&&x.chips+x.bet>0).length<=1) awardFold(room);
    else if(room.turnPlayerId===p.id) advancePoker(room);
  }
  if(!room.players.length){clearTimer(room);rooms.delete(room.code);return;}
  say(room,`${p.name} left the room${refunded?' and returned '+refunded.toLocaleString()+' tokens to the vault':''}.`);
  broadcast(room);
}
io.on('connection',socket=>{
  socket.on('createRoom',({name,accountToken}={},ack)=>{const a=accountFromToken(String(accountToken||''));if(!a)return ack?.({ok:false,error:'Sign in before creating a room.'});const p=player({name:a.name,accountId:a.id,socketId:socket.id});p.chips=Math.min(1000,a.tokens);a.tokens-=p.chips;recordTransaction(a,-p.chips,'table_buyin','lobby',{room:'new'});saveAccounts();const room=newRoom(p);rooms.set(room.code,room);socket.join(room.code);socket.data.room=room.code;socket.data.player=p.id;say(room,`${p.name} created the room.`);broadcast(room);ack?.({ok:true,code:room.code,reconnectToken:p.reconnectToken})});
  socket.on('requestJoin',({code,accountToken}={},ack)=>{const a=accountFromToken(String(accountToken||''));const room=rooms.get(String(code||'').toUpperCase());if(!a||!room)return ack?.({ok:false,error:'Room not found.'});if(room.status!=='LOBBY'||room.players.length>=MAX_PLAYERS)return ack?.({ok:false,error:'That room is not accepting players.'});if(room.players.some(x=>x.accountId===a.id))return ack?.({ok:false,error:'You are already in this room.'});const host=room.players.find(x=>x.id===room.hostId);const hostSocket=host?.socketId&&io.sockets.sockets.get(host.socketId);if(!hostSocket?.connected||!host.connected||hostSocket.data.room!==room.code||hostSocket.data.player!==host.id)return ack?.({ok:false,error:'The host is offline. Choose another live table.'});room.joinRequests=(room.joinRequests||[]).filter(x=>x.accountId!==a.id);const request={id:uid('req'),accountId:a.id,socketId:socket.id,name:a.name,at:Date.now()};room.joinRequests.push(request);hostSocket.emit('joinRequest',{id:request.id,code:room.code,name:a.name});ack?.({ok:true})});
  socket.on('respondJoin',({requestId,allow}={},ack)=>{const room=rooms.get(socket.data.room),host=room?.players.find(x=>x.id===socket.data.player);if(!room||!host||host.id!==room.hostId)return ack?.({ok:false,error:'Only the host can respond.'});const req=(room.joinRequests||[]).find(x=>x.id===requestId);if(!req)return ack?.({ok:false,error:'Request expired.'});const target=io.sockets.sockets.get(req.socketId);room.joinRequests=room.joinRequests.filter(x=>x.id!==requestId);if(!target||target.disconnected){broadcast(room);return ack?.({ok:false,error:'That player disconnected. Ask them to request again.'})}if(!allow){target.emit('joinRequestResult',{ok:false,code:room.code,error:'The host declined your request.'});broadcast(room);return ack?.({ok:true})}if(room.status!=='LOBBY'||room.players.length>=MAX_PLAYERS){target.emit('joinRequestResult',{ok:false,error:'Room is full or no longer accepting players.'});return ack?.({ok:false,error:'Room is full or no longer accepting players.'})}const a=accounts[req.accountId];if(!a)return ack?.({ok:false,error:'Account no longer exists.'});if(room.players.some(x=>x.accountId===a.id)){target.emit('joinRequestResult',{ok:false,error:'You are already in this room.'});return ack?.({ok:false,error:'Player is already in this room.'})}const p=player({name:a.name,accountId:a.id,socketId:target.id});p.chips=Math.min(1000,a.tokens);a.tokens-=p.chips;recordTransaction(a,-p.chips,'table_buyin','lobby',{room:room.code});saveAccounts();room.players.push(p);room.abandonedAt=null;target.join(room.code);target.data.room=room.code;target.data.player=p.id;target.emit('joinRequestResult',{ok:true,code:room.code,reconnectToken:p.reconnectToken});say(room,`${p.name} joined the room.`);broadcast(room);ack?.({ok:true})});
  socket.on('joinRoom',({code,name,accountToken}={},ack)=>{const a=accountFromToken(String(accountToken||''));if(!a)return ack?.({ok:false,error:'Sign in before joining a room.'});const room=rooms.get(String(code||'').toUpperCase());if(!room)return ack?.({ok:false,error:'Room does not exist.'});if(room.players.length>=MAX_PLAYERS)return ack?.({ok:false,error:'Room is full.'});if(room.status==='IN_GAME')return ack?.({ok:false,error:'That room is already in a game.'});const p=player({name:a.name,accountId:a.id,socketId:socket.id});if(room.players.some(x=>x.accountId===a.id))return ack?.({ok:false,error:'You are already in this room.'});p.chips=Math.min(1000,a.tokens);a.tokens-=p.chips;recordTransaction(a,-p.chips,'table_buyin','lobby',{room:room.code});saveAccounts();room.players.push(p);socket.join(room.code);socket.data.room=room.code;socket.data.player=p.id;say(room,`${p.name} joined the room.`);broadcast(room);ack?.({ok:true,code:room.code,reconnectToken:p.reconnectToken})});
  socket.on('resumeRoom',({code,reconnectToken}={},ack)=>{const room=rooms.get(String(code||'').toUpperCase());const p=room?.players.find(x=>x.reconnectToken===reconnectToken);if(!room||!p)return ack?.({ok:false,error:'Reconnection failed.'});p.socketId=socket.id;p.connected=true;p.disconnectedAt=null;room.abandonedAt=null;socket.join(room.code);socket.data.room=room.code;socket.data.player=p.id;broadcast(room);ack?.({ok:true})});
  socket.on('setGame',({game}={},ack)=>{const room=rooms.get(socket.data.room),p=room?.players.find(x=>x.id===socket.data.player);if(!room||!p||room.hostId!==p.id||room.status==='IN_GAME')return ack?.({ok:false,error:'Only the host can choose the lobby game.'});if(!['poker','blackjack','roulette','chess'].includes(game))return ack?.({ok:false,error:'Invalid game.'});room.game=game;room.poker.phase='LOBBY';broadcast(room);ack?.({ok:true})});
  socket.on('addBot',({type}={},ack)=>{const room=rooms.get(socket.data.room),p=room?.players.find(x=>x.id===socket.data.player);if(!room||!p||room.hostId!==p.id)return ack?.({ok:false,error:'Only the host can add bots.'});ack?.(addBot(room,type))});
  socket.on('removeBot',({id}={},ack)=>{const room=rooms.get(socket.data.room),p=room?.players.find(x=>x.id===socket.data.player);if(!room||!p||room.hostId!==p.id)return ack?.({ok:false,error:'Only the host can remove bots.'});const b=room.players.find(x=>x.id===id&&x.bot);if(!b)return ack?.({ok:false,error:'Bot not found.'});removePlayer(room,b);ack?.({ok:true})});
  socket.on('startGame',({entryBet}={},ack)=>{const room=rooms.get(socket.data.room),p=room?.players.find(x=>x.id===socket.data.player);if(!room||!p||room.hostId!==p.id)return ack?.({ok:false,error:'Only the host can start.'});if(room.game==='poker'){if(connected(room).filter(x=>x.chips>0).length<2)return ack?.({ok:false,error:'Add at least one bot or another player.'});startPokerHand(room)}else if(room.game==='blackjack'){bjStart(room)}else if(room.game==='roulette'){rouletteStart(room)}else{if(connected(room).length<2)return ack?.({ok:false,error:'Chess needs two players.'});chessStart(room,entryBet)}ack?.({ok:true})});
  socket.on('pokerAction',({action,amount}={},ack)=>{const room=rooms.get(socket.data.room),p=room?.players.find(x=>x.id===socket.data.player);ack?.(room&&p?pokerAction(room,p,action,amount):{ok:false,error:'Not in a room.'})});
  socket.on('blackjackBet',({amount}={},ack)=>{const room=rooms.get(socket.data.room),p=room?.players.find(x=>x.id===socket.data.player);ack?.(room&&p?blackjackBet(room,p,amount):{ok:false,error:'Not in a room.'})});
  socket.on('blackjackAction',({action}={},ack)=>{const room=rooms.get(socket.data.room),p=room?.players.find(x=>x.id===socket.data.player);ack?.(room&&p?bjAction(room,p,action):{ok:false,error:'Not in a room.'})});
  socket.on('rouletteBet',({type,value,amount}={},ack)=>{const room=rooms.get(socket.data.room),p=room?.players.find(x=>x.id===socket.data.player);ack?.(room&&p?rouletteBet(room,p,type,value,amount):{ok:false,error:'Not in a room.'})});
  socket.on('rouletteSpin',(_,ack)=>{const room=rooms.get(socket.data.room),p=room?.players.find(x=>x.id===socket.data.player);if(!room||!p||room.hostId!==p.id)return ack?.({ok:false,error:'Only the host can spin.'});if(room.roulette.phase!=='BETTING')return ack?.({ok:false,error:'The roulette wheel is not ready.'});rouletteSpin(room);ack?.({ok:true})});
  socket.on('chessMove',({move}={},ack)=>{const room=rooms.get(socket.data.room),p=room?.players.find(x=>x.id===socket.data.player);ack?.(room&&p?chessMove(room,p,move):{ok:false,error:'Not in a room.'})});
  socket.on('quickGame',({game,choice,amount,target}={},ack)=>{const a=accountFromToken(String(socket.handshake.auth?.accountToken||''));if(!a)return ack?.({ok:false,error:'Sign in first.'});const n=Math.floor(Number(amount));if(!Number.isFinite(n)||n<1||n>100000||n>a.tokens)return ack?.({ok:false,error:'Invalid token amount.'});let result,win=false,payout=0,meta={choice};if(game==='coinflip'){result=crypto.randomInt(2)===0?'heads':'tails';win=String(choice).toLowerCase()===result;payout=win?n*2:0}else if(game==='dice'){const t=Math.floor(Number(target));if(t<2||t>99)return ack?.({ok:false,error:'Target must be 2–99.'});result=crypto.randomInt(1,101);win=result>=t;payout=win?Math.max(n+1,Math.floor(n*100/(101-t))):0;meta.target=t}else if(game==='slots'){const symbols=['7','BAR','★','◆','●'];const reels=[0,0,0].map(()=>symbols[crypto.randomInt(symbols.length)]);result=reels.join(' | ');const counts={};reels.forEach(x=>counts[x]=(counts[x]||0)+1);const top=Math.max(...Object.values(counts));win=top>=2;payout=top===3?n*8:top===2?n*2:0;meta.reels=reels}else if(game==='higherlower'){const current=crypto.randomInt(1,14),next=crypto.randomInt(1,14);result={current,next};const dir=String(choice).toLowerCase();win=(dir==='higher'&&next>current)||(dir==='lower'&&next<current);payout=win?n*2:0;meta.current=current;meta.next=next}else return ack?.({ok:false,error:'Unknown quick game.'});a.tokens-=n;if(win)a.tokens+=payout;recordGame(a,game,win?payout-n:-n,win?'win':'loss',payout);saveAccounts();ack?.({ok:true,game,choice,result,win,payout,net:win?payout-n:-n,account:accountResponse(a)})});
  socket.on('chat',({text}={},ack)=>{const room=rooms.get(socket.data.room),p=room?.players.find(x=>x.id===socket.data.player);if(!room||!p)return ack?.({ok:false,error:'Not in a room.'});const t=cleanChat(text);if(!t)return ack?.({ok:false,error:'Empty message.'});room.chat.push({id:uid('m'),name:p.name,text:t,system:false,at:Date.now()});room.chat=room.chat.slice(-80);broadcast(room);ack?.({ok:true})});
  socket.on('returnToLobby',(_,ack)=>{const room=rooms.get(socket.data.room),p=room?.players.find(x=>x.id===socket.data.player);if(!room||!p)return ack?.({ok:false,error:'You are not in a room.'});clearTimer(room);if(room.game==='poker'&&room.poker.phase!=='HAND_COMPLETE'){for(const x of room.players){if(x.totalBet>0){x.chips+=Math.max(0,Math.floor(x.totalBet));x.bet=0;x.totalBet=0;}}}if(room.game==='blackjack'&&room.blackjack.phase!=='RESULT'){for(const x of room.players){const h=room.blackjack.hands?.[x.id];if(h?.bet){x.chips+=Math.max(0,Math.floor(h.bet));h.bet=0;}}}if(room.game==='roulette'&&room.roulette.phase!=='RESULT'){for(const b of room.roulette.bets||[]){const x=room.players.find(y=>y.id===b.playerId);if(x)x.chips+=Math.max(0,Math.floor(b.amount||0));}}if(room.game==='chess'&&room.chess.wagerPot>0&&room.chess.entryBet>0){for(const id of [room.chess.white,room.chess.black]){const x=room.players.find(y=>y.id===id);if(x)x.chips+=room.chess.entryBet;}room.chess.wagerPot=0;room.chess.entryBet=0;}room.status='LOBBY';room.poker.phase='LOBBY';room.poker.community=[];room.poker.pot=0;room.poker.showdown=[];room.poker.winners=[];room.poker.needsAction=new Set();room.blackjack={phase:'BETTING',deck:[],hands:{},dealer:[],hidden:true};room.roulette={phase:'BETTING',bets:[],result:null};room.chess={game:null,white:null,black:null,wagerPot:0,entryBet:0,winners:[]};room.joinRequests=[];room.abandonedAt=null;room.players.forEach(x=>{if(x.connected)x.disconnectedAt=null});say(room,`${p.name} returned the table to the room lobby. Active wagers were returned to the table stacks.`);broadcast(room);ack?.({ok:true});});
  socket.on('playAgain',(_,ack)=>{const room=rooms.get(socket.data.room),p=room?.players.find(x=>x.id===socket.data.player);if(!room||!p)return ack?.({ok:false,error:'Not in a room.'});if(room.game==='poker'){if(room.poker.phase==='HAND_COMPLETE'){clearTimer(room);nextHand(room)}else if(room.status==='LOBBY')startPokerHand(room)}else if(room.game==='blackjack'){room.status='IN_GAME';bjReset(room);say(room,'New blackjack round. Place your bets.');broadcast(room)}else if(room.game==='roulette'){room.status='IN_GAME';room.roulette={phase:'BETTING',bets:[],result:null};say(room,'New roulette round. Place your bets.');broadcast(room)}else if(room.game==='chess'){chessStart(room,0)}return ack?.({ok:true})});
  socket.on('leaveRoom',(_,ack)=>{const room=rooms.get(socket.data.room),p=room?.players.find(x=>x.id===socket.data.player);if(!room||!p)return ack?.({ok:false,error:'You are not in a room.'});removePlayer(room,p);socket.leave(room.code);socket.data.room=null;socket.data.player=null;ack?.({ok:true})});
  socket.on('disconnect',()=>{const room=rooms.get(socket.data.room),p=room?.players.find(x=>x.id===socket.data.player);if(!room||!p)return;p.connected=false;p.socketId=null;p.disconnectedAt=Date.now();if(!room.players.some(x=>!x.bot&&x.connected))room.abandonedAt=Date.now();if(room.hostId===p.id){const n=room.players.find(x=>x.connected||x.bot);if(n){room.hostId=n.id;room.players.forEach(x=>x.host=x.id===n.id)}}if(room.game==='poker'&&room.status==='IN_GAME'&&room.turnPlayerId===p.id)timeoutPoker(room);broadcast(room)});
});

// Expire stale invitations and destroy abandoned rooms after a short reconnect grace period.
setInterval(()=>{const now=Date.now();for(const room of [...rooms.values()]){room.joinRequests=(room.joinRequests||[]).filter(r=>now-r.at<90000&&io.sockets.sockets.has(r.socketId));const hasHuman=room.players.some(p=>!p.bot&&p.connected&&p.socketId&&io.sockets.sockets.has(p.socketId));if(hasHuman){room.abandonedAt=null;continue}const grace=room.status==='LOBBY'?60000:120000;if(!room.abandonedAt){const times=room.players.filter(p=>!p.bot&&Number.isFinite(p.disconnectedAt)).map(p=>p.disconnectedAt);room.abandonedAt=times.length?Math.max(...times):now-grace}if(now-room.abandonedAt>=grace){for(const p of [...room.players])removePlayer(room,p);rooms.delete(room.code)}}},15000).unref?.();

server.listen(PORT,'0.0.0.0',()=>console.log(`Game Hunk server listening on ${PORT}`));
