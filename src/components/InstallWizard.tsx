import React, { useState, useEffect, useCallback } from 'react';
import {
  Server,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Database,
  Key,
  FolderCheck,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Eye,
  EyeOff,
  UserCheck,
  Building,
  Sparkles,
  Lock,
  Terminal,
  Copy,
  Check,
  Layers,
  X,
  FileCode,
  HardDrive,
  Cpu,
} from 'lucide-react';

export interface InstallWizardProps {
  onComplete?: (userData: { token: string; user: any; permissions: any[] }) => void;
  onClose?: () => void;
  isInitialSetup?: boolean;
}

interface EnvStatus {
  node_env: string;
  node_env_is_production: boolean;
  jwt_secret_configured: boolean;
  jwt_secret_is_default: boolean;
  jwt_secret_length: number;
  db_path: string;
  db_exists: boolean;
  db_writable: boolean;
  port: number;
  node_version: string;
  platform: string;
}

interface DbInfo {
  tables_count: number;
  user_count: number;
  superadmin_count: number;
  is_empty: boolean;
}

export function InstallWizard({ onComplete, onClose, isInitialSetup = false }: InstallWizardProps) {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [rechecking, setRechecking] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Status data from server
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [envStatus, setEnvStatus] = useState<EnvStatus | null>(null);
  const [dbInfo, setDbInfo] = useState<DbInfo | null>(null);

  // Step 2: DB init options
  const [dbInitMode, setDbInitMode] = useState<'clean' | 'sample'>('clean');
  const [dbInitializing, setDbInitializing] = useState<boolean>(false);
  const [dbInitializedSuccess, setDbInitializedSuccess] = useState<boolean>(false);

  // Force reset dialog state
  const [showResetDialog, setShowResetDialog] = useState<boolean>(false);
  const [resetToken, setResetToken] = useState<string>('MediaFlowReset2026');
  const [resetWipeData, setResetWipeData] = useState<boolean>(true);
  const [resetting, setResetting] = useState<boolean>(false);
  const [resetSuccessMsg, setResetSuccessMsg] = useState<string | null>(null);

  // Step 3: Superadmin Form
  const [adminName, setAdminName] = useState('Administrator Utama');
  const [adminEmail, setAdminEmail] = useState('');
  const [companyName, setCompanyName] = useState('PT Nusantara Digital Media');
  const [adminPhone, setAdminPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [submittingAdmin, setSubmittingAdmin] = useState<boolean>(false);

  // Key generator helper state
  const [generatedKey, setGeneratedKey] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<boolean>(false);

  // Completed user payload
  const [completedAuth, setCompletedAuth] = useState<{ token: string; user: any; permissions: any[] } | null>(null);

  // Fetch installation status from backend
  const fetchInstallStatus = useCallback(async () => {
    try {
      setErrorMsg(null);
      const res = await fetch('/api/install/status');
      if (!res.ok) throw new Error('Gagal mengambil status instalasi server.');
      const data = await res.json();
      setIsInstalled(data.installed);
      setEnvStatus(data.env);
      setDbInfo(data.db_info);
      if (data.db_info?.tables_count > 0) {
        setDbInitializedSuccess(true);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Koneksi ke server gagal.');
    } finally {
      setLoading(false);
      setRechecking(false);
    }
  }, []);

  useEffect(() => {
    fetchInstallStatus();
  }, [fetchInstallStatus]);

  const handleRecheckEnv = () => {
    setRechecking(true);
    fetchInstallStatus();
  };

  const handleGenerateSecret = () => {
    const chars = '0123456789abcdef';
    let result = '';
    for (let i = 0; i < 64; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setGeneratedKey(result);
    setCopiedKey(false);
  };

  const handleCopyKey = () => {
    if (!generatedKey) return;
    navigator.clipboard.writeText(generatedKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2500);
  };

  // Step 2: Initialize Database
  const handleExecuteDbInit = async () => {
    try {
      setDbInitializing(true);
      setErrorMsg(null);
      const res = await fetch('/api/install/init-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: dbInitMode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal inisialisasi database.');
      setDbInitializedSuccess(true);
      await fetchInstallStatus();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengeksekusi inisialisasi database.');
    } finally {
      setDbInitializing(false);
    }
  };

  const handleResetInstallation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setResetting(true);
      setErrorMsg(null);
      setResetSuccessMsg(null);
      const res = await fetch('/api/install/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret_token: resetToken.trim(),
          wipe_data: resetWipeData,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mereset instalasi.');

      setResetSuccessMsg(data.message || 'Instalasi berhasil direset! Wizard sekarang aktif.');
      setShowResetDialog(false);
      setDbInitializedSuccess(false);
      setCurrentStep(1);
      await fetchInstallStatus();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengeksekusi reset instalasi.');
    } finally {
      setResetting(false);
    }
  };

  // Password strength calculation
  const getPasswordStrength = () => {
    if (!password) return 0;
    let score = 0;
    if (password.length >= 6) score += 25;
    if (password.length >= 10) score += 25;
    if (/[0-9]/.test(password)) score += 25;
    if (/[A-Z]/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 25;
    return score;
  };

  const passwordStrength = getPasswordStrength();

  // Step 3: Create Superadmin
  const handleCreateSuperadmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminName.trim() || !adminEmail.trim() || !password) {
      setErrorMsg('Semua kolom bertanda bintang (*) wajib diisi.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Konfirmasi password tidak cocok dengan password yang dimasukkan.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password minimal 6 karakter.');
      return;
    }

    try {
      setSubmittingAdmin(true);
      setErrorMsg(null);
      const res = await fetch('/api/install/create-superadmin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nama: adminName.trim(),
          email: adminEmail.trim(),
          password,
          no_telepon: adminPhone.trim(),
          perusahaan_nama: companyName.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membuat akun Superadmin.');

      setCompletedAuth({
        token: data.token,
        user: data.user,
        permissions: data.permissions || [],
      });
      setCurrentStep(4);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menyimpan akun Superadmin.');
    } finally {
      setSubmittingAdmin(false);
    }
  };

  const handleFinishAndEnter = () => {
    if (completedAuth && onComplete) {
      onComplete(completedAuth);
    } else if (onClose) {
      onClose();
    } else {
      window.location.reload();
    }
  };

  const stepsList = [
    { num: 1, title: 'Environment VPS', desc: 'NODE_ENV, JWT, DB' },
    { num: 2, title: 'Database SQLite', desc: 'Skema & Hak Akses' },
    { num: 3, title: 'Akun Superadmin', desc: 'Root Administrator' },
    { num: 4, title: 'Finalisasi', desc: 'Kunci & Mulai' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl my-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header Bar */}
        <div className="px-6 py-5 bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/20">
              <Server className="w-6 h-6 text-blue-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-white">
                  MediaFlow Setup & Install Wizard
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  VPS Ready
                </span>
              </div>
              <p className="text-xs text-blue-100/80">
                Panduan inisialisasi lingkungan mandiri untuk server Ubuntu / Debian
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isInitialSetup && onClose && (
              <button
                onClick={onClose}
                className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
                title="Tutup Wizard"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Step Indicator Bar */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
          <div className="grid grid-cols-4 gap-2">
            {stepsList.map((st) => {
              const isActive = currentStep === st.num;
              const isPast = currentStep > st.num;
              return (
                <div
                  key={st.num}
                  className={`flex items-center gap-3 p-2.5 rounded-xl transition-all ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/80 shadow-xs'
                      : isPast
                      ? 'bg-emerald-50/50 dark:bg-emerald-950/20 text-slate-700 dark:text-slate-300'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                        : isPast
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {isPast ? <Check className="w-4 h-4" /> : st.num}
                  </div>
                  <div className="min-w-0">
                    <p
                      className={`text-xs font-semibold truncate ${
                        isActive
                          ? 'text-blue-900 dark:text-blue-200'
                          : isPast
                          ? 'text-emerald-900 dark:text-emerald-200'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {st.title}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate hidden sm:block">
                      {st.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Error Alert Banner */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl flex items-start gap-3 text-rose-800 dark:text-rose-200 text-xs">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold">Perhatian: </span>
              {errorMsg}
            </div>
            <button
              onClick={() => setErrorMsg(null)}
              className="text-rose-600 hover:text-rose-800 font-bold"
            >
              ×
            </button>
          </div>
        )}

        {/* Success Alert Banner (e.g. after reset) */}
        {resetSuccessMsg && (
          <div className="mx-6 mt-4 p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-start gap-3 text-emerald-800 dark:text-emerald-200 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold">Sukses: </span>
              {resetSuccessMsg}
            </div>
            <button
              onClick={() => setResetSuccessMsg(null)}
              className="text-emerald-600 hover:text-emerald-800 font-bold"
            >
              ×
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto max-h-[65vh]">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
              <p className="text-sm font-medium">Memeriksa status lingkungan VPS...</p>
            </div>
          ) : (
            <>
              {/* Installation Locked Notice Banner */}
              {isInstalled && (
                <div className="mb-6 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-amber-100 dark:bg-amber-900/60 rounded-xl text-amber-700 dark:text-amber-300">
                      <Lock className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-amber-900 dark:text-amber-200 text-sm">
                        Sistem MediaFlow ERP Telah Terinstall & Terkunci
                      </p>
                      <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                        Pembuatan Super Administrator baru dikunci demi keamanan produksi. Anda dapat mereset kunci instalasi jika ingin mengonfigurasi ulang atau membersihkan data demo.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowResetDialog(true)}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl text-xs shrink-0 transition-colors shadow-xs"
                  >
                    Reset Kunci Instalasi...
                  </button>
                </div>
              )}

              {/* ================= STEP 1: ENVIRONMENT & VPS HEALTH ================= */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                        1. Pengecekan Environment Variables (VPS Health Check)
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Memverifikasi variabel sistem krusial pada file <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-blue-600 dark:text-blue-400">.env</code> server Anda.
                      </p>
                    </div>

                    <button
                      onClick={handleRecheckEnv}
                      disabled={rechecking}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2 transition-colors disabled:opacity-60"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${rechecking ? 'animate-spin' : ''}`} />
                      {rechecking ? 'Memeriksa...' : 'Periksa Ulang'}
                    </button>
                  </div>

                  {/* Diagnostic Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Card 1: NODE_ENV */}
                    <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-semibold text-xs">
                          <Cpu className="w-4 h-4 text-blue-600" />
                          <span>NODE_ENV</span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            envStatus?.node_env_is_production
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          }`}
                        >
                          {envStatus?.node_env || 'development'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {envStatus?.node_env_is_production
                          ? 'Mode produksi aktif. Aset statis Vite disajikan dengan performa optimal.'
                          : 'Mode pengembangan (development). Pada VPS operasional langsung, atur NODE_ENV="production" di file .env.'}
                      </p>
                    </div>

                    {/* Card 2: JWT_SECRET */}
                    <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-semibold text-xs">
                          <Key className="w-4 h-4 text-indigo-600" />
                          <span>JWT_SECRET</span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            !envStatus?.jwt_secret_is_default
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          }`}
                        >
                          {!envStatus?.jwt_secret_is_default ? 'Kustom & Aman' : 'Kunci Bawaan'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {!envStatus?.jwt_secret_is_default
                          ? `Kunci enkripsi token aktif (${envStatus?.jwt_secret_length || 0} karakter).`
                          : 'Masih menggunakan kunci standar contoh. Sangat disarankan menghasilkan kunci acak di bawah.'}
                      </p>
                    </div>

                    {/* Card 3: DB_PATH & SQLite */}
                    <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-semibold text-xs">
                          <HardDrive className="w-4 h-4 text-emerald-600" />
                          <span>DB_PATH (SQLite)</span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            envStatus?.db_writable
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          }`}
                        >
                          {envStatus?.db_writable ? 'Izin Tulis OK' : 'Izin Tulis Ditolak'}
                        </span>
                      </div>
                      <p className="text-[11px] font-mono text-slate-600 dark:text-slate-300 truncate">
                        {envStatus?.db_path || './mediaflow.db'}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Mode SQLite WAL aktif. File database dapat dibaca dan ditulis oleh proses Node.js.
                      </p>
                    </div>

                    {/* Card 4: Port & Engine */}
                    <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-semibold text-xs">
                          <Terminal className="w-4 h-4 text-purple-600" />
                          <span>Port & Node Runtime</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                          Port {envStatus?.port || 3000}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Node.js <span className="font-semibold text-slate-700 dark:text-slate-300">{envStatus?.node_version}</span> ({envStatus?.platform}). Siap dialihkan oleh Nginx Reverse Proxy.
                      </p>
                    </div>
                  </div>

                  {/* Helper: Secret Key Generator for VPS */}
                  <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 text-xs font-bold text-indigo-950 dark:text-indigo-200">
                          <ShieldCheck className="w-4 h-4 text-indigo-600" />
                          <span>Alat Bantu Generator Kunci JWT 32-Byte Hex</span>
                        </div>
                        <p className="text-[11px] text-indigo-800/80 dark:text-indigo-300/80 mt-0.5">
                          Klik untuk menghasilkan kunci rahasia acak super kuat yang dapat Anda tempel ke file <code className="font-mono bg-white/60 dark:bg-slate-800 px-1 py-0.5 rounded">.env</code> di VPS.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleGenerateSecret}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shrink-0 transition-colors shadow-xs"
                      >
                        Hasilkan Kunci Acak
                      </button>
                    </div>

                    {generatedKey && (
                      <div className="mt-3 flex items-center gap-2 p-2 bg-white dark:bg-slate-900 rounded-xl border border-indigo-200 dark:border-indigo-800">
                        <code className="text-xs font-mono text-indigo-900 dark:text-indigo-200 flex-1 truncate select-all px-2">
                          JWT_SECRET="{generatedKey}"
                        </code>
                        <button
                          type="button"
                          onClick={handleCopyKey}
                          className="px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg flex items-center gap-1.5 transition-colors"
                        >
                          {copiedKey ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Tersalin</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Salin</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Bottom Navigation */}
                  <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div className="text-xs text-slate-400">
                      Langkah 1 dari 4
                    </div>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(2)}
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition-all shadow-md shadow-blue-500/20"
                    >
                      <span>Lanjut: Inisialisasi Database</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* ================= STEP 2: DATABASE INITIALIZATION ================= */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      2. Inisialisasi Database SQLite
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Membuat tabel struktur sistem, pengaturan kop surat, matriks otorisasi 7 role, dan opsi data awal.
                    </p>
                  </div>

                  {/* Database Status Banner */}
                  <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-blue-100 dark:bg-blue-950/80 rounded-xl text-blue-600">
                        <Database className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          Status Database Saat Ini
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {dbInfo && dbInfo.tables_count > 0
                            ? `${dbInfo.tables_count} tabel terdeteksi, ${dbInfo.user_count} akun terdaftar.`
                            : 'Database kosong (belum ada tabel terpasang).'}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        dbInitializedSuccess || (dbInfo && dbInfo.tables_count > 0)
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      }`}
                    >
                      {dbInitializedSuccess || (dbInfo && dbInfo.tables_count > 0)
                        ? 'Tabel Siap'
                        : 'Perlu Inisialisasi'}
                    </span>
                  </div>

                  {/* Mode Selection */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div
                      onClick={() => setDbInitMode('clean')}
                      className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                        dbInitMode === 'clean'
                          ? 'border-blue-600 bg-blue-50/30 dark:bg-blue-950/30 shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                          <Layers className="w-4 h-4 text-blue-600" />
                          Database Bersih (Clean Production)
                        </span>
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            dbInitMode === 'clean'
                              ? 'border-blue-600 bg-blue-600 text-white'
                              : 'border-slate-300 dark:border-slate-600'
                          }`}
                        >
                          {dbInitMode === 'clean' && <Check className="w-3 h-3" />}
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        Hanya membuat skema tabel, 7 role & hak akses modul, serta pengaturan default sistem. Siap langsung dipakai operasional tanpa transaksi tiruan.
                      </p>
                    </div>

                    <div
                      onClick={() => setDbInitMode('sample')}
                      className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                        dbInitMode === 'sample'
                          ? 'border-blue-600 bg-blue-50/30 dark:bg-blue-950/30 shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-amber-500" />
                          Sertakan Data Sampel (Demo Data)
                        </span>
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            dbInitMode === 'sample'
                              ? 'border-blue-600 bg-blue-600 text-white'
                              : 'border-slate-300 dark:border-slate-600'
                          }`}
                        >
                          {dbInitMode === 'sample' && <Check className="w-3 h-3" />}
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        Menyertakan contoh katalog produk iklan (Artikel, Banner, Social Media), contoh format kop, dan alur simulasi lengkap untuk pengenalan tim.
                      </p>
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {dbInitializedSuccess
                          ? 'Skema tabel SQLite sudah aktif dan terverifikasi.'
                          : 'Klik tombol di samping untuk mengeksekusi inisialisasi tabel:'}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Memeriksa 25+ tabel: roles, users, quotations, deals, media_orders, proofs, invoices, dll.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleExecuteDbInit}
                      disabled={dbInitializing}
                      className="px-4 py-2 bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition-colors disabled:opacity-60 shadow-xs"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${dbInitializing ? 'animate-spin' : ''}`} />
                      {dbInitializing ? 'Menginisialisasi...' : 'Inisialisasi Tabel SQLite'}
                    </button>
                  </div>

                  {/* Checklist Summary */}
                  {dbInitializedSuccess && (
                    <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/80 rounded-xl flex items-center gap-3 text-emerald-800 dark:text-emerald-200 text-xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        Struktur database SQLite siap digunakan! Seluruh tabel dan permission matriks telah berhasil diverifikasi.
                      </span>
                    </div>
                  )}

                  {/* Bottom Navigation */}
                  <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl flex items-center gap-2 transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Kembali</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCurrentStep(3)}
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition-all shadow-md shadow-blue-500/20"
                    >
                      <span>Lanjut: Buat Akun Superadmin</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* ================= STEP 3: SUPERADMIN CREATION ================= */}
              {currentStep === 3 && (
                <form onSubmit={handleCreateSuperadmin} className="space-y-6">
                  <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      3. Pembuatan Akun Super Administrator Pertama
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Akun ini memiliki hak akses tertinggi (Super Admin) untuk mengelola master data, persetujuan, dan konfigurasi server.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Full Name */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Nama Lengkap Superadmin <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={adminName}
                        onChange={(e) => setAdminName(e.target.value)}
                        placeholder="Contoh: Rosidin Wijaya"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      />
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Email Resmi Login <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        placeholder="admin@perusahaanmedia.id"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      />
                    </div>

                    {/* Company Name */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Nama Perusahaan Media
                      </label>
                      <input
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="PT Nusantara Digital Media"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      />
                    </div>

                    {/* Phone Number */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Nomor WhatsApp / Kontak
                      </label>
                      <input
                        type="text"
                        value={adminPhone}
                        onChange={(e) => setAdminPhone(e.target.value)}
                        placeholder="081234567890"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      />
                    </div>

                    {/* Password */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Password Baru <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Minimal 6 karakter"
                          className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>

                      {/* Strength Bar */}
                      {password && (
                        <div className="mt-2 space-y-1">
                          <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ${
                                passwordStrength <= 25
                                  ? 'bg-rose-500 w-1/4'
                                  : passwordStrength <= 50
                                  ? 'bg-amber-500 w-2/4'
                                  : passwordStrength <= 75
                                  ? 'bg-blue-500 w-3/4'
                                  : 'bg-emerald-500 w-full'
                              }`}
                            />
                          </div>
                          <p className="text-[10px] text-slate-400">
                            Kekuatan Sandi:{' '}
                            <span className="font-semibold text-slate-600 dark:text-slate-300">
                              {passwordStrength <= 25
                                ? 'Sangat Lemah'
                                : passwordStrength <= 50
                                ? 'Cukup'
                                : passwordStrength <= 75
                                ? 'Kuat'
                                : 'Sangat Kuat'}
                            </span>
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Confirm Password */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Konfirmasi Password Baru <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Ulangi password di samping"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  {/* Security Note */}
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>
                      Password Anda dienkripsi secara irreversibel menggunakan algoritma hashing bcrypt standar industri.
                    </span>
                  </div>

                  {/* Bottom Navigation */}
                  <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(2)}
                      className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl flex items-center gap-2 transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Kembali</span>
                    </button>

                    <button
                      type="submit"
                      disabled={submittingAdmin}
                      className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all shadow-md shadow-emerald-500/20 disabled:opacity-60"
                    >
                      {submittingAdmin ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Mendaftarkan...</span>
                        </>
                      ) : (
                        <>
                          <UserCheck className="w-4 h-4" />
                          <span>Buat Akun & Selesaikan Setup</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* ================= STEP 4: FINALIZATION ================= */}
              {currentStep === 4 && (
                <div className="space-y-6 text-center py-4">
                  <div className="w-16 h-16 mx-auto bg-emerald-100 dark:bg-emerald-950/80 rounded-full flex items-center justify-center text-emerald-600 shadow-lg shadow-emerald-500/20">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>

                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                      Instalasi MediaFlow ERP Selesai!
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
                      Sistem telah berhasil diinisialisasi di VPS Anda. Kredensial Super Administrator telah aktif dan file pengunci telah diterapkan.
                    </p>
                  </div>

                  {/* Summary Box */}
                  <div className="max-w-md mx-auto p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-left space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-slate-400">Akun Superadmin:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {completedAuth?.user?.nama || adminName}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-slate-400">Email Login:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                        {completedAuth?.user?.email || adminEmail}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-slate-400">Perusahaan:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {companyName}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-400">Status Keamanan:</span>
                      <span className="font-semibold text-emerald-600 flex items-center gap-1">
                        <Lock className="w-3.5 h-3.5" />
                        Terkunci & Aman
                      </span>
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleFinishAndEnter}
                      className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-2xl shadow-lg shadow-blue-500/25 transition-all inline-flex items-center gap-2"
                    >
                      <span>Masuk ke Dashboard MediaFlow</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Force Reset Modal Dialog */}
        {showResetDialog && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5 text-slate-900 dark:text-slate-100 font-bold text-sm">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  <span>Reset Status Instalasi MediaFlow</span>
                </div>
                <button
                  onClick={() => setShowResetDialog(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleResetInstallation} className="space-y-4 text-xs">
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  Tindakan ini akan membuka kunci status instalasi sehingga Anda dapat menjalankan kembali wizard konfigurasi awal di browser ini.
                </p>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Token Rahasia Reset (Secret Token)
                  </label>
                  <input
                    type="password"
                    required
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    placeholder="Masukkan MediaFlowReset2026 atau JWT_SECRET"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Default token bawaan: <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-amber-600">MediaFlowReset2026</code> atau kunci JWT_SECRET di .env.
                  </p>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={resetWipeData}
                      onChange={(e) => setResetWipeData(e.target.checked)}
                      className="rounded text-amber-600 focus:ring-amber-500"
                    />
                    <span>Bersihkan seluruh data transaksi & dummy ke database murni (Clean Mode)</span>
                  </label>
                  <p className="text-[10px] text-slate-400 pl-5">
                    Jika dicentang, tabel transaksi dan akun contoh dihapus bersih, menyisakan 7 role dan permission dasar siap produksi.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowResetDialog(false)}
                    className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-semibold transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={resetting || !resetToken.trim()}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition-colors disabled:opacity-60 flex items-center gap-1.5 shadow-sm"
                  >
                    {resetting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Mereset...</span>
                      </>
                    ) : (
                      <span>Konfirmasi Reset</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
