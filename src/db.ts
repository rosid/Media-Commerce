import Database from 'better-sqlite3';
import type { Pool, Connection } from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';

export const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'mediaflow.db');

try {
  const dbDir = path.dirname(path.resolve(dbPath));
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
} catch (e) {
  console.warn('Warning creating db directory:', e);
}

// ==============================================================================
// MARIADB / MYSQL POOL INTEGRATION (DYNAMIC & FAULT-TOLERANT)
// ==============================================================================
export const isMariaDBConfigured = Boolean(
  (process.env.DB_TYPE === 'mariadb' || process.env.DB_HOST) &&
  process.env.DB_USER &&
  process.env.DB_NAME
);

let mysqlModule: any = null;
let mysqlLoadError: string | null = null;

try {
  // Dynamic import agar server TIDAK CRASH jika package mysql2 belum ter-install di node_modules VPS
  const mod = await import('mysql2/promise');
  mysqlModule = mod.default || mod;
} catch (err: any) {
  mysqlLoadError = err?.message || 'Module mysql2 not found';
  if (isMariaDBConfigured) {
    console.warn('⚠️ [DATABASE NOTICE] Paket mysql2 belum terpasang di node_modules VPS. Menggunakan SQLite sebagai fallback sementara:', mysqlLoadError);
  }
}

export let mariadbPool: Pool | null = null;

if (isMariaDBConfigured && mysqlModule) {
  try {
    mariadbPool = mysqlModule.createPool({
      host: process.env.DB_HOST || '127.0.0.1',
      port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      charset: 'utf8mb4',
    });
    console.log(`🔌 [MARIADB] Pool terkonfigurasi untuk ${process.env.DB_USER}@${process.env.DB_HOST}:${process.env.DB_PORT || 3306}/${process.env.DB_NAME}`);
  } catch (err) {
    console.warn('⚠️ [MARIADB] Gagal menginisialisasi koneksi pool MariaDB, fallback ke SQLite:', err);
  }
}

export async function testMariaDBConnection(customConfig?: {
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
}): Promise<{ success: boolean; message: string; version?: string }> {
  const host = customConfig?.host || process.env.DB_HOST || '127.0.0.1';
  const port = customConfig?.port || (process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306);
  const user = customConfig?.user || process.env.DB_USER || '';
  const password = customConfig?.password !== undefined ? customConfig.password : (process.env.DB_PASSWORD || '');
  const database = customConfig?.database || process.env.DB_NAME || '';

  if (!user || !database) {
    return {
      success: false,
      message: 'Parameter DB_USER dan DB_NAME harus diisi untuk pengujian koneksi MariaDB.',
    };
  }

  if (!mysqlModule) {
    try {
      const mod = await import('mysql2/promise');
      mysqlModule = mod.default || mod;
    } catch {
      return {
        success: false,
        message: "Paket driver 'mysql2' belum terpasang di folder node_modules VPS. Silakan jalankan perintah 'npm install' di folder proyek VPS Anda.",
      };
    }
  }

  let testConn: Connection | null = null;
  try {
    const conn: Connection = await mysqlModule.createConnection({
      host,
      port,
      user,
      password,
      database,
      connectTimeout: 5000,
    });
    testConn = conn;
    const [rows] = await conn.query('SELECT VERSION() as version, DATABASE() as current_db');
    const result = Array.isArray(rows) && rows[0] ? (rows[0] as any) : null;
    await conn.end();
    return {
      success: true,
      message: `Berhasil terhubung ke MariaDB di ${host}:${port} (Database: ${result?.current_db || database})`,
      version: result?.version || 'Unknown',
    };
  } catch (error: any) {
    if (testConn) {
      try {
        await testConn.end();
      } catch {}
    }
    return {
      success: false,
      message: `Gagal terhubung ke MariaDB: ${error.message || error.code || 'Connection error'}`,
    };
  }
}

// ==============================================================================
// SQLITE FALLBACK & LOCAL DEVELOPMENT ENGINE
// ==============================================================================
let activeDb = new Database(dbPath);
activeDb.pragma('journal_mode = WAL');
activeDb.pragma('foreign_keys = ON');
activeDb.pragma('busy_timeout = 5000');
activeDb.pragma('synchronous = NORMAL');

export const db: Database.Database = new Proxy({} as any, {
  get(_target, prop) {
    const val = (activeDb as any)[prop];
    if (typeof val === 'function') {
      return val.bind(activeDb);
    }
    return val;
  },
});

export function restoreDatabaseFromFile(buffer: Buffer): { success: boolean; backupFile: string; message: string } {
  if (buffer.length > 50 * 1024 * 1024) {
    throw new Error('Ukuran berkas database melebihi batas keamanan maksimal (50 MB).');
  }

  const magic = buffer.subarray(0, 16).toString('utf-8');
  if (!magic.startsWith('SQLite format 3')) {
    throw new Error('File yang diunggah bukan file SQLite yang valid (header tidak cocok).');
  }

  const tempPath = path.join(path.dirname(dbPath), `temp_restore_${Date.now()}_${ process.pid }.db`);
  fs.writeFileSync(tempPath, buffer, { mode: 0o600 });

  try {
    const testDb = new Database(tempPath, { readonly: true });
    testDb.pragma('trusted_schema = OFF');

    const integrity = testDb.prepare('PRAGMA integrity_check').get() as { integrity_check?: string } | undefined;
    if (!integrity || integrity.integrity_check !== 'ok') {
      testDb.close();
      throw new Error('Pemeriksaan integritas SQLite (PRAGMA integrity_check) gagal.');
    }

    const triggerCheck = testDb
      .prepare("SELECT count(*) as c FROM sqlite_master WHERE type IN ('trigger', 'view')")
      .get() as { c: number };
    if (triggerCheck && triggerCheck.c > 0) {
      testDb.close();
      throw new Error('Berkas database ditolak karena mengandung trigger atau view eksternal yang tidak diizinkan.');
    }

    const requiredTables = ['users', 'roles', 'settings', 'quotations', 'deals', 'media_orders', 'invoices'];
    const existingTables = (
      testDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>
    ).map((t) => t.name);
    testDb.close();

    for (const reqTable of requiredTables) {
      if (!existingTables.includes(reqTable)) {
        throw new Error(`Skema database tidak sesuai standar MediaFlow ERP (tabel "${reqTable}" tidak ditemukan).`);
      }
    }
  } catch (err: any) {
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch {}
    throw new Error(`Validasi keamanan berkas SQLite gagal: ${err.message}`);
  }

  try {
    activeDb.pragma('wal_checkpoint(TRUNCATE)');
    activeDb.close();
  } catch (closeErr) {
    console.warn('Warning during database close:', closeErr);
  }

  const backupFile = `mediaflow.db.bak-${Date.now()}`;
  const backupPath = path.join(path.dirname(dbPath), backupFile);
  if (fs.existsSync(dbPath)) {
    fs.copyFileSync(dbPath, backupPath);
  }

  try {
    if (fs.existsSync(`${dbPath}-wal`)) fs.unlinkSync(`${dbPath}-wal`);
    if (fs.existsSync(`${dbPath}-shm`)) fs.unlinkSync(`${dbPath}-shm`);
  } catch {}

  try {
    fs.copyFileSync(tempPath, dbPath);
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch {}
  } catch (copyErr: any) {
    if (fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, dbPath);
    }
    activeDb = new Database(dbPath);
    activeDb.pragma('journal_mode = WAL');
    activeDb.pragma('foreign_keys = ON');
    activeDb.pragma('busy_timeout = 5000');
    activeDb.pragma('synchronous = NORMAL');
    throw new Error(`Gagal menyalin file database: ${copyErr.message}`);
  }

  activeDb = new Database(dbPath);
  activeDb.pragma('journal_mode = WAL');
  activeDb.pragma('foreign_keys = ON');
  activeDb.pragma('busy_timeout = 5000');
  activeDb.pragma('synchronous = NORMAL');

  return {
    success: true,
    backupFile,
    message: `Database berhasil dipulihkan. Cadangan pengaman dibuat di ${backupFile}`,
  };
}

export function initDatabase(mode: 'clean' | 'sample' = 'clean') {
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

  // Ensure extended user profile & account preference columns exist (safe migration for existing SQLite DB)
  const existingUserCols = (
    db.prepare(`PRAGMA table_info(users)`).all() as Array<{ name: string }>
  ).map((c) => c.name);

  const extraUserColumns: Array<[string, string]> = [
    ['telepon', `TEXT NOT NULL DEFAULT '0812-8899-7700'`],
    ['departemen', `TEXT NOT NULL DEFAULT 'Divisi Komersial & Media Digital'`],
    ['bio', `TEXT NOT NULL DEFAULT ''`],
    ['avatar_url', `TEXT NOT NULL DEFAULT ''`],
    ['preferensi_tema', `TEXT NOT NULL DEFAULT 'light'`],
    ['notif_email', `INTEGER NOT NULL DEFAULT 1`],
    ['notif_approval', `INTEGER NOT NULL DEFAULT 1`],
    ['notif_jadwal', `INTEGER NOT NULL DEFAULT 1`],
    ['notif_invoice', `INTEGER NOT NULL DEFAULT 1`],
  ];

  for (const [colName, colDef] of extraUserColumns) {
    if (!existingUserCols.includes(colName)) {
      db.exec(`ALTER TABLE users ADD COLUMN ${colName} ${colDef};`);
    }
  }

  // Ensure diskon_tipe exists in quotation_versions
  const qvCols = (db.prepare('PRAGMA table_info(quotation_versions)').all() as Array<{ name: string }>).map((c) => c.name);
  if (!qvCols.includes('diskon_tipe')) {
    db.exec(`ALTER TABLE quotation_versions ADD COLUMN diskon_tipe TEXT NOT NULL DEFAULT 'persen';`);
  }

  // Ensure nama_sales exists in quotations (to support manual/non-permanent AE)
  const qCols = (db.prepare('PRAGMA table_info(quotations)').all() as Array<{ name: string }>).map((c) => c.name);
  if (!qCols.includes('nama_sales')) {
    db.exec(`ALTER TABLE quotations ADD COLUMN nama_sales TEXT;`);
  }

  // Ensure nama_sales exists in deals
  const dCols = (db.prepare('PRAGMA table_info(deals)').all() as Array<{ name: string }>).map((c) => c.name);
  if (!dCols.includes('nama_sales')) {
    db.exec(`ALTER TABLE deals ADD COLUMN nama_sales TEXT;`);
  }

  // Ensure Kwitansi (Receipt) columns exist in payments
  const payCols = (db.prepare('PRAGMA table_info(payments)').all() as Array<{ name: string }>).map((c) => c.name);
  if (!payCols.includes('nomor_kwitansi')) {
    db.exec(`ALTER TABLE payments ADD COLUMN nomor_kwitansi TEXT;`);
  }
  if (!payCols.includes('untuk_pembayaran')) {
    db.exec(`ALTER TABLE payments ADD COLUMN untuk_pembayaran TEXT;`);
  }
  if (!payCols.includes('catatan')) {
    db.exec(`ALTER TABLE payments ADD COLUMN catatan TEXT;`);
  }
  if (!payCols.includes('status')) {
    db.exec(`ALTER TABLE payments ADD COLUMN status TEXT NOT NULL DEFAULT 'Diterima';`);
  }

  // Ensure catalog categories exist
  const countCategories = (db.prepare('SELECT COUNT(*) as c FROM catalog_categories').get() as { c: number }).c;
  if (countCategories === 0) {
    const insCat = db.prepare('INSERT INTO catalog_categories (nama, deskripsi, urutan) VALUES (?, ?, ?)');
    const defaultCats: Array<[string, string, number]> = [
      ['Website', 'Kanal portal berita, advertorial SEO, dan banner display', 1],
      ['Sosial Media', 'Instagram feed, reels, story, dan TikTok creative video', 2],
      ['Video', 'YouTube dedicated video, podcast visual, dan brand sponsorship', 3],
      ['Newsletter', 'Email blast buletin korporat pagi kepada pengambil keputusan', 4],
      ['Podcast', 'Audio show Spotify/Apple podcast dan ad-lib sponsor', 5],
      ['Event', 'Aktivasi offline seminar, konferensi, dan expo bisnis', 6],
      ['Influencer', 'Kolaborasi Key Opinion Leader (KOL) dan content creator jaringan', 7],
    ];
    for (const [cName, cDesc, cOrder] of defaultCats) {
      insCat.run(cName, cDesc, cOrder);
    }
  }

  const roleCount = (db.prepare('SELECT COUNT(*) as cnt FROM roles').get() as { cnt: number }).cnt;
  if (roleCount === 0) {
    seedCoreSystemData();
  }

  if (mode === 'sample') {
    seedSampleDemoData();
  }

  // Ensure default Web App Master Settings, SEO Indexing, Cloudflare Turnstile & Security settings exist
  const defaultWebSettings: Array<[string, string]> = [
    ['app_installed', 'false'],
    ['site_title', 'MediaFlow ERP — Quotation, Media Order, Bukti Tayang & Invoice'],
    ['site_tagline', 'Solusi Terpadu Penjualan, Operasional Media & Rekonsiliasi Keuangan'],
    ['site_description', 'Sistem manajemen operasional dan keuangan media digital terintegrasi dari Quotation, Deal, Media Order, Bukti Tayang hingga Invoice A4 Landscape dengan autentikasi JWT, RBAC 7 role, dan Audit Log.'],
    ['site_keywords', 'media erp, media order, quotation, bukti tayang, invoice media, rate card, iklan digital, vps erp'],
    ['site_logo', ''],
    ['site_favicon', ''],
    ['seo_indexing', 'noindex'], // 'noindex' (Blokir Mesin Pencari / Internal ERP) vs 'index' (Izinkan Google & Mesin Pencari)
    ['turnstile_enabled', 'false'], // 'false' | 'true'
    ['turnstile_site_key', '0x4AAAAAAAx_DemoSiteKey2026'],
    ['turnstile_secret_key', '0x4AAAAAAAx_DemoSecretKey2026xxxxxxxxx'],
    ['turnstile_mode', 'managed'], // 'managed' | 'non-interactive' | 'invisible'
    ['security_session_timeout', '24h'],
    ['security_max_login_attempts', '5'],
    ['security_force_https', 'true'],
    ['security_password_min_length', '6'],
    ['maintenance_mode', 'false'],
    ['maintenance_message', 'Aplikasi MediaFlow ERP sedang dalam pemeliharaan berkala untuk peningkatan server VPS. Silakan hubungi Administrator atau coba beberapa saat lagi.'],
    ['app_footer_text', '© 2026 MediaFlow ERP. Hak Cipta Dilindungi · Siap Dijalankan di Server VPS'],
    ['app_timezone', 'Asia/Jakarta (WIB)'],
    ['app_canonical_url', 'https://erp.nusantaramedia.id'],
    ['google_site_verification', 'google-site-verification=mf_vps_auth_token_sample_2026'],
    ['seq_format_global', '{KODE}/{TAHUN}/{BULAN}/{URUT}'],
    ['seq_digits', '4'],
    ['seq_reset_period', 'TAHUNAN'],
    ['seq_code_QT', 'QT'],
    ['seq_code_DL', 'DL'],
    ['seq_code_MO', 'MO'],
    ['seq_code_BT', 'BT'],
    ['seq_code_INV', 'INV'],
    ['seq_code_KWT', 'KWT'],
    ['seq_format_QT', '{KODE}/{TAHUN}/{BULAN}/{URUT}'],
    ['seq_format_DL', '{KODE}/{TAHUN}/{BULAN}/{URUT}'],
    ['seq_format_MO', '{KODE}/{TAHUN}/{BULAN}/{URUT}'],
    ['seq_format_BT', '{KODE}/{TAHUN}/{BULAN}/{URUT}'],
    ['seq_format_INV', '{KODE}/{TAHUN}/{BULAN}/{URUT}'],
    ['seq_format_KWT', '{KODE}/{TAHUN}/{BULAN}/{URUT}'],
  ];

  const insWebSetting = db.prepare('INSERT OR IGNORE INTO settings (kunci, nilai) VALUES (?, ?)');
  for (const [k, v] of defaultWebSettings) {
    insWebSetting.run(k, v);
  }
}

export const ROMAN_MONTHS: Record<number, string> = {
  1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI',
  7: 'VII', 8: 'VIII', 9: 'IX', 10: 'X', 11: 'XI', 12: 'XII'
};

export interface SequenceFormatConfig {
  global_format: string;
  formats: Record<string, string>;
  codes: Record<string, string>;
  digits: number;
  reset_period: 'TAHUNAN' | 'BULANAN' | 'BERKELANJUTAN';
}

export function getSequenceConfig(): SequenceFormatConfig {
  const rows = db
    .prepare(`SELECT kunci, nilai FROM settings WHERE kunci LIKE 'seq_%' OR kunci IN ('format_nomor', 'reset_nomor')`)
    .all() as Array<{ kunci: string; nilai: string }>;
  const map: Record<string, string> = {};
  for (const r of rows) {
    map[r.kunci] = r.nilai;
  }

  const global_format = map.seq_format_global || map.format_nomor || '{KODE}/{TAHUN}/{BULAN}/{URUT}';
  const digits = Math.min(Math.max(Number(map.seq_digits) || 4, 3), 8);
  const reset_period = (map.seq_reset_period || map.reset_nomor || 'TAHUNAN').toUpperCase() as 'TAHUNAN' | 'BULANAN' | 'BERKELANJUTAN';

  const defaultCodes: Record<string, string> = {
    QT: 'QT',
    DL: 'DL',
    MO: 'MO',
    BT: 'BT',
    INV: 'INV',
    KWT: 'KWT',
  };

  const codes: Record<string, string> = {
    QT: map.seq_code_QT || defaultCodes.QT,
    DL: map.seq_code_DL || defaultCodes.DL,
    MO: map.seq_code_MO || defaultCodes.MO,
    BT: map.seq_code_BT || defaultCodes.BT,
    INV: map.seq_code_INV || defaultCodes.INV,
    KWT: map.seq_code_KWT || defaultCodes.KWT,
  };

  const formats: Record<string, string> = {
    QT: map.seq_format_QT || global_format,
    DL: map.seq_format_DL || global_format,
    MO: map.seq_format_MO || global_format,
    BT: map.seq_format_BT || global_format,
    INV: map.seq_format_INV || global_format,
    KWT: map.seq_format_KWT || global_format,
  };

  return { global_format, formats, codes, digits, reset_period };
}

export function formatSequenceNumber(
  formatTemplate: string,
  docCode: string,
  date: Date,
  seqNumber: number,
  digits = 4
): string {
  const year4 = String(date.getFullYear());
  const year2 = year4.slice(-2);
  const monthNum = date.getMonth() + 1;
  const month2 = String(monthNum).padStart(2, '0');
  const day2 = String(date.getDate()).padStart(2, '0');
  const romanMonth = ROMAN_MONTHS[monthNum] || month2;
  const paddedSeq = String(seqNumber).padStart(digits, '0');

  return formatTemplate
    .replace(/{KODE}/g, docCode)
    .replace(/{TAHUN}/g, year4)
    .replace(/{TH}/g, year2)
    .replace(/{BULAN}/g, month2)
    .replace(/{ROMAN}/g, romanMonth)
    .replace(/{HARI}/g, day2)
    .replace(/{URUT}/g, paddedSeq);
}

export function generateDocumentNumber(kode: 'QT' | 'DL' | 'MO' | 'BT' | 'INV' | 'KWT', dateStr?: string): string {
  const now = dateStr ? new Date(dateStr) : new Date();
  const validDate = isNaN(now.getTime()) ? new Date() : now;

  const config = getSequenceConfig();
  const docCode = config.codes[kode] || kode;
  const template = config.formats[kode] || config.global_format;

  const year = validDate.getFullYear();
  const month = validDate.getMonth() + 1;

  let seqTahunKey = year;
  if (config.reset_period === 'BULANAN') {
    seqTahunKey = year * 100 + month; // e.g. 202611
  } else if (config.reset_period === 'BERKELANJUTAN') {
    seqTahunKey = 0; // continuous across all years
  }

  const tx = db.transaction(() => {
    const existing = db
      .prepare('SELECT last_seq FROM number_sequences WHERE kode_dokumen = ? AND tahun = ?')
      .get(kode, seqTahunKey) as { last_seq: number } | undefined;

    let nextSeq = 1;
    if (existing) {
      nextSeq = existing.last_seq + 1;
      db.prepare('UPDATE number_sequences SET last_seq = ? WHERE kode_dokumen = ? AND tahun = ?').run(
        nextSeq,
        kode,
        seqTahunKey
      );
    } else {
      db.prepare('INSERT INTO number_sequences (kode_dokumen, tahun, last_seq) VALUES (?, ?, ?)').run(
        kode,
        seqTahunKey,
        nextSeq
      );
    }
    return formatSequenceNumber(template, docCode, validDate, nextSeq, config.digits);
  });

  return tx();
}

/**
 * Resets the operational database to a clean, production-ready state:
 * - Deletes all business transactions (quotations, deals, media orders, invoices, payments, proofs, approvals, audit logs, notifications)
 * - Deletes all sample clients, products, packages, and mock user accounts
 * - Resets document sequence counters
 * - Preserves core roles, permissions, teams, and master company settings
 * - Explicitly sets settings.app_installed = 'false'
 */
export function resetDatabaseToClean(): void {
  db.pragma('foreign_keys = OFF');
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
    db.pragma('foreign_keys = ON');
  }

  // Ensure core roles, permissions, and teams exist
  seedCoreSystemData();
}

/**
 * Seeds purely essential system definitions:
 * - 7 Core RBAC Roles
 * - Permission Matrix
 * - Default Teams
 * - Master Company Settings
 * DOES NOT CREATE ANY DUMMY USERS OR BUSINESS TRANSACTIONS.
 */
export function seedCoreSystemData() {
  const roleCount = (db.prepare('SELECT COUNT(*) as cnt FROM roles').get() as { cnt: number }).cnt;
  if (roleCount === 0) {
    // 1. Insert 7 Roles
    const insertRole = db.prepare(
      'INSERT INTO roles (kode, nama, cakupan, deskripsi) VALUES (?, ?, ?, ?)'
    );
    insertRole.run('super_admin', 'Super Admin', 'Seluruh sistem', 'Kelola pengguna dan role, pengaturan sistem, penomoran, template PDF, audit log');
    insertRole.run('admin', 'Admin Operasional', 'Seluruh operasional', 'Kelola master klien dan rate card, input/koreksi atas nama tim, kelola jadwal dan bukti tayang');
    insertRole.run('direktur', 'Direktur', 'Seluruh data (eksekutif)', 'Dashboard eksekutif, persetujuan strategis, seluruh laporan perusahaan');
    insertRole.run('manager', 'Manager', 'Timnya', 'Menyetujui quotation berdiskon, MO, dan verifikasi bukti tayang; memantau progres Deal tim');
    insertRole.run('marketing', 'Marketing', 'Kampanye yang ditangani', 'Membuat MO dan jadwal tayang, mengelola konten dan bukti tayang, memantau progres Deal');
    insertRole.run('sales', 'Sales', 'Klien, quotation, dan Deal miliknya', 'Membuat quotation, follow-up, menandai Deal/Lost, memantau progres Deal miliknya');
    insertRole.run('finance', 'Finance', 'Seluruh dokumen keuangan', 'Membuat dan mengirim invoice, mencatat pembayaran, piutang, pajak, laporan keuangan');

    // 2. Insert Permissions Matrix according to Section 3 Table
    const modules = [
      { modul: 'clients', nama: 'Master Klien' },
      { modul: 'catalog', nama: 'Rate Card & Paket' },
      { modul: 'quotations', nama: 'Quotation' },
      { modul: 'mark_deal', nama: 'Tandai Deal' },
      { modul: 'deals', nama: 'Deal & Progres' },
      { modul: 'media_orders', nama: 'Media Order' },
      { modul: 'schedules', nama: 'Jadwal Tayang' },
      { modul: 'proofs', nama: 'Bukti Tayang' },
      { modul: 'invoices', nama: 'Invoice' },
      { modul: 'payments', nama: 'Pembayaran' },
      { modul: 'users_roles', nama: 'Pengguna & Role' },
      { modul: 'dashboard', nama: 'Dashboard & Laporan' },
    ];

    const insertPerm = db.prepare('INSERT OR IGNORE INTO permissions (modul, nama_fitur) VALUES (?, ?)');
    for (const m of modules) {
      insertPerm.run(m.modul, m.nama);
    }

    // Matrix definition: [role_id, modul, B, U, A, L, scope]
    const matrix: Array<[number, string, number, number, number, number, string]> = [
      // Super Admin (role_id = 1)
      [1, 'clients', 1, 1, 1, 1, 'all'],
      [1, 'catalog', 1, 1, 1, 1, 'all'],
      [1, 'quotations', 1, 1, 1, 1, 'all'],
      [1, 'mark_deal', 1, 1, 1, 1, 'all'],
      [1, 'deals', 1, 1, 1, 1, 'all'],
      [1, 'media_orders', 1, 1, 1, 1, 'all'],
      [1, 'schedules', 1, 1, 1, 1, 'all'],
      [1, 'proofs', 1, 1, 1, 1, 'all'],
      [1, 'invoices', 1, 1, 1, 1, 'all'],
      [1, 'payments', 1, 1, 1, 1, 'all'],
      [1, 'users_roles', 1, 1, 1, 1, 'all'],
      [1, 'dashboard', 1, 1, 1, 1, 'all'],

      // Admin (role_id = 2)
      [2, 'clients', 1, 1, 0, 1, 'all'],
      [2, 'catalog', 1, 1, 0, 1, 'all'],
      [2, 'quotations', 1, 1, 0, 1, 'all'],
      [2, 'mark_deal', 1, 1, 0, 1, 'all'],
      [2, 'deals', 0, 1, 0, 1, 'all'],
      [2, 'media_orders', 1, 1, 0, 1, 'all'],
      [2, 'schedules', 1, 1, 0, 1, 'all'],
      [2, 'proofs', 1, 1, 1, 1, 'all'],
      [2, 'invoices', 0, 0, 0, 1, 'all'],
      [2, 'payments', 0, 0, 0, 0, 'none'],
      [2, 'users_roles', 0, 0, 0, 0, 'none'],
      [2, 'dashboard', 0, 0, 0, 1, 'all'],

      // Direktur (role_id = 3)
      [3, 'clients', 0, 0, 0, 1, 'all'],
      [3, 'catalog', 0, 0, 1, 1, 'all'],
      [3, 'quotations', 0, 0, 1, 1, 'all'],
      [3, 'mark_deal', 1, 1, 1, 1, 'all'],
      [3, 'deals', 0, 0, 1, 1, 'all'],
      [3, 'media_orders', 0, 0, 0, 1, 'all'],
      [3, 'schedules', 0, 0, 0, 1, 'all'],
      [3, 'proofs', 0, 0, 0, 1, 'all'],
      [3, 'invoices', 0, 0, 0, 1, 'all'],
      [3, 'payments', 0, 0, 0, 1, 'all'],
      [3, 'users_roles', 0, 0, 0, 0, 'none'],
      [3, 'dashboard', 0, 0, 0, 1, 'all'],

      // Manager (role_id = 4)
      [4, 'clients', 0, 0, 0, 1, 'team'],
      [4, 'catalog', 0, 0, 1, 1, 'all'],
      [4, 'quotations', 0, 0, 1, 1, 'team'],
      [4, 'mark_deal', 1, 1, 1, 1, 'team'],
      [4, 'deals', 0, 0, 1, 1, 'team'],
      [4, 'media_orders', 0, 0, 1, 1, 'team'],
      [4, 'schedules', 0, 0, 0, 1, 'team'],
      [4, 'proofs', 0, 0, 1, 1, 'team'],
      [4, 'invoices', 0, 0, 0, 1, 'team'],
      [4, 'payments', 0, 0, 0, 0, 'none'],
      [4, 'users_roles', 0, 0, 0, 0, 'none'],
      [4, 'dashboard', 0, 0, 0, 1, 'team'],

      // Marketing (role_id = 5)
      [5, 'clients', 1, 1, 0, 1, 'all'],
      [5, 'catalog', 1, 1, 0, 1, 'all'],
      [5, 'quotations', 0, 0, 0, 1, 'team'],
      [5, 'mark_deal', 0, 0, 0, 0, 'none'],
      [5, 'deals', 0, 1, 0, 1, 'team'],
      [5, 'media_orders', 1, 1, 0, 1, 'team'],
      [5, 'schedules', 1, 1, 0, 1, 'team'],
      [5, 'proofs', 1, 1, 0, 1, 'team'],
      [5, 'invoices', 0, 0, 0, 0, 'none'],
      [5, 'payments', 0, 0, 0, 0, 'none'],
      [5, 'users_roles', 0, 0, 0, 0, 'none'],
      [5, 'dashboard', 0, 0, 0, 1, 'team'],

      // Sales (role_id = 6)
      [6, 'clients', 1, 1, 0, 1, 'own'],
      [6, 'catalog', 0, 0, 0, 1, 'all'],
      [6, 'quotations', 1, 1, 0, 1, 'own'],
      [6, 'mark_deal', 1, 1, 0, 1, 'own'],
      [6, 'deals', 0, 0, 0, 1, 'own'],
      [6, 'media_orders', 0, 0, 0, 1, 'own'],
      [6, 'schedules', 0, 0, 0, 1, 'own'],
      [6, 'proofs', 0, 0, 0, 1, 'own'],
      [6, 'invoices', 0, 0, 0, 0, 'none'],
      [6, 'payments', 0, 0, 0, 0, 'none'],
      [6, 'users_roles', 0, 0, 0, 0, 'none'],
      [6, 'dashboard', 0, 0, 0, 1, 'own'],

      // Finance (role_id = 7)
      [7, 'clients', 0, 0, 0, 1, 'all'],
      [7, 'catalog', 0, 0, 0, 1, 'all'],
      [7, 'quotations', 0, 0, 0, 1, 'all'],
      [7, 'mark_deal', 0, 0, 0, 0, 'none'],
      [7, 'deals', 0, 0, 0, 1, 'all'],
      [7, 'media_orders', 0, 0, 0, 1, 'all'],
      [7, 'schedules', 0, 0, 0, 1, 'all'],
      [7, 'proofs', 0, 0, 0, 1, 'all'],
      [7, 'invoices', 1, 1, 1, 1, 'all'],
      [7, 'payments', 1, 1, 1, 1, 'all'],
      [7, 'users_roles', 0, 0, 0, 0, 'none'],
      [7, 'dashboard', 0, 0, 0, 1, 'all'],
    ];

    const insertRolePerm = db.prepare(
      'INSERT OR IGNORE INTO role_permissions (role_id, modul, can_create, can_update, can_approve, can_view, scope) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    for (const row of matrix) {
      insertRolePerm.run(...row);
    }
  }

  // Ensure Teams
  const teamCount = (db.prepare('SELECT COUNT(*) as cnt FROM teams').get() as { cnt: number }).cnt;
  if (teamCount === 0) {
    db.prepare('INSERT INTO teams (nama, manager_id) VALUES (?, ?)').run('Tim Komersial Alpha (Enterprise & FMCG)', null);
    db.prepare('INSERT INTO teams (nama, manager_id) VALUES (?, ?)').run('Tim Komersial Beta (Tech & Otomotif)', null);
  }

  // Ensure Master Settings
  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (kunci, nilai) VALUES (?, ?)');
  insertSetting.run('nama_perusahaan', 'PT Nusantara Digital Media Terpadu');
  insertSetting.run('alamat_perusahaan', 'Menara Sudirman Lt. 18, Jl. Jend. Sudirman Kav. 60, Jakarta Selatan 12190');
  insertSetting.run('npwp_perusahaan', '01.345.678.9-012.000');
  insertSetting.run('email_perusahaan', 'billing@nusantaramedia.id');
  insertSetting.run('telepon_perusahaan', '(021) 520-8899');
  insertSetting.run('bank_nama', 'Bank Mandiri KCP Sudirman Jakarta');
  insertSetting.run('bank_rekening', '122-00-9876543-2');
  insertSetting.run('bank_atas_nama', 'PT Nusantara Digital Media Terpadu');
  insertSetting.run('ppn_default', '11');
  insertSetting.run('pph23_default', '2');
  insertSetting.run('meterai_default', '10000');
  insertSetting.run('aturan_diskon_approval', 'all_discounts_require_manager');
  insertSetting.run('mo_wajib_approval_manager', 'true');
  insertSetting.run('tagih_wajib_bukti_terverifikasi', 'true');
  insertSetting.run('format_nomor', 'KODE/TAHUN/BULAN/URUT');
  insertSetting.run('reset_nomor', 'TAHUNAN');
  insertSetting.run('app_installed', 'false');
}

/**
 * Seeds sample/demo data for evaluation and testing purposes only.
 */
export function seedSampleDemoData() {
  const existingSample = db.prepare("SELECT count(*) as c FROM users WHERE email = 'superadmin@nusantaramedia.id'").get() as any;
  if (existingSample && existingSample.c > 0) {
    return; // Already seeded
  }

  seedCoreSystemData();
  const passwordHash = bcrypt.hashSync('MediaFlow2026!', 10);

  // 1. Insert 8 Demo Users
  const insertUser = db.prepare(
    'INSERT INTO users (nama, email, password_hash, jabatan, role_id, team_id, aktif, last_login) VALUES (?, ?, ?, ?, ?, ?, 1, ?)'
  );

  // User IDs:
  // 1: Super Admin
  insertUser.run('Rosidin Wijaya', 'superadmin@nusantaramedia.id', passwordHash, 'Head of IT & System Architect', 1, 1, '2026-11-08 08:30:00');
  // 2: Admin
  insertUser.run('Nadia Prameswari', 'admin@nusantaramedia.id', passwordHash, 'Sales & Media Traffic Admin', 2, 1, '2026-11-08 08:45:00');
  // 3: Direktur
  insertUser.run('Hendra Kusuma', 'direktur@nusantaramedia.id', passwordHash, 'Direktur Komersial & Bisnis', 3, 1, '2026-11-08 09:00:00');
  // 4: Manager Tim Alpha
  insertUser.run('Budi Santoso', 'manager@nusantaramedia.id', passwordHash, 'Commercial Group Manager', 4, 1, '2026-11-08 09:10:00');
  // 5: Marketing Tim Alpha
  insertUser.run('Rina Kartika', 'marketing@nusantaramedia.id', passwordHash, 'Digital Campaign & Traffic Specialist', 5, 1, '2026-11-08 09:15:00');
  // 6: Sales 1 Tim Alpha
  insertUser.run('Dimas Pratama', 'sales@nusantaramedia.id', passwordHash, 'Senior Account Executive', 6, 1, '2026-11-08 09:20:00');
  // 7: Finance
  insertUser.run('Siti Rahmawati', 'finance@nusantaramedia.id', passwordHash, 'Billing & AR Supervisor', 7, 1, '2026-11-08 09:25:00');
  // 8: Sales 2 Tim Alpha
  insertUser.run('Farhan Akbar', 'farhan.sales@nusantaramedia.id', passwordHash, 'Account Executive', 6, 1, '2026-11-07 17:10:00');

  db.prepare('UPDATE teams SET manager_id = 4 WHERE id IN (1, 2)').run();

  // 2. Master Clients & Contacts
  const insertClient = db.prepare(`
    INSERT INTO clients (kode, nama, tipe, parent_client_id, brand_turunan, npwp, alamat_tagih, termin_hari, owner_user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  // Client 1: Brand Langsung (Owned by Dimas - user 6)
  insertClient.run(
    'CL-001',
    'PT Telekomunikasi Seluler Nusantara',
    'brand',
    null,
    'NusaTelkomsel Halo 5G',
    '01.001.889.2-093.000',
    'Gedung Telkom Landmark Tower Lt. 22, Jl. Gatot Subroto Kav. 52, Jakarta Selatan',
    30,
    6
  );
  // Client 2: Agensi (Owned by Dimas - user 6)
  insertClient.run(
    'CL-002',
    'PT Dentsu Creative Media Indonesia',
    'agensi',
    null,
    'Multi-Brand Agency Account',
    '02.411.552.1-056.000',
    'Sentral Senayan III Lt. 14, Jl. Asia Afrika No. 8, Gelora, Jakarta Pusat',
    45,
    6
  );
  // Client 3: Brand Turunan dari Agensi CL-002 (Owned by Dimas - user 6)
  insertClient.run(
    'CL-003',
    'PT Astra Honda Motor (via Dentsu Media)',
    'brand',
    2,
    'Honda EM1 e: Electric Scooter',
    '01.308.441.7-092.000',
    'Jl. Laksda Yos Sudarso, Sunter I, Jakarta Utara 14350',
    45,
    6
  );
  // Client 4: Brand Langsung (Owned by Farhan - user 8)
  insertClient.run(
    'CL-004',
    'PT Bank Mandiri Taspen Digital',
    'brand',
    null,
    'Movin Digital Banking',
    '01.882.771.4-011.000',
    'Graha Mantap, Jl. Proklamasi No. 31, Menteng, Jakarta Pusat',
    14,
    8
  );

  const insertContact = db.prepare(`
    INSERT INTO client_contacts (client_id, nama_pic, jabatan, email, telepon, utama)
    VALUES (?, ?, ?, ?, ?, 1)
  `);
  insertContact.run(1, 'Arif Rahman Hakim', 'VP Brand & Marcomm', 'arif.hakim@nusatelkomsel.co.id', '0811-900-2341');
  insertContact.run(2, 'Clarissa Wijaya', 'Associate Media Director', 'clarissa.w@dentsumedia.co.id', '0812-8877-9900');
  insertContact.run(3, 'Kevindra Putra', 'Digital Media Planner', 'kevindra.p@dentsumedia.co.id', '0813-7766-1122');
  insertContact.run(4, 'Dewi Lestari', 'Head of Corporate Communication', 'dewi.lestari@bankmantap.co.id', '0811-2233-4455');

  // 6. Master Products & Versioned Rate Card
  const insertProduct = db.prepare(`
    INSERT INTO products (kode, kategori, nama, spesifikasi, satuan, tipe_kuota, slot_inventori)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertProduct.run('PRD-001', 'Website', 'Artikel Advertorial SEO Premium', 'Artikel 800-1.000 kata + 3 foto HD + 2 backlink dofollow permanen di kanal Bisnis/Tekno', 'Artikel', 'jumlah', 'Editorial Feed');
  insertProduct.run('PRD-002', 'Website', 'Homepage Leaderboard Banner (970x250)', 'Slot eksklusif atas halaman utama desktop & mobile (Share of Voice 100%)', 'Bulan', 'durasi', 'Homepage Top Banner');
  insertProduct.run('PRD-003', 'Sosial Media', 'Instagram Carousel + Reels Collaboration', 'Konten kreatif 5-7 slide atau Reels 60 detik di akun resmi @NusantaraMedia (1.8M followers)', 'Post', 'jumlah', 'IG Main Feed');
  insertProduct.run('PRD-004', 'Video', 'YouTube Dedicated Liputan & Podcast', 'Video liputan eksklusif 10-15 menit + bumper ad + penempatan pin komentar', 'Video', 'jumlah', 'YouTube Prime Slot');
  insertProduct.run('PRD-005', 'Website', 'Programmatic CPM Display Network', 'Penayangan banner di seluruh jaringan vertikal berita dengan garansi impresi', 'Impresi', 'impresi', 'RON Display Network');
  insertProduct.run('PRD-006', 'Newsletter', 'Executive Morning Briefing Blast', 'Sponsor tunggal buletin pagi ke 85.000+ eksekutif & pengambil keputusan', 'Minggu', 'durasi', 'Newsletter Header');

  const insertPrice = db.prepare(`
    INSERT INTO product_prices (product_id, versi, harga, berlaku_dari, berlaku_sampai)
    VALUES (?, ?, ?, ?, ?)
  `);
  // Historical v1 prices (2025) & Active v2 prices (2026)
  insertPrice.run(1, 1, 12500000, '2025-01-01', '2025-12-31');
  insertPrice.run(1, 2, 15000000, '2026-01-01', null);
  insertPrice.run(2, 1, 40000000, '2025-01-01', '2025-12-31');
  insertPrice.run(2, 2, 45000000, '2026-01-01', null);
  insertPrice.run(3, 2, 12000000, '2026-01-01', null);
  insertPrice.run(4, 2, 35000000, '2026-01-01', null);
  insertPrice.run(5, 2, 25000000, '2026-01-01', null); // per paket 500rb impresi
  insertPrice.run(6, 2, 18000000, '2026-01-01', null);

  // Packages
  db.prepare(`
    INSERT INTO packages (kode, nama, deskripsi, harga_paket)
    VALUES (?, ?, ?, ?)
  `).run(
    'PKT-360-A',
    'Paket Kampanye Peluncuran Produk 360°',
    'Bundel strategis mencakup 4 Artikel SEO, 4 Post Instagram Reels, 1 Bulan Homepage Leaderboard, dan 1 Video YouTube',
    135000000
  );
  const insertPkgItem = db.prepare('INSERT INTO package_items (package_id, product_id, qty) VALUES (?, ?, ?)');
  insertPkgItem.run(1, 1, 4);
  insertPkgItem.run(1, 3, 4);
  insertPkgItem.run(1, 2, 1);
  insertPkgItem.run(1, 4, 1);

  // 7. Seed Quotations, Deals, Media Orders, Proofs, and Invoices
  // --- QUOTATION 1: Already DEAL (PT Telekomunikasi Seluler Nusantara - Peluncuran 5G) ---
  const qt1No = generateDocumentNumber('QT', '2026-10-15');
  db.prepare(`
    INSERT INTO quotations (
      nomor, judul_penawaran, client_id, snapshot_nama_klien, snapshot_npwp, snapshot_alamat, snapshot_pic,
      owner_user_id, status, tanggal_terbit, berlaku_sampai, versi_aktif, catatan_followup, dibuka_klien_pada
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    qt1No,
    'Kampanye Nasional Ekspansi Jaringan 5G Q4 2026',
    1,
    'PT Telekomunikasi Seluler Nusantara',
    '01.001.889.2-093.000',
    'Gedung Telkom Landmark Tower Lt. 22, Jl. Gatot Subroto Kav. 52, Jakarta Selatan',
    'Arif Rahman Hakim',
    6,
    'Deal',
    '2026-10-15',
    '2026-11-15',
    2,
    'Revisi 2 disetujui klien setelah penyesuaian kuota IG Reels dan diskon 5% yang telah di-approve Manager.',
    '2026-10-16 14:20:00'
  );

  // Rev 1 (Historical)
  db.prepare(`
    INSERT INTO quotation_versions (
      quotation_id, nomor_revisi, subtotal, diskon_persen, diskon_nominal, dpp, ppn_persen, ppn_nominal, grand_total, catatan_revisi, dibuat_oleh
    ) VALUES (?, 1, 165000000, 0, 0, 165000000, 11, 18150000, 183150000, 'Penawaran awal sesuai brief Q4', 6)
  `).run(1);

  // Rev 2 (Active & Deal)
  // Items: 4 Artikel (@15jt = 60jt), 6 IG Post (@12jt = 72jt), 1 Bulan Banner (@45jt = 45jt) -> Subtotal = 177.000.000
  // Diskon 5% = 8.850.000 -> DPP = 168.150.000 -> PPN 11% = 18.496.500 -> Grand Total = 186.646.500
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
  // Version 1 items
  insertQItem.run(1, 1, 'Artikel Advertorial SEO Premium', 'Website', 'Artikel 800-1.000 kata + backlink dofollow', 'Nov - Des 2026', '25.000 Pageviews', 4, 'Artikel', 'jumlah', 15000000, 0, 0, 60000000);
  insertQItem.run(1, 3, 'Instagram Carousel + Reels Collaboration', 'Sosial Media', 'Konten IG Reels 60 detik', 'Nov - Des 2026', '150.000 Reach', 5, 'Post', 'jumlah', 12000000, 0, 0, 60000000);
  insertQItem.run(1, 2, 'Homepage Leaderboard Banner (970x250)', 'Website', 'Share of Voice 100% Desktop & Mobile', 'November 2026', '500.000 Impresi', 1, 'Bulan', 'durasi', 45000000, 0, 0, 45000000);

  // Version 2 items (Active)
  insertQItem.run(2, 1, 'Artikel Advertorial SEO Premium', 'Website', 'Artikel 800-1.000 kata + backlink dofollow', 'Nov - Des 2026', '25.000 Pageviews', 4, 'Artikel', 'jumlah', 15000000, 0, 0, 60000000);
  insertQItem.run(2, 3, 'Instagram Carousel + Reels Collaboration', 'Sosial Media', 'Konten IG Reels 60 detik', 'Nov - Des 2026', '180.000 Reach', 6, 'Post', 'jumlah', 12000000, 0, 0, 72000000);
  insertQItem.run(2, 2, 'Homepage Leaderboard Banner (970x250)', 'Website', 'Share of Voice 100% Desktop & Mobile', 'November 2026', '500.000 Impresi', 1, 'Bulan', 'durasi', 45000000, 0, 0, 45000000);

  // --- DEAL 1 from QUOTATION 1 ---
  const dl1No = generateDocumentNumber('DL', '2026-10-18');
  db.prepare(`
    INSERT INTO deals (
      nomor, quotation_id, quotation_version_id, client_id, snapshot_nama_klien, owner_user_id,
      nama_kampanye, no_po_klien, nilai_deal, dpp, ppn_nominal, mulai_kontrak, berlaku_sampai, skema_tagih, status, lampiran_po
    ) VALUES (?, 1, 2, 1, 'PT Telekomunikasi Seluler Nusantara', 6, ?, ?, 186646500, 168150000, 18496500, '2026-11-01', '2026-12-31', 'per_mo', 'Berjalan', 'PO-TSEL-2026-8841.pdf')
  `).run(dl1No, 'Kampanye Nasional Ekspansi Jaringan 5G Q4 2026', 'PO/TSEL/MKT/2026/8841');

  const insertDealItem = db.prepare(`
    INSERT INTO deal_items (
      deal_id, product_id, nama_produk, kategori, spesifikasi, periode, target_kpi, qty_dibeli, satuan, harga_satuan, jumlah_total, tipe_kuota
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  // Deal 1 Items (IDs: 1, 2, 3)
  insertDealItem.run(1, 1, 'Artikel Advertorial SEO Premium', 'Website', 'Artikel 800-1.000 kata + backlink dofollow', 'Nov - Des 2026', '25.000 Pageviews', 4, 'Artikel', 14250000, 57000000, 'jumlah');
  insertDealItem.run(1, 3, 'Instagram Carousel + Reels Collaboration', 'Sosial Media', 'Konten IG Reels 60 detik', 'Nov - Des 2026', '180.000 Reach', 6, 'Post', 11400000, 68400000, 'jumlah');
  insertDealItem.run(1, 2, 'Homepage Leaderboard Banner (970x250)', 'Website', 'Share of Voice 100% Desktop & Mobile', 'November 2026', '500.000 Impresi', 1, 'Bulan', 42750000, 42750000, 'durasi');

  // --- MEDIA ORDER 1 (Wave 1 November for Deal 1 - Selesai Tayang) ---
  const mo1No = generateDocumentNumber('MO', '2026-11-01');
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
  // MO 1 takes: 2 Artikel (from deal_item 1), 3 IG Post (from deal_item 2), 1 Bulan Banner (from deal_item 3)
  insertMoItem.run(1, 1, 1, 'Artikel Advertorial SEO Premium', 'Website Bisnis', 'Transformasi Industri Kreatif dengan Jaringan 5G Ultra-Low Latency', '2026-11-03', '09:00 WIB - Editorial Feed', 'Bagus (Editor)', 1, 'Artikel', 'Tayang Terverifikasi', 'https://nusantaramedia.id/bisnis/transformasi-5g-kreatif', '2026-11-03', 'Tayang tepat waktu');
  insertMoItem.run(1, 1, 1, 'Artikel Advertorial SEO Premium', 'Website Tekno', 'Uji Kecepatan Halo 5G di 12 Titik Pusat Bisnis Jakarta & Surabaya', '2026-11-06', '10:00 WIB - Editorial Feed', 'Bagus (Editor)', 1, 'Artikel', 'Tayang Terverifikasi', 'https://nusantaramedia.id/tekno/uji-kecepatan-halo-5g', '2026-11-06', 'Performa organik sangat tinggi');
  insertMoItem.run(1, 2, 3, 'Instagram Carousel + Reels Collaboration', 'Instagram @NusantaraMedia', 'Reels: Sehari Kerja Tanpa WiFi Hanya Pakai 5G', '2026-11-04', '12:00 WIB - IG Main Feed', 'Citra (Social)', 2, 'Post', 'Tayang Terverifikasi', 'https://instagram.com/p/C_tsel5g_reels01', '2026-11-04', '2 Konten (Carousel + Reels)');
  insertMoItem.run(1, 2, 3, 'Instagram Carousel + Reels Collaboration', 'Instagram @NusantaraMedia', 'Infografis Area Cakupan Baru 5G Nusantara', '2026-11-07', '18:30 WIB - IG Main Feed', 'Citra (Social)', 1, 'Post', 'Tayang Terverifikasi', 'https://instagram.com/p/C_tsel5g_carousel02', '2026-11-07', 'Engagement di atas rata-rata');
  insertMoItem.run(1, 3, 2, 'Homepage Leaderboard Banner (970x250)', 'Website Homepage', 'Banner Interaktif Halo 5G Unlimited Enterprise', '2026-11-01', 'Homepage Top Banner', 'Andi (AdOps)', 1, 'Bulan', 'Tayang Terverifikasi', 'https://nusantaramedia.id/?campaign=halo5g-nov', '2026-11-01', 'SOV 100% aktif sepanjang November');

  // --- MEDIA ORDER 2 (Wave 2 November-December for Deal 1 - Terjadwal) ---
  const mo2No = generateDocumentNumber('MO', '2026-11-05');
  db.prepare(`
    INSERT INTO media_orders (
      nomor, deal_id, urutan_di_deal, jenis, nama_kampanye, no_po_klien, pic_internal, pic_klien,
      periode_mulai, periode_selesai, brief_materi, tautan_aset, status, dibuat_oleh, disetujui_oleh
    ) VALUES (?, 1, 2, 'Reguler', 'Wave 2: Testimoni Pelanggan Korporat Halo 5G', 'PO/TSEL/MKT/2026/8841', 'Rina Kartika', 'Arif Rahman Hakim',
      '2026-11-12', '2026-11-28', 'Menampilkan studi kasus perusahaan logistik dan fintech.', 'https://drive.nusantaramedia.id/assets/tsel-wave2', 'Terjadwal', 5, 4)
  `).run(mo2No);

  // MO 2 takes: 1 Artikel (from deal_item 1 -> remaining 1 unscheduled), 2 IG Post (from deal_item 2 -> remaining 1 unscheduled)
  insertMoItem.run(2, 1, 1, 'Artikel Advertorial SEO Premium', 'Website Bisnis', 'Efisiensi Armada Logistik Nasional Berkat IoT 5G', '2026-11-14', '09:00 WIB - Editorial Feed', 'Bagus (Editor)', 1, 'Artikel', 'Dalam Produksi', null, null, 'Draft sedang direview klien');
  insertMoItem.run(2, 2, 3, 'Instagram Carousel + Reels Collaboration', 'Instagram @NusantaraMedia', 'Reels: Wawancara CEO Startup pengguna ekosistem 5G', '2026-11-18', '12:00 WIB - IG Main Feed', 'Citra (Social)', 2, 'Post', 'Terjadwal', null, null, 'Jadwal syuting 12 Nov');

  // Log penjadwalan ulang pada MO item ke-6
  db.prepare(`
    INSERT INTO mo_item_logs (mo_item_id, perubahan, nilai_lama, nilai_baru, alasan, user_id, waktu)
    VALUES (6, 'Reschedule Tanggal Tayang', '2026-11-12', '2026-11-14', 'Menunggu rilis data resmi kuartal III dari humas klien', 5, '2026-11-06 15:10:00')
  `).run();

  // --- PROOF OF BROADCAST (BUKTI TAYANG) 1 for MO 1 ---
  const bt1No = generateDocumentNumber('BT', '2026-11-08');
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
  insertProofItem.run(1, 1, 'Artikel: Transformasi Industri Kreatif dengan 5G', 'Website Bisnis', '2026-11-03', 'https://nusantaramedia.id/bisnis/transformasi-5g-kreatif', 'capture-artikel-5g-1.png', 25000, 31400, 28900, 1420, 4.52, 31400, 890, 125.6, 'Trending #2 di kanal Bisnis');
  insertProofItem.run(1, 2, 'Artikel: Uji Kecepatan Halo 5G di 12 Titik', 'Website Tekno', '2026-11-06', 'https://nusantaramedia.id/tekno/uji-kecepatan-halo-5g', 'capture-artikel-5g-2.png', 25000, 29800, 26100, 1650, 5.54, 29800, 1120, 119.2, 'Waktu baca rata-rata 4 menit 12 detik');
  insertProofItem.run(1, 3, 'IG Reels: Sehari Kerja Tanpa WiFi Pakai 5G (2 Post)', 'Instagram @NusantaraMedia', '2026-11-04', 'https://instagram.com/p/C_tsel5g_reels01', 'capture-ig-reels-1.png', 120000, 148500, 132000, 3210, 2.16, 164000, 9450, 123.8, '420 saves & 310 shares');
  insertProofItem.run(1, 4, 'IG Carousel: Infografis Area Cakupan Baru 5G', 'Instagram @NusantaraMedia', '2026-11-07', 'https://instagram.com/p/C_tsel5g_carousel02', 'capture-ig-carousel-2.png', 60000, 68200, 61500, 1180, 1.73, 68200, 4120, 113.7, 'Sentimen komentar 96% positif');
  insertProofItem.run(1, 5, 'Homepage Leaderboard Banner (970x250)', 'Website Homepage', '2026-11-01', 'https://nusantaramedia.id/?campaign=halo5g-nov', 'capture-banner-leaderboard.png', 500000, 542000, 410000, 8940, 1.65, 542000, 8940, 108.4, 'CTR banner di atas benchmark industri (1.2%)');

  // --- INVOICE 1 for MO 1 / Deal 1 (Dibayar Sebagian) ---
  // Nilai MO 1: 2 Artikel (@14.25jt = 28.5jt) + 3 IG Post (@11.4jt = 34.2jt) + 1 Bulan Banner (@42.75jt) = Subtotal 105.450.000
  // PPN 11% = 11.599.500, PPh 23 (2% dipotong) = -2.109.000, Meterai = 10.000 -> Total Tagihan = 114.950.500
  const inv1No = generateDocumentNumber('INV', '2026-11-08');
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
  insertInvItem.run(1, 1, 'Artikel Advertorial SEO Premium (Wave 1 - 2 Artikel Terverifikasi)', '03 - 06 Nov 2026', 2, 'Artikel', 14250000, 28500000);
  insertInvItem.run(1, 2, 'Instagram Carousel + Reels Collaboration (Wave 1 - 3 Post Terverifikasi)', '04 - 07 Nov 2026', 3, 'Post', 11400000, 34200000);
  insertInvItem.run(1, 3, 'Homepage Leaderboard Banner 970x250 (SOV 100% November)', '01 - 30 Nov 2026', 1, 'Bulan', 42750000, 42750000);

  db.prepare(`
    INSERT INTO payments (invoice_id, tanggal_bayar, jumlah, metode, referensi_bank, bukti_file, dicatat_oleh)
    VALUES (1, '2026-11-08', 60000000, 'Transfer Bank Mandiri Giro', 'TRX-MDR-20261108-99102', 'bukti-transfer-tsel-dp.pdf', 7)
  `).run();

  // --- QUOTATION 2: Waiting for Manager Approval because it has a discount (Honda EM1 e: via Dentsu) ---
  const qt2No = generateDocumentNumber('QT', '2026-11-07');
  db.prepare(`
    INSERT INTO quotations (
      nomor, judul_penawaran, client_id, snapshot_nama_klien, snapshot_npwp, snapshot_alamat, snapshot_pic,
      owner_user_id, status, tanggal_terbit, berlaku_sampai, versi_aktif, catatan_followup
    ) VALUES (?, ?, 3, 'PT Astra Honda Motor (via Dentsu Media)', '01.308.441.7-092.000',
      'Jl. Laksda Yos Sudarso, Sunter I, Jakarta Utara 14350', 'Kevindra Putra',
      6, 'Menunggu Persetujuan', '2026-11-07', '2026-12-07', 1, 'Agensi meminta diskon agensi 8% untuk paket peluncuran motor listrik Honda EM1 e:.')
  `).run(qt2No, 'Kampanye Edukasi Motor Listrik Honda EM1 e: Akhir Tahun');

  // Subtotal: 2 Video YouTube (@35jt = 70jt) + 3 Artikel (@15jt = 45jt) = 115.000.000
  // Diskon 8% = 9.200.000 -> DPP = 105.800.000 -> PPN 11% = 11.638.000 -> Grand Total = 117.438.000
  db.prepare(`
    INSERT INTO quotation_versions (
      quotation_id, nomor_revisi, subtotal, diskon_persen, diskon_nominal, dpp, ppn_persen, ppn_nominal, grand_total, catatan_revisi, dibuat_oleh
    ) VALUES (2, 1, 115000000, 8, 9200000, 105800000, 11, 11638000, 117438000, 'Penawaran perdana dengan diskon agensi 8% (Menunggu Approval Manager)', 6)
  `).run();

  insertQItem.run(3, 4, 'YouTube Dedicated Liputan & Podcast', 'Video', 'Video review & test ride 15 menit', 'Desember 2026', '100.000 Views', 2, 'Video', 'jumlah', 35000000, 0, 0, 70000000);
  insertQItem.run(3, 1, 'Artikel Advertorial SEO Premium', 'Website', 'Liputan mendalam teknologi baterai tukar Honda', 'Desember 2026', '30.000 Pageviews', 3, 'Artikel', 'jumlah', 15000000, 0, 0, 45000000);

  // Create Approval Request for Quotation 2
  db.prepare(`
    INSERT INTO approvals (jenis_dokumen, dokumen_id, nomor_dokumen, ringkasan_alasan, diminta_oleh, target_role, status)
    VALUES ('Quotation', 2, ?, 'Pengajuan diskon 8% (Rp 9.200.000) pada Quotation PT Astra Honda Motor. Sesuai aturan perusahaan, seluruh diskon wajib persetujuan Manager.', 6, 'manager', 'Menunggu')
  `).run(qt2No);

  // --- QUOTATION 3: Owned by Farhan (Sales 2 - user 8) -> Deal 2 ---
  const qt3No = generateDocumentNumber('QT', '2026-10-25');
  db.prepare(`
    INSERT INTO quotations (
      nomor, judul_penawaran, client_id, snapshot_nama_klien, snapshot_npwp, snapshot_alamat, snapshot_pic,
      owner_user_id, status, tanggal_terbit, berlaku_sampai, versi_aktif, catatan_followup
    ) VALUES (?, ?, 4, 'PT Bank Mandiri Taspen Digital', '01.882.771.4-011.000',
      'Graha Mantap, Jl. Proklamasi No. 31, Menteng, Jakarta Pusat', 'Dewi Lestari',
      8, 'Deal', '2026-10-25', '2026-11-25', 1, 'Deal tanpa diskon (harga publish rate card). Skema termin 50%-50%.')
  `).run(qt3No, 'Literasi Keuangan Pensiunan Mandiri & Aplikasi Movin');

  db.prepare(`
    INSERT INTO quotation_versions (
      quotation_id, nomor_revisi, subtotal, diskon_persen, diskon_nominal, dpp, ppn_persen, ppn_nominal, grand_total, catatan_revisi, dibuat_oleh
    ) VALUES (3, 1, 66000000, 0, 0, 66000000, 11, 7260000, 73260000, 'Publish Rate tanpa diskon', 8)
  `).run();

  insertQItem.run(4, 6, 'Executive Morning Briefing Blast', 'Newsletter', 'Sponsor eksklusif newsletter pagi', 'November 2026', '35% Open Rate', 2, 'Minggu', 'durasi', 18000000, 0, 0, 36000000);
  insertQItem.run(4, 1, 'Artikel Advertorial SEO Premium', 'Website', 'Edukasi investasi aman masa pensiun', 'November 2026', '20.000 Pageviews', 2, 'Artikel', 'jumlah', 15000000, 0, 0, 30000000);

  const dl2No = generateDocumentNumber('DL', '2026-10-28');
  db.prepare(`
    INSERT INTO deals (
      nomor, quotation_id, quotation_version_id, client_id, snapshot_nama_klien, owner_user_id,
      nama_kampanye, no_po_klien, nilai_deal, dpp, ppn_nominal, mulai_kontrak, berlaku_sampai, skema_tagih, status, lampiran_po
    ) VALUES (?, 3, 4, 4, 'PT Bank Mandiri Taspen Digital', 8, ?, 'PO/MANTAP/CORCOMM/102', 73260000, 66000000, 7260000, '2026-11-01', '2026-11-30', 'termin', 'Berjalan', 'PO-BankMantap-102.pdf')
  `).run(dl2No, 'Literasi Keuangan Pensiunan Mandiri & Aplikasi Movin');

  insertDealItem.run(2, 6, 'Executive Morning Briefing Blast', 'Newsletter', 'Sponsor eksklusif newsletter pagi', 'November 2026', '35% Open Rate', 2, 'Minggu', 18000000, 36000000, 'durasi');
  insertDealItem.run(2, 1, 'Artikel Advertorial SEO Premium', 'Website', 'Edukasi investasi aman masa pensiun', 'November 2026', '20.000 Pageviews', 2, 'Artikel', 15000000, 30000000, 'jumlah');

  // --- Notifications ---
  const insertNotif = db.prepare(`
    INSERT INTO notifications (user_id, role_target, judul, pesan, tautan_modul, dokumen_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertNotif.run(4, 'manager', 'Persetujuan Diskon Quotation Menunggu', `Quotation ${qt2No} (PT Astra Honda Motor) mengajukan diskon 8% dan menunggu persetujuan Anda.`, 'quotations', 2);
  insertNotif.run(5, 'marketing', 'Sisa Kuota Deal Belum Dijadwalkan', `Deal ${dl1No} masih memiliki 1 Artikel dan 1 IG Post yang belum masuk jadwal Media Order.`, 'deals', 1);
  insertNotif.run(7, 'finance', 'Piutang Sebagian Belum Lunas', `Invoice ${inv1No} telah dibayar Rp 60.000.000, sisa piutang Rp 54.950.500 jatuh tempo 08 Des 2026.`, 'invoices', 1);

  // --- Audit Logs ---
  const insertAudit = db.prepare(`
    INSERT INTO audit_logs (user_id, nama_user, role_user, modul, aksi, nomor_dokumen, ringkasan, nilai_lama, nilai_baru, ip_address, waktu)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertAudit.run(6, 'Dimas Pratama', 'Sales', 'Quotation', 'CREATE_REVISION', qt1No, 'Membuat Revisi 2 pada Quotation dengan penambahan kuota IG Reels dan diskon 5%', '{"versi":1,"total":183150000,"diskon":0}', '{"versi":2,"total":186646500,"diskon_persen":5}', '10.24.1.18', '2026-10-16 11:05:00');
  insertAudit.run(4, 'Budi Santoso', 'Manager', 'Quotation', 'APPROVE_DISCOUNT', qt1No, 'Menyetujui diskon 5% pada Quotation PT Telekomunikasi Seluler Nusantara', '{"status":"Menunggu Persetujuan"}', '{"status":"Terkirim","approved_by":"Budi Santoso"}', '10.24.1.04', '2026-10-16 13:40:00');
  insertAudit.run(6, 'Dimas Pratama', 'Sales', 'Deal', 'CONVERT_TO_DEAL', dl1No, `Mengonversi Quotation ${qt1No} (Rev.2) menjadi Paket Deal ${dl1No}`, '{"quotation_status":"Terkirim"}', `{"deal_nomor":"${dl1No}","nilai_deal":186646500}`, '10.24.1.18', '2026-10-18 10:15:00');
  insertAudit.run(5, 'Rina Kartika', 'Marketing', 'Media Order', 'CREATE_MO', mo1No, `Membuat Media Order Reguler ${mo1No} dari kuota Deal ${dl1No}`, null, `{"mo_nomor":"${mo1No}","items_count":3}`, '10.24.2.11', '2026-11-01 09:00:00');
  insertAudit.run(4, 'Budi Santoso', 'Manager', 'Bukti Tayang', 'VERIFY_PROOF', bt1No, `Memverifikasi Bukti Tayang ${bt1No}; 5 item MO otomatis berstatus Tayang Terverifikasi`, '{"status":"Menunggu Verifikasi"}', '{"status":"Terverifikasi","mo_items_verified":5}', '10.24.1.04', '2026-11-08 09:30:00');
  insertAudit.run(7, 'Siti Rahmawati', 'Finance', 'Invoice', 'RECORD_PAYMENT', inv1No, `Mencatat pembayaran termin pertama Rp 60.000.000 untuk Invoice ${inv1No}`, '{"total_dibayar":0,"status":"Terkirim"}', '{"total_dibayar":60000000,"status":"Dibayar Sebagian"}', '10.24.3.02', '2026-11-08 14:20:00');
}
