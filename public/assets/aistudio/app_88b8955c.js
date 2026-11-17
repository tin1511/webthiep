/* Đọc dữ liệu đã lưu trên trình duyệt (nếu có) */
try {
  const saved = localStorage.getItem("noel_cfg");
  if (saved) Object.assign(CONFIG, JSON.parse(saved));
} catch (e) {}

CONFIG.letter = CONFIG.letter.map(s => s.normalize("NFC"));
CONFIG.headline = CONFIG.headline.map(s => s.normalize("NFC"));
CONFIG.sign = CONFIG.sign.normalize("NFC");

const $=id=>document.getElementById(id), RM=false;
const R=new THREE.WebGLRenderer({antialias:true});R.setPixelRatio(Math.min(devicePixelRatio,2));document.body.prepend(R.domElement);
const S=new THREE.Scene();S.background=new THREE.Color(0x0b1622);
const C=new THREE.PerspectiveCamera(50,1,.1,100),G=new THREE.Group();S.add(G);
function fit(){const w=innerWidth,h=innerHeight;R.setSize(w,h);C.aspect=w/h;C.updateProjectionMatrix();C.position.z=Math.max(17,16/(2*Math.tan(25*Math.PI/180)*C.aspect))}
addEventListener("resize",fit);fit();

/* hạt */
const N=7000,pos=new Float32Array(N*3),col=new Float32Array(N*3),seed=new Float32Array(N*4);
const TP=[null,0,0,0].map((_,k)=>k?new Float32Array(N*3):null),TC=[0,0,0,0].map(()=>new Float32Array(N*3));
const cc=new THREE.Color(),rnd=Math.random;
const setC=(a,i,h)=>{cc.set(h);a[i*3]=cc.r;a[i*3+1]=cc.g;a[i*3+2]=cc.b};
const setH=(a,i,h,s,l)=>{cc.setHSL(h,s,l);a[i*3]=cc.r;a[i*3+1]=cc.g;a[i*3+2]=cc.b};
for(let i=0;i<N*4;i++)seed[i]=rnd();
for(let i=0;i<N;i++){pos[i*3]=(rnd()-.5)*30;pos[i*3+1]=(rnd()-.5)*20;pos[i*3+2]=(rnd()-.5)*20;
  const r=rnd();setC(TC[0],i,r<.5?"#ffd98a":r<.8?"#ffffff":"#9fd4ff")}

/* đích 1: chữ */
function _text(){const W=900,H=420,cv=document.createElement("canvas");cv.width=W;cv.height=H;const x=cv.getContext("2d");
  x.fillStyle="#fff";x.textAlign="center";x.textBaseline="middle";x.font='700 150px "Be Vietnam Pro",system-ui,"Segoe UI",Arial,sans-serif';
  x.fillText(CONFIG.headline[0],W/2,H*.31);x.fillText(CONFIG.headline[1],W/2,H*.7);
  const d=x.getImageData(0,0,W,H).data,p=[];
  for(let y=0;y<H;y+=3)for(let u=0;u<W;u+=3)if(d[(y*W+u)*4+3]>128)p.push([(u-W/2)*13/W,-(y-H/2)*13/W]);
  for(let i=0;i<N;i++){const q=p[(rnd()*p.length)|0];TP[1][i*3]=q[0]+(rnd()-.5)*.05;TP[1][i*3+1]=q[1]+(rnd()-.5)*.05;TP[1][i*3+2]=(rnd()-.5)*.5;
    setC(TC[1],i,rnd()<.7?"#ffe2a0":"#ffffff")}}
Promise.race([document.fonts.load('700 150px "Be Vietnam Pro"',"Chúc Mừng Giáng Sinh"),new Promise(r=>setTimeout(r,1500))]).then(_text,_text);

/* đích 2: phong thư */
(function(){const w=4,h=2.75,P="#ff7a8a",Y="#ffd98a",
  sg=[[-w,-h,w,-h,P],[w,-h,w,h,P],[w,h,-w,h,P],[-w,h,-w,-h,P],[-w,h,0,.3,Y],[w,h,0,.3,Y]],
  L=sg.map(s=>Math.hypot(s[2]-s[0],s[3]-s[1])),T=L.reduce((a,b)=>a+b);
  for(let i=0;i<N;i++){let x,y,c;
    if(rnd()<.2){x=(rnd()*2-1)*w;y=(rnd()*2-1)*h;c="#a8404f"}
    else{let r=rnd()*T,k=0;while(r>L[k]){r-=L[k];k++}const s=sg[k],t=r/L[k];x=s[0]+(s[2]-s[0])*t;y=s[1]+(s[3]-s[1])*t;c=s[4]}
    TP[2][i*3]=x+(rnd()-.5)*.06;TP[2][i*3+1]=y+(rnd()-.5)*.06;TP[2][i*3+2]=(rnd()-.5)*.3;setC(TC[2],i,c)}})();

/* đích 3: cây thông */
for(let i=0;i<N;i++){const r=rnd();let x,y,z;
  if(r<.05){const a=rnd()*6.283,q=rnd()*.45;x=Math.cos(a)*q;z=Math.sin(a)*q;y=-5.2+rnd()*1;setC(TC[3],i,"#8a5a2b")}
  else if(r<.07){const a=rnd()*6.283,b=rnd()*3.14,q=rnd()*.4;x=Math.sin(b)*Math.cos(a)*q;y=5+Math.cos(b)*q;z=Math.sin(b)*Math.sin(a)*q;setC(TC[3],i,"#fff1b0")}
  else{const t=Math.pow(rnd(),.85),a=rnd()*6.283,q=(1-t)*3.4*(.55+.45*rnd())*(.88+.12*Math.sin(t*22));
    x=Math.cos(a)*q;z=Math.sin(a)*q;y=-4.4+t*9.2;
    if(rnd()<.12)setC(TC[3],i,["#ff4d5e","#ffd98a","#bfe6ff"][(rnd()*3)|0]);else setH(TC[3],i,.36+rnd()*.06,.6,.3+rnd()*.25)}
  TP[3][i*3]=x;TP[3][i*3+1]=y;TP[3][i*3+2]=z}

const spr=(()=>{const c=document.createElement("canvas");c.width=c.height=64;const x=c.getContext("2d"),g=x.createRadialGradient(32,32,0,32,32,32);
  g.addColorStop(0,"#fff");g.addColorStop(.4,"rgba(255,255,255,.6)");g.addColorStop(1,"rgba(255,255,255,0)");x.fillStyle=g;x.fillRect(0,0,64,64);return new THREE.CanvasTexture(c)})();
const geo=new THREE.BufferGeometry();geo.setAttribute("position",new THREE.BufferAttribute(pos,3));geo.setAttribute("color",new THREE.BufferAttribute(col,3));
const pm=new THREE.PointsMaterial({size:.17,map:spr,vertexColors:true,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});G.add(new THREE.Points(geo,pm));

/* tuyết */
const SN=900,sp=new Float32Array(SN*3);for(let i=0;i<SN;i++){sp[i*3]=(rnd()-.5)*36;sp[i*3+1]=(rnd()-.5)*18;sp[i*3+2]=(rnd()-.5)*14}
const sg=new THREE.BufferGeometry();sg.setAttribute("position",new THREE.BufferAttribute(sp,3));
const sm=new THREE.PointsMaterial({size:.14,map:spr,transparent:true,opacity:.85,depthWrite:false,blending:THREE.AdditiveBlending});S.add(new THREE.Points(sg,sm));

/* ảnh treo */
const photos=[];
CONFIG.photos.forEach((p,i,arr)=>{
  const cv=document.createElement("canvas");cv.width=cv.height=512;const x=cv.getContext("2d"),tex=new THREE.CanvasTexture(cv);
  const draw=im=>{if(im){const s=Math.min(im.width,im.height);x.drawImage(im,(im.width-s)/2,(im.height-s)/2,s,s,0,0,512,512)}
    else{const g=x.createLinearGradient(0,0,512,512);g.addColorStop(0,"#ff8a9a");g.addColorStop(1,"#ffd98a");x.fillStyle=g;x.fillRect(0,0,512,512);
      x.fillStyle="#fff";x.textAlign="center";x.textBaseline="middle";x.font="200px sans-serif";x.fillText("♥",256,220);x.font="500 40px sans-serif";x.fillText("Ảnh "+(i+1),256,400)}
    tex.needsUpdate=true;p.url=cv.toDataURL("image/jpeg",.9)};
  draw(null);if(p.src){const im=new Image();im.onload=()=>draw(im);im.src=p.src}
  const g=new THREE.Group(),back=new THREE.Mesh(new THREE.PlaneGeometry(1.5,1.78),new THREE.MeshBasicMaterial({color:0xfff7ec,side:THREE.DoubleSide})),
    pic=new THREE.Mesh(new THREE.PlaneGeometry(1.3,1.3),new THREE.MeshBasicMaterial({map:tex}));
  pic.position.set(0,.14,.01);g.add(back,pic);
  const hook=new THREE.Mesh(new THREE.SphereGeometry(.07,8,8),new THREE.MeshBasicMaterial({color:0xffd98a}));hook.position.y=.95;g.add(hook);
  const y=-2.7+i/Math.max(1,arr.length-1)*5.2,a=i*2.4,r=(1-(y+4.4)/9.2)*3.4*.95+.3;
  g.position.set(Math.sin(a)*r,y,Math.cos(a)*r);g.rotation.set(0,a,(i%2?.08:-.08));g.scale.setScalar(.001);g.userData={p,i};
  G.add(g);photos.push(g);pic.userData.g=g});
const picMeshes=photos.map(g=>g.children[1]);

/* trạng thái */
let stage=0,st=0,last=performance.now()/1000,t0=last,spin=0,drag=false,moved=0,px=0;
const hint=$("hint");
function ui(){hint.textContent=stage===2?"Chạm vào phong thư để mở":stage===3?"Kéo để xoay · chạm vào ảnh để xem":"";$("open").hidden=stage!==2;$("read").hidden=stage!==3}
function go(s){stage=s;st=performance.now()/1000-t0;$("open").hidden=$("read").hidden=true;hint.textContent="";setTimeout(ui,s===2?1800:s===3?2600:0)}
setTimeout(()=>go(1),3200);setTimeout(()=>go(2),8400);

function tick(){
  const now=performance.now()/1000,dt=Math.min(.05,now-last),t=now-t0;last=now;
  const tp=TP[stage],tc=TC[stage],wob=RM?0:.03;
  for(let i=0;i<N;i++){const j=i*3,s=i*4;let tx,ty,tz;
    if(stage===0){const a=seed[s]*6.283+t*(.2+seed[s+1]*.3),b=seed[s+2]*3.14+t*.12,r=5+seed[s+3]*6;tx=r*Math.sin(b)*Math.cos(a);ty=r*Math.cos(b)*.7;tz=r*Math.sin(b)*Math.sin(a)}
    else{tx=tp[j]+Math.sin(t*1.7+i)*wob;ty=tp[j+1]+Math.cos(t*1.3+i)*wob;tz=tp[j+2]}
    const k=1-Math.exp(-dt*(stage===0?1.2:1.6+seed[s+1]*3));
    pos[j]+=(tx-pos[j])*k;pos[j+1]+=(ty-pos[j+1])*k;pos[j+2]+=(tz-pos[j+2])*k;
    col[j]+=(tc[j]-col[j])*k;col[j+1]+=(tc[j+1]-col[j+1])*k;col[j+2]+=(tc[j+2]-col[j+2])*k}
  geo.attributes.position.needsUpdate=geo.attributes.color.needsUpdate=true;
  if(stage===3){
    if(!drag&&!RM)spin+=dt*.15;
    photos.forEach((g,i)=>{const e=Math.max(0,Math.min(1,(t-st-1.4-i*.25)/.8));g.scale.setScalar(.001+e*e*(3-2*e));g.rotation.x=Math.sin(t*1.2+i)*.04});
    sm.opacity+=(.8-sm.opacity)*dt;
  }
  G.rotation.y=stage===3?spin:Math.sin(t*.4)*.12;G.position.y=Math.sin(t*.8)*.15;pm.size=.17+Math.sin(t*2.2)*.025;
  if(!RM||stage===3)for(let i=0;i<SN;i++){sp[i*3+1]-=dt*(.8+(i%5)*.15);sp[i*3]+=Math.sin(t*.6+i)*dt*.35;if(sp[i*3+1]<-9)sp[i*3+1]=9}
  sg.attributes.position.needsUpdate=true;
  C.lookAt(0,0,0);R.render(S,C);requestAnimationFrame(tick)}
tick();

/* tương tác */
const ov=$("ov"),ray=new THREE.Raycaster();
function show(html,lock){ov.replaceChildren(html);if(lock)ov.dataset.lock=1;else delete ov.dataset.lock;ov.hidden=false}
function shut(){ov.hidden=true}
ov.onclick=e=>{if(e.target===ov&&!ov.dataset.lock||e.target.classList.contains("close"))shut()};
addEventListener("keydown",e=>{if(e.key==="Escape"&&!ov.dataset.lock)shut();if(e.key.toLowerCase()==="m"&&ov.hidden&&!e.ctrlKey&&!e.metaKey&&!/INPUT|TEXTAREA/.test(document.activeElement.tagName))gate()});

/* ===== QUẢN TRỊ (nhấn phím M) ===== */
const h=(t,a,...k)=>{const e=Object.assign(document.createElement(t),a||{});e.append(...k);return e};
const lab=(t,e)=>h("label",{className:"lab"},h("span",{textContent:t}),e);
function readImg(f){return new Promise(r=>{const fr=new FileReader();fr.onload=()=>{const im=new Image();im.onload=()=>{const s=Math.min(im.width,im.height),c=h("canvas",{width:720,height:720});c.getContext("2d").drawImage(im,(im.width-s)/2,(im.height-s)/2,s,s,0,0,720,720);r(c.toDataURL("image/jpeg",.82))};im.src=fr.result};fr.readAsDataURL(f)})}
function pickImgs(multi,cb){const f=h("input",{type:"file",accept:"image/*",multiple:multi});f.onchange=async()=>{for(const x of [...f.files])cb(await readImg(x))};f.click()}
const HASH="0d0c9bc37ae955b26c8bfecc22fcd072c4ea5ce95947a5051b5ed7399bff4f2e";
async function sha(s){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s));return[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")}
function gate(){
  const pw=h("input",{type:"password",inputMode:"numeric",autocomplete:"off"}),msg=h("p",{className:"hint"});
  const go=async()=>{if(await sha(pw.value)===HASH)admin();else{msg.textContent="Sai mật khẩu.";pw.value="";pw.focus()}};
  pw.onkeydown=e=>{if(e.key==="Enter")go()};
  show(h("div",{className:"paper adm"},h("h2",{textContent:"Quản trị"}),lab("Mật khẩu",pw),msg,h("div",{className:"row"},h("button",{className:"sm close",textContent:"Đóng"}),h("button",{className:"btn",textContent:"Mở",onclick:go}))),true);
  pw.focus()}
function admin(){
  const P=CONFIG.photos.map(p=>({src:p.src,caption:p.caption})),msg=h("p",{className:"hint"}),list=h("div"),
    l1=h("input",{value:CONFIG.headline[0]}),l2=h("input",{value:CONFIG.headline[1]}),
    lt=h("textarea",{rows:9,value:CONFIG.letter.join("\n\n")}),sg=h("input",{value:CONFIG.sign});
  function draw(){list.replaceChildren(...P.map((p,i)=>{
    const th=h("div",{className:"th"});if(p.src)th.style.backgroundImage='url("'+p.src+'")';
    const cap=h("input",{value:p.caption,placeholder:"Chú thích",oninput:()=>{p.caption=cap.value}});
    return h("div",{className:"ph"},th,cap,
      h("button",{className:"sm",textContent:"Đổi ảnh",onclick:()=>pickImgs(false,s=>{p.src=s;draw()})}),
      h("button",{className:"sm",textContent:"Xóa",onclick:()=>{if(P.length>1){P.splice(i,1);draw()}}}))}))}
  async function save(mode){
    const cfg={headline:[l1.value.normalize("NFC").trim()||"Chúc Mừng",l2.value.normalize("NFC").trim()||"Giáng Sinh"],letter:lt.value.normalize("NFC").split(/\n\s*\n/).map(s=>s.trim()).filter(Boolean),sign:sg.value.normalize("NFC").trim(),photos:P};
    if(mode==="dl"){
      const blob = new Blob(["const CONFIG = " + JSON.stringify(cfg, null, 2) + ";"], {type: "application/javascript"});
      const a = h("a", {href: URL.createObjectURL(blob), download: "config.js"});
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      msg.textContent = "Đã tải file config.js mới về máy. Thay thế file config.js cũ là xong!";
      return;
    }
    try{
      localStorage.setItem("noel_cfg", JSON.stringify(cfg));
      msg.textContent = "Đã lưu trên trình duyệt! Tải lại trang (F5) để xem thay đổi.";
    }catch(e){
      msg.textContent = "Ảnh quá nặng nên trình duyệt không lưu hết được. Hãy bấm 'Tải file về' để xuất config.js.";
    }
  }
  draw();
  show(h("div",{className:"paper adm"},h("h2",{textContent:"Quản trị"}),lab("Dòng chữ chúc thứ nhất",l1),lab("Dòng chữ chúc thứ hai",l2),
    lab("Nội dung thư (cách đoạn bằng một dòng trống)",lt),lab("Lời ký tên",sg),h("h3",{textContent:"Ảnh trên cây thông"}),list,
    h("button",{className:"sm",textContent:"Thêm ảnh",onclick:()=>pickImgs(true,s=>{if(P.length<12){P.push({src:s,caption:"Kỷ niệm "+(P.length+1)});draw()}})}),msg,
    h("div",{className:"row"},h("button",{className:"sm",textContent:"Đóng",onclick:shut}),h("button",{className:"sm",textContent:"Tải file về",onclick:()=>save("dl")}),h("button",{className:"btn",textContent:"Lưu và cập nhật",onclick:save}))),true)}
$("open").onclick=()=>{if(stage===2)go(3)};
$("read").onclick=()=>{const d=document.createElement("div");d.className="paper";
  CONFIG.letter.forEach(t=>{const p=document.createElement("p");p.textContent=t;d.appendChild(p)});
  const s=document.createElement("p");s.className="sign";s.textContent=CONFIG.sign;d.appendChild(s);
  const b=document.createElement("button");b.className="btn close";b.textContent="Đóng";d.appendChild(b);show(d)};
const cv=R.domElement;
cv.addEventListener("pointerdown",e=>{drag=true;moved=0;px=e.clientX;cv.setPointerCapture(e.pointerId)});
cv.addEventListener("pointermove",e=>{if(!drag)return;const dx=e.clientX-px;px=e.clientX;moved+=Math.abs(dx);if(stage===3)spin+=dx*.008});
cv.addEventListener("pointerup",e=>{drag=false;if(moved>6)return;
  if(stage===2){go(3);return}
  if(stage!==3)return;
  ray.setFromCamera(new THREE.Vector2(e.clientX/innerWidth*2-1,-(e.clientY/innerHeight)*2+1),C);
  const h=ray.intersectObjects(picMeshes)[0];
  if(h&&h.object.userData.g.scale.x>.8){const p=h.object.userData.g.userData.p,d=document.createElement("div");d.className="pic";
    const im=new Image();im.src=p.url;im.alt=p.caption;const c=document.createElement("p");c.textContent=p.caption;d.append(im,c);show(d)}});