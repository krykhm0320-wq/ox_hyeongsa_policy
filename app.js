function prettifyText(s){
  // PDF 텍스트 추출 특유의 어색한 줄바꿈 정리:
  // - 문단 구분(빈 줄)은 유지
  // - 문단 내부의 단일 줄바꿈은 공백으로 치환
  if(!s) return '';
  s = String(s).replace(/\r/g,'');
  // normalize multiple spaces
  const paras = s.split(/\n{2,}/).map(p=>{
    // keep bullet/numbered lines as-is if they look like list
    // but still remove mid-line breaks
    const lines = p.split(/\n/).map(x=>x.trim()).filter(x=>x.length>0);
    // If it looks like a multi-line list (many lines starting with bullet/number), keep newlines
    const listLike = lines.length>=2 && lines.every(x=>/^([0-9]+[.)]|[-*•]|①|②|③|④|⑤|⑥|⑦|⑧|⑨|⑩)/.test(x));
    if(listLike) return lines.join('\n');
    return lines.join(' ').replace(/\s{2,}/g,' ').trim();
  });
  return paras.join('\n\n').trim();
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

let ALL=[], QUIZ=[], idx=0, score=0, locked=false;

const elQ=document.getElementById('question');
const elProg=document.getElementById('progress');
const elScore=document.getElementById('score');
const elMeta=document.getElementById('meta');

const btnO=document.getElementById('btnO');
const btnX=document.getElementById('btnX');
const btnNext=document.getElementById('btnNext');
const btnNextTop=document.getElementById('btnNextTop');
const btnRestart=document.getElementById('btnRestart');
const btnWrong=document.getElementById('btnWrong');
const btnBack=document.getElementById('btnBack');
const btnClearWrong=document.getElementById('btnClearWrong');

const box=document.getElementById('resultBox');
const title=document.getElementById('resultTitle');
const explain=document.getElementById('explain');

const quizView=document.getElementById('quizView');
const wrongView=document.getElementById('wrongView');
const wrongList=document.getElementById('wrongList');

function setBtnsEnabled(on){
  [btnO,btnX].forEach(b=>{ b.classList.toggle('disabled', !on); b.disabled=!on; });
}
function sample20(){
  const copy=ALL.slice();
  shuffle(copy);
  return copy.slice(0,20);
}
function render(){
  const q=QUIZ[idx];
  elQ.textContent=prettifyText(q.statement);
  elProg.textContent=`${idx+1} / 20`;
  elScore.textContent=`점수: ${score}`;
  elMeta.textContent=`문항번호: CH${q.chapter}-${q.no} / 전체문항: ${ALL.length}`;
  box.classList.add('hidden'); box.classList.remove('good','bad');
  title.textContent=''; explain.textContent='';
  locked=false; setBtnsEnabled(true);
}
function finish(){
  elQ.textContent=`끝. 점수 ${score}/20`;
  elProg.textContent='20 / 20';
  elMeta.textContent=`오답노트: ${loadWrong().length}개`;
  setBtnsEnabled(false); box.classList.add('hidden'); locked=true;
}
function showResult(user){
  const q=QUIZ[idx];
  const correct=q.answer;
  const ok=(user===correct);
  if(ok) score+=1; else addWrong(q,user);
  elScore.textContent=`점수: ${score}`;
  box.classList.remove('hidden');
  box.classList.toggle('good', ok);
  box.classList.toggle('bad', !ok);
  title.textContent= ok ? `정답 (정답: ${correct})` : `오답 (정답: ${correct})`;
  explain.textContent= (q.explanation && q.explanation.trim()) ? q.explanation : '(해설 추출 누락)';
  locked=true; setBtnsEnabled(false);
}
function onNextClick(){
  if(!locked) return;
  if(idx<QUIZ.length-1){ idx+=1; render(); } else { finish(); }
}
btnNext.addEventListener('click', onNextClick);
btnNextTop.addEventListener('click', onNextClick);

function setQuizMode(){
  quizView.classList.remove('hidden');
  wrongView.classList.add('hidden');
  btnBack.classList.add('hidden');
  btnClearWrong.classList.add('hidden');
  btnWrong.classList.remove('hidden');
}
function setWrongMode(){
  quizView.classList.add('hidden');
  wrongView.classList.remove('hidden');
  btnBack.classList.remove('hidden');
  btnClearWrong.classList.remove('hidden');
  btnWrong.classList.add('hidden');
  renderWrong();
}
function renderWrong(){
  const list=loadWrong();
  if(list.length===0){ wrongList.innerHTML='<div class="item">오답이 없음.</div>'; return; }
  wrongList.innerHTML=list.map((x,i)=>{
    const safeStmt=prettifyText(x.statement).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const safeExp=(x.explanation||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    return `
      <div class="item">
        <div class="title">#${i+1} 문항번호: CH${x.chapter}-${x.no}
          <span class="pill">내답: ${x.picked}</span>
          <span class="pill">정답: ${x.correct}</span>
        </div>
        <div style="white-space:pre-wrap; line-height:1.6;">${safeStmt}</div>
        <div style="margin-top:8px; white-space:pre-wrap; line-height:1.6; font-size:14px; color:#111;">${safeExp || '(해설 없음)'}</div>
      </div>
    `;
  }).join('');
}
btnRestart.addEventListener('click', ()=>{ restart(); });
btnWrong.addEventListener('click', ()=>{ setWrongMode(); });
btnBack.addEventListener('click', ()=>{ setQuizMode(); });
btnClearWrong.addEventListener('click', ()=>{ saveWrong([]); renderWrong(); });

function restart(){
  QUIZ=sample20(); idx=0; score=0; locked=false;
  setQuizMode(); render();
}
btnO.addEventListener('click', ()=>{ if(locked) return; showResult('O'); });
btnX.addEventListener('click', ()=>{ if(locked) return; showResult('X'); });

(async ()=>{
  ALL=await loadQuestions();
  restart();
})().catch(e=>{
  elQ.textContent='불러오기 실패: '+e.message;
});
