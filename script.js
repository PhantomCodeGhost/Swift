/* ═══════════════════════════════════════════════════════════════
   SWIFT MUSIC PLAYER — script.js
   Premium Redesign · High Performance · Logic Restored
═══════════════════════════════════════════════════════════════ */

/* ─── Supabase Setup ──────────────────────────────────────────── */
const SUPABASE_URL = "https://vhmwiarbobluutiumakr.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZobXdpYXJib2JsdXV0aXVtYWtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4NTAxNDUsImV4cCI6MjA4ODQyNjE0NX0.EeL1zlH0aWziPi3O4tDQ-SCPwzUToGVkp8MommHn-0I";

let db = null;
try { db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY); }
catch(e) { console.error("Supabase init failed:", e); }

/* ─── Gradient Palette ─────────────────────────────────────────── */
const GRADIENTS = [
  ['#27272a', '#3f3f46'], ['#18181b', '#3f3f46'], ['#3f3f46', '#52525b'],
  ['#000000', '#18181b'], ['#52525b', '#71717a'], ['#1e1e1e', '#333333'],
  ['#4a4a4a', '#27272a'], ['#2c2c2e', '#1c1c1e'], ['#1c1c1e', '#000000'],
  ['#333333', '#1e1e1e'], ['#555555', '#3f3f46'], ['#222222', '#121215'],
];

const getGradient = (id) => {
  const [a, b] = GRADIENTS[(typeof id === 'number' ? id : strHash(String(id))) % GRADIENTS.length];
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
};

function strHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

/* ─── App State ───────────────────────────────────────────────── */
let currentUser     = null;
let isRegisterMode  = false;
let allSongs        = [];
let filteredSongs   = [];
let currentIndex    = -1;
let isPlaying       = false;
let currentMood     = 'all';
let currentView     = 'home';
let searchQuery     = '';
let isShuffle       = false;
let repeatMode      = 'none';
let shuffleHistory  = [];
let queue           = [];
let recentlyPlayed  = JSON.parse(localStorage.getItem('swift_recent') || '[]');
let favorites       = new Set(JSON.parse(localStorage.getItem('swift_favs') || '[]'));
let sidebarOpen     = true;
let panelOpen       = true;
let currentLyrics   = [];
let activeLyricIndex = -1;
let isSeekDragging  = false;
let contextTargetId = null;

const audio = document.getElementById('audio-player');
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

/* ─── Global UI Handlers ───────────────────────────────────────── */
window.openModal = (id) => { const el = document.getElementById(id); if (el) el.classList.add("active"); };
window.closeModal = (id) => { const el = document.getElementById(id); if (el) { el.classList.remove("active"); clearErrors(); } };

document.querySelectorAll(".modal-overlay").forEach(overlay => {
  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.classList.remove("active"); });
});

function showToast(msg, dur = 2200) {
  const t = $('#toast');
  if (t) { t.textContent = msg; t.classList.add('show'); clearTimeout(window._toastTimer); window._toastTimer = setTimeout(() => t.classList.remove('show'), dur); }
}

function clearErrors() { $$('.error-msg, .success-msg').forEach(el => { el.classList.remove('show'); el.textContent = ''; }); }
function showError(id, msg) { const el = document.getElementById(id); if (el) { el.textContent = msg; el.classList.add('show'); } }
function showSuccess(id, msg) { const el = document.getElementById(id); if (el) { el.textContent = msg; el.classList.add('show'); } }

/* ─── Auth ────────────────────────────────────────────────────── */
window.adminLogin = async function () {
  clearErrors();
  const email = $('#admin-email').value.trim(), password = $('#admin-password').value;
  if (!email || !password) return showError('admin-error', 'Fill all fields');
  try {
    const { data, error } = await db.from('users').select('*').eq('email', email).eq('password', password).eq('role', 'admin').single();
    if (error || !data) return showError('admin-error', 'Invalid credentials');
    sessionStorage.setItem('emotune_user', JSON.stringify(data));
    window.location.href = 'admin.html';
  } catch (e) { showError('admin-error', 'Database error'); }
};

window.toggleAuthMode = () => {
  isRegisterMode = !isRegisterMode;
  clearErrors();
  $('#user-modal-title').textContent = isRegisterMode ? 'Create Account' : 'Welcome Back';
  $('#user-submit-btn').textContent  = isRegisterMode ? 'Register' : 'Continue';
  $('#form-toggle-link').textContent = isRegisterMode ? 'Login here' : 'Register here';
  $('#user-name-group').classList.toggle('hidden', !isRegisterMode);
};

window.userAuth = async function () {
  clearErrors();
  const email = $('#user-email').value.trim(), password = $('#user-password').value;
  if (!email || !password) return showError('user-error', 'Fill all fields');
  try {
    if (isRegisterMode) {
      const name = $('#user-name').value.trim();
      if (!name) return showError('user-error', 'Name is required');
      const { data: exists } = await db.from('users').select('id').eq('email', email).single();
      if (exists) return showError('user-error', 'Email registered. Login instead.');
      const { data, error } = await db.from('users').insert([{ name, email, password, role: 'user' }]).select().single();
      if (error) throw error;
      showSuccess('user-success', 'Account created!');
      setTimeout(() => startApp(data), 1000);
    } else {
      const { data, error } = await db.from('users').select('*').eq('email', email).eq('password', password).single();
      if (error || !data) return showError('user-error', 'Invalid credentials');
      if (data.role === 'admin') {
        sessionStorage.setItem('emotune_user', JSON.stringify(data));
        window.location.href = 'admin.html';
        return;
      }
      startApp(data);
    }
  } catch (e) { showError('user-error', 'Auth error'); }
};

async function startApp(user) {
  currentUser = user;
  localStorage.setItem('swift_user', JSON.stringify(user));
  closeModal('user-modal');
  $('#landing').classList.add('hidden');
  $('#app').classList.remove('hidden');
  $('#bottomPlayer').classList.remove('hidden');
  $('#topbarEmail').textContent = user.name || user.email;
  $('#userAvatarSmall').textContent = (user.name || user.email).charAt(0).toUpperCase();
  updateFavBadge();
  await loadAllSongs();
  bindPlayerControls();
  bindSidebarNav();
  bindSearchInput();
  bindPanelTabs();
  bindContextMenu();
  bindKeyboard();
  bindPanelToggle();
  renderView('home');
}

window.logout = () => {
  localStorage.removeItem('swift_user');
  location.reload();
};

/* ─── Data ────────────────────────────────────────────────────── */
async function loadAllSongs() {
  const container = $('#viewContainer');
  container.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';
  try {
    const { data, error } = await db.from('songs').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    allSongs = (data || []).map((s, i) => ({ ...s, _gradIdx: i }));
    filteredSongs = [...allSongs];
  } catch (e) { showToast('⚠️ Connection error'); }
}

function applyFilters() {
  filteredSongs = allSongs.filter(s => {
    const moodOk = currentMood === 'all' || (s.mood || '').toLowerCase() === currentMood.toLowerCase();
    const q = searchQuery.toLowerCase();
    const searchOk = !q || (s.title||'').toLowerCase().includes(q) || (s.artist||'').toLowerCase().includes(q);
    return moodOk && searchOk;
  });
}

/* ─── Views ───────────────────────────────────────────────────── */
function renderView(view) {
  currentView = view;
  $$('.nav-item').forEach(n => n.classList.remove('active'));
  $(`.nav-item[data-view="${view}"]`)?.classList.add('active');
  const container = $('#viewContainer');
  container.innerHTML = '';
  let content;
  switch (view) {
    case 'home':      content = renderHome();      break;
    case 'library':   content = renderLibrary();   break;
    case 'search':    content = renderSearch();    break;
    case 'playlists': content = renderPlaylists(); break;
    case 'favorites': content = renderFavorites(); break;
    case 'recent':    content = renderRecent();    break;
    case 'settings':  content = renderSettings();  break;
    default:          content = renderHome();
  }
  container.appendChild(content);
  if (window.refreshIcons) window.refreshIcons();
  bindSongCards();
  updateMoodPills();
  highlightCurrentCard();
}

function renderHome() {
  applyFilters();
  const div = document.createElement('div');
  const userName = currentUser?.name || (currentUser?.email || '').split('@')[0];
  div.innerHTML = `<div class="greeting-section"><h1 class="greeting-text">${getGreeting()}, ${escHtml(userName)}</h1><p class="greeting-sub">Your curated soundscape.</p></div>`;
  
  const stats = `<div class="stats-bar">
    <div class="stat-card stat-clickable" onclick="renderView('library')"><div class="stat-value">${allSongs.length}</div><div class="stat-label">Songs</div></div>
    <div class="stat-card stat-clickable" onclick="renderView('favorites')"><div class="stat-value">${favorites.size}</div><div class="stat-label">Favs</div></div>
    <div class="stat-card stat-clickable" onclick="renderView('recent')"><div class="stat-value">${recentlyPlayed.length}</div><div class="stat-label">Recent</div></div>
  </div>`;
  div.innerHTML += stats;

  const recentSongs = getRecentSongs();
  if (recentSongs.length > 0) {
    div.innerHTML += `<div class="section-header"><h2 class="section-title">Recently Played</h2></div>
      <div class="recent-strip">${recentSongs.slice(0, 8).map(s => `
        <div class="recent-chip" onclick="playRecent('${s.id}')">
          <div class="recent-chip-art" style="background:${getGradient(s._gradIdx)}">
            ${s.cover_url ? `<img src="${escHtml(s.cover_url)}">` : `<span>${(s.title||'?')[0]}</span>`}
          </div>
          <span class="recent-chip-name">${escHtml(s.title)}</span>
        </div>`).join('')}</div>`;
  }

  div.innerHTML += `<div class="section-header"><h2 class="section-title">${currentMood === 'all' ? 'All Tracks' : capitalize(currentMood)}</h2></div>`;
  const grid = document.createElement('div');
  grid.className = 'songs-grid';
  filteredSongs.forEach((s, i) => grid.appendChild(createSongCard(s, i)));
  div.appendChild(grid);
  return div;
}

window.playRecent = (id) => {
  const idx = filteredSongs.findIndex(s => String(s.id) === String(id));
  if (idx !== -1) playSong(idx);
  else { currentMood = 'all'; applyFilters(); playRecent(id); }
};

function renderLibrary() {
  applyFilters();
  const div = document.createElement('div');
  const moods = ['all', 'happy', 'sad', 'chill', 'energetic', 'romantic', 'focus'];
  div.innerHTML = `<div class="section-header"><h2 class="section-title">Library</h2></div>
    <div class="mood-filters">${moods.map(m => `<button class="mood-pill ${currentMood === m ? 'active' : ''}" onclick="setMood('${m}')">${capitalize(m)}</button>`).join('')}</div>`;
  const list = document.createElement('div');
  list.className = 'song-list';
  filteredSongs.forEach((s, i) => list.appendChild(createSongListItem(s, i)));
  div.appendChild(list);
  return div;
}

window.setMood = (m) => { currentMood = m; renderView('library'); };

function renderSearch() {
  applyFilters();
  const div = document.createElement('div');
  if (!searchQuery) { div.innerHTML = `<div class="empty-state"><i data-lucide="search"></i><div class="empty-state-title">Search music</div></div>`; return div; }
  div.innerHTML = `<div class="section-header"><h2 class="section-title">Results for "${escHtml(searchQuery)}"</h2></div>`;
  const list = document.createElement('div');
  list.className = 'song-list';
  filteredSongs.forEach((s, i) => list.appendChild(createSongListItem(s, i, searchQuery)));
  div.appendChild(list);
  return div;
}

function renderPlaylists() {
  const div = document.createElement('div');
  div.innerHTML = `<div class="section-header"><h2 class="section-title">Moods</h2></div>`;
  const grid = document.createElement('div');
  grid.className = 'playlist-grid';
  ['happy', 'sad', 'chill', 'energetic', 'romantic', 'focus'].forEach(m => {
    const card = document.createElement('div');
    card.className = 'playlist-card';
    card.innerHTML = `<div class="playlist-art" style="background:${getGradient(m)}"></div><div class="playlist-info"><div class="playlist-name">${capitalize(m)}</div></div>`;
    card.onclick = () => { currentMood = m; renderView('home'); };
    grid.appendChild(card);
  });
  div.appendChild(grid);
  return div;
}

function renderFavorites() {
  const favs = allSongs.filter(s => favorites.has(String(s.id)));
  const div = document.createElement('div');
  div.innerHTML = `<div class="section-header"><h2 class="section-title">Favorites</h2></div>`;
  if (!favs.length) { div.innerHTML += `<div class="empty-state">No favorites</div>`; }
  else {
    const list = document.createElement('div');
    list.className = 'song-list';
    favs.forEach((s, i) => {
      const item = createSongListItem(s, i);
      item.onclick = (e) => { if (!e.target.closest('.list-fav-btn')) { filteredSongs = favs; playSong(i); } };
      list.appendChild(item);
    });
    div.appendChild(list);
  }
  return div;
}

function renderRecent() {
  const recent = getRecentSongs();
  const div = document.createElement('div');
  div.innerHTML = `<div class="section-header"><h2 class="section-title">Recently Played</h2></div>`;
  if (!recent.length) { div.innerHTML += `<div class="empty-state">No history</div>`; }
  else {
    const list = document.createElement('div');
    list.className = 'song-list';
    recent.forEach((s, i) => {
      const item = createSongListItem(s, i);
      item.onclick = (e) => { if (!e.target.closest('.list-fav-btn')) { filteredSongs = recent; playSong(i); } };
      list.appendChild(item);
    });
    div.appendChild(list);
  }
  return div;
}

function renderSettings() {
  const div = document.createElement('div');
  div.innerHTML = `<div class="section-header"><h2 class="section-title">Settings</h2></div>
    <div class="settings-grid">
      <div class="stat-card"><strong>Account</strong><p>${escHtml(currentUser?.name || 'User')}</p><p style="font-size:0.8rem;opacity:0.6">${escHtml(currentUser?.email)}</p><button class="btn-ghost-sm" onclick="logout()">Logout</button></div>
      <div class="stat-card"><strong>Data</strong><p>${favorites.size} favs</p><button class="btn-ghost-sm" onclick="localStorage.clear(); location.reload();">Clear cache</button></div>
      <div class="stat-card" style="grid-column: 1 / -1; text-align: left; align-items: stretch;">
        <strong>Keyboard Shortcuts</strong>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-top: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px;">
            <span style="color: var(--text-secondary); font-size: 0.9rem;">Play / Pause</span>
            <kbd style="background: rgba(255,255,255,0.1); padding: 4px 8px; border-radius: 6px; font-family: monospace; font-size: 0.75rem; color: #fff; border: 1px solid rgba(255,255,255,0.15);">Space</kbd>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px;">
            <span style="color: var(--text-secondary); font-size: 0.9rem;">Next Track</span>
            <kbd style="background: rgba(255,255,255,0.1); padding: 4px 8px; border-radius: 6px; font-family: monospace; font-size: 0.75rem; color: #fff; border: 1px solid rgba(255,255,255,0.15);">N / &rarr;</kbd>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px;">
            <span style="color: var(--text-secondary); font-size: 0.9rem;">Previous Track</span>
            <kbd style="background: rgba(255,255,255,0.1); padding: 4px 8px; border-radius: 6px; font-family: monospace; font-size: 0.75rem; color: #fff; border: 1px solid rgba(255,255,255,0.15);">P / &larr;</kbd>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px;">
            <span style="color: var(--text-secondary); font-size: 0.9rem;">Volume Up / Down</span>
            <kbd style="background: rgba(255,255,255,0.1); padding: 4px 8px; border-radius: 6px; font-family: monospace; font-size: 0.75rem; color: #fff; border: 1px solid rgba(255,255,255,0.15);">&uarr; / &darr;</kbd>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px;">
            <span style="color: var(--text-secondary); font-size: 0.9rem;">Mute / Unmute</span>
            <kbd style="background: rgba(255,255,255,0.1); padding: 4px 8px; border-radius: 6px; font-family: monospace; font-size: 0.75rem; color: #fff; border: 1px solid rgba(255,255,255,0.15);">M</kbd>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px;">
            <span style="color: var(--text-secondary); font-size: 0.9rem;">Toggle Player Panel</span>
            <kbd style="background: rgba(255,255,255,0.1); padding: 4px 8px; border-radius: 6px; font-family: monospace; font-size: 0.75rem; color: #fff; border: 1px solid rgba(255,255,255,0.15);">L</kbd>
          </div>
        </div>
      </div>
    </div>`;
  return div;
}

/* ─── UI Components ───────────────────────────────────────────── */
function createSongCard(song, idx) {
  const card = document.createElement('div');
  const isFav = favorites.has(String(song.id)), isPlayingThis = currentIndex === idx && filteredSongs[idx]?.id === song.id;
  card.className = `song-card ${isPlayingThis ? 'playing' : ''}`;
  card.innerHTML = `
    <div class="song-card-cover">
      ${song.cover_url ? `<img src="${escHtml(song.cover_url)}">` : `<div class="song-card-cover-gradient" style="background:${getGradient(song._gradIdx)}"><span>${(song.title||'?')[0]}</span></div>`}
      <div class="play-overlay"><div class="play-circle">${isPlayingThis && isPlaying ? '<div class="eq-bars"><div class="eq-bar"></div><div class="eq-bar"></div><div class="eq-bar"></div></div>' : '<i data-lucide="play" fill="currentColor"></i>'}</div></div>
    </div>
    <div class="song-card-info">
      <div class="song-card-title">${escHtml(song.title)}</div>
      <div class="song-card-artist">${escHtml(song.artist)}</div>
      <div class="song-card-footer"><span class="song-mood-chip">${escHtml(song.mood)}</span>
        <button class="card-fav-btn ${isFav?'active':''}" data-fav-id="${song.id}" onclick="event.stopPropagation(); toggleFavorite('${song.id}')"><i data-lucide="heart" ${isFav?'fill="currentColor"':''}></i></button>
      </div>
    </div>`;
  card.onclick = () => playSong(idx);
  card.oncontextmenu = (e) => { e.preventDefault(); contextTargetId = song.id; showContextMenu(e); };
  return card;
}

function createSongListItem(song, idx, q='') {
  const item = document.createElement('div');
  const isFav = favorites.has(String(song.id)), isPlayingThis = filteredSongs[currentIndex]?.id === song.id;
  item.className = `song-list-item ${isPlayingThis ? 'playing' : ''}`;
  item.innerHTML = `
    <span class="list-num">${isPlayingThis && isPlaying ? '<div class="eq-bars"><div class="eq-bar"></div></div>' : idx+1}</span>
    <div class="list-art-wrap" style="background:${getGradient(song._gradIdx)}">
      ${song.cover_url ? `<img src="${escHtml(song.cover_url)}">` : `<span>${(song.title||'?')[0]}</span>`}
    </div>
    <span class="list-title">${hilite(escHtml(song.title), q)}</span>
    <span class="list-artist">${hilite(escHtml(song.artist), q)}</span>
    <button class="list-fav-btn ${isFav?'active':''}" data-fav-id="${song.id}" onclick="event.stopPropagation(); toggleFavorite('${song.id}')"><i data-lucide="heart" ${isFav?'fill="currentColor"':''}></i></button>`;
  item.onclick = () => playSong(idx);
  item.oncontextmenu = (e) => { e.preventDefault(); contextTargetId = song.id; showContextMenu(e); };
  return item;
}

/* ─── Lyrics ─── */
function parseLyrics(lrc) {
  if (!lrc) return [];
  return lrc.split('\n').map(line => {
    const match = line.match(/\[(\d+):(\d+(?:\.\d+)?)\](.*)/);
    if (!match) return null;
    return { time: parseInt(match[1]) * 60 + parseFloat(match[2]), text: match[3].trim() };
  }).filter(Boolean);
}

function renderLyricsPanel(lyrics) {
  const container = $('#lyricsContainer');
  if (!container) return;
  if (!lyrics.length) { container.innerHTML = '<p style="opacity:0.5;text-align:center;margin-top:40px">No lyrics available</p>'; return; }
  container.innerHTML = '';
  lyrics.forEach((line, i) => {
    const el = document.createElement('div');
    el.className = 'lyric-line';
    el.textContent = line.text;
    el.onclick = () => { audio.currentTime = line.time; };
    container.appendChild(el);
  });
}

function syncLyrics(time) {
  if (!currentLyrics.length) return;
  for (let i = 0; i < currentLyrics.length; i++) {
    const curr = currentLyrics[i], next = currentLyrics[i + 1];
    if (time >= curr.time && (!next || time < next.time)) {
      if (i === activeLyricIndex) return;
      activeLyricIndex = i;
      const lines = $$('.lyric-line');
      lines.forEach(l => l.classList.remove('active'));
      if (lines[i]) { 
        lines[i].classList.add('active'); 
        lines[i].scrollIntoView({ block: 'center', behavior: 'smooth' }); 
      }
      break;
    }
  }
}

/* ─── Player Logic ────────────────────────────────────────────── */
function playSong(idx) {
  if (idx < 0 || idx >= filteredSongs.length) return;
  currentIndex = idx;
  const s = filteredSongs[idx];
  audio.src = s.file_url;
  audio.play().catch(e => console.error(e));
  isPlaying = true;

  // Lyrics Init
  activeLyricIndex = -1;
  currentLyrics = parseLyrics(s.lyrics);
  renderLyricsPanel(currentLyrics);

  addToRecent(s);
  updatePlayerUI(s);
  updateNowPlaying(s);
  highlightCurrentCard();
}

function updatePlayerUI(s) {
  $('#playerTitle').textContent = s.title;
  $('#playerArtist').textContent = s.artist;
  const cover = $('#playerCover');
  cover.innerHTML = s.cover_url ? `<img src="${s.cover_url}">` : `<i data-lucide="music"></i>`;
  const isFav = favorites.has(String(s.id));
  const pfBtn = $('#playerFavBtn');
  pfBtn.classList.toggle('active', isFav);
  pfBtn.setAttribute('data-fav-id', s.id);
  pfBtn.innerHTML = `<i data-lucide="heart" ${isFav?'fill="currentColor"':''}></i>`;
  if (window.refreshIcons) window.refreshIcons();
}

function updateNowPlaying(s) {
  $('#npTitle').textContent = s.title;
  $('#npArtist').textContent = s.artist;
  if($('#npMood')) $('#npMood').textContent = s.mood;
  const art = $('#npArtwork');
  art.innerHTML = s.cover_url ? `<img src="${s.cover_url}">` : `<i data-lucide="disc"></i>`;
  if($('#npArtworkBlur')) $('#npArtworkBlur').style.background = getGradient(s._gradIdx);
  const isFav = favorites.has(String(s.id));
  const npBtn = $('#npFavBtn');
  npBtn.classList.toggle('active', isFav);
  npBtn.setAttribute('data-fav-id', s.id);
  npBtn.innerHTML = `<i data-lucide="heart" ${isFav?'fill="currentColor"':''}></i>`;
  if (window.refreshIcons) window.refreshIcons();
}

function updatePlayBtn() {
  const playing = !audio.paused;
  isPlaying = playing;
  $('.play-icon').style.display = playing ? 'none' : 'block';
  $('.pause-icon').style.display = playing ? 'block' : 'none';
  if ($('#npArtwork')) $('#npArtwork').classList.toggle('playing', playing);
}

function togglePlay() { if (audio.paused) audio.play().catch(()=>{}); else audio.pause(); }
function nextSong() { let n = isShuffle ? Math.floor(Math.random()*filteredSongs.length) : (currentIndex+1)%filteredSongs.length; playSong(n); }
function prevSong() { if(audio.currentTime > 3) { audio.currentTime=0; return; } let p = (currentIndex-1+filteredSongs.length)%filteredSongs.length; playSong(p); }

function setVolume(v) {
  audio.volume = v;
  const pct = (v*100) + '%';
  if($('#volumeFill')) $('#volumeFill').style.width = pct;
  if($('#volumeThumb')) $('#volumeThumb').style.left = pct;
  if($('#volumeInput')) $('#volumeInput').value = Math.round(v * 100);
  updateMuteBtn();
}
function toggleMute() { audio.volume = audio.volume === 0 ? 0.8 : 0; updateMuteBtn(); }
function updateMuteBtn() {
  const m = audio.volume === 0;
  $('.vol-icon').style.display = m ? 'none' : 'block';
  $('.mute-icon').style.display = m ? 'block' : 'none';
}

function toggleShuffle() { isShuffle = !isShuffle; $('#shuffleBtn').classList.toggle('active', isShuffle); }
function cycleRepeat() { 
  const modes = ['none','all','one']; repeatMode = modes[(modes.indexOf(repeatMode)+1)%3];
  $('#repeatBtn').classList.toggle('active', repeatMode !== 'none');
  showToast('Repeat: ' + repeatMode);
}

/* ─── Favorites ─── */
function toggleFavorite(id) {
  id = String(id);
  if(favorites.has(id)) favorites.delete(id); else favorites.add(id);
  localStorage.setItem('swift_favs', JSON.stringify([...favorites]));
  updateFavBadge();
  updateFavButtons(id);
}
function updateFavBadge() { if($('#favBadge')) $('#favBadge').textContent = favorites.size; }
function updateFavButtons(id) {
  $$(`[data-fav-id="${id}"]`).forEach(b => {
    const isFav = favorites.has(id);
    b.classList.toggle('active', isFav);
    b.innerHTML = `<i data-lucide="heart" ${isFav?'fill="currentColor"':''}></i>`;
  });
  if (window.refreshIcons) window.refreshIcons();
}

/* ─── Helpers ─────────────────────────────────────────────────── */
function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
function hilite(s, q) { if(!q) return s; return s.replace(new RegExp(`(${q})`,'gi'), '<span class="highlight">$1</span>'); }
function addToRecent(s) { recentlyPlayed = [String(s.id), ...recentlyPlayed.filter(x=>x!==String(s.id))].slice(0,20); localStorage.setItem('swift_recent', JSON.stringify(recentlyPlayed)); }
function getRecentSongs() { return recentlyPlayed.map(id => allSongs.find(s=>String(s.id)===id)).filter(Boolean); }
function highlightCurrentCard() { $$('.song-card, .song-list-item').forEach(c => c.classList.remove('playing')); const s = filteredSongs[currentIndex]; if(s) $$(`[data-song-id="${s.id}"]`).forEach(c => c.classList.add('playing')); }

/* ─── Bindings ────────────────────────────────────────────────── */
function bindPlayerControls() {
  $('#playBtn')?.addEventListener('click', togglePlay);
  $('#nextBtn')?.addEventListener('click', nextSong);
  $('#prevBtn')?.addEventListener('click', prevSong);
  $('#shuffleBtn')?.addEventListener('click', toggleShuffle);
  $('#repeatBtn')?.addEventListener('click', cycleRepeat);
  $('#muteBtn')?.addEventListener('click', toggleMute);
  $('#volumeInput')?.addEventListener('input', e => setVolume(e.target.value/100));
  $('#seekBarWrap')?.addEventListener('click', e => {
    const rect = e.currentTarget.getBoundingClientRect();
    audio.currentTime = ((e.clientX - rect.left) / rect.width) * audio.duration;
  });
  $('#playerFavBtn')?.addEventListener('click', () => {
    const s = filteredSongs[currentIndex];
    if (s) toggleFavorite(s.id);
  });
  $('#npFavBtn')?.addEventListener('click', () => {
    const s = filteredSongs[currentIndex];
    if (s) toggleFavorite(s.id);
  });
}

function bindSidebarNav() {
  $$('.nav-item[data-view]').forEach(l => l.onclick = () => renderView(l.dataset.view));
  $('#sidebarToggle')?.addEventListener('click', () => $('#sidebar').classList.toggle('collapsed'));
}

function bindSearchInput() {
  $('#searchInput')?.addEventListener('input', e => {
    searchQuery = e.target.value.trim();
    if(searchQuery) renderView('search'); else if(currentView==='search') renderView('home');
  });
}

function bindKeyboard() {
  document.onkeydown = (e) => {
    if(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    switch(e.code) {
      case 'Space':
        e.preventDefault();
        togglePlay();
        break;
      case 'ArrowRight':
      case 'KeyN':
        e.preventDefault();
        nextSong();
        break;
      case 'ArrowLeft':
      case 'KeyP':
        e.preventDefault();
        prevSong();
        break;
      case 'ArrowUp':
        e.preventDefault();
        setVolume(Math.min(1, audio.volume + 0.1));
        break;
      case 'ArrowDown':
        e.preventDefault();
        setVolume(Math.max(0, audio.volume - 0.1));
        break;
      case 'KeyM':
        e.preventDefault();
        toggleMute();
        break;
      case 'KeyL':
        e.preventDefault();
        $('#nowPlayingPanel')?.classList.toggle('collapsed');
        break;
    }
  };
}

function bindPanelTabs() {
  $$('.panel-tab').forEach(t => t.onclick = () => {
    $$('.panel-tab, .panel-tab-content').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    $(`#tab${capitalize(t.dataset.tab)}`)?.classList.add('active');
  });
}

function bindPanelToggle() {
  $('#queueToggle')?.addEventListener('click', () => $('#nowPlayingPanel').classList.toggle('collapsed'));
  $('#panelClose')?.addEventListener('click', () => $('#nowPlayingPanel').classList.add('collapsed'));
}

function bindContextMenu() {
  document.onclick = () => $('#contextMenu').classList.remove('show');
}

function showContextMenu(e) {
  const m = $('#contextMenu');
  m.style.left = e.clientX + 'px'; m.style.top = e.clientY + 'px';
  m.classList.add('show');
}

/* ─── Init ────────────────────────────────────────────────────── */
audio.ontimeupdate = () => {
  const p = (audio.currentTime / audio.duration) * 100 + '%';
  if($('#seekBarFill')) $('#seekBarFill').style.width = p;
  if($('#currentTime')) $('#currentTime').textContent = formatTime(audio.currentTime);
  syncLyrics(audio.currentTime + 0.15);
};
audio.onloadedmetadata = () => { if($('#totalTime')) $('#totalTime').textContent = formatTime(audio.duration); };
audio.onended = nextSong;
audio.onplay = updatePlayBtn;
audio.onpause = updatePlayBtn;

function formatTime(s) { if(isNaN(s)) return '0:00'; return Math.floor(s/60) + ':' + Math.floor(s%60).toString().padStart(2,'0'); }

const savedUser = localStorage.getItem('swift_user');
if (savedUser) startApp(JSON.parse(savedUser));

/* ─── Custom Cursor (Desktop Only) ─────────────────────────────── */
(function initCustomCursor() {
  // Only activate on devices with a fine pointer (mouse)
  if (!window.matchMedia('(pointer: fine)').matches) return;

  const dot = document.getElementById('cursorDot');
  const ring = document.getElementById('cursorRing');
  if (!dot || !ring) return;

  let mouseX = -100, mouseY = -100;
  let ringX = -100, ringY = -100;
  let isVisible = false;
  let rafId = null;

  // Smooth trailing for the ring
  const LERP = 0.15;

  function animate() {
    ringX += (mouseX - ringX) * LERP;
    ringY += (mouseY - ringY) * LERP;
    ring.style.left = ringX + 'px';
    ring.style.top = ringY + 'px';
    rafId = requestAnimationFrame(animate);
  }
  rafId = requestAnimationFrame(animate);

  // Move dot instantly
  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    dot.style.left = mouseX + 'px';
    dot.style.top = mouseY + 'px';

    if (!isVisible) {
      isVisible = true;
      dot.classList.add('visible');
      ring.classList.add('visible');
    }
  });

  // Hide when mouse leaves the window
  document.addEventListener('mouseleave', () => {
    isVisible = false;
    dot.classList.remove('visible');
    ring.classList.remove('visible');
  });
  document.addEventListener('mouseenter', () => {
    isVisible = true;
    dot.classList.add('visible');
    ring.classList.add('visible');
  });

  // Hover effect on interactive elements
  const hoverSelector = 'a, button, input, [role="button"], .song-card, .recent-chip, .mood-pill, .playlist-card, .song-list-item, .stat-clickable, .nav-item, .panel-tab';

  document.addEventListener('mouseover', (e) => {
    if (e.target.closest(hoverSelector)) {
      dot.classList.add('hover');
      ring.classList.add('hover');
    }
  });
  document.addEventListener('mouseout', (e) => {
    if (e.target.closest(hoverSelector)) {
      dot.classList.remove('hover');
      ring.classList.remove('hover');
    }
  });

  // Click effect
  document.addEventListener('mousedown', () => {
    dot.classList.add('click');
    ring.classList.add('click');
  });
  document.addEventListener('mouseup', () => {
    dot.classList.remove('click');
    ring.classList.remove('click');
  });
})();
