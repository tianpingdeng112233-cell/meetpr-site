// Optional browser walk-through using an already installed Playwright; no install/build step.
// PLAYWRIGHT_MODULE=/absolute/path/to/playwright-core node cn/reviews/tests/browser-check.mjs
// All temporary browser state/screenshots stay in the worktree's .verification-063/.
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const repo=path.resolve(import.meta.dirname,'../../..');
const output=path.join(repo,'.verification-063');
await fs.mkdir(output,{recursive:true});
const server=http.createServer(async(req,res)=>{
  try {
    let relative=decodeURIComponent(new URL(req.url,'http://local').pathname);
    if(relative==='/favicon.ico'){res.writeHead(204).end();return;}
    // Same static files under the local prefix and the deployed prefix, plus c/:id rewrite.
    if(relative.startsWith('/reviews/'))relative='/cn'+relative;
    if(/^\/cn\/reviews\/c\/[^/]+\/?$/.test(relative)&&!relative.endsWith('index.html'))relative='/cn/reviews/c/index.html';
    let file=path.resolve(repo,'.'+relative);
    if(!file.startsWith(repo+path.sep)){res.writeHead(403).end();return;}
    if((await fs.stat(file)).isDirectory())file=path.join(file,'index.html');
    res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.jpg':'image/jpeg'})[path.extname(file)]||'application/octet-stream');
    res.end(await fs.readFile(file));
  } catch {res.writeHead(404).end();}
});
let context;
try {
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const origin=`http://127.0.0.1:${server.address().port}`;
  context=await chromium.launchPersistentContext(path.join(output,'browser-profile'),{
    headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),
    downloadsPath:path.join(output,'downloads'),artifactsDir:path.join(output,'artifacts'),
  });
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('dialog',d=>d.accept());
  async function go(route) {
    await page.goto(origin+'/cn/reviews/'+route+(route.includes('?')?'&':'?')+'mock=1');
    await page.waitForSelector('html[data-ready="true"]');
  }
  async function loaded() {await page.waitForSelector('html[data-ready="true"]');}
  await go('');await page.evaluate(()=>localStorage.clear());await go('');
  await page.locator('.search input').fill('深圳');await page.locator('.search__bar button').click();await loaded();
  assert.equal(new URL(page.url()).searchParams.get('city'),'深圳');
  assert.equal(await page.locator('#coach-list .row').count(),3);
  await go('');await page.getByRole('tab',{name:'按名字 / 网名'}).click();await page.locator('.search input').fill('老王');await page.locator('.search__bar button').click();await loaded();
  assert.equal(await page.locator('#coach-list .row').count(),1);
  await page.locator('#coach-list .row').click();await loaded();
  const wang=new URL(page.url()).searchParams.get('id');
  const hao='00000000-0000-4000-8000-000000000008';
  await go('c/?id='+hao);assert.equal(await page.locator('.score b').innerText(),'点评较少');
  await page.locator('.profile__cta .btn--solid').click();await page.waitForURL('**/login/**');await loaded();
  await page.locator('[name=phone]').fill('13800000000');await page.locator('#send-code').click();await page.locator('[name=code]').fill('000000');await page.locator('[type=submit]').click();await page.waitForURL('**/write/**');await loaded();
  await page.locator('[name=nickname]').fill('举铁小王');
  for(const group of await page.locator('[role=radiogroup]').all())await group.locator('button').nth(3).click();
  const body='线下上了十二节私教课，卧推握距和起桥调得很细。';
  await page.locator('textarea').fill(body+'微信 abc123');await page.locator('[type=submit]').click();await page.getByRole('status').filter({hasText:'微信号'}).waitFor();assert.match(await page.locator('textarea').inputValue(),/abc123/);
  await page.locator('textarea').fill(body);await page.locator('[type=submit]').click();await page.waitForURL('**/c/**');await loaded();
  assert.equal(await page.locator('.profile__cta .btn--solid').innerText(),'修改我的点评');
  await page.locator('.profile__cta .btn--solid').click();await loaded();await page.locator('textarea').fill(body+'反馈很及时。');await page.locator('[type=submit]').click();await page.waitForURL('**/c/**');await loaded();
  assert.ok(await page.locator('.review').filter({hasText:'举铁小王'}).locator('.review__edited').count());
  await page.locator('[data-report]').first().click();await page.locator('#report-dialog [type=submit]').click();await page.getByRole('status').filter({hasText:'照常显示，3 天内处理'}).waitFor();
  await page.locator('[data-delete]').click();await page.waitForFunction(()=>document.querySelector('.profile__cta .btn--solid')?.textContent==='写点评');assert.equal(await page.locator('.score b').innerText(),'点评较少');
  await go('submit/');
  const submission={name:'测试教练',nickname:'测试',douyin_handle:'newcoach',douyin_url:'https://www.douyin.com/',city:'深圳',gyms:'无'};
  async function fillSubmit(handle) {for(const [name,value] of Object.entries({...submission,douyin_handle:handle}))await page.locator(`[name=${name}]`).fill(value);await page.locator('[name=province]').selectOption('广东');}
  await fillSubmit('newcoach');await page.locator('[type=submit]').click();await page.getByRole('status').filter({hasText:'已提交'}).waitFor();
  await fillSubmit(' LAOWANG ');await page.locator('[type=submit]').click();await page.waitForURL('**/c/**');await loaded();assert.equal(new URL(page.url()).searchParams.get('id'),wang);
  for(const width of [390,1440]) {
    await page.setViewportSize({width,height:width===390?844:900});
    for(const [name,route] of [['home',''],['list','coaches/'],['coach','c/?id='+wang],['login','login/'],['write','write/?coach='+hao],['submit','submit/']]) {
      await go(route);await page.evaluate(()=>document.fonts.ready);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name} overflows at ${width}`);
      await page.screenshot({path:path.join(output,`${name}-${width}.png`),fullPage:true});
    }
    await go('c/?id='+wang);await page.locator('[data-report]').first().click();await page.screenshot({path:path.join(output,`report-${width}.png`)});
  }
  await page.goto(origin+'/reviews/c/'+hao+'?mock=1');await loaded();assert.equal(await page.locator('#coach-h').innerText(),'孙浩\n浩子卧推');
  assert.deepEqual(errors,[]);
  console.log('PASS: six pages + report, F1–F7/F9 mock walkthrough, 390/1440 overflow and screenshots, rewritten route, no console/module errors');
} finally {await context?.close();if(server.listening)await new Promise(resolve=>server.close(resolve));}
