import { CampuslyStore } from './campusly-store.js?v=20261002-mobile1';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

function preview(document) {
  if (document.kind === 'ppt') return `<div class="doc-preview-slides">${(document.content?.slides || []).map((slide, index) => `<article class="card"><small>Slide ${index + 1}</small><h3>${esc(slide.title)}</h3><ul>${(slide.bullets || []).map(item => `<li>${esc(item)}</li>`).join('')}</ul></article>`).join('')}</div>`;
  const paper = document.content || {};
  return `<article class="card doc-preview-paper"><h2>${esc(paper.title || document.title)}</h2>${paper.abstract ? `<p>${esc(paper.abstract)}</p>` : ''}${(paper.chapters || []).map(chapter => `<h3>BAB ${esc(chapter.number)} ${esc(chapter.title)}</h3>${(chapter.sections || []).map(section => `${section.title ? `<h4>${esc(section.title)}</h4>` : ''}${(section.paragraphs || []).map(paragraph => `<p>${esc(paragraph)}</p>`).join('')}`).join('')}`).join('')}</article>`;
}

function dialog(root, title, body, action, label) {
  root.querySelector('.doc-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'overlay doc-overlay';
  overlay.innerHTML = `<div class="modal"><header><h2>${esc(title)}</h2><button type="button" class="icon-btn" data-close aria-label="Tutup">×</button></header><div class="modal-body">${body}</div><footer><button type="button" class="btn" data-cancel>Batal</button><button type="button" class="btn primary" data-action>${esc(label)}</button></footer></div>`;
  root.append(overlay);
  overlay.querySelectorAll('[data-close],[data-cancel]').forEach(button => button.addEventListener('click', () => overlay.remove()));
  overlay.querySelector('[data-action]').addEventListener('click', async event => {
    event.currentTarget.disabled = true;
    try { await action(overlay); overlay.remove(); }
    catch (error) { const message = overlay.querySelector('[data-dialog-error]'); if (message) message.textContent = error.message; event.currentTarget.disabled = false; }
  });
  return overlay;
}

async function exportBlob(document, format = 'default') {
  const endpoint = document.kind === 'ppt' ? '/api/export/pptx' : format === 'pdf' ? '/api/export/pdf' : '/api/export/docx';
  const response = await fetch(endpoint, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ document: document.content }) });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const requestId = data.requestId || response.headers.get('X-Request-ID');
    throw new Error(`${data.error || 'Dokumen belum bisa diekspor.'}${requestId ? ` (ID ${requestId})` : ''}`);
  }
  return response.blob();
}

function download(blob, name) {
  if (!blob.size) throw new Error('File hasil ekspor kosong.');
  const url = URL.createObjectURL(blob), anchor = document.createElement('a');
  anchor.href = url; anchor.download = name; anchor.rel = 'noopener';
  document.body.append(anchor); anchor.click();
  setTimeout(() => { anchor.remove(); URL.revokeObjectURL(url); }, 60000);
}

export async function mountDocumentLibrary(root, toast = () => {}) {
  const list = root.querySelector('#docs-list');
  if (!list) return;
  list.innerHTML = '<p class="muted" role="status">Memuat dokumen…</p>';
  let documents;
  try { documents = await CampuslyStore.listDocuments(); }
  catch (error) { list.innerHTML = `<div class="empty"><b>Dokumen belum bisa dimuat.</b><p>${esc(error.message)}</p><button class="btn" data-retry>Ulangi</button></div>`; list.querySelector('[data-retry]')?.addEventListener('click', () => mountDocumentLibrary(root, toast)); return; }
  documents.sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
  if (!documents.length) {
    list.innerHTML = '<div class="empty"><b>Belum ada dokumen tersimpan.</b><p>Hasil makalah dan PPT yang kamu buat bakal muncul di sini dan bisa diunduh lagi kapan saja.</p></div>';
    return;
  }
  list.innerHTML = documents.map(item => `<article class="card doc-card"><div><small>${item.kind === 'ppt' ? 'PRESENTASI' : 'MAKALAH'} · ${esc(new Date(item.updatedAt || item.createdAt || Date.now()).toLocaleDateString('id-ID'))}</small><h2>${esc(item.title || 'Dokumen Campusly')}</h2></div><div class="doc-actions"><button class="btn" data-doc-action="preview" data-doc-id="${esc(item.id)}">Pratinjau</button><button class="btn" data-doc-action="download" data-doc-id="${esc(item.id)}">Unduh</button>${item.kind === 'paper' ? `<button class="btn" data-doc-action="download-pdf" data-doc-id="${esc(item.id)}">Unduh PDF</button>` : ''}<button class="btn" data-doc-action="share" data-doc-id="${esc(item.id)}">Bagikan</button><button class="btn" data-doc-action="rename" data-doc-id="${esc(item.id)}">Ganti judul</button><button class="btn" data-doc-action="delete" data-doc-id="${esc(item.id)}">Hapus</button></div></article>`).join('');
  list.onclick = async event => {
    const button = event.target.closest('[data-doc-action]');
    if (!button) return;
    const item = documents.find(record => record.id === button.dataset.docId);
    if (!item) return;
    const action = button.dataset.docAction;
    if (action === 'preview') { dialog(root, item.title || 'Pratinjau dokumen', preview(item), async () => {}, 'Tutup'); return; }
    if (action === 'rename') {
      const overlay = dialog(root, 'Ganti judul', `<label class="field"><span>Judul dokumen</span><input name="title" maxlength="120" value="${esc(item.title || '')}"></label><p data-dialog-error class="error-text" aria-live="polite"></p>`, async dialogElement => {
        const title = dialogElement.querySelector('[name=title]').value.trim();
        if (!title) throw new Error('Judul dokumen wajib diisi.');
        await CampuslyStore.putDocument({ ...item, title });
        await mountDocumentLibrary(root, toast);
        toast('Judul dokumen diperbarui.');
      }, 'Simpan');
      overlay.querySelector('[name=title]').focus();
      return;
    }
    if (action === 'delete') {
      dialog(root, 'Hapus dokumen?', `<p>${esc(item.title || 'Dokumen Campusly')} akan dihapus dari perangkat ini.</p><p data-dialog-error class="error-text" aria-live="polite"></p>`, async () => {
        await CampuslyStore.deleteDocument(item.id);
        await mountDocumentLibrary(root, toast);
        toast('Dokumen dihapus.');
      }, 'Hapus');
      return;
    }
    button.disabled = true;
    try {
      const format = action === 'download-pdf' ? 'pdf' : 'default';
      const blob = await exportBlob(item, format);
      const filename = `${String(item.title || 'campusly').replace(/[\\/:*?"<>|]/g, '-').slice(0, 80)}.${format === 'pdf' ? 'pdf' : item.kind === 'ppt' ? 'pptx' : 'docx'}`;
      if (action === 'share') {
        const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
        if (navigator.canShare?.({ files: [file] }) && navigator.share) await navigator.share({ files: [file], title: item.title });
        else { download(blob, filename); toast('Berbagi file belum didukung di browser ini; file diunduh.'); }
      } else download(blob, filename);
    } catch (error) { toast(error.message || 'Ekspor belum berhasil.'); }
    finally { button.disabled = false; }
  };
}
