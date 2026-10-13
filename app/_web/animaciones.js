// Comportamiento de la web pública: animaciones de entrada, revelado por scroll,
// bloque verde que se expande, contadores, carrusel, tema claro/oscuro.
// Es JavaScript plano a propósito: se monta sobre el DOM que renderiza
// Sitio.tsx (más la página que lleve dentro) y devuelve una función de limpieza
// para el useEffect.
//
// Lo usan todas las páginas, y no todas tienen todo: la portada trae carrusel,
// casos y gráfico; una edición de Cafecito no. Por eso cada bloque pregunta
// primero si su elemento existe.
//
// La limpieza tiene que ser completa. El armazón (nav, footer) puede sobrevivir
// a una navegación entre páginas, y un listener que quede colgado del botón de
// tema hace que el siguiente montaje lo alterne dos veces, o sea ninguna. Todo
// listener se registra con la señal de `ac` y se va con un solo abort().
//
// Reglas que respeta:
// - prefers-reduced-motion apaga todo lo que se mueve.
// - Nada queda invisible si esto no corre: el estado de reposo es visible y
//   solo lo que está bajo el pliegue recibe el estado previo a la animación.

export function initSitio(wrapper) {

  var root=wrapper;
  var ac=new AbortController(),sg={signal:ac.signal},sgp={signal:ac.signal,passive:true},vivo=true,relojes=[];
  var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // theme toggle
  var btn=document.getElementById('themeBtn'),label=document.getElementById('themeLabel');
  function isDark(){var t=root.getAttribute('data-theme');if(t)return t==='dark';return window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches}
  function paint(){label.textContent=isDark()?'Modo claro':'Modo oscuro';drawSky(skyProgress)}
  try{var saved=localStorage.getItem('adoops-theme');if(saved==='dark'||saved==='light')root.setAttribute('data-theme',saved)}catch{}
  btn.addEventListener('click',function(){var next=isDark()?'light':'dark';root.setAttribute('data-theme',next);try{localStorage.setItem('adoops-theme',next)}catch{}paint()},sg);
  if(window.matchMedia){window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change',paint,sg)}

  // mobile menu
  var mb=document.getElementById('menuBtn'),mm=document.getElementById('mobileMenu');
  if(mb&&mm){
  mb.addEventListener('click',function(){mm.hidden=!mm.hidden;mb.setAttribute('aria-expanded',String(!mm.hidden))},sg);
  mm.querySelectorAll('a').forEach(function(a){a.addEventListener('click',function(){mm.hidden=true;mb.setAttribute('aria-expanded','false')},sg)});
  }

  // carousel
  var track=document.getElementById('track');
  if(track){
  var cards=track.children,dots=document.getElementById('dots');
  dots.textContent='';
  for(var j=0;j<cards.length;j++){var d=document.createElement('i');dots.appendChild(d)}
  function cardW(){return cards[0].getBoundingClientRect().width+16}
  function idx(){return Math.round(track.scrollLeft/cardW())}
  function paintDots(){var k=idx();for(var j=0;j<dots.children.length;j++)dots.children[j].classList.toggle('on',j===k)}
  document.getElementById('prevBtn').addEventListener('click',function(){track.scrollBy({left:-cardW(),behavior:'smooth'})},sg);
  document.getElementById('nextBtn').addEventListener('click',function(){track.scrollBy({left:cardW(),behavior:'smooth'})},sg);
  track.addEventListener('scroll',paintDots,sgp);paintDots();
  }

  // card art: normalized path length so each stroke can draw in, with a per-stroke delay
  // (el CSS engancha por la clase .draw y no por [pathLength]: con el selector de
  // atributo Chromium no re-estiliza los trazos al llegar .in y quedan sin dibujar)
  document.querySelectorAll('.card .art svg').forEach(function(svg){var k=0;svg.querySelectorAll('path,rect,circle').forEach(function(el){if(el.classList.contains('dot')||el.classList.contains('dot-acc'))return;el.setAttribute('pathLength','1');el.classList.add('draw');el.style.transitionDelay=(150+90*(k++))+'ms'})});

  // case filters
  var tabs=document.getElementById('tabs'),cases=document.querySelectorAll('#cases .case');
  if(tabs)tabs.addEventListener('click',function(e){var t=e.target.closest('.tab');if(!t)return;
    tabs.querySelectorAll('.tab').forEach(function(x){x.classList.toggle('on',x===t);x.setAttribute('aria-selected',String(x===t))});
    var f=t.getAttribute('data-f');cases.forEach(function(c){c.classList.toggle('hide',f!=='all'&&c.getAttribute('data-t')!==f)})},sg);

  // copy mail
  var cm=document.getElementById('copyMail');
  if(cm)cm.addEventListener('click',function(){var txt=document.getElementById('mail').textContent;
    function done(){cm.textContent='Copiado';setTimeout(function(){cm.textContent='Copiar'},1600)}
    function select(){var r=document.createRange();r.selectNodeContents(document.getElementById('mail'));var s=window.getSelection();s.removeAllRanges();s.addRange(r)}
    if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt).then(done).catch(function(){select();done()})}else{select();done()}},sg);

  // counters in the impact block
  function fmt(v,dec,sep){if(dec){return v.toFixed(dec).replace('.',',')}var s=String(Math.round(v));if(sep)s=s.replace(/\B(?=(\d{3})+(?!\d))/g,'.');return s}
  var counted=false;
  function runCounters(){if(counted)return;counted=true;
    document.querySelectorAll('.stats b[data-count]').forEach(function(b,i){var target=+b.getAttribute('data-count'),pre=b.getAttribute('data-pre')||'',suf=b.getAttribute('data-suf')||'',dec=+(b.getAttribute('data-dec')||0),sep=!!b.getAttribute('data-sep');
      if(reduce){b.textContent=pre+fmt(target,dec,sep)+suf;return}
      var t0=null,dur=1300+i*120;
      function frame(ts){if(!t0)t0=ts;var p=Math.min(1,(ts-t0)/dur);var e=1-Math.pow(1-p,3);b.textContent=pre+fmt(target*e,dec,sep)+suf;if(p<1&&vivo)requestAnimationFrame(frame)}
      requestAnimationFrame(frame)})}

  // statement: words already rendered as spans; they start dim and light up with the scroll
  var st=document.getElementById('statement');var stWords=st?Array.prototype.slice.call(st.querySelectorAll('.w')):[];
  if(!reduce)stWords.forEach(function(s){s.classList.add('off')});
  function paintStatement(){if(reduce||!st)return;var r=st.getBoundingClientRect(),vh=window.innerHeight;
    var p=(vh*0.88-r.top)/(vh*0.5+r.height*0.6);p=Math.max(0,Math.min(1,p));var n=Math.round(p*stWords.length);
    for(var i=0;i<stWords.length;i++)stWords[i].classList.toggle('off',i>=n)}

  // scroll reveal: only items below the fold get the hidden pre-state
  var rvs=document.querySelectorAll('.rv');var io=null;
  if(!reduce&&'IntersectionObserver' in window){
    var vh=window.innerHeight;
    rvs.forEach(function(el){if(el.getBoundingClientRect().top>vh*0.92)el.classList.add('pre')});
    document.querySelectorAll('.rv-group').forEach(function(g){Array.prototype.forEach.call(g.children,function(c,i){c.style.transitionDelay=(i*70)+'ms'})});
    io=new IntersectionObserver(function(entries){entries.forEach(function(en){if(en.isIntersecting){en.target.classList.add('in');if(en.target.classList.contains('stat'))runCounters();io.unobserve(en.target)}})},{rootMargin:'0px 0px -6% 0px'});
    rvs.forEach(function(el){io.observe(el)});
    relojes.push(setTimeout(function(){rvs.forEach(function(el){el.classList.add('in')});runCounters()},9000));
  }else{runCounters()}

  // footer: node network drawn to scale of the canvas, deterministic, draws in when visible
  var cv=document.getElementById('skyline'),skyProgress=reduce?1:0,pts=null,lastW=0,links=[];
  function rng(seed){return function(){seed=(seed*1664525+1013904223)%4294967296;return seed/4294967296}}
  function build(w,h){var r=rng(20260913);var n=Math.max(34,Math.round(w/26));pts=[];
    for(var i=0;i<n;i++){var x=(i+0.5)/n*w+(r()-0.5)*w/n*1.6;var y=h*0.78-Math.pow(r(),1.8)*h*0.7;pts.push({x:x,y:y,a:r()});}
    var ls=[];for(var i=0;i<pts.length;i++){for(var j=i+1;j<pts.length;j++){var dx=pts[i].x-pts[j].x,dy=pts[i].y-pts[j].y,d=Math.sqrt(dx*dx+dy*dy);if(d<w/8)ls.push({i:i,j:j,d:d})}}
    ls.sort(function(a,b){return (pts[a.i].x+pts[a.j].x)-(pts[b.i].x+pts[b.j].x)});return ls}
  function drawSky(p){
    if(!cv)return;
    var w=cv.clientWidth,h=cv.clientHeight,dpr=Math.min(window.devicePixelRatio||1,2);if(!w||!h)return;
    if(w!==lastW){links=build(w,h);lastW=w}
    cv.width=w*dpr;cv.height=h*dpr;var c=cv.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);
    var cs=getComputedStyle(root);var acc=cs.getPropertyValue('--accent').trim()||'#20C463';var ink=cs.getPropertyValue('--ink-3').trim()||'#7C8A9A';
    c.lineWidth=1;c.strokeStyle=ink;c.globalAlpha=.35;c.beginPath();c.moveTo(0,h*0.86);c.lineTo(w*p,h*0.86);c.stroke();
    c.globalAlpha=.18*p;for(var k=0;k<9;k++){var gx=w*k/8;c.beginPath();c.moveTo(gx,h*0.86);c.lineTo(w/2+(gx-w/2)*0.35,h*0.5);c.stroke();}
    var nl=Math.floor(links.length*p);c.strokeStyle=acc;
    for(var i=0;i<nl;i++){var l=links[i];c.globalAlpha=.55*(1-l.d/(w/8));c.beginPath();c.moveTo(pts[l.i].x,pts[l.i].y);c.lineTo(pts[l.j].x,pts[l.j].y);c.stroke();}
    c.strokeStyle=ink;
    pts.forEach(function(q){if(q.x>w*p)return;c.globalAlpha=.22;c.beginPath();c.moveTo(q.x,q.y);c.lineTo(q.x,h*0.86);c.stroke();
      c.globalAlpha=1;c.fillStyle=q.a>0.72?acc:ink;c.beginPath();c.arc(q.x,q.y,q.a>0.72?3.2:2,0,Math.PI*2);c.fill();});
    c.globalAlpha=1;
  }
  var skyStarted=false,sio=null;
  function startSky(){if(skyStarted)return;skyStarted=true;if(reduce){skyProgress=1;drawSky(1);return}
    var t0=null;function f(ts){if(!t0)t0=ts;var p=Math.min(1,(ts-t0)/1800);skyProgress=1-Math.pow(1-p,2);drawSky(skyProgress);if(p<1&&vivo)requestAnimationFrame(f)}requestAnimationFrame(f)}
  if(!cv){}else if('IntersectionObserver' in window){sio=new IntersectionObserver(function(en){if(en[0].isIntersecting){startSky();sio.disconnect()}},{threshold:.2});sio.observe(cv)}else{startSky()}

  var t;function onResizeDebounced(){clearTimeout(t);t=setTimeout(function(){drawSky(skyProgress);paintStatement()},120)}
  window.addEventListener('resize',onResizeDebounced,sg);
  // green block: expands from inset band to full bleed and rises over the previous section
  // (cualquier página puede llevar uno: es el .proof-inner, no un id de la portada)
  var block=wrapper.querySelector('.proof-inner'),nav=wrapper.querySelector('.nav');
  function gutter(){var vw=window.innerWidth;var g=vw>=720?32:16;return Math.max(g,(vw-1264)/2)}
  function paintBlock(){if(!block)return;var r=block.getBoundingClientRect(),vh=window.innerHeight;
    var p=reduce?1:Math.max(0,Math.min(1,(vh*0.95-r.top)/(vh*0.55)));
    var g=gutter()*(1-p);block.style.marginLeft=block.style.marginRight=g+'px';block.style.borderRadius=(10*(1-p))+'px';
    block.style.transform=reduce?'none':'translateY('+(-96*p)+'px)';
    var navH=nav.offsetHeight;var over=r.top<navH&&r.bottom>navH;nav.classList.toggle('over',over);}
  // chart draws with scroll
  var chart=document.getElementById('chart'),line=document.getElementById('chartLine'),nodes=document.querySelectorAll('#chartNodes .nd'),shadows=document.querySelectorAll('#chartNodes .sh'),bigCounted=false;
  if(line)line.setAttribute('pathLength','1');
  function paintChart(){if(reduce||!chart)return;var r=chart.getBoundingClientRect(),vh=window.innerHeight;
    var q=Math.max(0,Math.min(1,(vh*0.92-r.top)/(vh*0.75)));line.style.strokeDashoffset=String(1-q);
    nodes.forEach(function(n,i){var on=q>=(i+0.5)/nodes.length;n.classList.toggle('on',on);shadows[i].classList.toggle('on',on)});
    if(q>0.2&&!bigCounted){bigCounted=true;var b=document.querySelector('.proof-2 .big b');var target=+b.getAttribute('data-count'),pre=b.getAttribute('data-pre')||'',dec=+(b.getAttribute('data-dec')||0);var t0=null;
      (function frame(ts){if(!t0)t0=ts;var pp=Math.min(1,(ts-t0)/1400);var e=1-Math.pow(1-pp,3);b.textContent=pre+fmt(target*e,dec,false);if(pp<1&&vivo)requestAnimationFrame(frame)})(performance.now())}}
  // hero dots: parallax
  var heroDots=document.getElementById('heroDots');
  function paintDotsPx(){if(reduce||!heroDots)return;heroDots.style.transform='translateY('+(window.scrollY*0.35)+'px)'}
  function onScroll(){paintStatement();paintBlock();paintChart();paintDotsPx()}
  var ticking=false;function onScrollEv(){if(ticking)return;ticking=true;requestAnimationFrame(function(){onScroll();ticking=false})}
  window.addEventListener('scroll',onScrollEv,sgp);
  function onResize2(){paintBlock()}
  window.addEventListener('resize',onResize2,sg);
  paint();onScroll();
  return function(){vivo=false;ac.abort();relojes.forEach(clearTimeout);clearTimeout(t);if(io)io.disconnect();if(sio)sio.disconnect();if(nav)nav.classList.remove('over')};
}
