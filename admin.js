/* ═══════════════════════════════════════════════════════════════
   SWIFT — admin.js
   Original logic preserved · UI polish added
═══════════════════════════════════════════════════════════════ */

const SUPABASE_URL = "https://vhmwiarbobluutiumakr.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZobXdpYXJib2JsdXV0aXVtYWtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4NTAxNDUsImV4cCI6MjA4ODQyNjE0NX0.EeL1zlH0aWziPi3O4tDQ-SCPwzUToGVkp8MommHn-0I";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/* ─── Gradient palette (matches main app) ────────────────────── */
const GRADIENTS = [
  ['#667eea','#764ba2'],['#f093fb','#f5576c'],['#4facfe','#00f2fe'],
  ['#43e97b','#38f9d7'],['#fa709a','#fee140'],['#a18cd1','#fbc2eb'],
  ['#fda085','#f6d365'],['#89f7fe','#66a6ff'],['#d299c2','#fef9d7'],
  ['#00cdac','#8ddad5'],['#a1c4fd','#c2e9fb'],['#ff9a9e','#fecfef'],
  ['#a8edea','#fed6e3'],['#f6d365','#fda085'],['#96fbc4','#f9f586'],
];

function getGradient(idx) {
  const [a, b] = GRADIENTS[Math.abs(idx || 0) % GRADIENTS.length];
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

/* ─── Auth Guard ──────────────────────────────────────────────── */
const _sessionUser = JSON.parse(sessionStorage.getItem('emotune_user') || 'null');
if (!_sessionUser || _sessionUser.role !== 'admin') {
  window.location.href = 'index.html';
}
document.getElementById('admin-email-display').textContent = _sessionUser?.email || 'admin';

/* ─── Toast ───────────────────────────────────────────────────── */
function showToast(msg, dur = 2400) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(window._adminToast);
  window._adminToast = setTimeout(() => t.classList.remove('show'), dur);
}

/* ─── Modals ──────────────────────────────────────────────────── */
function openModal(id)  { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); clearErrors(); }

function clearErrors() {
  document.querySelectorAll('.error-msg,.success-msg').forEach(el => {
    el.classList.remove('show'); el.textContent = '';
  });
}

function showError(id, msg)   { const el = document.getElementById(id); if (el) { el.textContent = msg; el.classList.add('show'); } }
function showSuccess(id, msg) { const el = document.getElementById(id); if (el) { el.textContent = msg; el.classList.add('show'); } }

/* ─── File Drop Zone ──────────────────────────────────────────── */
function onFileSelected(input) {
  const zone = document.getElementById('fileDropZone');
  const nameEl = document.getElementById('fileDropName');
  if (input.files && input.files[0]) {
    const name = input.files[0].name;
    zone.classList.add('has-file');
    nameEl.textContent = '✓ ' + name;
    nameEl.style.display = 'block';
  } else {
    zone.classList.remove('has-file');
    nameEl.style.display = 'none';
  }
}

/* ─── Page Navigation ─────────────────────────────────────────── */
const PAGE_META = {
  home:  { title: 'Dashboard',      sub: 'Overview of your Swift library' },
  songs: { title: 'Songs Library',  sub: 'Manage all tracks in Swift' },
};

function showPage(page) {
  ['home','songs'].forEach(p => {
    document.getElementById(`page-${p}`).classList.toggle('active', p === page);
    document.getElementById(`nav-${p}`)?.classList.toggle('active', p === page);
  });

  const meta = PAGE_META[page] || {};
  document.getElementById('topbar-title').textContent = meta.title || '';
  document.getElementById('topbar-sub').textContent   = meta.sub   || '';

  if (page === 'songs') loadSongs();
}

/* ─── Text Decoder (ID3) ──────────────────────────────────────── */
function decodeText(bytes) {
  const encoding  = bytes[0];
  const textBytes = bytes.slice(1);
  if (encoding === 1 || encoding === 2) {
    return new TextDecoder('utf-16').decode(textBytes).replace(/\0/g, '');
  }
  return new TextDecoder('utf-8').decode(textBytes).replace(/\0/g, '');
}

/* ─── MP3 Metadata Reader ─────────────────────────────────────── */
async function readMP3Metadata(file) {
  let title   = file.name.replace('.mp3', '');
  let artist  = 'Unknown';
  let picture = null;
  let lyrics  = '';

  try {
    const buffer = await file.arrayBuffer();
    const view   = new DataView(buffer);

    // Must start with ID3
    if (view.getUint8(0) !== 0x49 || view.getUint8(1) !== 0x44 || view.getUint8(2) !== 0x33) {
      return { title, artist, picture, lyrics };
    }

    const size =
      (view.getUint8(6) << 21) | (view.getUint8(7) << 14) |
      (view.getUint8(8) << 7)  |  view.getUint8(9);

    let offset = 10;

    while (offset + 10 < size) {
      const frameID =
        String.fromCharCode(view.getUint8(offset), view.getUint8(offset+1),
                            view.getUint8(offset+2), view.getUint8(offset+3));

      const frameSize =
        (view.getUint8(offset+4) << 24) | (view.getUint8(offset+5) << 16) |
        (view.getUint8(offset+6) <<  8) |  view.getUint8(offset+7);

      if (frameSize <= 0) break;

      const frameStart = offset + 10;
      const frameEnd   = frameStart + frameSize;
      const bytes      = new Uint8Array(buffer.slice(frameStart, frameEnd));

      if (frameID === 'TIT2') title  = decodeText(bytes);
      if (frameID === 'TPE1') artist = decodeText(bytes);

      if (frameID === 'APIC') {
        let pos = frameStart;
        const encoding = view.getUint8(pos++);
        let mime = '';
        while (view.getUint8(pos) !== 0) { mime += String.fromCharCode(view.getUint8(pos)); pos++; }
        pos++; // null
        pos++; // picture type
        if (encoding === 1 || encoding === 2) {
          while (!(view.getUint8(pos) === 0 && view.getUint8(pos+1) === 0)) pos++;
          pos += 2;
        } else {
          while (view.getUint8(pos) !== 0) pos++;
          pos++;
        }
        const imgBytes = new Uint8Array(buffer.slice(pos, frameEnd));
        picture = new Blob([imgBytes], { type: mime || 'image/jpeg' });
      }

      if (frameID === 'USLT') {
        let pos = 0;
        const encoding = bytes[pos]; pos += 1;
        pos += 3; // language
        if (encoding === 1 || encoding === 2) {
          while (!(bytes[pos] === 0 && bytes[pos+1] === 0)) pos++;
          pos += 2;
        } else {
          while (bytes[pos] !== 0) pos++;
          pos += 1;
        }
        const lyricBytes = bytes.slice(pos);
        lyrics = (encoding === 1 || encoding === 2)
          ? new TextDecoder('utf-16').decode(lyricBytes)
          : new TextDecoder('utf-8').decode(lyricBytes);
        lyrics = lyrics.replace(/\0/g, '').trim();
      }

      offset += frameSize + 10;
    }
  } catch (e) {
    console.warn('Metadata read failed:', e);
  }

  return { title, artist, picture, lyrics };
}

/* ─── Set Progress Bar ────────────────────────────────────────── */
function setProgress(label, pct) {
  document.getElementById('upload-label').textContent = label;
  document.getElementById('upload-pct').textContent   = pct + '%';
  document.getElementById('upload-bar').style.width   = pct + '%';
  document.getElementById('upload-progress').classList.toggle('visible', pct > 0 && pct < 100);
}

/* ─── Load Stats ──────────────────────────────────────────────── */
async function loadStats() {
  try {
    const { data } = await supabaseClient.from('songs').select('mood');
    const songs = data || [];

    document.getElementById('stat-total').textContent    = songs.length;
    document.getElementById('stat-happy').textContent    = songs.filter(s => s.mood === 'happy').length;
    document.getElementById('stat-sad').textContent      = songs.filter(s => s.mood === 'sad').length;
    document.getElementById('stat-chill').textContent    = songs.filter(s => s.mood === 'chill').length;
    document.getElementById('stat-energetic').textContent= songs.filter(s => s.mood === 'energetic').length;
    document.getElementById('stat-romantic').textContent = songs.filter(s => s.mood === 'romantic').length;
    document.getElementById('stat-focus').textContent    = songs.filter(s => s.mood === 'focus').length;
  } catch (e) {
    console.error('loadStats error:', e);
  }
}

/* ─── Load Recent Grid (Dashboard) ───────────────────────────── */
async function loadRecentGrid() {
  const grid = document.getElementById('recent-grid');
  grid.innerHTML = '<div class="spinner"></div>';

  try {
    const { data } = await supabaseClient.from('songs').select('*')
      .order('created_at', { ascending: false }).limit(12);

    const songs = data || [];
    document.getElementById('recent-count').textContent = songs.length + ' songs';

    if (!songs.length) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state-icon">🎵</div>
        <div class="empty-state-title">No songs yet</div>
        <div class="empty-state-desc">Click "Add Song" to upload your first track</div>
      </div>`;
      return;
    }

    grid.innerHTML = '';
    songs.forEach((song, i) => {
      const card = document.createElement('div');
      card.className = 'recent-card';
      const hasCover = song.cover_url && song.cover_url.startsWith('http');

      card.innerHTML = `
        <div class="recent-card-art">
          ${hasCover
            ? `<img src="${escHtml(song.cover_url)}" alt="" onerror="this.style.display='none';this.nextSibling.style.display='flex'">`
            : ''}
          <div class="recent-card-grad" style="${hasCover ? 'display:none;' : ''}background:${getGradient(i)}">
            <span class="grad-letter">${(song.title || '?')[0].toUpperCase()}</span>
          </div>
        </div>
        <div class="recent-card-info">
          <div class="recent-card-title">${escHtml(song.title || 'Unknown')}</div>
          <div class="recent-card-artist">${escHtml(song.artist || '—')}</div>
          <span class="mood-chip">${escHtml(song.mood || '')}</span>
        </div>`;
      grid.appendChild(card);
    });
  } catch (e) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-title">Could not load songs</div></div>';
    console.error('loadRecentGrid error:', e);
  }
}

/* ─── Load Songs List ─────────────────────────────────────────── */
async function loadSongs() {
  const container = document.getElementById('songs-admin-container');
  container.innerHTML = '<div class="spinner"></div>';

  try {
    const { data } = await supabaseClient.from('songs').select('*')
      .order('created_at', { ascending: false });

    const songs = data || [];
    document.getElementById('songs-count').textContent = songs.length + ' songs';

    if (!songs.length) {
      container.innerHTML = `<div class="empty-state">
        <div class="empty-state-icon">🎵</div>
        <div class="empty-state-title">No songs yet</div>
        <div class="empty-state-desc">Add your first track using the button above</div>
      </div>`;
      return;
    }

    container.innerHTML = '';
    songs.forEach((song, i) => {
      const row = document.createElement('div');
      row.className = 'song-row';
      row.style.animationDelay = `${i * 0.03}s`;

      const hasCover = song.cover_url && song.cover_url.startsWith('http');

      row.innerHTML = `
        ${hasCover
          ? `<img class="song-row-cover" src="${escHtml(song.cover_url)}" alt=""
               onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
          : ''}
        <div class="song-row-cover-grad" style="${hasCover ? 'display:none;' : ''}background:${getGradient(i)}">
          <span class="row-grad-letter">${(song.title || '?')[0].toUpperCase()}</span>
        </div>
        <div class="song-row-info">
          <div class="song-row-title">${escHtml(song.title || 'Unknown')}</div>
          <div class="song-row-artist">${escHtml(song.artist || '—')}</div>
        </div>
        <div class="song-row-mood">${escHtml(song.mood || '')}</div>
        <button class="btn btn-danger btn-sm" onclick="openDelete('${song.id}')">
          Delete
        </button>`;

      container.appendChild(row);
    });
  } catch (e) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-title">Failed to load songs</div></div>';
    console.error('loadSongs error:', e);
  }
}

/* ─── Add Song ────────────────────────────────────────────────── */
async function addSong() {
  clearErrors();

  const mood    = document.getElementById('add-mood').value;
  const mp3File = document.getElementById('add-file').files[0];

  if (!mood)    { showError('add-error', 'Please select a mood.'); return; }
  if (!mp3File) { showError('add-error', 'Please select an MP3 file.'); return; }

  const btn     = document.getElementById('add-submit-btn');
  btn.disabled  = true;
  btn.textContent = 'Uploading…';

  try {
    // 1. Extract metadata
    setProgress('Reading metadata…', 10);
    const metadata = await readMP3Metadata(mp3File);
    const { title, artist, lyrics } = metadata;

    // 2. Upload cover (if extracted)
    let coverUrl = '';
    if (metadata.picture) {
      setProgress('Uploading cover art…', 30);
      const coverFile = new File([metadata.picture], `cover_${Date.now()}.jpg`, { type: 'image/jpeg' });
      const coverPath = `covers/${coverFile.name}`;

      const { error: coverErr } = await supabaseClient.storage
        .from('songs').upload(coverPath, coverFile, { contentType: 'image/jpeg', upsert: false });

      if (!coverErr) {
        const { data: urlData } = supabaseClient.storage.from('songs').getPublicUrl(coverPath);
        coverUrl = urlData.publicUrl;
      }
    }

    // 3. Upload MP3
    setProgress('Uploading audio…', 60);
    const mp3Path = `${Date.now()}_${mp3File.name}`;
    const { error: mp3Err } = await supabaseClient.storage.from('songs').upload(mp3Path, mp3File);
    if (mp3Err) throw mp3Err;

    const { data: mp3Data } = supabaseClient.storage.from('songs').getPublicUrl(mp3Path);
    const fileUrl = mp3Data.publicUrl;

    // 4. Insert record
    setProgress('Saving to library…', 85);
    const { error: insertErr } = await supabaseClient.from('songs').insert([{
      title, artist, mood, lyrics, cover_url: coverUrl, file_url: fileUrl
    }]);
    if (insertErr) throw insertErr;

    setProgress('Done!', 100);
    showSuccess('add-success', `"${title}" uploaded successfully!`);
    showToast(`✅ "${title}" added to library`);

    // Reset form
    document.getElementById('add-mood').value = '';
    document.getElementById('add-file').value = '';
    document.getElementById('fileDropZone').classList.remove('has-file');
    document.getElementById('fileDropName').style.display = 'none';

    setTimeout(() => {
      closeModal('add-song-modal');
      setProgress('', 0);
      loadStats();
      loadRecentGrid();
      if (document.getElementById('page-songs').classList.contains('active')) loadSongs();
    }, 1200);

  } catch (err) {
    console.error('addSong error:', err);
    showError('add-error', err.message || 'Upload failed. Please try again.');
    setProgress('', 0);
  }

  btn.disabled = false;
  btn.textContent = 'Upload & Add Song';
}

/* ─── Delete ──────────────────────────────────────────────────── */
function openDelete(id) {
  document.getElementById('delete-id').value = id;
  openModal('delete-modal');
}

async function confirmDelete() {
  const id = document.getElementById('delete-id').value;
  try {
    await supabaseClient.from('songs').delete().eq('id', id);
    closeModal('delete-modal');
    showToast('🗑️ Song deleted');
    loadStats();
    loadRecentGrid();
    if (document.getElementById('page-songs').classList.contains('active')) loadSongs();
  } catch (e) {
    console.error('Delete error:', e);
    showToast('⚠️ Delete failed');
    closeModal('delete-modal');
  }
}

/* ─── Navigation ──────────────────────────────────────────────── */
function backToApp() {
  // Keeps sessionStorage.emotune_user intact so admin can return directly
  window.location.href = 'index.html';
}

/* ─── Logout ──────────────────────────────────────────────────── */
function adminLogout() {
  sessionStorage.removeItem('emotune_user');
  window.location.href = 'index.html';
}

/* ─── Escape HTML ─────────────────────────────────────────────── */
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ─── Init ────────────────────────────────────────────────────── */
loadStats();
loadRecentGrid();
