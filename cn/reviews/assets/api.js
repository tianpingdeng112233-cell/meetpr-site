import { buildQuery, blockedReason } from './lib.js';

export const mock = new URLSearchParams(location.search).get('mock') === '1' || localStorage.reviewsMock === '1';
export const basePath = new URL('../', import.meta.url).pathname;
const prefix = '/api/public/coach-reviews';
const sessionKey = mock ? 'reviewsMockSession' : 'reviewsSession';
function readJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
export function session() { return readJSON(sessionKey, null); }
export function href(path = '', params = {}) {
  const url = new URL(path, location.origin + basePath);
  for (const [key,value] of Object.entries(params)) if (value != null && value !== '') url.searchParams.set(key,value);
  if (mock) url.searchParams.set('mock','1');
  return url.pathname + url.search + url.hash;
}
export function loginRedirect() {
  const next = location.pathname + location.search;
  location.assign(href('login/', {next}));
}
export function requireLogin() {
  const saved = session();
  if (!saved || Date.parse(saved.expires_at) <= Date.now()) { localStorage.removeItem(sessionKey); loginRedirect(); return false; }
  return true;
}
export function safeNext(value) {
  try {
    const url = new URL(value || basePath, location.origin);
    return url.origin === location.origin && url.pathname.startsWith(basePath) && !url.pathname.startsWith(basePath+'login') ? url.pathname+url.search+url.hash : href();
  } catch { return href(); }
}
const errors = {
  OTP_INVALID:'验证码错误或已过期，请重新获取。', OTP_COOLDOWN:'请等 60 秒后重新获取验证码。', OTP_DAILY_LIMIT:'今天获取验证码次数已达上限，请明天再试。',
  COACH_REVIEW_AUTH_REQUIRED:'登录已过期，请重新登录。', NICKNAME_REQUIRED:'请先设置昵称。',
  COACH_REVIEW_EXISTS:'你已经点评过这位教练，请返回教练页修改我的点评。',
  COACH_REVIEW_ALREADY_REPORTED:'你已经举报过这条点评，管理员会在 3 天内处理。',
  LISTED_COACH_NOT_FOUND:'该教练页面不存在或已下架', COACH_REVIEW_NOT_FOUND:'这条点评不存在或已删除。',
  LISTED_COACH_EXISTS:'这位教练已经在列表里', VALIDATION_ERROR:'请检查必填项和输入格式。',
};
export class ApiError extends Error {
  constructor(status, data = {}) {
    super(data.error === 'COACH_REVIEW_BLOCKED' ? blockedReason(data.reason,data.message) : data.message || errors[data.error] || (status===429 ? '操作太频繁，请稍后再试。' : '请求失败，请稍后重试。'));
    this.status=status; this.data=data;
  }
}
async function request(path, {method='GET', body, auth=false} = {}) {
  try {
    if (mock) { const {mockRequest} = await import('./mock.js'); return await mockRequest(path,{method,body,auth,session:session()}); }
    const headers = {Accept:'application/json'};
    if (body !== undefined) headers['Content-Type']='application/json';
    if (auth && session()?.token) headers.Authorization=`Bearer ${session().token}`;
    const res = await fetch(prefix+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(15000)});
    const data = res.status===204 ? null : await res.json().catch(()=>({}));
    if (!res.ok) throw new ApiError(res.status,data);
    return data;
  } catch (error) {
    if (auth && error.status===401) { localStorage.removeItem(sessionKey); loginRedirect(); }
    if (error instanceof ApiError) throw error;
    throw new Error('暂时无法连接，请稍后重试。');
  }
}
export const api = {
  async coaches(filters={}) {
    if (filters.sort !== 'newest' || mock) return request('/coaches?'+buildQuery(filters));
    // The current backend has no newest sort. Read all pages before sorting;
    // sorting only the first review-ranked page would silently omit new coaches.
    const coaches=[];let offset=0,contact='';
    while (true) {
      const data=await request('/coaches?'+buildQuery({...filters,sort:undefined,limit:100,offset}));
      coaches.push(...data.coaches);contact=data.contact;offset+=data.coaches.length;
      if (data.coaches.length<100) break;
    }
    coaches.sort((a,b)=>b.created_at.localeCompare(a.created_at)||a.id.localeCompare(b.id));
    const start=Number(filters.offset||0);
    return {coaches:coaches.slice(start,start+Number(filters.limit||50)),contact};
  },
  coach: id => request('/coaches/'+encodeURIComponent(id)),
  otp: phone => request('/auth/otp',{method:'POST',body:{phone}}),
  async login(phone,code) {
    const data=await request('/auth/login',{method:'POST',body:{phone,code}});
    localStorage.setItem(sessionKey,JSON.stringify(data)); return data;
  },
  me: () => request('/me',{auth:true}),
  async nickname(nickname) {
    const account=await request('/me',{method:'PATCH',body:{nickname},auth:true});
    localStorage.setItem(sessionKey,JSON.stringify({...session(),account})); return account;
  },
  mine: () => request('/me/reviews',{auth:true}),
  saveReview: (coach,id,body) => request(id?'/reviews/'+encodeURIComponent(id):'/coaches/'+encodeURIComponent(coach)+'/reviews',{method:id?'PATCH':'POST',body,auth:true}),
  deleteReview: id => request('/reviews/'+encodeURIComponent(id),{method:'DELETE',auth:true}),
  report: (id,body) => request('/reviews/'+encodeURIComponent(id)+'/reports',{method:'POST',body,auth:true}),
  submit: body => request('/coaches',{method:'POST',body,auth:true}),
  // A4: GET /api/public/coach-reviews/stats
  // {coach_count, province_count, review_count,
  //  provinces:[{province,coach_count,cities:[{city,coach_count}]}]}
  // Published coaches and undeleted reviews only. No estimates from a paginated list.
  stats: () => request('/stats'),
  // 待对齐接口 A1 (optimization): coaches?sort=newest orders by created_at DESC, id;
  // Until supported, coaches() above paginates fully and sorts in the adapter.
  // default/review_count keeps the backend's review_count/latest_review/name order.
  // Public configuration: GET /config returns {contact}. List/detail also include it.
  // Optional proposed config fields: rules_url, terms_url, privacy_url (approved destinations).
  config: () => request('/config'),
};

// All non-business network loading stays at the data boundary too.
export async function mapConfig() {
  if (mock) return {};
  try { return (await import('./config.js')).default || {}; } catch { return {}; }
}
export function loadAMap(key,securityCode) {
  if (window.AMap) return Promise.resolve(window.AMap);
  window._AMapSecurityConfig={securityJsCode:securityCode};
  return new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    const timer=setTimeout(()=>reject(new Error('地图加载超时')),10000);
    script.src='https://webapi.amap.com/maps?v=2.0&key='+encodeURIComponent(key);
    script.onload=()=>{clearTimeout(timer);window.AMap?resolve(window.AMap):reject(new Error('地图不可用'));};
    script.onerror=()=>{clearTimeout(timer);reject(new Error('地图不可用'));};
    document.head.append(script);
  });
}
