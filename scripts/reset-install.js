/**
 * MediaFlow ERP - Standalone Server CLI Reset Script
 * 
 * Usage:
 *   node scripts/reset-install.js [--wipe]
 * 
 * Description:
 *   Resets the 'app_installed' flag in the SQLite database to 'false', allowing
 *   administrators to access the Setup & Install Wizard without touching SQL directly.
 *   If '--wipe' is passed, it also purges sample transactions and mock accounts,
 *   returning the system to an untouched clean production state.
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'mediaflow.db');

if (!fs.existsSync(dbPath)) {
  console.log(`ℹ️ [RESET SCRIPT] File database ${dbPath} belum ada. Sistem belum terinstall.`);
  process.exit(0);
}

try {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const args = process.argv.slice(2);
  const wipeData = args.includes('--wipe') || args.includes('-w');

  console.log('🔄 [MEDIAFLOW ERP] Memulai proses reset status instalasi...');

  const tx = db.transaction(() => {
    // 1. Reset installation flag
    db.prepare("INSERT OR REPLACE INTO settings (kunci, nilai) VALUES ('app_installed', 'false')").run();

    if (wipeData) {
      console.log('🧹 [WIPE] Membersihkan seluruh data transaksi contoh & akun demo...');
      db.pragma('foreign_keys = OFF');
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
      `);
      db.pragma('foreign_keys = ON');
      console.log('✅ [WIPE] Database berhasil dibersihkan ke mode Clean Production.');
    }
  });

  tx();
  db.close();

  console.log('\n======================================================');
  console.log('✅ SUKSES: Status instalasi MediaFlow ERP telah direset!');
  console.log('   - app_installed = false');
  console.log('   - Database: ' + dbPath);
  console.log('   - Mode: ' + (wipeData ? 'Clean (Data dihapus)' : 'Preserve (Data dipertahankan)'));
  console.log('======================================================');
  console.log('👉 Silakan buka kembali browser Anda di domain VPS untuk menjalankan Setup Wizard.');
  process.exit(0);
} catch (err) {
  console.error('❌ Gagal mereset database:', err);
  process.exit(1);
}
