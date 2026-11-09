// Local-only fixtures from the approved mockups. Never used unless mock is explicit.
import {ApiError} from './api.js';
const key='reviewsMockDataV1';
const fields=['overall','professionalism','communication','results','value'];
const samples=[
  ['王磊','举铁老王','广东','深圳','线上+线下',36,4.7,'laowang'],
  ['陈静','静姐力量举','上海','上海','线上',24,4.5,'jingjie'],
  ['刘洋','洋哥硬拉','浙江','杭州','线下',17,4.2,'yangge'],
  ['周敏','周教练','广东','广州','线上',14,4.4,'zhou'],
  ['张伟','大伟 SBD','北京','北京','线上+线下',12,4.8,'dawei'],
  ['黄志远','志远举铁','广东','深圳','线下',11,4.6,'zhiyuan'],
  ['李娜','娜娜练力量','四川','成都','线上',8,3.9,'nana'],
  ['孙浩','浩子卧推','湖北','武汉','线下',2,4,'haozi'],
  ['梁宇','宇哥练力量','广东','深圳','线上',1,5,'yuge'],
];
const texts=[
  '线上跟了 8 个月。每周计划按上周的 RPE 调，视频基本当天回。备赛最后四周减量排得很细，比赛三项都开满了，总成绩涨了 35 kg。',
  '卧推起桥两个月改过来了。价格偏高，忙的时候回复会慢一两天。',
  '新手入门找的他，从动作模式教起，不急着上重量。半年三项都稳定了，也没受过伤。',
];
function initial() {
  const coaches=samples.map((r,i)=>({id:`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,name:r[0],nickname:r[1],province:r[2],city:r[3],teaching_mode:r[4],douyin_handle:r[7],douyin_url:'https://www.douyin.com/',gender:i===1||i===6?'女':'男',gyms:i===0?['铁馆力量举工作室','南山某健身房']:['无'],best_total_kg:i===0?650:null,competition_class:i===0?'男93':null,equipment:i===0?'无装备':null,certifications:i===0?'NSCA-CSCS':null,coaching_years:i===0?6:null,created_at:`2026-11-${String(i+1).padStart(2,'0')}T00:00:00Z`}));
  const reviews=coaches.flatMap((c,i)=>Array.from({length:samples[i][5]},(_,j)=>{
    const date=new Date(Date.UTC(2026,10,2-j)).toISOString();
    const target=samples[i][6];
    const overall=j<Math.round((target-Math.floor(target))*samples[i][5])?Math.ceil(target):Math.floor(target);
    return {id:`sample-${i}-${j}`,listed_coach_id:c.id,nickname:['深蹲一百八','Lily','硬拉不累'][j%3],overall,professionalism:5,communication:overall,results:overall,value:Math.max(1,overall-1),body:texts[j%3],edited:j===0,created_at:date,updated_at:date};
  }));
  // Preserve the three displayed review examples and the approved Wang averages.
  const wang=reviews.filter(r=>r.listed_coach_id===coaches[0].id);
  const first=[[5,5,5,5,4],[4,5,4,4,3],[5,5,5,5,5]];
  const targets=[4.7,4.8,4.6,4.7,4.3];
  fields.forEach((field,index)=>{
    first.forEach((values,i)=>{wang[i][field]=values[index];});
    let remainder=Math.round(targets[index]*wang.length)-first.reduce((sum,v)=>sum+v[index],0);
    for(let i=3;i<wang.length;i++) {
      wang[i][field]=Math.min(5,Math.max(1,Math.round(remainder/(wang.length-i))));
      remainder-=wang[i][field];
    }
  });
  wang[0].updated_at='2026-11-02T00:00:00.000Z';wang[1].updated_at='2026-10-21T00:00:00.000Z';wang[2].updated_at='2026-10-09T00:00:00.000Z';
  wang.slice(3).forEach((r,i)=>{r.created_at=r.updated_at=new Date(Date.UTC(2026,9,8-i)).toISOString();});
  return {coaches,reviews,account:{id:'mock-reviewer',nickname:null},reports:[],submissions:[]};
}
function state() {try{return JSON.parse(localStorage.getItem(key)) || initial();}catch{return initial();}}
function save(db) {localStorage.setItem(key,JSON.stringify(db));}
function fail(status,error,extra={}) {throw new ApiError(status,{error,...extra});}
function publicCoach(coach,db) {
  const reviews=db.reviews.filter(r=>r.listed_coach_id===coach.id);
  const averages=reviews.length<3?null:Object.fromEntries(fields.map(f=>[f,Math.round(reviews.reduce((s,r)=>s+r[f],0)/reviews.length*10)/10]));
  return {...coach,review_count:reviews.length,averages};
}
function moderate(body) {
  const text=body.normalize('NFKC');
  if(/1\d{10}/u.test(text)) return 'phone';
  if(/(?:微信|wechat|wx)\s*[:：号]?\s*[a-z\d_-]{3,}/iu.test(text)) return 'wechat';
  if(/qq\s*[:：号]?\s*\d{5,}/iu.test(text)) return 'qq';
  if(/https?:\/\/|www\./iu.test(text)) return 'link';
  if(/傻逼/u.test(text)) return 'blocked_word'; // Demo fixture only; live moderation belongs to backend.
  return null;
}
export async function mockRequest(path,{method,body,auth,session}) {
  const db=state(), url=new URL(path,'https://mock.invalid'), p=url.pathname, q=url.searchParams;
  if(auth && (!session || Date.parse(session.expires_at)<=Date.now())) fail(401,'COACH_REVIEW_AUTH_REQUIRED');
  if(p==='/auth/otp') {
    if(db.otpAt && Date.now()-db.otpAt<60000) fail(429,'OTP_COOLDOWN');
    db.otpAt=Date.now();save(db);return null;
  }
  if(p==='/auth/login') {
    if(body.code!=='000000' || !db.otpAt || Date.now()-db.otpAt>300000) fail(401,'OTP_INVALID');
    return {token:'mock-only',expires_at:new Date(Date.now()+86400000).toISOString(),account:db.account};
  }
  if(p==='/me') {
    if(method==='PATCH') {db.account.nickname=body.nickname;save(db);}
    return db.account;
  }
  if(p==='/me/reviews') return {reviews:db.reviews.filter(r=>r.mine)};
  if(p==='/config') return {contact:'演示管理员（仅 mock）'};
  if(p==='/stats') {
    const provinces=[...new Set(db.coaches.map(c=>c.province))].map(province=>{
      const coaches=db.coaches.filter(c=>c.province===province);
      return {province,coach_count:coaches.length,cities:[...new Set(coaches.map(c=>c.city))].map(city=>({city,coach_count:coaches.filter(c=>c.city===city).length}))};
    });
    return {coach_count:db.coaches.length,province_count:provinces.length,review_count:db.reviews.length,provinces};
  }
  if(p==='/coaches' && method==='GET') {
    let coaches=db.coaches.filter(c=>['province','city','teaching_mode'].every(f=>!q.get(f)||q.get(f)===c[f]) && (!q.get('q')||(c.name+c.nickname).toLowerCase().includes(q.get('q').toLowerCase()))).map(c=>publicCoach(c,db));
    const latest=id=>db.reviews.filter(r=>r.listed_coach_id===id).reduce((last,r)=>r.updated_at>last?r.updated_at:last,'');
    coaches.sort(q.get('sort')==='newest'?(a,b)=>b.created_at.localeCompare(a.created_at):(a,b)=>b.review_count-a.review_count||latest(b.id).localeCompare(latest(a.id))||a.name.localeCompare(b.name,'zh'));
    return {coaches:coaches.slice(Number(q.get('offset')||0),Number(q.get('offset')||0)+Number(q.get('limit')||50)),contact:'演示管理员（仅 mock）'};
  }
  if(p==='/coaches' && method==='POST') {
    const existing=[...db.coaches,...db.submissions].find(c=>c.douyin_handle.toLowerCase()===body.douyin_handle.trim().toLowerCase());
    if(existing) fail(409,'LISTED_COACH_EXISTS',{listed_coach_id:existing.id});
    const c={...body,id:crypto.randomUUID(),status:'pending'};db.submissions.push(c);save(db);return c;
  }
  const detail=p.match(/^\/coaches\/([^/]+)$/);
  if(detail) {
    const coach=db.coaches.find(c=>c.id===decodeURIComponent(detail[1]));
    if(!coach) fail(404,'LISTED_COACH_NOT_FOUND');
    return {coach:publicCoach(coach,db),reviews:db.reviews.filter(r=>r.listed_coach_id===coach.id).sort((a,b)=>b.updated_at.localeCompare(a.updated_at)),contact:'演示管理员（仅 mock）'};
  }
  const report=p.match(/^\/reviews\/([^/]+)\/reports$/);
  if(report) {
    if(db.reports.includes(report[1])) fail(409,'COACH_REVIEW_ALREADY_REPORTED');
    db.reports.push(report[1]);save(db);return {id:crypto.randomUUID()};
  }
  const create=p.match(/^\/coaches\/([^/]+)\/reviews$/), edit=p.match(/^\/reviews\/([^/]+)$/);
  if(create||edit) {
    const old=edit?db.reviews.find(r=>r.id===edit[1]&&r.mine):null;
    if(edit&&!old) fail(404,'COACH_REVIEW_NOT_FOUND');
    if(method==='DELETE') {db.reviews=db.reviews.filter(r=>r!==old);save(db);return null;}
    if(!db.account.nickname) fail(400,'NICKNAME_REQUIRED');
    const reason=moderate(body.body);if(reason) fail(400,'COACH_REVIEW_BLOCKED',{reason});
    if(create&&db.reviews.some(r=>r.mine&&r.listed_coach_id===create[1])) fail(409,'COACH_REVIEW_EXISTS');
    if(create&&!db.coaches.some(c=>c.id===create[1])) fail(404,'LISTED_COACH_NOT_FOUND');
    const now=new Date().toISOString();
    const review={...old,...body,id:old?.id||crypto.randomUUID(),listed_coach_id:old?.listed_coach_id||create[1],nickname:db.account.nickname,mine:true,edited:!!old,created_at:old?.created_at||now,updated_at:now};
    db.reviews=db.reviews.filter(r=>r.id!==review.id);db.reviews.push(review);save(db);return review;
  }
  fail(404,'NOT_FOUND');
}
