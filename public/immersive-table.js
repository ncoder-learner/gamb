import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

(() => {
  'use strict';
  const root = document.querySelector('.game-main');
  if (!root) return;

  const css = document.createElement('style');
  css.textContent = `
    .game-main{position:relative;isolation:isolate;min-height:760px!important}
    .immersive-scene{position:absolute;inset:0 0 92px;width:100%;height:calc(100% - 92px);min-height:600px;display:block;z-index:1;pointer-events:none}
    .game-main.immersive-active>.board:not(.hidden){position:relative!important;z-index:2!important;background:transparent!important;border:0!important;padding:0!important;min-height:650px}
    .game-main.immersive-active>.poker-board .poker-stage{background:transparent!important;perspective:none!important}.game-main.immersive-active .table-shadow,.game-main.immersive-active .casino-ambient{display:none!important}.game-main.immersive-active .table-felt{background:transparent!important;border-color:transparent!important;box-shadow:none!important;transform:none!important}.game-main.immersive-active .table-felt:after{display:none!important}.game-main.immersive-active .bj-table{background:transparent!important;border:0!important;box-shadow:none!important}.game-main.immersive-active .community .card,.game-main.immersive-active .my-hand .card,.game-main.immersive-active .seat .hole .card,.game-main.immersive-active #dealerCards .card,.game-main.immersive-active #bjHands .card{visibility:hidden!important}
    .game-main.immersive-active>.board:not(.hidden) .table-felt,.game-main.immersive-active>.board:not(.hidden) .bj-table{visibility:hidden!important}
    .game-main.immersive-active .hero-hand,.game-main.immersive-active .winner,.game-main.immersive-active .winner *,.game-main.immersive-active .showdown,.game-main.immersive-active .showdown *,.game-main.immersive-active .post-game,.game-main.immersive-active .post-game *,.game-main.immersive-active .street-chip,.game-main.immersive-active .pot,.game-main.immersive-active .dealer-badge,.game-main.immersive-active .felt-action{visibility:visible!important}
    .game-main.immersive-active .winner{position:absolute!important;z-index:12!important;top:47%!important;left:50%!important;transform:translate(-50%,-50%)!important;width:min(520px,92%)!important;max-height:34%!important;overflow:auto!important;text-align:center!important;pointer-events:none!important}
    .game-main.immersive-active .result-banner{display:flex;flex-direction:column;align-items:center;gap:5px;margin:0 auto 8px;padding:12px 18px;border:1px solid rgba(224,192,117,.65);border-radius:14px;background:rgba(5,12,8,.94);box-shadow:0 10px 36px #0009;color:#f7f0df;letter-spacing:.04em}
    .game-main.immersive-active .result-banner strong{font-size:clamp(16px,2.2vw,25px);letter-spacing:.12em;color:#f3d58f}
    .game-main.immersive-active .result-banner span{font-size:12px;color:#d3d9ce}
    .game-main.immersive-active .result-banner.you-lost strong{color:#f0b4a6}
    .game-main.immersive-active .winner-card{display:inline-flex;flex-direction:column;gap:3px;margin:3px;padding:8px 11px;border:1px solid #d3b16a55;border-radius:10px;background:#07120ee8;color:#eee6d5;font-size:11px}
    .game-main.immersive-active .showdown.visible{position:absolute!important;z-index:11!important;left:50%!important;top:66%!important;transform:translateX(-50%)!important;width:min(680px,94%)!important;max-height:17%!important;overflow:auto!important;padding:8px 10px!important;border:1px solid #d3b16a66!important;border-radius:12px!important;background:rgba(4,10,7,.91)!important;color:#eee6d5!important;pointer-events:auto!important}
    .game-main.immersive-active .post-game:not(.hidden){position:absolute!important;z-index:15!important;left:50%!important;top:88%!important;transform:translate(-50%,-50%)!important;display:flex!important;gap:8px!important;visibility:visible!important}
    .game-main.immersive-active .post-game:not(.hidden) .btn{white-space:nowrap;pointer-events:auto!important}
    .game-main.immersive-active #pot{top:33%!important;left:50%!important;z-index:4!important;min-width:82px;padding:4px 10px;border:1px solid rgba(196,159,86,.35);border-radius:999px;background:rgba(4,13,9,.72);box-shadow:0 5px 18px #0005;font-size:8px!important;line-height:1.1;letter-spacing:.16em!important;pointer-events:none}
    .game-main.immersive-active #pot b{font-size:15px!important;line-height:1.1;margin-top:2px}
    .game-main.immersive-active #streetChip{top:27%!important;z-index:4!important;padding:5px 10px;border-radius:999px;background:rgba(4,13,9,.58);border:1px solid rgba(196,159,86,.25)}
    .game-main.immersive-active #blackjackBoard{min-height:650px!important}
    .game-main.immersive-active #bjHands{display:none!important}
    .game-main.immersive-active .dealer-zone{visibility:hidden!important}
    .game-main.immersive-active #dealerCards{visibility:hidden!important}
    @media(max-width:760px){.game-main.immersive-active .winner{top:48%!important;max-height:32%!important}.game-main.immersive-active .showdown.visible{top:67%!important;max-height:16%!important}.game-main.immersive-active .post-game:not(.hidden){top:88%!important}.game-main.immersive-active .winner-card{padding:5px 7px;font-size:10px}}
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
  const camera = new THREE.PerspectiveCamera(58, 1, .1, 70);
  camera.position.set(0, 2.15, 6.8);
  camera.lookAt(0, .12, .05);

  scene.add(new THREE.HemisphereLight(0xe7f0e4, 0x17110a, 2.0));
  const key = new THREE.SpotLight(0xffe4ad, 190, 32, Math.PI/4.2, .5, 1.3);
  key.position.set(-3.5, 9, -4.5); key.target.position.set(0,0,0); key.castShadow=true; key.shadow.mapSize.set(1024,1024); scene.add(key,key.target);
  const fill = new THREE.PointLight(0x4c9a70, 38, 18); fill.position.set(5,4,4); scene.add(fill);
  const rim = new THREE.PointLight(0xf1bf65, 46, 15); rim.position.set(0,4,-6); scene.add(rim);

  const mat=(color,roughness=.7,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
  const feltCanvas=document.createElement('canvas');feltCanvas.width=1024;feltCanvas.height=1024;const feltCtx=feltCanvas.getContext('2d');
  const feltGradient=feltCtx.createRadialGradient(512,480,90,512,512,720);feltGradient.addColorStop(0,'#0b6844');feltGradient.addColorStop(.62,'#075237');feltGradient.addColorStop(1,'#032c1c');feltCtx.fillStyle=feltGradient;feltCtx.fillRect(0,0,1024,1024);
  let feltSeed=82417;const rand=()=>{feltSeed=(feltSeed*1664525+1013904223)>>>0;return feltSeed/4294967296};
  for(let i=0;i<54000;i++){const x=rand()*1024,y=rand()*1024,a=.018+rand()*.055;feltCtx.strokeStyle=rand()>.5?`rgba(218,231,207,${a})`:`rgba(0,0,0,${a*1.3})`;feltCtx.lineWidth=.45+rand()*.8;feltCtx.beginPath();feltCtx.moveTo(x,y);feltCtx.lineTo(x+(rand()-.5)*5,y+1+rand()*3);feltCtx.stroke()}
  feltCtx.globalAlpha=.14;feltCtx.strokeStyle='#b7c8a8';feltCtx.lineWidth=1;for(let y=0;y<1024;y+=6){feltCtx.beginPath();feltCtx.moveTo(0,y);feltCtx.lineTo(1024,y);feltCtx.stroke()}feltCtx.globalAlpha=1;
  const feltTexture=new THREE.CanvasTexture(feltCanvas);feltTexture.wrapS=feltTexture.wrapT=THREE.RepeatWrapping;feltTexture.repeat.set(1.35,1.35);feltTexture.colorSpace=THREE.SRGBColorSpace;feltTexture.anisotropy=8;
  const feltNormalCanvas=document.createElement('canvas');feltNormalCanvas.width=256;feltNormalCanvas.height=256;const fn= feltNormalCanvas.getContext('2d');fn.fillStyle='rgb(128,128,255)';fn.fillRect(0,0,256,256);let ns=44821;for(let i=0;i<12000;i++){ns=(ns*1664525+1013904223)>>>0;const x=ns%256;ns=(ns*1664525+1013904223)>>>0;const y=ns%256;const v=112+(ns%32);fn.fillStyle=`rgb(${v},${v},255)`;fn.fillRect(x,y,1,1)}const feltNormal=new THREE.CanvasTexture(feltNormalCanvas);feltNormal.wrapS=feltNormal.wrapT=THREE.RepeatWrapping;feltNormal.repeat.set(2,2);
  const feltMat=new THREE.MeshStandardMaterial({color:'#ffffff',map:feltTexture,normalMap:feltNormal,normalScale:new THREE.Vector2(.28,.28),roughness:.96,metalness:0});
  // Optional CC0 Stretch Poplin PBR maps from Poly Haven provide actual woven-fiber detail; procedural felt stays as the offline fallback.
  const railMat=mat('#ffffff',.34,.16), goldMat=mat('#b88d43',.27,.58), blackMat=mat('#080907',.45,.08);
  // CC0 PBR surface maps from Poly Haven: wood_table_001 for the rail and wood_floor_02 for the room floor.
  // Procedural felt remains the fallback, so the table still renders if the asset CDN is unavailable.
  const pbrLoader=new THREE.TextureLoader();pbrLoader.setCrossOrigin('anonymous');
  function loadPolyHaven(asset,mapName,onLoad,repeatX=2,repeatY=1){const url=`https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/${asset}/${asset}_${mapName}_1k.jpg`;pbrLoader.load(url,tex=>{tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(repeatX,repeatY);tex.anisotropy=8;if(mapName==='diff')tex.colorSpace=THREE.SRGBColorSpace;onLoad(tex)},undefined,()=>{});}

  loadPolyHaven('stretch_poplin','diff',t=>{feltMat.map=t;feltMat.color.set('#5b9369');feltMat.needsUpdate=true},4,4);
  loadPolyHaven('stretch_poplin','nor_gl',t=>{feltMat.normalMap=t;feltMat.normalScale=new THREE.Vector2(.34,.34);feltMat.needsUpdate=true},4,4);
  loadPolyHaven('stretch_poplin','rough',t=>{feltMat.roughnessMap=t;feltMat.needsUpdate=true},4,4);
  loadPolyHaven('wood_table_001','diff',t=>{railMat.map=t;railMat.color.set('#ffffff');railMat.needsUpdate=true},2,1);
  loadPolyHaven('wood_table_001','nor_gl',t=>{railMat.normalMap=t;railMat.normalScale=new THREE.Vector2(.24,.24);railMat.needsUpdate=true},2,1);
  loadPolyHaven('wood_table_001','rough',t=>{railMat.roughnessMap=t;railMat.needsUpdate=true},2,1);
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
  const bettingArc=new THREE.Mesh(new THREE.TorusGeometry(1,.009,6,128),mat('#9c7738',.48,.38));bettingArc.rotation.x=Math.PI/2;bettingArc.scale.set(3.28,1.72,1);bettingArc.position.set(0,.121,-.03);table.add(bettingArc);
  const logoCanvas=document.createElement('canvas');logoCanvas.width=512;logoCanvas.height=128;const logoCtx=logoCanvas.getContext('2d');logoCtx.clearRect(0,0,512,128);logoCtx.textAlign='center';logoCtx.textBaseline='middle';logoCtx.font='700 34px Georgia';logoCtx.fillStyle='rgba(214,181,111,.32)';logoCtx.fillText('GAME HUNK  •  PRIVATE CLUB',256,64);const logoTexture=new THREE.CanvasTexture(logoCanvas);logoTexture.colorSpace=THREE.SRGBColorSpace;const tableLogo=new THREE.Mesh(new THREE.PlaneGeometry(2.35,.42),new THREE.MeshBasicMaterial({map:logoTexture,transparent:true,depthWrite:false,side:THREE.DoubleSide}));tableLogo.rotation.x=-Math.PI/2;tableLogo.position.set(0,.122,-1.72);table.add(tableLogo);

  const floorMat=mat('#17130e',.9);floorMat.color.set('#5b4934');loadPolyHaven('wood_table_001','diff',t=>{floorMat.map=t;floorMat.needsUpdate=true},80,80);loadPolyHaven('wood_table_001','nor_gl',t=>{floorMat.normalMap=t;floorMat.normalScale=new THREE.Vector2(.18,.18);floorMat.needsUpdate=true},80,80);loadPolyHaven('wood_table_001','rough',t=>{floorMat.roughnessMap=t;floorMat.needsUpdate=true},80,80);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200,200),floorMat);
  floor.rotation.x=-Math.PI/2; floor.position.y=-1.15; floor.receiveShadow=true; scene.add(floor);
  // Build a real room around the table instead of leaving the scene in a black void.
  const backWall=new THREE.Mesh(new THREE.PlaneGeometry(18,7),mat('#171713',.88));
  backWall.position.set(0,2.1,-7.2);scene.add(backWall);
  const wallWood=[mat('#29251d',.55),mat('#211e18',.62),mat('#30291e',.52)];
  for(let i=0;i<13;i++){
    const x=-7.2+i*1.2;
    const panel=new THREE.Mesh(new THREE.BoxGeometry(1.08,4.9,.12),wallWood[i%wallWood.length]);
    panel.position.set(x,1.7,-7.08);panel.castShadow=true;panel.receiveShadow=true;scene.add(panel);
    const inlay=new THREE.Mesh(new THREE.BoxGeometry(.018,4.2,.025),goldMat);
    inlay.position.set(x+.51,1.7,-6.99);scene.add(inlay);
  }
  const wallSconceMat=mat('#e7c982',.25,.35);
  for(const x of [-5.4,5.4]){
    const fixture=new THREE.Mesh(new THREE.CylinderGeometry(.12,.18,.42,16),wallSconceMat);
    fixture.position.set(x,3.15,-6.85);scene.add(fixture);
    const glow=new THREE.PointLight(0xffd38a,34,8,2);glow.position.set(x,3.0,-6.2);scene.add(glow);
  }
  for(let i=0;i<5;i++){
    const brass=new THREE.Mesh(new THREE.BoxGeometry(.72,.035,.035),goldMat);
    brass.position.set(-2.4+i*1.2,3.7,-6.96);scene.add(brass);
  }
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
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(2.65,.66),new THREE.MeshBasicMaterial({map:textTexture('GAME HUNK',{size:58,color:'rgba(238,211,145,.72)'}),transparent:true,depthWrite:false}));
  logo.rotation.x=-Math.PI/2;logo.position.set(0,.125,-1.93);table.add(logo);
  const subtitle = new THREE.Mesh(new THREE.PlaneGeometry(2.1,.28),new THREE.MeshBasicMaterial({map:textTexture('PRIVATE POKER CLUB',{size:27,color:'rgba(226,211,172,.36)'}),transparent:true,depthWrite:false}));
  subtitle.rotation.x=-Math.PI/2;subtitle.position.set(0,.126,-1.58);table.add(subtitle);

  const chipsGroup=new THREE.Group();scene.add(chipsGroup);
  const cardGroup=new THREE.Group();scene.add(cardGroup);
  const cardFlights=[];
  let previousCardKeys=new Set();
  const seatGroup=new THREE.Group();scene.add(seatGroup);
  const dealerGroup=new THREE.Group();scene.add(dealerGroup);
  const seatArmRefs=new Map();
  const chipMaterials=['#e7d9b8','#bd342e','#2566b1','#252725','#d2a23d','#31855a'].map(c=>mat(c,.72,.015));
  const chipEdge=mat('#f0e4c8',.42,.08);
  function makeChip(x,y,z,colorIndex=0,rot=0){
    const g=new THREE.Group();
    const body=new THREE.Mesh(new THREE.CylinderGeometry(.17,.17,.055,32),chipMaterials[colorIndex%chipMaterials.length]);body.castShadow=true;body.receiveShadow=true;g.add(body);
    const top=new THREE.Mesh(new THREE.CylinderGeometry(.122,.122,.057,32),mat(['#f4e9d2','#e8c8c2','#c5d8ed','#d3d2ca','#f1dfa9','#c5dfcc'][colorIndex%6],.76,.01));top.position.y=.002;g.add(top);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.145,.008,5,32),chipEdge);ring.rotation.x=Math.PI/2;ring.position.y=.029;g.add(ring);
    for(let j=0;j<8;j++){const stripe=new THREE.Mesh(new THREE.BoxGeometry(.036,.056,.018),chipEdge);const a=j*Math.PI/4;stripe.position.set(Math.sin(a)*.156,0,Math.cos(a)*.156);stripe.rotation.y=a;g.add(stripe)}
    g.position.set(x,y,z);g.rotation.y=rot;chipsGroup.add(g);return g;
  }

  function addChipMark(x,y,z,colorIndex){
    const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;const ctx=canvas.getContext('2d');
    ctx.clearRect(0,0,128,128);ctx.strokeStyle='rgba(255,255,255,.9)';ctx.lineWidth=5;ctx.beginPath();ctx.arc(64,64,47,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle='#fffaf0';ctx.font='bold 39px Georgia';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(['1','5','25','100','500','1K'][colorIndex%6],64,65);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    const mark=new THREE.Mesh(new THREE.PlaneGeometry(.19,.19),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false}));mark.rotation.x=-Math.PI/2;mark.position.set(x,y,z);chipsGroup.add(mark);
  }

  function chipStack(x,z,count,color){
    for(let i=0;i<count;i++){makeChip(x,.17+i*.058,z,color,i*.12);if(i===count-1)addChipMark(x,.17+(count-1)*.058+.03,z,color);}
  }
  chipStack(-3.35,1.05,6,1);chipStack(-3.0,1.25,4,0);chipStack(3.2,-.65,5,2);chipStack(3.48,-.42,3,4);
  for(let i=0;i<5;i++)makeChip(-.35+i*.18,.17, -.45, i%5, i*.3);

  // The dealer is a 3D character silhouette, not a flat avatar pinned over the table.
  function mesh(geometry, material, parent, x,y,z, sx=1,sy=1,sz=1){
    const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  }
  const suit=mat('#111a1b',.48), shirt=mat('#e9e2d2',.72), skin=mat('#bd896b',.62), hair=mat('#171513',.76), tie=mat('#8c2825',.38);
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
  const cardGeo=new THREE.ExtrudeGeometry(roundedCardShape(.72,.98,.05),{depth:.022,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.01,bevelThickness:.007,curveSegments:7});
  function cardTexture(label,back=false){
    const c=document.createElement('canvas');c.width=256;c.height=360;const x=c.getContext('2d');
    x.fillStyle=back?'#f4ead7':'#fffdf5';x.fillRect(0,0,256,360);
    if(back){x.fillStyle='#10251d';x.fillRect(12,12,232,336);x.strokeStyle='#c8a45e';x.lineWidth=5;x.strokeRect(22,22,212,316);x.strokeStyle='rgba(207,177,111,.8)';x.lineWidth=1.6;
      for(let y=28;y<332;y+=16){for(let xx=28;xx<236;xx+=16){x.beginPath();x.moveTo(xx,y+8);x.lineTo(xx+8,y);x.lineTo(xx+16,y+8);x.lineTo(xx+8,y+16);x.closePath();x.stroke()}}x.strokeStyle='#d8bd7a';x.lineWidth=3;x.strokeRect(75,137,106,86);x.strokeRect(83,145,90,70);x.fillStyle='#e7d29a';x.font='bold 34px Georgia';x.textAlign='center';x.fillText('GH',128,188);
    }else{
      const red=/[♥♦]/.test(label);const ink=red?'#b72e30':'#171b1a';x.fillStyle=ink;x.font='bold 76px Georgia';x.textAlign='left';x.fillText(label,18,76);
      const suitChar=label.slice(-1);x.font='bold 88px Georgia';x.fillText(suitChar,18,157);
      x.save();x.translate(256,360);x.rotate(Math.PI);x.font='bold 76px Georgia';x.fillText(label,18,76);x.font='bold 88px Georgia';x.fillText(suitChar,18,157);x.restore();
      x.font='108px Georgia';x.textAlign='center';x.fillText(suitChar,128,226);
      x.strokeStyle='#ded7c8';x.lineWidth=2;x.strokeRect(5,5,246,350);
    }
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
  }
  function addCard(label,x,z,rot=0,back=false,animateDeal=false){
    const front=cardTexture(label||'?',back), side=mat('#e0d7c4',.48);
    // Keep the beveled card body and use a separate plane for the printed face.
    // ExtrudeGeometry's default UVs are world-unit based, which can crop a CanvasTexture.
    const card=new THREE.Group();
    card.position.set(x,.37,z);card.rotation.set(-Math.PI/2+.58,rot,0);
    const body=new THREE.Mesh(cardGeo,side);
    body.castShadow=true;body.receiveShadow=true;card.add(body);
    const face=new THREE.Mesh(
      new THREE.PlaneGeometry(.675,.935),
      new THREE.MeshBasicMaterial({map:front,side:THREE.DoubleSide,toneMapped:false})
    );
    face.position.z=.03;face.receiveShadow=true;card.add(face);
    cardGroup.add(card);
    if(animateDeal){
      const targetPosition=card.position.clone(),targetRotation=card.rotation.clone();
      card.position.set(0,.72,-2.35);card.rotation.set(-Math.PI/2+.95,0,0);
      cardFlights.push({card,targetPosition,targetRotation,start:performance.now()+cardFlights.length*105,duration:360});
    }
    return card;
  }
  function clearGroup(g){while(g.children.length){const o=g.children[g.children.length-1];g.remove(o);o.traverse?.(v=>{if(v.material){const ms=Array.isArray(v.material)?v.material:[v.material];ms.forEach(m=>{if(m.map)m.map.dispose()})}})}}
  function labelSprite(text, color='#f4e7c2'){
    const c=document.createElement('canvas');c.width=512;c.height=128;const x=c.getContext('2d');
    x.fillStyle='rgba(8,12,9,.88)';x.strokeStyle='rgba(201,168,94,.72)';x.lineWidth=4;
    x.beginPath();x.roundRect(8,8,496,112,24);x.fill();x.stroke();x.fillStyle=color;x.font='bold 36px Arial';x.textAlign='center';x.textBaseline='middle';x.fillText(String(text).slice(0,24),256,64);
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true,depthTest:true,depthWrite:false}));sp.scale.set(1.65,.42,1);return sp;
  }
  function rebuildSeats(){
    clearGroup(seatGroup);seatArmRefs.clear();
    const nodes=gameType==='poker'?[...document.querySelectorAll('#seats .seat')]:[];
    const skins=['#c58d6d','#8e5d43','#e0b18b','#ad7659','#d39a73','#77513e','#edc5a0','#9b684d'];
    const jackets=['#202c2a','#312d29','#283441','#3b2926','#26352d','#332d3c','#222927','#40332a'];
    const hairs=['#181513','#35271e','#101314','#3a2419','#1b1b1b','#513a2b','#24201b','#161616'];
    nodes.forEach((el,i)=>{
      const n=Math.max(1,nodes.length),mineIndex=Math.max(0,nodes.findIndex(e=>e.classList.contains('mine'))),a=((i-mineIndex)/n)*Math.PI*2;
      const x=Math.sin(a)*3.85,z=Math.cos(a)*2.05;
      const isMine=el.classList.contains('mine'),active=el.classList.contains('active');
      // First-person view: never render the local player's chair in front of their camera.
      if(!isMine){
        mesh(new THREE.CylinderGeometry(.24,.32,.5,24),mat('#252821',.5,.12),seatGroup,x,.33,z,.9,1,.9);
        mesh(new THREE.CylinderGeometry(.48,.52,.14,32),mat('#17211b',.6),seatGroup,x,.64,z,.95,1,.9);
        const back=mesh(new THREE.CapsuleGeometry(.39,.6,4,10),mat('#1c201a',.48),seatGroup,x,.98,z+(z>0?.42:-.42),1,.8,.55);
        back.rotation.x=z>0?-.2:.2;
      }
      if(!isMine){
        const lab=labelSprite((el.querySelector('.seat-name')?.textContent||'PLAYER').trim(),active?'#ffdb84':'#f4e7c2');
        lab.position.set(x,1.38,z+(z>0?-.62:-.5));seatGroup.add(lab);
      }
      if(!isMine){
        const avatar=new THREE.Group();avatar.position.set(x,.58,z+(z>0?.42:-.42));avatar.rotation.y=Math.atan2(-x,-z);seatGroup.add(avatar);
        const skinMat=mat(skins[i%skins.length],.61),hairMat=mat(hairs[i%hairs.length],.74),jacketMat=mat(jackets[i%jackets.length],.58),shirtMat=mat(i%3===0?'#e8e0d2':i%3===1?'#d8d7cf':'#bfc7bd',.7);
        mesh(new THREE.CapsuleGeometry(.42,.54,6,14),jacketMat,avatar,0,.52,0,1.25,1,.72);
        mesh(new THREE.CylinderGeometry(.13,.15,.28,18),skinMat,avatar,0,.98,.02);
        mesh(new THREE.SphereGeometry(.36,40,32),skinMat,avatar,0,1.34,.04,.88,1.08,.88);
        mesh(new THREE.SphereGeometry(.37,32,24),hairMat,avatar,0,1.54,-.015,.98,.58,.92);
        mesh(new THREE.SphereGeometry(.16,20,16),hairMat,avatar,-.31,1.42,.005,.55,1.2,.72);
        mesh(new THREE.SphereGeometry(.16,20,16),hairMat,avatar,.31,1.42,.005,.55,1.2,.72);
        mesh(new THREE.BoxGeometry(.22,.18,.035),shirtMat,avatar,0,.83,.27,1,1,1);
        mesh(new THREE.SphereGeometry(.065,16,12),skinMat,avatar,-.34,1.31,.035,.65,1,1);
        mesh(new THREE.SphereGeometry(.065,16,12),skinMat,avatar,.34,1.31,.035,.65,1,1);
        const eyeMat=mat('#151412',.35),eyeWhite=mat('#eee8dc',.4);
        mesh(new THREE.SphereGeometry(.038,12,8),eyeWhite,avatar,-.115,1.38,.345,1,.75,.6);
        mesh(new THREE.SphereGeometry(.038,12,8),eyeWhite,avatar,.115,1.38,.345,1,.75,.6);
        mesh(new THREE.SphereGeometry(.019,12,10),eyeMat,avatar,-.11,1.38,.368);
        mesh(new THREE.SphereGeometry(.019,12,10),eyeMat,avatar,.12,1.38,.368);
        mesh(new THREE.CapsuleGeometry(.025,.11,4,8),hairMat,avatar,-.115,1.435,.355,1,.55,.55);
        mesh(new THREE.CapsuleGeometry(.025,.11,4,8),hairMat,avatar,.115,1.435,.355,1,.55,.55);
        mesh(new THREE.ConeGeometry(.048,.12,12),skinMat,avatar,0,1.27,.385,1,.85,.8);
        mesh(new THREE.BoxGeometry(.11,.018,.018),mat('#713e37',.56),avatar,0,1.18,.35);
        const armL=new THREE.Group(),armR=new THREE.Group();avatar.add(armL,armR);
        armL.position.set(-.43,.78,.02);armR.position.set(.43,.78,.02);
        const limbGeo=new THREE.CapsuleGeometry(.135,.5,5,10),handGeo=new THREE.SphereGeometry(.13,14,10);
        const l1=new THREE.Mesh(limbGeo,jacketMat),r1=new THREE.Mesh(limbGeo,jacketMat);
        l1.rotation.x=Math.PI/2;r1.rotation.x=Math.PI/2;l1.position.z=.22;r1.position.z=.22;armL.add(l1);armR.add(r1);
        const l2=new THREE.Mesh(handGeo,skinMat),r2=new THREE.Mesh(handGeo,skinMat);
        l2.position.set(0,-.04,.53);r2.position.set(0,-.04,.53);l2.scale.set(1,.72,1.25);r2.scale.set(1,.72,1.25);armL.add(l2);armR.add(r2);
        [l1,r1,l2,r2].forEach(o=>{o.castShadow=true;o.receiveShadow=true});
        seatArmRefs.set(i,{armL,armR,baseL:{y:armL.position.y,z:armL.position.z},baseR:{y:armR.position.y,z:armR.position.z}});
      }
      const stack=Number((el.querySelector('.seat-chips b')?.textContent||'0').replace(/[^0-9.-]/g,''))||0;
      const stackCount=stack>0?Math.max(1,Math.min(7,Math.ceil(Math.log10(stack+1)*1.65))):0;
      const stackColor=stack>=10000?4:stack>=2500?3:stack>=500?2:stack>=100?1:0;
      if(stackCount)chipStack(x+(isMine?0:(x<0?-.42:.42)),z+(z>0?-.62:.62),stackCount,stackColor);
      const bet=Number((el.querySelector('.seat-bet')?.textContent||'').replace(/[^0-9.-]/g,''))||0;
      if(bet>0)chipStack(x,z+(z>0?-.96:.96),Math.max(1,Math.min(4,Math.ceil(Math.log10(bet+1)))),2);
    });
  }

  function getCards(selector){return [...document.querySelectorAll(selector)].flatMap(el=>[...el.querySelectorAll('.card')].map(c=>({label:(c.textContent||'').trim().replace(/\s+/g,' ')||'?',back:c.classList.contains('back')})));}
  let signature='',lastRender=0,gameType='poker',lastSeatSig='';

  // Player-side forearms and hands enter frame from the seated first-person viewpoint.
  const actionFxGroup = new THREE.Group(); scene.add(actionFxGroup);
  const heroArm = new THREE.Group(); scene.add(heroArm);
  const sleeveMat = mat('#202723',.72), cuffMat = mat('#c9b98f',.7), handMat = mat('#b98362',.8);
  const heroSleeve = new THREE.Mesh(new THREE.CapsuleGeometry(.19,.95,5,12),sleeveMat);
  heroSleeve.rotation.x = -Math.PI/2; heroSleeve.position.set(.23,0,.12); heroSleeve.castShadow=true; heroArm.add(heroSleeve);
  const heroCuff = new THREE.Mesh(new THREE.CylinderGeometry(.19,.19,.12,20),cuffMat);
  heroCuff.rotation.x = -Math.PI/2; heroCuff.position.set(.23,0,-.42); heroArm.add(heroCuff);
  const heroHand = new THREE.Mesh(new THREE.SphereGeometry(.22,20,14),handMat);
  heroHand.scale.set(1.15,.65,1.35); heroHand.position.set(.23,.01,-.57); heroHand.castShadow=true; heroArm.add(heroHand);
  heroArm.position.set(.42,.32,2.9); heroArm.visible=true;
  const movingChips=[];
  function throwChips(fromX,fromZ,count=3,color=1){
    for(let i=0;i<count;i++){
      const g=new THREE.Group();
      const body=new THREE.Mesh(new THREE.CylinderGeometry(.15,.15,.05,28),chipMaterials[color%chipMaterials.length]);g.add(body);
      const edge=new THREE.Mesh(new THREE.TorusGeometry(.125,.009,5,28),chipEdge);edge.rotation.x=Math.PI/2;edge.position.y=.026;g.add(edge);
      g.position.set(fromX+(i-count/2)*.11,.22+i*.035,fromZ+(i%2)*.08);actionFxGroup.add(g);
      movingChips.push({g,from:new THREE.Vector3(g.position.x,g.position.y,g.position.z),to:new THREE.Vector3(-.2+(i%3)*.18,.2,-.82+(i%2)*.12),start:performance.now()+i*65,duration:520+i*40});
    }
  }
  let heroActionStart=0;
  function animateHeroAction(action){
    if(!['CALL','RAISE','ALL-IN','CHECK'].includes(String(action).toUpperCase()))return;
    heroActionStart=performance.now();heroArm.visible=true;
    if(['CALL','RAISE','ALL-IN'].includes(String(action).toUpperCase()))throwChips(.55,3.0,action==='ALL-IN'?5:3,action==='RAISE'?4:1);
  }
  const previousActions=new Map();
  const seatGestures=new Map();
  let firstActionSync=true;

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
      : [...getCards('#community'),...getCards('#myHand'),...getCards('#seats .seat:not(.mine) .hole')];
    const seatNodes=[...document.querySelectorAll('#seats .seat')];
    const seatSig=seatNodes.map(e=>e.textContent).join('|');
    if(!firstActionSync){
      seatNodes.forEach((el,i)=>{
        const action=(el.querySelector('.seat-action')?.textContent||'').replace('• YOUR TURN','').trim().toUpperCase();
        const old=previousActions.get(i);
        if(action&&action!==old&&['CALL','RAISE','ALL-IN','CHECK','FOLD'].some(a=>action.startsWith(a))){
          seatGestures.set(i,performance.now());
          const n=Math.max(1,seatNodes.length),mineIndex=Math.max(0,seatNodes.findIndex(e=>e.classList.contains('mine'))),a=((i-mineIndex)/n)*Math.PI*2;
          const x=Math.sin(a)*3.15,z=Math.cos(a)*1.65;
          if(['CALL','RAISE','ALL-IN'].some(v=>action.startsWith(v)))throwChips(x,z,action.startsWith('ALL-IN')?5:3,action.startsWith('RAISE')?4:1);
          if(el.classList.contains('mine'))animateHeroAction(action);
          else if(action.startsWith('CHECK')){const marker=labelSprite('CHECK','#e8e1c8');marker.position.set(x,.9,z);seatGroup.add(marker);setTimeout(()=>{seatGroup.remove(marker);marker.material.map?.dispose();marker.material.dispose()},850)}
        }
        previousActions.set(i,action);
      });
    } else {seatNodes.forEach((el,i)=>previousActions.set(i,(el.querySelector('.seat-action')?.textContent||'').trim().toUpperCase()));firstActionSync=false;}
    const sig=gameType+'|'+phase+'|'+cards.map(c=>c.label+(c.back?'b':'f')).join(',');
    if(!force&&sig===signature&&seatSig===lastSeatSig)return;
    const seatsChanged=force||seatSig!==lastSeatSig;lastSeatSig=seatSig;signature=sig;
    clearGroup(chipsGroup);rebuildSeats();
    clearGroup(cardGroup);
    cardFlights.length=0;
    const nextCardKeys=new Set();
    const placeCard=(key,label,x,z,rot=0,back=false)=>{
      nextCardKeys.add(key);
      return addCard(label,x,z,rot,back,!previousCardKeys.has(key));
    };
    if(gameType==='poker'){
      const community=getCards('#community');
      const communityStart=-(Math.max(community.length,5)-1)*.41;
      community.forEach((c,i)=>placeCard('community:'+i+':'+c.label,c.label,communityStart+i*.82,-.35,(i-2)*.012,c.back));
      const mine=getCards('#myHand');
      mine.forEach((c,i)=>placeCard('hero:'+i+':'+c.label,c.label,(i-(mine.length-1)/2)*.88,1.28,(i-(mine.length-1)/2)*.045,c.back));
      const seats=[...document.querySelectorAll('#seats .seat:not(.mine)')];
      seats.forEach((el,i)=>{
        const allSeats=[...document.querySelectorAll('#seats .seat')],seatIndex=allSeats.indexOf(el);
        const n=Math.max(1,allSeats.length),mineIndex=Math.max(0,allSeats.findIndex(e=>e.classList.contains('mine'))),a=((seatIndex-mineIndex)/n)*Math.PI*2,x=Math.sin(a)*3.15,z=Math.cos(a)*1.65;
        getCards('#seats .seat:nth-child('+(seatIndex+1)+') .hole').forEach((c,j)=>placeCard('seat:'+seatIndex+':'+j+':'+c.label,c.label,x+(j-.5)*.78,z,(j-.5)*.035,c.back));
      });
      const potValue=Number((document.querySelector('#pot b')?.textContent||'0').replace(/[^0-9.-]/g,''))||0;
      const potCount=potValue>0?Math.max(1,Math.min(10,Math.ceil(Math.log10(potValue+1)*2))):0;
      for(let i=0;i<potCount;i++)makeChip(-1.38+(i%3)*.19,.17+Math.floor(i/3)*.058,-.72,i%5);
      for(let col=0;col<3;col++){const count=Math.max(0,Math.ceil((potCount-col)/3));if(count)addChipMark(-1.38+col*.19,.17+(count-1)*.058+.03,-.72,col%5)}
      previousCardKeys=nextCardKeys;
    }else{
      const dealer=getCards('#dealerCards');
      dealer.forEach((c,i)=>placeCard('dealer:'+i+':'+c.label,c.label,(i-(dealer.length-1)/2)*.82,-1.25,(i-(dealer.length-1)/2)*.025,c.back));
      const dealerLabel=labelSprite('DEALER','#e5c983');dealerLabel.position.set(0,.28,-2.18);dealerLabel.scale.set(1.45,.34,1);seatGroup.add(dealerLabel);
      const hands=[...document.querySelectorAll('#bjHands .bj-hand')],heroIndex=Math.max(0,hands.findIndex(el=>el.classList.contains('mine'))),seatCount=Math.max(1,hands.length);
      hands.forEach((el,idx)=>{
        const isMine=el.classList.contains('mine');
        const relative=(idx-heroIndex+seatCount)%seatCount;
        const angle=relative/seatCount*Math.PI*2;
        const baseX=isMine?0:Math.sin(angle)*3.05;
        const baseZ=isMine?1.35:Math.cos(angle)*1.48;
        const cardsInHand=getCards('#bjHands .bj-hand:nth-child('+(idx+1)+') .cards');
        const cardsCenter=baseX+(isMine?0:0);
        cardsInHand.forEach((c,i)=>placeCard('bj:'+idx+':'+i+':'+c.label,c.label,cardsCenter+(i-(cardsInHand.length-1)/2)*.76,baseZ,(i-(cardsInHand.length-1)/2)*.025,c.back));
        const title=el.querySelector('b')?.textContent?.trim()||'PLAYER';
        const total=el.querySelector('div:nth-of-type(2)')?.textContent?.trim()||'';
        const label=labelSprite((isMine?'YOU · ': '')+title.replace(/🤖/g,'').trim()+(total?' · '+total:''),isMine?'#ffdc8a':'#f4e7c2');
        label.position.set(baseX,.28,baseZ+(isMine ? 0.86 : (baseZ>0 ? 0.72 : -0.68)));label.scale.set(isMine?1.8:1.55,.34,1);seatGroup.add(label);
      });
      previousCardKeys=nextCardKeys;
      const potValue=[...document.querySelectorAll('#bjHands .bj-hand')].reduce((sum,el)=>{const m=el.textContent.match(/\bbet\s+([\d,]+)/i);return sum+(m?Number(m[1].replace(/,/g,''))||0:0)},0);
      const bjChipCount=Math.min(8,Math.ceil(potValue/100));for(let i=0;i<bjChipCount;i++)makeChip(-1.12+(i%4)*.17,.17+Math.floor(i/4)*.058,-.7,i%5);for(let col=0;col<4;col++){const count=Math.max(0,Math.ceil((bjChipCount-col)/4));if(count)addChipMark(-1.12+col*.17,.17+(count-1)*.058+.03,-.7,col%5)}
    }
  }

  function resize(){
    const r=root.getBoundingClientRect(),w=Math.max(320,r.width),h=Math.max(480,Math.min(720,r.height-80||620));
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
    const t=clock.getElapsedTime(), now=performance.now();
    fill.intensity=36+Math.sin(t*.6)*2;
    for(let i=cardFlights.length-1;i>=0;i--){
      const f=cardFlights[i];if(now<f.start)continue;
      const p=Math.min(1,(now-f.start)/f.duration),ease=1-Math.pow(1-p,3);
      f.card.position.lerpVectors(new THREE.Vector3(0,.72,-2.35),f.targetPosition,ease);
      f.card.position.y+=Math.sin(p*Math.PI)*.34;
      f.card.rotation.set(
        THREE.MathUtils.lerp(-Math.PI/2+.95,f.targetRotation.x,ease),
        THREE.MathUtils.lerp(0,f.targetRotation.y,ease),
        THREE.MathUtils.lerp(0,f.targetRotation.z,ease)+Math.sin(p*Math.PI)*.08
      );
      if(p>=1)cardFlights.splice(i,1);
    }
    camera.position.x=Math.sin(t*.12)*.025;
    camera.position.y=2.15+Math.sin(t*.17)*.004;
    camera.lookAt(0,.12,.05);
    if(!heroActionStart){heroArm.position.set(.42+Math.sin(t*.7)*.018,.32+Math.sin(t*1.1)*.012,2.9+Math.sin(t*.6)*.025);heroArm.rotation.z=Math.sin(t*.5)*.012;}
    if(heroActionStart){
      const p=Math.min(1,(now-heroActionStart)/620);
      const reach=p<.48?p/.48:1-(p-.48)/.52;
      heroArm.visible=p<1;
      heroArm.position.set(.42-reach*.28,.32+Math.sin(reach*Math.PI)*.06,2.9-reach*.78);
      if(p>=1)heroActionStart=0;
    }
    for(const [i,startAt] of seatGestures){
      const refs=seatArmRefs.get(i),p=Math.min(1,(now-startAt)/620),reach=p<.42?p/.42:1-(p-.42)/.58;
      if(refs){
        refs.armL.position.z=refs.baseL.z+reach*.42;refs.armR.position.z=refs.baseR.z+reach*.42;
        refs.armL.position.y=refs.baseL.y-reach*.12;refs.armR.position.y=refs.baseR.y-reach*.12;
      }
      if(p>=1)seatGestures.delete(i);
    }
    for(let i=movingChips.length-1;i>=0;i--){
      const c=movingChips[i],p=Math.max(0,Math.min(1,(now-c.start)/c.duration));
      if(now<c.start)continue;
      const eased=1-Math.pow(1-p,3);
      c.g.position.lerpVectors(c.from,c.to,eased);
      c.g.position.y=.2+Math.sin(p*Math.PI)*.48;
      c.g.rotation.x=p*Math.PI*2;c.g.rotation.z=p*Math.PI*2;
      if(p>=1){actionFxGroup.remove(c.g);c.g.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose()}});movingChips.splice(i,1)}
    }
    renderer.render(scene,camera);
  }
  animate();
  window.addEventListener('beforeunload',()=>{observer.disconnect();resizeObserver.disconnect();renderer.dispose()});
})();