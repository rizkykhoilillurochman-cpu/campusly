/* Campusly — Developer & Contact panel */
(function () {
  const DEV = {
    name: 'Rizky Khoilillu Rochman',
    email: 'rizkykhoilillurochman@gmail.com',
    instagram: 'therealramanih_'
  };

  function developerCard() {
    return `<div class="card developer-card" style="grid-column:1/-1">
      <div class="card-head">
        <div>
          <div class="stat-label">ABOUT CAMPUSLY</div>
          <h2 style="margin:.2rem 0 0">Developer & Contact</h2>
        </div>
        <span class="pill">v1.0</span>
      </div>
      <div class="developer-profile" style="display:flex;gap:14px;align-items:center;margin:16px 0">
        <div class="avatar" style="width:54px;height:54px;flex:0 0 54px">R</div>
        <div>
          <div class="row-title">${DEV.name}</div>
          <div class="row-meta">Developer · Campusly</div>
        </div>
      </div>
      <div class="developer-links" style="display:grid;gap:10px">
        <a class="btn" href="mailto:${DEV.email}">✉️ ${DEV.email}</a>
        <a class="btn" href="https://instagram.com/${DEV.instagram}" target="_blank" rel="noopener noreferrer">◎ Instagram · @${DEV.instagram}</a>
      </div>
      <p class="muted" style="margin:14px 0 0">Kalau nemu bug, punya ide fitur, atau mau ngasih feedback, langsung kontak aja.</p>
    </div>`;
  }

  window.settings = function () {
    const p = state.profile;
    return `${header('ACCOUNT','Settings','Profil, target akademik, data lokal, dan info developer.')}
      <div class="grid two">
        <div class="card">
          <h2>Profil</h2>
          <form class="form" onsubmit="saveSettings(event)">
            <div class="field"><label>Nama</label><input name="name" value="${esc(p.name)}"></div>
            <div class="field"><label>Nama panggilan</label><input name="preferredName" value="${esc(p.preferredName)}"></div>
            <div class="field"><label>Universitas</label><input name="university" value="${esc(p.university)}"></div>
            <div class="field"><label>Jurusan</label><input name="major" value="${esc(p.major)}"></div>
            <div class="field"><label>Semester</label><input name="semester" type="number" min="1" value="${p.semester||1}"></div>
            <div class="field"><label>GPA</label><input name="gpa" type="number" step=".01" min="0" max="4" value="${p.gpa||''}"></div>
            <div class="field"><label>Target GPA</label><input name="targetGpa" type="number" step=".01" min="0" max="4" value="${p.targetGpa||3.75}"></div>
            <button class="btn primary">Simpan</button>
          </form>
        </div>
        <div class="card">
          <h2>Data</h2>
          <p class="muted">Data aplikasi saat ini tersimpan lokal di browser.</p>
          <div class="actions"><button class="btn" onclick="exportData()">Export JSON</button><button class="btn danger" onclick="resetData()">Reset data</button></div>
        </div>
        ${developerCard()}
      </div>`;
  };

  // Make the developer/contact info visible from the mobile Menu too.
  window.menu = function () {
    return `${header('NAVIGATION','Menu','Semua fitur tetap tersedia di HP—tidak ada fitur yang disembunyikan.')}
      <div class="menu-sheet">${FEATURES.filter(x=>!['home','tasks','schedule','ai'].includes(x[0])).map(([r,l,d])=>`<button class="menu-item" onclick="go('${r}')"><b>${ICON[r]} ${l}</b><span>${d}</span></button>`).join('')}</div>
      ${developerCard()}`;
  };

  // app.js renders once before this file loads; render again after the overrides.
  if (typeof window.render === 'function') window.render();
})();
