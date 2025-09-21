// ==UserScript==
// @name         Hide Mark
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Скрывает Марка trololo
// @author       Ilja :)
// @match        https://vk.com/*
// @icon         https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/VK_Compact_Logo_%282021-present%29.svg/2048px-VK_Compact_Logo_%282021-present%29.svg.png
// @grant        none
// ==/UserScript==

(function(){
'use strict';

const BLOCK_RULES = ["Mark Yakomulsky", /Mark\s*Yakomulsky/i];
const HIDDEN_ATTR = 'data-vk-hide-by-script';
const SCAN_SELECTORS = [
  '.ConvoHistory__messageBlock',
  'div.ConvoMessage',
  '[data-message-id]',
  '[data-peer]',
  '[data-author-id]',
  '[data-from-id]'
];
function matchesRule(value){
  if(!value) return false;
  for(const r of BLOCK_RULES){
    if(typeof r === 'string'){
      if(value.indexOf(r) !== -1) return true;
    } else if(r instanceof RegExp){
      try{ if(r.test(value)) return true; }catch(e){}
    } else if(typeof r === 'number'){
      if(value.indexOf(String(r)) !== -1) return true;
    }
  }
  return false;
}
function climbForDataset(el){
  let node = el;
  for(let i=0;i<8 && node;i++){
    if(node.dataset){
      const keys = ['peer','authorId','fromId','from','userId','senderId'];
      for(const k of keys){
        if(node.dataset[k]) return {type:'id', value: String(node.dataset[k])};
      }
    }
    node = node.parentElement;
  }
  return null;
}
function findMessageContainer(el){
  let node = el;
  for(let i=0;i<10 && node;i++){
    if(node.nodeType !==1){ node = node.parentElement; continue; }
    const cls = node.className || '';
    const attrs = node.getAttribute && Array.from(node.attributes||[]).map(a=>a.name+'='+a.value).join(' ');
    if(/ConvoHistory__messageBlock|ConvoMessage|messageBlock|message|msg|bubble/i.test(cls) ||
       /data-message-id|data-peer|data-author-id|data-from-id/.test(attrs) ||
       node.getAttribute && node.getAttribute('role') === 'listitem') return node;
    node = node.parentElement;
  }
  return el;
}
    //я не считаю себя ебанутым но это пизда полная вековой позор
function getAuthorInfo(msg){
  try{
    const anchors = msg.querySelectorAll && msg.querySelectorAll('a[href]');
    if(anchors && anchors.length){
      for(const a of anchors){
        const href = a.getAttribute('href') || a.href || '';
        const txt = (a.textContent||'').trim();
        if(href && href.includes('vk.com') && txt) return {type:'name', value: txt, href: href};
      }
    }
    const authorSelectors = ['.ConvoMessageAuthor','.ConvoMessage__author','[class*="Author"]','[class*="author"]','[data-author-name]'];
    for(const s of authorSelectors){
      const el = msg.querySelector && msg.querySelector(s);
      if(el && (el.textContent||'').trim()) return {type:'name', value: (el.textContent||'').trim()};
    }
    const aria = msg.getAttribute && (msg.getAttribute('aria-label') || msg.getAttribute('title'));
    if(aria) return {type:'name', value: aria};
    const ds = climbForDataset(msg);
    if(ds) return ds;
    const headerSibling = msg.previousElementSibling || msg.parentElement && msg.parentElement.querySelector && msg.parentElement.querySelector('a[href*="vk.com"]');
    if(headerSibling){
      const a = headerSibling.querySelector && headerSibling.querySelector('a[href*="vk.com"]');
      if(a && (a.textContent||'').trim()) return {type:'name', value:(a.textContent||'').trim(), href: a.getAttribute('href')||a.href};
    }
  }catch(e){}
  return null;
}
function hideElement(node, reason){
  if(!node || (node.getAttribute && node.getAttribute(HIDDEN_ATTR))) return false;
  try{
    node.setAttribute(HIDDEN_ATTR, reason||'blocked');
    node.style.transition = 'opacity .08s';
    node.style.opacity = '0';
    setTimeout(()=>{ try{ node.style.display = 'none'; }catch(e){} },120);
    return true;
  }catch(e){ return false; }
}
function processCandidate(node){
  if(!node || node.getAttribute && node.getAttribute(HIDDEN_ATTR)) return false;
  const container = findMessageContainer(node);
  const info = getAuthorInfo(container);
  if(info){
    if(info.type === 'name' && matchesRule(info.value)) return hideElement(container, info.value);
    if(info.type === 'id' && matchesRule(info.value)) return hideElement(container, info.value);
    if(info.href && matchesRule(info.href)) return hideElement(container, info.href);
  }
  return false;
}
function scanRoot(root){
  if(!root) return 0;
  let count = 0;
  const selector = SCAN_SELECTORS.join(',');
  const nodes = Array.from((root.querySelectorAll && root.querySelectorAll(selector)) || []);
  for(const n of nodes){
    try{ if(processCandidate(n)) count++; }catch(e){}
  }
  return count;
}
let containerObserver = null;
let periodicScan = null;
function startObserver(){
  const container = document.querySelector('.ConvoHistory__content') || document.querySelector('.ConvoHistory__wrapper') || document.body;
  scanRoot(document);
  containerObserver = new MutationObserver((mutations)=>{
    const toScan = new Set();
    for(const m of mutations){
      if(m.addedNodes){
        for(const n of m.addedNodes){
          if(n.nodeType===1) toScan.add(n);
        }
      }
      if(m.target && m.target.nodeType===1) toScan.add(m.target);
    }
    toScan.forEach(n=>{ try{ scanRoot(n); }catch(e){} });
  });
  containerObserver.observe(container, { childList:true, subtree:true, characterData:false });
  periodicScan = setInterval(()=>{ try{ scanRoot(document); }catch(e){} }, 4000);
  window.__vkHide = {
    rescan: ()=> scanRoot(document),
    findMatches: ()=> {
      const out = [];
      const selector = SCAN_SELECTORS.join(',');
      const nodes = Array.from((document.querySelectorAll && document.querySelectorAll(selector)) || []);
      for(const n of nodes){
        const info = getAuthorInfo(n);
        out.push({node: n, author: info});
      }
      return out;
    },
    showAll: ()=> {
      const hidden = document.querySelectorAll('['+HIDDEN_ATTR+']');
      hidden.forEach(h=>{ h.style.display=''; h.style.opacity=''; h.removeAttribute(HIDDEN_ATTR); });
      return hidden.length;
    },
    addRule: (r)=>{ BLOCK_RULES.push(r); return BLOCK_RULES; },
    removeRule: (idxOrVal)=>{ if(typeof idxOrVal === 'number') BLOCK_RULES.splice(idxOrVal,1); else { const i = BLOCK_RULES.findIndex(x=>String(x)===String(idxOrVal)); if(i>=0) BLOCK_RULES.splice(i,1);} return BLOCK_RULES; },
    rules: BLOCK_RULES,
    stop: ()=>{ if(containerObserver) containerObserver.disconnect(); if(periodicScan) clearInterval(periodicScan); }
  };
}
if(document.readyState === 'loading'){ window.addEventListener('DOMContentLoaded', startObserver); } else startObserver();

})();