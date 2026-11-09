// Dependency-free verification of the static assets and API boundary, including mock flows.
// Run: node --experimental-vm-modules cn/reviews/tests/check.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
const root=path.resolve(import.meta.dirname,'..');
const origin='http://127.0.0.1:8063';
const pages=['','coaches/','c/','login/','write/','submit/'];
for(const route of pages) {
  const html=await fs.readFile(path.join(root,route,'index.html'),'utf8');
  assert.match(html,/<title>力量举教练点评<\/title>/);
  let base;
  const document={createElement:()=>({}),head:{append:el=>{base=el.href;}}};
  vm.runInNewContext(html.match(/<script>(.*?)<\/script>/s)[1],{location:{pathname:'/cn/reviews/'+route},document});
  assert.equal(base,'/cn/reviews/');
  for(const [,resource] of html.matchAll(/(?:src|href)="(assets\/[^"]+)"/g)) await fs.access(path.join(root,resource));
}
console.log('PASS: six HTML pages, titles, runtime base and local asset paths');
const makeStorage=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k),clear:()=>data.clear()};};
let redirected='';
const context=vm.createContext({URL,URLSearchParams,localStorage:makeStorage(),location:{origin,pathname:'/cn/reviews/',search:'?mock=1',assign:url=>redirected=url},crypto:globalThis.crypto,setTimeout,clearTimeout,AbortSignal,console});
const modules=new Map();
async function moduleFor(file) {
  if(modules.has(file)) return modules.get(file);
  const mod=new vm.SourceTextModule(await fs.readFile(file,'utf8'),{context,identifier:file,initializeImportMeta:meta=>{meta.url=origin+'/cn/reviews/'+path.relative(root,file);},importModuleDynamically:async(spec,ref)=>{const child=await moduleFor(path.resolve(path.dirname(ref.identifier),spec));if(child.status==='unlinked')await child.link(link);if(child.status==='linked')await child.evaluate();return child;}});
  modules.set(file,mod);return mod;
}
const link=(spec,ref)=>moduleFor(path.resolve(path.dirname(ref.identifier),spec));
const mod=await moduleFor(path.join(root,'assets/api.js'));await mod.link(link);await mod.evaluate();
const {api,href,safeNext,requireLogin}=mod.namespace;
assert.equal(href('c/',{id:'abc'}),'/cn/reviews/c/?id=abc&mock=1');
assert.equal(safeNext('https://outside.invalid/'),href());
assert.equal(requireLogin(),false);assert.match(redirected,/login/);
const stats=await api.stats();assert.equal(stats.coach_count,9);assert.equal(stats.review_count,125);
const all=await api.coaches();assert.equal(all.coaches[0].name,'王磊');assert.equal(all.coaches.length,9);
const filtered=await api.coaches({city:'深圳',province:'广东',teaching_mode:'线上'});assert.equal(filtered.coaches.length,1);assert.equal(filtered.coaches[0].name,'梁宇');
assert.equal((await api.coaches({name:'老王'})).coaches[0].name,'王磊');
assert.equal((await api.coaches({sort:'newest',limit:2})).coaches[0].name,'梁宇');
const coach=all.coaches.find(c=>c.name==='孙浩'),id=coach.id;
assert.equal((await api.coach(id)).coach.averages,null);
await api.otp('13800000000');
await assert.rejects(api.login('13800000000','111111'),error=>error.data.error==='OTP_INVALID');
await api.login('13800000000','000000');assert.equal(requireLogin(),true);
await api.nickname('举铁小王');
const payload={overall:4,professionalism:5,communication:4,results:4,value:4,body:'线下上了十二节私教课，卧推握距和起桥调得很细。'};
for(const text of ['手机号 13800000000','微信 abc123','QQ 12345678','https://example.invalid','傻逼'])await assert.rejects(api.saveReview(id,null,{...payload,body:payload.body+text}),error=>error.data.error==='COACH_REVIEW_BLOCKED');
assert.equal((await api.mine()).reviews.length,0);
const created=await api.saveReview(id,null,payload);
assert.equal((await api.coach(id)).coach.review_count,3);assert.notEqual((await api.coach(id)).coach.averages,null);
await assert.rejects(api.saveReview(id,null,payload),error=>error.data.error==='COACH_REVIEW_EXISTS');
await api.saveReview(id,created.id,{...payload,overall:5});assert.equal((await api.mine()).reviews[0].edited,true);
await api.report(created.id,{reason:'other',explanation:'需要管理员核实'});
assert.equal((await api.coach(id)).reviews.length,3);
await assert.rejects(api.report(created.id,{reason:'abuse',explanation:null}),error=>error.data.error==='COACH_REVIEW_ALREADY_REPORTED');
await api.deleteReview(created.id);assert.equal((await api.coach(id)).coach.averages,null);
const submission={name:'测试教练',nickname:'测试',gender:'男',douyin_handle:'newcoach',douyin_url:'https://www.douyin.com/',province:'广东',city:'深圳',gyms:['无'],teaching_mode:'线上'};
assert.equal((await api.submit(submission)).status,'pending');assert.equal((await api.coaches()).coaches.length,9);
await assert.rejects(api.submit({...submission,douyin_handle:' LAOWANG '}),error=>error.data.error==='LISTED_COACH_EXISTS');
await assert.rejects(api.coach('missing'),error=>error.status===404);
console.log('PASS: mock browse/filter/stats, OTP/login, nickname, block reasons, create/edit/delete, threshold recomputation, report/dedup, submission/dedup, absent coach');
// Exercise the live API adapter with HTTP-shaped responses and actual public route prefix.
context.location.search='';context.localStorage=makeStorage();
const liveModules=new Map();modules.clear();
const requests=[];context.fetch=async(url,options)=>{
  requests.push({url,options});
  assert.ok(url.startsWith('/api/public/coach-reviews/'));
  if(url.endsWith('/auth/login'))return {ok:true,status:200,json:async()=>({token:'live-test-token',expires_at:'2099-01-01',account:{id:'account',nickname:'昵称'}})};
  if(url.includes('/coaches?')) {
    const q=new URL(url,origin).searchParams,offset=Number(q.get('offset')||0);
    const coaches=offset===0?Array.from({length:100},(_,i)=>({id:String(i),created_at:'2026-01-01'})):[{id:'newest-on-page-two',created_at:'2026-11-09'}];
    return {ok:true,status:200,json:async()=>({coaches,contact:''})};
  }
  return {ok:false,status:401,json:async()=>({error:'COACH_REVIEW_AUTH_REQUIRED'})};
};
const live=await moduleFor(path.join(root,'assets/api.js'));await live.link(link);await live.evaluate();
await live.namespace.api.login('13800000000','000000');
const newest=await live.namespace.api.coaches({sort:'newest',limit:1});assert.equal(newest.coaches[0].id,'newest-on-page-two');
await assert.rejects(live.namespace.api.mine());
assert.equal(requests.at(-1).options.headers.Authorization,'Bearer live-test-token');
assert.equal(live.namespace.session(),null);assert.match(redirected,/login/);
console.log('PASS: live route prefix, newest pagination across page boundary, auth header, expiry redirect');
