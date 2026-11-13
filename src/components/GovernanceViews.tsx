import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Briefcase,
  Building2,
  Calendar,
  CalendarRange,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Cpu,
  Database,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileDigit,
  FileSignature,
  FileSpreadsheet,
  FileText,
  Filter,
  Globe,
  HardDrive,
  Hash,
  Image,
  Info,
  KeyRound,
  Layers,
  Lock,
  PieChart,
  Plus,
  Radio,
  Receipt,
  RefreshCw,
  Save,
  Search,
  Server,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Trash2,
  TrendingUp,
  Upload,
  UserPlus,
  X,
} from 'lucide-react';
import {
  formatRupiah,
  formatDateId,
  exportToCsv,
  getStatusSemanticColor,
  DEFAULT_COMPANY_LOGO_SVG,
  DEFAULT_PDF_SIGNATURES,
  parsePdfSignaturesConfig,
  PdfDocKey,
  PdfSignatureMap,
  PdfSignatorySlot,
} from '../utils/format';

// ============================================================================
// 1. KALENDER & TABEL JADWAL TAYANG LINTAS KAMPANYE
// ============================================================================
export const SchedulesCalendarModule: React.FC<{
  mediaOrders: Array<Record<string, any>>;
}> = ({ mediaOrders }) => {
  const [platformFilter, setPlatformFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const allItems = mediaOrders.flatMap((mo) =>
    (mo.items || []).map((it: any) => ({
      ...it,
      nomor_mo: mo.nomor,
      nama_kampanye: mo.nama_kampanye,
      snapshot_nama_klien: mo.snapshot_nama_klien,
      jenis_mo: mo.jenis,
    }))
  );

  const platforms = Array.from(new Set(allItems.map((i) => i.platform)));

  const filtered = allItems.filter((it) => {
    if (platformFilter !== 'ALL' && it.platform !== platformFilter) return false;
    if (statusFilter !== 'ALL' && it.status !== statusFilter) return false;
    return true;
  });

  // Check if any two items share the same date and slot
  const slotCounts: Record<string, number> = {};
  for (const it of allItems) {
    if (it.status === 'Batal') continue;
    const key = `${it.tanggal_tayang}__${String(it.slot_jam).toLowerCase()}`;
    slotCounts[key] = (slotCounts[key] || 0) + 1;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Kalender & Jadwal Tayang Inventori Media
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Memantau seluruh slot penayangan dari semua Media Order aktif beserta pendeteksi bentrok slot inventori.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
          >
            <option value="ALL">Semua Platform</option>
            {platforms.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
          >
            <option value="ALL">Semua Status Tayang</option>
            {['Terjadwal', 'Dalam Produksi', 'Siap Tayang', 'Tayang', 'Tayang Terverifikasi', 'Ditunda', 'Batal'].map(
              (s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              )
            )}
          </select>
          <button
            onClick={() => exportToCsv('jadwal_tayang_mediaflow.csv', filtered)}
            className="px-3.5 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Ekspor CSV Jadwal
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <th className="py-3 px-4 text-left">Tanggal Tayang & Slot</th>
              <th className="py-3 px-4 text-left">Platform & Produk</th>
              <th className="py-3 px-4 text-left">Judul / Topik Konten</th>
              <th className="py-3 px-4 text-left">Klien & Nomor MO</th>
              <th className="py-3 px-4 text-left">PIC Konten</th>
              <th className="py-3 px-4 text-right font-mono">Qty</th>
              <th className="py-3 px-4 text-left">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filtered.map((it) => {
              const conflictKey = `${it.tanggal_tayang}__${String(it.slot_jam).toLowerCase()}`;
              const isConflict = (slotCounts[conflictKey] || 0) > 1 && it.status !== 'Batal';
              return (
                <tr key={it.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4 font-mono">
                    <div className="font-bold text-slate-900">{formatDateId(it.tanggal_tayang)}</div>
                    <div className="text-[11px] text-slate-500">{it.slot_jam}</div>
                    {isConflict && (
                      <div className="text-[11px] text-red-600 font-semibold mt-0.5">
                        ! Bentrok Slot Inventori
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-900">{it.platform}</div>
                    <div className="text-slate-500">{it.nama_item}</div>
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-900">{it.judul_topik}</td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-900">{it.snapshot_nama_klien}</div>
                    <div className="font-mono text-[11px] text-blue-700">{it.nomor_mo}</div>
                  </td>
                  <td className="py-3 px-4 text-slate-700">{it.pic_konten}</td>
                  <td className="py-3 px-4 text-right font-mono font-semibold">
                    {it.qty} {it.satuan}
                  </td>
                  <td className="py-3 px-4">
                    <span className={getStatusSemanticColor(it.status)}>{it.status}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ============================================================================
// 2. PUSAT PERSETUJUAN (APPROVAL CENTER - Manager & Direktur)
// ============================================================================
export const ApprovalsModule: React.FC<{
  approvals: Array<Record<string, any>>;
  currentUser: Record<string, any>;
  onDecide: (approvalId: number, decision: 'Disetujui' | 'Ditolak', catatan: string) => Promise<void>;
}> = ({ approvals, currentUser, onDecide }) => {
  const [notes, setNotes] = useState<Record<number, string>>({});
  const canDecide = ['manager', 'direktur', 'super_admin'].includes(currentUser.role_kode);

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-slate-200">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Pusat Persetujuan Manajemen (Quotation Diskon, MO & Bukti Tayang)
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Sesuai kebijakan perusahaan, setiap Quotation berdiskon dan Media Order baru memerlukan otorisasi Manager sebelum aktif.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <th className="py-3 px-4 text-left">Dokumen & Jenis</th>
              <th className="py-3 px-4 text-left">Ringkasan Pengajuan</th>
              <th className="py-3 px-4 text-left">Pemohon</th>
              <th className="py-3 px-4 text-left">Status & Penyetuju</th>
              <th className="py-3 px-4 text-right">Keputusan Otorisasi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {approvals.map((a) => (
              <tr key={a.id} className="hover:bg-slate-50/70">
                <td className="py-3.5 px-4 font-mono">
                  <div className="font-bold text-blue-700">{a.nomor_dokumen}</div>
                  <div className="font-sans text-slate-500">{a.jenis_dokumen}</div>
                </td>
                <td className="py-3.5 px-4 text-slate-800 max-w-md">{a.ringkasan_alasan}</td>
                <td className="py-3.5 px-4">
                  <div className="font-semibold text-slate-900">{a.pemohon_nama}</div>
                  <div className="text-slate-500">{a.pemohon_jabatan}</div>
                </td>
                <td className="py-3.5 px-4">
                  <div className={getStatusSemanticColor(a.status)}>{a.status}</div>
                  {a.penyetuju_nama && (
                    <div className="text-[11px] text-slate-500">Oleh: {a.penyetuju_nama}</div>
                  )}
                </td>
                <td className="py-3.5 px-4 text-right">
                  {a.status === 'Menunggu' && canDecide ? (
                    <div className="flex items-center justify-end gap-2">
                      <input
                        type="text"
                        placeholder="Catatan keputusan..."
                        value={notes[a.id] || ''}
                        onChange={(e) => setNotes({ ...notes, [a.id]: e.target.value })}
                        className="px-2.5 py-1 border border-slate-300 rounded text-xs w-40"
                      />
                      <button
                        onClick={() => onDecide(a.id, 'Disetujui', notes[a.id] || 'Disetujui sesuai wewenang Manager')}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded cursor-pointer"
                      >
                        Setujui
                      </button>
                      <button
                        onClick={() => onDecide(a.id, 'Ditolak', notes[a.id] || 'Revisi kembali penawaran')}
                        className="px-3 py-1.5 bg-white hover:bg-red-50 text-red-700 border border-red-200 font-semibold rounded cursor-pointer"
                      >
                        Tolak
                      </button>
                    </div>
                  ) : (
                    <span className="text-slate-400 font-mono">{a.decided_at || 'Menunggu Manager'}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ============================================================================
// 3. LAPORAN EKSEKUTIF, PIUTANG & EKSPOR CSV
// ============================================================================
export const ReportsModule: React.FC<{
  quotations: Array<Record<string, any>>;
  deals: Array<Record<string, any>>;
  invoices: Array<Record<string, any>>;
  mediaOrders?: Array<Record<string, any>>;
  clients?: Array<Record<string, any>>;
}> = ({ quotations, deals, invoices, mediaOrders = [], clients = [] }) => {
  // Date Filter State
  const [dateFilter, setDateFilter] = useState<'hari' | 'pekan' | 'bulan' | 'semua' | 'custom'>('bulan');
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [activeChartSection, setActiveChartSection] = useState<'semua' | 'quotation' | 'mo' | 'invoice' | 'klien'>('semua');

  // Helper date checker
  const isDateInRange = (item: Record<string, any>): boolean => {
    if (dateFilter === 'semua') return true;

    const rawDate =
      item.tanggal_terbit ||
      item.periode_mulai ||
      item.mulai_kontrak ||
      item.tanggal_order ||
      item.created_at ||
      '';

    if (!rawDate) return true;
    const dateStr = rawDate.slice(0, 10);
    const itemDate = new Date(dateStr);
    if (isNaN(itemDate.getTime())) return true;

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    if (dateFilter === 'hari') {
      return dateStr === todayStr;
    }

    if (dateFilter === 'pekan') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return itemDate >= sevenDaysAgo && itemDate <= now;
    }

    if (dateFilter === 'bulan') {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return itemDate >= thirtyDaysAgo && itemDate <= now;
    }

    if (dateFilter === 'custom') {
      if (customStartDate && dateStr < customStartDate) return false;
      if (customEndDate && dateStr > customEndDate) return false;
      return true;
    }

    return true;
  };

  // Filtered Datasets based on Date Filter
  const filteredQuotations = quotations.filter(isDateInRange);
  const filteredDeals = deals.filter(isDateInRange);
  const filteredInvoices = invoices.filter(isDateInRange);
  const filteredMOs = mediaOrders.filter(isDateInRange);

  // 1. Quotation Metrics
  const totalQuotationsCount = filteredQuotations.length;
  const totalQuotationsVal = filteredQuotations.reduce(
    (acc, q) => acc + Number(q.active_version?.grand_total || 0),
    0
  );
  const quotDeal = filteredQuotations.filter((q) => q.status === 'DEAL');
  const quotApproved = filteredQuotations.filter((q) => q.status === 'Disetujui');
  const quotPending = filteredQuotations.filter((q) => q.status === 'Menunggu Persetujuan');
  const quotDraft = filteredQuotations.filter((q) => q.status === 'Draft');
  const quotLost = filteredQuotations.filter((q) => q.status === 'LOST');

  const quotDealVal = quotDeal.reduce((acc, q) => acc + Number(q.active_version?.grand_total || 0), 0);
  const quotPendingVal = quotPending.reduce((acc, q) => acc + Number(q.active_version?.grand_total || 0), 0);
  const quotApprovedVal = quotApproved.reduce((acc, q) => acc + Number(q.active_version?.grand_total || 0), 0);
  const quotDraftVal = quotDraft.reduce((acc, q) => acc + Number(q.active_version?.grand_total || 0), 0);
  const quotLostVal = quotLost.reduce((acc, q) => acc + Number(q.active_version?.grand_total || 0), 0);

  const winRate = totalQuotationsCount > 0 ? Math.round((quotDeal.length / totalQuotationsCount) * 100) : 0;
  const avgQuotVal = totalQuotationsCount > 0 ? Math.round(totalQuotationsVal / totalQuotationsCount) : 0;

  // 2. Media Order (MO) Metrics
  const totalMOsCount = filteredMOs.length;
  const moSelesai = filteredMOs.filter((m) => m.status === 'Selesai' || m.status === 'Selesai Tayang');
  const moTayang = filteredMOs.filter((m) => m.status === 'Tayang' || m.status === 'Sedang Tayang');
  const moTerjadwal = filteredMOs.filter((m) => m.status === 'Terjadwal' || m.status === 'Disetujui');
  const moDraft = filteredMOs.filter((m) => m.status === 'Draft' || m.status === 'Menunggu');

  // Platform Distribution
  const platformCounts: Record<string, number> = {};
  filteredMOs.forEach((mo) => {
    (mo.items || []).forEach((it: any) => {
      const plat = it.platform || it.kategori || 'Website';
      platformCounts[plat] = (platformCounts[plat] || 0) + Number(it.qty || 1);
    });
    if (!mo.items || mo.items.length === 0) {
      const plat = mo.jenis === 'barter' ? 'Sosial Media' : 'Website';
      platformCounts[plat] = (platformCounts[plat] || 0) + 1;
    }
  });

  const totalPlatformItems = Object.values(platformCounts).reduce((a, b) => a + b, 0) || 1;
  const sortedPlatforms = Object.entries(platformCounts).sort((a, b) => b[1] - a[1]);

  // 3. Invoice & Keuangan Metrics
  const totalInvoiced = filteredInvoices.reduce((acc, i) => acc + Number(i.total_tagihan || 0), 0);
  const totalPaid = filteredInvoices.reduce((acc, i) => acc + Number(i.total_dibayar || 0), 0);
  const totalOutstanding = Math.max(0, totalInvoiced - totalPaid);
  const collectionRate = totalInvoiced > 0 ? Math.round((totalPaid / totalInvoiced) * 100) : 0;

  const invLunas = filteredInvoices.filter((i) => i.status === 'Lunas');
  const invSebagian = filteredInvoices.filter((i) => i.status === 'Sebagian');
  const invBelumLunas = filteredInvoices.filter((i) => i.status === 'Belum Lunas');
  const invOverdue = filteredInvoices.filter((i) => i.status === 'Jatuh Tempo' || i.status === 'Overdue');

  // Aging Piutang
  const agingLancar = filteredInvoices
    .filter((i) => i.status !== 'Lunas' && (!i.jatuh_tempo || new Date(i.jatuh_tempo) >= new Date()))
    .reduce((acc, i) => acc + Math.max(0, Number(i.total_tagihan || 0) - Number(i.total_dibayar || 0)), 0);

  const agingOverdue = filteredInvoices
    .filter((i) => i.status !== 'Lunas' && i.jatuh_tempo && new Date(i.jatuh_tempo) < new Date())
    .reduce((acc, i) => acc + Math.max(0, Number(i.total_tagihan || 0) - Number(i.total_dibayar || 0)), 0);

  // 4. Top Klien & Top Sales
  const clientRevenueMap: Record<string, { total: number; dealsCount: number }> = {};
  filteredDeals.forEach((d) => {
    const name = d.snapshot_nama_klien || 'Tanpa Nama';
    if (!clientRevenueMap[name]) clientRevenueMap[name] = { total: 0, dealsCount: 0 };
    clientRevenueMap[name].total += Number(d.nilai_deal || 0);
    clientRevenueMap[name].dealsCount += 1;
  });

  const sortedTopClients = Object.entries(clientRevenueMap)
    .map(([nama, data]) => ({ nama, ...data }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const maxClientVal = sortedTopClients[0]?.total || 1;

  const salesRevenueMap: Record<string, { total: number; count: number }> = {};
  filteredDeals.forEach((d) => {
    const sName = d.nama_sales || 'Sales Tim';
    if (!salesRevenueMap[sName]) salesRevenueMap[sName] = { total: 0, count: 0 };
    salesRevenueMap[sName].total += Number(d.nilai_deal || 0);
    salesRevenueMap[sName].count += 1;
  });

  const sortedSales = Object.entries(salesRevenueMap)
    .map(([nama, data]) => ({ nama, ...data }))
    .sort((a, b) => b.total - a.total);

  // Dynamic filter label
  const getFilterPeriodLabel = () => {
    switch (dateFilter) {
      case 'hari':
        return `Hari Ini (${formatDateId(new Date().toISOString().slice(0, 10))})`;
      case 'pekan':
        return 'Pekan Ini (7 Hari Terakhir)';
      case 'bulan':
        return 'Bulan Ini (30 Hari Terakhir)';
      case 'custom':
        return `Rentang Kustom: ${formatDateId(customStartDate)} s/d ${formatDateId(customEndDate)}`;
      case 'semua':
        return 'Seluruh Waktu (All Time)';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Export Strip */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            Laporan Analitik, Piutang & Grafik Kinerja Operasional
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Visualisasi terintegrasi untuk Quotation, Media Order, Penagihan Invoice, Arus Kas & Ekspor CSV.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() =>
              exportToCsv(
                `rekap_piutang_invoice_${dateFilter}.csv`,
                filteredInvoices.map((i) => ({
                  Nomor_Invoice: i.nomor,
                  Klien: i.snapshot_nama_klien,
                  Nomor_Deal: i.nomor_deal,
                  Tanggal_Terbit: i.tanggal_terbit,
                  Jatuh_Tempo: i.jatuh_tempo,
                  Total_Tagihan: i.total_tagihan,
                  Total_Dibayar: i.total_dibayar,
                  Sisa_Piutang: Math.max(0, Number(i.total_tagihan) - Number(i.total_dibayar)),
                  Status: i.status,
                  No_Faktur_Pajak: i.no_faktur_pajak,
                }))
              )
            }
            className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            CSV Piutang ({filteredInvoices.length})
          </button>
          <button
            onClick={() =>
              exportToCsv(
                `laporan_progres_deal_${dateFilter}.csv`,
                filteredDeals.map((d) => ({
                  Nomor_Deal: d.nomor,
                  Kampanye: d.nama_kampanye || d.nama_deal,
                  Klien: d.snapshot_nama_klien,
                  Sales: d.nama_sales,
                  Nilai_Deal: d.nilai_deal,
                  Kuota_Dibeli: d.ringkasan_kuota?.dibeli,
                  Sudah_Tayang: d.ringkasan_kuota?.sudah_tayang,
                  Terjadwal: d.ringkasan_kuota?.terjadwal,
                  Belum_Dijadwalkan: d.ringkasan_kuota?.belum_dijadwalkan,
                  Progres_Persen: d.ringkasan_kuota?.persen_progres,
                }))
              )
            }
            className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            CSV Deal ({filteredDeals.length})
          </button>
          <button
            onClick={() =>
              exportToCsv(
                `rekap_quotations_${dateFilter}.csv`,
                filteredQuotations.map((q) => ({
                  Nomor_Quotation: q.nomor,
                  Judul: q.judul_penawaran,
                  Klien: q.snapshot_nama_klien,
                  Sales: q.nama_sales,
                  Revisi: q.versi_aktif,
                  Tanggal_Terbit: q.tanggal_terbit,
                  Berlaku_Sampai: q.berlaku_sampai,
                  Grand_Total: q.active_version?.grand_total,
                  Status: q.status,
                }))
              )
            }
            className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            CSV Quotation ({filteredQuotations.length})
          </button>
          <button
            onClick={() =>
              exportToCsv(
                `rekap_media_orders_${dateFilter}.csv`,
                filteredMOs.map((m) => ({
                  Nomor_MO: m.nomor,
                  Kampanye: m.nama_kampanye,
                  Klien: m.snapshot_nama_klien,
                  Jenis: m.jenis,
                  Periode_Mulai: m.periode_mulai,
                  Periode_Selesai: m.periode_selesai,
                  Status: m.status,
                }))
              )
            }
            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            CSV MO ({filteredMOs.length})
          </button>
        </div>
      </div>

      {/* FILTER TANGGAL (Hari, Pekan, Bulan, Semua, Custom) */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3 text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-blue-600" />
              Filter Periode Laporan:
            </span>
            <div className="flex items-center rounded-lg border border-slate-300 p-0.5 bg-slate-100 flex-wrap">
              {[
                { id: 'hari', label: 'Hari Ini' },
                { id: 'pekan', label: 'Pekan Ini (7 Hari)' },
                { id: 'bulan', label: 'Bulan Ini (30 Hari)' },
                { id: 'semua', label: 'Seluruh Waktu' },
                { id: 'custom', label: 'Custom Tanggal' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setDateFilter(f.id as any)}
                  className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                    dateFilter === f.id
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 text-slate-500 font-mono text-[11px] self-start sm:self-auto">
            <CalendarRange className="w-3.5 h-3.5 text-blue-600" />
            <span className="font-semibold text-slate-700">{getFilterPeriodLabel()}</span>
          </div>
        </div>

        {/* Input Rentang Tanggal Custom */}
        {dateFilter === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-200">
            <div className="flex items-center gap-2">
              <label className="text-slate-600 font-medium">Dari Tanggal:</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-3 py-1.5 bg-white border border-slate-300 rounded-md font-mono text-slate-800"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-slate-600 font-medium">Sampai Tanggal:</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-3 py-1.5 bg-white border border-slate-300 rounded-md font-mono text-slate-800"
              />
            </div>
            <div className="text-[11px] text-slate-500 font-sans">
              Menampilkan data transaksi dan penayangan dalam rentang tanggal yang ditentukan.
            </div>
          </div>
        )}
      </div>

      {/* 4 HIGHLIGHT METRICS STRIP */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Quotations */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold text-slate-700 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-amber-600" />
              Pipeline Quotation
            </span>
            <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold text-[10px] border border-amber-200">
              {filteredQuotations.length} Dokumen
            </span>
          </div>
          <div className="my-3">
            <div className="text-2xl font-bold tracking-tight text-slate-900 font-mono">
              {formatRupiah(totalQuotationsVal)}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Win Rate Deal: <strong className="text-emerald-700">{winRate}%</strong> ({quotDeal.length} Deal)
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Menunggu Approval: {quotPending.length}</span>
            <span>Rata-rata: {formatRupiah(avgQuotVal)}</span>
          </div>
        </div>

        {/* Metric 2: Media Orders */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold text-slate-700 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-indigo-600" />
              Media Order (MO)
            </span>
            <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold text-[10px] border border-indigo-200">
              {filteredMOs.length} Order
            </span>
          </div>
          <div className="my-3">
            <div className="text-2xl font-bold tracking-tight text-slate-900 font-mono">
              {moSelesai.length} / {filteredMOs.length}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Order Selesai Tayang (<strong className="text-indigo-700">
                {filteredMOs.length > 0 ? Math.round((moSelesai.length / filteredMOs.length) * 100) : 0}%
              </strong>)
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Terjadwal: {moTerjadwal.length}</span>
            <span>Draft/Review: {moDraft.length}</span>
          </div>
        </div>

        {/* Metric 3: Total Invoiced */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold text-slate-700 flex items-center gap-1.5">
              <Receipt className="w-4 h-4 text-purple-600" />
              Penagihan Invoice
            </span>
            <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-bold text-[10px] border border-purple-200">
              {filteredInvoices.length} Faktur
            </span>
          </div>
          <div className="my-3">
            <div className="text-2xl font-bold tracking-tight text-slate-900 font-mono">
              {formatRupiah(totalInvoiced)}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Realisasi Pelunasan: <strong className="text-emerald-700">{collectionRate}%</strong> ({formatRupiah(totalPaid)})
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Lunas: {invLunas.length}</span>
            <span>Belum Lunas: {invBelumLunas.length + invSebagian.length}</span>
          </div>
        </div>

        {/* Metric 4: Outstanding Receivables */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold text-slate-700 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Sisa Piutang Klien
            </span>
            <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700 font-bold text-[10px] border border-red-200 font-mono">
              Aging
            </span>
          </div>
          <div className="my-3">
            <div className="text-2xl font-bold tracking-tight text-amber-700 font-mono">
              {formatRupiah(totalOutstanding)}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Jatuh Tempo: <strong className="text-red-700">{formatRupiah(agingOverdue)}</strong>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Piutang Lancar: {formatRupiah(agingLancar)}</span>
            <span>Overdue: {invOverdue.length}</span>
          </div>
        </div>
      </div>

      {/* SECTION TABS FOR CHARTS */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto text-xs">
        {[
          { id: 'semua', label: 'Seluruh Grafik Analitik' },
          { id: 'quotation', label: 'Grafik Quotation & Pipeline' },
          { id: 'mo', label: 'Grafik Media Order & Platform' },
          { id: 'invoice', label: 'Grafik Invoice & Arus Kas' },
          { id: 'klien', label: 'Top Klien & Sales' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveChartSection(tab.id as any)}
            className={`px-3.5 py-1.5 rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              activeChartSection === tab.id
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* GRAFIK 1: QUOTATION & PIPELINE CONVERSION */}
      {(activeChartSection === 'semua' || activeChartSection === 'quotation') && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-600" />
                Grafik Analitik Quotation: Status, Nilai Pipeline & Konversi Deal
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Distribusi status penawaran harga pada periode {getFilterPeriodLabel()}.
              </p>
            </div>
            <div className="flex items-center gap-3 font-mono text-xs">
              <span className="text-slate-600">
                Win Rate: <strong className="text-emerald-700">{winRate}%</strong>
              </span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-600">
                Total Pipeline: <strong className="text-slate-900">{formatRupiah(totalQuotationsVal)}</strong>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {[
              { label: 'DEAL / Menang', count: quotDeal.length, val: quotDealVal, color: 'bg-emerald-600', light: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
              { label: 'Disetujui Klien', count: quotApproved.length, val: quotApprovedVal, color: 'bg-blue-600', light: 'bg-blue-50 text-blue-800 border-blue-200' },
              { label: 'Menunggu Approval', count: quotPending.length, val: quotPendingVal, color: 'bg-amber-500', light: 'bg-amber-50 text-amber-800 border-amber-200' },
              { label: 'Draft Penawaran', count: quotDraft.length, val: quotDraftVal, color: 'bg-slate-500', light: 'bg-slate-50 text-slate-800 border-slate-200' },
              { label: 'Lost / Batal', count: quotLost.length, val: quotLostVal, color: 'bg-red-500', light: 'bg-red-50 text-red-800 border-red-200' },
            ].map((stat, idx) => {
              const pct = totalQuotationsCount > 0 ? Math.round((stat.count / totalQuotationsCount) * 100) : 0;
              const valPct = totalQuotationsVal > 0 ? Math.round((stat.val / totalQuotationsVal) * 100) : 0;
              return (
                <div key={idx} className={`p-4 rounded-xl border ${stat.light} space-y-2`}>
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span>{stat.label}</span>
                    <span className="font-mono">{stat.count} Dokumen</span>
                  </div>
                  <div className="text-lg font-bold font-mono tracking-tight">{formatRupiah(stat.val)}</div>
                  {/* Visual Progress Bar */}
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div className={`${stat.color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between text-[11px] opacity-80 font-mono">
                    <span>{pct}% Kuota</span>
                    <span>{valPct}% Nilai</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* GRAFIK 2: MEDIA ORDER & DISTRIBUSI PLATFORM MEDIA */}
      {(activeChartSection === 'semua' || activeChartSection === 'mo') && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                Grafik Media Order: Realisasi Penayangan & Distribusi Platform
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Sebaran platform penayangan dan tingkat kepatuhan jadwal penayangan pada periode {getFilterPeriodLabel()}.
              </p>
            </div>
            <div className="font-mono text-xs text-slate-600">
              Total Order: <strong className="text-slate-900">{filteredMOs.length}</strong> · Total Penempatan:{' '}
              <strong className="text-indigo-700">{totalPlatformItems} Item</strong>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Visual Platform Comparison Bar Chart */}
            <div className="lg:col-span-8 space-y-3">
              <div className="text-xs font-bold text-slate-800">
                Peringkat Volume Penayangan per Platform Media
              </div>
              <div className="space-y-2.5">
                {sortedPlatforms.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400">
                    Belum ada penayangan Media Order pada periode ini.
                  </div>
                ) : (
                  sortedPlatforms.map(([plat, count], idx) => {
                    const pct = Math.round((count / totalPlatformItems) * 100);
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-medium text-slate-700">
                          <span className="font-semibold flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-indigo-600 inline-block" />
                            {plat}
                          </span>
                          <span className="font-mono text-slate-900">
                            {count} Penayangan ({pct}%)
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden flex">
                          <div
                            className="bg-indigo-600 h-3 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Status Penayangan Ringkasan */}
            <div className="lg:col-span-4 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 flex flex-col justify-between">
              <div className="font-bold text-xs text-slate-900">Status Pemenuhan Media Order</div>
              <div className="space-y-2 font-mono text-xs">
                <div className="flex justify-between items-center p-2.5 bg-white rounded-lg border border-slate-200">
                  <span className="font-sans text-slate-700 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Selesai Tayang:
                  </span>
                  <span className="font-bold text-emerald-700">{moSelesai.length} Order</span>
                </div>
                <div className="flex justify-between items-center p-2.5 bg-white rounded-lg border border-slate-200">
                  <span className="font-sans text-slate-700 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                    Terjadwal / Sedang Tayang:
                  </span>
                  <span className="font-bold text-blue-700">{moTerjadwal.length + moTayang.length} Order</span>
                </div>
                <div className="flex justify-between items-center p-2.5 bg-white rounded-lg border border-slate-200">
                  <span className="font-sans text-slate-700 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-amber-600" />
                    Draft / Belum Rilis:
                  </span>
                  <span className="font-bold text-amber-700">{moDraft.length} Order</span>
                </div>
              </div>

              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-[11px] text-indigo-900 leading-relaxed font-sans">
                <strong>Catatan Operasional:</strong> Setiap Media Order yang berstatus Tayang wajib dilengkapi bukti tautan (live URL) dan screenshot sebelum invoice final dapat diterbitkan.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GRAFIK 3: INVOICE, ARUS KAS & REALISASI PEMBAYARAN */}
      {(activeChartSection === 'semua' || activeChartSection === 'invoice') && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-purple-600" />
                Grafik Invoice & Arus Kas: Tertagih, Realisasi Pembayaran & Aging Piutang
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Monitoring efektivitas penagihan piutang pada periode {getFilterPeriodLabel()}.
              </p>
            </div>
            <div className="font-mono text-xs">
              Collection Rate: <strong className="text-emerald-700">{collectionRate}%</strong> Terbayar
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Visual Ratio Bar: Terbayar vs Piutang */}
            <div className="lg:col-span-7 space-y-4">
              <div className="text-xs font-bold text-slate-800">
                Realisasi Arus Kas Penagihan ({formatRupiah(totalInvoiced)})
              </div>

              {/* Stacked Comparative Bar */}
              <div className="w-full bg-slate-100 rounded-xl h-6 overflow-hidden flex shadow-inner">
                <div
                  className="bg-emerald-600 h-6 flex items-center justify-center text-white text-[11px] font-mono font-bold transition-all"
                  style={{ width: `${collectionRate}%` }}
                  title={`Terbayar: ${formatRupiah(totalPaid)} (${collectionRate}%)`}
                >
                  {collectionRate > 15 ? `${collectionRate}% Lunas` : ''}
                </div>
                <div
                  className="bg-amber-500 h-6 flex items-center justify-center text-white text-[11px] font-mono font-bold transition-all"
                  style={{ width: `${100 - collectionRate}%` }}
                  title={`Piutang: ${formatRupiah(totalOutstanding)} (${100 - collectionRate}%)`}
                >
                  {100 - collectionRate > 15 ? `${100 - collectionRate}% Piutang` : ''}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 font-mono text-xs">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <div className="text-[11px] text-slate-600 font-sans">Sudah Dibayar (Cash In):</div>
                  <div className="text-lg font-bold text-emerald-800 mt-0.5">{formatRupiah(totalPaid)}</div>
                  <div className="text-[11px] text-emerald-700 mt-0.5">{collectionRate}% dari total faktur</div>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="text-[11px] text-slate-600 font-sans">Sisa Piutang (Receivables):</div>
                  <div className="text-lg font-bold text-amber-800 mt-0.5">{formatRupiah(totalOutstanding)}</div>
                  <div className="text-[11px] text-amber-700 mt-0.5">{100 - collectionRate}% belum diterima</div>
                </div>
              </div>
            </div>

            {/* Aging Piutang Bucket Card */}
            <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="font-bold text-xs text-slate-900">Analisis Umur Piutang (Aging Buckets)</div>
              <div className="space-y-2 text-xs font-mono">
                <div className="p-2.5 bg-white rounded-lg border border-slate-200 flex justify-between items-center">
                  <div>
                    <span className="font-sans font-semibold text-slate-800 block">Piutang Lancar (≤14 Hari)</span>
                    <span className="text-[11px] text-slate-500">Sesuai termin pembayaran standar</span>
                  </div>
                  <span className="font-bold text-slate-900">{formatRupiah(agingLancar)}</span>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-red-200 flex justify-between items-center">
                  <div>
                    <span className="font-sans font-semibold text-red-700 block">Jatuh Tempo / Overdue</span>
                    <span className="text-[11px] text-red-600">Melewati tenggat NET NET</span>
                  </div>
                  <span className="font-bold text-red-700">{formatRupiah(agingOverdue)}</span>
                </div>
              </div>

              <div className="text-[11px] text-slate-500 font-sans pt-1">
                Faktur jatuh tempo otomatis memicu notifikasi peringatan kepada tim Finance dan Account Executive terkait.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GRAFIK 4: KONTRIBUSI TOP KLIEN & TOP SALES */}
      {(activeChartSection === 'semua' || activeChartSection === 'klien') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Klien */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4 text-blue-600" />
                  Top Klien Kontributor Nilai Deal
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Klien terbesar pada periode terpilih</p>
              </div>
              <span className="text-xs font-mono text-slate-500 font-semibold">{sortedTopClients.length} Klien</span>
            </div>

            <div className="space-y-3">
              {sortedTopClients.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">Belum ada deal klien pada periode ini.</div>
              ) : (
                sortedTopClients.map((client, idx) => {
                  const pct = Math.round((client.total / maxClientVal) * 100);
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-slate-900">
                          {idx + 1}. {client.nama}
                        </span>
                        <span className="font-mono font-bold text-blue-700">{formatRupiah(client.total)}</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                        <div className="bg-blue-600 h-2.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono text-right">{client.dealsCount} Kontrak Deal</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Top Sales */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  Performa Sales Executive (Omset Deal)
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Capaian penjualan berdasarkan nama sales</p>
              </div>
              <span className="text-xs font-mono text-slate-500 font-semibold">{sortedSales.length} Sales</span>
            </div>

            <div className="space-y-3">
              {sortedSales.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">Belum ada catatan sales pada periode ini.</div>
              ) : (
                sortedSales.map((sales, idx) => {
                  const maxSales = sortedSales[0]?.total || 1;
                  const pct = Math.round((sales.total / maxSales) * 100);
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-slate-900">
                          {idx + 1}. {sales.nama}
                        </span>
                        <span className="font-mono font-bold text-emerald-700">{formatRupiah(sales.total)}</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                        <div className="bg-emerald-600 h-2.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono text-right">{sales.count} Paket Deal Ditutup</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* TABEL 1: Rekap Piutang Belum Lunas */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Rekapitulasi Piutang & Tagihan Klien (Accounts Receivable)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Daftar faktur penagihan yang aktif pada periode {getFilterPeriodLabel()}.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-600 font-semibold">
            Total Piutang: {formatRupiah(totalOutstanding)}
          </span>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <th className="py-2.5 px-3 text-left">Nomor Invoice</th>
                <th className="py-2.5 px-3 text-left">Klien</th>
                <th className="py-2.5 px-3 text-left">Ref Deal</th>
                <th className="py-2.5 px-3 text-left">Jatuh Tempo</th>
                <th className="py-2.5 px-3 text-right font-mono">Total Tagihan</th>
                <th className="py-2.5 px-3 text-right font-mono">Terbayar</th>
                <th className="py-2.5 px-3 text-right font-mono">Sisa Piutang</th>
                <th className="py-2.5 px-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-slate-400">
                    Tidak ada faktur penagihan pada rentang tanggal ini.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((i) => {
                  const sisa = Math.max(0, Number(i.total_tagihan) - Number(i.total_dibayar));
                  return (
                    <tr key={i.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-700">{i.nomor}</td>
                      <td className="py-2.5 px-3 font-medium text-slate-900">{i.snapshot_nama_klien}</td>
                      <td className="py-2.5 px-3 font-mono">{i.nomor_deal}</td>
                      <td className="py-2.5 px-3 font-mono">{formatDateId(i.jatuh_tempo)}</td>
                      <td className="py-2.5 px-3 text-right font-mono">{formatRupiah(i.total_tagihan)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-700">{formatRupiah(i.total_dibayar)}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-700">{formatRupiah(sisa)}</td>
                      <td className="py-2.5 px-3">
                        <span className={getStatusSemanticColor(i.status)}>{i.status}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* TABEL 2: Rekonsiliasi Kontrak Deal */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Rekonsiliasi Nilai Kontrak Deal vs Nilai Sudah Ditagihkan
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Sinkronisasi antara nilai kontrak deal, progres pemenuhan kuota tayang, dan nilai sisa belum tertagih.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-600 font-semibold">
            {filteredDeals.length} Paket Deal
          </span>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <th className="py-2.5 px-3 text-left">Nomor Deal & Klien</th>
                <th className="py-2.5 px-3 text-left">Sales</th>
                <th className="py-2.5 px-3 text-right font-mono">Progres Tayang</th>
                <th className="py-2.5 px-3 text-right font-mono">Nilai Deal</th>
                <th className="py-2.5 px-3 text-right font-mono">Sudah Ditagihkan</th>
                <th className="py-2.5 px-3 text-right font-mono">Belum Ditagihkan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredDeals.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    Tidak ada paket deal pada rentang tanggal ini.
                  </td>
                </tr>
              ) : (
                filteredDeals.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3">
                      <span className="font-mono font-bold text-blue-700">{d.nomor}</span> ·{' '}
                      <span className="font-semibold text-slate-900">{d.snapshot_nama_klien}</span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-700">{d.nama_sales}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-emerald-700">
                      {d.ringkasan_kuota?.persen_progres}%
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono">{formatRupiah(d.nilai_deal)}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-blue-700">
                      {formatRupiah(d.keuangan?.nilai_tertagih)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      {formatRupiah(d.keuangan?.sisa_belum_tertagih)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 4. SISTEM LOGGING & AUDIT TRAIL MENDALAM
// ============================================================================
export const AuditLogsModule: React.FC<{
  logs: Array<Record<string, any>>;
  onFilterChange: (modul: string, search: string) => void;
}> = ({ logs, onFilterChange }) => {
  const [modul, setModul] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedDiff, setSelectedDiff] = useState<Record<string, any> | null>(null);

  const handleApply = (newModul: string, newSearch: string) => {
    setModul(newModul);
    setSearch(newSearch);
    onFilterChange(newModul, newSearch);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Sistem Audit Log & Pelacakan Aktivitas Mendalam
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Mencatat secara permanen setiap autentikasi JWT, pembuatan dokumen, revisi harga, penjadwalan ulang, verifikasi, hingga pembayaran.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => handleApply(modul, e.target.value)}
              placeholder="Cari user, nomor dokumen, aktivitas..."
              className="pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-xs w-64"
            />
          </div>
          <select
            value={modul}
            onChange={(e) => handleApply(e.target.value, search)}
            className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
          >
            <option value="all">Semua Modul Sistem</option>
            {['Auth', 'Quotation', 'Deal', 'Media Order', 'Jadwal Tayang', 'Bukti Tayang', 'Invoice', 'Pembayaran', 'Approval', 'Rate Card', 'Pengaturan'].map(
              (m) => (
                <option key={m} value={m}>
                  Modul: {m}
                </option>
              )
            )}
          </select>
          <button
            onClick={() => exportToCsv('audit_logs_sistem.csv', logs)}
            className="px-3.5 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Unduh Log CSV
          </button>
        </div>
      </div>

      {selectedDiff && (
        <div className="bg-slate-900 text-slate-100 rounded-lg p-5 space-y-3 text-xs font-mono">
          <div className="flex items-center justify-between pb-2 border-b border-slate-700">
            <span className="font-bold text-blue-400">
              Inspeksi Payload Audit Log #{selectedDiff.id} · {selectedDiff.aksi} ({selectedDiff.nomor_dokumen || 'SYSTEM'})
            </span>
            <button
              onClick={() => setSelectedDiff(null)}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-200 cursor-pointer"
            >
              Tutup Inspeksi
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 bg-slate-950 border border-slate-800 rounded">
              <div className="text-slate-400 mb-1">Nilai Sebelum Perubahan (nilai_lama):</div>
              <pre className="whitespace-pre-wrap text-amber-300">
                {selectedDiff.nilai_lama || 'null (Data Baru)'}
              </pre>
            </div>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded">
              <div className="text-slate-400 mb-1">Nilai Sesudah Perubahan (nilai_baru):</div>
              <pre className="whitespace-pre-wrap text-emerald-300">
                {selectedDiff.nilai_baru || 'null'}
              </pre>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <th className="py-3 px-4 text-left font-mono">Waktu (UTC/WIB)</th>
              <th className="py-3 px-4 text-left">Pengguna & Role</th>
              <th className="py-3 px-4 text-left">Modul & Kode Aksi</th>
              <th className="py-3 px-4 text-left">Dokumen</th>
              <th className="py-3 px-4 text-left">Ringkasan Aktivitas</th>
              <th className="py-3 px-4 text-right">Payload Diff</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {logs.map((l) => (
              <tr key={l.id} className="hover:bg-slate-50/70">
                <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                  <div>{l.waktu}</div>
                  <div className="text-[11px] text-slate-400">IP: {l.ip_address}</div>
                </td>
                <td className="py-3 px-4">
                  <div className="font-semibold text-slate-900">{l.nama_user}</div>
                  <div className="text-slate-500">{l.role_user}</div>
                </td>
                <td className="py-3 px-4">
                  <div className="font-semibold text-slate-800">{l.modul}</div>
                  <div className="font-mono text-[11px] text-blue-700">{l.aksi}</div>
                </td>
                <td className="py-3 px-4 font-mono font-semibold text-slate-800">
                  {l.nomor_dokumen || '-'}
                </td>
                <td className="py-3 px-4 text-slate-700 max-w-md">{l.ringkasan}</td>
                <td className="py-3 px-4 text-right">
                  {(l.nilai_lama || l.nilai_baru) && (
                    <button
                      onClick={() => setSelectedDiff(l)}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-mono text-[11px] rounded cursor-pointer"
                    >
                      Lihat JSON Diff
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ============================================================================
// 5. PENGATURAN SISTEM, MANAJEMEN PENGGUNA, MASTER KOP PDF & MATRIKS RBAC
// ============================================================================
export const SettingsModule: React.FC<{
  settingsData: Record<string, any> | null;
  currentUser: Record<string, any>;
  apiPut: (url: string, body: any) => Promise<any>;
  apiPost: (url: string, body: any) => Promise<any>;
  apiGet?: (url: string) => Promise<any>;
  showToast?: (msg: string) => void;
  onRefresh: () => void;
}> = ({ settingsData, currentUser, apiPut, apiPost, apiGet, showToast, onRefresh }) => {
  const [subTab, setSubTab] = useState<'web' | 'seo' | 'security' | 'company' | 'sequence' | 'rbac' | 'users' | 'system'>('web');
  const [selectedRoleId, setSelectedRoleId] = useState<number>(6);

  // New User Form State
  const [namaUser, setNamaUser] = useState('');
  const [emailUser, setEmailUser] = useState('');
  const [jabatanUser, setJabatanUser] = useState('');
  const [roleIdUser, setRoleIdUser] = useState(6);
  const [passwordUser, setPasswordUser] = useState('');
  const [showPasswordUser, setShowPasswordUser] = useState(false);

  // User Password Reset Modal State
  const [selectedUserForReset, setSelectedUserForReset] = useState<Record<string, any> | null>(null);
  const [newPasswordForReset, setNewPasswordForReset] = useState('');
  const [showNewPasswordReset, setShowNewPasswordReset] = useState(false);
  const [submittingPasswordReset, setSubmittingPasswordReset] = useState(false);
  const [credentialBanner, setCredentialBanner] = useState<{ nama: string; email: string; pass: string } | null>(null);
  const [copiedBanner, setCopiedBanner] = useState(false);

  // 1. MASTER PENGATURAN IDENTITAS WEB & BRANDING
  const [siteTitle, setSiteTitle] = useState('MediaFlow ERP');
  const [siteTagline, setSiteTagline] = useState('Sistem Terpadu Quotation → Deal → Media Order → Bukti Tayang → Invoice');
  const [siteDescription, setSiteDescription] = useState('Platform manajemen periklanan digital, advertorial, jadwal tayang inventori media, verifikasi bukti tayang, dan faktur penagihan.');
  const [siteKeywords, setSiteKeywords] = useState('quotation, media order, bukti tayang, invoice, advertising erp, rate card');
  const [siteLogo, setSiteLogo] = useState<string>(DEFAULT_COMPANY_LOGO_SVG);
  const [siteFavicon, setSiteFavicon] = useState<string>(DEFAULT_COMPANY_LOGO_SVG);
  const [appFooterText, setAppFooterText] = useState('© 2026 PT Nusantara Digital Media Terpadu. All rights reserved.');
  const [appTimezone, setAppTimezone] = useState('Asia/Jakarta');
  const [appCanonicalUrl, setAppCanonicalUrl] = useState('https://mediaflow.nusantaramedia.id');

  // 2. SEO & PENGATURAN INDEX MESIN PENCARI
  const [seoIndexing, setSeoIndexing] = useState<'noindex' | 'index'>('noindex');
  const [googleSiteVerification, setGoogleSiteVerification] = useState('');

  // 3. CLOUDFLARE TURNSTILE & KEAMANAN VPS
  const [turnstileEnabled, setTurnstileEnabled] = useState<boolean>(true);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState('0x4AAAAAAABcDeFgHiJkLmNo');
  const [turnstileSecretKey, setTurnstileSecretKey] = useState('0x4AAAAAAABcDeFgHiJkLmNoPqRsTuVwXyZ');
  const [turnstileMode, setTurnstileMode] = useState<'managed' | 'non-interactive' | 'invisible'>('managed');
  const [securitySessionTimeout, setSecuritySessionTimeout] = useState('24h');
  const [securityMaxLoginAttempts, setSecurityMaxLoginAttempts] = useState(5);
  const [securityForceHttps, setSecurityForceHttps] = useState<boolean>(true);
  const [securityPasswordMinLength, setSecurityPasswordMinLength] = useState(8);

  // 4. PEMELIHARAAN SISTEM & DATABASE VPS
  const [maintenanceMode, setMaintenanceMode] = useState<boolean>(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('Sistem MediaFlow ERP sedang dalam proses pemeliharaan berkala untuk peningkatan performa server. Silakan coba kembali beberapa saat lagi.');
  const [systemStats, setSystemStats] = useState<Record<string, any> | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [isOptimizingDb, setIsOptimizingDb] = useState(false);
  const [isSavingWebSettings, setIsSavingWebSettings] = useState(false);

  // 5. MASTER PENGATURAN KOP PDF & TANDA TANGAN
  const [namaPerusahaan, setNamaPerusahaan] = useState('PT Nusantara Digital Media Terpadu');
  const [subJudulKop, setSubJudulKop] = useState(
    'Jaringan Media Digital, Advertorial, & Solusi Periklanan Terintegrasi'
  );
  const [alamatPerusahaan, setAlamatPerusahaan] = useState(
    'Menara Sudirman Lt. 18, Jl. Jend. Sudirman Kav. 60, Jakarta Selatan 12190'
  );
  const [npwpPerusahaan, setNpwpPerusahaan] = useState('01.345.678.9-012.000');
  const [teleponPerusahaan, setTeleponPerusahaan] = useState('(021) 520-8899');
  const [emailPerusahaan, setEmailPerusahaan] = useState('billing@nusantaramedia.id');
  const [websitePerusahaan, setWebsitePerusahaan] = useState('www.nusantaramedia.id');
  const [bankNama, setBankNama] = useState('Bank Mandiri KCP Sudirman Jakarta');
  const [bankRekening, setBankRekening] = useState('122-00-9876543-2');
  const [bankAtasNama, setBankAtasNama] = useState('PT Nusantara Digital Media Terpadu');
  const [catatanKakiPdf, setCatatanKakiPdf] = useState(
    'Dokumen Resmi PT Nusantara Digital Media Terpadu · Dicetak otomatis dari Sistem MediaFlow ERP'
  );
  const [logoPerusahaan, setLogoPerusahaan] = useState<string>(DEFAULT_COMPANY_LOGO_SVG);
  const [tampilkanLogoKop, setTampilkanLogoKop] = useState<boolean>(true);

  // Per-Document Signature Configuration State (Quotation, MO, Invoice, Proof, Deal Progress)
  const [selectedSigDoc, setSelectedSigDoc] = useState<PdfDocKey>('QUOTATION');
  const [sigMap, setSigMap] = useState<PdfSignatureMap>(DEFAULT_PDF_SIGNATURES);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // 6. MASTER PENGATURAN SEQUENCE PENOMORAN DOKUMEN
  const [seqGlobalFormat, setSeqGlobalFormat] = useState('{KODE}/{TAHUN}/{BULAN}/{URUT}');
  const [seqDigits, setSeqDigits] = useState(4);
  const [seqResetPeriod, setSeqResetPeriod] = useState<'TAHUNAN' | 'BULANAN' | 'BERKELANJUTAN'>('TAHUNAN');
  const [seqCodes, setSeqCodes] = useState<Record<string, string>>({
    QT: 'QT',
    DL: 'DL',
    MO: 'MO',
    BT: 'BT',
    INV: 'INV',
    KWT: 'KWT',
  });
  const [seqFormats, setSeqFormats] = useState<Record<string, string>>({
    QT: '{KODE}/{TAHUN}/{BULAN}/{URUT}',
    DL: '{KODE}/{TAHUN}/{BULAN}/{URUT}',
    MO: '{KODE}/{TAHUN}/{BULAN}/{URUT}',
    BT: '{KODE}/{TAHUN}/{BULAN}/{URUT}',
    INV: '{KODE}/{TAHUN}/{BULAN}/{URUT}',
    KWT: '{KODE}/{TAHUN}/{BULAN}/{URUT}',
  });
  const [seqCounters, setSeqCounters] = useState<Array<any>>([]);
  const [isSavingSeq, setIsSavingSeq] = useState(false);
  const [selectedCounterForEdit, setSelectedCounterForEdit] = useState<{
    kode_dokumen: string;
    tahun: number;
    last_seq: number;
  } | null>(null);
  const [newCounterValue, setNewCounterValue] = useState<number>(0);
  const [isUpdatingCounter, setIsUpdatingCounter] = useState(false);

  const rawSettings = settingsData?.settings;

  useEffect(() => {
    if (!rawSettings) return;
    // Web Branding
    setSiteTitle(rawSettings.site_title || 'MediaFlow ERP');
    setSiteTagline(rawSettings.site_tagline || 'Sistem Terpadu Quotation → Deal → Media Order → Bukti Tayang → Invoice');
    setSiteDescription(rawSettings.site_description || 'Platform manajemen periklanan digital, advertorial, jadwal tayang inventori media, verifikasi bukti tayang, dan faktur penagihan.');
    setSiteKeywords(rawSettings.site_keywords || 'quotation, media order, bukti tayang, invoice, advertising erp, rate card');
    setSiteLogo(rawSettings.site_logo || DEFAULT_COMPANY_LOGO_SVG);
    setSiteFavicon(rawSettings.site_favicon || DEFAULT_COMPANY_LOGO_SVG);
    setAppFooterText(rawSettings.app_footer_text || '© 2026 PT Nusantara Digital Media Terpadu. All rights reserved.');
    setAppTimezone(rawSettings.app_timezone || 'Asia/Jakarta');
    setAppCanonicalUrl(rawSettings.app_canonical_url || 'https://mediaflow.nusantaramedia.id');

    // SEO
    setSeoIndexing(rawSettings.seo_indexing === 'index' ? 'index' : 'noindex');
    setGoogleSiteVerification(rawSettings.google_site_verification || '');

    // Security & Turnstile
    setTurnstileEnabled(rawSettings.turnstile_enabled !== 'false');
    setTurnstileSiteKey(rawSettings.turnstile_site_key || '0x4AAAAAAABcDeFgHiJkLmNo');
    setTurnstileSecretKey(rawSettings.turnstile_secret_key || '0x4AAAAAAABcDeFgHiJkLmNoPqRsTuVwXyZ');
    setTurnstileMode((rawSettings.turnstile_mode as any) || 'managed');
    setSecuritySessionTimeout(rawSettings.security_session_timeout || '24h');
    setSecurityMaxLoginAttempts(Number(rawSettings.security_max_login_attempts) || 5);
    setSecurityForceHttps(rawSettings.security_force_https !== 'false');
    setSecurityPasswordMinLength(Number(rawSettings.security_password_min_length) || 8);

    // Maintenance
    setMaintenanceMode(rawSettings.maintenance_mode === 'true');
    setMaintenanceMessage(rawSettings.maintenance_message || 'Sistem MediaFlow ERP sedang dalam proses pemeliharaan berkala untuk peningkatan performa server. Silakan coba kembali beberapa saat lagi.');

    // Company & Kop PDF
    setNamaPerusahaan(rawSettings.nama_perusahaan || 'PT Nusantara Digital Media Terpadu');
    setSubJudulKop(
      rawSettings.sub_judul_kop || 'Jaringan Media Digital, Advertorial, & Solusi Periklanan Terintegrasi'
    );
    setAlamatPerusahaan(
      rawSettings.alamat_perusahaan ||
        'Menara Sudirman Lt. 18, Jl. Jend. Sudirman Kav. 60, Jakarta Selatan 12190'
    );
    setNpwpPerusahaan(rawSettings.npwp_perusahaan || '01.345.678.9-012.000');
    setTeleponPerusahaan(rawSettings.telepon_perusahaan || '(021) 520-8899');
    setEmailPerusahaan(rawSettings.email_perusahaan || 'billing@nusantaramedia.id');
    setWebsitePerusahaan(rawSettings.website_perusahaan || 'www.nusantaramedia.id');
    setBankNama(rawSettings.bank_nama || 'Bank Mandiri KCP Sudirman Jakarta');
    setBankRekening(rawSettings.bank_rekening || '122-00-9876543-2');
    setBankAtasNama(rawSettings.bank_atas_nama || 'PT Nusantara Digital Media Terpadu');
    setCatatanKakiPdf(
      rawSettings.catatan_kaki_pdf ||
        `Dokumen Resmi ${rawSettings.nama_perusahaan || 'PT Nusantara Digital Media Terpadu'} · Dicetak otomatis dari Sistem MediaFlow ERP`
    );
    setLogoPerusahaan(rawSettings.logo_perusahaan || DEFAULT_COMPANY_LOGO_SVG);
    setTampilkanLogoKop(rawSettings.tampilkan_logo_kop !== 'false');
    setSigMap(parsePdfSignaturesConfig(rawSettings.pdf_signatures_config));

    // Sequence Penomoran Dokumen
    setSeqGlobalFormat(rawSettings.seq_format_global || rawSettings.format_nomor || '{KODE}/{TAHUN}/{BULAN}/{URUT}');
    setSeqDigits(Number(rawSettings.seq_digits) || 4);
    setSeqResetPeriod((rawSettings.seq_reset_period || rawSettings.reset_nomor || 'TAHUNAN').toUpperCase() as any);
    setSeqCodes({
      QT: rawSettings.seq_code_QT || 'QT',
      DL: rawSettings.seq_code_DL || 'DL',
      MO: rawSettings.seq_code_MO || 'MO',
      BT: rawSettings.seq_code_BT || 'BT',
      INV: rawSettings.seq_code_INV || 'INV',
      KWT: rawSettings.seq_code_KWT || 'KWT',
    });
    setSeqFormats({
      QT: rawSettings.seq_format_QT || rawSettings.seq_format_global || rawSettings.format_nomor || '{KODE}/{TAHUN}/{BULAN}/{URUT}',
      DL: rawSettings.seq_format_DL || rawSettings.seq_format_global || rawSettings.format_nomor || '{KODE}/{TAHUN}/{BULAN}/{URUT}',
      MO: rawSettings.seq_format_MO || rawSettings.seq_format_global || rawSettings.format_nomor || '{KODE}/{TAHUN}/{BULAN}/{URUT}',
      BT: rawSettings.seq_format_BT || rawSettings.seq_format_global || rawSettings.format_nomor || '{KODE}/{TAHUN}/{BULAN}/{URUT}',
      INV: rawSettings.seq_format_INV || rawSettings.seq_format_global || rawSettings.format_nomor || '{KODE}/{TAHUN}/{BULAN}/{URUT}',
      KWT: rawSettings.seq_format_KWT || rawSettings.seq_format_global || rawSettings.format_nomor || '{KODE}/{TAHUN}/{BULAN}/{URUT}',
    });
  }, [rawSettings]);

  const loadSystemStats = async () => {
    if (!apiGet) return;
    setIsLoadingStats(true);
    try {
      const res = await apiGet('/api/settings/system-stats');
      if (res) setSystemStats(res);
    } catch {
      // ignore
    } finally {
      setIsLoadingStats(false);
    }
  };

  const loadSequenceSettings = async () => {
    if (!apiGet) return;
    try {
      const res = await apiGet('/api/settings/sequences');
      if (res?.config) {
        setSeqGlobalFormat(res.config.global_format || '{KODE}/{TAHUN}/{BULAN}/{URUT}');
        setSeqDigits(res.config.digits || 4);
        setSeqResetPeriod(res.config.reset_period || 'TAHUNAN');
        if (res.config.codes) setSeqCodes(res.config.codes);
        if (res.config.formats) setSeqFormats(res.config.formats);
      }
      if (res?.counters) setSeqCounters(res.counters);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (subTab === 'system') {
      loadSystemStats();
    } else if (subTab === 'sequence') {
      loadSequenceSettings();
    }
  }, [subTab]);

  const { roleMatrix = [], users = [], sequences = [] } = settingsData || {};
  const isSuperAdmin = currentUser?.role_kode === 'super_admin' || currentUser?.role_id === 1 || currentUser?.role_kode === 'superadmin';
  const canEditCompany = ['super_admin', 'admin'].includes(currentUser?.role_kode) || currentUser?.role_id === 1;
  const activeRoleObj = roleMatrix.find((r: any) => r.id === selectedRoleId) || roleMatrix[0];

  const handleTogglePerm = async (
    permRow: Record<string, any>,
    field: 'can_create' | 'can_update' | 'can_approve' | 'can_view',
    newScope?: string
  ) => {
    if (!isSuperAdmin) return;
    await apiPut('/api/settings/permissions', {
      role_id: selectedRoleId,
      modul: permRow.modul,
      can_create: field === 'can_create' ? !permRow.can_create : Boolean(permRow.can_create),
      can_update: field === 'can_update' ? !permRow.can_update : Boolean(permRow.can_update),
      can_approve: field === 'can_approve' ? !permRow.can_approve : Boolean(permRow.can_approve),
      can_view: field === 'can_view' ? !permRow.can_view : Boolean(permRow.can_view),
      scope: newScope !== undefined ? newScope : permRow.scope,
    });
    onRefresh();
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    let res = '';
    for (let i = 0; i < 10; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res;
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaUser.trim() || !emailUser.trim()) return;
    try {
      const res = await apiPost('/api/settings/users', {
        nama: namaUser.trim(),
        email: emailUser.toLowerCase().trim(),
        password: passwordUser ? passwordUser.trim() : undefined,
        jabatan: jabatanUser.trim() || 'Staff Operasional',
        role_id: roleIdUser,
        team_id: 1,
      });

      const assignedPass = res?.temporary_password || (passwordUser ? passwordUser.trim() : 'MediaFlow2026!');
      setCredentialBanner({
        nama: namaUser.trim(),
        email: emailUser.toLowerCase().trim(),
        pass: assignedPass,
      });

      setNamaUser('');
      setEmailUser('');
      setJabatanUser('');
      setPasswordUser('');
      onRefresh();
      if (showToast) showToast('Pengguna baru berhasil ditambahkan.');
    } catch (err: any) {
      if (showToast) showToast(err.message || 'Gagal menambahkan pengguna baru.');
    }
  };

  const handleExecuteResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForReset || !newPasswordForReset) return;
    if (newPasswordForReset.trim().length < 6) {
      if (showToast) showToast('Kata sandi baru minimal harus 6 karakter.');
      return;
    }

    setSubmittingPasswordReset(true);
    try {
      const res = await apiPut(`/api/settings/users/${selectedUserForReset.id}/password`, {
        password_baru: newPasswordForReset.trim(),
      });
      setCredentialBanner({
        nama: selectedUserForReset.nama,
        email: selectedUserForReset.email,
        pass: newPasswordForReset.trim(),
      });
      setSelectedUserForReset(null);
      setNewPasswordForReset('');
      onRefresh();
      if (showToast) showToast(res.message || `Kata sandi akun ${selectedUserForReset.nama} berhasil direset.`);
    } catch (err: any) {
      if (showToast) showToast(err.message || 'Gagal mereset kata sandi pengguna.');
    } finally {
      setSubmittingPasswordReset(false);
    }
  };

  const handleToggleUserActive = async (u: Record<string, any>) => {
    if (!isSuperAdmin) return;
    try {
      const res = await apiPut(`/api/settings/users/${u.id}/toggle-status`, {});
      onRefresh();
      if (showToast) showToast(res.message || `Status akun ${u.nama} berhasil diubah.`);
    } catch (err: any) {
      if (showToast) showToast(err.message || 'Gagal mengubah status akun.');
    }
  };

  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setLogoPerusahaan(reader.result);
        setTampilkanLogoKop(true);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSiteLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setSiteLogo(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSiteFaviconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setSiteFavicon(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const activeDocSlots = sigMap[selectedSigDoc] || [];

  const handleUpdateSignatorySlot = (idx: number, patch: Partial<PdfSignatorySlot>) => {
    const updated = [...activeDocSlots];
    updated[idx] = { ...updated[idx], ...patch };
    setSigMap({
      ...sigMap,
      [selectedSigDoc]: updated,
    });
  };

  const handleAddSignatorySlot = () => {
    if (activeDocSlots.length >= 4) return;
    const newSlot: PdfSignatorySlot = {
      id: `${selectedSigDoc.toLowerCase()}-${Date.now()}`,
      label_atas: 'Mengetahui / Menyetujui,',
      mode_penandatangan: 'custom',
      nama: 'Hendra Kusuma',
      jabatan: 'Direktur Komersial & Bisnis',
      tampilkan_ttd_digital: true,
      tampilkan_stempel: false,
    };
    setSigMap({
      ...sigMap,
      [selectedSigDoc]: [...activeDocSlots, newSlot],
    });
  };

  const handleRemoveSignatorySlot = (idx: number) => {
    if (activeDocSlots.length <= 1) return;
    setSigMap({
      ...sigMap,
      [selectedSigDoc]: activeDocSlots.filter((_, i) => i !== idx),
    });
  };

  const handleSaveMasterPdfConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditCompany) return;
    setIsSavingConfig(true);
    try {
      await apiPut('/api/settings/company', {
        nama_perusahaan: namaPerusahaan,
        sub_judul_kop: subJudulKop,
        alamat_perusahaan: alamatPerusahaan,
        npwp_perusahaan: npwpPerusahaan,
        telepon_perusahaan: teleponPerusahaan,
        email_perusahaan: emailPerusahaan,
        website_perusahaan: websitePerusahaan,
        bank_nama: bankNama,
        bank_rekening: bankRekening,
        bank_atas_nama: bankAtasNama,
        catatan_kaki_pdf: catatanKakiPdf,
        logo_perusahaan: logoPerusahaan,
        tampilkan_logo_kop: tampilkanLogoKop ? 'true' : 'false',
        pdf_signatures_config: JSON.stringify(sigMap),
      });
      onRefresh();
      if (showToast) showToast('Pengaturan Kop PDF & Penandatangan berhasil disimpan.');
    } finally {
      setIsSavingConfig(false);
    }
  };

  const computeLivePreview = (docKey: 'QT' | 'DL' | 'MO' | 'BT' | 'INV' | 'KWT') => {
    const d = new Date();
    const y4 = String(d.getFullYear());
    const y2 = y4.slice(-2);
    const mNum = d.getMonth() + 1;
    const m2 = String(mNum).padStart(2, '0');
    const day2 = String(d.getDate()).padStart(2, '0');
    const ROMANS: Record<number, string> = {
      1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI',
      7: 'VII', 8: 'VIII', 9: 'IX', 10: 'X', 11: 'XI', 12: 'XII'
    };
    const roman = ROMANS[mNum] || m2;

    let seqTahunKey = d.getFullYear();
    if (seqResetPeriod === 'BULANAN') {
      seqTahunKey = d.getFullYear() * 100 + mNum;
    } else if (seqResetPeriod === 'BERKELANJUTAN') {
      seqTahunKey = 0;
    }

    const matchCounter = seqCounters.find((c) => c.kode_dokumen === docKey && c.tahun === seqTahunKey);
    const nextSeq = (matchCounter ? matchCounter.last_seq : 0) + 1;
    const padded = String(nextSeq).padStart(seqDigits, '0');

    const docCode = seqCodes[docKey] || docKey;
    const tpl = seqFormats[docKey] || seqGlobalFormat || '{KODE}/{TAHUN}/{BULAN}/{URUT}';

    return tpl
      .replace(/{KODE}/g, docCode)
      .replace(/{TAHUN}/g, y4)
      .replace(/{TH}/g, y2)
      .replace(/{BULAN}/g, m2)
      .replace(/{ROMAN}/g, roman)
      .replace(/{HARI}/g, day2)
      .replace(/{URUT}/g, padded);
  };

  const handleSaveSequenceFormat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) return;
    setIsSavingSeq(true);
    try {
      await apiPut('/api/settings/sequences/format', {
        global_format: seqGlobalFormat,
        digits: seqDigits,
        reset_period: seqResetPeriod,
        codes: seqCodes,
        formats: seqFormats,
      });
      if (showToast) showToast('Konfigurasi sequence penomoran dokumen berhasil disimpan.');
      await loadSequenceSettings();
      onRefresh();
    } catch (err: any) {
      if (showToast) showToast('Gagal menyimpan konfigurasi penomoran: ' + (err.message || 'Error'));
    } finally {
      setIsSavingSeq(false);
    }
  };

  const handleUpdateCounter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin || !selectedCounterForEdit) return;
    setIsUpdatingCounter(true);
    try {
      await apiPut('/api/settings/sequences/counter', {
        kode_dokumen: selectedCounterForEdit.kode_dokumen,
        tahun: selectedCounterForEdit.tahun,
        new_last_seq: newCounterValue,
      });
      if (showToast) showToast(`Counter ${selectedCounterForEdit.kode_dokumen} berhasil diubah ke ${newCounterValue}.`);
      setSelectedCounterForEdit(null);
      await loadSequenceSettings();
      onRefresh();
    } catch (err: any) {
      if (showToast) showToast('Gagal mengubah counter: ' + (err.message || 'Error'));
    } finally {
      setIsUpdatingCounter(false);
    }
  };

  const handleSaveWebSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditCompany) return;
    setIsSavingWebSettings(true);
    try {
      await apiPut('/api/settings/web', {
        site_title: siteTitle,
        site_tagline: siteTagline,
        site_description: siteDescription,
        site_keywords: siteKeywords,
        site_logo: siteLogo,
        site_favicon: siteFavicon,
        seo_indexing: seoIndexing,
        app_canonical_url: appCanonicalUrl,
        google_site_verification: googleSiteVerification,
        turnstile_enabled: turnstileEnabled ? 'true' : 'false',
        turnstile_site_key: turnstileSiteKey,
        turnstile_secret_key: turnstileSecretKey,
        turnstile_mode: turnstileMode,
        security_session_timeout: securitySessionTimeout,
        security_max_login_attempts: String(securityMaxLoginAttempts),
        security_force_https: securityForceHttps ? 'true' : 'false',
        security_password_min_length: String(securityPasswordMinLength),
        maintenance_mode: maintenanceMode ? 'true' : 'false',
        maintenance_message: maintenanceMessage,
        app_footer_text: appFooterText,
        app_timezone: appTimezone,
      });
      onRefresh();
      if (showToast) showToast('Master pengaturan web, keamanan, dan SEO berhasil disimpan.');
    } finally {
      setIsSavingWebSettings(false);
    }
  };

  const handleOptimizeDb = async () => {
    if (!canEditCompany) return;
    setIsOptimizingDb(true);
    try {
      const res = await apiPost('/api/settings/optimize-db', {});
      if (res?.success) {
        if (showToast) showToast(res.message || 'Database SQLite berhasil dioptimasi.');
        loadSystemStats();
      }
    } catch (err: any) {
      if (showToast) showToast(err.message || 'Gagal mengoptimasi database.');
    } finally {
      setIsOptimizingDb(false);
    }
  };

  const [isDownloadingDb, setIsDownloadingDb] = useState<boolean>(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreConfirmChecked, setRestoreConfirmChecked] = useState<boolean>(false);
  const [showRestoreModal, setShowRestoreModal] = useState<boolean>(false);
  const [isRestoringDb, setIsRestoringDb] = useState<boolean>(false);
  const restoreFileInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleDownloadDbBackup = async () => {
    setIsDownloadingDb(true);
    try {
      const token = localStorage.getItem('mediaflow_jwt');
      const res = await fetch('/api/settings/backup-db', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Gagal mengunduh cadangan database.');
      }
      const blob = await res.blob();
      const today = new Date().toISOString().split('T')[0];
      const filename = `mediaflow-backup-${today}.db`;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      if (showToast) showToast('Snapshot database SQLite (.db) berhasil diunduh.');
    } catch (err: any) {
      if (showToast) showToast(err.message || 'Gagal mengunduh file cadangan database.');
    } finally {
      setIsDownloadingDb(false);
    }
  };

  const [dbStatus, setDbStatus] = useState<{
    active_engine?: string;
    is_mariadb_configured?: boolean;
    host?: string;
    port?: number;
    database?: string;
    user?: string;
    sqlite_fallback?: boolean;
  }>({});
  const [isDownloadingMariaDBSchema, setIsDownloadingMariaDBSchema] = useState(false);
  const [isTestingMariaDB, setIsTestingMariaDB] = useState(false);
  const [mariaDBTestResult, setMariaDBTestResult] = useState<{ success: boolean; message: string; version?: string } | null>(null);

  useEffect(() => {
    if (subTab === 'system' && isSuperAdmin && apiGet) {
      apiGet('/api/database/status')
        .then((data) => {
          if (data) setDbStatus(data);
        })
        .catch(() => {});
    }
  }, [subTab, isSuperAdmin]);

  const handleDownloadMariaDBSchema = async () => {
    setIsDownloadingMariaDBSchema(true);
    try {
      const token = localStorage.getItem('mediaflow_jwt');
      const res = await fetch('/api/database/schema-mariadb', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Gagal mengunduh berkas skema MariaDB.');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'schema-mariadb.sql';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      if (showToast) showToast('Berkas schema-mariadb.sql berhasil diunduh.');
    } catch (err: any) {
      if (showToast) showToast(err.message || 'Gagal mengunduh skema MariaDB.');
    } finally {
      setIsDownloadingMariaDBSchema(false);
    }
  };

  const handleTestMariaDBConnection = async () => {
    setIsTestingMariaDB(true);
    setMariaDBTestResult(null);
    try {
      const token = localStorage.getItem('mediaflow_jwt');
      const res = await fetch('/api/database/test-mariadb', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      setMariaDBTestResult(data);
      if (showToast) showToast(data.message);
    } catch (err: any) {
      const fail = { success: false, message: err.message || 'Gagal menghubungi endpoint uji database' };
      setMariaDBTestResult(fail);
      if (showToast) showToast(fail.message);
    } finally {
      setIsTestingMariaDB(false);
    }
  };

  const handleSelectRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.db') && !file.name.endsWith('.sqlite')) {
        if (showToast) showToast('Harap pilih berkas dengan ekstensi .db atau .sqlite');
        return;
      }
      setRestoreFile(file);
      setShowRestoreModal(true);
      setRestoreConfirmChecked(false);
    }
    e.target.value = '';
  };

  const handleExecuteRestore = async () => {
    if (!restoreFile || !restoreConfirmChecked) return;
    setIsRestoringDb(true);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (err) => reject(err);
      });
      reader.readAsDataURL(restoreFile);
      const fileData = await base64Promise;

      const res = await apiPost('/api/settings/restore-db', {
        file_base64: fileData,
        file_name: restoreFile.name,
      });

      if (res?.success) {
        if (showToast) showToast(res.message || 'Database berhasil dipulihkan!');
        setShowRestoreModal(false);
        setRestoreFile(null);
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        throw new Error(res?.error || 'Gagal memulihkan database.');
      }
    } catch (err: any) {
      if (showToast) showToast(err.message || 'Gagal memulihkan database dari file cadangan.');
    } finally {
      setIsRestoringDb(false);
    }
  };

  const docLabels: Array<{ key: PdfDocKey; label: string; desc: string }> = [
    {
      key: 'QUOTATION',
      label: 'Quotation Penawaran',
      desc: 'Pengaturan penandatangan khusus dokumen Quotation (mis. Sales & Klien)',
    },
    {
      key: 'MEDIA_ORDER',
      label: 'Media Order (MO)',
      desc: 'Pengaturan penandatangan khusus dokumen MO (mis. Traffic, Manager & Klien)',
    },
    {
      key: 'INVOICE',
      label: 'Invoice Penagihan',
      desc: 'Pengaturan penandatangan khusus dokumen Invoice (mis. Otorisasi Finance / Direktur)',
    },
    {
      key: 'PROOF',
      label: 'Bukti Tayang',
      desc: 'Pengaturan penandatangan untuk laporan verifikasi Bukti Tayang',
    },
    {
      key: 'DEAL_PROGRESS',
      label: 'Laporan Progres Deal',
      desc: 'Pengaturan penandatangan untuk cetak Laporan Progres Paket Deal',
    },
    {
      key: 'RECEIPT',
      label: 'Kwitansi (Receipt)',
      desc: 'Pengaturan penandatangan tanda terima bukti pembayaran (mis. Kasir / Otorisasi Keuangan)',
    },
  ];

  if (!settingsData) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Master Pengaturan Web, SEO, Keamanan & Tata Kelola Sistem
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Konfigurasi branding web, proteksi Cloudflare Turnstile, indexing mesin pencari, kop PDF & tanda tangan dinamis, matriks 7 role, dan backup database VPS.
          </p>
        </div>

        {/* 7 Sub-tabs Navigation */}
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
          <button
            onClick={() => setSubTab('web')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
              subTab === 'web' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-blue-600" />
            Identitas Web & Logo
          </button>
          <button
            onClick={() => setSubTab('seo')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
              subTab === 'seo' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Search className="w-3.5 h-3.5 text-emerald-600" />
            Index Mesin Pencari
          </button>
          <button
            onClick={() => setSubTab('security')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
              subTab === 'security' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-amber-600" />
            Cloudflare Turnstile
          </button>
          <button
            onClick={() => setSubTab('company')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
              subTab === 'company' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-indigo-600" />
            Kop PDF & TTD
          </button>
          <button
            onClick={() => setSubTab('sequence')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
              subTab === 'sequence' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileDigit className="w-3.5 h-3.5 text-amber-600" />
            Penomoran Dokumen
          </button>
          <button
            onClick={() => setSubTab('rbac')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
              subTab === 'rbac' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
            Hak Akses (RBAC)
          </button>
          <button
            onClick={() => setSubTab('users')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
              subTab === 'users' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5 text-slate-700" />
            Daftar Pengguna
          </button>
          {isSuperAdmin && (
            <button
              onClick={() => setSubTab('system')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                subTab === 'system' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Server className="w-3.5 h-3.5 text-rose-600" />
              Server VPS & Database
            </button>
          )}
        </div>
      </div>

      {/* ====================================================================
          TAB A: MASTER PENGATURAN IDENTITAS WEB & BRANDING
         ==================================================================== */}
      {subTab === 'web' && (
        <form onSubmit={handleSaveWebSettings} className="space-y-6 text-xs">
          {/* Top Bar Action */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-600" />
                Master Identitas Web Aplikasi & Branding
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Pengaturan judul web, deskripsi, favicon, logo header/login, dan informasi hak cipta pada footer.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="submit"
                disabled={!canEditCompany || isSavingWebSettings}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                {isSavingWebSettings ? 'Menyimpan...' : 'Simpan Identitas Web'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Form Fields */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-6 space-y-4">
              <div className="pb-3 border-b border-slate-200 font-bold text-slate-900 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-blue-600" />
                Metadata & Informasi Situs
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Site Title (Judul Situs Web)
                </label>
                <input
                  type="text"
                  required
                  value={siteTitle}
                  onChange={(e) => setSiteTitle(e.target.value)}
                  placeholder="MediaFlow ERP"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md font-semibold text-slate-900"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Ditampilkan pada judul tab browser (<code>&lt;title&gt;</code>) dan header utama sistem.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Site Tagline (Slogan / Sub-Judul Web)
                </label>
                <input
                  type="text"
                  value={siteTagline}
                  onChange={(e) => setSiteTagline(e.target.value)}
                  placeholder="Sistem Terpadu Quotation → Deal → Media Order → Bukti Tayang → Invoice"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Site Description (Meta Deskripsi)
                </label>
                <textarea
                  rows={3}
                  value={siteDescription}
                  onChange={(e) => setSiteDescription(e.target.value)}
                  placeholder="Deskripsi ringkas sistem untuk meta description mesin pencari..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-800 leading-relaxed"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Digunakan untuk <code>&lt;meta name="description"&gt;</code> dan ringkasan pada halaman login.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Meta Keywords (Kata Kunci SEO)
                </label>
                <input
                  type="text"
                  value={siteKeywords}
                  onChange={(e) => setSiteKeywords(e.target.value)}
                  placeholder="quotation, media order, bukti tayang, invoice, advertising erp"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-800 font-mono text-[11px]"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Pisahkan beberapa kata kunci dengan tanda koma (,).
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Zona Waktu Default
                  </label>
                  <select
                    value={appTimezone}
                    onChange={(e) => setAppTimezone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-slate-800"
                  >
                    <option value="Asia/Jakarta">WIB (Asia/Jakarta - UTC+7)</option>
                    <option value="Asia/Makassar">WITA (Asia/Makassar - UTC+8)</option>
                    <option value="Asia/Jayapura">WIT (Asia/Jayapura - UTC+9)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    URL Kanonikal Web (VPS Base URL)
                  </label>
                  <input
                    type="url"
                    value={appCanonicalUrl}
                    onChange={(e) => setAppCanonicalUrl(e.target.value)}
                    placeholder="https://mediaflow.nusantaramedia.id"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-800 font-mono text-[11px]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Teks Footer & Copyright Aplikasi
                </label>
                <input
                  type="text"
                  value={appFooterText}
                  onChange={(e) => setAppFooterText(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-800"
                />
              </div>
            </div>

            {/* Right Column: Logo & Favicon Assets with Live Preview */}
            <div className="lg:col-span-5 space-y-6">
              {/* Logo Card */}
              <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
                <div className="pb-3 border-b border-slate-200 font-bold text-slate-900 flex items-center gap-2">
                  <Image className="w-4 h-4 text-blue-600" />
                  Logo Web & Halaman Login
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center min-h-[90px]">
                  {siteLogo ? (
                    <img
                      src={siteLogo}
                      alt="Logo Web"
                      referrerPolicy="no-referrer"
                      className="max-h-16 max-w-full object-contain"
                    />
                  ) : (
                    <span className="text-slate-400 text-xs">Belum ada logo web</span>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded cursor-pointer inline-flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5" />
                      Unggah Logo Web
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleSiteLogoUpload}
                        className="hidden"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setSiteLogo(DEFAULT_COMPANY_LOGO_SVG)}
                      className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-medium rounded cursor-pointer"
                    >
                      Gunakan Default SVG
                    </button>
                  </div>
                  <input
                    type="text"
                    value={siteLogo.startsWith('data:') ? '' : siteLogo}
                    onChange={(e) => setSiteLogo(e.target.value || DEFAULT_COMPANY_LOGO_SVG)}
                    placeholder="Atau tempel URL gambar (https://...)"
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded font-mono text-[11px]"
                  />
                  <p className="text-[11px] text-slate-500">
                    Format disarankan: PNG transparan atau SVG dengan lebar rasio 3:1 atau 1:1.
                  </p>
                </div>
              </div>

              {/* Favicon Card */}
              <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
                <div className="pb-3 border-b border-slate-200 font-bold text-slate-900 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-emerald-600" />
                  Favicon Browser (Ikon Tab Browser)
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-4">
                  <div className="w-12 h-12 rounded border border-slate-300 bg-white flex items-center justify-center p-1 shrink-0">
                    {siteFavicon ? (
                      <img
                        src={siteFavicon}
                        alt="Favicon"
                        referrerPolicy="no-referrer"
                        className="w-8 h-8 object-contain"
                      />
                    ) : (
                      <Globe className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="font-semibold text-slate-900">Ukuran Rekomendasi: 32x32 px</div>
                    <p className="text-[11px] text-slate-500">
                      Favicon langsung diinjeksikan ke <code>&lt;link rel="icon"&gt;</code> di browser.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <label className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded cursor-pointer inline-flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    Unggah Favicon (.ico/.png/.svg)
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleSiteFaviconUpload}
                      className="hidden"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setSiteFavicon(DEFAULT_COMPANY_LOGO_SVG)}
                    className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-medium rounded cursor-pointer"
                  >
                    Reset Favicon
                  </button>
                </div>
              </div>

              {/* Browser Tab Simulation Preview */}
              <div className="bg-slate-900 text-slate-200 rounded-lg p-4 space-y-2">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Simulasi Tampilan Tab Browser
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded-t-lg px-3 py-2 flex items-center gap-2.5 max-w-xs shadow-inner">
                  {siteFavicon && (
                    <img
                      src={siteFavicon}
                      alt="Favicon preview"
                      referrerPolicy="no-referrer"
                      className="w-4 h-4 object-contain rounded-xs shrink-0"
                    />
                  )}
                  <span className="font-medium text-white truncate text-xs">
                    {siteTitle} — {siteTagline.slice(0, 30)}...
                  </span>
                  <span className="ml-auto text-slate-400 text-xs">×</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Judul dan favicon otomatis tersinkronisasi tanpa perlu reload halaman.
                </div>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* ====================================================================
          TAB B: INDEX MESIN PENCARI & SEO SETTINGS
         ==================================================================== */}
      {subTab === 'seo' && (
        <form onSubmit={handleSaveWebSettings} className="space-y-6 text-xs">
          {/* Top Bar Action */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Search className="w-4 h-4 text-emerald-600" />
                Pengaturan Indexing Mesin Pencari & Optimasi SEO
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Kontrol apakah sistem diizinkan terindeks di Google/Bing atau sepenuhnya tertutup untuk privasi internal perusahaan.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="submit"
                disabled={!canEditCompany || isSavingWebSettings}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                {isSavingWebSettings ? 'Menyimpan...' : 'Simpan Pengaturan SEO'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Indexing Mode Selection */}
            <div className="lg:col-span-7 space-y-6">
              {/* Indexing Policy Options */}
              <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
                <div className="pb-3 border-b border-slate-200 font-bold text-slate-900 flex items-center gap-2">
                  <Radio className="w-4 h-4 text-emerald-600" />
                  Kebijakan Indexing Robot Mesin Pencari (Meta Robots)
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Option 1: NOINDEX (Recommended for ERP) */}
                  <div
                    onClick={() => setSeoIndexing('noindex')}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      seoIndexing === 'noindex'
                        ? 'border-emerald-600 bg-emerald-50/50 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="seo_indexing"
                          checked={seoIndexing === 'noindex'}
                          onChange={() => setSeoIndexing('noindex')}
                          className="w-4 h-4 text-emerald-600"
                        />
                        <span className="font-bold text-slate-900">TIDAK DI-INDEX (Disarankan)</span>
                      </div>
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-semibold text-[10px]">
                        ERP Privat
                      </span>
                    </div>
                    <div className="mt-3 text-slate-600 leading-relaxed text-[11px]">
                      Menyematkan tag <code>noindex, nofollow</code>. Mesin pencari seperti Google, Bing, Yahoo dilarang mengindeks halaman apapun, menjaga privasi data klien dan invoice.
                    </div>
                  </div>

                  {/* Option 2: INDEX */}
                  <div
                    onClick={() => setSeoIndexing('index')}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      seoIndexing === 'index'
                        ? 'border-blue-600 bg-blue-50/50 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="seo_indexing"
                          checked={seoIndexing === 'index'}
                          onChange={() => setSeoIndexing('index')}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className="font-bold text-slate-900">IZINKAN DI-INDEX</span>
                      </div>
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-semibold text-[10px]">
                        Publik
                      </span>
                    </div>
                    <div className="mt-3 text-slate-600 leading-relaxed text-[11px]">
                      Menyematkan tag <code>index, follow</code>. Mesin pencari diizinkan merayapi dan menampilkan halaman publik sistem pada hasil pencarian web.
                    </div>
                  </div>
                </div>

                {/* Generated Meta Tag Preview */}
                <div className="p-3 bg-slate-900 text-slate-200 rounded-lg font-mono text-[11px] space-y-1">
                  <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                    Tag HTML yang aktif pada &lt;head&gt;:
                  </div>
                  <div className="text-emerald-400">
                    &lt;meta name="robots" content="{seoIndexing === 'index' ? 'index, follow' : 'noindex, nofollow'}" /&gt;
                  </div>
                  <div className="text-blue-300">
                    &lt;link rel="canonical" href="{appCanonicalUrl}" /&gt;
                  </div>
                </div>
              </div>

              {/* Webmaster & Google Verification */}
              <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
                <div className="pb-3 border-b border-slate-200 font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Verifikasi Kepemilikan Webmaster
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Google Site Verification Token / HTML Tag
                  </label>
                  <input
                    type="text"
                    value={googleSiteVerification}
                    onChange={(e) => setGoogleSiteVerification(e.target.value)}
                    placeholder="misal: aBcDeFgHiJkLmNoPqRsTuVwXyZ12345"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono text-[11px]"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Diperlukan jika Anda ingin memverifikasi kepemilikan domain di Google Search Console tanpa upload file HTML.
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column: Google SERP Preview & Robots.txt */}
            <div className="lg:col-span-5 space-y-6">
              {/* Google Search Result Preview */}
              <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-3">
                <div className="pb-2 border-b border-slate-200 font-bold text-slate-900 flex items-center justify-between">
                  <span>Pratinjau Hasil Pencarian Google (SERP)</span>
                  <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                    seoIndexing === 'index' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {seoIndexing === 'index' ? 'Terlihat di Google' : 'Diblokir dari Google'}
                  </span>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                  <div className="flex items-center gap-2 text-[11px] text-slate-700 truncate">
                    <span className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-bold">
                      G
                    </span>
                    <span className="truncate">{appCanonicalUrl}</span>
                  </div>
                  <div className="text-sm font-semibold text-blue-700 hover:underline cursor-pointer leading-tight">
                    {siteTitle} — {siteTagline}
                  </div>
                  <div className="text-xs text-slate-600 leading-relaxed">
                    {siteDescription}
                  </div>
                </div>

                {seoIndexing === 'noindex' && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-md flex items-start gap-2 text-amber-800 text-[11px]">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      Karena mode <strong>Tidak Di-index</strong> aktif, Google akan mengabaikan halaman ini sehingga privasi sistem ERP Anda terlindungi sepenuhnya.
                    </span>
                  </div>
                )}
              </div>

              {/* Robots.txt Configuration Helper */}
              <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-3">
                <div className="font-bold text-slate-900 flex items-center gap-2">
                  <Server className="w-4 h-4 text-slate-700" />
                  Konfigurasi File robots.txt VPS
                </div>
                <p className="text-slate-500 text-[11px]">
                  Contoh konfigurasi <code>/robots.txt</code> standar untuk server Nginx/VPS Anda:
                </p>
                <pre className="p-3 bg-slate-900 text-slate-200 rounded font-mono text-[10px] overflow-x-auto leading-relaxed">
{seoIndexing === 'noindex'
  ? `User-agent: *\nDisallow: /`
  : `User-agent: *\nDisallow: /api/\nDisallow: /admin/\nAllow: /\n\nSitemap: ${appCanonicalUrl}/sitemap.xml`}
                </pre>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* ====================================================================
          TAB C: CLOUDFLARE TURNSTILE & KEAMANAN VPS
         ==================================================================== */}
      {subTab === 'security' && (
        <form onSubmit={handleSaveWebSettings} className="space-y-6 text-xs">
          {/* Top Bar Action */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-600" />
                Cloudflare Turnstile CAPTCHA & Kebijakan Keamanan Sesi
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Lindungi halaman login dari bot dan serangan brute-force dengan Cloudflare Turnstile serta kelola durasi token JWT dan otorisasi.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="submit"
                disabled={!canEditCompany || isSavingWebSettings}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                {isSavingWebSettings ? 'Menyimpan...' : 'Simpan Keamanan & Turnstile'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Cloudflare Turnstile Configuration */}
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
                <div className="pb-3 border-b border-slate-200 flex items-center justify-between">
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-amber-600" />
                    Proteksi Cloudflare Turnstile pada Login
                  </div>
                  <label className="flex items-center gap-2 font-semibold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={turnstileEnabled}
                      onChange={(e) => setTurnstileEnabled(e.target.checked)}
                      className="w-4 h-4 text-amber-600 rounded"
                    />
                    <span>Aktifkan Turnstile</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Turnstile Site Key (Kunci Publik Web)
                    </label>
                    <input
                      type="text"
                      value={turnstileSiteKey}
                      onChange={(e) => setTurnstileSiteKey(e.target.value)}
                      placeholder="0x4AAAAAAABcDeFgHiJkLmNo"
                      className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono text-[11px]"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Didapatkan dari Cloudflare Dashboard &gt; Turnstile Sites.
                    </p>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Turnstile Secret Key (Kunci Privat Server)
                    </label>
                    <input
                      type="password"
                      value={turnstileSecretKey}
                      onChange={(e) => setTurnstileSecretKey(e.target.value)}
                      placeholder="0x4AAAAAAABcDeFgHiJkLmNoPqRsTuVwXyZ"
                      className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono text-[11px]"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Digunakan oleh backend Express untuk memverifikasi keaslian token pengunjung di <code>https://challenges.cloudflare.com/turnstile/v0/siteverify</code>.
                    </p>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Mode Interaksi Widget Turnstile
                    </label>
                    <select
                      value={turnstileMode}
                      onChange={(e) => setTurnstileMode(e.target.value as any)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-slate-800"
                    >
                      <option value="managed">Managed (Rekomendasi - Otomatis menentukan tantangan jika ada anomali)</option>
                      <option value="non-interactive">Non-Interactive (Verifikasi otomatis tanpa klik pengguna)</option>
                      <option value="invisible">Invisible (Sepenuhnya tersembunyi di latar belakang form)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Account Security Policy */}
              <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
                <div className="pb-3 border-b border-slate-200 font-bold text-slate-900 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-blue-600" />
                  Kebijakan Sesi & Keamanan Akun
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Durasi Kedaluwarsa JWT Token
                    </label>
                    <select
                      value={securitySessionTimeout}
                      onChange={(e) => setSecuritySessionTimeout(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
                    >
                      <option value="4h">4 Jam</option>
                      <option value="8h">8 Jam (1 Hari Kerja Standar)</option>
                      <option value="24h">24 Jam (1 Hari Penuh)</option>
                      <option value="7d">7 Hari (1 Minggu)</option>
                      <option value="30d">30 Hari</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Maks. Percobaan Login Gagal
                    </label>
                    <select
                      value={securityMaxLoginAttempts}
                      onChange={(e) => setSecurityMaxLoginAttempts(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
                    >
                      <option value={3}>3 Kali</option>
                      <option value={5}>5 Kali (Standar)</option>
                      <option value={10}>10 Kali</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Panjang Minimum Kata Sandi
                    </label>
                    <select
                      value={securityPasswordMinLength}
                      onChange={(e) => setSecurityPasswordMinLength(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
                    >
                      <option value={6}>6 Karakter</option>
                      <option value={8}>8 Karakter (Rekomendasi NIST)</option>
                      <option value={12}>12 Karakter (Ketua Tingkat Tinggi)</option>
                    </select>
                  </div>

                  <div className="flex flex-col justify-end">
                    <label className="flex items-center gap-2 font-semibold text-slate-800 cursor-pointer py-2">
                      <input
                        type="checkbox"
                        checked={securityForceHttps}
                        onChange={(e) => setSecurityForceHttps(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <span>Wajibkan Protokol HTTPS / SSL</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Live Turnstile Test Simulation Widget */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
                <div className="font-bold text-slate-900 flex items-center justify-between">
                  <span>Simulasi Widget Cloudflare Turnstile</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    turnstileEnabled ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {turnstileEnabled ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>

                <p className="text-slate-600 text-[11px]">
                  Tampilan widget keamanan pada formulir login saat Turnstile diaktifkan:
                </p>

                {/* Cloudflare Turnstile Realistic Simulation Box */}
                <div className="p-4 border border-slate-300 rounded-lg bg-slate-50 flex items-center justify-between gap-3 shadow-inner">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-sm border-2 border-slate-400 bg-white flex items-center justify-center text-emerald-600">
                      <Check className="w-5 h-5 stroke-[3]" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-800 text-xs">Verifikasi Manusia Berhasil</div>
                      <div className="text-[10px] text-slate-400 font-mono">Token valid: cf-turnstile-token</div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="font-bold text-[10px] text-slate-700 tracking-tight flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
                      CLOUDFLARE
                    </div>
                    <div className="text-[9px] text-slate-400">Turnstile • Privacy</div>
                  </div>
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-blue-800 text-[11px] leading-relaxed">
                  <strong>Catatan Integrasi:</strong> Turnstile memberikan perlindungan bebas captchas membingungkan bagi pengguna resmi dan otomatis menghadang bot scraper atau serangan kata sandi berulang.
                </div>
              </div>

              {/* Security Headers Summary */}
              <div className="bg-slate-900 text-slate-200 rounded-lg p-5 space-y-3 font-mono text-[11px]">
                <div className="font-bold text-slate-400 text-[10px] uppercase tracking-wider">
                  Header Keamanan Sistem Aktif
                </div>
                <div className="space-y-1 text-[10px]">
                  <div className="text-emerald-400">✓ X-Content-Type-Options: nosniff</div>
                  <div className="text-emerald-400">✓ X-Frame-Options: SAMEORIGIN</div>
                  <div className="text-emerald-400">✓ Strict-Transport-Security (HSTS)</div>
                  <div className="text-emerald-400">✓ Content-Security-Policy (CSP)</div>
                </div>
              </div>
            </div>
          </div>
        </form>
      )}


      {subTab === 'company' && (
        <form onSubmit={handleSaveMasterPdfConfig} className="space-y-6 text-xs">
          {/* Top Bar Save Action */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600" />
                Konfigurasi Master Kop Surat A4 Landscape & Blok Tanda Tangan
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Perubahan logo, identitas perusahaan, dan daftar penandatangan per dokumen langsung diterapkan pada seluruh cetakan PDF.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setSigMap(DEFAULT_PDF_SIGNATURES)}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg cursor-pointer"
              >
                Reset Default TTD
              </button>
              <button
                type="submit"
                disabled={!canEditCompany || isSavingConfig}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                {isSavingConfig ? 'Menyimpan...' : 'Simpan Pengaturan Kop PDF & TTD'}
              </button>
            </div>
          </div>

          {/* SECTION A: LOGO & DATA PERUSAHAAN + LIVE KOP PREVIEW */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Form Logo & Data Perusahaan */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-6 space-y-5">
              <div className="pb-3 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Image className="w-4 h-4 text-blue-600" />
                  1. Pengaturan Logo & Identitas Data Perusahaan
                </h3>
                <label className="flex items-center gap-2 font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tampilkanLogoKop}
                    onChange={(e) => setTampilkanLogoKop(e.target.checked)}
                    className="w-4 h-4"
                  />
                  Tampilkan Logo pada Kop PDF
                </label>
              </div>

              {/* Logo Upload & URL Controls */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="w-16 h-16 rounded-lg border border-slate-300 bg-white flex items-center justify-center p-1.5 shrink-0">
                  {tampilkanLogoKop && logoPerusahaan ? (
                    <img
                      src={logoPerusahaan}
                      alt="Logo Perusahaan"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <span className="text-[10px] text-slate-400 text-center">Tanpa Logo</span>
                  )}
                </div>
                <div className="flex-1 space-y-2 w-full">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded cursor-pointer inline-flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5" />
                      Unggah File Logo (PNG/JPG/SVG)
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoFileUpload}
                        className="hidden"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setLogoPerusahaan(DEFAULT_COMPANY_LOGO_SVG);
                        setTampilkanLogoKop(true);
                      }}
                      className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-medium rounded cursor-pointer"
                    >
                      Gunakan Logo Default
                    </button>
                  </div>
                  <div>
                    <input
                      type="text"
                      value={logoPerusahaan.startsWith('data:') ? '' : logoPerusahaan}
                      onChange={(e) => {
                        setLogoPerusahaan(e.target.value || DEFAULT_COMPANY_LOGO_SVG);
                        setTampilkanLogoKop(true);
                      }}
                      placeholder="Atau tempel URL gambar logo eksternal (https://...)"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded font-mono text-[11px]"
                    />
                  </div>
                </div>
              </div>

              {/* Company Profile Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Nama Resmi Perusahaan (Kop Utama)</label>
                  <input
                    type="text"
                    required
                    value={namaPerusahaan}
                    onChange={(e) => setNamaPerusahaan(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Sub-Judul / Tagline Kop Surat</label>
                  <input
                    type="text"
                    value={subJudulKop}
                    onChange={(e) => setSubJudulKop(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block font-medium text-slate-700 mb-1">Alamat Lengkap Perusahaan</label>
                  <input
                    type="text"
                    required
                    value={alamatPerusahaan}
                    onChange={(e) => setAlamatPerusahaan(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Nomor NPWP Perusahaan</label>
                  <input
                    type="text"
                    required
                    value={npwpPerusahaan}
                    onChange={(e) => setNpwpPerusahaan(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Nomor Telepon Resmi</label>
                  <input
                    type="text"
                    value={teleponPerusahaan}
                    onChange={(e) => setTeleponPerusahaan(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Email Penagihan / Korporat</label>
                  <input
                    type="email"
                    value={emailPerusahaan}
                    onChange={(e) => setEmailPerusahaan(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Website Perusahaan</label>
                  <input
                    type="text"
                    value={websitePerusahaan}
                    onChange={(e) => setWebsitePerusahaan(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Nama Bank & Cabang (Untuk Invoice)</label>
                  <input
                    type="text"
                    value={bankNama}
                    onChange={(e) => setBankNama(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Nomor Rekening Bank</label>
                  <input
                    type="text"
                    value={bankRekening}
                    onChange={(e) => setBankRekening(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Rekening Atas Nama</label>
                  <input
                    type="text"
                    value={bankAtasNama}
                    onChange={(e) => setBankAtasNama(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Teks Catatan Kaki (Footer) PDF</label>
                  <input
                    type="text"
                    value={catatanKakiPdf}
                    onChange={(e) => setCatatanKakiPdf(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  />
                </div>
              </div>
            </div>

            {/* Right Column: Live Kop PDF Preview + Sequence Info */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-3">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Pratinjau Langsung Kop Surat PDF (A4 Landscape)
                </div>

                {/* Simulated Letterhead Sheet */}
                <div className="p-5 bg-white border-2 border-slate-900 rounded-md space-y-3">
                  <div className="flex items-start justify-between gap-4 pb-3 border-b-2 border-slate-900">
                    <div className="flex items-start gap-3">
                      {tampilkanLogoKop && logoPerusahaan && (
                        <img
                          src={logoPerusahaan}
                          alt="Preview Logo"
                          referrerPolicy="no-referrer"
                          className="w-12 h-12 object-contain rounded border border-slate-200 p-1 shrink-0"
                        />
                      )}
                      <div>
                        <div className="text-sm font-bold text-slate-900 leading-snug">{namaPerusahaan}</div>
                        {subJudulKop && (
                          <div className="text-[10px] font-semibold text-blue-700 mt-0.5">{subJudulKop}</div>
                        )}
                        <div className="text-[10px] text-slate-600 mt-0.5 leading-relaxed">{alamatPerusahaan}</div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          NPWP: {npwpPerusahaan} · {teleponPerusahaan} · {emailPerusahaan}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
                    <span>Rekening Tagihan: {bankNama} ({bankRekening})</span>
                    <span>A/N: {bankAtasNama}</span>
                  </div>
                </div>
              </div>

              {/* Sequence Penomoran Tahunan */}
              <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-3">
                <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-200">
                  Sequence Penomoran Dokumen Tahunan (KODE/TAHUN/BULAN/URUT)
                </h3>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                      <th className="py-2 px-3 text-left">Kode</th>
                      <th className="py-2 px-3 text-left">Tahun</th>
                      <th className="py-2 px-3 text-right font-mono">Urutan Terakhir</th>
                      <th className="py-2 px-3 text-right font-mono">Nomor Berikutnya</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono">
                    {sequences.map((sq: any) => (
                      <tr key={sq.id}>
                        <td className="py-2 px-3 font-bold text-blue-700">{sq.kode_dokumen}</td>
                        <td className="py-2 px-3">{sq.tahun}</td>
                        <td className="py-2 px-3 text-right">{sq.last_seq}</td>
                        <td className="py-2 px-3 text-right font-semibold text-slate-900">
                          {sq.kode_dokumen}/{sq.tahun}/11/{String(sq.last_seq + 1).padStart(4, '0')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* SECTION B: PENGATURAN TANDA TANGAN PER JENIS DOKUMEN (Quotation, MO, Invoice, Bukti Tayang) */}
          <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FileSignature className="w-4 h-4 text-blue-600" />
                  2. Pengaturan Tanda Tangan per Dokumen (Beda Orang & Beda Jumlah Kolom)
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Atur jumlah kolom penandatangan (1 s/d 4 orang) serta pejabat yang menandatangani untuk masing-masing jenis dokumen.
                </p>
              </div>

              <button
                type="button"
                disabled={activeDocSlots.length >= 4}
                onClick={handleAddSignatorySlot}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 self-start cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah Kolom Penandatangan ({activeDocSlots.length}/4)
              </button>
            </div>

            {/* Document Type Selector Tabs */}
            <div className="flex flex-wrap gap-2">
              {docLabels.map((dl) => {
                const count = (sigMap[dl.key] || []).length;
                const isSelected = selectedSigDoc === dl.key;
                return (
                  <button
                    key={dl.key}
                    type="button"
                    onClick={() => setSelectedSigDoc(dl.key)}
                    className={`px-4 py-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="font-bold text-xs">{dl.label}</div>
                    <div className={`text-[11px] font-mono mt-0.5 ${isSelected ? 'text-blue-300' : 'text-slate-500'}`}>
                      {count} Penandatangan
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Editor Cards for Each Signatory Slot of the Selected Document */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {activeDocSlots.map((slot, idx) => (
                <div key={slot.id} className="p-4 border border-slate-200 rounded-lg bg-slate-50/60 space-y-3 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                      <span className="font-mono font-bold text-slate-800">
                        Kolom TTD #{idx + 1}
                      </span>
                      {activeDocSlots.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSignatorySlot(idx)}
                          className="text-red-600 hover:text-red-800 flex items-center gap-1 text-[11px] font-semibold cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          Hapus
                        </button>
                      )}
                    </div>

                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Label Atas Tanda Tangan</label>
                      <input
                        type="text"
                        value={slot.label_atas}
                        onChange={(e) => handleUpdateSignatorySlot(idx, { label_atas: e.target.value })}
                        placeholder="Hormat Kami, / Disetujui Oleh,"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded"
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Sumber Penandatangan</label>
                      <select
                        value={slot.mode_penandatangan}
                        onChange={(e) =>
                          handleUpdateSignatorySlot(idx, {
                            mode_penandatangan: e.target.value as 'custom' | 'pembuat' | 'klien',
                          })
                        }
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded"
                      >
                        <option value="custom">Pejabat / Nama Tertentu (Custom)</option>
                        <option value="pembuat">Otomatis: Sales / Pembuat Dokumen</option>
                        <option value="klien">Otomatis: PIC Klien pada Dokumen</option>
                      </select>
                    </div>

                    {slot.mode_penandatangan === 'custom' && (
                      <div>
                        <label className="block font-medium text-slate-700 mb-1">Pilih Cepat Pejabat Internal</label>
                        <select
                          value=""
                          onChange={(e) => {
                            const uid = Number(e.target.value);
                            const found = users.find((u: any) => u.id === uid);
                            if (found) {
                              handleUpdateSignatorySlot(idx, {
                                nama: found.nama,
                                jabatan: found.jabatan,
                              });
                            }
                          }}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-700"
                        >
                          <option value="">-- Pilih dari Daftar User atau Ketik Manual --</option>
                          {users.map((u: any) => (
                            <option key={u.id} value={u.id}>
                              {u.nama} ({u.jabatan})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        {slot.mode_penandatangan === 'custom'
                          ? 'Nama Lengkap Penandatangan'
                          : 'Nama Fallback (Jika Data Dinamis Kosong)'}
                      </label>
                      <input
                        type="text"
                        value={slot.nama}
                        onChange={(e) => handleUpdateSignatorySlot(idx, { nama: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Jabatan / Keterangan Bawah</label>
                      <input
                        type="text"
                        value={slot.jabatan}
                        onChange={(e) => handleUpdateSignatorySlot(idx, { jabatan: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded"
                      />
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-200 space-y-1.5">
                    <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                      <input
                        type="checkbox"
                        checked={slot.tampilkan_ttd_digital}
                        onChange={(e) =>
                          handleUpdateSignatorySlot(idx, { tampilkan_ttd_digital: e.target.checked })
                        }
                        className="w-3.5 h-3.5"
                      />
                      Tampilkan TTD Digital Terverifikasi
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                      <input
                        type="checkbox"
                        checked={slot.tampilkan_stempel}
                        onChange={(e) =>
                          handleUpdateSignatorySlot(idx, { tampilkan_stempel: e.target.checked })
                        }
                        className="w-3.5 h-3.5"
                      />
                      Tampilkan Cap / Stempel Perusahaan
                    </label>
                  </div>
                </div>
              ))}
            </div>

            {/* Live Preview of Signature Block for Selected Document */}
            <div className="p-5 bg-white border border-slate-300 rounded-lg space-y-3">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Pratinjau Blok Tanda Tangan PDF untuk Dokumen: {docLabels.find((d) => d.key === selectedSigDoc)?.label} ({activeDocSlots.length} Kolom)
              </div>

              <div
                className={
                  activeDocSlots.length === 1
                    ? 'flex justify-end text-xs text-center pt-2'
                    : activeDocSlots.length === 2
                    ? 'grid grid-cols-2 gap-12 text-xs text-center pt-2'
                    : activeDocSlots.length === 3
                    ? 'grid grid-cols-3 gap-8 text-xs text-center pt-2'
                    : 'grid grid-cols-4 gap-6 text-xs text-center pt-2'
                }
              >
                {activeDocSlots.map((slot) => (
                  <div
                    key={slot.id}
                    className={activeDocSlots.length === 1 ? 'w-72 flex flex-col items-center' : 'flex flex-col items-center'}
                  >
                    <div className="text-slate-600 font-medium">{slot.label_atas}</div>
                    <div className="h-14 flex items-center justify-center gap-2 my-1">
                      {slot.tampilkan_ttd_digital && (
                        <span className="px-2 py-0.5 border border-blue-200 bg-blue-50 text-blue-800 rounded font-mono text-[10px]">
                          ✓ TTD Digital: {slot.nama.split(' ')[0]}
                        </span>
                      )}
                      {slot.tampilkan_stempel && (
                        <span className="px-2 py-0.5 border-2 border-emerald-700/60 text-emerald-800 rounded font-mono text-[10px] font-bold">
                          STEMPEL RESMI
                        </span>
                      )}
                    </div>
                    <div className="font-bold text-slate-900 underline">
                      {slot.nama}
                      {slot.mode_penandatangan === 'pembuat'
                        ? ' (Mengikuti Pembuat Dokumen)'
                        : slot.mode_penandatangan === 'klien'
                        ? ' (Mengikuti PIC Klien)'
                        : ''}
                    </div>
                    <div className="text-slate-500 text-[11px]">{slot.jabatan}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </form>
      )}

      {/* ====================================================================
          TAB: PENGATURAN SEQUENCE & FORMAT PENOMORAN DOKUMEN
         ==================================================================== */}
      {subTab === 'sequence' && (
        <div className="space-y-6 text-xs">
          {/* Top Bar Header & Action */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileDigit className="w-5 h-5 text-amber-600" />
                Pengaturan Sequence & Format Penomoran Dokumen
              </h2>
              <p className="text-slate-500 text-[11px] mt-0.5">
                Konfigurasi pola nomor otomatis untuk Quotation, Paket Deal, Media Order, Bukti Tayang, dan Invoice.
              </p>
            </div>

            {isSuperAdmin && (
              <button
                type="button"
                onClick={handleSaveSequenceFormat}
                disabled={isSavingSeq}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg flex items-center gap-2 transition-colors cursor-pointer shadow-xs self-start sm:self-auto shrink-0"
              >
                {isSavingSeq ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>{isSavingSeq ? 'Menyimpan...' : 'Simpan Format Penomoran'}</span>
              </button>
            )}
          </div>

          {/* 1. LIVE PREVIEW STRIP (6 KARTU DOKUMEN) */}
          <div>
            <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-blue-600" />
              Pratinjau Nomor Dokumen Berikutnya (Live Preview)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { key: 'QT' as const, label: 'Quotation', bg: 'bg-blue-50 border-blue-200 text-blue-900', badge: 'bg-blue-600 text-white' },
                { key: 'DL' as const, label: 'Paket Deal', bg: 'bg-indigo-50 border-indigo-200 text-indigo-900', badge: 'bg-indigo-600 text-white' },
                { key: 'MO' as const, label: 'Media Order (MO)', bg: 'bg-emerald-50 border-emerald-200 text-emerald-900', badge: 'bg-emerald-600 text-white' },
                { key: 'BT' as const, label: 'Bukti Tayang', bg: 'bg-amber-50 border-amber-200 text-amber-900', badge: 'bg-amber-600 text-white' },
                { key: 'INV' as const, label: 'Invoice', bg: 'bg-rose-50 border-rose-200 text-rose-900', badge: 'bg-rose-600 text-white' },
                { key: 'KWT' as const, label: 'Kwitansi', bg: 'bg-teal-50 border-teal-200 text-teal-900', badge: 'bg-teal-600 text-white' },
              ].map((doc) => (
                <div key={doc.key} className={`border rounded-xl p-3.5 ${doc.bg} shadow-2xs`}>
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span className="font-bold text-xs">{doc.label}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${doc.badge}`}>
                      {seqCodes[doc.key] || doc.key}
                    </span>
                  </div>
                  <div className="font-mono font-bold text-xs tracking-tight break-all bg-white/80 p-2 rounded-lg border border-slate-200/60 text-slate-900">
                    {computeLivePreview(doc.key)}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1.5 font-sans">
                    Format: <span className="font-mono text-slate-700 font-medium">{seqFormats[doc.key] || seqGlobalFormat}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 2. PENGATURAN POLA GLOBAL & PRESETS */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-600" />
                Format Pola Penomoran Global & Aturan Reset
              </h3>
              <span className="text-[11px] text-slate-500">Berlaku untuk semua jenis dokumen secara default</span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Format Template Global *
                </label>
                <input
                  type="text"
                  value={seqGlobalFormat}
                  onChange={(e) => setSeqGlobalFormat(e.target.value)}
                  disabled={!isSuperAdmin}
                  placeholder="Contoh: {KODE}/{TAHUN}/{BULAN}/{URUT}"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg font-mono text-xs text-blue-900 font-semibold bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Quick Presets Buttons */}
              <div>
                <label className="block font-medium text-slate-600 text-[11px] mb-1.5">
                  Preset Format Populer (Klik untuk Menerapkan):
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'Standar Indonesia (KODE/TAHUN/BULAN/URUT)', pattern: '{KODE}/{TAHUN}/{BULAN}/{URUT}' },
                    { label: 'Bulan Romawi (KODE/ROMAN/TAHUN/URUT)', pattern: '{KODE}/{ROMAN}/{TAHUN}/{URUT}' },
                    { label: 'Inisial Perusahaan (KODE/DM/TAHUN/URUT)', pattern: '{KODE}/DM/{TAHUN}/{BULAN}/{URUT}' },
                    { label: 'Format Ringkas (KODE-YYMM-URUT)', pattern: '{KODE}-{TH}{BULAN}-{URUT}' },
                    { label: 'Nomor di Depan (URUT/KODE/BULAN/TAHUN)', pattern: '{URUT}/{KODE}/{BULAN}/{TAHUN}' },
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      disabled={!isSuperAdmin}
                      onClick={() => setSeqGlobalFormat(preset.pattern)}
                      className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-mono transition-colors cursor-pointer ${
                        seqGlobalFormat === preset.pattern
                          ? 'bg-amber-100 border-amber-400 text-amber-900 font-bold'
                          : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tag Legend / Petunjuk Variabel */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="font-semibold text-slate-700 text-[11px] flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-blue-600" />
                  Daftar Variabel yang Dapat Digunakan dalam Format:
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 font-mono text-[11px]">
                  <div className="p-2 bg-white rounded border border-slate-200">
                    <span className="font-bold text-blue-700">{'{KODE}'}</span>
                    <p className="font-sans text-[10px] text-slate-500 mt-0.5">Kode dokumen (QT, INV, dsb)</p>
                  </div>
                  <div className="p-2 bg-white rounded border border-slate-200">
                    <span className="font-bold text-blue-700">{'{TAHUN}'}</span>
                    <p className="font-sans text-[10px] text-slate-500 mt-0.5">4 digit tahun (2026)</p>
                  </div>
                  <div className="p-2 bg-white rounded border border-slate-200">
                    <span className="font-bold text-blue-700">{'{TH}'}</span>
                    <p className="font-sans text-[10px] text-slate-500 mt-0.5">2 digit tahun (26)</p>
                  </div>
                  <div className="p-2 bg-white rounded border border-slate-200">
                    <span className="font-bold text-blue-700">{'{BULAN}'}</span>
                    <p className="font-sans text-[10px] text-slate-500 mt-0.5">2 digit bulan (01 s.d. 12)</p>
                  </div>
                  <div className="p-2 bg-white rounded border border-slate-200">
                    <span className="font-bold text-amber-700">{'{ROMAN}'}</span>
                    <p className="font-sans text-[10px] text-slate-500 mt-0.5">Bulan Romawi (I s.d. XII)</p>
                  </div>
                  <div className="p-2 bg-white rounded border border-slate-200">
                    <span className="font-bold text-blue-700">{'{HARI}'}</span>
                    <p className="font-sans text-[10px] text-slate-500 mt-0.5">2 digit tanggal (01 s.d. 31)</p>
                  </div>
                  <div className="p-2 bg-white rounded border border-slate-200">
                    <span className="font-bold text-emerald-700">{'{URUT}'}</span>
                    <p className="font-sans text-[10px] text-slate-500 mt-0.5">Nomor urut sekuensial</p>
                  </div>
                </div>
              </div>

              {/* Panjang Digit & Periode Reset */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Panjang Digit Urut ({'{URUT}'}) *
                  </label>
                  <select
                    value={seqDigits}
                    onChange={(e) => setSeqDigits(Number(e.target.value))}
                    disabled={!isSuperAdmin}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white cursor-pointer"
                  >
                    <option value={3}>3 Digit (Contoh: 001)</option>
                    <option value={4}>4 Digit (Contoh: 0001 - Standar)</option>
                    <option value={5}>5 Digit (Contoh: 00001)</option>
                    <option value={6}>6 Digit (Contoh: 000001)</option>
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Digit nomor urut akan otomatis diisi angka 0 di depannya (zero padding).
                  </p>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Periode Siklus Reset Nomor Urut *
                  </label>
                  <select
                    value={seqResetPeriod}
                    onChange={(e) => setSeqResetPeriod(e.target.value as any)}
                    disabled={!isSuperAdmin}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white cursor-pointer"
                  >
                    <option value="TAHUNAN">Tahunan (Reset ke 0001 setiap 1 Januari - Rekomendasi)</option>
                    <option value="BULANAN">Bulanan (Reset ke 0001 setiap awal bulan)</option>
                    <option value="BERKELANJUTAN">Berkelanjutan (Tidak pernah reset, lanjut terus)</option>
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Menentukan kapan counter urut nomor dokumen otomatis kembali ke urutan 1.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 3. KUSTOMISASI PREFIKS & FORMAT KHUSUS PER JENIS DOKUMEN */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-xs flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  Kustomisasi Kode Prefiks & Format Khusus per Dokumen
                </h3>
                <p className="text-[11px] text-slate-500">
                  Anda dapat menentukan kode inisial atau format khusus untuk jenis dokumen tertentu bila tidak ingin menggunakan format global.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <th className="py-3 px-4 text-left">Jenis Dokumen</th>
                    <th className="py-3 px-4 text-left w-36">Kode Prefiks ({'{KODE}'})</th>
                    <th className="py-3 px-4 text-left">Format Khusus Dokumen (Opsional)</th>
                    <th className="py-3 px-4 text-left">Hasil Penomoran (Live)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {[
                    { key: 'QT' as const, label: 'Quotation', desc: 'Surat penawaran harga iklan resmi' },
                    { key: 'DL' as const, label: 'Paket Deal', desc: 'Konfirmasi kesepakatan komersial' },
                    { key: 'MO' as const, label: 'Media Order (MO)', desc: 'Surat perintah tayang inventori' },
                    { key: 'BT' as const, label: 'Bukti Tayang', desc: 'Laporan tayang dan verifikasi' },
                    { key: 'INV' as const, label: 'Invoice', desc: 'Faktur penagihan pembayaran klien' },
                    { key: 'KWT' as const, label: 'Kwitansi (Receipt)', desc: 'Tanda bukti pembayaran resmi yang diterima' },
                  ].map((row) => (
                    <tr key={row.key} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{row.label}</div>
                        <div className="text-[11px] text-slate-500">{row.desc}</div>
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          value={seqCodes[row.key] || ''}
                          disabled={!isSuperAdmin}
                          onChange={(e) =>
                            setSeqCodes({ ...seqCodes, [row.key]: e.target.value.toUpperCase() })
                          }
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono font-bold text-xs uppercase"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          value={seqFormats[row.key] || ''}
                          disabled={!isSuperAdmin}
                          onChange={(e) =>
                            setSeqFormats({ ...seqFormats, [row.key]: e.target.value })
                          }
                          placeholder={seqGlobalFormat}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono text-xs"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded border border-blue-200">
                          {computeLivePreview(row.key)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 4. MANAJEMEN COUNTER NOMOR BERJALAN (NUMBER SEQUENCES) */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-xs flex items-center gap-2">
                  <Hash className="w-4 h-4 text-emerald-600" />
                  Daftar Counter Nomor Urut Berjalan (Database Sequences)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Lihat angka urut terakhir sistem (`last_seq`) dan sesuaikan jika perusahaan bermigrasi dari sistem pembukuan lama.
                </p>
              </div>

              {isSuperAdmin && (
                <button
                  type="button"
                  onClick={loadSequenceSettings}
                  className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                  Muat Ulang
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <th className="py-3 px-4 text-left">Kode Dokumen</th>
                    <th className="py-3 px-4 text-left">Periode Akuntansi</th>
                    <th className="py-3 px-4 text-center">Nomor Terakhir (last_seq)</th>
                    <th className="py-3 px-4 text-left font-mono">Nomor Berikutnya</th>
                    {isSuperAdmin && <th className="py-3 px-4 text-right">Aksi Penyesuaian</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {seqCounters.length === 0 ? (
                    <tr>
                      <td colSpan={isSuperAdmin ? 5 : 4} className="py-8 text-center text-slate-400">
                        Belum ada riwayat nomor transaksi di database. Dokumen pertama akan dimulai dari urutan 0001.
                      </td>
                    </tr>
                  ) : (
                    seqCounters.map((c: any) => {
                      const docLabels: Record<string, string> = {
                        QT: 'Quotation',
                        DL: 'Paket Deal',
                        MO: 'Media Order',
                        BT: 'Bukti Tayang',
                        INV: 'Invoice',
                        KWT: 'Kwitansi Pembayaran',
                      };
                      const periodeLabel =
                        c.tahun === 0
                          ? 'Berkelanjutan'
                          : c.tahun > 9999
                          ? `Tahun ${Math.floor(c.tahun / 100)}, Bulan ${c.tahun % 100}`
                          : `Tahun ${c.tahun}`;

                      return (
                        <tr key={c.id || `${c.kode_dokumen}-${c.tahun}`} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 px-4">
                            <span className="font-bold text-slate-900">{docLabels[c.kode_dokumen] || c.kode_dokumen}</span>
                            <span className="ml-2 font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                              {c.kode_dokumen}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-700">{periodeLabel}</td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-slate-900 text-sm">
                            {c.last_seq}
                          </td>
                          <td className="py-3 px-4 font-mono font-semibold text-blue-700">
                            Urutan ke-{(c.last_seq || 0) + 1}
                          </td>
                          {isSuperAdmin && (
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedCounterForEdit(c);
                                  setNewCounterValue(c.last_seq);
                                }}
                                className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer inline-flex"
                              >
                                <Sliders className="w-3 h-3 text-amber-600" />
                                <span>Sesuaikan Counter</span>
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Modal Sesuaikan Counter Penomoran */}
          {selectedCounterForEdit && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
              <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Hash className="w-5 h-5 text-amber-400" />
                    <h3 className="font-bold text-sm">Sesuaikan Counter Nomor Urut</h3>
                  </div>
                  <button
                    onClick={() => setSelectedCounterForEdit(null)}
                    className="text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleUpdateCounter} className="p-6 space-y-4 text-xs">
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                    <div className="font-bold text-amber-900">
                      Dokumen: {selectedCounterForEdit.kode_dokumen} (Periode {selectedCounterForEdit.tahun})
                    </div>
                    <div className="text-amber-800 text-[11px]">
                      Nilai saat ini: <span className="font-mono font-bold">{selectedCounterForEdit.last_seq}</span>. Dokumen berikutnya akan menggunakan urutan <span className="font-mono font-bold">{selectedCounterForEdit.last_seq + 1}</span>.
                    </div>
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Nilai Terakhir Baru (last_seq) *
                    </label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={newCounterValue}
                      onChange={(e) => setNewCounterValue(parseInt(e.target.value, 10) || 0)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-sm font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Contoh: Jika Anda mengisi <strong>100</strong>, dokumen berikutnya yang dibuat akan mendapat nomor urut <strong>101</strong>. Jika diisi <strong>0</strong>, counter akan kembali ke <strong>1</strong>.
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setSelectedCounterForEdit(null)}
                      className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={isUpdatingCounter}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      {isUpdatingCounter ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      <span>{isUpdatingCounter ? 'Menyimpan...' : 'Simpan Counter'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ====================================================================
          TAB 2: MATRIKS HAK AKSES 7 ROLE (RBAC)
         ==================================================================== */}
      {subTab === 'rbac' && (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {roleMatrix.map((r: any) => (
              <button
                key={r.id}
                onClick={() => setSelectedRoleId(r.id)}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                  selectedRoleId === r.id
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {r.nama}
              </button>
            ))}
          </div>

          {activeRoleObj && (
            <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                    Konfigurasi Matriks Izin Role: {activeRoleObj.nama}
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Cakupan Data Default: <strong>{activeRoleObj.cakupan}</strong> · {activeRoleObj.deskripsi}
                  </p>
                </div>
                {!isSuperAdmin && (
                  <span className="text-xs text-amber-700 font-medium flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5" /> Mode Lihat Saja (Beralih ke Super Admin untuk mengubah izin)
                  </span>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                      <th className="py-2.5 px-4 text-left">Modul / Fitur</th>
                      <th className="py-2.5 px-4 text-center">Buat (B)</th>
                      <th className="py-2.5 px-4 text-center">Ubah (U)</th>
                      <th className="py-2.5 px-4 text-center">Setujui / Verifikasi (A)</th>
                      <th className="py-2.5 px-4 text-center">Lihat (L)</th>
                      <th className="py-2.5 px-4 text-left">Cakupan Kepemilikan Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {(activeRoleObj.permissions || []).map((pm: any) => (
                      <tr key={pm.modul} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-4 font-semibold text-slate-900 capitalize">
                          {pm.modul.replace('_', ' ')}
                        </td>
                        {(['can_create', 'can_update', 'can_approve', 'can_view'] as const).map((field) => (
                          <td key={field} className="py-2.5 px-4 text-center">
                            <input
                              type="checkbox"
                              disabled={!isSuperAdmin}
                              checked={Boolean(pm[field])}
                              onChange={() => handleTogglePerm(pm, field)}
                              className="w-4 h-4 cursor-pointer"
                            />
                          </td>
                        ))}
                        <td className="py-2.5 px-4">
                          <select
                            disabled={!isSuperAdmin}
                            value={pm.scope}
                            onChange={(e) => handleTogglePerm(pm, 'can_view', e.target.value)}
                            className="px-2.5 py-1 border border-slate-300 rounded bg-white text-xs"
                          >
                            <option value="all">Seluruh Data (All)</option>
                            <option value="team">Satu Tim di Bawah Manager (Team)</option>
                            <option value="own">Hanya Milik Sendiri (Own)</option>
                            <option value="none">Tidak Ada Akses (None)</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ====================================================================
          TAB 3: DAFTAR PENGGUNA & AKUN JWT
         ==================================================================== */}
      {subTab === 'users' && (
        <div className="space-y-6">
          {/* Banner Kredensial Baru / Sandi Berhasil Direset */}
          {credentialBanner && (
            <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg text-emerald-700 mt-0.5 shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-emerald-900 text-sm">
                    Kredensial Login Pengguna Siap Digunakan
                  </h3>
                  <p className="text-emerald-800 text-[11px] mt-0.5">
                    Silakan salin kredensial berikut dan bagikan ke pengguna agar dapat langsung login ke MediaFlow ERP:
                  </p>
                  <div className="mt-2 p-2.5 bg-white border border-emerald-200 rounded-lg font-mono text-xs space-y-1">
                    <div className="text-slate-700">Nama: <span className="font-semibold text-slate-900">{credentialBanner.nama}</span></div>
                    <div className="text-slate-700">Email: <span className="font-semibold text-blue-700">{credentialBanner.email}</span></div>
                    <div className="text-slate-700 flex items-center gap-2">
                      <span>Kata Sandi:</span>
                      <span className="font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded border border-emerald-300">
                        {credentialBanner.pass}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => {
                    const text = `Kredensial Akses MediaFlow ERP:\nNama: ${credentialBanner.nama}\nEmail: ${credentialBanner.email}\nKata Sandi: ${credentialBanner.pass}\nURL: ${window.location.origin}`;
                    navigator.clipboard.writeText(text);
                    setCopiedBanner(true);
                    setTimeout(() => setCopiedBanner(false), 2500);
                  }}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold flex items-center gap-1.5 text-xs transition-colors cursor-pointer shadow-xs"
                >
                  {copiedBanner ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedBanner ? 'Tersalin!' : 'Salin Kredensial'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCredentialBanner(null)}
                  className="p-1.5 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
                  title="Tutup pemberitahuan"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {isSuperAdmin && (
            <form onSubmit={handleCreateUser} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 text-xs shadow-xs">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-blue-600" />
                  Tambah Pengguna Baru & Atur Kata Sandi
                </h2>
                <span className="text-[11px] text-slate-400">
                  Role: Super Admin Only
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Nama Lengkap *</label>
                  <input
                    type="text"
                    required
                    value={namaUser}
                    onChange={(e) => setNamaUser(e.target.value)}
                    placeholder="Contoh: Andika Pratama"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Email Login JWT *</label>
                  <input
                    type="email"
                    required
                    value={emailUser}
                    onChange={(e) => setEmailUser(e.target.value)}
                    placeholder="andika@digdayamedia.com"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-medium text-slate-700">Kata Sandi Awal</label>
                    <button
                      type="button"
                      onClick={() => setPasswordUser(generateRandomPassword())}
                      className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                    >
                      + Sandi Acak
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPasswordUser ? 'text' : 'password'}
                      value={passwordUser}
                      onChange={(e) => setPasswordUser(e.target.value)}
                      placeholder="Default: MediaFlow2026!"
                      className="w-full px-3 py-2 pr-8 border border-slate-300 rounded-lg font-mono text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordUser(!showPasswordUser)}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                      title={showPasswordUser ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
                    >
                      {showPasswordUser ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Jabatan *</label>
                  <input
                    type="text"
                    required
                    value={jabatanUser}
                    onChange={(e) => setJabatanUser(e.target.value)}
                    placeholder="Contoh: Account Executive"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Role Hak Akses *</label>
                  <select
                    value={roleIdUser}
                    onChange={(e) => setRoleIdUser(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  >
                    {roleMatrix.map((r: any) => (
                      <option key={r.id} value={r.id}>
                        {r.nama}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
                <p className="text-[11px] text-slate-500">
                  💡 Tips: Jika kolom kata sandi dikosongkan, pengguna akan diberikan sandi default <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-700 font-mono font-semibold">MediaFlow2026!</code>. Pengguna juga dapat mengubah sandinya mandiri di menu Profil.
                </p>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg flex items-center gap-2 transition-colors cursor-pointer shadow-xs shrink-0"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Daftarkan Pengguna</span>
                </button>
              </div>
            </form>
          )}

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="px-5 py-3.5 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-xs">Daftar Seluruh Pengguna Sistem ({users.length})</h3>
                <p className="text-[11px] text-slate-500">Seluruh akun yang terdaftar untuk autentikasi JWT di lingkungan VPS ini.</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <th className="py-3 px-4 text-left">Nama & Jabatan</th>
                    <th className="py-3 px-4 text-left">Email Login</th>
                    <th className="py-3 px-4 text-left">Role Sistem</th>
                    <th className="py-3 px-4 text-left">Tim Komersial</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-left font-mono">Login Terakhir</th>
                    {isSuperAdmin && <th className="py-3 px-4 text-right">Aksi Password & Akun</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {users.map((u: any) => (
                    <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{u.nama}</div>
                        <div className="text-slate-500 text-[11px]">{u.jabatan}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-blue-700">{u.email}</td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                          {u.role_nama}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{u.nama_tim || '-'}</td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            u.aktif !== 0
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {u.aktif !== 0 ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">{u.last_login || '-'}</td>
                      {isSuperAdmin && (
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedUserForReset(u);
                                setNewPasswordForReset(generateRandomPassword());
                              }}
                              className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                              title="Reset kata sandi pengguna ini"
                            >
                              <KeyRound className="w-3 h-3 text-amber-600" />
                              <span>Reset Sandi</span>
                            </button>

                            {u.id !== currentUser.id && (
                              <button
                                type="button"
                                onClick={() => handleToggleUserActive(u)}
                                className={`px-2 py-1.5 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer ${
                                  u.aktif !== 0
                                    ? 'border-slate-300 text-slate-600 hover:bg-slate-100'
                                    : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                                }`}
                                title={u.aktif !== 0 ? 'Nonaktifkan akun' : 'Aktifkan akun'}
                              >
                                {u.aktif !== 0 ? 'Nonaktifkan' : 'Aktifkan'}
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Modal Dialog: Reset Kata Sandi Pengguna */}
          {selectedUserForReset && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
              <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <KeyRound className="w-5 h-5 text-amber-400" />
                    <h3 className="font-bold text-sm">Reset Kata Sandi Pengguna</h3>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedUserForReset(null);
                      setNewPasswordForReset('');
                    }}
                    className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleExecuteResetPassword} className="p-6 space-y-4 text-xs">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <div className="font-semibold text-slate-900 text-sm">{selectedUserForReset.nama}</div>
                    <div className="font-mono text-slate-600 text-[11px]">{selectedUserForReset.email}</div>
                    <div className="text-[11px] text-blue-700 font-semibold">{selectedUserForReset.role_nama} · {selectedUserForReset.jabatan}</div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block font-semibold text-slate-700">Kata Sandi Baru (Min. 6 Karakter) *</label>
                      <button
                        type="button"
                        onClick={() => setNewPasswordForReset(generateRandomPassword())}
                        className="text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                      >
                        + Sandi Acak Kuat
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showNewPasswordReset ? 'text' : 'password'}
                        required
                        minLength={6}
                        value={newPasswordForReset}
                        onChange={(e) => setNewPasswordForReset(e.target.value)}
                        placeholder="Masukkan password baru untuk pengguna..."
                        className="w-full px-3.5 py-2.5 pr-10 border border-slate-300 rounded-xl font-mono text-xs focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPasswordReset(!showNewPasswordReset)}
                        className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                        title={showNewPasswordReset ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
                      >
                        {showNewPasswordReset ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Setelah kata sandi direset, pengguna dapat langsung login ke MediaFlow ERP menggunakan password baru ini. Anda akan diberikan kotak kredensial untuk menyalin sandi setelah disimpan.
                  </p>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedUserForReset(null);
                        setNewPasswordForReset('');
                      }}
                      className="px-4 py-2 border border-slate-300 hover:bg-slate-50 rounded-xl font-semibold text-slate-700 transition-colors cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={submittingPasswordReset || !newPasswordForReset.trim()}
                      className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold transition-colors cursor-pointer disabled:opacity-60 flex items-center gap-1.5 shadow-xs"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>{submittingPasswordReset ? 'Menyimpan...' : 'Terapkan Kata Sandi'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ====================================================================
          TAB G: SERVER VPS, MODE PEMELIHARAAN & MANAJEMEN DATABASE (SUPER ADMIN ONLY)
         ==================================================================== */}
      {subTab === 'system' && isSuperAdmin && (
        <div className="space-y-6 text-xs">
          {/* Top Bar Action */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Server className="w-4 h-4 text-rose-600" />
                Status Server VPS, Mode Pemeliharaan & Manajemen Database
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Pemantauan metrik server VPS, pengaktifan mode pemeliharaan darurat, unduh backup snapshot SQLite, dan optimasi storage.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={loadSystemStats}
                disabled={isLoadingStats}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingStats ? 'animate-spin' : ''}`} />
                {isLoadingStats ? 'Memuat...' : 'Refresh Metrik'}
              </button>
              <button
                type="button"
                onClick={handleSaveWebSettings}
                disabled={!canEditCompany || isSavingWebSettings}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                {isSavingWebSettings ? 'Menyimpan...' : 'Simpan Mode Pemeliharaan'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Maintenance Mode & Database Actions */}
            <div className="lg:col-span-7 space-y-6">
              {/* Maintenance Mode Card */}
              <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
                <div className="pb-3 border-b border-slate-200 flex items-center justify-between">
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    Mode Pemeliharaan Sistem (Maintenance Mode)
                  </div>
                  <label className="flex items-center gap-2 font-semibold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={maintenanceMode}
                      onChange={(e) => setMaintenanceMode(e.target.checked)}
                      className="w-4 h-4 text-rose-600 rounded"
                    />
                    <span className={maintenanceMode ? 'text-rose-600 font-bold' : ''}>
                      {maintenanceMode ? 'PEMELIHARAAN AKTIF' : 'Status: Normal (Nonaktif)'}
                    </span>
                  </label>
                </div>

                {maintenanceMode && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-rose-800 leading-relaxed text-[11px]">
                    <strong>Pemberitahuan Darurat:</strong> Saat mode ini aktif, seluruh pengguna operasional (Sales, Traffic, Finance, Client) yang mencoba login akan diblokir dengan kode HTTP 503 dan menampilkan pesan pemeliharaan di bawah. Hanya <strong>Super Admin & Admin</strong> yang tetap dapat masuk untuk melakukan konfigurasi.
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Pesan Pengumuman Pemeliharaan untuk Pengguna
                  </label>
                  <textarea
                    rows={3}
                    value={maintenanceMessage}
                    onChange={(e) => setMaintenanceMessage(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-800 leading-relaxed"
                    placeholder="Sistem MediaFlow ERP sedang dalam proses pemeliharaan rutin..."
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Pesan ini akan langsung muncul pada layar halaman login ketika mode pemeliharaan diaktifkan.
                  </p>
                </div>
              </div>

              {/* Database Actions: MariaDB / MySQL Production Engine */}
              <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
                <div className="pb-3 border-b border-slate-200 font-bold text-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-emerald-600" />
                    Integrasi & Migrasi Database MariaDB / MySQL (VPS Production)
                  </span>
                  <div className="flex items-center gap-2">
                    {dbStatus.is_mariadb_configured ? (
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        MariaDB Aktif ({dbStatus.host || '127.0.0.1'})
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                        <Info className="w-3 h-3 text-amber-600" />
                        SQLite Aktif (Mode Fallback / Pengujian)
                      </span>
                    )}
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                  <p className="text-xs text-slate-700 leading-relaxed">
                    Aplikasi ini mendukung arsitektur hybrid MariaDB &amp; SQLite. Untuk lingkungan produksi di VPS (xCloud), disarankan menghubungkan MariaDB lokal agar proses PM2 dapat berjalan dalam multi-worker tanpa risiko lock.
                  </p>

                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={handleDownloadMariaDBSchema}
                      disabled={isDownloadingMariaDBSchema}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer text-xs transition-colors shadow-xs"
                    >
                      <Download className={`w-3.5 h-3.5 ${isDownloadingMariaDBSchema ? 'animate-bounce' : ''}`} />
                      {isDownloadingMariaDBSchema ? 'Mengunduh...' : 'Unduh schema-mariadb.sql'}
                    </button>

                    <button
                      type="button"
                      onClick={handleTestMariaDBConnection}
                      disabled={isTestingMariaDB}
                      className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer text-xs transition-colors shadow-xs"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isTestingMariaDB ? 'animate-spin' : ''}`} />
                      {isTestingMariaDB ? 'Menguji Koneksi...' : 'Uji Koneksi MariaDB'}
                    </button>
                  </div>

                  {mariaDBTestResult && (
                    <div
                      className={`p-3 rounded-lg border text-xs flex items-start gap-2 ${
                        mariaDBTestResult.success
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                          : 'bg-rose-50 border-rose-200 text-rose-900'
                      }`}
                    >
                      {mariaDBTestResult.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="font-bold">{mariaDBTestResult.message}</div>
                        {mariaDBTestResult.version && (
                          <div className="text-[11px] text-slate-600 mt-0.5 font-mono">
                            Versi Server: {mariaDBTestResult.version}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="mt-3 p-3 bg-white border border-slate-200 rounded-md text-[11px] text-slate-600 space-y-1.5">
                    <div className="font-semibold text-slate-800">Langkah Migrasi ke MariaDB di VPS (xCloud):</div>
                    <ol className="list-decimal list-inside space-y-1 text-slate-600">
                      <li>Buka phpMyAdmin di VPS dan buat database baru (contoh: <code>pos_digdayamedi_db</code>).</li>
                      <li>Impor berkas <code>schema-mariadb.sql</code> melalui menu <strong>Import</strong> di phpMyAdmin.</li>
                      <li>Di VPS Anda, tambahkan kredensial di <code>.env</code>: <code>DB_TYPE="mariadb"</code>, <code>DB_HOST="127.0.0.1"</code>, <code>DB_USER="..."</code>, <code>DB_PASSWORD="..."</code>, <code>DB_NAME="..."</code>.</li>
                      <li>Lakukan redeploy atau restart server di xCloud.</li>
                    </ol>
                  </div>
                </div>
              </div>

              {/* Database Actions: Backup, Restore & Optimize */}
              <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
                <div className="pb-3 border-b border-slate-200 font-bold text-slate-900 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-blue-600" />
                    Operasi, Cadangan & Pemulihan Database SQLite
                  </span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                    mediaflow.db
                  </span>
                </div>

                {/* 1. Backup Download */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                      <Download className="w-4 h-4 text-blue-600" />
                      Unduh Snapshot Database SQLite (.db)
                    </div>
                    <p className="text-slate-500 text-[11px] leading-relaxed">
                      Download berkas binary <code>mediaflow.db</code> secara utuh untuk backup offline, arsip harian, atau migrasi ke VPS lain.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadDbBackup}
                    disabled={isDownloadingDb}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg flex items-center gap-1.5 shrink-0 cursor-pointer text-xs disabled:opacity-60 transition-colors"
                  >
                    <Download className={`w-3.5 h-3.5 ${isDownloadingDb ? 'animate-bounce' : ''}`} />
                    {isDownloadingDb ? 'Menyiapkan...' : 'Unduh Backup .db'}
                  </button>
                </div>

                {/* 2. Restore Database from Uploaded .db File */}
                <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="font-bold text-amber-950 flex items-center gap-1.5 text-xs">
                      <Upload className="w-4 h-4 text-amber-600" />
                      Pulihkan Database (Restore dari Berkas .db)
                    </div>
                    <p className="text-slate-600 text-[11px] leading-relaxed">
                      Unggah berkas snapshot cadangan sebelumnya untuk menggantikan isi database aktif. Salinan pengaman <code>.bak</code> otomatis dibuat sebelum proses penggantian.
                    </p>
                  </div>

                  <input
                    type="file"
                    ref={restoreFileInputRef}
                    accept=".db,.sqlite"
                    className="hidden"
                    onChange={handleSelectRestoreFile}
                  />

                  <button
                    type="button"
                    onClick={() => restoreFileInputRef.current?.click()}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg flex items-center gap-1.5 shrink-0 cursor-pointer text-xs transition-colors shadow-xs"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Pilih & Pulihkan .db
                  </button>
                </div>

                {/* 3. VACUUM & Rebuild Optimize */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                      <RefreshCw className="w-4 h-4 text-emerald-600" />
                      Optimasi Storage Database (VACUUM & PRAGMA)
                    </div>
                    <p className="text-slate-500 text-[11px] leading-relaxed">
                      Reorganisasi halaman SQLite untuk mengembalikan ruang disk yang terhapus dan mengoptimalkan kecepatan query database.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleOptimizeDb}
                    disabled={isOptimizingDb}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer text-xs disabled:opacity-60"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isOptimizingDb ? 'animate-spin' : ''}`} />
                    {isOptimizingDb ? 'Mengoptimasi...' : 'Jalankan VACUUM'}
                  </button>
                </div>
              </div>

              {/* Restore Confirmation Modal */}
              {showRestoreModal && restoreFile && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4">
                  <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95">
                    <div className="flex items-center gap-3 text-amber-600">
                      <div className="p-2.5 bg-amber-100 rounded-xl">
                        <AlertTriangle className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-base">Konfirmasi Pemulihan Database</h3>
                        <p className="text-xs text-slate-500">Tindakan ini memerlukan kehati-hatian tingkat tinggi</p>
                      </div>
                    </div>

                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Nama Berkas:</span>
                        <span className="font-semibold text-slate-900 font-mono">{restoreFile.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Ukuran Berkas:</span>
                        <span className="font-semibold text-slate-900">
                          {(restoreFile.size / (1024 * 1024)).toFixed(2)} MB ({restoreFile.size.toLocaleString()} bytes)
                        </span>
                      </div>
                    </div>

                    <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs space-y-2">
                      <p className="font-bold">⚠️ PERINGATAN KRUSIAL:</p>
                      <p className="text-[11px] leading-relaxed text-rose-800">
                        Memulihkan database akan <strong>mengganti seluruh data aktif saat ini</strong> (klien, penawaran, deal, media order, bukti tayang, invoice, dan pengaturan pengguna) dengan data yang ada di dalam berkas backup ini.
                      </p>
                      <p className="text-[11px] leading-relaxed text-emerald-800 font-medium">
                        🛡️ Sistem secara otomatis membuat berkas cadangan pengaman (<code>mediaflow.db.bak-[timestamp]</code>) di server sebelum proses restorasi dieksekusi.
                      </p>
                    </div>

                    <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100/80 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={restoreConfirmChecked}
                        onChange={(e) => setRestoreConfirmChecked(e.target.checked)}
                        className="mt-0.5 w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
                      />
                      <span className="text-xs text-slate-700 leading-snug font-medium">
                        Saya memahami risiko ini dan menyatakan setuju untuk mengganti database sistem aktif dengan berkas yang dipilih.
                      </span>
                    </label>

                    <div className="flex items-center justify-end gap-3 pt-2">
                      <button
                        type="button"
                        disabled={isRestoringDb}
                        onClick={() => {
                          setShowRestoreModal(false);
                          setRestoreFile(null);
                        }}
                        className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                      >
                        Batal
                      </button>

                      <button
                        type="button"
                        disabled={!restoreConfirmChecked || isRestoringDb}
                        onClick={handleExecuteRestore}
                        className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-xl transition-colors shadow-xs flex items-center gap-2"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRestoringDb ? 'animate-spin' : ''}`} />
                        {isRestoringDb ? 'Memulihkan Database...' : 'Ya, Pulihkan Sekarang'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Live VPS Server Metrics */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
                <div className="pb-3 border-b border-slate-200 font-bold text-slate-900 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-indigo-600" />
                    Spesifikasi Lingkungan VPS
                  </span>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-mono text-[10px] font-bold">
                    ONLINE
                  </span>
                </div>

                <div className="space-y-2.5 font-mono text-xs">
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Sistem Operasi / Arch:</span>
                    <span className="font-semibold text-slate-900">
                      {systemStats?.platform || 'linux'} ({systemStats?.arch || 'x64'})
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Runtime Node.js:</span>
                    <span className="font-semibold text-blue-700">
                      {systemStats?.node_version || 'v20.x LTS'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Waktu Uptime Server:</span>
                    <span className="font-semibold text-slate-900">
                      {systemStats?.uptime_seconds
                        ? `${Math.floor(systemStats.uptime_seconds / 3600)}j ${Math.floor((systemStats.uptime_seconds % 3600) / 60)}m ${systemStats.uptime_seconds % 60}d`
                        : 'Baru Dijalankan'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Memory RSS:</span>
                    <span className="font-semibold text-slate-900">
                      {systemStats?.memory_rss_mb || '45.2'} MB
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Memory Heap Used:</span>
                    <span className="font-semibold text-slate-900">
                      {systemStats?.memory_heap_mb || '28.1'} MB
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Ukuran Database SQLite:</span>
                    <span className="font-bold text-emerald-700">
                      {systemStats?.db_size_mb || '0.35'} MB
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-500">Berkas Database Aktif:</span>
                    <span className="font-semibold text-slate-800 text-[10px] truncate max-w-[200px]">
                      {systemStats?.db_path || 'mediaflow.db'}
                    </span>
                  </div>
                </div>

                {/* Record Counts Grid */}
                <div className="pt-2">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Jumlah Baris Data Tersimpan
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 bg-slate-50 rounded border border-slate-200">
                      <div className="text-base font-bold text-slate-900">
                        {systemStats?.counts?.users ?? users.length}
                      </div>
                      <div className="text-[10px] text-slate-500">Pengguna</div>
                    </div>
                    <div className="p-2 bg-slate-50 rounded border border-slate-200">
                      <div className="text-base font-bold text-slate-900">
                        {systemStats?.counts?.quotations ?? '-'}
                      </div>
                      <div className="text-[10px] text-slate-500">Quotation</div>
                    </div>
                    <div className="p-2 bg-slate-50 rounded border border-slate-200">
                      <div className="text-base font-bold text-slate-900">
                        {systemStats?.counts?.deals ?? '-'}
                      </div>
                      <div className="text-[10px] text-slate-500">Deal Paket</div>
                    </div>
                    <div className="p-2 bg-slate-50 rounded border border-slate-200">
                      <div className="text-base font-bold text-slate-900">
                        {systemStats?.counts?.media_orders ?? '-'}
                      </div>
                      <div className="text-[10px] text-slate-500">Media Order</div>
                    </div>
                    <div className="p-2 bg-slate-50 rounded border border-slate-200">
                      <div className="text-base font-bold text-slate-900">
                        {systemStats?.counts?.invoices ?? '-'}
                      </div>
                      <div className="text-[10px] text-slate-500">Invoice</div>
                    </div>
                    <div className="p-2 bg-slate-50 rounded border border-slate-200">
                      <div className="text-base font-bold text-slate-900">
                        {systemStats?.counts?.audit_logs ?? '-'}
                      </div>
                      <div className="text-[10px] text-slate-500">Audit Log</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* VPS Cron & Systemd Instruction */}
              <div className="bg-slate-900 text-slate-200 rounded-lg p-5 space-y-3 font-mono text-[11px]">
                <div className="font-bold text-slate-400 text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-blue-400" />
                  Rekomendasi Service & Cron VPS
                </div>
                <div className="text-[10px] text-slate-400 leading-relaxed">
                  Restart service di VPS:
                </div>
                <pre className="p-2 bg-slate-800 rounded text-emerald-400 text-[10px]">
sudo systemctl restart mediaflow
                </pre>
                <div className="text-[10px] text-slate-400 leading-relaxed">
                  Backup otomatis berkala via cron job:
                </div>
                <pre className="p-2 bg-slate-800 rounded text-blue-300 text-[10px]">
0 2 * * * cp mediaflow.db /backups/db-$(date +\%F).db
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

