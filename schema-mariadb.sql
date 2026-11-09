-- ==============================================================================
-- MediaFlow ERP — MariaDB / MySQL Complete Production Schema & Seed
-- Target: MariaDB 10.4+ / MySQL 8.0+
-- Collation: utf8mb4_unicode_ci
-- ==============================================================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

-- ------------------------------------------------------------------------------
-- 1. ROLES & PERMISSIONS
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `role_permissions`;
DROP TABLE IF EXISTS `permissions`;
DROP TABLE IF EXISTS `roles`;

CREATE TABLE `roles` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `kode` VARCHAR(50) NOT NULL UNIQUE,
  `nama` VARCHAR(100) NOT NULL,
  `cakupan` VARCHAR(255) NOT NULL,
  `deskripsi` TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `permissions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `modul` VARCHAR(100) NOT NULL UNIQUE,
  `nama_fitur` VARCHAR(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `role_permissions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `role_id` INT NOT NULL,
  `modul` VARCHAR(100) NOT NULL,
  `can_create` TINYINT(1) NOT NULL DEFAULT 0,
  `can_update` TINYINT(1) NOT NULL DEFAULT 0,
  `can_approve` TINYINT(1) NOT NULL DEFAULT 0,
  `can_view` TINYINT(1) NOT NULL DEFAULT 0,
  `scope` VARCHAR(50) NOT NULL DEFAULT 'all',
  UNIQUE KEY `uk_role_modul` (`role_id`, `modul`),
  CONSTRAINT `fk_role_perm_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 2. TEAMS & USERS
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `teams`;

CREATE TABLE `teams` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nama` VARCHAR(150) NOT NULL,
  `manager_id` INT DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nama` VARCHAR(150) NOT NULL,
  `email` VARCHAR(150) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `jabatan` VARCHAR(100) NOT NULL,
  `role_id` INT NOT NULL,
  `team_id` INT DEFAULT NULL,
  `aktif` TINYINT(1) NOT NULL DEFAULT 1,
  `telepon` VARCHAR(50) NOT NULL DEFAULT '0812-8899-7700',
  `departemen` VARCHAR(150) NOT NULL DEFAULT 'Divisi Komersial & Media Digital',
  `bio` TEXT DEFAULT NULL,
  `avatar_url` TEXT DEFAULT NULL,
  `preferensi_tema` VARCHAR(20) NOT NULL DEFAULT 'light',
  `notif_email` TINYINT(1) NOT NULL DEFAULT 1,
  `notif_approval` TINYINT(1) NOT NULL DEFAULT 1,
  `notif_jadwal` TINYINT(1) NOT NULL DEFAULT 1,
  `notif_invoice` TINYINT(1) NOT NULL DEFAULT 1,
  `last_login` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_user_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`),
  CONSTRAINT `fk_user_team` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 3. CLIENTS & CONTACTS
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `client_contacts`;
DROP TABLE IF EXISTS `clients`;

CREATE TABLE `clients` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `kode` VARCHAR(50) NOT NULL UNIQUE,
  `nama` VARCHAR(200) NOT NULL,
  `tipe` VARCHAR(50) NOT NULL DEFAULT 'brand',
  `parent_client_id` INT DEFAULT NULL,
  `brand_turunan` VARCHAR(255) DEFAULT NULL,
  `npwp` VARCHAR(50) NOT NULL,
  `alamat_tagih TEXT NOT NULL,
  `termin_hari` INT NOT NULL DEFAULT 30,
  `owner_user_id` INT NOT NULL,
  `aktif` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_client_parent` FOREIGN KEY (`parent_client_id`) REFERENCES `clients` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_client_owner` FOREIGN KEY (`owner_user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `client_contacts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `client_id` INT NOT NULL,
  `nama_pic` VARCHAR(150) NOT NULL,
  `jabatan` VARCHAR(100) NOT NULL,
  `email` VARCHAR(150) NOT NULL,
  `telepon` VARCHAR(50) NOT NULL,
  `utama` TINYINT(1) NOT NULL DEFAULT 1,
  CONSTRAINT `fk_contact_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 4. PRODUCT CATALOG & RATE CARD
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `package_items`;
DROP TABLE IF EXISTS `packages`;
DROP TABLE IF EXISTS `product_prices`;
DROP TABLE IF EXISTS `products`;
DROP TABLE IF EXISTS `catalog_categories`;

CREATE TABLE `catalog_categories` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nama` VARCHAR(100) NOT NULL UNIQUE,
  `deskripsi` TEXT DEFAULT NULL,
  `urutan` INT NOT NULL DEFAULT 0,
  `aktif` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `products` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `kode` VARCHAR(50) NOT NULL UNIQUE,
  `kategori` VARCHAR(100) NOT NULL,
  `nama` VARCHAR(200) NOT NULL,
  `spesifikasi` TEXT NOT NULL,
  `satuan` VARCHAR(50) NOT NULL,
  `tipe_kuota` VARCHAR(50) NOT NULL DEFAULT 'jumlah',
  `slot_inventori` VARCHAR(100) DEFAULT NULL,
  `aktif` TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `product_prices` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `product_id` INT NOT NULL,
  `versi` INT NOT NULL DEFAULT 1,
  `harga` DECIMAL(15,2) NOT NULL,
  `berlaku_dari` VARCHAR(50) NOT NULL,
  `berlaku_sampai` VARCHAR(50) DEFAULT NULL,
  CONSTRAINT `fk_price_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `packages` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `kode` VARCHAR(50) NOT NULL UNIQUE,
  `nama` VARCHAR(200) NOT NULL,
  `deskripsi` TEXT NOT NULL,
  `harga_paket` DECIMAL(15,2) NOT NULL,
  `aktif` TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `package_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `package_id` INT NOT NULL,
  `product_id` INT NOT NULL,
  `qty` INT NOT NULL,
  CONSTRAINT `fk_pkgitem_pkg` FOREIGN KEY (`package_id`) REFERENCES `packages` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pkgitem_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 5. QUOTATIONS & VERSIONS
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `quotation_items`;
DROP TABLE IF EXISTS `quotation_versions`;
DROP TABLE IF EXISTS `quotations`;

CREATE TABLE `quotations` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nomor` VARCHAR(50) NOT NULL UNIQUE,
  `judul_penawaran` VARCHAR(255) NOT NULL,
  `client_id` INT NOT NULL,
  `snapshot_nama_klien` VARCHAR(200) NOT NULL,
  `snapshot_npwp` VARCHAR(50) NOT NULL,
  `snapshot_alamat` TEXT NOT NULL,
  `snapshot_pic` VARCHAR(150) NOT NULL,
  `owner_user_id` INT NOT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'Draft',
  `tanggal_terbit` VARCHAR(50) NOT NULL,
  `berlaku_sampai` VARCHAR(50) NOT NULL,
  `versi_aktif` INT NOT NULL DEFAULT 1,
  `alasan_lost` TEXT DEFAULT NULL,
  `catatan_followup` TEXT DEFAULT NULL,
  `dibuka_klien_pada` VARCHAR(50) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_quote_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`),
  CONSTRAINT `fk_quote_owner` FOREIGN KEY (`owner_user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `quotation_versions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `quotation_id` INT NOT NULL,
  `nomor_revisi` INT NOT NULL DEFAULT 1,
  `subtotal` DECIMAL(15,2) NOT NULL DEFAULT 0,
  `diskon_tipe` VARCHAR(20) NOT NULL DEFAULT 'persen',
  `diskon_persen` DECIMAL(5,2) NOT NULL DEFAULT 0,
  `diskon_nominal` DECIMAL(15,2) NOT NULL DEFAULT 0,
  `dpp` DECIMAL(15,2) NOT NULL DEFAULT 0,
  `ppn_persen` DECIMAL(5,2) NOT NULL DEFAULT 11,
  `ppn_nominal` DECIMAL(15,2) NOT NULL DEFAULT 0,
  `grand_total` DECIMAL(15,2) NOT NULL DEFAULT 0,
  `catatan_revisi` TEXT DEFAULT NULL,
  `dibuat_oleh` INT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_quote_revisi` (`quotation_id`, `nomor_revisi`),
  CONSTRAINT `fk_qv_quote` FOREIGN KEY (`quotation_id`) REFERENCES `quotations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_qv_user` FOREIGN KEY (`dibuat_oleh`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `quotation_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `version_id` INT NOT NULL,
  `product_id` INT DEFAULT NULL,
  `nama_produk` VARCHAR(200) NOT NULL,
  `kategori` VARCHAR(100) NOT NULL,
  `spesifikasi` TEXT NOT NULL,
  `periode` VARCHAR(100) NOT NULL,
  `target_kpi` VARCHAR(255) DEFAULT NULL,
  `qty` INT NOT NULL,
  `satuan` VARCHAR(50) NOT NULL,
  `tipe_kuota` VARCHAR(50) NOT NULL DEFAULT 'jumlah',
  `harga_satuan` DECIMAL(15,2) NOT NULL,
  `diskon_persen` DECIMAL(5,2) NOT NULL DEFAULT 0,
  `diskon_nominal` DECIMAL(15,2) NOT NULL DEFAULT 0,
  `jumlah` DECIMAL(15,2) NOT NULL,
  CONSTRAINT `fk_qi_version` FOREIGN KEY (`version_id`) REFERENCES `quotation_versions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 6. DEALS & DEAL ITEMS
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `deal_items`;
DROP TABLE IF EXISTS `deals`;

CREATE TABLE `deals` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nomor` VARCHAR(50) NOT NULL UNIQUE,
  `quotation_id` INT NOT NULL UNIQUE,
  `quotation_version_id` INT NOT NULL,
  `client_id` INT NOT NULL,
  `snapshot_nama_klien` VARCHAR(200) NOT NULL,
  `owner_user_id` INT NOT NULL,
  `nama_kampanye` VARCHAR(255) NOT NULL,
  `no_po_klien` VARCHAR(100) DEFAULT NULL,
  `nilai_deal` DECIMAL(15,2) NOT NULL,
  `dpp` DECIMAL(15,2) NOT NULL,
  `ppn_nominal` DECIMAL(15,2) NOT NULL,
  `mulai_kontrak` VARCHAR(50) NOT NULL,
  `berlaku_sampai` VARCHAR(50) NOT NULL,
  `skema_tagih` VARCHAR(50) NOT NULL DEFAULT 'per_mo',
  `status` VARCHAR(50) NOT NULL DEFAULT 'Belum Dimulai',
  `lampiran_po` TEXT DEFAULT NULL,
  `catatan_addendum` TEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_deal_quote` FOREIGN KEY (`quotation_id`) REFERENCES `quotations` (`id`),
  CONSTRAINT `fk_deal_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`),
  CONSTRAINT `fk_deal_owner` FOREIGN KEY (`owner_user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `deal_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `deal_id` INT NOT NULL,
  `product_id` INT DEFAULT NULL,
  `nama_produk` VARCHAR(200) NOT NULL,
  `kategori` VARCHAR(100) NOT NULL,
  `spesifikasi` TEXT NOT NULL,
  `periode` VARCHAR(100) NOT NULL,
  `target_kpi` VARCHAR(255) DEFAULT NULL,
  `qty_dibeli` INT NOT NULL,
  `satuan` VARCHAR(50) NOT NULL,
  `harga_satuan` DECIMAL(15,2) NOT NULL,
  `jumlah_total` DECIMAL(15,2) NOT NULL,
  `tipe_kuota` VARCHAR(50) NOT NULL DEFAULT 'jumlah',
  CONSTRAINT `fk_di_deal` FOREIGN KEY (`deal_id`) REFERENCES `deals` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 7. MEDIA ORDERS (MO) & ITEMS
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `mo_item_logs`;
DROP TABLE IF EXISTS `mo_items`;
DROP TABLE IF EXISTS `media_orders`;

CREATE TABLE `media_orders` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nomor` VARCHAR(50) NOT NULL UNIQUE,
  `deal_id` INT DEFAULT NULL,
  `urutan_di_deal` INT NOT NULL DEFAULT 1,
  `jenis` VARCHAR(50) NOT NULL DEFAULT 'Reguler',
  `nama_kampanye` VARCHAR(255) NOT NULL,
  `no_po_klien` VARCHAR(100) DEFAULT NULL,
  `pic_internal` VARCHAR(150) NOT NULL,
  `pic_klien` VARCHAR(150) NOT NULL,
  `periode_mulai` VARCHAR(50) NOT NULL,
  `periode_selesai` VARCHAR(50) NOT NULL,
  `brief_materi` TEXT DEFAULT NULL,
  `tautan_aset` TEXT DEFAULT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'Draft',
  `dibuat_oleh` INT NOT NULL,
  `disetujui_oleh` INT DEFAULT NULL,
  `catatan_addendum` TEXT DEFAULT NULL,
  `lampiran_mo_ttd` TEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_mo_deal` FOREIGN KEY (`deal_id`) REFERENCES `deals` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_mo_creator` FOREIGN KEY (`dibuat_oleh`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `mo_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `mo_id` INT NOT NULL,
  `deal_item_id` INT DEFAULT NULL,
  `product_id` INT DEFAULT NULL,
  `nama_item` VARCHAR(200) NOT NULL,
  `platform` VARCHAR(100) NOT NULL,
  `judul_topik` VARCHAR(255) NOT NULL,
  `tanggal_tayang` VARCHAR(50) NOT NULL,
  `slot_jam` VARCHAR(50) NOT NULL,
  `pic_konten` VARCHAR(150) NOT NULL,
  `qty` INT NOT NULL,
  `satuan` VARCHAR(50) NOT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'Terjadwal',
  `url_live` TEXT DEFAULT NULL,
  `tanggal_tayang_aktual` VARCHAR(50) DEFAULT NULL,
  `alasan_batal` TEXT DEFAULT NULL,
  `catatan` TEXT DEFAULT NULL,
  CONSTRAINT `fk_moi_mo` FOREIGN KEY (`mo_id`) REFERENCES `media_orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `mo_item_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `mo_item_id` INT NOT NULL,
  `perubahan` VARCHAR(255) NOT NULL,
  `nilai_lama` TEXT DEFAULT NULL,
  `nilai_baru` TEXT DEFAULT NULL,
  `alasan` TEXT NOT NULL,
  `user_id` INT NOT NULL,
  `waktu` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_moilog_item` FOREIGN KEY (`mo_item_id`) REFERENCES `mo_items` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_moilog_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 8. PROOFS (BUKTI TAYANG)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `proof_items`;
DROP TABLE IF EXISTS `proofs`;

CREATE TABLE `proofs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nomor` VARCHAR(50) NOT NULL UNIQUE,
  `mo_id` INT NOT NULL,
  `deal_id` INT DEFAULT NULL,
  `periode_laporan` VARCHAR(100) NOT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'Draft',
  `catatan_kompensasi` TEXT DEFAULT NULL,
  `dibuat_oleh` INT NOT NULL,
  `diverifikasi_oleh` INT DEFAULT NULL,
  `tanggal_verifikasi` VARCHAR(50) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_proof_mo` FOREIGN KEY (`mo_id`) REFERENCES `media_orders` (`id`),
  CONSTRAINT `fk_proof_creator` FOREIGN KEY (`dibuat_oleh`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `proof_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `proof_id` INT NOT NULL,
  `mo_item_id` INT NOT NULL,
  `nama_item` VARCHAR(200) NOT NULL,
  `platform` VARCHAR(100) NOT NULL,
  `tanggal_tayang` VARCHAR(50) NOT NULL,
  `url_live` TEXT NOT NULL,
  `screenshot_url` TEXT NOT NULL,
  `target_impresi` INT NOT NULL DEFAULT 0,
  `realisasi_impresi` INT NOT NULL DEFAULT 0,
  `reach` INT NOT NULL DEFAULT 0,
  `klik` INT NOT NULL DEFAULT 0,
  `ctr` DECIMAL(5,2) NOT NULL DEFAULT 0,
  `views` INT NOT NULL DEFAULT 0,
  `engagement` INT NOT NULL DEFAULT 0,
  `capaian_persen` DECIMAL(5,2) NOT NULL DEFAULT 100,
  `catatan` TEXT DEFAULT NULL,
  CONSTRAINT `fk_pi_proof` FOREIGN KEY (`proof_id`) REFERENCES `proofs` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 9. INVOICES & PAYMENTS
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `payments`;
DROP TABLE IF EXISTS `invoice_items`;
DROP TABLE IF EXISTS `invoices`;

CREATE TABLE `invoices` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nomor` VARCHAR(50) NOT NULL UNIQUE,
  `deal_id` INT NOT NULL,
  `mo_id` INT DEFAULT NULL,
  `proof_id` INT DEFAULT NULL,
  `skema` VARCHAR(50) NOT NULL,
  `keterangan_termin` VARCHAR(255) DEFAULT NULL,
  `tanggal_terbit` VARCHAR(50) NOT NULL,
  `jatuh_tempo` VARCHAR(50) NOT NULL,
  `subtotal` DECIMAL(15,2) NOT NULL,
  `ppn_persen` DECIMAL(5,2) NOT NULL DEFAULT 11,
  `ppn_nominal` DECIMAL(15,2) NOT NULL,
  `pph23_dipotong` TINYINT(1) NOT NULL DEFAULT 0,
  `pph23_nominal` DECIMAL(15,2) NOT NULL DEFAULT 0,
  `meterai` DECIMAL(15,2) NOT NULL DEFAULT 0,
  `total_tagihan` DECIMAL(15,2) NOT NULL,
  `total_dibayar` DECIMAL(15,2) NOT NULL DEFAULT 0,
  `status` VARCHAR(50) NOT NULL DEFAULT 'Draft',
  `no_faktur_pajak` VARCHAR(100) DEFAULT NULL,
  `catatan_revisi` TEXT DEFAULT NULL,
  `dibuat_oleh` INT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_inv_deal` FOREIGN KEY (`deal_id`) REFERENCES `deals` (`id`),
  CONSTRAINT `fk_inv_creator` FOREIGN KEY (`dibuat_oleh`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `invoice_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `invoice_id` INT NOT NULL,
  `deal_item_id` INT DEFAULT NULL,
  `mo_id` INT DEFAULT NULL,
  `proof_id` INT DEFAULT NULL,
  `deskripsi` TEXT NOT NULL,
  `periode_tayang` VARCHAR(100) NOT NULL,
  `qty` DECIMAL(10,2) NOT NULL,
  `satuan` VARCHAR(50) NOT NULL,
  `harga_satuan` DECIMAL(15,2) NOT NULL,
  `diskon` DECIMAL(15,2) NOT NULL DEFAULT 0,
  `jumlah` DECIMAL(15,2) NOT NULL,
  CONSTRAINT `fk_ii_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `payments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `invoice_id` INT NOT NULL,
  `tanggal_bayar` VARCHAR(50) NOT NULL,
  `jumlah` DECIMAL(15,2) NOT NULL,
  `metode` VARCHAR(50) NOT NULL,
  `referensi_bank` VARCHAR(100) NOT NULL,
  `bukti_file` TEXT DEFAULT NULL,
  `dicatat_oleh` INT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_pmt_inv` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pmt_user` FOREIGN KEY (`dicatat_oleh`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 10. APPROVALS, NUMBER SEQUENCES, AUDIT LOGS, NOTIFICATIONS & SETTINGS
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `approvals`;
DROP TABLE IF EXISTS `number_sequences`;
DROP TABLE IF EXISTS `audit_logs`;
DROP TABLE IF EXISTS `notifications`;
DROP TABLE IF EXISTS `settings`;

CREATE TABLE `approvals` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `jenis_dokumen` VARCHAR(50) NOT NULL,
  `dokumen_id` INT NOT NULL,
  `nomor_dokumen` VARCHAR(50) NOT NULL,
  `ringkasan_alasan` TEXT NOT NULL,
  `diminta_oleh` INT NOT NULL,
  `target_role` VARCHAR(50) NOT NULL DEFAULT 'manager',
  `disetujui_oleh` INT DEFAULT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'Menunggu',
  `catatan_keputusan` TEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `decided_at` VARCHAR(50) DEFAULT NULL,
  CONSTRAINT `fk_appr_requester` FOREIGN KEY (`diminta_oleh`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `number_sequences` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `kode_dokumen` VARCHAR(50) NOT NULL,
  `tahun` INT NOT NULL,
  `last_seq` INT NOT NULL DEFAULT 0,
  UNIQUE KEY `uk_seq_doc_year` (`kode_dokumen`, `tahun`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `audit_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT DEFAULT NULL,
  `nama_user` VARCHAR(150) NOT NULL,
  `role_user` VARCHAR(100) NOT NULL,
  `modul` VARCHAR(100) NOT NULL,
  `aksi` VARCHAR(100) NOT NULL,
  `nomor_dokumen` VARCHAR(50) DEFAULT NULL,
  `ringkasan` TEXT NOT NULL,
  `nilai_lama` TEXT DEFAULT NULL,
  `nilai_baru` TEXT DEFAULT NULL,
  `ip_address` VARCHAR(50) NOT NULL DEFAULT '127.0.0.1',
  `waktu` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `notifications` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT DEFAULT NULL,
  `role_target` VARCHAR(100) DEFAULT NULL,
  `judul` VARCHAR(255) NOT NULL,
  `pesan` TEXT NOT NULL,
  `tautan_modul` VARCHAR(100) NOT NULL,
  `dokumen_id` INT DEFAULT NULL,
  `dibaca` TINYINT(1) NOT NULL DEFAULT 0,
  `waktu` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `settings` (
  `kunci` VARCHAR(100) PRIMARY KEY,
  `nilai` LONGTEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ------------------------------------------------------------------------------
-- 11. SEED DATA (ROLES, PERMISSIONS, SUPERADMIN, DEFAULT SETTINGS)
-- ------------------------------------------------------------------------------

-- Default 7 Roles
INSERT INTO `roles` (`id`, `kode`, `nama`, `cakupan`, `deskripsi`) VALUES
(1, 'super_admin', 'Super Admin', 'Seluruh sistem', 'Kelola pengguna dan role, pengaturan sistem, penomoran, template PDF, audit log'),
(2, 'admin', 'Admin Operasional', 'Seluruh operasional', 'Kelola master klien dan rate card, input/koreksi atas nama tim, kelola jadwal dan bukti tayang'),
(3, 'direktur', 'Direktur', 'Seluruh data (eksekutif)', 'Dashboard eksekutif, persetujuan strategis, seluruh laporan perusahaan'),
(4, 'manager', 'Manager', 'Timnya', 'Menyetujui quotation berdiskon, MO, dan verifikasi bukti tayang; memantau progres Deal tim'),
(5, 'marketing', 'Marketing', 'Kampanye yang ditangani', 'Membuat MO dan jadwal tayang, mengelola konten dan bukti tayang, memantau progres Deal'),
(6, 'sales', 'Account Executive (Sales)', 'Klien dan Quotation sendiri', 'Mengelola prospek dan klien, membuat penawaran dan negosiasi quotation, memantau invoice klien'),
(7, 'finance', 'Finance & Penagihan', 'Keuangan seluruh perusahaan', 'Menerbitkan invoice resmi, mencatat pembayaran, mengelola rekonsiliasi dan piutang');

-- Default Teams
INSERT INTO `teams` (`id`, `nama`, `manager_id`) VALUES
(1, 'Tim Media Jakarta', NULL),
(2, 'Tim Digital & Ads Surabaya', NULL);

-- Default Super Admin (Password: MediaFlow2026!)
INSERT INTO `users` (`id`, `nama`, `email`, `password_hash`, `jabatan`, `role_id`, `team_id`, `aktif`, `telepon`, `departemen`) VALUES
(1, 'Super Administrator', 'admin@mediaflow.id', '$2b$10$wE991Q3e2rA.s93Wp3Q24eK6bF8jI21F6D97yM6x4P34G4Z5J6wQ2', 'Chief Technology Officer', 1, 1, 1, '0812-8899-7700', 'Divisi Teknologi Informasi & Sistem ERP');

-- Default Catalog Categories
INSERT INTO `catalog_categories` (`nama`, `deskripsi`, `urutan`) VALUES
('Website', 'Kanal portal berita, advertorial SEO, dan banner display', 1),
('Sosial Media', 'Instagram feed, reels, story, dan TikTok creative video', 2),
('Video', 'YouTube dedicated video, podcast visual, dan brand sponsorship', 3),
('Newsletter', 'Email blast buletin korporat pagi kepada pengambil keputusan', 4),
('Podcast', 'Audio show Spotify/Apple podcast dan ad-lib sponsor', 5),
('Event', 'Aktivasi offline seminar, konferensi, dan expo bisnis', 6),
('Influencer', 'Kolaborasi Key Opinion Leader (KOL) dan content creator jaringan', 7);

-- Default Web & Security Settings
INSERT INTO `settings` (`kunci`, `nilai`) VALUES
('site_title', 'MediaFlow ERP — Quotation, Media Order, Bukti Tayang & Invoice'),
('site_tagline', 'Solusi Terpadu Penjualan, Operasional Media & Rekonsiliasi Keuangan'),
('site_description', 'Sistem manajemen operasional dan keuangan media digital terintegrasi dari Quotation, Deal, Media Order, Bukti Tayang hingga Invoice A4 Landscape dengan autentikasi JWT, RBAC 7 role, dan Audit Log.'),
('site_keywords', 'media erp, media order, quotation, bukti tayang, invoice media, rate card, iklan digital, vps erp, mariadb'),
('site_logo', ''),
('site_favicon', ''),
('seo_indexing', 'noindex'),
('turnstile_enabled', 'false'),
('turnstile_site_key', '0x4AAAAAAAx_DemoSiteKey2026'),
('turnstile_secret_key', '0x4AAAAAAAx_DemoSecretKey2026xxxxxxxxx'),
('turnstile_mode', 'managed'),
('security_session_timeout', '24h'),
('security_max_login_attempts', '5'),
('security_force_https', 'true'),
('security_password_min_length', '6'),
('maintenance_mode', 'false'),
('maintenance_message', 'Aplikasi MediaFlow ERP sedang dalam pemeliharaan berkala untuk peningkatan server VPS. Silakan hubungi Administrator atau coba beberapa saat lagi.'),
('app_footer_text', '© 2026 MediaFlow ERP. Hak Cipta Dilindungi · Siap Dijalankan di MariaDB & VPS'),
('app_timezone', 'Asia/Jakarta (WIB)'),
('app_canonical_url', 'https://pos.digdayamedia.com'),
('google_site_verification', 'google-site-verification=mf_vps_auth_token_sample_2026');

-- Notifications
INSERT INTO `notifications` (`user_id`, `role_target`, `judul`, `pesan`, `tautan_modul`, `dokumen_id`, `dibaca`) VALUES
(1, 'all', 'Sistem Siap Digunakan (MariaDB)', 'Database MediaFlow ERP telah berhasil diinisialisasi pada server MariaDB.', 'settings', NULL, 0);

COMMIT;
