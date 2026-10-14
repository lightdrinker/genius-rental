const GAMES = window.FALLBACK_GAMES || [];
const KEY = "genius-rental:rentals:v1";
const state = { games: GAMES, rentals: [], selected: null, returnId: null, mode: "local" };

function cfg(){const c=window.GENIUS_CONFIG||{};return{url:String(c.supabaseUrl||"").replace(/\/$/,""),key:String(c.supabaseAnonKey||"")}}
function toast(msg){const el=document.querySelector("#toast");el.textContent=msg;el.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>{el.hidden=true},2600)}
function addDays(n){const d=new Date();d.setDate(d.getDate()+n);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
function fmt(v){if(!v)return"";const p=String(v).split("-");return p.length>=3?Number(p[1])+"월 "+Number(p[2])+"일":v}
function readLocal(){try{return JSON.parse(localStorage.getItem(KEY)||"[]")||[]}catch(e){return[]}}
function writeLocal(rows){localStorage.setItem(KEY,JSON.stringify(rows))}
function active(){return state.rentals.filter(r=>!r.returned_at)}
function gameOf(id){return state.games.find(g=>g.id===id)}

async function sb(path,options={}){const c=cfg();const res=await fetch(c.url+"/rest/v1"+path,{...options,headers:{apikey:c.key,Authorization:"Bearer "+c.key,"Content-Type":"application/json",...(options.headers||{})}});const text=await res.text();const body=text?JSON.parse(text):null;if(!res.ok)throw new Error(body&&(body.message||body.hint)||"요청 실패");return body}

async function load(){const c=cfg();const pill=document.querySelector("#pill");if(!c.url||!c.key){state.mode="local";state.rentals=readLocal();pill.textContent="이 기기 임시 저장";pill.classList.remove("ok");render();return}try{const [games,rentals]=await Promise.all([sb("/games?select=id,name,description,sort_order,is_active&is_active=eq.true&order=sort_order.asc"),sb("/rentals?select=id,borrower_name,game_id,borrowed_at,due_date,returned_at&order=borrowed_at.desc")]);const ids=new Set(games.map(g=>g.id));state.games=[...games,...GAMES.filter(g=>!ids.has(g.id))].sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));const remoteIds=new Set(rentals.map(r=>String(r.id)));state.rentals=[...rentals,...readLocal().filter(r=>!remoteIds.has(String(r.id)))];state.mode="supabase";pill.textContent="공동 대장 연결됨";pill.classList.add("ok")}catch(e){state.mode="local";state.games=GAMES;state.rentals=readLocal();pill.textContent="이 기기 임시 저장";pill.classList.remove("ok")}render()}

function show(view){document.querySelector("#viewBorrow").hidden=view!=="borrow";document.querySelector("#viewReturn").hidden=view!=="return";document.querySelector("#viewStatus").hidden=view!=="status";document.querySelectorAll(".nav-btn").forEach(btn=>btn.classList.remove("on"));if(view==="borrow")document.querySelector("#btnBorrow").classList.add("on");if(view==="return")document.querySelector("#btnReturn").classList.add("on");if(view==="status")document.querySelector("#btnStatus").classList.add("on")}

function render(){const rented=new Map(active().map(r=>[r.game_id,r]));const list=document.querySelector("#gameList");list.innerHTML="";if(!state.games.length){list.innerHTML='<div class="empty">등록된 게임이 없습니다.</div>';}else{for(const game of state.games){const busy=rented.get(game.id);const btn=document.createElement("button");btn.type="button";btn.className="card"+(state.selected===game.id?" on":"")+(busy?" busy":"");btn.disabled=Boolean(busy);btn.setAttribute("aria-pressed", state.selected===game.id);btn.style.setProperty("--accent", game.color||"#F7B91E");btn.innerHTML=`<strong>${game.name}<span class="status-label">${busy?"대여 중":"가능"}</span></strong><span>${busy?busy.borrower_name+"님 대여 중":game.description}</span>`;btn.onclick=()=>{if(!busy){state.selected=game.id;render()}};list.append(btn)}}}

const q=document.querySelector("#returnSearch").value.replace(/\s+/g,"").toLowerCase();const ret=document.querySelector("#returnList");ret.innerHTML="";const actives=active();if(!actives.length){ret.innerHTML='<div class="empty">반납할 대여 기록이 없습니다.</div>';}else{for(const rental of actives){const game=gameOf(rental.game_id);const hay=(rental.borrower_name+" "+(game&&game.name||"")).replace(/\s+/g,"").toLowerCase();if(q&&!hay.includes(q))continue;const btn=document.createElement("button");btn.type="button";btn.className="card"+(state.returnId===rental.id?" on":"");btn.setAttribute("aria-pressed", state.returnId===rental.id);btn.style.setProperty("--accent", (game&&game.color)||"#F7B91E");btn.innerHTML=`<strong>${game&&game.name||rental.game_id}</strong><span>${rental.borrower_name} · ${fmt(rental.due_date)}까지</span>`;btn.onclick=()=>{state.returnId=rental.id;render()};ret.append(btn)}if(!ret.children.length)ret.innerHTML='<div class="empty">검색 결과가 없습니다.</div>'}

const act=active();document.querySelector("#metrics").textContent=`가능 ${Math.max(state.games.length-act.length,0)} · 대여중 ${act.length}`;const board=document.querySelector("#boardList");board.innerHTML="";if(!state.rentals.length){board.innerHTML='<div class="empty">아직 대여 기록이 없습니다.</div>';}else{for(const rental of state.rentals){const game=gameOf(rental.game_id);const div=document.createElement("div");div.className="card";div.style.setProperty("--accent", (game&&game.color)||"#F7B91E");div.innerHTML=`<strong>${game&&game.name||rental.game_id}</strong><span>${rental.borrower_name} · ${rental.returned_at?"반납됨":fmt(rental.due_date)+"까지"}</span>`;board.append(div)}}}

async function borrow(){const name=document.querySelector("#borrowerName").value.trim();if(name.length<2)return toast("이름을 2글자 이상 입력해 주세요.");if(!state.selected)return toast("게임을 선택해 주세요.");try{if(state.mode==="supabase"){try{await sb("/rentals",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify([{borrower_name:name,game_id:state.selected}])})}catch(e){const rows=readLocal();rows.unshift({id:"local-"+Date.now(),borrower_name:name,game_id:state.selected,borrowed_at:new Date().toISOString(),due_date:addDays(7),returned_at:null});writeLocal(rows);toast("공동 대장에 없는 게임이라 이 기기에도 저장했어요.")}}else{const rows=readLocal();rows.unshift({id:"local-"+Date.now(),borrower_name:name,game_id:state.selected,borrowed_at:new Date().toISOString(),due_date:addDays(7),returned_at:null});writeLocal(rows)}state.selected=null;document.querySelector("#borrowerName").value="";await load();toast("대여가 완료되었습니다.")}catch(e){toast(e.message)}}

async function giveBack(){const name=document.querySelector("#returnerName").value.trim();const rental=state.rentals.find(r=>r.id===state.returnId);if(!rental)return toast("반납할 기록을 선택해 주세요.");if(name.length<2)return toast("빌릴 때 쓴 이름을 입력해 주세요.");try{if(state.mode==="supabase"&&!String(rental.id).startsWith("local-")){await sb("/rpc/mark_rental_returned",{method:"POST",body:JSON.stringify({p_rental_id:rental.id,p_borrower_name:name})})}else{if(rental.borrower_name.replace(/\s+/g,"").toLowerCase()!==name.replace(/\s+/g,"").toLowerCase())throw new Error("대여자 이름이 일치하지 않아요.");writeLocal(readLocal().map(r=>r.id===rental.id?{...r,returned_at:new Date().toISOString()}:r))}state.returnId=null;document.querySelector("#returnerName").value="";await load();toast("반납이 완료되었습니다.")}catch(e){toast(e.message)}}

document.querySelector("#btnBorrow").onclick=()=>show("borrow");
document.querySelector("#btnReturn").onclick=()=>show("return");
document.querySelector("#btnStatus").onclick=()=>show("status");
document.querySelector("#borrowSubmit").onclick=borrow;
document.querySelector("#returnSubmit").onclick=giveBack;
document.querySelector("#returnSearch").oninput=render;
load();
setInterval(load,30000);
show("borrow");
