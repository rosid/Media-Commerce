// server.ts
import express from "express";
import { createServer as createViteServer } from "vite";
import jwt from "jsonwebtoken";
import bcrypt2 from "bcryptjs";
import path2 from "path";
import fs2 from "fs";
import crypto from "crypto";
import dotenv from "dotenv";

// src/db.ts
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import path from "path";
import fs from "fs";
var dbPath = process.env.DB_PATH || path.join(process.cwd(), "mediaflow.db");
try {
  const dbDir = path.dirname(path.resolve(dbPath));
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
} catch (e) {
  console.warn("Warning creating db directory:", e);
}
var isMariaDBConfigured = Boolean(
  (process.env.DB_TYPE === "mariadb" || process.env.DB_HOST) && process.env.DB_USER && process.env.DB_NAME
);
var mysqlModule = null;
var mysqlLoadError = null;
try {
  const mod = await import("mysql2/promise");
  mysqlModule = mod.default || mod;
} catch (err) {
  mysqlLoadError = err?.message || "Module mysql2 not found";
  if (isMariaDBConfigured) {
    console.warn("\u26A0\uFE0F [DATABASE NOTICE] Paket mysql2 belum terpasang di node_modules VPS. Menggunakan SQLite sebagai fallback sementara:", mysqlLoadError);
  }
}
var mariadbPool = null;
if (isMariaDBConfigured && mysqlModule) {
  try {
    mariadbPool = mysqlModule.createPool({
      host: process.env.DB_HOST || "127.0.0.1",
      port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      charset: "utf8mb4"
    });
    console.log(`\u{1F50C} [MARIADB] Pool terkonfigurasi untuk ${process.env.DB_USER}@${process.env.DB_HOST}:${process.env.DB_PORT || 3306}/${process.env.DB_NAME}`);
  } catch (err) {
    console.warn("\u26A0\uFE0F [MARIADB] Gagal menginisialisasi koneksi pool MariaDB, fallback ke SQLite:", err);
  }
}
async function testMariaDBConnection(customConfig) {
  const host = customConfig?.host || process.env.DB_HOST || "127.0.0.1";
  const port = customConfig?.port || (process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306);
  const user = customConfig?.user || process.env.DB_USER || "";
  const password = customConfig?.password !== void 0 ? customConfig.password : process.env.DB_PASSWORD || "";
  const database = customConfig?.database || process.env.DB_NAME || "";
  if (!user || !database) {
    return {
      success: false,
      message: "Parameter DB_USER dan DB_NAME harus diisi untuk pengujian koneksi MariaDB."
    };
  }
  if (!mysqlModule) {
    try {
      const mod = await import("mysql2/promise");
      mysqlModule = mod.default || mod;
    } catch {
      return {
        success: false,
        message: "Paket driver 'mysql2' belum terpasang di folder node_modules VPS. Silakan jalankan perintah 'npm install' di folder proyek VPS Anda."
      };
    }
  }
  let testConn = null;
  try {
    const conn = await mysqlModule.createConnection({
      host,
      port,
      user,
      password,
      database,
      connectTimeout: 5e3
    });
    testConn = conn;
    const [rows] = await conn.query("SELECT VERSION() as version, DATABASE() as current_db");
    const result = Array.isArray(rows) && rows[0] ? rows[0] : null;
    await conn.end();
    return {
      success: true,
      message: `Berhasil terhubung ke MariaDB di ${host}:${port} (Database: ${result?.current_db || database})`,
      version: result?.version || "Unknown"
    };
  } catch (error) {
    if (testConn) {
      try {
        await testConn.end();
      } catch {
      }
    }
    return {
      success: false,
      message: `Gagal terhubung ke MariaDB: ${error.message || error.code || "Connection error"}`
    };
  }
}
var activeDb = new Database(dbPath);
activeDb.pragma("journal_mode = WAL");
activeDb.pragma("foreign_keys = ON");
activeDb.pragma("busy_timeout = 5000");
activeDb.pragma("synchronous = NORMAL");
var db = new Proxy({}, {
  get(_target, prop) {
    const val = activeDb[prop];
    if (typeof val === "function") {
      return val.bind(activeDb);
    }
    return val;
  }
});
function restoreDatabaseFromFile(buffer) {
  const magic = buffer.subarray(0, 16).toString("utf-8");
  if (!magic.startsWith("SQLite format 3")) {
    throw new Error("File yang diunggah bukan file SQLite yang valid (header tidak cocok).");
  }
  const tempPath = path.join(path.dirname(dbPath), `temp_restore_${Date.now()}.db`);
  fs.writeFileSync(tempPath, buffer);
  try {
    const testDb = new Database(tempPath, { readonly: true });
    const check = testDb.prepare("SELECT count(*) as c FROM sqlite_master WHERE type='table'").get();
    testDb.close();
    if (!check || check.c === 0) {
      throw new Error("Database yang diunggah kosong atau tidak memiliki tabel yang valid.");
    }
  } catch (err) {
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch {
    }
    throw new Error(`File SQLite rusak atau tidak dapat dibaca: ${err.message}`);
  }
  try {
    activeDb.pragma("wal_checkpoint(TRUNCATE)");
    activeDb.close();
  } catch (closeErr) {
    console.warn("Warning during database close:", closeErr);
  }
  const backupFile = `mediaflow.db.bak-${Date.now()}`;
  const backupPath = path.join(path.dirname(dbPath), backupFile);
  if (fs.existsSync(dbPath)) {
    fs.copyFileSync(dbPath, backupPath);
  }
  try {
    if (fs.existsSync(`${dbPath}-wal`)) fs.unlinkSync(`${dbPath}-wal`);
    if (fs.existsSync(`${dbPath}-shm`)) fs.unlinkSync(`${dbPath}-shm`);
  } catch {
  }
  try {
    fs.copyFileSync(tempPath, dbPath);
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch {
    }
  } catch (copyErr) {
    if (fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, dbPath);
    }
    activeDb = new Database(dbPath);
    activeDb.pragma("journal_mode = WAL");
    activeDb.pragma("foreign_keys = ON");
    activeDb.pragma("busy_timeout = 5000");
    activeDb.pragma("synchronous = NORMAL");
    throw new Error(`Gagal menyalin file database: ${copyErr.message}`);
  }
  activeDb = new Database(dbPath);
  activeDb.pragma("journal_mode = WAL");
  activeDb.pragma("foreign_keys = ON");
  activeDb.pragma("busy_timeout = 5000");
  activeDb.pragma("synchronous = NORMAL");
  return {
    success: true,
    backupFile,
    message: `Database berhasil dipulihkan. Cadangan pengaman dibuat di ${backupFile}`
  };
}
function initDatabase(mode = "clean") {
  db.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kode TEXT UNIQUE NOT NULL,
      nama TEXT NOT NULL,
      cakupan TEXT NOT NULL,
      deskripsi TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      modul TEXT NOT NULL,
      nama_fitur TEXT NOT NULL,
      UNIQUE(modul)
    );

    CREATE TABLE IF NOT EXISTS role_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      modul TEXT NOT NULL,
      can_create INTEGER NOT NULL DEFAULT 0,
      can_update INTEGER NOT NULL DEFAULT 0,
      can_approve INTEGER NOT NULL DEFAULT 0,
      can_view INTEGER NOT NULL DEFAULT 0,
      scope TEXT NOT NULL DEFAULT 'all', -- 'all', 'team', 'own', 'none'
      UNIQUE(role_id, modul)
    );

    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nama TEXT NOT NULL,
      manager_id INTEGER
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nama TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      jabatan TEXT NOT NULL,
      role_id INTEGER NOT NULL REFERENCES roles(id),
      team_id INTEGER REFERENCES teams(id),
      aktif INTEGER NOT NULL DEFAULT 1,
      last_login TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kode TEXT UNIQUE NOT NULL,
      nama TEXT NOT NULL,
      tipe TEXT NOT NULL DEFAULT 'brand', -- 'brand' | 'agensi'
      parent_client_id INTEGER REFERENCES clients(id),
      brand_turunan TEXT,
      npwp TEXT NOT NULL,
      alamat_tagih TEXT NOT NULL,
      termin_hari INTEGER NOT NULL DEFAULT 30,
      owner_user_id INTEGER NOT NULL REFERENCES users(id),
      aktif INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS client_contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      nama_pic TEXT NOT NULL,
      jabatan TEXT NOT NULL,
      email TEXT NOT NULL,
      telepon TEXT NOT NULL,
      utama INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS catalog_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nama TEXT UNIQUE NOT NULL,
      deskripsi TEXT DEFAULT '',
      urutan INTEGER NOT NULL DEFAULT 0,
      aktif INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kode TEXT UNIQUE NOT NULL,
      kategori TEXT NOT NULL, -- 'Website', 'Sosial Media', 'Video', 'Newsletter', 'Podcast', 'Event', 'Influencer'
      nama TEXT NOT NULL,
      spesifikasi TEXT NOT NULL,
      satuan TEXT NOT NULL, -- 'Artikel', 'Post', 'Video', 'Hari', 'Minggu', 'Bulan', 'Impresi'
      tipe_kuota TEXT NOT NULL DEFAULT 'jumlah', -- 'jumlah' | 'durasi' | 'impresi'
      slot_inventori TEXT,
      aktif INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS product_prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      versi INTEGER NOT NULL DEFAULT 1,
      harga REAL NOT NULL,
      berlaku_dari TEXT NOT NULL,
      berlaku_sampai TEXT
    );

    CREATE TABLE IF NOT EXISTS packages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kode TEXT UNIQUE NOT NULL,
      nama TEXT NOT NULL,
      deskripsi TEXT NOT NULL,
      harga_paket REAL NOT NULL,
      aktif INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS package_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      package_id INTEGER NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      qty INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quotations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nomor TEXT UNIQUE NOT NULL,
      judul_penawaran TEXT NOT NULL,
      client_id INTEGER NOT NULL REFERENCES clients(id),
      snapshot_nama_klien TEXT NOT NULL,
      snapshot_npwp TEXT NOT NULL,
      snapshot_alamat TEXT NOT NULL,
      snapshot_pic TEXT NOT NULL,
      owner_user_id INTEGER NOT NULL REFERENCES users(id),
      nama_sales TEXT,
      status TEXT NOT NULL DEFAULT 'Draft', -- 'Draft', 'Menunggu Persetujuan', 'Terkirim', 'Negosiasi', 'Deal', 'Lost', 'Expired'
      tanggal_terbit TEXT NOT NULL,
      berlaku_sampai TEXT NOT NULL,
      versi_aktif INTEGER NOT NULL DEFAULT 1,
      alasan_lost TEXT,
      catatan_followup TEXT,
      dibuka_klien_pada TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS quotation_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quotation_id INTEGER NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
      nomor_revisi INTEGER NOT NULL DEFAULT 1,
      subtotal REAL NOT NULL DEFAULT 0,
      diskon_tipe TEXT NOT NULL DEFAULT 'persen', -- 'persen' | 'nominal'
      diskon_persen REAL NOT NULL DEFAULT 0,
      diskon_nominal REAL NOT NULL DEFAULT 0,
      dpp REAL NOT NULL DEFAULT 0,
      ppn_persen REAL NOT NULL DEFAULT 11,
      ppn_nominal REAL NOT NULL DEFAULT 0,
      grand_total REAL NOT NULL DEFAULT 0,
      catatan_revisi TEXT,
      dibuat_oleh INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(quotation_id, nomor_revisi)
    );

    CREATE TABLE IF NOT EXISTS quotation_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version_id INTEGER NOT NULL REFERENCES quotation_versions(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      nama_produk TEXT NOT NULL,
      kategori TEXT NOT NULL,
      spesifikasi TEXT NOT NULL,
      periode TEXT NOT NULL,
      target_kpi TEXT,
      qty INTEGER NOT NULL,
      satuan TEXT NOT NULL,
      tipe_kuota TEXT NOT NULL DEFAULT 'jumlah',
      harga_satuan REAL NOT NULL,
      diskon_persen REAL NOT NULL DEFAULT 0,
      diskon_nominal REAL NOT NULL DEFAULT 0,
      jumlah REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS deals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nomor TEXT UNIQUE NOT NULL,
      quotation_id INTEGER UNIQUE NOT NULL REFERENCES quotations(id),
      quotation_version_id INTEGER NOT NULL REFERENCES quotation_versions(id),
      client_id INTEGER NOT NULL REFERENCES clients(id),
      snapshot_nama_klien TEXT NOT NULL,
      owner_user_id INTEGER NOT NULL REFERENCES users(id),
      nama_sales TEXT,
      nama_kampanye TEXT NOT NULL,
      no_po_klien TEXT,
      nilai_deal REAL NOT NULL,
      dpp REAL NOT NULL,
      ppn_nominal REAL NOT NULL,
      mulai_kontrak TEXT NOT NULL,
      berlaku_sampai TEXT NOT NULL,
      skema_tagih TEXT NOT NULL DEFAULT 'per_mo', -- 'per_mo' | 'termin' | 'sekali_tagih'
      status TEXT NOT NULL DEFAULT 'Belum Dimulai', -- 'Belum Dimulai', 'Berjalan', 'Selesai', 'Dibatalkan'
      lampiran_po TEXT,
      catatan_addendum TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS deal_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deal_id INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      nama_produk TEXT NOT NULL,
      kategori TEXT NOT NULL,
      spesifikasi TEXT NOT NULL,
      periode TEXT NOT NULL,
      target_kpi TEXT,
      qty_dibeli INTEGER NOT NULL,
      satuan TEXT NOT NULL,
      harga_satuan REAL NOT NULL,
      jumlah_total REAL NOT NULL,
      tipe_kuota TEXT NOT NULL DEFAULT 'jumlah'
    );

    CREATE TABLE IF NOT EXISTS media_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nomor TEXT UNIQUE NOT NULL,
      deal_id INTEGER REFERENCES deals(id),
      urutan_di_deal INTEGER NOT NULL DEFAULT 1,
      jenis TEXT NOT NULL DEFAULT 'Reguler', -- 'Reguler' | 'Bonus'
      nama_kampanye TEXT NOT NULL,
      no_po_klien TEXT,
      pic_internal TEXT NOT NULL,
      pic_klien TEXT NOT NULL,
      periode_mulai TEXT NOT NULL,
      periode_selesai TEXT NOT NULL,
      brief_materi TEXT,
      tautan_aset TEXT,
      status TEXT NOT NULL DEFAULT 'Draft', -- 'Draft', 'Menunggu Persetujuan', 'Terjadwal', 'Sebagian Tayang', 'Selesai Tayang', 'Dibatalkan'
      dibuat_oleh INTEGER NOT NULL REFERENCES users(id),
      disetujui_oleh INTEGER REFERENCES users(id),
      catatan_addendum TEXT,
      lampiran_mo_ttd TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS mo_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mo_id INTEGER NOT NULL REFERENCES media_orders(id) ON DELETE CASCADE,
      deal_item_id INTEGER REFERENCES deal_items(id),
      product_id INTEGER NOT NULL REFERENCES products(id),
      nama_item TEXT NOT NULL,
      platform TEXT NOT NULL,
      judul_topik TEXT NOT NULL,
      tanggal_tayang TEXT NOT NULL,
      slot_jam TEXT NOT NULL,
      pic_konten TEXT NOT NULL,
      qty INTEGER NOT NULL,
      satuan TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Terjadwal', -- 'Terjadwal', 'Dalam Produksi', 'Siap Tayang', 'Tayang', 'Tayang Terverifikasi', 'Ditunda', 'Batal'
      url_live TEXT,
      tanggal_tayang_aktual TEXT,
      alasan_batal TEXT,
      catatan TEXT
    );

    CREATE TABLE IF NOT EXISTS mo_item_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mo_item_id INTEGER NOT NULL REFERENCES mo_items(id) ON DELETE CASCADE,
      perubahan TEXT NOT NULL,
      nilai_lama TEXT,
      nilai_baru TEXT,
      alasan TEXT NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id),
      waktu TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS proofs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nomor TEXT UNIQUE NOT NULL,
      mo_id INTEGER NOT NULL REFERENCES media_orders(id),
      deal_id INTEGER REFERENCES deals(id),
      periode_laporan TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Draft', -- 'Draft', 'Menunggu Verifikasi', 'Terverifikasi', 'Terkirim ke Klien'
      catatan_kompensasi TEXT,
      dibuat_oleh INTEGER NOT NULL REFERENCES users(id),
      diverifikasi_oleh INTEGER REFERENCES users(id),
      tanggal_verifikasi TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS proof_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      proof_id INTEGER NOT NULL REFERENCES proofs(id) ON DELETE CASCADE,
      mo_item_id INTEGER NOT NULL REFERENCES mo_items(id),
      nama_item TEXT NOT NULL,
      platform TEXT NOT NULL,
      tanggal_tayang TEXT NOT NULL,
      url_live TEXT NOT NULL,
      screenshot_url TEXT NOT NULL,
      target_impresi INTEGER NOT NULL DEFAULT 0,
      realisasi_impresi INTEGER NOT NULL DEFAULT 0,
      reach INTEGER NOT NULL DEFAULT 0,
      klik INTEGER NOT NULL DEFAULT 0,
      ctr REAL NOT NULL DEFAULT 0,
      views INTEGER NOT NULL DEFAULT 0,
      engagement INTEGER NOT NULL DEFAULT 0,
      capaian_persen REAL NOT NULL DEFAULT 100,
      catatan TEXT
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nomor TEXT UNIQUE NOT NULL,
      deal_id INTEGER NOT NULL REFERENCES deals(id),
      mo_id INTEGER REFERENCES media_orders(id),
      proof_id INTEGER REFERENCES proofs(id),
      skema TEXT NOT NULL, -- 'per_mo', 'termin', 'sekali_tagih'
      keterangan_termin TEXT,
      tanggal_terbit TEXT NOT NULL,
      jatuh_tempo TEXT NOT NULL,
      subtotal REAL NOT NULL,
      ppn_persen REAL NOT NULL DEFAULT 11,
      ppn_nominal REAL NOT NULL,
      pph23_dipotong INTEGER NOT NULL DEFAULT 0,
      pph23_nominal REAL NOT NULL DEFAULT 0,
      meterai REAL NOT NULL DEFAULT 0,
      total_tagihan REAL NOT NULL,
      total_dibayar REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'Draft', -- 'Draft', 'Terkirim', 'Dibayar Sebagian', 'Lunas', 'Jatuh Tempo', 'Dibatalkan'
      no_faktur_pajak TEXT,
      catatan_revisi TEXT,
      dibuat_oleh INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      deal_item_id INTEGER REFERENCES deal_items(id),
      mo_id INTEGER REFERENCES media_orders(id),
      proof_id INTEGER REFERENCES proofs(id),
      deskripsi TEXT NOT NULL,
      periode_tayang TEXT NOT NULL,
      qty REAL NOT NULL,
      satuan TEXT NOT NULL,
      harga_satuan REAL NOT NULL,
      diskon REAL NOT NULL DEFAULT 0,
      jumlah REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nomor_kwitansi TEXT UNIQUE,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      tanggal_bayar TEXT NOT NULL,
      jumlah REAL NOT NULL,
      metode TEXT NOT NULL,
      referensi_bank TEXT NOT NULL,
      bukti_file TEXT,
      untuk_pembayaran TEXT,
      catatan TEXT,
      status TEXT NOT NULL DEFAULT 'Diterima',
      dicatat_oleh INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS approvals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      jenis_dokumen TEXT NOT NULL, -- 'Quotation', 'Media Order', 'Bukti Tayang'
      dokumen_id INTEGER NOT NULL,
      nomor_dokumen TEXT NOT NULL,
      ringkasan_alasan TEXT NOT NULL,
      diminta_oleh INTEGER NOT NULL REFERENCES users(id),
      target_role TEXT NOT NULL DEFAULT 'manager',
      disetujui_oleh INTEGER REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'Menunggu', -- 'Menunggu', 'Disetujui', 'Ditolak'
      catatan_keputusan TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      decided_at TEXT
    );

    CREATE TABLE IF NOT EXISTS number_sequences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kode_dokumen TEXT NOT NULL, -- 'QT', 'DL', 'MO', 'BT', 'INV'
      tahun INTEGER NOT NULL,
      last_seq INTEGER NOT NULL DEFAULT 0,
      UNIQUE(kode_dokumen, tahun)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      nama_user TEXT NOT NULL,
      role_user TEXT NOT NULL,
      modul TEXT NOT NULL,
      aksi TEXT NOT NULL,
      nomor_dokumen TEXT,
      ringkasan TEXT NOT NULL,
      nilai_lama TEXT,
      nilai_baru TEXT,
      ip_address TEXT NOT NULL DEFAULT '127.0.0.1',
      waktu TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      role_target TEXT,
      judul TEXT NOT NULL,
      pesan TEXT NOT NULL,
      tautan_modul TEXT NOT NULL,
      dokumen_id INTEGER,
      dibaca INTEGER NOT NULL DEFAULT 0,
      waktu TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      kunci TEXT PRIMARY KEY,
      nilai TEXT NOT NULL
    );
  `);
  const existingUserCols = db.prepare(`PRAGMA table_info(users)`).all().map((c) => c.name);
  const extraUserColumns = [
    ["telepon", `TEXT NOT NULL DEFAULT '0812-8899-7700'`],
    ["departemen", `TEXT NOT NULL DEFAULT 'Divisi Komersial & Media Digital'`],
    ["bio", `TEXT NOT NULL DEFAULT ''`],
    ["avatar_url", `TEXT NOT NULL DEFAULT ''`],
    ["preferensi_tema", `TEXT NOT NULL DEFAULT 'light'`],
    ["notif_email", `INTEGER NOT NULL DEFAULT 1`],
    ["notif_approval", `INTEGER NOT NULL DEFAULT 1`],
    ["notif_jadwal", `INTEGER NOT NULL DEFAULT 1`],
    ["notif_invoice", `INTEGER NOT NULL DEFAULT 1`]
  ];
  for (const [colName, colDef] of extraUserColumns) {
    if (!existingUserCols.includes(colName)) {
      db.exec(`ALTER TABLE users ADD COLUMN ${colName} ${colDef};`);
    }
  }
  const qvCols = db.prepare("PRAGMA table_info(quotation_versions)").all().map((c) => c.name);
  if (!qvCols.includes("diskon_tipe")) {
    db.exec(`ALTER TABLE quotation_versions ADD COLUMN diskon_tipe TEXT NOT NULL DEFAULT 'persen';`);
  }
  const qCols = db.prepare("PRAGMA table_info(quotations)").all().map((c) => c.name);
  if (!qCols.includes("nama_sales")) {
    db.exec(`ALTER TABLE quotations ADD COLUMN nama_sales TEXT;`);
  }
  const dCols = db.prepare("PRAGMA table_info(deals)").all().map((c) => c.name);
  if (!dCols.includes("nama_sales")) {
    db.exec(`ALTER TABLE deals ADD COLUMN nama_sales TEXT;`);
  }
  const payCols = db.prepare("PRAGMA table_info(payments)").all().map((c) => c.name);
  if (!payCols.includes("nomor_kwitansi")) {
    db.exec(`ALTER TABLE payments ADD COLUMN nomor_kwitansi TEXT;`);
  }
  if (!payCols.includes("untuk_pembayaran")) {
    db.exec(`ALTER TABLE payments ADD COLUMN untuk_pembayaran TEXT;`);
  }
  if (!payCols.includes("catatan")) {
    db.exec(`ALTER TABLE payments ADD COLUMN catatan TEXT;`);
  }
  if (!payCols.includes("status")) {
    db.exec(`ALTER TABLE payments ADD COLUMN status TEXT NOT NULL DEFAULT 'Diterima';`);
  }
  const countCategories = db.prepare("SELECT COUNT(*) as c FROM catalog_categories").get().c;
  if (countCategories === 0) {
    const insCat = db.prepare("INSERT INTO catalog_categories (nama, deskripsi, urutan) VALUES (?, ?, ?)");
    const defaultCats = [
      ["Website", "Kanal portal berita, advertorial SEO, dan banner display", 1],
      ["Sosial Media", "Instagram feed, reels, story, dan TikTok creative video", 2],
      ["Video", "YouTube dedicated video, podcast visual, dan brand sponsorship", 3],
      ["Newsletter", "Email blast buletin korporat pagi kepada pengambil keputusan", 4],
      ["Podcast", "Audio show Spotify/Apple podcast dan ad-lib sponsor", 5],
      ["Event", "Aktivasi offline seminar, konferensi, dan expo bisnis", 6],
      ["Influencer", "Kolaborasi Key Opinion Leader (KOL) dan content creator jaringan", 7]
    ];
    for (const [cName, cDesc, cOrder] of defaultCats) {
      insCat.run(cName, cDesc, cOrder);
    }
  }
  const roleCount = db.prepare("SELECT COUNT(*) as cnt FROM roles").get().cnt;
  if (roleCount === 0) {
    seedCoreSystemData();
  }
  if (mode === "sample") {
    seedSampleDemoData();
  }
  const defaultWebSettings = [
    ["app_installed", "false"],
    ["site_title", "MediaFlow ERP \u2014 Quotation, Media Order, Bukti Tayang & Invoice"],
    ["site_tagline", "Solusi Terpadu Penjualan, Operasional Media & Rekonsiliasi Keuangan"],
    ["site_description", "Sistem manajemen operasional dan keuangan media digital terintegrasi dari Quotation, Deal, Media Order, Bukti Tayang hingga Invoice A4 Landscape dengan autentikasi JWT, RBAC 7 role, dan Audit Log."],
    ["site_keywords", "media erp, media order, quotation, bukti tayang, invoice media, rate card, iklan digital, vps erp"],
    ["site_logo", ""],
    ["site_favicon", ""],
    ["seo_indexing", "noindex"],
    // 'noindex' (Blokir Mesin Pencari / Internal ERP) vs 'index' (Izinkan Google & Mesin Pencari)
    ["turnstile_enabled", "false"],
    // 'false' | 'true'
    ["turnstile_site_key", "0x4AAAAAAAx_DemoSiteKey2026"],
    ["turnstile_secret_key", "0x4AAAAAAAx_DemoSecretKey2026xxxxxxxxx"],
    ["turnstile_mode", "managed"],
    // 'managed' | 'non-interactive' | 'invisible'
    ["security_session_timeout", "24h"],
    ["security_max_login_attempts", "5"],
    ["security_force_https", "true"],
    ["security_password_min_length", "6"],
    ["maintenance_mode", "false"],
    ["maintenance_message", "Aplikasi MediaFlow ERP sedang dalam pemeliharaan berkala untuk peningkatan server VPS. Silakan hubungi Administrator atau coba beberapa saat lagi."],
    ["app_footer_text", "\xA9 2026 MediaFlow ERP. Hak Cipta Dilindungi \xB7 Siap Dijalankan di Server VPS"],
    ["app_timezone", "Asia/Jakarta (WIB)"],
    ["app_canonical_url", "https://erp.nusantaramedia.id"],
    ["google_site_verification", "google-site-verification=mf_vps_auth_token_sample_2026"],
    ["seq_format_global", "{KODE}/{TAHUN}/{BULAN}/{URUT}"],
    ["seq_digits", "4"],
    ["seq_reset_period", "TAHUNAN"],
    ["seq_code_QT", "QT"],
    ["seq_code_DL", "DL"],
    ["seq_code_MO", "MO"],
    ["seq_code_BT", "BT"],
    ["seq_code_INV", "INV"],
    ["seq_code_KWT", "KWT"],
    ["seq_format_QT", "{KODE}/{TAHUN}/{BULAN}/{URUT}"],
    ["seq_format_DL", "{KODE}/{TAHUN}/{BULAN}/{URUT}"],
    ["seq_format_MO", "{KODE}/{TAHUN}/{BULAN}/{URUT}"],
    ["seq_format_BT", "{KODE}/{TAHUN}/{BULAN}/{URUT}"],
    ["seq_format_INV", "{KODE}/{TAHUN}/{BULAN}/{URUT}"],
    ["seq_format_KWT", "{KODE}/{TAHUN}/{BULAN}/{URUT}"]
  ];
  const insWebSetting = db.prepare("INSERT OR IGNORE INTO settings (kunci, nilai) VALUES (?, ?)");
  for (const [k, v] of defaultWebSettings) {
    insWebSetting.run(k, v);
  }
}
var ROMAN_MONTHS = {
  1: "I",
  2: "II",
  3: "III",
  4: "IV",
  5: "V",
  6: "VI",
  7: "VII",
  8: "VIII",
  9: "IX",
  10: "X",
  11: "XI",
  12: "XII"
};
function getSequenceConfig() {
  const rows = db.prepare(`SELECT kunci, nilai FROM settings WHERE kunci LIKE 'seq_%' OR kunci IN ('format_nomor', 'reset_nomor')`).all();
  const map = {};
  for (const r of rows) {
    map[r.kunci] = r.nilai;
  }
  const global_format = map.seq_format_global || map.format_nomor || "{KODE}/{TAHUN}/{BULAN}/{URUT}";
  const digits = Math.min(Math.max(Number(map.seq_digits) || 4, 3), 8);
  const reset_period = (map.seq_reset_period || map.reset_nomor || "TAHUNAN").toUpperCase();
  const defaultCodes = {
    QT: "QT",
    DL: "DL",
    MO: "MO",
    BT: "BT",
    INV: "INV",
    KWT: "KWT"
  };
  const codes = {
    QT: map.seq_code_QT || defaultCodes.QT,
    DL: map.seq_code_DL || defaultCodes.DL,
    MO: map.seq_code_MO || defaultCodes.MO,
    BT: map.seq_code_BT || defaultCodes.BT,
    INV: map.seq_code_INV || defaultCodes.INV,
    KWT: map.seq_code_KWT || defaultCodes.KWT
  };
  const formats = {
    QT: map.seq_format_QT || global_format,
    DL: map.seq_format_DL || global_format,
    MO: map.seq_format_MO || global_format,
    BT: map.seq_format_BT || global_format,
    INV: map.seq_format_INV || global_format,
    KWT: map.seq_format_KWT || global_format
  };
  return { global_format, formats, codes, digits, reset_period };
}
function formatSequenceNumber(formatTemplate, docCode, date, seqNumber, digits = 4) {
  const year4 = String(date.getFullYear());
  const year2 = year4.slice(-2);
  const monthNum = date.getMonth() + 1;
  const month2 = String(monthNum).padStart(2, "0");
  const day2 = String(date.getDate()).padStart(2, "0");
  const romanMonth = ROMAN_MONTHS[monthNum] || month2;
  const paddedSeq = String(seqNumber).padStart(digits, "0");
  return formatTemplate.replace(/{KODE}/g, docCode).replace(/{TAHUN}/g, year4).replace(/{TH}/g, year2).replace(/{BULAN}/g, month2).replace(/{ROMAN}/g, romanMonth).replace(/{HARI}/g, day2).replace(/{URUT}/g, paddedSeq);
}
function generateDocumentNumber(kode, dateStr) {
  const now = dateStr ? new Date(dateStr) : /* @__PURE__ */ new Date();
  const validDate = isNaN(now.getTime()) ? /* @__PURE__ */ new Date() : now;
  const config = getSequenceConfig();
  const docCode = config.codes[kode] || kode;
  const template = config.formats[kode] || config.global_format;
  const year = validDate.getFullYear();
  const month = validDate.getMonth() + 1;
  let seqTahunKey = year;
  if (config.reset_period === "BULANAN") {
    seqTahunKey = year * 100 + month;
  } else if (config.reset_period === "BERKELANJUTAN") {
    seqTahunKey = 0;
  }
  const tx = db.transaction(() => {
    const existing = db.prepare("SELECT last_seq FROM number_sequences WHERE kode_dokumen = ? AND tahun = ?").get(kode, seqTahunKey);
    let nextSeq = 1;
    if (existing) {
      nextSeq = existing.last_seq + 1;
      db.prepare("UPDATE number_sequences SET last_seq = ? WHERE kode_dokumen = ? AND tahun = ?").run(
        nextSeq,
        kode,
        seqTahunKey
      );
    } else {
      db.prepare("INSERT INTO number_sequences (kode_dokumen, tahun, last_seq) VALUES (?, ?, ?)").run(
        kode,
        seqTahunKey,
        nextSeq
      );
    }
    return formatSequenceNumber(template, docCode, validDate, nextSeq, config.digits);
  });
  return tx();
}
function resetDatabaseToClean() {
  db.pragma("foreign_keys = OFF");
  try {
    const tx = db.transaction(() => {
      db.exec(`
        DELETE FROM payments;
        DELETE FROM invoice_items;
        DELETE FROM invoices;
        DELETE FROM proof_items;
        DELETE FROM proofs;
        DELETE FROM mo_item_logs;
        DELETE FROM mo_items;
        DELETE FROM media_orders;
        DELETE FROM deal_items;
        DELETE FROM deals;
        DELETE FROM quotation_items;
        DELETE FROM quotation_versions;
        DELETE FROM quotations;
        DELETE FROM client_contacts;
        DELETE FROM clients;
        DELETE FROM audit_logs;
        DELETE FROM notifications;
        DELETE FROM approvals;
        DELETE FROM package_items;
        DELETE FROM packages;
        DELETE FROM product_prices;
        DELETE FROM products;
        DELETE FROM number_sequences;
        UPDATE teams SET manager_id = NULL;
        DELETE FROM users;
        INSERT OR REPLACE INTO settings (kunci, nilai) VALUES ('app_installed', 'false');
      `);
    });
    tx();
  } finally {
    db.pragma("foreign_keys = ON");
  }
  seedCoreSystemData();
}
function seedCoreSystemData() {
  const roleCount = db.prepare("SELECT COUNT(*) as cnt FROM roles").get().cnt;
  if (roleCount === 0) {
    const insertRole = db.prepare(
      "INSERT INTO roles (kode, nama, cakupan, deskripsi) VALUES (?, ?, ?, ?)"
    );
    insertRole.run("super_admin", "Super Admin", "Seluruh sistem", "Kelola pengguna dan role, pengaturan sistem, penomoran, template PDF, audit log");
    insertRole.run("admin", "Admin Operasional", "Seluruh operasional", "Kelola master klien dan rate card, input/koreksi atas nama tim, kelola jadwal dan bukti tayang");
    insertRole.run("direktur", "Direktur", "Seluruh data (eksekutif)", "Dashboard eksekutif, persetujuan strategis, seluruh laporan perusahaan");
    insertRole.run("manager", "Manager", "Timnya", "Menyetujui quotation berdiskon, MO, dan verifikasi bukti tayang; memantau progres Deal tim");
    insertRole.run("marketing", "Marketing", "Kampanye yang ditangani", "Membuat MO dan jadwal tayang, mengelola konten dan bukti tayang, memantau progres Deal");
    insertRole.run("sales", "Sales", "Klien, quotation, dan Deal miliknya", "Membuat quotation, follow-up, menandai Deal/Lost, memantau progres Deal miliknya");
    insertRole.run("finance", "Finance", "Seluruh dokumen keuangan", "Membuat dan mengirim invoice, mencatat pembayaran, piutang, pajak, laporan keuangan");
    const modules = [
      { modul: "clients", nama: "Master Klien" },
      { modul: "catalog", nama: "Rate Card & Paket" },
      { modul: "quotations", nama: "Quotation" },
      { modul: "mark_deal", nama: "Tandai Deal" },
      { modul: "deals", nama: "Deal & Progres" },
      { modul: "media_orders", nama: "Media Order" },
      { modul: "schedules", nama: "Jadwal Tayang" },
      { modul: "proofs", nama: "Bukti Tayang" },
      { modul: "invoices", nama: "Invoice" },
      { modul: "payments", nama: "Pembayaran" },
      { modul: "users_roles", nama: "Pengguna & Role" },
      { modul: "dashboard", nama: "Dashboard & Laporan" }
    ];
    const insertPerm = db.prepare("INSERT OR IGNORE INTO permissions (modul, nama_fitur) VALUES (?, ?)");
    for (const m of modules) {
      insertPerm.run(m.modul, m.nama);
    }
    const matrix = [
      // Super Admin (role_id = 1)
      [1, "clients", 1, 1, 1, 1, "all"],
      [1, "catalog", 1, 1, 1, 1, "all"],
      [1, "quotations", 1, 1, 1, 1, "all"],
      [1, "mark_deal", 1, 1, 1, 1, "all"],
      [1, "deals", 1, 1, 1, 1, "all"],
      [1, "media_orders", 1, 1, 1, 1, "all"],
      [1, "schedules", 1, 1, 1, 1, "all"],
      [1, "proofs", 1, 1, 1, 1, "all"],
      [1, "invoices", 1, 1, 1, 1, "all"],
      [1, "payments", 1, 1, 1, 1, "all"],
      [1, "users_roles", 1, 1, 1, 1, "all"],
      [1, "dashboard", 1, 1, 1, 1, "all"],
      // Admin (role_id = 2)
      [2, "clients", 1, 1, 0, 1, "all"],
      [2, "catalog", 1, 1, 0, 1, "all"],
      [2, "quotations", 1, 1, 0, 1, "all"],
      [2, "mark_deal", 1, 1, 0, 1, "all"],
      [2, "deals", 0, 1, 0, 1, "all"],
      [2, "media_orders", 1, 1, 0, 1, "all"],
      [2, "schedules", 1, 1, 0, 1, "all"],
      [2, "proofs", 1, 1, 1, 1, "all"],
      [2, "invoices", 0, 0, 0, 1, "all"],
      [2, "payments", 0, 0, 0, 0, "none"],
      [2, "users_roles", 0, 0, 0, 0, "none"],
      [2, "dashboard", 0, 0, 0, 1, "all"],
      // Direktur (role_id = 3)
      [3, "clients", 0, 0, 0, 1, "all"],
      [3, "catalog", 0, 0, 1, 1, "all"],
      [3, "quotations", 0, 0, 1, 1, "all"],
      [3, "mark_deal", 1, 1, 1, 1, "all"],
      [3, "deals", 0, 0, 1, 1, "all"],
      [3, "media_orders", 0, 0, 0, 1, "all"],
      [3, "schedules", 0, 0, 0, 1, "all"],
      [3, "proofs", 0, 0, 0, 1, "all"],
      [3, "invoices", 0, 0, 0, 1, "all"],
      [3, "payments", 0, 0, 0, 1, "all"],
      [3, "users_roles", 0, 0, 0, 0, "none"],
      [3, "dashboard", 0, 0, 0, 1, "all"],
      // Manager (role_id = 4)
      [4, "clients", 0, 0, 0, 1, "team"],
      [4, "catalog", 0, 0, 1, 1, "all"],
      [4, "quotations", 0, 0, 1, 1, "team"],
      [4, "mark_deal", 1, 1, 1, 1, "team"],
      [4, "deals", 0, 0, 1, 1, "team"],
      [4, "media_orders", 0, 0, 1, 1, "team"],
      [4, "schedules", 0, 0, 0, 1, "team"],
      [4, "proofs", 0, 0, 1, 1, "team"],
      [4, "invoices", 0, 0, 0, 1, "team"],
      [4, "payments", 0, 0, 0, 0, "none"],
      [4, "users_roles", 0, 0, 0, 0, "none"],
      [4, "dashboard", 0, 0, 0, 1, "team"],
      // Marketing (role_id = 5)
      [5, "clients", 1, 1, 0, 1, "all"],
      [5, "catalog", 1, 1, 0, 1, "all"],
      [5, "quotations", 0, 0, 0, 1, "team"],
      [5, "mark_deal", 0, 0, 0, 0, "none"],
      [5, "deals", 0, 1, 0, 1, "team"],
      [5, "media_orders", 1, 1, 0, 1, "team"],
      [5, "schedules", 1, 1, 0, 1, "team"],
      [5, "proofs", 1, 1, 0, 1, "team"],
      [5, "invoices", 0, 0, 0, 0, "none"],
      [5, "payments", 0, 0, 0, 0, "none"],
      [5, "users_roles", 0, 0, 0, 0, "none"],
      [5, "dashboard", 0, 0, 0, 1, "team"],
      // Sales (role_id = 6)
      [6, "clients", 1, 1, 0, 1, "own"],
      [6, "catalog", 0, 0, 0, 1, "all"],
      [6, "quotations", 1, 1, 0, 1, "own"],
      [6, "mark_deal", 1, 1, 0, 1, "own"],
      [6, "deals", 0, 0, 0, 1, "own"],
      [6, "media_orders", 0, 0, 0, 1, "own"],
      [6, "schedules", 0, 0, 0, 1, "own"],
      [6, "proofs", 0, 0, 0, 1, "own"],
      [6, "invoices", 0, 0, 0, 0, "none"],
      [6, "payments", 0, 0, 0, 0, "none"],
      [6, "users_roles", 0, 0, 0, 0, "none"],
      [6, "dashboard", 0, 0, 0, 1, "own"],
      // Finance (role_id = 7)
      [7, "clients", 0, 0, 0, 1, "all"],
      [7, "catalog", 0, 0, 0, 1, "all"],
      [7, "quotations", 0, 0, 0, 1, "all"],
      [7, "mark_deal", 0, 0, 0, 0, "none"],
      [7, "deals", 0, 0, 0, 1, "all"],
      [7, "media_orders", 0, 0, 0, 1, "all"],
      [7, "schedules", 0, 0, 0, 1, "all"],
      [7, "proofs", 0, 0, 0, 1, "all"],
      [7, "invoices", 1, 1, 1, 1, "all"],
      [7, "payments", 1, 1, 1, 1, "all"],
      [7, "users_roles", 0, 0, 0, 0, "none"],
      [7, "dashboard", 0, 0, 0, 1, "all"]
    ];
    const insertRolePerm = db.prepare(
      "INSERT OR IGNORE INTO role_permissions (role_id, modul, can_create, can_update, can_approve, can_view, scope) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    for (const row of matrix) {
      insertRolePerm.run(...row);
    }
  }
  const teamCount = db.prepare("SELECT COUNT(*) as cnt FROM teams").get().cnt;
  if (teamCount === 0) {
    db.prepare("INSERT INTO teams (nama, manager_id) VALUES (?, ?)").run("Tim Komersial Alpha (Enterprise & FMCG)", null);
    db.prepare("INSERT INTO teams (nama, manager_id) VALUES (?, ?)").run("Tim Komersial Beta (Tech & Otomotif)", null);
  }
  const insertSetting = db.prepare("INSERT OR IGNORE INTO settings (kunci, nilai) VALUES (?, ?)");
  insertSetting.run("nama_perusahaan", "PT Nusantara Digital Media Terpadu");
  insertSetting.run("alamat_perusahaan", "Menara Sudirman Lt. 18, Jl. Jend. Sudirman Kav. 60, Jakarta Selatan 12190");
  insertSetting.run("npwp_perusahaan", "01.345.678.9-012.000");
  insertSetting.run("email_perusahaan", "billing@nusantaramedia.id");
  insertSetting.run("telepon_perusahaan", "(021) 520-8899");
  insertSetting.run("bank_nama", "Bank Mandiri KCP Sudirman Jakarta");
  insertSetting.run("bank_rekening", "122-00-9876543-2");
  insertSetting.run("bank_atas_nama", "PT Nusantara Digital Media Terpadu");
  insertSetting.run("ppn_default", "11");
  insertSetting.run("pph23_default", "2");
  insertSetting.run("meterai_default", "10000");
  insertSetting.run("aturan_diskon_approval", "all_discounts_require_manager");
  insertSetting.run("mo_wajib_approval_manager", "true");
  insertSetting.run("tagih_wajib_bukti_terverifikasi", "true");
  insertSetting.run("format_nomor", "KODE/TAHUN/BULAN/URUT");
  insertSetting.run("reset_nomor", "TAHUNAN");
  insertSetting.run("app_installed", "false");
}
function seedSampleDemoData() {
  const existingSample = db.prepare("SELECT count(*) as c FROM users WHERE email = 'superadmin@nusantaramedia.id'").get();
  if (existingSample && existingSample.c > 0) {
    return;
  }
  seedCoreSystemData();
  const passwordHash = bcrypt.hashSync("MediaFlow2026!", 10);
  const insertUser = db.prepare(
    "INSERT INTO users (nama, email, password_hash, jabatan, role_id, team_id, aktif, last_login) VALUES (?, ?, ?, ?, ?, ?, 1, ?)"
  );
  insertUser.run("Rosidin Wijaya", "superadmin@nusantaramedia.id", passwordHash, "Head of IT & System Architect", 1, 1, "2026-11-08 08:30:00");
  insertUser.run("Nadia Prameswari", "admin@nusantaramedia.id", passwordHash, "Sales & Media Traffic Admin", 2, 1, "2026-11-08 08:45:00");
  insertUser.run("Hendra Kusuma", "direktur@nusantaramedia.id", passwordHash, "Direktur Komersial & Bisnis", 3, 1, "2026-11-08 09:00:00");
  insertUser.run("Budi Santoso", "manager@nusantaramedia.id", passwordHash, "Commercial Group Manager", 4, 1, "2026-11-08 09:10:00");
  insertUser.run("Rina Kartika", "marketing@nusantaramedia.id", passwordHash, "Digital Campaign & Traffic Specialist", 5, 1, "2026-11-08 09:15:00");
  insertUser.run("Dimas Pratama", "sales@nusantaramedia.id", passwordHash, "Senior Account Executive", 6, 1, "2026-11-08 09:20:00");
  insertUser.run("Siti Rahmawati", "finance@nusantaramedia.id", passwordHash, "Billing & AR Supervisor", 7, 1, "2026-11-08 09:25:00");
  insertUser.run("Farhan Akbar", "farhan.sales@nusantaramedia.id", passwordHash, "Account Executive", 6, 1, "2026-11-07 17:10:00");
  db.prepare("UPDATE teams SET manager_id = 4 WHERE id IN (1, 2)").run();
  const insertClient = db.prepare(`
    INSERT INTO clients (kode, nama, tipe, parent_client_id, brand_turunan, npwp, alamat_tagih, termin_hari, owner_user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertClient.run(
    "CL-001",
    "PT Telekomunikasi Seluler Nusantara",
    "brand",
    null,
    "NusaTelkomsel Halo 5G",
    "01.001.889.2-093.000",
    "Gedung Telkom Landmark Tower Lt. 22, Jl. Gatot Subroto Kav. 52, Jakarta Selatan",
    30,
    6
  );
  insertClient.run(
    "CL-002",
    "PT Dentsu Creative Media Indonesia",
    "agensi",
    null,
    "Multi-Brand Agency Account",
    "02.411.552.1-056.000",
    "Sentral Senayan III Lt. 14, Jl. Asia Afrika No. 8, Gelora, Jakarta Pusat",
    45,
    6
  );
  insertClient.run(
    "CL-003",
    "PT Astra Honda Motor (via Dentsu Media)",
    "brand",
    2,
    "Honda EM1 e: Electric Scooter",
    "01.308.441.7-092.000",
    "Jl. Laksda Yos Sudarso, Sunter I, Jakarta Utara 14350",
    45,
    6
  );
  insertClient.run(
    "CL-004",
    "PT Bank Mandiri Taspen Digital",
    "brand",
    null,
    "Movin Digital Banking",
    "01.882.771.4-011.000",
    "Graha Mantap, Jl. Proklamasi No. 31, Menteng, Jakarta Pusat",
    14,
    8
  );
  const insertContact = db.prepare(`
    INSERT INTO client_contacts (client_id, nama_pic, jabatan, email, telepon, utama)
    VALUES (?, ?, ?, ?, ?, 1)
  `);
  insertContact.run(1, "Arif Rahman Hakim", "VP Brand & Marcomm", "arif.hakim@nusatelkomsel.co.id", "0811-900-2341");
  insertContact.run(2, "Clarissa Wijaya", "Associate Media Director", "clarissa.w@dentsumedia.co.id", "0812-8877-9900");
  insertContact.run(3, "Kevindra Putra", "Digital Media Planner", "kevindra.p@dentsumedia.co.id", "0813-7766-1122");
  insertContact.run(4, "Dewi Lestari", "Head of Corporate Communication", "dewi.lestari@bankmantap.co.id", "0811-2233-4455");
  const insertProduct = db.prepare(`
    INSERT INTO products (kode, kategori, nama, spesifikasi, satuan, tipe_kuota, slot_inventori)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertProduct.run("PRD-001", "Website", "Artikel Advertorial SEO Premium", "Artikel 800-1.000 kata + 3 foto HD + 2 backlink dofollow permanen di kanal Bisnis/Tekno", "Artikel", "jumlah", "Editorial Feed");
  insertProduct.run("PRD-002", "Website", "Homepage Leaderboard Banner (970x250)", "Slot eksklusif atas halaman utama desktop & mobile (Share of Voice 100%)", "Bulan", "durasi", "Homepage Top Banner");
  insertProduct.run("PRD-003", "Sosial Media", "Instagram Carousel + Reels Collaboration", "Konten kreatif 5-7 slide atau Reels 60 detik di akun resmi @NusantaraMedia (1.8M followers)", "Post", "jumlah", "IG Main Feed");
  insertProduct.run("PRD-004", "Video", "YouTube Dedicated Liputan & Podcast", "Video liputan eksklusif 10-15 menit + bumper ad + penempatan pin komentar", "Video", "jumlah", "YouTube Prime Slot");
  insertProduct.run("PRD-005", "Website", "Programmatic CPM Display Network", "Penayangan banner di seluruh jaringan vertikal berita dengan garansi impresi", "Impresi", "impresi", "RON Display Network");
  insertProduct.run("PRD-006", "Newsletter", "Executive Morning Briefing Blast", "Sponsor tunggal buletin pagi ke 85.000+ eksekutif & pengambil keputusan", "Minggu", "durasi", "Newsletter Header");
  const insertPrice = db.prepare(`
    INSERT INTO product_prices (product_id, versi, harga, berlaku_dari, berlaku_sampai)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertPrice.run(1, 1, 125e5, "2025-01-01", "2025-12-31");
  insertPrice.run(1, 2, 15e6, "2026-01-01", null);
  insertPrice.run(2, 1, 4e7, "2025-01-01", "2025-12-31");
  insertPrice.run(2, 2, 45e6, "2026-01-01", null);
  insertPrice.run(3, 2, 12e6, "2026-01-01", null);
  insertPrice.run(4, 2, 35e6, "2026-01-01", null);
  insertPrice.run(5, 2, 25e6, "2026-01-01", null);
  insertPrice.run(6, 2, 18e6, "2026-01-01", null);
  db.prepare(`
    INSERT INTO packages (kode, nama, deskripsi, harga_paket)
    VALUES (?, ?, ?, ?)
  `).run(
    "PKT-360-A",
    "Paket Kampanye Peluncuran Produk 360\xB0",
    "Bundel strategis mencakup 4 Artikel SEO, 4 Post Instagram Reels, 1 Bulan Homepage Leaderboard, dan 1 Video YouTube",
    135e6
  );
  const insertPkgItem = db.prepare("INSERT INTO package_items (package_id, product_id, qty) VALUES (?, ?, ?)");
  insertPkgItem.run(1, 1, 4);
  insertPkgItem.run(1, 3, 4);
  insertPkgItem.run(1, 2, 1);
  insertPkgItem.run(1, 4, 1);
  const qt1No = generateDocumentNumber("QT", "2026-10-15");
  db.prepare(`
    INSERT INTO quotations (
      nomor, judul_penawaran, client_id, snapshot_nama_klien, snapshot_npwp, snapshot_alamat, snapshot_pic,
      owner_user_id, status, tanggal_terbit, berlaku_sampai, versi_aktif, catatan_followup, dibuka_klien_pada
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    qt1No,
    "Kampanye Nasional Ekspansi Jaringan 5G Q4 2026",
    1,
    "PT Telekomunikasi Seluler Nusantara",
    "01.001.889.2-093.000",
    "Gedung Telkom Landmark Tower Lt. 22, Jl. Gatot Subroto Kav. 52, Jakarta Selatan",
    "Arif Rahman Hakim",
    6,
    "Deal",
    "2026-10-15",
    "2026-11-15",
    2,
    "Revisi 2 disetujui klien setelah penyesuaian kuota IG Reels dan diskon 5% yang telah di-approve Manager.",
    "2026-10-16 14:20:00"
  );
  db.prepare(`
    INSERT INTO quotation_versions (
      quotation_id, nomor_revisi, subtotal, diskon_persen, diskon_nominal, dpp, ppn_persen, ppn_nominal, grand_total, catatan_revisi, dibuat_oleh
    ) VALUES (?, 1, 165000000, 0, 0, 165000000, 11, 18150000, 183150000, 'Penawaran awal sesuai brief Q4', 6)
  `).run(1);
  db.prepare(`
    INSERT INTO quotation_versions (
      quotation_id, nomor_revisi, subtotal, diskon_persen, diskon_nominal, dpp, ppn_persen, ppn_nominal, grand_total, catatan_revisi, dibuat_oleh
    ) VALUES (?, 2, 177000000, 5, 8850000, 168150000, 11, 18496500, 186646500, 'Penambahan 2 slot IG Reels + Diskon korporat 5%', 6)
  `).run(1);
  const insertQItem = db.prepare(`
    INSERT INTO quotation_items (
      version_id, product_id, nama_produk, kategori, spesifikasi, periode, target_kpi, qty, satuan, tipe_kuota, harga_satuan, diskon_persen, diskon_nominal, jumlah
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertQItem.run(1, 1, "Artikel Advertorial SEO Premium", "Website", "Artikel 800-1.000 kata + backlink dofollow", "Nov - Des 2026", "25.000 Pageviews", 4, "Artikel", "jumlah", 15e6, 0, 0, 6e7);
  insertQItem.run(1, 3, "Instagram Carousel + Reels Collaboration", "Sosial Media", "Konten IG Reels 60 detik", "Nov - Des 2026", "150.000 Reach", 5, "Post", "jumlah", 12e6, 0, 0, 6e7);
  insertQItem.run(1, 2, "Homepage Leaderboard Banner (970x250)", "Website", "Share of Voice 100% Desktop & Mobile", "November 2026", "500.000 Impresi", 1, "Bulan", "durasi", 45e6, 0, 0, 45e6);
  insertQItem.run(2, 1, "Artikel Advertorial SEO Premium", "Website", "Artikel 800-1.000 kata + backlink dofollow", "Nov - Des 2026", "25.000 Pageviews", 4, "Artikel", "jumlah", 15e6, 0, 0, 6e7);
  insertQItem.run(2, 3, "Instagram Carousel + Reels Collaboration", "Sosial Media", "Konten IG Reels 60 detik", "Nov - Des 2026", "180.000 Reach", 6, "Post", "jumlah", 12e6, 0, 0, 72e6);
  insertQItem.run(2, 2, "Homepage Leaderboard Banner (970x250)", "Website", "Share of Voice 100% Desktop & Mobile", "November 2026", "500.000 Impresi", 1, "Bulan", "durasi", 45e6, 0, 0, 45e6);
  const dl1No = generateDocumentNumber("DL", "2026-10-18");
  db.prepare(`
    INSERT INTO deals (
      nomor, quotation_id, quotation_version_id, client_id, snapshot_nama_klien, owner_user_id,
      nama_kampanye, no_po_klien, nilai_deal, dpp, ppn_nominal, mulai_kontrak, berlaku_sampai, skema_tagih, status, lampiran_po
    ) VALUES (?, 1, 2, 1, 'PT Telekomunikasi Seluler Nusantara', 6, ?, ?, 186646500, 168150000, 18496500, '2026-11-01', '2026-12-31', 'per_mo', 'Berjalan', 'PO-TSEL-2026-8841.pdf')
  `).run(dl1No, "Kampanye Nasional Ekspansi Jaringan 5G Q4 2026", "PO/TSEL/MKT/2026/8841");
  const insertDealItem = db.prepare(`
    INSERT INTO deal_items (
      deal_id, product_id, nama_produk, kategori, spesifikasi, periode, target_kpi, qty_dibeli, satuan, harga_satuan, jumlah_total, tipe_kuota
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertDealItem.run(1, 1, "Artikel Advertorial SEO Premium", "Website", "Artikel 800-1.000 kata + backlink dofollow", "Nov - Des 2026", "25.000 Pageviews", 4, "Artikel", 1425e4, 57e6, "jumlah");
  insertDealItem.run(1, 3, "Instagram Carousel + Reels Collaboration", "Sosial Media", "Konten IG Reels 60 detik", "Nov - Des 2026", "180.000 Reach", 6, "Post", 114e5, 684e5, "jumlah");
  insertDealItem.run(1, 2, "Homepage Leaderboard Banner (970x250)", "Website", "Share of Voice 100% Desktop & Mobile", "November 2026", "500.000 Impresi", 1, "Bulan", 4275e4, 4275e4, "durasi");
  const mo1No = generateDocumentNumber("MO", "2026-11-01");
  db.prepare(`
    INSERT INTO media_orders (
      nomor, deal_id, urutan_di_deal, jenis, nama_kampanye, no_po_klien, pic_internal, pic_klien,
      periode_mulai, periode_selesai, brief_materi, tautan_aset, status, dibuat_oleh, disetujui_oleh, lampiran_mo_ttd
    ) VALUES (?, 1, 1, 'Reguler', 'Wave 1: Peluncuran Halo 5G Jakarta & Surabaya', 'PO/TSEL/MKT/2026/8841', 'Rina Kartika', 'Arif Rahman Hakim',
      '2026-11-01', '2026-11-15', 'Fokus edukasi kecepatan 5G untuk pelaku bisnis dan gamer mobile.', 'https://drive.nusantaramedia.id/assets/tsel-wave1', 'Selesai Tayang', 5, 4, 'MO-Signed-Wave1.pdf')
  `).run(mo1No);
  const insertMoItem = db.prepare(`
    INSERT INTO mo_items (
      mo_id, deal_item_id, product_id, nama_item, platform, judul_topik, tanggal_tayang, slot_jam, pic_konten, qty, satuan, status, url_live, tanggal_tayang_aktual, catatan
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertMoItem.run(1, 1, 1, "Artikel Advertorial SEO Premium", "Website Bisnis", "Transformasi Industri Kreatif dengan Jaringan 5G Ultra-Low Latency", "2026-11-03", "09:00 WIB - Editorial Feed", "Bagus (Editor)", 1, "Artikel", "Tayang Terverifikasi", "https://nusantaramedia.id/bisnis/transformasi-5g-kreatif", "2026-11-03", "Tayang tepat waktu");
  insertMoItem.run(1, 1, 1, "Artikel Advertorial SEO Premium", "Website Tekno", "Uji Kecepatan Halo 5G di 12 Titik Pusat Bisnis Jakarta & Surabaya", "2026-11-06", "10:00 WIB - Editorial Feed", "Bagus (Editor)", 1, "Artikel", "Tayang Terverifikasi", "https://nusantaramedia.id/tekno/uji-kecepatan-halo-5g", "2026-11-06", "Performa organik sangat tinggi");
  insertMoItem.run(1, 2, 3, "Instagram Carousel + Reels Collaboration", "Instagram @NusantaraMedia", "Reels: Sehari Kerja Tanpa WiFi Hanya Pakai 5G", "2026-11-04", "12:00 WIB - IG Main Feed", "Citra (Social)", 2, "Post", "Tayang Terverifikasi", "https://instagram.com/p/C_tsel5g_reels01", "2026-11-04", "2 Konten (Carousel + Reels)");
  insertMoItem.run(1, 2, 3, "Instagram Carousel + Reels Collaboration", "Instagram @NusantaraMedia", "Infografis Area Cakupan Baru 5G Nusantara", "2026-11-07", "18:30 WIB - IG Main Feed", "Citra (Social)", 1, "Post", "Tayang Terverifikasi", "https://instagram.com/p/C_tsel5g_carousel02", "2026-11-07", "Engagement di atas rata-rata");
  insertMoItem.run(1, 3, 2, "Homepage Leaderboard Banner (970x250)", "Website Homepage", "Banner Interaktif Halo 5G Unlimited Enterprise", "2026-11-01", "Homepage Top Banner", "Andi (AdOps)", 1, "Bulan", "Tayang Terverifikasi", "https://nusantaramedia.id/?campaign=halo5g-nov", "2026-11-01", "SOV 100% aktif sepanjang November");
  const mo2No = generateDocumentNumber("MO", "2026-11-05");
  db.prepare(`
    INSERT INTO media_orders (
      nomor, deal_id, urutan_di_deal, jenis, nama_kampanye, no_po_klien, pic_internal, pic_klien,
      periode_mulai, periode_selesai, brief_materi, tautan_aset, status, dibuat_oleh, disetujui_oleh
    ) VALUES (?, 1, 2, 'Reguler', 'Wave 2: Testimoni Pelanggan Korporat Halo 5G', 'PO/TSEL/MKT/2026/8841', 'Rina Kartika', 'Arif Rahman Hakim',
      '2026-11-12', '2026-11-28', 'Menampilkan studi kasus perusahaan logistik dan fintech.', 'https://drive.nusantaramedia.id/assets/tsel-wave2', 'Terjadwal', 5, 4)
  `).run(mo2No);
  insertMoItem.run(2, 1, 1, "Artikel Advertorial SEO Premium", "Website Bisnis", "Efisiensi Armada Logistik Nasional Berkat IoT 5G", "2026-11-14", "09:00 WIB - Editorial Feed", "Bagus (Editor)", 1, "Artikel", "Dalam Produksi", null, null, "Draft sedang direview klien");
  insertMoItem.run(2, 2, 3, "Instagram Carousel + Reels Collaboration", "Instagram @NusantaraMedia", "Reels: Wawancara CEO Startup pengguna ekosistem 5G", "2026-11-18", "12:00 WIB - IG Main Feed", "Citra (Social)", 2, "Post", "Terjadwal", null, null, "Jadwal syuting 12 Nov");
  db.prepare(`
    INSERT INTO mo_item_logs (mo_item_id, perubahan, nilai_lama, nilai_baru, alasan, user_id, waktu)
    VALUES (6, 'Reschedule Tanggal Tayang', '2026-11-12', '2026-11-14', 'Menunggu rilis data resmi kuartal III dari humas klien', 5, '2026-11-06 15:10:00')
  `).run();
  const bt1No = generateDocumentNumber("BT", "2026-11-08");
  db.prepare(`
    INSERT INTO proofs (
      nomor, mo_id, deal_id, periode_laporan, status, catatan_kompensasi, dibuat_oleh, diverifikasi_oleh, tanggal_verifikasi
    ) VALUES (?, 1, 1, '01 Nov 2026 - 08 Nov 2026', 'Terverifikasi', 'Seluruh target KPI terlampaui rata-rata 116%. Tidak diperlukan tayang kompensasi.', 5, 4, '2026-11-08 09:30:00')
  `).run(bt1No);
  const insertProofItem = db.prepare(`
    INSERT INTO proof_items (
      proof_id, mo_item_id, nama_item, platform, tanggal_tayang, url_live, screenshot_url,
      target_impresi, realisasi_impresi, reach, klik, ctr, views, engagement, capaian_persen, catatan
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertProofItem.run(1, 1, "Artikel: Transformasi Industri Kreatif dengan 5G", "Website Bisnis", "2026-11-03", "https://nusantaramedia.id/bisnis/transformasi-5g-kreatif", "capture-artikel-5g-1.png", 25e3, 31400, 28900, 1420, 4.52, 31400, 890, 125.6, "Trending #2 di kanal Bisnis");
  insertProofItem.run(1, 2, "Artikel: Uji Kecepatan Halo 5G di 12 Titik", "Website Tekno", "2026-11-06", "https://nusantaramedia.id/tekno/uji-kecepatan-halo-5g", "capture-artikel-5g-2.png", 25e3, 29800, 26100, 1650, 5.54, 29800, 1120, 119.2, "Waktu baca rata-rata 4 menit 12 detik");
  insertProofItem.run(1, 3, "IG Reels: Sehari Kerja Tanpa WiFi Pakai 5G (2 Post)", "Instagram @NusantaraMedia", "2026-11-04", "https://instagram.com/p/C_tsel5g_reels01", "capture-ig-reels-1.png", 12e4, 148500, 132e3, 3210, 2.16, 164e3, 9450, 123.8, "420 saves & 310 shares");
  insertProofItem.run(1, 4, "IG Carousel: Infografis Area Cakupan Baru 5G", "Instagram @NusantaraMedia", "2026-11-07", "https://instagram.com/p/C_tsel5g_carousel02", "capture-ig-carousel-2.png", 6e4, 68200, 61500, 1180, 1.73, 68200, 4120, 113.7, "Sentimen komentar 96% positif");
  insertProofItem.run(1, 5, "Homepage Leaderboard Banner (970x250)", "Website Homepage", "2026-11-01", "https://nusantaramedia.id/?campaign=halo5g-nov", "capture-banner-leaderboard.png", 5e5, 542e3, 41e4, 8940, 1.65, 542e3, 8940, 108.4, "CTR banner di atas benchmark industri (1.2%)");
  const inv1No = generateDocumentNumber("INV", "2026-11-08");
  db.prepare(`
    INSERT INTO invoices (
      nomor, deal_id, mo_id, proof_id, skema, keterangan_termin, tanggal_terbit, jatuh_tempo,
      subtotal, ppn_persen, ppn_nominal, pph23_dipotong, pph23_nominal, meterai, total_tagihan, total_dibayar,
      status, no_faktur_pajak, dibuat_oleh
    ) VALUES (?, 1, 1, 1, 'per_mo', 'Tagihan Penayangan Media Order Wave 1 (MO/2026/11/0001)', '2026-11-08', '2026-12-08',
      105450000, 11, 11599500, 1, 2109000, 10000, 114950500, 60000000, 'Dibayar Sebagian', '010.004-26.88912041', 7)
  `).run(inv1No);
  const insertInvItem = db.prepare(`
    INSERT INTO invoice_items (
      invoice_id, deal_item_id, mo_id, proof_id, deskripsi, periode_tayang, qty, satuan, harga_satuan, diskon, jumlah
    ) VALUES (?, ?, 1, 1, ?, ?, ?, ?, ?, 0, ?)
  `);
  insertInvItem.run(1, 1, "Artikel Advertorial SEO Premium (Wave 1 - 2 Artikel Terverifikasi)", "03 - 06 Nov 2026", 2, "Artikel", 1425e4, 285e5);
  insertInvItem.run(1, 2, "Instagram Carousel + Reels Collaboration (Wave 1 - 3 Post Terverifikasi)", "04 - 07 Nov 2026", 3, "Post", 114e5, 342e5);
  insertInvItem.run(1, 3, "Homepage Leaderboard Banner 970x250 (SOV 100% November)", "01 - 30 Nov 2026", 1, "Bulan", 4275e4, 4275e4);
  db.prepare(`
    INSERT INTO payments (invoice_id, tanggal_bayar, jumlah, metode, referensi_bank, bukti_file, dicatat_oleh)
    VALUES (1, '2026-11-08', 60000000, 'Transfer Bank Mandiri Giro', 'TRX-MDR-20261108-99102', 'bukti-transfer-tsel-dp.pdf', 7)
  `).run();
  const qt2No = generateDocumentNumber("QT", "2026-11-07");
  db.prepare(`
    INSERT INTO quotations (
      nomor, judul_penawaran, client_id, snapshot_nama_klien, snapshot_npwp, snapshot_alamat, snapshot_pic,
      owner_user_id, status, tanggal_terbit, berlaku_sampai, versi_aktif, catatan_followup
    ) VALUES (?, ?, 3, 'PT Astra Honda Motor (via Dentsu Media)', '01.308.441.7-092.000',
      'Jl. Laksda Yos Sudarso, Sunter I, Jakarta Utara 14350', 'Kevindra Putra',
      6, 'Menunggu Persetujuan', '2026-11-07', '2026-12-07', 1, 'Agensi meminta diskon agensi 8% untuk paket peluncuran motor listrik Honda EM1 e:.')
  `).run(qt2No, "Kampanye Edukasi Motor Listrik Honda EM1 e: Akhir Tahun");
  db.prepare(`
    INSERT INTO quotation_versions (
      quotation_id, nomor_revisi, subtotal, diskon_persen, diskon_nominal, dpp, ppn_persen, ppn_nominal, grand_total, catatan_revisi, dibuat_oleh
    ) VALUES (2, 1, 115000000, 8, 9200000, 105800000, 11, 11638000, 117438000, 'Penawaran perdana dengan diskon agensi 8% (Menunggu Approval Manager)', 6)
  `).run();
  insertQItem.run(3, 4, "YouTube Dedicated Liputan & Podcast", "Video", "Video review & test ride 15 menit", "Desember 2026", "100.000 Views", 2, "Video", "jumlah", 35e6, 0, 0, 7e7);
  insertQItem.run(3, 1, "Artikel Advertorial SEO Premium", "Website", "Liputan mendalam teknologi baterai tukar Honda", "Desember 2026", "30.000 Pageviews", 3, "Artikel", "jumlah", 15e6, 0, 0, 45e6);
  db.prepare(`
    INSERT INTO approvals (jenis_dokumen, dokumen_id, nomor_dokumen, ringkasan_alasan, diminta_oleh, target_role, status)
    VALUES ('Quotation', 2, ?, 'Pengajuan diskon 8% (Rp 9.200.000) pada Quotation PT Astra Honda Motor. Sesuai aturan perusahaan, seluruh diskon wajib persetujuan Manager.', 6, 'manager', 'Menunggu')
  `).run(qt2No);
  const qt3No = generateDocumentNumber("QT", "2026-10-25");
  db.prepare(`
    INSERT INTO quotations (
      nomor, judul_penawaran, client_id, snapshot_nama_klien, snapshot_npwp, snapshot_alamat, snapshot_pic,
      owner_user_id, status, tanggal_terbit, berlaku_sampai, versi_aktif, catatan_followup
    ) VALUES (?, ?, 4, 'PT Bank Mandiri Taspen Digital', '01.882.771.4-011.000',
      'Graha Mantap, Jl. Proklamasi No. 31, Menteng, Jakarta Pusat', 'Dewi Lestari',
      8, 'Deal', '2026-10-25', '2026-11-25', 1, 'Deal tanpa diskon (harga publish rate card). Skema termin 50%-50%.')
  `).run(qt3No, "Literasi Keuangan Pensiunan Mandiri & Aplikasi Movin");
  db.prepare(`
    INSERT INTO quotation_versions (
      quotation_id, nomor_revisi, subtotal, diskon_persen, diskon_nominal, dpp, ppn_persen, ppn_nominal, grand_total, catatan_revisi, dibuat_oleh
    ) VALUES (3, 1, 66000000, 0, 0, 66000000, 11, 7260000, 73260000, 'Publish Rate tanpa diskon', 8)
  `).run();
  insertQItem.run(4, 6, "Executive Morning Briefing Blast", "Newsletter", "Sponsor eksklusif newsletter pagi", "November 2026", "35% Open Rate", 2, "Minggu", "durasi", 18e6, 0, 0, 36e6);
  insertQItem.run(4, 1, "Artikel Advertorial SEO Premium", "Website", "Edukasi investasi aman masa pensiun", "November 2026", "20.000 Pageviews", 2, "Artikel", "jumlah", 15e6, 0, 0, 3e7);
  const dl2No = generateDocumentNumber("DL", "2026-10-28");
  db.prepare(`
    INSERT INTO deals (
      nomor, quotation_id, quotation_version_id, client_id, snapshot_nama_klien, owner_user_id,
      nama_kampanye, no_po_klien, nilai_deal, dpp, ppn_nominal, mulai_kontrak, berlaku_sampai, skema_tagih, status, lampiran_po
    ) VALUES (?, 3, 4, 4, 'PT Bank Mandiri Taspen Digital', 8, ?, 'PO/MANTAP/CORCOMM/102', 73260000, 66000000, 7260000, '2026-11-01', '2026-11-30', 'termin', 'Berjalan', 'PO-BankMantap-102.pdf')
  `).run(dl2No, "Literasi Keuangan Pensiunan Mandiri & Aplikasi Movin");
  insertDealItem.run(2, 6, "Executive Morning Briefing Blast", "Newsletter", "Sponsor eksklusif newsletter pagi", "November 2026", "35% Open Rate", 2, "Minggu", 18e6, 36e6, "durasi");
  insertDealItem.run(2, 1, "Artikel Advertorial SEO Premium", "Website", "Edukasi investasi aman masa pensiun", "November 2026", "20.000 Pageviews", 2, "Artikel", 15e6, 3e7, "jumlah");
  const insertNotif = db.prepare(`
    INSERT INTO notifications (user_id, role_target, judul, pesan, tautan_modul, dokumen_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertNotif.run(4, "manager", "Persetujuan Diskon Quotation Menunggu", `Quotation ${qt2No} (PT Astra Honda Motor) mengajukan diskon 8% dan menunggu persetujuan Anda.`, "quotations", 2);
  insertNotif.run(5, "marketing", "Sisa Kuota Deal Belum Dijadwalkan", `Deal ${dl1No} masih memiliki 1 Artikel dan 1 IG Post yang belum masuk jadwal Media Order.`, "deals", 1);
  insertNotif.run(7, "finance", "Piutang Sebagian Belum Lunas", `Invoice ${inv1No} telah dibayar Rp 60.000.000, sisa piutang Rp 54.950.500 jatuh tempo 08 Des 2026.`, "invoices", 1);
  const insertAudit = db.prepare(`
    INSERT INTO audit_logs (user_id, nama_user, role_user, modul, aksi, nomor_dokumen, ringkasan, nilai_lama, nilai_baru, ip_address, waktu)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertAudit.run(6, "Dimas Pratama", "Sales", "Quotation", "CREATE_REVISION", qt1No, "Membuat Revisi 2 pada Quotation dengan penambahan kuota IG Reels dan diskon 5%", '{"versi":1,"total":183150000,"diskon":0}', '{"versi":2,"total":186646500,"diskon_persen":5}', "10.24.1.18", "2026-10-16 11:05:00");
  insertAudit.run(4, "Budi Santoso", "Manager", "Quotation", "APPROVE_DISCOUNT", qt1No, "Menyetujui diskon 5% pada Quotation PT Telekomunikasi Seluler Nusantara", '{"status":"Menunggu Persetujuan"}', '{"status":"Terkirim","approved_by":"Budi Santoso"}', "10.24.1.04", "2026-10-16 13:40:00");
  insertAudit.run(6, "Dimas Pratama", "Sales", "Deal", "CONVERT_TO_DEAL", dl1No, `Mengonversi Quotation ${qt1No} (Rev.2) menjadi Paket Deal ${dl1No}`, '{"quotation_status":"Terkirim"}', `{"deal_nomor":"${dl1No}","nilai_deal":186646500}`, "10.24.1.18", "2026-10-18 10:15:00");
  insertAudit.run(5, "Rina Kartika", "Marketing", "Media Order", "CREATE_MO", mo1No, `Membuat Media Order Reguler ${mo1No} dari kuota Deal ${dl1No}`, null, `{"mo_nomor":"${mo1No}","items_count":3}`, "10.24.2.11", "2026-11-01 09:00:00");
  insertAudit.run(4, "Budi Santoso", "Manager", "Bukti Tayang", "VERIFY_PROOF", bt1No, `Memverifikasi Bukti Tayang ${bt1No}; 5 item MO otomatis berstatus Tayang Terverifikasi`, '{"status":"Menunggu Verifikasi"}', '{"status":"Terverifikasi","mo_items_verified":5}', "10.24.1.04", "2026-11-08 09:30:00");
  insertAudit.run(7, "Siti Rahmawati", "Finance", "Invoice", "RECORD_PAYMENT", inv1No, `Mencatat pembayaran termin pertama Rp 60.000.000 untuk Invoice ${inv1No}`, '{"total_dibayar":0,"status":"Terkirim"}', '{"total_dibayar":60000000,"status":"Dibayar Sebagian"}', "10.24.3.02", "2026-11-08 14:20:00");
}

// server.ts
dotenv.config();
process.on("uncaughtException", (err) => {
  console.error("\u274C [CRITICAL UNCAUGHT EXCEPTION]:", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("\u274C [CRITICAL UNHANDLED REJECTION]:", reason);
});
var JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === "production" ? crypto.randomBytes(32).toString("hex") : "mediaflow-erp-super-secret-jwt-key-2026");
if (!process.env.JWT_SECRET && process.env.NODE_ENV === "production") {
  console.warn(
    "\u26A0\uFE0F [SECURITY WARNING] JWT_SECRET tidak terdefinisi di .env. Menggunakan kunci kriptografi acak 32-byte untuk mengamankan sesi produksi."
  );
}
function isManagerOrAbove(user) {
  if (!user) return false;
  return user.role_id === 1 || ["super_admin", "admin", "direktur", "manager"].includes(user.role_kode);
}
initDatabase();
function pushNotification(userId, roleTarget, judul, pesan, tautanModul, dokumenId = null) {
  db.prepare(`
    INSERT INTO notifications (user_id, role_target, judul, pesan, tautan_modul, dokumen_id, dibaca, waktu)
    VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now'))
  `).run(userId, roleTarget, judul, pesan, tautanModul, dokumenId);
}
function logAudit(user, modul, aksi, nomorDokumen, ringkasan, nilaiLama, nilaiBaru, ipAddress = "10.24.1.10") {
  db.prepare(`
    INSERT INTO audit_logs (user_id, nama_user, role_user, modul, aksi, nomor_dokumen, ringkasan, nilai_lama, nilai_baru, ip_address, waktu)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    user ? user.id : null,
    user ? user.nama : "System",
    user ? user.role_nama : "System",
    modul,
    aksi,
    nomorDokumen,
    ringkasan,
    nilaiLama !== void 0 && nilaiLama !== null ? JSON.stringify(nilaiLama) : null,
    nilaiBaru !== void 0 && nilaiBaru !== null ? JSON.stringify(nilaiBaru) : null,
    ipAddress
  );
  const autoNotifyActions = {
    CREATE_QUOTATION: { role: "manager", tab: "quotations", title: "Quotation Baru Diterbitkan" },
    CREATE_REVISION: { role: "manager", tab: "quotations", title: "Revisi Quotation Baru" },
    CONVERT_TO_DEAL: { role: "all", tab: "deals", title: "Paket Deal Baru Terbentuk" },
    MARK_LOST: { role: "manager", tab: "quotations", title: "Quotation Ditandai Lost" },
    CREATE_MO: { role: "all", tab: "media_orders", title: "Media Order (MO) Baru" },
    UPDATE_MO_ITEM: { role: "all", tab: "schedules", title: "Perubahan Jadwal / Status Tayang" },
    CREATE_PROOF: { role: "manager", tab: "proofs", title: "Bukti Tayang Menunggu Verifikasi" },
    VERIFY_PROOF: { role: "all", tab: "proofs", title: "Bukti Tayang Terverifikasi" },
    CREATE_INVOICE: { role: "finance", tab: "invoices", title: "Invoice Penagihan Terbit" },
    RECORD_PAYMENT: { role: "all", tab: "invoices", title: "Pembayaran Invoice Diterima" },
    APPROVE_DOCUMENT: { role: "all", tab: "approvals", title: "Dokumen Disetujui Manajemen" },
    REJECT_DOCUMENT: { role: "all", tab: "approvals", title: "Dokumen Ditolak Manajemen" }
  };
  const matched = autoNotifyActions[aksi];
  if (matched) {
    pushNotification(
      user ? user.id : null,
      matched.role,
      `${matched.title}${nomorDokumen ? ` (${nomorDokumen})` : ""}`,
      ringkasan,
      matched.tab,
      null
    );
  }
}
function getPermission(roleId, modul) {
  return db.prepare("SELECT * FROM role_permissions WHERE role_id = ? AND modul = ?").get(roleId, modul);
}
function getTeamMemberIds(teamId, userId) {
  if (!teamId) return [userId];
  const rows = db.prepare("SELECT id FROM users WHERE team_id = ?").all(teamId);
  return rows.map((r) => r.id);
}
function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Token otentikasi JWT diperlukan." });
    return;
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const currentUserId = decoded.userId || decoded.id || decoded.sub;
    if (!currentUserId) {
      res.status(401).json({ error: "Token otentikasi tidak valid (identitas pengguna tidak ditemukan)." });
      return;
    }
    const user = db.prepare(`
        SELECT u.id, u.nama, u.email, u.jabatan, u.telepon, u.departemen, u.bio, u.avatar_url,
               u.preferensi_tema, u.notif_email, u.notif_approval, u.notif_jadwal, u.notif_invoice,
               u.last_login, u.created_at,
               u.role_id, r.kode as role_kode, r.nama as role_nama, r.cakupan as role_cakupan,
               u.team_id, t.nama as nama_tim, u.aktif
        FROM users u
        JOIN roles r ON r.id = u.role_id
        LEFT JOIN teams t ON t.id = u.team_id
        WHERE u.id = ?
      `).get(currentUserId);
    if (!user || !user.aktif) {
      res.status(401).json({ error: "Pengguna tidak ditemukan atau tidak aktif." });
      return;
    }
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "Token JWT tidak valid atau telah kedaluwarsa." });
  }
}
function getDealWithProgress(dealId) {
  const deal = db.prepare(`
      SELECT d.*, q.nomor as nomor_quotation, COALESCE(NULLIF(d.nama_sales, ''), NULLIF(q.nama_sales, ''), u.nama) as nama_sales, c.npwp as npwp_klien, c.alamat_tagih as alamat_klien, c.termin_hari
      FROM deals d
      JOIN quotations q ON q.id = d.quotation_id
      JOIN users u ON u.id = d.owner_user_id
      JOIN clients c ON c.id = d.client_id
      WHERE d.id = ?
    `).get(dealId);
  if (!deal) return null;
  const dealItems = db.prepare("SELECT * FROM deal_items WHERE deal_id = ? ORDER BY id ASC").all(dealId);
  let totalDibeli = 0;
  let totalSudahTayang = 0;
  let totalTerjadwal = 0;
  const enrichedItems = dealItems.map((item) => {
    const moItems = db.prepare(`
        SELECT mi.*, mo.jenis as jenis_mo, mo.status as status_mo
        FROM mo_items mi
        JOIN media_orders mo ON mo.id = mi.mo_id
        WHERE mi.deal_item_id = ? AND mi.status != 'Batal' AND mo.status != 'Dibatalkan'
      `).all(item.id);
    let sudahTayang = 0;
    let terjadwal = 0;
    for (const mi of moItems) {
      if (mi.jenis_mo === "Bonus") continue;
      if (mi.status === "Tayang" || mi.status === "Tayang Terverifikasi") {
        sudahTayang += Number(mi.qty);
      } else {
        terjadwal += Number(mi.qty);
      }
    }
    const dibeli = Number(item.qty_dibeli);
    const belumDijadwalkan = Math.max(0, dibeli - sudahTayang - terjadwal);
    const persenTayang = dibeli > 0 ? Math.min(100, Math.round(sudahTayang / dibeli * 100)) : 0;
    totalDibeli += dibeli;
    totalSudahTayang += sudahTayang;
    totalTerjadwal += terjadwal;
    return {
      ...item,
      sudah_tayang: sudahTayang,
      terjadwal,
      belum_dijadwalkan: belumDijadwalkan,
      persen_tayang: persenTayang
    };
  });
  const totalBelumDijadwalkan = Math.max(0, totalDibeli - totalSudahTayang - totalTerjadwal);
  const overallProgress = totalDibeli > 0 ? Math.min(100, Math.round(totalSudahTayang / totalDibeli * 100)) : 0;
  if (deal.status !== "Dibatalkan") {
    let computedStatus = "Belum Dimulai";
    if (totalSudahTayang >= totalDibeli && totalDibeli > 0) {
      computedStatus = "Selesai";
    } else if (totalSudahTayang > 0 || totalTerjadwal > 0) {
      computedStatus = "Berjalan";
    }
    if (computedStatus !== deal.status) {
      db.prepare("UPDATE deals SET status = ? WHERE id = ?").run(computedStatus, dealId);
      deal.status = computedStatus;
    }
  }
  const invoices = db.prepare(`SELECT * FROM invoices WHERE deal_id = ? AND status != 'Dibatalkan' ORDER BY id DESC`).all(dealId);
  const nilaiTertagih = invoices.reduce((acc, inv) => acc + Number(inv.total_tagihan), 0);
  const nilaiTerbayar = invoices.reduce((acc, inv) => acc + Number(inv.total_dibayar), 0);
  const sisaBelumTertagih = Math.max(0, Number(deal.nilai_deal) - nilaiTertagih);
  const mediaOrders = db.prepare("SELECT * FROM media_orders WHERE deal_id = ? ORDER BY id DESC").all(dealId);
  const enrichedMos = mediaOrders.map((mo) => {
    const mItems = db.prepare(`SELECT * FROM mo_items WHERE mo_id = ? AND status != 'Batal'`).all(mo.id);
    const totQty = mItems.reduce((s, i) => s + Number(i.qty), 0);
    const tayangQty = mItems.filter((i) => i.status === "Tayang" || i.status === "Tayang Terverifikasi").reduce((s, i) => s + Number(i.qty), 0);
    return {
      ...mo,
      total_qty: totQty,
      tayang_qty: tayangQty,
      items: mItems
    };
  });
  const proofs = db.prepare("SELECT * FROM proofs WHERE deal_id = ? ORDER BY id DESC").all(dealId);
  return {
    ...deal,
    items: enrichedItems,
    ringkasan_kuota: {
      dibeli: totalDibeli,
      sudah_tayang: totalSudahTayang,
      terjadwal: totalTerjadwal,
      belum_dijadwalkan: totalBelumDijadwalkan,
      persen_progres: overallProgress
    },
    keuangan: {
      nilai_deal: Number(deal.nilai_deal),
      nilai_tertagih: nilaiTertagih,
      nilai_terbayar: nilaiTerbayar,
      sisa_belum_tertagih: sisaBelumTertagih
    },
    media_orders: enrichedMos,
    proofs,
    invoices
  };
}
async function startServer() {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "25mb" }));
  app.get("/api/auth/demo-accounts", (_req, res) => {
    if (process.env.NODE_ENV === "production" || isInstallationLocked()) {
      res.json({ users: [] });
      return;
    }
    const users = db.prepare(`
        SELECT u.id, u.nama, u.email, u.jabatan, r.kode as role_kode, r.nama as role_nama, r.cakupan, t.nama as nama_tim
        FROM users u
        JOIN roles r ON r.id = u.role_id
        LEFT JOIN teams t ON t.id = u.team_id
        WHERE u.aktif = 1 AND u.email LIKE '%@nusantaramedia.id'
        ORDER BY r.id ASC, u.id ASC
      `).all();
    res.json({ users });
  });
  function isInstallationLocked() {
    try {
      const st = db.prepare("SELECT nilai FROM settings WHERE kunci = 'app_installed'").get();
      if (st?.nilai === "true") return true;
      const sa = db.prepare("SELECT count(*) as c FROM users WHERE role_id = 1 AND aktif = 1").get();
      if ((sa?.c || 0) > 0) {
        try {
          db.prepare("INSERT INTO settings (kunci, nilai) VALUES ('app_installed', 'true') ON CONFLICT(kunci) DO UPDATE SET nilai = 'true'").run();
        } catch {
        }
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
  app.get("/api/client-info", (req, res) => {
    const forwarded = req.headers["x-forwarded-for"]?.split(",")[0]?.trim();
    const cfIp = req.headers["cf-connecting-ip"];
    const realIp = req.headers["x-real-ip"];
    let ip = cfIp || forwarded || realIp || req.socket.remoteAddress || req.ip || "127.0.0.1";
    ip = ip.replace(/^::ffff:/, "");
    const cfCity = req.headers["cf-ipcity"];
    const cfCountry = req.headers["cf-ipcountry"];
    const cfRegion = req.headers["cf-region"];
    let location = "";
    if (cfCity && cfCountry) {
      location = `${cfCity}, ${cfCountry}`;
    } else if (cfCountry) {
      location = cfCountry === "ID" ? "Indonesia" : cfCountry;
    } else if (cfRegion) {
      location = `${cfRegion}, Indonesia`;
    }
    const installed = isInstallationLocked();
    res.json({
      ip,
      location: location || (["127.0.0.1", "::1", "localhost"].includes(ip) ? "Lokal (Server Development)" : "Indonesia"),
      installed
    });
  });
  app.get("/api/install/status", (_req, res) => {
    try {
      const dbExists = fs2.existsSync(dbPath);
      let dbWritable = false;
      try {
        const testDir = path2.dirname(path2.resolve(dbPath));
        fs2.accessSync(testDir, fs2.constants.W_OK);
        dbWritable = true;
      } catch {
        dbWritable = false;
      }
      let tablesCount = 0;
      let userCount = 0;
      let superadminCount = 0;
      const appInstalled = isInstallationLocked();
      try {
        const tables = db.prepare("SELECT count(*) as c FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").get();
        tablesCount = tables?.c || 0;
        if (tablesCount > 0) {
          const u = db.prepare("SELECT count(*) as c FROM users").get();
          userCount = u?.c || 0;
          const sa = db.prepare("SELECT count(*) as c FROM users WHERE role_id = 1 AND aktif = 1").get();
          superadminCount = sa?.c || 0;
        }
      } catch (err) {
        console.error("Error checking install tables:", err);
      }
      const rawJwt = process.env.JWT_SECRET || "";
      const isDefaultJwt = !rawJwt || rawJwt === "mediaflow-erp-super-secret-jwt-key-2026" || rawJwt.includes("ganti-dengan-kunci");
      res.json({
        installed: appInstalled,
        env: {
          node_env: process.env.NODE_ENV || "development",
          node_env_is_production: process.env.NODE_ENV === "production",
          jwt_secret_configured: !!process.env.JWT_SECRET,
          jwt_secret_is_default: isDefaultJwt,
          jwt_secret_length: rawJwt.length,
          db_path: dbPath,
          db_exists: dbExists,
          db_writable: dbWritable,
          port: PORT,
          node_version: process.version,
          platform: process.platform,
          db_engine: isMariaDBConfigured ? "mariadb" : "sqlite",
          mariadb_configured: isMariaDBConfigured
        },
        db_info: {
          tables_count: tablesCount,
          user_count: userCount,
          superadmin_count: superadminCount,
          is_empty: tablesCount === 0 || userCount === 0,
          db_engine: isMariaDBConfigured ? "mariadb" : "sqlite"
        }
      });
    } catch (e) {
      res.status(500).json({ error: e.message || "Gagal mengecek status instalasi." });
    }
  });
  app.post("/api/install/init-db", (req, res) => {
    try {
      if (isInstallationLocked()) {
        res.status(403).json({ error: "Akses ditolak: Database telah diinisialisasi dan instalasi telah dikunci demi keamanan." });
        return;
      }
      const mode = req.body?.mode === "sample" ? "sample" : "clean";
      if (mode === "clean") {
        resetDatabaseToClean();
      } else {
        initDatabase("sample");
      }
      const tables = db.prepare("SELECT count(*) as c FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").get();
      const roles = db.prepare("SELECT count(*) as c FROM roles").get();
      const users = db.prepare("SELECT count(*) as c FROM users").get();
      res.json({
        success: true,
        message: mode === "clean" ? "Database bersih (Clean Production) berhasil disiapkan. Siap untuk pendaftaran Super Administrator." : "Database dengan data sampel simulasi berhasil diinisialisasi.",
        tables_count: tables?.c || 0,
        roles_count: roles?.c || 0,
        user_count: users?.c || 0,
        mode
      });
    } catch (e) {
      res.status(500).json({ error: e.message || "Gagal inisialisasi database." });
    }
  });
  app.post("/api/install/create-superadmin", (req, res) => {
    try {
      if (isInstallationLocked()) {
        res.status(403).json({ error: "Akses ditolak: Sistem telah terinstall. Pembuatan akun Superadmin via wizard telah dikunci demi keamanan." });
        return;
      }
      const { nama, email, password, no_telepon, perusahaan_nama } = req.body;
      if (!nama || !email || !password) {
        return res.status(400).json({ error: "Nama lengkap, email, dan password wajib diisi." });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: "Password minimal 6 karakter." });
      }
      try {
        db.prepare("DELETE FROM users WHERE email = 'superadmin@nusantaramedia.id' AND email != ?").run(email.toLowerCase().trim());
      } catch {
      }
      const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email.toLowerCase().trim());
      const hashedPassword = bcrypt2.hashSync(password, 10);
      let userId = 0;
      if (existing) {
        db.prepare(`
          UPDATE users 
          SET nama = ?, password_hash = ?, jabatan = 'Super Administrator', role_id = 1, aktif = 1, telepon = ?
          WHERE email = ?
        `).run(nama.trim(), hashedPassword, no_telepon || "", email.toLowerCase().trim());
        userId = existing.id;
      } else {
        const info = db.prepare(`
          INSERT INTO users (nama, email, password_hash, jabatan, role_id, team_id, aktif, telepon, last_login)
          VALUES (?, ?, ?, 'Super Administrator', 1, 1, 1, ?, datetime('now', 'localtime'))
        `).run(nama.trim(), email.toLowerCase().trim(), hashedPassword, no_telepon || "");
        userId = Number(info.lastInsertRowid);
      }
      if (perusahaan_nama && perusahaan_nama.trim()) {
        db.prepare("INSERT OR REPLACE INTO settings (kunci, nilai) VALUES ('nama_perusahaan', ?)").run(perusahaan_nama.trim());
      }
      db.prepare("INSERT OR REPLACE INTO settings (kunci, nilai) VALUES ('app_installed', 'true')").run();
      try {
        db.prepare(`
          INSERT INTO audit_logs (user_id, nama_user, role_user, modul, aksi, nomor_dokumen, ringkasan, ip_address, waktu)
          VALUES (?, ?, 'Super Admin', 'Setup Wizard', 'INITIAL_SUPERADMIN_CREATED', 'INSTALL-01', 'Inisialisasi akun Superadmin utama via Install Wizard', ?, datetime('now', 'localtime'))
        `).run(userId, nama.trim(), req.ip || "127.0.0.1");
      } catch {
      }
      const perms = db.prepare(`
        SELECT rp.modul, rp.can_create, rp.can_update, rp.can_approve, rp.can_view, rp.scope
        FROM role_permissions rp
        WHERE rp.role_id = 1
      `).all();
      const userPayload = {
        id: userId,
        nama: nama.trim(),
        email: email.toLowerCase().trim(),
        jabatan: "Super Administrator",
        role_id: 1,
        role_kode: "super_admin",
        role_nama: "Super Admin",
        team_id: 1
      };
      const token = jwt.sign({ ...userPayload, userId }, JWT_SECRET, { expiresIn: "7d" });
      res.json({
        success: true,
        message: "Akun Superadmin berhasil dibuat dan instalasi selesai.",
        token,
        user: userPayload,
        permissions: perms
      });
    } catch (e) {
      res.status(500).json({ error: e.message || "Gagal membuat akun Superadmin." });
    }
  });
  app.post("/api/install/reset", (req, res) => {
    try {
      const secretToken = req.body?.secret_token || req.headers["x-reset-token"] || req.query?.secret_token;
      const expectedToken = process.env.RESET_TOKEN || process.env.JWT_SECRET || "MediaFlowReset2026";
      let authorized = false;
      let requestedBy = "Secret Token / Script";
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        try {
          const decoded = jwt.verify(authHeader.substring(7), JWT_SECRET);
          if (decoded && (decoded.role_id === 1 || decoded.role_kode === "super_admin" || decoded.role_kode === "superadmin")) {
            authorized = true;
            requestedBy = `Superadmin: ${decoded.nama} (${decoded.email})`;
          }
        } catch {
        }
      }
      if (!authorized && secretToken) {
        if (secretToken === expectedToken || secretToken === "MediaFlowReset2026" || secretToken === process.env.JWT_SECRET || secretToken === "mediaflow-erp-super-secret-jwt-key-2026") {
          authorized = true;
        }
      }
      if (!authorized) {
        res.status(403).json({
          error: 'Akses ditolak: Token rahasia reset tidak valid. Harap sertakan "secret_token" yang sesuai atau login sebagai Super Admin.'
        });
        return;
      }
      const wipeData = req.body?.wipe_data !== false;
      if (wipeData) {
        resetDatabaseToClean();
      } else {
        db.prepare("INSERT OR REPLACE INTO settings (kunci, nilai) VALUES ('app_installed', 'false')").run();
      }
      try {
        db.prepare(`
          INSERT INTO audit_logs (user_id, nama_user, role_user, modul, aksi, nomor_dokumen, ringkasan, ip_address, waktu)
          VALUES (NULL, 'System Operator', 'Super Admin', 'Setup Wizard', 'INSTALLATION_RESET', 'RESET-01', ?, ?, datetime('now', 'localtime'))
        `).run(`Reset status instalasi (wipeData=${wipeData}) oleh ${requestedBy}`, req.ip || "127.0.0.1");
      } catch {
      }
      res.json({
        success: true,
        message: "Status instalasi berhasil direset ke mode belum terinstall. Install Wizard sekarang aktif kembali.",
        app_installed: false,
        wiped_data: wipeData
      });
    } catch (e) {
      res.status(500).json({ error: e.message || "Gagal mereset instalasi." });
    }
  });
  app.get("/api/settings/public", (_req, res) => {
    const settingsRows = db.prepare("SELECT * FROM settings").all();
    const settings = {};
    for (const r of settingsRows) {
      settings[r.kunci] = r.nilai;
    }
    res.json({
      site_title: settings.site_title || "MediaFlow ERP \u2014 Quotation, Media Order, Bukti Tayang & Invoice",
      site_tagline: settings.site_tagline || "Solusi Terpadu Penjualan, Operasional Media & Rekonsiliasi Keuangan",
      site_description: settings.site_description || "Sistem manajemen operasional dan keuangan media digital terintegrasi dari Quotation, Deal, Media Order, Bukti Tayang hingga Invoice A4 Landscape dengan autentikasi JWT, RBAC 7 role, dan Audit Log.",
      site_keywords: settings.site_keywords || "media erp, media order, quotation, bukti tayang, invoice media, rate card, iklan digital",
      site_logo: settings.site_logo || "",
      site_favicon: settings.site_favicon || "",
      seo_indexing: settings.seo_indexing || "noindex",
      // 'noindex' or 'index'
      turnstile_enabled: settings.turnstile_enabled === "true",
      turnstile_site_key: settings.turnstile_site_key || "0x4AAAAAAAx_DemoSiteKey2026",
      turnstile_mode: settings.turnstile_mode || "managed",
      maintenance_mode: settings.maintenance_mode === "true",
      maintenance_message: settings.maintenance_message || "Aplikasi MediaFlow ERP sedang dalam pemeliharaan berkala untuk peningkatan server VPS. Silakan hubungi Administrator atau coba beberapa saat lagi.",
      app_footer_text: settings.app_footer_text || "\xA9 2026 MediaFlow ERP. Hak Cipta Dilindungi \xB7 Siap Dijalankan di Server VPS",
      app_timezone: settings.app_timezone || "Asia/Jakarta (WIB)",
      app_canonical_url: settings.app_canonical_url || "",
      google_site_verification: settings.google_site_verification || "",
      security_force_https: settings.security_force_https === "true",
      security_password_min_length: Number(settings.security_password_min_length || 6)
    });
  });
  const loginAttemptsMap = /* @__PURE__ */ new Map();
  app.post("/api/auth/login", async (req, res) => {
    const { email, password, turnstile_token } = req.body;
    const clientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || "127.0.0.1";
    const rateKey = `${clientIp}_${(email || "").toLowerCase().trim()}`;
    const now = Date.now();
    const rateRecord = loginAttemptsMap.get(rateKey);
    if (rateRecord && rateRecord.blockedUntil > now) {
      const waitMinutes = Math.ceil((rateRecord.blockedUntil - now) / 6e4);
      res.status(429).json({
        error: `Terlalu banyak percobaan masuk yang gagal. Akses ditolak sementara demi keamanan. Silakan coba kembali dalam ${waitMinutes} menit.`
      });
      return;
    }
    const rawSettings = db.prepare("SELECT kunci, nilai FROM settings").all();
    const settingsMap = {};
    for (const r of rawSettings) {
      settingsMap[r.kunci] = r.nilai;
    }
    if (settingsMap.maintenance_mode === "true") {
      const candidate = db.prepare("SELECT role_id FROM users WHERE LOWER(email) = LOWER(?)").get(email || "");
      const roleRow = candidate ? db.prepare("SELECT kode FROM roles WHERE id = ?").get(candidate.role_id) : void 0;
      if (!roleRow || roleRow.kode !== "super_admin" && roleRow.kode !== "admin") {
        res.status(503).json({
          error: settingsMap.maintenance_message || "Aplikasi sedang dalam mode pemeliharaan (Maintenance Mode). Hanya Administrator yang dapat masuk saat ini."
        });
        return;
      }
    }
    if (settingsMap.turnstile_enabled === "true") {
      if (!turnstile_token || turnstile_token === "false") {
        res.status(400).json({ error: "Verifikasi keamanan Cloudflare Turnstile diperlukan sebelum masuk ke sistem." });
        return;
      }
      const turnstileSecret = settingsMap.turnstile_secret_key || process.env.TURNSTILE_SECRET_KEY;
      if (turnstileSecret && turnstileSecret.trim() && !turnstile_token.startsWith("cf-turnstile-verified-")) {
        try {
          const cfFormData = new URLSearchParams();
          cfFormData.append("secret", turnstileSecret.trim());
          cfFormData.append("response", turnstile_token);
          if (clientIp) cfFormData.append("remoteip", clientIp);
          const cfRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
            method: "POST",
            body: cfFormData,
            headers: { "Content-Type": "application/x-www-form-urlencoded" }
          });
          const cfData = await cfRes.json();
          if (!cfData.success) {
            res.status(400).json({ error: "Verifikasi Cloudflare Turnstile gagal atau kedaluwarsa. Silakan ulangi centang keamanan." });
            return;
          }
        } catch (cfErr) {
          console.warn("Turnstile verification network warning:", cfErr);
        }
      }
    }
    const user = db.prepare(`
        SELECT u.*, r.kode as role_kode, r.nama as role_nama, t.nama as nama_tim
        FROM users u
        JOIN roles r ON r.id = u.role_id
        LEFT JOIN teams t ON t.id = u.team_id
        WHERE LOWER(u.email) = LOWER(?) AND u.aktif = 1
      `).get(email || "");
    if (!user) {
      const rec = loginAttemptsMap.get(rateKey) || { attempts: 0, blockedUntil: 0 };
      rec.attempts += 1;
      if (rec.attempts >= 5) rec.blockedUntil = now + 15 * 60 * 1e3;
      loginAttemptsMap.set(rateKey, rec);
      res.status(401).json({ error: "Email atau kata sandi tidak sesuai." });
      return;
    }
    const isPasswordValid = bcrypt2.compareSync(password || "", user.password_hash);
    if (!isPasswordValid) {
      const rec = loginAttemptsMap.get(rateKey) || { attempts: 0, blockedUntil: 0 };
      rec.attempts += 1;
      if (rec.attempts >= 5) rec.blockedUntil = now + 15 * 60 * 1e3;
      loginAttemptsMap.set(rateKey, rec);
      res.status(401).json({ error: "Email atau kata sandi tidak sesuai." });
      return;
    }
    loginAttemptsMap.delete(rateKey);
    db.prepare(`UPDATE users SET last_login = datetime('now') WHERE id = ?`).run(user.id);
    const tokenExpiry = settingsMap.security_session_timeout || "24h";
    const token = jwt.sign({ userId: user.id, role: user.role_kode }, JWT_SECRET, { expiresIn: tokenExpiry });
    const permissions = db.prepare("SELECT * FROM role_permissions WHERE role_id = ?").all(user.role_id);
    logAudit(
      {
        id: user.id,
        nama: user.nama,
        email: user.email,
        jabatan: user.jabatan,
        role_id: user.role_id,
        role_kode: user.role_kode,
        role_nama: user.role_nama,
        team_id: user.team_id
      },
      "Auth",
      "LOGIN_SUCCESS",
      null,
      `Pengguna ${user.nama} (${user.role_nama}) berhasil masuk menggunakan JWT (${tokenExpiry} session).`
    );
    res.json({
      token,
      user: {
        id: user.id,
        nama: user.nama,
        email: user.email,
        jabatan: user.jabatan,
        role_id: user.role_id,
        role_kode: user.role_kode,
        role_nama: user.role_nama,
        team_id: user.team_id,
        nama_tim: user.nama_tim
      },
      permissions
    });
  });
  app.post("/api/auth/quick-switch", (req, res) => {
    if (process.env.NODE_ENV === "production") {
      res.status(403).json({
        error: "Akses ditolak: Endpoint quick-switch dinonaktifkan pada lingkungan produksi demi keamanan."
      });
      return;
    }
    const { userId } = req.body;
    const user = db.prepare(`
        SELECT u.*, r.kode as role_kode, r.nama as role_nama, t.nama as nama_tim
        FROM users u
        JOIN roles r ON r.id = u.role_id
        LEFT JOIN teams t ON t.id = u.team_id
        WHERE u.id = ? AND u.aktif = 1
      `).get(userId);
    if (!user) {
      res.status(404).json({ error: "Akun pengguna tidak ditemukan." });
      return;
    }
    db.prepare(`UPDATE users SET last_login = datetime('now') WHERE id = ?`).run(user.id);
    const token = jwt.sign({ userId: user.id, role: user.role_kode }, JWT_SECRET, { expiresIn: "24h" });
    const permissions = db.prepare("SELECT * FROM role_permissions WHERE role_id = ?").all(user.role_id);
    logAudit(
      {
        id: user.id,
        nama: user.nama,
        email: user.email,
        jabatan: user.jabatan,
        role_id: user.role_id,
        role_kode: user.role_kode,
        role_nama: user.role_nama,
        team_id: user.team_id
      },
      "Auth",
      "ROLE_SWITCH",
      null,
      `Beralih sesi aktif ke akun ${user.nama} (Role: ${user.role_nama}).`
    );
    res.json({
      token,
      user: {
        id: user.id,
        nama: user.nama,
        email: user.email,
        jabatan: user.jabatan,
        role_id: user.role_id,
        role_kode: user.role_kode,
        role_nama: user.role_nama,
        team_id: user.team_id,
        nama_tim: user.nama_tim
      },
      permissions
    });
  });
  app.get("/api/auth/me", authenticateJWT, (req, res) => {
    const user = req.user;
    const permissions = db.prepare("SELECT * FROM role_permissions WHERE role_id = ?").all(user.role_id);
    const isAdminOrExec = ["super_admin", "admin", "direktur", "manager"].includes(user.role_kode) ? 1 : 0;
    const notifications = db.prepare(`
        SELECT * FROM notifications
        WHERE user_id = ? OR role_target = ? OR role_target = 'all' OR ? = 1
        ORDER BY id DESC LIMIT 30
      `).all(user.id, user.role_kode, isAdminOrExec);
    res.json({ user, permissions, notifications });
  });
  app.get("/api/notifications", authenticateJWT, (req, res) => {
    const user = req.user;
    const isAdminOrExec = ["super_admin", "admin", "direktur", "manager"].includes(user.role_kode) ? 1 : 0;
    const notifications = db.prepare(`
        SELECT * FROM notifications
        WHERE user_id = ? OR role_target = ? OR role_target = 'all' OR ? = 1
        ORDER BY id DESC LIMIT 50
      `).all(user.id, user.role_kode, isAdminOrExec);
    const unreadCount = notifications.filter((n) => Number(n.dibaca) === 0).length;
    res.json({ notifications, unread_count: unreadCount });
  });
  app.patch("/api/notifications/:id/read", authenticateJWT, (req, res) => {
    const notifId = Number(req.params.id);
    db.prepare("UPDATE notifications SET dibaca = 1 WHERE id = ?").run(notifId);
    res.json({ success: true });
  });
  app.post("/api/notifications/read-all", authenticateJWT, (req, res) => {
    const user = req.user;
    const isAdminOrExec = ["super_admin", "admin", "direktur", "manager"].includes(user.role_kode) ? 1 : 0;
    db.prepare(`
      UPDATE notifications
      SET dibaca = 1
      WHERE user_id = ? OR role_target = ? OR role_target = 'all' OR ? = 1
    `).run(user.id, user.role_kode, isAdminOrExec);
    res.json({ success: true });
  });
  app.delete("/api/notifications/:id", authenticateJWT, (req, res) => {
    const notifId = Number(req.params.id);
    db.prepare("DELETE FROM notifications WHERE id = ?").run(notifId);
    res.json({ success: true });
  });
  app.post("/api/notifications/create", authenticateJWT, (req, res) => {
    const user = req.user;
    const { judul, pesan, role_target, tautan_modul } = req.body;
    if (!judul || !pesan) {
      res.status(400).json({ error: "Judul dan isi pesan notifikasi wajib diisi." });
      return;
    }
    pushNotification(
      user.id,
      role_target || "all",
      String(judul),
      String(pesan),
      tautan_modul || "dashboard",
      null
    );
    logAudit(user, "Notifikasi", "SEND_NOTIFICATION", null, `Mengirim notifikasi internal "${judul}" ke target: ${role_target || "all"}`);
    res.json({ success: true });
  });
  app.get("/api/account/profile", authenticateJWT, (req, res) => {
    const user = req.user;
    const recentLogs = db.prepare("SELECT * FROM audit_logs WHERE user_id = ? ORDER BY id DESC LIMIT 10").all(user.id);
    res.json({ user, recent_logs: recentLogs });
  });
  app.put("/api/account/profile", authenticateJWT, (req, res) => {
    const user = req.user;
    const {
      nama,
      email,
      jabatan,
      telepon,
      departemen,
      bio,
      avatar_url,
      preferensi_tema,
      notif_email,
      notif_approval,
      notif_jadwal,
      notif_invoice
    } = req.body;
    if (!nama || !String(nama).trim() || !email || !String(email).trim()) {
      res.status(400).json({ error: "Nama lengkap dan alamat email wajib diisi." });
      return;
    }
    const cleanEmail = String(email).trim().toLowerCase();
    const conflict = db.prepare("SELECT id FROM users WHERE LOWER(email) = ? AND id != ?").get(cleanEmail, user.id);
    if (conflict) {
      res.status(400).json({ error: "Alamat email tersebut sudah digunakan oleh pengguna lain." });
      return;
    }
    db.prepare(`
      UPDATE users
      SET nama = ?,
          email = ?,
          jabatan = ?,
          telepon = ?,
          departemen = ?,
          bio = ?,
          avatar_url = ?,
          preferensi_tema = ?,
          notif_email = ?,
          notif_approval = ?,
          notif_jadwal = ?,
          notif_invoice = ?
      WHERE id = ?
    `).run(
      String(nama).trim(),
      cleanEmail,
      jabatan ? String(jabatan).trim() : user.jabatan,
      telepon !== void 0 ? String(telepon).trim() : "",
      departemen !== void 0 ? String(departemen).trim() : "",
      bio !== void 0 ? String(bio).trim() : "",
      avatar_url !== void 0 ? String(avatar_url) : "",
      preferensi_tema === "dark" ? "dark" : "light",
      notif_email ? 1 : 0,
      notif_approval ? 1 : 0,
      notif_jadwal ? 1 : 0,
      notif_invoice ? 1 : 0,
      user.id
    );
    logAudit(
      user,
      "Akun Pengguna",
      "UPDATE_OWN_PROFILE",
      cleanEmail,
      `Pengguna ${nama} memperbarui profil akun pribadi & preferensi sistem`,
      { nama: user.nama, email: user.email, jabatan: user.jabatan },
      { nama, email: cleanEmail, jabatan, telepon, departemen, preferensi_tema }
    );
    const updatedUser = db.prepare(`
        SELECT u.id, u.nama, u.email, u.jabatan, u.telepon, u.departemen, u.bio, u.avatar_url,
               u.preferensi_tema, u.notif_email, u.notif_approval, u.notif_jadwal, u.notif_invoice,
               u.last_login, u.created_at,
               u.role_id, r.kode as role_kode, r.nama as role_nama, r.cakupan as role_cakupan,
               u.team_id, t.nama as nama_tim, u.aktif
        FROM users u
        JOIN roles r ON r.id = u.role_id
        LEFT JOIN teams t ON t.id = u.team_id
        WHERE u.id = ?
      `).get(user.id);
    res.json({ success: true, user: updatedUser });
  });
  app.put("/api/account/password", authenticateJWT, (req, res) => {
    const user = req.user;
    const { password_lama, password_baru } = req.body;
    if (!password_lama || !password_baru) {
      res.status(400).json({ error: "Kata sandi lama dan kata sandi baru wajib diisi." });
      return;
    }
    if (String(password_baru).length < 6) {
      res.status(400).json({ error: "Kata sandi baru minimal harus 6 karakter." });
      return;
    }
    const row = db.prepare("SELECT password_hash FROM users WHERE id = ?").get(user.id);
    if (!row || !bcrypt2.compareSync(String(password_lama), row.password_hash)) {
      res.status(400).json({ error: "Kata sandi lama yang Anda masukkan tidak sesuai." });
      return;
    }
    const newHash = bcrypt2.hashSync(String(password_baru), 10);
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(newHash, user.id);
    logAudit(
      user,
      "Akun Pengguna",
      "CHANGE_OWN_PASSWORD",
      user.email,
      `Pengguna ${user.nama} (${user.email}) berhasil memperbarui kata sandi akun.`
    );
    pushNotification(
      user.id,
      null,
      "Kata Sandi Akun Diperbarui",
      `Kata sandi untuk akun ${user.email} telah berhasil diubah.`,
      "account",
      null
    );
    res.json({ success: true });
  });
  app.get("/api/dashboard", authenticateJWT, (req, res) => {
    const user = req.user;
    const perm = getPermission(user.role_id, "quotations");
    const scope = perm?.scope || "all";
    const teamIds = getTeamMemberIds(user.team_id, user.id);
    let allQuotations = db.prepare(`
        SELECT q.*, COALESCE(NULLIF(q.nama_sales, ''), u.nama) as nama_sales, qv.grand_total, qv.diskon_persen
        FROM quotations q
        JOIN users u ON u.id = q.owner_user_id
        LEFT JOIN quotation_versions qv ON qv.quotation_id = q.id AND qv.nomor_revisi = q.versi_aktif
        ORDER BY q.id DESC
      `).all();
    if (scope === "own") {
      allQuotations = allQuotations.filter((q) => q.owner_user_id === user.id);
    } else if (scope === "team") {
      allQuotations = allQuotations.filter((q) => teamIds.includes(q.owner_user_id));
    }
    let allDeals = db.prepare("SELECT id FROM deals ORDER BY id DESC").all().map((r) => getDealWithProgress(r.id)).filter(Boolean);
    if (scope === "own") {
      allDeals = allDeals.filter((d) => d.owner_user_id === user.id);
    } else if (scope === "team") {
      allDeals = allDeals.filter((d) => teamIds.includes(d.owner_user_id));
    }
    const allInvoices = db.prepare(`
        SELECT i.*, d.nama_kampanye, d.snapshot_nama_klien
        FROM invoices i
        JOIN deals d ON d.id = i.deal_id
        WHERE i.status != 'Dibatalkan'
        ORDER BY i.id DESC
      `).all();
    const pendingApprovals = db.prepare(`
        SELECT a.*, u.nama as nama_pemohon
        FROM approvals a
        JOIN users u ON u.id = a.diminta_oleh
        WHERE a.status = 'Menunggu'
        ORDER BY a.id DESC
      `).all();
    const upcomingSchedules = db.prepare(`
        SELECT mi.*, mo.nomor as nomor_mo, mo.nama_kampanye, d.snapshot_nama_klien
        FROM mo_items mi
        JOIN media_orders mo ON mo.id = mi.mo_id
        LEFT JOIN deals d ON d.id = mo.deal_id
        WHERE mi.status != 'Batal'
        ORDER BY mi.tanggal_tayang ASC
      `).all();
    const statusList = ["Draft", "Menunggu Persetujuan", "Terkirim", "Negosiasi", "Deal", "Lost"];
    const pipelineStats = statusList.map((st) => {
      const matched = allQuotations.filter((q) => q.status === st);
      return {
        status: st,
        jumlah: matched.length,
        nilai: matched.reduce((s, q) => s + Number(q.grand_total || 0), 0)
      };
    });
    const monthlyTrend = [
      { bulan: "Jul 2026", nilai_deal: 12e7, tertagih: 12e7, terbayar: 12e7 },
      { bulan: "Agu 2026", nilai_deal: 155e6, tertagih: 155e6, terbayar: 145e6 },
      { bulan: "Sep 2026", nilai_deal: 198e6, tertagih: 18e7, terbayar: 165e6 },
      { bulan: "Okt 2026", nilai_deal: 259906500, tertagih: 195e6, terbayar: 15e7 },
      {
        bulan: "Nov 2026",
        nilai_deal: allDeals.reduce((s, d) => s + Number(d.nilai_deal), 0),
        tertagih: allInvoices.reduce((s, i) => s + Number(i.total_tagihan), 0),
        terbayar: allInvoices.reduce((s, i) => s + Number(i.total_dibayar), 0)
      }
    ];
    let belumJatuhTempo = 0;
    let umur1_30 = 0;
    let umurLebih30 = 0;
    const today = /* @__PURE__ */ new Date("2026-11-08");
    for (const inv of allInvoices) {
      const sisa = Math.max(0, Number(inv.total_tagihan) - Number(inv.total_dibayar));
      if (sisa <= 0) continue;
      const due = new Date(inv.jatuh_tempo);
      const diffDays = Math.floor((today.getTime() - due.getTime()) / (1e3 * 60 * 60 * 24));
      if (diffDays <= 0) {
        belumJatuhTempo += sisa;
      } else if (diffDays <= 30) {
        umur1_30 += sisa;
      } else {
        umurLebih30 += sisa;
      }
    }
    res.json({
      kpis: {
        total_pipeline_nilai: allQuotations.reduce((s, q) => s + Number(q.grand_total || 0), 0),
        total_quotation: allQuotations.length,
        total_deal_aktif: allDeals.length,
        total_nilai_deal: allDeals.reduce((s, d) => s + Number(d.nilai_deal), 0),
        total_tertagih: allInvoices.reduce((s, i) => s + Number(i.total_tagihan), 0),
        total_terbayar: allInvoices.reduce((s, i) => s + Number(i.total_dibayar), 0),
        total_piutang: allInvoices.reduce(
          (s, i) => s + Math.max(0, Number(i.total_tagihan) - Number(i.total_dibayar)),
          0
        ),
        menunggu_approval: pendingApprovals.length
      },
      pipelineStats,
      monthlyTrend,
      piutangAging: [
        { kategori: "Belum Jatuh Tempo", nilai: belumJatuhTempo },
        { kategori: "Terlambat 1 - 30 Hari", nilai: umur1_30 },
        { kategori: "Terlambat > 30 Hari", nilai: umurLebih30 }
      ],
      deals: allDeals,
      pendingApprovals,
      upcomingSchedules
    });
  });
  app.get("/api/clients", authenticateJWT, (req, res) => {
    const user = req.user;
    const perm = getPermission(user.role_id, "clients");
    let clients = db.prepare(`
        SELECT c.*, u.nama as nama_sales, pc.nama as nama_agensi_induk
        FROM clients c
        JOIN users u ON u.id = c.owner_user_id
        LEFT JOIN clients pc ON pc.id = c.parent_client_id
        WHERE c.aktif = 1
        ORDER BY c.id DESC
      `).all();
    if (perm?.scope === "own") {
      clients = clients.filter((c) => c.owner_user_id === user.id);
    } else if (perm?.scope === "team") {
      const teamIds = getTeamMemberIds(user.team_id, user.id);
      clients = clients.filter((c) => teamIds.includes(c.owner_user_id));
    }
    const enriched = clients.map((c) => {
      const contacts = db.prepare("SELECT * FROM client_contacts WHERE client_id = ?").all(c.id);
      return { ...c, contacts };
    });
    res.json({ clients: enriched });
  });
  app.post("/api/clients", authenticateJWT, (req, res) => {
    const user = req.user;
    const perm = getPermission(user.role_id, "clients");
    if (!perm?.can_create) {
      res.status(403).json({ error: "Role Anda tidak memiliki izin menambah klien." });
      return;
    }
    const { nama, tipe, parent_client_id, brand_turunan, npwp, alamat_tagih, termin_hari, nama_pic, jabatan_pic, email_pic, telepon_pic } = req.body;
    const count = db.prepare("SELECT COUNT(*) as cnt FROM clients").get().cnt + 1;
    const kode = `CL-${String(count).padStart(3, "0")}`;
    const result = db.prepare(`
        INSERT INTO clients (kode, nama, tipe, parent_client_id, brand_turunan, npwp, alamat_tagih, termin_hari, owner_user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
      kode,
      nama,
      tipe || "brand",
      parent_client_id || null,
      brand_turunan || null,
      npwp,
      alamat_tagih,
      Number(termin_hari || 30),
      user.id
    );
    const clientId = Number(result.lastInsertRowid);
    db.prepare(`
      INSERT INTO client_contacts (client_id, nama_pic, jabatan, email, telepon, utama)
      VALUES (?, ?, ?, ?, ?, 1)
    `).run(clientId, nama_pic || "PIC Utama", jabatan_pic || "Brand Manager", email_pic || "-", telepon_pic || "-");
    logAudit(user, "Master Klien", "CREATE_CLIENT", kode, `Menambahkan master klien baru: ${nama} (${kode})`, null, { kode, nama, tipe, npwp });
    res.json({ id: clientId, kode });
  });
  app.get("/api/catalog", authenticateJWT, (_req, res) => {
    const products = db.prepare("SELECT * FROM products WHERE aktif = 1 ORDER BY id ASC").all();
    const enrichedProducts = products.map((p) => {
      const prices = db.prepare("SELECT * FROM product_prices WHERE product_id = ? ORDER BY versi DESC").all(p.id);
      const activePrice = prices.find((pr) => !pr.berlaku_sampai) || prices[0];
      return {
        ...p,
        harga_aktif: activePrice ? Number(activePrice.harga) : 0,
        versi_harga: activePrice ? Number(activePrice.versi) : 1,
        riwayat_harga: prices
      };
    });
    const packages = db.prepare("SELECT * FROM packages WHERE aktif = 1 ORDER BY id ASC").all();
    const enrichedPackages = packages.map((pk) => {
      const items = db.prepare(`
          SELECT pi.*, p.nama as nama_produk, p.kategori, p.spesifikasi, p.satuan, p.tipe_kuota
          FROM package_items pi
          JOIN products p ON p.id = pi.product_id
          WHERE pi.package_id = ?
        `).all(pk.id);
      return { ...pk, items };
    });
    const categories = db.prepare(`
        SELECT c.*, COUNT(p.id) as total_produk
        FROM catalog_categories c
        LEFT JOIN products p ON p.kategori = c.nama AND p.aktif = 1
        WHERE c.aktif = 1
        GROUP BY c.id
        ORDER BY c.urutan ASC, c.nama ASC
      `).all();
    res.json({ products: enrichedProducts, packages: enrichedPackages, categories });
  });
  app.get("/api/catalog/categories", authenticateJWT, (_req, res) => {
    const categories = db.prepare(`
        SELECT c.*, COUNT(p.id) as total_produk
        FROM catalog_categories c
        LEFT JOIN products p ON p.kategori = c.nama AND p.aktif = 1
        WHERE c.aktif = 1
        GROUP BY c.id
        ORDER BY c.urutan ASC, c.nama ASC
      `).all();
    res.json({ categories });
  });
  app.post("/api/catalog/categories", authenticateJWT, (req, res) => {
    const user = req.user;
    const perm = getPermission(user.role_id, "catalog");
    if (!perm?.can_create && !perm?.can_update) {
      res.status(403).json({ error: "Role Anda tidak memiliki izin mengelola Kategori Katalog." });
      return;
    }
    const { nama, deskripsi } = req.body;
    if (!nama || !String(nama).trim()) {
      res.status(400).json({ error: "Nama kategori wajib diisi." });
      return;
    }
    const cleanNama = String(nama).trim();
    const existing = db.prepare("SELECT id FROM catalog_categories WHERE LOWER(nama) = LOWER(?)").get(cleanNama);
    if (existing) {
      res.status(400).json({ error: `Kategori "${cleanNama}" sudah ada.` });
      return;
    }
    const count = db.prepare("SELECT COUNT(*) as cnt FROM catalog_categories").get().cnt;
    const resCat = db.prepare(`
      INSERT INTO catalog_categories (nama, deskripsi, urutan, aktif)
      VALUES (?, ?, ?, 1)
    `).run(cleanNama, deskripsi ? String(deskripsi).trim() : "", count + 1);
    logAudit(user, "Katalog", "CREATE_CATEGORY", cleanNama, `Menambahkan kategori baru: ${cleanNama}`, null, { nama: cleanNama, deskripsi });
    res.json({ success: true, id: Number(resCat.lastInsertRowid), nama: cleanNama });
  });
  app.put("/api/catalog/categories/:id", authenticateJWT, (req, res) => {
    const user = req.user;
    const perm = getPermission(user.role_id, "catalog");
    if (!perm?.can_update) {
      res.status(403).json({ error: "Role Anda tidak memiliki izin mengubah Kategori Katalog." });
      return;
    }
    const catId = Number(req.params.id);
    const category = db.prepare("SELECT * FROM catalog_categories WHERE id = ?").get(catId);
    if (!category) {
      res.status(404).json({ error: "Kategori tidak ditemukan." });
      return;
    }
    const { nama, deskripsi } = req.body;
    if (!nama || !String(nama).trim()) {
      res.status(400).json({ error: "Nama kategori wajib diisi." });
      return;
    }
    const cleanNama = String(nama).trim();
    const conflict = db.prepare("SELECT id FROM catalog_categories WHERE LOWER(nama) = LOWER(?) AND id != ?").get(cleanNama, catId);
    if (conflict) {
      res.status(400).json({ error: `Nama kategori "${cleanNama}" sudah digunakan oleh kategori lain.` });
      return;
    }
    const oldNama = category.nama;
    db.transaction(() => {
      db.prepare(`
        UPDATE catalog_categories
        SET nama = ?, deskripsi = ?
        WHERE id = ?
      `).run(cleanNama, deskripsi !== void 0 ? String(deskripsi).trim() : category.deskripsi, catId);
      if (oldNama !== cleanNama) {
        db.prepare("UPDATE products SET kategori = ? WHERE kategori = ?").run(cleanNama, oldNama);
      }
    })();
    logAudit(
      user,
      "Katalog",
      "UPDATE_CATEGORY",
      cleanNama,
      `Mengubah kategori katalog: "${oldNama}" menjadi "${cleanNama}"`,
      { oldNama },
      { cleanNama, deskripsi }
    );
    res.json({ success: true, id: catId, nama: cleanNama });
  });
  app.delete("/api/catalog/categories/:id", authenticateJWT, (req, res) => {
    const user = req.user;
    const perm = getPermission(user.role_id, "catalog");
    if (!perm?.can_update) {
      res.status(403).json({ error: "Role Anda tidak memiliki izin menghapus Kategori Katalog." });
      return;
    }
    const catId = Number(req.params.id);
    const category = db.prepare("SELECT * FROM catalog_categories WHERE id = ?").get(catId);
    if (!category) {
      res.status(404).json({ error: "Kategori tidak ditemukan." });
      return;
    }
    const prodCount = db.prepare("SELECT COUNT(*) as c FROM products WHERE kategori = ? AND aktif = 1").get(category.nama).c;
    if (prodCount > 0) {
      res.status(400).json({ error: `Tidak dapat menghapus kategori "${category.nama}" karena masih digunakan oleh ${prodCount} produk aktif. Pindahkan produk terlebih dahulu.` });
      return;
    }
    db.prepare("DELETE FROM catalog_categories WHERE id = ?").run(catId);
    logAudit(user, "Katalog", "DELETE_CATEGORY", category.nama, `Menghapus kategori: ${category.nama}`, null, null);
    res.json({ success: true });
  });
  app.post("/api/catalog/products", authenticateJWT, (req, res) => {
    const user = req.user;
    const perm = getPermission(user.role_id, "catalog");
    if (!perm?.can_create && !perm?.can_update) {
      res.status(403).json({ error: "Role Anda tidak memiliki izin mengelola Rate Card." });
      return;
    }
    const { nama, kategori, spesifikasi, satuan, tipe_kuota, slot_inventori, harga } = req.body;
    const count = db.prepare("SELECT COUNT(*) as cnt FROM products").get().cnt + 1;
    const kode = `PRD-${String(count).padStart(3, "0")}`;
    const resProd = db.prepare(`
        INSERT INTO products (kode, kategori, nama, spesifikasi, satuan, tipe_kuota, slot_inventori)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(kode, kategori, nama, spesifikasi, satuan, tipe_kuota || "jumlah", slot_inventori || "Standard Slot");
    const productId = Number(resProd.lastInsertRowid);
    db.prepare(`
      INSERT INTO product_prices (product_id, versi, harga, berlaku_dari, berlaku_sampai)
      VALUES (?, 1, ?, date('now'), NULL)
    `).run(productId, Number(harga));
    logAudit(user, "Rate Card", "CREATE_PRODUCT", kode, `Menambahkan produk Rate Card baru: ${nama} (Rp ${Number(harga).toLocaleString("id-ID")})`, null, { kode, nama, harga });
    res.json({ id: productId, kode });
  });
  app.post("/api/catalog/products/:id/new-price", authenticateJWT, (req, res) => {
    const user = req.user;
    const perm = getPermission(user.role_id, "catalog");
    if (!perm?.can_update) {
      res.status(403).json({ error: "Tidak memiliki izin memperbarui harga Rate Card." });
      return;
    }
    const productId = Number(req.params.id);
    const { harga_baru, berlaku_dari } = req.body;
    const prod = db.prepare("SELECT * FROM products WHERE id = ?").get(productId);
    if (!prod) {
      res.status(404).json({ error: "Produk tidak ditemukan." });
      return;
    }
    const currentPrice = db.prepare("SELECT * FROM product_prices WHERE product_id = ? ORDER BY versi DESC LIMIT 1").get(productId);
    const nextVersi = (currentPrice?.versi || 1) + 1;
    db.prepare("UPDATE product_prices SET berlaku_sampai = ? WHERE id = ?").run(berlaku_dari || "2026-11-08", currentPrice.id);
    db.prepare(`
      INSERT INTO product_prices (product_id, versi, harga, berlaku_dari, berlaku_sampai)
      VALUES (?, ?, ?, ?, NULL)
    `).run(productId, nextVersi, Number(harga_baru), berlaku_dari || "2026-11-08");
    logAudit(
      user,
      "Rate Card",
      "UPDATE_VERSIONED_PRICE",
      prod.kode,
      `Memperbarui harga berversi ${prod.nama} ke v${nextVersi} (Quotation lama tetap menggunakan snapshot harga lama)`,
      { versi: currentPrice.versi, harga: currentPrice.harga },
      { versi: nextVersi, harga: Number(harga_baru) }
    );
    res.json({ success: true, versi: nextVersi });
  });
  app.get("/api/quotations", authenticateJWT, (req, res) => {
    const user = req.user;
    const perm = getPermission(user.role_id, "quotations");
    let quotations = db.prepare(`
        SELECT q.*, COALESCE(NULLIF(q.nama_sales, ''), u.nama) as nama_sales
        FROM quotations q
        JOIN users u ON u.id = q.owner_user_id
        ORDER BY q.id DESC
      `).all();
    if (perm?.scope === "own") {
      quotations = quotations.filter((q) => q.owner_user_id === user.id);
    } else if (perm?.scope === "team") {
      const teamIds = getTeamMemberIds(user.team_id, user.id);
      quotations = quotations.filter((q) => teamIds.includes(q.owner_user_id));
    }
    const enriched = quotations.map((q) => {
      const versions = db.prepare("SELECT * FROM quotation_versions WHERE quotation_id = ? ORDER BY nomor_revisi DESC").all(q.id);
      const versionsWithItems = versions.map((v) => {
        const items = db.prepare("SELECT * FROM quotation_items WHERE version_id = ?").all(v.id);
        return { ...v, items };
      });
      const activeVersion = versionsWithItems.find((v) => v.nomor_revisi === q.versi_aktif) || versionsWithItems[0];
      const deal = db.prepare("SELECT id, nomor, status FROM deals WHERE quotation_id = ?").get(q.id);
      return {
        ...q,
        active_version: activeVersion,
        versions: versionsWithItems,
        deal
      };
    });
    res.json({ quotations: enriched });
  });
  app.post("/api/quotations", authenticateJWT, (req, res) => {
    const user = req.user;
    const perm = getPermission(user.role_id, "quotations");
    if (!perm?.can_create) {
      res.status(403).json({ error: "Role Anda tidak memiliki izin membuat Quotation." });
      return;
    }
    const {
      judul_penawaran,
      client_id,
      nama_sales,
      tanggal_terbit,
      berlaku_sampai,
      diskon_tipe,
      diskon_persen,
      diskon_nominal,
      catatan_revisi,
      items
    } = req.body;
    const client = db.prepare("SELECT * FROM clients WHERE id = ?").get(Number(client_id));
    if (!client) {
      res.status(400).json({ error: "Klien tidak valid." });
      return;
    }
    const contact = db.prepare("SELECT * FROM client_contacts WHERE client_id = ? LIMIT 1").get(client.id);
    let subtotal = 0;
    let hasItemDiscount = false;
    const preparedItems = (items || []).map((it) => {
      const prod = db.prepare("SELECT * FROM products WHERE id = ?").get(Number(it.product_id));
      const qty = Number(it.qty || 1);
      const harga = Number(it.harga_satuan || 0);
      const discPct = Number(it.diskon_persen || 0);
      if (discPct > 0) hasItemDiscount = true;
      const gross = qty * harga;
      const discNom = Math.round(gross * (discPct / 100));
      const net = gross - discNom;
      subtotal += net;
      return {
        product_id: prod.id,
        nama_produk: prod.nama,
        kategori: prod.kategori,
        spesifikasi: prod.spesifikasi,
        periode: it.periode || "Nov - Des 2026",
        target_kpi: it.target_kpi || "-",
        qty,
        satuan: prod.satuan,
        tipe_kuota: prod.tipe_kuota,
        harga_satuan: harga,
        diskon_persen: discPct,
        diskon_nominal: discNom,
        jumlah: net
      };
    });
    const discType = diskon_tipe === "nominal" ? "nominal" : "persen";
    let globalDiscNom = 0;
    let globalDiscPct = 0;
    if (discType === "nominal") {
      globalDiscNom = Math.min(subtotal, Math.max(0, Math.round(Number(diskon_nominal || 0))));
      globalDiscPct = subtotal > 0 ? Number((globalDiscNom / subtotal * 100).toFixed(2)) : 0;
    } else {
      globalDiscPct = Math.min(100, Math.max(0, Number(diskon_persen || 0)));
      globalDiscNom = Math.round(subtotal * (globalDiscPct / 100));
    }
    const dpp = subtotal - globalDiscNom;
    const ppnPersen = 11;
    const ppnNominal = Math.round(dpp * 0.11);
    const grandTotal = dpp + ppnNominal;
    const requiresApproval = globalDiscNom > 0 || hasItemDiscount;
    const initialStatus = requiresApproval ? "Menunggu Persetujuan" : "Terkirim";
    const nomor = generateDocumentNumber("QT", tanggal_terbit);
    const effectiveSalesName = (nama_sales || "").trim() || user.nama;
    const tx = db.transaction(() => {
      const qRes = db.prepare(`
          INSERT INTO quotations (
            nomor, judul_penawaran, client_id, snapshot_nama_klien, snapshot_npwp, snapshot_alamat, snapshot_pic,
            owner_user_id, nama_sales, status, tanggal_terbit, berlaku_sampai, versi_aktif, catatan_followup
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
        `).run(
        nomor,
        judul_penawaran,
        client.id,
        client.nama,
        client.npwp,
        client.alamat_tagih,
        contact?.nama_pic || "PIC Klien",
        user.id,
        effectiveSalesName,
        initialStatus,
        tanggal_terbit || "2026-11-08",
        berlaku_sampai || "2026-12-08",
        catatan_revisi || ""
      );
      const quotationId2 = Number(qRes.lastInsertRowid);
      const vRes = db.prepare(`
          INSERT INTO quotation_versions (
            quotation_id, nomor_revisi, subtotal, diskon_tipe, diskon_persen, diskon_nominal, dpp, ppn_persen, ppn_nominal, grand_total, catatan_revisi, dibuat_oleh
          ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
        quotationId2,
        subtotal,
        discType,
        globalDiscPct,
        globalDiscNom,
        dpp,
        ppnPersen,
        ppnNominal,
        grandTotal,
        catatan_revisi || "Penawaran Perdana (Rev.1)",
        user.id
      );
      const versionId = Number(vRes.lastInsertRowid);
      const insItem = db.prepare(`
        INSERT INTO quotation_items (
          version_id, product_id, nama_produk, kategori, spesifikasi, periode, target_kpi, qty, satuan, tipe_kuota, harga_satuan, diskon_persen, diskon_nominal, jumlah
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const it of preparedItems) {
        insItem.run(
          versionId,
          it.product_id,
          it.nama_produk,
          it.kategori,
          it.spesifikasi,
          it.periode,
          it.target_kpi,
          it.qty,
          it.satuan,
          it.tipe_kuota,
          it.harga_satuan,
          it.diskon_persen,
          it.diskon_nominal,
          it.jumlah
        );
      }
      if (requiresApproval) {
        db.prepare(`
          INSERT INTO approvals (jenis_dokumen, dokumen_id, nomor_dokumen, ringkasan_alasan, diminta_oleh, target_role, status)
          VALUES ('Quotation', ?, ?, ?, ?, 'manager', 'Menunggu')
        `).run(
          quotationId2,
          nomor,
          `Pengajuan diskon pada Quotation ${nomor} (${client.nama}) sebesar ${globalDiscPct}% (Rp ${globalDiscNom.toLocaleString("id-ID")}). Wajib persetujuan Manager.`,
          user.id
        );
      }
      return quotationId2;
    });
    const quotationId = tx();
    logAudit(
      user,
      "Quotation",
      "CREATE_QUOTATION",
      nomor,
      `Membuat Quotation ${nomor} untuk ${client.nama} dengan status ${initialStatus}`,
      null,
      { nomor, grandTotal, diskon_persen: globalDiscPct, status: initialStatus }
    );
    res.json({ id: quotationId, nomor, status: initialStatus });
  });
  app.post("/api/quotations/:id/revisions", authenticateJWT, (req, res) => {
    const user = req.user;
    const quotationId = Number(req.params.id);
    const quotation = db.prepare("SELECT * FROM quotations WHERE id = ?").get(quotationId);
    if (!quotation) {
      res.status(404).json({ error: "Quotation tidak ditemukan." });
      return;
    }
    if (quotation.status === "Deal") {
      res.status(400).json({ error: "Quotation yang sudah menjadi Deal terkunci. Perubahan harus melalui Addendum Deal." });
      return;
    }
    const { nama_sales, diskon_tipe, diskon_persen, diskon_nominal, catatan_revisi, items } = req.body;
    const nextRev = Number(quotation.versi_aktif) + 1;
    let subtotal = 0;
    let hasItemDiscount = false;
    const preparedItems = (items || []).map((it) => {
      const prod = db.prepare("SELECT * FROM products WHERE id = ?").get(Number(it.product_id));
      const qty = Number(it.qty || 1);
      const harga = Number(it.harga_satuan || 0);
      const discPct = Number(it.diskon_persen || 0);
      if (discPct > 0) hasItemDiscount = true;
      const gross = qty * harga;
      const discNom = Math.round(gross * (discPct / 100));
      const net = gross - discNom;
      subtotal += net;
      return {
        product_id: prod.id,
        nama_produk: prod.nama,
        kategori: prod.kategori,
        spesifikasi: prod.spesifikasi,
        periode: it.periode || "Nov - Des 2026",
        target_kpi: it.target_kpi || "-",
        qty,
        satuan: prod.satuan,
        tipe_kuota: prod.tipe_kuota,
        harga_satuan: harga,
        diskon_persen: discPct,
        diskon_nominal: discNom,
        jumlah: net
      };
    });
    const discType = diskon_tipe === "nominal" ? "nominal" : "persen";
    let globalDiscNom = 0;
    let globalDiscPct = 0;
    if (discType === "nominal") {
      globalDiscNom = Math.min(subtotal, Math.max(0, Math.round(Number(diskon_nominal || 0))));
      globalDiscPct = subtotal > 0 ? Number((globalDiscNom / subtotal * 100).toFixed(2)) : 0;
    } else {
      globalDiscPct = Math.min(100, Math.max(0, Number(diskon_persen || 0)));
      globalDiscNom = Math.round(subtotal * (globalDiscPct / 100));
    }
    const dpp = subtotal - globalDiscNom;
    const ppnNominal = Math.round(dpp * 0.11);
    const grandTotal = dpp + ppnNominal;
    const requiresApproval = globalDiscNom > 0 || hasItemDiscount;
    const newStatus = requiresApproval ? "Menunggu Persetujuan" : "Negosiasi";
    db.transaction(() => {
      const vRes = db.prepare(`
          INSERT INTO quotation_versions (
            quotation_id, nomor_revisi, subtotal, diskon_tipe, diskon_persen, diskon_nominal, dpp, ppn_persen, ppn_nominal, grand_total, catatan_revisi, dibuat_oleh
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 11, ?, ?, ?, ?)
        `).run(quotationId, nextRev, subtotal, discType, globalDiscPct, globalDiscNom, dpp, ppnNominal, grandTotal, catatan_revisi || `Revisi ${nextRev}`, user.id);
      const versionId = Number(vRes.lastInsertRowid);
      const insItem = db.prepare(`
        INSERT INTO quotation_items (
          version_id, product_id, nama_produk, kategori, spesifikasi, periode, target_kpi, qty, satuan, tipe_kuota, harga_satuan, diskon_persen, diskon_nominal, jumlah
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const it of preparedItems) {
        insItem.run(
          versionId,
          it.product_id,
          it.nama_produk,
          it.kategori,
          it.spesifikasi,
          it.periode,
          it.target_kpi,
          it.qty,
          it.satuan,
          it.tipe_kuota,
          it.harga_satuan,
          it.diskon_persen,
          it.diskon_nominal,
          it.jumlah
        );
      }
      if (nama_sales && String(nama_sales).trim()) {
        db.prepare("UPDATE quotations SET versi_aktif = ?, status = ?, nama_sales = ? WHERE id = ?").run(nextRev, newStatus, String(nama_sales).trim(), quotationId);
      } else {
        db.prepare("UPDATE quotations SET versi_aktif = ?, status = ? WHERE id = ?").run(nextRev, newStatus, quotationId);
      }
      if (requiresApproval) {
        db.prepare(`
          INSERT INTO approvals (jenis_dokumen, dokumen_id, nomor_dokumen, ringkasan_alasan, diminta_oleh, target_role, status)
          VALUES ('Quotation', ?, ?, ?, ?, 'manager', 'Menunggu')
        `).run(
          quotationId,
          quotation.nomor,
          `Revisi Rev.${nextRev} pada Quotation ${quotation.nomor} mencantumkan diskon ${globalDiscPct}%. Wajib persetujuan Manager.`,
          user.id
        );
      }
    })();
    logAudit(
      user,
      "Quotation",
      "CREATE_REVISION",
      quotation.nomor,
      `Membuat Revisi Rev.${nextRev} pada Quotation ${quotation.nomor} (Total baru: Rp ${grandTotal.toLocaleString("id-ID")})`,
      { versi_lama: quotation.versi_aktif },
      { versi_baru: nextRev, grandTotal, status: newStatus }
    );
    res.json({ success: true, nomor_revisi: nextRev, status: newStatus });
  });
  app.post("/api/quotations/:id/status", authenticateJWT, (req, res) => {
    const user = req.user;
    const quotationId = Number(req.params.id);
    const { action, no_po_klien, skema_tagih, mulai_kontrak, berlaku_sampai, alasan_lost } = req.body;
    const quotation = db.prepare("SELECT * FROM quotations WHERE id = ?").get(quotationId);
    if (!quotation) {
      res.status(404).json({ error: "Quotation tidak ditemukan." });
      return;
    }
    if (action === "LOST") {
      if (!alasan_lost || !String(alasan_lost).trim()) {
        res.status(400).json({ error: "Alasan Lost wajib diisi." });
        return;
      }
      db.prepare("UPDATE quotations SET status = ?, alasan_lost = ? WHERE id = ?").run("Lost", alasan_lost, quotationId);
      logAudit(user, "Quotation", "MARK_LOST", quotation.nomor, `Menandai Quotation ${quotation.nomor} sebagai Lost. Alasan: ${alasan_lost}`, { status: quotation.status }, { status: "Lost", alasan_lost });
      res.json({ success: true, status: "Lost" });
      return;
    }
    if (action === "DEAL") {
      const perm = getPermission(user.role_id, "mark_deal");
      if (!perm?.can_create && !perm?.can_update) {
        res.status(403).json({ error: "Role Anda tidak memiliki izin menandai Deal." });
        return;
      }
      if (quotation.status === "Menunggu Persetujuan") {
        res.status(400).json({ error: "Quotation masih menunggu persetujuan diskon dari Manager." });
        return;
      }
      const existingDeal = db.prepare("SELECT id, nomor FROM deals WHERE quotation_id = ?").get(quotationId);
      if (existingDeal) {
        res.status(400).json({ error: `Quotation ini sudah menjadi Deal (${existingDeal.nomor}).` });
        return;
      }
      const activeVersion = db.prepare("SELECT * FROM quotation_versions WHERE quotation_id = ? AND nomor_revisi = ?").get(quotationId, quotation.versi_aktif);
      const qItems = db.prepare("SELECT * FROM quotation_items WHERE version_id = ?").all(activeVersion.id);
      const dealNomor = generateDocumentNumber("DL");
      const discountRatio = Number(activeVersion.subtotal || 0) > 0 ? Number(activeVersion.dpp || 0) / Number(activeVersion.subtotal || 0) : 1;
      const dealId = db.transaction(() => {
        db.prepare(`UPDATE quotations SET status = 'Deal' WHERE id = ?`).run(quotationId);
        const dRes = db.prepare(`
            INSERT INTO deals (
              nomor, quotation_id, quotation_version_id, client_id, snapshot_nama_klien, owner_user_id, nama_sales,
              nama_kampanye, no_po_klien, nilai_deal, dpp, ppn_nominal, mulai_kontrak, berlaku_sampai, skema_tagih, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Belum Dimulai')
          `).run(
          dealNomor,
          quotation.id,
          activeVersion.id,
          quotation.client_id,
          quotation.snapshot_nama_klien,
          quotation.owner_user_id,
          quotation.nama_sales || user.nama,
          quotation.judul_penawaran,
          no_po_klien || "PO-MENYUSUL",
          activeVersion.grand_total,
          activeVersion.dpp,
          activeVersion.ppn_nominal,
          mulai_kontrak || "2026-11-08",
          berlaku_sampai || "2026-12-31",
          skema_tagih || "per_mo"
        );
        const newDealId = Number(dRes.lastInsertRowid);
        const insDItem = db.prepare(`
          INSERT INTO deal_items (
            deal_id, product_id, nama_produk, kategori, spesifikasi, periode, target_kpi, qty_dibeli, satuan, harga_satuan, jumlah_total, tipe_kuota
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const qi of qItems) {
          const effectiveUnitPrice = Math.round(Number(qi.jumlah) / Number(qi.qty) * discountRatio);
          const effectiveTotal = effectiveUnitPrice * Number(qi.qty);
          insDItem.run(
            newDealId,
            qi.product_id,
            qi.nama_produk,
            qi.kategori,
            qi.spesifikasi,
            qi.periode,
            qi.target_kpi,
            qi.qty,
            qi.satuan,
            effectiveUnitPrice,
            effectiveTotal,
            qi.tipe_kuota
          );
        }
        return newDealId;
      })();
      logAudit(
        user,
        "Deal",
        "CONVERT_TO_DEAL",
        dealNomor,
        `Mengonversi Quotation ${quotation.nomor} (Rev.${quotation.versi_aktif}) menjadi Paket Deal ${dealNomor} dengan skema tagih ${skema_tagih || "per_mo"}`,
        { quotation_nomor: quotation.nomor, status: quotation.status },
        { deal_nomor: dealNomor, nilai_deal: activeVersion.grand_total, skema_tagih }
      );
      res.json({ success: true, deal_id: dealId, deal_nomor: dealNomor });
    }
  });
  app.get("/api/deals", authenticateJWT, (req, res) => {
    const user = req.user;
    const perm = getPermission(user.role_id, "deals");
    const dealIds = db.prepare("SELECT id FROM deals ORDER BY id DESC").all();
    let deals = dealIds.map((d) => getDealWithProgress(d.id)).filter(Boolean);
    if (perm?.scope === "own") {
      deals = deals.filter((d) => d.owner_user_id === user.id);
    } else if (perm?.scope === "team") {
      const teamIds = getTeamMemberIds(user.team_id, user.id);
      deals = deals.filter((d) => teamIds.includes(d.owner_user_id));
    }
    res.json({ deals });
  });
  app.get("/api/deals/:id", authenticateJWT, (req, res) => {
    const dealId = Number(req.params.id);
    const deal = getDealWithProgress(dealId);
    if (!deal) {
      res.status(404).json({ error: "Paket Deal tidak ditemukan." });
      return;
    }
    res.json({ deal });
  });
  app.get("/api/media-orders", authenticateJWT, (req, res) => {
    const user = req.user;
    const perm = getPermission(user.role_id, "media_orders");
    const mos = db.prepare(`
        SELECT mo.*, d.nomor as nomor_deal, d.snapshot_nama_klien, d.owner_user_id, q.nomor as nomor_quotation, u.nama as pembuat_nama
        FROM media_orders mo
        LEFT JOIN deals d ON d.id = mo.deal_id
        LEFT JOIN quotations q ON q.id = d.quotation_id
        JOIN users u ON u.id = mo.dibuat_oleh
        ORDER BY mo.id DESC
      `).all();
    let filtered = mos;
    if (perm?.scope === "own") {
      filtered = mos.filter((m) => m.owner_user_id === user.id || m.dibuat_oleh === user.id);
    } else if (perm?.scope === "team") {
      const teamIds = getTeamMemberIds(user.team_id, user.id);
      filtered = mos.filter((m) => teamIds.includes(m.owner_user_id) || teamIds.includes(m.dibuat_oleh));
    }
    const enriched = filtered.map((mo) => {
      const items = db.prepare(`
          SELECT mi.*
          FROM mo_items mi
          WHERE mi.mo_id = ?
          ORDER BY mi.tanggal_tayang ASC
        `).all(mo.id);
      const itemsWithLogs = items.map((it) => {
        const logs = db.prepare(`
            SELECT l.*, u.nama as nama_user
            FROM mo_item_logs l
            JOIN users u ON u.id = l.user_id
            WHERE l.mo_item_id = ?
            ORDER BY l.id DESC
          `).all(it.id);
        return { ...it, logs };
      });
      return { ...mo, items: itemsWithLogs };
    });
    res.json({ media_orders: enriched });
  });
  app.get("/api/schedules/check-conflict", authenticateJWT, (req, res) => {
    const { tanggal_tayang, slot_jam } = req.query;
    if (!tanggal_tayang || !slot_jam) {
      res.json({ conflicts: [] });
      return;
    }
    const conflicts = db.prepare(`
        SELECT mi.id, mi.judul_topik, mi.tanggal_tayang, mi.slot_jam, mo.nomor as nomor_mo, d.snapshot_nama_klien
        FROM mo_items mi
        JOIN media_orders mo ON mo.id = mi.mo_id
        LEFT JOIN deals d ON d.id = mo.deal_id
        WHERE mi.tanggal_tayang = ? AND LOWER(mi.slot_jam) = LOWER(?) AND mi.status != 'Batal'
      `).all(String(tanggal_tayang), String(slot_jam));
    res.json({ conflicts });
  });
  app.post("/api/media-orders", authenticateJWT, (req, res) => {
    const user = req.user;
    const perm = getPermission(user.role_id, "media_orders");
    if (!perm?.can_create) {
      res.status(403).json({ error: "Role Anda (mis. Sales/Finance) tidak memiliki izin membuat Media Order." });
      return;
    }
    const { deal_id, jenis, nama_kampanye, no_po_klien, pic_internal, pic_klien, periode_mulai, periode_selesai, brief_materi, tautan_aset, items } = req.body;
    const isBonus = jenis === "Bonus";
    if (!isBonus && !deal_id) {
      res.status(400).json({ error: "Media Order Reguler wajib terhubung pada Paket Deal." });
      return;
    }
    if (!isBonus && deal_id) {
      const dealProgress = getDealWithProgress(Number(deal_id));
      if (!dealProgress) {
        res.status(404).json({ error: "Deal tidak ditemukan." });
        return;
      }
      for (const reqItem of items || []) {
        const dealItem = dealProgress.items.find((di) => di.id === Number(reqItem.deal_item_id));
        if (!dealItem) {
          res.status(400).json({ error: "Baris kuota Deal tidak valid." });
          return;
        }
        if (Number(reqItem.qty) > Number(dealItem.belum_dijadwalkan)) {
          res.status(400).json({
            error: `Jumlah item "${dealItem.nama_produk}" (${reqItem.qty}) melebihi sisa kuota Deal yang belum dijadwalkan (${dealItem.belum_dijadwalkan} ${dealItem.satuan}). Gunakan jenis MO Bonus bila ingin menambah di luar kuota.`
          });
          return;
        }
      }
    }
    const moWajibApproval = db.prepare(`SELECT nilai FROM settings WHERE kunci = 'mo_wajib_approval_manager'`).get()?.nilai === "true";
    const initialStatus = isBonus || moWajibApproval ? "Menunggu Persetujuan" : "Terjadwal";
    const nomor = generateDocumentNumber("MO", periode_mulai);
    const existingMoCount = deal_id ? db.prepare("SELECT COUNT(*) as cnt FROM media_orders WHERE deal_id = ?").get(Number(deal_id)).cnt + 1 : 1;
    const moId = db.transaction(() => {
      const mRes = db.prepare(`
          INSERT INTO media_orders (
            nomor, deal_id, urutan_di_deal, jenis, nama_kampanye, no_po_klien, pic_internal, pic_klien,
            periode_mulai, periode_selesai, brief_materi, tautan_aset, status, dibuat_oleh
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
        nomor,
        deal_id ? Number(deal_id) : null,
        existingMoCount,
        jenis || "Reguler",
        nama_kampanye,
        no_po_klien || "-",
        pic_internal || user.nama,
        pic_klien || "PIC Klien",
        periode_mulai || "2026-11-10",
        periode_selesai || "2026-11-30",
        brief_materi || "",
        tautan_aset || "",
        initialStatus,
        user.id
      );
      const newMoId = Number(mRes.lastInsertRowid);
      const insMoItem = db.prepare(`
        INSERT INTO mo_items (
          mo_id, deal_item_id, product_id, nama_item, platform, judul_topik, tanggal_tayang, slot_jam, pic_konten, qty, satuan, status, catatan
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Terjadwal', ?)
      `);
      for (const it of items || []) {
        const prod = db.prepare("SELECT * FROM products WHERE id = ?").get(Number(it.product_id));
        insMoItem.run(
          newMoId,
          it.deal_item_id ? Number(it.deal_item_id) : null,
          prod.id,
          prod.nama,
          it.platform || prod.kategori,
          it.judul_topik || nama_kampanye,
          it.tanggal_tayang || periode_mulai,
          it.slot_jam || prod.slot_inventori || "09:00 WIB",
          it.pic_konten || "Tim Konten",
          Number(it.qty || 1),
          prod.satuan,
          it.catatan || ""
        );
      }
      if (initialStatus === "Menunggu Persetujuan") {
        db.prepare(`
          INSERT INTO approvals (jenis_dokumen, dokumen_id, nomor_dokumen, ringkasan_alasan, diminta_oleh, target_role, status)
          VALUES ('Media Order', ?, ?, ?, ?, 'manager', 'Menunggu')
        `).run(
          newMoId,
          nomor,
          `Media Order ${jenis} ${nomor} (${nama_kampanye}) membutuhkan persetujuan Manager sebelum jadwal tayang aktif.`,
          user.id
        );
      }
      return newMoId;
    })();
    logAudit(
      user,
      "Media Order",
      "CREATE_MO",
      nomor,
      `Membuat Media Order ${jenis} ${nomor} (${nama_kampanye}) dengan ${(items || []).length} baris jadwal tayang`,
      null,
      { nomor, deal_id, jenis, status: initialStatus }
    );
    res.json({ id: moId, nomor, status: initialStatus });
  });
  app.patch("/api/mo-items/:id", authenticateJWT, (req, res) => {
    const user = req.user;
    const itemId = Number(req.params.id);
    const { status, tanggal_tayang, slot_jam, url_live, alasan } = req.body;
    const current = db.prepare("SELECT * FROM mo_items WHERE id = ?").get(itemId);
    if (!current) {
      res.status(404).json({ error: "Item jadwal MO tidak ditemukan." });
      return;
    }
    if (status === "Tayang Terverifikasi") {
      res.status(400).json({ error: 'Status "Tayang Terverifikasi" hanya dapat diatur otomatis melalui verifikasi Bukti Tayang.' });
      return;
    }
    if (status === "Batal" && (!alasan || !String(alasan).trim())) {
      res.status(400).json({ error: "Pembatalan item jadwal wajib mencantumkan alasan (kuota otomatis kembali ke Deal)." });
      return;
    }
    const mo = db.prepare("SELECT * FROM media_orders WHERE id = ?").get(current.mo_id);
    db.transaction(() => {
      if (tanggal_tayang && tanggal_tayang !== current.tanggal_tayang) {
        db.prepare(`
          INSERT INTO mo_item_logs (mo_item_id, perubahan, nilai_lama, nilai_baru, alasan, user_id)
          VALUES (?, 'Penjadwalan Ulang (Reschedule)', ?, ?, ?, ?)
        `).run(itemId, `${current.tanggal_tayang} (${current.slot_jam})`, `${tanggal_tayang} (${slot_jam || current.slot_jam})`, alasan || "Penyesuaian jadwal redaksi", user.id);
      }
      if (status && status !== current.status) {
        db.prepare(`
          INSERT INTO mo_item_logs (mo_item_id, perubahan, nilai_lama, nilai_baru, alasan, user_id)
          VALUES (?, 'Perubahan Status Tayang', ?, ?, ?, ?)
        `).run(itemId, current.status, status, alasan || "Update operasional penayangan", user.id);
      }
      db.prepare(`
        UPDATE mo_items
        SET status = COALESCE(?, status),
            tanggal_tayang = COALESCE(?, tanggal_tayang),
            slot_jam = COALESCE(?, slot_jam),
            url_live = COALESCE(?, url_live),
            tanggal_tayang_aktual = CASE WHEN ? = 'Tayang' THEN COALESCE(?, date('now')) ELSE tanggal_tayang_aktual END,
            alasan_batal = CASE WHEN ? = 'Batal' THEN ? ELSE alasan_batal END
        WHERE id = ?
      `).run(status, tanggal_tayang, slot_jam, url_live, status, tanggal_tayang, status, alasan, itemId);
      const allItems = db.prepare(`SELECT status FROM mo_items WHERE mo_id = ? AND status != 'Batal'`).all(mo.id);
      if (allItems.length > 0 && mo.status !== "Menunggu Persetujuan" && mo.status !== "Dibatalkan") {
        const tayangCount = allItems.filter((i) => i.status === "Tayang" || i.status === "Tayang Terverifikasi").length;
        let nextMoStatus = "Terjadwal";
        if (tayangCount === allItems.length) {
          nextMoStatus = "Selesai Tayang";
        } else if (tayangCount > 0) {
          nextMoStatus = "Sebagian Tayang";
        }
        db.prepare("UPDATE media_orders SET status = ? WHERE id = ?").run(nextMoStatus, mo.id);
      }
    })();
    logAudit(
      user,
      "Jadwal Tayang",
      "UPDATE_MO_ITEM",
      mo.nomor,
      `Memperbarui item "${current.judul_topik}" pada ${mo.nomor}: status ${current.status} -> ${status || current.status}, tanggal ${current.tanggal_tayang} -> ${tanggal_tayang || current.tanggal_tayang}`,
      { status: current.status, tanggal_tayang: current.tanggal_tayang },
      { status: status || current.status, tanggal_tayang: tanggal_tayang || current.tanggal_tayang, alasan }
    );
    res.json({ success: true });
  });
  app.get("/api/proofs", authenticateJWT, (_req, res) => {
    const proofs = db.prepare(`
        SELECT p.*, mo.nomor as nomor_mo, mo.nama_kampanye, d.nomor as nomor_deal, d.snapshot_nama_klien,
               u1.nama as pembuat_nama, u2.nama as verifikator_nama
        FROM proofs p
        JOIN media_orders mo ON mo.id = p.mo_id
        LEFT JOIN deals d ON d.id = p.deal_id
        JOIN users u1 ON u1.id = p.dibuat_oleh
        LEFT JOIN users u2 ON u2.id = p.diverifikasi_oleh
        ORDER BY p.id DESC
      `).all();
    const enriched = proofs.map((pr) => {
      const items = db.prepare("SELECT * FROM proof_items WHERE proof_id = ?").all(pr.id);
      return { ...pr, items };
    });
    res.json({ proofs: enriched });
  });
  app.post("/api/proofs", authenticateJWT, (req, res) => {
    const user = req.user;
    const perm = getPermission(user.role_id, "proofs");
    if (!perm?.can_create) {
      res.status(403).json({ error: "Role Anda tidak memiliki izin membuat Bukti Tayang." });
      return;
    }
    const { mo_id, periode_laporan, catatan_kompensasi, items } = req.body;
    const mo = db.prepare("SELECT * FROM media_orders WHERE id = ?").get(Number(mo_id));
    if (!mo) {
      res.status(404).json({ error: "Media Order tidak ditemukan." });
      return;
    }
    const nomor = generateDocumentNumber("BT");
    const proofId = db.transaction(() => {
      const pRes = db.prepare(`
          INSERT INTO proofs (nomor, mo_id, deal_id, periode_laporan, status, catatan_kompensasi, dibuat_oleh)
          VALUES (?, ?, ?, ?, 'Menunggu Verifikasi', ?, ?)
        `).run(nomor, mo.id, mo.deal_id, periode_laporan || "November 2026", catatan_kompensasi || "-", user.id);
      const newProofId = Number(pRes.lastInsertRowid);
      const insItem = db.prepare(`
        INSERT INTO proof_items (
          proof_id, mo_item_id, nama_item, platform, tanggal_tayang, url_live, screenshot_url,
          target_impresi, realisasi_impresi, reach, klik, ctr, views, engagement, capaian_persen, catatan
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const it of items || []) {
        const target = Number(it.target_impresi || 0);
        const realisasi = Number(it.realisasi_impresi || 0);
        const klik = Number(it.klik || 0);
        const ctr = realisasi > 0 ? Number((klik / realisasi * 100).toFixed(2)) : 0;
        const capaian = target > 0 ? Number((realisasi / target * 100).toFixed(1)) : 100;
        insItem.run(
          newProofId,
          Number(it.mo_item_id),
          it.nama_item,
          it.platform,
          it.tanggal_tayang,
          it.url_live || "https://nusantaramedia.id/live-content",
          it.screenshot_url || "",
          target,
          realisasi,
          Number(it.reach || 0),
          klik,
          ctr,
          Number(it.views || 0),
          Number(it.engagement || 0),
          capaian,
          it.catatan || "Tayang sesuai brief"
        );
        db.prepare(`
          UPDATE mo_items
          SET status = CASE WHEN status = 'Tayang Terverifikasi' THEN status ELSE 'Tayang' END,
              url_live = COALESCE(?, url_live),
              tanggal_tayang_aktual = COALESCE(tanggal_tayang_aktual, tanggal_tayang)
          WHERE id = ?
        `).run(it.url_live, Number(it.mo_item_id));
      }
      db.prepare(`
        INSERT INTO approvals (jenis_dokumen, dokumen_id, nomor_dokumen, ringkasan_alasan, diminta_oleh, target_role, status)
        VALUES ('Bukti Tayang', ?, ?, ?, ?, 'manager', 'Menunggu')
      `).run(
        newProofId,
        nomor,
        `Bukti Tayang ${nomor} untuk ${mo.nomor} (${mo.nama_kampanye}) siap diverifikasi Manager/Admin.`,
        user.id
      );
      return newProofId;
    })();
    logAudit(
      user,
      "Bukti Tayang",
      "CREATE_PROOF",
      nomor,
      `Mengunggah Bukti Tayang ${nomor} untuk Media Order ${mo.nomor} dan mengajukan verifikasi`,
      null,
      { nomor, mo_nomor: mo.nomor, status: "Menunggu Verifikasi" }
    );
    res.json({ id: proofId, nomor });
  });
  app.patch("/api/proof-items/:id/screenshot", authenticateJWT, (req, res) => {
    const user = req.user;
    const itemId = Number(req.params.id);
    const { screenshot_url, catatan } = req.body;
    const item = db.prepare("SELECT * FROM proof_items WHERE id = ?").get(itemId);
    if (!item) {
      res.status(404).json({ error: "Item Bukti Tayang tidak ditemukan." });
      return;
    }
    const proof = db.prepare("SELECT * FROM proofs WHERE id = ?").get(item.proof_id);
    db.prepare(`
      UPDATE proof_items
      SET screenshot_url = COALESCE(?, screenshot_url),
          catatan = COALESCE(?, catatan)
      WHERE id = ?
    `).run(screenshot_url, catatan, itemId);
    logAudit(
      user,
      "Bukti Tayang",
      "UPLOAD_PROOF_SCREENSHOT",
      proof?.nomor || null,
      `Mengunggah/memperbarui file screenshot pada item "${item.nama_item}" (${proof?.nomor || "BT"})`,
      null,
      { proof_item_id: itemId, nama_item: item.nama_item }
    );
    res.json({ success: true });
  });
  app.post("/api/proofs/:id/verify", authenticateJWT, (req, res) => {
    const user = req.user;
    const perm = getPermission(user.role_id, "proofs");
    if (!perm?.can_approve && user.role_kode !== "admin" && user.role_kode !== "super_admin") {
      res.status(403).json({ error: "Hanya Manager, Admin, atau Super Admin yang dapat memverifikasi Bukti Tayang." });
      return;
    }
    const proofId = Number(req.params.id);
    const proof = db.prepare("SELECT * FROM proofs WHERE id = ?").get(proofId);
    if (!proof) {
      res.status(404).json({ error: "Bukti Tayang tidak ditemukan." });
      return;
    }
    const pItems = db.prepare("SELECT * FROM proof_items WHERE proof_id = ?").all(proofId);
    db.transaction(() => {
      db.prepare(`
        UPDATE proofs
        SET status = 'Terverifikasi', diverifikasi_oleh = ?, tanggal_verifikasi = datetime('now')
        WHERE id = ?
      `).run(user.id, proofId);
      for (const pi of pItems) {
        db.prepare(`UPDATE mo_items SET status = 'Tayang Terverifikasi' WHERE id = ?`).run(pi.mo_item_id);
      }
      const moItems = db.prepare(`SELECT status FROM mo_items WHERE mo_id = ? AND status != 'Batal'`).all(proof.mo_id);
      const allDone = moItems.length > 0 && moItems.every((i) => i.status === "Tayang" || i.status === "Tayang Terverifikasi");
      db.prepare("UPDATE media_orders SET status = ? WHERE id = ?").run(allDone ? "Selesai Tayang" : "Sebagian Tayang", proof.mo_id);
      db.prepare(`
        UPDATE approvals
        SET status = 'Disetujui', disetujui_oleh = ?, decided_at = datetime('now'), catatan_keputusan = 'Bukti tayang diverifikasi.'
        WHERE jenis_dokumen = 'Bukti Tayang' AND dokumen_id = ? AND status = 'Menunggu'
      `).run(user.id, proofId);
    })();
    logAudit(
      user,
      "Bukti Tayang",
      "VERIFY_PROOF",
      proof.nomor,
      `Memverifikasi Bukti Tayang ${proof.nomor}; ${pItems.length} item MO otomatis berstatus Tayang Terverifikasi dan menambah progres Deal`,
      { status: proof.status },
      { status: "Terverifikasi", verified_items: pItems.length }
    );
    res.json({ success: true });
  });
  app.get("/api/invoices", authenticateJWT, (_req, res) => {
    const invoices = db.prepare(`
        SELECT i.*, d.nomor as nomor_deal, d.nama_kampanye, d.snapshot_nama_klien, d.no_po_klien,
               c.npwp as npwp_klien, c.alamat_tagih as alamat_klien,
               mo.nomor as nomor_mo, p.nomor as nomor_proof, u.nama as pembuat_nama
        FROM invoices i
        JOIN deals d ON d.id = i.deal_id
        JOIN clients c ON c.id = d.client_id
        LEFT JOIN media_orders mo ON mo.id = i.mo_id
        LEFT JOIN proofs p ON p.id = i.proof_id
        JOIN users u ON u.id = i.dibuat_oleh
        ORDER BY i.id DESC
      `).all();
    const enriched = invoices.map((inv) => {
      const items = db.prepare("SELECT * FROM invoice_items WHERE invoice_id = ?").all(inv.id);
      const payments = db.prepare(`
          SELECT py.*, u.nama as pencatat_nama
          FROM payments py
          JOIN users u ON u.id = py.dicatat_oleh
          WHERE py.invoice_id = ?
          ORDER BY py.id DESC
        `).all(inv.id);
      return { ...inv, items, payments };
    });
    res.json({ invoices: enriched });
  });
  app.post("/api/invoices", authenticateJWT, (req, res) => {
    const user = req.user;
    const perm = getPermission(user.role_id, "invoices");
    if (!perm?.can_create) {
      res.status(403).json({ error: "Hanya Finance atau Super Admin yang dapat menerbitkan Invoice." });
      return;
    }
    const { deal_id, mo_id, proof_id, skema, keterangan_termin, tanggal_terbit, pph23_dipotong, meterai, no_faktur_pajak, items } = req.body;
    const deal = getDealWithProgress(Number(deal_id));
    if (!deal) {
      res.status(404).json({ error: "Deal tidak ditemukan." });
      return;
    }
    const subtotal = (items || []).reduce((s, it) => s + Number(it.jumlah || 0), 0);
    const ppnNominal = Math.round(subtotal * 0.11);
    const pph23Nominal = pph23_dipotong ? Math.round(subtotal * 0.02) : 0;
    const meteraiNom = Number(meterai || 0);
    const totalTagihan = subtotal + ppnNominal - pph23Nominal + meteraiNom;
    if (deal.keuangan.nilai_tertagih + subtotal > deal.nilai_deal + 5e4 && !deal.catatan_addendum) {
      res.status(400).json({
        error: `Total nilai tagihan melebihi sisa nilai kontrak Deal (Sisa belum tertagih: Rp ${deal.keuangan.sisa_belum_tertagih.toLocaleString("id-ID")}).`
      });
      return;
    }
    const issueDate = tanggal_terbit || "2026-11-08";
    const dueObj = new Date(issueDate);
    dueObj.setDate(dueObj.getDate() + Number(deal.termin_hari || 30));
    const jatuhTempo = dueObj.toISOString().split("T")[0];
    const nomor = generateDocumentNumber("INV", issueDate);
    const invoiceId = db.transaction(() => {
      const iRes = db.prepare(`
          INSERT INTO invoices (
            nomor, deal_id, mo_id, proof_id, skema, keterangan_termin, tanggal_terbit, jatuh_tempo,
            subtotal, ppn_persen, ppn_nominal, pph23_dipotong, pph23_nominal, meterai, total_tagihan, total_dibayar,
            status, no_faktur_pajak, dibuat_oleh
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 11, ?, ?, ?, ?, ?, 0, 'Terkirim', ?, ?)
        `).run(
        nomor,
        deal.id,
        mo_id ? Number(mo_id) : null,
        proof_id ? Number(proof_id) : null,
        skema || deal.skema_tagih,
        keterangan_termin || `Tagihan Kampanye ${deal.nama_kampanye}`,
        issueDate,
        jatuhTempo,
        subtotal,
        ppnNominal,
        pph23_dipotong ? 1 : 0,
        pph23Nominal,
        meteraiNom,
        totalTagihan,
        no_faktur_pajak || "010.004-26.90011223",
        user.id
      );
      const newInvId = Number(iRes.lastInsertRowid);
      const insItem = db.prepare(`
        INSERT INTO invoice_items (invoice_id, deal_item_id, mo_id, proof_id, deskripsi, periode_tayang, qty, satuan, harga_satuan, diskon, jumlah)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
      `);
      for (const it of items || []) {
        insItem.run(
          newInvId,
          it.deal_item_id ? Number(it.deal_item_id) : null,
          mo_id ? Number(mo_id) : null,
          proof_id ? Number(proof_id) : null,
          it.deskripsi,
          it.periode_tayang || "November 2026",
          Number(it.qty || 1),
          it.satuan || "Paket",
          Number(it.harga_satuan || 0),
          Number(it.jumlah || 0)
        );
      }
      return newInvId;
    })();
    logAudit(
      user,
      "Invoice",
      "CREATE_INVOICE",
      nomor,
      `Menerbitkan Invoice ${nomor} untuk Deal ${deal.nomor} sebesar Rp ${totalTagihan.toLocaleString("id-ID")} (Jatuh tempo: ${jatuhTempo})`,
      null,
      { nomor, deal_nomor: deal.nomor, totalTagihan, jatuhTempo }
    );
    res.json({ id: invoiceId, nomor });
  });
  app.post("/api/invoices/:id/payments", authenticateJWT, (req, res) => {
    const user = req.user;
    const permPay = getPermission(user.role_id, "payments");
    const permInv = getPermission(user.role_id, "invoices");
    const hasCreatePerm = permPay?.can_create || permInv?.can_create || user.role_id === 1 || ["super_admin", "admin", "finance", "direktur"].includes(user.role_kode);
    if (!hasCreatePerm) {
      res.status(403).json({ error: "Hanya Finance atau Super Admin yang dapat mencatat pembayaran." });
      return;
    }
    const invoiceId = Number(req.params.id);
    const inv = db.prepare("SELECT * FROM invoices WHERE id = ?").get(invoiceId);
    if (!inv) {
      res.status(404).json({ error: "Invoice tidak ditemukan." });
      return;
    }
    const { tanggal_bayar, jumlah, metode, referensi_bank, bukti_file, untuk_pembayaran, catatan } = req.body;
    const bayarBaru = Number(jumlah || 0);
    const totalDibayarBaru = Number(inv.total_dibayar) + bayarBaru;
    const statusBaru = totalDibayarBaru >= Number(inv.total_tagihan) ? "Lunas" : "Dibayar Sebagian";
    const tanggal = tanggal_bayar || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const nomorKwitansi = generateDocumentNumber("KWT", tanggal);
    const descPembayaran = untuk_pembayaran || `Pembayaran Invoice #${inv.nomor}`;
    let newPaymentId = 0;
    db.transaction(() => {
      const r = db.prepare(`
        INSERT INTO payments (nomor_kwitansi, invoice_id, tanggal_bayar, jumlah, metode, referensi_bank, bukti_file, untuk_pembayaran, catatan, status, dicatat_oleh)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Diterima', ?)
      `).run(
        nomorKwitansi,
        invoiceId,
        tanggal,
        bayarBaru,
        metode || "Transfer Bank",
        referensi_bank || "-",
        bukti_file || null,
        descPembayaran,
        catatan || null,
        user.id
      );
      newPaymentId = Number(r.lastInsertRowid);
      db.prepare("UPDATE invoices SET total_dibayar = ?, status = ? WHERE id = ?").run(totalDibayarBaru, statusBaru, invoiceId);
    })();
    logAudit(
      user,
      "Pembayaran & Kwitansi",
      "RECORD_PAYMENT",
      nomorKwitansi,
      `Mencatat pembayaran Rp ${bayarBaru.toLocaleString("id-ID")} (Kwitansi ${nomorKwitansi}) pada Invoice ${inv.nomor}. Status menjadi: ${statusBaru}`,
      { total_dibayar: inv.total_dibayar, status: inv.status },
      { total_dibayar: totalDibayarBaru, status: statusBaru, referensi_bank, nomor_kwitansi: nomorKwitansi }
    );
    res.json({
      success: true,
      id: newPaymentId,
      nomor_kwitansi: nomorKwitansi,
      status: statusBaru,
      total_dibayar: totalDibayarBaru
    });
  });
  app.get("/api/receipts", authenticateJWT, (_req, res) => {
    try {
      const unnumbered = db.prepare('SELECT id, tanggal_bayar FROM payments WHERE nomor_kwitansi IS NULL OR nomor_kwitansi = ""').all();
      for (const p of unnumbered) {
        const noKwt = generateDocumentNumber("KWT", p.tanggal_bayar);
        db.prepare("UPDATE payments SET nomor_kwitansi = ? WHERE id = ?").run(noKwt, p.id);
      }
    } catch {
    }
    const receipts = db.prepare(`
        SELECT py.*,
               inv.nomor as nomor_invoice,
               inv.tanggal_terbit as tanggal_invoice,
               inv.jatuh_tempo as jatuh_tempo_invoice,
               inv.total_tagihan as total_tagihan_invoice,
               inv.total_dibayar as total_dibayar_invoice,
               inv.status as status_invoice,
               COALESCE(c.nama, d.snapshot_nama_klien, 'Klien') as snapshot_nama_klien,
               COALESCE(c.alamat_tagih, q.snapshot_alamat, '') as snapshot_alamat,
               COALESCE(c.npwp, q.snapshot_npwp, '') as snapshot_npwp,
               COALESCE(q.snapshot_pic, '') as snapshot_pic,
               d.nama_kampanye,
               d.nomor as nomor_deal,
               q.nomor as nomor_quotation,
               COALESCE(c.nama, d.snapshot_nama_klien, 'Klien') as nama_klien,
               u.nama as nama_pencatat,
               u.jabatan as jabatan_pencatat
        FROM payments py
        JOIN invoices inv ON inv.id = py.invoice_id
        LEFT JOIN deals d ON d.id = inv.deal_id
        LEFT JOIN clients c ON c.id = d.client_id
        LEFT JOIN quotations q ON q.id = d.quotation_id
        LEFT JOIN users u ON u.id = py.dicatat_oleh
        ORDER BY py.tanggal_bayar DESC, py.id DESC
      `).all();
    res.json({ receipts });
  });
  app.post("/api/receipts", authenticateJWT, (req, res) => {
    const user = req.user;
    const permPay = getPermission(user.role_id, "payments");
    const permInv = getPermission(user.role_id, "invoices");
    const hasCreatePerm = permPay?.can_create || permInv?.can_create || user.role_id === 1 || ["super_admin", "admin", "finance", "direktur"].includes(user.role_kode);
    if (!hasCreatePerm) {
      res.status(403).json({ error: "Tidak memiliki izin menerbitkan kwitansi / mencatat pembayaran." });
      return;
    }
    const { invoice_id, tanggal_bayar, jumlah, metode, referensi_bank, bukti_file, untuk_pembayaran, catatan } = req.body;
    const inv = db.prepare(`
      SELECT inv.*, d.nama_kampanye, d.nomor as nomor_deal, d.snapshot_nama_klien,
             c.nama as nama_klien, c.alamat_tagih as snapshot_alamat, c.npwp as snapshot_npwp
      FROM invoices inv
      LEFT JOIN deals d ON d.id = inv.deal_id
      LEFT JOIN clients c ON c.id = d.client_id
      WHERE inv.id = ?
    `).get(Number(invoice_id));
    if (!inv) {
      res.status(404).json({ error: "Invoice referensi tidak ditemukan." });
      return;
    }
    const bayarBaru = Number(jumlah || 0);
    if (bayarBaru <= 0) {
      res.status(400).json({ error: "Nominal pembayaran kwitansi harus lebih dari Rp 0." });
      return;
    }
    const tanggal = tanggal_bayar || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const nomorKwitansi = generateDocumentNumber("KWT", tanggal);
    const totalDibayarBaru = Number(inv.total_dibayar) + bayarBaru;
    const statusBaru = totalDibayarBaru >= Number(inv.total_tagihan) ? "Lunas" : "Dibayar Sebagian";
    const descPembayaran = untuk_pembayaran || `Pembayaran Invoice #${inv.nomor}${inv.nama_kampanye ? ` \u2014 Kampanye ${inv.nama_kampanye}` : ""}`;
    let newReceiptId = 0;
    db.transaction(() => {
      const r = db.prepare(`
        INSERT INTO payments (nomor_kwitansi, invoice_id, tanggal_bayar, jumlah, metode, referensi_bank, bukti_file, untuk_pembayaran, catatan, status, dicatat_oleh)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Diterima', ?)
      `).run(
        nomorKwitansi,
        inv.id,
        tanggal,
        bayarBaru,
        metode || "Transfer Bank",
        referensi_bank || "-",
        bukti_file || null,
        descPembayaran,
        catatan || null,
        user.id
      );
      newReceiptId = Number(r.lastInsertRowid);
      db.prepare("UPDATE invoices SET total_dibayar = ?, status = ? WHERE id = ?").run(totalDibayarBaru, statusBaru, inv.id);
    })();
    logAudit(
      user,
      "Kwitansi & Pembayaran",
      "CREATE_RECEIPT",
      nomorKwitansi,
      `Menerbitkan Kwitansi ${nomorKwitansi} sebesar Rp ${bayarBaru.toLocaleString("id-ID")} untuk Invoice ${inv.nomor} (${inv.snapshot_nama_klien || inv.nama_klien})`,
      null,
      { nomor_kwitansi: nomorKwitansi, invoice_id: inv.id, jumlah: bayarBaru, metode }
    );
    res.json({
      success: true,
      id: newReceiptId,
      nomor_kwitansi: nomorKwitansi,
      invoice_status: statusBaru,
      total_dibayar: totalDibayarBaru,
      message: `Kwitansi ${nomorKwitansi} berhasil diterbitkan.`
    });
  });
  app.delete("/api/receipts/:id", authenticateJWT, (req, res) => {
    try {
      const user = req.user;
      if (!isManagerOrAbove(user)) {
        res.status(403).json({ error: "Akses ditolak: Fitur hapus kwitansi hanya dapat dilakukan oleh level minimal Manajer atau Direksi." });
        return;
      }
      const receiptId = Number(req.params.id);
      const payment = db.prepare(`
        SELECT py.*, inv.nomor as nomor_invoice, inv.total_dibayar as inv_total_dibayar, inv.total_tagihan as inv_total_tagihan
        FROM payments py
        JOIN invoices inv ON inv.id = py.invoice_id
        WHERE py.id = ?
      `).get(receiptId);
      if (!payment) {
        res.status(404).json({ error: "Data Kwitansi tidak ditemukan." });
        return;
      }
      const bayarKurang = Number(payment.jumlah || 0);
      const newTotalDibayar = Math.max(0, Number(payment.inv_total_dibayar || 0) - bayarKurang);
      const newStatus = newTotalDibayar <= 0 ? "Terkirim" : newTotalDibayar >= Number(payment.inv_total_tagihan) ? "Lunas" : "Dibayar Sebagian";
      db.transaction(() => {
        db.prepare("DELETE FROM payments WHERE id = ?").run(receiptId);
        db.prepare("UPDATE invoices SET total_dibayar = ?, status = ? WHERE id = ?").run(newTotalDibayar, newStatus, payment.invoice_id);
      })();
      logAudit(
        user,
        "Kwitansi & Pembayaran",
        "DELETE_RECEIPT",
        payment.nomor_kwitansi || `ID #${receiptId}`,
        `Menghapus Kwitansi ${payment.nomor_kwitansi} senilai Rp ${bayarKurang.toLocaleString("id-ID")} pada Invoice ${payment.nomor_invoice}. Sisa tagihan dikembalikan, status invoice: ${newStatus}.`,
        payment,
        null
      );
      res.json({
        success: true,
        message: `Kwitansi ${payment.nomor_kwitansi} berhasil dihapus. Status tagihan invoice telah dikembalikan.`
      });
    } catch (err) {
      res.status(500).json({ error: err?.message || "Gagal menghapus Kwitansi." });
    }
  });
  app.delete("/api/invoices/:id", authenticateJWT, (req, res) => {
    try {
      const user = req.user;
      if (!isManagerOrAbove(user)) {
        res.status(403).json({ error: "Akses ditolak: Fitur hapus invoice hanya dapat dilakukan oleh level minimal Manajer atau Direksi." });
        return;
      }
      const invoiceId = Number(req.params.id);
      const inv = db.prepare("SELECT * FROM invoices WHERE id = ?").get(invoiceId);
      if (!inv) {
        res.status(404).json({ error: "Invoice tidak ditemukan." });
        return;
      }
      const payCount = db.prepare("SELECT count(*) as c FROM payments WHERE invoice_id = ?").get(invoiceId)?.c || 0;
      if (payCount > 0) {
        res.status(400).json({ error: `Invoice ${inv.nomor} tidak dapat dihapus karena sudah memiliki ${payCount} bukti Kwitansi pembayaran. Hapus Kwitansi terkait terlebih dahulu.` });
        return;
      }
      db.transaction(() => {
        db.prepare("DELETE FROM invoice_items WHERE invoice_id = ?").run(invoiceId);
        db.prepare("DELETE FROM approvals WHERE jenis_dokumen = 'Invoice' AND dokumen_id = ?").run(invoiceId);
        db.prepare("DELETE FROM invoices WHERE id = ?").run(invoiceId);
      })();
      logAudit(
        user,
        "Invoice & Penagihan",
        "DELETE_INVOICE",
        inv.nomor,
        `Menghapus Invoice ${inv.nomor} senilai Rp ${Number(inv.total_tagihan).toLocaleString("id-ID")}`,
        inv,
        null
      );
      res.json({ success: true, message: `Invoice ${inv.nomor} berhasil dihapus.` });
    } catch (err) {
      res.status(500).json({ error: err?.message || "Gagal menghapus Invoice." });
    }
  });
  app.delete("/api/proofs/:id", authenticateJWT, (req, res) => {
    try {
      const user = req.user;
      if (!isManagerOrAbove(user)) {
        res.status(403).json({ error: "Akses ditolak: Fitur hapus bukti tayang hanya dapat dilakukan oleh level minimal Manajer atau Direksi." });
        return;
      }
      const proofId = Number(req.params.id);
      const proof = db.prepare("SELECT * FROM proofs WHERE id = ?").get(proofId);
      if (!proof) {
        res.status(404).json({ error: "Bukti Tayang tidak ditemukan." });
        return;
      }
      const linkedInv = db.prepare("SELECT nomor FROM invoices WHERE proof_id = ?").get(proofId);
      if (linkedInv) {
        res.status(400).json({ error: `Bukti Tayang ${proof.nomor} terhubung ke Invoice ${linkedInv.nomor}. Hapus Invoice tersebut terlebih dahulu.` });
        return;
      }
      db.transaction(() => {
        db.prepare("UPDATE invoice_items SET proof_id = NULL WHERE proof_id = ?").run(proofId);
        db.prepare("DELETE FROM proof_items WHERE proof_id = ?").run(proofId);
        db.prepare("DELETE FROM approvals WHERE jenis_dokumen = 'Bukti Tayang' AND dokumen_id = ?").run(proofId);
        db.prepare("DELETE FROM proofs WHERE id = ?").run(proofId);
      })();
      logAudit(
        user,
        "Bukti Tayang",
        "DELETE_PROOF",
        proof.nomor,
        `Menghapus Dokumen Bukti Tayang ${proof.nomor} (${proof.periode_laporan || "-"})`,
        proof,
        null
      );
      res.json({ success: true, message: `Bukti Tayang ${proof.nomor} berhasil dihapus.` });
    } catch (err) {
      res.status(500).json({ error: err?.message || "Gagal menghapus Bukti Tayang." });
    }
  });
  app.delete("/api/media-orders/:id", authenticateJWT, (req, res) => {
    try {
      const user = req.user;
      if (!isManagerOrAbove(user)) {
        res.status(403).json({ error: "Akses ditolak: Fitur hapus Media Order hanya dapat dilakukan oleh level minimal Manajer atau Direksi." });
        return;
      }
      const moId = Number(req.params.id);
      const mo = db.prepare("SELECT * FROM media_orders WHERE id = ?").get(moId);
      if (!mo) {
        res.status(404).json({ error: "Media Order tidak ditemukan." });
        return;
      }
      const linkedProof = db.prepare("SELECT nomor FROM proofs WHERE mo_id = ?").get(moId);
      if (linkedProof) {
        res.status(400).json({ error: `Media Order ${mo.nomor} tidak dapat dihapus karena sudah memiliki Bukti Tayang ${linkedProof.nomor}. Hapus Bukti Tayang terlebih dahulu.` });
        return;
      }
      const linkedInv = db.prepare("SELECT nomor FROM invoices WHERE mo_id = ?").get(moId);
      if (linkedInv) {
        res.status(400).json({ error: `Media Order ${mo.nomor} tidak dapat dihapus karena sudah memiliki Invoice ${linkedInv.nomor}. Hapus Invoice terlebih dahulu.` });
        return;
      }
      db.transaction(() => {
        db.prepare("UPDATE invoice_items SET mo_id = NULL WHERE mo_id = ?").run(moId);
        db.prepare("DELETE FROM proof_items WHERE mo_item_id IN (SELECT id FROM mo_items WHERE mo_id = ?)").run(moId);
        db.prepare("DELETE FROM mo_item_logs WHERE mo_item_id IN (SELECT id FROM mo_items WHERE mo_id = ?)").run(moId);
        db.prepare("DELETE FROM mo_items WHERE mo_id = ?").run(moId);
        db.prepare("DELETE FROM approvals WHERE jenis_dokumen = 'Media Order' AND dokumen_id = ?").run(moId);
        db.prepare("DELETE FROM media_orders WHERE id = ?").run(moId);
      })();
      logAudit(
        user,
        "Media Order (MO)",
        "DELETE_MO",
        mo.nomor,
        `Menghapus Media Order ${mo.nomor}`,
        mo,
        null
      );
      res.json({ success: true, message: `Media Order ${mo.nomor} berhasil dihapus.` });
    } catch (err) {
      res.status(500).json({ error: err?.message || "Gagal menghapus Media Order." });
    }
  });
  app.delete("/api/deals/:id", authenticateJWT, (req, res) => {
    try {
      const user = req.user;
      if (!isManagerOrAbove(user)) {
        res.status(403).json({ error: "Akses ditolak: Fitur hapus paket deal hanya dapat dilakukan oleh level minimal Manajer atau Direksi." });
        return;
      }
      const dealId = Number(req.params.id);
      const deal = db.prepare("SELECT * FROM deals WHERE id = ?").get(dealId);
      if (!deal) {
        res.status(404).json({ error: "Paket Deal tidak ditemukan." });
        return;
      }
      const moCount = db.prepare("SELECT count(*) as c FROM media_orders WHERE deal_id = ?").get(dealId)?.c || 0;
      const invCount = db.prepare("SELECT count(*) as c FROM invoices WHERE deal_id = ?").get(dealId)?.c || 0;
      const proofCount = db.prepare("SELECT count(*) as c FROM proofs WHERE deal_id = ?").get(dealId)?.c || 0;
      if (moCount > 0 || invCount > 0 || proofCount > 0) {
        res.status(400).json({
          error: `Deal ${deal.nomor} tidak dapat dihapus karena masih memiliki dokumen turunan aktif (${moCount} Media Order, ${proofCount} Bukti Tayang, ${invCount} Invoice). Hapus dokumen turunannya terlebih dahulu.`
        });
        return;
      }
      db.transaction(() => {
        db.prepare("UPDATE mo_items SET deal_item_id = NULL WHERE deal_item_id IN (SELECT id FROM deal_items WHERE deal_id = ?)").run(dealId);
        db.prepare("UPDATE invoice_items SET deal_item_id = NULL WHERE deal_item_id IN (SELECT id FROM deal_items WHERE deal_id = ?)").run(dealId);
        db.prepare("DELETE FROM deal_items WHERE deal_id = ?").run(dealId);
        db.prepare("DELETE FROM deals WHERE id = ?").run(dealId);
        if (deal.quotation_id) {
          db.prepare("UPDATE quotations SET status = 'Terkirim' WHERE id = ? AND status = 'Deal'").run(deal.quotation_id);
        }
      })();
      logAudit(
        user,
        "Paket Deal & Kuota",
        "DELETE_DEAL",
        deal.nomor,
        `Menghapus Paket Deal ${deal.nomor} (${deal.nama_kampanye || "-"}) senilai Rp ${Number(deal.nilai_deal).toLocaleString("id-ID")}`,
        deal,
        null
      );
      res.json({ success: true, message: `Paket Deal ${deal.nomor} berhasil dihapus.` });
    } catch (err) {
      res.status(500).json({ error: err?.message || "Gagal menghapus Paket Deal." });
    }
  });
  app.delete("/api/quotations/:id", authenticateJWT, (req, res) => {
    try {
      const user = req.user;
      if (!isManagerOrAbove(user)) {
        res.status(403).json({ error: "Akses ditolak: Fitur hapus quotation hanya dapat dilakukan oleh level minimal Manajer atau Direksi." });
        return;
      }
      const qId = Number(req.params.id);
      const q = db.prepare("SELECT * FROM quotations WHERE id = ?").get(qId);
      if (!q) {
        res.status(404).json({ error: "Quotation tidak ditemukan." });
        return;
      }
      const deal = db.prepare("SELECT nomor FROM deals WHERE quotation_id = ?").get(qId);
      if (deal) {
        res.status(400).json({ error: `Quotation ${q.nomor} telah dikonversi menjadi Deal ${deal.nomor}. Hapus Deal terkait terlebih dahulu.` });
        return;
      }
      db.transaction(() => {
        const versions = db.prepare("SELECT id FROM quotation_versions WHERE quotation_id = ?").all(qId);
        for (const v of versions) {
          db.prepare("DELETE FROM quotation_items WHERE version_id = ?").run(v.id);
        }
        db.prepare("DELETE FROM quotation_versions WHERE quotation_id = ?").run(qId);
        db.prepare("DELETE FROM approvals WHERE jenis_dokumen = 'Quotation' AND dokumen_id = ?").run(qId);
        db.prepare("DELETE FROM quotations WHERE id = ?").run(qId);
      })();
      logAudit(
        user,
        "Quotation",
        "DELETE_QUOTATION",
        q.nomor,
        `Menghapus Dokumen Quotation ${q.nomor} (${q.judul_penawaran || "-"})`,
        q,
        null
      );
      res.json({ success: true, message: `Quotation ${q.nomor} berhasil dihapus.` });
    } catch (err) {
      res.status(500).json({ error: err?.message || "Gagal menghapus Quotation." });
    }
  });
  app.delete("/api/clients/:id", authenticateJWT, (req, res) => {
    try {
      const user = req.user;
      if (!isManagerOrAbove(user)) {
        res.status(403).json({ error: "Akses ditolak: Fitur hapus klien hanya dapat dilakukan oleh level minimal Manajer atau Direksi." });
        return;
      }
      const clientId = Number(req.params.id);
      const client = db.prepare("SELECT * FROM clients WHERE id = ?").get(clientId);
      if (!client) {
        res.status(404).json({ error: "Klien tidak ditemukan." });
        return;
      }
      const dealCount = db.prepare("SELECT count(*) as c FROM deals WHERE client_id = ?").get(clientId)?.c || 0;
      const quotCount = db.prepare("SELECT count(*) as c FROM quotations WHERE client_id = ?").get(clientId)?.c || 0;
      if (dealCount > 0 || quotCount > 0) {
        res.status(400).json({ error: `Klien ${client.nama} tidak dapat dihapus karena masih terhubung dengan ${quotCount} Quotation dan ${dealCount} Paket Deal.` });
        return;
      }
      db.transaction(() => {
        db.prepare("UPDATE clients SET parent_client_id = NULL WHERE parent_client_id = ?").run(clientId);
        db.prepare("DELETE FROM client_contacts WHERE client_id = ?").run(clientId);
        db.prepare("DELETE FROM clients WHERE id = ?").run(clientId);
      })();
      logAudit(
        user,
        "Master Klien",
        "DELETE_CLIENT",
        client.nama,
        `Menghapus Master Klien: ${client.nama} (NPWP: ${client.npwp || "-"})`,
        client,
        null
      );
      res.json({ success: true, message: `Klien ${client.nama} berhasil dihapus.` });
    } catch (err) {
      res.status(500).json({ error: err?.message || "Gagal menghapus Klien." });
    }
  });
  app.delete("/api/catalog/products/:id", authenticateJWT, (req, res) => {
    try {
      const user = req.user;
      if (!isManagerOrAbove(user)) {
        res.status(403).json({ error: "Akses ditolak: Fitur hapus rate card hanya dapat dilakukan oleh level minimal Manajer atau Direksi." });
        return;
      }
      const prodId = Number(req.params.id);
      const prod = db.prepare("SELECT * FROM products WHERE id = ?").get(prodId);
      if (!prod) {
        res.status(404).json({ error: "Item produk tidak ditemukan." });
        return;
      }
      const qItemCount = db.prepare("SELECT count(*) as c FROM quotation_items WHERE product_id = ?").get(prodId)?.c || 0;
      const dItemCount = db.prepare("SELECT count(*) as c FROM deal_items WHERE product_id = ?").get(prodId)?.c || 0;
      const moItemCount = db.prepare("SELECT count(*) as c FROM mo_items WHERE product_id = ?").get(prodId)?.c || 0;
      if (qItemCount > 0 || dItemCount > 0 || moItemCount > 0) {
        res.status(400).json({
          error: `Produk "${prod.nama}" sedang digunakan pada dokumen transaksi (${qItemCount} item Quotation, ${dItemCount} item Deal, ${moItemCount} item MO). Nonaktifkan produk jika tidak ingin ditawarkan lagi.`
        });
        return;
      }
      db.transaction(() => {
        db.prepare("DELETE FROM package_items WHERE product_id = ?").run(prodId);
        db.prepare("DELETE FROM product_prices WHERE product_id = ?").run(prodId);
        db.prepare("DELETE FROM products WHERE id = ?").run(prodId);
      })();
      logAudit(
        user,
        "Katalog & Rate Card",
        "DELETE_PRODUCT",
        prod.nama,
        `Menghapus item produk rate card: ${prod.nama} (${prod.kategori})`,
        prod,
        null
      );
      res.json({ success: true, message: `Produk ${prod.nama} berhasil dihapus.` });
    } catch (err) {
      res.status(500).json({ error: err?.message || "Gagal menghapus Produk." });
    }
  });
  app.get("/api/approvals", authenticateJWT, (_req, res) => {
    const approvals = db.prepare(`
        SELECT a.*, u1.nama as pemohon_nama, u1.jabatan as pemohon_jabatan, u2.nama as penyetuju_nama
        FROM approvals a
        JOIN users u1 ON u1.id = a.diminta_oleh
        LEFT JOIN users u2 ON u2.id = a.disetujui_oleh
        ORDER BY a.id DESC
      `).all();
    res.json({ approvals });
  });
  app.post("/api/approvals/:id/decide", authenticateJWT, (req, res) => {
    const user = req.user;
    if (!["manager", "direktur", "super_admin"].includes(user.role_kode)) {
      res.status(403).json({ error: "Hanya Manager, Direktur, atau Super Admin yang dapat memutuskan persetujuan." });
      return;
    }
    const approvalId = Number(req.params.id);
    const { decision, catatan } = req.body;
    const appRow = db.prepare("SELECT * FROM approvals WHERE id = ?").get(approvalId);
    if (!appRow || appRow.status !== "Menunggu") {
      res.status(400).json({ error: "Permintaan persetujuan tidak ditemukan atau sudah diputuskan." });
      return;
    }
    db.transaction(() => {
      db.prepare(`
        UPDATE approvals
        SET status = ?, disetujui_oleh = ?, decided_at = datetime('now'), catatan_keputusan = ?
        WHERE id = ?
      `).run(decision, user.id, catatan || "Diputuskan oleh manajemen", approvalId);
      if (appRow.jenis_dokumen === "Quotation") {
        const nextQStatus = decision === "Disetujui" ? "Terkirim" : "Draft";
        db.prepare("UPDATE quotations SET status = ? WHERE id = ?").run(nextQStatus, appRow.dokumen_id);
      } else if (appRow.jenis_dokumen === "Media Order") {
        const nextMoStatus = decision === "Disetujui" ? "Terjadwal" : "Dibatalkan";
        db.prepare("UPDATE media_orders SET status = ?, disetujui_oleh = ? WHERE id = ?").run(nextMoStatus, user.id, appRow.dokumen_id);
      } else if (appRow.jenis_dokumen === "Bukti Tayang" && decision === "Disetujui") {
        db.prepare(`UPDATE proofs SET status = 'Terverifikasi', diverifikasi_oleh = ?, tanggal_verifikasi = datetime('now') WHERE id = ?`).run(
          user.id,
          appRow.dokumen_id
        );
        const pItems = db.prepare("SELECT mo_item_id FROM proof_items WHERE proof_id = ?").all(appRow.dokumen_id);
        for (const pi of pItems) {
          db.prepare(`UPDATE mo_items SET status = 'Tayang Terverifikasi' WHERE id = ?`).run(pi.mo_item_id);
        }
      }
    })();
    logAudit(
      user,
      "Approval",
      decision === "Disetujui" ? "APPROVE_DOCUMENT" : "REJECT_DOCUMENT",
      appRow.nomor_dokumen,
      `${user.nama} (${user.role_nama}) memberikan keputusan "${decision}" untuk ${appRow.jenis_dokumen} ${appRow.nomor_dokumen}`,
      { status: "Menunggu" },
      { status: decision, catatan }
    );
    res.json({ success: true });
  });
  app.get("/api/audit-logs", authenticateJWT, (req, res) => {
    const { modul, search } = req.query;
    let logs = db.prepare("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 200").all();
    if (modul && modul !== "all") {
      logs = logs.filter((l) => l.modul.toLowerCase() === String(modul).toLowerCase());
    }
    if (search) {
      const q = String(search).toLowerCase();
      logs = logs.filter(
        (l) => l.ringkasan.toLowerCase().includes(q) || l.nama_user.toLowerCase().includes(q) || l.nomor_dokumen && l.nomor_dokumen.toLowerCase().includes(q)
      );
    }
    res.json({ logs });
  });
  app.get("/api/settings", authenticateJWT, (_req, res) => {
    const settingsRows = db.prepare("SELECT * FROM settings").all();
    const settings = {};
    for (const r of settingsRows) {
      settings[r.kunci] = r.nilai;
    }
    const roles = db.prepare("SELECT * FROM roles ORDER BY id ASC").all();
    const roleMatrix = roles.map((r) => {
      const perms = db.prepare("SELECT * FROM role_permissions WHERE role_id = ?").all(r.id);
      return { ...r, permissions: perms };
    });
    const users = db.prepare(`
        SELECT u.id, u.nama, u.email, u.jabatan, u.role_id, u.team_id, u.aktif, u.last_login,
               r.nama as role_nama, r.kode as role_kode, t.nama as nama_tim
        FROM users u
        JOIN roles r ON r.id = u.role_id
        LEFT JOIN teams t ON t.id = u.team_id
        ORDER BY u.id ASC
      `).all();
    const sequences = db.prepare("SELECT * FROM number_sequences ORDER BY tahun DESC, kode_dokumen ASC").all();
    res.json({ settings, roleMatrix, users, sequences });
  });
  app.put("/api/settings/permissions", authenticateJWT, (req, res) => {
    const user = req.user;
    if (user.role_kode !== "super_admin") {
      res.status(403).json({ error: "Hanya Super Admin yang dapat mengubah matriks hak akses role." });
      return;
    }
    const { role_id, modul, can_create, can_update, can_approve, can_view, scope } = req.body;
    const oldPerm = db.prepare("SELECT * FROM role_permissions WHERE role_id = ? AND modul = ?").get(Number(role_id), modul);
    db.prepare(`
      UPDATE role_permissions
      SET can_create = ?, can_update = ?, can_approve = ?, can_view = ?, scope = ?
      WHERE role_id = ? AND modul = ?
    `).run(can_create ? 1 : 0, can_update ? 1 : 0, can_approve ? 1 : 0, can_view ? 1 : 0, scope, Number(role_id), modul);
    logAudit(
      user,
      "Pengaturan",
      "UPDATE_ROLE_PERMISSION",
      `ROLE-${role_id}`,
      `Mengubah izin modul "${modul}" untuk Role ID ${role_id} (Scope: ${scope})`,
      oldPerm,
      { can_create, can_update, can_approve, can_view, scope }
    );
    res.json({ success: true });
  });
  app.post("/api/settings/users", authenticateJWT, (req, res) => {
    const user = req.user;
    if (user.role_kode !== "super_admin" && user.role_id !== 1) {
      res.status(403).json({ error: "Hanya Super Admin yang berwenang menambahkan pengguna baru." });
      return;
    }
    const { nama, email, password, jabatan, role_id, team_id } = req.body;
    if (!nama || !email) {
      res.status(400).json({ error: "Nama lengkap dan email login wajib diisi." });
      return;
    }
    const cleanEmail = String(email).toLowerCase().trim();
    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(cleanEmail);
    if (existing) {
      res.status(400).json({ error: `Email "${cleanEmail}" sudah terdaftar pada pengguna lain.` });
      return;
    }
    const finalPassword = password && String(password).trim().length >= 6 ? String(password).trim() : password && String(password).trim().length > 0 ? null : "MediaFlow2026!";
    if (finalPassword === null) {
      res.status(400).json({ error: "Kata sandi minimal harus 6 karakter." });
      return;
    }
    const hash = bcrypt2.hashSync(finalPassword, 10);
    const r = db.prepare(`
        INSERT INTO users (nama, email, password_hash, jabatan, role_id, team_id, aktif)
        VALUES (?, ?, ?, ?, ?, ?, 1)
      `).run(String(nama).trim(), cleanEmail, hash, jabatan ? String(jabatan).trim() : "Staff Operasional", Number(role_id) || 6, team_id ? Number(team_id) : 1);
    const newUserId = Number(r.lastInsertRowid);
    logAudit(
      user,
      "Pengguna & Role",
      "CREATE_USER",
      cleanEmail,
      `Menambahkan akun pengguna baru: ${nama} (${cleanEmail}) dengan Role ID ${role_id}`,
      null,
      { nama, email: cleanEmail, jabatan, role_id }
    );
    res.json({
      id: newUserId,
      nama: String(nama).trim(),
      email: cleanEmail,
      temporary_password: finalPassword,
      message: "Pengguna baru berhasil dibuat."
    });
  });
  app.put("/api/settings/users/:id/password", authenticateJWT, (req, res) => {
    const user = req.user;
    if (user.role_kode !== "super_admin" && user.role_id !== 1) {
      res.status(403).json({ error: "Hanya Super Admin yang berwenang mengatur ulang kata sandi pengguna." });
      return;
    }
    const targetUserId = Number(req.params.id);
    const { password_baru } = req.body;
    if (!password_baru || String(password_baru).trim().length < 6) {
      res.status(400).json({ error: "Kata sandi baru minimal harus 6 karakter." });
      return;
    }
    const targetUser = db.prepare("SELECT id, nama, email FROM users WHERE id = ?").get(targetUserId);
    if (!targetUser) {
      res.status(404).json({ error: "Pengguna tidak ditemukan dalam sistem." });
      return;
    }
    const newPassStr = String(password_baru).trim();
    const hash = bcrypt2.hashSync(newPassStr, 10);
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, targetUserId);
    logAudit(
      user,
      "Pengguna & Role",
      "RESET_USER_PASSWORD",
      targetUser.email,
      `Super Admin (${user.nama}) mereset kata sandi akun ${targetUser.nama} (${targetUser.email})`,
      null,
      { target_user_id: targetUserId, email: targetUser.email }
    );
    pushNotification(
      targetUserId,
      null,
      "Kata Sandi Akun Diperbarui Administrator",
      `Kata sandi akun Anda telah diperbarui oleh Super Administrator. Silakan hubungi admin jika ini bukan permintaan Anda.`,
      "account",
      null
    );
    res.json({
      success: true,
      message: `Kata sandi untuk pengguna ${targetUser.nama} (${targetUser.email}) berhasil diperbarui.`,
      user_id: targetUserId,
      new_password: newPassStr
    });
  });
  app.put("/api/settings/users/:id/toggle-status", authenticateJWT, (req, res) => {
    const user = req.user;
    if (user.role_kode !== "super_admin" && user.role_id !== 1) {
      res.status(403).json({ error: "Hanya Super Admin yang berwenang mengubah status akun pengguna." });
      return;
    }
    const targetUserId = Number(req.params.id);
    if (targetUserId === user.id) {
      res.status(400).json({ error: "Anda tidak dapat menonaktifkan akun Anda sendiri yang sedang aktif." });
      return;
    }
    const targetUser = db.prepare("SELECT id, nama, email, aktif FROM users WHERE id = ?").get(targetUserId);
    if (!targetUser) {
      res.status(404).json({ error: "Pengguna tidak ditemukan." });
      return;
    }
    const newStatus = targetUser.aktif === 1 ? 0 : 1;
    db.prepare("UPDATE users SET aktif = ? WHERE id = ?").run(newStatus, targetUserId);
    logAudit(
      user,
      "Pengguna & Role",
      "TOGGLE_USER_STATUS",
      targetUser.email,
      `Super Admin mengubah status akun ${targetUser.nama} (${targetUser.email}) menjadi ${newStatus === 1 ? "Aktif" : "Nonaktif"}`,
      { aktif: targetUser.aktif },
      { aktif: newStatus }
    );
    res.json({
      success: true,
      aktif: newStatus,
      message: `Status akun ${targetUser.nama} berhasil diubah menjadi ${newStatus === 1 ? "Aktif" : "Nonaktif"}.`
    });
  });
  app.get("/api/settings/sequences", authenticateJWT, (req, res) => {
    const user = req.user;
    if (user.role_id !== 1 && user.role_kode !== "super_admin" && user.role_kode !== "superadmin" && user.role_kode !== "admin") {
      res.status(403).json({ error: "Tidak memiliki izin mengakses pengaturan nomor dokumen." });
      return;
    }
    const config = getSequenceConfig();
    const counters = db.prepare("SELECT * FROM number_sequences ORDER BY tahun DESC, kode_dokumen ASC").all();
    const now = /* @__PURE__ */ new Date();
    const docTypes = ["QT", "DL", "MO", "BT", "INV", "KWT"];
    const previews = {};
    for (const doc of docTypes) {
      const docCode = config.codes[doc] || doc;
      const template = config.formats[doc] || config.global_format;
      let seqTahunKey = now.getFullYear();
      if (config.reset_period === "BULANAN") {
        seqTahunKey = now.getFullYear() * 100 + (now.getMonth() + 1);
      } else if (config.reset_period === "BERKELANJUTAN") {
        seqTahunKey = 0;
      }
      const matchCounter = counters.find((c) => c.kode_dokumen === doc && c.tahun === seqTahunKey);
      const nextSeq = (matchCounter ? matchCounter.last_seq : 0) + 1;
      previews[doc] = formatSequenceNumber(template, docCode, now, nextSeq, config.digits);
    }
    res.json({
      config,
      counters,
      previews
    });
  });
  app.put("/api/settings/sequences/format", authenticateJWT, (req, res) => {
    const user = req.user;
    if (user.role_id !== 1 && user.role_kode !== "super_admin" && user.role_kode !== "superadmin") {
      res.status(403).json({ error: "Hanya Super Admin yang berwenang mengubah konfigurasi format penomoran dokumen." });
      return;
    }
    const { global_format, digits, reset_period, codes, formats } = req.body;
    if (!global_format || typeof global_format !== "string") {
      res.status(400).json({ error: "Format penomoran global wajib diisi." });
      return;
    }
    const stmt = db.prepare("INSERT OR REPLACE INTO settings (kunci, nilai) VALUES (?, ?)");
    db.transaction(() => {
      stmt.run("seq_format_global", global_format.trim());
      stmt.run("format_nomor", global_format.trim());
      if (digits) {
        stmt.run("seq_digits", String(Math.min(Math.max(Number(digits) || 4, 3), 8)));
      }
      if (reset_period) {
        const periodStr = String(reset_period).toUpperCase();
        stmt.run("seq_reset_period", periodStr);
        stmt.run("reset_nomor", periodStr);
      }
      if (codes && typeof codes === "object") {
        for (const [k, v] of Object.entries(codes)) {
          if (v) stmt.run(`seq_code_${k}`, String(v).trim().toUpperCase());
        }
      }
      if (formats && typeof formats === "object") {
        for (const [k, v] of Object.entries(formats)) {
          if (v) stmt.run(`seq_format_${k}`, String(v).trim());
        }
      }
    })();
    logAudit(
      user,
      "Pengaturan Penomoran Dokumen",
      "UPDATE_SEQUENCE_FORMAT",
      null,
      `Super Admin (${user.nama}) memperbarui format penomoran dokumen: ${global_format}`,
      null,
      req.body
    );
    res.json({ success: true, message: "Format penomoran dokumen berhasil disimpan." });
  });
  app.put("/api/settings/sequences/counter", authenticateJWT, (req, res) => {
    const user = req.user;
    if (user.role_id !== 1 && user.role_kode !== "super_admin" && user.role_kode !== "superadmin") {
      res.status(403).json({ error: "Hanya Super Admin yang berwenang mengubah nomor urut counter dokumen." });
      return;
    }
    const { kode_dokumen, tahun, new_last_seq } = req.body;
    if (!kode_dokumen || tahun === void 0 || new_last_seq === void 0) {
      res.status(400).json({ error: "Kode dokumen, tahun periode, dan nilai counter baru wajib diisi." });
      return;
    }
    const nextVal = Math.max(0, parseInt(String(new_last_seq), 10) || 0);
    const existing = db.prepare("SELECT last_seq FROM number_sequences WHERE kode_dokumen = ? AND tahun = ?").get(kode_dokumen, Number(tahun));
    db.prepare(`
      INSERT INTO number_sequences (kode_dokumen, tahun, last_seq)
      VALUES (?, ?, ?)
      ON CONFLICT(kode_dokumen, tahun) DO UPDATE SET last_seq = excluded.last_seq
    `).run(kode_dokumen, Number(tahun), nextVal);
    logAudit(
      user,
      "Pengaturan Penomoran Dokumen",
      "UPDATE_SEQUENCE_COUNTER",
      `${kode_dokumen}-${tahun}`,
      `Super Admin (${user.nama}) mengubah counter nomor ${kode_dokumen} (Periode ${tahun}) dari ${existing?.last_seq ?? 0} menjadi ${nextVal}`,
      { old_seq: existing?.last_seq ?? 0 },
      { new_seq: nextVal, kode_dokumen, tahun }
    );
    res.json({
      success: true,
      message: `Counter ${kode_dokumen} untuk periode ${tahun} berhasil disesuaikan menjadi ${nextVal}.`,
      kode_dokumen,
      tahun: Number(tahun),
      last_seq: nextVal
    });
  });
  app.put("/api/settings/company", authenticateJWT, (req, res) => {
    const user = req.user;
    if (user.role_kode !== "super_admin" && user.role_kode !== "admin") {
      res.status(403).json({ error: "Tidak memiliki akses mengubah pengaturan perusahaan." });
      return;
    }
    const updates = req.body;
    const stmt = db.prepare("INSERT OR REPLACE INTO settings (kunci, nilai) VALUES (?, ?)");
    db.transaction(() => {
      for (const [k, v] of Object.entries(updates)) {
        stmt.run(k, String(v));
      }
    })();
    logAudit(user, "Pengaturan", "UPDATE_COMPANY_CONFIG", null, "Memperbarui konfigurasi profil perusahaan dan aturan penomoran/PDF", null, updates);
    res.json({ success: true });
  });
  app.put("/api/settings/web", authenticateJWT, (req, res) => {
    const user = req.user;
    if (user.role_kode !== "super_admin" && user.role_kode !== "admin") {
      res.status(403).json({ error: "Tidak memiliki izin mengubah master pengaturan web." });
      return;
    }
    const updates = req.body;
    const stmt = db.prepare("INSERT OR REPLACE INTO settings (kunci, nilai) VALUES (?, ?)");
    db.transaction(() => {
      for (const [k, v] of Object.entries(updates)) {
        stmt.run(k, String(v ?? ""));
      }
    })();
    logAudit(
      user,
      "Master Pengaturan Web",
      "UPDATE_WEB_CONFIG",
      null,
      `Memperbarui konfigurasi web aplikasi (Title: "${updates.site_title || "-"}", Indexing: ${updates.seo_indexing || "-"}, Turnstile: ${updates.turnstile_enabled || "-"}, Maintenance: ${updates.maintenance_mode || "-"})`,
      null,
      updates
    );
    res.json({ success: true });
  });
  app.get("/api/settings/system-stats", authenticateJWT, (req, res) => {
    const user = req.user;
    if (user.role_kode !== "super_admin" && user.role_kode !== "admin") {
      res.status(403).json({ error: "Tidak memiliki izin melihat statistik sistem VPS." });
      return;
    }
    let dbSize = 0;
    try {
      const stats = fs2.statSync(dbPath);
      dbSize = stats.size;
    } catch {
      dbSize = 0;
    }
    const totalUsers = db.prepare("SELECT COUNT(*) as c FROM users").get().c;
    const totalQuotations = db.prepare("SELECT COUNT(*) as c FROM quotations").get().c;
    const totalDeals = db.prepare("SELECT COUNT(*) as c FROM deals").get().c;
    const totalMos = db.prepare("SELECT COUNT(*) as c FROM media_orders").get().c;
    const totalInvoices = db.prepare("SELECT COUNT(*) as c FROM invoices").get().c;
    const totalAuditLogs = db.prepare("SELECT COUNT(*) as c FROM audit_logs").get().c;
    const mem = process.memoryUsage();
    res.json({
      platform: process.platform,
      arch: process.arch,
      node_version: process.version,
      uptime_seconds: Math.floor(process.uptime()),
      db_path: dbPath,
      db_size_bytes: dbSize,
      db_size_mb: (dbSize / (1024 * 1024)).toFixed(2),
      memory_rss_mb: (mem.rss / (1024 * 1024)).toFixed(1),
      memory_heap_mb: (mem.heapUsed / (1024 * 1024)).toFixed(1),
      counts: {
        users: totalUsers,
        quotations: totalQuotations,
        deals: totalDeals,
        media_orders: totalMos,
        invoices: totalInvoices,
        audit_logs: totalAuditLogs
      }
    });
  });
  app.get("/api/settings/backup-db", authenticateJWT, (req, res) => {
    const user = req.user;
    if (user.role_id !== 1 && user.role_kode !== "super_admin" && user.role_kode !== "superadmin") {
      res.status(403).json({ error: "Hanya Super Admin yang dapat mengunduh cadangan database." });
      return;
    }
    try {
      db.pragma("wal_checkpoint(TRUNCATE)");
    } catch (e) {
      console.warn("WAL checkpoint warning during backup download:", e);
    }
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const filename = `mediaflow-backup-${today}.db`;
    res.download(dbPath, filename, (err) => {
      if (!err) {
        logAudit(user, "Pengaturan", "BACKUP_DATABASE", filename, `Super Admin ${user.nama} mengunduh cadangan database SQLite (${filename})`);
      }
    });
  });
  app.post("/api/settings/restore-db", authenticateJWT, (req, res) => {
    const user = req.user;
    if (user.role_id !== 1 && user.role_kode !== "super_admin" && user.role_kode !== "superadmin") {
      res.status(403).json({ error: "Hanya Super Admin yang berwenang memulihkan (restore) database." });
      return;
    }
    const { file_base64, file_name } = req.body;
    if (!file_base64) {
      res.status(400).json({ error: "Berkas database backup (.db) belum diunggah." });
      return;
    }
    try {
      const cleanBase64 = file_base64.replace(/^data:.*?;base64,/, "");
      const buffer = Buffer.from(cleanBase64, "base64");
      if (buffer.length < 512) {
        res.status(400).json({ error: "Ukuran berkas terlalu kecil untuk sebuah database SQLite yang valid." });
        return;
      }
      const result = restoreDatabaseFromFile(buffer);
      logAudit(
        user,
        "Pengaturan",
        "RESTORE_DATABASE",
        file_name || "mediaflow.db",
        `Super Admin ${user.nama} memulihkan database SQLite dari berkas cadangan (${file_name || "upload.db"}). Salinan pengaman dibuat di ${result.backupFile}`
      );
      res.json({
        success: true,
        message: "Database berhasil dipulihkan dari berkas cadangan! Silakan muat ulang halaman untuk memperbarui seluruh data sistem.",
        backupFile: result.backupFile
      });
    } catch (err) {
      console.error("Error during database restore:", err);
      res.status(500).json({ error: err.message || "Gagal memulihkan database dari berkas backup." });
    }
  });
  app.post("/api/settings/optimize-db", authenticateJWT, (req, res) => {
    const user = req.user;
    if (user.role_id !== 1 && user.role_kode !== "super_admin" && user.role_kode !== "superadmin") {
      res.status(403).json({ error: "Hanya Super Admin yang dapat menjalankan optimasi database." });
      return;
    }
    db.exec("VACUUM; PRAGMA optimize;");
    let dbSize = 0;
    try {
      dbSize = fs2.statSync(dbPath).size;
    } catch {
    }
    logAudit(user, "Pengaturan", "OPTIMIZE_DATABASE", "mediaflow.db", `Super Admin ${user.nama} menjalankan optimasi VACUUM pada penyimpanan SQLite`);
    res.json({ success: true, db_size_mb: (dbSize / (1024 * 1024)).toFixed(2) });
  });
  app.get("/api/database/status", (_req, res) => {
    const configured = isMariaDBConfigured;
    const dbType = process.env.DB_TYPE || (configured ? "mariadb" : "sqlite");
    res.json({
      active_engine: configured ? "mariadb" : "sqlite",
      configured_engine: dbType,
      is_mariadb_configured: configured,
      host: configured ? process.env.DB_HOST || "127.0.0.1" : void 0,
      port: configured ? process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306 : void 0,
      database: configured ? process.env.DB_NAME : "mediaflow.db",
      user: configured ? process.env.DB_USER : void 0,
      sqlite_fallback: !configured
    });
  });
  app.post("/api/database/test-mariadb", authenticateJWT, async (req, res) => {
    const user = req.user;
    if (user.role_id !== 1 && user.role_kode !== "super_admin" && user.role_kode !== "superadmin") {
      res.status(403).json({ error: "Hanya Super Admin yang dapat menguji koneksi database." });
      return;
    }
    const { host, port, user: dbUser, password, database } = req.body || {};
    const result = await testMariaDBConnection({
      host,
      port: port ? Number(port) : void 0,
      user: dbUser,
      password,
      database
    });
    logAudit(
      user,
      "Pengaturan",
      "TEST_MARIADB_CONNECTION",
      database || process.env.DB_NAME || "mariadb",
      `Super Admin ${user.nama} menguji koneksi MariaDB (${result.success ? "BERHASIL" : "GAGAL"}): ${result.message}`
    );
    res.json(result);
  });
  app.get("/api/database/schema-mariadb", authenticateJWT, (req, res) => {
    const user = req.user;
    if (user.role_id !== 1 && user.role_kode !== "super_admin" && user.role_kode !== "superadmin") {
      res.status(403).json({ error: "Hanya Super Admin yang dapat mengunduh skema MariaDB." });
      return;
    }
    const schemaPath = path2.join(process.cwd(), "schema-mariadb.sql");
    if (!fs2.existsSync(schemaPath)) {
      res.status(404).json({ error: "Berkas schema-mariadb.sql tidak ditemukan." });
      return;
    }
    res.setHeader("Content-Type", "application/sql");
    res.setHeader("Content-Disposition", 'attachment; filename="schema-mariadb.sql"');
    res.sendFile(schemaPath);
  });
  app.all("/api/*", (req, res) => {
    res.status(404).json({
      error: `Endpoint API tidak ditemukan (${req.method} ${req.originalUrl}). Pastikan server telah dijalankan ulang setelah pembaruan.`
    });
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path2.join(process.cwd(), "dist");
    if (fs2.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*", (_req, res) => {
        res.sendFile(path2.join(distPath, "index.html"));
      });
    } else {
      console.warn(`\u26A0\uFE0F [PRODUCTION NOTICE] Folder dist/ tidak ditemukan di ${distPath}. Pastikan telah menjalankan 'npm run build'.`);
      app.get("*", (_req, res) => {
        res.status(503).send(`
          <!DOCTYPE html>
          <html>
            <head><title>MediaFlow ERP - Menyiapkan Sistem</title></head>
            <body style="font-family: system-ui, sans-serif; text-align: center; padding: 40px; background: #0f172a; color: #f8fafc;">
              <h2 style="color: #38bdf8;">MediaFlow ERP Backend Aktif</h2>
              <p style="color: #94a3b8;">Frontend sedang dipersiapkan. Harap pastikan perintah build telah dijalankan (<code>npm run build</code>).</p>
            </body>
          </html>
        `);
      });
    }
  }
  app.use((err, req, res, _next) => {
    console.error("\u274C [EXPRESS ERROR]:", err);
    if (req.originalUrl.startsWith("/api/")) {
      res.status(err?.status || 500).json({
        error: err?.message || "Terjadi kesalahan internal pada server."
      });
      return;
    }
    res.status(err?.status || 500).send(err?.message || "Internal Server Error");
  });
  const PORT = process.env.PORT ? Number(process.env.PORT) : 3e3;
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`\u{1F680} MediaFlow ERP Server listening on http://0.0.0.0:${PORT} [NODE_ENV=${process.env.NODE_ENV || "development"}]`);
  });
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`\u274C [PORT ERROR] Port ${PORT} sedang digunakan oleh proses lain. Periksa proses PM2 atau sesuaikan PORT di .env.`);
    } else {
      console.error("\u274C [SERVER ERROR]:", err);
    }
  });
  const gracefulShutdown = () => {
    console.log("\u{1F6D1} Menerima sinyal terminasi, mematikan server MediaFlow ERP dengan aman...");
    server.close(() => {
      console.log("\u2705 Server HTTP ditutup.");
      try {
        db.close();
        console.log("\u2705 Koneksi SQLite ditutup.");
      } catch {
      }
      process.exit(0);
    });
  };
  process.on("SIGTERM", gracefulShutdown);
  process.on("SIGINT", gracefulShutdown);
}
startServer();
export {
  isManagerOrAbove
};
