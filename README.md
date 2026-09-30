# Campusly

Campusly adalah workspace mahasiswa dengan satu frontend canonical dan satu production server.

## Struktur canonical

- `index.html` — satu entrypoint browser
- `campusly-v5.js` — satu runtime frontend
- `campusly-v5.css` — satu stylesheet
- `campusly-production-server.js` — AI gateway dan export DOCX/PDF/PPTX
- `tests/integration.js` — smoke test end-to-end

Tidak ada overlay script, `*-fix.js`, service-worker patch, atau runtime server kedua.

## Fitur inti

Beranda, Jadwal dengan validasi bentrok, Tugas, Kalender, AI chat, catatan, profil, dan export dokumen.

Makalah/PPT memakai prompt formal KBBI/EYD. Chat biasa tetap bersifat percakapan.

DOCX menggunakan Times New Roman, 12 pt, spasi 1,5, margin akademik, dan rata kanan-kiri. PPTX menggunakan layout 16:9, elemen visual, ikon/ilustrasi, dan objek yang tetap dapat diedit setelah dibuka di PowerPoint atau diimpor ke Canva.

## Menjalankan

```bash
npm install
npm start
```

Set `GEMINI_API_KEY` pada environment server untuk AI.

## Pemeriksaan

```bash
npm run check
npm test
```
