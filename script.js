/* ═══════════════════════════════════════════════════════════════
   SWIFT MUSIC PLAYER — script.js
   (defer attribute means DOM is ready — no DOMContentLoaded needed)
═══════════════════════════════════════════════════════════════ */

/* ─── Supabase Setup ──────────────────────────────────────────── */
const SUPABASE_URL = "https://vhmwiarbobluutiumakr.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZobXdpYXJib2JsdXV0aXVtYWtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4NTAxNDUsImV4cCI6MjA4ODQyNjE0NX0.EeL1zlH0aWziPi3O4tDQ-SCPwzUToGVkp8MommHn-0I";

let db = null;
try { db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY); }
catch(e) { console.error("Supabase init failed:", e); }

/* ═══════════════════════════════════════════════════════════════
   GLOBAL FUNCTIONS — available immediately for HTML onclick attrs
═══════════════════════════════════════════════════════════════ */

window.openModal = function(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
};

window.closeModal = function(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove("active");
};

/* Close modal when clicking outside the box */
document.querySelectorAll(".modal-overlay").forEach(overlay => {
  overlay.addEventListener("click", e => {
    if (e.target === overlay) overlay.classList.remove("active");
  });
});


/* ─── Supabase Setup ──────────────────────────────────────────── */

/* ─── Gradient Palette ─────────────────────────────────────────── */
const GRADIENTS = [
  ['#667eea','#764ba2'], ['#f093fb','#f5576c'], ['#4facfe','#00f2fe'],
  ['#43e97b','#38f9d7'], ['#fa709a','#fee140'], ['#a18cd1','#fbc2eb'],
  ['#fda085','#f6d365'], ['#89f7fe','#66a6ff'], ['#d299c2','#fef9d7'],
  ['#00cdac','#8ddad5'], ['#a1c4fd','#c2e9fb'], ['#ff9a9e','#fecfef'],
  ['#a8edea','#fed6e3'], ['#f6d365','#fda085'], ['#96fbc4','#f9f586'],
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
let allSongs        = [];         // All songs from Supabase
let filteredSongs   = [];         // Current filtered list
let currentIndex    = -1;
let isPlaying       = false;
let currentMood     = 'all';
let currentView     = 'home';
let searchQuery     = '';
let isShuffle       = false;
let repeatMode      = 'none';     // 'none' | 'one' | 'all'
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
let allSongsLoaded  = false;

const audio = document.getElementById('audio-player');

/* ─── DOM Helpers ─────────────────────────────────────────────── */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function cleanText(str) {
  if (!str) return '';
  return str.replace(/^\uFEFF/, '').replace(/[^\x20-\x7E\u00A0-\uFFFF]/g, '').trim();
}

function formatTime(s) {
  if (isNaN(s) || s < 0) return '0:00';
  return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
}

function hilite(str, query) {
  if (!query) return str;
  const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return str.replace(re, '<span class="highlight">$1</span>');
}

/* ─── Toast ───────────────────────────────────────────────────── */
function showToast(msg, dur = 2200) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => t.classList.remove('show'), dur);
}

/* ─── Modal Helpers ───────────────────────────────────────────── */



function clearErrors() {
  document.querySelectorAll('.error-msg, .success-msg').forEach(el => {
    el.classList.remove('show');
    el.textContent = '';
  });
}

function showError(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.classList.add('show'); }
}

function showSuccess(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.classList.add('show'); }
}

/* ─── Admin Login ─────────────────────────────────────────────── */
window.adminLogin = async function () {
  clearErrors();
  const email    = document.getElementById('admin-email').value.trim();
  const password = document.getElementById('admin-password').value;

  if (!email || !password) { showError('admin-error', 'Please fill in all fields.'); return; }

  try {
    const { data, error } = await db.from('users').select('*')
      .eq('email', email).eq('password', password).eq('role', 'admin').single();

    if (error || !data) { showError('admin-error', 'Invalid credentials or not authorized.'); return; }

    sessionStorage.setItem('emotune_user', JSON.stringify(data));
    window.location.href = 'admin.html';
  } catch (err) {
    console.error('Admin login error:', err);
    showError('admin-error', 'Database error. Please try again.');
  }
};

/* ─── Toggle Auth Mode ────────────────────────────────────────── */
window.toggleAuthMode = function () {
  isRegisterMode = !isRegisterMode;
  clearErrors();
  if (isRegisterMode) {
    document.getElementById('user-modal-title').textContent = 'Create Account';
    document.getElementById('user-modal-sub').textContent   = 'Join Swift for free';
    document.getElementById('user-submit-btn').textContent  = 'Register →';
    document.getElementById('form-toggle-text').textContent = 'Already have an account?';
    document.getElementById('form-toggle-link').textContent = 'Login here';
  } else {
    document.getElementById('user-modal-title').textContent = 'Welcome Back';
    document.getElementById('user-modal-sub').textContent   = 'Login to feel the music';
    document.getElementById('user-submit-btn').textContent  = 'Login →';
    document.getElementById('form-toggle-text').textContent = 'New user?';
    document.getElementById('form-toggle-link').textContent = 'Register here';
  }
};

/* ─── User Auth ───────────────────────────────────────────────── */
window.userAuth = async function () {
  clearErrors();
  const email    = document.getElementById('user-email').value.trim();
  const password = document.getElementById('user-password').value;

  if (!email || !password) { showError('user-error', 'Please fill in all fields.'); return; }

  try {
    if (isRegisterMode) {
      const { data: existing } = await db.from('users').select('id').eq('email', email).single();
      if (existing) { showError('user-error', 'Email already registered. Please login.'); return; }

      const { data, error } = await db.from('users').insert([{ email, password, role: 'user' }]).select().single();
      if (error || !data) { showError('user-error', 'Registration failed. Please try again.'); return; }

      showSuccess('user-success', 'Account created! Logging you in…');
      currentUser = data;
      localStorage.setItem('swift_user', JSON.stringify(data));
      setTimeout(() => startApp(data), 1000);
    } else {
      const { data, error } = await db.from('users').select('*')
        .eq('email', email).eq('password', password).single();

      if (error || !data) { showError('user-error', 'Invalid email or password.'); return; }
      if (data.role === 'admin') { showError('user-error', 'Admins must use the Admin Login.'); return; }

      currentUser = data;
      localStorage.setItem('swift_user', JSON.stringify(data));
      startApp(data);
    }
  } catch (err) {
    console.error('Auth error:', err);
    showError('user-error', 'Connection error. Please try again.');
  }
};

/* ─── Start App ───────────────────────────────────────────────── */
async function startApp(user) {
  if (!user) return;
  localStorage.setItem('swift_user', JSON.stringify(user));
  closeModal('user-modal');

  document.getElementById('landing').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('bottomPlayer').classList.remove('hidden');

  // Set user info in topbar
  const email = user.email || '';
  document.getElementById('topbarEmail').textContent = email;
  const avatarLetter = email.charAt(0).toUpperCase();
  document.getElementById('userAvatarSmall').textContent = avatarLetter;

  // Update fav badge
  updateFavBadge();

  // Load all songs from Supabase
  await loadAllSongs();

  // Bind UI events
  bindPlayerControls();
  bindSidebarNav();
  bindSearchInput();
  bindPanelTabs();
  bindContextMenu();
  bindKeyboard();
  bindPanelToggle();

  // Render home view
  renderView('home');
}

/* ─── Logout ──────────────────────────────────────────────────── */
window.logout = function () {
  localStorage.removeItem('swift_user');
  currentUser = null;
  allSongs    = [];
  filteredSongs = [];
  currentIndex = -1;
  queue = [];
  audio.pause();
  audio.src = '';

  document.getElementById('app').classList.add('hidden');
  document.getElementById('bottomPlayer').classList.add('hidden');
  document.getElementById('landing').classList.remove('hidden');
};

/* ─── Load Songs from Supabase ────────────────────────────────── */
async function loadAllSongs() {
  const container = $('#viewContainer');
  container.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';

  try {
    const { data, error } = await db.from('songs').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    allSongs = (data || []).map((s, i) => ({ ...s, _gradIdx: i }));
    allSongsLoaded = true;
    filteredSongs = [...allSongs];
  } catch (err) {
    console.error('Load songs error:', err);
    allSongs = [];
    showToast('⚠️ Could not load songs — check connection');
  }
}

/* ─── Filter Songs ────────────────────────────────────────────── */
function applyFilters() {
  filteredSongs = allSongs.filter(song => {
    const moodOk   = currentMood === 'all' || (song.mood || '').toLowerCase() === currentMood.toLowerCase();
    const q        = searchQuery.toLowerCase();
    const searchOk = !q ||
      (song.title  || '').toLowerCase().includes(q) ||
      (song.artist || '').toLowerCase().includes(q) ||
      (song.mood   || '').toLowerCase().includes(q);
    return moodOk && searchOk;
  });
}

/* ─── Views ───────────────────────────────────────────────────── */
function renderView(view) {
  currentView = view;

  // Update sidebar active state
  $$('.nav-item').forEach(n => n.classList.remove('active'));
  const activeLink = $(`.nav-item[data-view="${view}"]`);
  if (activeLink) activeLink.classList.add('active');

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
  requestAnimationFrame(() => content.classList.add('view-enter'));

  // Bind card events
  bindSongCards();
  updateMoodPills();
  highlightCurrentCard();
}

/* ─── Home View ───────────────────────────────────────────────── */
function renderHome() {
  applyFilters();
  const div = document.createElement('div');

  const userName = (currentUser?.email || '').split('@')[0];

  // Greeting
  const moodLabels = { all:'All Songs', happy:'Happy', sad:'Sad', chill:'Chill', energetic:'Energetic', romantic:'Romantic', focus:'Focus' };
  div.innerHTML += `
    <div class="greeting-section">
      <h1 class="greeting-text">${getGreeting()}, ${escHtml(userName)} 👋</h1>
      <p class="greeting-sub">Your music, your mood.</p>
    </div>`;

  // Stats — clickable shortcuts
  const moodsSet = new Set(allSongs.map(s => s.mood).filter(Boolean));
  div.innerHTML += `
    <div class="stats-bar">
      <div class="stat-card stat-clickable" onclick="renderView('library')" title="Browse library">
        <div class="stat-value">${allSongs.length}</div><div class="stat-label">Songs</div>
      </div>
      <div class="stat-card stat-clickable" onclick="renderView('favorites')" title="Your favorites">
        <div class="stat-value">${favorites.size}</div><div class="stat-label">Favorites</div>
      </div>
      <div class="stat-card stat-clickable" onclick="renderView('recent')" title="Recently played">
        <div class="stat-value">${recentlyPlayed.length}</div><div class="stat-label">Played</div>
      </div>
      <div class="stat-card stat-clickable" onclick="renderView('playlists')" title="Mood collections">
        <div class="stat-value">${moodsSet.size}</div><div class="stat-label">Moods</div>
      </div>
    </div>`;

  // Recently played strip
  const recentSongs = getRecentSongs();
  if (recentSongs.length > 0) {
    const recentHTML = recentSongs.slice(0, 8).map(song => {
      const cover = song.cover_url && song.cover_url.startsWith('http') ? song.cover_url : null;
      return `<div class="recent-chip" data-song-id="${song.id}">
        <div class="recent-chip-art">
          ${cover
            ? `<img src="${escHtml(cover)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
            : ''}
          <div style="${cover ? 'display:none;' : ''}background:${getGradient(song._gradIdx)};width:100%;height:100%;border-radius:50%;display:flex;align-items:center;justify-content:center;">
            <span style="font-size:0.75rem;font-weight:800;color:rgba(255,255,255,0.9)">${(song.title || '?')[0]}</span>
          </div>
        </div>
        <span class="recent-chip-name">${escHtml(song.title)}</span>
      </div>`;
    }).join('');

    div.innerHTML += `
      <div class="section-header"><h2 class="section-title">Recently Played</h2></div>
      <div class="recent-strip" id="recentStrip">${recentHTML}</div>`;
  }

  // Song grid
  const count = filteredSongs.length;
  const moodLabel = currentMood === 'all' ? 'All Songs' : `${moodLabels[currentMood] || currentMood} Vibes`;

  div.innerHTML += `
    <div class="section-header">
      <h2 class="section-title">${moodLabel} <span style="color:var(--text-muted);font-weight:400;font-size:0.85rem">(${count})</span></h2>
    </div>`;

  if (count === 0) {
    div.innerHTML += `<div class="empty-state">
      <div class="empty-state-icon">🎵</div>
      <div class="empty-state-title">No songs found</div>
      <div class="empty-state-desc">Try a different mood filter or check back later</div>
    </div>`;
  } else {
    const grid = document.createElement('div');
    grid.className = 'songs-grid';
    filteredSongs.forEach((song, idx) => grid.appendChild(createSongCard(song, idx)));
    div.appendChild(grid);
  }

  // Bind recent chips after insertion
  setTimeout(() => {
    $$('.recent-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const id = chip.dataset.songId;
        const idx = filteredSongs.findIndex(s => String(s.id) === String(id));
        if (idx !== -1) playSong(idx);
        else {
          // Song not in current filter, switch to all
          currentMood = 'all';
          applyFilters();
          const idx2 = filteredSongs.findIndex(s => String(s.id) === String(id));
          if (idx2 !== -1) playSong(idx2);
        }
      });
    });
  }, 0);

  return div;
}

/* ─── Library View ────────────────────────────────────────────── */
function renderLibrary() {
  applyFilters();
  const div = document.createElement('div');

  // Mood pills
  const moods = ['all', 'happy', 'sad', 'chill', 'energetic', 'romantic', 'focus'];
  const moodEmojis = { all:'🎵', happy:'😄', sad:'😢', chill:'😌', energetic:'⚡', romantic:'💕', focus:'🧠' };
  const moodLabels = { all:'All', happy:'Happy', sad:'Sad', chill:'Chill', energetic:'Energetic', romantic:'Romantic', focus:'Focus' };

  div.innerHTML = `
    <div class="section-header" style="margin-bottom:16px">
      <h2 class="section-title">Library</h2>
      <span style="color:var(--text-muted);font-size:0.85rem">${filteredSongs.length} songs</span>
    </div>
    <div class="mood-filters" id="moodFiltersRow">
      ${moods.filter(m => m === 'all' || allSongs.some(s => (s.mood || '').toLowerCase() === m))
        .map(m => `<button class="mood-pill ${currentMood === m ? 'active' : ''}" data-mood="${m}">
          <span>${moodEmojis[m] || '🎵'}</span><span>${moodLabels[m] || m}</span>
        </button>`).join('')}
    </div>`;

  const list = document.createElement('div');
  list.className = 'song-list';

  if (filteredSongs.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🎵</div><div class="empty-state-title">No songs found</div></div>`;
  } else {
    filteredSongs.forEach((song, idx) => list.appendChild(createSongListItem(song, idx)));
  }
  div.appendChild(list);

  setTimeout(() => {
    $$('.mood-pill').forEach(pill => {
      pill.addEventListener('click', () => { currentMood = pill.dataset.mood; renderView('library'); });
    });
  }, 0);

  return div;
}

/* ─── Search View ─────────────────────────────────────────────── */
function renderSearch() {
  applyFilters();
  const div = document.createElement('div');
  const q = searchQuery;

  if (!q) {
    div.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon">🔍</div>
      <div class="empty-state-title">Search for music</div>
      <div class="empty-state-desc">Type in the search bar above to find songs or artists</div>
    </div>`;
    return div;
  }

  div.innerHTML = `<div class="section-header" style="margin-bottom:20px">
    <h2 class="section-title">Results for "<em style="color:var(--accent-light)">${escHtml(q)}</em>"</h2>
    <span style="color:var(--text-muted);font-size:0.85rem">${filteredSongs.length} found</span>
  </div>`;

  if (filteredSongs.length === 0) {
    div.innerHTML += `<div class="empty-state"><div class="empty-state-icon">😔</div><div class="empty-state-title">No results</div><div class="empty-state-desc">Try a different keyword</div></div>`;
  } else {
    const list = document.createElement('div');
    list.className = 'song-list';
    filteredSongs.forEach((song, idx) => list.appendChild(createSongListItem(song, idx, q)));
    div.appendChild(list);
  }
  return div;
}

/* ─── Playlists View ──────────────────────────────────────────── */
function renderPlaylists() {
  const div = document.createElement('div');
  div.innerHTML = `<div class="section-header" style="margin-bottom:20px"><h2 class="section-title">Mood Collections</h2></div>`;

  const grid = document.createElement('div');
  grid.className = 'playlist-grid';

  const moods = [
    { id: 'happy',    label: 'Happy Vibes',    emoji: '😄', bg: 'linear-gradient(135deg,#d97706,#fbbf24)' },
    { id: 'sad',      label: 'Sad Songs',       emoji: '😢', bg: 'linear-gradient(135deg,#4f46e5,#818cf8)' },
    { id: 'chill',    label: 'Chill Out',       emoji: '😌', bg: 'linear-gradient(135deg,#0891b2,#22d3ee)' },
    { id: 'energetic',label: 'Energetic',       emoji: '⚡', bg: 'linear-gradient(135deg,#dc2626,#f87171)' },
    { id: 'romantic', label: 'Romantic',        emoji: '💕', bg: 'linear-gradient(135deg,#db2777,#f472b6)' },
    { id: 'focus',    label: 'Focus Mode',      emoji: '🧠', bg: 'linear-gradient(135deg,#6d28d9,#8b5cf6)' },
  ];

  moods.forEach(mood => {
    const count = allSongs.filter(s => (s.mood || '').toLowerCase() === mood.id).length;
    const card = document.createElement('div');
    card.className = 'playlist-card';
    card.innerHTML = `
      <div class="playlist-art" style="background:${mood.bg}">
        <span style="font-size:2.8rem">${mood.emoji}</span>
      </div>
      <div class="playlist-info">
        <div class="playlist-name">${mood.label}</div>
        <div class="playlist-count">${count} songs</div>
      </div>`;
    card.addEventListener('click', () => {
      currentMood = mood.id;
      renderView('home');
    });
    grid.appendChild(card);
  });

  div.appendChild(grid);
  return div;
}

/* ─── Favorites View ──────────────────────────────────────────── */
function renderFavorites() {
  const div = document.createElement('div');
  const favSongs = allSongs.filter(s => favorites.has(String(s.id)));

  div.innerHTML = `<div class="section-header" style="margin-bottom:20px">
    <h2 class="section-title">Favorites <span style="color:var(--text-muted);font-weight:400;font-size:0.85rem">(${favSongs.length})</span></h2>
  </div>`;

  if (!favSongs.length) {
    div.innerHTML += `<div class="empty-state"><div class="empty-state-icon">💔</div><div class="empty-state-title">No favorites yet</div><div class="empty-state-desc">Click the ♡ icon on any song to save it here</div></div>`;
  } else {
    const list = document.createElement('div');
    list.className = 'song-list';
    favSongs.forEach((song, idx) => {
      const item = createSongListItem(song, idx);
      // Override click to play from favSongs array via filteredSongs sync
      item.addEventListener('click', (e) => {
        if (e.target.closest('.list-fav-btn')) return;
        filteredSongs = favSongs;
        playSong(idx);
      });
      list.appendChild(item);
    });
    div.appendChild(list);
  }
  return div;
}

/* ─── Recent View ─────────────────────────────────────────────── */
function renderRecent() {
  const div = document.createElement('div');
  const recent = getRecentSongs();

  div.innerHTML = `<div class="section-header" style="margin-bottom:20px"><h2 class="section-title">Recently Played</h2></div>`;

  if (!recent.length) {
    div.innerHTML += `<div class="empty-state"><div class="empty-state-icon">🕐</div><div class="empty-state-title">Nothing yet</div><div class="empty-state-desc">Start playing music to see your history</div></div>`;
  } else {
    const list = document.createElement('div');
    list.className = 'song-list';
    recent.forEach((song, idx) => {
      const item = createSongListItem(song, idx);
      item.addEventListener('click', (e) => {
        if (e.target.closest('.list-fav-btn')) return;
        filteredSongs = recent;
        playSong(idx);
      });
      list.appendChild(item);
    });
    div.appendChild(list);
  }
  return div;
}

/* ─── Settings View ───────────────────────────────────────────── */
function renderSettings() {
  const div = document.createElement('div');
  div.innerHTML = `
    <div class="section-header" style="margin-bottom:24px"><h2 class="section-title">Settings</h2></div>
    <div class="settings-grid">
      <div class="stat-card">
        <div style="font-family:var(--font-display);font-weight:700;margin-bottom:12px">Account</div>
        <div style="font-size:0.875rem;color:var(--text-secondary);margin-bottom:12px">
          Logged in as <strong>${escHtml(currentUser?.email || '—')}</strong>
        </div>
        <button onclick="logout()" class="btn-ghost-sm" style="color:#f87171;border-color:rgba(239,68,68,0.3)">
          <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><polyline points="16 17 21 12 16 7" stroke="currentColor" stroke-width="1.8"/><line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" stroke-width="1.8"/></svg>
          Logout
        </button>
      </div>
      <div class="stat-card">
        <div style="font-family:var(--font-display);font-weight:700;margin-bottom:8px">Library</div>
        <div style="font-size:0.875rem;color:var(--text-secondary);margin-bottom:14px">
          ${allSongs.length} songs · ${favorites.size} favorites · ${recentlyPlayed.length} tracks played
        </div>
        <button onclick="clearLocalData()" class="btn-ghost-sm" style="color:#f87171;border-color:rgba(239,68,68,0.3)">
          Clear saved data
        </button>
      </div>
      <div class="stat-card">
        <div style="font-family:var(--font-display);font-weight:700;margin-bottom:12px">Keyboard Shortcuts</div>
        <div style="display:grid;grid-template-columns:auto 1fr;gap:8px 16px;font-size:0.82rem;color:var(--text-secondary)">
          <kbd style="background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:4px;padding:2px 8px;font-family:inherit">Space</kbd><span>Play / Pause</span>
          <kbd style="background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:4px;padding:2px 8px;font-family:inherit">← →</kbd><span>Seek ±5 seconds</span>
          <kbd style="background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:4px;padding:2px 8px;font-family:inherit">Shift ← →</kbd><span>Previous / Next track</span>
          <kbd style="background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:4px;padding:2px 8px;font-family:inherit">↑ ↓</kbd><span>Volume up / down</span>
          <kbd style="background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:4px;padding:2px 8px;font-family:inherit">S</kbd><span>Toggle shuffle</span>
          <kbd style="background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:4px;padding:2px 8px;font-family:inherit">R</kbd><span>Cycle repeat</span>
          <kbd style="background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:4px;padding:2px 8px;font-family:inherit">M</kbd><span>Mute / Unmute</span>
          <kbd style="background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:4px;padding:2px 8px;font-family:inherit">F</kbd><span>Favorite current</span>
          <kbd style="background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:4px;padding:2px 8px;font-family:inherit">⌘K</kbd><span>Focus search</span>
        </div>
      </div>
      <div class="stat-card" style="text-align:center;color:var(--text-muted);font-size:0.8rem">
        <div style="font-size:1.5rem;margin-bottom:8px">⚡</div>
        <div style="font-family:var(--font-display);font-weight:700;color:var(--text-primary)">Swift Music Player</div>
        <div style="margin-top:4px">Mood-based streaming · Built with Supabase</div>
      </div>
    </div>`;
  return div;
}

window.clearLocalData = function() {
  favorites = new Set();
  recentlyPlayed = [];
  localStorage.removeItem('swift_favs');
  localStorage.removeItem('swift_recent');
  updateFavBadge();
  showToast('🗑️ Saved data cleared');
  renderView('settings');
};

/* ─── Song Card (Grid) ────────────────────────────────────────── */
function createSongCard(song, idx) {
  const card = document.createElement('div');
  const isFav = favorites.has(String(song.id));
  const isCurrentlyPlaying = currentIndex === idx && filteredSongs[idx]?.id === song.id;
  card.className = `song-card${isCurrentlyPlaying ? ' playing' : ''}`;
  card.dataset.songId = song.id;
  card.dataset.filteredIdx = idx;
  card.style.animationDelay = `${idx * 0.04}s`;

  const cover = song.cover_url && song.cover_url.startsWith('http') ? song.cover_url : null;
  const firstLetter = (song.title || '?')[0].toUpperCase();

  card.innerHTML = `
    <div class="song-card-cover">
      ${cover
        ? `<img src="${escHtml(cover)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
        : ''}
      <div class="song-card-cover-gradient" style="${cover ? 'display:none;' : ''}background:${getGradient(song._gradIdx)}">
        <span class="cover-letter">${firstLetter}</span>
      </div>
      <div class="play-overlay">
        <div class="play-circle">
          ${isCurrentlyPlaying && isPlaying
            ? '<div class="eq-bars"><div class="eq-bar"></div><div class="eq-bar"></div><div class="eq-bar"></div><div class="eq-bar"></div></div>'
            : '<svg viewBox="0 0 24 24" fill="none" width="18" height="18"><polygon points="5,3 19,12 5,21 5,3" fill="currentColor"/></svg>'}
        </div>
      </div>
    </div>
    <div class="song-card-info">
      <div class="song-card-title">${escHtml(cleanText(song.title))}</div>
      <div class="song-card-artist">${escHtml(cleanText(song.artist))}</div>
      <div class="song-card-footer">
        <span class="song-mood-chip">${escHtml(song.mood || 'music')}</span>
        <button class="card-fav-btn ${isFav ? 'active' : ''}" data-fav-id="${song.id}" title="${isFav ? 'Remove from favorites' : 'Add to favorites'}">
          <svg viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" width="14" height="14">
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </div>`;

  return card;
}

/* ─── Song List Item ──────────────────────────────────────────── */
function createSongListItem(song, idx, highlight = '') {
  const item = document.createElement('div');
  const isFav = favorites.has(String(song.id));
  const isCurrentlyPlaying = currentIndex !== -1 && filteredSongs[currentIndex]?.id === song.id;
  item.className = `song-list-item${isCurrentlyPlaying ? ' playing' : ''}`;
  item.dataset.songId = song.id;
  item.dataset.filteredIdx = idx;
  item.style.animationDelay = `${idx * 0.03}s`;

  const cover = song.cover_url && song.cover_url.startsWith('http') ? song.cover_url : null;
  const firstLetter = (song.title || '?')[0].toUpperCase();
  const titleDisplay  = highlight ? hilite(escHtml(cleanText(song.title)), highlight) : escHtml(cleanText(song.title));
  const artistDisplay = highlight ? hilite(escHtml(cleanText(song.artist)), highlight) : escHtml(cleanText(song.artist));

  item.innerHTML = `
    <span class="list-num">${isCurrentlyPlaying && isPlaying
      ? '<div class="eq-bars" style="justify-content:center"><div class="eq-bar"></div><div class="eq-bar"></div><div class="eq-bar"></div></div>'
      : idx + 1}</span>
    <div class="list-art-wrap">
      ${cover
        ? `<img src="${escHtml(cover)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
        : ''}
      <div class="list-art-grad" style="${cover ? 'display:none;' : ''}background:${getGradient(song._gradIdx)};border-radius:8px;align-items:center;justify-content:center;">
        <span style="font-family:var(--font-display);font-weight:800;font-size:0.9rem;color:rgba(255,255,255,0.9)">${firstLetter}</span>
      </div>
    </div>
    <span class="list-title">${titleDisplay}</span>
    <span class="list-artist">${artistDisplay}</span>
    <span class="list-mood">${escHtml(song.mood || '')}</span>
    <button class="list-fav-btn ${isFav ? 'active' : ''}" data-fav-id="${song.id}" title="${isFav ? 'Unfavorite' : 'Favorite'}">
      <svg viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" width="15" height="15">
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
      </svg>
    </button>`;

  return item;
}

/* ─── Bind Song Card Events ───────────────────────────────────── */
function bindSongCards() {
  $$('.song-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.card-fav-btn')) return;
      const idx = parseInt(card.dataset.filteredIdx);
      playSong(idx);
    });
    card.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      contextTargetId = card.dataset.songId;
      showContextMenu(e);
    });
    const favBtn = card.querySelector('.card-fav-btn');
    if (favBtn) favBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFavorite(favBtn.dataset.favId);
    });
  });

  $$('.song-list-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.list-fav-btn')) return;
      const idx = parseInt(item.dataset.filteredIdx);
      playSong(idx);
    });
    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      contextTargetId = item.dataset.songId;
      showContextMenu(e);
    });
    const favBtn = item.querySelector('.list-fav-btn');
    if (favBtn) favBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFavorite(favBtn.dataset.favId);
    });
  });
}

/* ─── Play Song ───────────────────────────────────────────────── */
function playSong(idx) {
  if (idx < 0 || idx >= filteredSongs.length) return;
  currentIndex = idx;
  const song = filteredSongs[idx];

  if (!song.file_url) {
    showToast('⚠️ No audio file for this song');
    return;
  }

  audio.src = song.file_url;
  audio.play().catch(err => console.error('Playback error:', err));
  isPlaying = true;

  addToRecent(song);
  updatePlayerUI(song);
  updateNowPlaying(song);
  renderQueue();
  highlightCurrentCard();

  // Show player
  document.getElementById('bottomPlayer').classList.remove('hidden');

  // Parse lyrics
  activeLyricIndex = -1;
  if (song.lyrics) {
    currentLyrics = parseLyrics(song.lyrics);
    renderLyricsPanel(currentLyrics);
  } else {
    currentLyrics = [];
    const lyricsContainer = $('#lyricsContainer');
    if (lyricsContainer) lyricsContainer.innerHTML = '<p class="lyrics-placeholder">No lyrics available for this song.</p>';
  }
}

/* ─── Toggle Play ─────────────────────────────────────────────── */
function togglePlay() {
  if (currentIndex === -1 && filteredSongs.length > 0) { playSong(0); return; }
  if (audio.paused) { audio.play().catch(() => {}); }
  else { audio.pause(); }
}

/* ─── Next Song ───────────────────────────────────────────────── */
function nextSong() {
  if (!filteredSongs.length) return;

  // Check queue first
  if (queue.length > 0) {
    const nextFromQueue = queue.shift();
    const idx = filteredSongs.findIndex(s => String(s.id) === String(nextFromQueue.id));
    if (idx !== -1) { playSong(idx); renderQueue(); return; }
  }

  let nextIdx;
  if (isShuffle) nextIdx = randomIndex();
  else nextIdx = (currentIndex + 1) % filteredSongs.length;
  playSong(nextIdx);
}

/* ─── Prev Song ───────────────────────────────────────────────── */
function prevSong() {
  if (!filteredSongs.length) return;
  if (audio.currentTime > 3) { audio.currentTime = 0; return; }
  let prevIdx;
  if (isShuffle && shuffleHistory.length > 0) prevIdx = shuffleHistory.pop();
  else prevIdx = (currentIndex - 1 + filteredSongs.length) % filteredSongs.length;
  playSong(prevIdx);
}

/* ─── Handle Track End ────────────────────────────────────────── */
function handleTrackEnd() {
  switch (repeatMode) {
    case 'one': audio.currentTime = 0; audio.play(); break;
    case 'all': nextSong(); break;
    default:
      if (currentIndex < filteredSongs.length - 1) nextSong();
      else { isPlaying = false; updatePlayBtn(); }
  }
}

/* ─── Random Index ────────────────────────────────────────────── */
function randomIndex() {
  if (filteredSongs.length <= 1) return 0;
  shuffleHistory.push(currentIndex);
  let idx;
  do { idx = Math.floor(Math.random() * filteredSongs.length); }
  while (idx === currentIndex);
  return idx;
}

/* ─── Update Player UI ────────────────────────────────────────── */
function updatePlayerUI(song) {
  // Bottom bar
  document.getElementById('playerTitle').textContent  = cleanText(song.title) || '—';
  document.getElementById('playerArtist').textContent = cleanText(song.artist) || '—';

  const playerCoverEl = document.getElementById('playerCover');
  playerCoverEl.innerHTML = '';
  if (song.cover_url && song.cover_url.startsWith('http')) {
    const img = document.createElement('img');
    img.src = song.cover_url;
    img.alt = song.title;
    img.onerror = () => {
      img.remove();
      const grad = document.createElement('div');
      grad.className = 'player-cover-grad';
      grad.style.background = getGradient(song._gradIdx);
      grad.innerHTML = `<span style="font-family:var(--font-display);font-weight:800;font-size:1.2rem;color:rgba(255,255,255,0.9)">${(song.title||'?')[0]}</span>`;
      playerCoverEl.appendChild(grad);
    };
    playerCoverEl.appendChild(img);
  } else {
    const grad = document.createElement('div');
    grad.className = 'player-cover-grad';
    grad.style.background = getGradient(song._gradIdx);
    grad.innerHTML = `<span style="font-family:var(--font-display);font-weight:800;font-size:1.2rem;color:rgba(255,255,255,0.9)">${(song.title||'?')[0]}</span>`;
    playerCoverEl.appendChild(grad);
  }

  // Fav state
  const isFav = favorites.has(String(song.id));
  document.getElementById('playerFavBtn').classList.toggle('active', isFav);
  const pfSvg = document.getElementById('playerFavBtn').querySelector('svg');
  if (pfSvg) pfSvg.setAttribute('fill', isFav ? 'currentColor' : 'none');

  document.getElementById('currentTime').textContent = '0:00';
  setProgressUI(0);
  updatePlayBtn();
}

/* ─── Update Now Playing Panel ────────────────────────────────── */
function updateNowPlaying(song) {
  document.getElementById('npTitle').textContent  = cleanText(song.title) || 'Unknown';
  document.getElementById('npArtist').textContent = cleanText(song.artist) || '—';
  document.getElementById('npMood').textContent   = song.mood ? capitalize(song.mood) : '';

  // Artwork
  const artwork = document.getElementById('npArtwork');
  artwork.innerHTML = '';
  if (song.cover_url && song.cover_url.startsWith('http')) {
    const img = document.createElement('img');
    img.src = song.cover_url;
    img.alt = song.title;
    img.onerror = () => { img.remove(); setNpGradient(artwork, song); };
    artwork.appendChild(img);
  } else {
    setNpGradient(artwork, song);
  }
  artwork.classList.toggle('playing', true);

  // Blur bg
  const blur = document.getElementById('npArtworkBlur');
  blur.style.background = getGradient(song._gradIdx);

  // Fav state
  const isFav = favorites.has(String(song.id));
  document.getElementById('npFavBtn').classList.toggle('active', isFav);
  const npFavSvg = document.getElementById('npFavBtn').querySelector('svg');
  if (npFavSvg) npFavSvg.setAttribute('fill', isFav ? 'currentColor' : 'none');
}

function setNpGradient(artwork, song) {
  const gradDiv = document.createElement('div');
  gradDiv.className = 'np-artwork-gradient';
  gradDiv.style.background = getGradient(song._gradIdx);
  const letter = document.createElement('span');
  letter.className = 'np-artwork-letter';
  letter.textContent = (song.title || '?')[0].toUpperCase();
  gradDiv.appendChild(letter);
  artwork.appendChild(gradDiv);
}

/* ─── Update Play Button ──────────────────────────────────────── */
function updatePlayBtn() {
  const playIcon  = $('#playBtn .play-icon');
  const pauseIcon = $('#playBtn .pause-icon');
  const playing   = !audio.paused;
  isPlaying = playing;
  if (playIcon)  playIcon.style.display  = playing ? 'none' : '';
  if (pauseIcon) pauseIcon.style.display = playing ? ''     : 'none';

  // Artwork pulse
  const artwork = document.getElementById('npArtwork');
  if (artwork) artwork.classList.toggle('playing', playing);
}

/* ─── Seek ────────────────────────────────────────────────────── */
function setProgressUI(ratio) {
  const pct = `${(ratio * 100).toFixed(2)}%`;
  const fill  = document.getElementById('seekBarFill');
  const thumb = document.getElementById('seekBarThumb');
  if (fill)  fill.style.width = pct;
  if (thumb) thumb.style.left = pct;
}

function seekFromEvent(e) {
  const wrap = document.getElementById('seekBarWrap');
  if (!wrap) return;
  const rect = wrap.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  if (!isNaN(audio.duration)) {
    audio.currentTime = ratio * audio.duration;
    setProgressUI(ratio);
  }
}

/* ─── Volume ──────────────────────────────────────────────────── */
function setVolume(vol) {
  audio.volume = Math.max(0, Math.min(1, vol));
  const pct = `${(vol * 100).toFixed(0)}%`;
  const fill  = document.getElementById('volumeFill');
  const thumb = document.getElementById('volumeThumb');
  const input = document.getElementById('volumeInput');
  if (fill)  fill.style.width  = pct;
  if (thumb) thumb.style.left  = pct;
  if (input) input.value       = vol * 100;
  updateMuteBtn();
}

let prevVolume = 0.8;

function toggleMute() {
  if (audio.volume === 0) {
    setVolume(prevVolume || 0.8);
  } else {
    prevVolume = audio.volume;
    setVolume(0);
  }
}

function updateMuteBtn() {
  const muted = audio.volume === 0;
  const volIcon  = $('#muteBtn .vol-icon');
  const muteIcon = $('#muteBtn .mute-icon');
  if (volIcon)  volIcon.style.display  = muted ? 'none' : '';
  if (muteIcon) muteIcon.style.display = muted ? ''     : 'none';
}

/* ─── Shuffle & Repeat ────────────────────────────────────────── */
function toggleShuffle() {
  isShuffle = !isShuffle;
  shuffleHistory = [];
  document.getElementById('shuffleBtn').classList.toggle('active', isShuffle);
  showToast(isShuffle ? '🔀 Shuffle on' : '🔀 Shuffle off');
}

function cycleRepeat() {
  const modes = ['none', 'all', 'one'];
  const i = modes.indexOf(repeatMode);
  repeatMode = modes[(i + 1) % modes.length];
  const btn = document.getElementById('repeatBtn');
  btn.classList.toggle('active', repeatMode !== 'none');
  const labels = { none: '🔁 Repeat off', all: '🔁 Repeat all', one: '🔂 Repeat one' };
  showToast(labels[repeatMode] || 'Repeat off');
}

/* ─── Favorites ───────────────────────────────────────────────── */
function toggleFavorite(id) {
  id = String(id);
  if (favorites.has(id)) {
    favorites.delete(id);
    showToast('💔 Removed from favorites');
  } else {
    favorites.add(id);
    showToast('❤️ Added to favorites');
  }
  localStorage.setItem('swift_favs', JSON.stringify([...favorites]));
  updateFavBadge();
  updateFavButtons(id);
  if (currentView === 'favorites') renderView('favorites');
}

function updateFavBadge() {
  const badge = document.getElementById('favBadge');
  if (badge) badge.textContent = favorites.size;
}

function updateFavButtons(id) {
  const isFav = favorites.has(String(id));
  // Update all card/list fav buttons with this id
  document.querySelectorAll(`[data-fav-id="${id}"]`).forEach(btn => {
    btn.classList.toggle('active', isFav);
    const svg = btn.querySelector('svg');
    if (svg) svg.setAttribute('fill', isFav ? 'currentColor' : 'none');
  });
  // Update NP panel and player bar if this is the currently playing song
  const song = filteredSongs[currentIndex];
  if (song && String(song.id) === String(id)) {
    const npBtn = document.getElementById('npFavBtn');
    if (npBtn) {
      npBtn.classList.toggle('active', isFav);
      const svg = npBtn.querySelector('svg');
      if (svg) svg.setAttribute('fill', isFav ? 'currentColor' : 'none');
    }
    const pfBtn = document.getElementById('playerFavBtn');
    if (pfBtn) {
      pfBtn.classList.toggle('active', isFav);
      const svg = pfBtn.querySelector('svg');
      if (svg) svg.setAttribute('fill', isFav ? 'currentColor' : 'none');
    }
  }
}

/* ─── Queue ───────────────────────────────────────────────────── */
function addToQueue(song) {
  queue.push(song);
  renderQueue();
  showToast(`➕ "${song.title}" added to queue`);
}

function renderQueue() {
  const container = document.getElementById('queueList');
  if (!container) return;

  if (!queue.length) {
    container.innerHTML = '<p class="queue-empty">Your queue is empty</p>';
    return;
  }

  container.innerHTML = queue.map((song, i) => {
    const cover = song.cover_url && song.cover_url.startsWith('http') ? song.cover_url : null;
    return `<div class="queue-item" data-queue-idx="${i}">
      <div class="queue-item-art">
        ${cover
          ? `<img src="${escHtml(cover)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='block'">`
          : ''}
        <div class="queue-item-art-grad" style="${cover ? 'display:none;' : ''}background:${getGradient(song._gradIdx)}"></div>
      </div>
      <div class="queue-item-info">
        <div class="queue-item-title">${escHtml(song.title)}</div>
        <div class="queue-item-artist">${escHtml(song.artist)}</div>
      </div>
      <button class="queue-item-remove" data-remove-idx="${i}" title="Remove">✕</button>
    </div>`;
  }).join('');

  container.querySelectorAll('.queue-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.queue-item-remove')) return;
      const idx = parseInt(item.dataset.queueIdx);
      const song = queue.splice(idx, 1)[0];
      const filtIdx = filteredSongs.findIndex(s => String(s.id) === String(song.id));
      if (filtIdx !== -1) playSong(filtIdx);
      renderQueue();
    });
  });

  container.querySelectorAll('.queue-item-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.removeIdx);
      queue.splice(idx, 1);
      renderQueue();
    });
  });
}

/* ─── Recently Played ─────────────────────────────────────────── */
function addToRecent(song) {
  recentlyPlayed = [String(song.id), ...recentlyPlayed.filter(id => id !== String(song.id))].slice(0, 20);
  localStorage.setItem('swift_recent', JSON.stringify(recentlyPlayed));
}

function getRecentSongs() {
  return recentlyPlayed.map(id => allSongs.find(s => String(s.id) === String(id))).filter(Boolean);
}

/* ─── Lyrics ──────────────────────────────────────────────────── */
function parseLyrics(lrc) {
  if (!lrc) return [];
  return lrc.split('\n').map(line => {
    const match = line.match(/\[(\d+):(\d+(?:\.\d+)?)\](.*)/);
    if (!match) return null;
    return { time: parseInt(match[1]) * 60 + parseFloat(match[2]), text: match[3].trim() };
  }).filter(Boolean);
}

function renderLyricsPanel(lyrics) {
  const container = document.getElementById('lyricsContainer');
  if (!container) return;

  if (!lyrics.length) {
    container.innerHTML = '<p class="lyrics-placeholder">No lyrics available.</p>';
    return;
  }

  container.innerHTML = '';
  lyrics.forEach((line, i) => {
    const el = document.createElement('div');
    el.className = 'lyric-line';
    el.dataset.time = line.time;
    el.textContent = line.text;
    el.addEventListener('click', () => { audio.currentTime = line.time; });
    container.appendChild(el);
  });
}

function syncLyrics(time) {
  if (!currentLyrics.length) return;
  for (let i = 0; i < currentLyrics.length; i++) {
    const curr = currentLyrics[i];
    const next = currentLyrics[i + 1];
    if (time >= curr.time && (!next || time < next.time)) {
      if (i === activeLyricIndex) return;
      activeLyricIndex = i;
      const lines = document.querySelectorAll('.lyric-line');
      lines.forEach(el => el.classList.remove('active'));
      const active = lines[i];
      if (active) { active.classList.add('active'); active.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
      break;
    }
  }
}

/* ─── Highlight Current Card ──────────────────────────────────── */
function highlightCurrentCard() {
  $$('.song-card').forEach(c => c.classList.remove('playing'));
  $$('.song-list-item').forEach(c => c.classList.remove('playing'));
  const song = filteredSongs[currentIndex];
  if (!song) return;
  $$(`.song-card[data-song-id="${song.id}"]`).forEach(c => c.classList.add('playing'));
  $$(`.song-list-item[data-song-id="${song.id}"]`).forEach(c => c.classList.add('playing'));
}

/* ─── Update Mood Pills ───────────────────────────────────────── */
function updateMoodPills() {
  $$('.mood-pill').forEach(p => p.classList.toggle('active', p.dataset.mood === currentMood));
}

/* ─── Context Menu ────────────────────────────────────────────── */
function showContextMenu(e) {
  const menu = document.getElementById('contextMenu');
  const x = Math.min(e.clientX, window.innerWidth  - 200);
  const y = Math.min(e.clientY, window.innerHeight - 200);
  menu.style.left = `${x}px`;
  menu.style.top  = `${y}px`;
  menu.classList.add('show');
}

/* ─── Panel Tab Switching ─────────────────────────────────────── */
function bindPanelTabs() {
  $$('.panel-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.panel-tab').forEach(t => t.classList.remove('active'));
      $$('.panel-tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      const tabId = tab.dataset.tab;
      const content = document.getElementById('tab' + tabId.charAt(0).toUpperCase() + tabId.slice(1));
      if (content) content.classList.add('active');
    });
  });
}

/* ─── Panel Toggle ────────────────────────────────────────────── */
function bindPanelToggle() {
  const panel = document.getElementById('nowPlayingPanel');
  const toggleBtn = document.getElementById('queueToggle');
  const closeBtn  = document.getElementById('panelClose');

  if (toggleBtn) toggleBtn.addEventListener('click', () => {
    panelOpen = !panelOpen;
    panel.classList.toggle('collapsed', !panelOpen);
    toggleBtn.classList.toggle('active', panelOpen);
  });

  if (closeBtn) closeBtn.addEventListener('click', () => {
    panelOpen = false;
    panel.classList.add('collapsed');
    if (toggleBtn) toggleBtn.classList.remove('active');
  });
}

/* ─── Sidebar Nav ─────────────────────────────────────────────── */
function bindSidebarNav() {
  $$('.nav-item[data-view]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      renderView(link.dataset.view);
    });
  });

  $$('.mood-nav-item[data-mood]').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      currentMood = item.dataset.mood;
      // Update active state
      $$('.mood-nav-item').forEach(m => m.classList.remove('active'));
      item.classList.add('active');
      renderView('home');
    });
  });

  // Sidebar toggle button
  const sidebarToggle = document.getElementById('sidebarToggle');
  if (sidebarToggle) sidebarToggle.addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    sidebarOpen = !sidebarOpen;
    sidebar.classList.toggle('collapsed', !sidebarOpen);
  });
}

/* ─── Search Input ────────────────────────────────────────────── */
function bindSearchInput() {
  const searchInput = document.getElementById('searchInput');
  if (!searchInput) return;

  let debounceTimer;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      searchQuery = e.target.value.trim();
      if (searchQuery) renderView('search');
      else if (currentView === 'search') renderView('home');
    }, 250);
  });
}

/* ─── Player Controls Binding ─────────────────────────────────── */
function bindPlayerControls() {
  // Play/Pause
  document.getElementById('playBtn')?.addEventListener('click', togglePlay);
  document.getElementById('nextBtn')?.addEventListener('click', nextSong);
  document.getElementById('prevBtn')?.addEventListener('click', prevSong);
  document.getElementById('shuffleBtn')?.addEventListener('click', toggleShuffle);
  document.getElementById('repeatBtn')?.addEventListener('click', cycleRepeat);
  document.getElementById('muteBtn')?.addEventListener('click', toggleMute);

  // Volume
  document.getElementById('volumeInput')?.addEventListener('input', (e) => {
    setVolume(e.target.value / 100);
  });

  // Seek
  const seekWrap = document.getElementById('seekBarWrap');
  if (seekWrap) {
    seekWrap.addEventListener('mousedown', (e) => { isSeekDragging = true; seekFromEvent(e); });
    seekWrap.addEventListener('touchstart', (e) => { isSeekDragging = true; seekFromEvent(e); }, { passive: true });
    document.addEventListener('mousemove', (e) => { if (isSeekDragging) seekFromEvent(e); });
    document.addEventListener('touchmove', (e) => { if (isSeekDragging) seekFromEvent(e); }, { passive: true });
    document.addEventListener('mouseup',  (e) => { if (isSeekDragging) { seekFromEvent(e); isSeekDragging = false; } });
    document.addEventListener('touchend', (e) => { if (isSeekDragging) { isSeekDragging = false; } });
  }

  // Fav buttons
  document.getElementById('npFavBtn')?.addEventListener('click', () => {
    const song = filteredSongs[currentIndex];
    if (song) toggleFavorite(song.id);
  });
  document.getElementById('playerFavBtn')?.addEventListener('click', () => {
    const song = filteredSongs[currentIndex];
    if (song) toggleFavorite(song.id);
  });

  // Queue clear
  document.getElementById('queueClearBtn')?.addEventListener('click', () => {
    queue = [];
    renderQueue();
    showToast('Queue cleared');
  });

  // Download button
  document.getElementById('downloadBtn')?.addEventListener('click', () => {
    const song = filteredSongs[currentIndex];
    if (!song) { showToast('⚠️ No song playing'); return; }
    downloadSong(song.file_url, song.title);
  });
}

/* ─── Context Menu Binding ────────────────────────────────────── */
function bindContextMenu() {
  const ctx = document.getElementById('contextMenu');
  document.addEventListener('click', (e) => {
    if (!ctx.contains(e.target)) ctx.classList.remove('show');
  });

  ctx?.addEventListener('click', (e) => {
    const btn = e.target.closest('.ctx-item');
    if (!btn || !contextTargetId) return;
    const song = allSongs.find(s => String(s.id) === String(contextTargetId));
    if (!song) return;

    switch (btn.dataset.action) {
      case 'play': {
        const idx = filteredSongs.findIndex(s => String(s.id) === String(contextTargetId));
        if (idx !== -1) playSong(idx); break;
      }
      case 'queue':    addToQueue(song); break;
      case 'favorite': toggleFavorite(song.id); break;
      case 'download': downloadSong(song.file_url, song.title); break;
    }
    ctx.classList.remove('show');
  });
}

/* ─── Keyboard Shortcuts ──────────────────────────────────────── */
function bindKeyboard() {
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;

    if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      document.getElementById('searchInput')?.focus();
      return;
    }

    switch (e.code) {
      case 'Space':      e.preventDefault(); togglePlay(); break;
      case 'ArrowRight': e.shiftKey ? nextSong() : (audio.currentTime = Math.min(audio.currentTime + 5, audio.duration || 0)); break;
      case 'ArrowLeft':  e.shiftKey ? prevSong() : (audio.currentTime = Math.max(audio.currentTime - 5, 0)); break;
      case 'ArrowUp':    e.preventDefault(); setVolume(Math.min(1, audio.volume + 0.05)); break;
      case 'ArrowDown':  e.preventDefault(); setVolume(Math.max(0, audio.volume - 0.05)); break;
      case 'KeyS':       toggleShuffle(); break;
      case 'KeyR':       cycleRepeat(); break;
      case 'KeyM':       toggleMute(); break;
      case 'KeyF':       { const song = filteredSongs[currentIndex]; if (song) toggleFavorite(song.id); break; }
    }
  });
}

/* ─── Download Song ───────────────────────────────────────────── */
async function downloadSong(url, title) {
  if (!url) { showToast('⚠️ No download available'); return; }
  showToast('⏳ Starting download…');
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Network error');
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = (title || 'song') + '.mp3';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objectUrl);
    showToast('✅ Download started');
  } catch (err) {
    console.error('Download error:', err);
    showToast('⚠️ Download failed');
  }
}

/* ─── Audio Events ────────────────────────────────────────────── */
audio.addEventListener('timeupdate', () => {
  if (!isSeekDragging && audio.duration) {
    const ratio = audio.currentTime / audio.duration;
    setProgressUI(ratio);
    document.getElementById('currentTime').textContent = formatTime(audio.currentTime);
    syncLyrics(audio.currentTime + 0.12);
  }
});

audio.addEventListener('loadedmetadata', () => {
  document.getElementById('totalTime').textContent = formatTime(audio.duration);
});

audio.addEventListener('ended', handleTrackEnd);

audio.addEventListener('play',  updatePlayBtn);
audio.addEventListener('pause', updatePlayBtn);

audio.addEventListener('error', () => {
  showToast('⚠️ Could not load audio file');
  isPlaying = false;
  updatePlayBtn();
});

// Lyrics sync interval
setInterval(() => {
  if (!audio.paused && currentLyrics.length) syncLyrics(audio.currentTime + 0.12);
}, 60);

/* ─── Helpers ─────────────────────────────────────────────────── */
function capitalize(str) { return str ? str.charAt(0).toUpperCase() + str.slice(1) : ''; }

/* ─── Restore Session ─────────────────────────────────────────── */
function restoreSession() {
  const savedUser = localStorage.getItem('swift_user');
  if (!savedUser) return;
  try {
    const user = JSON.parse(savedUser);
    currentUser = user;
    startApp(user);
  } catch {
    localStorage.removeItem('swift_user');
  }
}

restoreSession();

