(()=> {
  'use strict';
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const css = `
  :root{--casino-gold:#e3bd69;--casino-felt:#0b422b;--casino-ink:#070b08}
  .immersive-casino{--ease-casino:cubic-bezier(.2,.8,.2,1)}
  .immersive-casino .poker-stage{perspective:1100px;isolation:isolate}
  .immersive-casino .table-shadow{filter:blur(18px);opacity:.8}
  .immersive-casino .table-felt,.immersive-casino .bj-table{position:relative;overflow:hidden;background:radial-gradient(ellipse at 50% 42%,#176541 0%,#0d4b30 42%,#073421 75%,#052618 100%);box-shadow:inset 0 0 0 2px #c29a51,inset 0 0 0 7px #102117,inset 0 0 75px #00180d,0 30px 75px #000b;transform:translateZ(0)}
  .immersive-casino .table-felt:before,.immersive-casino .bj-table:before{content:"";position:absolute;inset:12px;border:1px solid #d0ae6538;border-radius:inherit;pointer-events:none;z-index:0}
  .immersive-casino .table-felt:after,.immersive-casino .bj-table:after{content:"";position:absolute;inset:0;background:radial-gradient(ellipse at 50% 0%,#ffffff0d,transparent 55%),radial-gradient(ellipse at center,transparent 42%,#0005 100%);pointer-events:none;z-index:0}
  .immersive-casino .table-rail-top,.immersive-casino .dealer-badge,.immersive-casino .street-chip,.immersive-casino .pot,.immersive-casino .community,.immersive-casino .seats,.immersive-casino .felt-action,.immersive-casino .winner,.immersive-casino .showdown,.immersive-casino .hero-hand,.immersive-casino .dealer-hands{z-index:1}
  .immersive-casino .table-felt>*{position:relative}
  .immersive-casino .dealer-badge{box-shadow:0 5px 18px #0008,0 0 0 3px #d7b36612}
  .immersive-casino .seat{transition:filter .2s,transform .2s}
  .immersive-casino .seat.active{filter:drop-shadow(0 0 12px #e6bd5a9c);transform:translateY(-2px)}
  .immersive-casino .seat.active .seat-name{border-color:#f1cc72;box-shadow:0 0 0 2px #e5bb5a22,0 0 22px #d9ae5145}
  .immersive-casino .card{position:relative;transform-origin:50% 85%;will-change:transform,filter;transition:transform .22s var(--ease-casino),filter .22s,box-shadow .22s;cursor:pointer;backface-visibility:hidden}
  .immersive-casino .card:hover{filter:brightness(1.06);box-shadow:0 12px 24px #000b}
  .immersive-casino .card.peeked{transform:translateY(-19px) rotate(-2deg) scale(1.06)!important;z-index:30;box-shadow:0 18px 28px #000b,0 0 0 2px #e4bd69}
  .immersive-casino .card.dealing{animation:casinoDeal .42s cubic-bezier(.16,.85,.24,1) both}
  .immersive-casino .card.card-revealed{animation:casinoFlip .42s ease both}
  .immersive-casino .card.winning-card{box-shadow:0 0 0 2px #f3d27a,0 0 24px #f4ce5d9c,0 10px 18px #0008!important}
  @keyframes casinoDeal{from{opacity:.25;transform:translate(-34px,-20px) rotate(-9deg) scale(.8)}to{opacity:1;transform:translate(0,0) rotate(0) scale(1)}}
  @keyframes casinoFlip{0%{transform:rotateY(90deg) scale(.96);filter:brightness(.7)}65%{transform:rotateY(-8deg)}100%{transform:rotateY(0) scale(1);filter:brightness(1)}}
  @keyframes casinoChipToss{0%{opacity:0;transform:translate(var(--chip-x,0),var(--chip-y,-22px)) scale(.65) rotate(-18deg)}70%{opacity:1;transform:translate(0,3px) scale(1.08) rotate(5deg)}100%{opacity:1;transform:translate(0,0) scale(1) rotate(0)}}
  .casino-chip{--chip-color:#e8e6df;position:relative;display:inline-grid;place-items:center;width:36px;height:36px;border-radius:50%;border:3px dashed #fff9;background:radial-gradient(circle at 35% 28%,#ffffff88,transparent 32%),radial-gradient(circle,#fff2 0 36%,transparent 38%),var(--chip-color);color:#161813;text-shadow:0 1px #fff7;font-size:9px;font-weight:1000;box-shadow:inset 0 0 0 2px #0002,inset 0 -4px 0 #0003,0 4px 0 #0005,0 7px 12px #0006;cursor:pointer;transition:transform .16s,filter .16s;user-select:none}
  .casino-chip:before{content:"";position:absolute;inset:5px;border:1px solid #fff9;border-radius:50%}
  .casino-chip:hover{transform:translateY(-4px) scale(1.07);filter:brightness(1.1)}
  .casino-chip.selected{transform:translateY(-7px);outline:2px solid var(--casino-gold);outline-offset:3px;filter:brightness(1.12)}
  .casino-chip[data-value="5"]{--chip-color:#d95751}.casino-chip[data-value="25"]{--chip-color:#2caa75}.casino-chip[data-value="100"]{--chip-color:#333b4a;color:#fff}.casino-chip[data-value="500"]{--chip-color:#7b56a7;color:#fff}.casino-chip[data-value="1000"]{--chip-color:#d8ae4e}
  .chip-rack{display:flex;align-items:end;justify-content:center;gap:10px;padding:10px 12px;border:1px solid #a98a4c55;border-radius:16px;background:linear-gradient(180deg,#080c09e8,#101711e8);box-shadow:0 10px 25px #0006}
  .chip-choice{display:flex;flex-direction:column;align-items:center;gap:7px;background:transparent;border:0;color:#dce2d9;font-size:10px}
  .chip-choice small{color:#aeb6aa;font-size:9px}
  .chip-stack{display:flex;flex-direction:column-reverse;align-items:center;min-width:36px}
  .chip-stack .casino-chip{margin-top:-23px}.chip-stack .casino-chip:first-child{margin-top:0}
  .chip-bet-tray{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);z-index:6;width:min(94%,450px)}
  .chip-pile{display:flex;gap:3px;align-items:end;justify-content:center;min-height:30px;margin:4px auto}
  .chip-pile .casino-chip{width:27px;height:27px;font-size:7px;margin-left:-8px}.chip-pile .casino-chip:first-child{margin-left:0}
  .chip-pile .casino-chip{animation:casinoChipToss .32s var(--ease-casino) both}
  .action-callout{position:absolute;z-index:20;left:50%;top:24%;transform:translate(-50%,-8px);padding:8px 13px;border:1px solid #e3bd6988;border-radius:999px;background:#090d09ed;color:#f4d78f;font-size:10px;font-weight:1000;letter-spacing:.1em;box-shadow:0 8px 28px #0009;animation:casinoCallout .24s ease both;pointer-events:none}
  @keyframes casinoCallout{from{opacity:0;transform:translate(-50%,6px) scale(.92)}to{opacity:1;transform:translate(-50%,-8px) scale(1)}}
  .immersive-casino .pot{box-shadow:0 0 0 1px #d7b35b20,0 8px 22px #0007}
  .immersive-casino .pot.pot-pulse{animation:casinoPotPulse .38s ease}
  @keyframes casinoPotPulse{50%{transform:translateY(-3px) scale(1.08);filter:brightness(1.3)}}
  .casino-sound-toggle{position:absolute;right:16px;bottom:14px;z-index:8;border:1px solid #d0ac5b55;border-radius:999px;background:#080c09d9;color:#dfc27d;padding:7px 10px;font-size:9px;font-weight:900;letter-spacing:.08em;cursor:pointer}
  .casino-feedback{position:fixed;inset:0;pointer-events:none;z-index:1000;opacity:0;background:radial-gradient(circle at center,#e9c76a16,transparent 48%)}
  .casino-feedback.pop{animation:casinoWin .65s ease-out}
  @keyframes casinoWin{0%{opacity:0}20%{opacity:1}100%{opacity:0}}
  @media(prefers-reduced-motion:reduce){.immersive-casino *, .casino-chip,.casino-feedback{animation-duration:.01ms!important;transition-duration:.01ms!important}}
  @media(max-width:700px){.chip-rack{gap:6px;padding:8px}.casino-chip{width:31px;height:31px}.chip-choice{font-size:9px}.chip-bet-tray{bottom:10px}.immersive-casino .table-felt{overflow:visible}}
  `;
  const style=document.createElement('style');style.textContent=css;document.head.appendChild(style);
  document.body.classList.add('immersive-casino');
  let soundOn=false, audioCtx=null, selectedValue=25, lastSnapshot='', seen=new WeakSet();
  const feedback=document.createElement('div');feedback.className='casino-feedback';document.body.appendChild(feedback);
  const values=[5,25,100,500,1000];
  function sound(type){if(!soundOn)return;try{audioCtx=audioCtx||new(window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();const now=audioCtx.currentTime;const osc=audioCtx.createOscillator(),gain=audioCtx.createGain();osc.connect(gain);gain.connect(audioCtx.destination);osc.type=type==='win'?'sine':'triangle';osc.frequency.setValueAtTime(type==='card'?850:type==='win'?660:type==='bet'?420:250,now);osc.frequency.exponentialRampToValueAtTime(type==='win'?990:type==='card'?520:180,now+.09);gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(type==='win'?.08:.035,now+.008);gain.gain.exponentialRampToValueAtTime(.0001,now+.13);osc.start(now);osc.stop(now+.14)}catch{}}
  function chip(value,extra=''){return '<span class="casino-chip '+extra+'" data-value="'+value+'" aria-label="'+value+' virtual tokens">'+(value>=1000?'1K':value)+'</span>'}
  function addRack(board,betInput){if(!board||$('.chip-bet-tray',board))return;const tray=document.createElement('div');tray.className='chip-bet-tray';tray.innerHTML='<div class="chip-rack" role="group" aria-label="Select virtual chip amount">'+values.map(v=>'<button type="button" class="chip-choice" data-chip-value="'+v+'" aria-label="Select '+v+' tokens"><span class="chip-stack">'+Array.from({length:v===5?1:v===25?2:v===100?3:v===500?4:5},()=>chip(v)).join('')+'</span><small>'+v.toLocaleString()+'</small></button>').join('')+'</div><div class="chip-pile" aria-live="polite"></div>';board.appendChild(tray);$$('[data-chip-value]',tray).forEach(btn=>btn.addEventListener('click',()=>{selectedValue=Number(btn.dataset.chipValue);$$('[data-chip-value]',tray).forEach(x=>x.classList.toggle('selected',x===btn));const input=$(betInput);if(input){const current=Math.max(0,Number(input.value)||0);input.value=String(current+selectedValue);input.dispatchEvent(new Event('input',{bubbles:true}))}const pile=$('.chip-pile',tray);pile.insertAdjacentHTML('beforeend',chip(selectedValue));while(pile.children.length>16)pile.firstElementChild.remove();sound('bet');const pot=$('#pot');if(pot){pot.classList.remove('pot-pulse');void pot.offsetWidth;pot.classList.add('pot-pulse')}}))}
  function annotateCards(root){$$('.card',root).forEach((el,i)=>{if(seen.has(el))return;seen.add(el);el.style.setProperty('--deal-delay',Math.min(i*70,350)+'ms');el.classList.add('dealing');el.style.animationDelay=el.style.getPropertyValue('--deal-delay');el.addEventListener('click',()=>{el.classList.toggle('peeked');sound('card')});el.addEventListener('animationend',e=>{if(e.animationName==='casinoDeal'){el.classList.remove('dealing');if(!el.classList.contains('peeked'))el.style.animationDelay=''}});if(!el.hasAttribute('tabindex'))el.tabIndex=0;el.setAttribute('role','button');el.setAttribute('aria-label','Card: click to lift or lower');el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();el.classList.toggle('peeked');sound('card')}})})}
  function animateChanges(){const board=$('#pokerBoard:not(.hidden),#blackjackBoard:not(.hidden)');if(!board)return;annotateCards(board);const pot=$('#pot');if(pot){const snap=pot.textContent.trim();if(snap&&snap!==lastSnapshot){if(lastSnapshot){pot.classList.remove('pot-pulse');void pot.offsetWidth;pot.classList.add('pot-pulse');sound('bet')}lastSnapshot=snap}}
    $$('.seat.active').forEach(s=>{if(!s.dataset.casinoMarked){s.dataset.casinoMarked='1';s.classList.add('casino-turn-pulse')}})
    const winner=$('#winner');if(winner&&winner.textContent.trim()&&!winner.dataset.casinoCelebrated){winner.dataset.casinoCelebrated='1';feedback.classList.remove('pop');void feedback.offsetWidth;feedback.classList.add('pop');sound('win');$$('#myHand .card').forEach(c=>c.classList.add('winning-card'))}
  }
  function announce(text,board){let old=$('.action-callout',board);if(old)old.remove();const node=document.createElement('div');node.className='action-callout';node.textContent=text;board.appendChild(node);setTimeout(()=>node.remove(),1600)}
  function decorate(){const poker=$('#pokerBoard'),bj=$('#blackjackBoard');if(poker){addRack(poker,'#raiseAmount');if(!$('.casino-sound-toggle',poker)){const b=document.createElement('button');b.className='casino-sound-toggle';b.textContent='SOUND OFF';b.onclick=()=>{soundOn=!soundOn;b.textContent=soundOn?'SOUND ON':'SOUND OFF';if(soundOn)sound('card')};poker.appendChild(b)}}if(bj){addRack(bj,'#bjBet');if(!$('.casino-sound-toggle',bj)){const b=document.createElement('button');b.className='casino-sound-toggle';b.textContent='SOUND OFF';b.onclick=()=>{soundOn=!soundOn;$$('.casino-sound-toggle').forEach(x=>x.textContent=soundOn?'SOUND ON':'SOUND OFF');if(soundOn)sound('card')};bj.appendChild(b)}}animateChanges()}
  const observer=new MutationObserver(()=>{if(!document.body.classList.contains('immersive-casino'))document.body.classList.add('immersive-casino');decorate()});
  observer.observe(document.body,{subtree:true,childList:true,characterData:true});
  document.addEventListener('click',e=>{const a=e.target.closest('[data-action]');if(a){const board=$('#pokerBoard');announce((a.dataset.action||'').toUpperCase(),board);sound('bet')}const bj=e.target.closest('[data-bj]');if(bj){announce((bj.dataset.bj||'').toUpperCase(),$('#blackjackBoard'));sound('card')}});
  window.addEventListener('load',()=>setTimeout(decorate,200));setInterval(decorate,1200);
})();