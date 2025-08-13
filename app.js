// app.js
(() => {
  const qs = (s, el=document) => el.querySelector(s);
  const qsa = (s, el=document) => [...el.querySelectorAll(s)];
  const pad = n => String(n).padStart(2,'0');

  const board = qs('#board');
  const cardTpl = qs('#cardTpl');
  const timeEl = qs('#time');
  const movesEl = qs('#moves');
  const errorsEl = qs('#errors');
  const matchesEl = qs('#matches');
  const startBtn = qs('#startBtn');
  const previewSel = qs('#previewTime');
  const imageFiles = qs('#imageFiles');
  const hintBtn = qs('#hintBtn');
  const pauseBtn = qs('#pauseBtn');
  const shuffleBtn = qs('#shuffleBtn');
  const restartBtn = qs('#restartBtn');
  const countdown = qs('#countdown');
  const winModal = qs('#winModal');
  const winStats = qs('#winStats');
  const playAgain = qs('#playAgain');
  const themeToggle = qs('#themeToggle');
  const rowsInput = qs('#rows');
  const colsInput = qs('#cols');
  const applyCustomBtn = qs('#applyCustom');
  const radioDefault = qs('input[value="default"]');
  const radioCustom = qs('input[value="custom"]');
  const uploader = qs('#uploader');

  // Default content if no images uploaded
  const EMOJIS = ['🍎','🍌','🍇','🍑','🍒','🍍','🥝','🍓','🥥','🍉','🍋','🫐','🥕','🌽','🍆','🥑','🍪','🍰','🍩','🍫'];

  let state = {
    rows: 2,
    cols: 4,
    preview: 3,
    first: null,
    lock: false,
    moves: 0,
    errors: 0,
    matches: 0,
    totalPairs: 0,
    timer: null,
    elapsed: 0,
    paused: false,
    hintLeft: 3,
    deck: [],
    useCustom: false
  };

  // Settings persistence
  const saveSettings = () => {
    localStorage.setItem('cq-settings', JSON.stringify({rows:state.rows, cols:state.cols, preview: state.preview, useCustom: state.useCustom}));
  };
  const loadSettings = () => {
    try{
      const s = JSON.parse(localStorage.getItem('cq-settings')||'{}');
      if(s.rows) { state.rows = s.rows; rowsInput.value = s.rows; }
      if(s.cols) { state.cols = s.cols; colsInput.value = s.cols; }
      if(s.preview){ state.preview = s.preview; previewSel.value = String(s.preview); }
      if(typeof s.useCustom === 'boolean'){ state.useCustom = s.useCustom; }
    }catch{}
  };
  loadSettings();
  (state.useCustom ? radioCustom : radioDefault).checked = true;
  uploader.hidden = !state.useCustom;

  // UI handlers
  qsa('[data-grid]').forEach(btn=>btn.addEventListener('click', () => {
    const [r,c] = btn.dataset.grid.split('x').map(n=>+n);
    state.rows=r; state.cols=c;
    rowsInput.value=r; colsInput.value=c;
    saveSettings();
  }));
  applyCustomBtn.addEventListener('click', ()=>{
    const r = +rowsInput.value, c = +colsInput.value;
    if(r*c % 2 !== 0){ alert('Grid must have an even number of cells.'); return; }
    state.rows=r; state.cols=c; saveSettings();
  });

  previewSel.addEventListener('change', e => { state.preview = +e.target.value; saveSettings(); });
  themeToggle.addEventListener('click', () => { document.body.classList.toggle('light'); });

  radioDefault.addEventListener('change', () => { state.useCustom = false; uploader.hidden = true; saveSettings(); });
  radioCustom.addEventListener('change', () => { state.useCustom = true; uploader.hidden = false; saveSettings(); });

  function resetHUD() {
    state.moves = 0; state.errors = 0; state.matches = 0; state.elapsed = 0;
    state.hintLeft = 3;
    movesEl.textContent = '0';
    errorsEl.textContent = '0';
    matchesEl.textContent = '0';
    timeEl.textContent = '00:00';
    hintBtn.textContent = `💡 Hint (${state.hintLeft})`;
  }

  function startTimer(){
    stopTimer();
    state.timer = setInterval(()=>{
      if(!state.paused){ state.elapsed++; renderTime(); }
    },1000);
  }
  function stopTimer(){ if(state.timer){ clearInterval(state.timer); state.timer=null; } }
  function renderTime(){
    const m = Math.floor(state.elapsed/60), s = state.elapsed%60;
    timeEl.textContent = `${pad(m)}:${pad(s)}`;
  }

  function fisherYates(arr){
    for(let i=arr.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [arr[i],arr[j]] = [arr[j],arr[i]];
    }
    return arr;
  }

  async function buildDeck(){
    // Build images from uploads or emojis
    let faces = [];
    if(state.useCustom){
      const files = [...imageFiles.files||[]].slice(0, 24);
      if(files.length < 2){
        alert('Upload at least 2 images or switch to default emojis.'); 
        throw new Error('Insufficient custom images');
      }
      faces = await Promise.all(files.map(file => new Promise(res=>{
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.readAsDataURL(file);
      })));
    } else {
      faces = EMOJIS.slice();
    }
    // duplicate and shuffle to fit pair count
    const pairCount = (state.rows*state.cols)/2;
    const deckFaces = [];
    for(let i=0;i<pairCount;i++){
      const face = faces[i % faces.length];
      deckFaces.push(face, face);
    }
    fisherYates(deckFaces);
    state.deck = deckFaces;
    state.totalPairs = pairCount;
  }

  function gridTemplate(){
    board.style.gridTemplateColumns = `repeat(${state.cols}, minmax(80px, 1fr))`;
  }

  function renderBoard(){
    board.innerHTML = '';
    gridTemplate();
    state.deck.forEach((face, idx) => {
      const node = cardTpl.content.firstElementChild.cloneNode(true);
      node.dataset.index = idx;
      const front = node.querySelector('.front');
      const back = node.querySelector('.back');
      // Front is the back of card (hidden), Back shows face after flip
      front.innerHTML = '🧩';
      if(typeof face === 'string' && face.startsWith('data:')){
        back.style.backgroundImage = `url(${face})`;
        back.textContent = '';
      } else {
        back.textContent = face;
      }
      node.addEventListener('click', ()=> onFlip(node));
      node.addEventListener('keydown', e=>{
        if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); onFlip(node); }
      });
      board.appendChild(node);
    });
  }

  function setControlsEnabled(enabled){
    [hintBtn, pauseBtn, shuffleBtn, restartBtn].forEach(b => b.disabled = !enabled);
  }

  async function startGame(){
    if(state.rows*state.cols % 2 !== 0){ alert('Choose an even grid.'); return; }
    resetHUD();
    try{
      await buildDeck();
    }catch{ return; }
    renderBoard();
    setControlsEnabled(false);
    // Reveal preview
    const previewMs = state.preview*1000;
    qsa('.card').forEach(c => c.classList.add('flipped'));
    countdown.classList.remove('hidden');
    let left = state.preview;
    countdown.textContent = left;
    const cd = setInterval(()=>{
      left--; countdown.textContent = left;
      if(left<=0){ clearInterval(cd); countdown.classList.add('hidden');
        qsa('.card').forEach(c => c.classList.remove('flipped'));
        setControlsEnabled(true);
        startTimer();
      }
    }, 1000);
  }

  function onFlip(card){
    if(state.lock || state.paused) return;
    if(card.classList.contains('matched') || card.classList.contains('flipped')) return;
    card.classList.add('flipped');
    const idx = +card.dataset.index;
    if(state.first === null){
      state.first = { idx, card };
      return;
    }
    state.moves++; movesEl.textContent = String(state.moves);
    const first = state.first;
    state.first = null;
    const match = state.deck[first.idx] === state.deck[idx];
    if(match){
      card.classList.add('matched');
      first.card.classList.add('matched');
      state.matches++; matchesEl.textContent = String(state.matches);
      if(state.matches === state.totalPairs){ onWin(); }
    } else {
      state.errors++; errorsEl.textContent = String(state.errors);
      state.lock = true;
      setTimeout(()=>{
        card.classList.remove('flipped');
        first.card.classList.remove('flipped');
        state.lock = false;
      }, 700);
    }
  }

  // Controls
  hintBtn.addEventListener('click', () => {
    if(state.hintLeft<=0) return;
    const candidates = qsa('.card').filter(c=>!c.classList.contains('matched') && !c.classList.contains('flipped'));
    if(candidates.length<2) return;
    state.hintLeft--;
    hintBtn.textContent = `💡 Hint (${state.hintLeft})`;
    const [a,b] = candidates.slice(0,2);
    a.classList.add('flipped'); b.classList.add('flipped');
    setTimeout(()=>{ a.classList.remove('flipped'); b.classList.remove('flipped'); }, 800);
  });

  pauseBtn.addEventListener('click', () => {
    state.paused = !state.paused;
    pauseBtn.textContent = state.paused ? '▶️ Resume' : '⏸ Pause';
    board.style.opacity = state.paused ? .6 : 1;
  });

  shuffleBtn.addEventListener('click', () => {
    state.first = null;
    const faces = [...state.deck];
    fisherYates(faces);
    state.deck = faces;
    const flipped = qsa('.card').map(c => c.classList.contains('flipped') || c.classList.contains('matched'));
    renderBoard();
    // maintain face-up cards if any were up
    qsa('.card').forEach((c,i)=>{ if(flipped[i]) c.classList.add('flipped'); });
  });

  restartBtn.addEventListener('click', () => {
    stopTimer();
    startGame();
  });

  startBtn.addEventListener('click', startGame);
  playAgain.addEventListener('click', () => { winModal.classList.add('hidden'); startGame(); });

  function onWin(){
    stopTimer();
    setControlsEnabled(false);
    confettiBurst();
    const grid = `${state.rows}x${state.cols}`;
    winStats.textContent = `Grid ${grid} • Time ${timeEl.textContent} • Moves ${state.moves} • Errors ${state.errors}`;
    saveScore({ grid, timeSec: state.elapsed, moves: state.moves, errors: state.errors, date: Date.now() });
    setTimeout(()=> winModal.classList.remove('hidden'), 600);
  }

  function saveScore(entry){
    // keep recent 50
    const arr = JSON.parse(localStorage.getItem('cq-scores')||'[]');
    arr.unshift(entry);
    localStorage.setItem('cq-scores', JSON.stringify(arr.slice(0,50)));
    // bests
    const bests = JSON.parse(localStorage.getItem('cq-bests')||'{}');
    const g = entry.grid;
    const current = bests[g];
    if(!current || entry.timeSec < current.timeSec || (entry.timeSec===current.timeSec && entry.moves < current.moves)){
      bests[g] = entry;
      localStorage.setItem('cq-bests', JSON.stringify(bests));
    }
  }

  // Simple confetti
  const canvas = qs('#confetti');
  const ctx = canvas.getContext('2d');
  function resize(){ canvas.width = board.clientWidth; canvas.height = board.clientHeight; }
  window.addEventListener('resize', resize); resize();

  function confettiBurst(){
    const pieces = Array.from({length: 120}, () => ({
      x: Math.random()*canvas.width,
      y: -10,
      r: Math.random()*4 + 2,
      vx: (Math.random()-.5)*2,
      vy: Math.random()*2 + 1,
      life: 120 + Math.random()*60
    }));
    let frame = 0;
    function tick(){
      ctx.clearRect(0,0,canvas.width,canvas.height);
      pieces.forEach(p=>{
        p.x += p.vx; p.y += p.vy; p.vy += 0.02; p.life--;
        ctx.globalAlpha = Math.max(p.life/180,0);
        ctx.beginPath();
        ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
        ctx.fill();
      });
      frame++;
      if(frame<200) requestAnimationFrame(tick);
    }
    tick();
  }
})();