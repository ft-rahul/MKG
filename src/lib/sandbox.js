// Shared sandbox page builder for the Tutor workspace and the Lobby demo.

import { annotateHtml } from './lens';

/*
 * Lens: the parent sends { __monklogyLens, id, line | selector } while a line is
 * hovered in the editor. Matching elements get a highlight box (like DevTools),
 * and the page replies with how many matched and how many are visible.
 *
 * With a link map ([{ f: 'css' | 'js', l: line, s: selector }]) the page also
 * works the other way: hovering an element outlines it and reports the source
 * lines that built it (HTML), style it (CSS) and use it (JS) as a "pick".
 */
const lensScript = (map, runId) => `(function(){
  var boxes=[],els=[],tagOf=function(el){var s=el.tagName.toLowerCase();if(el.id)s+='#'+el.id;if(typeof el.className==='string'&&el.className.trim())s+='.'+el.className.trim().split(/\\s+/).join('.');return s};
  var C='#4f8cff',css=document.createElement('style');
  css.textContent='[data-ml-lens]{position:fixed;z-index:2147483647;pointer-events:none;box-sizing:border-box;border:2px solid var(--c);border-radius:4px;background:color-mix(in srgb,var(--c) 14%,transparent);animation:mlin .15s ease-out}[data-ml-lens][data-still]{animation:none}[data-ml-lens]>span{position:absolute;left:-2px;background:var(--c);color:#fff;font:600 11px/1.5 ui-monospace,Menlo,monospace;padding:1px 7px;border-radius:4px;white-space:nowrap}@keyframes mlin{from{opacity:0}to{opacity:1}}@media (prefers-reduced-motion:reduce){[data-ml-lens]{animation:none}}';
  document.head.appendChild(css);
  var clear=function(){boxes.forEach(function(b){b.remove()});boxes=[]};
  var draw=function(still){clear();els.slice(0,40).forEach(function(el,i){var r=el.getBoundingClientRect();if(!r.width&&!r.height)return;
    var b=document.createElement('div');b.setAttribute('data-ml-lens','');if(still)b.setAttribute('data-still','');
    b.style.cssText='--c:'+C+';left:'+r.left+'px;top:'+r.top+'px;width:'+r.width+'px;height:'+r.height+'px';
    if(i<6){var t=document.createElement('span');t.textContent='<'+el.tagName.toLowerCase()+'>';t.style.cssText=r.top>22?'bottom:100%':'top:100%';b.appendChild(t)}
    document.documentElement.appendChild(b);boxes.push(b)})};
  window.addEventListener('scroll',function(){if(els.length)draw(true)},true);
  window.addEventListener('resize',function(){if(els.length)draw(true)});
  window.addEventListener('message',function(e){var d=e.data;if(!d||!d.__monklogyLens)return;els=[];C=d.color||'#4f8cff';
    try{if(d.line)els=[].slice.call(document.querySelectorAll('[data-ml-line="'+d.line+'"]'));else if(d.selector)els=[].slice.call(document.querySelectorAll(d.selector)).filter(function(n){return !n.hasAttribute('data-ml-lens')})}catch(err){}
    if(els[0]&&els[0].scrollIntoView)els[0].scrollIntoView({block:'nearest',inline:'nearest'});
    draw();
    var shown=els.filter(function(n){var r=n.getBoundingClientRect();return r.width||r.height}).length;
    parent.postMessage({__monklogy:true,run:d.run,type:'lens',id:d.id,count:els.length,visible:shown,first:els[0]?tagOf(els[0]):''},'*')});${map ? `
  var MAP=${JSON.stringify(map).replace(/</g, '\\u003c')},last=null;
  var pick=function(el){if(el===last)return;last=el;els=el?[el]:[];C='#2563eb';draw();var css=[],js=[];
    if(el)MAP.forEach(function(m){try{if(el.matches(m.s))(m.f==='css'?css:js).push(m.l)}catch(err){}});
    parent.postMessage({__monklogy:true,run:${runId},type:'pick',tag:el?tagOf(el):'',html:el?+el.getAttribute('data-ml-line'):null,css:css,js:js},'*')};
  document.addEventListener('mouseover',function(e){var el=e.target&&e.target.closest?e.target.closest('[data-ml-line]'):null;if(el)pick(el)});
  document.addEventListener('click',function(e){var el=e.target&&e.target.closest?e.target.closest('[data-ml-line]'):null;parent.postMessage({__monklogy:true,run:${runId},type:'tap',tag:el?tagOf(el):''},'*')},true);
  document.documentElement.addEventListener('mouseleave',function(){last=null;els=[];clear()});` : ''}
})();`;

/*
 * Builds the sandboxed page. Every message carries the run id, so output from
 * an earlier run can never be mistaken for the current one. The user's script
 * starts on a known line, so runtime errors map back to script.js line numbers.
 * When `executeJs` is false (the build failed) the script is not included.
 */
export const buildDocument = (files, runId, { executeJs = true, lens = false, linkMap = null } = {}) => {
  const get = (lang) => files.find((f) => f.language === lang)?.code || '';
  const html = lens ? annotateHtml(get('html')) : get('html');
  const js = get('javascript').replace(/<\/script/gi, '<\\/script');
  const head = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${get('css')}</style></head><body>${html}
<script>(function(){
  var RUN=${runId};
  var fmt=function(a){try{if(typeof a==='string')return a;if(typeof a==='function')return 'ƒ '+(a.name||'anonymous')+'()';if(a instanceof Error)return a.name+': '+a.message;if(a instanceof Element)return '<'+a.tagName.toLowerCase()+(a.id?'#'+a.id:'')+'>';var s=JSON.stringify(a);return s===undefined?String(a):s}catch(e){return String(a)}};
  var send=function(type,args,extra){try{var m={__monklogy:true,run:RUN,type:type,text:Array.prototype.map.call(args,fmt).join(' ')};for(var k in extra)m[k]=extra[k];parent.postMessage(m,'*')}catch(e){}};
  ['log','info','warn','error'].forEach(function(k){var o=console[k];console[k]=function(){send(k,arguments);o.apply(console,arguments)}});
  window.addEventListener('error',function(e){var msg=String(e.message||'Error').replace('Uncaught ','');send('runtime',[msg],{lineno:e.lineno,colno:e.colno})});
  window.addEventListener('unhandledrejection',function(e){var r=e.reason;send('runtime',['Unhandled promise rejection: '+(r&&r.name?r.name+': '+r.message:fmt(r))])});
  // A srcdoc page resolves links against the app's address, so href="#" or a form submit would load the app inside the preview. Keep navigation in the page.
  window.addEventListener('click',function(e){if(e.defaultPrevented)return;var a=e.target&&e.target.closest?e.target.closest('a[href]'):null;if(!a)return;var h=a.getAttribute('href')||'';if(/^javascript:/i.test(h))return;e.preventDefault();if(h.charAt(0)==='#'){var t=h.length>1&&(document.getElementById(decodeURIComponent(h.slice(1)))||document.getElementsByName(h.slice(1))[0]);if(t)t.scrollIntoView();else if(h==='#')window.scrollTo(0,0)}else send('info',['Link to '+h+' does not open in the preview.'])});
  window.addEventListener('submit',function(e){if(e.defaultPrevented)return;e.preventDefault();send('info',['Form submitted. The preview does not send forms; handle the submit event to use the data.'])});
  window.addEventListener('message',function(e){var d=e.data;if(!d||!d.__monklogyEval)return;try{var r=(0,eval)(d.code);if(r&&typeof r.then==='function'){send('result',['Promise {<pending>}'],{id:d.id});r.then(function(v){send('result',['Promise resolved: '+fmt(v)],{id:d.id})},function(err){send('runtime',['Promise rejected: '+fmt(err)],{id:d.id})})}else send('result',[r===undefined?'undefined':typeof r==='string'?JSON.stringify(r):fmt(r)],{id:d.id})}catch(err){send('evalerror',[err.name+': '+err.message],{id:d.id})}});
})();${lens ? lensScript(linkMap, runId) : ''}<\/script>
<script>`;
  const jsStartLine = head.split('\n').length;
  const tail = `<\/script>
<script>parent.postMessage({__monklogy:true,run:${runId},type:'done'},'*')<\/script></body></html>`;
  // A failed build gets no "done" signal: nothing ran, so nothing can report success.
  return { html: executeJs ? head + js + tail : `${head}/* build failed — script not executed */<\/script></body></html>`, jsStartLine };
};

