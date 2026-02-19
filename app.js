function prettifyText(s){
  if(!s) return '';
  s = String(s).replace(/\r/g,'');
  // 다중 공백만 정리(줄바꿈은 questions.json에 반영된 형태 유지)
  s = s.replace(/[ \t]{2,}/g,' ').trim();
  return s;
}



async function loadQuestions(){
  const res = await fetch('questions.json', {cache:'no-store'});
  if(!res.ok) throw new Error('questions.json 로드 실패');
  return await res.json();
}
function shuffle(arr){
  for(let i=arr.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
  return arr;
}
const LS_KEY='ox_wrong_hyeongsa_policy_chaptered_fixed_v1';
function loadWrong(){ try{ return JSON.parse(localStorage.getItem(LS_KEY)||'[]'); }catch(e){ return []; } }
function saveWrong(list){ localStorage.setItem(LS_KEY, JSON.stringify(list)); }
function addWrong(q, userAnswer){
  const list=loadWrong();
  const key=String(q.id)+'|'+q.statement;
  if(!list.some(x=>x.key===key)){
    list.unshift({key,id:q.id,chapter:q.chapter,no:q.no,statement:q.statement,correct:q.answer,picked:userAnswer,explanation:q.explanation||''});
    saveWrong(list);
  }
}

const BM_KEY='ox_bookmark_v1';
function loadBookmarks(){ try{ return JSON.parse(localStorage.getItem(BM_KEY)||'[]'); }catch(e){ return []; } }
function saveBookmarks(list){ localStorage.setItem(BM_KEY, JSON.stringify(list)); }
function isBookmarked(id){ return loadBookmarks().includes(Number(id)); }
function toggleBookmark(id){
  id=Number(id);
  const list=loadBookmarks();
  const i=list.indexOf(id);
  if(i>=0) list.splice(i,1); else list.push(id);
  list.sort((a,b)=>a-b);
  saveBookmarks(list);
}
function removeWrongByKey(key){
  const list=loadWrong();
  const next=list.filter(x=>x.key!==key);
  if(next.length!==list.length) saveWrong(next);
}

let ALL=[], QUIZ=[], idx=0, score=0, locked=false;
let MODE='random20'; // 'random20' | 'sequential'

const elQ=document.getElementById('question');
const elProg=document.getElementById('progress');
const elScore=document.getElementById('score');
const elMeta=document.getElementById('meta');

const btnO=document.getElementById('btnO');
const btnX=document.getElementById('btnX');
const btnNext=document.getElementById('btnNext');
const btnNextTop=document.getElementById('btnNextTop');
const btnRestart=document.getElementById('btnRestart');
const btnSequential=document.getElementById('btnSequential');
const btnRetryWrong=document.getElementById('btnRetryWrong');
const btnBookmarks=document.getElementById('btnBookmarks');
const btnBookmark=document.getElementById('btnBookmark');

const box=document.getElementById('resultBox');
const title=document.getElementById('resultTitle');
const explain=document.getElementById('explain');

const quizView=document.getElementById('quizView');

function setBtnsEnabled(on){
  [btnO,btnX].forEach(b=>{ b.classList.toggle('disabled', !on); b.disabled=!on; });
}
function sample20(){
  const copy=ALL.slice();
  shuffle(copy);
  return copy.slice(0,20);
}

function buildSequential(){
  // CH1-1부터 쭉 (chapter, no) 기준 정렬
  return ALL.slice().sort((a,b)=>{
    const ac=Number(a.chapter), bc=Number(b.chapter);
    const an=Number(a.no), bn=Number(b.no);
    if(Number.isFinite(ac) && Number.isFinite(bc) && ac!==bc) return ac-bc;
    if(Number.isFinite(an) && Number.isFinite(bn) && an!==bn) return an-bn;
    // fallback
    const ai=Number(a.id), bi=Number(b.id);
    if(Number.isFinite(ai) && Number.isFinite(bi) && ai!==bi) return ai-bi;
    return String(a.id).localeCompare(String(b.id));
  });
}


function buildWrongOnly(){
  const wrong = loadWrong(); // [{key,...}]
  if(!wrong.length) return [];
  // key => entry for stable ordering
  const keySet = new Set(wrong.map(x=>x.key));
  const byKey = new Map();
  for(const q of ALL){
    const key = String(q.id)+'|'+q.statement;
    if(keySet.has(key)) byKey.set(key, q);
  }
  const out=[];
  for(const w of wrong){
    const q = byKey.get(w.key);
    if(q) out.push(q);
  }
  return out;
}
function buildBookmarksOnly(){
  const ids = loadBookmarks();
  if(!ids.length) return [];
  const set = new Set(ids.map(Number));
  const out = ALL.filter(q=>set.has(Number(q.id)));
  out.sort((a,b)=>Number(a.id)-Number(b.id));
  return out;
}
function setQuizMode(){
  // 버튼 활성/비활성(데이터 없으면 비활성)
  const w = loadWrong().length;
  const b = loadBookmarks().length;
  btnRetryWrong.disabled = (w===0);
  btnRetryWrong.classList.toggle('disabled', w===0);
  btnBookmarks.disabled = (b===0);
  btnBookmarks.classList.toggle('disabled', b===0);

  // 진행 표시 초기화
  elProg.textContent = `0 / ${totalCount() || (MODE==='sequential' ? ALL.length : 20)}`;
  updateMeta(null);
}

function totalCount(){
  return QUIZ.length || 0;
}
function modeLabel(){
  if(MODE==='sequential') return '순서대로';
  if(MODE==='wrongOnly') return '틀린문제';
  if(MODE==='bookmarks') return '북마크';
  return '랜덤20제';
}
function updateMeta(q){
  const w=loadWrong().length;
  const b=loadBookmarks().length;
  const idPart = q ? ` · 문항번호: ${q.id}` : '';
  elMeta.textContent=`모드: ${modeLabel()}${idPart} · 틀린문제: ${w}개 · 북마크: ${b}개`;
}
function render(){
  const q=QUIZ[idx];
  elQ.textContent=prettifyText(q.statement);
  elProg.textContent=`${idx+1} / ${totalCount()}`;
  elScore.textContent=`점수: ${score}`;
  updateMeta(q);
  const marked=isBookmarked(q.id);
  btnBookmark.textContent = marked ? '★ 북마크됨' : '☆ 북마크';
  box.classList.add('hidden'); box.classList.remove('good','bad');
  title.textContent=''; explain.textContent='';
  locked=false; setBtnsEnabled(true);
}
function finish(){
  const t=totalCount();
  elQ.textContent=`끝. 점수 ${score}/${t}`;
  elProg.textContent=`${t} / ${t}`;
  updateMeta(null);
  setBtnsEnabled(false); box.classList.add('hidden'); locked=true;
}

function showResult(picked){
  const q=QUIZ[idx];
  const correct=String(q.answer||'').trim().toUpperCase();
  const p=String(picked||'').trim().toUpperCase();
  const ok = (p===correct);
  if(ok) score+=1;

  // 오답 목록 관리
  const key=String(q.id)+'|'+q.statement;
  if(MODE==='wrongOnly'){
    if(ok) removeWrongByKey(key);
    else addWrong(q, p);
  }else{
    if(!ok) addWrong(q, p);
  }

  box.classList.remove('hidden');
  box.classList.toggle('good', ok);
  box.classList.toggle('bad', !ok);
  title.textContent= ok ? `정답 (정답: ${correct})` : `오답 (정답: ${correct})`;
  explain.textContent= (q.explanation && q.explanation.trim()) ? q.explanation : '(해설 추출 누락)';
  locked=true; setBtnsEnabled(false);
  updateMeta(q);
}

function onNextClick(){
  if(!locked) return;
  if(idx<QUIZ.length-1){ idx+=1; render(); } else { finish(); }
}
btnNext.addEventListener('click', onNextClick);
btnNextTop.addEventListener('click', onNextClick);

btnRestart.addEventListener('click', ()=>{ restart('random20'); });
btnSequential.addEventListener('click', ()=>{ restart('sequential'); });
btnRetryWrong.addEventListener('click', ()=>{ restart('wrongOnly'); });
btnBookmarks.addEventListener('click', ()=>{ restart('bookmarks'); });
btnBookmark.addEventListener('click', ()=>{
  const q=QUIZ[idx];
  toggleBookmark(q.id);
  render();
});

function restart(mode){
  MODE = mode || MODE || 'random20';

  if(MODE==='sequential'){
    QUIZ = buildSequential();
  }else if(MODE==='wrongOnly'){
    QUIZ = buildWrongOnly();
  }else if(MODE==='bookmarks'){
    QUIZ = buildBookmarksOnly();
  }else{
    QUIZ = sample20();
    MODE = 'random20';
  }

  idx=0; score=0; locked=false;

  // 데이터가 없으면 안내 후 종료상태로
  if(!QUIZ || QUIZ.length===0){
    const msg = (MODE==='wrongOnly') ? '틀린문제가 없습니다.' :
                (MODE==='bookmarks') ? '북마크한 문제가 없습니다.' :
                '문제가 없습니다.';
    elQ.textContent = msg;
    elProg.textContent = `0 / 0`;
    elScore.textContent = `점수: 0`;
    updateMeta(null);
    setBtnsEnabled(false);
    locked=true;
    return;
  }

  setQuizMode();
  render();
}
btnO.addEventListener('click', ()=>{ if(locked) return; showResult('O'); });
btnX.addEventListener('click', ()=>{ if(locked) return; showResult('X'); });

(async ()=>{
  ALL=await loadQuestions();
  restart('random20');
})().catch(e=>{
  elQ.textContent='불러오기 실패: '+e.message;
});
