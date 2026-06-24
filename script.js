(function(){
'use strict';

/* ===== MUSIC PLAYER (persistent across SPA nav) ===== */
var audio = new Audio('/Sundown.WAV');
audio.loop = true;
audio.preload = 'auto';

var savedTime = sessionStorage.getItem('te_audio_time');
var savedVol = sessionStorage.getItem('te_audio_vol');
var wasPlaying = sessionStorage.getItem('te_audio_playing');
audio.volume = savedVol ? parseFloat(savedVol) : 0.5;
if (savedTime) audio.currentTime = parseFloat(savedTime);

function saveState(){
  try {
    sessionStorage.setItem('te_audio_time', audio.currentTime);
    sessionStorage.setItem('te_audio_vol', audio.volume);
    sessionStorage.setItem('te_audio_playing', audio.paused ? '0' : '1');
  } catch(e){}
}

window.addEventListener('beforeunload', saveState);

var wrap = document.createElement('div');
wrap.id = 'te-player';
wrap.innerHTML =
  '<div class="te-row">' +
    '<span class="te-label">Sundown</span>' +
    '<div class="te-ctrls">' +
      '<button class="te-restart" title="Restart">&#9198;</button>' +
      '<button class="te-play" title="Play / Pause">&#9654;</button>' +
      '<button class="te-forward" title="Skip +10s">&#9197;</button>' +
    '</div>' +
    '<span class="te-time">0:00 / 0:00</span>' +
    '<input type="range" class="te-vol" min="0" max="1" step="0.05" value="' + audio.volume + '">' +
  '</div>' +
  '<input type="range" class="te-seek" min="0" max="100" step="0.1" value="0">';
document.body.appendChild(wrap);

var playBtn = wrap.querySelector('.te-play');
var restartBtn = wrap.querySelector('.te-restart');
var forwardBtn = wrap.querySelector('.te-forward');
var volSlider = wrap.querySelector('.te-vol');
var seekBar = wrap.querySelector('.te-seek');
var timeDisplay = wrap.querySelector('.te-time');
var seeking = false;

function fmt(t){ var m = Math.floor(t/60), s = Math.floor(t%60); return m + ':' + (s<10?'0':'') + s; }

function updateTime(){
  if (!seeking && audio.duration) seekBar.value = (audio.currentTime / audio.duration) * 100;
  timeDisplay.textContent = fmt(audio.currentTime) + ' / ' + (audio.duration ? fmt(audio.duration) : '0:00');
}

function updateBtn(){ playBtn.textContent = audio.paused ? '\u25B6' : '\u23F8'; }

audio.addEventListener('pause', updateBtn);
audio.addEventListener('play', updateBtn);
audio.addEventListener('timeupdate', updateTime);
audio.addEventListener('loadedmetadata', updateTime);

playBtn.addEventListener('click', function(){
  if (audio.paused) { audio.play().catch(function(){}); }
  else { audio.pause(); }
  saveState();
});

restartBtn.addEventListener('click', function(){
  audio.currentTime = 0;
  if (audio.paused) audio.play().catch(function(){});
});

forwardBtn.addEventListener('click', function(){
  audio.currentTime = Math.min(audio.currentTime + 10, audio.duration || 0);
});

volSlider.addEventListener('input', function(){
  audio.volume = parseFloat(this.value);
  saveState();
});

seekBar.addEventListener('input', function(){
  seeking = true;
  if (audio.duration) {
    audio.currentTime = (parseFloat(this.value) / 100) * audio.duration;
    timeDisplay.textContent = fmt(audio.currentTime) + ' / ' + fmt(audio.duration);
  }
});

seekBar.addEventListener('change', function(){ seeking = false; });

if (wasPlaying === '1') {
  var resume = function(){
    audio.play().catch(function(){});
    document.removeEventListener('click', resume);
    document.removeEventListener('scroll', resume);
    document.removeEventListener('keydown', resume);
    document.removeEventListener('touchstart', resume);
  };
  document.addEventListener('click', resume);
  document.addEventListener('scroll', resume);
  document.addEventListener('keydown', resume);
  document.addEventListener('touchstart', resume);
  audio.play().catch(function(){});
}
updateBtn();
updateTime();


/* ===== SPA NAVIGATION (gapless audio across pages) ===== */

var contentEl = document.getElementById('app-content');
if (!contentEl) contentEl = document.body;

function findAppContent(html){
  try {
    var d = new DOMParser().parseFromString(html, 'text/html');
    var el = d.getElementById('app-content');
    return el ? el.innerHTML : '';
  } catch(e) { return ''; }
}

function findNav(html){
  try {
    var d = new DOMParser().parseFromString(html, 'text/html');
    var el = d.querySelector('nav');
    return el ? el.outerHTML : '';
  } catch(e) { return ''; }
}

function extractTitle(html){
  try {
    var d = new DOMParser().parseFromString(html, 'text/html');
    return d.title;
  } catch(e) { return ''; }
}

function execScripts(container){
  container.querySelectorAll('script:not([src])').forEach(function(s){
    try { (0, eval)(s.textContent); } catch(e){}
  });
}

function loadPage(url, push){
  // Handle hash-only navigation
  if (url.startsWith('#')) {
    if (url === '#games') { switchTab('games'); return; }
    if (url === '#developers') { switchTab('developers'); return; }
    if (url === '#social') { switchTab('social'); return; }
    return;
  }

  // Strip hash from URL for fetch, keep it for pushState
  var hashIdx = url.indexOf('#');
  var fetchUrl = hashIdx > -1 ? url.slice(0, hashIdx) : url;
  var hash = hashIdx > -1 ? url.slice(hashIdx) : '';
  // Normalize: if fetchUrl is empty or /, fetch /
  if (!fetchUrl || fetchUrl === '/') fetchUrl = '/';

  fetch(fetchUrl).then(function(r){
    if (!r.ok) { window.location.href = url; return; }
    return r.text();
  }).then(function(html){
    if (!html) return;
    var newContent = findAppContent(html);
    if (!newContent) { window.location.href = url; return; }

    // Swap nav before content (nav is outside #app-content)
    var newNav = findNav(html);
    var currentNav = document.querySelector('nav');
    if (newNav && currentNav) {
      currentNav.outerHTML = newNav;
    }

    contentEl.innerHTML = newContent;
    document.title = extractTitle(html) || document.title;

    if (push !== false) {
      history.pushState({ url: url }, '', url);
    }

    execScripts(contentEl);
    if (typeof rebindTabs === 'function') rebindTabs();

    // Handle hash after content load
    if (hash) {
      if (hash === '#games') { switchTab('games'); }
      else if (hash === '#developers') { switchTab('developers'); }
      else if (hash === '#social') { switchTab('social'); }
      else {
        setTimeout(function(){
          var el = document.getElementById(hash.slice(1));
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    }
  }).catch(function(){
    window.location.href = url;
  });
}

function switchTab(name){
  var tabs = document.querySelectorAll('[data-tab]');
  var contents = {
    home: document.getElementById('tab-home'),
    games: document.getElementById('tab-games'),
    developers: document.getElementById('tab-developers'),
    social: document.getElementById('tab-social')
  };
  if (!tabs.length || !contents[name]) return;
  tabs.forEach(function(b){ b.classList.remove('active'); });
  var btn = document.querySelector('[data-tab="' + name + '"]');
  if (btn) btn.classList.add('active');
  Object.values(contents).forEach(function(c){ if (c) c.classList.remove('active'); });
  if (contents[name]) contents[name].classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Intercept internal link clicks
document.addEventListener('click', function(e){
  var link = e.target.closest('a');
  if (!link) return;
  var href = link.getAttribute('href');
  if (!href) return;
  // Skip external, mailto, target=_blank, or download links
  if (link.hasAttribute('target') || href.startsWith('http') || href.startsWith('//') || href.startsWith('mailto:')) return;
  // Skip if ctrl/meta held (open in new tab)
  if (e.ctrlKey || e.metaKey) return;

  // Handle hash-only links
  if (href.startsWith('#')) {
    e.preventDefault();
    loadPage(href);
    return;
  }

  // Internal navigation
  e.preventDefault();
  loadPage(href);
});

// Handle browser back/forward
window.addEventListener('popstate', function(e){
  if (e.state && e.state.url) {
    loadPage(e.state.url, false);
  } else {
    // Initial state — reload
    window.location.reload();
  }
});

// Re-bind tab buttons after SPA nav (runs on initial page too)
function rebindTabs(){
  var initialHash = window.location.hash;
  if (initialHash === '#games') { setTimeout(function(){ switchTab('games'); }, 50); }
  if (initialHash === '#developers') { setTimeout(function(){ switchTab('developers'); }, 50); }

  document.querySelectorAll('[data-tab]').forEach(function(btn){
    btn.removeEventListener('click', tabClickHandler);
    btn.addEventListener('click', tabClickHandler);
  });
}

function tabClickHandler(e){
  if (typeof switchTab === 'function') switchTab(this.dataset.tab);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

rebindTabs();

})();
