// stats.js
(() => {
  const qs = (s, el=document) => el.querySelector(s);
  const bestsEl = qs('#bests');
  const recentEl = qs('#recent');

  const bests = JSON.parse(localStorage.getItem('cq-bests')||'{}');
  const scores = JSON.parse(localStorage.getItem('cq-scores')||'[]');

  function fmtTime(sec){
    const m = Math.floor(sec/60), s = sec%60;
    return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
  }
  function row(cols, header=false){
    const div = document.createElement('div');
    div.className = 'row'+(header?' header':'');
    cols.forEach(c=>{
      const span = document.createElement('div');
      span.textContent = c;
      div.appendChild(span);
    });
    return div;
  }

  // Bests
  bestsEl.appendChild(row(['Grid','Time','Moves','Errors','When'], true));
  Object.keys(bests).sort().forEach(g=>{
    const b = bests[g];
    bestsEl.appendChild(row([g, fmtTime(b.timeSec), b.moves, b.errors, new Date(b.date).toLocaleString()]));
  });

  // Recent
  recentEl.appendChild(row(['When','Grid','Time','Moves','Errors'], true));
  scores.slice(0,20).forEach(s=>{
    recentEl.appendChild(row([new Date(s.date).toLocaleString(), s.grid, fmtTime(s.timeSec), s.moves, s.errors]));
  });

  qs('#clearScores').addEventListener('click', () => {
    if(confirm('Clear all saved scores?')){
      localStorage.removeItem('cq-scores');
      localStorage.removeItem('cq-bests');
      location.reload();
    }
  });
})();