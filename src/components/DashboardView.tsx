import React, { useState } from 'react';
import {
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock,
  FileCheck,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import { formatRupiah, formatDateId, getStatusSemanticColor } from '../utils/format';

interface DashboardViewProps {
  dashboardData: Record<string, any> | null;
  currentUser: Record<string, any>;
  onNavigate: (tab: string, entityId?: number) => void;
  onQuickApprove: (approvalId: number, decision: 'Disetujui' | 'Ditolak') => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  dashboardData,
  currentUser,
  onNavigate,
  onQuickApprove,
}) => {
  const [chartMode, setChartMode] = useState<'revenue' | 'pipeline' | 'aging'>('revenue');
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);

  if (!dashboardData) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-28 bg-white border border-slate-200 rounded-lg p-5 animate-pulse" />
          ))}
        </div>
        <div className="h-80 bg-white border border-slate-200 rounded-lg p-6 animate-pulse" />
      </div>
    );
  }

  const { kpis, pipelineStats = [], monthlyTrend = [], piutangAging = [], deals = [], pendingApprovals = [], upcomingSchedules = [] } = dashboardData;

  const maxMonthlyVal = Math.max(
    1,
    ...monthlyTrend.map((m: any) => Math.max(Number(m.nilai_deal || 0), Number(m.tertagih || 0), Number(m.terbayar || 0)))
  );

  const maxPipelineVal = Math.max(1, ...pipelineStats.map((p: any) => Number(p.nilai || 0)));
  const maxAgingVal = Math.max(1, ...piutangAging.map((a: any) => Number(a.nilai || 0)));

  const canApprove = ['super_admin', 'direktur', 'manager'].includes(currentUser.role_kode);

  return (
    <div className="space-y-8">
      {/* Contextual Role Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Ringkasan Eksekutif & Operasional
          </h1>
          <div className="text-sm text-slate-600 mt-1.5 flex items-center gap-2 flex-wrap">
            <span>
              Selamat datang kembali,{' '}
              <strong className="text-slate-900 font-semibold">{currentUser.nama}</strong>!
            </span>
            <span className="text-slate-300 hidden sm:inline">·</span>
            <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-semibold text-xs">
              {currentUser.role_nama}
            </span>
            <span className="text-slate-300 hidden sm:inline">·</span>
            <span className="text-slate-500 text-xs">
              {currentUser.nama_tim ? `Divisi ${currentUser.nama_tim}` : 'Akses Seluruh Unit Bisnis'}
            </span>
            <span className="text-slate-300 hidden sm:inline">·</span>
            <span className="text-slate-500 text-xs font-mono">
              {formatDateId(new Date().toISOString().slice(0, 10))}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => onNavigate('quotations')}
            className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Lihat Quotation
          </button>
          <button
            onClick={() => onNavigate('deals')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Pusat Kendali Deal
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Top 4 KPI Strip (Single-Elevation Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-xs font-medium text-slate-500">Nilai Pipeline Quotation</div>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-2">
            {formatRupiah(kpis.total_pipeline_nilai)}
          </div>
          <div className="text-xs text-slate-500 mt-2 font-mono">
            {kpis.total_quotation} dokumen penawaran terdaftar
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-xs font-medium text-slate-500">Total Kontrak Deal Aktif</div>
          <div className="text-xl font-bold font-mono tabular-nums text-blue-700 mt-2">
            {formatRupiah(kpis.total_nilai_deal)}
          </div>
          <div className="text-xs text-slate-500 mt-2 font-mono">
            {kpis.total_deal_aktif} Paket Deal berjalan
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-xs font-medium text-slate-500">Realisasi Tertagih vs Terbayar</div>
          <div className="text-xl font-bold font-mono tabular-nums text-emerald-700 mt-2">
            {formatRupiah(kpis.total_terbayar)}
          </div>
          <div className="text-xs text-slate-500 mt-2 font-mono">
            Dari {formatRupiah(kpis.total_tertagih)} total invoice
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-xs font-medium text-slate-500">Sisa Piutang & Antrean Approval</div>
          <div className="text-xl font-bold font-mono tabular-nums text-amber-700 mt-2">
            {formatRupiah(kpis.total_piutang)}
          </div>
          <div className="text-xs text-slate-500 mt-2 font-mono">
            {kpis.menunggu_approval} dokumen menunggu persetujuan
          </div>
        </div>
      </div>

      {/* Interactive Data Visualization Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-lg p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                Visualisasi Kinerja Bisnis & Keuangan
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Arahkan kursor pada batang grafik untuk melihat rincian angka presisi dalam Rupiah
              </p>
            </div>

            {/* Interactive Segmented Control */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
              <button
                onClick={() => setChartMode('revenue')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  chartMode === 'revenue' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tren Deal & Tagihan
              </button>
              <button
                onClick={() => setChartMode('pipeline')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  chartMode === 'pipeline' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Pipeline Quotation
              </button>
              <button
                onClick={() => setChartMode('aging')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  chartMode === 'aging' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Umur Piutang
              </button>
            </div>
          </div>

          {/* Chart Viewport */}
          {chartMode === 'revenue' && (
            <div className="mt-6">
              <div className="flex items-center gap-6 text-xs text-slate-600 mb-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 bg-slate-900 inline-block rounded-xs" /> Nilai Kontrak Deal
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 bg-blue-600 inline-block rounded-xs" /> Sudah Ditagihkan (Invoice)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 bg-emerald-600 inline-block rounded-xs" /> Pembayaran Diterima
                </span>
              </div>

              <div className="grid grid-cols-5 gap-4 items-end h-56 pt-6 px-2 border-b border-slate-200">
                {monthlyTrend.map((m: any, idx: number) => {
                  const hDeal = Math.max(8, Math.round((Number(m.nilai_deal) / maxMonthlyVal) * 165));
                  const hBill = Math.max(8, Math.round((Number(m.tertagih) / maxMonthlyVal) * 165));
                  const hPaid = Math.max(8, Math.round((Number(m.terbayar) / maxMonthlyVal) * 165));
                  const isHovered = hoveredBar === idx;

                  return (
                    <div
                      key={m.bulan}
                      onMouseEnter={() => setHoveredBar(idx)}
                      onMouseLeave={() => setHoveredBar(null)}
                      className="flex flex-col items-center group relative cursor-pointer"
                    >
                      {isHovered && (
                        <div className="absolute -top-16 z-10 bg-slate-900 text-white text-[11px] font-mono p-2 rounded shadow-lg whitespace-nowrap pointer-events-none">
                          <div>Deal: {formatRupiah(m.nilai_deal)}</div>
                          <div>Tagih: {formatRupiah(m.tertagih)}</div>
                          <div>Bayar: {formatRupiah(m.terbayar)}</div>
                        </div>
                      )}
                      <div className="flex items-end gap-1.5 h-44">
                        <div
                          style={{ height: `${hDeal}px` }}
                          className="w-4 sm:w-5 bg-slate-900 rounded-t-xs transition-opacity group-hover:opacity-90"
                        />
                        <div
                          style={{ height: `${hBill}px` }}
                          className="w-4 sm:w-5 bg-blue-600 rounded-t-xs transition-opacity group-hover:opacity-90"
                        />
                        <div
                          style={{ height: `${hPaid}px` }}
                          className="w-4 sm:w-5 bg-emerald-600 rounded-t-xs transition-opacity group-hover:opacity-90"
                        />
                      </div>
                      <div className="text-xs font-medium text-slate-700 mt-2.5 font-mono">{m.bulan}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {chartMode === 'pipeline' && (
            <div className="mt-5 space-y-3.5">
              {pipelineStats.map((st: any) => {
                const widthPct = Math.max(4, Math.round((Number(st.nilai) / maxPipelineVal) * 100));
                return (
                  <div key={st.status} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800">
                        {st.status} <span className="text-slate-400 font-mono">({st.jumlah} dokumen)</span>
                      </span>
                      <span className="font-mono font-semibold text-slate-900">{formatRupiah(st.nilai)}</span>
                    </div>
                    <div className="w-full h-3 bg-slate-100 rounded-xs overflow-hidden">
                      <div
                        style={{ width: `${widthPct}%` }}
                        className={`h-full ${
                          st.status === 'Deal'
                            ? 'bg-emerald-600'
                            : st.status === 'Menunggu Persetujuan'
                            ? 'bg-amber-500'
                            : st.status === 'Lost'
                            ? 'bg-red-500'
                            : 'bg-blue-600'
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {chartMode === 'aging' && (
            <div className="mt-6 space-y-5">
              {piutangAging.map((ag: any, i: number) => {
                const widthPct = Math.max(4, Math.round((Number(ag.nilai) / maxAgingVal) * 100));
                return (
                  <div key={ag.kategori} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800">{ag.kategori}</span>
                      <span className="font-mono font-bold text-slate-900">{formatRupiah(ag.nilai)}</span>
                    </div>
                    <div className="w-full h-4 bg-slate-100 rounded-xs overflow-hidden">
                      <div
                        style={{ width: `${widthPct}%` }}
                        className={`h-full ${
                          i === 0 ? 'bg-blue-600' : i === 1 ? 'bg-amber-500' : 'bg-red-600'
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
              <div className="pt-2 text-xs text-slate-500">
                Berdasarkan tanggal jatuh tempo otomatis dari termin pembayaran masing-masing klien (NET 14, NET 30, NET 45).
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Actionable Approval Queue */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-lg p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                Antrean Persetujuan & Verifikasi
              </h2>
              <span className="text-xs font-mono font-semibold text-slate-600">
                {pendingApprovals.length} menunggu
              </span>
            </div>

            {pendingApprovals.length === 0 ? (
              <div className="py-10 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                <div className="text-sm font-semibold text-slate-800">Tidak Ada Antrean Menunggu</div>
                <p className="text-xs text-slate-500 mt-1">
                  Seluruh pengajuan diskon Quotation, Media Order, dan Bukti Tayang telah diproses.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200 mt-2">
                {pendingApprovals.slice(0, 4).map((app: any) => (
                  <div key={app.id} className="py-3.5 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-bold text-blue-700">{app.nomor_dokumen}</span>
                      <span className="text-slate-500">
                        {app.jenis_dokumen} · Pemohon: {app.nama_pemohon}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">{app.ringkasan_alasan}</p>
                    {canApprove ? (
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => onQuickApprove(app.id, 'Disetujui')}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded transition-colors cursor-pointer"
                        >
                          Setujui Sekarang
                        </button>
                        <button
                          onClick={() => onQuickApprove(app.id, 'Ditolak')}
                          className="px-3 py-1 bg-white hover:bg-red-50 text-red-700 border border-red-200 text-xs font-semibold rounded transition-colors cursor-pointer"
                        >
                          Tolak
                        </button>
                      </div>
                    ) : (
                      <div className="text-[11px] text-amber-700 font-medium">
                        Menunggu otorisasi Manager / Direktur
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => onNavigate('approvals')}
            className="mt-4 w-full py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 border border-slate-200 hover:bg-slate-50 rounded-md transition-colors cursor-pointer"
          >
            Buka Pusat Persetujuan Lengkap
          </button>
        </div>
      </div>

      {/* Bottom Split: Deal Quota Progress & Upcoming Broadcast Schedules */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-blue-600" />
                Pemantauan Kuota & Progres Paket Deal
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Rumus baku: Dibeli = Sudah Tayang + Terjadwal + Belum Dijadwalkan
              </p>
            </div>
            <button
              onClick={() => onNavigate('deals')}
              className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
            >
              Semua Deal →
            </button>
          </div>

          <div className="divide-y divide-slate-200 mt-2">
            {deals.map((d: any) => {
              const rk = d.ringkasan_kuota || { dibeli: 0, sudah_tayang: 0, terjadwal: 0, belum_dijadwalkan: 0, persen_progres: 0 };
              return (
                <div key={d.id} className="py-4 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div>
                      <button
                        onClick={() => onNavigate('deals', d.id)}
                        className="text-sm font-bold text-slate-900 hover:text-blue-600 transition-colors text-left cursor-pointer"
                      >
                        {d.nama_kampanye}
                      </button>
                      <div className="text-xs text-slate-500 mt-0.5">
                        <span className="font-mono font-semibold text-slate-700">{d.nomor}</span>
                        {' · '}
                        <span>{d.snapshot_nama_klien}</span>
                        {' · '}
                        <span>Sales: {d.nama_sales}</span>
                        {' · '}
                        <span className={getStatusSemanticColor(d.status)}>{d.status}</span>
                      </div>
                    </div>
                    <div className="text-right font-mono">
                      <div className="text-sm font-bold text-slate-900">{formatRupiah(d.nilai_deal)}</div>
                      <div className="text-xs text-emerald-700 font-semibold">{rk.persen_progres}% Tayang</div>
                    </div>
                  </div>

                  {/* Multi-Segment Quota Progress Bar */}
                  <div className="w-full h-2.5 bg-slate-100 rounded-xs overflow-hidden flex">
                    <div
                      style={{ width: `${rk.dibeli > 0 ? (rk.sudah_tayang / rk.dibeli) * 100 : 0}%` }}
                      className="bg-emerald-600 h-full"
                      title="Sudah Tayang"
                    />
                    <div
                      style={{ width: `${rk.dibeli > 0 ? (rk.terjadwal / rk.dibeli) * 100 : 0}%` }}
                      className="bg-amber-500 h-full"
                      title="Terjadwal di MO"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 font-mono">
                    <span>
                      Kuota Dibeli: <strong>{rk.dibeli}</strong>
                    </span>
                    <span className="text-emerald-700">
                      Sudah Tayang: <strong>{rk.sudah_tayang}</strong>
                    </span>
                    <span className="text-amber-700">
                      Terjadwal: <strong>{rk.terjadwal}</strong>
                    </span>
                    <span className="text-slate-600">
                      Belum Dijadwalkan: <strong>{rk.belum_dijadwalkan}</strong>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming Broadcast Schedule Table */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                Jadwal Tayang Media Order
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Daftar penayangan yang melekat pada Media Order aktif
              </p>
            </div>
            <button
              onClick={() => onNavigate('schedules')}
              className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
            >
              Kalender Penuh →
            </button>
          </div>

          <div className="divide-y divide-slate-200 mt-2">
            {upcomingSchedules.slice(0, 5).map((sc: any) => (
              <div key={sc.id} className="py-3 flex items-start justify-between gap-3 text-xs">
                <div className="space-y-0.5">
                  <div className="font-semibold text-slate-900">{sc.judul_topik}</div>
                  <div className="text-slate-500">
                    <span>{sc.platform}</span>
                    {' · '}
                    <span className="font-mono">{sc.nomor_mo}</span>
                    {' · '}
                    <span>{sc.snapshot_nama_klien}</span>
                  </div>
                </div>
                <div className="text-right shrink-0 font-mono">
                  <div className="font-semibold text-slate-900">{formatDateId(sc.tanggal_tayang)}</div>
                  <div className={getStatusSemanticColor(sc.status)}>{sc.status}</div>
                </div>
              </div>
            ))}
          </div>

          {deals.some((d: any) => d.ringkasan_kuota?.belum_dijadwalkan > 0) && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md flex items-start gap-2.5 text-xs text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Peringatan Kuota Belum Dijadwalkan: </span>
                Terdapat kuota Paket Deal yang belum dimasukkan ke Media Order. Segera jadwalkan sebelum masa kontrak berakhir.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
