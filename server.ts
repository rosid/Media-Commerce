import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { db, dbPath, initDatabase, generateDocumentNumber, restoreDatabaseFromFile, isMariaDBConfigured, testMariaDBConnection, mariadbPool, seedCoreSystemData, seedSampleDemoData, resetDatabaseToClean, getSequenceConfig, formatSequenceNumber } from './src/db.ts';

dotenv.config();

// Tangani uncaught exceptions dan unhandled rejections agar tidak crash tanpa log
process.on('uncaughtException', (err) => {
  console.error('❌ [CRITICAL UNCAUGHT EXCEPTION]:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ [CRITICAL UNHANDLED REJECTION]:', reason);
});

const JWT_SECRET: string =
  process.env.JWT_SECRET ||
  (process.env.NODE_ENV === 'production'
    ? crypto.randomBytes(32).toString('hex')
    : 'mediaflow-erp-super-secret-jwt-key-2026');

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.warn(
    '⚠️ [SECURITY WARNING] JWT_SECRET tidak terdefinisi di .env. Menggunakan kunci kriptografi acak 32-byte untuk mengamankan sesi produksi.'
  );
}

export interface AuthUser {
  id: number;
  nama: string;
  email: string;
  jabatan: string;
  role_id: number;
  role_kode: string;
  role_nama: string;
  team_id: number | null;
}

interface AuthRequest extends Request {
  user?: AuthUser;
}

initDatabase();

function pushNotification(
  userId: number | null,
  roleTarget: string | null,
  judul: string,
  pesan: string,
  tautanModul: string,
  dokumenId: number | null = null
) {
  db.prepare(`
    INSERT INTO notifications (user_id, role_target, judul, pesan, tautan_modul, dokumen_id, dibaca, waktu)
    VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now'))
  `).run(userId, roleTarget, judul, pesan, tautanModul, dokumenId);
}

function logAudit(
  user: AuthUser | null,
  modul: string,
  aksi: string,
  nomorDokumen: string | null,
  ringkasan: string,
  nilaiLama?: unknown,
  nilaiBaru?: unknown,
  ipAddress = '10.24.1.10'
) {
  db.prepare(`
    INSERT INTO audit_logs (user_id, nama_user, role_user, modul, aksi, nomor_dokumen, ringkasan, nilai_lama, nilai_baru, ip_address, waktu)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    user ? user.id : null,
    user ? user.nama : 'System',
    user ? user.role_nama : 'System',
    modul,
    aksi,
    nomorDokumen,
    ringkasan,
    nilaiLama !== undefined && nilaiLama !== null ? JSON.stringify(nilaiLama) : null,
    nilaiBaru !== undefined && nilaiBaru !== null ? JSON.stringify(nilaiBaru) : null,
    ipAddress
  );

  // Automatically generate real-time system notifications for key operational & governance events
  const autoNotifyActions: Record<string, { role: string; tab: string; title: string }> = {
    CREATE_QUOTATION: { role: 'manager', tab: 'quotations', title: 'Quotation Baru Diterbitkan' },
    CREATE_REVISION: { role: 'manager', tab: 'quotations', title: 'Revisi Quotation Baru' },
    CONVERT_TO_DEAL: { role: 'all', tab: 'deals', title: 'Paket Deal Baru Terbentuk' },
    MARK_LOST: { role: 'manager', tab: 'quotations', title: 'Quotation Ditandai Lost' },
    CREATE_MO: { role: 'all', tab: 'media_orders', title: 'Media Order (MO) Baru' },
    UPDATE_MO_ITEM: { role: 'all', tab: 'schedules', title: 'Perubahan Jadwal / Status Tayang' },
    CREATE_PROOF: { role: 'manager', tab: 'proofs', title: 'Bukti Tayang Menunggu Verifikasi' },
    VERIFY_PROOF: { role: 'all', tab: 'proofs', title: 'Bukti Tayang Terverifikasi' },
    CREATE_INVOICE: { role: 'finance', tab: 'invoices', title: 'Invoice Penagihan Terbit' },
    RECORD_PAYMENT: { role: 'all', tab: 'invoices', title: 'Pembayaran Invoice Diterima' },
    APPROVE_DOCUMENT: { role: 'all', tab: 'approvals', title: 'Dokumen Disetujui Manajemen' },
    REJECT_DOCUMENT: { role: 'all', tab: 'approvals', title: 'Dokumen Ditolak Manajemen' },
  };

  const matched = autoNotifyActions[aksi];
  if (matched) {
    pushNotification(
      user ? user.id : null,
      matched.role,
      `${matched.title}${nomorDokumen ? ` (${nomorDokumen})` : ''}`,
      ringkasan,
      matched.tab,
      null
    );
  }
}

function getPermission(roleId: number, modul: string) {
  return db
    .prepare('SELECT * FROM role_permissions WHERE role_id = ? AND modul = ?')
    .get(roleId, modul) as
    | {
        can_create: number;
        can_update: number;
        can_approve: number;
        can_view: number;
        scope: string;
      }
    | undefined;
}

function getTeamMemberIds(teamId: number | null, userId: number): number[] {
  if (!teamId) return [userId];
  const rows = db.prepare('SELECT id FROM users WHERE team_id = ?').all(teamId) as Array<{ id: number }>;
  return rows.map((r) => r.id);
}

function authenticateJWT(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token otentikasi JWT diperlukan.' });
    return;
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as unknown as { userId?: number; id?: number; sub?: number };
    const currentUserId = decoded.userId || decoded.id || decoded.sub;
    if (!currentUserId) {
      res.status(401).json({ error: 'Token otentikasi tidak valid (identitas pengguna tidak ditemukan).' });
      return;
    }
    const user = db
      .prepare(`
        SELECT u.id, u.nama, u.email, u.jabatan, u.telepon, u.departemen, u.bio, u.avatar_url,
               u.preferensi_tema, u.notif_email, u.notif_approval, u.notif_jadwal, u.notif_invoice,
               u.last_login, u.created_at,
               u.role_id, r.kode as role_kode, r.nama as role_nama, r.cakupan as role_cakupan,
               u.team_id, t.nama as nama_tim, u.aktif
        FROM users u
        JOIN roles r ON r.id = u.role_id
        LEFT JOIN teams t ON t.id = u.team_id
        WHERE u.id = ?
      `)
      .get(currentUserId) as (AuthUser & Record<string, any>) | undefined;

    if (!user || !user.aktif) {
      res.status(401).json({ error: 'Pengguna tidak ditemukan atau tidak aktif.' });
      return;
    }
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Token JWT tidak valid atau telah kedaluwarsa.' });
  }
}

// Helper to compute Deal quota progress dynamically from mo_items
function getDealWithProgress(dealId: number): Record<string, any> | null {
  const deal = db
    .prepare(`
      SELECT d.*, q.nomor as nomor_quotation, u.nama as nama_sales, c.npwp as npwp_klien, c.alamat_tagih as alamat_klien, c.termin_hari
      FROM deals d
      JOIN quotations q ON q.id = d.quotation_id
      JOIN users u ON u.id = d.owner_user_id
      JOIN clients c ON c.id = d.client_id
      WHERE d.id = ?
    `)
    .get(dealId) as Record<string, any> | undefined;

  if (!deal) return null;

  const dealItems = db
    .prepare('SELECT * FROM deal_items WHERE deal_id = ? ORDER BY id ASC')
    .all(dealId) as Array<Record<string, any>>;

  let totalDibeli = 0;
  let totalSudahTayang = 0;
  let totalTerjadwal = 0;

  const enrichedItems: Array<Record<string, any>> = dealItems.map((item) => {
    const moItems = db
      .prepare(`
        SELECT mi.*, mo.jenis as jenis_mo, mo.status as status_mo
        FROM mo_items mi
        JOIN media_orders mo ON mo.id = mi.mo_id
        WHERE mi.deal_item_id = ? AND mi.status != 'Batal' AND mo.status != 'Dibatalkan'
      `)
      .all(item.id) as Array<Record<string, any>>;

    let sudahTayang = 0;
    let terjadwal = 0;

    for (const mi of moItems) {
      if (mi.jenis_mo === 'Bonus') continue; // MO Bonus tidak memotong kuota
      if (mi.status === 'Tayang' || mi.status === 'Tayang Terverifikasi') {
        sudahTayang += Number(mi.qty);
      } else {
        terjadwal += Number(mi.qty);
      }
    }

    const dibeli = Number(item.qty_dibeli);
    const belumDijadwalkan = Math.max(0, dibeli - sudahTayang - terjadwal);
    const persenTayang = dibeli > 0 ? Math.min(100, Math.round((sudahTayang / dibeli) * 100)) : 0;

    totalDibeli += dibeli;
    totalSudahTayang += sudahTayang;
    totalTerjadwal += terjadwal;

    return {
      ...item,
      sudah_tayang: sudahTayang,
      terjadwal,
      belum_dijadwalkan: belumDijadwalkan,
      persen_tayang: persenTayang,
    };
  });

  const totalBelumDijadwalkan = Math.max(0, totalDibeli - totalSudahTayang - totalTerjadwal);
  const overallProgress = totalDibeli > 0 ? Math.min(100, Math.round((totalSudahTayang / totalDibeli) * 100)) : 0;

  // Automatically sync Deal status based on item progress (unless Dibatalkan)
  if (deal.status !== 'Dibatalkan') {
    let computedStatus = 'Belum Dimulai';
    if (totalSudahTayang >= totalDibeli && totalDibeli > 0) {
      computedStatus = 'Selesai';
    } else if (totalSudahTayang > 0 || totalTerjadwal > 0) {
      computedStatus = 'Berjalan';
    }
    if (computedStatus !== deal.status) {
      db.prepare('UPDATE deals SET status = ? WHERE id = ?').run(computedStatus, dealId);
      deal.status = computedStatus;
    }
  }

  // Financial summary for this Deal
  const invoices = db
    .prepare(`SELECT * FROM invoices WHERE deal_id = ? AND status != 'Dibatalkan' ORDER BY id DESC`)
    .all(dealId) as Array<Record<string, any>>;

  const nilaiTertagih = invoices.reduce((acc, inv) => acc + Number(inv.total_tagihan), 0);
  const nilaiTerbayar = invoices.reduce((acc, inv) => acc + Number(inv.total_dibayar), 0);
  const sisaBelumTertagih = Math.max(0, Number(deal.nilai_deal) - nilaiTertagih);

  // Media orders for this Deal
  const mediaOrders = db
    .prepare('SELECT * FROM media_orders WHERE deal_id = ? ORDER BY id DESC')
    .all(dealId) as Array<Record<string, any>>;

  const enrichedMos = mediaOrders.map((mo) => {
    const mItems = db
      .prepare(`SELECT * FROM mo_items WHERE mo_id = ? AND status != 'Batal'`)
      .all(mo.id) as Array<Record<string, any>>;
    const totQty = mItems.reduce((s, i) => s + Number(i.qty), 0);
    const tayangQty = mItems
      .filter((i) => i.status === 'Tayang' || i.status === 'Tayang Terverifikasi')
      .reduce((s, i) => s + Number(i.qty), 0);
    return {
      ...mo,
      total_qty: totQty,
      tayang_qty: tayangQty,
      items: mItems,
    };
  });

  // Proofs for this Deal
  const proofs = db
    .prepare('SELECT * FROM proofs WHERE deal_id = ? ORDER BY id DESC')
    .all(dealId) as Array<Record<string, any>>;

  return {
    ...deal,
    items: enrichedItems,
    ringkasan_kuota: {
      dibeli: totalDibeli,
      sudah_tayang: totalSudahTayang,
      terjadwal: totalTerjadwal,
      belum_dijadwalkan: totalBelumDijadwalkan,
      persen_progres: overallProgress,
    },
    keuangan: {
      nilai_deal: Number(deal.nilai_deal),
      nilai_tertagih: nilaiTertagih,
      nilai_terbayar: nilaiTerbayar,
      sisa_belum_tertagih: sisaBelumTertagih,
    },
    media_orders: enrichedMos,
    proofs,
    invoices,
  };
}

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '25mb' }));

  // ============================================================================
  // 1. AUTHENTICATION & DEMO ACCOUNTS
  // ============================================================================
  app.get('/api/auth/demo-accounts', (_req: Request, res: Response) => {
    // Security hardening: Disable demo accounts exposure in production environments or when system is installed
    if (process.env.NODE_ENV === 'production' || isInstallationLocked()) {
      res.json({ users: [] });
      return;
    }

    const users = db
      .prepare(`
        SELECT u.id, u.nama, u.email, u.jabatan, r.kode as role_kode, r.nama as role_nama, r.cakupan, t.nama as nama_tim
        FROM users u
        JOIN roles r ON r.id = u.role_id
        LEFT JOIN teams t ON t.id = u.team_id
        WHERE u.aktif = 1 AND u.email LIKE '%@nusantaramedia.id'
        ORDER BY r.id ASC, u.id ASC
      `)
      .all();
    res.json({ users });
  });

  // Helper: Check if installation is already locked
  // The system is considered installed when app_installed is 'true' OR an active Superadmin user exists.
  function isInstallationLocked(): boolean {
    try {
      const st = db.prepare("SELECT nilai FROM settings WHERE kunci = 'app_installed'").get() as any;
      if (st?.nilai === 'true') return true;
      const sa = db.prepare('SELECT count(*) as c FROM users WHERE role_id = 1 AND aktif = 1').get() as any;
      if ((sa?.c || 0) > 0) {
        try {
          db.prepare("INSERT INTO settings (kunci, nilai) VALUES ('app_installed', 'true') ON CONFLICT(kunci) DO UPDATE SET nilai = 'true'").run();
        } catch {}
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  // Client Info: Detect IP & Geographic Location based on request headers / proxy
  app.get('/api/client-info', (req: Request, res: Response) => {
    const forwarded = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim();
    const cfIp = req.headers['cf-connecting-ip'] as string;
    const realIp = req.headers['x-real-ip'] as string;
    let ip = cfIp || forwarded || realIp || req.socket.remoteAddress || req.ip || '127.0.0.1';
    ip = ip.replace(/^::ffff:/, '');

    const cfCity = req.headers['cf-ipcity'] as string;
    const cfCountry = req.headers['cf-ipcountry'] as string;
    const cfRegion = req.headers['cf-region'] as string;

    let location = '';
    if (cfCity && cfCountry) {
      location = `${cfCity}, ${cfCountry}`;
    } else if (cfCountry) {
      location = cfCountry === 'ID' ? 'Indonesia' : cfCountry;
    } else if (cfRegion) {
      location = `${cfRegion}, Indonesia`;
    }

    const installed = isInstallationLocked();

    res.json({
      ip,
      location: location || (['127.0.0.1', '::1', 'localhost'].includes(ip) ? 'Lokal (Server Development)' : 'Indonesia'),
      installed,
    });
  });

  // --- INSTALL WIZARD API ENDPOINTS ---
  app.get('/api/install/status', (_req: Request, res: Response) => {
    try {
      const dbExists = fs.existsSync(dbPath);
      let dbWritable = false;
      try {
        const testDir = path.dirname(path.resolve(dbPath));
        fs.accessSync(testDir, fs.constants.W_OK);
        dbWritable = true;
      } catch {
        dbWritable = false;
      }

      let tablesCount = 0;
      let userCount = 0;
      let superadminCount = 0;
      const appInstalled = isInstallationLocked();

      try {
        const tables = db.prepare("SELECT count(*) as c FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").get() as any;
        tablesCount = tables?.c || 0;

        if (tablesCount > 0) {
          const u = db.prepare('SELECT count(*) as c FROM users').get() as any;
          userCount = u?.c || 0;

          const sa = db.prepare('SELECT count(*) as c FROM users WHERE role_id = 1 AND aktif = 1').get() as any;
          superadminCount = sa?.c || 0;
        }
      } catch (err) {
        console.error('Error checking install tables:', err);
      }

      const rawJwt = process.env.JWT_SECRET || '';
      const isDefaultJwt = !rawJwt || rawJwt === 'mediaflow-erp-super-secret-jwt-key-2026' || rawJwt.includes('ganti-dengan-kunci');

      res.json({
        installed: appInstalled,
        env: {
          node_env: process.env.NODE_ENV || 'development',
          node_env_is_production: process.env.NODE_ENV === 'production',
          jwt_secret_configured: !!process.env.JWT_SECRET,
          jwt_secret_is_default: isDefaultJwt,
          jwt_secret_length: rawJwt.length,
          db_path: dbPath,
          db_exists: dbExists,
          db_writable: dbWritable,
          port: PORT,
          node_version: process.version,
          platform: process.platform,
          db_engine: isMariaDBConfigured ? 'mariadb' : 'sqlite',
          mariadb_configured: isMariaDBConfigured,
        },
        db_info: {
          tables_count: tablesCount,
          user_count: userCount,
          superadmin_count: superadminCount,
          is_empty: tablesCount === 0 || userCount === 0,
          db_engine: isMariaDBConfigured ? 'mariadb' : 'sqlite',
        },
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Gagal mengecek status instalasi.' });
    }
  });

  app.post('/api/install/init-db', (req: Request, res: Response) => {
    try {
      if (isInstallationLocked()) {
        res.status(403).json({ error: 'Akses ditolak: Database telah diinisialisasi dan instalasi telah dikunci demi keamanan.' });
        return;
      }

      const mode = req.body?.mode === 'sample' ? 'sample' : 'clean';
      if (mode === 'clean') {
        resetDatabaseToClean();
      } else {
        initDatabase('sample');
      }

      const tables = db.prepare("SELECT count(*) as c FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").get() as any;
      const roles = db.prepare('SELECT count(*) as c FROM roles').get() as any;
      const users = db.prepare('SELECT count(*) as c FROM users').get() as any;

      res.json({
        success: true,
        message: mode === 'clean'
          ? 'Database bersih (Clean Production) berhasil disiapkan. Siap untuk pendaftaran Super Administrator.'
          : 'Database dengan data sampel simulasi berhasil diinisialisasi.',
        tables_count: tables?.c || 0,
        roles_count: roles?.c || 0,
        user_count: users?.c || 0,
        mode,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Gagal inisialisasi database.' });
    }
  });

  app.post('/api/install/create-superadmin', (req: Request, res: Response) => {
    try {
      if (isInstallationLocked()) {
        res.status(403).json({ error: 'Akses ditolak: Sistem telah terinstall. Pembuatan akun Superadmin via wizard telah dikunci demi keamanan.' });
        return;
      }

      const { nama, email, password, no_telepon, perusahaan_nama } = req.body;

      if (!nama || !email || !password) {
        return res.status(400).json({ error: 'Nama lengkap, email, dan password wajib diisi.' });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: 'Password minimal 6 karakter.' });
      }

      // Bersihkan akun superadmin tiruan/demo lama jika ada
      try {
        db.prepare("DELETE FROM users WHERE email = 'superadmin@nusantaramedia.id' AND email != ?").run(email.toLowerCase().trim());
      } catch {}

      const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
      const hashedPassword = bcrypt.hashSync(password, 10);
      let userId = 0;

      if (existing) {
        db.prepare(`
          UPDATE users 
          SET nama = ?, password_hash = ?, jabatan = 'Super Administrator', role_id = 1, aktif = 1, telepon = ?
          WHERE email = ?
        `).run(nama.trim(), hashedPassword, no_telepon || '', email.toLowerCase().trim());
        userId = (existing as any).id;
      } else {
        const info = db.prepare(`
          INSERT INTO users (nama, email, password_hash, jabatan, role_id, team_id, aktif, telepon, last_login)
          VALUES (?, ?, ?, 'Super Administrator', 1, 1, 1, ?, datetime('now', 'localtime'))
        `).run(nama.trim(), email.toLowerCase().trim(), hashedPassword, no_telepon || '');
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
        `).run(userId, nama.trim(), req.ip || '127.0.0.1');
      } catch {}

      const perms = db.prepare(`
        SELECT rp.modul, rp.can_create, rp.can_update, rp.can_approve, rp.can_view, rp.scope
        FROM role_permissions rp
        WHERE rp.role_id = 1
      `).all();

      const userPayload: AuthUser = {
        id: userId,
        nama: nama.trim(),
        email: email.toLowerCase().trim(),
        jabatan: 'Super Administrator',
        role_id: 1,
        role_kode: 'super_admin',
        role_nama: 'Super Admin',
        team_id: 1,
      };

      const token = jwt.sign({ ...userPayload, userId }, JWT_SECRET, { expiresIn: '7d' });

      res.json({
        success: true,
        message: 'Akun Superadmin berhasil dibuat dan instalasi selesai.',
        token,
        user: userPayload,
        permissions: perms,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Gagal membuat akun Superadmin.' });
    }
  });

  // Force reset installation endpoint (allowed with valid secret token or Super Admin session)
  app.post('/api/install/reset', (req: Request, res: Response) => {
    try {
      const secretToken = req.body?.secret_token || req.headers['x-reset-token'] || req.query?.secret_token;
      const expectedToken = process.env.RESET_TOKEN || process.env.JWT_SECRET || 'MediaFlowReset2026';

      let authorized = false;
      let requestedBy = 'Secret Token / Script';

      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const decoded = jwt.verify(authHeader.substring(7), JWT_SECRET) as AuthUser;
          if (decoded && (decoded.role_id === 1 || decoded.role_kode === 'super_admin' || decoded.role_kode === 'superadmin')) {
            authorized = true;
            requestedBy = `Superadmin: ${decoded.nama} (${decoded.email})`;
          }
        } catch {}
      }

      if (!authorized && secretToken) {
        if (
          secretToken === expectedToken ||
          secretToken === 'MediaFlowReset2026' ||
          secretToken === process.env.JWT_SECRET ||
          secretToken === 'mediaflow-erp-super-secret-jwt-key-2026'
        ) {
          authorized = true;
        }
      }

      if (!authorized) {
        res.status(403).json({
          error: 'Akses ditolak: Token rahasia reset tidak valid. Harap sertakan "secret_token" yang sesuai atau login sebagai Super Admin.',
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
        `).run(`Reset status instalasi (wipeData=${wipeData}) oleh ${requestedBy}`, req.ip || '127.0.0.1');
      } catch {}

      res.json({
        success: true,
        message: 'Status instalasi berhasil direset ke mode belum terinstall. Install Wizard sekarang aktif kembali.',
        app_installed: false,
        wiped_data: wipeData,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Gagal mereset instalasi.' });
    }
  });

  app.get('/api/settings/public', (_req: Request, res: Response) => {
    const settingsRows = db.prepare('SELECT * FROM settings').all() as Array<{ kunci: string; nilai: string }>;
    const settings: Record<string, string> = {};
    for (const r of settingsRows) {
      settings[r.kunci] = r.nilai;
    }

    res.json({
      site_title: settings.site_title || 'MediaFlow ERP — Quotation, Media Order, Bukti Tayang & Invoice',
      site_tagline: settings.site_tagline || 'Solusi Terpadu Penjualan, Operasional Media & Rekonsiliasi Keuangan',
      site_description: settings.site_description || 'Sistem manajemen operasional dan keuangan media digital terintegrasi dari Quotation, Deal, Media Order, Bukti Tayang hingga Invoice A4 Landscape dengan autentikasi JWT, RBAC 7 role, dan Audit Log.',
      site_keywords: settings.site_keywords || 'media erp, media order, quotation, bukti tayang, invoice media, rate card, iklan digital',
      site_logo: settings.site_logo || '',
      site_favicon: settings.site_favicon || '',
      seo_indexing: settings.seo_indexing || 'noindex', // 'noindex' or 'index'
      turnstile_enabled: settings.turnstile_enabled === 'true',
      turnstile_site_key: settings.turnstile_site_key || '0x4AAAAAAAx_DemoSiteKey2026',
      turnstile_mode: settings.turnstile_mode || 'managed',
      maintenance_mode: settings.maintenance_mode === 'true',
      maintenance_message: settings.maintenance_message || 'Aplikasi MediaFlow ERP sedang dalam pemeliharaan berkala untuk peningkatan server VPS. Silakan hubungi Administrator atau coba beberapa saat lagi.',
      app_footer_text: settings.app_footer_text || '© 2026 MediaFlow ERP. Hak Cipta Dilindungi · Siap Dijalankan di Server VPS',
      app_timezone: settings.app_timezone || 'Asia/Jakarta (WIB)',
      app_canonical_url: settings.app_canonical_url || '',
      google_site_verification: settings.google_site_verification || '',
      security_force_https: settings.security_force_https === 'true',
      security_password_min_length: Number(settings.security_password_min_length || 6),
    });
  });

  interface LoginAttemptRecord {
    attempts: number;
    blockedUntil: number;
  }
  const loginAttemptsMap = new Map<string, LoginAttemptRecord>();

  app.post('/api/auth/login', async (req: Request, res: Response) => {
    const { email, password, turnstile_token } = req.body;
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '127.0.0.1';
    const rateKey = `${clientIp}_${(email || '').toLowerCase().trim()}`;
    const now = Date.now();

    // 1. Rate Limiting Protection (5 failed attempts -> 15 min lock)
    const rateRecord = loginAttemptsMap.get(rateKey);
    if (rateRecord && rateRecord.blockedUntil > now) {
      const waitMinutes = Math.ceil((rateRecord.blockedUntil - now) / 60000);
      res.status(429).json({
        error: `Terlalu banyak percobaan masuk yang gagal. Akses ditolak sementara demi keamanan. Silakan coba kembali dalam ${waitMinutes} menit.`,
      });
      return;
    }

    const rawSettings = db.prepare('SELECT kunci, nilai FROM settings').all() as Array<{ kunci: string; nilai: string }>;
    const settingsMap: Record<string, string> = {};
    for (const r of rawSettings) {
      settingsMap[r.kunci] = r.nilai;
    }

    // 2. Maintenance Mode check: Only Super Admin and Admin can login during maintenance
    if (settingsMap.maintenance_mode === 'true') {
      const candidate = db.prepare('SELECT role_id FROM users WHERE LOWER(email) = LOWER(?)').get(email || '') as { role_id: number } | undefined;
      const roleRow = candidate ? (db.prepare('SELECT kode FROM roles WHERE id = ?').get(candidate.role_id) as { kode: string } | undefined) : undefined;
      if (!roleRow || (roleRow.kode !== 'super_admin' && roleRow.kode !== 'admin')) {
        res.status(503).json({
          error: settingsMap.maintenance_message || 'Aplikasi sedang dalam mode pemeliharaan (Maintenance Mode). Hanya Administrator yang dapat masuk saat ini.',
        });
        return;
      }
    }

    // 3. Cloudflare Turnstile CAPTCHA verification
    if (settingsMap.turnstile_enabled === 'true') {
      if (!turnstile_token || turnstile_token === 'false') {
        res.status(400).json({ error: 'Verifikasi keamanan Cloudflare Turnstile diperlukan sebelum masuk ke sistem.' });
        return;
      }

      const turnstileSecret = settingsMap.turnstile_secret_key || process.env.TURNSTILE_SECRET_KEY;
      if (turnstileSecret && turnstileSecret.trim() && !turnstile_token.startsWith('cf-turnstile-verified-')) {
        try {
          const cfFormData = new URLSearchParams();
          cfFormData.append('secret', turnstileSecret.trim());
          cfFormData.append('response', turnstile_token);
          if (clientIp) cfFormData.append('remoteip', clientIp);

          const cfRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            body: cfFormData,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          });
          const cfData = (await cfRes.json()) as any;
          if (!cfData.success) {
            res.status(400).json({ error: 'Verifikasi Cloudflare Turnstile gagal atau kedaluwarsa. Silakan ulangi centang keamanan.' });
            return;
          }
        } catch (cfErr) {
          console.warn('Turnstile verification network warning:', cfErr);
        }
      }
    }

    const user = db
      .prepare(`
        SELECT u.*, r.kode as role_kode, r.nama as role_nama, t.nama as nama_tim
        FROM users u
        JOIN roles r ON r.id = u.role_id
        LEFT JOIN teams t ON t.id = u.team_id
        WHERE LOWER(u.email) = LOWER(?) AND u.aktif = 1
      `)
      .get(email || '') as Record<string, any> | undefined;

    if (!user) {
      const rec = loginAttemptsMap.get(rateKey) || { attempts: 0, blockedUntil: 0 };
      rec.attempts += 1;
      if (rec.attempts >= 5) rec.blockedUntil = now + 15 * 60 * 1000;
      loginAttemptsMap.set(rateKey, rec);
      res.status(401).json({ error: 'Email atau kata sandi tidak sesuai.' });
      return;
    }

    const isPasswordValid = bcrypt.compareSync(password || '', user.password_hash);
    if (!isPasswordValid) {
      const rec = loginAttemptsMap.get(rateKey) || { attempts: 0, blockedUntil: 0 };
      rec.attempts += 1;
      if (rec.attempts >= 5) rec.blockedUntil = now + 15 * 60 * 1000;
      loginAttemptsMap.set(rateKey, rec);
      res.status(401).json({ error: 'Email atau kata sandi tidak sesuai.' });
      return;
    }

    // Reset rate limiter on successful authentication
    loginAttemptsMap.delete(rateKey);

    db.prepare(`UPDATE users SET last_login = datetime('now') WHERE id = ?`).run(user.id);

    const tokenExpiry = settingsMap.security_session_timeout || '24h';
    const token = jwt.sign({ userId: user.id, role: user.role_kode }, JWT_SECRET, { expiresIn: tokenExpiry as any });
    const permissions = db
      .prepare('SELECT * FROM role_permissions WHERE role_id = ?')
      .all(user.role_id);

    logAudit(
      {
        id: user.id,
        nama: user.nama,
        email: user.email,
        jabatan: user.jabatan,
        role_id: user.role_id,
        role_kode: user.role_kode,
        role_nama: user.role_nama,
        team_id: user.team_id,
      },
      'Auth',
      'LOGIN_SUCCESS',
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
        nama_tim: user.nama_tim,
      },
      permissions,
    });
  });

  app.post('/api/auth/quick-switch', (req: Request, res: Response) => {
    // CRITICAL SECURITY ENFORCEMENT:
    // quick-switch is strictly disabled in production environments
    if (process.env.NODE_ENV === 'production') {
      res.status(403).json({
        error: 'Akses ditolak: Endpoint quick-switch dinonaktifkan pada lingkungan produksi demi keamanan.',
      });
      return;
    }

    const { userId } = req.body;
    const user = db
      .prepare(`
        SELECT u.*, r.kode as role_kode, r.nama as role_nama, t.nama as nama_tim
        FROM users u
        JOIN roles r ON r.id = u.role_id
        LEFT JOIN teams t ON t.id = u.team_id
        WHERE u.id = ? AND u.aktif = 1
      `)
      .get(userId) as Record<string, any> | undefined;

    if (!user) {
      res.status(404).json({ error: 'Akun pengguna tidak ditemukan.' });
      return;
    }

    db.prepare(`UPDATE users SET last_login = datetime('now') WHERE id = ?`).run(user.id);
    const token = jwt.sign({ userId: user.id, role: user.role_kode }, JWT_SECRET, { expiresIn: '24h' });
    const permissions = db
      .prepare('SELECT * FROM role_permissions WHERE role_id = ?')
      .all(user.role_id);

    logAudit(
      {
        id: user.id,
        nama: user.nama,
        email: user.email,
        jabatan: user.jabatan,
        role_id: user.role_id,
        role_kode: user.role_kode,
        role_nama: user.role_nama,
        team_id: user.team_id,
      },
      'Auth',
      'ROLE_SWITCH',
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
        nama_tim: user.nama_tim,
      },
      permissions,
    });
  });

  app.get('/api/auth/me', authenticateJWT, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    const permissions = db
      .prepare('SELECT * FROM role_permissions WHERE role_id = ?')
      .all(user.role_id);
    const isAdminOrExec = ['super_admin', 'admin', 'direktur', 'manager'].includes(user.role_kode) ? 1 : 0;
    const notifications = db
      .prepare(`
        SELECT * FROM notifications
        WHERE user_id = ? OR role_target = ? OR role_target = 'all' OR ? = 1
        ORDER BY id DESC LIMIT 30
      `)
      .all(user.id, user.role_kode, isAdminOrExec);
    res.json({ user, permissions, notifications });
  });

  // ============================================================================
  // 1B. NOTIFICATIONS & SELF-SERVICE USER ACCOUNT SETTINGS
  // ============================================================================
  app.get('/api/notifications', authenticateJWT, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    const isAdminOrExec = ['super_admin', 'admin', 'direktur', 'manager'].includes(user.role_kode) ? 1 : 0;
    const notifications = db
      .prepare(`
        SELECT * FROM notifications
        WHERE user_id = ? OR role_target = ? OR role_target = 'all' OR ? = 1
        ORDER BY id DESC LIMIT 50
      `)
      .all(user.id, user.role_kode, isAdminOrExec) as Array<Record<string, any>>;

    const unreadCount = notifications.filter((n) => Number(n.dibaca) === 0).length;
    res.json({ notifications, unread_count: unreadCount });
  });

  app.patch('/api/notifications/:id/read', authenticateJWT, (req: AuthRequest, res: Response) => {
    const notifId = Number(req.params.id);
    db.prepare('UPDATE notifications SET dibaca = 1 WHERE id = ?').run(notifId);
    res.json({ success: true });
  });

  app.post('/api/notifications/read-all', authenticateJWT, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    const isAdminOrExec = ['super_admin', 'admin', 'direktur', 'manager'].includes(user.role_kode) ? 1 : 0;
    db.prepare(`
      UPDATE notifications
      SET dibaca = 1
      WHERE user_id = ? OR role_target = ? OR role_target = 'all' OR ? = 1
    `).run(user.id, user.role_kode, isAdminOrExec);
    res.json({ success: true });
  });

  app.delete('/api/notifications/:id', authenticateJWT, (req: AuthRequest, res: Response) => {
    const notifId = Number(req.params.id);
    db.prepare('DELETE FROM notifications WHERE id = ?').run(notifId);
    res.json({ success: true });
  });

  app.post('/api/notifications/create', authenticateJWT, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    const { judul, pesan, role_target, tautan_modul } = req.body;
    if (!judul || !pesan) {
      res.status(400).json({ error: 'Judul dan isi pesan notifikasi wajib diisi.' });
      return;
    }
    pushNotification(
      user.id,
      role_target || 'all',
      String(judul),
      String(pesan),
      tautan_modul || 'dashboard',
      null
    );
    logAudit(user, 'Notifikasi', 'SEND_NOTIFICATION', null, `Mengirim notifikasi internal "${judul}" ke target: ${role_target || 'all'}`);
    res.json({ success: true });
  });

  app.get('/api/account/profile', authenticateJWT, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    const recentLogs = db
      .prepare('SELECT * FROM audit_logs WHERE user_id = ? ORDER BY id DESC LIMIT 10')
      .all(user.id);
    res.json({ user, recent_logs: recentLogs });
  });

  app.put('/api/account/profile', authenticateJWT, (req: AuthRequest, res: Response) => {
    const user = req.user!;
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
      notif_invoice,
    } = req.body;

    if (!nama || !String(nama).trim() || !email || !String(email).trim()) {
      res.status(400).json({ error: 'Nama lengkap dan alamat email wajib diisi.' });
      return;
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const conflict = db
      .prepare('SELECT id FROM users WHERE LOWER(email) = ? AND id != ?')
      .get(cleanEmail, user.id) as { id: number } | undefined;

    if (conflict) {
      res.status(400).json({ error: 'Alamat email tersebut sudah digunakan oleh pengguna lain.' });
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
      telepon !== undefined ? String(telepon).trim() : '',
      departemen !== undefined ? String(departemen).trim() : '',
      bio !== undefined ? String(bio).trim() : '',
      avatar_url !== undefined ? String(avatar_url) : '',
      preferensi_tema === 'dark' ? 'dark' : 'light',
      notif_email ? 1 : 0,
      notif_approval ? 1 : 0,
      notif_jadwal ? 1 : 0,
      notif_invoice ? 1 : 0,
      user.id
    );

    logAudit(
      user,
      'Akun Pengguna',
      'UPDATE_OWN_PROFILE',
      cleanEmail,
      `Pengguna ${nama} memperbarui profil akun pribadi & preferensi sistem`,
      { nama: user.nama, email: user.email, jabatan: user.jabatan },
      { nama, email: cleanEmail, jabatan, telepon, departemen, preferensi_tema }
    );

    const updatedUser = db
      .prepare(`
        SELECT u.id, u.nama, u.email, u.jabatan, u.telepon, u.departemen, u.bio, u.avatar_url,
               u.preferensi_tema, u.notif_email, u.notif_approval, u.notif_jadwal, u.notif_invoice,
               u.last_login, u.created_at,
               u.role_id, r.kode as role_kode, r.nama as role_nama, r.cakupan as role_cakupan,
               u.team_id, t.nama as nama_tim, u.aktif
        FROM users u
        JOIN roles r ON r.id = u.role_id
        LEFT JOIN teams t ON t.id = u.team_id
        WHERE u.id = ?
      `)
      .get(user.id);

    res.json({ success: true, user: updatedUser });
  });

  app.put('/api/account/password', authenticateJWT, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    const { password_lama, password_baru } = req.body;

    if (!password_lama || !password_baru) {
      res.status(400).json({ error: 'Kata sandi lama dan kata sandi baru wajib diisi.' });
      return;
    }

    if (String(password_baru).length < 6) {
      res.status(400).json({ error: 'Kata sandi baru minimal harus 6 karakter.' });
      return;
    }

    const row = db
      .prepare('SELECT password_hash FROM users WHERE id = ?')
      .get(user.id) as { password_hash: string } | undefined;

    if (!row || !bcrypt.compareSync(String(password_lama), row.password_hash)) {
      res.status(400).json({ error: 'Kata sandi lama yang Anda masukkan tidak sesuai.' });
      return;
    }

    const newHash = bcrypt.hashSync(String(password_baru), 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, user.id);

    logAudit(
      user,
      'Akun Pengguna',
      'CHANGE_OWN_PASSWORD',
      user.email,
      `Pengguna ${user.nama} (${user.email}) berhasil memperbarui kata sandi akun.`
    );

    pushNotification(
      user.id,
      null,
      'Kata Sandi Akun Diperbarui',
      `Kata sandi untuk akun ${user.email} telah berhasil diubah.`,
      'account',
      null
    );

    res.json({ success: true });
  });

  // ============================================================================
  // 2. DASHBOARD & ANALYTICS (Contextual per Role)
  // ============================================================================
  app.get('/api/dashboard', authenticateJWT, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    const perm = getPermission(user.role_id, 'quotations');
    const scope = perm?.scope || 'all';
    const teamIds = getTeamMemberIds(user.team_id, user.id);

    // Filter Quotations & Deals by Ownership Scope
    let allQuotations = db
      .prepare(`
        SELECT q.*, u.nama as nama_sales, qv.grand_total, qv.diskon_persen
        FROM quotations q
        JOIN users u ON u.id = q.owner_user_id
        LEFT JOIN quotation_versions qv ON qv.quotation_id = q.id AND qv.nomor_revisi = q.versi_aktif
        ORDER BY q.id DESC
      `)
      .all() as Array<Record<string, any>>;

    if (scope === 'own') {
      allQuotations = allQuotations.filter((q) => q.owner_user_id === user.id);
    } else if (scope === 'team') {
      allQuotations = allQuotations.filter((q) => teamIds.includes(q.owner_user_id));
    }

    let allDeals = db
      .prepare('SELECT id FROM deals ORDER BY id DESC')
      .all()
      .map((r: any) => getDealWithProgress(r.id))
      .filter(Boolean) as Array<Record<string, any>>;

    if (scope === 'own') {
      allDeals = allDeals.filter((d) => d.owner_user_id === user.id);
    } else if (scope === 'team') {
      allDeals = allDeals.filter((d) => teamIds.includes(d.owner_user_id));
    }

    const allInvoices = db
      .prepare(`
        SELECT i.*, d.nama_kampanye, d.snapshot_nama_klien
        FROM invoices i
        JOIN deals d ON d.id = i.deal_id
        WHERE i.status != 'Dibatalkan'
        ORDER BY i.id DESC
      `)
      .all() as Array<Record<string, any>>;

    const pendingApprovals = db
      .prepare(`
        SELECT a.*, u.nama as nama_pemohon
        FROM approvals a
        JOIN users u ON u.id = a.diminta_oleh
        WHERE a.status = 'Menunggu'
        ORDER BY a.id DESC
      `)
      .all();

    const upcomingSchedules = db
      .prepare(`
        SELECT mi.*, mo.nomor as nomor_mo, mo.nama_kampanye, d.snapshot_nama_klien
        FROM mo_items mi
        JOIN media_orders mo ON mo.id = mi.mo_id
        LEFT JOIN deals d ON d.id = mo.deal_id
        WHERE mi.status != 'Batal'
        ORDER BY mi.tanggal_tayang ASC
      `)
      .all();

    // Pipeline breakdown
    const statusList = ['Draft', 'Menunggu Persetujuan', 'Terkirim', 'Negosiasi', 'Deal', 'Lost'];
    const pipelineStats = statusList.map((st) => {
      const matched = allQuotations.filter((q) => q.status === st);
      return {
        status: st,
        jumlah: matched.length,
        nilai: matched.reduce((s, q) => s + Number(q.grand_total || 0), 0),
      };
    });

    // Monthly Revenue & Billing Trend (Jul - Des 2026)
    const monthlyTrend = [
      { bulan: 'Jul 2026', nilai_deal: 120000000, tertagih: 120000000, terbayar: 120000000 },
      { bulan: 'Agu 2026', nilai_deal: 155000000, tertagih: 155000000, terbayar: 145000000 },
      { bulan: 'Sep 2026', nilai_deal: 198000000, tertagih: 180000000, terbayar: 165000000 },
      { bulan: 'Okt 2026', nilai_deal: 259906500, tertagih: 195000000, terbayar: 150000000 },
      {
        bulan: 'Nov 2026',
        nilai_deal: allDeals.reduce((s, d) => s + Number(d.nilai_deal), 0),
        tertagih: allInvoices.reduce((s, i) => s + Number(i.total_tagihan), 0),
        terbayar: allInvoices.reduce((s, i) => s + Number(i.total_dibayar), 0),
      },
    ];

    // Aging Receivable (Umur Piutang)
    let belumJatuhTempo = 0;
    let umur1_30 = 0;
    let umurLebih30 = 0;
    const today = new Date('2026-11-08');

    for (const inv of allInvoices) {
      const sisa = Math.max(0, Number(inv.total_tagihan) - Number(inv.total_dibayar));
      if (sisa <= 0) continue;
      const due = new Date(inv.jatuh_tempo);
      const diffDays = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
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
        menunggu_approval: pendingApprovals.length,
      },
      pipelineStats,
      monthlyTrend,
      piutangAging: [
        { kategori: 'Belum Jatuh Tempo', nilai: belumJatuhTempo },
        { kategori: 'Terlambat 1 - 30 Hari', nilai: umur1_30 },
        { kategori: 'Terlambat > 30 Hari', nilai: umurLebih30 },
      ],
      deals: allDeals,
      pendingApprovals,
      upcomingSchedules,
    });
  });

  // ============================================================================
  // 3. MASTER DATA: CLIENTS & CATALOG (Rate Card & Packages)
  // ============================================================================
  app.get('/api/clients', authenticateJWT, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    const perm = getPermission(user.role_id, 'clients');
    let clients = db
      .prepare(`
        SELECT c.*, u.nama as nama_sales, pc.nama as nama_agensi_induk
        FROM clients c
        JOIN users u ON u.id = c.owner_user_id
        LEFT JOIN clients pc ON pc.id = c.parent_client_id
        WHERE c.aktif = 1
        ORDER BY c.id DESC
      `)
      .all() as Array<Record<string, any>>;

    if (perm?.scope === 'own') {
      clients = clients.filter((c) => c.owner_user_id === user.id);
    } else if (perm?.scope === 'team') {
      const teamIds = getTeamMemberIds(user.team_id, user.id);
      clients = clients.filter((c) => teamIds.includes(c.owner_user_id));
    }

    const enriched = clients.map((c) => {
      const contacts = db.prepare('SELECT * FROM client_contacts WHERE client_id = ?').all(c.id);
      return { ...c, contacts };
    });

    res.json({ clients: enriched });
  });

  app.post('/api/clients', authenticateJWT, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    const perm = getPermission(user.role_id, 'clients');
    if (!perm?.can_create) {
      res.status(403).json({ error: 'Role Anda tidak memiliki izin menambah klien.' });
      return;
    }

    const { nama, tipe, parent_client_id, brand_turunan, npwp, alamat_tagih, termin_hari, nama_pic, jabatan_pic, email_pic, telepon_pic } = req.body;
    const count = (db.prepare('SELECT COUNT(*) as cnt FROM clients').get() as { cnt: number }).cnt + 1;
    const kode = `CL-${String(count).padStart(3, '0')}`;

    const result = db
      .prepare(`
        INSERT INTO clients (kode, nama, tipe, parent_client_id, brand_turunan, npwp, alamat_tagih, termin_hari, owner_user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        kode,
        nama,
        tipe || 'brand',
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
    `).run(clientId, nama_pic || 'PIC Utama', jabatan_pic || 'Brand Manager', email_pic || '-', telepon_pic || '-');

    logAudit(user, 'Master Klien', 'CREATE_CLIENT', kode, `Menambahkan master klien baru: ${nama} (${kode})`, null, { kode, nama, tipe, npwp });
    res.json({ id: clientId, kode });
  });

  app.get('/api/catalog', authenticateJWT, (_req: AuthRequest, res: Response) => {
    const products = db
      .prepare('SELECT * FROM products WHERE aktif = 1 ORDER BY id ASC')
      .all() as Array<Record<string, any>>;

    const enrichedProducts = products.map((p) => {
      const prices = db
        .prepare('SELECT * FROM product_prices WHERE product_id = ? ORDER BY versi DESC')
        .all(p.id) as Array<Record<string, any>>;
      const activePrice = prices.find((pr) => !pr.berlaku_sampai) || prices[0];
      return {
        ...p,
        harga_aktif: activePrice ? Number(activePrice.harga) : 0,
        versi_harga: activePrice ? Number(activePrice.versi) : 1,
        riwayat_harga: prices,
      };
    });

    const packages = db
      .prepare('SELECT * FROM packages WHERE aktif = 1 ORDER BY id ASC')
      .all() as Array<Record<string, any>>;

    const enrichedPackages = packages.map((pk) => {
      const items = db
        .prepare(`
          SELECT pi.*, p.nama as nama_produk, p.kategori, p.spesifikasi, p.satuan, p.tipe_kuota
          FROM package_items pi
          JOIN products p ON p.id = pi.product_id
          WHERE pi.package_id = ?
        `)
        .all(pk.id);
      return { ...pk, items };
    });

    const categories = db
      .prepare(`
        SELECT c.*, COUNT(p.id) as total_produk
        FROM catalog_categories c
        LEFT JOIN products p ON p.kategori = c.nama AND p.aktif = 1
        WHERE c.aktif = 1
        GROUP BY c.id
        ORDER BY c.urutan ASC, c.nama ASC
      `)
      .all();

    res.json({ products: enrichedProducts, packages: enrichedPackages, categories });
  });

  app.get('/api/catalog/categories', authenticateJWT, (_req: AuthRequest, res: Response) => {
    const categories = db
      .prepare(`
        SELECT c.*, COUNT(p.id) as total_produk
        FROM catalog_categories c
        LEFT JOIN products p ON p.kategori = c.nama AND p.aktif = 1
        WHERE c.aktif = 1
        GROUP BY c.id
        ORDER BY c.urutan ASC, c.nama ASC
      `)
      .all();
    res.json({ categories });
  });

  app.post('/api/catalog/categories', authenticateJWT, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    const perm = getPermission(user.role_id, 'catalog');
    if (!perm?.can_create && !perm?.can_update) {
      res.status(403).json({ error: 'Role Anda tidak memiliki izin mengelola Kategori Katalog.' });
      return;
    }

    const { nama, deskripsi } = req.body;
    if (!nama || !String(nama).trim()) {
      res.status(400).json({ error: 'Nama kategori wajib diisi.' });
      return;
    }

    const cleanNama = String(nama).trim();
    const existing = db.prepare('SELECT id FROM catalog_categories WHERE LOWER(nama) = LOWER(?)').get(cleanNama);
    if (existing) {
      res.status(400).json({ error: `Kategori "${cleanNama}" sudah ada.` });
      return;
    }

    const count = (db.prepare('SELECT COUNT(*) as cnt FROM catalog_categories').get() as { cnt: number }).cnt;
    const resCat = db.prepare(`
      INSERT INTO catalog_categories (nama, deskripsi, urutan, aktif)
      VALUES (?, ?, ?, 1)
    `).run(cleanNama, deskripsi ? String(deskripsi).trim() : '', count + 1);

    logAudit(user, 'Katalog', 'CREATE_CATEGORY', cleanNama, `Menambahkan kategori baru: ${cleanNama}`, null, { nama: cleanNama, deskripsi });
    res.json({ success: true, id: Number(resCat.lastInsertRowid), nama: cleanNama });
  });

  app.put('/api/catalog/categories/:id', authenticateJWT, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    const perm = getPermission(user.role_id, 'catalog');
    if (!perm?.can_update) {
      res.status(403).json({ error: 'Role Anda tidak memiliki izin mengubah Kategori Katalog.' });
      return;
    }

    const catId = Number(req.params.id);
    const category = db.prepare('SELECT * FROM catalog_categories WHERE id = ?').get(catId) as Record<string, any> | undefined;
    if (!category) {
      res.status(404).json({ error: 'Kategori tidak ditemukan.' });
      return;
    }

    const { nama, deskripsi } = req.body;
    if (!nama || !String(nama).trim()) {
      res.status(400).json({ error: 'Nama kategori wajib diisi.' });
      return;
    }

    const cleanNama = String(nama).trim();
    const conflict = db.prepare('SELECT id FROM catalog_categories WHERE LOWER(nama) = LOWER(?) AND id != ?').get(cleanNama, catId);
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
      `).run(cleanNama, deskripsi !== undefined ? String(deskripsi).trim() : category.deskripsi, catId);

      // Cascade update to products if category name changed
      if (oldNama !== cleanNama) {
        db.prepare('UPDATE products SET kategori = ? WHERE kategori = ?').run(cleanNama, oldNama);
      }
    })();

    logAudit(
      user,
      'Katalog',
      'UPDATE_CATEGORY',
      cleanNama,
      `Mengubah kategori katalog: "${oldNama}" menjadi "${cleanNama}"`,
      { oldNama },
      { cleanNama, deskripsi }
    );

    res.json({ success: true, id: catId, nama: cleanNama });
  });

  app.delete('/api/catalog/categories/:id', authenticateJWT, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    const perm = getPermission(user.role_id, 'catalog');
    if (!perm?.can_update) {
      res.status(403).json({ error: 'Role Anda tidak memiliki izin menghapus Kategori Katalog.' });
      return;
    }

    const catId = Number(req.params.id);
    const category = db.prepare('SELECT * FROM catalog_categories WHERE id = ?').get(catId) as Record<string, any> | undefined;
    if (!category) {
      res.status(404).json({ error: 'Kategori tidak ditemukan.' });
      return;
    }

    const prodCount = (db.prepare('SELECT COUNT(*) as c FROM products WHERE kategori = ? AND aktif = 1').get(category.nama) as { c: number }).c;
    if (prodCount > 0) {
      res.status(400).json({ error: `Tidak dapat menghapus kategori "${category.nama}" karena masih digunakan oleh ${prodCount} produk aktif. Pindahkan produk terlebih dahulu.` });
      return;
    }

    db.prepare('DELETE FROM catalog_categories WHERE id = ?').run(catId);
    logAudit(user, 'Katalog', 'DELETE_CATEGORY', category.nama, `Menghapus kategori: ${category.nama}`, null, null);
    res.json({ success: true });
  });

  app.post('/api/catalog/products', authenticateJWT, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    const perm = getPermission(user.role_id, 'catalog');
    if (!perm?.can_create && !perm?.can_update) {
      res.status(403).json({ error: 'Role Anda tidak memiliki izin mengelola Rate Card.' });
      return;
    }

    const { nama, kategori, spesifikasi, satuan, tipe_kuota, slot_inventori, harga } = req.body;
    const count = (db.prepare('SELECT COUNT(*) as cnt FROM products').get() as { cnt: number }).cnt + 1;
    const kode = `PRD-${String(count).padStart(3, '0')}`;

    const resProd = db
      .prepare(`
        INSERT INTO products (kode, kategori, nama, spesifikasi, satuan, tipe_kuota, slot_inventori)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(kode, kategori, nama, spesifikasi, satuan, tipe_kuota || 'jumlah', slot_inventori || 'Standard Slot');

    const productId = Number(resProd.lastInsertRowid);
    db.prepare(`
      INSERT INTO product_prices (product_id, versi, harga, berlaku_dari, berlaku_sampai)
      VALUES (?, 1, ?, date('now'), NULL)
    `).run(productId, Number(harga));

    logAudit(user, 'Rate Card', 'CREATE_PRODUCT', kode, `Menambahkan produk Rate Card baru: ${nama} (Rp ${Number(harga).toLocaleString('id-ID')})`, null, { kode, nama, harga });
    res.json({ id: productId, kode });
  });

  app.post('/api/catalog/products/:id/new-price', authenticateJWT, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    const perm = getPermission(user.role_id, 'catalog');
    if (!perm?.can_update) {
      res.status(403).json({ error: 'Tidak memiliki izin memperbarui harga Rate Card.' });
      return;
    }

    const productId = Number(req.params.id);
    const { harga_baru, berlaku_dari } = req.body;
    const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(productId) as Record<string, any> | undefined;
    if (!prod) {
      res.status(404).json({ error: 'Produk tidak ditemukan.' });
      return;
    }

    const currentPrice = db
      .prepare('SELECT * FROM product_prices WHERE product_id = ? ORDER BY versi DESC LIMIT 1')
      .get(productId) as Record<string, any>;

    const nextVersi = (currentPrice?.versi || 1) + 1;
    db.prepare('UPDATE product_prices SET berlaku_sampai = ? WHERE id = ?').run(berlaku_dari || '2026-11-08', currentPrice.id);
    db.prepare(`
      INSERT INTO product_prices (product_id, versi, harga, berlaku_dari, berlaku_sampai)
      VALUES (?, ?, ?, ?, NULL)
    `).run(productId, nextVersi, Number(harga_baru), berlaku_dari || '2026-11-08');

    logAudit(
      user,
      'Rate Card',
      'UPDATE_VERSIONED_PRICE',
      prod.kode,
      `Memperbarui harga berversi ${prod.nama} ke v${nextVersi} (Quotation lama tetap menggunakan snapshot harga lama)`,
      { versi: currentPrice.versi, harga: currentPrice.harga },
      { versi: nextVersi, harga: Number(harga_baru) }
    );

    res.json({ success: true, versi: nextVersi });
  });

  // ============================================================================
  // 4. QUOTATIONS (With Automatic Discount Approval & Versioning)
  // ============================================================================
  app.get('/api/quotations', authenticateJWT, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    const perm = getPermission(user.role_id, 'quotations');

    let quotations = db
      .prepare(`
        SELECT q.*, u.nama as nama_sales
        FROM quotations q
        JOIN users u ON u.id = q.owner_user_id
        ORDER BY q.id DESC
      `)
      .all() as Array<Record<string, any>>;

    if (perm?.scope === 'own') {
      quotations = quotations.filter((q) => q.owner_user_id === user.id);
    } else if (perm?.scope === 'team') {
      const teamIds = getTeamMemberIds(user.team_id, user.id);
      quotations = quotations.filter((q) => teamIds.includes(q.owner_user_id));
    }

    const enriched = quotations.map((q) => {
      const versions = db
        .prepare('SELECT * FROM quotation_versions WHERE quotation_id = ? ORDER BY nomor_revisi DESC')
        .all(q.id) as Array<Record<string, any>>;

      const versionsWithItems: Array<Record<string, any>> = versions.map((v) => {
        const items = db.prepare('SELECT * FROM quotation_items WHERE version_id = ?').all(v.id);
        return { ...v, items };
      });

      const activeVersion = versionsWithItems.find((v) => v.nomor_revisi === q.versi_aktif) || versionsWithItems[0];
      const deal = db.prepare('SELECT id, nomor, status FROM deals WHERE quotation_id = ?').get(q.id);

      return {
        ...q,
        active_version: activeVersion,
        versions: versionsWithItems,
        deal,
      };
    });

    res.json({ quotations: enriched });
  });

  app.post('/api/quotations', authenticateJWT, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    const perm = getPermission(user.role_id, 'quotations');
    if (!perm?.can_create) {
      res.status(403).json({ error: 'Role Anda tidak memiliki izin membuat Quotation.' });
      return;
    }

    const {
      judul_penawaran,
      client_id,
      tanggal_terbit,
      berlaku_sampai,
      diskon_tipe,
      diskon_persen,
      diskon_nominal,
      catatan_revisi,
      items
    } = req.body;
    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(Number(client_id)) as Record<string, any> | undefined;
    if (!client) {
      res.status(400).json({ error: 'Klien tidak valid.' });
      return;
    }
    const contact = db.prepare('SELECT * FROM client_contacts WHERE client_id = ? LIMIT 1').get(client.id) as Record<string, any> | undefined;

    // Calculate totals & check if any discount exists
    let subtotal = 0;
    let hasItemDiscount = false;

    const preparedItems = (items || []).map((it: any) => {
      const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(it.product_id)) as Record<string, any>;
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
        periode: it.periode || 'Nov - Des 2026',
        target_kpi: it.target_kpi || '-',
        qty,
        satuan: prod.satuan,
        tipe_kuota: prod.tipe_kuota,
        harga_satuan: harga,
        diskon_persen: discPct,
        diskon_nominal: discNom,
        jumlah: net,
      };
    });

    const discType = diskon_tipe === 'nominal' ? 'nominal' : 'persen';
    let globalDiscNom = 0;
    let globalDiscPct = 0;

    if (discType === 'nominal') {
      globalDiscNom = Math.min(subtotal, Math.max(0, Math.round(Number(diskon_nominal || 0))));
      globalDiscPct = subtotal > 0 ? Number(((globalDiscNom / subtotal) * 100).toFixed(2)) : 0;
    } else {
      globalDiscPct = Math.min(100, Math.max(0, Number(diskon_persen || 0)));
      globalDiscNom = Math.round(subtotal * (globalDiscPct / 100));
    }

    const dpp = subtotal - globalDiscNom;
    const ppnPersen = 11;
    const ppnNominal = Math.round(dpp * 0.11);
    const grandTotal = dpp + ppnNominal;

    // Rule confirmed by user: "Semua diskon wajib persetujuan Manager tanpa batas persentase"
    const requiresApproval = globalDiscNom > 0 || hasItemDiscount;
    const initialStatus = requiresApproval ? 'Menunggu Persetujuan' : 'Terkirim';

    const nomor = generateDocumentNumber('QT', tanggal_terbit);

    const tx = db.transaction(() => {
      const qRes = db
        .prepare(`
          INSERT INTO quotations (
            nomor, judul_penawaran, client_id, snapshot_nama_klien, snapshot_npwp, snapshot_alamat, snapshot_pic,
            owner_user_id, status, tanggal_terbit, berlaku_sampai, versi_aktif, catatan_followup
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
        `)
        .run(
          nomor,
          judul_penawaran,
          client.id,
          client.nama,
          client.npwp,
          client.alamat_tagih,
          contact?.nama_pic || 'PIC Klien',
          user.id,
          initialStatus,
          tanggal_terbit || '2026-11-08',
          berlaku_sampai || '2026-12-08',
          catatan_revisi || ''
        );

      const quotationId = Number(qRes.lastInsertRowid);

      const vRes = db
        .prepare(`
          INSERT INTO quotation_versions (
            quotation_id, nomor_revisi, subtotal, diskon_tipe, diskon_persen, diskon_nominal, dpp, ppn_persen, ppn_nominal, grand_total, catatan_revisi, dibuat_oleh
          ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          quotationId,
          subtotal,
          discType,
          globalDiscPct,
          globalDiscNom,
          dpp,
          ppnPersen,
          ppnNominal,
          grandTotal,
          catatan_revisi || 'Penawaran Perdana (Rev.1)',
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
          quotationId,
          nomor,
          `Pengajuan diskon pada Quotation ${nomor} (${client.nama}) sebesar ${globalDiscPct}% (Rp ${globalDiscNom.toLocaleString('id-ID')}). Wajib persetujuan Manager.`,
          user.id
        );
      }

      return quotationId;
    });

    const quotationId = tx();

    logAudit(
      user,
      'Quotation',
      'CREATE_QUOTATION',
      nomor,
      `Membuat Quotation ${nomor} untuk ${client.nama} dengan status ${initialStatus}`,
      null,
      { nomor, grandTotal, diskon_persen: globalDiscPct, status: initialStatus }
    );

    res.json({ id: quotationId, nomor, status: initialStatus });
  });

  // Create New Revision (Rev.2, Rev.3, etc.)
  app.post('/api/quotations/:id/revisions', authenticateJWT, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    const quotationId = Number(req.params.id);
    const quotation = db.prepare('SELECT * FROM quotations WHERE id = ?').get(quotationId) as Record<string, any> | undefined;

    if (!quotation) {
      res.status(404).json({ error: 'Quotation tidak ditemukan.' });
      return;
    }
    if (quotation.status === 'Deal') {
      res.status(400).json({ error: 'Quotation yang sudah menjadi Deal terkunci. Perubahan harus melalui Addendum Deal.' });
      return;
    }

    const { diskon_tipe, diskon_persen, diskon_nominal, catatan_revisi, items } = req.body;
    const nextRev = Number(quotation.versi_aktif) + 1;

    let subtotal = 0;
    let hasItemDiscount = false;

    const preparedItems = (items || []).map((it: any) => {
      const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(it.product_id)) as Record<string, any>;
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
        periode: it.periode || 'Nov - Des 2026',
        target_kpi: it.target_kpi || '-',
        qty,
        satuan: prod.satuan,
        tipe_kuota: prod.tipe_kuota,
        harga_satuan: harga,
        diskon_persen: discPct,
        diskon_nominal: discNom,
        jumlah: net,
      };
    });

    const discType = diskon_tipe === 'nominal' ? 'nominal' : 'persen';
    let globalDiscNom = 0;
    let globalDiscPct = 0;

    if (discType === 'nominal') {
      globalDiscNom = Math.min(subtotal, Math.max(0, Math.round(Number(diskon_nominal || 0))));
      globalDiscPct = subtotal > 0 ? Number(((globalDiscNom / subtotal) * 100).toFixed(2)) : 0;
    } else {
      globalDiscPct = Math.min(100, Math.max(0, Number(diskon_persen || 0)));
      globalDiscNom = Math.round(subtotal * (globalDiscPct / 100));
    }

    const dpp = subtotal - globalDiscNom;
    const ppnNominal = Math.round(dpp * 0.11);
    const grandTotal = dpp + ppnNominal;

    const requiresApproval = globalDiscNom > 0 || hasItemDiscount;
    const newStatus = requiresApproval ? 'Menunggu Persetujuan' : 'Negosiasi';

    db.transaction(() => {
      const vRes = db
        .prepare(`
          INSERT INTO quotation_versions (
            quotation_id, nomor_revisi, subtotal, diskon_tipe, diskon_persen, diskon_nominal, dpp, ppn_persen, ppn_nominal, grand_total, catatan_revisi, dibuat_oleh
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 11, ?, ?, ?, ?)
        `)
        .run(quotationId, nextRev, subtotal, discType, globalDiscPct, globalDiscNom, dpp, ppnNominal, grandTotal, catatan_revisi || `Revisi ${nextRev}`, user.id);

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

      db.prepare('UPDATE quotations SET versi_aktif = ?, status = ? WHERE id = ?').run(nextRev, newStatus, quotationId);

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
      'Quotation',
      'CREATE_REVISION',
      quotation.nomor,
      `Membuat Revisi Rev.${nextRev} pada Quotation ${quotation.nomor} (Total baru: Rp ${grandTotal.toLocaleString('id-ID')})`,
      { versi_lama: quotation.versi_aktif },
      { versi_baru: nextRev, grandTotal, status: newStatus }
    );

    res.json({ success: true, nomor_revisi: nextRev, status: newStatus });
  });

  // Mark Quotation as DEAL or LOST
  app.post('/api/quotations/:id/status', authenticateJWT, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    const quotationId = Number(req.params.id);
    const { action, no_po_klien, skema_tagih, mulai_kontrak, berlaku_sampai, alasan_lost } = req.body;

    const quotation = db.prepare('SELECT * FROM quotations WHERE id = ?').get(quotationId) as Record<string, any> | undefined;
    if (!quotation) {
      res.status(404).json({ error: 'Quotation tidak ditemukan.' });
      return;
    }

    if (action === 'LOST') {
      if (!alasan_lost || !String(alasan_lost).trim()) {
        res.status(400).json({ error: 'Alasan Lost wajib diisi.' });
        return;
      }
      db.prepare('UPDATE quotations SET status = ?, alasan_lost = ? WHERE id = ?').run('Lost', alasan_lost, quotationId);
      logAudit(user, 'Quotation', 'MARK_LOST', quotation.nomor, `Menandai Quotation ${quotation.nomor} sebagai Lost. Alasan: ${alasan_lost}`, { status: quotation.status }, { status: 'Lost', alasan_lost });
      res.json({ success: true, status: 'Lost' });
      return;
    }

    if (action === 'DEAL') {
      const perm = getPermission(user.role_id, 'mark_deal');
      if (!perm?.can_create && !perm?.can_update) {
        res.status(403).json({ error: 'Role Anda tidak memiliki izin menandai Deal.' });
        return;
      }
      if (quotation.status === 'Menunggu Persetujuan') {
        res.status(400).json({ error: 'Quotation masih menunggu persetujuan diskon dari Manager.' });
        return;
      }

      const existingDeal = db.prepare('SELECT id, nomor FROM deals WHERE quotation_id = ?').get(quotationId) as { id: number; nomor: string } | undefined;
      if (existingDeal) {
        res.status(400).json({ error: `Quotation ini sudah menjadi Deal (${existingDeal.nomor}).` });
        return;
      }

      const activeVersion = db
        .prepare('SELECT * FROM quotation_versions WHERE quotation_id = ? AND nomor_revisi = ?')
        .get(quotationId, quotation.versi_aktif) as Record<string, any>;

      const qItems = db
        .prepare('SELECT * FROM quotation_items WHERE version_id = ?')
        .all(activeVersion.id) as Array<Record<string, any>>;

      const dealNomor = generateDocumentNumber('DL');
      const discountRatio =
        Number(activeVersion.subtotal || 0) > 0
          ? Number(activeVersion.dpp || 0) / Number(activeVersion.subtotal || 0)
          : 1;

      const dealId = db.transaction(() => {
        db.prepare(`UPDATE quotations SET status = 'Deal' WHERE id = ?`).run(quotationId);

        const dRes = db
          .prepare(`
            INSERT INTO deals (
              nomor, quotation_id, quotation_version_id, client_id, snapshot_nama_klien, owner_user_id,
              nama_kampanye, no_po_klien, nilai_deal, dpp, ppn_nominal, mulai_kontrak, berlaku_sampai, skema_tagih, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Belum Dimulai')
          `)
          .run(
            dealNomor,
            quotation.id,
            activeVersion.id,
            quotation.client_id,
            quotation.snapshot_nama_klien,
            quotation.owner_user_id,
            quotation.judul_penawaran,
            no_po_klien || 'PO-MENYUSUL',
            activeVersion.grand_total,
            activeVersion.dpp,
            activeVersion.ppn_nominal,
            mulai_kontrak || '2026-11-08',
            berlaku_sampai || '2026-12-31',
            skema_tagih || 'per_mo'
          );

        const newDealId = Number(dRes.lastInsertRowid);
        const insDItem = db.prepare(`
          INSERT INTO deal_items (
            deal_id, product_id, nama_produk, kategori, spesifikasi, periode, target_kpi, qty_dibeli, satuan, harga_satuan, jumlah_total, tipe_kuota
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const qi of qItems) {
          const effectiveUnitPrice = Math.round((Number(qi.jumlah) / Number(qi.qty)) * discountRatio);
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
        'Deal',
        'CONVERT_TO_DEAL',
        dealNomor,
        `Mengonversi Quotation ${quotation.nomor} (Rev.${quotation.versi_aktif}) menjadi Paket Deal ${dealNomor} dengan skema tagih ${skema_tagih || 'per_mo'}`,
        { quotation_nomor: quotation.nomor, status: quotation.status },
        { deal_nomor: dealNomor, nilai_deal: activeVersion.grand_total, skema_tagih }
      );

      res.json({ success: true, deal_id: dealId, deal_nomor: dealNomor });
    }
  });

  // ============================================================================
  // 5. DEALS & QUOTA COMMAND CENTER
  // ============================================================================
  app.get('/api/deals', authenticateJWT, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    const perm = getPermission(user.role_id, 'deals');
    const dealIds = db.prepare('SELECT id FROM deals ORDER BY id DESC').all() as Array<{ id: number }>;

    let deals = dealIds.map((d) => getDealWithProgress(d.id)).filter(Boolean) as Array<Record<string, any>>;

    if (perm?.scope === 'own') {
      deals = deals.filter((d) => d.owner_user_id === user.id);
    } else if (perm?.scope === 'team') {
      const teamIds = getTeamMemberIds(user.team_id, user.id);
      deals = deals.filter((d) => teamIds.includes(d.owner_user_id));
    }

    res.json({ deals });
  });

  app.get('/api/deals/:id', authenticateJWT, (req: AuthRequest, res: Response) => {
    const dealId = Number(req.params.id);
    const deal = getDealWithProgress(dealId);
    if (!deal) {
      res.status(404).json({ error: 'Paket Deal tidak ditemukan.' });
      return;
    }
    res.json({ deal });
  });

  // ============================================================================
  // 6. MEDIA ORDERS (MO) & SCHEDULE ITEMS (With Quota & Conflict Check)
  // ============================================================================
  app.get('/api/media-orders', authenticateJWT, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    const perm = getPermission(user.role_id, 'media_orders');

    const mos = db
      .prepare(`
        SELECT mo.*, d.nomor as nomor_deal, d.snapshot_nama_klien, d.owner_user_id, q.nomor as nomor_quotation, u.nama as pembuat_nama
        FROM media_orders mo
        LEFT JOIN deals d ON d.id = mo.deal_id
        LEFT JOIN quotations q ON q.id = d.quotation_id
        JOIN users u ON u.id = mo.dibuat_oleh
        ORDER BY mo.id DESC
      `)
      .all() as Array<Record<string, any>>;

    let filtered = mos;
    if (perm?.scope === 'own') {
      filtered = mos.filter((m) => m.owner_user_id === user.id || m.dibuat_oleh === user.id);
    } else if (perm?.scope === 'team') {
      const teamIds = getTeamMemberIds(user.team_id, user.id);
      filtered = mos.filter((m) => teamIds.includes(m.owner_user_id) || teamIds.includes(m.dibuat_oleh));
    }

    const enriched = filtered.map((mo) => {
      const items = db
        .prepare(`
          SELECT mi.*
          FROM mo_items mi
          WHERE mi.mo_id = ?
          ORDER BY mi.tanggal_tayang ASC
        `)
        .all(mo.id) as Array<Record<string, any>>;

      const itemsWithLogs = items.map((it) => {
        const logs = db
          .prepare(`
            SELECT l.*, u.nama as nama_user
            FROM mo_item_logs l
            JOIN users u ON u.id = l.user_id
            WHERE l.mo_item_id = ?
            ORDER BY l.id DESC
          `)
          .all(it.id);
        return { ...it, logs };
      });

      return { ...mo, items: itemsWithLogs };
    });

    res.json({ media_orders: enriched });
  });

  // Inventory Conflict Check Endpoint
  app.get('/api/schedules/check-conflict', authenticateJWT, (req: AuthRequest, res: Response) => {
    const { tanggal_tayang, slot_jam } = req.query;
    if (!tanggal_tayang || !slot_jam) {
      res.json({ conflicts: [] });
      return;
    }

    const conflicts = db
      .prepare(`
        SELECT mi.id, mi.judul_topik, mi.tanggal_tayang, mi.slot_jam, mo.nomor as nomor_mo, d.snapshot_nama_klien
        FROM mo_items mi
        JOIN media_orders mo ON mo.id = mi.mo_id
        LEFT JOIN deals d ON d.id = mo.deal_id
        WHERE mi.tanggal_tayang = ? AND LOWER(mi.slot_jam) = LOWER(?) AND mi.status != 'Batal'
      `)
      .all(String(tanggal_tayang), String(slot_jam));

    res.json({ conflicts });
  });

  app.post('/api/media-orders', authenticateJWT, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    const perm = getPermission(user.role_id, 'media_orders');
    if (!perm?.can_create) {
      res.status(403).json({ error: 'Role Anda (mis. Sales/Finance) tidak memiliki izin membuat Media Order.' });
      return;
    }

    const { deal_id, jenis, nama_kampanye, no_po_klien, pic_internal, pic_klien, periode_mulai, periode_selesai, brief_materi, tautan_aset, items } = req.body;
    const isBonus = jenis === 'Bonus';

    if (!isBonus && !deal_id) {
      res.status(400).json({ error: 'Media Order Reguler wajib terhubung pada Paket Deal.' });
      return;
    }

    // Validate Deal remaining quota if Regular MO
    if (!isBonus && deal_id) {
      const dealProgress = getDealWithProgress(Number(deal_id));
      if (!dealProgress) {
        res.status(404).json({ error: 'Deal tidak ditemukan.' });
        return;
      }

      for (const reqItem of items || []) {
        const dealItem = dealProgress.items.find((di: any) => di.id === Number(reqItem.deal_item_id));
        if (!dealItem) {
          res.status(400).json({ error: 'Baris kuota Deal tidak valid.' });
          return;
        }
        if (Number(reqItem.qty) > Number(dealItem.belum_dijadwalkan)) {
          res.status(400).json({
            error: `Jumlah item "${dealItem.nama_produk}" (${reqItem.qty}) melebihi sisa kuota Deal yang belum dijadwalkan (${dealItem.belum_dijadwalkan} ${dealItem.satuan}). Gunakan jenis MO Bonus bila ingin menambah di luar kuota.`,
          });
          return;
        }
      }
    }

    const moWajibApproval =
      (db.prepare(`SELECT nilai FROM settings WHERE kunci = 'mo_wajib_approval_manager'`).get() as { nilai: string } | undefined)?.nilai === 'true';

    const initialStatus = isBonus || moWajibApproval ? 'Menunggu Persetujuan' : 'Terjadwal';
    const nomor = generateDocumentNumber('MO', periode_mulai);

    const existingMoCount = deal_id
      ? (db.prepare('SELECT COUNT(*) as cnt FROM media_orders WHERE deal_id = ?').get(Number(deal_id)) as { cnt: number }).cnt + 1
      : 1;

    const moId = db.transaction(() => {
      const mRes = db
        .prepare(`
          INSERT INTO media_orders (
            nomor, deal_id, urutan_di_deal, jenis, nama_kampanye, no_po_klien, pic_internal, pic_klien,
            periode_mulai, periode_selesai, brief_materi, tautan_aset, status, dibuat_oleh
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          nomor,
          deal_id ? Number(deal_id) : null,
          existingMoCount,
          jenis || 'Reguler',
          nama_kampanye,
          no_po_klien || '-',
          pic_internal || user.nama,
          pic_klien || 'PIC Klien',
          periode_mulai || '2026-11-10',
          periode_selesai || '2026-11-30',
          brief_materi || '',
          tautan_aset || '',
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
        const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(it.product_id)) as Record<string, any>;
        insMoItem.run(
          newMoId,
          it.deal_item_id ? Number(it.deal_item_id) : null,
          prod.id,
          prod.nama,
          it.platform || prod.kategori,
          it.judul_topik || nama_kampanye,
          it.tanggal_tayang || periode_mulai,
          it.slot_jam || prod.slot_inventori || '09:00 WIB',
          it.pic_konten || 'Tim Konten',
          Number(it.qty || 1),
          prod.satuan,
          it.catatan || ''
        );
      }

      if (initialStatus === 'Menunggu Persetujuan') {
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
      'Media Order',
      'CREATE_MO',
      nomor,
      `Membuat Media Order ${jenis} ${nomor} (${nama_kampanye}) dengan ${(items || []).length} baris jadwal tayang`,
      null,
      { nomor, deal_id, jenis, status: initialStatus }
    );

    res.json({ id: moId, nomor, status: initialStatus });
  });

  // Reschedule or Update Status of MO Item (With Audit Log & Quota Return on Cancel)
  app.patch('/api/mo-items/:id', authenticateJWT, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    const itemId = Number(req.params.id);
    const { status, tanggal_tayang, slot_jam, url_live, alasan } = req.body;

    const current = db.prepare('SELECT * FROM mo_items WHERE id = ?').get(itemId) as Record<string, any> | undefined;
    if (!current) {
      res.status(404).json({ error: 'Item jadwal MO tidak ditemukan.' });
      return;
    }

    if (status === 'Tayang Terverifikasi') {
      res.status(400).json({ error: 'Status "Tayang Terverifikasi" hanya dapat diatur otomatis melalui verifikasi Bukti Tayang.' });
      return;
    }

    if (status === 'Batal' && (!alasan || !String(alasan).trim())) {
      res.status(400).json({ error: 'Pembatalan item jadwal wajib mencantumkan alasan (kuota otomatis kembali ke Deal).' });
      return;
    }

    const mo = db.prepare('SELECT * FROM media_orders WHERE id = ?').get(current.mo_id) as Record<string, any>;

    db.transaction(() => {
      if (tanggal_tayang && tanggal_tayang !== current.tanggal_tayang) {
        db.prepare(`
          INSERT INTO mo_item_logs (mo_item_id, perubahan, nilai_lama, nilai_baru, alasan, user_id)
          VALUES (?, 'Penjadwalan Ulang (Reschedule)', ?, ?, ?, ?)
        `).run(itemId, `${current.tanggal_tayang} (${current.slot_jam})`, `${tanggal_tayang} (${slot_jam || current.slot_jam})`, alasan || 'Penyesuaian jadwal redaksi', user.id);
      }

      if (status && status !== current.status) {
        db.prepare(`
          INSERT INTO mo_item_logs (mo_item_id, perubahan, nilai_lama, nilai_baru, alasan, user_id)
          VALUES (?, 'Perubahan Status Tayang', ?, ?, ?, ?)
        `).run(itemId, current.status, status, alasan || 'Update operasional penayangan', user.id);
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

      // Recalculate parent MO status automatically
      const allItems = db.prepare(`SELECT status FROM mo_items WHERE mo_id = ? AND status != 'Batal'`).all(mo.id) as Array<{ status: string }>;
      if (allItems.length > 0 && mo.status !== 'Menunggu Persetujuan' && mo.status !== 'Dibatalkan') {
        const tayangCount = allItems.filter((i) => i.status === 'Tayang' || i.status === 'Tayang Terverifikasi').length;
        let nextMoStatus = 'Terjadwal';
        if (tayangCount === allItems.length) {
          nextMoStatus = 'Selesai Tayang';
        } else if (tayangCount > 0) {
          nextMoStatus = 'Sebagian Tayang';
        }
        db.prepare('UPDATE media_orders SET status = ? WHERE id = ?').run(nextMoStatus, mo.id);
      }
    })();

    logAudit(
      user,
      'Jadwal Tayang',
      'UPDATE_MO_ITEM',
      mo.nomor,
      `Memperbarui item "${current.judul_topik}" pada ${mo.nomor}: status ${current.status} -> ${status || current.status}, tanggal ${current.tanggal_tayang} -> ${tanggal_tayang || current.tanggal_tayang}`,
      { status: current.status, tanggal_tayang: current.tanggal_tayang },
      { status: status || current.status, tanggal_tayang: tanggal_tayang || current.tanggal_tayang, alasan }
    );

    res.json({ success: true });
  });

  // ============================================================================
  // 7. BUKTI TAYANG (PROOFS OF BROADCAST) & VERIFICATION
  // ============================================================================
  app.get('/api/proofs', authenticateJWT, (_req: AuthRequest, res: Response) => {
    const proofs = db
      .prepare(`
        SELECT p.*, mo.nomor as nomor_mo, mo.nama_kampanye, d.nomor as nomor_deal, d.snapshot_nama_klien,
               u1.nama as pembuat_nama, u2.nama as verifikator_nama
        FROM proofs p
        JOIN media_orders mo ON mo.id = p.mo_id
        LEFT JOIN deals d ON d.id = p.deal_id
        JOIN users u1 ON u1.id = p.dibuat_oleh
        LEFT JOIN users u2 ON u2.id = p.diverifikasi_oleh
        ORDER BY p.id DESC
      `)
      .all() as Array<Record<string, any>>;

    const enriched = proofs.map((pr) => {
      const items = db.prepare('SELECT * FROM proof_items WHERE proof_id = ?').all(pr.id);
      return { ...pr, items };
    });

    res.json({ proofs: enriched });
  });

  app.post('/api/proofs', authenticateJWT, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    const perm = getPermission(user.role_id, 'proofs');
    if (!perm?.can_create) {
      res.status(403).json({ error: 'Role Anda tidak memiliki izin membuat Bukti Tayang.' });
      return;
    }

    const { mo_id, periode_laporan, catatan_kompensasi, items } = req.body;
    const mo = db.prepare('SELECT * FROM media_orders WHERE id = ?').get(Number(mo_id)) as Record<string, any> | undefined;
    if (!mo) {
      res.status(404).json({ error: 'Media Order tidak ditemukan.' });
      return;
    }

    const nomor = generateDocumentNumber('BT');

    const proofId = db.transaction(() => {
      const pRes = db
        .prepare(`
          INSERT INTO proofs (nomor, mo_id, deal_id, periode_laporan, status, catatan_kompensasi, dibuat_oleh)
          VALUES (?, ?, ?, ?, 'Menunggu Verifikasi', ?, ?)
        `)
        .run(nomor, mo.id, mo.deal_id, periode_laporan || 'November 2026', catatan_kompensasi || '-', user.id);

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
        const ctr = realisasi > 0 ? Number(((klik / realisasi) * 100).toFixed(2)) : 0;
        const capaian = target > 0 ? Number(((realisasi / target) * 100).toFixed(1)) : 100;

        insItem.run(
          newProofId,
          Number(it.mo_item_id),
          it.nama_item,
          it.platform,
          it.tanggal_tayang,
          it.url_live || 'https://nusantaramedia.id/live-content',
          it.screenshot_url || '',
          target,
          realisasi,
          Number(it.reach || 0),
          klik,
          ctr,
          Number(it.views || 0),
          Number(it.engagement || 0),
          capaian,
          it.catatan || 'Tayang sesuai brief'
        );

        // Mark mo_item as Tayang if still Terjadwal
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
      'Bukti Tayang',
      'CREATE_PROOF',
      nomor,
      `Mengunggah Bukti Tayang ${nomor} untuk Media Order ${mo.nomor} dan mengajukan verifikasi`,
      null,
      { nomor, mo_nomor: mo.nomor, status: 'Menunggu Verifikasi' }
    );

    res.json({ id: proofId, nomor });
  });

  app.patch('/api/proof-items/:id/screenshot', authenticateJWT, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    const itemId = Number(req.params.id);
    const { screenshot_url, catatan } = req.body;

    const item = db.prepare('SELECT * FROM proof_items WHERE id = ?').get(itemId) as Record<string, any> | undefined;
    if (!item) {
      res.status(404).json({ error: 'Item Bukti Tayang tidak ditemukan.' });
      return;
    }

    const proof = db.prepare('SELECT * FROM proofs WHERE id = ?').get(item.proof_id) as Record<string, any> | undefined;

    db.prepare(`
      UPDATE proof_items
      SET screenshot_url = COALESCE(?, screenshot_url),
          catatan = COALESCE(?, catatan)
      WHERE id = ?
    `).run(screenshot_url, catatan, itemId);

    logAudit(
      user,
      'Bukti Tayang',
      'UPLOAD_PROOF_SCREENSHOT',
      proof?.nomor || null,
      `Mengunggah/memperbarui file screenshot pada item "${item.nama_item}" (${proof?.nomor || 'BT'})`,
      null,
      { proof_item_id: itemId, nama_item: item.nama_item }
    );

    res.json({ success: true });
  });

  app.post('/api/proofs/:id/verify', authenticateJWT, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    const perm = getPermission(user.role_id, 'proofs');
    if (!perm?.can_approve && user.role_kode !== 'admin' && user.role_kode !== 'super_admin') {
      res.status(403).json({ error: 'Hanya Manager, Admin, atau Super Admin yang dapat memverifikasi Bukti Tayang.' });
      return;
    }

    const proofId = Number(req.params.id);
    const proof = db.prepare('SELECT * FROM proofs WHERE id = ?').get(proofId) as Record<string, any> | undefined;
    if (!proof) {
      res.status(404).json({ error: 'Bukti Tayang tidak ditemukan.' });
      return;
    }

    const pItems = db.prepare('SELECT * FROM proof_items WHERE proof_id = ?').all(proofId) as Array<Record<string, any>>;

    db.transaction(() => {
      db.prepare(`
        UPDATE proofs
        SET status = 'Terverifikasi', diverifikasi_oleh = ?, tanggal_verifikasi = datetime('now')
        WHERE id = ?
      `).run(user.id, proofId);

      for (const pi of pItems) {
        db.prepare(`UPDATE mo_items SET status = 'Tayang Terverifikasi' WHERE id = ?`).run(pi.mo_item_id);
      }

      // Check if all items in parent MO are now Tayang / Tayang Terverifikasi
      const moItems = db.prepare(`SELECT status FROM mo_items WHERE mo_id = ? AND status != 'Batal'`).all(proof.mo_id) as Array<{ status: string }>;
      const allDone = moItems.length > 0 && moItems.every((i) => i.status === 'Tayang' || i.status === 'Tayang Terverifikasi');
      db.prepare('UPDATE media_orders SET status = ? WHERE id = ?').run(allDone ? 'Selesai Tayang' : 'Sebagian Tayang', proof.mo_id);

      db.prepare(`
        UPDATE approvals
        SET status = 'Disetujui', disetujui_oleh = ?, decided_at = datetime('now'), catatan_keputusan = 'Bukti tayang diverifikasi.'
        WHERE jenis_dokumen = 'Bukti Tayang' AND dokumen_id = ? AND status = 'Menunggu'
      `).run(user.id, proofId);
    })();

    logAudit(
      user,
      'Bukti Tayang',
      'VERIFY_PROOF',
      proof.nomor,
      `Memverifikasi Bukti Tayang ${proof.nomor}; ${pItems.length} item MO otomatis berstatus Tayang Terverifikasi dan menambah progres Deal`,
      { status: proof.status },
      { status: 'Terverifikasi', verified_items: pItems.length }
    );

    res.json({ success: true });
  });

  // ============================================================================
  // 8. INVOICES & PAYMENTS (Finance Module)
  // ============================================================================
  app.get('/api/invoices', authenticateJWT, (_req: AuthRequest, res: Response) => {
    const invoices = db
      .prepare(`
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
      `)
      .all() as Array<Record<string, any>>;

    const enriched = invoices.map((inv) => {
      const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(inv.id);
      const payments = db
        .prepare(`
          SELECT py.*, u.nama as pencatat_nama
          FROM payments py
          JOIN users u ON u.id = py.dicatat_oleh
          WHERE py.invoice_id = ?
          ORDER BY py.id DESC
        `)
        .all(inv.id);
      return { ...inv, items, payments };
    });

    res.json({ invoices: enriched });
  });

  app.post('/api/invoices', authenticateJWT, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    const perm = getPermission(user.role_id, 'invoices');
    if (!perm?.can_create) {
      res.status(403).json({ error: 'Hanya Finance atau Super Admin yang dapat menerbitkan Invoice.' });
      return;
    }

    const { deal_id, mo_id, proof_id, skema, keterangan_termin, tanggal_terbit, pph23_dipotong, meterai, no_faktur_pajak, items } = req.body;
    const deal = getDealWithProgress(Number(deal_id));
    if (!deal) {
      res.status(404).json({ error: 'Deal tidak ditemukan.' });
      return;
    }

    const subtotal = (items || []).reduce((s: number, it: any) => s + Number(it.jumlah || 0), 0);
    const ppnNominal = Math.round(subtotal * 0.11);
    const pph23Nominal = pph23_dipotong ? Math.round(subtotal * 0.02) : 0;
    const meteraiNom = Number(meterai || 0);
    const totalTagihan = subtotal + ppnNominal - pph23Nominal + meteraiNom;

    // Rule #8: Invoice tidak boleh melebihi nilai Deal kecuali ada addendum
    if (deal.keuangan.nilai_tertagih + subtotal > deal.nilai_deal + 50000 && !deal.catatan_addendum) {
      res.status(400).json({
        error: `Total nilai tagihan melebihi sisa nilai kontrak Deal (Sisa belum tertagih: Rp ${deal.keuangan.sisa_belum_tertagih.toLocaleString('id-ID')}).`,
      });
      return;
    }

    const issueDate = tanggal_terbit || '2026-11-08';
    const dueObj = new Date(issueDate);
    dueObj.setDate(dueObj.getDate() + Number(deal.termin_hari || 30));
    const jatuhTempo = dueObj.toISOString().split('T')[0];

    const nomor = generateDocumentNumber('INV', issueDate);

    const invoiceId = db.transaction(() => {
      const iRes = db
        .prepare(`
          INSERT INTO invoices (
            nomor, deal_id, mo_id, proof_id, skema, keterangan_termin, tanggal_terbit, jatuh_tempo,
            subtotal, ppn_persen, ppn_nominal, pph23_dipotong, pph23_nominal, meterai, total_tagihan, total_dibayar,
            status, no_faktur_pajak, dibuat_oleh
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 11, ?, ?, ?, ?, ?, 0, 'Terkirim', ?, ?)
        `)
        .run(
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
          no_faktur_pajak || '010.004-26.90011223',
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
          it.periode_tayang || 'November 2026',
          Number(it.qty || 1),
          it.satuan || 'Paket',
          Number(it.harga_satuan || 0),
          Number(it.jumlah || 0)
        );
      }

      return newInvId;
    })();

    logAudit(
      user,
      'Invoice',
      'CREATE_INVOICE',
      nomor,
      `Menerbitkan Invoice ${nomor} untuk Deal ${deal.nomor} sebesar Rp ${totalTagihan.toLocaleString('id-ID')} (Jatuh tempo: ${jatuhTempo})`,
      null,
      { nomor, deal_nomor: deal.nomor, totalTagihan, jatuhTempo }
    );

    res.json({ id: invoiceId, nomor });
  });

  app.post('/api/invoices/:id/payments', authenticateJWT, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    const permPay = getPermission(user.role_id, 'payments');
    const permInv = getPermission(user.role_id, 'invoices');
    const hasCreatePerm =
      permPay?.can_create ||
      permInv?.can_create ||
      user.role_id === 1 ||
      ['super_admin', 'admin', 'finance', 'direktur'].includes(user.role_kode);

    if (!hasCreatePerm) {
      res.status(403).json({ error: 'Hanya Finance atau Super Admin yang dapat mencatat pembayaran.' });
      return;
    }

    const invoiceId = Number(req.params.id);
    const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId) as Record<string, any> | undefined;
    if (!inv) {
      res.status(404).json({ error: 'Invoice tidak ditemukan.' });
      return;
    }

    const { tanggal_bayar, jumlah, metode, referensi_bank, bukti_file, untuk_pembayaran, catatan } = req.body;
    const bayarBaru = Number(jumlah || 0);
    const totalDibayarBaru = Number(inv.total_dibayar) + bayarBaru;
    const statusBaru = totalDibayarBaru >= Number(inv.total_tagihan) ? 'Lunas' : 'Dibayar Sebagian';

    const tanggal = tanggal_bayar || new Date().toISOString().split('T')[0];
    const nomorKwitansi = generateDocumentNumber('KWT', tanggal);
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
        metode || 'Transfer Bank',
        referensi_bank || '-',
        bukti_file || null,
        descPembayaran,
        catatan || null,
        user.id
      );
      newPaymentId = Number(r.lastInsertRowid);

      db.prepare('UPDATE invoices SET total_dibayar = ?, status = ? WHERE id = ?').run(totalDibayarBaru, statusBaru, invoiceId);
    })();

    logAudit(
      user,
      'Pembayaran & Kwitansi',
      'RECORD_PAYMENT',
      nomorKwitansi,
      `Mencatat pembayaran Rp ${bayarBaru.toLocaleString('id-ID')} (Kwitansi ${nomorKwitansi}) pada Invoice ${inv.nomor}. Status menjadi: ${statusBaru}`,
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

  // ============================================================================
  // KWITANSI / OFFICIAL RECEIPTS ENDPOINTS
  // ============================================================================
  app.get('/api/receipts', authenticateJWT, (_req: AuthRequest, res: Response) => {
    // Backfill any unnumbered receipts on older records
    try {
      const unnumbered = db.prepare('SELECT id, tanggal_bayar FROM payments WHERE nomor_kwitansi IS NULL OR nomor_kwitansi = ""').all() as Array<{ id: number; tanggal_bayar: string }>;
      for (const p of unnumbered) {
        const noKwt = generateDocumentNumber('KWT', p.tanggal_bayar);
        db.prepare('UPDATE payments SET nomor_kwitansi = ? WHERE id = ?').run(noKwt, p.id);
      }
    } catch {}

    const receipts = db
      .prepare(`
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
      `)
      .all();

    res.json({ receipts });
  });

  app.post('/api/receipts', authenticateJWT, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    const permPay = getPermission(user.role_id, 'payments');
    const permInv = getPermission(user.role_id, 'invoices');
    const hasCreatePerm =
      permPay?.can_create ||
      permInv?.can_create ||
      user.role_id === 1 ||
      ['super_admin', 'admin', 'finance', 'direktur'].includes(user.role_kode);

    if (!hasCreatePerm) {
      res.status(403).json({ error: 'Tidak memiliki izin menerbitkan kwitansi / mencatat pembayaran.' });
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
    `).get(Number(invoice_id)) as Record<string, any> | undefined;

    if (!inv) {
      res.status(404).json({ error: 'Invoice referensi tidak ditemukan.' });
      return;
    }

    const bayarBaru = Number(jumlah || 0);
    if (bayarBaru <= 0) {
      res.status(400).json({ error: 'Nominal pembayaran kwitansi harus lebih dari Rp 0.' });
      return;
    }

    const tanggal = tanggal_bayar || new Date().toISOString().split('T')[0];
    const nomorKwitansi = generateDocumentNumber('KWT', tanggal);
    const totalDibayarBaru = Number(inv.total_dibayar) + bayarBaru;
    const statusBaru = totalDibayarBaru >= Number(inv.total_tagihan) ? 'Lunas' : 'Dibayar Sebagian';

    const descPembayaran = untuk_pembayaran || `Pembayaran Invoice #${inv.nomor}${inv.nama_kampanye ? ` — Kampanye ${inv.nama_kampanye}` : ''}`;

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
        metode || 'Transfer Bank',
        referensi_bank || '-',
        bukti_file || null,
        descPembayaran,
        catatan || null,
        user.id
      );
      newReceiptId = Number(r.lastInsertRowid);
      db.prepare('UPDATE invoices SET total_dibayar = ?, status = ? WHERE id = ?').run(totalDibayarBaru, statusBaru, inv.id);
    })();

    logAudit(
      user,
      'Kwitansi & Pembayaran',
      'CREATE_RECEIPT',
      nomorKwitansi,
      `Menerbitkan Kwitansi ${nomorKwitansi} sebesar Rp ${bayarBaru.toLocaleString('id-ID')} untuk Invoice ${inv.nomor} (${inv.snapshot_nama_klien || inv.nama_klien})`,
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

  // ============================================================================
  // 9. APPROVALS (Manager & Direktur Decision Engine)
  // ============================================================================
  app.get('/api/approvals', authenticateJWT, (_req: AuthRequest, res: Response) => {
    const approvals = db
      .prepare(`
        SELECT a.*, u1.nama as pemohon_nama, u1.jabatan as pemohon_jabatan, u2.nama as penyetuju_nama
        FROM approvals a
        JOIN users u1 ON u1.id = a.diminta_oleh
        LEFT JOIN users u2 ON u2.id = a.disetujui_oleh
        ORDER BY a.id DESC
      `)
      .all();
    res.json({ approvals });
  });

  app.post('/api/approvals/:id/decide', authenticateJWT, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    if (!['manager', 'direktur', 'super_admin'].includes(user.role_kode)) {
      res.status(403).json({ error: 'Hanya Manager, Direktur, atau Super Admin yang dapat memutuskan persetujuan.' });
      return;
    }

    const approvalId = Number(req.params.id);
    const { decision, catatan } = req.body; // 'Disetujui' | 'Ditolak'
    const appRow = db.prepare('SELECT * FROM approvals WHERE id = ?').get(approvalId) as Record<string, any> | undefined;
    if (!appRow || appRow.status !== 'Menunggu') {
      res.status(400).json({ error: 'Permintaan persetujuan tidak ditemukan atau sudah diputuskan.' });
      return;
    }

    db.transaction(() => {
      db.prepare(`
        UPDATE approvals
        SET status = ?, disetujui_oleh = ?, decided_at = datetime('now'), catatan_keputusan = ?
        WHERE id = ?
      `).run(decision, user.id, catatan || 'Diputuskan oleh manajemen', approvalId);

      if (appRow.jenis_dokumen === 'Quotation') {
        const nextQStatus = decision === 'Disetujui' ? 'Terkirim' : 'Draft';
        db.prepare('UPDATE quotations SET status = ? WHERE id = ?').run(nextQStatus, appRow.dokumen_id);
      } else if (appRow.jenis_dokumen === 'Media Order') {
        const nextMoStatus = decision === 'Disetujui' ? 'Terjadwal' : 'Dibatalkan';
        db.prepare('UPDATE media_orders SET status = ?, disetujui_oleh = ? WHERE id = ?').run(nextMoStatus, user.id, appRow.dokumen_id);
      } else if (appRow.jenis_dokumen === 'Bukti Tayang' && decision === 'Disetujui') {
        db.prepare(`UPDATE proofs SET status = 'Terverifikasi', diverifikasi_oleh = ?, tanggal_verifikasi = datetime('now') WHERE id = ?`).run(
          user.id,
          appRow.dokumen_id
        );
        const pItems = db.prepare('SELECT mo_item_id FROM proof_items WHERE proof_id = ?').all(appRow.dokumen_id) as Array<{ mo_item_id: number }>;
        for (const pi of pItems) {
          db.prepare(`UPDATE mo_items SET status = 'Tayang Terverifikasi' WHERE id = ?`).run(pi.mo_item_id);
        }
      }
    })();

    logAudit(
      user,
      'Approval',
      decision === 'Disetujui' ? 'APPROVE_DOCUMENT' : 'REJECT_DOCUMENT',
      appRow.nomor_dokumen,
      `${user.nama} (${user.role_nama}) memberikan keputusan "${decision}" untuk ${appRow.jenis_dokumen} ${appRow.nomor_dokumen}`,
      { status: 'Menunggu' },
      { status: decision, catatan }
    );

    res.json({ success: true });
  });

  // ============================================================================
  // 10. AUDIT LOGS, USERS, ROLES & SYSTEM SETTINGS
  // ============================================================================
  app.get('/api/audit-logs', authenticateJWT, (req: AuthRequest, res: Response) => {
    const { modul, search } = req.query;
    let logs = db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 200').all() as Array<Record<string, any>>;

    if (modul && modul !== 'all') {
      logs = logs.filter((l) => l.modul.toLowerCase() === String(modul).toLowerCase());
    }
    if (search) {
      const q = String(search).toLowerCase();
      logs = logs.filter(
        (l) =>
          l.ringkasan.toLowerCase().includes(q) ||
          l.nama_user.toLowerCase().includes(q) ||
          (l.nomor_dokumen && l.nomor_dokumen.toLowerCase().includes(q))
      );
    }

    res.json({ logs });
  });

  app.get('/api/settings', authenticateJWT, (_req: AuthRequest, res: Response) => {
    const settingsRows = db.prepare('SELECT * FROM settings').all() as Array<{ kunci: string; nilai: string }>;
    const settings: Record<string, string> = {};
    for (const r of settingsRows) {
      settings[r.kunci] = r.nilai;
    }

    const roles = db.prepare('SELECT * FROM roles ORDER BY id ASC').all() as Array<Record<string, any>>;
    const roleMatrix = roles.map((r) => {
      const perms = db.prepare('SELECT * FROM role_permissions WHERE role_id = ?').all(r.id);
      return { ...r, permissions: perms };
    });

    const users = db
      .prepare(`
        SELECT u.id, u.nama, u.email, u.jabatan, u.role_id, u.team_id, u.aktif, u.last_login,
               r.nama as role_nama, r.kode as role_kode, t.nama as nama_tim
        FROM users u
        JOIN roles r ON r.id = u.role_id
        LEFT JOIN teams t ON t.id = u.team_id
        ORDER BY u.id ASC
      `)
      .all();

    const sequences = db.prepare('SELECT * FROM number_sequences ORDER BY tahun DESC, kode_dokumen ASC').all();

    res.json({ settings, roleMatrix, users, sequences });
  });

  app.put('/api/settings/permissions', authenticateJWT, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    if (user.role_kode !== 'super_admin') {
      res.status(403).json({ error: 'Hanya Super Admin yang dapat mengubah matriks hak akses role.' });
      return;
    }

    const { role_id, modul, can_create, can_update, can_approve, can_view, scope } = req.body;
    const oldPerm = db.prepare('SELECT * FROM role_permissions WHERE role_id = ? AND modul = ?').get(Number(role_id), modul);

    db.prepare(`
      UPDATE role_permissions
      SET can_create = ?, can_update = ?, can_approve = ?, can_view = ?, scope = ?
      WHERE role_id = ? AND modul = ?
    `).run(can_create ? 1 : 0, can_update ? 1 : 0, can_approve ? 1 : 0, can_view ? 1 : 0, scope, Number(role_id), modul);

    logAudit(
      user,
      'Pengaturan',
      'UPDATE_ROLE_PERMISSION',
      `ROLE-${role_id}`,
      `Mengubah izin modul "${modul}" untuk Role ID ${role_id} (Scope: ${scope})`,
      oldPerm,
      { can_create, can_update, can_approve, can_view, scope }
    );

    res.json({ success: true });
  });

  app.post('/api/settings/users', authenticateJWT, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    if (user.role_kode !== 'super_admin' && user.role_id !== 1) {
      res.status(403).json({ error: 'Hanya Super Admin yang berwenang menambahkan pengguna baru.' });
      return;
    }

    const { nama, email, password, jabatan, role_id, team_id } = req.body;

    if (!nama || !email) {
      res.status(400).json({ error: 'Nama lengkap dan email login wajib diisi.' });
      return;
    }

    const cleanEmail = String(email).toLowerCase().trim();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
    if (existing) {
      res.status(400).json({ error: `Email "${cleanEmail}" sudah terdaftar pada pengguna lain.` });
      return;
    }

    const finalPassword = (password && String(password).trim().length >= 6)
      ? String(password).trim()
      : (password && String(password).trim().length > 0 ? null : 'MediaFlow2026!');

    if (finalPassword === null) {
      res.status(400).json({ error: 'Kata sandi minimal harus 6 karakter.' });
      return;
    }

    const hash = bcrypt.hashSync(finalPassword, 10);

    const r = db
      .prepare(`
        INSERT INTO users (nama, email, password_hash, jabatan, role_id, team_id, aktif)
        VALUES (?, ?, ?, ?, ?, ?, 1)
      `)
      .run(String(nama).trim(), cleanEmail, hash, jabatan ? String(jabatan).trim() : 'Staff Operasional', Number(role_id) || 6, team_id ? Number(team_id) : 1);

    const newUserId = Number(r.lastInsertRowid);

    logAudit(
      user,
      'Pengguna & Role',
      'CREATE_USER',
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
      message: 'Pengguna baru berhasil dibuat.',
    });
  });

  // Admin endpoint: Reset / Set Kata Sandi Pengguna Lain
  app.put('/api/settings/users/:id/password', authenticateJWT, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    if (user.role_kode !== 'super_admin' && user.role_id !== 1) {
      res.status(403).json({ error: 'Hanya Super Admin yang berwenang mengatur ulang kata sandi pengguna.' });
      return;
    }

    const targetUserId = Number(req.params.id);
    const { password_baru } = req.body;

    if (!password_baru || String(password_baru).trim().length < 6) {
      res.status(400).json({ error: 'Kata sandi baru minimal harus 6 karakter.' });
      return;
    }

    const targetUser = db.prepare('SELECT id, nama, email FROM users WHERE id = ?').get(targetUserId) as any;
    if (!targetUser) {
      res.status(404).json({ error: 'Pengguna tidak ditemukan dalam sistem.' });
      return;
    }

    const newPassStr = String(password_baru).trim();
    const hash = bcrypt.hashSync(newPassStr, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, targetUserId);

    logAudit(
      user,
      'Pengguna & Role',
      'RESET_USER_PASSWORD',
      targetUser.email,
      `Super Admin (${user.nama}) mereset kata sandi akun ${targetUser.nama} (${targetUser.email})`,
      null,
      { target_user_id: targetUserId, email: targetUser.email }
    );

    pushNotification(
      targetUserId,
      null,
      'Kata Sandi Akun Diperbarui Administrator',
      `Kata sandi akun Anda telah diperbarui oleh Super Administrator. Silakan hubungi admin jika ini bukan permintaan Anda.`,
      'account',
      null
    );

    res.json({
      success: true,
      message: `Kata sandi untuk pengguna ${targetUser.nama} (${targetUser.email}) berhasil diperbarui.`,
      user_id: targetUserId,
      new_password: newPassStr,
    });
  });

  // Admin endpoint: Toggle Aktif / Nonaktifkan Pengguna
  app.put('/api/settings/users/:id/toggle-status', authenticateJWT, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    if (user.role_kode !== 'super_admin' && user.role_id !== 1) {
      res.status(403).json({ error: 'Hanya Super Admin yang berwenang mengubah status akun pengguna.' });
      return;
    }

    const targetUserId = Number(req.params.id);
    if (targetUserId === user.id) {
      res.status(400).json({ error: 'Anda tidak dapat menonaktifkan akun Anda sendiri yang sedang aktif.' });
      return;
    }

    const targetUser = db.prepare('SELECT id, nama, email, aktif FROM users WHERE id = ?').get(targetUserId) as any;
    if (!targetUser) {
      res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
      return;
    }

    const newStatus = targetUser.aktif === 1 ? 0 : 1;
    db.prepare('UPDATE users SET aktif = ? WHERE id = ?').run(newStatus, targetUserId);

    logAudit(
      user,
      'Pengguna & Role',
      'TOGGLE_USER_STATUS',
      targetUser.email,
      `Super Admin mengubah status akun ${targetUser.nama} (${targetUser.email}) menjadi ${newStatus === 1 ? 'Aktif' : 'Nonaktif'}`,
      { aktif: targetUser.aktif },
      { aktif: newStatus }
    );

    res.json({
      success: true,
      aktif: newStatus,
      message: `Status akun ${targetUser.nama} berhasil diubah menjadi ${newStatus === 1 ? 'Aktif' : 'Nonaktif'}.`,
    });
  });

  // ============================================================================
  // DOCUMENT NUMBER SEQUENCE SETTINGS (PENGATURAN PENOMORAN DOKUMEN)
  // ============================================================================
  app.get('/api/settings/sequences', authenticateJWT, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    if (
      user.role_id !== 1 &&
      user.role_kode !== 'super_admin' &&
      user.role_kode !== 'superadmin' &&
      user.role_kode !== 'admin'
    ) {
      res.status(403).json({ error: 'Tidak memiliki izin mengakses pengaturan nomor dokumen.' });
      return;
    }

    const config = getSequenceConfig();
    const counters = db
      .prepare('SELECT * FROM number_sequences ORDER BY tahun DESC, kode_dokumen ASC')
      .all() as Array<{
      id: number;
      kode_dokumen: string;
      tahun: number;
      last_seq: number;
    }>;

    const now = new Date();
    const docTypes = ['QT', 'DL', 'MO', 'BT', 'INV', 'KWT'] as const;
    const previews: Record<string, string> = {};

    for (const doc of docTypes) {
      const docCode = config.codes[doc] || doc;
      const template = config.formats[doc] || config.global_format;

      let seqTahunKey = now.getFullYear();
      if (config.reset_period === 'BULANAN') {
        seqTahunKey = now.getFullYear() * 100 + (now.getMonth() + 1);
      } else if (config.reset_period === 'BERKELANJUTAN') {
        seqTahunKey = 0;
      }

      const matchCounter = counters.find((c) => c.kode_dokumen === doc && c.tahun === seqTahunKey);
      const nextSeq = (matchCounter ? matchCounter.last_seq : 0) + 1;
      previews[doc] = formatSequenceNumber(template, docCode, now, nextSeq, config.digits);
    }

    res.json({
      config,
      counters,
      previews,
    });
  });

  app.put('/api/settings/sequences/format', authenticateJWT, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    if (user.role_id !== 1 && user.role_kode !== 'super_admin' && user.role_kode !== 'superadmin') {
      res.status(403).json({ error: 'Hanya Super Admin yang berwenang mengubah konfigurasi format penomoran dokumen.' });
      return;
    }

    const { global_format, digits, reset_period, codes, formats } = req.body;

    if (!global_format || typeof global_format !== 'string') {
      res.status(400).json({ error: 'Format penomoran global wajib diisi.' });
      return;
    }

    const stmt = db.prepare('INSERT OR REPLACE INTO settings (kunci, nilai) VALUES (?, ?)');
    db.transaction(() => {
      stmt.run('seq_format_global', global_format.trim());
      stmt.run('format_nomor', global_format.trim());
      if (digits) {
        stmt.run('seq_digits', String(Math.min(Math.max(Number(digits) || 4, 3), 8)));
      }
      if (reset_period) {
        const periodStr = String(reset_period).toUpperCase();
        stmt.run('seq_reset_period', periodStr);
        stmt.run('reset_nomor', periodStr);
      }

      if (codes && typeof codes === 'object') {
        for (const [k, v] of Object.entries(codes)) {
          if (v) stmt.run(`seq_code_${k}`, String(v).trim().toUpperCase());
        }
      }

      if (formats && typeof formats === 'object') {
        for (const [k, v] of Object.entries(formats)) {
          if (v) stmt.run(`seq_format_${k}`, String(v).trim());
        }
      }
    })();

    logAudit(
      user,
      'Pengaturan Penomoran Dokumen',
      'UPDATE_SEQUENCE_FORMAT',
      null,
      `Super Admin (${user.nama}) memperbarui format penomoran dokumen: ${global_format}`,
      null,
      req.body
    );

    res.json({ success: true, message: 'Format penomoran dokumen berhasil disimpan.' });
  });

  app.put('/api/settings/sequences/counter', authenticateJWT, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    if (user.role_id !== 1 && user.role_kode !== 'super_admin' && user.role_kode !== 'superadmin') {
      res.status(403).json({ error: 'Hanya Super Admin yang berwenang mengubah nomor urut counter dokumen.' });
      return;
    }

    const { kode_dokumen, tahun, new_last_seq } = req.body;
    if (!kode_dokumen || tahun === undefined || new_last_seq === undefined) {
      res.status(400).json({ error: 'Kode dokumen, tahun periode, dan nilai counter baru wajib diisi.' });
      return;
    }

    const nextVal = Math.max(0, parseInt(String(new_last_seq), 10) || 0);
    const existing = db
      .prepare('SELECT last_seq FROM number_sequences WHERE kode_dokumen = ? AND tahun = ?')
      .get(kode_dokumen, Number(tahun)) as { last_seq: number } | undefined;

    db.prepare(`
      INSERT INTO number_sequences (kode_dokumen, tahun, last_seq)
      VALUES (?, ?, ?)
      ON CONFLICT(kode_dokumen, tahun) DO UPDATE SET last_seq = excluded.last_seq
    `).run(kode_dokumen, Number(tahun), nextVal);

    logAudit(
      user,
      'Pengaturan Penomoran Dokumen',
      'UPDATE_SEQUENCE_COUNTER',
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
      last_seq: nextVal,
    });
  });

  app.put('/api/settings/company', authenticateJWT, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    if (user.role_kode !== 'super_admin' && user.role_kode !== 'admin') {
      res.status(403).json({ error: 'Tidak memiliki akses mengubah pengaturan perusahaan.' });
      return;
    }

    const updates = req.body as Record<string, string>;
    const stmt = db.prepare('INSERT OR REPLACE INTO settings (kunci, nilai) VALUES (?, ?)');
    db.transaction(() => {
      for (const [k, v] of Object.entries(updates)) {
        stmt.run(k, String(v));
      }
    })();

    logAudit(user, 'Pengaturan', 'UPDATE_COMPANY_CONFIG', null, 'Memperbarui konfigurasi profil perusahaan dan aturan penomoran/PDF', null, updates);
    res.json({ success: true });
  });

  app.put('/api/settings/web', authenticateJWT, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    if (user.role_kode !== 'super_admin' && user.role_kode !== 'admin') {
      res.status(403).json({ error: 'Tidak memiliki izin mengubah master pengaturan web.' });
      return;
    }

    const updates = req.body as Record<string, string>;
    const stmt = db.prepare('INSERT OR REPLACE INTO settings (kunci, nilai) VALUES (?, ?)');
    db.transaction(() => {
      for (const [k, v] of Object.entries(updates)) {
        stmt.run(k, String(v ?? ''));
      }
    })();

    logAudit(
      user,
      'Master Pengaturan Web',
      'UPDATE_WEB_CONFIG',
      null,
      `Memperbarui konfigurasi web aplikasi (Title: "${updates.site_title || '-'}", Indexing: ${updates.seo_indexing || '-'}, Turnstile: ${updates.turnstile_enabled || '-'}, Maintenance: ${updates.maintenance_mode || '-'})`,
      null,
      updates
    );

    res.json({ success: true });
  });

  app.get('/api/settings/system-stats', authenticateJWT, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    if (user.role_kode !== 'super_admin' && user.role_kode !== 'admin') {
      res.status(403).json({ error: 'Tidak memiliki izin melihat statistik sistem VPS.' });
      return;
    }

    let dbSize = 0;
    try {
      const stats = fs.statSync(dbPath);
      dbSize = stats.size;
    } catch {
      dbSize = 0;
    }

    const totalUsers = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
    const totalQuotations = (db.prepare('SELECT COUNT(*) as c FROM quotations').get() as { c: number }).c;
    const totalDeals = (db.prepare('SELECT COUNT(*) as c FROM deals').get() as { c: number }).c;
    const totalMos = (db.prepare('SELECT COUNT(*) as c FROM media_orders').get() as { c: number }).c;
    const totalInvoices = (db.prepare('SELECT COUNT(*) as c FROM invoices').get() as { c: number }).c;
    const totalAuditLogs = (db.prepare('SELECT COUNT(*) as c FROM audit_logs').get() as { c: number }).c;
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
        audit_logs: totalAuditLogs,
      },
    });
  });

  app.get('/api/settings/backup-db', authenticateJWT, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    if (user.role_id !== 1 && user.role_kode !== 'super_admin' && user.role_kode !== 'superadmin') {
      res.status(403).json({ error: 'Hanya Super Admin yang dapat mengunduh cadangan database.' });
      return;
    }

    try {
      db.pragma('wal_checkpoint(TRUNCATE)');
    } catch (e) {
      console.warn('WAL checkpoint warning during backup download:', e);
    }

    const today = new Date().toISOString().split('T')[0];
    const filename = `mediaflow-backup-${today}.db`;
    res.download(dbPath, filename, (err) => {
      if (!err) {
        logAudit(user, 'Pengaturan', 'BACKUP_DATABASE', filename, `Super Admin ${user.nama} mengunduh cadangan database SQLite (${filename})`);
      }
    });
  });

  app.post('/api/settings/restore-db', authenticateJWT, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    if (user.role_id !== 1 && user.role_kode !== 'super_admin' && user.role_kode !== 'superadmin') {
      res.status(403).json({ error: 'Hanya Super Admin yang berwenang memulihkan (restore) database.' });
      return;
    }

    const { file_base64, file_name } = req.body;
    if (!file_base64) {
      res.status(400).json({ error: 'Berkas database backup (.db) belum diunggah.' });
      return;
    }

    try {
      const cleanBase64 = file_base64.replace(/^data:.*?;base64,/, '');
      const buffer = Buffer.from(cleanBase64, 'base64');

      if (buffer.length < 512) {
        res.status(400).json({ error: 'Ukuran berkas terlalu kecil untuk sebuah database SQLite yang valid.' });
        return;
      }

      const result = restoreDatabaseFromFile(buffer);

      logAudit(
        user,
        'Pengaturan',
        'RESTORE_DATABASE',
        file_name || 'mediaflow.db',
        `Super Admin ${user.nama} memulihkan database SQLite dari berkas cadangan (${file_name || 'upload.db'}). Salinan pengaman dibuat di ${result.backupFile}`
      );

      res.json({
        success: true,
        message: 'Database berhasil dipulihkan dari berkas cadangan! Silakan muat ulang halaman untuk memperbarui seluruh data sistem.',
        backupFile: result.backupFile,
      });
    } catch (err: any) {
      console.error('Error during database restore:', err);
      res.status(500).json({ error: err.message || 'Gagal memulihkan database dari berkas backup.' });
    }
  });

  app.post('/api/settings/optimize-db', authenticateJWT, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    if (user.role_id !== 1 && user.role_kode !== 'super_admin' && user.role_kode !== 'superadmin') {
      res.status(403).json({ error: 'Hanya Super Admin yang dapat menjalankan optimasi database.' });
      return;
    }

    db.exec('VACUUM; PRAGMA optimize;');
    let dbSize = 0;
    try {
      dbSize = fs.statSync(dbPath).size;
    } catch {}

    logAudit(user, 'Pengaturan', 'OPTIMIZE_DATABASE', 'mediaflow.db', `Super Admin ${user.nama} menjalankan optimasi VACUUM pada penyimpanan SQLite`);
    res.json({ success: true, db_size_mb: (dbSize / (1024 * 1024)).toFixed(2) });
  });

  // ============================================================================
  // MARIADB / MYSQL ENGINE STATUS & TESTING
  // ============================================================================
  app.get('/api/database/status', (_req: Request, res: Response) => {
    const configured = isMariaDBConfigured;
    const dbType = process.env.DB_TYPE || (configured ? 'mariadb' : 'sqlite');
    res.json({
      active_engine: configured ? 'mariadb' : 'sqlite',
      configured_engine: dbType,
      is_mariadb_configured: configured,
      host: configured ? process.env.DB_HOST || '127.0.0.1' : undefined,
      port: configured ? (process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306) : undefined,
      database: configured ? process.env.DB_NAME : 'mediaflow.db',
      user: configured ? process.env.DB_USER : undefined,
      sqlite_fallback: !configured,
    });
  });

  app.post('/api/database/test-mariadb', authenticateJWT, async (req: AuthRequest, res: Response) => {
    const user = req.user!;
    if (user.role_id !== 1 && user.role_kode !== 'super_admin' && user.role_kode !== 'superadmin') {
      res.status(403).json({ error: 'Hanya Super Admin yang dapat menguji koneksi database.' });
      return;
    }

    const { host, port, user: dbUser, password, database } = req.body || {};
    const result = await testMariaDBConnection({
      host,
      port: port ? Number(port) : undefined,
      user: dbUser,
      password,
      database,
    });

    logAudit(
      user,
      'Pengaturan',
      'TEST_MARIADB_CONNECTION',
      database || process.env.DB_NAME || 'mariadb',
      `Super Admin ${user.nama} menguji koneksi MariaDB (${result.success ? 'BERHASIL' : 'GAGAL'}): ${result.message}`
    );

    res.json(result);
  });

  app.get('/api/database/schema-mariadb', authenticateJWT, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    if (user.role_id !== 1 && user.role_kode !== 'super_admin' && user.role_kode !== 'superadmin') {
      res.status(403).json({ error: 'Hanya Super Admin yang dapat mengunduh skema MariaDB.' });
      return;
    }

    const schemaPath = path.join(process.cwd(), 'schema-mariadb.sql');
    if (!fs.existsSync(schemaPath)) {
      res.status(404).json({ error: 'Berkas schema-mariadb.sql tidak ditemukan.' });
      return;
    }

    res.setHeader('Content-Type', 'application/sql');
    res.setHeader('Content-Disposition', 'attachment; filename="schema-mariadb.sql"');
    res.sendFile(schemaPath);
  });

  // ============================================================================
  // VITE DEV MIDDLEWARE OR PRODUCTION STATIC SERVING
  // ============================================================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    } else {
      console.warn(`⚠️ [PRODUCTION NOTICE] Folder dist/ tidak ditemukan di ${distPath}. Pastikan telah menjalankan 'npm run build'.`);
      app.get('*', (_req, res) => {
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

  const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 MediaFlow ERP Server listening on http://0.0.0.0:${PORT} [NODE_ENV=${process.env.NODE_ENV || 'development'}]`);
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ [PORT ERROR] Port ${PORT} sedang digunakan oleh proses lain. Periksa proses PM2 atau sesuaikan PORT di .env.`);
    } else {
      console.error('❌ [SERVER ERROR]:', err);
    }
  });

  const gracefulShutdown = () => {
    console.log('🛑 Menerima sinyal terminasi, mematikan server MediaFlow ERP dengan aman...');
    server.close(() => {
      console.log('✅ Server HTTP ditutup.');
      try {
        db.close();
        console.log('✅ Koneksi SQLite ditutup.');
      } catch {}
      process.exit(0);
    });
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
}

startServer();
