# Spesifikasi Aplikasi Quotation – Media Order – Bukti Tayang – Invoice

Nov 5, 2026 · @Rosidin

## 1. Ringkasan dan Asumsi

Aplikasi ini menjalankan satu rantai data untuk perusahaan media digital: **Quotation → Deal → Media Order (MO) → Bukti Tayang → Invoice**. Data diinput sekali dan mengalir ke dokumen berikutnya; setiap dokumen menghasilkan PDF A4 landscape.

Tiga keputusan desain utama:

- **Satu Deal punya banyak MO.** Deal menyimpan kuota yang dibeli klien, tiap MO mengambil sebagian kuota sesuai jadwal terbit.
- **Tidak ada penayangan tanpa MO.** Jadwal tayang dan Bukti Tayang selalu melekat pada MO.
- **Progres Deal dihitung otomatis:** berapa item sudah terbit, terjadwal, dan belum dijadwalkan.

Beberapa pertanyaan terbuka belum dijawab, jadi spesifikasi ini memakai asumsi berikut. Koreksi bila ada yang berbeda dari cara kerja timmu.

| Topik | Asumsi yang dipakai |
| --- | --- |
| Jenis kuota Deal | Dua jenis: **berbasis jumlah** (artikel, post, video) dan **berbasis durasi/impresi** (banner 1 bulan, 1 juta impresi) |
| Pembuat MO | Marketing dan Admin; Sales hanya memantau |
| Persetujuan MO | Manager menyetujui MO sebelum aktif; bisa dimatikan di pengaturan |
| MO tanpa Deal | Boleh hanya sebagai jenis **Bonus/Tambahan** (tidak memotong kuota, perlu persetujuan Manager) |
| Skema invoice | Tiga skema didukung (per MO, termin Deal, sekali tagih), dipilih per Deal |
| Struktur tim | Setiap Sales dan Marketing berada di satu tim di bawah satu Manager |
| Pajak | PPN 11% default; PPh 23 dan meterai opsional per invoice |
| Mata uang dan bahasa | Rupiah, dokumen dalam Bahasa Indonesia |

## 2. Alur Bisnis dan Relasi Dokumen

Satu Deal bisa memiliki banyak MO, karena konten tidak selalu terbit sekaligus.

&#91;embedded content: alur dokumen · 1 Deal, banyak MO, bukti tayang per MO\]

Quotation yang menjadi Deal membentuk Paket Deal berisi kuota. Dari kuota itu dibuat satu atau lebih MO sesuai jadwal terbit; tiap MO punya bukti tayang sendiri, dan invoice mengikuti skema yang dipilih untuk Deal.

- 1 Quotation menjadi paling banyak 1 Deal.
- 1 Deal punya banyak MO; jumlah item semua MO tidak melebihi kuota Deal (kecuali MO Bonus).
- 1 MO punya banyak item jadwal dan satu atau lebih Bukti Tayang (mis. per minggu atau per bulan).
- 1 Deal punya satu atau banyak Invoice, sesuai skema: per MO, termin, atau sekali tagih.
- Ringkasan progres Deal dihitung dari status item di semua MO.

## 3. Role dan Hak Akses

Tujuh role dengan prinsip: makin tinggi role, makin luas cakupan data; Sales dan Marketing hanya melihat data miliknya, Manager melihat timnya, Finance fokus pada uang.

| Role | Cakupan data | Tugas utama |
| --- | --- | --- |
| Super Admin | Seluruh sistem | Kelola pengguna dan role, pengaturan sistem, penomoran, template PDF, audit log, pemulihan data |
| Admin | Seluruh operasional | Kelola master klien dan rate card, input atau koreksi atas nama tim, kelola jadwal tayang, unggah bukti tayang |
| Direktur | Seluruh data (umumnya baca saja) | Dashboard eksekutif, persetujuan final (diskon besar, pembatalan Deal), semua laporan |
| Manager | Timnya | Menyetujui quotation, diskon, dan MO sesuai batas wewenang; memantau target dan progres Deal tim |
| Marketing | Kampanye yang ditangani | Membuat MO dan jadwal tayang, mengelola konten dan bukti tayang, memantau progres Deal |
| Sales | Klien, quotation, dan Deal miliknya | Membuat quotation, follow-up, menandai Deal, memantau progres Deal (hanya lihat untuk MO dan bukti) |
| Finance | Seluruh dokumen keuangan | Membuat dan mengirim invoice, mencatat pembayaran, piutang, pajak, laporan keuangan |

### Matriks akses

Kode: **B** buat, **U** ubah, **A** setujui, **L** lihat, **–** tidak ada akses. "Milik sendiri" berarti terbatas pada data yang ia tangani.

| Fitur | Super Admin | Admin | Direktur | Manager | Marketing | Sales | Finance |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Master klien | B U L | B U L | L | L | B U L | B U L (milik sendiri) | L |
| Rate card dan paket | B U L | B U L | A L | A L | B U L | L | L |
| Quotation | B U L | B U L | A L | A L | L | B U L (milik sendiri) | L |
| Tandai Deal | B U | B U | B U | B U | – | B U (milik sendiri) | – |
| Deal dan progres | L U | L U | L | L | L U | L (milik sendiri) | L |
| Media Order | B U L | B U L | L | A L | B U L | L | L |
| Jadwal tayang | B U L | B U L | L | L | B U L | L | L |
| Bukti Tayang | B U L | B U L | L | A L | B U L | L | L |
| Invoice | B U L | L | L | L | – | – | B U L |
| Pembayaran | B U L | – | L | – | – | – | B U L |
| Pengguna dan role | B U L | – | – | – | – | – | – |
| Dashboard | Semua | Operasional | Eksekutif | Tim | Kampanye | Penjualan pribadi | Keuangan |

### Aturan akses tambahan

- **Berbasis kepemilikan:** setiap klien, quotation, dan Deal punya pemilik (Sales). Sales melihat miliknya, Manager melihat semua milik anggota timnya.
- **Batas persetujuan bisa diatur,** misalnya diskon di atas 10% perlu Manager dan di atas 20% perlu Direktur.
- **Dokumen final terkunci.** Perubahan hanya lewat revisi atau addendum, dan tercatat di audit log.
- **Izin disimpan sebagai data** (bukan ditulis mati per role) agar bisa disesuaikan tanpa mengubah aplikasi.

## 4. Spesifikasi Fitur per Modul

### 4.1 Master Data

- **Klien dan kontak:** nama perusahaan, NPWP, alamat penagihan, PIC, email, telepon; tipe klien (brand langsung atau agensi, dengan brand turunan); termin bayar default (NET 14, 30, 45); pemilik klien (Sales).
- **Katalog produk dan rate card:** kategori media (website, sosial media, video, newsletter, podcast, event, influencer), spesifikasi, satuan (post, artikel, hari, minggu, bulan, CPM, impresi), harga list. Harga berversi: quotation lama tidak berubah saat harga baru berlaku.
- **Paket penawaran:** bundel item dengan harga paket, bisa dipakai ulang sebagai template quotation.
- **Pengaturan perusahaan:** logo, kop, rekening bank, tanda tangan dan stempel digital, format penomoran dokumen, tarif pajak, syarat dan ketentuan baku per dokumen.

### 4.2 Quotation

- Pilih klien, tambahkan item atau paket dari katalog, atur kuantitas, periode, dan target (impresi, klik) bila ada.
- Diskon per item, per paket, atau total; diskon di atas batas wewenang memicu persetujuan.
- Perhitungan otomatis: subtotal, diskon, PPN, grand total.
- **Revisi berversi** (Rev.1, Rev.2) yang bisa dibandingkan; hanya versi terakhir yang aktif.
- Masa berlaku dengan penanda otomatis *Expired*.
- Kirim lewat email dari aplikasi, unduh PDF, atau bagikan tautan lihat-saja; catat kapan dibuka klien dan catatan follow-up.
- Aksi akhir: **Deal** (membuat Paket Deal) atau **Lost** (wajib isi alasan).

### 4.3 Paket Deal (induk dari MO)

Deal dibuat otomatis dari quotation berstatus Deal dan menjadi pusat pemantauan.

- **Kuota:** setiap baris quotation menjadi baris kuota (mis. Artikel 10, Post Instagram 20, Banner 1 bulan).
- **Ringkasan progres** per baris kuota: dibeli, sudah tayang, terjadwal, belum dijadwalkan, persentase.
- Daftar MO milik Deal beserta progres masing-masing.
- Nilai Deal, nilai sudah tertagih, nilai sudah dibayar, sisa belum tertagih.
- Masa berlaku Deal dengan peringatan bila kuota masih tersisa mendekati akhir kontrak.
- Dokumen terkait dalam satu garis waktu: quotation, MO, bukti tayang, invoice.
- Lampiran kontrak atau PO klien.
- Tombol utama: **Buat MO**, **Buat Invoice**, **Cetak Laporan Progres**.

### 4.4 Media Order (MO)

- **Dibuat dari Deal:** pilih baris kuota dan jumlah dari sisa kuota. Sistem menolak atau meminta persetujuan bila melebihi sisa.
- Isi nama kampanye, nomor PO klien, PIC kedua pihak, brief dan materi, tautan aset.
- **Jadwal tayang** per item: tanggal, slot atau jam, platform, judul atau topik, penanggung jawab konten.
- **Cek bentrok inventori** (mis. slot banner homepage yang sudah terisi klien lain).
- Penomoran berurutan per Deal (mis. `MO/2026/11/0007`, MO ke-2 dari Deal DL-0012).
- **Penjadwalan ulang** tercatat (tanggal lama, tanggal baru, siapa, alasan).
- **Addendum** bila ada tambah atau kurang item setelah MO aktif; tidak menimpa data lama.
- Jenis MO: **Reguler** (memotong kuota) dan **Bonus/Tambahan** (tidak memotong kuota, perlu persetujuan Manager).
- Pembatalan item mengembalikan kuota ke Deal, dengan alasan wajib.
- Unggah MO bertanda tangan (scan) sebagai lampiran.

### 4.5 Bukti Tayang

- Dibuat **per MO**, bisa parsial per periode atau per kumpulan item yang sudah tayang.
- Per item tayang: screenshot atau foto (banyak file, tanggal), tautan live, data kinerja (impresi, reach, klik, CTR, views, engagement) yang bisa diinput manual atau diimpor dari CSV.
- **Target vs realisasi** dengan persentase capaian.
- Catatan kompensasi atau tayang pengganti bila ada kekurangan.
- Alur verifikasi: pembuat mengisi, Manager atau Admin memverifikasi, baru bisa dikirim ke klien.
- Item yang bukti tayangnya terverifikasi otomatis berstatus **Tayang terverifikasi** dan menambah progres Deal.
- Pengaturan opsional: item tanpa bukti terverifikasi tidak bisa ditagihkan.

### 4.6 Invoice

- Dibuat dari Deal atau MO dan Bukti Tayang; hanya item yang memenuhi syarat penagihan yang masuk.
- **Tiga skema**, dipilih per Deal: (1) per MO, (2) termin di level Deal (mis. DP 30%, progres, pelunasan), (3) sekali tagih di akhir.
- PPN, PPh 23 (potongan), meterai, dan kolom nomor faktur pajak.
- Jatuh tempo otomatis dari termin klien.
- Pencatatan pembayaran sebagian atau penuh (tanggal, metode, bukti transfer); status berubah otomatis.
- Pengingat email sebelum dan sesudah jatuh tempo; daftar piutang.
- Nota kredit atau revisi invoice bila ada koreksi.
- Paket kirim: invoice beserta lampiran MO dan Bukti Tayang terkait.
- Panel **tertagih vs belum tertagih** per Deal, termasuk item sudah tayang tetapi belum ditagih.

### 4.7 Dashboard dan Laporan

- **Sales:** pipeline quotation per status, tingkat konversi Deal dan Lost, alasan Lost, target vs capaian.
- **Operasional:** kalender tayang, jadwal terlambat, bukti tayang belum diisi, Deal dengan kuota belum dijadwalkan.
- **Finance:** piutang per umur (belum jatuh tempo, 1 sampai 30 hari, di atas 30 hari), pendapatan per bulan, tayang belum ditagih.
- **Direktur:** ringkasan pendapatan, pipeline, performa per Sales, klien, dan jenis media.
- Ekspor laporan ke Excel/CSV.

### 4.8 Fitur Lintas Modul

- Audit log (siapa mengubah apa dan kapan) dan riwayat revisi.
- Notifikasi di aplikasi dan email (persetujuan menunggu, jadwal besok, bukti belum diisi, invoice jatuh tempo).
- Pencarian dan filter global; lampiran file di setiap dokumen.
- Template PDF yang bisa diatur (logo, warna, footer) dan penomoran otomatis yang bisa diatur formatnya.

## 5. Aturan Bisnis, Status, dan Progres

Angka progres Deal harus konsisten di semua layar, jadi definisinya ditetapkan di sini.

### 5.1 Definisi dan rumus progres

| Istilah | Definisi |
| --- | --- |
| Dibeli | Jumlah kuota pada baris Deal (dikurangi yang dibatalkan permanen) |
| Sudah tayang | Item MO berstatus *Tayang* atau *Tayang terverifikasi* |
| Terjadwal | Item MO yang sudah punya jadwal tetapi belum tayang |
| Belum dijadwalkan | Kuota Deal yang belum masuk MO mana pun |
| Progres | Sudah tayang ÷ Dibeli |

```latex
Dibeli = SudahTayang + Terjadwal + BelumDijadwalkan
```

Item yang dibatalkan dan dikembalikan ke Deal otomatis kembali menjadi *Belum dijadwalkan*. Untuk kuota berbasis durasi, progres dihitung dari hari berjalan ÷ total hari; untuk berbasis impresi, dari impresi tercapai ÷ target.

### 5.2 Status per dokumen

| Dokumen | Status |
| --- | --- |
| Quotation | Draft → Menunggu persetujuan → Terkirim → Negosiasi → Deal / Lost / Expired |
| Paket Deal | Belum dimulai → Berjalan → Selesai / Dibatalkan; penanda tambahan *Terlambat* dan *Mendekati masa berlaku* |
| Media Order | Draft → Menunggu persetujuan → Terjadwal → Sebagian tayang → Selesai tayang / Dibatalkan |
| Item jadwal MO | Terjadwal → Dalam produksi → Siap tayang → Tayang → Tayang terverifikasi; cabang: Ditunda, Batal |
| Bukti Tayang | Draft → Menunggu verifikasi → Terverifikasi → Terkirim ke klien |
| Invoice | Draft → Terkirim → Dibayar sebagian → Lunas; cabang: Jatuh tempo, Dibatalkan |

Status Deal, MO, dan progres dihitung otomatis dari status item di bawahnya; pengguna tidak mengisinya manual.

### 5.3 Aturan penting

1. Quotation hanya bisa menjadi Deal sekali; revisi setelah Deal harus lewat addendum Deal.
2. Tidak ada jadwal tayang, bukti tayang, atau penagihan berbasis tayang tanpa MO.
3. Total jumlah item di semua MO aktif untuk satu baris kuota tidak boleh melebihi kuota Deal (kecuali jenis MO Bonus atau disetujui Manager).
4. Item hanya bisa berstatus *Tayang terverifikasi* bila bukti tayangnya terverifikasi.
5. Harga di Deal dan MO mengikuti quotation; perubahan harga master tidak mengubah dokumen yang sudah ada.
6. Dokumen berstatus final (terkirim, aktif, terverifikasi, lunas) terkunci; perubahan lewat revisi, addendum, atau nota kredit.
7. Nomor dokumen unik dan berurutan; tidak bisa dipakai ulang walau dokumen dibatalkan.
8. Invoice tidak boleh melebihi nilai Deal kecuali ada addendum.
9. Setiap perubahan status, harga, jadwal, dan pembayaran tercatat di audit log.

## 6. Alur Layar

Navigasi utama berpusat pada **Deal**: dari halaman detail Deal pengguna bisa membuat MO, melihat bukti tayang, dan membuat invoice tanpa berpindah menu.

### 6.1 Menu dan layar

| Menu | Layar | Isi dan aksi utama |
| --- | --- | --- |
| Dashboard | Dashboard per role | Kartu ringkas, grafik, daftar tugas (persetujuan menunggu, jadwal hari ini, invoice jatuh tempo) |
| Klien | Daftar klien, detail klien | Pencarian, filter pemilik; detail memuat kontak, riwayat quotation, Deal, invoice |
| Katalog | Rate card, paket penawaran | Daftar item dan harga berversi, bundel paket |
| Quotation | Daftar, form quotation, detail | Filter status; form dengan tabel item dan ringkasan biaya langsung; tombol Kirim, Revisi, Tandai Deal atau Lost, Unduh PDF |
| Deal | Daftar Deal, **detail Deal** | Daftar dengan bilah progres; detail memuat ringkasan kuota, daftar MO, nilai tertagih, garis waktu dokumen; tombol Buat MO, Buat Invoice |
| Media Order | Daftar MO, form MO, detail MO | Form memilih sisa kuota dan mengisi jadwal; detail memuat status per item, penjadwalan ulang, addendum, Unduh PDF |
| Jadwal Tayang | Kalender dan tabel jadwal | Tampilan bulan, minggu, daftar; filter platform, klien, penanggung jawab; penanda bentrok dan terlambat |
| Bukti Tayang | Daftar, form bukti, detail | Unggah screenshot dan tautan, input atau impor kinerja, target vs realisasi, tombol Verifikasi dan Kirim |
| Invoice | Daftar, form invoice, detail | Pilih skema tagih, pilih MO atau termin, hitung pajak, catat pembayaran, kirim dan unduh PDF |
| Laporan | Piutang, pipeline, pendapatan, kinerja | Filter periode dan ekspor Excel atau CSV |
| Pengaturan | Pengguna dan role, perusahaan, penomoran, template PDF, batas persetujuan | Hanya Super Admin (sebagian Admin) |

Menu yang tampil mengikuti role; mis. Sales tidak melihat menu Invoice dan Pengaturan.

### 6.2 Layar kunci: Detail Deal

Susunan dari atas ke bawah:

1. **Header:** nama kampanye, klien, pemilik (Sales), status Deal, nilai Deal, masa berlaku.
2. **Ringkasan progres:** tabel kuota per baris dengan bilah progres (dibeli, tayang, terjadwal, belum dijadwalkan) dan total.
3. **Daftar MO:** nomor, nama, periode, progres "3/5 tayang", status, aksi lihat dan unduh PDF; tombol **Buat MO**.
4. **Penagihan:** nilai tertagih, dibayar, sisa; daftar invoice; tombol **Buat Invoice**.
5. **Garis waktu dokumen:** quotation, MO, bukti tayang, invoice, serta riwayat perubahan.

### 6.3 Alur kerja harian per peran

1. **Sales:** buat quotation, kirim, follow-up, tandai Deal, lalu pantau progres Deal miliknya.
2. **Marketing atau Admin:** buka Deal, buat MO dari sisa kuota, isi jadwal tayang, ajukan persetujuan.
3. **Manager:** menyetujui quotation (diskon besar) dan MO, memverifikasi bukti tayang.
4. **Marketing atau Admin:** setelah tayang, ubah status item, unggah bukti, ajukan verifikasi.
5. **Finance:** buka Deal, buat invoice dari MO atau termin yang terpenuhi, kirim, catat pembayaran.

## 7. Rancangan Database

Inti desainnya: **`deal_items` menyimpan kuota, `mo_items` menyimpan penayangan nyata**. Progres Deal dihitung dari status `mo_items`, bukan disimpan sebagai angka terpisah, sehingga tidak bisa salah sinkron.

### 7.1 Pengguna dan akses

| Tabel | Kolom kunci | Relasi |
| --- | --- | --- |
| `users` | id, nama, email, password\_hash, role\_id, team\_id, aktif | milik `roles`, `teams` |
| `roles` | id, nama (super\_admin, admin, direktur, manager, marketing, sales, finance) | punya banyak `users` |
| `permissions`, `role_permissions` | kode izin (mis. `mo.create`), cakupan (semua, tim, milik sendiri) | menghubungkan role dan izin |
| `teams` | id, nama, manager\_id | punya banyak `users` |

### 7.2 Master data

| Tabel | Kolom kunci | Relasi |
| --- | --- | --- |
| `clients` | id, nama, npwp, alamat\_tagih, termin\_hari, owner\_user\_id, parent\_client\_id (agensi ke brand) | punya `client_contacts` |
| `products` | id, kategori, nama, spesifikasi, satuan, tipe\_kuota (jumlah, durasi, impresi) | punya banyak `product_prices` |
| `product_prices` | product\_id, harga, berlaku\_dari, berlaku\_sampai | harga berversi |
| `packages`, `package_items` | nama paket, harga paket; product\_id, qty | bundel produk |

### 7.3 Dokumen alur utama

| Tabel | Kolom kunci | Relasi |
| --- | --- | --- |
| `quotations` | id, nomor, client\_id, owner\_user\_id, status, berlaku\_sampai, versi\_aktif\_id, alasan\_lost | induk `quotation_versions` |
| `quotation_versions` | quotation\_id, nomor\_revisi, subtotal, diskon, ppn, total, catatan | induk `quotation_items` |
| `quotation_items` | version\_id, product\_id, deskripsi, periode, qty, harga, diskon, jumlah |  |
| `deals` | id, nomor, quotation\_version\_id, client\_id, owner\_user\_id, nama\_kampanye, no\_po, nilai, berlaku\_sampai, status, skema\_tagih | induk `deal_items`, `media_orders`, `invoices` |
| `deal_items` | deal\_id, product\_id, deskripsi, qty\_dibeli, harga\_satuan, tipe\_kuota | **kuota** per baris |
| `media_orders` | id, nomor, deal\_id (null untuk Bonus tanpa Deal), jenis (reguler, bonus), nama, periode, status, disetujui\_oleh | induk `mo_items` |
| `mo_items` | mo\_id, deal\_item\_id, judul, platform, tanggal\_tayang, slot, qty, status, url\_live, tanggal\_tayang\_aktual | **penayangan nyata**; sumber hitungan progres |
| `mo_item_logs` | mo\_item\_id, perubahan, nilai\_lama, nilai\_baru, alasan, user\_id, waktu | riwayat jadwal ulang dan status |
| `proofs` | id, nomor, mo\_id, periode, status, diverifikasi\_oleh | induk `proof_items` |
| `proof_items` | proof\_id, mo\_item\_id, target, realisasi, impresi, reach, klik, views, engagement, catatan |  |
| `proof_files` | proof\_item\_id, file\_path, jenis (screenshot, foto, laporan), keterangan |  |
| `invoices` | id, nomor, deal\_id, skema, tanggal, jatuh\_tempo, subtotal, ppn, pph23, meterai, total, status, no\_faktur\_pajak | induk `invoice_items`, `payments` |
| `invoice_items` | invoice\_id, mo\_id atau deal\_item\_id, deskripsi, qty, harga, jumlah, proof\_id | menautkan tagihan ke bukti tayang |
| `payments` | invoice\_id, tanggal, jumlah, metode, bukti\_file, dicatat\_oleh |  |

### 7.4 Pendukung

| Tabel | Fungsi |
| --- | --- |
| `approvals` | permintaan persetujuan (jenis dokumen, dokumen, diminta oleh, disetujui oleh, status, alasan) |
| `number_sequences` | penomoran per jenis dokumen dan periode, tanpa celah dan tanpa duplikat |
| `attachments` | lampiran generik per dokumen (kontrak, PO, MO bertanda tangan) |
| `audit_logs` | siapa, kapan, dokumen apa, field apa, nilai lama, nilai baru |
| `notifications` | notifikasi per pengguna dan statusnya dibaca |
| `settings` | profil perusahaan, tarif pajak, batas persetujuan, template PDF |

### 7.5 Cara progres dihitung

Per baris kuota, tiga angka diturunkan dari `mo_items` yang terhubung lewat `deal_item_id` (mengabaikan item berstatus Batal):

- **Sudah tayang** = jumlah `qty` dengan status Tayang atau Tayang terverifikasi
- **Terjadwal** = jumlah `qty` dengan status lain
- **Belum dijadwalkan** = `qty_dibeli` dikurangi dua angka di atas

Karena diturunkan, pembatalan item otomatis mengembalikan kuota, dan validasi "tidak melebihi kuota" cukup membandingkan jumlah `mo_items` dengan `qty_dibeli` saat MO disimpan.

### 7.6 Aturan integritas

- Seluruh tabel dokumen memakai penghapusan lunak (soft delete); dokumen final tidak bisa dihapus, hanya dibatalkan.
- Harga, nama klien, dan alamat disalin (snapshot) ke dokumen saat dibuat, agar PDF lama tetap sama walau master berubah.
- Nomor dokumen diambil dalam transaksi dari `number_sequences`.
- Indeks pada `client_id`, `deal_id`, `mo_id`, `status`, dan `tanggal_tayang` untuk dashboard dan kalender.

## 8. Spesifikasi PDF A4 Landscape

Empat dokumen memakai satu kerangka yang sama (kop, blok referensi, tabel utama, blok total, tanda tangan, footer) supaya terlihat satu keluarga dan mudah diatur lewat satu template.

### 8.1 Ketentuan umum

- Ukuran A4 landscape (297 × 210 mm), margin sekitar 12 mm.
- Kop: logo, nama dan alamat perusahaan, NPWP, kontak. Di kanan atas: judul dokumen, nomor, tanggal, dan status.
- Tabel panjang otomatis berlanjut ke halaman berikutnya; header tabel diulang, nomor halaman "Halaman x dari y" di footer.
- Blok tanda tangan tidak terpotong antar halaman.
- Nomor dokumen dan kode referensi dokumen asal (mis. "Ref. Quotation QT/…, Deal DL-…") selalu tampil.
- Dokumen berstatus Draft diberi watermark "DRAFT"; dokumen dibatalkan diberi watermark "BATAL".
- Nama file otomatis, mis. `Invoice_INV-2026-11-0012_NamaKlien.pdf`.
- Opsional: QR code ke halaman verifikasi dokumen.

### 8.2 Isi tiap dokumen

| Dokumen | Bagian utama | Kolom tabel utama |
| --- | --- | --- |
| Quotation | Data klien dan PIC; judul penawaran; masa berlaku; tabel item; ringkasan biaya; syarat dan ketentuan; tanda tangan | No, Media/Produk, Spesifikasi, Periode, Qty, Satuan, Harga, Diskon, Jumlah |
| Media Order | Referensi Deal, Quotation, PO klien; nama kampanye; PIC kedua pihak; tabel jadwal tayang; ketentuan; tanda tangan kedua pihak | No, Item, Platform, Judul/Topik, Tanggal tayang, Slot, Qty, Catatan |
| Bukti Tayang | Ringkasan kampanye; tabel target vs realisasi; halaman lampiran screenshot per item dengan tautan live; pernyataan verifikasi; tanda tangan | No, Item, Tanggal tayang, Tautan, Target, Realisasi, Capaian % |
| Invoice | Data penagihan; referensi MO, Bukti Tayang, PO; tabel item; rincian pajak; info rekening; terbilang; tanda tangan dan stempel | No, Deskripsi, Periode/Tanggal tayang, Qty, Harga, Diskon, Jumlah |

### 8.3 Dokumen tambahan (opsional)

- **Laporan Progres Deal:** ringkasan kuota (dibeli, tayang, terjadwal, belum dijadwalkan) dan daftar MO beserta statusnya, untuk dikirim ke klien secara berkala.
- **Rekap Piutang:** daftar invoice belum lunas per klien untuk keperluan penagihan.

## 9. Tahapan Pengembangan dan Teknologi

Pembangunan dibagi tiga fase; fase 1 sudah cukup dipakai harian untuk seluruh alur Quotation sampai Invoice.

### 9.1 Tahapan

| Fase | Cakupan | Hasil yang bisa dipakai |
| --- | --- | --- |
| 1. Inti alur | Login dan 7 role, master klien dan rate card, Quotation, Deal dengan kuota dan progres, MO dengan jadwal tayang, Bukti Tayang, Invoice, 4 template PDF A4 landscape, penomoran otomatis, audit log | Seluruh alur berjalan dari penawaran sampai tagihan |
| 2. Kontrol dan keuangan | Alur persetujuan (diskon, MO), revisi dan addendum, pencatatan pembayaran, piutang, pajak lengkap, kirim email dari aplikasi, dashboard per role, Laporan Progres Deal | Manajemen dan finance punya kontrol dan laporan |
| 3. Otomasi dan perluasan | Cek bentrok inventori, impor data kinerja (CSV lalu API platform), pengingat otomatis, tanda tangan digital, portal klien untuk approve quotation dan melihat progres, notifikasi WhatsApp | Efisiensi dan pengalaman klien |

### 9.2 Rekomendasi teknologi

Ini rekomendasi awal, bisa diganti sesuai keahlian tim pengembang.

- **Aplikasi web:** framework full-stack yang matang (mis. Laravel atau Next.js) dengan database relasional PostgreSQL atau MySQL.
- **PDF:** pembuatan dari template HTML/CSS lewat mesin render headless agar tata letak A4 landscape presisi dan tabel panjang terpecah rapi antar halaman.
- **Penyimpanan file:** object storage untuk screenshot, lampiran, dan PDF yang sudah diterbitkan.
- **Keamanan:** autentikasi dengan opsi 2FA, izin berbasis role dan kepemilikan, backup harian, audit log tidak bisa diubah.
- **Hosting:** server cloud di Indonesia atau Asia Tenggara, dengan lingkungan staging terpisah.

### 9.3 Keputusan yang masih terbuka

- [ ] Tim pengembang dan stack yang dipakai
- [ ] Contoh dokumen, kop, dan logo yang sudah ada untuk dijadikan acuan template PDF
- [ ] Ambang diskon dan nilai yang memerlukan persetujuan Manager atau Direktur
- [ ] Aturan penomoran dokumen (format dan reset per tahun atau bulan)
- [ ] Kebutuhan faktur pajak: cukup kolom input atau terintegrasi dengan sistem pajak
- [ ] Daftar awal klien, rate card, dan pengguna yang akan diimpor ke sistem
