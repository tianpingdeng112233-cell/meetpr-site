import {api,href,session,requireLogin} from './api.js';
import {scoreDisplay} from './lib.js';
import {$,$$,escape,row,stars,ratings,notice,contacts,setupSearch,action,safeLink} from './ui.js';
import {renderMap} from './map.js';

function filtersFromURL() {return Object.fromEntries(new URLSearchParams(location.search));}
function navigateFilters(filters) {location.assign(href('coaches/',filters));}
function setupFilters(stats,filters,onChange) {
  const container=$('.filters');if(!container)return;
  const provinces=stats?.provinces||[];
  const province=$('select',container),city=$('select[aria-label="城市"]',container);
  if(province) {
    const names=[...new Set([...provinces.map(p=>p.province),filters.province].filter(Boolean))];
    province.innerHTML='<option value="">全部省份</option>'+names.map(p=>`<option>${escape(p)}</option>`).join('');province.value=filters.province||'';
    province.onchange=()=>onChange({...filters,province:province.value,city:''});
  }
  if(city) {
    const cities=provinces.filter(p=>!filters.province||p.province===filters.province).flatMap(p=>p.cities.map(c=>c.city));
    city.innerHTML='<option value="">全部城市</option>'+[...new Set([...cities,filters.city].filter(Boolean))].map(c=>`<option>${escape(c)}</option>`).join('');city.value=filters.city||'';
    city.onchange=()=>onChange({...filters,city:city.value});
  }
  $$('button',container).forEach((button,i)=>{
    const mode=i?button.textContent:'';button.classList.toggle('on',mode===(filters.teaching_mode||''));
    button.onclick=()=>onChange({...filters,teaching_mode:mode});
  });
}
export async function home() {
  setupSearch({},navigateFilters);
  const results=await Promise.allSettled([api.stats(),api.coaches({limit:4}),api.coaches({sort:'newest',limit:2})]);
  const stats=results[0].status==='fulfilled'?results[0].value:null;
  setupFilters(stats,{},navigateFilters);
  if(stats) {
    $$('.stat b').forEach((el,i)=>{el.firstChild.textContent=[stats.coach_count,stats.province_count,stats.review_count][i];});
    $('.roster .more').textContent=`VIEW ALL ${stats.coach_count} COACHES →`;
    await renderMap(stats);
  } else {notice('教练分布暂时无法加载。',$('#city-fallback'));}
  for(const [index,id] of [[1,'#popular-coaches'],[2,'#new-coaches']]) {
    const result=results[index];$(id).innerHTML=result.status==='fulfilled'?(result.value.coaches.map(c=>row(c)).join('')||'<p class="empty">暂无教练</p>'):'<p class="empty">名单暂时无法加载，请稍后重试。</p>';
  }
}
export async function list() {
  const filters=filtersFromURL(),choose=filters.choose==='1';
  if(choose) notice('选择一位教练，写下你的点评。',$('.list-head'));
  setupSearch(filters,navigateFilters);
  const stats=await api.stats().catch(()=>null);setupFilters(stats,filters,navigateFilters);
  let offset=0;const limit=50,more=$('#load-more');
  async function load() {
    const data=await api.coaches({...filters,limit,offset});contacts(data);
    $('#coach-list').insertAdjacentHTML('beforeend',data.coaches.map(c=>row(c,choose)).join(''));
    offset+=data.coaches.length;
    $('.list-meta .tag').textContent=`${offset}${data.coaches.length===limit?'+':''} COACHES`;
    more.hidden=data.coaches.length<limit;
    if(offset===0) $('#coach-list').innerHTML='<p class="empty">没有找到符合条件的教练。换个城市或名字试试。</p>';
  }
  more.onclick=()=>action(more,load,$('.roster .wrap'));await load();
}
function reviewHTML(r,mine) {
  return `<article class="review" data-review="${escape(r.id)}"><div class="review__top"><b>${escape(r.nickname)}</b><span class="stars" aria-label="${r.overall} 星">${stars(r.overall)}</span><time>${escape(r.updated_at?.slice(0,10).replaceAll('-','.'))}</time>${r.edited?'<span class="review__edited">已修改</span>':''}<button class="review__report" data-report="${escape(r.id)}">举报</button></div><div class="review__subs">${ratings.slice(1).map(([key,label])=>`${label} ${r[key]}`).join(' · ')}</div><p>${escape(r.body)}</p>${mine?`<div class="review__actions"><a href="${escape(href('write/',{coach:r.listed_coach_id}))}">修改我的点评</a><button data-delete="${escape(r.id)}">删除我的点评</button></div>`:''}</article>`;
}
export async function coach(id) {
  if(!id) {$('#coach-profile').innerHTML='<h1 id="coach-h" class="empty">该教练页面不存在或已下架</h1>';$('.body').hidden=true;return;}
  let data;
  try {data=await api.coach(id);} catch(error) {$('#coach-profile').innerHTML=`<h1 id="coach-h" class="empty">${escape(error.message)}</h1>`;$('.body').hidden=true;contacts(error.data||{});return;}
  const c=data.coach;contacts(data);
  let mine=[];
  if(session()) {try {mine=(await api.mine()).reviews;}catch{}}
  const own=mine.find(r=>r.listed_coach_id===id),writeURL=href('write/',{coach:id});
  const score=scoreDisplay(c.review_count,c.averages?.overall);
  const douyin=safeLink(c.douyin_url);
  $('#coach-profile').innerHTML=`<div><span class="tag">COACH // ${escape(c.province+' '+c.city)}</span><h1 id="coach-h" class="huge">${escape(c.name)}<span>${escape(c.nickname)}</span></h1><div class="profile__meta"><span>${escape(c.gender)}</span><span>${escape(c.teaching_mode)}</span>${c.coaching_years!=null?`<span>执教 ${c.coaching_years} 年</span>`:''}</div><div class="profile__cta"><a class="btn btn--solid" href="${escape(writeURL)}">${own?'修改我的点评':'写点评'}</a>${douyin?`<a class="btn btn--dark" href="${escape(douyin)}" target="_blank" rel="noopener">抖音主页 ↗</a>`:''}</div></div><div class="score ${c.review_count<3?'score--few':''}" aria-label="${score}，共 ${c.review_count} 条点评"><b>${score}</b>${c.review_count>=3?`<span class="stars" aria-hidden="true">${stars(c.averages?.overall)}</span>`:''}<small>${c.review_count} REVIEWS</small></div>`;
  $$('.bar__actions a').filter(a=>a.href.includes('/write/')).forEach(a=>{a.href=writeURL;a.textContent=own?'修改我的点评':'写点评';});
  $('.bar').classList.toggle('has-own-review',!!own);
  $('.subs').innerHTML=c.review_count<3?'<p class="tag">点评较少</p>':ratings.slice(1).map(([key,label])=>`<div class="sub"><span>${label}</span><i style="--v:${Number(c.averages?.[key]||0)*20}%"></i><b>${scoreDisplay(c.review_count,c.averages?.[key])}</b></div>`).join('');
  const total=c.best_total_kg==null?'未提供':`<em>${escape(c.best_total_kg)}</em> KG`;
  const years=c.coaching_years==null?'未提供':`<em>${escape(c.coaching_years)}</em> 年`;
  $('.facts').innerHTML=[['BEST TOTAL',`${total} · ${escape(c.competition_class||'未提供级别')} · ${escape(c.equipment||'未提供装备类别')}`],['CERTIFICATION',escape(c.certifications||'未提供')],['GYM',escape(c.gyms.join('、'))],['COACHING',years]].map(([key,value])=>`<div><dt>${key}</dt><dd>${value}</dd></div>`).join('');
  $('.reviews-head .tag').textContent=`REVIEWS // ${c.review_count}`;
  const draw=sort=>{
    const reviews=[...data.reviews];if(sort==='score') reviews.sort((a,b)=>b.overall-a.overall||b.updated_at.localeCompare(a.updated_at));
    $('#review-list').innerHTML=reviews.map(r=>reviewHTML(r,r.id===own?.id)).join('')||'<p class="empty">还没有点评，写下你的体验。</p>';
    $$('[data-report]').forEach(b=>b.onclick=()=>report(data.reviews.find(r=>r.id===b.dataset.report)));
    $$('[data-delete]').forEach(b=>b.onclick=()=>{if(confirm('删除这条点评？')) action(b,async()=>{await api.deleteReview(b.dataset.delete);await coach(id);},$('#review-list'));});
  };
  $$('.reviews-head button').forEach((b,i)=>b.onclick=()=>{$$('.reviews-head button').forEach(v=>v.classList.toggle('on',v===b));draw(i?'score':'latest');});draw('latest');
  const pending=new URLSearchParams(location.search).get('report');
  if(pending && session()) {const review=data.reviews.find(r=>r.id===pending);if(review) report(review);}
}
function report(review) {
  if(!session()) {location.assign(href('login/',{next:href('c/',{id:review.listed_coach_id,report:review.id})}));return;}
  if(!requireLogin()) return;
  const dialog=$('#report-dialog'),form=$('form',dialog);form.reset();$('.status',form)?.remove();
  $('.quote',dialog).textContent=`「${review.body}」—— ${review.nickname}`;
  const textarea=$('textarea',form);textarea.maxLength=1000;
  $$('input[type="radio"]',form).forEach((input,i)=>{input.value=['abuse','privacy','advertising','other'][i];input.onchange=()=>{textarea.required=input.value==='other';$('.field > span',form).textContent=input.value==='other'?'补充说明（必填）':'补充说明（选填）';};});
  textarea.required=false;
  $('.field > span',form).textContent='补充说明（选填）';
  $('.close',dialog).onclick=()=>dialog.close();
  form.onsubmit=e=>{e.preventDefault();action($('button[type="submit"]',form),async()=>{await api.report(review.id,{reason:$('input:checked',form).value,explanation:textarea.value.trim()||null});dialog.close();notice('照常显示，3 天内处理',$('#review-list'));},form);};
  dialog.showModal();
}
