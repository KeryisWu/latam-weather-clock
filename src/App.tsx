import {useEffect,useMemo,useRef,useState,type CSSProperties} from "react";
import brazilMap from "@svg-maps/brazil";
import mexicoMap from "@svg-maps/mexico";

type Country="BR"|"MX";
type City={name:string;lat:number;lon:number};
type State={id:string;code:string;name:string;cn:string;capital:string;timezone:string;lat:number;lon:number;cities:City[]};
type Forecast={current?:{temperature_2m:number;apparent_temperature:number;relative_humidity_2m:number;weather_code:number;is_day:number};daily:{time:string[];temperature_2m_max:number[];temperature_2m_min:number[];weather_code:number[]}};
interface InstallPrompt extends Event{prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>}

const BASE=import.meta.env.BASE_URL;
const CFG={
  BR:{name:"巴西",en:"BRAZIL",count:27,map:brazilMap,data:`${BASE}data/br-states.json`,flag:"flag-br"},
  MX:{name:"墨西哥",en:"MEXICO",count:32,map:mexicoMap,data:`${BASE}data/mx-states.json`,flag:"flag-mx"}
} as const;
const ZONES:Record<string,{label:string;color:string}>={
  br2:{label:"UTC−2 · 海岛时间",color:"#6f8fe8"},br3:{label:"UTC−3 · 巴西利亚时间",color:"#3bc08b"},br4:{label:"UTC−4 · 亚马孙时间",color:"#e4ad45"},br5:{label:"UTC−5 · 阿克里时间",color:"#e3795b"},
  mx8:{label:"UTC−8 · 西北区",color:"#6f86dc"},mx7:{label:"UTC−7 · 太平洋区",color:"#3ba9a8"},mx6:{label:"UTC−6 · 中部区",color:"#dfab45"},mx5:{label:"UTC−5 · 东南区",color:"#e47759"}
};
const PAGE_SIZE=5;

function zone(country:Country,id:string){
  if(country==="BR"){if(id==="ac")return"br5";if(["am","mt","ms","ro","rr"].includes(id))return"br4";return"br3"}
  if(id==="bcn")return"mx8";if(["bcs","nay","sin","son"].includes(id))return"mx7";if(id==="roo")return"mx5";return"mx6";
}
function weather(code=-1,day=1){
  if(code===0)return{icon:day?"☀️":"🌙",label:"晴朗"};if([1,2].includes(code))return{icon:"🌤️",label:"少云"};if(code===3)return{icon:"☁️",label:"阴天"};
  if([45,48].includes(code))return{icon:"🌫️",label:"雾"};if([51,53,55,56,57].includes(code))return{icon:"🌦️",label:"小雨"};
  if([61,63,65,66,67,80,81,82].includes(code))return{icon:"🌧️",label:"降雨"};if([95,96,99].includes(code))return{icon:"⛈️",label:"雷暴"};return{icon:"◌",label:"等待天气"};
}
function localTime(tz:string,seconds=false){try{return new Intl.DateTimeFormat("zh-CN",{timeZone:tz,hour:"2-digit",minute:"2-digit",...(seconds?{second:"2-digit"}:{}),hourCycle:"h23"}).format(new Date())}catch{return"--:--"}}
function localDate(tz:string){try{return new Intl.DateTimeFormat("zh-CN",{timeZone:tz,month:"long",day:"numeric",weekday:"long"}).format(new Date())}catch{return""}}
function opStatus(tz:string){let h=12;try{h=Number(new Intl.DateTimeFormat("en-US",{timeZone:tz,hour:"2-digit",hourCycle:"h23"}).format(new Date()))}catch{}if(h<6)return["深夜休息 · 不建议联系","#7f918c"];if(h<9)return["早间启动 · 内容预热时段","#e4ad45"];if(h<12)return["工作时段 · 适合联系达人","#47d59c"];if(h<14)return["午间时段 · 回复可能变慢","#e4ad45"];if(h<18)return["工作时段 · 适合沟通协作","#47d59c"];if(h<22)return["晚间活跃 · 适合发布内容","#53c8db"];return["夜间收尾 · 谨慎联系","#9a9db9"]}
function batches<T>(a:T[],n:number){const out:T[][]=[];for(let i=0;i<a.length;i+=n)out.push(a.slice(i,i+n));return out}
async function getForecast(points:{key:string;lat:number;lon:number}[],days:number){
  const p=new URLSearchParams({latitude:points.map(x=>x.lat).join(","),longitude:points.map(x=>x.lon).join(","),current:"temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day",daily:"temperature_2m_max,temperature_2m_min,weather_code",forecast_days:String(days),timezone:"auto"});
  const r=await fetch(`https://api.open-meteo.com/v1/forecast?${p}`,{cache:"no-store"});if(!r.ok)throw new Error("weather");const data=await r.json();const list:Forecast[]=Array.isArray(data)?data:[data];return new Map(points.map((x,i)=>[x.key,list[i]]));
}
function combine<K,V>(maps:Map<K,V>[]){const out=new Map<K,V>();maps.forEach(m=>m.forEach((v,k)=>out.set(k,v)));return out}

function Chart({forecast}:{forecast?:Forecast}){
  if(!forecast?.daily?.time?.length)return <div className="chart-empty">未来一周天气加载中</div>;
  const hi=forecast.daily.temperature_2m_max,lo=forecast.daily.temperature_2m_min,all=[...hi,...lo],min=Math.min(...all)-2,max=Math.max(...all)+2,w=620,h=150,l=28,r=18,t=20,b=31;
  const x=(i:number)=>l+i*(w-l-r)/Math.max(hi.length-1,1),y=(v:number)=>t+(max-v)*(h-t-b)/Math.max(max-min,1),points=(a:number[])=>a.map((v,i)=>`${x(i)},${y(v)}`).join(" ");
  return <svg className="trend-chart" viewBox={`0 0 ${w} ${h}`} aria-label="未来七天最高和最低温度变化">
    {[0,1,2].map(i=><line key={i} x1={l} x2={w-r} y1={t+i*(h-t-b)/2} y2={t+i*(h-t-b)/2} className="chart-grid"/>)}
    <polyline points={points(hi)} className="chart-line high-line"/><polyline points={points(lo)} className="chart-line low-line"/>
    {hi.map((v,i)=><g key={`h${i}`}><circle cx={x(i)} cy={y(v)} r="4" className="dot high-dot"/><text x={x(i)} y={y(v)-10} className="chart-value">{Math.round(v)}°</text></g>)}
    {lo.map((v,i)=><g key={`l${i}`}><circle cx={x(i)} cy={y(v)} r="3.5" className="dot low-dot"/><text x={x(i)} y={y(v)+16} className="chart-value low-value">{Math.round(v)}°</text></g>)}
    {forecast.daily.time.map((d,i)=><text key={d} x={x(i)} y={h-5} className="chart-day">{i===0?"今天":new Intl.DateTimeFormat("zh-CN",{weekday:"short"}).format(new Date(`${d}T12:00:00`))}</text>)}
  </svg>
}

function Sparkline({forecast}:{forecast:Forecast}){
  const hi=forecast.daily.temperature_2m_max,lo=forecast.daily.temperature_2m_min,values=hi.map((v,i)=>(v+lo[i])/2),min=Math.min(...values),max=Math.max(...values),w=92,h=25;
  const pts=values.map((v,i)=>`${i*w/Math.max(values.length-1,1)},${h-3-(v-min)*(h-6)/Math.max(max-min,1)}`).join(" ");
  return <svg className="sparkline" viewBox={`0 0 ${w} ${h}`} aria-label="未来七天平均温度变化曲线"><polyline points={pts}/></svg>
}

export default function Home(){
  const[country,setCountry]=useState<Country>("BR"),[states,setStates]=useState<State[]>([]),[selectedId,setSelectedId]=useState<string|null>(null),[capitalWx,setCapitalWx]=useState<Map<string,Forecast>>(new Map()),[cityWx,setCityWx]=useState<Map<string,Forecast>>(new Map()),[query,setQuery]=useState(""),[stateQuery,setStateQuery]=useState(""),[page,setPage]=useState(0),[tick,setTick]=useState(0),[sync,setSync]=useState<"loading"|"ready"|"error">("loading"),[updated,setUpdated]=useState<Date|null>(null),[tip,setTip]=useState<{x:number;y:number;s:State}|null>(null),[labelPos,setLabelPos]=useState<Record<string,{x:number;y:number}>>({}),[installer,setInstaller]=useState<InstallPrompt|null>(null),[toast,setToast]=useState("");
  const mapBox=useRef<HTMLDivElement>(null),mapSvg=useRef<SVGSVGElement>(null),config=CFG[country],stateMap=useMemo(()=>new Map(states.map(s=>[s.id,s])),[states]),selected=selectedId?stateMap.get(selectedId)||null:null;
  const movers=useMemo(()=>states.map(s=>{const f=capitalWx.get(s.id);if(!f)return null;const mid=f.daily.temperature_2m_max.map((v,i)=>(v+f.daily.temperature_2m_min[i])/2);const change=mid.slice(1).reduce((sum,v,i)=>sum+Math.abs(v-mid[i]),0);const amplitude=Math.max(...mid)-Math.min(...mid);return{s,f,change,amplitude}}).filter((x):x is NonNullable<typeof x>=>Boolean(x)).sort((a,b)=>b.change-a.change||b.amplitude-a.amplitude).slice(0,6),[states,capitalWx]);
  const stateMatches=useMemo(()=>{const q=stateQuery.trim().toLocaleLowerCase();if(!q)return[];return states.filter(s=>`${s.code} ${s.name} ${s.cn}`.toLocaleLowerCase().includes(q)).slice(0,8)},[states,stateQuery]);
  const focus=selected||movers[0]?.s||states[0],focusWx=focus?capitalWx.get(focus.id):undefined;
  const filtered=useMemo(()=>{if(!selected)return[];const q=query.trim().toLowerCase();return q?selected.cities.filter(c=>c.name.toLowerCase().includes(q)):selected.cities},[selected,query]);
  const pages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE)),visible=useMemo(()=>filtered.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE),[filtered,page]);
  void tick;

  useEffect(()=>{let off=false;fetch(config.data).then(r=>r.json()).then((d:State[])=>{if(!off)setStates(d)}).catch(()=>!off&&setSync("error"));return()=>{off=true}},[config.data]);
  useEffect(()=>{if(!states.length)return;let off=false;Promise.all(batches(states,12).map(g=>getForecast(g.map(s=>({key:s.id,lat:s.lat,lon:s.lon})),7))).then(m=>{if(!off){setCapitalWx(combine(m));setSync("ready");setUpdated(new Date())}}).catch(()=>!off&&setSync("error"));return()=>{off=true}},[states]);
  useEffect(()=>{if(!selected||!visible.length)return;let off=false,timer:ReturnType<typeof setTimeout>;const load=(retry=false)=>getForecast(visible.map(c=>({key:`${selected.code}:${c.name}`,lat:c.lat,lon:c.lon})),1).then(m=>{if(!off)setCityWx(old=>{const n=new Map(old);m.forEach((v,k)=>n.set(k,v));return n})}).catch(()=>{if(!off&&!retry)timer=setTimeout(()=>load(true),1400)});load();return()=>{off=true;clearTimeout(timer)}},[selected,visible]);
  useEffect(()=>{if(!states.length)return;const frame=requestAnimationFrame(()=>{const next:Record<string,{x:number;y:number}>={};states.forEach(s=>{const path=mapSvg.current?.querySelector<SVGGraphicsElement>(`[data-map-id="${s.id}"]`);if(path){const b=path.getBBox();next[s.id]={x:b.x+b.width/2,y:b.y+b.height/2}}});setLabelPos(next)});return()=>cancelAnimationFrame(frame)},[states,country]);
  useEffect(()=>{const timer=setInterval(()=>setTick(x=>x+1),1000);const install=(e:Event)=>{e.preventDefault();setInstaller(e as InstallPrompt)};window.addEventListener("beforeinstallprompt",install);if("serviceWorker"in navigator&&location.protocol==="https:")navigator.serviceWorker.register(`${BASE}sw.js`).catch(()=>{});return()=>{clearInterval(timer);window.removeEventListener("beforeinstallprompt",install)}},[]);

  function switchCountry(c:Country){if(c===country)return;setSync("loading");setStates([]);setCapitalWx(new Map());setCityWx(new Map());setSelectedId(null);setQuery("");setStateQuery("");setLabelPos({});setPage(0);setCountry(c)}
  function choose(id:string){setSelectedId(id);setQuery("");setStateQuery("");setPage(0)}
  function hover(e:React.MouseEvent,s:State){const r=mapBox.current?.getBoundingClientRect();if(r)setTip({x:e.clientX-r.left+12,y:e.clientY-r.top+12,s})}
  async function install(){if(installer){await installer.prompt();await installer.userChoice;setInstaller(null)}else{setToast("请在 Edge 右上角“…”中选择：应用 → 将此站点作为应用安装");setTimeout(()=>setToast(""),6000)}}

  const current=focusWx?.current,visual=weather(current?.weather_code,current?.is_day),[op,color]=focus?opStatus(focus.timezone):["正在同步","#47d59c"];
  return <main className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-mark">LA</span><div><p className="eyebrow">LATAM OPERATIONS DESK</p><h1>拉美运营时空台</h1></div></div><div className="top-actions"><div className={`sync ${sync}`}><i/><span>{sync==="loading"?"正在同步全部州天气":sync==="ready"?`已覆盖 ${config.count} 个州`:"天气连接异常，地图仍可使用"}</span></div><button className="install" onClick={install}>＋ 安装桌面图标</button></div></header>
    <nav className="country-tabs">{(["BR","MX"] as Country[]).map(c=><button key={c} className={country===c?"active":""} onClick={()=>switchCountry(c)}><i className={`flag ${CFG[c].flag}`}/><span><strong>{CFG[c].name}</strong><small>{CFG[c].count} 个州 · 全部覆盖</small></span></button>)}</nav>
    <section className="dashboard">
      <article className="map-card glass"><div className="section-head"><div><p className="eyebrow">{config.en} STATE TIME ZONES</p><h2>{config.name}州级时区地图</h2><small>州简称直接标注在地图上，也可通过列表或中英文搜索定位</small></div><div className="state-tools"><select aria-label="滚动选择州" value={selectedId||""} onChange={e=>e.target.value?choose(e.target.value):setSelectedId(null)}><option value="">选择州 / Estado</option>{states.map(s=><option key={s.id} value={s.id}>{s.code} · {s.name} / {s.cn}</option>)}</select><div className="state-search"><input aria-label="搜索州" value={stateQuery} onChange={e=>setStateQuery(e.target.value)} placeholder="搜索州名/中文/简称"/>{stateMatches.length>0&&<div className="state-results">{stateMatches.map(s=><button key={s.id} onClick={()=>choose(s.id)}><b>{s.code}</b><span>{s.name}<small>{s.cn}</small></span></button>)}</div>}</div>{selected&&<button className="back" onClick={()=>setSelectedId(null)}>返回变化榜</button>}</div></div>
        <div className="map-wrap" ref={mapBox}><svg ref={mapSvg} viewBox={config.map.viewBox} role="img" aria-label={`${config.name}全部州地图`}>{config.map.locations.map((loc:{id:string;name:string;path:string})=>{const s=stateMap.get(loc.id),z=zone(country,loc.id);return <path key={loc.id} data-map-id={loc.id} d={loc.path} fill={ZONES[z].color} className={`map-state ${selectedId===loc.id?"selected":""}`} tabIndex={0} aria-label={s?`${s.name}，${s.cn}`:loc.name} onMouseEnter={e=>s&&hover(e,s)} onMouseMove={e=>s&&hover(e,s)} onMouseLeave={()=>setTip(null)} onClick={()=>s&&choose(s.id)} onKeyDown={e=>s&&(e.key==="Enter"||e.key===" ")&&choose(s.id)}/>})}{states.map(s=>labelPos[s.id]&&<text key={`label-${s.id}`} x={labelPos[s.id].x} y={labelPos[s.id].y} className={`state-code ${s.code.length>2?"state-code-long":""}`}>{s.code}</text>)}</svg>{tip&&<div className="tooltip" style={{left:tip.x,top:tip.y}}><strong>{tip.s.cn}</strong><span>{tip.s.name}</span><small>{ZONES[zone(country,tip.s.id)].label}</small></div>}</div>
        <div className="legend">{Object.entries(ZONES).filter(([k])=>k.startsWith(country==="BR"?"br":"mx")).map(([k,z])=><span key={k}><i style={{background:z.color}}/>{z.label}</span>)}</div><div className="note"><b>i</b>所有州均可点击；天气默认以州府坐标计算，州内城市按需分页加载。</div>
      </article>
      <aside className="right-col">
        <article className="forecast glass"><div className="forecast-head"><div><p className="eyebrow">{selected?`${selected.cn} · ${selected.name}`:"近期温度变化较大城市"}</p><h2>{focus?.capital||"天气加载中"}</h2><small>{focus?.cn||config.name} · 州府天气 · {focus?localTime(focus.timezone,true):"--:--:--"}</small></div><div className="now"><span>{visual.icon}</span><strong>{current?`${Math.round(current.temperature_2m)}°`:"--°"}</strong><small>{visual.label}</small></div></div>
          <div className="chart-title"><strong>未来7天温度变化</strong><span><i/>最高温 <i/>最低温</span><small>{focus?localDate(focus.timezone):""}</small></div><Chart forecast={focusWx}/>
          <div className="metrics"><div><span>今日最高</span><strong>{focusWx?`${Math.round(focusWx.daily.temperature_2m_max[0])}°`:"--°"}</strong></div><div><span>今日最低</span><strong>{focusWx?`${Math.round(focusWx.daily.temperature_2m_min[0])}°`:"--°"}</strong></div><div><span>体感温度</span><strong>{current?`${Math.round(current.apparent_temperature)}°`:"--°"}</strong></div><div><span>湿度</span><strong>{current?`${Math.round(current.relative_humidity_2m)}%`:"--%"}</strong></div></div>
          <div className="op" style={{"--op":color} as CSSProperties}><i/><span><small>当前运营状态</small><strong>{op}</strong></span></div>
        </article>
        <article className={`list-card glass ${selected?"city-card":""}`}>{!selected?<><div className="list-head"><div><p className="eyebrow">RECENT TEMPERATURE MOVERS</p><h2>近期温度曲线变化较大城市</h2></div><small>{updated?`${updated.toLocaleTimeString("zh-CN",{hour:"2-digit",minute:"2-digit"})} 更新`:"正在计算"}</small></div><div className="vol-list mover-list">{movers.map((x,i)=>{const now=x.f.current?.temperature_2m,v=weather(x.f.current?.weather_code,x.f.current?.is_day);return <button key={x.s.id} onClick={()=>choose(x.s.id)}><b>{String(i+1).padStart(2,"0")}</b><span><strong>{x.s.capital}</strong><small>{x.s.name} / {x.s.cn}</small></span><Sparkline forecast={x.f}/><em>{v.icon} {Number.isFinite(now)?`${Math.round(now!)}°`:"--°"}</em><mark>7日变化 {x.change.toFixed(1)}°</mark></button>})}{!movers.length&&<div className="loading">正在比较全部州府未来七天温度曲线……</div>}</div></>:
          <><div className="list-head"><div><p className="eyebrow">{selected.name.toUpperCase()} CITIES</p><h2>{selected.cn}城市天气</h2></div><small>共 {selected.cities.length} 个城市 · 每页 5 个</small></div><div className="city-tools"><input value={query} onChange={e=>{setQuery(e.target.value);setPage(0)}} placeholder="搜索州内城市名称"/><span>{filtered.length} 个结果</span></div><div className="city-list">{visible.map((c,i)=>{const f=cityWx.get(`${selected.code}:${c.name}`),now=f?.current?.temperature_2m,hi=f?.daily.temperature_2m_max[0],lo=f?.daily.temperature_2m_min[0],v=weather(f?.current?.weather_code??f?.daily.weather_code[0],f?.current?.is_day);return <div className="city-row" key={`${c.name}${i}`}><b>{v.icon}</b><span><strong>{c.name}</strong><small>{i===0&&page===0&&!query?"州府 · ":""}{selected.cn}</small></span><div className="current-temp"><small>实时</small><strong>{Number.isFinite(now)?`${Math.round(now!)}°`:"--°"}</strong></div><div><small>最高</small><strong>{Number.isFinite(hi)?`${Math.round(hi!)}°`:"--°"}</strong></div><div><small>最低</small><strong>{Number.isFinite(lo)?`${Math.round(lo!)}°`:"--°"}</strong></div></div>})}</div><div className="pager"><button disabled={!page} onClick={()=>setPage(x=>Math.max(0,x-1))}>上一页</button><span>{page+1} / {pages}</span><button disabled={page>=pages-1} onClick={()=>setPage(x=>Math.min(pages-1,x+1))}>下一页</button></div></>}
        </article>
      </aside>
    </section>
    <footer><span>覆盖：巴西 27 州 · 墨西哥 32 州</span><span>城市数据按州分页加载</span><span>天气数据：Open-Meteo</span></footer>{toast&&<div className="toast">{toast}</div>}
  </main>
}
