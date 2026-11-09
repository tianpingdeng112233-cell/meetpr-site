import {coachId} from './lib.js';
import {href} from './api.js';
import {setupCommon,notice,$} from './ui.js';
import {home,list,coach} from './browse.js';
import {login,write,submitCoach} from './forms.js';
setupCommon();
const page=document.body.dataset.page;
const id=coachId(location.search,location.pathname);
// A generic write entry first asks the visitor to pick the coach they are reviewing.
if(page!=='coach') document.querySelectorAll('a').forEach(a=>{if(['写点评','写一条点评 →'].includes(a.textContent.trim()))a.href=href('write/');});
try {
  await ({home,list,coach:()=>coach(id),login,write:()=>write(id),submit:submitCoach}[page])();
  if(new URLSearchParams(location.search).get('duplicate')==='1') notice('这位教练已经在列表里',$('#coach-profile'));
} catch(error) {
  notice(error.message,$('form.form')||$('.roster .wrap')||$('.body .wrap')||document.body);
}
document.documentElement.dataset.ready='true';
