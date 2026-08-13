/* Production frontend: the browser sends intents; the server owns game state. */
const SOCKET_URL = window.POKER_SERVER_URL || "https://gamb-eu6t.onrender.com";
const socket = io(SOCKET_URL, { transports:["websocket","polling"], reconnection:true, reconnectionAttempts:Infinity });
let roomCode='', me=null, state=null, selectedChess=null, toastTimer=null;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function showScreen(id){$$('.screen').forEach(x=>x.classList.remove('active'));$('#'+id).classList.add('active');}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2500);}
function openModal(html){$('#modalContent').innerHTML=html;$('#modal').classList.remove('hidden');}
function closeModal(){$('#modal').classList.add('hidden');}
function ackCall(event,payload){return new Promise(resolve=>{let done=false;const finish=r=>{if(done)return;done=true;clearTimeout(t);resolve(r||{});};const t=setTimeout(()=>finish({ok:false,error:'Server did not respond. Check the connection.'}),7000);socket.emit(event,payload,finish);});}
function saveSession(){if(roomCode&&me?.reconnectToken)localStorage.setItem('ph_session',JSON.stringify({code:roomCode,reconnectToken:me.reconnectToken,name:me.name}));}
function renderConnection(ok){$('#connection').classList.toggle('online',ok);$('#connection').innerHTML=`<i></i> ${ok?'Connected':'Disconnected'}`;}
socket.on('connect',async()=>{renderConnection(true);const s=JSON.parse(localStorage.getItem('ph_session')||'null');if(s){const r=await ackCall('resumeRoom',{code:s.code,reconnectToken:s.reconnectToken});if(r.ok){roomCode=s.code;toast('Reconnected to your room.');}}});
socket.on('disconnect',()=>renderConnection(false));
socket.on('connect_error',()=>renderConnection(false));
socket.on('joined',d=>{roomCode=d.code;me={reconnectToken:d.reconnectToken};saveSession();});
socket.on('state',s=>{state=s;const local=s.players.find(p=>p.id===s.me?.id)||s.players.find(p=>p.id===me?.id);if(local){me={...me,...local};}if(s.code){roomCode=s.code;$('#roomCode').textContent=s.code;$('#gameRoom').textContent=s.code;saveSession();}renderState();});
function renderState(){if(!state)return;$('#playerCount').textContent=state.players.length;renderPlayers();renderChat();if(state.status==='IN_GAME'){showScreen('game');renderGame();}else{showScreen('lobby');renderLobby();}}
function renderLobby(){$$('.game-tab').forEach(b=>b.classList.toggle('active',b.dataset.game===state.game));$('#startBtn').disabled=state.players.find(p=>p.id===state.me?.id)?.host!==true;}
function renderPlayers(){const html=state.players.map(p=>`<div class="player-row"><div class="avatar">${esc(p.name.slice(0,2).toUpperCase())}</div><div class="player-meta"><b>${esc(p.name)} ${p.host?'★':''}</b><span>${p.bot?'BOT · '+esc(p.botType):(p.connected?'CONNECTED':'DISCONNECTED')}</span></div><div class="chips">${p.chips.toLocaleString()}</div></div>`).join('');$('#playersList').innerHTML=html;$('#gamePlayers').innerHTML=state.players.map(p=>`<div class="game-player ${state.turnPlayerId===p.id?'active':''}"><div class="gp-top"><b>${esc(p.name)}</b><span>${p.bot?'BOT':'HUMAN'}</span></div><div class="gp-sub">${p.chips.toLocaleString()} chips · ${esc(p.action||p.lastAction||'')}</div></div>`).join('');}
function renderChat(){const logs=[state.chat||[]];const make=a=>a.map(m=>`<div class="chat-line ${m.system?'system':''}">${m.system?'':`<b>${esc(m.name)}:</b>`}${esc(m.text)}</div>`).join('');$('#chatLog').innerHTML=make(logs[0]);$('#gameChat').innerHTML=make(logs[0]);['#chatLog','#gameChat'].forEach(s=>{const x=$(s);x.scrollTop=x.scrollHeight;});}
function card(c){if(c==='??')return '<div class="card back">GH</div>';const red=/[♥♦]/.test(c);return `<div class="card ${red?'red':''}">${esc(c)}</div>`;}
function renderGame(){const game=state.game;$('#pokerBoard').classList.toggle('hidden',game!=='poker');$('#blackjackBoard').classList.toggle('hidden',game!=='blackjack');$('#rouletteBoard').classList.toggle('hidden',game!=='roulette');$('#chessBoard').classList.toggle('hidden',game!=='chess');$('#pokerActions').classList.toggle('hidden',game!=='poker');$('#bjActions').classList.toggle('hidden',game!=='blackjack');if(game==='poker')renderPoker();if(game==='blackjack')renderBJ();if(game==='roulette')renderRoulette();if(game==='chess')renderChess();}
function seatPos(i,n){const angle=(-90+(360/n)*i)*Math.PI/180;return {left:(50+43*Math.cos(angle)),top:(50+43*Math.sin(angle))};}
function renderPoker(){const p=state.poker||{phase:state.phase,community:state.community,pot:state.pot,highestBet:state.highestBet,minimumRaise:state.minimumRaise,winners:state.winners};$('#pot').innerHTML=`POT <b>${(p.pot||0).toLocaleString()}</b>`;$('#community').innerHTML=(p.community||[]).map(card).join('');const seats=$('#seats');const ps=state.players;seats.innerHTML=ps.map((x,i)=>{const pos=seatPos(i,Math.max(ps.length,2));const mine=state.me?.id===x.id;const myHole=mine&&state.me?.hole?`<div class="hole">${state.me.hole.map(card).join('')}</div>`:'';return `<div class="seat ${state.turnPlayerId===x.id?'active':''}" style="left:${pos.left}%;top:${pos.top}%;transform:translate(-50%,-50%)"><div class="seat-name">${esc(x.name)} ${x.bot?'· BOT':''}</div><div class="seat-chips">${x.chips.toLocaleString()} · bet ${x.bet}</div><div class="seat-action">${esc(x.lastAction||'')}</div>${myHole}</div>`;}).join('');const winner=state.poker.winners?.length?state.poker.winners.map(w=>{const p=ps.find(x=>x.id===w.id);return `${esc(p?.name||'Player')} +${w.amount.toLocaleString()} · ${esc(w.hand)}`}).join(' • '):'';$('#winner').innerHTML=winner;const myTurn=state.turnPlayerId===state.me?.id;$('#turnBadge').textContent=myTurn?'YOUR TURN':(state.turnPlayerId?`${esc(ps.find(x=>x.id===state.turnPlayerId)?.name||'Player')}'S TURN`:p.phase||'WAITING');renderTimer();}
function renderTimer(){const el=$('#timer');if(!state.turnEndsAt){el.textContent='—';return;}const update=()=>{const sec=Math.max(0,Math.ceil((state.turnEndsAt-Date.now())/1000));el.textContent=sec+'s';if(sec>0)requestAnimationFrame(update);};update();}
function renderBJ(){const b=state.blackjack||{};$('#dealerCards').innerHTML=(b.dealer||[]).map(card).join('');$('#bjHands').innerHTML=state.players.map(p=>{const h=b.hands?.[p.id];if(!h)return '';return `<div class="bj-hand"><b>${esc(p.name)}</b><div class="cards">${h.cards.map(card).join('')}</div><div>${h.total} · bet ${h.bet}</div><div class="eyebrow">${esc(h.result||(!h.done?'YOUR HAND':''))}</div></div>`}).join('');}
function renderRoulette(){const r=state.roulette||{};$('#rouletteResult').textContent=r.result?`RESULT: ${r.result}`:r.phase==='SPINNING'?'SPINNING…':'PLACE YOUR BETS';$('#wheel').classList.toggle('spinning',r.phase==='SPINNING');}
const pieces={p:'♟',r:'♜',n:'♞',b:'♝',q:'♛',k:'♚',P:'♙',R:'♖',N:'♘',B:'♗',Q:'♕',K:'♔'};
function renderChess(){const c=state.chess||{};$('#chessStatus').textContent=c.winners?.length?'GAME OVER':`Turn: ${c.turn==='w'?'White':'Black'}`;if(!c.fen)return;const board=c.fen.split(' ')[0];const rows=[];for(const row of board.split('/')){const out=[];for(const ch of row){if(/\d/.test(ch))for(let i=0;i<+ch;i++)out.push(null);else out.push(ch);}rows.push(out);}$('#chessGrid').innerHTML=rows.flatMap((row,r)=>row.map((piece,col)=>{const sq=String.fromCharCode(97+col)+(8-r);return `<div class="sq ${(r+col)%2?'dark':'light'} ${selectedChess===sq?'sel':''}" data-sq="${sq}">${piece?pieces[piece]:''}</div>`;})).join('');$$('#chessGrid .sq').forEach(x=>x.onclick=()=>chessClick(x.dataset.sq));}
let chessFenPieces=()=>state?.chess?.fen?.split(' ')[0];
function chessClick(sq){if(!selectedChess){selectedChess=sq;renderChess();return;}const from=selectedChess;selectedChess=null;const piece=prompt('Promotion piece (q/r/b/n) or leave blank:','');const move={from,to:sq};if(piece)move.promotion=piece.toLowerCase();ackCall('chessMove',{move}).then(r=>{if(!r.ok)toast(r.error||'Illegal move');});renderChess();}
const savedName=()=>localStorage.getItem('ph_name')||'';
function rememberName(name){const n=String(name||'').trim().slice(0,18);if(n)localStorage.setItem('ph_name',n);return n;}
function nameModal(mode,code=''){
  const join=mode==='join';
  openModal(`<span class="eyebrow">${join?'JOIN ROOM':'CREATE ROOM'}</span><h2>${join?'Enter your seat':'Choose your player name'}</h2><p class="modal-sub">Your name is saved on this device so you won't have to type it every time.</p>${join?'<label class="modal-label">ROOM CODE</label><input id="joinCode" class="modal-input" maxlength="6" placeholder="ABC123" autocomplete="off">':''}<label class="modal-label">YOUR NAME</label><input id="playerName" class="modal-input" maxlength="18" placeholder="Your name" value="${esc(savedName())}" autocomplete="nickname"><button class="btn primary full" id="${join?'doJoin':'doCreate'}">${join?'JOIN ROOM':'CREATE ROOM'}</button>`);
  setTimeout(()=>$('#playerName')?.focus(),30);
}
$('#createBtn').onclick=()=>nameModal('create');
$('#joinBtn').onclick=()=>nameModal('join');
$('#modalClose').onclick=closeModal;
$('#modal').addEventListener('click',e=>{if(e.target.id==='modal')closeModal();});
document.addEventListener('click',e=>{
  if(e.target.id==='doCreate'){const name=rememberName($('#playerName')?.value);if(!name)return toast('Please enter your name.');ackCall('createRoom',{name}).then(r=>{if(!r.ok)toast(r.error||'Could not create room');else closeModal();});}
  if(e.target.id==='doJoin'){const code=$('#joinCode').value.trim().toUpperCase(),name=rememberName($('#playerName')?.value);if(!name)return toast('Please enter your name.');if(code.length<5)return toast('Enter a valid room code.');ackCall('joinRoom',{code,name}).then(r=>{if(!r.ok)toast(r.error);else closeModal();});}
  if(e.target.id==='doLeave'){leaveRoom();}
});
$$('.game-tab').forEach(b=>b.onclick=()=>ackCall('setGame',{game:b.dataset.game}).then(r=>{if(!r.ok)toast(r.error);}));
$('#startBtn').onclick=async()=>{const b=$('#startBtn');b.disabled=true;b.textContent='STARTING…';const r=await ackCall('startGame',{});if(!r.ok)toast(r.error||'Could not start game.');else toast('Game started.');setTimeout(()=>{b.textContent='START GAME';if(state?.status!=='IN_GAME')renderLobby();},350);};
$('#copyRoom').onclick=async()=>{await navigator.clipboard?.writeText(roomCode);toast('Room code copied.');};
$('#addBotBtn').onclick=()=>openModal(`<span class="eyebrow">SERVER-SIDE BOTS</span><h2>Choose a personality</h2><div class="bot-grid">${['Ace','Shark','Bluff','Lucky','Dealer','River','Pocket','Wildcard'].map(x=>`<button class="bot-option" data-bot="${x}"><b>${x}</b><span>${({Ace:'Tight · Conservative',Shark:'Aggressive · Pressure',Bluff:'High bluff · Unpredictable',Lucky:'Loose · Calls often',Dealer:'Conservative · Low variance',River:'Balanced',Pocket:'Tight-aggressive',Wildcard:'Highly unpredictable'})[x]}</span></button>`).join('')}</div>`);
document.addEventListener('click',e=>{const b=e.target.closest('[data-bot]');if(b)ackCall('addBot',{type:b.dataset.bot}).then(r=>{if(!r.ok)toast(r.error);else closeModal();});});
$$('[data-action]').forEach(b=>b.onclick=()=>{const action=b.dataset.action;let amount; if(action==='raise')amount=Number($('#raiseAmount').value);ackCall('pokerAction',{action,amount}).then(r=>{if(!r.ok)toast(r.error);});});
$$('[data-bj]').forEach(b=>b.onclick=()=>ackCall('blackjackAction',{action:b.dataset.bj}).then(r=>{if(!r.ok)toast(r.error);}));
$('#bjBetBtn').onclick=()=>ackCall('blackjackBet',{amount:Number($('#bjBet').value)}).then(r=>{if(!r.ok)toast(r.error);});
$('#spinBtn').onclick=()=>ackCall('rouletteSpin',{}).then(r=>{if(!r.ok)toast(r.error);});
$$('.bet-chip').forEach(b=>b.onclick=()=>{const amount=Number(prompt('Bet amount:','25'));if(amount>0)ackCall('rouletteBet',{type:b.dataset.type,value:'',amount}).then(r=>{if(!r.ok)toast(r.error);});});
async function leaveRoom(){if(!roomCode)return;const r=await ackCall('leaveRoom',{});if(!r.ok){toast(r.error||'Could not leave room.');return;}localStorage.removeItem('ph_session');roomCode='';state=null;me=null;showScreen('home');toast('You left the room.');}
$('#leaveBtn').onclick=leaveRoom;$('#leaveLobbyBtn').onclick=leaveRoom;
function chat(form,input){$(form).onsubmit=e=>{e.preventDefault();const v=$(input).value.trim();if(v)ackCall('chat',{text:v});$(input).value='';};}chat('#chatForm','#chatInput');chat('#gameChatForm','#gameChatInput');
setInterval(()=>{if(state?.turnPlayerId&&state.game==='poker')renderTimer();},500);

document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});
