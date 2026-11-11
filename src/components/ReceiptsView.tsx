import React, { useState, useEffect, useMemo } from 'react';
import {
  ReceiptText,
  Plus,
  Search,
  Filter,
  Printer,
  Copy,
  Check,
  Download,
  Calendar,
  Building2,
  DollarSign,
  TrendingUp,
  FileCheck2,
  CreditCard,
  Banknote,
  AlertCircle,
  ExternalLink,
  X,
  RefreshCw,
} from 'lucide-react';
import {
  formatRupiah,
  formatDateId,
  terbilangRupiah,
  exportToCsv,
  RolePerm,
  checkPerm,
} from '../utils/format';
interface ReceiptsModuleProps {
  currentUser: any;
  permissions: RolePerm[];
  invoices: Array<Record<string, any>>;
  companySettings?: Record<string, any>;
  apiGet?: (url: string) => Promise<any>;
  apiPost?: (url: string, body: any) => Promise<any>;
  showToast?: (msg: string) => void;
  onRefresh: () => void;
  onOpenPrintModal: (receiptData: Record<string, any>) => void;
}

export const ReceiptsModule: React.FC<ReceiptsModuleProps> = ({
  currentUser,
  permissions,
  invoices,
  companySettings,
  apiGet,
  apiPost,
  showToast,
  onRefresh,
  onOpenPrintModal,
}) => {
  const [receipts, setReceipts] = useState<Array<Record<string, any>>>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState<'semua' | 'hari' | 'pekan' | 'bulan' | 'custom'>('semua');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Create Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | ''>('');
  const [tanggalBayar, setTanggalBayar] = useState(new Date().toISOString().split('T')[0]);
  const [jumlahBayar, setJumlahBayar] = useState<number | ''>('');
  const [metodeBayar, setMetodeBayar] = useState('Transfer Bank Mandiri');
  const [referensiBank, setReferensiBank] = useState('');
  const [untukPembayaran, setUntukPembayaran] = useState('');
  const [catatan, setCatatan] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const canCreate =
    checkPerm(permissions, 'payments', 'create') ||
    currentUser.role_id === 1 ||
    currentUser.role_kode === 'super_admin' ||
    currentUser.role_kode === 'finance';

  const loadReceipts = async () => {
    if (!apiGet) return;
    setLoading(true);
    try {
      const res = await apiGet('/api/receipts');
      if (res?.receipts) {
        setReceipts(res.receipts);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReceipts();
  }, []);

  // Filter receipts
  const filteredReceipts = useMemo(() => {
    return receipts.filter((r) => {
      // Search
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        String(r.nomor_kwitansi || '').toLowerCase().includes(q) ||
        String(r.nomor_invoice || '').toLowerCase().includes(q) ||
        String(r.snapshot_nama_klien || r.nama_klien || '').toLowerCase().includes(q) ||
        String(r.referensi_bank || '').toLowerCase().includes(q) ||
        String(r.untuk_pembayaran || '').toLowerCase().includes(q);

      // Method
      const matchMethod =
        methodFilter === 'ALL' ||
        String(r.metode || '').toLowerCase().includes(methodFilter.toLowerCase());

      // Date
      let matchDate = true;
      if (dateFilter !== 'semua' && r.tanggal_bayar) {
        const itemDate = new Date(r.tanggal_bayar);
        const now = new Date();
        if (dateFilter === 'hari') {
          matchDate = itemDate.toDateString() === now.toDateString();
        } else if (dateFilter === 'pekan') {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(now.getDate() - 7);
          matchDate = itemDate >= sevenDaysAgo && itemDate <= now;
        } else if (dateFilter === 'bulan') {
          matchDate =
            itemDate.getFullYear() === now.getFullYear() &&
            itemDate.getMonth() === now.getMonth();
        } else if (dateFilter === 'custom') {
          if (customStartDate && customEndDate) {
            const start = new Date(customStartDate);
            const end = new Date(customEndDate);
            end.setHours(23, 59, 59, 999);
            matchDate = itemDate >= start && itemDate <= end;
          }
        }
      }

      return matchSearch && matchMethod && matchDate;
    });
  }, [receipts, searchQuery, methodFilter, dateFilter, customStartDate, customEndDate]);

  // Highlight Metrics
  const totalCount = receipts.length;
  const totalDanaDiterima = receipts.reduce((acc, r) => acc + Number(r.jumlah || 0), 0);
  
  const currentMonthReceipts = receipts.filter((r) => {
    if (!r.tanggal_bayar) return false;
    const d = new Date(r.tanggal_bayar);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  const totalBulanIni = currentMonthReceipts.reduce((acc, r) => acc + Number(r.jumlah || 0), 0);
  const avgTransaksi = totalCount > 0 ? Math.round(totalDanaDiterima / totalCount) : 0;

  // Unpaid or partially paid invoices available for creating a receipt
  const pendingInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const sisa = Number(inv.total_tagihan || 0) - Number(inv.total_dibayar || 0);
      return sisa > 0 || inv.status !== 'Lunas';
    });
  }, [invoices]);

  const handleSelectInvoice = (invId: number) => {
    setSelectedInvoiceId(invId);
    const target = invoices.find((inv) => inv.id === invId);
    if (target) {
      const sisa = Math.max(0, Number(target.total_tagihan || 0) - Number(target.total_dibayar || 0));
      setJumlahBayar(sisa > 0 ? sisa : Number(target.total_tagihan || 0));
      setUntukPembayaran(
        `Pembayaran Invoice #${target.nomor}${
          target.nama_kampanye ? ` — Kampanye ${target.nama_kampanye}` : ''
        }`
      );
    }
  };

  const handleCreateReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceId || !jumlahBayar || Number(jumlahBayar) <= 0) {
      showToast?.('Pilih invoice dan isi nominal pembayaran dengan benar.');
      return;
    }

    if (!apiPost) return;
    setSubmitting(true);
    try {
      const res = await apiPost('/api/receipts', {
        invoice_id: selectedInvoiceId,
        tanggal_bayar: tanggalBayar,
        jumlah: Number(jumlahBayar),
        metode: metodeBayar,
        referensi_bank: referensiBank,
        untuk_pembayaran: untukPembayaran,
        catatan,
      });

      if (res?.success) {
        showToast?.(`Kwitansi ${res.nomor_kwitansi} berhasil diterbitkan!`);
        setIsModalOpen(false);
        // Reset form
        setSelectedInvoiceId('');
        setJumlahBayar('');
        setReferensiBank('');
        setUntukPembayaran('');
        setCatatan('');

        // Reload data
        await loadReceipts();
        onRefresh();

        // Find created receipt and offer immediate print
        const targetInv = invoices.find((inv) => inv.id === selectedInvoiceId);
        onOpenPrintModal({
          nomor_kwitansi: res.nomor_kwitansi,
          tanggal_bayar: tanggalBayar,
          jumlah: Number(jumlahBayar),
          metode: metodeBayar,
          referensi_bank: referensiBank,
          untuk_pembayaran: untukPembayaran,
          catatan,
          status: 'Diterima',
          nomor_invoice: targetInv?.nomor,
          nama_kampanye: targetInv?.nama_kampanye,
          nomor_deal: targetInv?.nomor_deal,
          snapshot_nama_klien: targetInv?.snapshot_nama_klien,
          snapshot_alamat: targetInv?.snapshot_alamat,
          snapshot_npwp: targetInv?.snapshot_npwp,
          snapshot_pic: targetInv?.snapshot_pic,
          total_tagihan_invoice: targetInv?.total_tagihan,
          nama_pencatat: currentUser.nama,
          jabatan_pencatat: currentUser.jabatan,
        });
      }
    } catch (err: any) {
      showToast?.('Gagal menerbitkan kwitansi: ' + (err.message || 'Terjadi kesalahan'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyReceiptText = (r: Record<string, any>) => {
    const text = `BUKTI KWITANSI PEMBAYARAN:
No. Kwitansi : ${r.nomor_kwitansi || '-'}
Tanggal      : ${formatDateId(r.tanggal_bayar)}
Diterima Dari: ${r.snapshot_nama_klien || r.nama_klien || '-'}
Jumlah       : ${formatRupiah(r.jumlah)} (${terbilangRupiah(r.jumlah)})
Untuk        : ${r.untuk_pembayaran || `Invoice #${r.nomor_invoice}`}
Metode Bayar : ${r.metode} (Ref: ${r.referensi_bank || '-'})
Status       : LUNAS / DITERIMA`;

    navigator.clipboard.writeText(text);
    setCopiedId(r.id);
    setTimeout(() => setCopiedId(null), 2500);
    showToast?.(`Ringkasan Kwitansi ${r.nomor_kwitansi} disalin ke clipboard.`);
  };

  return (
    <div className="space-y-6 text-xs">
      {/* 1. TOP HEADER & METRICS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <ReceiptText className="w-6 h-6 text-emerald-600" />
            Kwitansi Bukti Pembayaran (Official Receipts)
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Dokumentasi resmi tanda terima pembayaran dari klien atas invoice yang telah lunas atau terbayar sebagian.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() =>
              exportToCsv(
                `kwitansi_pembayaran_${new Date().toISOString().split('T')[0]}.csv`,
                filteredReceipts.map((r) => ({
                  Nomor_Kwitansi: r.nomor_kwitansi,
                  Tanggal_Bayar: r.tanggal_bayar,
                  Klien: r.snapshot_nama_klien || r.nama_klien,
                  Nomor_Invoice: r.nomor_invoice,
                  Jumlah_Diterima: r.jumlah,
                  Metode: r.metode,
                  Referensi_Bank: r.referensi_bank,
                  Untuk_Pembayaran: r.untuk_pembayaran,
                  Dicatat_Oleh: r.nama_pencatat,
                  Status: r.status || 'Diterima',
                }))
              )
            }
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ekspor CSV</span>
          </button>

          {canCreate && (
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Terbitkan Kwitansi Baru</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. METRIC STRIP */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="font-semibold text-slate-600">Total Kwitansi Terbit</span>
            <ReceiptText className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900">{totalCount}</div>
          <p className="text-[11px] text-slate-500 mt-1">Seluruh bukti transaksi pembayaran</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="font-semibold text-slate-600">Total Dana Masuk</span>
            <DollarSign className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-700">
            {formatRupiah(totalDanaDiterima)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Akumulasi penerimaan kas & bank</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="font-semibold text-slate-600">Penerimaan Bulan Ini</span>
            <TrendingUp className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-indigo-700">
            {formatRupiah(totalBulanIni)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">{currentMonthReceipts.length} transaksi di bulan ini</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="font-semibold text-slate-600">Rata-rata Transaksi</span>
            <Banknote className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-800">
            {formatRupiah(avgTransaksi)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Nilai per kwitansi pembayaran</p>
        </div>
      </div>

      {/* 3. TOOLBAR & FILTER */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari no. kwitansi, no. invoice, nama klien, atau bank..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 focus:bg-white border border-slate-300 rounded-lg text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <span className="font-semibold text-slate-600">Metode:</span>
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs cursor-pointer"
              >
                <option value="ALL">Semua Metode</option>
                <option value="Mandiri">Bank Mandiri</option>
                <option value="BCA">Bank BCA</option>
                <option value="BRI">Bank BRI</option>
                <option value="BNI">Bank BNI</option>
                <option value="Virtual Account">Virtual Account</option>
                <option value="Cek">Cek / Giro</option>
                <option value="Tunai">Tunai / Kas</option>
              </select>
            </div>

            <div className="flex items-center rounded-lg border border-slate-300 p-0.5 bg-slate-100">
              {[
                { id: 'semua', label: 'Semua' },
                { id: 'hari', label: 'Hari Ini' },
                { id: 'pekan', label: '7 Hari' },
                { id: 'bulan', label: 'Bulan Ini' },
                { id: 'custom', label: 'Custom' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setDateFilter(f.id as any)}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                    dateFilter === f.id
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={loadReceipts}
              className="p-2 border border-slate-300 hover:bg-slate-50 rounded-lg text-slate-600 cursor-pointer"
              title="Muat ulang data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {dateFilter === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-200">
            <div className="flex items-center gap-2">
              <label className="text-slate-600 font-medium">Dari:</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-slate-600 font-medium">Sampai:</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono"
              />
            </div>
          </div>
        )}
      </div>

      {/* 4. TABEL DAFTAR KWITANSI */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-xs">
              Daftar Kwitansi & Tanda Terima Pembayaran ({filteredReceipts.length})
            </h3>
            <p className="text-[11px] text-slate-500">
              Dokumen resmi bukti penerimaan dana dari klien pengiklan.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <th className="py-3 px-4 text-left">No. Kwitansi</th>
                <th className="py-3 px-4 text-left">Tanggal Bayar</th>
                <th className="py-3 px-4 text-left">Diterima Dari (Klien)</th>
                <th className="py-3 px-4 text-left">Ref. Invoice & Kampanye</th>
                <th className="py-3 px-4 text-left">Metode & Ref Bank</th>
                <th className="py-3 px-4 text-right">Nominal Diterima</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredReceipts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <ReceiptText className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    Belum ada data kwitansi pembayaran yang tercatat sesuai filter.
                  </td>
                </tr>
              ) : (
                filteredReceipts.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        {r.nomor_kwitansi || `KWT-${r.id}`}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {formatDateId(r.tanggal_bayar)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">
                        {r.snapshot_nama_klien || r.nama_klien || 'Pihak Klien'}
                      </div>
                      {r.snapshot_pic && (
                        <div className="text-[11px] text-slate-500">PIC: {r.snapshot_pic}</div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">
                        Invoice: <span className="font-mono text-blue-600">{r.nomor_invoice || '-'}</span>
                      </div>
                      {r.nama_kampanye && (
                        <div className="text-[11px] text-slate-500 truncate max-w-xs">
                          {r.nama_kampanye}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{r.metode || 'Transfer Bank'}</div>
                      <div className="text-[11px] font-mono text-slate-500">
                        Ref: {r.referensi_bank || '-'}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="font-mono font-bold text-emerald-700 text-sm">
                        {formatRupiah(r.jumlah)}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        ✓ Lunas
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onOpenPrintModal(r)}
                          className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-300 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                          title="Cetak Kwitansi Resmi"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Cetak Kwitansi</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCopyReceiptText(r)}
                          className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors cursor-pointer"
                          title="Salin rincian kwitansi"
                        >
                          {copiedId === r.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. MODAL TERBITKAN KWITANSI BARU */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ReceiptText className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="font-bold text-sm">Terbitkan Kwitansi Bukti Pembayaran</h3>
                  <p className="text-[11px] text-slate-400">
                    Catat penerimaan kas / bank dan terbitkan nomor kwitansi resmi.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateReceipt} className="p-6 space-y-4 text-xs">
              {/* Pilih Invoice */}
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Pilih Invoice Referensi *
                </label>
                <select
                  required
                  value={selectedInvoiceId}
                  onChange={(e) => handleSelectInvoice(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white cursor-pointer text-xs"
                >
                  <option value="">-- Pilih Invoice yang Akan Dibayar --</option>
                  {pendingInvoices.map((inv) => {
                    const sisa = Math.max(0, Number(inv.total_tagihan || 0) - Number(inv.total_dibayar || 0));
                    return (
                      <option key={inv.id} value={inv.id}>
                        {inv.nomor} — {inv.snapshot_nama_klien} (Total: {formatRupiah(inv.total_tagihan)} | Sisa: {formatRupiah(sisa)}) [{inv.status}]
                      </option>
                    );
                  })}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Memilih invoice akan otomatis mengisi data klien dan sisa tagihan yang harus dibayar.
                </p>
              </div>

              {/* Tanggal & Jumlah Bayar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Tanggal Bayar Diterima *</label>
                  <input
                    type="date"
                    required
                    value={tanggalBayar}
                    onChange={(e) => setTanggalBayar(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Jumlah Nominal Diterima (Rp) *</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={jumlahBayar}
                    onChange={(e) => setJumlahBayar(Number(e.target.value) || '')}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-xs font-bold text-slate-900"
                  />
                </div>
              </div>

              {/* Terbilang Preview */}
              {Number(jumlahBayar) > 0 && (
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px]">
                  <span className="text-slate-500 block">Terbilang:</span>
                  <span className="font-bold italic text-slate-800">
                    # {terbilangRupiah(Number(jumlahBayar))} #
                  </span>
                </div>
              )}

              {/* Metode Bayar & Ref Bank */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Metode Pembayaran *</label>
                  <select
                    value={metodeBayar}
                    onChange={(e) => setMetodeBayar(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white cursor-pointer text-xs"
                  >
                    <option value="Transfer Bank Mandiri">Transfer Bank Mandiri Giro</option>
                    <option value="Transfer Bank BCA">Transfer Bank BCA</option>
                    <option value="Transfer Bank BRI">Transfer Bank BRI</option>
                    <option value="Transfer Bank BNI">Transfer Bank BNI</option>
                    <option value="Virtual Account">Virtual Account</option>
                    <option value="Cek / Bilyet Giro">Cek / Bilyet Giro</option>
                    <option value="Tunai / Kas Langsung">Tunai / Kas Langsung</option>
                    <option value="Kartu Kredit Corporate">Kartu Kredit Corporate</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">No. Referensi / Bukti Bank *</label>
                  <input
                    type="text"
                    required
                    value={referensiBank}
                    onChange={(e) => setReferensiBank(e.target.value)}
                    placeholder="Contoh: TRX-BCA-981729 atau No. Cek"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-xs"
                  />
                </div>
              </div>

              {/* Keterangan Untuk Pembayaran */}
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Keterangan Untuk Pembayaran *
                </label>
                <textarea
                  required
                  rows={2}
                  value={untukPembayaran}
                  onChange={(e) => setUntukPembayaran(e.target.value)}
                  placeholder="Contoh: Pembayaran Pelunasan Invoice #INV/2026/11/0001 — Kampanye Telkomsel 5G Speed Fest"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              {/* Catatan Tambahan */}
              <div>
                <label className="block font-medium text-slate-700 mb-1">Catatan Tambahan (Opsional)</label>
                <input
                  type="text"
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  placeholder="Contoh: Pembayaran telah dikonfirmasi oleh Finance"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold rounded-lg flex items-center gap-2 cursor-pointer shadow-xs"
                >
                  {submitting ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Printer className="w-3.5 h-3.5" />
                  )}
                  <span>{submitting ? 'Memproses...' : 'Terbitkan & Cetak Kwitansi'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
