(()=> {
  'use strict';
  // Stable table-scene treatment. No DOM observers, no card re-mounting,
  // no card entrance animations, and no floating chip tray.
  const css = `
  body.immersive-casino{--casino-gold:#dfbd70;--casino-felt:#0a5136;background:#050706}
  body.immersive-casino .poker-board,
  body.immersive-casino .bj-board{position:relative;isolation:isolate;overflow:hidden;background:
    radial-gradient(ellipse at 50% 5%,rgba(197,159,83,.12),transparent 30%),
    radial-gradient(ellipse at 50% 100%,rgba(0,0,0,.08),rgba(0,0,0,.88) 82%),
    linear-gradient(180deg,#191b17 0%,#0b0d0b 48%,#050605 100%)!important}
  body.immersive-casino .poker-board:before,
  body.immersive-casino .bj-board:before{content:"";position:absolute;inset:0;pointer-events:none;z-index:0;background:
    repeating-linear-gradient(90deg,transparent 0 95px,rgba(255,255,255,.012) 96px 97px),
    radial-gradient(ellipse at 50% 0,rgba(238,209,141,.09),transparent 52%)}
  body.immersive-casino .poker-stage{position:relative;isolation:isolate;perspective:1450px;perspective-origin:50% 48%;min-height:680px}
  body.immersive-casino .table-shadow{width:min(1000px,94%);background:#000;filter:blur(24px);opacity:.92;transform:translateY(50px) rotateX(58deg) scaleY(.9)}
  body.immersive-casino .table-felt{position:relative;isolation:isolate;transform:rotateX(13deg) scaleY(.94);transform-origin:50% 62%;
    background:
      radial-gradient(ellipse at 50% 40%,rgba(44,139,91,.28),transparent 58%),
      repeating-linear-gradient(115deg,rgba(255,255,255,.012) 0 1px,transparent 1px 3px),
      radial-gradient(ellipse at 50% 46%,#12613f 0%,#0b4a31 58%,#063321 82%,#031b11 100%)!important;
    border:24px solid #191a16!important;border-radius:50%;
    box-shadow:inset 0 0 0 2px #b58b45,inset 0 0 0 6px #0b1710,inset 0 0 65px #00150b,
      inset 0 -24px 30px rgba(0,0,0,.45),0 4px 0 #090a08,0 12px 0 #24231c,0 20px 0 #0a0b09,
      0 32px 34px rgba(0,0,0,.75),0 55px 70px rgba(0,0,0,.6)!important;
    overflow:visible!important}
  body.immersive-casino .table-felt:before{content:"";position:absolute;inset:4%;border:1px solid rgba(224,193,119,.22);border-radius:50%;pointer-events:none;box-shadow:inset 0 0 32px rgba(0,0,0,.12)}
  body.immersive-casino .table-felt:after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;background:
    radial-gradient(ellipse at 50% 0,rgba(255,255,255,.08),transparent 40%),
    radial-gradient(ellipse at 50% 55%,transparent 45%,rgba(0,0,0,.22) 100%);z-index:2}
  body.immersive-casino .table-rail-top{top:7%;z-index:4;color:#e4c879;text-shadow:0 2px 5px #000}
  body.immersive-casino .table-rail-top small{color:#a6ad9f}
  body.immersive-casino .dealer-badge{top:15%;z-index:5;background:linear-gradient(180deg,#20251e,#090c09);border:1px solid #a9884b;border-radius:999px;padding:7px 15px;box-shadow:0 5px 0 #050705,0 8px 14px #0008;color:#aeb8aa}
  body.immersive-casino .dealer-badge b{color:#f2d78f}
  body.immersive-casino .street-chip{top:26%;z-index:5;background:#07150dce;border:1px solid #e1bd6c55;border-radius:999px;padding:5px 10px;color:#d7c18b}
  body.immersive-casino .pot{top:39%;z-index:5;text-shadow:0 2px 7px #000}
  body.immersive-casino .community{top:49%;z-index:6;gap:8px}
  body.immersive-casino .community .card{width:65px;height:91px;font-size:25px;transform:none!important;animation:none!important;transition:none!important;box-shadow:0 7px 0 rgba(0,0,0,.22),0 13px 18px #0009;border:1px solid #ded4c0}
  body.immersive-casino .seat{z-index:7;filter:drop-shadow(0 10px 10px rgba(0,0,0,.32));transition:none!important}
  body.immersive-casino .seat.active{transform:translate(-50%,-50%)!important;filter:drop-shadow(0 10px 10px rgba(0,0,0,.4))}
  body.immersive-casino .seat-panel{background:linear-gradient(180deg,rgba(24,29,23,.98),rgba(5,8,6,.98));border:1px solid #515b4c;box-shadow:0 5px 0 #080a08,0 12px 22px #0009}
  body.immersive-casino .seat-avatar{background:radial-gradient(circle at 35% 26%,#73796a 0,#33392f 36%,#151914 72%)!important;border:2px solid #6a6c58!important;box-shadow:0 3px 0 #090a08,0 7px 12px #000!important}
  body.immersive-casino .seat.active .seat-panel{border-color:#e0bc68;box-shadow:0 0 0 1px #e0bc68,0 5px 0 #080a08,0 12px 24px #000a}
  body.immersive-casino .seat .hole .card{animation:none!important;transition:none!important;transform:none!important}
  body.immersive-casino .seat .mini-back{box-shadow:0 4px 0 #080a08,0 8px 12px #0009}
  body.immersive-casino .felt-action{top:65%;z-index:8;text-shadow:0 2px 8px #000}
  body.immersive-casino .hero-hand{bottom:2%!important;z-index:12!important;pointer-events:none!important;background:linear-gradient(180deg,rgba(10,17,11,.94),rgba(4,7,5,.97))!important;border:1px solid rgba(222,185,99,.35)!important;box-shadow:0 8px 0 rgba(0,0,0,.2),0 14px 28px #000c!important}
  body.immersive-casino .my-hand .card{animation:none!important;transition:none!important;cursor:default!important;transform:none!important;box-shadow:0 7px 0 #c5bba7,0 13px 20px #000b!important}
  body.immersive-casino .my-hand .card:first-child,
  body.immersive-casino .my-hand .card:last-child,
  body.immersive-casino .my-hand.your-turn .card:first-child,
  body.immersive-casino .my-hand.your-turn .card:last-child{transform:none!important}
  body.immersive-casino .winner,body.immersive-casino .showdown{z-index:14}
  body.immersive-casino .chip-bet-tray,
  body.immersive-casino .casino-sound-toggle,
  body.immersive-casino .action-callout,
  body.immersive-casino .casino-feedback{display:none!important}
  body.immersive-casino .bj-table{position:relative;overflow:hidden;background:
    repeating-linear-gradient(115deg,rgba(255,255,255,.012) 0 1px,transparent 1px 3px),
    radial-gradient(ellipse at 50% 35%,#12613f 0%,#0b4a31 58%,#063321 82%,#031b11 100%)!important;
    border:24px solid #191a16!important;box-shadow:inset 0 0 0 2px #b58b45,inset 0 0 0 6px #0b1710,inset 0 0 65px #00150b,0 4px 0 #090a08,0 12px 0 #24231c,0 20px 0 #0a0b09,0 32px 34px #000b!important}
  body.immersive-casino .bj-table:before{content:"";position:absolute;inset:12px;border:1px solid #e0bc6840;border-radius:22px;pointer-events:none}
  body.immersive-casino .dealer-zone{position:relative;border:0;background:linear-gradient(180deg,rgba(3,12,7,.24),transparent);border-radius:18px}
  body.immersive-casino .dealer-zone .eyebrow{display:inline-block;padding:7px 13px;background:#0a100bd9;border:1px solid #b58b4855;border-radius:999px}
  body.immersive-casino .dealer-zone .card,body.immersive-casino .bj-hand .card{animation:none!important;transition:none!important;transform:none!important;box-shadow:0 7px 0 rgba(0,0,0,.18),0 13px 18px #0009}
  body.immersive-casino .bj-board .chip-bet-tray{display:none!important}
  @media(max-width:760px){
    body.immersive-casino .poker-stage{min-height:550px;perspective:1100px}
    body.immersive-casino .table-felt{width:100%;border-width:14px!important;transform:rotateX(10deg) scaleY(.96);transform-origin:50% 60%}
    body.immersive-casino .community{gap:3px}
    body.immersive-casino .community .card{width:39px;height:56px;font-size:15px}
    body.immersive-casino .seat{min-width:94px}
    body.immersive-casino .seat-panel{padding:5px}
    body.immersive-casino .seat .mini-back{width:21px;height:30px}
    body.immersive-casino .hero-hand{bottom:2%!important;min-width:180px!important}
    body.immersive-casino .my-hand .card{width:48px;height:68px;font-size:19px}
    body.immersive-casino .bj-table{padding:24px 14px;border-width:12px!important}
  }
  @media(prefers-reduced-motion:reduce){body.immersive-casino *{scroll-behavior:auto!important;animation:none!important;transition:none!important}}
  `;
  const style=document.createElement('style');
  style.id='casino-table-scene';
  style.textContent=css;
  document.head.appendChild(style);
  document.body.classList.add('immersive-casino');
})();