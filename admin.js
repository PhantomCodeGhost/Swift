/* ═══════════════════════════════════════════════════════════════
   SWIFT — admin.js
   Premium Redesign · Logic Preserved · Lucide Integrated
═══════════════════════════════════════════════════════════════ */

const SUPABASE_URL = "https://vhmwiarbobluutiumakr.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZobXdpYXJib2JsdXV0aXVtYWtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4NTAxNDUsImV4cCI6MjA4ODQyNjE0NX0.EeL1zlH0aWziPi3O4tDQ-SCPwzUToGVkp8MommHn-0I";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const GRADIENTS = [
  ['#27272a', '#3f3f46'], ['#18181b', '#3f3f46'], ['#3f3f46', '#52525b'],
  ['#000000', '#18181b'], ['#52525b', '#71717a'], ['#1e1e1e', '#333333'],
  ['#4a4a4a', '#27272a'], ['#2c2c2e', '#1c1c1e'], ['#1c1c1e', '#000000'],
  ['#333333', '#1e1e1e'], ['#555555', '#3f3f46'], ['#222222', '#121215'],
];

function getGradient(idx) {
  const [a, b] = GRADIENTS[Math.abs(idx || 0) % GRADIENTS.length];
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

/* ─── Auth ─── */
const _sessionUser = JSON.parse(sessionStorage.getItem('emotune_user') || 'null');
if (!_sessionUser || _sessionUser.role !== 'admin') window.location.href = 'index.html';
document.getElementById('admin-email-display').textContent = _sessionUser?.email || 'admin';

/* ─── UI ─── */
function showToast(msg, dur = 2400) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(window._adminToast);
  window._adminToast = setTimeout(() => t.classList.remove('show'), dur);
}

function openModal(id) { document.getElementById(id).classList.add('active'); if(window.refreshIcons) window.refreshIcons(); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); clearErrors(); }

function clearErrors() { document.querySelectorAll('.error-msg,.success-msg').forEach(el => { el.classList.remove('show'); el.textContent = ''; }); }
function showError(id, msg) { const el = document.getElementById(id); if (el) { el.textContent = msg; el.classList.add('show'); } }
function showSuccess(id, msg) { const el = document.getElementById(id); if (el) { el.textContent = msg; el.classList.add('show'); } }

function onFileSelected(input) {
  const zone = document.getElementById('fileDropZone');
  const nameEl = document.getElementById('fileDropName');
  if (input.files && input.files[0]) {
    zone.classList.add('has-file');
    nameEl.textContent = '✓ ' + input.files[0].name;
    nameEl.style.display = 'block';
  } else {
    zone.classList.remove('has-file');
    nameEl.style.display = 'none';
  }
}

function showPage(page) {
  ['home','songs'].forEach(p => {
    document.getElementById(`page-${p}`).classList.toggle('active', p === page);
    document.getElementById(`nav-${p}`)?.classList.toggle('active', p === page);
  });
  const meta = { home:['Dashboard','System overview'], songs:['Library','Manage tracks'] }[page];
  document.getElementById('topbar-title').textContent = meta[0];
  document.getElementById('topbar-sub').textContent = meta[1];
  if (page === 'songs') loadSongs();
  if(window.refreshIcons) window.refreshIcons();
}

/* ─── Metadata ─── */
function decodeText(bytes) {
  const encoding = bytes[0];
  const textBytes = bytes.slice(1);
  return new TextDecoder(encoding === 1 || encoding === 2 ? 'utf-16' : 'utf-8').decode(textBytes).replace(/\0/g, '');
}

async function readMP3Metadata(file) {
  let title = file.name.replace('.mp3', ''), artist = 'Unknown', picture = null, lyrics = '';
  try {
    const buffer = await file.arrayBuffer(), view = new DataView(buffer);
    if (view.getUint8(0) !== 0x49 || view.getUint8(1) !== 0x44 || view.getUint8(2) !== 0x33) return { title, artist, picture, lyrics };
    const size = (view.getUint8(6) << 21) | (view.getUint8(7) << 14) | (view.getUint8(8) << 7) | view.getUint8(9);
    let offset = 10;
    while (offset + 10 < size) {
      const frameID = String.fromCharCode(view.getUint8(offset), view.getUint8(offset+1), view.getUint8(offset+2), view.getUint8(offset+3));
      const frameSize = (view.getUint8(offset+4) << 24) | (view.getUint8(offset+5) << 16) | (view.getUint8(offset+6) << 8) | view.getUint8(offset+7);
      if (frameSize <= 0) break;
      const bytes = new Uint8Array(buffer.slice(offset + 10, offset + 10 + frameSize));
      if (frameID === 'TIT2') title = decodeText(bytes);
      if (frameID === 'TPE1') artist = decodeText(bytes);
      if (frameID === 'APIC') {
        let pos = offset + 11;
        while (view.getUint8(pos) !== 0) pos++; pos++; pos++;
        const imgBytes = new Uint8Array(buffer.slice(pos, offset + 10 + frameSize));
        picture = new Blob([imgBytes], { type: 'image/jpeg' });
      }
      offset += frameSize + 10;
    }
  } catch (e) {}
  return { title, artist, picture, lyrics };
}

/* ─── Data ─── */
async function loadStats() {
  const { data } = await supabaseClient.from('songs').select('mood');
  const s = data || [];
  document.getElementById('stat-total').textContent = s.length;
  ['happy','sad','chill','energetic','romantic','focus'].forEach(m => {
    document.getElementById(`stat-${m}`).textContent = s.filter(x => x.mood === m).length;
  });
}

async function loadRecentGrid() {
  const grid = document.getElementById('recent-grid');
  const { data } = await supabaseClient.from('songs').select('*').order('created_at', { ascending: false }).limit(12);
  const songs = data || [];
  document.getElementById('recent-count').textContent = songs.length + ' tracks';
  grid.innerHTML = songs.map((s, i) => `
    <div class="recent-card">
      <div class="recent-card-art">
        ${s.cover_url ? `<img src="${escHtml(s.cover_url)}" onerror="this.style.display='none';this.nextSibling.style.display='flex'">` : ''}
        <div class="recent-card-grad" style="background:${getGradient(i)}"><span class="grad-letter">${(s.title||'?')[0].toUpperCase()}</span></div>
      </div>
      <div class="recent-card-info">
        <div class="recent-card-title">${escHtml(s.title)}</div>
        <div class="recent-card-artist">${escHtml(s.artist)}</div>
        <span class="mood-chip">${escHtml(s.mood)}</span>
      </div>
    </div>
  `).join('') || '<p class="empty-state">No tracks</p>';
}

async function loadSongs() {
  const container = document.getElementById('songs-admin-container');
  const { data } = await supabaseClient.from('songs').select('*').order('created_at', { ascending: false });
  const songs = data || [];
  document.getElementById('songs-count').textContent = songs.length + ' total';
  container.innerHTML = songs.map((s, i) => `
    <div class="song-row" style="animation-delay:${i*0.02}s">
      <div class="song-row-cover-grad" style="background:${getGradient(i)}"><span class="row-grad-letter">${(s.title||'?')[0].toUpperCase()}</span></div>
      <div class="song-row-info"><div class="song-row-title">${escHtml(s.title)}</div><div class="song-row-artist">${escHtml(s.artist)}</div></div>
      <div class="song-row-mood">${escHtml(s.mood)}</div>
      <button class="btn btn-danger btn-sm" onclick="openDelete('${s.id}')"><i data-lucide="trash-2" style="width:14px;height:14px"></i></button>
    </div>
  `).join('') || '<p class="empty-state">Library empty</p>';
  if(window.refreshIcons) window.refreshIcons();
}

async function addSong() {
  clearErrors();
  const mood = document.getElementById('add-mood').value, file = document.getElementById('add-file').files[0];
  if (!mood || !file) return showError('add-error', 'Mood and File are required');
  const btn = document.getElementById('add-submit-btn');
  btn.disabled = true; btn.textContent = 'Syncing...';
  try {
    const meta = await readMP3Metadata(file);
    let coverUrl = '';
    if (meta.picture) {
      const cName = `covers/${Date.now()}.jpg`;
      await supabaseClient.storage.from('songs').upload(cName, meta.picture);
      coverUrl = supabaseClient.storage.from('songs').getPublicUrl(cName).data.publicUrl;
    }
    const fName = `${Date.now()}_${file.name}`;
    await supabaseClient.storage.from('songs').upload(fName, file);
    const fileUrl = supabaseClient.storage.from('songs').getPublicUrl(fName).data.publicUrl;
    await supabaseClient.from('songs').insert([{ title:meta.title, artist:meta.artist, mood, cover_url:coverUrl, file_url:fileUrl }]);
    showToast('✅ Track added');
    closeModal('add-song-modal');
    loadStats(); loadRecentGrid();
  } catch (e) { showError('add-error', 'Sync failed'); }
  btn.disabled = false; btn.textContent = 'Push to Library';
}

function openDelete(id) { document.getElementById('delete-id').value = id; openModal('delete-modal'); }
async function confirmDelete() {
  const id = document.getElementById('delete-id').value;
  await supabaseClient.from('songs').delete().eq('id', id);
  closeModal('delete-modal'); showToast('🗑️ Track wiped');
  loadStats(); loadRecentGrid(); if(document.getElementById('page-songs').classList.contains('active')) loadSongs();
}

function adminLogout() { sessionStorage.removeItem('emotune_user'); window.location.href = 'index.html'; }
function escHtml(str) { return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

/* Close modals on click outside (overlay) */
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) {
      overlay.classList.remove('active');
      clearErrors();
    }
  });
});

loadStats(); loadRecentGrid();
if(window.refreshIcons) window.refreshIcons();
