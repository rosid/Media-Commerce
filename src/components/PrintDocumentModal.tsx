import React from 'react';
import { Printer, X, CheckCircle2, FileText } from 'lucide-react';
import {
  formatRupiah,
  formatNumber,
  formatDateId,
  terbilangRupiah,
  DEFAULT_COMPANY_LOGO_SVG,
  parsePdfSignaturesConfig,
  PdfSignatorySlot,
} from '../utils/format';

export type PrintableDocType = 'QUOTATION' | 'MEDIA_ORDER' | 'PROOF' | 'INVOICE' | 'DEAL_PROGRESS' | 'RECEIPT';

interface PrintDocumentModalProps {
  docType: PrintableDocType;
  data: Record<string, any>;
  companySettings: Record<string, string>;
  onClose: () => void;
}

export const PrintDocumentModal: React.FC<PrintDocumentModalProps> = ({
  docType,
  data,
  companySettings,
  onClose,
}) => {
  const companyName = companySettings.nama_perusahaan || 'PT Nusantara Digital Media Terpadu';
  const companyTagline =
    companySettings.sub_judul_kop || 'Jaringan Media Digital, Advertorial, & Solusi Periklanan Terintegrasi';
  const companyAddress =
    companySettings.alamat_perusahaan || 'Menara Sudirman Lt. 18, Jl. Jend. Sudirman Kav. 60, Jakarta Selatan 12190';
  const companyNpwp = companySettings.npwp_perusahaan || '01.345.678.9-012.000';
  const companyWebsite = companySettings.website_perusahaan || 'www.nusantaramedia.id';
  const companyContact = `${companySettings.telepon_perusahaan || '(021) 520-8899'} · ${
    companySettings.email_perusahaan || 'billing@nusantaramedia.id'
  } · ${companyWebsite}`;
  const companyLogo =
    companySettings.tampilkan_logo_kop === 'false'
      ? null
      : companySettings.logo_perusahaan || DEFAULT_COMPANY_LOGO_SVG;
  const pdfFooterNote =
    companySettings.catatan_kaki_pdf ||
    `Dokumen Resmi ${companyName} · Dicetak otomatis dari Sistem MediaFlow ERP`;

  const signaturesMap = parsePdfSignaturesConfig(companySettings.pdf_signatures_config);
  const activeSignatories: PdfSignatorySlot[] = signaturesMap[docType] || signaturesMap.QUOTATION;

  const resolveSignatoryPerson = (slot: PdfSignatorySlot) => {
    if (docType === 'RECEIPT') {
      return {
        nama: data.nama_pencatat || slot.nama || 'Siti Rahmawati',
        jabatan: data.jabatan_pencatat || slot.jabatan || 'Billing & Finance Officer',
      };
    }
    if (slot.mode_penandatangan === 'pembuat') {
      return {
        nama: data.nama_sales || data.pembuat_nama || data.pic_internal || slot.nama || companyName,
        jabatan: slot.jabatan || companyName,
      };
    }
    if (slot.mode_penandatangan === 'klien') {
      return {
        nama: data.snapshot_pic || data.pic_klien || slot.nama || 'PIC Klien',
        jabatan: data.snapshot_nama_klien || slot.jabatan || 'Pihak Klien',
      };
    }
    return {
      nama: slot.nama || companyName,
      jabatan: slot.jabatan || companyName,
    };
  };

  const statusText = String(data.status || '');
  const isDraft = statusText.toLowerCase().includes('draft') || statusText.toLowerCase().includes('menunggu');
  const isCancelled =
    statusText.toLowerCase().includes('batal') ||
    statusText.toLowerCase().includes('lost') ||
    statusText.toLowerCase().includes('ditolak');

  const getDocTitle = () => {
    switch (docType) {
      case 'QUOTATION':
        return 'QUOTATION';
      case 'MEDIA_ORDER':
        return 'MEDIA ORDER (MO)';
      case 'PROOF':
        return 'LAPORAN BUKTI TAYANG';
      case 'INVOICE':
        return 'INVOICE';
      case 'DEAL_PROGRESS':
        return 'LAPORAN PROGRES PAKET DEAL';
      case 'RECEIPT':
        return 'KWITANSI';
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const activeVersion = data.active_version || {};

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 flex flex-col items-center justify-start overflow-y-auto p-4 md:p-8">
      {/* Control Toolbar (Hidden on Print) */}
      <div className="no-print w-full max-w-[1120px] bg-slate-900 text-white px-5 py-3 rounded-t-lg flex items-center justify-between border-b border-slate-700">
        <div className="flex items-center gap-3">
          <FileText className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-semibold tracking-tight">
            Pratinjau Dokumen Standar A4 Landscape (297 × 210 mm)
          </span>
          <span className="text-xs text-slate-400 font-mono">· {data.nomor}</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-md flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            Cetak / Simpan PDF A4 Landscape
          </button>
          <button
            onClick={onClose}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            Tutup
          </button>
        </div>
      </div>

      {/* A4 Landscape Sheet Container */}
      <div className="a4-landscape-sheet relative w-full max-w-[1120px] min-h-[790px] bg-white text-slate-900 shadow-2xl border border-slate-200 p-8 md:p-10 flex flex-col justify-between overflow-hidden">
        {/* Conditional Status Watermark per Section 8.1 */}
        {(isDraft || isCancelled) && (
          <div className="pointer-events-none select-none absolute inset-0 flex items-center justify-center">
            <span className="text-[88px] font-bold tracking-widest text-slate-900/6 -rotate-12 border-4 border-slate-900/10 px-10 py-2">
              {isCancelled ? 'BATAL' : 'DRAFT'}
            </span>
          </div>
        )}

        <div>
          {/* 1. Standard Unified Letterhead (Kop Perusahaan) with Logo */}
          <div className="flex items-start justify-between gap-6 pb-5 border-b-2 border-slate-900">
            <div className="flex items-start gap-4">
              {companyLogo && (
                <img
                  src={companyLogo}
                  alt={companyName}
                  referrerPolicy="no-referrer"
                  className="w-14 h-14 object-contain rounded-md border border-slate-200 bg-white p-1 shrink-0"
                />
              )}
              <div>
                <div className="text-xl font-bold tracking-tight text-slate-900">{companyName}</div>
                {companyTagline && (
                  <div className="text-[11px] font-semibold text-blue-700 mt-0.5">{companyTagline}</div>
                )}
                <div className="text-xs text-slate-600 mt-0.5 max-w-lg">{companyAddress}</div>
                <div className="text-xs text-slate-600 mt-0.5 font-mono">
                  NPWP: {companyNpwp} · {companyContact}
                </div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-lg font-bold tracking-tight text-slate-900">{getDocTitle()}</div>
              <div className="text-sm font-mono font-semibold text-blue-700 mt-0.5">
                No: {data.nomor_kwitansi || data.nomor}
                {docType === 'QUOTATION' && data.versi_aktif ? ` (Rev.${data.versi_aktif})` : ''}
              </div>
              <div className="text-xs text-slate-600 mt-1">
                Tanggal: <span className="font-mono">{formatDateId(data.tanggal_bayar || data.tanggal_terbit || data.periode_mulai || data.created_at)}</span>
                {' · '}
                Status: <span className="font-semibold text-slate-900">{data.status || 'Diterima'}</span>
              </div>
            </div>
          </div>

          {/* 2. Reference Block & Metadata per Document Type */}
          {docType === 'QUOTATION' && (
            <div className="grid grid-cols-2 gap-6 py-4 border-b border-slate-200 text-xs">
              <div>
                <div className="text-slate-500 font-medium">Ditujukan Kepada Klien:</div>
                <div className="text-sm font-bold text-slate-900 mt-0.5">{data.snapshot_nama_klien}</div>
                <div className="text-slate-600 mt-0.5">{data.snapshot_alamat}</div>
                <div className="text-slate-600 mt-0.5 font-mono">
                  NPWP: {data.snapshot_npwp} · UP/PIC: {data.snapshot_pic}
                </div>
              </div>
              <div className="text-right space-y-1">
                <div>
                  <span className="text-slate-500">Judul Kampanye: </span>
                  <span className="font-semibold text-slate-900">{data.judul_penawaran}</span>
                </div>
                <div>
                  <span className="text-slate-500">Berlaku Sampai: </span>
                  <span className="font-mono font-semibold text-slate-900">{formatDateId(data.berlaku_sampai)}</span>
                </div>
                <div>
                  <span className="text-slate-500">Account Executive (Sales): </span>
                  <span className="font-semibold text-slate-900">{data.nama_sales || data.pembuat_nama || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500">Revisi Aktif: </span>
                  <span className="font-mono text-slate-900">Rev.{data.versi_aktif}</span>
                </div>
              </div>
            </div>
          )}

          {docType === 'MEDIA_ORDER' && (
            <div className="grid grid-cols-2 gap-6 py-4 border-b border-slate-200 text-xs">
              <div>
                <div className="text-slate-500 font-medium">Informasi Klien & Kampanye:</div>
                <div className="text-sm font-bold text-slate-900 mt-0.5">{data.nama_kampanye}</div>
                <div className="text-slate-700 mt-0.5">Klien: {data.snapshot_nama_klien || 'Internal / Bonus Kampanye'}</div>
                <div className="text-slate-600 mt-0.5">
                  PIC Klien: <span className="font-medium">{data.pic_klien}</span> · PIC Media: <span className="font-medium">{data.pic_internal}</span>
                </div>
              </div>
              <div className="text-right space-y-1 font-mono">
                <div>
                  <span className="text-slate-500 font-sans">Ref. Paket Deal: </span>
                  <span className="font-semibold text-slate-900">{data.nomor_deal || 'MO-BONUS'}</span>
                  <span className="text-slate-400"> · </span>
                  <span className="text-slate-500 font-sans">Ref. Quotation: </span>
                  <span className="text-slate-900">{data.nomor_quotation || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-sans">Nomor PO Klien: </span>
                  <span className="text-slate-900">{data.no_po_klien || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-sans">Jenis MO: </span>
                  <span className="font-semibold text-slate-900">{data.jenis}</span>
                  <span className="text-slate-400"> · </span>
                  <span className="text-slate-500 font-sans">Periode Tayang: </span>
                  <span>
                    {formatDateId(data.periode_mulai)} s/d {formatDateId(data.periode_selesai)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {docType === 'PROOF' && (
            <div className="grid grid-cols-2 gap-6 py-4 border-b border-slate-200 text-xs">
              <div>
                <div className="text-slate-500 font-medium">Ringkasan Kampanye & Klien:</div>
                <div className="text-sm font-bold text-slate-900 mt-0.5">{data.nama_kampanye}</div>
                <div className="text-slate-700 mt-0.5">Klien: {data.snapshot_nama_klien}</div>
                <div className="text-slate-600 mt-0.5">Periode Laporan: {data.periode_laporan}</div>
              </div>
              <div className="text-right space-y-1 font-mono">
                <div>
                  <span className="text-slate-500 font-sans">Ref. Media Order: </span>
                  <span className="font-semibold text-slate-900">{data.nomor_mo}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-sans">Ref. Paket Deal: </span>
                  <span className="text-slate-900">{data.nomor_deal || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-sans">Diverifikasi Oleh: </span>
                  <span className="font-sans font-semibold text-emerald-700">
                    {data.verifikator_nama || 'Menunggu Verifikasi Manager'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {docType === 'INVOICE' && (
            <div className="grid grid-cols-2 gap-6 py-4 border-b border-slate-200 text-xs">
              <div>
                <div className="text-slate-500 font-medium">Ditagihkan Kepada:</div>
                <div className="text-sm font-bold text-slate-900 mt-0.5">{data.snapshot_nama_klien}</div>
                <div className="text-slate-600 mt-0.5">{data.alamat_klien}</div>
                <div className="text-slate-600 mt-0.5 font-mono">NPWP: {data.npwp_klien}</div>
              </div>
              <div className="text-right space-y-1 font-mono">
                <div>
                  <span className="text-slate-500 font-sans">Ref. Deal: </span>
                  <span className="font-semibold text-slate-900">{data.nomor_deal}</span>
                  {data.nomor_mo && (
                    <>
                      <span className="text-slate-400"> · </span>
                      <span className="text-slate-500 font-sans">Ref. MO: </span>
                      <span>{data.nomor_mo}</span>
                    </>
                  )}
                  {data.nomor_proof && (
                    <>
                      <span className="text-slate-400"> · </span>
                      <span className="text-slate-500 font-sans">Ref. Bukti: </span>
                      <span>{data.nomor_proof}</span>
                    </>
                  )}
                </div>
                <div>
                  <span className="text-slate-500 font-sans">No. PO Klien: </span>
                  <span>{data.no_po_klien || '-'}</span>
                  <span className="text-slate-400"> · </span>
                  <span className="text-slate-500 font-sans">No. Faktur Pajak: </span>
                  <span className="font-semibold">{data.no_faktur_pajak || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-sans">Tanggal Jatuh Tempo: </span>
                  <span className="font-semibold text-red-700">{formatDateId(data.jatuh_tempo)}</span>
                </div>
              </div>
            </div>
          )}

          {docType === 'DEAL_PROGRESS' && (
            <div className="grid grid-cols-2 gap-6 py-4 border-b border-slate-200 text-xs">
              <div>
                <div className="text-slate-500 font-medium">Klien & Kontrak Kampanye:</div>
                <div className="text-sm font-bold text-slate-900 mt-0.5">{data.nama_kampanye}</div>
                <div className="text-slate-700 mt-0.5">{data.snapshot_nama_klien}</div>
                <div className="text-slate-600 mt-0.5 font-mono">
                  No. PO: {data.no_po_klien} · Sales: {data.nama_sales}
                </div>
              </div>
              <div className="text-right space-y-1 font-mono">
                <div>
                  <span className="text-slate-500 font-sans">Ref. Quotation: </span>
                  <span className="font-semibold text-slate-900">{data.nomor_quotation}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-sans">Periode Kontrak: </span>
                  <span>
                    {formatDateId(data.mulai_kontrak)} s/d {formatDateId(data.berlaku_sampai)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-sans">Progres Keseluruhan: </span>
                  <span className="font-bold text-emerald-700">{data.ringkasan_kuota?.persen_progres || 0}% Tayang</span>
                </div>
              </div>
            </div>
          )}

          {docType === 'RECEIPT' && (
            <div className="py-6 border-b border-slate-200 text-xs space-y-4">
              <div className="grid grid-cols-12 gap-3 pb-3 border-b border-slate-100">
                <div className="col-span-3 text-slate-500 font-semibold uppercase tracking-wider text-[11px] pt-0.5">
                  Telah Diterima Dari:
                </div>
                <div className="col-span-9">
                  <div className="text-sm font-bold text-slate-900">
                    {data.snapshot_nama_klien || data.nama_klien || data.diterima_dari || 'Pihak Klien'}
                  </div>
                  {data.snapshot_alamat && (
                    <div className="text-slate-600 text-xs mt-0.5">{data.snapshot_alamat}</div>
                  )}
                  <div className="text-slate-500 font-mono text-[11px] mt-0.5 flex flex-wrap gap-x-4">
                    {data.snapshot_npwp && <span>NPWP: {data.snapshot_npwp}</span>}
                    {data.snapshot_pic && <span>UP/PIC: {data.snapshot_pic}</span>}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-12 gap-3 py-2 items-center">
                <div className="col-span-3 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                  Uang Sejumlah:
                </div>
                <div className="col-span-9 p-3.5 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl">
                  <div className="text-slate-500 text-[10px] uppercase font-mono tracking-wider mb-0.5">Terbilang:</div>
                  <div className="font-bold italic text-slate-900 text-sm md:text-base leading-relaxed">
                    # {terbilangRupiah(Number(data.jumlah || data.jumlah_bayar || data.total_dibayar || 0))} #
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-12 gap-3 py-2">
                <div className="col-span-3 text-slate-500 font-semibold uppercase tracking-wider text-[11px] pt-0.5">
                  Untuk Pembayaran:
                </div>
                <div className="col-span-9 space-y-1.5">
                  <div className="font-bold text-slate-900 text-xs leading-relaxed">
                    {data.untuk_pembayaran || (data.nomor_invoice ? `Pembayaran Tagihan Invoice #${data.nomor_invoice}` : `Pembayaran Invoice #${data.nomor || ''}`)}
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 font-mono text-[11px] text-slate-600 space-y-0.5">
                    <div>
                      Ref. Dokumen Invoice: <span className="text-blue-700 font-bold">{data.nomor_invoice || data.nomor || '-'}</span>
                      {data.total_tagihan_invoice ? ` (Total Tagihan: ${formatRupiah(data.total_tagihan_invoice)})` : ''}
                    </div>
                    {data.nama_kampanye && (
                      <div>Nama Kampanye: <span className="font-semibold text-slate-800">{data.nama_kampanye}</span></div>
                    )}
                    {data.nomor_deal && (
                      <div>Ref. Paket Deal: <span className="text-slate-700">{data.nomor_deal}</span></div>
                    )}
                  </div>
                  {data.catatan && (
                    <div className="text-slate-500 italic text-[11px]">
                      Catatan Tambahan: {data.catatan}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-12 gap-3 pt-3 border-t border-slate-100">
                <div className="col-span-3 text-slate-500 font-semibold uppercase tracking-wider text-[11px] pt-1">
                  Nominal & Bank:
                </div>
                <div className="col-span-9">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-emerald-50/80 border-2 border-emerald-300 rounded-xl gap-4">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-emerald-800 font-bold font-mono">
                        Jumlah Dana Telah Diterima (IDR)
                      </span>
                      <div className="text-2xl font-bold font-mono text-emerald-950 mt-0.5">
                        {formatRupiah(Number(data.jumlah || data.jumlah_bayar || data.total_dibayar || 0))}
                      </div>
                    </div>
                    <div className="text-right text-[11px] font-mono text-slate-700 space-y-0.5 self-end sm:self-center border-t sm:border-t-0 sm:border-l sm:pl-4 border-emerald-200 pt-2 sm:pt-0">
                      <div>Metode Bayar: <strong className="text-slate-900">{data.metode || 'Transfer Bank'}</strong></div>
                      <div>Referensi Transaksi: <strong className="text-slate-900">{data.referensi_bank || '-'}</strong></div>
                      <div>Rekening Tujuan: <span className="text-slate-600">{companySettings.bank_nama || 'Bank Mandiri'} ({companySettings.bank_rekening || '-'})</span></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. Main Document Table per Section 8.2 */}
          <div className="mt-4">
            {docType === 'QUOTATION' && (
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-y border-slate-300 text-slate-700">
                    <th className="py-2 px-2.5 text-left w-10">No</th>
                    <th className="py-2 px-2.5 text-left">Media / Produk</th>
                    <th className="py-2 px-2.5 text-left">Spesifikasi & Target</th>
                    <th className="py-2 px-2.5 text-left">Periode</th>
                    <th className="py-2 px-2.5 text-right font-mono">Qty</th>
                    <th className="py-2 px-2.5 text-left">Satuan</th>
                    <th className="py-2 px-2.5 text-right font-mono">Harga Satuan</th>
                    <th className="py-2 px-2.5 text-right font-mono">Diskon</th>
                    <th className="py-2 px-2.5 text-right font-mono">Jumlah</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {(activeVersion.items || []).map((it: any, idx: number) => (
                    <tr key={idx}>
                      <td className="py-2 px-2.5 font-mono text-slate-500">{idx + 1}</td>
                      <td className="py-2 px-2.5 font-semibold text-slate-900">
                        {it.nama_produk}
                        <span className="block text-[11px] font-normal text-slate-500">{it.kategori}</span>
                      </td>
                      <td className="py-2 px-2.5 text-slate-600 max-w-xs">
                        {it.spesifikasi}
                        {it.target_kpi && it.target_kpi !== '-' && (
                          <span className="block text-[11px] text-slate-500">Target: {it.target_kpi}</span>
                        )}
                      </td>
                      <td className="py-2 px-2.5 text-slate-700">{it.periode}</td>
                      <td className="py-2 px-2.5 text-right font-mono font-medium">{it.qty}</td>
                      <td className="py-2 px-2.5 text-slate-600">{it.satuan}</td>
                      <td className="py-2 px-2.5 text-right font-mono">{formatRupiah(it.harga_satuan)}</td>
                      <td className="py-2 px-2.5 text-right font-mono">
                        {Number(it.diskon_persen) > 0 ? `${it.diskon_persen}%` : '-'}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono font-semibold">{formatRupiah(it.jumlah)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {docType === 'MEDIA_ORDER' && (
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-y border-slate-300 text-slate-700">
                    <th className="py-2 px-2.5 text-left w-10">No</th>
                    <th className="py-2 px-2.5 text-left">Item Produk</th>
                    <th className="py-2 px-2.5 text-left">Platform</th>
                    <th className="py-2 px-2.5 text-left">Judul / Topik Konten</th>
                    <th className="py-2 px-2.5 text-left">Tanggal Tayang</th>
                    <th className="py-2 px-2.5 text-left">Slot / Jam</th>
                    <th className="py-2 px-2.5 text-right font-mono">Qty</th>
                    <th className="py-2 px-2.5 text-left">Status & Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {(data.items || []).map((it: any, idx: number) => (
                    <tr key={idx}>
                      <td className="py-2 px-2.5 font-mono text-slate-500">{idx + 1}</td>
                      <td className="py-2 px-2.5 font-semibold text-slate-900">{it.nama_item}</td>
                      <td className="py-2 px-2.5 text-slate-700">{it.platform}</td>
                      <td className="py-2 px-2.5 text-slate-800">{it.judul_topik}</td>
                      <td className="py-2 px-2.5 font-mono">{formatDateId(it.tanggal_tayang)}</td>
                      <td className="py-2 px-2.5 font-mono text-slate-600">{it.slot_jam}</td>
                      <td className="py-2 px-2.5 text-right font-mono font-semibold">
                        {it.qty} {it.satuan}
                      </td>
                      <td className="py-2 px-2.5 text-slate-600">
                        <span className="font-semibold text-slate-900">{it.status}</span>
                        {it.catatan ? ` · ${it.catatan}` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {docType === 'PROOF' && (
              <>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-y border-slate-300 text-slate-700">
                      <th className="py-2 px-2.5 text-left w-10">No</th>
                      <th className="py-2 px-2.5 text-left">Item Penayangan & Platform</th>
                      <th className="py-2 px-2.5 text-left w-32">Tanggal Tayang</th>
                      <th className="py-2 px-2.5 text-left">Tautan Live URL</th>
                      <th className="py-2 px-2.5 text-left">Lampiran Screenshot Bukti Tayang</th>
                      <th className="py-2 px-2.5 text-left">Catatan Penayangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {(data.items || []).map((it: any, idx: number) => {
                      const isImg =
                        typeof it.screenshot_url === 'string' &&
                        (it.screenshot_url.startsWith('data:image/') ||
                          it.screenshot_url.startsWith('http://') ||
                          it.screenshot_url.startsWith('https://') ||
                          it.screenshot_url.startsWith('/'));
                      return (
                        <tr key={idx}>
                          <td className="py-2 px-2.5 font-mono text-slate-500">{idx + 1}</td>
                          <td className="py-2 px-2.5 font-semibold text-slate-900">
                            {it.nama_item}
                            <span className="block text-[11px] font-normal text-slate-500">{it.platform}</span>
                          </td>
                          <td className="py-2 px-2.5 font-mono whitespace-nowrap">{formatDateId(it.tanggal_tayang)}</td>
                          <td className="py-2 px-2.5 font-mono text-[11px] text-blue-700 break-all">
                            {it.url_live}
                          </td>
                          <td className="py-2 px-2.5">
                            {isImg ? (
                              <img
                                src={it.screenshot_url}
                                alt={it.nama_item}
                                referrerPolicy="no-referrer"
                                className="w-28 h-16 object-contain rounded border border-slate-300 bg-slate-50 p-0.5"
                              />
                            ) : (
                              <span className="font-mono text-[11px] text-slate-600">
                                {it.screenshot_url || '-'}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-2.5 text-slate-600">{it.catatan || 'Tayang sesuai brief'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="mt-3 p-3 bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-center justify-between">
                  <div>
                    <span className="font-semibold">Catatan Verifikasi & Keterangan: </span>
                    {data.catatan_kompensasi || 'Seluruh penayangan sesuai spesifikasi Media Order.'}
                  </div>
                  <div className="flex items-center gap-1.5 font-semibold text-emerald-700">
                    <CheckCircle2 className="w-4 h-4" />
                    Status: {data.status}
                  </div>
                </div>
              </>
            )}

            {docType === 'INVOICE' && (
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-y border-slate-300 text-slate-700">
                    <th className="py-2 px-2.5 text-left w-10">No</th>
                    <th className="py-2 px-2.5 text-left">Deskripsi Penagihan</th>
                    <th className="py-2 px-2.5 text-left">Periode / Tanggal Tayang</th>
                    <th className="py-2 px-2.5 text-right font-mono">Qty</th>
                    <th className="py-2 px-2.5 text-right font-mono">Harga Satuan</th>
                    <th className="py-2 px-2.5 text-right font-mono">Diskon</th>
                    <th className="py-2 px-2.5 text-right font-mono">Jumlah</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {(data.items || []).map((it: any, idx: number) => (
                    <tr key={idx}>
                      <td className="py-2 px-2.5 font-mono text-slate-500">{idx + 1}</td>
                      <td className="py-2 px-2.5 font-semibold text-slate-900">{it.deskripsi}</td>
                      <td className="py-2 px-2.5 text-slate-700">{it.periode_tayang}</td>
                      <td className="py-2 px-2.5 text-right font-mono">
                        {it.qty} {it.satuan}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono">{formatRupiah(it.harga_satuan)}</td>
                      <td className="py-2 px-2.5 text-right font-mono">{formatRupiah(it.diskon)}</td>
                      <td className="py-2 px-2.5 text-right font-mono font-semibold">{formatRupiah(it.jumlah)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {docType === 'DEAL_PROGRESS' && (
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-y border-slate-300 text-slate-700">
                    <th className="py-2 px-2.5 text-left w-10">No</th>
                    <th className="py-2 px-2.5 text-left">Baris Kuota Produk</th>
                    <th className="py-2 px-2.5 text-left">Periode</th>
                    <th className="py-2 px-2.5 text-right font-mono">Kuota Dibeli</th>
                    <th className="py-2 px-2.5 text-right font-mono">Sudah Tayang</th>
                    <th className="py-2 px-2.5 text-right font-mono">Terjadwal</th>
                    <th className="py-2 px-2.5 text-right font-mono">Belum Dijadwalkan</th>
                    <th className="py-2 px-2.5 text-right font-mono">Progres %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {(data.items || []).map((it: any, idx: number) => (
                    <tr key={idx}>
                      <td className="py-2 px-2.5 font-mono text-slate-500">{idx + 1}</td>
                      <td className="py-2 px-2.5 font-semibold text-slate-900">
                        {it.nama_produk} ({it.satuan})
                      </td>
                      <td className="py-2 px-2.5 text-slate-600">{it.periode}</td>
                      <td className="py-2 px-2.5 text-right font-mono font-semibold">{it.qty_dibeli}</td>
                      <td className="py-2 px-2.5 text-right font-mono text-emerald-700 font-semibold">
                        {it.sudah_tayang}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono text-amber-700">{it.terjadwal}</td>
                      <td className="py-2 px-2.5 text-right font-mono text-slate-600">{it.belum_dijadwalkan}</td>
                      <td className="py-2 px-2.5 text-right font-mono font-bold">{it.persen_tayang}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* 4. Totals & Financial Summary Block */}
          {(docType === 'QUOTATION' || docType === 'INVOICE') && (
            <div className="mt-4 grid grid-cols-12 gap-6 pt-3 border-t border-slate-300 text-xs">
              <div className="col-span-7 space-y-2">
                {docType === 'INVOICE' && (
                  <>
                    <div className="p-2.5 bg-slate-50 border border-slate-200">
                      <span className="text-slate-500 block text-[11px]">Terbilang:</span>
                      <span className="font-semibold italic text-slate-900">
                        # {terbilangRupiah(Number(data.total_tagihan || 0))} #
                      </span>
                    </div>
                    <div className="text-slate-600 space-y-0.5">
                      <div className="font-semibold text-slate-900">Instruksi Pembayaran Rekening Bank:</div>
                      <div>
                        {companySettings.bank_nama || 'Bank Mandiri KCP Sudirman Jakarta'} · No. Rek:{' '}
                        <span className="font-mono font-semibold text-slate-900">
                          {companySettings.bank_rekening || '122-00-9876543-2'}
                        </span>
                      </div>
                      <div>A/N: {companySettings.bank_atas_nama || companyName}</div>
                    </div>
                  </>
                )}
                {docType === 'QUOTATION' && (
                  <div className="text-slate-600 space-y-1">
                    <div className="font-semibold text-slate-900">Syarat & Ketentuan Penawaran:</div>
                    <div>1. Harga sudah memperhitungkan spesifikasi yang tercantum pada tabel penawaran.</div>
                    <div>2. Penayangan iklan wajib didahului dengan PO/Kontrak dan penerbitan Media Order (MO).</div>
                    <div>3. Catatan Revisi: {activeVersion.catatan_revisi || '-'}</div>
                  </div>
                )}
              </div>

              <div className="col-span-5 space-y-1.5 font-mono">
                {docType === 'QUOTATION' && (
                  <>
                    <div className="flex justify-between text-slate-600">
                      <span className="font-sans">Subtotal:</span>
                      <span>{formatRupiah(activeVersion.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span className="font-sans">
                        Diskon Total {activeVersion.diskon_tipe === 'nominal' ? '(Nominal)' : `(${activeVersion.diskon_persen || 0}%)`}:
                      </span>
                      <span>- {formatRupiah(activeVersion.diskon_nominal)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span className="font-sans">DPP (Dasar Pengenaan Pajak):</span>
                      <span>{formatRupiah(activeVersion.dpp)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span className="font-sans">PPN (11%):</span>
                      <span>{formatRupiah(activeVersion.ppn_nominal)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-slate-900 pt-1.5 border-t border-slate-300">
                      <span className="font-sans">GRAND TOTAL:</span>
                      <span>{formatRupiah(activeVersion.grand_total)}</span>
                    </div>
                  </>
                )}

                {docType === 'INVOICE' && (
                  <>
                    <div className="flex justify-between text-slate-600">
                      <span className="font-sans">Subtotal (DPP):</span>
                      <span>{formatRupiah(data.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span className="font-sans">PPN (11%):</span>
                      <span>+ {formatRupiah(data.ppn_nominal)}</span>
                    </div>
                    {Number(data.pph23_dipotong) === 1 && (
                      <div className="flex justify-between text-slate-600">
                        <span className="font-sans">Potongan PPh Pasal 23 (2%):</span>
                        <span>- {formatRupiah(data.pph23_nominal)}</span>
                      </div>
                    )}
                    {Number(data.meterai) > 0 && (
                      <div className="flex justify-between text-slate-600">
                        <span className="font-sans">Bea Meterai:</span>
                        <span>+ {formatRupiah(data.meterai)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-bold text-slate-900 pt-1.5 border-t border-slate-300">
                      <span className="font-sans">TOTAL TAGIHAN:</span>
                      <span>{formatRupiah(data.total_tagihan)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-700 font-semibold">
                      <span className="font-sans">Sudah Dibayar:</span>
                      <span>{formatRupiah(data.total_dibayar)}</span>
                    </div>
                    <div className="flex justify-between text-slate-900 font-bold">
                      <span className="font-sans">Sisa Piutang:</span>
                      <span>{formatRupiah(Math.max(0, Number(data.total_tagihan) - Number(data.total_dibayar)))}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 5. Unbroken Dynamic Signature & Verification Footer Block (Section 8.1) */}
        <div className="signature-block mt-8 pt-4 border-t border-slate-200">
          <div
            className={
              activeSignatories.length === 1
                ? 'flex justify-end text-xs text-center'
                : activeSignatories.length === 2
                ? 'grid grid-cols-2 gap-12 text-xs text-center'
                : activeSignatories.length === 3
                ? 'grid grid-cols-3 gap-8 text-xs text-center'
                : 'grid grid-cols-4 gap-6 text-xs text-center'
            }
          >
            {activeSignatories.map((slot) => {
              const resolved = resolveSignatoryPerson(slot);
              return (
                <div
                  key={slot.id}
                  className={activeSignatories.length === 1 ? 'w-72 flex flex-col items-center' : 'flex flex-col items-center'}
                >
                  <div className="text-slate-600 font-medium">{slot.label_atas}</div>
                  <div className="h-16 flex items-center justify-center gap-2 my-1 relative">
                    {slot.tampilkan_ttd_digital && (
                      <div className="px-2.5 py-1 border border-blue-200 bg-blue-50/50 rounded text-[10px] font-mono text-blue-800">
                        ✓ TTD Digital: {resolved.nama.split(' ')[0]}
                      </div>
                    )}
                    {slot.tampilkan_stempel && (
                      <div className="px-2.5 py-1 border-2 border-emerald-700/60 text-emerald-800 rounded text-[10px] font-mono font-bold tracking-wider uppercase -rotate-3">
                        STEMPEL RESMI
                      </div>
                    )}
                  </div>
                  <div className="font-bold text-slate-900 underline">{resolved.nama}</div>
                  <div className="text-slate-500 text-[11px] mt-0.5">{resolved.jabatan}</div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>{pdfFooterNote}</span>
            <span>Halaman 1 dari 1</span>
          </div>
        </div>
      </div>
    </div>
  );
};
