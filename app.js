// ARSENAL BUILDER
function buildArsenal(filter = 'all') {
  const grid = document.getElementById('arsenalGrid');
  grid.innerHTML = weapons
    .filter(w => filter === 'all' || w.cat === filter)
    .map(w => `
      <div class="arsenal-item">
        ${w.tag ? `<div class="arsenal-tag ${w.tag}">${w.tag === 'gold' ? 'RARE' : 'NEW'}</div>` : ''}
        <img src="data:image/png;base64,${w.img}" width="64" height="64" alt="${w.name}">
        <div class="arsenal-name">${w.name}</div>
      </div>`).join('');
}

function filterCat(cat, btn) {
  document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  buildArsenal(cat);
}

buildArsenal();

// COPY IP
function copyIP() {
  navigator.clipboard.writeText('play.underblockmc.com').then(() => {
    const el = document.getElementById('navip');
    const txt = document.getElementById('ipText');
    el.classList.add('copied');
    el.textContent = '✓ COPIED!';
    txt.textContent = '✓ Copied!';
    setTimeout(() => {
      el.classList.remove('copied');
      el.textContent = '▶ play.underblockmc.com';
      txt.textContent = 'play.underblockmc.com';
    }, 2000);
  });
}

// SCROLL REVEAL
const observer = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
}, { threshold: 0.1 });
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
