import {api,href,mock,session,requireLogin,safeNext} from './api.js';
import {$,$$,ratings,escape,notice,action} from './ui.js';

export function login() {
  const form=$('form'),send=$('#send-code'),phone=$('[name="phone"]'),code=$('[name="code"]');
  const next=safeNext(new URLSearchParams(location.search).get('next'));
  $('.back').href=next;
  if(mock) notice('演示验证码：000000（先点获取验证码）',form);
  let timer;
  function countdown(seconds) {
    clearInterval(timer);let until=Date.now()+seconds*1000;
    const tick=()=>{const left=Math.max(0,Math.ceil((until-Date.now())/1000));send.disabled=left>0;send.textContent=left?`重新获取 ${left}s`:'获取验证码';if(!left)clearInterval(timer);};
    tick();timer=setInterval(tick,1000);
  }
  send.onclick=async()=>{
    if(!phone.reportValidity()||send.disabled)return;
    send.disabled=true;
    try {await api.otp(phone.value.trim());countdown(60);notice('验证码已发送，5 分钟内有效。',form);code.focus();}
    catch(error) {notice(error.message,form);if(error.data?.error==='OTP_COOLDOWN')countdown(60);else send.disabled=false;}
  };
  form.onsubmit=e=>{e.preventDefault();action($('[type="submit"]',form),async()=>{await api.login(phone.value.trim(),code.value.trim());location.assign(next);},form);};
}
export async function write(id) {
  if(!id) {location.replace(href('coaches/',{choose:'1'}));return;}
  if(!requireLogin())return;
  const form=$('form'),submit=$('[type="submit"]',form);submit.disabled=true;
  const [detail,account,mine]=await Promise.all([api.coach(id),api.me(),api.mine()]);
  const coach=detail.coach,existing=mine.reviews.find(r=>r.listed_coach_id===id);
  $('.back').href=href('c/',{id});
  $('#w-h').innerHTML=`${existing?'修改点评':'点评'} ${escape(coach.name)}<span>${escape(coach.nickname+' · '+coach.teaching_mode)}</span>`;
  $('.form > div .tag').textContent=`WRITE A REVIEW // ${coach.province} ${coach.city}`;
  const nickname=$('[name="nickname"]'),body=$('[name="body"]');
  nickname.value=account.nickname||'';nickname.readOnly=!!account.nickname;
  const draftKey=`reviewsDraft:${mock?'mock':'live'}:${account.id}:${id}`;
  let draft;try{draft=JSON.parse(sessionStorage.getItem(draftKey));}catch{}
  const values=Object.fromEntries(ratings.map(([key])=>[key,draft?.[key]??existing?.[key]??0]));
  body.value=draft?.body??existing?.body??'';
  if(!account.nickname)nickname.value=draft?.nickname||'';
  function persist() {sessionStorage.setItem(draftKey,JSON.stringify({...values,body:body.value,nickname:nickname.value}));}
  function count() {$('.count span:last-child').textContent=`${Array.from(body.value).length} / 1000`;persist();}
  body.oninput=count;nickname.oninput=persist;count();
  const groups=[$('.total'),...$$('.pick')];
  groups.forEach((group,index)=>{
    const [key,label]=ratings[index];group.setAttribute('role','radiogroup');group.setAttribute('aria-label',label);
    function update() {$$('button',group).forEach((b,i)=>{b.type='button';b.classList.toggle('on',i<values[key]);b.setAttribute('aria-label',`${i+1} 星`);b.setAttribute('role','radio');b.setAttribute('aria-checked',values[key]===i+1);b.tabIndex=(values[key]||1)===i+1?0:-1;});}
    $$('button',group).forEach((b,i)=>{
      b.onclick=()=>{values[key]=i+1;update();persist();};
      b.onkeydown=e=>{if(['ArrowLeft','ArrowDown','ArrowRight','ArrowUp'].includes(e.key)){e.preventDefault();const n=(i+(['ArrowLeft','ArrowDown'].includes(e.key)?4:1))%5;$$('button',group)[n].click();$$('button',group)[n].focus();}};
    });update();
  });
  submit.textContent=existing?'保存修改':'发布点评';submit.disabled=false;
  if(existing) {
    const remove=document.createElement('button');remove.type='button';remove.className='btn btn--dark';remove.textContent='删除我的点评';submit.after(remove);
    remove.onclick=()=>{if(confirm('删除这条点评？'))action(remove,async()=>{await api.deleteReview(existing.id);sessionStorage.removeItem(draftKey);location.assign(href('c/',{id}));},form);};
  }
  form.onsubmit=e=>{e.preventDefault();persist();action(submit,async()=>{
    if(ratings.some(([key])=>!values[key]))throw new Error('请填写总分和四个分项，均为 1–5 星。');
    if(Array.from(body.value.trim()).length<10||Array.from(body.value.trim()).length>1000)throw new Error('点评正文请填写 10–1000 个字。');
    if(Array.from(nickname.value.trim()).length<2||Array.from(nickname.value.trim()).length>16)throw new Error('昵称请填写 2–16 个字。');
    if(/1\d{10}/u.test(nickname.value))throw new Error('昵称不能是手机号。');
    if(!account.nickname) await api.nickname(nickname.value.trim());
    await api.saveReview(id,existing?.id,{...values,body:body.value.trim()});
    sessionStorage.removeItem(draftKey);location.assign(href('c/',{id}));
  },form);};
}
const provinces='北京 天津 河北 山西 内蒙古 辽宁 吉林 黑龙江 上海 江苏 浙江 安徽 福建 江西 山东 河南 湖北 湖南 广东 广西 海南 重庆 四川 贵州 云南 西藏 陕西 甘肃 青海 宁夏 新疆 香港 澳门 台湾'.split(' ');
export function submitCoach() {
  if(!requireLogin())return;
  const form=$('form');
  $('[name="province"]').innerHTML='<option value="">请选择</option>'+provinces.map(p=>`<option>${p}</option>`).join('');
  $('[name="douyin_url"]').type='url';$('[name="douyin_url"]').maxLength=1000;
  const selected={gender:'男',teaching_mode:'线上+线下'};
  $$('.seg').forEach((group,index)=>{$$('button',group).forEach(button=>{
    button.setAttribute('aria-pressed',button.classList.contains('on'));
    button.onclick=()=>{selected[index?'teaching_mode':'gender']=button.textContent;$$('button',group).forEach(b=>{b.classList.toggle('on',b===button);b.setAttribute('aria-pressed',b===button);});};
  });});
  $('#optional-fields').innerHTML=`<div class="two">${[['best_total_kg','最好总成绩 (kg)','number'],['competition_class','比赛级别','text'],['certifications','资质认证','text'],['coaching_years','执教年限','number']].map(([name,label,type])=>`<label class="field"><span>${label}</span><input class="input" name="${name}" type="${type}" ${type==='number'?'min="0" step="any"':'maxlength="200"'}></label>`).join('')}</div><label class="field"><span>装备类别</span><select class="input" name="equipment"><option value="">请选择</option><option>无装备</option><option>单层装备</option><option>多层装备</option></select></label>`;
  form.onsubmit=e=>{e.preventDefault();action($('[type="submit"]',form),async()=>{
    const data=Object.fromEntries(new FormData(form));Object.assign(data,selected);
    data.gyms=data.gyms.split(/[,，、]/u).map(x=>x.trim()).filter(Boolean);
    if(!data.gyms.length)throw new Error('请填写所属场馆，没有就填「无」。');
    const url=new URL(data.douyin_url);
    if(url.protocol!=='https:'||!(url.hostname==='douyin.com'||url.hostname.endsWith('.douyin.com')))throw new Error('请填写有效的抖音 HTTPS 主页链接。');
    for(const key of ['best_total_kg','coaching_years'])data[key]=data[key]===''?null:Number(data[key]);
    for(const key of ['competition_class','certifications','equipment'])data[key]=data[key]||null;
    try {await api.submit(data);form.reset();notice('已提交，管理员审核通过后上线。',form);}
    catch(error) {if(error.data?.error==='LISTED_COACH_EXISTS'&&error.data.listed_coach_id){location.assign(href('c/',{id:error.data.listed_coach_id,duplicate:'1'}));return;}throw error;}
  },form);};
}
