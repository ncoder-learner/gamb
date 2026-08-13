const express = require('express');
const http = require('http');
const crypto = require('crypto');
const { Server } = require('socket.io');
const { Chess } = require('chess.js');

const app = express();
app.use(express.json());
app.use(express.static('public'));
app.get('/health', (_req, res) => res.json({ ok: true, service: 'poker-hunk-ultimate', time: new Date().toISOString() }));
const server = http.createServer(app);
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:3000').split(',').map(s => s.trim()).filter(Boolean);
const io = new Server(server, { cors: { origin: allowedOrigins, methods: ['GET','POST'] } });

const PORT = Number(process.env.PORT || 3000);
const MAX_PLAYERS = 8;
const STARTING_CHIPS = 1000;
const ACTION_MS = 25000;
const BOT_DELAY = 900;
const rooms = new Map();
const reconnects = new Map();

const BOT_TYPES = {
  Ace:{tight:.78, aggression:.48, bluff:.05, call:.42, variance:.15},
  Shark:{tight:.42, aggression:.88, bluff:.20, call:.52, variance:.20},
  Bluff:{tight:.40, aggression:.62, bluff:.58, call:.45, variance:.45},
  Lucky:{tight:.25, aggression:.38, bluff:.28, call:.78, variance:.70},
  Dealer:{tight:.82, aggression:.30, bluff:.02, call:.36, variance:.08},
  River:{tight:.50, aggression:.52, bluff:.15, call:.55, variance:.22},
  Pocket:{tight:.84, aggression:.70, bluff:.06, call:.40, variance:.18},
  Wildcard:{tight:.38, aggression:.72, bluff:.48, call:.62, variance:.90}
};

function uid(prefix='p'){ return `${prefix}_${crypto.randomBytes(8).toString('hex')}`; }
function roomCode(){ const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let c=''; for(let i=0;i<6;i++) c+=chars[crypto.randomInt(chars.length)]; return c; }
function uniqueRoomCode(){ let c; do c=roomCode(); while(rooms.has(c)); return c; }
function cleanName(s){ return String(s||'Player').replace(/[<>]/g,'').trim().slice(0,18)||'Player'; }
function cleanChat(s){ return String(s||'').replace(/[<>]/g,'').replace(/[\u0000-\u001F\u007F]/g,'').trim().slice(0,180); }
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=crypto.randomInt(i+1); [a[i],a[j]]=[a[j],a[i]]; } return a; }
function deck(){ const suits=['♠','♥','♦','♣']; const ranks=['2','3','4','5','6','7','8','9','T','J','Q','K','A']; return shuffle(suits.flatMap(s=>ranks.map(r=>({r,s})))); }
function cardText(c){ return c ? `${c.r}${c.s}` : ''; }
function rankVal(r){ return {'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'T':10,'J':11,'Q':12,'K':13,'A':14}[r]; }

function combinations(arr,k){ const out=[]; function rec(start,cur){ if(cur.length===k){out.push(cur.slice());return;} for(let i=start;i<=arr.length-(k-cur.length);i++){cur.push(arr[i]);rec(i+1,cur);cur.pop();} } rec(0,[]); return out; }
function eval5(cards){
  const vals=cards.map(c=>rankVal(c.r)).sort((a,b)=>b-a), counts={}; vals.forEach(v=>counts[v]=(counts[v]||0)+1);
  const flush=cards.every(c=>c.s===cards[0].s); const uniq=[...new Set(vals)].sort((a,b)=>b-a);
  let straightHigh=0; if(uniq.length===5){ if(uniq[0]-uniq[4]===4) straightHigh=uniq[0]; else if(JSON.stringify(uniq)==='[14,5,4,3,2]') straightHigh=5; }
  const groups=Object.entries(counts).map(([v,n])=>({v:+v,n})).sort((a,b)=>b.n-a.n||b.v-a.v);
  if(flush&&straightHigh) return [8,straightHigh];
  if(groups[0].n===4) return [7,groups[0].v,groups[1].v];
  if(groups[0].n===3&&groups[1].n===2) return [6,groups[0].v,groups[1].v];
  if(flush) return [5,...vals];
  if(straightHigh) return [4,straightHigh];
  if(groups[0].n===3) return [3,groups[0].v,...groups.slice(1).map(x=>x.v).sort((a,b)=>b-a)];
  const pairs=groups.filter(g=>g.n===2).sort((a,b)=>b.v-a.v); if(pairs.length===2) return [2,pairs[0].v,pairs[1].v,groups.find(g=>g.n===1).v];
  if(pairs.length===1) return [1,pairs[0].v,...groups.filter(g=>g.n===1).map(g=>g.v).sort((a,b)=>b-a)];
  return [0,...vals];
}
function eval7(cards){ return combinations(cards,5).map(eval5).sort((a,b)=>{for(let i=0;i<Math.max(a.length,b.length);i++){const d=(b[i]||0)-(a[i]||0);if(d)return d;}return 0;})[0]; }
const handNames=['High Card','Pair','Two Pair','Three of a Kind','Straight','Flush','Full House','Four of a Kind','Straight Flush'];

function makePlayer({id,name,bot=false,botType=null,socketId=null}){ return {id,name,bot,botType,socketId,connected:!!socketId,chips:STARTING_CHIPS,host:false,folded:false,allIn:false,bet:0,totalBet:0,hole:[],action:'',lastAction:'',reconnectToken:uid('r'), disconnectedAt:null}; }
function publicPlayer(p,room){ return {id:p.id,name:p.name,bot:p.bot,botType:p.botType,connected:p.connected,chips:p.chips,host:p.host,folded:p.folded,allIn:p.allIn,bet:p.bet,action:p.action,lastAction:p.lastAction,seat:room.players.indexOf(p)}; }
function broadcast(room){ io.to(room.code).emit('state', publicState(room)); }
function privateState(room,socket){ const state=publicState(room); const p=room.players.find(x=>x.socketId===socket.id); if(p) state.me={id:p.id,reconnectToken:p.reconnectToken,hole:p.hole.map(cardText)}; return state; }
function publicState(room){
  return {code:room.code,hostId:room.hostId,game:room.game,players:room.players.map(p=>publicPlayer(p,room)),chat:room.chat.slice(-60),status:room.status,turnPlayerId:room.turnPlayerId,turnEndsAt:room.turnEndsAt,serverNow:Date.now(),phase:room.poker.phase,community:room.poker.community.map(cardText),pot:room.poker.pot,highestBet:room.poker.highestBet,minimumRaise:room.poker.minimumRaise,dealerIndex:room.poker.dealerIndex,winners:room.poker.winners,blackjack:bjPublic(room),roulette:roulettePublic(room),chess:chessPublic(room)};
}
function emitPrivate(room){ room.players.filter(p=>p.socketId).forEach(p=>io.to(p.socketId).emit('state',privateState(room,io.sockets.sockets.get(p.socketId)))); }
function say(room,text,system=true){room.chat.push({id:uid('m'),name:system?'SYSTEM':'',text,system,at:Date.now()}); room.chat=room.chat.slice(-100);}
function connectedPlayers(room){return room.players.filter(p=>p.connected);}
function activePokerPlayers(room){return room.players.filter(p=>!p.folded&&p.chips+p.bet>0);}
function seatOrder(room,start){ const arr=[]; for(let i=1;i<=room.players.length;i++){const p=room.players[(start+i)%room.players.length]; if(p && p.chips+p.bet>0 && !p.folded) arr.push(p);} return arr; }
function nextEligible(room,from){ const n=room.players.length; for(let i=1;i<=n;i++){const p=room.players[(from+i+n)%n]; if(p&&!p.folded&&!p.allIn&&(p.chips+p.bet>0)&&p.connected) return p;} return null; }
function eligibleToAct(room){return room.players.filter(p=>!p.folded&&!p.allIn&&p.connected&&p.chips+p.bet>0);}
function nextPokerActor(room,from){ const n=room.players.length; for(let i=1;i<=n;i++){const p=room.players[(from+i+n)%n]; if(p&&!p.folded&&!p.allIn&&p.connected&&p.chips+p.bet>0&&(p.bet<room.poker.highestBet||p.lastAction==='')) return p;} return null; }

function newRoom(code,host){ const room={code,hostId:host.id,players:[host],game:'poker',status:'LOBBY',chat:[],turnPlayerId:null,turnEndsAt:null,timer:null,poker:{phase:'LOBBY',deck:[],community:[],pot:0,highestBet:0,minimumRaise:50,dealerIndex:0,turnIndex:null,winners:[],lastAggressor:null},blackjack:{phase:'BETTING',deck:[],hands:{},dealer:[],dealerHoleHidden:true,bettingEndsAt:null},roulette:{phase:'BETTING',bets:{},result:null,spinEndsAt:null},chess:{game:null,entryBet:0,white:null,black:null,wagerPot:0,winners:[]}}; host.host=true; return room; }

function clearTimer(room){if(room.timer){clearTimeout(room.timer);room.timer=null;} room.turnEndsAt=null; room.turnPlayerId=null;}
function startTurnTimer(room,cb){clearTimer(room); room.turnEndsAt=Date.now()+ACTION_MS; room.timer=setTimeout(cb,ACTION_MS);}
function playerPut(room,p,amount){amount=Math.max(0,Math.min(amount,p.chips)); p.chips-=amount;p.bet+=amount;p.totalBet+=amount;room.poker.pot+=amount; if(p.chips===0)p.allIn=true; }
function requiredAmount(room,p){return Math.max(0,room.poker.highestBet-p.bet);}
function resetStreetBets(room){room.players.forEach(p=>p.bet=0);room.poker.highestBet=0;room.poker.minimumRaise=50;}
function activeCanAct(room){return eligibleToAct(room).length;}
function onlyOne(room){return room.players.filter(p=>!p.folded && p.chips+p.bet>0).length===1;}
function startPokerHand(room){
  clearTimer(room); const eligible=room.players.filter(p=>p.chips>0 && p.connected); if(eligible.length<2){room.status='WAITING';room.poker.phase='LOBBY';broadcast(room);return;}
  room.status='IN_GAME';room.poker.phase='PREFLOP';room.poker.deck=deck();room.poker.community=[];room.poker.pot=0;room.poker.highestBet=0;room.poker.minimumRaise=50;room.poker.winners=[];
  room.players.forEach(p=>{p.folded=!p.connected||p.chips<=0;p.allIn=false;p.bet=0;p.totalBet=0;p.hole=[];p.action='';p.lastAction='';});
  let d=room.poker.dealerIndex%room.players.length; for(let i=0;i<room.players.length;i++){if(room.players[(d+i)%room.players.length].chips>0&&room.players[(d+i)%room.players.length].connected){d=(d+i)%room.players.length;break;}}
  room.poker.dealerIndex=d; const sb=seatOrder(room,d)[0], bb=seatOrder(room,d)[1]; if(!sb||!bb){room.status='WAITING';return;}
  room.players.filter(p=>!p.folded).forEach(p=>p.hole=[room.poker.deck.pop(),room.poker.deck.pop()]); playerPut(room,sb,25);playerPut(room,bb,50);room.poker.highestBet=50;
  const first=nextPokerActor(room,room.players.indexOf(bb)); room.turnPlayerId=first?.id||null;
  say(room,'Hand started.');
  if(!first || activeCanAct(room)===0){advancePoker(room);} else startTurnTimer(room,()=>timeoutPoker(room));
  broadcast(room);emitPrivate(room);
}
function postBlindsAndFirst(room){ }
function bettingComplete(room){
  const actors=eligibleToAct(room); if(!actors.length) return true;
  return actors.every(p=>p.bet===room.poker.highestBet && (p.lastAction==='CHECK'||p.lastAction==='CALL'||p.lastAction==='RAISE'||p.lastAction==='ALL-IN'));
}
function advancePoker(room){
  clearTimer(room);
  if(onlyOne(room)){awardFoldWin(room);return;}
  if(activeCanAct(room)>0){
    const current=room.turnPlayerId?room.players.findIndex(p=>p.id===room.turnPlayerId):-1; const n=nextPokerActor(room,current<0?room.poker.dealerIndex:current); if(n){room.turnPlayerId=n.id;startTurnTimer(room,()=>timeoutPoker(room));broadcast(room);emitPrivate(room);return;}
  }
  const p=room.poker.phase;
  if(p==='PREFLOP'||p==='FLOP'||p==='TURN'||p==='RIVER'){
    if(p==='PREFLOP'){room.poker.community.push(room.poker.deck.pop(),room.poker.deck.pop(),room.poker.deck.pop());room.poker.phase='FLOP';}
    else if(p==='FLOP'){room.poker.community.push(room.poker.deck.pop());room.poker.phase='TURN';}
    else if(p==='TURN'){room.poker.community.push(room.poker.deck.pop());room.poker.phase='RIVER';}
    else {room.poker.phase='SHOWDOWN';showdown(room);return;}
    resetStreetBets(room);room.players.forEach(p=>{if(!p.folded)p.lastAction='';});
    if(activeCanAct(room)===0){advancePoker(room);return;}
    const first=nextPokerActor(room,room.poker.dealerIndex);room.turnPlayerId=first?.id||null;if(!first){advancePoker(room);return;}
    startTurnTimer(room,()=>timeoutPoker(room));broadcast(room);emitPrivate(room);return;
  }
}
function awardFoldWin(room){ const winner=room.players.find(p=>!p.folded&&p.chips+p.bet>0); if(!winner)return; winner.chips+=room.poker.pot; winner.lastAction='WIN';room.poker.winners=[{id:winner.id,amount:room.poker.pot,hand:'Everyone folded'}];say(room,`${winner.name} wins ${room.poker.pot} chips.`,true);room.poker.pot=0;room.poker.phase='HAND_COMPLETE';clearTimer(room);broadcast(room);setTimeout(()=>nextHand(room),1800); }
function nextHand(room){ if(!rooms.has(room.code))return; const count=room.players.filter(p=>p.chips>0&&p.connected).length;if(count>=2){room.poker.dealerIndex=(room.poker.dealerIndex+1)%room.players.length;startPokerHand(room);}else{room.status='WAITING';room.poker.phase='LOBBY';broadcast(room);} }
function showdown(room){
  clearTimer(room); const contenders=room.players.filter(p=>!p.folded&&p.chips+p.bet>0); const totalPot=room.poker.pot; const contributions=new Map(contenders.map(p=>[p.id,p.totalBet]));
  const levels=[...new Set(room.players.filter(p=>p.totalBet>0).map(p=>p.totalBet))].sort((a,b)=>a-b); let prev=0; const payouts=new Map(); const winners=[];
  for(const level of levels){const participants=room.players.filter(p=>p.totalBet>=level);const amount=(level-prev)*participants.length;if(amount<=0){prev=level;continue;}const eligible=contenders.filter(p=>p.totalBet>=level);let best=null,ws=[];eligible.forEach(p=>{const e=eval7([...p.hole,...room.poker.community]);p.handName=handNames[e[0]];if(!best||cmpRank(e,best)>0){best=e;ws=[p];}else if(cmpRank(e,best)===0)ws.push(p);});const share=Math.floor(amount/ws.length),rem=amount%ws.length;ws.forEach((p,i)=>{const pay=share+(i===0?rem:0);p.chips+=pay;payouts.set(p.id,(payouts.get(p.id)||0)+pay);}); if(ws.length) winners.push(...ws.map(p=>({id:p.id,amount:Math.floor(amount/ws.length),hand:p.handName,sidePot:amount})));prev=level;}
  room.poker.pot=0;room.poker.phase='HAND_COMPLETE';room.poker.winners=[...payouts.entries()].map(([id,amount])=>{const w=winners.find(x=>x.id===id);return {id,amount,hand:w?.hand||'Winner'};});room.players.forEach(p=>{if(p.hole.length)p.lastAction=room.poker.winners.some(w=>w.id===p.id)?'WIN':'SHOWDOWN';});say(room,room.poker.winners.map(w=>`${room.players.find(p=>p.id===w.id)?.name}: +${w.amount}`).join(' • '),true);broadcast(room);emitPrivate(room);setTimeout(()=>nextHand(room),2500);
}
function cmpRank(a,b){for(let i=0;i<Math.max(a.length,b.length);i++){const d=(a[i]||0)-(b[i]||0);if(d)return d;}return 0;}
function pokerAction(room,p,action,amount){
  if(room.game!=='poker'||!['PREFLOP','FLOP','TURN','RIVER'].includes(room.poker.phase))return {ok:false,error:'No poker action is available.'};
  if(room.turnPlayerId!==p.id)return {ok:false,error:'It is not your turn.'}; if(p.folded||p.allIn)return {ok:false,error:'You cannot act.'};
  const toCall=requiredAmount(room,p); let raiseTo=0;
  if(action==='fold'){p.folded=true;p.lastAction='FOLD';p.action='FOLD';}
  else if(action==='check'){if(toCall!==0)return {ok:false,error:'You must call or fold.'};p.lastAction='CHECK';p.action='CHECK';}
  else if(action==='call'){if(toCall<=0)return {ok:false,error:'Nothing to call.'};playerPut(room,p,toCall);p.lastAction='CALL';p.action='CALL';}
  else if(action==='allin'){const before=room.poker.highestBet;const put=p.chips;playerPut(room,p,put);if(p.bet>before){room.poker.minimumRaise=Math.max(1,p.bet-before);room.poker.highestBet=p.bet;p.lastAction='ALL-IN';p.action='ALL-IN';room.players.forEach(x=>{if(x.id!==p.id&&x.lastAction==='CHECK')x.lastAction='';});}else{p.lastAction='ALL-IN';p.action='ALL-IN';}}
  else if(action==='raise'){raiseTo=Number(amount);if(!Number.isFinite(raiseTo))return {ok:false,error:'Invalid raise.'};const minTo=room.poker.highestBet+room.poker.minimumRaise;const maxTo=p.bet+p.chips;if(raiseTo<minTo)return {ok:false,error:`Minimum raise is ${minTo}.`};if(raiseTo>maxTo)return {ok:false,error:'Raise exceeds your chips.'};const diff=raiseTo-p.bet;playerPut(room,p,diff);room.poker.minimumRaise=raiseTo-room.poker.highestBet;room.poker.highestBet=raiseTo;p.lastAction='RAISE';p.action='RAISE';room.players.forEach(x=>{if(x.id!==p.id&&!x.folded&&!x.allIn)x.lastAction='';});}
  else return {ok:false,error:'Unknown action.'};
  if(onlyOne(room)){awardFoldWin(room);return {ok:true};}
  const next=nextPokerActor(room,room.players.indexOf(p)); if(next){room.turnPlayerId=next.id;startTurnTimer(room,()=>timeoutPoker(room));}
  else advancePoker(room);
  broadcast(room);emitPrivate(room);return {ok:true};
}
function timeoutPoker(room){ const p=room.players.find(x=>x.id===room.turnPlayerId);if(!p)return advancePoker(room);const toCall=requiredAmount(room,p);p.lastAction=toCall?'FOLD':'CHECK';p.action=p.lastAction;say(room,`${p.name} timed out and ${p.lastAction.toLowerCase()}s.`); if(toCall)p.folded=true; const next=nextPokerActor(room,room.players.indexOf(p)); if(next){room.turnPlayerId=next.id;startTurnTimer(room,()=>timeoutPoker(room));broadcast(room);emitPrivate(room);}else advancePoker(room); }

// Blackjack
function bjReset(room){ room.blackjack={phase:'BETTING',deck:deck(),hands:{},dealer:[],dealerHoleHidden:true,bettingEndsAt:Date.now()+12000}; room.players.forEach(p=>{room.blackjack.hands[p.id]={bet:0,cards:[],done:false,doubled:false,result:null,payout:0};}); }
function bjValue(cards){let total=0,aces=0;cards.forEach(c=>{if(c.r==='A'){aces++;total+=11}else total+=Math.min(10,rankVal(c.r));});while(total>21&&aces){total-=10;aces--;}return {total,soft:aces>0};}
function bjPublic(room){return {phase:room.blackjack.phase,dealer:room.blackjack.dealer.map((c,i)=>i===1&&room.blackjack.dealerHoleHidden?'??':cardText(c)),hands:Object.fromEntries(Object.entries(room.blackjack.hands).map(([id,h])=>[id,{bet:h.bet,cards:h.cards.map(cardText),done:h.done,doubled:h.doubled,result:h.result,payout:h.payout,total:bjValue(h.cards).total}]))};}
function bjStart(room){clearTimer(room);room.game='blackjack';room.status='IN_GAME';bjReset(room);say(room,'Blackjack betting is open.');broadcast(room);setTimeout(()=>{const bettors=room.players.filter(p=>p.chips>0&&p.connected&&room.blackjack.hands[p.id]?.bet>0);if(!bettors.length){room.blackjack.phase='BETTING';broadcast(room);return;}room.blackjack.phase='PLAYING';bettors.forEach(p=>{room.blackjack.hands[p.id].cards=[room.blackjack.deck.pop(),room.blackjack.deck.pop()];});room.blackjack.dealer=[room.blackjack.deck.pop(),room.blackjack.deck.pop()];room.blackjack.dealerHoleHidden=true;bjAdvance(room);},12000);}
function bjAllDone(room){return room.players.filter(p=>room.blackjack.hands[p.id]?.bet>0).every(p=>room.blackjack.hands[p.id].done||bjValue(room.blackjack.hands[p.id].cards).total>21);}
function bjAdvance(room){if(!bjAllDone(room)){const p=room.players.find(p=>{const h=room.blackjack.hands[p.id];return h?.bet>0&&!h.done&&bjValue(h.cards).total<=21;});if(p){room.turnPlayerId=p.id;startTurnTimer(room,()=>{room.blackjack.hands[p.id].done=true;bjAdvance(room);});}broadcast(room);return;}room.turnPlayerId=null;clearTimer(room);room.blackjack.dealerHoleHidden=false;while(bjValue(room.blackjack.dealer).total<17)room.blackjack.dealer.push(room.blackjack.deck.pop());const dv=bjValue(room.blackjack.dealer);room.players.forEach(p=>{const h=room.blackjack.hands[p.id];if(!h||!h.bet)return;const v=bjValue(h.cards).total; if(v>21){h.result='BUST';h.payout=0;}else if(v===21&&h.cards.length===2&&dv.total!==21){h.result='BLACKJACK';h.payout=Math.floor(h.bet*2.5);p.chips+=h.payout;}else if(dv.total>21||v>dv.total){h.result='WIN';h.payout=h.bet*2;p.chips+=h.payout;}else if(v===dv.total){h.result='PUSH';h.payout=h.bet;p.chips+=h.payout;}else{h.result='LOSE';h.payout=0;}});room.blackjack.phase='RESULT';say(room,'Blackjack round complete.');broadcast(room);setTimeout(()=>{room.status='WAITING';room.game='poker';broadcast(room);},3500);}
function bjAction(room,p,action){const h=room.blackjack.hands[p.id];if(room.blackjack.phase!=='PLAYING'||room.turnPlayerId!==p.id||!h||h.done)return {ok:false,error:'Not your blackjack turn.'};if(action==='hit'){h.cards.push(room.blackjack.deck.pop());if(bjValue(h.cards).total>=21)h.done=true;}else if(action==='stand'){h.done=true;}else if(action==='double'){if(h.cards.length!==2||h.doubled||p.chips<h.bet)return {ok:false,error:'Double down is not available.'};p.chips-=h.bet;h.bet*=2;h.doubled=true;h.cards.push(room.blackjack.deck.pop());h.done=true;}else return {ok:false,error:'Unknown blackjack action.'};bjAdvance(room);broadcast(room);return {ok:true};}

// Roulette
function roulettePublic(room){return {phase:room.roulette.phase,bets:room.roulette.bets,result:room.roulette.result,spinEndsAt:room.roulette.spinEndsAt};}
const redNums=new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
function rouletteBet(room,p,type,value,amount){if(room.game!=='roulette'||room.roulette.phase!=='BETTING')return {ok:false,error:'Betting is closed.'};amount=Number(amount);if(!Number.isFinite(amount)||amount<=0||amount>p.chips)return {ok:false,error:'Invalid wager.'};const key=`${p.id}:${type}:${value}`;p.chips-=amount;room.roulette.bets[key]=(room.roulette.bets[key]||0)+amount;broadcast(room);return {ok:true};}
function rouletteStart(room){room.game='roulette';room.status='IN_GAME';room.roulette={phase:'BETTING',bets:{},result:null,spinEndsAt:null};say(room,'Roulette betting is open.');broadcast(room);}
function rouletteSpin(room){if(room.roulette.phase!=='BETTING')return; if(!Object.keys(room.roulette.bets).length){say(room,'No roulette bets placed.');return;}room.roulette.phase='SPINNING';room.roulette.spinEndsAt=Date.now()+5000;broadcast(room);setTimeout(()=>{const result=crypto.randomInt(0,38);const label=result===37?'00':String(result);room.roulette.result=label;room.roulette.phase='RESULT';Object.entries(room.roulette.bets).forEach(([key,amt])=>{const [,id,type,value]=key.split(':');const p=room.players.find(x=>x.id===id);if(!p)return;let win=false,mult=0;if(type==='straight'&&value===label){win=true;mult=35}else if(type==='red'&&redNums.has(result)){win=true;mult=1}else if(type==='black'&&result>0&&result<37&&!redNums.has(result)){win=true;mult=1}else if(type==='odd'&&result>0&&result<37&&result%2===1){win=true;mult=1}else if(type==='even'&&result>0&&result<37&&result%2===0){win=true;mult=1}else if(type==='low'&&result>=1&&result<=18){win=true;mult=1}else if(type==='high'&&result>=19&&result<=36){win=true;mult=1}else if(type==='dozen1'&&result>=1&&result<=12){win=true;mult=2}else if(type==='dozen2'&&result>=13&&result<=24){win=true;mult=2}else if(type==='dozen3'&&result>=25&&result<=36){win=true;mult=2}if(win)p.chips+=amt*(mult+1);});say(room,`Roulette result: ${label}`);broadcast(room);setTimeout(()=>{room.roulette.phase='BETTING';room.roulette.bets={};room.roulette.result=null;broadcast(room);},4000);},5000);}

// Chess
function chessPublic(room){const g=room.chess.game;return {fen:g?g.fen():null,turn:g?g.turn():null,history:g?g.history():[],white:room.chess.white,black:room.chess.black,wagerPot:room.chess.wagerPot,entryBet:room.chess.entryBet,winners:room.chess.winners};}
function chessStart(room,entryBet=0){room.game='chess';room.status='IN_GAME';room.chess={game:new Chess(),entryBet:Number(entryBet)||0,white:null,black:null,wagerPot:0,winners:[]};const eligible=room.players.filter(p=>p.connected&&p.chips>=(Number(entryBet)||0));if(eligible[0])room.chess.white=eligible[0].id;if(eligible[1])room.chess.black=eligible[1].id;if(entryBet>0){eligible.slice(0,2).forEach(p=>{p.chips-=entryBet;room.chess.wagerPot+=entryBet;});}say(room,'Chess game ready.');broadcast(room);}
function chessMove(room,p,move){const g=room.chess.game;if(!g)return {ok:false,error:'Chess has not started.'};if((g.turn()==='w'?room.chess.white:room.chess.black)!==p.id)return {ok:false,error:'It is not your turn.'};try{g.move(move); }catch(e){return {ok:false,error:'Illegal chess move.'};}if(g.isGameOver()){let winner=null;if(g.isCheckmate())winner=g.turn()==='w'?room.chess.black:room.chess.white;room.chess.winners=winner?[{id:winner,amount:room.chess.wagerPot}]:[];if(winner)room.players.find(x=>x.id===winner).chips+=room.chess.wagerPot;room.chess.wagerPot=0;say(room,g.isCheckmate()?`${room.players.find(x=>x.id===winner)?.name} wins by checkmate.`:'Chess game drawn.');}broadcast(room);return {ok:true};}

function addBot(room,type){if(room.players.length>=MAX_PLAYERS)return {ok:false,error:'Room is full.'};if(!BOT_TYPES[type])return {ok:false,error:'Unknown bot.'};const p=makePlayer({id:uid('bot'),name:type,bot:true,botType:type});p.connected=true;p.host=false;room.players.push(p);say(room,`${type} joined as a bot.`);broadcast(room);return {ok:true};}
function botTick(room){if(!rooms.has(room.code))return;if(room.game==='poker'&&['PREFLOP','FLOP','TURN','RIVER'].includes(room.poker.phase)&&room.turnPlayerId){const p=room.players.find(x=>x.id===room.turnPlayerId);if(p?.bot){setTimeout(()=>{if(room.turnPlayerId!==p.id)return;const cfg=BOT_TYPES[p.botType]||BOT_TYPES.River;const toCall=requiredAmount(room,p);const strength=estimateStrength(p,room);let action='call';if(strength<cfg.tight*.25&&toCall>0&&Math.random()>cfg.bluff)action='fold';else if(toCall===0)action=Math.random()<cfg.aggression*.5?'raise':'check';else if(Math.random()<cfg.aggression&&strength>.35){const min=room.poker.highestBet+room.poker.minimumRaise;const max=p.bet+p.chips;if(max>=min)action='raise';}if(action==='raise'){const min=room.poker.highestBet+room.poker.minimumRaise;const max=p.bet+p.chips;const amt=Math.min(max,Math.max(min,room.poker.highestBet+room.poker.minimumRaise));p.socketId=null;p.connected=true;p.socketId='BOT';pokerAction(room,p,'raise',amt);p.socketId=null;}else pokerAction(room,p,action);},BOT_DELAY+crypto.randomInt(700));}}
  if(room.game==='blackjack'&&room.turnPlayerId){const p=room.players.find(x=>x.id===room.turnPlayerId);if(p?.bot)setTimeout(()=>{const h=room.blackjack.hands[p.id];const v=bjValue(h.cards).total;bjAction(room,p,v<16?'hit':'stand');},BOT_DELAY);}
}
function estimateStrength(p,room){const cards=[...p.hole,...room.poker.community];if(!p.hole.length)return .1;const e=room.poker.community.length?eval7(cards):([0,Math.max(rankVal(p.hole[0].r),rankVal(p.hole[1].r))]);return Math.min(1,(e[0]*.1+(e[1]||5)/20));}
setInterval(()=>rooms.forEach(botTick),500);

io.on('connection',socket=>{
  socket.on('createRoom',({name}={},ack)=>{try{const p=makePlayer({id:uid(),name:cleanName(name),socketId:socket.id});const code=uniqueRoomCode();const room=newRoom(code,p);rooms.set(code,room);socket.join(code);socket.data.room=code;socket.data.player=p.id;say(room,`${p.name} created the room.`);socket.emit('joined',{code,reconnectToken:p.reconnectToken});broadcast(room);emitPrivate(room);ack?.({ok:true,code,reconnectToken:p.reconnectToken});}catch(e){ack?.({ok:false,error:'Could not create room.'});}});
  socket.on('joinRoom',({code,name,reconnectToken}={},ack)=>{code=String(code||'').trim().toUpperCase();const room=rooms.get(code);if(!room)return ack?.({ok:false,error:'Room does not exist.'});if(room.players.length>=MAX_PLAYERS)return ack?.({ok:false,error:'Room is full.'});let p=reconnectToken&&room.players.find(x=>x.reconnectToken===reconnectToken);if(p){p.socketId=socket.id;p.connected=true;p.disconnectedAt=null;}else{p=makePlayer({id:uid(),name:cleanName(name),socketId:socket.id});room.players.push(p);say(room,`${p.name} joined the room.`);}socket.join(code);socket.data.room=code;socket.data.player=p.id;ack?.({ok:true,code,reconnectToken:p.reconnectToken});broadcast(room);emitPrivate(room);});
  socket.on('resumeRoom',({code,reconnectToken}={},ack)=>{const room=rooms.get(String(code||'').toUpperCase());const p=room?.players.find(x=>x.reconnectToken===reconnectToken);if(!room||!p)return ack?.({ok:false,error:'Reconnection token is invalid.'});p.socketId=socket.id;p.connected=true;p.disconnectedAt=null;socket.join(room.code);socket.data.room=room.code;socket.data.player=p.id;ack?.({ok:true});broadcast(room);emitPrivate(room);});
  socket.on('setGame',({game}={},ack)=>{const room=rooms.get(socket.data.room),p=room?.players.find(x=>x.id===socket.data.player);if(!room||!p||room.hostId!==p.id||room.status==='IN_GAME')return ack?.({ok:false,error:'Only the host can choose a lobby game.'});if(!['poker','blackjack','roulette','chess'].includes(game))return ack?.({ok:false,error:'Invalid game.'});room.game=game;room.poker.phase=game==='poker'?'LOBBY':room.poker.phase;broadcast(room);ack?.({ok:true});});
  socket.on('startGame',({entryBet}={},ack)=>{const room=rooms.get(socket.data.room),p=room?.players.find(x=>x.id===socket.data.player);if(!room||!p||room.hostId!==p.id)return ack?.({ok:false,error:'Only the host can start.'});if(room.game==='poker'){if(room.players.filter(x=>x.connected&&x.chips>0).length<2)return ack?.({ok:false,error:'Need at least two players.'});startPokerHand(room);}else if(room.game==='blackjack')bjStart(room);else if(room.game==='roulette')rouletteStart(room);else chessStart(room,entryBet);ack?.({ok:true});});
  socket.on('pokerAction',({action,amount}={},ack)=>{const room=rooms.get(socket.data.room),p=room?.players.find(x=>x.id===socket.data.player);const r=room&&p?pokerAction(room,p,action,amount):{ok:false,error:'Not in a room.'};ack?.(r);});
  socket.on('addBot',({type}={},ack)=>{const room=rooms.get(socket.data.room),p=room?.players.find(x=>x.id===socket.data.player);if(!room||!p||room.hostId!==p.id)return ack?.({ok:false,error:'Only the host can add bots.'});ack?.(addBot(room,type));});
  socket.on('removeBot',({id}={},ack)=>{const room=rooms.get(socket.data.room),p=room?.players.find(x=>x.id===socket.data.player);if(!room||!p||room.hostId!==p.id)return ack?.({ok:false,error:'Only the host can remove bots.'});const i=room.players.findIndex(x=>x.id===id&&x.bot);if(i<0)return ack?.({ok:false,error:'Bot not found.'});room.players.splice(i,1);broadcast(room);ack?.({ok:true});});
  socket.on('chat',({text}={},ack)=>{const room=rooms.get(socket.data.room),p=room?.players.find(x=>x.id===socket.data.player);if(!room||!p)return;const t=cleanChat(text);if(!t)return;room.chat.push({id:uid('m'),name:p.name,text:t,system:false,at:Date.now()});room.chat=room.chat.slice(-100);broadcast(room);ack?.({ok:true});});
  socket.on('blackjackBet',({amount}={},ack)=>{const room=rooms.get(socket.data.room),p=room?.players.find(x=>x.id===socket.data.player);if(!room||!p||room.game!=='blackjack'||room.blackjack.phase!=='BETTING')return ack?.({ok:false,error:'Betting is closed.'});amount=Number(amount);if(amount<1||amount>p.chips)return ack?.({ok:false,error:'Invalid bet.'});p.chips-=amount;room.blackjack.hands[p.id].bet+=amount;broadcast(room);ack?.({ok:true});});
  socket.on('blackjackAction',({action}={},ack)=>{const room=rooms.get(socket.data.room),p=room?.players.find(x=>x.id===socket.data.player);ack?.(room&&p?bjAction(room,p,action):{ok:false,error:'Not in a room.'});});
  socket.on('rouletteBet',({type,value,amount}={},ack)=>{const room=rooms.get(socket.data.room),p=room?.players.find(x=>x.id===socket.data.player);ack?.(room&&p?rouletteBet(room,p,type,value,amount):{ok:false,error:'Not in a room.'});});
  socket.on('rouletteSpin',(_,ack)=>{const room=rooms.get(socket.data.room),p=room?.players.find(x=>x.id===socket.data.player);if(!room||!p||room.hostId!==p.id)return ack?.({ok:false,error:'Only the host can spin.'});rouletteSpin(room);ack?.({ok:true});});
  socket.on('chessMove',({move}={},ack)=>{const room=rooms.get(socket.data.room),p=room?.players.find(x=>x.id===socket.data.player);ack?.(room&&p?chessMove(room,p,move):{ok:false,error:'Not in a room.'});});
  socket.on('disconnect',()=>{const room=rooms.get(socket.data.room);const p=room?.players.find(x=>x.id===socket.data.player);if(!room||!p)return;p.connected=false;p.socketId=null;p.disconnectedAt=Date.now();if(room.hostId===p.id){const next=room.players.find(x=>x.connected);if(next){room.hostId=next.id;room.players.forEach(x=>x.host=x.id===next.id);say(room,`${next.name} is now host.`);}}if(room.game==='poker'&&room.turnPlayerId===p.id&&['PREFLOP','FLOP','TURN','RIVER'].includes(room.poker.phase)){p.connected=true;setTimeout(()=>{if(!rooms.has(room.code))return;p.connected=false;if(room.turnPlayerId===p.id)timeoutPoker(room);broadcast(room);},1000);}broadcast(room);});
});

server.listen(PORT,'0.0.0.0',()=>console.log(`Poker Hunk server listening on ${PORT}`));
