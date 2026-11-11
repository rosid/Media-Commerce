export function formatRupiah(value: number | string | undefined | null): string {
  const num = Number(value || 0);
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatNumber(value: number | string | undefined | null): string {
  return new Intl.NumberFormat('id-ID').format(Number(value || 0));
}

export function formatDateId(dateStr: string | undefined | null): string {
  if (!dateStr) return '-';
  const clean = dateStr.split(' ')[0];
  const parts = clean.split('-');
  if (parts.length !== 3) return dateStr;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const mIdx = parseInt(parts[1], 10) - 1;
  return `${parts[2]} ${months[mIdx] || parts[1]} ${parts[0]}`;
}

export function formatDateTimeId(dateTimeStr: string | undefined | null): string {
  if (!dateTimeStr) return '-';
  const [datePart, timePart] = dateTimeStr.replace('T', ' ').split(' ');
  const formattedDate = formatDateId(datePart);
  if (!timePart) return formattedDate;
  return `${formattedDate}, ${timePart.slice(0, 5)} WIB`;
}

const SATUAN = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];

function sebutAngka(n: number): string {
  n = Math.floor(Math.abs(n));
  if (n < 12) return SATUAN[n];
  if (n < 20) return `${sebutAngka(n - 10)} Belas`;
  if (n < 100) return `${sebutAngka(Math.floor(n / 10))} Puluh ${sebutAngka(n % 10)}`.trim();
  if (n < 200) return `Seratus ${sebutAngka(n - 100)}`.trim();
  if (n < 1000) return `${sebutAngka(Math.floor(n / 100))} Ratus ${sebutAngka(n % 100)}`.trim();
  if (n < 2000) return `Seribu ${sebutAngka(n - 1000)}`.trim();
  if (n < 1000000) return `${sebutAngka(Math.floor(n / 1000))} Ribu ${sebutAngka(n % 1000)}`.trim();
  if (n < 1000000000) return `${sebutAngka(Math.floor(n / 1000000))} Juta ${sebutAngka(n % 1000000)}`.trim();
  if (n < 1000000000000) return `${sebutAngka(Math.floor(n / 1000000000))} Miliar ${sebutAngka(n % 1000000000)}`.trim();
  return `${formatNumber(n)}`;
}

export function terbilangRupiah(nominal: number): string {
  if (!nominal || nominal <= 0) return 'Nol Rupiah';
  return `${sebutAngka(nominal).replace(/\s+/g, ' ').trim()} Rupiah`;
}

export function exportToCsv(filename: string, rows: Array<Record<string, any>>) {
  if (!rows || rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csvLines = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const val = row[h] === null || row[h] === undefined ? '' : String(row[h]);
          return `"${val.replace(/"/g, '""')}"`;
        })
        .join(',')
    ),
  ];
  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface RolePerm {
  modul: string;
  can_create: number;
  can_update: number;
  can_approve: number;
  can_view: number;
  scope: string;
}

export function checkPerm(
  permissions: RolePerm[],
  modul: string,
  action: 'create' | 'update' | 'approve' | 'view' = 'view'
): boolean {
  const found = permissions.find((p) => p.modul === modul);
  if (!found) return false;
  if (action === 'create') return Boolean(found.can_create);
  if (action === 'update') return Boolean(found.can_update);
  if (action === 'approve') return Boolean(found.can_approve);
  return Boolean(found.can_view);
}

export function getStatusSemanticColor(status: string): string {
  const s = (status || '').toLowerCase();
  if (
    s.includes('deal') ||
    s.includes('lunas') ||
    s.includes('terverifikasi') ||
    s.includes('selesai') ||
    s.includes('disetujui')
  ) {
    return 'text-emerald-700 font-semibold';
  }
  if (
    s.includes('menunggu') ||
    s.includes('sebagian') ||
    s.includes('negosiasi') ||
    s.includes('produksi') ||
    s.includes('terjadwal') ||
    s.includes('berjalan')
  ) {
    return 'text-amber-700 font-semibold';
  }
  if (s.includes('lost') || s.includes('batal') || s.includes('ditolak') || s.includes('jatuh tempo') || s.includes('expired')) {
    return 'text-red-700 font-semibold';
  }
  return 'text-slate-700 font-medium';
}

export interface PdfSignatorySlot {
  id: string;
  label_atas: string;
  mode_penandatangan: 'custom' | 'pembuat' | 'klien';
  nama: string;
  jabatan: string;
  tampilkan_ttd_digital: boolean;
  tampilkan_stempel: boolean;
}

export type PdfDocKey = 'QUOTATION' | 'MEDIA_ORDER' | 'INVOICE' | 'PROOF' | 'DEAL_PROGRESS' | 'RECEIPT';

export type PdfSignatureMap = Record<PdfDocKey, PdfSignatorySlot[]>;

export const DEFAULT_COMPANY_LOGO_SVG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none">
      <rect width="120" height="120" rx="22" fill="#0F172A"/>
      <path d="M28 86V34H43L64 66V34H78V86H63L42 54V86H28Z" fill="#FFFFFF"/>
      <circle cx="92" cy="38" r="10" fill="#2563EB"/>
      <path d="M28 96H92" stroke="#2563EB" stroke-width="6" stroke-linecap="round"/>
    </svg>
  `);

export const DEFAULT_PDF_SIGNATURES: PdfSignatureMap = {
  QUOTATION: [
    {
      id: 'qt-1',
      label_atas: 'Hormat Kami, Diajukan Oleh',
      mode_penandatangan: 'pembuat',
      nama: 'Dimas Pratama',
      jabatan: 'Senior Account Executive',
      tampilkan_ttd_digital: true,
      tampilkan_stempel: true,
    },
    {
      id: 'qt-2',
      label_atas: 'Menyetujui, Konfirmasi Klien',
      mode_penandatangan: 'klien',
      nama: 'PIC Klien',
      jabatan: 'Pihak Klien / Pengiklan',
      tampilkan_ttd_digital: false,
      tampilkan_stempel: false,
    },
  ],
  MEDIA_ORDER: [
    {
      id: 'mo-1',
      label_atas: 'Disiapkan Oleh (Media Planner),',
      mode_penandatangan: 'pembuat',
      nama: 'Rina Kartika',
      jabatan: 'Digital Campaign & Traffic Specialist',
      tampilkan_ttd_digital: true,
      tampilkan_stempel: false,
    },
    {
      id: 'mo-2',
      label_atas: 'Disetujui Oleh (Manager),',
      mode_penandatangan: 'custom',
      nama: 'Budi Santoso',
      jabatan: 'Commercial Group Manager',
      tampilkan_ttd_digital: true,
      tampilkan_stempel: true,
    },
    {
      id: 'mo-3',
      label_atas: 'Menyetujui, Pihak Klien / Agensi',
      mode_penandatangan: 'klien',
      nama: 'PIC Klien',
      jabatan: 'Pihak Klien',
      tampilkan_ttd_digital: false,
      tampilkan_stempel: false,
    },
  ],
  INVOICE: [
    {
      id: 'inv-1',
      label_atas: 'Hormat Kami, Otorisasi Keuangan & Pajak',
      mode_penandatangan: 'custom',
      nama: 'Siti Rahmawati',
      jabatan: 'Billing & AR Supervisor',
      tampilkan_ttd_digital: true,
      tampilkan_stempel: true,
    },
  ],
  PROOF: [
    {
      id: 'prf-1',
      label_atas: 'Dilaporkan Oleh (Tim Kampanye),',
      mode_penandatangan: 'pembuat',
      nama: 'Rina Kartika',
      jabatan: 'Digital Campaign & Traffic Specialist',
      tampilkan_ttd_digital: true,
      tampilkan_stempel: false,
    },
    {
      id: 'prf-2',
      label_atas: 'Diverifikasi Oleh (Manajemen),',
      mode_penandatangan: 'custom',
      nama: 'Budi Santoso',
      jabatan: 'Commercial Group Manager',
      tampilkan_ttd_digital: true,
      tampilkan_stempel: true,
    },
  ],
  DEAL_PROGRESS: [
    {
      id: 'dl-1',
      label_atas: 'Disusun Oleh (Account Executive),',
      mode_penandatangan: 'pembuat',
      nama: 'Dimas Pratama',
      jabatan: 'Senior Account Executive',
      tampilkan_ttd_digital: true,
      tampilkan_stempel: false,
    },
    {
      id: 'dl-2',
      label_atas: 'Mengetahui (Direktur Komersial),',
      mode_penandatangan: 'custom',
      nama: 'Hendra Kusuma',
      jabatan: 'Direktur Komersial & Bisnis',
      tampilkan_ttd_digital: true,
      tampilkan_stempel: true,
    },
  ],
  RECEIPT: [
    {
      id: 'kwt-1',
      label_atas: 'Diterima Oleh (Finance / Kasir),',
      mode_penandatangan: 'pembuat',
      nama: 'Siti Rahmawati',
      jabatan: 'Billing & Finance Officer',
      tampilkan_ttd_digital: true,
      tampilkan_stempel: true,
    },
  ],
};

export function parsePdfSignaturesConfig(rawJson?: string | null): PdfSignatureMap {
  if (!rawJson) return DEFAULT_PDF_SIGNATURES;
  try {
    const parsed = JSON.parse(rawJson);
    return {
      QUOTATION: Array.isArray(parsed.QUOTATION) && parsed.QUOTATION.length > 0 ? parsed.QUOTATION : DEFAULT_PDF_SIGNATURES.QUOTATION,
      MEDIA_ORDER: Array.isArray(parsed.MEDIA_ORDER) && parsed.MEDIA_ORDER.length > 0 ? parsed.MEDIA_ORDER : DEFAULT_PDF_SIGNATURES.MEDIA_ORDER,
      INVOICE: Array.isArray(parsed.INVOICE) && parsed.INVOICE.length > 0 ? parsed.INVOICE : DEFAULT_PDF_SIGNATURES.INVOICE,
      PROOF: Array.isArray(parsed.PROOF) && parsed.PROOF.length > 0 ? parsed.PROOF : DEFAULT_PDF_SIGNATURES.PROOF,
      DEAL_PROGRESS: Array.isArray(parsed.DEAL_PROGRESS) && parsed.DEAL_PROGRESS.length > 0 ? parsed.DEAL_PROGRESS : DEFAULT_PDF_SIGNATURES.DEAL_PROGRESS,
      RECEIPT: Array.isArray(parsed.RECEIPT) && parsed.RECEIPT.length > 0 ? parsed.RECEIPT : DEFAULT_PDF_SIGNATURES.RECEIPT,
    };
  } catch {
    return DEFAULT_PDF_SIGNATURES;
  }
}

