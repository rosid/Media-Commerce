import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  X,
  Users,
  Briefcase,
  Receipt,
  FileText,
  Layers,
  ArrowRight,
  CornerDownLeft,
  Command,
  Printer,
  ChevronRight,
} from 'lucide-react';
import { formatRupiah, formatDateId, getStatusSemanticColor } from '../utils/format';
import { PrintableDocType } from './PrintDocumentModal';

export interface GlobalSearchResult {
  id: string | number;
  type: 'client' | 'deal' | 'invoice' | 'quotation' | 'media_order';
  typeLabel: string;
  typeBadgeColor: string;
  title: string;
  subtitle: string;
  meta: string;
  status?: string;
  amount?: number;
  raw: Record<string, any>;
  targetTab: string;
  targetEntityId?: number;
  printableDocType?: PrintableDocType;
}

interface GlobalSearchBarProps {
  clients: Array<Record<string, any>>;
  deals: Array<Record<string, any>>;
  invoices: Array<Record<string, any>>;
  quotations: Array<Record<string, any>>;
  mediaOrders: Array<Record<string, any>>;
  onNavigate: (tab: string, entityId?: number) => void;
  onPrintDocument?: (type: PrintableDocType, data: Record<string, any>) => void;
}

export const GlobalSearchBar: React.FC<GlobalSearchBarProps> = ({
  clients,
  deals,
  invoices,
  quotations,
  mediaOrders,
  onNavigate,
  onPrintDocument,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global Keyboard Shortcuts (Ctrl+K, Cmd+K, or Slash '/')
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if typing in another input/textarea unless it's Ctrl+K
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const isInput = targetTag === 'input' || targetTag === 'textarea' || targetTag === 'select';

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        setTimeout(() => inputRef.current?.focus(), 50);
      } else if (e.key === '/' && !isInput && !isOpen) {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Aggregate and search results across modules
  const searchResults: GlobalSearchResult[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    const results: GlobalSearchResult[] = [];

    // 1. Search Clients
    if (typeFilter === 'all' || typeFilter === 'client') {
      clients.forEach((c) => {
        const match =
          !q ||
          c.nama?.toLowerCase().includes(q) ||
          c.npwp?.toLowerCase().includes(q) ||
          c.alamat_tagih?.toLowerCase().includes(q) ||
          c.brand_turunan?.toLowerCase().includes(q) ||
          c.contacts?.some(
            (ct: any) =>
              ct.nama_pic?.toLowerCase().includes(q) ||
              ct.email?.toLowerCase().includes(q) ||
              ct.telepon?.toLowerCase().includes(q)
          );

        if (match) {
          const pic = c.contacts?.[0] || {};
          results.push({
            id: `client-${c.id}`,
            type: 'client',
            typeLabel: 'Klien',
            typeBadgeColor: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
            title: c.nama,
            subtitle: `${c.tipe === 'agensi' ? 'Agensi Media' : 'Brand Langsung'} · NPWP: ${c.npwp || '-'}`,
            meta: `PIC: ${pic.nama_pic || '-'} (${pic.email || pic.telepon || '-'}) · NET ${c.termin_hari} Hari`,
            raw: c,
            targetTab: 'clients',
            targetEntityId: c.id,
          });
        }
      });
    }

    // 2. Search Deals
    if (typeFilter === 'all' || typeFilter === 'deal') {
      deals.forEach((d) => {
        const match =
          !q ||
          d.nomor?.toLowerCase().includes(q) ||
          d.nama_deal?.toLowerCase().includes(q) ||
          d.no_po_klien?.toLowerCase().includes(q) ||
          d.snapshot_nama_klien?.toLowerCase().includes(q) ||
          d.status?.toLowerCase().includes(q);

        if (match) {
          results.push({
            id: `deal-${d.id}`,
            type: 'deal',
            typeLabel: 'Paket Deal',
            typeBadgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
            title: `${d.nomor} — ${d.nama_deal}`,
            subtitle: `Klien: ${d.snapshot_nama_klien || '-'} · PO: ${d.no_po_klien || '-'}`,
            meta: `Skema: ${d.skema_tagih === 'per_mo' ? 'Per MO' : d.skema_tagih === 'termin' ? 'Termin Deal' : 'Akhir Kampanye'} · Progres: ${d.total_kuota_unit || 0} Unit`,
            status: d.status,
            amount: d.grand_total,
            raw: d,
            targetTab: 'deals',
            targetEntityId: d.id,
          });
        }
      });
    }

    // 3. Search Invoices
    if (typeFilter === 'all' || typeFilter === 'invoice') {
      invoices.forEach((inv) => {
        const match =
          !q ||
          inv.nomor?.toLowerCase().includes(q) ||
          inv.snapshot_nama_klien?.toLowerCase().includes(q) ||
          inv.no_faktur_pajak?.toLowerCase().includes(q) ||
          inv.status?.toLowerCase().includes(q) ||
          inv.items?.some((it: any) => it.deskripsi?.toLowerCase().includes(q));

        if (match) {
          results.push({
            id: `inv-${inv.id}`,
            type: 'invoice',
            typeLabel: 'Invoice',
            typeBadgeColor: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800',
            title: `${inv.nomor}`,
            subtitle: `Klien: ${inv.snapshot_nama_klien} · Jatuh Tempo: ${formatDateId(inv.jatuh_tempo)}`,
            meta: `Faktur: ${inv.no_faktur_pajak || '-'} · Ref: ${inv.snapshot_no_po || '-'}`,
            status: inv.status,
            amount: inv.total_tagihan,
            raw: inv,
            targetTab: 'invoices',
            targetEntityId: inv.id,
            printableDocType: 'INVOICE',
          });
        }
      });
    }

    // 4. Search Quotations
    if (typeFilter === 'all' || typeFilter === 'quotation') {
      quotations.forEach((quot) => {
        const match =
          !q ||
          quot.nomor?.toLowerCase().includes(q) ||
          quot.judul_penawaran?.toLowerCase().includes(q) ||
          quot.snapshot_nama_klien?.toLowerCase().includes(q) ||
          quot.status?.toLowerCase().includes(q) ||
          quot.nama_sales?.toLowerCase().includes(q);

        if (match) {
          const av = quot.active_version || {};
          results.push({
            id: `quot-${quot.id}`,
            type: 'quotation',
            typeLabel: 'Quotation',
            typeBadgeColor: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
            title: `${quot.nomor} — ${quot.judul_penawaran}`,
            subtitle: `Klien: ${quot.snapshot_nama_klien} · Sales: ${quot.nama_sales}`,
            meta: `Rev.${quot.versi_aktif} · Berlaku s/d ${formatDateId(quot.berlaku_sampai)}`,
            status: quot.status,
            amount: av.grand_total,
            raw: quot,
            targetTab: 'quotations',
            targetEntityId: quot.id,
            printableDocType: 'QUOTATION',
          });
        }
      });
    }

    // 5. Search Media Orders (MO)
    if (typeFilter === 'all' || typeFilter === 'media_order') {
      mediaOrders.forEach((mo) => {
        const match =
          !q ||
          mo.nomor?.toLowerCase().includes(q) ||
          mo.nama_kampanye?.toLowerCase().includes(q) ||
          mo.snapshot_nama_klien?.toLowerCase().includes(q) ||
          mo.jenis?.toLowerCase().includes(q) ||
          mo.status?.toLowerCase().includes(q) ||
          mo.items?.some((it: any) => it.nama_item?.toLowerCase().includes(q) || it.platform?.toLowerCase().includes(q));

        if (match) {
          results.push({
            id: `mo-${mo.id}`,
            type: 'media_order',
            typeLabel: 'Media Order',
            typeBadgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800',
            title: `${mo.nomor} — ${mo.nama_kampanye}`,
            subtitle: `Klien: ${mo.snapshot_nama_klien || '-'} · Jenis: ${mo.jenis}`,
            meta: `Periode: ${formatDateId(mo.periode_mulai)} s/d ${formatDateId(mo.periode_selesai)}`,
            status: mo.status,
            raw: mo,
            targetTab: 'media_orders',
            targetEntityId: mo.id,
            printableDocType: 'MEDIA_ORDER',
          });
        }
      });
    }

    return results;
  }, [query, typeFilter, clients, deals, invoices, quotations, mediaOrders]);

  // Keep selected index within bounds
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchResults.length, query, typeFilter]);

  const handleSelectResult = (result: GlobalSearchResult) => {
    onNavigate(result.targetTab, result.targetEntityId);
    setIsOpen(false);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < searchResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : Math.max(0, searchResults.length - 1)));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (searchResults[selectedIndex]) {
        handleSelectResult(searchResults[selectedIndex]);
      }
    }
  };

  const getResultIcon = (type: GlobalSearchResult['type']) => {
    switch (type) {
      case 'client':
        return <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      case 'deal':
        return <Briefcase className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case 'invoice':
        return <Receipt className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
      case 'quotation':
        return <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case 'media_order':
        return <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
    }
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-md lg:max-w-lg">
      {/* Search Input Trigger Bar in Navbar */}
      <div
        onClick={() => {
          setIsOpen(true);
          inputRef.current?.focus();
        }}
        className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg border transition-all cursor-pointer select-none text-xs ${
          isOpen
            ? 'bg-white border-blue-500 shadow-sm ring-2 ring-blue-500/20 dark:bg-slate-900 dark:border-blue-400'
            : 'bg-slate-100/90 hover:bg-white border-slate-300 hover:border-slate-400 text-slate-600 dark:bg-slate-800/90 dark:hover:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
        }`}
      >
        <Search className="w-4 h-4 text-slate-400 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleInputKeyDown}
          placeholder="Cari klien, deal, invoice, penawaran..."
          className="w-full bg-transparent border-none outline-none text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-0 p-0"
        />

        {query && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setQuery('');
              inputRef.current?.focus();
            }}
            className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        <div className="hidden sm:flex items-center gap-1 shrink-0 font-mono text-[10px] text-slate-400 bg-slate-200/80 dark:bg-slate-700/80 px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-600">
          <Command className="w-2.5 h-2.5" />
          <span>K</span>
        </div>
      </div>

      {/* Global Search Results Dropdown Overlay */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden z-50 text-xs animate-in fade-in zoom-in-95 duration-100 max-h-[80vh] flex flex-col">
          {/* Module Filter Chips Header */}
          <div className="px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 overflow-x-auto">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mr-1">
                Filter:
              </span>
              {[
                { id: 'all', label: 'Semua' },
                { id: 'client', label: 'Klien' },
                { id: 'deal', label: 'Deal' },
                { id: 'invoice', label: 'Invoice' },
                { id: 'quotation', label: 'Quotation' },
                { id: 'media_order', label: 'Media Order' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTypeFilter(tab.id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                    typeFilter === tab.id
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 shrink-0">
              {searchResults.length} Hasil
            </span>
          </div>

          {/* Results List */}
          <div className="overflow-y-auto max-h-[420px] divide-y divide-slate-100 dark:divide-slate-800/60">
            {searchResults.length === 0 ? (
              <div className="py-12 px-6 text-center">
                <Search className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  Tidak ada hasil pencarian
                </p>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 max-w-sm mx-auto">
                  {query
                    ? `Tidak ditemukan klien, deal, atau invoice yang cocok dengan "${query}".`
                    : 'Ketik kata kunci untuk mencari nama perusahaan, nomor deal (DL/...), invoice (INV/...), atau PIC.'}
                </p>
              </div>
            ) : (
              searchResults.map((item, index) => {
                const isSelected = index === selectedIndex;
                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectResult(item)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`px-4 py-3 flex items-start justify-between gap-3 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-blue-50/80 dark:bg-blue-950/40 border-l-3 border-blue-600'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0 mt-0.5">
                        {getResultIcon(item.type)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${item.typeBadgeColor}`}
                          >
                            {item.typeLabel}
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white truncate">
                            {item.title}
                          </span>
                          {item.status && (
                            <span className={getStatusSemanticColor(item.status)}>
                              {item.status}
                            </span>
                          )}
                        </div>
                        <div className="text-slate-600 dark:text-slate-400 mt-1 truncate">
                          {item.subtitle}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 dark:text-slate-500 mt-0.5 truncate">
                          {item.meta}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-center">
                      {item.amount !== undefined && (
                        <div className="text-right font-mono">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {formatRupiah(item.amount)}
                          </span>
                        </div>
                      )}

                      {item.printableDocType && onPrintDocument && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onPrintDocument(item.printableDocType!, item.raw);
                            setIsOpen(false);
                          }}
                          title={`Cetak PDF ${item.typeLabel}`}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-md transition-colors cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleSelectResult(item)}
                        className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                        }`}
                        title="Buka Halaman Modul"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Quick Helper Footer */}
          <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 font-mono">
                <kbd className="px-1 py-0.5 bg-white dark:bg-slate-700 rounded border border-slate-300 dark:border-slate-600 text-[10px]">
                  ↑
                </kbd>
                <kbd className="px-1 py-0.5 bg-white dark:bg-slate-700 rounded border border-slate-300 dark:border-slate-600 text-[10px]">
                  ↓
                </kbd>{' '}
                Navigasi
              </span>
              <span className="flex items-center gap-1 font-mono">
                <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded border border-slate-300 dark:border-slate-600 text-[10px]">
                  Enter
                </kbd>{' '}
                Buka
              </span>
              <span className="flex items-center gap-1 font-mono">
                <kbd className="px-1 py-0.5 bg-white dark:bg-slate-700 rounded border border-slate-300 dark:border-slate-600 text-[10px]">
                  Esc
                </kbd>{' '}
                Tutup
              </span>
            </div>
            <div className="hidden sm:inline-block">
              Pencarian lintas Klien, Deal, Invoice, Penawaran & MO
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
