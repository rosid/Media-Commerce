import React, { useState, useEffect } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  Moon,
  Send,
  ShieldCheck,
  Sun,
  Trash2,
  Upload,
  UserCheck,
  UserCog,
  X,
} from 'lucide-react';
import { formatDateTimeId } from '../utils/format';

// ============================================================================
// 1. HEADER NOTIFICATION DROPDOWN PANEL
// ============================================================================
export const NotificationDropdown: React.FC<{
  notifications: Array<Record<string, any>>;
  onMarkRead: (id: number) => Promise<void>;
  onMarkAllRead: () => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onNavigateModule: (tab: string, entityId?: number | null) => void;
  onOpenFullCenter: () => void;
  onClose: () => void;
}> = ({
  notifications,
  onMarkRead,
  onMarkAllRead,
  onDelete,
  onNavigateModule,
  onOpenFullCenter,
  onClose,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'UNREAD'>('ALL');

  const unreadCount = notifications.filter((n) => Number(n.dibaca) === 0).length;
  const displayed =
    filter === 'UNREAD'
      ? notifications.filter((n) => Number(n.dibaca) === 0)
      : notifications.slice(0, 12);

  return (
    <div className="absolute right-0 top-full mt-2 w-96 max-w-[92vw] bg-white border border-slate-200 rounded-lg shadow-xl z-50 overflow-hidden text-xs">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-blue-600" />
          <span className="font-bold text-slate-900">Notifikasi Sistem</span>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.5 bg-blue-600 text-white font-mono text-[10px] font-bold rounded">
              {unreadCount} baru
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={onMarkAllRead}
              className="text-[11px] font-semibold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Baca Semua
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="px-4 py-2 border-b border-slate-200 flex items-center justify-between bg-white">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFilter('ALL')}
            className={`px-2.5 py-1 rounded font-medium cursor-pointer ${
              filter === 'ALL' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Semua ({notifications.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('UNREAD')}
            className={`px-2.5 py-1 rounded font-medium cursor-pointer ${
              filter === 'UNREAD' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Belum Dibaca ({unreadCount})
          </button>
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto divide-y divide-slate-200">
        {displayed.length === 0 ? (
          <div className="py-10 px-4 text-center text-slate-500">
            Tidak ada notifikasi {filter === 'UNREAD' ? 'yang belum dibaca' : 'saat ini'}.
          </div>
        ) : (
          displayed.map((n) => {
            const isUnread = Number(n.dibaca) === 0;
            return (
              <div
                key={n.id}
                className={`p-3.5 flex items-start justify-between gap-3 transition-colors ${
                  isUnread ? 'bg-blue-50/40 hover:bg-blue-50/70' : 'bg-white hover:bg-slate-50'
                }`}
              >
                <div
                  onClick={async () => {
                    if (isUnread) await onMarkRead(n.id);
                    onNavigateModule(n.tautan_modul || 'dashboard', n.dokumen_id);
                    onClose();
                  }}
                  className="flex-1 cursor-pointer space-y-1"
                >
                  <div className="flex items-center gap-1.5">
                    {isUnread && <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />}
                    <span className={`text-slate-900 ${isUnread ? 'font-bold' : 'font-semibold'}`}>
                      {n.judul}
                    </span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">{n.pesan}</p>
                  <div className="text-[10px] font-mono text-slate-400">
                    {formatDateTimeId(n.waktu)} · Modul: {n.tautan_modul}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 shrink-0">
                  {isUnread && (
                    <button
                      type="button"
                      title="Tandai sudah dibaca"
                      onClick={() => onMarkRead(n.id)}
                      className="p-1 text-blue-600 hover:bg-blue-100 rounded cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    title="Hapus notifikasi"
                    onClick={() => onDelete(n.id)}
                    className="p-1 text-slate-400 hover:text-red-600 rounded cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="p-2.5 bg-slate-50 border-t border-slate-200 text-center">
        <button
          type="button"
          onClick={() => {
            onOpenFullCenter();
            onClose();
          }}
          className="w-full py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-semibold rounded cursor-pointer"
        >
          Buka Pusat Notifikasi Lengkap
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// 2. FULL NOTIFICATION CENTER VIEW
// ============================================================================
export const NotificationsCenterView: React.FC<{
  notifications: Array<Record<string, any>>;
  onMarkRead: (id: number) => Promise<void>;
  onMarkAllRead: () => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onSendNotification: (payload: {
    judul: string;
    pesan: string;
    role_target: string;
    tautan_modul: string;
  }) => Promise<void>;
  onNavigateModule: (tab: string, entityId?: number | null) => void;
}> = ({
  notifications,
  onMarkRead,
  onMarkAllRead,
  onDelete,
  onSendNotification,
  onNavigateModule,
}) => {
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNREAD' | 'READ'>('ALL');
  const [showSendForm, setShowSendForm] = useState(false);
  const [judul, setJudul] = useState('');
  const [pesan, setPesan] = useState('');
  const [roleTarget, setRoleTarget] = useState('all');
  const [tautanModul, setTautanModul] = useState('dashboard');

  const unreadCount = notifications.filter((n) => Number(n.dibaca) === 0).length;

  const filtered = notifications.filter((n) => {
    if (statusFilter === 'UNREAD') return Number(n.dibaca) === 0;
    if (statusFilter === 'READ') return Number(n.dibaca) === 1;
    return true;
  });

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!judul.trim() || !pesan.trim()) return;
    await onSendNotification({
      judul: judul.trim(),
      pesan: pesan.trim(),
      role_target: roleTarget,
      tautan_modul: tautanModul,
    });
    setJudul('');
    setPesan('');
    setShowSendForm(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Pusat Notifikasi & Pengingat Operasional
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Pantau seluruh notifikasi persetujuan diskon, jadwal tayang Media Order, verifikasi Bukti Tayang, dan jatuh tempo Invoice secara real-time.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={onMarkAllRead}
              className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5 text-blue-600" />
              Tandai Semua Dibaca ({unreadCount})
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowSendForm(!showSendForm)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            {showSendForm ? 'Tutup Form Pengumuman' : 'Kirim Notifikasi Tim'}
          </button>
        </div>
      </div>

      {showSendForm && (
        <form onSubmit={handleCreateSubmit} className="bg-white border border-slate-200 rounded-lg p-6 space-y-4 text-xs">
          <div className="font-bold text-sm text-slate-900 pb-2 border-b border-slate-200">
            Kirim Pengumuman / Pengingat Internal ke Tim
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Judul Notifikasi</label>
              <input
                type="text"
                required
                value={judul}
                onChange={(e) => setJudul(e.target.value)}
                placeholder="Contoh: Batas Upload Materi Kampanye Akhir Bulan"
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Target Penerima Role</label>
              <select
                value={roleTarget}
                onChange={(e) => setRoleTarget(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
              >
                <option value="all">Seluruh Pengguna (Semua Role)</option>
                <option value="manager">Manager</option>
                <option value="sales">Tim Sales / Account Executive</option>
                <option value="marketing">Tim Operasional / Traffic Media</option>
                <option value="finance">Tim Finance & Penagihan</option>
                <option value="direktur">Direktur</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Tautan Modul Terkait</label>
              <select
                value={tautanModul}
                onChange={(e) => setTautanModul(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
              >
                <option value="dashboard">Dashboard Utama</option>
                <option value="quotations">Quotation Penawaran</option>
                <option value="deals">Paket Deal & Kuota</option>
                <option value="media_orders">Media Order (MO)</option>
                <option value="schedules">Kalender Jadwal Tayang</option>
                <option value="proofs">Bukti Tayang</option>
                <option value="invoices">Invoice & Pembayaran</option>
                <option value="approvals">Persetujuan (Approval)</option>
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="block font-medium text-slate-700 mb-1">Isi Pesan Notifikasi</label>
              <input
                type="text"
                required
                value={pesan}
                onChange={(e) => setPesan(e.target.value)}
                placeholder="Tulis rincian informasi atau tindak lanjut yang diperlukan..."
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowSendForm(false)}
              className="px-4 py-2 border border-slate-300 rounded-md cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md cursor-pointer"
            >
              Kirim Notifikasi Sekarang
            </button>
          </div>
        </form>
      )}

      <div className="flex items-center gap-2">
        {[
          { id: 'ALL', label: `Semua Notifikasi (${notifications.length})` },
          { id: 'UNREAD', label: `Belum Dibaca (${unreadCount})` },
          { id: 'READ', label: `Sudah Dibaca (${notifications.length - unreadCount})` },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setStatusFilter(t.id as 'ALL' | 'UNREAD' | 'READ')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer ${
              statusFilter === t.id
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-200">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500">
            Tidak ada notifikasi pada kategori ini.
          </div>
        ) : (
          filtered.map((n) => {
            const isUnread = Number(n.dibaca) === 0;
            return (
              <div
                key={n.id}
                className={`p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  isUnread ? 'bg-blue-50/30' : ''
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    {isUnread && <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0" />}
                    <span className="font-bold text-sm text-slate-900">{n.judul}</span>
                    <span className="font-mono text-[11px] text-slate-500">
                      · Target: {n.role_target || 'Personal'} · {formatDateTimeId(n.waktu)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">{n.pesan}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                  <button
                    type="button"
                    onClick={async () => {
                      if (isUnread) await onMarkRead(n.id);
                      onNavigateModule(n.tautan_modul || 'dashboard', n.dokumen_id);
                    }}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded cursor-pointer"
                  >
                    Buka Modul
                  </button>
                  {isUnread && (
                    <button
                      type="button"
                      onClick={() => onMarkRead(n.id)}
                      className="px-3 py-1.5 bg-white hover:bg-slate-100 text-blue-700 border border-slate-300 text-xs font-medium rounded cursor-pointer"
                    >
                      Tandai Dibaca
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onDelete(n.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 border border-slate-200 rounded cursor-pointer"
                    title="Hapus Notifikasi"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

// ============================================================================
// 3. SELF-SERVICE USER ACCOUNT SETTINGS (Pengaturan Akun oleh Masing-Masing Pengguna)
// ============================================================================
export const AccountProfileModule: React.FC<{
  currentUser: Record<string, any>;
  themeMode: 'light' | 'dark';
  onToggleTheme: (mode: 'light' | 'dark') => void;
  apiGet: (url: string) => Promise<any>;
  apiPut: (url: string, body: any) => Promise<any>;
  onProfileUpdated: (updatedUser: Record<string, any>) => void;
  showToast: (msg: string) => void;
}> = ({
  currentUser,
  themeMode,
  onToggleTheme,
  apiGet,
  apiPut,
  onProfileUpdated,
  showToast,
}) => {
  const [nama, setNama] = useState(currentUser.nama || '');
  const [email, setEmail] = useState(currentUser.email || '');
  const [jabatan, setJabatan] = useState(currentUser.jabatan || '');
  const [telepon, setTelepon] = useState(currentUser.telepon || '0812-8899-7700');
  const [departemen, setDepartemen] = useState(
    currentUser.departemen || 'Divisi Komersial & Media Digital'
  );
  const [bio, setBio] = useState(currentUser.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatar_url || '');
  const [preferensiTema, setPreferensiTema] = useState<'light' | 'dark'>(themeMode);
  const [notifEmail, setNotifEmail] = useState<boolean>(currentUser.notif_email !== 0);
  const [notifApproval, setNotifApproval] = useState<boolean>(currentUser.notif_approval !== 0);
  const [notifJadwal, setNotifJadwal] = useState<boolean>(currentUser.notif_jadwal !== 0);
  const [notifInvoice, setNotifInvoice] = useState<boolean>(currentUser.notif_invoice !== 0);

  // Password Change State
  const [passwordLama, setPasswordLama] = useState('');
  const [passwordBaru, setPasswordBaru] = useState('');
  const [konfirmasiPassword, setKonfirmasiPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  const [recentLogs, setRecentLogs] = useState<Array<Record<string, any>>>([]);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    setNama(currentUser.nama || '');
    setEmail(currentUser.email || '');
    setJabatan(currentUser.jabatan || '');
    setTelepon(currentUser.telepon || '0812-8899-7700');
    setDepartemen(currentUser.departemen || 'Divisi Komersial & Media Digital');
    setBio(currentUser.bio || '');
    setAvatarUrl(currentUser.avatar_url || '');
    setNotifEmail(currentUser.notif_email !== 0);
    setNotifApproval(currentUser.notif_approval !== 0);
    setNotifJadwal(currentUser.notif_jadwal !== 0);
    setNotifInvoice(currentUser.notif_invoice !== 0);
  }, [currentUser]);

  useEffect(() => {
    setPreferensiTema(themeMode);
  }, [themeMode]);

  useEffect(() => {
    apiGet('/api/account/profile')
      .then((res) => {
        if (res?.recent_logs) setRecentLogs(res.recent_logs);
      })
      .catch(() => {});
  }, [apiGet, currentUser.id]);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfileError(null);
    if (!file.type.startsWith('image/')) {
      setProfileError('File foto profil harus berupa gambar (PNG, JPG, WebP, atau SVG).');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setProfileError('Ukuran foto profil maksimal 3 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAvatarUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setSavingProfile(true);
    try {
      const res = await apiPut('/api/account/profile', {
        nama,
        email,
        jabatan,
        telepon,
        departemen,
        bio,
        avatar_url: avatarUrl,
        preferensi_tema: preferensiTema,
        notif_email: notifEmail,
        notif_approval: notifApproval,
        notif_jadwal: notifJadwal,
        notif_invoice: notifInvoice,
      });
      if (res?.user) {
        onProfileUpdated(res.user);
      }
      onToggleTheme(preferensiTema);
      showToast('Profil akun dan preferensi Anda berhasil disimpan.');
    } catch (err: any) {
      setProfileError(err.message || 'Gagal memperbarui profil akun.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    if (passwordBaru.length < 6) {
      setPasswordError('Kata sandi baru minimal harus 6 karakter.');
      return;
    }
    if (passwordBaru !== konfirmasiPassword) {
      setPasswordError('Konfirmasi kata sandi baru tidak cocok.');
      return;
    }
    setSavingPassword(true);
    try {
      await apiPut('/api/account/password', {
        password_lama: passwordLama,
        password_baru: passwordBaru,
      });
      setPasswordLama('');
      setPasswordBaru('');
      setKonfirmasiPassword('');
      showToast('Kata sandi akun Anda berhasil diperbarui.');
    } catch (err: any) {
      setPasswordError(err.message || 'Gagal mengubah kata sandi.');
    } finally {
      setSavingPassword(false);
    }
  };

  const initials = (nama || 'U')
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Pengaturan Akun & Preferensi Pribadi
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Kelola identitas lengkap, alamat email login, foto profil, keamanan kata sandi, tema tampilan (Dark/Light Mode), dan preferensi notifikasi Anda.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start">
          <button
            type="button"
            onClick={() => {
              const next = themeMode === 'dark' ? 'light' : 'dark';
              setPreferensiTema(next);
              onToggleTheme(next);
            }}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg flex items-center gap-2 cursor-pointer"
          >
            {themeMode === 'dark' ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-slate-700" />}
            <span>{themeMode === 'dark' ? 'Beralih ke Light Mode' : 'Beralih ke Dark Mode'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Main Profile Form */}
        <div className="lg:col-span-8 space-y-6">
          <form onSubmit={handleSaveProfile} className="bg-white border border-slate-200 rounded-lg p-6 space-y-5 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <UserCog className="w-4 h-4 text-blue-600" />
                <h2 className="text-base font-bold text-slate-900">
                  Data Profil & Identitas Pengguna
                </h2>
              </div>
              <span className="font-mono text-[11px] text-slate-500">
                User ID: #{currentUser.id} · Role: {currentUser.role_nama}
              </span>
            </div>

            {profileError && (
              <div className="p-3 bg-red-50 border border-red-300 rounded text-red-800 font-medium">
                {profileError}
              </div>
            )}

            {/* Avatar Upload Section */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={nama}
                  referrerPolicy="no-referrer"
                  className="w-16 h-16 rounded-full object-cover border-2 border-blue-600 shrink-0 bg-white"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-blue-600 text-white font-bold text-lg flex items-center justify-center shrink-0">
                  {initials}
                </div>
              )}
              <div className="space-y-1.5 flex-1">
                <div className="font-bold text-sm text-slate-900">{nama}</div>
                <div className="text-slate-500">
                  {jabatan} · {departemen}
                </div>
                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  <label className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded flex items-center gap-1.5 cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Foto Profil</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                  </label>
                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={() => setAvatarUrl('')}
                      className="px-3 py-1.5 bg-white hover:bg-slate-100 text-red-600 border border-slate-300 font-medium rounded cursor-pointer"
                    >
                      Hapus Foto
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Alamat Email Login (JWT)</label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Jabatan / Posisi</label>
                <input
                  type="text"
                  required
                  value={jabatan}
                  onChange={(e) => setJabatan(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Nomor Telepon / WhatsApp</label>
                <input
                  type="text"
                  value={telepon}
                  onChange={(e) => setTelepon(e.target.value)}
                  placeholder="0812-xxxx-xxxx"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block font-medium text-slate-700 mb-1">Departemen / Divisi Kerja</label>
                <input
                  type="text"
                  value={departemen}
                  onChange={(e) => setDepartemen(e.target.value)}
                  placeholder="Divisi Komersial & Media Digital"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block font-medium text-slate-700 mb-1">Catatan Kerja / Bio Singkat</label>
                <input
                  type="text"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Spesialisasi akun klien, catatan delegasi tugas, atau ekstensi kantor..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-md"
                />
              </div>
            </div>

            {/* Theme & Notification Preferences inside Profile Form */}
            <div className="pt-4 border-t border-slate-200 space-y-4">
              <div className="font-bold text-slate-900">
                Preferensi Tema Tampilan & Notifikasi Personal
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                  <div className="font-semibold text-slate-800">Mode Tampilan Aplikasi</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPreferensiTema('light');
                        onToggleTheme('light');
                      }}
                      className={`py-2 px-3 rounded border font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                        preferensiTema === 'light'
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-700 border-slate-300'
                      }`}
                    >
                      <Sun className="w-3.5 h-3.5" />
                      Light Mode
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPreferensiTema('dark');
                        onToggleTheme('dark');
                      }}
                      className={`py-2 px-3 rounded border font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                        preferensiTema === 'dark'
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-700 border-slate-300'
                      }`}
                    >
                      <Moon className="w-3.5 h-3.5" />
                      Dark Mode
                    </button>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                  <div className="font-semibold text-slate-800">Kategori Notifikasi Aktif</div>
                  <div className="grid grid-cols-1 gap-1.5 text-slate-700">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifApproval}
                        onChange={(e) => setNotifApproval(e.target.checked)}
                        className="w-3.5 h-3.5"
                      />
                      <span>Notifikasi Persetujuan (Approval Diskon & MO Bonus)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifJadwal}
                        onChange={(e) => setNotifJadwal(e.target.checked)}
                        className="w-3.5 h-3.5"
                      />
                      <span>Pengingat Jadwal Tayang & Verifikasi Bukti Tayang</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifInvoice}
                        onChange={(e) => setNotifInvoice(e.target.checked)}
                        className="w-3.5 h-3.5"
                      />
                      <span>Peringatan Tagihan Invoice & Pembayaran Masuk</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifEmail}
                        onChange={(e) => setNotifEmail(e.target.checked)}
                        className="w-3.5 h-3.5"
                      />
                      <span>Kirim Ringkasan Aktivitas Harian ke Email</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={savingProfile}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md flex items-center gap-2 cursor-pointer"
              >
                <UserCheck className="w-4 h-4" />
                {savingProfile ? 'Menyimpan...' : 'Simpan Perubahan Profil & Preferensi'}
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Password Change & Account Governance Info */}
        <div className="lg:col-span-4 space-y-6">
          {/* Form Ubah Kata Sandi */}
          <form onSubmit={handleChangePassword} className="bg-white border border-slate-200 rounded-lg p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-blue-600" />
                <h2 className="text-base font-bold text-slate-900">Ubah Kata Sandi</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
              >
                {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showPass ? 'Sembunyikan' : 'Tampilkan'}</span>
              </button>
            </div>

            {passwordError && (
              <div className="p-3 bg-red-50 border border-red-300 rounded text-red-800 font-medium">
                {passwordError}
              </div>
            )}

            <div>
              <label className="block font-medium text-slate-700 mb-1">Kata Sandi Saat Ini</label>
              <input
                type={showPass ? 'text' : 'password'}
                required
                value={passwordLama}
                onChange={(e) => setPasswordLama(e.target.value)}
                placeholder="Default akun demo: MediaFlow2026!"
                className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Kata Sandi Baru (Min. 6 Karakter)</label>
              <input
                type={showPass ? 'text' : 'password'}
                required
                value={passwordBaru}
                onChange={(e) => setPasswordBaru(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Konfirmasi Kata Sandi Baru</label>
              <input
                type={showPass ? 'text' : 'password'}
                required
                value={konfirmasiPassword}
                onChange={(e) => setKonfirmasiPassword(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={savingPassword}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-md cursor-pointer"
            >
              {savingPassword ? 'Memproses...' : 'Perbarui Kata Sandi'}
            </button>
          </form>

          {/* Informasi Hak Akses Role & Sesi */}
          <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-3 text-xs">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <h3 className="font-bold text-sm text-slate-900">Informasi Peran & Keamanan</h3>
            </div>
            <div className="space-y-2 text-slate-600">
              <div className="flex justify-between">
                <span>Peran Sistem (RBAC):</span>
                <span className="font-bold text-slate-900">{currentUser.role_nama}</span>
              </div>
              <div className="flex justify-between">
                <span>Tim / Unit:</span>
                <span className="font-medium text-slate-900">{currentUser.nama_tim || 'Lintas Divisi'}</span>
              </div>
              <div className="flex justify-between">
                <span>Email Terdaftar:</span>
                <span className="font-mono text-slate-900">{currentUser.email}</span>
              </div>
              <div className="flex justify-between">
                <span>Login Terakhir:</span>
                <span className="font-mono text-slate-900">{formatDateTimeId(currentUser.last_login)}</span>
              </div>
            </div>
          </div>

          {/* Log Aktivitas Terakhir Akun Ini */}
          <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-3 text-xs">
            <div className="font-bold text-sm text-slate-900 pb-2 border-b border-slate-200">
              Riwayat Aktivitas Akun Saya
            </div>
            {recentLogs.length === 0 ? (
              <div className="text-slate-500 py-2">Belum ada riwayat aktivitas tercatat.</div>
            ) : (
              <div className="divide-y divide-slate-200 max-h-60 overflow-y-auto">
                {recentLogs.slice(0, 6).map((lg) => (
                  <div key={lg.id} className="py-2 space-y-0.5">
                    <div className="font-semibold text-slate-900">{lg.aksi}</div>
                    <div className="text-slate-600">{lg.ringkasan}</div>
                    <div className="font-mono text-[10px] text-slate-400">{formatDateTimeId(lg.waktu)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
