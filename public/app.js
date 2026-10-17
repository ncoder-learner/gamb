const IS_FEATURE_PREVIEW = location.hostname.includes('gamb-git-feature-first-person-po-52cdba') || (location.hostname.startsWith('gamb-') && location.hostname.endsWith('-neal-singhal-s-projects.vercel.app'));
const SOCKET_URL = window.POKER_SERVER_URL || (IS_FEATURE_PREVIEW ? 'https://gamb-feature-preview.onrender.com' : 'https://gamb-eu6t.onrender.com');
const API_URL = window.POKER_SERVER_URL || SOCKET_URL;
const socket = window.io ? io(SOCKET_URL,{auth:{accountToken:localStorage.getItem('gh_account_token')||''},transports:['websocket','polling'],reconnection:true,reconnectionAttempts:Infinity}) : {connected:false,auth:{},on(){return this},emit(event,payload,cb){if(typeof cb==='function')cb({ok:false,error:'Realtime server unavailable. Refresh the page and try again.'});return this},disconnect(){return this},connect(){return this}};
function syncSocketAuth(){socket.auth={accountToken};if(socket.connected)socket.disconnect().connect();}
let state=null,roomCode='',me=null,toastTimer=null,selectedChess=null,chessBoardFlipped=null,account=null,pendingJoinRequest=null,accountToken=localStorage.getItem('gh_account_token')||'',authMode='register';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const savedName=()=>localStorage.getItem('gh_name')||'';
function rememberName(v){v=String(v||'').trim().slice(0,18);if(v)localStorage.setItem('gh_name',v);return v}
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2800)}
function showScreen(id){if(id!=='game')document.body.classList.remove('compact-card-game');$$('.screen').forEach(x=>x.classList.remove('active'));$('#'+id).classList.add('active')}
function openModal(html){$('#modalContent').innerHTML=html;$('#modal').classList.remove('hidden')}
function closeModal(){$('#modal').classList.add('hidden')}
function call(event,payload){return new Promise(resolve=>{let done=false;const finish=r=>{if(done)return;done=true;clearTimeout(timer);resolve(r||{})};const timer=setTimeout(()=>finish({ok:false,error:'The server did not respond. Check your connection and try again.'}),8000);try{socket.emit(event,payload||{},finish)}catch(e){finish({ok:false,error:e.message||'Connection failed.'})}})}
async function api(path,opts={}){const headers={'Content-Type':'application/json',...(opts.headers||{})};if(accountToken)headers.Authorization='Bearer '+accountToken;const r=await fetch(API_URL+path,{...opts,headers});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Request failed');return j}
async function loadAccount(){if(!accountToken){renderAuth();return}try{const j=await api('/api/me');account=j.account;renderAccount();showScreen(state?'lobby':'home')}catch{localStorage.removeItem('gh_account_token');accountToken='';renderAuth()}}
function renderAccount(){if($('#vaultTokens'))$('#vaultTokens').textContent=`${(account?.tokens||0).toLocaleString()} 🪙`}
function renderAuth(){showScreen('auth');const host=$('#authForm');host.innerHTML=`<label class="modal-label">USERNAME</label><input id="authName" class="modal-input" maxlength=18 placeholder="3–18 characters"><label class="modal-label">PASSWORD</label><input id="authPassword" class="modal-input" type="password" minlength=6 placeholder="At least 6 characters"><button class="btn primary full" id="authSubmit">${authMode==='register'?'CREATE ACCOUNT':'SIGN IN'}</button><p class="auth-note">Tokens are virtual and have no cash value.</p>`;$$('.auth-tab').forEach(b=>b.classList.toggle('active',b.dataset.auth===authMode))}
async function submitAuth(){try{const j=await api('/api/'+(authMode==='register'?'register':'login'),{method:'POST',body:JSON.stringify({name:$('#authName').value,password:$('#authPassword').value})});accountToken=j.token;localStorage.setItem('gh_account_token',accountToken);syncSocketAuth();account=j.account;rememberName(account.name);renderAccount();showScreen('home');toast(authMode==='register'?'Account created!':'Welcome back!')}catch(e){toast(e.message)}}
async function transfer(direction){if(!state?.code)return toast('Join a room first.');const raw=prompt(direction==='withdraw'?'How many tokens do you want to withdraw into this table?':'How many chips do you want to deposit into your vault?');const amount=Math.floor(Number(raw));if(!Number.isFinite(amount)||amount<1)return;try{const j=await api('/api/wallet/transfer',{method:'POST',body:JSON.stringify({direction,amount,room:state.code})});account=j.account;renderAccount();toast(direction==='withdraw'?`Withdrew ${amount} tokens.`:`Deposited ${amount} tokens.`)}catch(e){toast(e.message)}}
async function showRooms(){try{const j=await api('/api/rooms');const rows=j.rooms||[];const html=rows.length?rows.map(r=>'<div class="room-row"><div><b>'+esc(r.host)+'\'s '+esc(r.game)+' table</b><span>'+r.players+'/'+r.maxPlayers+' seats · '+esc(r.code)+'</span></div><button class="btn primary request-join" data-room="'+esc(r.code)+'">ASK TO JOIN</button></div>').join(''):'<p class="modal-sub">No open tables right now. Create one and you will appear here.</p>';if($('#roomsList'))$('#roomsList').innerHTML=html;openModal('<span class="eyebrow">LIVE TABLES</span><h2>Find players</h2><p class="modal-sub">Open tables you can ask to join right now.</p><div class="rooms-list modal-rooms">'+html+'</div>');$$('.request-join').forEach(btn=>btn.onclick=()=>requestJoin(btn.dataset.room))}catch(e){toast(e.message)}} async function requestJoin(code){const r=await call('requestJoin',{code,accountToken});if(!r.ok)toast(r.error);else{closeModal();toast('Join request sent to the host.')}} async function respondJoin(allow){const req=pendingJoinRequest;if(!req?.id)return closeModal();const r=await call('respondJoin',{requestId:req.id,allow});if(!r.ok)toast(r.error);else pendingJoinRequest=null;closeModal()} async function showProfile(){try{const j=await api('/api/profile');const p=j.profile;openModal(`<span class="eyebrow">PROFILE</span><h2>${esc(p.name)}</h2><p class="modal-sub">Member since ${new Date(p.createdAt).toLocaleDateString()}</p><div class="stats-grid"><div><b>${p.stats.gamesPlayed}</b><span>GAMES</span></div><div><b>${p.stats.wins}</b><span>WINS</span></div><div><b>${p.stats.winRate}%</b><span>WIN RATE</span></div><div><b>${p.stats.largestWin.toLocaleString()}</b><span>LARGEST WIN</span></div></div><label class="modal-label">USERNAME</label><input id="profileName" class="modal-input" value="${esc(p.name)}" maxlength="18"><button class="btn primary full" id="saveProfile">SAVE PROFILE</button><button class="btn full" id="logoutBtn">LOG OUT</button>`)}catch(e){toast(e.message)}} 
async function showHistory(){try{const j=await api('/api/history');openModal(`<span class="eyebrow">HISTORY</span><h2>Recent activity</h2><div class="history-list">${j.history.length?j.history.map(x=>`<div class="history-row"><b>${esc(x.type.replaceAll('_',' '))}</b><span>${x.game?esc(x.game):'Account'} · ${new Date(x.timestamp).toLocaleString()}</span><strong class="${x.amount>=0?'positive':'negative'}">${x.amount>=0?'+':''}${x.amount.toLocaleString()} 🪙</strong></div>`).join(''):'<p class="modal-sub">No activity yet.</p>'}</div>`)}catch(e){toast(e.message)}} 
async function showLeaderboard(){try{const j=await api('/api/leaderboard');openModal(`<span class="eyebrow">LEADERBOARD</span><h2>Largest wins</h2><div class="history-list">${j.rows.map((x,i)=>`<div class="history-row"><b>#${i+1} ${esc(x.name)}</b><span>${x.stats.gamesPlayed} games · ${x.stats.winRate}% win rate</span><strong>${x.stats.largestWin.toLocaleString()} 🪙</strong></div>`).join('')}</div>`)}catch(e){toast(e.message)}} 
async function claimDaily(){try{const j=await api('/api/daily',{method:'POST',body:'{}'});if(!j.ok)return toast(j.error);account=j.account;renderAccount();toast(`Daily reward: +${j.amount} tokens`)}catch(e){toast(e.message)}} 
async function quickGame(game){let choice='heads',target=50;if(game==='coinflip')choice=prompt('Choose heads or tails','heads')?.toLowerCase();else if(game==='dice')target=Number(prompt('Target from 2–99','50'));else if(game==='higherlower')choice=prompt('Choose higher or lower','higher')?.toLowerCase();const amount=Number(prompt('Bet amount','25'));if(!Number.isFinite(amount)||amount<1)return;const j=await new Promise(resolve=>socket.emit('quickGame',{game,choice,amount,target},resolve));if(!j.ok)return toast(j.error);account=j.account;renderAccount();toast(j.win?`You won +${j.net.toLocaleString()} tokens`:`You lost ${Math.abs(j.net).toLocaleString()} tokens`);if(game==='slots')openModal(`<span class="eyebrow">SLOTS</span><h2>${esc(j.result)}</h2><p class="modal-sub">${j.win?'WIN +'+j.net:'No win this spin.'}</p>`)} 
async function showShop(){try{const j=await api('/api/me');account=j.account;const shop=j.shop||[];openModal(`<span class="eyebrow">GAME HUNK SHOP</span><h2>Collectibles</h2><p class="modal-sub">Cosmetics only. Tokens have no real-world value.</p><div class="shop-grid">${shop.map(i=>{const owned=account.inventory.includes(i.id);return `<div class="shop-item rarity-${i.rarity.toLowerCase()}"><div class="shop-rarity">${i.rarity}</div><h3>${esc(i.name)}</h3><p>${esc(i.description)}</p><b>${i.price.toLocaleString()} 🪙</b><button class="btn ${owned?'':'gold'} shop-buy" data-shop="${i.id}" ${owned?'disabled':''}>${owned?'OWNED':'BUY'}</button>${owned?`<button class="btn shop-equip" data-equip="${i.id}">EQUIP</button>`:''}</div>`}).join('')}</div>`)}catch(e){toast(e.message)}}
async function buyItem(id){try{const j=await api('/api/shop/buy',{method:'POST',body:JSON.stringify({id})});account=j.account;toast('Item unlocked!');showShop()}catch(e){toast(e.message)}}
async function equipItem(id){try{const j=await api('/api/shop/equip',{method:'POST',body:JSON.stringify({id})});account=j.account;toast('Equipped!');showShop()}catch(e){toast(e.message)}}
function mePlayer(){return state?.players.find(p=>p.id===state.me?.id)||state?.players.find(p=>p.id===me?.id)}
function openDevTools(){const token=sessionStorage.getItem('gh_dev_token');if(token){openModal('<span class="eyebrow">DEVELOPER CONSOLE</span><h2>Maintenance tools</h2><p class="modal-sub">Destructive actions affect every player. Leaderboard reset preserves accounts and token balances; room reset ends every live table.</p><button class="btn danger full" id="devResetRooms">RESET ALL LIVE ROOMS</button><button class="btn danger full" id="devResetLeaderboard">RESET LEADERBOARD + HISTORY</button><button class="btn full" id="devLogout">SIGN OUT OF DEV TOOLS</button>');return}openModal('<span class="eyebrow">RESTRICTED ACCESS</span><h2>Developer sign in</h2><p class="modal-sub">Developer credentials are checked by the server. Configure DEV_USERNAME and DEV_PASSWORD in Render environment settings first.</p><label class="modal-label">USERNAME</label><input id="devUsername" class="modal-input" value="dev" autocomplete="username"><label class="modal-label">PASSWORD</label><input id="devPassword" class="modal-input" type="password" autocomplete="current-password"><button class="btn primary full" id="devLoginBtn">SIGN IN</button>')}
async function devAction(path,label){if(!confirm(label+'? This cannot be undone.'))return;try{const r=await fetch(API_URL+path,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+sessionStorage.getItem('gh_dev_token')},body:'{}'});const j=await r.json();if(!r.ok)throw Error(j.error||'Request failed');toast(j.message);if(path.endsWith('reset-rooms')){state=null;me=null;roomCode='';localStorage.removeItem('gh_session');showScreen('home')}openDevTools()}catch(e){toast(e.message)}}
function renderConnection(ok){$('#connection').classList.toggle('online',ok);$('#connection').innerHTML=`<i></i> ${ok?'Connected':'Disconnected'}`}
function saveSession(){if(roomCode&&me?.reconnectToken)localStorage.setItem('gh_session',JSON.stringify({code:roomCode,reconnectToken:me.reconnectToken}))}
socket.on('connect',async()=>{renderConnection(true);await loadAccount();const s=JSON.parse(localStorage.getItem('gh_session')||'null');if(s){const r=await call('resumeRoom',s);if(r.ok){roomCode=s.code;toast('Reconnected')}}});
socket.on('devRoomReset',x=>{state=null;me=null;roomCode='';localStorage.removeItem('gh_session');showScreen('home');toast(x?.message||'Live rooms were reset by a developer.')});
socket.on('disconnect',()=>renderConnection(false));socket.on('connect_error',()=>renderConnection(false));
socket.on('joinRequest',x=>{pendingJoinRequest=x;openModal('<span class="eyebrow">TABLE REQUEST</span><h2>'+esc(x.name)+' wants to join</h2><p class="modal-sub">'+esc(x.name)+' is asking to sit at table '+esc(x.code)+'.</p><div class="home-actions"><button class="btn primary" id="acceptJoin">LET THEM IN</button><button class="btn danger" id="declineJoin">DECLINE</button></div>');$('#acceptJoin').onclick=()=>respondJoin(true);$('#declineJoin').onclick=()=>respondJoin(false)});socket.on('joinRequestResult',async r=>{pendingJoinRequest=null;if(!r.ok){toast(r.error||'Join request declined.');return}roomCode=r.code||roomCode;me={...(me||{}),reconnectToken:r.reconnectToken||me?.reconnectToken};saveSession();const rebound=await call('resumeRoom',{code:roomCode,reconnectToken:me.reconnectToken});if(!rebound.ok){toast(rebound.error||'Accepted, but reconnect failed. Refresh and try again.');return}showScreen('lobby');toast('Accepted. You joined the existing table lobby.')});
socket.on('state',s=>{state=s;roomCode=s.code||roomCode;me={...(me||{}),...(s.me||{})};if(s.me?.reconnectToken)saveSession();if(s.code){$('#roomCode').textContent=s.code;$('#gameRoom').textContent=s.code}renderAll();updateFunFeatures(s)});

const FUN_KEY='gh_fun_progress_v1';
let funSnapshot=null,funPanelOpen=false,funAudioContext=null;
function funLoad(){try{return JSON.parse(localStorage.getItem(FUN_KEY)||'{}')}catch{return {}}}
function funSave(v){localStorage.setItem(FUN_KEY,JSON.stringify(v))}
function ensureFunPanel(){
 if($('#funDock'))return;
 const dock=document.createElement('section');dock.id='funDock';dock.innerHTML='<button id="funToggle" class="fun-toggle" aria-expanded="false">✦ PLAY BETTER</button><div id="funPanel" class="fun-panel" hidden><div class="fun-head"><b>GAME HUB</b><button id="funClose" aria-label="Close">×</button></div><div class="fun-tabs"><button data-fun-tab="challenges" class="active">Challenges</button><button data-fun-tab="coach">Coach</button><button data-fun-tab="recap">Recap</button><button data-fun-tab="social">Emotes</button></div><div id="funBody"></div><div class="fun-foot"><label><input id="funSound" type="checkbox"> Round sounds</label><button id="funTheme">Change table accent</button></div></div>';
 document.body.appendChild(dock);
 $('#funToggle').onclick=()=>{funPanelOpen=!funPanelOpen;$('#funPanel').hidden=!funPanelOpen;$('#funToggle').setAttribute('aria-expanded',String(funPanelOpen));if(funPanelOpen)renderFunTab('challenges')};
 $('#funClose').onclick=()=>{funPanelOpen=false;$('#funPanel').hidden=true;$('#funToggle').setAttribute('aria-expanded','false')};
 $$('#funPanel [data-fun-tab]').forEach(b=>b.onclick=()=>renderFunTab(b.dataset.funTab));
 $('#funSound').checked=localStorage.getItem('gh_fun_sound')==='1';
 $('#funSound').onchange=()=>localStorage.setItem('gh_fun_sound',$('#funSound').checked?'1':'0');
 $('#funTheme').onclick=()=>{const next=localStorage.getItem('gh_fun_accent')==='gold'?'blue':'gold';localStorage.setItem('gh_fun_accent',next);document.documentElement.dataset.funAccent=next;toast('Table accent changed.')};
 document.documentElement.dataset.funAccent=localStorage.getItem('gh_fun_accent')||'blue';
}
function funPlaySound(){
 if(localStorage.getItem('gh_fun_sound')!=='1')return;
 try{const C=window.AudioContext||window.webkitAudioContext;if(!C)return;funAudioContext=funAudioContext||new C();const osc=funAudioContext.createOscillator(),gain=funAudioContext.createGain();osc.type='sine';osc.frequency.value=660;gain.gain.value=.045;osc.connect(gain);gain.connect(funAudioContext.destination);osc.start();osc.stop(funAudioContext.currentTime+.12)}catch{}
}
function funToday(){return new Date().toISOString().slice(0,10)}
function updateFunFeatures(s){
 ensureFunPanel();
 const p=funLoad(),today=funToday();
 if(p.day!==today){p.day=today;p.roundsToday=0;p.winsToday=0;p.gamesToday=[]}
 const game=s.game||'unknown',mine=s.me?.id,phase=game==='poker'?s.poker?.phase:game==='blackjack'?s.blackjack?.phase:game==='roulette'?s.roulette?.phase:s.chess?.winners?.length?'RESULT':'';
 const marker=game==='poker'?(s.poker?.handNo||0)+':'+phase:game==='blackjack'?phase+':'+Object.values(s.blackjack?.hands||{}).map(h=>h.result||'').join(','):game==='roulette'?phase+':'+JSON.stringify(s.roulette?.result||null):phase+':'+JSON.stringify(s.chess?.winners||[]);
 const prev=funSnapshot;
 if(prev&&prev.code===s.code&&prev.game===game&&prev.marker!==marker){
   const resultReady=(game==='poker'&&s.poker?.phase==='HAND_COMPLETE')||(game==='blackjack'&&s.blackjack?.phase==='RESULT')||(game==='roulette'&&s.roulette?.phase==='RESULT')||(game==='chess'&&Array.isArray(s.chess?.winners)&&s.chess.winners.length>0);
   if(resultReady&&prev.marker!==marker){
     p.roundsToday=(p.roundsToday||0)+1;if(!p.gamesToday.includes(game))p.gamesToday.push(game);
     let won=false,summary='';
     if(game==='poker'){won=(s.poker?.winners||[]).some(w=>w.id===mine);const w=(s.poker?.winners||[]).map(w=>s.players.find(x=>x.id===w.id)?.name+' · '+(w.hand||'won pot')).filter(Boolean);summary=won?'You won the poker hand.':(w.join(', ')||'Poker hand completed.')}
     else if(game==='blackjack'){const h=s.blackjack?.hands?.[mine];won=h?.result==='win'||h?.result==='blackjack';summary='Your total: '+(h?.total??'—')+'. Dealer total: '+(s.blackjack?.dealer||[]).filter(c=>c!=='??').join(' ') + (h?.result?' · '+h.result:'')}
     else if(game==='roulette'){const wins=(s.roulette?.result?.winners||[]).some(w=>w.playerId===mine);won=wins;summary='Spin result: '+JSON.stringify(s.roulette?.result??'completed')}
     else {won=(s.chess?.winners||[]).includes(mine);summary=won?'You won the chess game.':'Chess game completed.'}
     if(won)p.winsToday=(p.winsToday||0)+1;
     p.lastRecap={game,won,summary,at:Date.now()};
     p.achievements=p.achievements||{};
     if(p.roundsToday>=3)p.achievements.threeRounds=true;
     if(won)p.achievements.firstWin=true;
     if(p.gamesToday.length>=2)p.achievements.variety=true;
     funSave(p);funPlaySound();
     if(funPanelOpen)renderFunTab('recap');
   }
 }
 funSnapshot={code:s.code,game,marker};
}
function renderFunTab(tab){
 ensureFunPanel();$$('#funPanel [data-fun-tab]').forEach(b=>b.classList.toggle('active',b.dataset.funTab===tab));
 const body=$('#funBody'),p=funLoad(),game=state?.game||'poker';
 if(tab==='challenges'){
  const rounds=p.roundsToday||0,wins=p.winsToday||0,ach=p.achievements||{};
  body.innerHTML='<p class="fun-intro">Complete small goals while you play. Progress is saved in this browser.</p><div class="fun-challenge"><b>Warm-up</b><span>'+rounds+'/3 rounds today</span><i><em style="width:'+Math.min(100,rounds/3*100)+'%"></em></i></div><div class="fun-challenge"><b>First win</b><span>'+(wins?'Complete':'Win any round')+'</span><i><em style="width:'+(wins?100:0)+'%"></em></i></div><div class="fun-challenge"><b>Game explorer</b><span>'+(p.gamesToday||[]).length+'/2 game types</span><i><em style="width:'+Math.min(100,(p.gamesToday||[]).length/2*100)+'%"></em></i></div><h4>Achievements</h4><div class="fun-achievements"><span class="'+(ach.threeRounds?'earned':'')+'">3-round streak</span><span class="'+(ach.firstWin?'earned':'')+'">First win</span><span class="'+(ach.variety?'earned':'')+'">Game explorer</span></div>';
 }else if(tab==='coach'){
  const meP=state?.players?.find(x=>x.id===state?.me?.id),call=Math.max(0,Number(state?.poker?.highestBet||0)-Number(meP?.bet||0)),pot=Number(state?.poker?.pot||0),hand=state?.me?.currentHand||'Waiting for cards';
  let advice='Wait for a hand to begin to get a contextual tip.';
  if(game==='poker'&&state?.status==='IN_GAME'){if(call===0)advice=/Pair|Two Pair|Three|Straight|Flush|Full House|Four|Royal/i.test(hand)?'You have made a hand. Consider value betting when weaker hands can call.':'You can check for free; avoid building a large pot with only high card.';else advice=call/(pot+call)>.33?'The call is expensive relative to the current pot. Continue mainly with strong hands or meaningful draw potential.':'The pot price is relatively favorable; compare your hand strength and likely outs before calling.'}
  if(game==='blackjack'&&state?.blackjack?.hands?.[state?.me?.id]){const h=state.blackjack.hands[state.me.id];advice='Your total is '+h.total+'. Basic rule: stand on hard 17+, hit hard 11 or less; soft totals depend on the dealer up-card.'}
  if(game==='roulette')advice='Roulette is random; no bet type predicts the next spin. Choose stakes for entertainment, not as a way to beat the odds.';
  body.innerHTML='<p class="fun-intro">Quick strategy coach · informational, not a guarantee.</p><div class="fun-coach"><small>TABLE</small><b>'+esc(game.toUpperCase())+'</b><small>YOUR CURRENT HAND</small><b>'+esc(hand)+'</b><p>'+esc(advice)+'</p></div>';
 }else if(tab==='recap'){
  const r=p.lastRecap;
  body.innerHTML=r?'<div class="fun-recap '+(r.won?'won':'lost')+'"><small>'+esc(r.game.toUpperCase())+' · '+new Date(r.at).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})+'</small><h3>'+(r.won?'ROUND WON':'ROUND COMPLETE')+'</h3><p>'+esc(r.summary)+'</p></div><p class="fun-intro">For complete account history, open History from the main lobby.</p>':'<p class="fun-intro">Your last round recap will appear here after a game finishes.</p>';
 }else{
  body.innerHTML='<p class="fun-intro">Send a quick reaction to everyone at this table.</p><div class="fun-emotes">'+['👏','😎','🔥','🤔','💀','GG'].map(e=>'<button data-emote="'+e+'">'+e+'</button>').join('')+'</div><p class="fun-intro">Reactions use table chat and do not affect gameplay.</p>';
  $('[data-emote]').forEach(b=>b.onclick=()=>call('chat',{text:b.dataset.emote}).then(r=>{if(!r.ok)toast(r.error);else toast('Reaction sent.')}));
 }
}

function renderAll(){if(!state){renderAccount();return;}$('#playerCount').textContent=state.players.length;renderPlayers();renderChat();if(state.status==='IN_GAME'){showScreen('game');renderGame()}else{showScreen('lobby');renderLobby()}}
function renderLobby(){renderAccount();const mine=mePlayer();$$('.game-tab').forEach(b=>b.classList.toggle('active',b.dataset.game===state.game));$('#chessWagerWrap').classList.toggle('hidden',state.game!=='chess');const canHost=mine?.host;$('#startBtn').disabled=!canHost;$('#addBotBtn').disabled=!canHost;$('#addBotBtn').textContent=state.game==='chess'?'+ ADD CHESS BOT':'+ ADD DEALER/BOT';const startLabel=state.game==='poker'?'START POKER':state.game==='blackjack'?'START BLACKJACK':state.game==='roulette'?'OPEN ROULETTE':'START CHESS';$('#startBtn').textContent=startLabel}
function renderPlayers(){
 $('#playersList').innerHTML=state.players.map(p=>`<div class="player-row"><div class="avatar">${esc(p.name.slice(0,2).toUpperCase())}</div><div class="player-meta"><b>${esc(p.name)} ${p.host?'★':''}</b><span>${p.bot?'BOT · '+esc(p.botType):(p.connected?'CONNECTED':'DISCONNECTED')}</span></div><div class="chips">${p.chips.toLocaleString()}</div></div>`).join('');
 $('#gamePlayers').innerHTML=state.players.map(p=>`<div class="game-player ${state.turnPlayerId===p.id?'active':''}"><div class="gp-top"><b>${esc(p.name)}</b><span>${p.bot?'BOT':'HUMAN'}</span></div><div class="gp-sub">${p.chips.toLocaleString()} chips · ${esc(p.lastAction||'')}</div></div>`).join('')
}
function renderChat(){const html=(state.chat||[]).map(m=>`<div class="chat-line ${m.system?'system':''}">${m.system?'':`<b>${esc(m.name)}:</b>`}${esc(m.text)}</div>`).join('');$('#chatLog').innerHTML=html;$('#gameChat').innerHTML=html;['#chatLog','#gameChat'].forEach(s=>{const x=$(s);x.scrollTop=x.scrollHeight})}
function card(c){if(c==='??')return '<div class="card back">?</div>';const face=String(c).replace(/^T(?=[♠♥♦♣])/,'10');return `<div class="card ${/[♥♦]/.test(face)?'red':''}">${esc(face)}</div>`}
function renderGame(){const g=state.game;document.body.classList.toggle('compact-card-game',g==='poker'||g==='blackjack');$('#postGame').classList.add('hidden');$('#pokerBoard').classList.toggle('hidden',g!=='poker');$('#blackjackBoard').classList.toggle('hidden',g!=='blackjack');$('#rouletteBoard').classList.toggle('hidden',g!=='roulette');$('#chessBoard').classList.toggle('hidden',g!=='chess');$('#pokerActions').classList.toggle('hidden',g!=='poker');$('#bjActions').classList.toggle('hidden',g!=='blackjack');if(g==='poker')renderPoker();if(g==='blackjack'){renderBJ();renderBJSummary()}if(g==='roulette')renderRoulette();if(g==='chess')renderChess()}
function seatPos(i,n,focus=0){const a=(90+(360/n)*(i-focus))*Math.PI/180;return {left:50+42*Math.cos(a),top:50+38*Math.sin(a)}}
function renderPoker(){
  const p=state.poker||{}, players=state.players||[], mine=mePlayer(), myTurn=state.turnPlayerId===mine?.id;
 const phase=p.phase||'WAITING';
 const showdown=new Map((p.showdown||[]).map(x=>[x.id,x]));
 const street={LOBBY:'WAITING',PREFLOP:'PRE-FLOP',FLOP:'FLOP',TURN:'TURN',RIVER:'RIVER',SHOWDOWN:'SHOWDOWN',HAND_COMPLETE:'SHOWDOWN'}[phase]||phase;
 const pot=$('#pot'), streetChip=$('#streetChip'), dealerName=$('#dealerName');
 if(pot)pot.innerHTML='<span>POT</span><b>'+Number(p.pot||0).toLocaleString()+'</b>';
 if(streetChip)streetChip.textContent=street;
 const dealer=players[p.dealerIndex];
 if(dealerName)dealerName.textContent=dealer?.name||'—';
 const community=$('#community');
 if(community)community.innerHTML=(p.community||[]).map((c,i)=>{const best=state.me?.bestCards?.includes(c);return card(c).replace('class="card','class="card deal-card deal-'+i+(best?' best-hand-card':''))}).join('');
 const seats=$('#seats');
 if(seats)seats.innerHTML=players.map((x,i)=>{
   const mineIndex=players.findIndex(v=>v.id===mine?.id); const pos=seatPos(i,Math.max(2,players.length),mineIndex<0?0:mineIndex);
   const mineSeat=x.id===mine?.id;
   const revealed=phase==='HAND_COMPLETE'&&showdown.has(x.id);
   let hole='';
   if(mineSeat&&state.me?.hole?.length) hole=state.me.hole.map(card).join('');
   else if(revealed) hole=(showdown.get(x.id)?.cards||[]).map(card).join('');
   else hole='<div class="card back mini-back">?</div><div class="card back mini-back">?</div>';
   const active=state.turnPlayerId===x.id;
   const action=x.lastAction||'';
   const hand=revealed?showdown.get(x.id)?.hand:'';
   return '<div class="seat '+(mineSeat?'mine ':'')+(active?'active ':'')+(x.folded?'folded ':'')+'" style="left:'+pos.left+'%;top:'+pos.top+'%">'+
     '<div class="opponent-figure"><i></i><span></span></div>'+
     '<div class="seat-panel"><div class="seat-name">'+esc(x.name)+(x.host?' ♛':'')+'</div>'+
     '<div class="seat-role">'+(x.bot?'DEALER':'PLAYER')+'</div><div class="hole">'+hole+'</div>'+
     '<div class="seat-chips"><b>'+Number(x.chips||0).toLocaleString()+'</b><span>CHIPS</span></div>'+
     '<div class="seat-bet">'+(x.bet?'BET '+Number(x.bet).toLocaleString():'')+'</div>'+
     '<div class="seat-action">'+esc(action)+(active?' • YOUR TURN':'')+'</div>'+
     (hand?'<div class="revealed-hand">'+esc(hand)+'</div>':'')+
     '</div></div>';
 }).join('');
 const winner=$('#winner');
 if(winner){
   const winningRows=(p.winners||[]).map(w=>{const pl=players.find(x=>x.id===w.id);return '<div class="winner-card"><strong>'+esc(pl?.name||'Player')+' WINS</strong><b>+'+Number(w.amount||0).toLocaleString()+' chips</b><span>'+esc(w.hand||'Winner')+'</span></div>'}).join('');
   if(phase==='HAND_COMPLETE'){
     const myWin=(p.winners||[]).some(w=>w.id===mine?.id),winnerNames=(p.winners||[]).map(w=>players.find(x=>x.id===w.id)?.name||'Player').join(' · '),myResult=showdown.get(mine?.id);
     winner.innerHTML='<div class="result-banner '+(myWin?'you-won':'you-lost')+'"><strong>'+(myWin?'YOU WON THE HAND':(myResult?.folded?'YOU FOLDED':'HAND COMPLETE'))+'</strong><span>'+(winnerNames?'Winner'+((p.winners||[]).length>1?'s':'')+': '+esc(winnerNames):'No winner recorded')+'</span>'+(myWin?'<b>+'+Number((p.winners||[]).find(w=>w.id===mine?.id)?.amount||0).toLocaleString()+' chips</b>':'<span>Your result: '+esc(myResult?.hand||(myResult?.folded?'Folded':'Loss'))+'</span>')+'</div>'+winningRows;
   }else winner.innerHTML='';
 }
 const showdownEl=$('#showdown');
 if(showdownEl){
   showdownEl.innerHTML=phase==='HAND_COMPLETE'&&p.showdown?.length?
     '<div class="showdown-title">SHOWDOWN · CARDS REVEALED</div>'+
     (function(){const ranks={'High Card':0,'Pair':1,'Two Pair':2,'Three of a Kind':3,'Straight':4,'Flush':5,'Full House':6,'Four of a Kind':7,'Straight Flush':8,'Royal Flush':9};const winners=p.showdown.filter(x=>(p.winners||[]).some(w=>w.id===x.id));const other=p.showdown.filter(x=>!x.folded&&!winners.some(w=>w.id===x.id));const why=winners.length&&other.length?winners.map(w=>{const beaten=other.slice().sort((a,b)=>(ranks[b.hand]||0)-(ranks[a.hand]||0))[0];if(!beaten)return '';const wr=ranks[w.hand]??0,br=ranks[beaten.hand]??0;return wr>br?w.hand+' beats '+beaten.hand+' because '+w.hand.toLowerCase()+' ranks higher in poker.':wr===br?'Both made '+w.hand+'. The winner is decided by the highest kickers (remaining cards).':'The winner took a side pot; compare each pot separately.'}).filter(Boolean).join(' '):winners.length?'The pot was uncontested: every other player folded.':'';return (why?'<div class="showdown-explanation"><b>WHY THE WINNER WON</b><p>'+esc(why)+'</p></div>':'')+p.showdown.map(x=>'<div class="showdown-player"><b>'+esc(x.name)+'</b><div class="showdown-cards">'+x.cards.map(card).join('')+'</div><span>'+esc(x.folded?'FOLDED':x.hand||'SHOWED')+'</span></div>').join('')})()
     :'';
   showdownEl.classList.toggle('visible',phase==='HAND_COMPLETE');
 }
 const post=$('#postGame'); if(post)post.classList.toggle('hidden',phase!=='HAND_COMPLETE');
 const myHand=$('#myHand');
 if(myHand){
   myHand.innerHTML=(state.me?.hole||[]).map(c=>card(c).replace('class="card','class="card '+(state.me?.bestCards?.includes(c)?'best-hand-card ':'')+'hero-card')).join('');
   myHand.classList.toggle('your-turn',myTurn);
 }
 const turnName=players.find(x=>x.id===state.turnPlayerId)?.name;
 if($('#turnBadge'))$('#turnBadge').textContent=myTurn?'YOUR TURN':turnName?turnName+'\'S TURN':phase==='HAND_COMPLETE'?'SHOWDOWN':phase;
 if(phase==='HAND_COMPLETE'&&$('#playAgainBtn'))$('#playAgainBtn').textContent='DEAL NEXT HAND NOW';
 if($('#timer'))$('#timer').textContent=state.turnEndsAt?Math.max(0,Math.ceil((state.turnEndsAt-Date.now())/1000))+'s':'—';
 const strength=$('#myHandStrength');if(strength){const current=state.me?.currentHand;strength.textContent=current||(phase==='PREFLOP'?'PRE-FLOP · TWO PRIVATE CARDS':'HAND IN PROGRESS');strength.classList.toggle('live',!!current);strength.classList.toggle('turn',myTurn&&phase!=='HAND_COMPLETE');}
 const toCall=Math.max(0,(p.highestBet||0)-(mine?.bet||0));
 document.dispatchEvent(new CustomEvent('gh:poker-bet-state',{detail:{
   myTurn,stack:Math.max(0,Number(mine?.chips)||0),toCall,
   minContribution:Math.max(1,Number(p.highestBet||0)+Number(p.minRaise||50)-Number(mine?.bet||0))
 }}));
 if($('#callBtn')){const b=$('#callBtn');b.textContent=toCall?'CALL '+toCall:'CHECK';b.dataset.action=toCall?'call':'check';}const raiseBtn=$('[data-action="raise"]');if(raiseBtn)raiseBtn.textContent=toCall?'RAISE TO':'BET / RAISE TO';
 $$('[data-action]').forEach(btn=>btn.disabled=!myTurn||phase==='HAND_COMPLETE');
 if($('#raiseAmount')){$('#raiseAmount').placeholder='Raise to '+Math.max((p.highestBet||0)+(p.minRaise||50),(mine?.bet||0)+1);$('#raiseAmount').disabled=!myTurn||phase==='HAND_COMPLETE'}
 const guide=$('#handGuide');
 if(guide){guide.classList.remove('hidden');const current=state.me?.currentHand;$$('[data-hand]').forEach(x=>x.classList.toggle('current',!!current&&x.dataset.hand===current))}
 const fa=$('#feltAction');
 if(fa){const active=players.find(x=>x.id===state.turnPlayerId);fa.textContent=active?(active.id===mine?.id?'YOUR TURN':active.name+' IS PLAYING'):(phase==='HAND_COMPLETE'?'SHOWDOWN':'')}
 if(window.ghPokerFX?.lastHand!==p.handNo){window.ghPokerFX={lastHand:p.handNo};}
 const previous=window.ghPokerFX.players||{};
 players.forEach(x=>{
   const key=x.id, now=x.lastAction||'';
   if(now&&now!==previous[key])showPokerActionFX(x,now);
 });
 window.ghPokerFX.players=Object.fromEntries(players.map(x=>[x.id,x.lastAction||'']));
}
function showPokerActionFX(player,action){
 const stage=$('.poker-stage'); if(!stage)return;
 const mineIndex=state.players.findIndex(v=>v.id===state.me?.id); const pos=seatPos(player.seat||0,Math.max(2,state.players.length),mineIndex<0?0:mineIndex);
 const el=document.createElement('div');
 el.className='action-fx '+(action==='FOLD'?'fold':'');
 el.style.left=pos.left+'%';el.style.top=pos.top+'%';
 el.innerHTML='<b>'+esc(action.replace('ALL-IN','ALL IN'))+'</b><span>'+(action==='CALL'||action==='RAISE'||action==='ALL-IN'?'CHIPS FORWARD':'')+'</span>';
 stage.appendChild(el);
 setTimeout(()=>el.remove(),1300);
 if(['CALL','RAISE','ALL-IN'].includes(action)){
   const chips=document.createElement('div');chips.className='flying-chips';chips.style.left=pos.left+'%';chips.style.top=pos.top+'%';stage.appendChild(chips);setTimeout(()=>chips.remove(),850);
 }
}
function renderBJ(){const b=state.blackjack||{},mine=mePlayer(),h=mine?b.hands?.[mine.id]:null;$('#dealerCards').innerHTML=(b.dealer||[]).map(card).join('');$('#bjHands').innerHTML=state.players.map(p=>{const hand=b.hands?.[p.id];if(!hand||!hand.bet)return `<div class="bj-hand ${p.id===mine?.id?'mine ':''}${state.turnPlayerId===p.id?'bj-active':''}"><b>${esc(p.name)}</b><div class="muted">No bet</div></div>`;return `<div class="bj-hand ${p.id===mine?.id?'mine ':''}${state.turnPlayerId===p.id?'bj-active':''}"><b>${esc(p.name)} ${p.bot?'🤖':''}</b><div class="cards">${hand.cards.map(card).join('')}</div><div>${hand.total} · bet ${hand.bet}</div><div class="eyebrow">${esc(hand.result||(!hand.done?'PLAYING':''))}</div></div>`}).join('');const hud=$('#bjHud');if(hud){const total=h?.cards?.length?h.total:null,rank=String(b.dealer?.[0]||'').replace(/[♠♥♦♣]/g,''),dealerValue=rank==='A'?11:(Number(rank)||0);let advice='PLACE A BET TO START',detail='Your hand total will appear here.';if(h?.bet){if(b.phase==='BETTING'){advice='BET PLACED';detail=`${h.bet.toLocaleString()} virtual tokens committed · waiting for the deal.`}else if(h.result==='BUST'||(total??0)>21){advice='BUST';detail=`${total} points · over 21. This hand is finished.`}else if(h.result==='BLACKJACK'){advice='BLACKJACK';detail='Natural 21 · your hand has blackjack.'}else if(b.phase==='RESULT'){advice=h.result||'ROUND COMPLETE';detail=`Final total: ${total??'—'} · bet ${h.bet.toLocaleString()} tokens.`}else if(h.done){advice='HAND COMPLETE';detail='Your turn is finished · waiting for the dealer and remaining players.'}else if(total!==null){if(total===21){advice='21 · STAND';detail='You have 21. Do not draw another card.'}else if(total>=17){advice='SUGGESTION · STAND';detail=`${total} points · usually stand on 17 or higher.`}else if(total>=13&&dealerValue>=2&&dealerValue<=6){advice='SUGGESTION · STAND';detail=`${total} against dealer ${rank} · basic strategy usually stands.`}else if(total===12&&dealerValue>=4&&dealerValue<=6){advice='SUGGESTION · STAND';detail=`12 against dealer ${rank} · basic strategy usually stands.`}else if(total===11&&h.cards?.length===2&&mine?.chips>=h.bet){advice='SUGGESTION · DOUBLE';detail='11 on the first two cards · consider doubling if allowed.'}else{advice='SUGGESTION · HIT';detail=`${total} points${rank?` against dealer ${rank}`:''} · basic strategy usually hits.`}}}hud.innerHTML=`<div class="bj-hud-kicker">YOUR BLACKJACK HAND</div><div class="bj-hud-total">${total===null?'—':total}<span>${total===null?'TOTAL':'POINTS'}</span></div><div class="bj-hud-status ${advice.includes('BUST')||advice==='LOSE'?'is-loss':advice.includes('BLACKJACK')||advice==='WIN'?'is-win':''}">${esc(advice)}</div><div class="bj-hud-detail">${esc(detail)}</div>${h?.bet?`<div class="bj-hud-bet"><span>WAGER CONFIRMED</span><b>${h.bet.toLocaleString()} TOKENS</b></div>`:`<div class="bj-hud-bet is-empty">NO BET YET</div>`}`;}const myTurn=state.turnPlayerId===mine?.id;$$('[data-bj]').forEach(btn=>btn.disabled=!myTurn);$('#bjBetBtn').disabled=b.phase!=='BETTING'||!mine}
function renderBJSummary(){
 const b=state.blackjack||{},mine=mePlayer(),hand=mine?b.hands?.[mine.id]:null,host=$('#bjHud');
 if(!host)return;
 let panel=$('#bjRoundSummary');
 if(!panel){panel=document.createElement('section');panel.id='bjRoundSummary';panel.className='bj-round-summary';host.insertAdjacentElement('afterend',panel)}
 if(b.phase!=='RESULT'||!hand?.bet){panel.innerHTML='';panel.classList.remove('visible');return}
 const dealerCards=b.dealer||[];
 let dealerTotal=0,dealerAces=0;dealerCards.forEach(c=>{const r=String(c).replace(/[♠♥♦♣]/g,'');if(r==='A'){dealerAces++;dealerTotal+=11}else if(['K','Q','J','T','10'].includes(r))dealerTotal+=10;else dealerTotal+=Number(r)||0});while(dealerTotal>21&&dealerAces>0){dealerTotal-=10;dealerAces--;}
 const result=hand.result||'ROUND COMPLETE',won=result==='WIN'||result==='BLACKJACK',pushed=result==='PUSH';
 const title=won?'YOU WIN':pushed?'PUSH · BET RETURNED':result==='BUST'?'YOU BUSTED':'DEALER WINS';
 const detail=result==='BLACKJACK'?'Natural blackjack pays 3:2.':result==='BUST'?'Your '+hand.total+' points exceeded 21.':pushed?'Both hands finished at '+hand.total+'. Your wager was returned.':won?'Your '+hand.total+' beats the dealer’s '+dealerTotal+'.':'Dealer '+dealerTotal+' beats your '+hand.total+'.';
 panel.innerHTML='<div class="bj-result-heading '+(won?'is-win':pushed?'is-push':'is-loss')+'"><strong>'+title+'</strong><span>'+esc(detail)+'</span></div><div class="bj-result-comparison"><div><label>DEALER · '+dealerTotal+'</label><div class="cards">'+dealerCards.map(card).join('')+'</div></div><div class="bj-result-vs">VS</div><div><label>YOU · '+Number(hand.total||0)+'</label><div class="cards">'+(hand.cards||[]).map(card).join('')+'</div></div></div><div class="bj-result-footer">WAGER '+Number(hand.bet||0).toLocaleString()+' · '+esc(result)+'</div>';
 panel.classList.add('visible');
}
function renderRoulette(){
  const r=state.roulette||{},bets=r.bets||[],players=state.players||[];
  const reds=new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
  const order=['0',28,9,26,30,11,7,20,32,17,5,22,34,15,3,24,36,13,1,'00',27,10,25,29,12,8,19,31,18,6,21,33,16,4,23,35,14,2].map(String);
  const wheel=$('#wheel'),pockets=$('#wheelPockets');
  if(wheel&&pockets&&!pockets.childElementCount){
    const angle=360/order.length;
    pockets.innerHTML=order.map((n,i)=>'<span class="wheel-pocket '+((n==='0'||n==='00')?'green':reds.has(Number(n))?'red':'black')+'" style="--pocket-index:'+i+'">'+n+'</span>').join('');
    wheel.style.background='conic-gradient(from '+(-angle/2)+'deg,'+order.map((n,i)=>{const color=(n==='0'||n==='00')?'#168050':reds.has(Number(n))?'#a92d2b':'#171a17';return color+' '+(i*angle)+'deg '+((i+1)*angle)+'deg'}).join(',')+')';
  }
  if($('#roulettePhase'))$('#roulettePhase').textContent=r.phase==='SPINNING'?'WHEEL IN MOTION':r.phase==='RESULT'?'ROUND RESULT':'BETTING OPEN';
  $('#rouletteResult').textContent=r.phase==='SPINNING'?'The wheel is spinning…':r.result!=null?'Spin complete · compare your bets below':'Choose your bets, then spin';
  const result=$('#rouletteNumberDisplay');
  if(result){result.textContent=r.result??'—';result.classList.remove('red','black','green');if(r.result!=null)result.classList.add(r.result==='0'||r.result==='00'?'green':reds.has(Number(r.result))?'red':'black')}
  if(wheel)wheel.classList.toggle('spinning',r.phase==='SPINNING');
  const grid=$('#rouletteGrid');
  if(grid&&!grid.childElementCount){
    grid.innerHTML=Array.from({length:36},(_,i)=>i+1).map(n=>'<button class="roulette-pocket '+(reds.has(n)?'red':'black')+'" data-roulette-number="'+n+'" style="grid-column:'+Math.ceil(n/3)+';grid-row:'+(3-((n-1)%3))+'" aria-label="Bet on '+n+'">'+n+'</button>').join('');
  }
  const betsHost=$('#rouletteBets');
  if(betsHost)betsHost.innerHTML=bets.length?bets.map(b=>{const p=players.find(x=>x.id===b.playerId);const label=b.type==='number'?'NUMBER '+b.value:b.type.toUpperCase();return '<div class="roulette-bet-row"><span class="roulette-bet-dot '+(b.type==='red'?'red':b.type==='black'?'black':b.type==='number'?'number':'outside')+'"></span><div><b>'+esc(p?.name||'Player')+'</b><span>'+esc(label)+'</span></div><strong>'+Number(b.amount||0).toLocaleString()+' chips</strong></div>'}).join(''):'<p class="roulette-empty">No bets yet. Choose an outside bet or tap a number.</p>';
  if($('#rouletteBetTotal'))$('#rouletteBetTotal').textContent=bets.reduce((sum,b)=>sum+Number(b.amount||0),0).toLocaleString()+' chips committed · '+bets.length+' bet'+(bets.length===1?'':'s');
  let outcome=$('#rouletteOutcomeDetails');
  if(!outcome){outcome=document.createElement('div');outcome.id='rouletteOutcomeDetails';outcome.className='roulette-outcome-details';const panel=$('.roulette-table-panel');if(panel)panel.appendChild(outcome)}
  if(r.phase==='RESULT'&&r.result!=null){
    const n=r.result==='00'?37:Number(r.result),red=reds.has(n),mine=mePlayer(),mineBets=bets.filter(b=>b.playerId===mine?.id);
    const rows=mineBets.map(b=>{let won=false,mult=1;if(b.type==='number'){won=String(b.value)===String(r.result);mult=35}else if(b.type==='red')won=r.result!=='0'&&r.result!=='00'&&red;else if(b.type==='black')won=r.result!=='0'&&r.result!=='00'&&!red;else if(b.type==='odd')won=n>0&&n<37&&n%2===1;else if(b.type==='even')won=n>0&&n<37&&n%2===0;else if(b.type==='low')won=n>=1&&n<=18;else if(b.type==='high')won=n>=19&&n<=36;return {bet:b,won,payout:won?Number(b.amount||0)*(mult+1):0,label:b.type==='number'?'Number '+b.value:b.type.toUpperCase()}});
    const won=rows.filter(x=>x.won),lost=rows.filter(x=>!x.won),paid=won.reduce((sum,x)=>sum+x.payout,0),staked=rows.reduce((sum,x)=>sum+Number(x.bet.amount||0),0);
    outcome.innerHTML='<div class="roulette-outcome-title '+(won.length?'is-win':'is-loss')+'"><strong>'+(won.length?'YOU WON':'NO WINNING BETS')+'</strong><span>Ball landed on '+esc(r.result)+' · '+(r.result==='0'||r.result==='00'?'GREEN':red?'RED':'BLACK')+'</span></div><div class="roulette-outcome-math">'+won.map(x=>'<div class="roulette-settlement win"><b>'+esc(x.label)+'</b><span>'+Number(x.bet.amount).toLocaleString()+' stake → '+Number(x.payout).toLocaleString()+' returned</span></div>').join('')+lost.map(x=>'<div class="roulette-settlement loss"><b>'+esc(x.label)+'</b><span>'+Number(x.bet.amount).toLocaleString()+' stake → 0 returned</span></div>').join('')+'</div><p class="roulette-net '+(paid>staked?'is-win':paid===staked?'is-push':'is-loss')+'">Staked '+staked.toLocaleString()+' · payout '+paid.toLocaleString()+' · net '+(paid-staked>0?'+':'')+(paid-staked).toLocaleString()+'</p>';
    outcome.classList.add('visible');
  }else{outcome.innerHTML='';outcome.classList.remove('visible')}
  const mine=mePlayer();$('#spinBtn').disabled=!mine?.host||r.phase!=='BETTING'||bets.length===0;
}
const pieces={p:'♟',r:'♜',n:'♞',b:'♝',q:'♛',k:'♚',P:'♙',R:'♖',N:'♘',B:'♗',Q:'♕',K:'♔'};
function renderChess(){const c=state.chess||{},mine=me?.id,white=state.players.find(p=>p.id===c.white),black=state.players.find(p=>p.id===c.black),myColor=mine===c.white?'w':mine===c.black?'b':null,myTurn=!!myColor&&(c.turn==='w'?c.white:c.black)===mine;if(chessBoardFlipped===null)chessBoardFlipped=myColor==='b';const gameOver=!!c.gameOver;const winner=c.result?.winnerId?state.players.find(p=>p.id===c.result.winnerId):null;$('#chessStatus').textContent=gameOver?(winner?`${winner.name} wins by checkmate`:c.result?.reason||'Draw'):myTurn?'YOUR MOVE':`${c.turn==='w'?'White':'Black'} to move`;$('#chessTurnHint').textContent=gameOver?'Game complete. Start a new table to play again.':myTurn?'Select one of your pieces, then a highlighted square.':`${(c.turn==='w'?white:black)?.name|| (c.turn==='w'?'White':'Black')} is thinking / to move.`;$('#chessOpponentBar').innerHTML=`<span class="chess-color-dot ${chessBoardFlipped?'white-dot':'black-dot'}"></span><b>${esc((chessBoardFlipped?white:black)?.name||'White')}</b><span>${chessBoardFlipped?'WHITE':'BLACK'} · ${Number((chessBoardFlipped?white:black)?.chips||0).toLocaleString()} chips</span>`;$('#chessSelfBar').innerHTML=`<span class="chess-color-dot ${chessBoardFlipped?'black-dot':'white-dot'}"></span><b>${esc((chessBoardFlipped?black:white)?.name||'Black')}</b><span>${chessBoardFlipped?'BLACK':'WHITE'} · ${Number((chessBoardFlipped?black:white)?.chips||0).toLocaleString()} chips</span>`;$('#whiteCaptured').textContent=(c.history||[]).filter(m=>m.color==='w'&&m.captured).map(m=>pieces[m.captured]||m.captured).join(' ')||'—';$('#blackCaptured').textContent=(c.history||[]).filter(m=>m.color==='b'&&m.captured).map(m=>pieces[m.captured.toUpperCase()]||m.captured).join(' ')||'—';const hist=c.history||[];$('#chessMoveList').innerHTML=hist.length?Array.from({length:Math.ceil(hist.length/2)},(_,i)=>`<li><span>${i+1}.</span> ${esc(hist[i*2]?.san||'')}${hist[i*2+1]?' <i>'+esc(hist[i*2+1].san)+'</i>':''}</li>`).join(''):'<li class="muted">Moves appear here.</li>';if(c.wagerPot)$('#chessTurnHint').textContent+=` · ${Number(c.wagerPot).toLocaleString()} chips in the pot`;if(!c.fen)return;const rows=[];for(const row of c.fen.split(' ')[0].split('/')){const out=[];for(const ch of row){if(/\d/.test(ch))for(let i=0;i<+ch;i++)out.push(null);else out.push(ch)}rows.push(out)}const last=c.lastMove||{},legal=(c.legalMoves||[]).filter(m=>m.from===selectedChess).map(m=>m.to);const displayRows=chessBoardFlipped?rows.slice().reverse().map(row=>row.slice().reverse()):rows;$('#chessGrid').innerHTML=displayRows.flatMap((row,r)=>row.map((piece,col)=>{const actualRow=chessBoardFlipped?7-r:r,actualCol=chessBoardFlipped?7-col:col,sq=String.fromCharCode(97+actualCol)+(8-actualRow),ownPiece=piece&&(c.turn==='w'?piece===piece.toUpperCase():piece===piece.toLowerCase()),isMyTurn=myColor===c.turn&&myTurn,classes=['sq',(r+col)%2?'dark':'light',selectedChess===sq?'sel':'',last.from===sq?'last-from':'',last.to===sq?'last-to':'',legal.includes(sq)?'legal-target':'',piece?(piece===piece.toUpperCase()?'piece-white':'piece-black'):'',piece&&isMyTurn&&ownPiece?'selectable':''].filter(Boolean).join(' ');return `<div class="${classes}" data-sq="${sq}" data-piece="${piece||''}" aria-label="${sq} ${piece||'empty'}">${piece?pieces[piece]:''}</div>`})).join('');$('#chessGrid .sq').forEach(x=>x.onclick=()=>chessClick(x.dataset.sq))}
function chessClick(sq){const c=state?.chess||{},mine=me?.id,myColor=mine===c.white?'w':mine===c.black?'b':null,myTurn=!!myColor&&(c.turn==='w'?c.white:c.black)===mine;const cell=$(`#chessGrid .sq[data-sq="${sq}"]`),piece=cell?.dataset.piece||'';if(!myTurn){selectedChess=null;toast('Wait for your turn.');renderChess();return}const own=piece&&(myColor==='w'?piece===piece.toUpperCase():piece===piece.toLowerCase());if(!selectedChess){if(own){selectedChess=sq;renderChess()}return}if(own){selectedChess=sq;renderChess();return}const from=selectedChess,legal=(c.legalMoves||[]).some(m=>m.from===from&&m.to===sq);if(!legal){selectedChess=null;renderChess();return}selectedChess=null;let promotion;if(from[1]==='7'&&sq[1]==='8'||from[1]==='2'&&sq[1]==='1')promotion='q';call('chessMove',{move:{from,to:sq,promotion}}).then(r=>{if(!r.ok)toast(r.error||'Illegal move')});renderChess()}
function nameModal(join){openModal(`<span class="eyebrow">${join?'JOIN ROOM':'CREATE ROOM'}</span><h2>${join?'Join a room':'Choose your name'}</h2><p class="modal-sub">Your name is saved on this device.</p>${join?'<label class="modal-label">ROOM CODE</label><input id="joinCode" class="modal-input" maxlength="6" placeholder="ABC123">':''}<label class="modal-label">YOUR NAME</label><input id="playerName" class="modal-input" maxlength="18" placeholder="Your name" value="${esc(savedName())}" autocomplete="nickname"><button class="btn primary full" id="modalSubmit">${join?'JOIN ROOM':'CREATE ROOM'}</button>`);setTimeout(()=>$('#playerName')?.focus(),30)}
$('#devToolsBtn').onclick=openDevTools;$('#dailyBtn').onclick=claimDaily;$('#profileBtn').onclick=showProfile;$('#historyBtn').onclick=showHistory;$('#leaderboardBtn').onclick=showLeaderboard;$('#roomsBtn').onclick=showRooms;$('#roomsBtnHero').onclick=showRooms;$('#refreshRooms').onclick=showRooms;$('#createBtn').onclick=()=>nameModal(false);$('#joinBtn').onclick=()=>nameModal(true);$('#modalClose').onclick=closeModal;$('#modal').onclick=e=>{if(e.target.id==='modal')closeModal()};$('#shopBtn').onclick=showShop;$('#withdrawBtn').onclick=()=>transfer('withdraw');$('#depositBtn').onclick=()=>transfer('deposit');$('#adBtn').onclick=async()=>{try{const j=await api('/api/refill',{method:'POST',body:'{}'});account=j.account;renderAccount();toast(`Free refill: +${j.amount.toLocaleString()} tokens`)}catch(e){toast(e.message)}};$$('.auth-tab').forEach(b=>b.onclick=()=>{authMode=b.dataset.auth;renderAuth()});document.addEventListener('click',e=>{if(e.target.id==='devLoginBtn'){(async()=>{try{const r=await fetch(API_URL+'/api/dev/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:$('#devUsername').value,password:$('#devPassword').value})});const j=await r.json();if(!r.ok){if(r.status===404)throw Error('Developer sign-in is not available on the backend this preview is using. Render is still running main; the feature-branch server must be deployed to a separate preview backend before this can work.');throw Error(j.error||'Sign-in failed')}sessionStorage.setItem('gh_dev_token',j.token);openDevTools()}catch(err){toast(err.message)}})()}if(e.target.id==='devResetRooms')devAction('/api/dev/reset-rooms','Reset all live rooms');if(e.target.id==='devResetLeaderboard')devAction('/api/dev/reset-leaderboard','Reset leaderboard and game history');if(e.target.id==='devLogout'){sessionStorage.removeItem('gh_dev_token');openDevTools()}if(e.target.id==='authSubmit')submitAuth();const buy=e.target.closest('[data-shop]');if(buy)buyItem(buy.dataset.shop);const eq=e.target.closest('[data-equip]');if(eq)equipItem(eq.dataset.equip)});
document.addEventListener('click',e=>{if(e.target.id==='modalSubmit'){const name=rememberName($('#playerName').value);if(!name)return toast('Enter your name.');if($('#joinCode')){const code=$('#joinCode').value.trim().toUpperCase();if(code.length!==6)return toast('Enter the 6-character room code.');call('joinRoom',{code,name,accountToken}).then(r=>{if(!r.ok)toast(r.error);else closeModal()})}else call('createRoom',{name,accountToken}).then(r=>{if(!r.ok)toast(r.error);else{me={reconnectToken:r.reconnectToken};roomCode=r.code;saveSession();closeModal()}})}});
$$('.game-tab').forEach(b=>b.onclick=()=>call('setGame',{game:b.dataset.game}).then(r=>{if(!r.ok)toast(r.error)}));
$('#startBtn').onclick=async()=>{const entryBet=state?.game==='chess'?Math.max(0,Number($('#chessWager')?.value||0)):0;const r=await call('startGame',{entryBet});if(!r.ok)toast(r.error);};
$('#addBotBtn').onclick=()=>{if(state?.game==='chess'){openModal(`<span class="eyebrow">CHESS OPPONENT</span><h2>Choose your rival</h2><p class="modal-sub">Four deterministic search profiles. No external AI service or language model.</p><div class="bot-grid chess-bot-grid"><button class="bot-option" data-chess-bot="beginner"><b>Beginner</b><span>Depth 1 · forgiving, makes mistakes</span></button><button class="bot-option" data-chess-bot="casual"><b>Casual</b><span>Depth 2 · learns simple tactics</span></button><button class="bot-option" data-chess-bot="club"><b>Club Player</b><span>Depth 3 · looks for captures and threats</span></button><button class="bot-option" data-chess-bot="expert"><b>Expert</b><span>Depth 3 · less randomness, strongest setting</span></button></div>`);return}openModal(`<span class="eyebrow">SERVER-SIDE BOTS</span><h2>Add a bot</h2><p class="modal-sub">Poker bots use distinct server-side strategies.</p><div class="bot-grid">${Object.entries({Ace:'Tight / conservative',Shark:'Aggressive / pressure',Bluff:'Frequent bluffs',Lucky:'Loose / call-heavy',Dealer:'Low variance',River:'Balanced',Pocket:'Tight-aggressive',Wildcard:'Unpredictable'}).map(([n,d])=>`<button class="bot-option" data-bot="${n}"><b>${n}</b><span>${d}</span></button>`).join('')}</div>`)};
document.addEventListener('click',e=>{const chess=e.target.closest('[data-chess-bot]');if(chess){call('addBot',{type:'Chess Bot',difficulty:chess.dataset.chessBot}).then(r=>{if(!r.ok)toast(r.error);else closeModal()});return}const b=e.target.closest('[data-bot]');if(b)call('addBot',{type:b.dataset.bot}).then(r=>{if(!r.ok)toast(r.error);else closeModal()})});
$('#chessFlipBtn').onclick=()=>{chessBoardFlipped=!chessBoardFlipped;selectedChess=null;renderChess()};
$
document.addEventListener('gh:poker-physical-bet',async event=>{
 const mine=mePlayer(),p=state?.poker||{},contribution=Math.floor(Number(event.detail?.contribution)||0);
 const fail=message=>{toast(message);document.dispatchEvent(new CustomEvent('gh:poker-physical-bet-result',{detail:{ok:false}}));};
 if(!state||state.game!=='poker')return fail('The poker table is not active.');
 if(state.turnPlayerId!==mine?.id)return fail("It's not your turn.");
 const stack=Math.max(0,Number(mine?.chips)||0),myBet=Math.max(0,Number(mine?.bet)||0),toCall=Math.max(0,Number(p.highestBet||0)-myBet);
 if(contribution<=0)return fail('Click a physical chip stack to select chips.');
 if(stack<=0)return fail('You have no chips left to bet.');
 if(contribution>=stack){
   const r=await call('pokerAction',{action:'allin'});
   if(!r.ok)return fail(r.error);
 }else if(toCall>0&&contribution===toCall){
   const r=await call('pokerAction',{action:'call'});
   if(!r.ok)return fail(r.error);
 }else{
   const amount=myBet+contribution,minTo=Number(p.highestBet||0)+Number(p.minRaise||50);
   if(contribution<toCall)return fail('Select at least '+toCall.toLocaleString()+' chips to call.');
   if(amount<minTo)return fail('Minimum raise is to '+minTo.toLocaleString()+'. Add more physical chips.');
   const r=await call('pokerAction',{action:'raise',amount});
   if(!r.ok)return fail(r.error);
 }
 document.dispatchEvent(new CustomEvent('gh:poker-physical-bet-result',{detail:{ok:true}}));
});

$$('[data-action]').forEach(b=>b.onclick=()=>{let amount=Number($('#raiseAmount').value);call('pokerAction',{action:b.dataset.action,amount}).then(r=>{if(!r.ok)toast(r.error)})});
$$('[data-bj]').forEach(b=>b.onclick=()=>call('blackjackAction',{action:b.dataset.bj}).then(r=>{if(!r.ok)toast(r.error)}));$('#bjBetBtn').onclick=()=>{const amount=Number($('#bjBet').value);call('blackjackBet',{amount}).then(r=>{if(!r.ok)toast(r.error);else{toast(`Bet placed · ${amount.toLocaleString()} virtual tokens`);$('#bjBet').value='';}})};
$('#spinBtn').onclick=()=>call('rouletteSpin',{}).then(r=>{if(!r.ok)toast(r.error)});
$$('.bet-chip').forEach(b=>b.onclick=()=>{if(b.id==='numberBet')return;const amount=Number($('#rouletteAmount').value||25);call('rouletteBet',{type:b.dataset.type,value:b.dataset.value||'',amount}).then(r=>{if(!r.ok)toast(r.error);else toast('Bet placed')})});$('#numberBet').onclick=()=>{const amount=Number($('#rouletteAmount').value||25),raw=$('#rouletteNumber').value.trim(),value=raw==='00'?'00':Number(raw);if(!(value==='00'||Number.isInteger(value)&&value>=0&&value<=36))return toast('Choose a number from 0 to 36, or 00.');call('rouletteBet',{type:'number',value,amount}).then(r=>{if(!r.ok)toast(r.error);else toast(`Bet on ${value} placed`)})};$('#rouletteNumber').max='36';$('.roulette-number-area').addEventListener('click',e=>{const b=e.target.closest('[data-roulette-number]');if(!b)return;$('#rouletteNumber').value=b.dataset.rouletteNumber;$('#numberBet').click()});
async function leave(){const r=await call('leaveRoom',{});if(!r.ok)return toast(r.error);localStorage.removeItem('gh_session');state=null;me=null;roomCode='';showScreen('home');renderAccount()}
async function returnToRoom(){const code=state?.code||roomCode;const r=await call('returnToLobby',{});if(!r.ok)return toast(r.error||'Could not return to the room.');if(state)state.status='LOBBY';showScreen('lobby');renderLobby();toast(`Back in table lobby${code?' · '+code:''}. You are still seated.`)}$('#playAgainBtn').onclick=async()=>{const r=await call('playAgain',{});if(!r.ok)toast(r.error)};$('#quitGameBtn').onclick=returnToRoom;$('#leaveBtn').onclick=returnToRoom;$('#leaveLobbyBtn').onclick=leave;$('#copyRoom').onclick=()=>navigator.clipboard?.writeText(roomCode).then(()=>toast('Room code copied'));
function chat(form,input){$(form).onsubmit=e=>{e.preventDefault();const v=$(input).value.trim();if(v)call('chat',{text:v});$(input).value=''}}chat('#chatForm','#chatInput');chat('#gameChatForm','#gameChatInput');$('#compactChatToggle').onclick=()=>{const panel=$('.side-chat'),open=!panel.classList.contains('chat-open');panel.classList.toggle('chat-open',open);$('#compactChatToggle').setAttribute('aria-expanded',String(open));if(open)$('#gameChatInput').focus()};
setInterval(()=>{if(state?.turnEndsAt)renderAll()},500);document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});

loadAccount();

document.addEventListener('click',e=>{if(e.target.id==='profileBtn')showProfile();if(e.target.id==='historyBtn')showHistory();if(e.target.id==='leaderboardBtn')showLeaderboard();if(e.target.id==='dailyBtn')claimDaily();if(e.target.id==='saveProfile')api('/api/profile',{method:'POST',body:JSON.stringify({name:$('#profileName').value})}).then(j=>{account=j.account;renderAccount();toast('Profile saved');closeModal()}).catch(err=>toast(err.message));if(e.target.id==='logoutBtn')api('/api/logout',{method:'POST',body:'{}'}).finally(()=>{localStorage.removeItem('gh_account_token');accountToken='';account=null;syncSocketAuth();closeModal();renderAuth()});const q=e.target.closest('[data-quick]');if(q){if(!accountToken)return toast('Sign in to play.');quickGame(q.dataset.quick)}});