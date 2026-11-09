import {api,href,mock,session} from './api.js';
import {scoreDisplay} from './lib.js';
export const $ = (selector,root=document) => root.querySelector(selector);
export const $$ = (selector,root=document) => [...root.querySelectorAll(selector)];
export const escape = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const ratings = [['overall','总分'],['professionalism','专业度'],['communication','沟通反馈'],['results','训练效果'],['value','性价比']];
export function stars(value) {const n=Math.max(0,Math.min(5,Math.floor(Number(value)||0)));return '★'.repeat(n)+'<s>'+'★'.repeat(5-n)+'</s>';}
export function notice(text,root=document.body) {
  let box=$(':scope > .status',root);
  if(!box) {box=document.createElement('div');box.className='alert status';box.setAttribute('role','status');root.append(box);}
  box.textContent=text;box.hidden=!text;return box;
}
export async function action(button,work,root=button.closest('form')||document.body) {
  if(button.disabled) return;
  button.disabled=true;
  try {await work();} catch(error) {notice(error.message,root);} finally {button.disabled=false;}
}
export function row(coach,choose=false) {
  const count=coach.review_count,score=scoreDisplay(count,coach.averages?.overall);
  return `<a class="row" href="${escape(href(choose?'write/':'c/',{[choose?'coach':'id']:coach.id}))}"><span class="row__name">${escape(coach.name)}</span><span class="row__alias">${escape(coach.nickname)}</span><span class="row__mode">${escape(coach.teaching_mode)}</span><span class="row__city">${escape(coach.province===coach.city?coach.city:coach.province+' '+coach.city)}</span>${count<3?`<span class="row__few">${score} · ${count} 条</span>`:`<span class="row__score"><b>${score}</b><small>${count} REVIEWS</small></span>`}</a>`;
}
export function safeLink(value) {
  try {const url=new URL(value);return ['https:','http:','mailto:'].includes(url.protocol)?url.href:null;} catch {return null;}
}
export function contacts(config) {
  $$('.contact').forEach(el=>{
    el.hidden=!config.contact;
    if(config.contact) {
      el.replaceChildren(document.createTextNode('教练本人申请下架 / 投诉：'));
      const url=safeLink(config.contact),node=document.createElement(url?'a':'span');
      node.textContent=config.contact;if(url) node.href=url;el.append(node);
    }
  });
  $$('[data-policy]').forEach(link=>{
    const target=safeLink(config[link.dataset.policy+'_url']);
    if(target) {link.href=target;link.removeAttribute('data-unavailable');}
  });
}
export function setupCommon() {
  $$('a[href]').forEach(link=>{
    if(link.dataset.policy) {
      link.dataset.unavailable='true';
      link.addEventListener('click',e=>{if(link.dataset.unavailable){e.preventDefault();notice('该页面暂未提供。');}});
      return;
    }
    const url=new URL(link.getAttribute('href'),document.baseURI);
    if(url.origin===location.origin && mock) {url.searchParams.set('mock','1');link.href=url.pathname+url.search+url.hash;}
    if(link.textContent.trim()==='登录' && session()) link.textContent='已登录';
  });
  $$('button[aria-label="搜索教练"]').forEach(b=>b.onclick=()=>$('.search input')?.focus());
  const form=$('form');
  if(form && !$('.contact')) {const contact=document.createElement('p');contact.className='contact fine';contact.hidden=true;form.append(contact);}
  api.config().then(contacts).catch(()=>{});
}
export function setupSearch(filters={},onSearch) {
  const form=$('form.search');if(!form)return;
  const input=$('input',form),tabs=$$('.search__tabs button',form);
  let mode=filters.city?'city':filters.q?'q':document.body.dataset.page==='home'?'city':'q';
  function select(next) {
    mode=next;tabs.forEach((tab,i)=>{const on=(i===0)===(mode==='city');tab.classList.toggle('on',on);tab.setAttribute('aria-selected',on);});
    input.placeholder=mode==='city'?'输入城市，比如 深圳':'输入教练名字或网名';input.setAttribute('aria-label',input.placeholder);
    input.value=filters[mode]||'';
  }
  tabs.forEach((tab,i)=>tab.onclick=()=>select(i===0?'city':'q'));
  select(mode);
  form.onsubmit=e=>{e.preventDefault();onSearch({...filters,[mode]:input.value.trim()});};
}
