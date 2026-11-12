import React, { useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Layers,
  Plus,
  Printer,
  Receipt,
  Trash2,
} from 'lucide-react';
import {
  formatRupiah,
  formatDateId,
  checkPerm,
  RolePerm,
  getStatusSemanticColor,
} from '../utils/format';
import { PrintableDocType } from './PrintDocumentModal';

interface DealCommandCenterProps {
  deals: Array<Record<string, any>>;
  selectedDealId: number | null;
  onSelectDeal: (id: number | null) => void;
  permissions: RolePerm[];
  currentUser?: any;
  apiDelete?: (url: string) => Promise<any>;
  showToast?: (msg: string) => void;
  onRefresh?: () => void;
  onCreateMoFromDeal: (deal: Record<string, any>) => void;
  onCreateInvoiceFromDeal: (deal: Record<string, any>) => void;
  onPrintDocument: (type: PrintableDocType, data: Record<string, any>) => void;
}

export const DealCommandCenter: React.FC<DealCommandCenterProps> = ({
  deals,
  selectedDealId,
  onSelectDeal,
  permissions,
  currentUser,
  apiDelete,
  showToast,
  onRefresh,
  onCreateMoFromDeal,
  onCreateInvoiceFromDeal,
  onPrintDocument,
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const isManager =
    currentUser?.role_id === 1 ||
    ['super_admin', 'admin', 'direktur', 'manager'].includes(currentUser?.role_kode);

  const canCreateMo = checkPerm(permissions, 'media_orders', 'create');
  const canCreateInvoice = checkPerm(permissions, 'invoices', 'create');

  const activeDeal = selectedDealId ? deals.find((d) => d.id === selectedDealId) : null;

  // ============================================================================
  // LAYAR KUNCI 6.2: DETAIL DEAL (Pusat Kendali Kuota, MO, Bukti Tayang & Invoice)
  // ============================================================================
  if (activeDeal) {
    const rk = activeDeal.ringkasan_kuota || {
      dibeli: 0,
      sudah_tayang: 0,
      terjadwal: 0,
      belum_dijadwalkan: 0,
      persen_progres: 0,
    };
    const keu = activeDeal.keuangan || {
      nilai_deal: activeDeal.nilai_deal,
      nilai_tertagih: 0,
      nilai_terbayar: 0,
      sisa_belum_tertagih: activeDeal.nilai_deal,
    };

    const skemaLabel =
      activeDeal.skema_tagih === 'per_mo'
        ? 'Per Media Order (MO)'
        : activeDeal.skema_tagih === 'termin'
        ? 'Termin di Level Deal'
        : 'Sekali Tagih di Akhir';

    return (
      <div className="space-y-6">
        {/* Top Action Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <button
            onClick={() => onSelectDeal(null)}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 self-start cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Daftar Paket Deal
          </button>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => onPrintDocument('DEAL_PROGRESS', activeDeal)}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Cetak Laporan Progres (A4 Landscape)
            </button>
            {canCreateMo && (
              <button
                onClick={() => onCreateMoFromDeal(activeDeal)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Buat Media Order (MO)
              </button>
            )}
            {canCreateInvoice && (
              <button
                onClick={() => onCreateInvoiceFromDeal(activeDeal)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Receipt className="w-3.5 h-3.5" />
                Buat Invoice Tagihan
              </button>
            )}
            {isManager && (
              <button
                type="button"
                onClick={async () => {
                  const confirmed = window.confirm(
                    `Peringatan Otorisasi Manajer:\n\nApakah Anda yakin ingin MENGHAPUS Deal #${activeDeal.nomor} ("${activeDeal.nama_kampanye}")?\n\nPerhatian:\n- Deal yang memiliki Media Order atau Invoice aktif tidak dapat dihapus.\n- Seluruh alokasi kuota dan histori deal ini akan dihapus permanen.\n- Tindakan ini dicatat di Audit Trail.`
                  );
                  if (!confirmed) return;
                  try {
                    if (apiDelete) {
                      await apiDelete(`/api/deals/${activeDeal.id}`);
                      showToast?.(`Deal #${activeDeal.nomor} berhasil dihapus.`);
                      onSelectDeal(null);
                      onRefresh?.();
                    }
                  } catch (err: any) {
                    showToast?.(`Gagal menghapus Deal: ${err?.message || 'Terjadi kesalahan sistem'}`);
                  }
                }}
                className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Hapus Deal Ini (Otorisasi Minimal Manajer)"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Hapus Deal
              </button>
            )}
          </div>
        </div>

        {/* 1. HEADER DETAIL DEAL */}
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="text-xs text-slate-500 font-mono">
                <span className="font-bold text-blue-700">{activeDeal.nomor}</span>
                {' · '}
                <span>Ref. Quotation: {activeDeal.nomor_quotation}</span>
                {' · '}
                <span>No. PO Klien: {activeDeal.no_po_klien || '-'}</span>
                {' · '}
                <span className={getStatusSemanticColor(activeDeal.status)}>Status: {activeDeal.status}</span>
              </div>
              <h1 className="text-xl font-bold text-slate-900">{activeDeal.nama_kampanye}</h1>
              <div className="text-xs text-slate-600">
                Klien: <span className="font-semibold text-slate-900">{activeDeal.snapshot_nama_klien}</span>
                {' · '}
                Pemilik (Sales): <span className="font-semibold text-slate-900">{activeDeal.nama_sales}</span>
                {' · '}
                Skema Tagih: <span className="font-semibold text-slate-900">{skemaLabel}</span>
                {' · '}
                Masa Berlaku: <span className="font-mono">{formatDateId(activeDeal.mulai_kontrak)} s/d {formatDateId(activeDeal.berlaku_sampai)}</span>
              </div>
            </div>

            <div className="text-left lg:text-right font-mono shrink-0">
              <div className="text-xs text-slate-500 font-sans">Nilai Kontrak Deal (Inc. PPN 11%)</div>
              <div className="text-2xl font-bold text-slate-900 mt-0.5">{formatRupiah(activeDeal.nilai_deal)}</div>
              <div className="text-xs text-emerald-700 font-semibold mt-1">
                Progres Penayangan: {rk.persen_progres}% ({rk.sudah_tayang}/{rk.dibeli} item tayang)
              </div>
            </div>
          </div>
        </div>

        {/* 2. RINGKASAN PROGRES KUOTA PER BARIS (Dibeli = Sudah Tayang + Terjadwal + Belum Dijadwalkan) */}
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-200">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                Tabel Kuota & Realisasi Penayangan per Baris Item
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Dihitung otomatis secara real-time dari status item pada seluruh Media Order (MO) aktif
              </p>
            </div>
            <div className="text-xs font-mono text-slate-600">
              Total Kuota: <strong>{rk.dibeli}</strong> · Tayang: <strong className="text-emerald-700">{rk.sudah_tayang}</strong> · Terjadwal: <strong className="text-amber-700">{rk.terjadwal}</strong> · Sisa: <strong>{rk.belum_dijadwalkan}</strong>
            </div>
          </div>

          <div className="overflow-x-auto mt-3">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 bg-slate-50">
                  <th className="py-2.5 px-3 text-left">Baris Produk / Media</th>
                  <th className="py-2.5 px-3 text-left">Tipe Kuota</th>
                  <th className="py-2.5 px-3 text-right font-mono">Harga Satuan Deal</th>
                  <th className="py-2.5 px-3 text-right font-mono">Dibeli</th>
                  <th className="py-2.5 px-3 text-right font-mono">Sudah Tayang</th>
                  <th className="py-2.5 px-3 text-right font-mono">Terjadwal</th>
                  <th className="py-2.5 px-3 text-right font-mono">Belum Dijadwalkan</th>
                  <th className="py-2.5 px-3 text-left w-48">Bilah Progres</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(activeDeal.items || []).map((item: any) => (
                  <tr key={item.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-900">{item.nama_produk}</div>
                      <div className="text-[11px] text-slate-500">
                        {item.kategori} · Target: {item.target_kpi || '-'} · Periode: {item.periode}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-slate-600 capitalize">{item.tipe_kuota}</td>
                    <td className="py-3 px-3 text-right font-mono">{formatRupiah(item.harga_satuan)}</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                      {item.qty_dibeli} {item.satuan}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-semibold text-emerald-700">
                      {item.sudah_tayang} {item.satuan}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-semibold text-amber-700">
                      {item.terjadwal} {item.satuan}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-semibold text-slate-700">
                      {item.belum_dijadwalkan} {item.satuan}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-full h-2 bg-slate-100 rounded-xs overflow-hidden flex">
                          <div
                            style={{
                              width: `${item.qty_dibeli > 0 ? (item.sudah_tayang / item.qty_dibeli) * 100 : 0}%`,
                            }}
                            className="bg-emerald-600 h-full"
                          />
                          <div
                            style={{
                              width: `${item.qty_dibeli > 0 ? (item.terjadwal / item.qty_dibeli) * 100 : 0}%`,
                            }}
                            className="bg-amber-500 h-full"
                          />
                        </div>
                        <span className="font-mono font-bold text-slate-800 w-9 text-right">
                          {item.persen_tayang}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 3. DAFTAR MEDIA ORDER (MO) & 4. PANEL PENAGIHAN (INVOICE) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Daftar MO Milik Deal */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Daftar Media Order (MO) pada Deal Ini
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Setiap MO mengambil sebagian kuota Deal sesuai gelombang jadwal terbit
                </p>
              </div>
              {canCreateMo && (
                <button
                  onClick={() => onCreateMoFromDeal(activeDeal)}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-md flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Buat MO Baru
                </button>
              )}
            </div>

            {(activeDeal.media_orders || []).length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                Belum ada Media Order untuk Deal ini. Klik tombol <strong>Buat MO Baru</strong> untuk menjadwalkan penayangan.
              </div>
            ) : (
              <div className="divide-y divide-slate-200 mt-2">
                {activeDeal.media_orders.map((mo: any) => (
                  <div key={mo.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-mono font-bold text-blue-700">{mo.nomor}</span>
                        <span>·</span>
                        <span className="font-semibold text-slate-900">{mo.nama_kampanye}</span>
                        <span>·</span>
                        <span className={getStatusSemanticColor(mo.status)}>{mo.status}</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1 font-mono">
                        Jenis: {mo.jenis} · Periode: {formatDateId(mo.periode_mulai)} s/d {formatDateId(mo.periode_selesai)} · Progres Item:{' '}
                        <strong className="text-slate-900">
                          {mo.tayang_qty}/{mo.total_qty} tayang
                        </strong>
                      </div>
                    </div>

                    <button
                      onClick={() =>
                        onPrintDocument('MEDIA_ORDER', {
                          ...mo,
                          nomor_deal: activeDeal.nomor,
                          nomor_quotation: activeDeal.nomor_quotation,
                          snapshot_nama_klien: activeDeal.snapshot_nama_klien,
                        })
                      }
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded flex items-center gap-1.5 self-start sm:self-center cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      PDF MO
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Panel Penagihan & Keuangan Deal */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Panel Tertagih vs Belum Tertagih
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">Skema Tagih: {skemaLabel}</p>
                </div>
                {canCreateInvoice && (
                  <button
                    onClick={() => onCreateInvoiceFromDeal(activeDeal)}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Buat Invoice
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 my-4 font-mono text-xs">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                  <div className="text-slate-500 font-sans">Nilai Kontrak Deal</div>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">{formatRupiah(keu.nilai_deal)}</div>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                  <div className="text-slate-500 font-sans">Sudah Tertagih</div>
                  <div className="text-sm font-bold text-blue-700 mt-0.5">{formatRupiah(keu.nilai_tertagih)}</div>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                  <div className="text-slate-500 font-sans">Sudah Dibayar Lunas</div>
                  <div className="text-sm font-bold text-emerald-700 mt-0.5">{formatRupiah(keu.nilai_terbayar)}</div>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                  <div className="text-slate-500 font-sans">Sisa Belum Ditagih</div>
                  <div className="text-sm font-bold text-amber-700 mt-0.5">
                    {formatRupiah(keu.sisa_belum_tertagih)}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-700">Riwayat Invoice Deal Ini:</div>
                {(activeDeal.invoices || []).length === 0 ? (
                  <div className="text-xs text-slate-500 py-3">Belum ada invoice yang diterbitkan.</div>
                ) : (
                  <div className="divide-y divide-slate-200">
                    {activeDeal.invoices.map((inv: any) => (
                      <div key={inv.id} className="py-2.5 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-mono font-bold text-slate-900">{inv.nomor}</div>
                          <div className="text-slate-500">
                            Jatuh Tempo: {formatDateId(inv.jatuh_tempo)} ·{' '}
                            <span className={getStatusSemanticColor(inv.status)}>{inv.status}</span>
                          </div>
                        </div>
                        <div className="text-right font-mono">
                          <div className="font-bold text-slate-900">{formatRupiah(inv.total_tagihan)}</div>
                          <div className="text-[11px] text-emerald-700">
                            Bayar: {formatRupiah(inv.total_dibayar)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 5. GARIS WAKTU DOKUMEN TERKAIT (Document Chain Timeline) */}
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <h2 className="text-base font-bold text-slate-900 pb-3 border-b border-slate-200">
            Garis Waktu Rantai Dokumen (Quotation → Deal → MO → Bukti Tayang → Invoice)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 pt-4 text-xs">
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded space-y-1">
              <div className="text-slate-500 font-medium">1. Quotation Asal</div>
              <div className="font-mono font-bold text-slate-900">{activeDeal.nomor_quotation}</div>
              <div className="text-emerald-700 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Status: Deal
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded space-y-1">
              <div className="text-slate-500 font-medium">2. Paket Deal Induk</div>
              <div className="font-mono font-bold text-blue-700">{activeDeal.nomor}</div>
              <div className="text-slate-700">{ (activeDeal.items || []).length } baris kuota kontrak</div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded space-y-1">
              <div className="text-slate-500 font-medium">3. Media Order (MO)</div>
              <div className="font-mono font-bold text-slate-900">
                {(activeDeal.media_orders || []).length} Dokumen MO
              </div>
              <div className="text-slate-600">
                {(activeDeal.media_orders || []).map((m: any) => m.nomor).join(', ') || 'Belum dibuat'}
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded space-y-1">
              <div className="text-slate-500 font-medium">4. Bukti Tayang</div>
              <div className="font-mono font-bold text-slate-900">
                {(activeDeal.proofs || []).length} Laporan Bukti
              </div>
              <div className="text-slate-600">
                {(activeDeal.proofs || []).map((p: any) => p.nomor).join(', ') || 'Belum diunggah'}
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded space-y-1">
              <div className="text-slate-500 font-medium">5. Invoice Tagihan</div>
              <div className="font-mono font-bold text-slate-900">
                {(activeDeal.invoices || []).length} Invoice Terbit
              </div>
              <div className="text-slate-600">
                {(activeDeal.invoices || []).map((i: any) => i.nomor).join(', ') || 'Belum ditagih'}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // DAFTAR SEMUA PAKET DEAL
  // ============================================================================
  const filteredDeals = deals.filter((d) => {
    if (statusFilter !== 'ALL' && d.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        d.nomor.toLowerCase().includes(q) ||
        d.nama_kampanye.toLowerCase().includes(q) ||
        d.snapshot_nama_klien.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Paket Deal & Pemantauan Kuota Kontrak
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Pusat kendali kuota klien. Klik pada salah satu Deal untuk membuat Media Order, memantau Bukti Tayang, atau menerbitkan Invoice.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nomor Deal, kampanye, klien..."
            className="px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 w-64 focus:outline-none focus:border-blue-600"
          />
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {['ALL', 'Berjalan', 'Belum Dimulai', 'Selesai'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  statusFilter === st ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st === 'ALL' ? 'Semua' : st}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <th className="py-3 px-4 text-left">Nomor Deal & Quotation</th>
              <th className="py-3 px-4 text-left">Kampanye & Klien</th>
              <th className="py-3 px-4 text-left">Skema Tagih</th>
              <th className="py-3 px-4 text-right font-mono">Nilai Deal</th>
              <th className="py-3 px-4 text-left w-56">Progres Kuota (Tayang / Dibeli)</th>
              <th className="py-3 px-4 text-left">Status</th>
              <th className="py-3 px-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredDeals.map((d) => {
              const rk = d.ringkasan_kuota || { dibeli: 0, sudah_tayang: 0, terjadwal: 0, belum_dijadwalkan: 0, persen_progres: 0 };
              return (
                <tr key={d.id} className="hover:bg-slate-50/80">
                  <td className="py-3.5 px-4 font-mono">
                    <div className="font-bold text-blue-700">{d.nomor}</div>
                    <div className="text-[11px] text-slate-500">Ref: {d.nomor_quotation}</div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-slate-900">{d.nama_kampanye}</div>
                    <div className="text-slate-500 mt-0.5">
                      {d.snapshot_nama_klien} · Sales: {d.nama_sales}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-700">
                    {d.skema_tagih === 'per_mo'
                      ? 'Per MO'
                      : d.skema_tagih === 'termin'
                      ? 'Termin Deal'
                      : 'Sekali Tagih'}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                    {formatRupiah(d.nilai_deal)}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="space-y-1">
                      <div className="w-full h-2 bg-slate-100 rounded-xs overflow-hidden flex">
                        <div
                          style={{ width: `${rk.dibeli > 0 ? (rk.sudah_tayang / rk.dibeli) * 100 : 0}%` }}
                          className="bg-emerald-600 h-full"
                        />
                        <div
                          style={{ width: `${rk.dibeli > 0 ? (rk.terjadwal / rk.dibeli) * 100 : 0}%` }}
                          className="bg-amber-500 h-full"
                        />
                      </div>
                      <div className="flex justify-between font-mono text-[11px] text-slate-600">
                        <span>
                          {rk.sudah_tayang}/{rk.dibeli} Tayang ({rk.persen_progres}%)
                        </span>
                        <span>Sisa: {rk.belum_dijadwalkan}</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={getStatusSemanticColor(d.status)}>{d.status}</span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => onSelectDeal(d.id)}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded transition-colors cursor-pointer"
                      >
                        Buka Detail Deal
                      </button>
                      {isManager && (
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            const confirmed = window.confirm(
                              `Peringatan Otorisasi Manajer:\n\nApakah Anda yakin ingin MENGHAPUS Deal #${d.nomor} ("${d.nama_kampanye}")?\n\nPerhatian:\n- Deal yang memiliki Media Order atau Invoice aktif tidak dapat dihapus.\n- Seluruh alokasi kuota dan histori deal ini akan dihapus permanen.\n- Tindakan ini dicatat di Audit Trail.`
                            );
                            if (!confirmed) return;
                            try {
                              if (apiDelete) {
                                await apiDelete(`/api/deals/${d.id}`);
                                showToast?.(`Deal #${d.nomor} berhasil dihapus.`);
                                onRefresh?.();
                              }
                            } catch (err: any) {
                              showToast?.(`Gagal menghapus Deal: ${err?.message || 'Terjadi kesalahan sistem'}`);
                            }
                          }}
                          className="p-1.5 hover:bg-rose-50 text-rose-600 rounded transition-colors cursor-pointer border border-transparent hover:border-rose-200"
                          title="Hapus Deal (Otorisasi Minimal Manajer)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
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
