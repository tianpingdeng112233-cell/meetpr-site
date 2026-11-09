import {href,mapConfig,loadAMap} from './api.js';
import {$,escape} from './ui.js';
// City centers in GCJ-02 for the cities used in the supplied directory/map mockups.
const cities={北京:[116.4074,39.9042],上海:[121.4737,31.2304],深圳:[114.0579,22.5431],广州:[113.2644,23.1291],杭州:[120.1551,30.2741],南京:[118.7969,32.0603],成都:[104.0665,30.5723],武汉:[114.3054,30.5931],济南:[117.1201,36.6512],西安:[108.9398,34.3416],沈阳:[123.4315,41.8057],重庆:[106.5516,29.563],佛山:[113.1214,23.0215],东莞:[113.7518,23.0207]};
export async function renderMap(stats) {
  const fallback=$('#city-fallback'),canvas=$('#map-canvas'),card=$('#region-card');
  function showRegion(province) {
    card.hidden=false;
    card.innerHTML=`<span class="tag">REGION</span><h4>${escape(province.province)} ${province.coach_count} 位教练</h4><p>${province.cities.map(c=>`${escape(c.city)} ${c.coach_count}`).join(' · ')}</p><a href="${escape(href('coaches/',{province:province.province}))}">看这里的教练 →</a>`;
  }
  const all=stats.provinces.flatMap(p=>p.cities.map(c=>({...c,province:p})));
  $('#city-count').textContent=`${all.length} 个城市`;
  fallback.innerHTML=all.length?all.map(c=>`<div class="city-entry"><button type="button" data-region="${escape(c.province.province)}">${escape(c.city)} <b>${c.coach_count}</b></button><a href="${escape(href('coaches/',{city:c.city,province:c.province.province}))}" aria-label="查看${escape(c.city)}的教练">看教练 →</a></div>`).join(''):'<p class="empty">暂无城市</p>';
  fallback.querySelectorAll('button').forEach(b=>b.onclick=()=>showRegion(stats.provinces.find(p=>p.province===b.dataset.region)));
  if(stats.provinces.length) showRegion(stats.provinces.find(p=>p.province==='广东')||stats.provinces[0]);
  const config=await mapConfig();
  if(!config.amapKey) return;
  let map;
  try {
    const AMap=await loadAMap(config.amapKey,config.amapSecurityCode);
    map=new AMap.Map(canvas,{zoom:4,center:[105,35],mapStyle:'amap://styles/dark',resizeEnable:true});
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('地图加载超时')),10000);
      map.on('complete',()=>{clearTimeout(timer);resolve();});
      map.on('error',()=>{clearTimeout(timer);reject(new Error('地图加载失败'));});
    });
    all.forEach(city=>{
      const position=cities[city.city.replace(/市$/,'')];if(!position)return;
      const marker=new AMap.CircleMarker({center:position,radius:Math.min(24,6+Math.sqrt(city.coach_count)*3),fillColor:'#e5251d',fillOpacity:.8,strokeColor:'#e5251d',strokeWeight:1,cursor:'pointer'});
      marker.on('click',()=>showRegion(city.province));map.add(marker);
    });
    fallback.hidden=true;
    const toggle=document.createElement('button');toggle.className='map-toggle';toggle.textContent='城市列表';toggle.onclick=()=>{fallback.hidden=!fallback.hidden;toggle.textContent=fallback.hidden?'城市列表':'返回地图';};$('.map__bar').append(toggle);
    // Keep AMap's copyright and map approval number unobscured at the bottom.
    $('.map').classList.add('map--live');
  } catch {map?.destroy();canvas.replaceChildren();fallback.hidden=false;}
}
