import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

(() => {
  'use strict';
  const root = document.querySelector('.game-main');
  if (!root) return;

  const css = document.createElement('style');
  css.textContent = `
    .game-main{position:relative;isolation:isolate;min-height:760px!important}
    .immersive-scene{position:absolute;inset:0 0 92px;width:100%;height:calc(100% - 92px);min-height:600px;display:block;z-index:1;pointer-events:none}
    .game-main.immersive-active>.board:not(.hidden){position:relative!important;z-index:0!important;background:transparent!important;border:0!important;padding:0!important;min-height:650px}
    .game-main.immersive-active>.board:not(.hidden)>:not(.immersive-scene){visibility:hidden!important;pointer-events:none!important}
    .game-main.immersive-active>.board:not(.hidden) .table-felt,.game-main.immersive-active>.board:not(.hidden) .bj-table{visibility:hidden!important}
    .game-main>.actionbar{position:relative;z-index:3;background:rgba(7,10,8,.94)!important;border:1px solid rgba(211,178,104,.28)!important;backdrop-filter:blur(18px);box-shadow:0 14px 40px #0009}
    .game-main>.actionbar .btn{pointer-events:auto}
    .immersive-hud{position:absolute;top:18px;left:20px;right:20px;display:flex;justify-content:space-between;align-items:flex-start;z-index:2;pointer-events:none;font:800 10px/1.4 'DM Sans',sans-serif;letter-spacing:.17em;color:#e5cc8d;text-shadow:0 2px 8px #000}
    .immersive-hud .sub{display:block;color:#a7b3a6;font-size:8px;letter-spacing:.2em;margin-top:4px}
    .immersive-hud .phase{border:1px solid #d3b16a66;border-radius:999px;background:#07150edb;padding:8px 12px}
    @media(max-width:760px){.game-main{min-height:620px!important}.immersive-scene{min-height:500px}.game-main.immersive-active>.board:not(.hidden){min-height:540px}.immersive-hud{top:12px;left:12px;right:12px}.immersive-hud .sub{display:none}}
  `;
  document.head.appendChild(css);

  const canvas = document.createElement('canvas');
  canvas.className = 'immersive-scene';
  canvas.setAttribute('aria-label','Real-time 3D casino table');
  root.prepend(canvas);
  const hud = document.createElement('div');
  hud.className = 'immersive-hud';
  hud.innerHTML = '<div>GAME HUNK<span class="sub">PRIVATE CLUB · VIRTUAL TABLE</span></div><div class="phase" id="scenePhase">TABLE OPEN</div>';
  root.appendChild(hud);

  const renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true, powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#080a08');
  scene.fog = new THREE.Fog('#080a08', 13, 27);
  const camera = new THREE.PerspectiveCamera(36, 1, .1, 70);
  camera.position.set(0, 7.9, 11.7);
  camera.lookAt(0, .25, -.45);

  scene.add(new THREE.HemisphereLight(0xe7f0e4, 0x17110a, 2.0));
  const key = new THREE.SpotLight(0xffe4ad, 190, 32, Math.PI/4.2, .5, 1.3);
  key.position.set(-3.5, 9, -4.5); key.target.position.set(0,0,0); key.castShadow=true; key.shadow.mapSize.set(1024,1024); scene.add(key,key.target);
  const fill = new THREE.PointLight(0x4c9a70, 38, 18); fill.position.set(5,4,4); scene.add(fill);
  const rim = new THREE.PointLight(0xf1bf65, 46, 15); rim.position.set(0,4,-6); scene.add(rim);

  const mat=(color,roughness=.7,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
  const feltMat=new THREE.MeshStandardMaterial({color:'#075336',roughness:.96,metalness:0});
  const railMat=mat('#211c14',.34,.16), goldMat=mat('#b88d43',.27,.58), blackMat=mat('#080907',.45,.08);
  const table = new THREE.Group(); scene.add(table);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1,1,1.0,96),mat('#171914',.42,.12));
  base.scale.set(4.75,1,2.8); base.position.y=-.58; base.castShadow=true; base.receiveShadow=true; table.add(base);
  const lowerRail = new THREE.Mesh(new THREE.CylinderGeometry(1,1,.22,96),railMat);
  lowerRail.scale.set(5.08,1,3.08); lowerRail.position.y=-.12; lowerRail.castShadow=true; lowerRail.receiveShadow=true; table.add(lowerRail);
  const surface = new THREE.Mesh(new THREE.CylinderGeometry(1,1,.2,96),feltMat);
  surface.scale.set(4.83,1,2.88); surface.position.y=.015; surface.receiveShadow=true; surface.castShadow=true; table.add(surface);
  const rail = new THREE.Mesh(new THREE.TorusGeometry(1,.15,16,120),railMat);
  rail.rotation.x=Math.PI/2; rail.scale.set(4.95,2.98,1); rail.position.y=.18; rail.castShadow=true; rail.receiveShadow=true; table.add(rail);
  const goldTrim = new THREE.Mesh(new THREE.TorusGeometry(1,.026,8,120),goldMat);
  goldTrim.rotation.x=Math.PI/2; goldTrim.scale.set(4.81,2.84,1); goldTrim.position.y=.14; table.add(goldTrim);
  const innerTrim = new THREE.Mesh(new THREE.TorusGeometry(1,.012,8,120),goldMat);
  innerTrim.rotation.x=Math.PI/2; innerTrim.scale.set(4.36,2.39,1); innerTrim.position.y=.125; table.add(innerTrim);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200,200),mat('#090b09',.95));
  floor.rotation.x=-Math.PI/2; floor.position.y=-1.15; floor.receiveShadow=true; scene.add(floor);
  // Dark wood panels and warm brass inlays give the rail a real manufactured edge.
  for(let i=0;i<8;i++){
    const seam=new THREE.Mesh(new THREE.BoxGeometry(.018,.018,4.1),mat('#51402a',.5,.2));
    seam.position.set(-3.5+i, -.03, 0); table.add(seam);
  }
  // Subtle engraved table lettering, physically placed on the felt.
  function textTexture(text, opts={}) {
    const c=document.createElement('canvas'); c.width=1024;c.height=256;
    const x=c.getContext('2d'); x.clearRect(0,0,c.width,c.height);
    x.font=`700 ${opts.size||48}px Georgia, serif`;x.textAlign='center';x.textBaseline='middle';
    x.fillStyle=opts.color||'rgba(218,190,125,.44)';x.letterSpacing='9px';x.fillText(text,512,128);
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
  }
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(2.65,.66),new THREE.MeshBasicMaterial({map:textTexture('GAME HUNK'),transparent:true,depthWrite:false}));
  logo.rotation.x=-Math.PI/2;logo.position.set(0,.125,-1.93);table.add(logo);
  const subtitle = new THREE.Mesh(new THREE.PlaneGeometry(2.1,.28),new THREE.MeshBasicMaterial({map:textTexture('PRIVATE POKER CLUB',{size:27,color:'rgba(226,211,172,.36)'}),transparent:true,depthWrite:false}));
  subtitle.rotation.x=-Math.PI/2;subtitle.position.set(0,.126,-1.58);table.add(subtitle);

  const chipsGroup=new THREE.Group();scene.add(chipsGroup);
  const cardGroup=new THREE.Group();scene.add(cardGroup);
  const seatGroup=new THREE.Group();scene.add(seatGroup);
  const dealerGroup=new THREE.Group();scene.add(dealerGroup);
  const chipMaterials=['#eee6d2','#bb3d35','#2366a7','#252725','#d4a43d','#3b8a5e'].map(c=>mat(c,.31,.04));
  const chipEdge=mat('#f0e4c8',.42,.08);
  function makeChip(x,y,z,colorIndex=0,rot=0){
    const g=new THREE.Group();
    const body=new THREE.Mesh(new THREE.CylinderGeometry(.17,.17,.055,32),chipMaterials[colorIndex%chipMaterials.length]);body.castShadow=true;body.receiveShadow=true;g.add(body);
    const top=new THREE.Mesh(new THREE.CylinderGeometry(.122,.122,.057,32),mat('#f3e8d1',.38,.03));top.position.y=.002;g.add(top);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.145,.008,5,32),chipEdge);ring.rotation.x=Math.PI/2;ring.position.y=.029;g.add(ring);
    for(let j=0;j<8;j++){const stripe=new THREE.Mesh(new THREE.BoxGeometry(.036,.056,.018),chipEdge);const a=j*Math.PI/4;stripe.position.set(Math.sin(a)*.156,0,Math.cos(a)*.156);stripe.rotation.y=a;g.add(stripe)}
    g.position.set(x,y,z);g.rotation.y=rot;chipsGroup.add(g);return g;
  }
  function chipStack(x,z,count,color){
    for(let i=0;i<count;i++)makeChip(x,.17+i*.058,z,color,i*.12);
  }
  chipStack(-3.35,1.05,6,1);chipStack(-3.0,1.25,4,0);chipStack(3.2,-.65,5,2);chipStack(3.48,-.42,3,4);
  for(let i=0;i<5;i++)makeChip(-.35+i*.18,.17, -.45, i%5, i*.3);

  // The dealer is a 3D character silhouette, not a flat avatar pinned over the table.
  function mesh(geometry, material, parent, x,y,z, sx=1,sy=1,sz=1){
    const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  }
  const suit=mat('#111a1b',.62), shirt=mat('#e9e2d2',.8), skin=mat('#bd896b',.76), hair=mat('#171513',.88), tie=mat('#8c2825',.45);
  // Dealer sits beyond the far rail; torso and arms remain visible over the table.
  mesh(new THREE.CapsuleGeometry(.78,.72,5,12),suit,dealerGroup,0,.5,-3.65,1.35,1, .72);
  mesh(new THREE.CylinderGeometry(.23,.27,.48,24),skin,dealerGroup,0,1.47,-3.5,1,1,.9);
  mesh(new THREE.SphereGeometry(.55,32,24),skin,dealerGroup,0,2.0,-3.53,.92,1.06,.83);
  mesh(new THREE.SphereGeometry(.56,24,18),hair,dealerGroup,0,2.28,-3.57,.94,.62,.86);
  mesh(new THREE.BoxGeometry(.16,.06,.05),blackMat,dealerGroup,-.2,2.02,-2.82);
  mesh(new THREE.BoxGeometry(.16,.06,.05),blackMat,dealerGroup,.2,2.02,-2.82);
  mesh(new THREE.BoxGeometry(.14,.38,.09),shirt,dealerGroup,0,1.38,-3.14);
  mesh(new THREE.ConeGeometry(.11,.36,4),tie,dealerGroup,0,1.27,-3.07,1,1,1);
  const armL=mesh(new THREE.CapsuleGeometry(.16,.72,4,10),suit,dealerGroup,-.95,.72,-2.8,1,1,.82);armL.rotation.z=-.9;
  const armR=mesh(new THREE.CapsuleGeometry(.16,.72,4,10),suit,dealerGroup,.95,.72,-2.8,1,1,.82);armR.rotation.z=.9;
  mesh(new THREE.SphereGeometry(.19,16,12),skin,dealerGroup,-1.42,.33,-2.05,1,.7,.7);
  mesh(new THREE.SphereGeometry(.19,16,12),skin,dealerGroup,1.42,.33,-2.05,1,.7,.7);

  function roundedCardShape(w,h,r){
    const s=new THREE.Shape();s.moveTo(-w/2+r,-h/2);s.lineTo(w/2-r,-h/2);s.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);s.lineTo(w/2,h/2-r);s.quadraticCurveTo(w/2,h/2,w/2-r,h/2);s.lineTo(-w/2+r,h/2);s.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);s.lineTo(-w/2,-h/2+r);s.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);return s;
  }
  const cardGeo=new THREE.ExtrudeGeometry(roundedCardShape(.62,.88,.045),{depth:.018,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.009,bevelThickness:.006,curveSegments:5});
  function cardTexture(label,back=false){
    const c=document.createElement('canvas');c.width=256;c.height=360;const x=c.getContext('2d');
    x.fillStyle=back?'#f4ead7':'#fffdf5';x.fillRect(0,0,256,360);
    if(back){x.fillStyle='#182c24';x.fillRect(12,12,232,336);x.strokeStyle='#d1ad61';x.lineWidth=5;x.strokeRect(22,22,212,316);x.strokeStyle='#728d70';x.lineWidth=2;
      for(let y=35;y<325;y+=18){x.beginPath();x.moveTo(30,y);x.lineTo(226,y+12);x.stroke()}x.fillStyle='#e5c779';x.font='bold 34px Georgia';x.textAlign='center';x.fillText('GH',128,188);
    }else{
      const red=/[♥♦]/.test(label);const ink=red?'#b72e30':'#171b1a';x.fillStyle=ink;x.font='bold 52px Georgia';x.textAlign='left';x.fillText(label,17,55);
      const suitChar=label.slice(-1);x.font='bold 64px Georgia';x.fillText(suitChar,18,112);
      x.save();x.translate(256,360);x.rotate(Math.PI);x.font='bold 52px Georgia';x.fillText(label,17,55);x.font='bold 64px Georgia';x.fillText(suitChar,18,112);x.restore();
      x.font='70px Georgia';x.textAlign='center';x.fillText(suitChar,128,216);
      x.strokeStyle='#ded7c8';x.lineWidth=2;x.strokeRect(5,5,246,350);
    }
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
  }
  function addCard(label,x,z,rot=0,back=false){
    const front=cardTexture(label||'?',back), side=mat('#e0d7c4',.48);
    const m=new THREE.Mesh(cardGeo,[side,new THREE.MeshBasicMaterial({map:front})]);
    m.rotation.x=-Math.PI/2;m.rotation.z=rot;m.position.set(x,.22,z);m.castShadow=true;m.receiveShadow=true;cardGroup.add(m);return m;
  }
  function clearGroup(g){while(g.children.length){const o=g.children[g.children.length-1];g.remove(o);o.traverse?.(v=>{if(v.material){const ms=Array.isArray(v.material)?v.material:[v.material];ms.forEach(m=>{if(m.map)m.map.dispose()})}})}}
  function labelSprite(text, color='#f4e7c2'){
    const c=document.createElement('canvas');c.width=512;c.height=128;const x=c.getContext('2d');
    x.fillStyle='rgba(8,12,9,.88)';x.strokeStyle='rgba(201,168,94,.72)';x.lineWidth=4;
    x.beginPath();x.roundRect(8,8,496,112,24);x.fill();x.stroke();x.fillStyle=color;x.font='bold 36px Arial';x.textAlign='center';x.textBaseline='middle';x.fillText(String(text).slice(0,24),256,64);
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true,depthTest:false}));sp.scale.set(1.65,.42,1);return sp;
  }
  function rebuildSeats(){
    clearGroup(seatGroup);
    const nodes=[...document.querySelectorAll('#seats .seat')];
    nodes.forEach((el,i)=>{
      const n=Math.max(1,nodes.length),mineIndex=Math.max(0,nodes.findIndex(e=>e.classList.contains('mine'))),a=((i-mineIndex)/n)*Math.PI*2;
      const x=Math.sin(a)*3.85,z=Math.cos(a)*2.05;
      const isMine=el.classList.contains('mine'), active=el.classList.contains('active');
      const pedestal=mesh(new THREE.CylinderGeometry(.24,.32,.5,24),mat(isMine?'#a7833e':'#252821',.5,.12),seatGroup,x,.33,z,.9,1,.9);
      const cushion=mesh(new THREE.CylinderGeometry(.48,.52,.14,32),mat(isMine?'#3a2820':'#17211b',.6),seatGroup,x,.64,z,.95,1,.9);
      const back=mesh(new THREE.CapsuleGeometry(.39,.6,4,10),mat('#1c201a',.48),seatGroup,x,.98,z+(z>0?.42:-.42),1,.8,.55);
      back.rotation.x=z>0?-.2:.2;
      const lab=labelSprite((el.querySelector('.seat-name')?.textContent||'PLAYER').trim(),active?'#ffdb84':'#f4e7c2');
      lab.position.set(x,1.48,z+(z>0?.56:-.5));seatGroup.add(lab);
      const stack=el.querySelector('.seat-chips b')?.textContent;
      if(stack){for(let k=0;k<3;k++)makeChip(x+(k-1)*.15,.18+k*.058,z+(z>0?-.6:.6),isMine?4:([0,1,2,3,4][i%5]));}
    });
  }

  function getCards(selector){return [...document.querySelectorAll(selector)].flatMap(el=>[...el.querySelectorAll('.card')].map(c=>({label:(c.textContent||'').trim().replace(/\s+/g,' ')||'?',back:c.classList.contains('back')})));}
  let signature='',lastRender=0,gameType='poker',lastSeatSig='';
  function syncScene(force=false){
    const pokerVisible=!document.querySelector('#pokerBoard')?.classList.contains('hidden');
    const bjVisible=!document.querySelector('#blackjackBoard')?.classList.contains('hidden');
    const active=pokerVisible||bjVisible;root.classList.toggle('immersive-active',active);canvas.style.display=active?'block':'none';hud.style.display=active?'flex':'none';
    if(!active)return;
    gameType=bjVisible?'blackjack':'poker';
    const phase=(document.querySelector('#streetChip')?.textContent||document.querySelector('#bjActions .turn-badge')?.textContent||'TABLE OPEN').trim();
    const phaseEl=document.querySelector('#scenePhase');if(phaseEl)phaseEl.textContent=phase;
    const cards=gameType==='blackjack'
      ? [...getCards('#dealerCards'),...getCards('#bjHands .bj-hand .cards')]
      : [...getCards('#community'),...getCards('#myHand'),...getCards('#seats .hole')];
    const seatSig=[...document.querySelectorAll('#seats .seat')].map(e=>e.textContent).join('|');
    const sig=gameType+'|'+phase+'|'+cards.map(c=>c.label+(c.back?'b':'f')).join(',');
    if(!force&&sig===signature&&seatSig===lastSeatSig)return;
    const seatsChanged=force||seatSig!==lastSeatSig;lastSeatSig=seatSig;signature=sig;
    clearGroup(chipsGroup);rebuildSeats();
    clearGroup(cardGroup);
    if(gameType==='poker'){
      const community=getCards('#community');community.forEach((c,i)=>addCard(c.label,-1.24+i*.62,-.35,(i-2)*.018,c.back));
      const mine=getCards('#myHand');mine.forEach((c,i)=>addCard(c.label,-.37+i*.66,1.35,(i-.5)*.08,c.back));
      const seats=[...document.querySelectorAll('#seats .seat')];
      seats.forEach((el,i)=>{
        const n=Math.max(1,seats.length),mineIndex=Math.max(0,seats.findIndex(e=>e.classList.contains('mine'))),a=((i-mineIndex)/n)*Math.PI*2,x=Math.sin(a)*3.15,z=Math.cos(a)*1.65;
        getCards('#seats .seat:nth-child('+(i+1)+') .hole').forEach((c,j)=>addCard(c.label,x+(j-.5)*.34,z,(j-.5)*.08,c.back));
      });
      // Place the pot in a visible physical stack at the center of the felt.
      for(let i=0;i<7;i++)makeChip(-.48+(i%4)*.16,.18+Math.floor(i/4)*.058,-.95,i%5);
    }else{
      const dealer=getCards('#dealerCards');dealer.forEach((c,i)=>addCard(c.label,-.42+i*.66,-1.4,(i-.5)*.04,c.back));
      const hands=[...document.querySelectorAll('#bjHands .bj-hand')];
      hands.slice(0,4).forEach((el,idx)=>getCards('#bjHands .bj-hand:nth-child('+(idx+1)+') .cards').forEach((c,i)=>addCard(c.label,-1.25+i*.54+(idx%2)*2.4,.85+Math.floor(idx/2)*.7,(i-.5)*.035,c.back)));
      for(let i=0;i<5;i++)makeChip(-.4+i*.16,.18,-.55,i%5);
    }
  }

  function resize(){
    const r=root.getBoundingClientRect(),w=Math.max(320,r.width),h=Math.max(500,Math.min(790,r.height-80||680));
    renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
    canvas.style.width='100%';canvas.style.height=h+'px';
  }
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(root);window.addEventListener('resize',resize);
  const observer=new MutationObserver(()=>{if(performance.now()-lastRender>80){lastRender=performance.now();syncScene()}});
  observer.observe(root,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','style']});
  resize();syncScene(true);
  const clock=new THREE.Clock();
  function animate(){
    requestAnimationFrame(animate);
    const t=clock.getElapsedTime();
    // Gentle light breathing and a tiny table-side camera drift add life without moving the cards.
    fill.intensity=36+Math.sin(t*.6)*2;
    camera.position.x=Math.sin(t*.12)*.055;
    camera.lookAt(0,.2,-.45);
    renderer.render(scene,camera);
  }
  animate();
  window.addEventListener('beforeunload',()=>{observer.disconnect();resizeObserver.disconnect();renderer.dispose()});
})();