/* Volio — shared site behaviour */

(function(){
  var p=document.getElementById('preloader');if(!p)return;
  var path=p.querySelector('path');
  try{var L=path.getTotalLength();path.style.strokeDasharray=L;path.style.strokeDashoffset=L;}catch(e){}
  document.documentElement.classList.add('preloading');
  var t0=Date.now(),MIN=650,done=false;
  function hide(){
    if(done)return;done=true;
    setTimeout(function(){
      p.classList.add('done');
      document.documentElement.classList.remove('preloading');
      setTimeout(function(){if(p.parentNode)p.parentNode.removeChild(p);},700);
    },Math.max(0,MIN-(Date.now()-t0)));
  }
  if(document.readyState==='complete')hide();else window.addEventListener('load',hide);
  setTimeout(hide,6000);
})();


const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const io=new IntersectionObserver((es)=>{es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}})},{threshold:.12});
document.querySelectorAll('.reveal').forEach(el=>io.observe(el));

/* [A4] count-up on the Why stats */
function countUp(el){
  const target=+el.dataset.count, suffix=el.dataset.suffix||'', dur=1200, t0=performance.now();
  function step(t){const p=Math.min((t-t0)/dur,1),eased=1-Math.pow(1-p,3);el.textContent=Math.round(target*eased).toLocaleString()+suffix;if(p<1)requestAnimationFrame(step);}
  requestAnimationFrame(step);
}
const whySec=document.getElementById('why');
if(whySec){
  const whyIO=new IntersectionObserver((es)=>{es.forEach(e=>{if(e.isIntersecting){
    whySec.querySelectorAll('[data-count]').forEach(el=>{
      if(reduceMotion){el.textContent=el.dataset.count;}else{countUp(el);}
    });
    whyIO.disconnect();
  }})},{threshold:.4});
  whyIO.observe(whySec);
}

/* [A7] nav shadow once scrolled */
const navEl=document.querySelector('nav');
window.addEventListener('scroll',()=>navEl.classList.toggle('scrolled',window.scrollY>10),{passive:true});

document.querySelectorAll('.faq-q').forEach(q=>{q.addEventListener('click',()=>{
  const item=q.parentNode,a=item.querySelector('.faq-a'),open=item.classList.contains('open');
  document.querySelectorAll('.faq-item.open').forEach(o=>{o.classList.remove('open');o.querySelector('.faq-a').style.maxHeight=null;});
  if(!open){item.classList.add('open');a.style.maxHeight=a.scrollHeight+'px';}
});});

/* ---- NEWSLETTER : Brevo via AWS Lambda ---- */
const LAMBDA_URL='https://9ek2lcmtx8.execute-api.eu-west-1.amazonaws.com/prod/subscribe';
async function subscribeToBrevo(email,firstName=''){
  try{
    const res=await fetch(LAMBDA_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,firstName})});
    if(res.ok)return{ok:true};
    const data=await res.json().catch(()=>({}));
    return{ok:false,message:data.error||data.message||('HTTP '+res.status)};
  }catch(err){
    console.error('[Volio] Subscribe error:',err);
    return{ok:false,message:'Network error — please try again.'};
  }
}
const nlBtn=document.getElementById('newsletterBtn');
const nlEmail=document.getElementById('newsletterEmail');
const nlFirst=document.getElementById('newsletterFirstName');
const nlConsent=document.getElementById('newsletterConsent');
if(nlBtn&&nlEmail&&nlConsent){
  const isIT=()=>document.documentElement.lang==='it';
  nlBtn.disabled=true;
  nlConsent.addEventListener('change',()=>{nlBtn.disabled=!nlConsent.checked;});
  nlBtn.addEventListener('click',async()=>{
    if(!nlConsent.checked)return;
    const email=nlEmail.value.trim();
    if(!email||!email.includes('@')){
      nlEmail.style.outline='2px solid #e74c3c';nlEmail.focus();
      setTimeout(()=>nlEmail.style.outline='',1500);
      return;
    }
    nlBtn.disabled=true;nlBtn.style.opacity='1';nlBtn.textContent='...';
    const result=await subscribeToBrevo(email,nlFirst?nlFirst.value.trim():'');
    if(result.ok){
      document.querySelector('.newsletter-body').innerHTML='<span class="newsletter-done">✓ &nbsp;'+(isIT()?'Sei in lista!':"You're on the list!")+'</span>';
      try{sessionStorage.setItem('volio_popup_shown','1');}catch(e){}
      if(window.goatcounter)window.goatcounter.count({path:'newsletter-subscribe',title:'Newsletter: subscribe',event:true});
    }else{
      nlBtn.disabled=false;nlBtn.textContent=isIT()?'Riprova':'Try again';
      nlEmail.style.outline='2px solid #e74c3c';
      setTimeout(()=>nlEmail.style.outline='',2000);
    }
  });
  nlEmail.addEventListener('keydown',e=>{if(e.key==='Enter')nlBtn.click();});
}

/* ---- FOOTER CONTACT : reveal the address, then copy it ---- */
const footContact=document.getElementById('footContact');
if(footContact){
  const ADDR='support@volioapp.it';
  footContact.addEventListener('click',e=>{
    e.preventDefault();
    if(footContact.textContent.indexOf('@')===-1){footContact.textContent=ADDR;return;}
    if(navigator.clipboard){
      navigator.clipboard.writeText(ADDR).then(()=>{
        footContact.textContent=document.documentElement.lang==='it'?'Copiata!':'Copied!';
        setTimeout(()=>footContact.textContent=ADDR,1400);
      }).catch(()=>{});
    }
  });
}

/* ---- EMAIL POPUP : delayed, and never on top of the cookie banner ---- */
const POPUP_DELAY=25000;      /* how long before it can appear */
const POPUP_GRACE=5000;       /* breathing room after the cookie banner goes away */
const modal=document.getElementById('emailModal');
if(modal){
  const mdClose=document.getElementById('modalClose');
  const mdForm=document.getElementById('modalForm');
  const mdSuccess=document.getElementById('modalSuccess');
  const mdSubmit=document.getElementById('modalSubmit');
  const mdEmail=document.getElementById('modalEmail');
  const mdFirst=document.getElementById('modalFirstName');
  const mdConsent=document.getElementById('modalConsent');
  const isIT=()=>document.documentElement.lang==='it';
  const seen=()=>{try{return !!sessionStorage.getItem('volio_popup_shown');}catch(e){return false;}};
  const markSeen=()=>{try{sessionStorage.setItem('volio_popup_shown','1');}catch(e){}};

  function cookieBannerUp(){
    const el=document.querySelector('#iubenda-cs-banner,.iubenda-cs-container,#iubenda-cs-brand');
    if(!el)return false;
    const r=el.getBoundingClientRect();
    return r.height>0&&r.width>0&&getComputedStyle(el).visibility!=='hidden';
  }
  function openModal(){
    mdForm.classList.remove('hide');mdSuccess.classList.remove('show');
    mdEmail.value='';mdFirst.value='';mdConsent.checked=false;
    modal.classList.add('open');
    setTimeout(()=>mdFirst.focus(),350);
  }
  function closeModal(){modal.classList.remove('open');markSeen();}

  function schedulePopup(){
    if(seen())return;
    setTimeout(function waitForBanner(){
      if(seen())return;
      if(cookieBannerUp()){setTimeout(waitForBanner,2000);return;}
      setTimeout(()=>{if(seen())return;openModal();markSeen();},POPUP_GRACE);
    },POPUP_DELAY);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedulePopup);
  else schedulePopup();

  mdClose.addEventListener('click',closeModal);
  modal.addEventListener('click',e=>{if(e.target===modal)closeModal();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal.classList.contains('open'))closeModal();});

  mdSubmit.addEventListener('click',async()=>{
    const email=mdEmail.value.trim();
    if(!email||!email.includes('@')){
      mdEmail.style.borderColor='#e74c3c';mdEmail.focus();
      setTimeout(()=>mdEmail.style.borderColor='',1500);
      return;
    }
    if(!mdConsent.checked){
      const lb=document.getElementById('modalConsentLabel');
      lb.style.color='#e74c3c';
      setTimeout(()=>lb.style.color='',1500);
      return;
    }
    mdSubmit.disabled=true;mdSubmit.textContent='...';
    const result=await subscribeToBrevo(email,mdFirst.value.trim());
    if(result.ok){
      mdForm.classList.add('hide');mdSuccess.classList.add('show');
      if(window.goatcounter)window.goatcounter.count({path:'popup-subscribe',title:'Popup: subscribe',event:true});
      setTimeout(closeModal,3000);
    }else{
      mdSubmit.disabled=false;mdSubmit.textContent=isIT()?'Sono dentro':'Count me in';
      mdEmail.style.borderColor='#e74c3c';mdEmail.focus();
      setTimeout(()=>mdEmail.style.borderColor='',2000);
    }
  });
  mdEmail.addEventListener('keydown',e=>{if(e.key==='Enter')mdSubmit.click();});
}


/* ---- i18n engine : English (default) / Italian ----
   Each page defines window.VOLIO_I18N = { T:[[selector, value, mode?], ...],
   PH:[[selector, placeholder], ...] } before loading this file. */
(function(){
  var cfg=window.VOLIO_I18N||{T:[],PH:[]};
  var T=cfg.T||[], PH=cfg.PH||[];
  var _en=new WeakMap(), _ph=new WeakMap();
  function setLang(lang){
    PH.forEach(function(p){
      var el=document.querySelector(p[0]);if(!el)return;
      if(!_ph.has(el))_ph.set(el,el.placeholder);
      el.placeholder=lang==='it'?p[1]:_ph.get(el);
    });
    T.forEach(function(t){
      var sel=t[0],val=t[1],mode=t[2];
      document.querySelectorAll(sel).forEach(function(el,i){
        if(!_en.has(el))_en.set(el,el.innerHTML);
        if(lang==='it'){
          var s=Array.isArray(val)?val[i]:val;
          if(s==null)return;
          if(mode==='icon'){var g=el.querySelector('svg');el.innerHTML=(g?g.outerHTML+' ':'')+s;}
          else el.innerHTML=s;
        }else{el.innerHTML=_en.get(el);}
      });
    });
    document.documentElement.lang=lang;
    try{localStorage.setItem('volio-lang',lang);}catch(e){}
    document.querySelectorAll('#langToggle,#langToggleM').forEach(function(b){b.textContent=lang==='it'?'EN':'IT';});
  }
  window.volioSetLang=setLang;
  var saved='en';try{saved=localStorage.getItem('volio-lang')||'en';}catch(e){}
  setLang(saved);
  document.querySelectorAll('#langToggle,#langToggleM').forEach(function(b){
    b.addEventListener('click',function(){
      var next=document.documentElement.lang==='it'?'en':'it';
      setLang(next);
      if(next==='it'&&window.goatcounter){
        window.goatcounter.count({path:'lang-switch-italian',title:'Language Switch: Italian',event:true});
      }
    });
  });
})();

/* ---- mobile menu ---- */
(function(){
  var btn=document.getElementById('navToggle'), menu=document.getElementById('mobileMenu');
  if(!btn||!menu)return;
  function close(){menu.classList.remove('open');btn.classList.remove('open');btn.setAttribute('aria-expanded','false');document.body.style.overflow='';}
  function open(){menu.classList.add('open');btn.classList.add('open');btn.setAttribute('aria-expanded','true');document.body.style.overflow='hidden';}
  btn.addEventListener('click',function(){menu.classList.contains('open')?close():open();});
  menu.querySelectorAll('a').forEach(function(a){a.addEventListener('click',close);});
  document.addEventListener('keydown',function(e){if(e.key==='Escape')close();});
  window.addEventListener('resize',function(){if(window.innerWidth>900)close();});
})();

/* ---- field notes: looping marquee, travels left to right ---- */
(function(){
  var track=document.getElementById('notesTrack');
  if(!track)return;
  var wrap=track.parentNode;
  var prev=document.getElementById('notesPrev'), next=document.getElementById('notesNext');
  var reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var originals=Array.prototype.slice.call(track.children);
  if(!originals.length)return;

  function gap(){var cs=getComputedStyle(track);return parseFloat(cs.columnGap||cs.gap||'18')||18;}
  function setWidth(){var g=gap(),w=0;originals.forEach(function(el){w+=el.getBoundingClientRect().width+g;});return w;}
  function cardStep(){return originals[0].getBoundingClientRect().width+gap();}

  var setW=setWidth();
  var copies=Math.max(3,Math.ceil((track.clientWidth*2)/Math.max(setW,1))+2);
  for(var k=1;k<copies;k++){
    originals.forEach(function(el){
      var c=el.cloneNode(true);
      c.setAttribute('aria-hidden','true');
      track.appendChild(c);
    });
  }
  wrap.classList.add('is-looping');

  var pos=0,paused=false,dragging=false,animating=false,anim=null;
  var SPEED=0.35, DIR=1;    /* DIR 1 = cards travel right to left */

  function measure(){setW=setWidth();}
  function wrapPos(){
    if(setW<=0)return;
    while(pos>=setW)pos-=setW;
    while(pos<0)pos+=setW;
  }
  function apply(){track.scrollLeft=pos;}
  function tick(){
    if(!paused&&!dragging&&!animating&&!reduce){pos+=SPEED*DIR;wrapPos();apply();}
    window.requestAnimationFrame(tick);
  }
  function nudge(d){
    if(anim)window.cancelAnimationFrame(anim);
    var start=pos, dist=d*cardStep(), dur=420, t0=null;
    animating=true;
    function frame(t){
      if(t0===null)t0=t;
      var k=Math.min((t-t0)/dur,1);
      var eased=1-Math.pow(1-k,3);
      pos=start+dist*eased;
      wrapPos();apply();
      if(k<1){anim=window.requestAnimationFrame(frame);}
      else{anim=null;animating=false;}
    }
    anim=window.requestAnimationFrame(frame);
  }
  if(prev)prev.addEventListener('click',function(){nudge(-1);});
  if(next)next.addEventListener('click',function(){nudge(1);});
  wrap.addEventListener('mouseenter',function(){paused=true;});
  wrap.addEventListener('mouseleave',function(){paused=false;});
  wrap.addEventListener('focusin',function(){paused=true;});
  wrap.addEventListener('focusout',function(){paused=false;});
  track.addEventListener('keydown',function(e){
    if(e.key==='ArrowRight'){e.preventDefault();nudge(1);}
    if(e.key==='ArrowLeft'){e.preventDefault();nudge(-1);}
  });
  var x0=0,s0=0,moved=false;
  track.addEventListener('pointerdown',function(e){
    dragging=true;moved=false;x0=e.clientX;s0=track.scrollLeft;track.classList.add('grabbing');
  });
  window.addEventListener('pointermove',function(e){
    if(!dragging)return;
    var d=e.clientX-x0;
    if(Math.abs(d)>3)moved=true;
    pos=s0-d;wrapPos();apply();
  });
  window.addEventListener('pointerup',function(){
    if(!dragging)return;dragging=false;pos=track.scrollLeft;track.classList.remove('grabbing');
  });
  track.addEventListener('click',function(e){if(moved)e.preventDefault();},true);
  track.addEventListener('scroll',function(){if(!dragging&&(paused||reduce))pos=track.scrollLeft;},{passive:true});
  window.addEventListener('resize',function(){measure();wrapPos();apply();});
  measure();
  pos=setW;apply();
  if(!reduce)window.requestAnimationFrame(tick);
})();

/* ---- spotter: recent shots carousel ---- */
(function(){
  var track=document.getElementById('shotsTrack');
  if(!track)return;
  var slides=track.children, dotsBox=document.getElementById('shotsDots');
  var prev=document.getElementById('shotsPrev'), next=document.getElementById('shotsNext');
  var reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function step(){var s=slides[0];return s.getBoundingClientRect().width+parseFloat(getComputedStyle(track).columnGap||getComputedStyle(track).gap||20);}
  function perView(){return Math.max(1,Math.round(track.clientWidth/step()));}
  function pages(){return Math.max(1,slides.length-perView()+1);}
  function current(){return Math.round(track.scrollLeft/step());}
  function go(i){var n=pages();i=(i+n)%n;track.scrollTo({left:i*step(),behavior:reduce?'auto':'smooth'});}
  function buildDots(){
    dotsBox.innerHTML='';
    for(var i=0;i<pages();i++){(function(i){var b=document.createElement('button');b.setAttribute('aria-label','Go to shot '+(i+1));b.addEventListener('click',function(){go(i);restart();});dotsBox.appendChild(b);})(i);}
    mark();
  }
  function mark(){var c=current();Array.prototype.forEach.call(dotsBox.children,function(d,i){d.classList.toggle('on',i===c);});}
  prev.addEventListener('click',function(){go(current()-1);restart();});
  next.addEventListener('click',function(){go(current()+1);restart();});
  track.addEventListener('keydown',function(e){if(e.key==='ArrowRight'){e.preventDefault();go(current()+1);restart();}if(e.key==='ArrowLeft'){e.preventDefault();go(current()-1);restart();}});
  var t;track.addEventListener('scroll',function(){clearTimeout(t);t=setTimeout(mark,60);},{passive:true});
  var timer=null,hold=false;
  function tick(){if(!hold&&!document.hidden)go(current()+1);}
  function restart(){if(reduce)return;clearInterval(timer);timer=setInterval(tick,4500);}
  ['mouseenter','touchstart','focusin'].forEach(function(e){track.parentNode.addEventListener(e,function(){hold=true;},{passive:true});});
  ['mouseleave','touchend','focusout'].forEach(function(e){track.parentNode.addEventListener(e,function(){hold=false;},{passive:true});});
  window.addEventListener('resize',buildDots);
  buildDots();restart();
})();

/* ---- phone screenshots that slide up as you scroll ([data-scroll-phone]) ---- */
(function(){
  var boxes=document.querySelectorAll('[data-scroll-phone]');
  if(!boxes.length)return;
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  var ticking=false;
  function update(){
    ticking=false;
    var vh=window.innerHeight, y=window.pageYOffset||document.documentElement.scrollTop||0;
    Array.prototype.forEach.call(boxes,function(box){
      var img=box.querySelector('img'); if(!img)return;
      var r=box.getBoundingClientRect();
      var travel=Math.max(0,img.offsetHeight-box.clientHeight)*0.85;   /* never reveal the very bottom */
      /* 0 where the frame first appears (on load, or entering at the bottom of the screen), 1 once it has left the top */
      var start=Math.min(vh, r.top+y);
      var p=(start-r.top)/Math.max(1,start+r.height);
      p=Math.max(0,Math.min(1,p));
      img.style.transform='translate3d(0,'+(-p*travel).toFixed(1)+'px,0)';
    });
  }
  function req(){if(!ticking){ticking=true;requestAnimationFrame(update);}}
  window.addEventListener('scroll',req,{passive:true});
  window.addEventListener('resize',req);
  window.addEventListener('load',update);
  update();
})();

/* ---- spotter: feed video plays only while on screen (and not at all with reduced motion) ---- */
(function(){
  var v=document.querySelector('.feed-video video');
  if(!v)return;
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){v.removeAttribute('autoplay');v.pause();return;}
  if(!('IntersectionObserver' in window))return;
  new IntersectionObserver(function(es){es.forEach(function(e){
    if(e.isIntersecting){var p=v.play();if(p&&p.catch)p.catch(function(){});}else v.pause();
  });},{threshold:.25}).observe(v);
})();

/* ---- home: "Show more" partners ---- */
(function(){
  var btn=document.getElementById('partnersMore');
  if(!btn)return;
  btn.addEventListener('click',function(){
    btn.parentNode.classList.add('show-all');
    btn.setAttribute('aria-expanded','true');
  });
})();
