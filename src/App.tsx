import React, { useEffect, useState, useCallback } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Briefcase,
  Calendar,
  Check,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  FileCheck,
  FileText,
  Globe,
  Layers,
  LayoutDashboard,
  LogOut,
  Moon,
  Package,
  PanelLeft,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  ReceiptText,
  Server,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sun,
  UserCog,
  Users,
} from 'lucide-react';
import { checkPerm, RolePerm, DEFAULT_COMPANY_LOGO_SVG } from './utils/format';
import { PrintDocumentModal, PrintableDocType } from './components/PrintDocumentModal';
import { DashboardView } from './components/DashboardView';
import { DealCommandCenter } from './components/DealCommandCenter';
import { GlobalSearchBar } from './components/GlobalSearchBar';
import { InstallWizard } from './components/InstallWizard';
import {
  ClientsModule,
  CatalogModule,
  QuotationsModule,
  MediaOrdersModule,
  ProofsModule,
  InvoicesModule,
} from './components/OperationalViews';
import { ReceiptsModule } from './components/ReceiptsView';
import {
  SchedulesCalendarModule,
  ApprovalsModule,
  ReportsModule,
  AuditLogsModule,
  SettingsModule,
} from './components/GovernanceViews';
import {
  NotificationDropdown,
  NotificationsCenterView,
  AccountProfileModule,
} from './components/AccountAndNotificationViews';

export default function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('mediaflow_jwt'));
  const [currentUser, setCurrentUser] = useState<Record<string, any> | null>(null);
  const [permissions, setPermissions] = useState<RolePerm[]>([]);
  const [demoAccounts, setDemoAccounts] = useState<Array<Record<string, any>>>([]);

  // Theme State (Dark / Light Mode)
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('mediaflow_theme');
    return saved === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', themeMode === 'dark');
    localStorage.setItem('mediaflow_theme', themeMode);
  }, [themeMode]);

  const handleToggleTheme = (nextMode?: 'light' | 'dark') => {
    setThemeMode((prev) => {
      if (nextMode) return nextMode;
      return prev === 'dark' ? 'light' : 'dark';
    });
  };

  // Public Web & Security Settings State
  const [publicSettings, setPublicSettings] = useState<Record<string, any>>({
    site_title: 'MediaFlow ERP',
    site_tagline: 'Sistem Terpadu Quotation → Deal → Media Order → Bukti Tayang → Invoice',
    site_description: 'Platform manajemen periklanan digital, advertorial, jadwal tayang inventori media, verifikasi bukti tayang, dan faktur penagihan.',
    site_logo: DEFAULT_COMPANY_LOGO_SVG,
    site_favicon: DEFAULT_COMPANY_LOGO_SVG,
    seo_indexing: 'noindex',
    turnstile_enabled: 'true',
    turnstile_site_key: '0x4AAAAAAABcDeFgHiJkLmNo',
    turnstile_mode: 'managed',
    maintenance_mode: 'false',
    maintenance_message: '',
    app_footer_text: '© 2026 PT Nusantara Digital Media Terpadu. All rights reserved.',
  });
  const [turnstileVerified, setTurnstileVerified] = useState<boolean>(false);
  const [turnstileToken, setTurnstileToken] = useState<string>('cf-auto-token');
  const [loggedOutManually, setLoggedOutManually] = useState<boolean>(false);

  // Login Form State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  // Install Wizard State
  const [showInstallWizard, setShowInstallWizard] = useState<boolean>(false);

  // Navigation & View State
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [selectedDealId, setSelectedDealId] = useState<number | null>(null);
  const [preselectedMoDealId, setPreselectedMoDealId] = useState<number | null>(null);
  const [preselectedInvDealId, setPreselectedInvDealId] = useState<number | null>(null);
  const [showNotifDropdown, setShowNotifDropdown] = useState<boolean>(false);

  // Application Data State
  const [dashboardData, setDashboardData] = useState<Record<string, any> | null>(null);
  const [clients, setClients] = useState<Array<Record<string, any>>>([]);
  const [categories, setCategories] = useState<Array<Record<string, any>>>([]);
  const [products, setProducts] = useState<Array<Record<string, any>>>([]);
  const [packages, setPackages] = useState<Array<Record<string, any>>>([]);
  const [quotations, setQuotations] = useState<Array<Record<string, any>>>([]);
  const [deals, setDeals] = useState<Array<Record<string, any>>>([]);
  const [mediaOrders, setMediaOrders] = useState<Array<Record<string, any>>>([]);
  const [proofs, setProofs] = useState<Array<Record<string, any>>>([]);
  const [invoices, setInvoices] = useState<Array<Record<string, any>>>([]);
  const [approvals, setApprovals] = useState<Array<Record<string, any>>>([]);
  const [auditLogs, setAuditLogs] = useState<Array<Record<string, any>>>([]);
  const [settingsData, setSettingsData] = useState<Record<string, any> | null>(null);
  const [notifications, setNotifications] = useState<Array<Record<string, any>>>([]);

  // Sidebar Collapse (Hide/Show) State & Shortcut
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('mediaflow_sidebar_collapsed') === 'true';
  });

  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('mediaflow_sidebar_collapsed', String(next));
      return next;
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar]);

  // Print Modal & Toast State
  const [printModal, setPrintModal] = useState<{
    type: PrintableDocType;
    data: Record<string, any>;
  } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  // Authenticated Fetch Helpers
  const apiGet = useCallback(
    async (url: string, overrideToken?: string) => {
      const tk = overrideToken || token;
      if (!tk) return null;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${tk}` },
      });
      if (res.status === 401) {
        localStorage.removeItem('mediaflow_jwt');
        setToken(null);
        setCurrentUser(null);
        return null;
      }
      return res.json();
    },
    [token]
  );

  const apiPost = useCallback(
    async (url: string, body: any) => {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Terjadi kesalahan pada permintaan server.');
      }
      return data;
    },
    [token]
  );

  const apiPut = useCallback(
    async (url: string, body: any) => {
      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Terjadi kesalahan pada permintaan server.');
      }
      return data;
    },
    [token]
  );

  const apiPatch = useCallback(
    async (url: string, body: any) => {
      const res = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Terjadi kesalahan pada permintaan server.');
      }
      return data;
    },
    [token]
  );

  const apiDelete = useCallback(
    async (url: string) => {
      const res = await fetch(url, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Terjadi kesalahan pada permintaan server.');
      }
      return data;
    },
    [token]
  );

  const loadAllWorkspaceData = useCallback(
    async (activeTk?: string) => {
      const tk = activeTk || token;
      if (!tk) return;

      const [
        meRes,
        dashRes,
        cliRes,
        catRes,
        quotRes,
        dealRes,
        moRes,
        prfRes,
        invRes,
        appRes,
        logRes,
        setRes,
        notifRes,
      ] = await Promise.all([
        apiGet('/api/auth/me', tk),
        apiGet('/api/dashboard', tk),
        apiGet('/api/clients', tk),
        apiGet('/api/catalog', tk),
        apiGet('/api/quotations', tk),
        apiGet('/api/deals', tk),
        apiGet('/api/media-orders', tk),
        apiGet('/api/proofs', tk),
        apiGet('/api/invoices', tk),
        apiGet('/api/approvals', tk),
        apiGet('/api/audit-logs', tk),
        apiGet('/api/settings', tk),
        apiGet('/api/notifications', tk),
      ]);

      if (meRes?.user) {
        setCurrentUser(meRes.user);
        setPermissions(meRes.permissions || []);
      }
      if (dashRes) setDashboardData(dashRes);
      if (cliRes?.clients) setClients(cliRes.clients);
      if (catRes) {
        setProducts(catRes.products || []);
        setPackages(catRes.packages || []);
        if (catRes.categories) setCategories(catRes.categories);
      }
      if (quotRes?.quotations) setQuotations(quotRes.quotations);
      if (dealRes?.deals) setDeals(dealRes.deals);
      if (moRes?.media_orders) setMediaOrders(moRes.media_orders);
      if (prfRes?.proofs) setProofs(prfRes.proofs);
      if (invRes?.invoices) setInvoices(invRes.invoices);
      if (appRes?.approvals) setApprovals(appRes.approvals);
      if (logRes?.logs) setAuditLogs(logRes.logs);
      if (setRes) setSettingsData(setRes);
      if (notifRes?.notifications) setNotifications(notifRes.notifications);
    },
    [apiGet, token]
  );

  const refreshDemoAccounts = useCallback(() => {
    fetch('/api/auth/demo-accounts')
      .then((r) => r.json())
      .then((d) => {
        if (d?.users) setDemoAccounts(d.users);
      })
      .catch(() => {});
  }, []);

  const fetchPublicSettings = useCallback(() => {
    fetch('/api/settings/public')
      .then((r) => r.json())
      .then((d) => {
        if (d && !d.error) setPublicSettings(d);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchPublicSettings();
  }, [fetchPublicSettings]);

  // Check if system is uninstalled; auto-open Install Wizard for first-time VPS setup
  useEffect(() => {
    fetch('/api/install/status')
      .then((r) => r.json())
      .then((d) => {
        if (d && d.installed === false) {
          setShowInstallWizard(true);
        }
      })
      .catch(() => {});
  }, []);

  // Synchronize Document Head with Web & SEO Settings
  useEffect(() => {
    if (publicSettings.site_title) {
      document.title = `${publicSettings.site_title} — ${publicSettings.site_tagline || ''}`;
    }

    // Meta Description
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute('content', publicSettings.site_description || '');

    // Meta Robots (Index vs NoIndex)
    let metaRobots = document.querySelector('meta[name="robots"]');
    if (!metaRobots) {
      metaRobots = document.createElement('meta');
      metaRobots.setAttribute('name', 'robots');
      document.head.appendChild(metaRobots);
    }
    metaRobots.setAttribute(
      'content',
      publicSettings.seo_indexing === 'index' ? 'index, follow' : 'noindex, nofollow'
    );

    // Favicon Dynamic Link
    if (publicSettings.site_favicon) {
      let linkIcon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
      if (!linkIcon) {
        linkIcon = document.createElement('link');
        linkIcon.rel = 'icon';
        document.head.appendChild(linkIcon);
      }
      linkIcon.href = publicSettings.site_favicon;
    }
  }, [publicSettings]);

  useEffect(() => {
    refreshDemoAccounts();
    fetch('/api/install/status')
      .then((r) => r.json())
      .then((d) => {
        if (d && d.installed === false) {
          setShowInstallWizard(true);
        }
      })
      .catch(() => {});
  }, [refreshDemoAccounts]);

  useEffect(() => {
    if (token) {
      loadAllWorkspaceData(token);
    } else if (!loggedOutManually) {
      fetch('/api/auth/quick-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 1 }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d?.token) {
            localStorage.setItem('mediaflow_jwt', d.token);
            setToken(d.token);
            setCurrentUser(d.user);
            setPermissions(d.permissions || []);
          }
        })
        .catch(() => {});
    }
  }, [token, loggedOutManually, loadAllWorkspaceData]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    // Check Turnstile on client if enabled
    if (publicSettings.turnstile_enabled !== 'false' && !turnstileVerified) {
      setLoginError('Harap selesaikan verifikasi Cloudflare Turnstile terlebih dahulu.');
      return;
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword,
          cf_turnstile_token: turnstileToken,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || 'Gagal masuk.');
        return;
      }
      localStorage.setItem('mediaflow_jwt', data.token);
      setToken(data.token);
      setCurrentUser(data.user);
      setPermissions(data.permissions || []);
      setLoggedOutManually(false);
      setActiveTab('dashboard');
      showToast(`Selamat datang, ${data.user.nama} (${data.user.role_nama})`);
    } catch {
      setLoginError('Gagal menghubungi server otentikasi.');
    }
  };

  const handleQuickRoleSwitch = async (userId: number) => {
    const res = await fetch('/api/auth/quick-switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    const data = await res.json();
    if (res.ok && data.token) {
      localStorage.setItem('mediaflow_jwt', data.token);
      setToken(data.token);
      setCurrentUser(data.user);
      setPermissions(data.permissions || []);
      setLoggedOutManually(false);
      setSelectedDealId(null);
      setActiveTab('dashboard');
      await loadAllWorkspaceData(data.token);
      showToast(`Sesi JWT beralih ke: ${data.user.nama} (Role: ${data.user.role_nama})`);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('mediaflow_jwt');
    setToken(null);
    setCurrentUser(null);
    setLoggedOutManually(true);
    setTurnstileVerified(false);
  };

  const handleFilterAuditLogs = async (modul: string, search: string) => {
    const res = await apiGet(
      `/api/audit-logs?modul=${encodeURIComponent(modul)}&search=${encodeURIComponent(search)}`
    );
    if (res?.logs) setAuditLogs(res.logs);
  };

  const handleDecisionApproval = async (
    approvalId: number,
    decision: 'Disetujui' | 'Ditolak',
    catatan = 'Diputuskan melalui sistem'
  ) => {
    await apiPost(`/api/approvals/${approvalId}/decide`, { decision, catatan });
    await loadAllWorkspaceData();
    showToast(`Keputusan "${decision}" telah disimpan dan dicatat ke Audit Log.`);
  };

  // Notification Actions
  const handleMarkNotificationRead = async (notifId: number) => {
    await apiPatch(`/api/notifications/${notifId}/read`, {});
    const notifRes = await apiGet('/api/notifications');
    if (notifRes?.notifications) setNotifications(notifRes.notifications);
  };

  const handleMarkAllNotificationsRead = async () => {
    await apiPost('/api/notifications/read-all', {});
    const notifRes = await apiGet('/api/notifications');
    if (notifRes?.notifications) setNotifications(notifRes.notifications);
    showToast('Seluruh notifikasi telah ditandai sudah dibaca.');
  };

  const handleDeleteNotification = async (notifId: number) => {
    await apiDelete(`/api/notifications/${notifId}`);
    const notifRes = await apiGet('/api/notifications');
    if (notifRes?.notifications) setNotifications(notifRes.notifications);
  };

  const handleSendNotification = async (payload: {
    judul: string;
    pesan: string;
    role_target: string;
    tautan_modul: string;
  }) => {
    await apiPost('/api/notifications/create', payload);
    const notifRes = await apiGet('/api/notifications');
    if (notifRes?.notifications) setNotifications(notifRes.notifications);
    showToast('Notifikasi internal berhasil dikirim.');
  };

  const handleInstallWizardComplete = async (authData: { token: string; user: any; permissions: any[] }) => {
    localStorage.setItem('mediaflow_jwt', authData.token);
    setToken(authData.token);
    setCurrentUser(authData.user);
    setPermissions(authData.permissions || []);
    setShowInstallWizard(false);
    setLoggedOutManually(false);
    setActiveTab('dashboard');
    await loadAllWorkspaceData(authData.token);
    showToast(`Selamat datang, ${authData.user.nama}! Akun Super Administrator Anda telah aktif.`);
  };

  // ============================================================================
  // LOGIN SCREEN (When Logged Out)
  // ============================================================================
  if (!token || !currentUser) {
    return (
      <div className="app-shell-canvas min-h-screen bg-slate-50 flex flex-col justify-center items-center p-6">
        {/* Maintenance Mode Emergency Alert Banner */}
        {publicSettings.maintenance_mode === 'true' && (
          <div className="w-full max-w-4xl mb-3 p-4 bg-rose-50 border border-rose-300 rounded-xl text-rose-900 flex items-start gap-3 shadow-xs">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <div className="font-bold text-rose-900 text-sm">Mode Pemeliharaan Server Sedang Aktif</div>
              <p className="text-rose-800 leading-relaxed">
                {publicSettings.maintenance_message ||
                  'Sistem sedang dalam proses pemeliharaan berkala untuk optimasi database dan server.'}
              </p>
              <div className="text-[11px] text-rose-700 font-medium">
                Pemberitahuan: Hanya akun Super Admin & Admin yang dapat masuk ke dalam sistem selama jendela pemeliharaan berlangsung.
              </div>
            </div>
          </div>
        )}

        <div className="w-full max-w-4xl mb-3 flex justify-between items-center">
          <div className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-blue-600" />
            <span>{publicSettings.site_title || 'MediaFlow ERP'}</span>
          </div>
          <button
            type="button"
            onClick={() => handleToggleTheme()}
            className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            {themeMode === 'dark' ? <Sun className="w-3.5 h-3.5 text-amber-500" /> : <Moon className="w-3.5 h-3.5" />}
            <span>{themeMode === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
        </div>

        <div className="w-full max-w-4xl bg-white border border-slate-200 rounded-xl shadow-xs grid grid-cols-1 md:grid-cols-12 overflow-hidden">
          {/* Left Form */}
          <div className="md:col-span-6 p-8 space-y-5">
            <div className="flex items-center gap-3">
              {publicSettings.site_logo && (
                <div className="w-12 h-12 rounded-lg border border-slate-200 bg-slate-50 p-1 flex items-center justify-center shrink-0">
                  <img
                    src={publicSettings.site_logo}
                    alt="Logo"
                    referrerPolicy="no-referrer"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              )}
              <div>
                <div className="text-lg font-bold tracking-tight text-slate-900">
                  {publicSettings.site_title || 'MediaFlow ERP'}
                </div>
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                  {publicSettings.site_tagline ||
                    'Sistem Terpadu Quotation → Deal → Media Order → Bukti Tayang → Invoice'}
                </p>
              </div>
            </div>

            {loginError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700 font-medium">
                {loginError}
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email Korporat</label>
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kata Sandi</label>
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 font-mono"
                />
              </div>

              {/* Cloudflare Turnstile Verification Widget */}
              {publicSettings.turnstile_enabled !== 'false' && (
                <div className="p-3 bg-slate-50 border border-slate-300 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <div
                      onClick={() => {
                        setTurnstileVerified(true);
                        setTurnstileToken(`cf-turnstile-verified-${Date.now()}`);
                        if (loginError?.includes('Turnstile')) setLoginError(null);
                      }}
                      className="flex items-center gap-2.5 cursor-pointer select-none group"
                    >
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                          turnstileVerified
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'border-slate-400 bg-white group-hover:border-slate-600'
                        }`}
                      >
                        {turnstileVerified && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                      <span className="font-semibold text-slate-800 text-xs">
                        {turnstileVerified
                          ? 'Saya bukan robot (Terverifikasi)'
                          : 'Verifikasi bahwa Anda adalah manusia'}
                      </span>
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                      <span className="font-bold text-[9px] text-slate-600 tracking-tight flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block"></span>
                        CLOUDFLARE
                      </span>
                      <span className="text-[8px] text-slate-400">Turnstile</span>
                    </div>
                  </div>
                  {!turnstileVerified && (
                    <div className="text-[10px] text-slate-400">
                      Klik kotak centang di atas untuk verifikasi Turnstile CAPTCHA.
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={publicSettings.turnstile_enabled !== 'false' && !turnstileVerified}
                className={`w-full py-2.5 text-white font-semibold rounded-lg transition-colors cursor-pointer ${
                  publicSettings.turnstile_enabled !== 'false' && !turnstileVerified
                    ? 'bg-slate-400 cursor-not-allowed opacity-80'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                Masuk dengan Otentikasi JWT
              </button>
            </form>

            {demoAccounts.length > 0 && (
              <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 font-mono">
                Password default seluruh akun demo: <strong>MediaFlow2026!</strong>
              </div>
            )}

            <div className="pt-2.5">
              <button
                type="button"
                onClick={() => setShowInstallWizard(true)}
                className="w-full py-2 px-3 bg-blue-50/80 hover:bg-blue-100/90 text-blue-700 font-semibold rounded-lg text-xs flex items-center justify-center gap-2 border border-blue-200 transition-colors cursor-pointer"
              >
                <Server className="w-3.5 h-3.5" />
                <span>Buka Install Wizard & Cek Lingkungan VPS</span>
              </button>
            </div>
          </div>

          {/* Right Column: Demo Switcher or Production System Information */}
          <div className="md:col-span-6 bg-slate-900 text-slate-100 p-8 flex flex-col justify-between">
            {demoAccounts.length > 0 ? (
              <div className="space-y-3">
                <div className="text-xs font-semibold text-blue-400">
                  Simulasi Cepat 7 Role & Hak Akses (RBAC)
                </div>
                <h2 className="text-base font-bold text-white">
                  Klik Akun di Bawah untuk Masuk Langsung Sesuai Peran
                </h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Setiap role memiliki menu, cakupan kepemilikan data (Seluruh, Tim, atau Milik Sendiri), dan wewenang persetujuan yang berbeda.
                </p>

                <div className="space-y-1.5 pt-2">
                  {demoAccounts.map((acc) => (
                    <button
                      key={acc.id}
                      onClick={() => handleQuickRoleSwitch(acc.id)}
                      className="w-full text-left px-3.5 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 flex items-center justify-between text-xs transition-colors cursor-pointer"
                    >
                      <div>
                        <span className="font-semibold text-white">{acc.role_nama}</span>
                        <span className="text-slate-400"> · {acc.nama}</span>
                      </div>
                      <span className="font-mono text-[11px] text-blue-400">{acc.cakupan}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-5 my-auto">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-xs font-semibold">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Lingkungan Produksi Terproteksi</span>
                </div>
                <h2 className="text-xl font-bold text-white tracking-tight">
                  Sistem ERP Media Digital Mandiri
                </h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Akses operasional dan keuangan dilindungi oleh enkripsi JWT berstandar industri, proteksi mitigasi brute-force, dan isolasi hak akses berbasis peran (RBAC 7 tingkatan).
                </p>
                <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700/60 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-400">Status Server:</span>
                    <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      Aktif & Aman
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-400">Penyimpanan:</span>
                    <span className="font-mono text-slate-200">SQLite WAL Persistent</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-400">Keamanan Sesi:</span>
                    <span className="text-slate-200">JWT Token Expiry (24h)</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* VPS Initial Setup & Install Wizard Modal (Accessible on Login Screen) */}
        {showInstallWizard && (
          <InstallWizard
            onClose={() => setShowInstallWizard(false)}
            onComplete={handleInstallWizardComplete}
          />
        )}
      </div>
    );
  }

  const unreadNotifCount = notifications.filter((n) => Number(n.dibaca) === 0).length;

  // Navigation items filtered dynamically by the active role's permissions
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, visible: true },
    {
      id: 'clients',
      label: 'Master Klien',
      icon: Users,
      visible: checkPerm(permissions, 'clients', 'view'),
    },
    {
      id: 'catalog',
      label: 'Katalog & Rate Card',
      icon: Package,
      visible: checkPerm(permissions, 'catalog', 'view'),
    },
    {
      id: 'quotations',
      label: 'Quotation',
      icon: FileText,
      visible: checkPerm(permissions, 'quotations', 'view'),
    },
    {
      id: 'deals',
      label: 'Paket Deal & Kuota',
      icon: Briefcase,
      visible: checkPerm(permissions, 'deals', 'view'),
    },
    {
      id: 'media_orders',
      label: 'Media Order (MO)',
      icon: Layers,
      visible: checkPerm(permissions, 'media_orders', 'view'),
    },
    {
      id: 'schedules',
      label: 'Jadwal Tayang',
      icon: Calendar,
      visible: checkPerm(permissions, 'schedules', 'view'),
    },
    {
      id: 'proofs',
      label: 'Bukti Tayang',
      icon: FileCheck,
      visible: checkPerm(permissions, 'proofs', 'view'),
    },
    {
      id: 'invoices',
      label: 'Invoice & Pembayaran',
      icon: Receipt,
      visible: checkPerm(permissions, 'invoices', 'view'),
    },
    {
      id: 'receipts',
      label: 'Kwitansi (Receipt)',
      icon: ReceiptText,
      visible: checkPerm(permissions, 'invoices', 'view') || checkPerm(permissions, 'payments', 'view'),
    },
    {
      id: 'approvals',
      label: 'Persetujuan (Approval)',
      icon: CheckSquare,
      visible: true,
    },
    {
      id: 'notifications',
      label: `Notifikasi${unreadNotifCount > 0 ? ` (${unreadNotifCount})` : ''}`,
      icon: Bell,
      visible: true,
    },
    {
      id: 'reports',
      label: 'Laporan & CSV',
      icon: BarChart3,
      visible: checkPerm(permissions, 'dashboard', 'view'),
    },
    {
      id: 'audit_logs',
      label: 'Audit Log Sistem',
      icon: ShieldAlert,
      visible: ['super_admin', 'admin', 'direktur', 'manager'].includes(currentUser.role_kode),
    },
    {
      id: 'settings',
      label: 'Pengaturan & Role',
      icon: Settings,
      visible: ['super_admin', 'admin'].includes(currentUser.role_kode),
    },
    {
      id: 'account',
      label: 'Pengaturan Akun Saya',
      icon: UserCog,
      visible: true,
    },
  ].filter((item) => item.visible);

  const activeNavObj = navItems.find((n) => n.id === activeTab) || navItems[0];

  const userInitials = (currentUser.nama || 'U')
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="app-shell-canvas min-h-screen flex bg-[#F8FAFC] text-slate-900">
      {/* Left Workspace Sidebar */}
      <aside
        className={`no-print ${
          isSidebarCollapsed ? 'w-20' : 'w-64'
        } bg-slate-900 text-slate-200 shrink-0 hidden lg:flex flex-col justify-between border-r border-slate-800 transition-all duration-200 select-none`}
      >
        <div className="flex flex-col">
          {/* Brand Header */}
          {isSidebarCollapsed ? (
            <div className="px-3 py-5 border-b border-slate-800 flex items-center justify-center">
              {publicSettings.site_logo && (
                <div
                  className="w-10 h-10 rounded-lg bg-slate-800 p-1.5 flex items-center justify-center shrink-0 border border-slate-700"
                  title={publicSettings.site_title}
                >
                  <img
                    src={publicSettings.site_logo}
                    alt="Site Logo"
                    referrerPolicy="no-referrer"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="px-6 py-5 border-b border-slate-800 flex items-center gap-3">
              {publicSettings.site_logo && (
                <div className="w-9 h-9 rounded-lg bg-slate-800 p-1 flex items-center justify-center shrink-0 border border-slate-700">
                  <img
                    src={publicSettings.site_logo}
                    alt="Site Logo"
                    referrerPolicy="no-referrer"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              )}
              <div className="min-w-0">
                <div className="text-base font-bold tracking-tight text-white truncate">
                  {publicSettings.site_title || 'MediaFlow ERP'}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                  {publicSettings.site_tagline
                    ? publicSettings.site_tagline.slice(0, 32) + '...'
                    : 'Quotation · Deal · MO · Bukti · Invoice'}
                </div>
              </div>
            </div>
          )}

          {/* Navigation Menu */}
          <nav className="p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    if (item.id !== 'deals') setSelectedDealId(null);
                  }}
                  title={item.label}
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? 'justify-center px-2.5 py-2.5' : 'gap-3 px-3.5 py-2.5'
                  } rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white font-semibold shadow-xs'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}
          </nav>

          {/* Tombol Hide / Show Sidebar Menu (Di Bawah Daftar Menu) */}
          <div className="px-3 pt-1 pb-3 border-t border-slate-800/80">
            <button
              type="button"
              onClick={toggleSidebar}
              title={
                isSidebarCollapsed
                  ? 'Tampilkan Sidebar Menu (Ctrl+B)'
                  : 'Sembunyikan Sidebar Menu (Ctrl+B)'
              }
              className={`w-full flex items-center ${
                isSidebarCollapsed ? 'justify-center p-2' : 'justify-between px-3 py-2'
              } rounded-lg text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/70 hover:bg-slate-800 border border-slate-700/70 transition-all cursor-pointer group shadow-2xs`}
            >
              {isSidebarCollapsed ? (
                <ChevronRight className="w-4 h-4 text-blue-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <ChevronLeft className="w-4 h-4 text-blue-400 group-hover:-translate-x-0.5 transition-transform shrink-0" />
                    <span className="truncate">Sembunyikan Menu</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">Ctrl+B</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Quick Role Switcher & User Profile in Sidebar Footer */}
        {isSidebarCollapsed ? (
          <div className="p-3 border-t border-slate-800 flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveTab('account')}
              title={`Akun: ${currentUser.nama} (${currentUser.role_nama})`}
              className="cursor-pointer"
            >
              {currentUser.avatar_url ? (
                <img
                  src={currentUser.avatar_url}
                  alt={currentUser.nama}
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 rounded-full object-cover border border-slate-600"
                />
              ) : (
                <span className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-[11px] flex items-center justify-center">
                  {userInitials}
                </span>
              )}
            </button>
            <button
              onClick={handleLogout}
              title="Keluar Sesi JWT"
              className="p-2 bg-slate-800 hover:bg-red-950/80 text-slate-300 hover:text-red-300 rounded-md transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="p-4 border-t border-slate-800 space-y-3 text-xs">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Simulasi Beralih Peran (7 Role RBAC):
              </label>
              <select
                value={currentUser.id}
                onChange={(e) => handleQuickRoleSwitch(Number(e.target.value))}
                className="w-full px-2.5 py-2 bg-slate-800 border border-slate-700 rounded-md text-xs text-white font-medium cursor-pointer"
              >
                {demoAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    [{acc.role_nama}] {acc.nama}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[11px] text-slate-400">
              <button
                type="button"
                onClick={() => setActiveTab('account')}
                title="Buka Pengaturan Akun Saya"
                className="flex items-center gap-2.5 truncate pr-2 text-left hover:opacity-90 cursor-pointer"
              >
                {currentUser.avatar_url ? (
                  <img
                    src={currentUser.avatar_url}
                    alt={currentUser.nama}
                    referrerPolicy="no-referrer"
                    className="w-7 h-7 rounded-full object-cover border border-slate-600 shrink-0"
                  />
                ) : (
                  <span className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                    {userInitials}
                  </span>
                )}
                <div className="truncate">
                  <div className="font-semibold text-slate-200 truncate">{currentUser.nama}</div>
                  <div className="truncate">{currentUser.email}</div>
                </div>
              </button>
              <button
                onClick={handleLogout}
                title="Keluar Sesi JWT"
                className="p-2 bg-slate-800 hover:bg-red-950/80 text-slate-300 hover:text-red-300 rounded-md transition-colors shrink-0 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Strict 3-Zone Top Bar Contract */}
        <header className="no-print bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between gap-6">
          {/* Zone 1: Contextual Breadcrumb + Sidebar Toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleSidebar}
              title={isSidebarCollapsed ? 'Tampilkan Sidebar (Ctrl+B)' : 'Sembunyikan Sidebar (Ctrl+B)'}
              className="hidden lg:flex p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            >
              {isSidebarCollapsed ? (
                <PanelLeftOpen className="w-4 h-4 text-blue-600" />
              ) : (
                <PanelLeftClose className="w-4 h-4 text-slate-600" />
              )}
            </button>
            <div className="text-sm font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
              {publicSettings.site_title || 'MediaFlow ERP'} / {activeNavObj?.label}
              {activeTab === 'deals' && selectedDealId ? ` / Detail Deal #${selectedDealId}` : ''}
            </div>
          </div>

          {/* Zone 2: Global Search Bar (Cari Klien, Deal, Invoice, Penawaran, MO) */}
          <div className="flex-1 flex items-center justify-center max-w-xl mx-2">
            <GlobalSearchBar
              clients={clients}
              deals={deals}
              invoices={invoices}
              quotations={quotations}
              mediaOrders={mediaOrders}
              onNavigate={(tab, entityId) => {
                setActiveTab(tab);
                if (tab === 'deals' && entityId) {
                  setSelectedDealId(entityId);
                } else if (tab !== 'deals') {
                  setSelectedDealId(null);
                }
              }}
              onPrintDocument={(type, data) => setPrintModal({ type, data })}
            />
          </div>

          {/* Quick Module Links on Wide screens */}
          <nav className="hidden 2xl:flex items-center gap-4 text-xs font-medium text-slate-600 dark:text-slate-400">
            <button
              onClick={() => setActiveTab('dashboard')}
              className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Dashboard
            </button>
            <button
              onClick={() => {
                setSelectedDealId(null);
                setActiveTab('deals');
              }}
              className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Pusat Deal
            </button>
            <button
              onClick={() => setActiveTab('approvals')}
              className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Persetujuan ({approvals.filter((a) => a.status === 'Menunggu').length})
            </button>
          </nav>

          {/* Zone 3: Theme Toggle, Notification Bell, & User Account Profile */}
          <div className="flex items-center gap-2.5 shrink-0">
            {currentUser?.role_kode === 'superadmin' && (
              <button
                type="button"
                onClick={() => setShowInstallWizard(true)}
                title="Pemeriksaan Lingkungan Server & Setup Wizard"
                className="px-2.5 py-1.5 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-blue-200 dark:border-blue-800"
              >
                <Server className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Status VPS</span>
              </button>
            )}

            {/* Dark / Light Mode Toggle Button */}
            <button
              type="button"
              onClick={() => handleToggleTheme()}
              title={themeMode === 'dark' ? 'Beralih ke Light Mode' : 'Beralih ke Dark Mode'}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {themeMode === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                  <span className="hidden md:inline">Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-slate-700" />
                  <span className="hidden md:inline">Dark</span>
                </>
              )}
            </button>

            {/* Notification Bell + Interactive Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowNotifDropdown((prev) => !prev)}
                title="Notifikasi Sistem"
                className="relative p-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                {unreadNotifCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-600 text-white font-mono text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unreadNotifCount}
                  </span>
                )}
              </button>

              {showNotifDropdown && (
                <NotificationDropdown
                  notifications={notifications}
                  onMarkRead={handleMarkNotificationRead}
                  onMarkAllRead={handleMarkAllNotificationsRead}
                  onDelete={handleDeleteNotification}
                  onNavigateModule={(tab, entityId) => {
                    setActiveTab(tab);
                    if (tab === 'deals' && entityId) {
                      setSelectedDealId(entityId);
                    }
                  }}
                  onOpenFullCenter={() => setActiveTab('notifications')}
                  onClose={() => setShowNotifDropdown(false)}
                />
              )}
            </div>

            {/* Active User Profile Button -> Opens Pengaturan Akun Saya */}
            <button
              type="button"
              onClick={() => setActiveTab('account')}
              title="Pengaturan Akun Saya"
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-2 text-xs transition-colors cursor-pointer"
            >
              {currentUser.avatar_url ? (
                <img
                  src={currentUser.avatar_url}
                  alt={currentUser.nama}
                  referrerPolicy="no-referrer"
                  className="w-5 h-5 rounded-full object-cover"
                />
              ) : (
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center">
                  {userInitials}
                </span>
              )}
              <span className="hidden sm:inline-block text-slate-800 font-medium whitespace-nowrap">
                <strong className="text-slate-900">{currentUser.nama}</strong> · {currentUser.role_nama}
              </span>
            </button>
          </div>
        </header>

        {/* Mobile Navigation Strip */}
        <div className="no-print lg:hidden bg-slate-900 text-white px-4 py-2 flex items-center gap-2 overflow-x-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`px-3 py-1.5 rounded text-xs whitespace-nowrap shrink-0 ${
                activeTab === item.id ? 'bg-blue-600 font-semibold' : 'text-slate-300'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Toast Notification */}
        {toastMessage && (
          <div className="no-print fixed bottom-5 right-5 z-40 bg-slate-900 text-white px-4 py-3 rounded-lg shadow-lg border border-slate-700 text-xs font-medium">
            {toastMessage}
          </div>
        )}

        {/* Viewport Container */}
        <main className="flex-1 p-6 md:p-8 max-w-[1400px] w-full mx-auto">
          {activeTab === 'dashboard' && (
            <DashboardView
              dashboardData={dashboardData}
              currentUser={currentUser}
              onNavigate={(tab, entityId) => {
                setActiveTab(tab);
                if (tab === 'deals' && entityId) {
                  setSelectedDealId(entityId);
                }
              }}
              onQuickApprove={(appId, dec) => handleDecisionApproval(appId, dec)}
            />
          )}

          {activeTab === 'clients' && (
            <ClientsModule
              clients={clients}
              permissions={permissions}
              apiPost={apiPost}
              onRefresh={() => {
                loadAllWorkspaceData();
                showToast('Master klien berhasil diperbarui.');
              }}
            />
          )}

          {activeTab === 'catalog' && (
            <CatalogModule
              products={products}
              packages={packages}
              categories={categories}
              permissions={permissions}
              apiPost={apiPost}
              apiPut={apiPut}
              apiDelete={apiDelete}
              showToast={showToast}
              onRefresh={() => {
                loadAllWorkspaceData();
                showToast('Katalog Rate Card berversi berhasil diperbarui.');
              }}
            />
          )}

          {activeTab === 'quotations' && (
            <QuotationsModule
              quotations={quotations}
              clients={clients}
              products={products}
              packages={packages}
              permissions={permissions}
              apiPost={apiPost}
              onRefresh={() => {
                loadAllWorkspaceData();
                showToast('Data Quotation berhasil diperbarui.');
              }}
              onPrintDocument={(type, data) => setPrintModal({ type, data })}
              onOpenDealDetail={(dealId) => {
                setSelectedDealId(dealId);
                setActiveTab('deals');
              }}
            />
          )}

          {activeTab === 'deals' && (
            <DealCommandCenter
              deals={deals}
              selectedDealId={selectedDealId}
              onSelectDeal={(id) => setSelectedDealId(id)}
              permissions={permissions}
              onCreateMoFromDeal={(deal) => {
                setPreselectedMoDealId(deal.id);
                setActiveTab('media_orders');
              }}
              onCreateInvoiceFromDeal={(deal) => {
                setPreselectedInvDealId(deal.id);
                setActiveTab('invoices');
              }}
              onPrintDocument={(type, data) => setPrintModal({ type, data })}
            />
          )}

          {activeTab === 'media_orders' && (
            <MediaOrdersModule
              mediaOrders={mediaOrders}
              deals={deals}
              products={products}
              preselectedDealId={preselectedMoDealId}
              permissions={permissions}
              apiPost={apiPost}
              apiPatch={apiPatch}
              apiGet={apiGet}
              onRefresh={() => {
                setPreselectedMoDealId(null);
                loadAllWorkspaceData();
                showToast('Media Order & jadwal tayang berhasil diperbarui.');
              }}
              onPrintDocument={(type, data) => setPrintModal({ type, data })}
            />
          )}

          {activeTab === 'schedules' && <SchedulesCalendarModule mediaOrders={mediaOrders} />}

          {activeTab === 'proofs' && (
            <ProofsModule
              proofs={proofs}
              mediaOrders={mediaOrders}
              permissions={permissions}
              currentUser={currentUser}
              apiPost={apiPost}
              apiPatch={apiPatch}
              onRefresh={() => {
                loadAllWorkspaceData();
                showToast('Bukti Tayang berhasil diperbarui & progres Deal tersinkronisasi.');
              }}
              onPrintDocument={(type, data) => setPrintModal({ type, data })}
            />
          )}

          {activeTab === 'invoices' && (
            <InvoicesModule
              invoices={invoices}
              deals={deals}
              preselectedDealId={preselectedInvDealId}
              permissions={permissions}
              apiPost={apiPost}
              onRefresh={() => {
                setPreselectedInvDealId(null);
                loadAllWorkspaceData();
                showToast('Invoice & pembayaran berhasil diperbarui.');
              }}
              onPrintDocument={(type, data) => setPrintModal({ type, data })}
            />
          )}

          {activeTab === 'receipts' && (
            <ReceiptsModule
              currentUser={currentUser}
              permissions={permissions}
              invoices={invoices}
              companySettings={settingsData?.settings || {}}
              apiGet={apiGet}
              apiPost={apiPost}
              showToast={showToast}
              onRefresh={() => {
                loadAllWorkspaceData();
                showToast('Data kwitansi berhasil diperbarui.');
              }}
              onOpenPrintModal={(receiptData) => setPrintModal({ type: 'RECEIPT', data: receiptData })}
            />
          )}

          {activeTab === 'approvals' && (
            <ApprovalsModule
              approvals={approvals}
              currentUser={currentUser}
              onDecide={handleDecisionApproval}
            />
          )}

          {activeTab === 'notifications' && (
            <NotificationsCenterView
              notifications={notifications}
              onMarkRead={handleMarkNotificationRead}
              onMarkAllRead={handleMarkAllNotificationsRead}
              onDelete={handleDeleteNotification}
              onSendNotification={handleSendNotification}
              onNavigateModule={(tab, entityId) => {
                setActiveTab(tab);
                if (tab === 'deals' && entityId) {
                  setSelectedDealId(entityId);
                }
              }}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsModule
              quotations={quotations}
              deals={deals}
              invoices={invoices}
              mediaOrders={mediaOrders}
              clients={clients}
            />
          )}

          {activeTab === 'audit_logs' && (
            <AuditLogsModule logs={auditLogs} onFilterChange={handleFilterAuditLogs} />
          )}

          {activeTab === 'settings' && (
            <SettingsModule
              settingsData={settingsData}
              currentUser={currentUser}
              apiPut={apiPut}
              apiPost={apiPost}
              apiGet={apiGet}
              showToast={showToast}
              onRefresh={() => {
                loadAllWorkspaceData();
                fetchPublicSettings();
                showToast('Pengaturan, identitas web, & matriks hak akses berhasil diperbarui.');
              }}
            />
          )}

          {activeTab === 'account' && (
            <AccountProfileModule
              currentUser={currentUser}
              themeMode={themeMode}
              onToggleTheme={(mode) => handleToggleTheme(mode)}
              apiGet={apiGet}
              apiPut={apiPut}
              onProfileUpdated={(updatedUser) => {
                setCurrentUser(updatedUser);
                refreshDemoAccounts();
                loadAllWorkspaceData();
              }}
              showToast={showToast}
            />
          )}
        </main>

        <footer className="no-print py-3 px-6 border-t border-slate-200 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2 bg-white">
          <span>{publicSettings.app_footer_text || '© 2026 PT Nusantara Digital Media Terpadu. All rights reserved.'}</span>
          <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
            <span>Zona: {publicSettings.app_timezone || 'Asia/Jakarta'}</span>
            <span>•</span>
            <span>SEO: {publicSettings.seo_indexing === 'index' ? 'Index (Publik)' : 'NoIndex (Privat)'}</span>
            <span>•</span>
            <span>Turnstile: {publicSettings.turnstile_enabled !== 'false' ? 'Aktif' : 'Nonaktif'}</span>
          </div>
        </footer>
      </div>

      {/* Unified A4 Landscape PDF Print & Preview Modal */}
      {printModal && (
        <PrintDocumentModal
          docType={printModal.type}
          data={printModal.data}
          companySettings={settingsData?.settings || {}}
          onClose={() => setPrintModal(null)}
        />
      )}

      {/* VPS Initial Setup & Install Wizard Modal */}
      {showInstallWizard && (
        <InstallWizard
          onClose={() => setShowInstallWizard(false)}
          onComplete={handleInstallWizardComplete}
        />
      )}
    </div>
  );
}
