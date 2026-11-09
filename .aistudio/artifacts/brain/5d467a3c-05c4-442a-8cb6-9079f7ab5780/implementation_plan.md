# Sistem Manajemen Siklus Media Digital (Quotation – Deal – Media Order – Bukti Tayang – Invoice)

Platform operasional dan keuangan terpadu untuk perusahaan media digital yang menghubungkan seluruh rantai transaksi mulai dari penawaran harga (Quotation), manajemen kuota kontrak (Deal), penjadwalan penayangan (Media Order), verifikasi performa tayang (Bukti Tayang), hingga penagihan dan rekonsiliasi pembayaran (Invoice) dengan dokumen PDF berformat A4 Landscape.

## User Review & Critical Decisions

> [!IMPORTANT]
> Keputusan arsitektur dan aturan bisnis berikut telah dikonfirmasi berdasarkan preferensi Anda pada tahap klarifikasi awal dan akan menjadi acuan utama pembangunan sistem:

- **Cakupan Fitur (Fase 1 & Fase 2 Lengkap)**: Mencakup alur inti dari Quotation hingga Invoice, dilengkapi dengan sistem persetujuan berjenjang (Approval), revisi versi dokumen, addendum kontrak/MO, pencatatan pembayaran bertahap, pemantauan umur piutang (aging schedule), pajak lengkap (PPN 11%, PPh 23, Meterai, No. Faktur Pajak), serta Laporan Progres Deal dan ekspor CSV.
- **Penyimpanan Data VPS-Ready (SQLite Lokal)**: Menggunakan database relasional SQLite di sisi server yang persisten dalam satu file terstruktur dengan dukungan transaksi penuh (ACID), memudahkan deployment langsung di VPS tanpa ketergantungan layanan database eksternal.
- **Aturan Persetujuan Diskon Ketat**: Setiap Quotation yang mencantumkan diskon (berapapun persentasenya, baik diskon per baris item maupun diskon total) secara otomatis berstatus *Menunggu Persetujuan* dan wajib disetujui oleh Manager sebelum dapat dikirim ke klien atau ditandai sebagai Deal.
- **Format Penomoran Dokumen Tahunan**: Seluruh dokumen (`QT`, `DL`, `MO`, `BT`, `INV`) menggunakan format `KODE/TAHUN/BULAN/URUT` (contoh: `QT/2026/11/0001`) dengan nomor urut yang dijamin unik tanpa celah dan di-reset kembali ke `0001` setiap pergantian tahun baru.

---

## 1. Overview & Core Concept

- **What It Does**: Mengelola siklus hidup kampanye iklan media digital dalam satu rantai data terintegrasi. Data yang dimasukkan pada Quotation mengalir otomatis membentuk kuota Paket Deal, dipecah menjadi satu atau banyak Media Order (MO) beserta jadwal tayangnya, diverifikasi melalui Bukti Tayang, dan ditagihkan melalui Invoice sesuai skema tagih Deal (per MO, termin Deal, atau sekali tagih).
- **Target Audience / Persona**:
  - **Super Admin & Admin**: Mengelola pengguna, matriks izin, konfigurasi perusahaan, katalog rate card berversi, dan operasional harian lintas tim.
  - **Direktur & Manager**: Memantau performa pendapatan dan pipeline eksekutif, menyetujui Quotation berdiskon atau MO Bonus, serta memverifikasi Bukti Tayang.
  - **Sales**: Mengelola klien milik sendiri, menyusun Quotation dan revisinya, melakukan follow-up, menandai Deal/Lost, serta memantau progres penayangan kliennya.
  - **Marketing**: Mengeksekusi kuota Deal menjadi Media Order, menyusun kalender jadwal tayang, serta mengunggah screenshot dan metrik kinerja pada Bukti Tayang.
  - **Finance**: Menerbitkan Invoice berdasarkan skema tagih dan syarat kelayakan tayang, mengelola faktur pajak, mencatat pembayaran masuk, dan memantau piutang jatuh tempo.
- **Key Value**: Menghilangkan duplikasi input antar divisi, mencegah penayangan melebihi kuota kontrak secara otomatis (karena progres dihitung langsung dari realisasi item Media Order), mengamankan dokumen final dari perubahan tanpa jejak, dan menyajikan transparansi audit log di setiap perubahan status maupun nilai.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Autentikasi JWT & Simulasi Role Cepat**: Pengguna masuk menggunakan email dan kata sandi (diverifikasi dengan token JWT yang aman). Untuk memudahkan pengujian di VPS, halaman login dan profil juga menyediakan daftar akun peraga untuk ke-7 role.
  2. **Dashboard Kontekstual Berbasis Peran**: Setelah login, pengguna melihat ringkasan KPI, grafik visualisasi interaktif (pipeline konversi, pendapatan bulanan, umur piutang, dan realisasi kuota), serta daftar antrean tugas (dokumen yang menunggu persetujuan Manager, jadwal tayang hari ini, atau invoice jatuh tempo).
  3. **Siklus Quotation ke Deal**: Sales memilih klien dan item dari Rate Card/Paket, mengatur kuantitas dan diskon. Jika terdapat diskon, Quotation masuk ke antrean *Menunggu Persetujuan* Manager. Jika ada perubahan harga atau negosiasi, Sales dapat membuat *Revisi* baru (`Rev.1`, `Rev.2`) tanpa menghapus histori versi sebelumnya. Saat klien setuju, Sales menekan **Tandai Deal** yang otomatis membangkitkan **Paket Deal** beserta kuota per baris item.
  4. **Pusat Kendali Detail Deal**: Halaman Detail Deal menjadi hub utama yang menampilkan bilah progres kuota secara real-time (*Dibeli = Sudah Tayang + Terjadwal + Belum Dijadwalkan*), daftar Media Order aktif, ringkasan nilai tertagih vs terbayar, garis waktu dokumen terkait, serta tombol aksi cepat **Buat MO**, **Buat Invoice**, dan **Cetak Laporan Progres**.
  5. **Eksekusi Media Order & Bukti Tayang**: Marketing membuat MO Reguler (memotong sisa kuota Deal) atau MO Bonus (tanpa memotong kuota, wajib persetujuan Manager), mengisi jadwal tayang per item, dan memantau indikasi bentrok slot inventori. Setelah tayang, Marketing membuat Bukti Tayang per MO dengan tautan live, screenshot/foto, serta metrik target vs realisasi (impresi, klik, CTR, views). Saat Manager/Admin memverifikasi Bukti Tayang, status item otomatis menjadi *Tayang Terverifikasi* dan memperbarui persentase progres Deal.
  6. **Penagihan & Pembayaran (Finance)**: Finance membuat Invoice dari Deal (baik per MO, termin persentase, maupun sekali tagih), menghitung otomatis PPN 11%, potongan PPh 23 opsional, dan meterai, lalu mencatat pembayaran bertahap atau lunas beserta nomor faktur pajak.
  7. **Cetak & Pratinjau PDF A4 Landscape**: Setiap dokumen (Quotation, Media Order, Bukti Tayang, Invoice, dan Laporan Progres Deal) memiliki pratinjau dokumen presisi berukuran A4 Landscape dengan kop perusahaan, kode referensi silang antar dokumen, watermark otomatis (*DRAFT* atau *BATAL*), blok tanda tangan yang utuh, serta tombol cetak/unduh PDF.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Minimalis, bersih, dan berorientasi data (*Enterprise Editorial Workspace*). Mengutamakan kejelasan hierarki informasi, kepadatan tabel yang terukur, dan ketenangan visual tanpa dekorasi berlebihan.
  - *Color Palette & Mood*: Mengikuti aturan distribusi 60-30-10:
    - **60% Canvas Netral**: Putih bersih (`#FFFFFF`) dan abu-abu sejuk lembut (`#F8FAFC`) untuk area kerja utama yang terang dan nyaman dibaca.
    - **30% Struktur & Permukaan**: Slate gelap (`#0F172A`) untuk sidebar navigasi dan teks utama, serta garis batas tipis 1px (`#E2E8F0`) untuk memisahkan kartu dan tabel tanpa tumpukan bayangan berat.
    - **10% Aksen Fungsional & Semantik**: Biru Royal tajam (`#2563EB`) khusus untuk aksi utama dan navigasi aktif; Hijau Emerald (`#16A34A`) untuk status selesai/terverifikasi/lunas; Amber (`#D97706`) untuk antrean persetujuan/mendekati tenggat; Merah Crimson (`#DC2626`) untuk status jatuh tempo/batal/bentrok jadwal. Setiap status warna selalu didampingi teks label yang eksplisit.
  - *Typography & Hierarchy*:
    - **Display & Navigasi**: `Plus Jakarta Sans` (SemiBold/Bold) untuk judul halaman, header kartu, dan navigasi yang tegas.
    - **Body & Form**: `Plus Jakarta Sans` (Regular/Medium, 13px–15px) untuk keterbacaan optimal pada form dan tabel padat.
    - **Angka, Nominal Rupiah, Nomor Dokumen & Waktu**: `JetBrains Mono` dengan `font-variant-numeric: tabular-nums` agar seluruh kolom nominal Rupiah, persentase progres, kode nomor dokumen, dan timestamp audit log sejajar secara vertikal.
  - *Component Styling & Layout*:
    - **Workspace Canvas**: Sidebar navigasi kiri berukuran tetap (`260px`) yang menampilkan menu sesuai izin role aktif + Header atas satu baris (kontrak 3 zona: Breadcrumb kontekstual di kiri, indikator role/tim di tengah, dan aksi utama/profil di kanan) + Area konten utama responsif.
    - **Single-Elevation Depth**: Permukaan datar dengan batas garis 1px (`border-slate-200`), tanpa kartu bersarang di dalam kartu (*no cards within cards*) dan tanpa garis aksen tebal di sisi kiri.
    - **Zero-Pill Metadata Discipline**: Informasi metadata statis (tanggal, kategori, nama pemilik, referensi dokumen) ditampilkan sebagai teks bersih dengan pemisah tipografis (`·` atau `/`), sementara tombol filter interaktif menggunakan *segmented control* yang rapi.
    - **High-Density Data Grids**: Tinggi baris tabel yang ringkas (`40px`), perataan kiri untuk teks dan perataan kanan untuk angka nominal/kuantitas.

- **Interactive Feedback & Motion**:
  - Transisi antar tab, modal, dan drawer berlangsung cepat ($\le 150\text{ms}$) menggunakan properti `opacity` dan `transform`.
  - Setiap tampilan daftar mendukung status lengkap: tampilan data terisi, tampilan kosong (*empty state*) dengan tombol aksi langsung, indikator pemuatan (*skeleton*), serta pencarian dan pemfilteran langsung.
  - Umpan balik aksi (simpan, setujui, verifikasi, catat bayar, kunci dokumen) ditampilkan melalui notifikasi toast yang jelas dan pembaruan instan pada indikator progres.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Perhitungan Progres Deal Secara Turunan (Derived State) dari Item MO**
  - *Chosen Approach*: Tidak menyimpan angka progres Deal sebagai kolom statis yang diubah manual, melainkan menghitungnya secara langsung melalui kueri agregasi dari tabel `mo_items` yang berelasi dengan `deal_items`.
  - *Why*: Menjamin konsistensi 100% di seluruh layar (Dashboard, Detail Deal, Media Order, hingga Laporan Progres). Saat item MO dibatalkan atau dijadwalkan ulang, sisa kuota Deal otomatis kembali akurat tanpa risiko selisih sinkronisasi.
  - *Alternatives Considered*: Menyimpan counter manual di tabel Deal, yang rawan menghasilkan ketidakcocokan angka ketika terjadi pembatalan parsial atau addendum MO.

- **Decision 2: Database SQLite Server-Side dengan Snapshot Data Dokumen**
  - *Chosen Approach*: Menggunakan SQLite di sisi server Express dengan mekanisme penyalinan (*snapshot*) harga produk, nama klien, NPWP, dan alamat tagih ke dalam baris dokumen saat Quotation, Deal, dan Invoice diterbitkan.
  - *Why*: Memenuhi kebutuhan eksekusi mandiri di VPS dengan performa baca/tulis cepat dan integritas relasional penuh, sekaligus memastikan dokumen historis dan cetakan PDF lama tidak pernah berubah meskipun master Rate Card atau profil klien diperbarui di kemudian hari.
  - *Alternatives Considered*: Mengambil harga secara dinamis lewat join ke tabel master produk pada saat render PDF, yang akan merusak histori nilai kontrak lama saat harga katalog naik.

- **Decision 3: Matriks Hak Akses (RBAC) & Kepemilikan Data Berbasis Database**
  - *Chosen Approach*: Menyimpan izin (`permissions` dan `role_permissions`) beserta cakupan datanya (`all`, `team`, `own`) di dalam database, dievaluasi oleh middleware JWT di setiap endpoint API.
  - *Why*: Memastikan keamanan berlapis baik di antarmuka maupun di server. Sales hanya dapat melihat dan memodifikasi klien/Quotation/Deal miliknya sendiri, Manager dapat memantau dan menyetujui dokumen seluruh anggota satu timnya, sementara Super Admin dapat menyesuaikan matriks izin langsung dari menu Pengaturan tanpa mengubah kode sumber.

- **Decision 4: Mesin Cetak PDF A4 Landscape Berbasis CSS Print & HTML Presisi**
  - *Chosen Approach*: Menyediakan komponen pratinjau dokumen berstandar A4 Landscape (`297mm × 210mm`) yang seragam untuk ke-4 dokumen utama (Quotation, Media Order, Bukti Tayang, Invoice) plus Laporan Progres Deal, lengkap dengan aturan `@media print` untuk pemenggalan halaman tabel otomatis, pengulangan header tabel, watermark status, dan blok tanda tangan anti-terpotong.
  - *Why*: Menghasilkan dokumen PDF vektor yang tajam, ringan, dan siap diunduh atau dicetak langsung dari browser di lingkungan VPS manapun tanpa memerlukan instalasi binary browser headless yang membebani RAM server.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & Component Diagram

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT SPA (React 19 + Tailwind CSS)                         │
├───────────────────┬────────────────────────────────────────────────┬───────────────────┤
│  Auth & RBAC      │  Core Operational Modules                      │  Reporting & PDF  │
│  ┌─────────────┐  │  ┌──────────────┐   ┌───────────────────────┐  │  ┌─────────────┐  │
│  │ JWT Session │  │  │ Master Data  │   │ Deal Command Center   │  │  │ Role-Based  │  │
│  │ & Role      │  │  │ (Klien, Rate │   │ (Kuota Bar, Timeline, │  │  │ Interactive │  │
│  │ Switcher    │  │  │  Card, Paket)│   │  Ringkasan Tagihan)   │  │  │ Charts      │  │
│  └──────┬──────┘  │  └──────┬───────┘   └───────────┬───────────┘  │  └──────┬──────┘  │
│         │         │         │                       │              │         │         │
│  ┌──────▼──────┐  │  ┌──────▼───────┐   ┌───────────▼───────────┐  │  ┌──────▼──────┐  │
│  │ Permission  │  │  │ Quotation &  │──►│ Media Order, Jadwal   │──┼─►│ A4 Landscape│  │
│  │ Matrix &    │  │  │ Versioning   │   │ Kalender & Bentrok    │  │  │ Print/PDF   │  │
│  │ Audit Viewer│  │  │ (Rev.1..N)   │   │ + Bukti Tayang & Inv  │  │  │ Engine      │  │
│  └─────────────┘  │  └──────────────┘   └───────────────────────┘  │  └─────────────┘  │
└─────────┼───────────────────┼───────────────────────┼────────────────────────┼─────────┘
          │                   │    REST API + Bearer JWT                       │
          ▼                   ▼                       ▼                        ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                          EXPRESS BACKEND SERVER (server.ts)                            │
├─────────────────────────┬───────────────────────────────┬──────────────────────────────┤
│  Security & Middleware  │  Business Logic Controllers   │  Audit & Numbering Services  │
│  • JWT Token Verifier   │  • Quota Validation Engine    │  • Yearly Sequence Generator │
│  • Role & Ownership     │  • Discount Approval Router   │    (KODE/YYYY/MM/NNNN)       │
│    Scope Guard          │  • Inventory Conflict Checker │  • Deep Audit Trail Logger   │
│    (All / Team / Own)   │  • Document Lock Enforcer     │    (Old vs New Value Diff)   │
└─────────────────────────┴───────────────┬───────────────┴──────────────────────────────┘
                                          │
                                          ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        PERSISTENT SQLITE DATABASE (local file)                         │
│  • Identity & RBAC : users, roles, teams, permissions, role_permissions                │
│  • Master Catalog  : clients, client_contacts, products, product_prices, packages      │
│  • Document Chain  : quotations, quotation_versions, quotation_items, deals,           │
│                      deal_items, media_orders, mo_items, mo_item_logs, proofs,         │
│                      proof_items, invoices, invoice_items, payments                    │
│  • Governance      : approvals, number_sequences, audit_logs, notifications, settings  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Data Model & State

1. **Pengguna, Tim, dan RBAC Dinamis**:
   - `roles`: 7 peran baku (`super_admin`, `admin`, `direktur`, `manager`, `marketing`, `sales`, `finance`).
   - `teams` & `users`: Setiap pengguna Sales dan Marketing tergabung dalam satu tim di bawah satu Manager (`manager_id`).
   - `permissions` & `role_permissions`: Menyimpan matriks izin per modul (`create`, `update`, `approve`, `view`) beserta cakupan kepemilikan (`all`, `team`, `own`).
2. **Master Klien & Katalog Berversi**:
   - `clients` & `client_contacts`: Menyimpan data perusahaan, NPWP, alamat penagihan, tipe klien (Brand Langsung atau Agensi beserta relasi brand turunan), termin bayar (`NET 14`, `NET 30`, `NET 45`), dan pemilik (`owner_user_id`).
   - `products`, `product_prices`, & `packages`: Menyimpan item media (website, sosmed, video, newsletter, podcast, event, influencer), tipe kuota (`jumlah`, `durasi`, `impresi`), serta histori harga berdasarkan rentang tanggal berlaku.
3. **Rantai Dokumen Utama**:
   - `quotations`, `quotation_versions`, `quotation_items`: Mendukung multi-revisi (`Rev.0`, `Rev.1`, dst.). Menyimpan snapshot harga, diskon baris/total, PPN 11%, masa berlaku, dan alasan jika berstatus *Lost*.
   - `deals` & `deal_items`: Dibuat otomatis(1:1) saat Quotation ditandai *Deal*. `deal_items` menyimpan `qty_dibeli` sebagai batas kuota kontrak dan pilihan skema penagihan (`per_mo`, `termin`, `sekali_tagih`).
   - `media_orders`, `mo_items`, & `mo_item_logs`: Mengambil kuota dari `deal_items` (untuk jenis *Reguler*) atau tanpa memotong kuota (untuk jenis *Bonus/Tambahan*). Setiap baris jadwal menyimpan platform, tanggal tayang, slot inventori, PIC konten, dan status item (*Terjadwal*, *Dalam Produksi*, *Siap Tayang*, *Tayang*, *Tayang Terverifikasi*, *Ditunda*, *Batal*). Perubahan jadwal dicatat di `mo_item_logs`.
   - `proofs`, `proof_items`, & `proof_files`: Melekat pada MO. Mencatat URL tayang aktual, lampiran bukti screenshot, serta metrik target vs realisasi (impresi, reach, klik, views, engagement).
   - `invoices`, `invoice_items`, & `payments`: Menagihkan Deal sesuai skema yang dipilih, menghitung PPN 11%, potongan PPh 23, dan meterai, menyimpan nomor faktur pajak, serta melacak riwayat pembayaran masuk hingga lunas.
4. **Governance, Penomoran & Audit Log**:
   - `number_sequences`: Mengelola nomor urut per jenis dokumen dan tahun (`reset_period = YEARLY`) dalam transaksi atomik untuk menghasilkan format `KODE/TAHUN/BULAN/URUT`.
   - `approvals`: Mencatat permintaan dan keputusan persetujuan Manager/Direktur untuk Quotation berdiskon, MO, dan Bukti Tayang.
   - `audit_logs`: Mencatat secara otomatis setiap aksi pembuatan, perubahan status, revisi harga, penjadwalan ulang, pembayaran, dan login lengkap dengan identitas pengguna, waktu, nilai lama, dan nilai baru.

### Interactive Component & State Mapping

- **Halaman Login & Header Sesi**:
  - Memvalidasi kredensial ke `/api/auth/login`, menyimpan JWT, dan memuat profil beserta matriks izin role.
  - Menyediakan pemilih *Quick Demo Switcher* agar penguji dapat berpindah antar 7 role (Super Admin, Admin, Direktur, Manager, Marketing, Sales, Finance) dengan sekali klik dan langsung melihat perubahan menu, cakupan data, serta grafik dashboard.
- **Dashboard Multi-Role & Grafik Interaktif**:
  - Menampilkan visualisasi grafik yang menyesuaikan peran aktif (Corong Pipeline & Konversi untuk Sales; Kalender Jadwal & Status Kuota untuk Marketing/Admin; Grafik Pendapatan Bulanan & Umur Piutang untuk Finance/Direktur).
  - Klik pada item di daftar tugas (misal: *"Quotation menunggu persetujuan diskon"* atau *"Bukti Tayang menunggu verifikasi"*) langsung mengarahkan pengguna ke detail dokumen terkait untuk mengambil keputusan.
- **Editor Quotation & Alur Persetujuan Diskon**:
  - Saat baris item atau paket ditambahkan, kalkulator otomatis menghitung Subtotal, Diskon, PPN 11%, dan Grand Total.
  - Apabila terdapat nilai diskon $> 0$, tombol aksi otomatis mengirimkan Quotation ke status *Menunggu Persetujuan* dan membuat tiket di tabel `approvals` untuk Manager tim terkait.
  - Dokumen yang sudah berstatus *Terkirim* atau *Deal* terkunci dari edit langsung; tombol **Buat Revisi Baru** akan menduplikasi versi aktif menjadi `Rev.N+1` dan mencatatnya di Audit Log.
- **Detail Deal & Validasi Kuota Media Order**:
  - Saat pengguna membuat MO dari halaman Detail Deal, form MO menampilkan sisa kuota yang belum dijadwalkan untuk setiap baris produk.
  - Jika pengguna memasukkan kuantitas melebihi sisa kuota pada MO Reguler, sistem menolak penyimpanan dengan pesan validasi yang jelas; jika dipilih jenis *MO Bonus*, sistem mengizinkan penyimpanan dengan status wajib *Menunggu Persetujuan Manager*.
  - Saat mengisi tanggal dan slot jadwal tayang (mis. *Homepage Top Banner*), sistem memeriksa apakah ada item MO aktif lain dari klien berbeda di tanggal dan slot yang sama, lalu memberikan peringatan bentrok inventori.
- **Verifikasi Bukti Tayang & Rekonsiliasi Invoice**:
  - Marketing menginput tautan live, screenshot, serta realisasi impresi/klik (atau mengimpor dari CSV) pada Bukti Tayang lalu mengajukan verifikasi.
  - Saat Manager/Admin menekan **Verifikasi Bukti Tayang**, seluruh `mo_items` terkait otomatis naik menjadi *Tayang Terverifikasi*, bilah progres Deal bertambah secara real-time, dan item tersebut siap ditagihkan pada modul Invoice.
  - Pada modul Invoice, pencatatan pembayaran (sebagian atau penuh) otomatis mengubah status Invoice menjadi *Dibayar Sebagian* atau *Lunas*, serta memperbarui panel *Tertagih vs Terbayar* di Detail Deal.
- **Audit Log & Pengaturan Sistem**:
  - Menu Audit Log menyajikan tabel kronologis dengan fitur filter berdasarkan pengguna, modul, jenis aksi, dan rentang tanggal, serta panel inspeksi perbandingan nilai lama vs nilai baru (JSON diff).
  - Menu Pengaturan memungkinkan Super Admin mengelola pengguna & tim, menyesuaikan matriks hak akses role secara dinamis, memperbarui profil perusahaan & rekening bank untuk kop PDF, serta mengatur format penomoran dokumen.
