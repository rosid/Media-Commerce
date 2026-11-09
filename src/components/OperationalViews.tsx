import React, { useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  Edit2,
  FilePlus2,
  Filter,
  FolderKanban,
  GitCompare,
  History,
  Package,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Tag,
  Tags,
  Trash2,
  Upload,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import {
  formatRupiah,
  formatNumber,
  formatDateId,
  checkPerm,
  RolePerm,
  getStatusSemanticColor,
} from '../utils/format';
import { PrintableDocType } from './PrintDocumentModal';

// ============================================================================
// 1. MASTER KLIEN & KONTAK
// ============================================================================
export const ClientsModule: React.FC<{
  clients: Array<Record<string, any>>;
  permissions: RolePerm[];
  apiPost: (url: string, body: any) => Promise<any>;
  onRefresh: () => void;
}> = ({ clients, permissions, apiPost, onRefresh }) => {
  const [showForm, setShowForm] = useState(false);
  const [nama, setNama] = useState('');
  const [tipe, setTipe] = useState<'brand' | 'agensi'>('brand');
  const [parentClientId, setParentClientId] = useState<string>('');
  const [brandTurunan, setBrandTurunan] = useState('');
  const [npwp, setNpwp] = useState('01.554.889.1-012.000');
  const [alamatTagih, setAlamatTagih] = useState('');
  const [terminHari, setTerminHari] = useState(30);
  const [namaPic, setNamaPic] = useState('');
  const [jabatanPic, setJabatanPic] = useState('Brand & Media Manager');
  const [emailPic, setEmailPic] = useState('');
  const [teleponPic, setTeleponPic] = useState('');

  const canCreate = checkPerm(permissions, 'clients', 'create');
  const agencies = clients.filter((c) => c.tipe === 'agensi');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nama || !alamatTagih) return;
    await apiPost('/api/clients', {
      nama,
      tipe,
      parent_client_id: parentClientId ? Number(parentClientId) : null,
      brand_turunan: brandTurunan,
      npwp,
      alamat_tagih: alamatTagih,
      termin_hari: terminHari,
      nama_pic: namaPic,
      jabatan_pic: jabatanPic,
      email_pic: emailPic,
      telepon_pic: teleponPic,
    });
    setShowForm(false);
    setNama('');
    setAlamatTagih('');
    setNamaPic('');
    onRefresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Master Klien & Kontak Penagihan
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Mendukung klien Brand Langsung maupun Agensi Iklan dengan Brand Turunan serta pengaturan Termin Default (NET 14, 30, 45).
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 self-start cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            {showForm ? 'Tutup Form' : 'Tambah Klien Baru'}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-900">Registrasi Master Klien & PIC Penagihan</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Nama Perusahaan (PT/CV)</label>
              <input
                type="text"
                required
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                placeholder="PT Indofood CBP Sukses Makmur Tbk"
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Tipe Klien</label>
              <select
                value={tipe}
                onChange={(e) => setTipe(e.target.value as 'brand' | 'agensi')}
                className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
              >
                <option value="brand">Brand Langsung</option>
                <option value="agensi">Agensi Media / Periklanan</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Agensi Induk (Opsional bila via Agensi)</label>
              <select
                value={parentClientId}
                onChange={(e) => setParentClientId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
              >
                <option value="">-- Langsung Tanpa Agensi --</option>
                {agencies.map((ag) => (
                  <option key={ag.id} value={ag.id}>
                    {ag.nama}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Nama Produk / Brand Turunan</label>
              <input
                type="text"
                value={brandTurunan}
                onChange={(e) => setBrandTurunan(e.target.value)}
                placeholder="Indomie / Pop Mie Digital"
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Nomor NPWP</label>
              <input
                type="text"
                required
                value={npwp}
                onChange={(e) => setNpwp(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Termin Pembayaran Default</label>
              <select
                value={terminHari}
                onChange={(e) => setTerminHari(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white font-mono"
              >
                <option value={14}>NET 14 Hari</option>
                <option value={30}>NET 30 Hari</option>
                <option value={45}>NET 45 Hari</option>
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="block font-medium text-slate-700 mb-1">Alamat Penagihan Lengkap</label>
              <input
                type="text"
                required
                value={alamatTagih}
                onChange={(e) => setAlamatTagih(e.target.value)}
                placeholder="Sudirman Plaza Indofood Tower Lt. 25, Jl. Jend. Sudirman Kav. 76-78, Jakarta Selatan"
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Nama PIC Klien</label>
              <input
                type="text"
                required
                value={namaPic}
                onChange={(e) => setNamaPic(e.target.value)}
                placeholder="Bpk. Hendro Wibowo"
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Email PIC</label>
              <input
                type="email"
                required
                value={emailPic}
                onChange={(e) => setEmailPic(e.target.value)}
                placeholder="hendro.w@client.co.id"
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Telepon / WhatsApp PIC</label>
              <input
                type="text"
                required
                value={teleponPic}
                onChange={(e) => setTeleponPic(e.target.value)}
                placeholder="0811-8899-7766"
                className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 border border-slate-300 text-xs font-medium rounded-md cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md cursor-pointer"
            >
              Simpan Master Klien
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <th className="py-3 px-4 text-left">Kode & Nama Perusahaan</th>
              <th className="py-3 px-4 text-left">Tipe & Brand</th>
              <th className="py-3 px-4 text-left">NPWP & Alamat Tagih</th>
              <th className="py-3 px-4 text-left">Kontak PIC Utama</th>
              <th className="py-3 px-4 text-right font-mono">Termin</th>
              <th className="py-3 px-4 text-left">Pemilik (Sales)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {clients.map((c) => {
              const pic = (c.contacts || [])[0] || {};
              return (
                <tr key={c.id} className="hover:bg-slate-50/70">
                  <td className="py-3.5 px-4">
                    <div className="font-mono font-bold text-blue-700">{c.kode}</div>
                    <div className="font-semibold text-slate-900 mt-0.5">{c.nama}</div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-medium text-slate-800 capitalize">{c.tipe}</div>
                    <div className="text-slate-500">
                      {c.brand_turunan || '-'}
                      {c.nama_agensi_induk ? ` · via ${c.nama_agensi_induk}` : ''}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 max-w-xs">
                    <div className="font-mono text-slate-800">{c.npwp}</div>
                    <div className="text-slate-500 truncate" title={c.alamat_tagih}>
                      {c.alamat_tagih}
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-medium text-slate-900">{pic.nama_pic || '-'}</div>
                    <div className="text-slate-500 font-mono">
                      {pic.email} · {pic.telepon}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-semibold text-slate-900">
                    NET {c.termin_hari}
                  </td>
                  <td className="py-3.5 px-4 font-medium text-slate-800">{c.nama_sales}</td>
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
// 2. KATALOG PRODUK, RATE CARD BERVERSI & PAKET PENAWARAN
// ============================================================================
export const CatalogModule: React.FC<{
  products: Array<Record<string, any>>;
  packages: Array<Record<string, any>>;
  categories?: Array<Record<string, any>>;
  permissions: RolePerm[];
  apiPost: (url: string, body: any) => Promise<any>;
  apiPut?: (url: string, body: any) => Promise<any>;
  apiDelete?: (url: string) => Promise<any>;
  showToast?: (msg: string) => void;
  onRefresh: () => void;
}> = ({ products, packages, categories = [], permissions, apiPost, apiPut, apiDelete, showToast, onRefresh }) => {
  const [showNewProd, setShowNewProd] = useState(false);
  const [editingPriceProd, setEditingPriceProd] = useState<Record<string, any> | null>(null);
  const [newPriceVal, setNewPriceVal] = useState('');
  const [nama, setNama] = useState('');
  const [kategori, setKategori] = useState('Website');
  const [spesifikasi, setSpesifikasi] = useState('');
  const [satuan, setSatuan] = useState('Artikel');
  const [tipeKuota, setTipeKuota] = useState('jumlah');
  const [slotInventori, setSlotInventori] = useState('Editorial Feed');
  const [harga, setHarga] = useState('15000000');

  // Category Management State
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCatNama, setNewCatNama] = useState('');
  const [newCatDeskripsi, setNewCatDeskripsi] = useState('');
  const [editingCat, setEditingCat] = useState<Record<string, any> | null>(null);
  const [editCatNama, setEditCatNama] = useState('');
  const [editCatDeskripsi, setEditCatDeskripsi] = useState('');
  const [catFilter, setCatFilter] = useState('ALL');
  const [isSavingCat, setIsSavingCat] = useState(false);

  const canUpdate = checkPerm(permissions, 'catalog', 'update');

  const categoriesList = categories && categories.length > 0
    ? categories
    : [
        { id: 1, nama: 'Website', deskripsi: 'Kanal portal berita, advertorial SEO, dan banner', total_produk: 0 },
        { id: 2, nama: 'Sosial Media', deskripsi: 'Instagram, TikTok, dan media sosial resmi', total_produk: 0 },
        { id: 3, nama: 'Video', deskripsi: 'YouTube dedicated video dan podcast visual', total_produk: 0 },
        { id: 4, nama: 'Newsletter', deskripsi: 'Email blast buletin korporat pagi', total_produk: 0 },
        { id: 5, nama: 'Podcast', deskripsi: 'Audio show streaming dan sponsorship ad-lib', total_produk: 0 },
        { id: 6, nama: 'Event', deskripsi: 'Aktivasi offline seminar dan expo bisnis', total_produk: 0 },
        { id: 7, nama: 'Influencer', deskripsi: 'Kolaborasi KOL dan content creator', total_produk: 0 },
      ];

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiPost('/api/catalog/products', {
      nama,
      kategori,
      spesifikasi,
      satuan,
      tipe_kuota: tipeKuota,
      slot_inventori: slotInventori,
      harga: Number(harga),
    });
    setShowNewProd(false);
    setNama('');
    setSpesifikasi('');
    onRefresh();
    if (showToast) showToast(`Produk Rate Card "${nama}" berhasil ditambahkan.`);
  };

  const handleUpdatePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPriceProd || !newPriceVal) return;
    await apiPost(`/api/catalog/products/${editingPriceProd.id}/new-price`, {
      harga_baru: Number(newPriceVal),
      berlaku_dari: '2026-11-08',
    });
    setEditingPriceProd(null);
    setNewPriceVal('');
    onRefresh();
    if (showToast) showToast('Versi harga baru berhasil diterbitkan.');
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatNama.trim()) return;
    setIsSavingCat(true);
    try {
      await apiPost('/api/catalog/categories', {
        nama: newCatNama.trim(),
        deskripsi: newCatDeskripsi.trim(),
      });
      setNewCatNama('');
      setNewCatDeskripsi('');
      onRefresh();
      if (showToast) showToast(`Kategori "${newCatNama.trim()}" berhasil ditambahkan.`);
    } catch (err: any) {
      if (showToast) showToast(err.message || 'Gagal menambahkan kategori.');
    } finally {
      setIsSavingCat(false);
    }
  };

  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCat || !editCatNama.trim()) return;
    setIsSavingCat(true);
    try {
      if (apiPut) {
        await apiPut(`/api/catalog/categories/${editingCat.id}`, {
          nama: editCatNama.trim(),
          deskripsi: editCatDeskripsi.trim(),
        });
      } else {
        await apiPost(`/api/catalog/categories/${editingCat.id}`, {
          nama: editCatNama.trim(),
          deskripsi: editCatDeskripsi.trim(),
        });
      }
      setEditingCat(null);
      onRefresh();
      if (showToast) showToast(`Kategori berhasil diperbarui menjadi "${editCatNama.trim()}".`);
    } catch (err: any) {
      if (showToast) showToast(err.message || 'Gagal mengubah kategori.');
    } finally {
      setIsSavingCat(false);
    }
  };

  const handleDeleteCategory = async (cat: Record<string, any>) => {
    if (!confirm(`Hapus kategori "${cat.nama}"?`)) return;
    try {
      if (apiDelete) {
        await apiDelete(`/api/catalog/categories/${cat.id}`);
      }
      onRefresh();
      if (showToast) showToast(`Kategori "${cat.nama}" berhasil dihapus.`);
    } catch (err: any) {
      if (showToast) showToast(err.message || 'Gagal menghapus kategori.');
    }
  };

  const filteredProducts = products.filter((p) => {
    if (catFilter !== 'ALL' && p.kategori !== catFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Katalog Produk, Rate Card Berversi & Paket Bundel
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Kelola master kategori media, produk rate card, dan paket bundling dengan riwayat versi harga transparan.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start">
          <button
            type="button"
            onClick={() => setShowCategoryModal(true)}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <FolderKanban className="w-3.5 h-3.5 text-blue-600" />
            Tambah & Edit Kategori ({categoriesList.length})
          </button>
          {canUpdate && (
            <button
              onClick={() => setShowNewProd(!showNewProd)}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Tambah Item Rate Card
            </button>
          )}
        </div>
      </div>

      {/* MODAL KELOLA KATEGORI KATALOG */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden text-xs">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <FolderKanban className="w-4 h-4 text-blue-600" />
                <h2 className="text-base font-bold text-slate-900">
                  Manajemen Kategori Katalog Media
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCategoryModal(false);
                  setEditingCat(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto">
              {/* Form Tambah atau Edit Kategori */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                <div className="font-bold text-slate-900 flex items-center justify-between">
                  <span>{editingCat ? `Edit Kategori: ${editingCat.nama}` : 'Tambah Kategori Baru'}</span>
                  {editingCat && (
                    <button
                      type="button"
                      onClick={() => setEditingCat(null)}
                      className="text-[11px] text-blue-600 hover:underline cursor-pointer"
                    >
                      Batal Edit / Tambah Baru
                    </button>
                  )}
                </div>

                <form
                  onSubmit={editingCat ? handleUpdateCategory : handleCreateCategory}
                  className="space-y-3"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Nama Kategori
                      </label>
                      <input
                        type="text"
                        required
                        value={editingCat ? editCatNama : newCatNama}
                        onChange={(e) =>
                          editingCat ? setEditCatNama(e.target.value) : setNewCatNama(e.target.value)
                        }
                        placeholder="Contoh: Digital Out-of-Home (DOOH)"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Deskripsi Singkat
                      </label>
                      <input
                        type="text"
                        value={editingCat ? editCatDeskripsi : newCatDeskripsi}
                        onChange={(e) =>
                          editingCat
                            ? setEditCatDeskripsi(e.target.value)
                            : setNewCatDeskripsi(e.target.value)
                        }
                        placeholder="Keterangan penempatan atau format..."
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-900"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    {editingCat && (
                      <button
                        type="button"
                        onClick={() => setEditingCat(null)}
                        className="px-3.5 py-1.5 border border-slate-300 bg-white rounded-md cursor-pointer"
                      >
                        Batal
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={isSavingCat}
                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      {isSavingCat
                        ? 'Menyimpan...'
                        : editingCat
                        ? 'Perbarui Kategori'
                        : 'Tambah Kategori'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Tabel Daftar Kategori */}
              <div>
                <div className="font-bold text-slate-900 mb-2">
                  Daftar Kategori Saat Ini ({categoriesList.length})
                </div>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-600 border-b border-slate-200">
                        <th className="py-2.5 px-3 text-left">Nama Kategori</th>
                        <th className="py-2.5 px-3 text-left">Deskripsi</th>
                        <th className="py-2.5 px-3 text-center">Produk Terkait</th>
                        <th className="py-2.5 px-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {categoriesList.map((cat: any) => {
                        const prodCount = products.filter((p) => p.kategori === cat.nama).length;
                        return (
                          <tr key={cat.id || cat.nama} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-semibold text-slate-900">
                              <span className="inline-flex items-center gap-1.5">
                                <Tag className="w-3.5 h-3.5 text-blue-600" />
                                {cat.nama}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">{cat.deskripsi || '-'}</td>
                            <td className="py-2.5 px-3 text-center font-mono">
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-bold text-[11px]">
                                {prodCount} Item
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingCat(cat);
                                    setEditCatNama(cat.nama);
                                    setEditCatDeskripsi(cat.deskripsi || '');
                                  }}
                                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded flex items-center gap-1 font-medium cursor-pointer"
                                  title="Edit Kategori"
                                >
                                  <Pencil className="w-3 h-3 text-blue-600" />
                                  Edit
                                </button>
                                {cat.id && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCategory(cat)}
                                    disabled={prodCount > 0}
                                    className={`px-2 py-1 rounded flex items-center gap-1 font-medium ${
                                      prodCount > 0
                                        ? 'bg-slate-50 text-slate-300 cursor-not-allowed'
                                        : 'bg-red-50 hover:bg-red-100 text-red-700 cursor-pointer'
                                    }`}
                                    title={
                                      prodCount > 0
                                        ? 'Kategori tidak dapat dihapus karena masih digunakan produk'
                                        : 'Hapus Kategori'
                                    }
                                  >
                                    <Trash2 className="w-3 h-3" />
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
            </div>

            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowCategoryModal(false);
                  setEditingCat(null);
                }}
                className="px-4 py-2 bg-slate-900 text-white font-semibold rounded-md cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {showNewProd && (
        <form onSubmit={handleAddProduct} className="bg-white border border-slate-200 rounded-lg p-6 space-y-4 text-xs">
          <h2 className="text-sm font-bold text-slate-900">Tambah Produk Media ke Rate Card</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Nama Produk / Penempatan</label>
              <input
                type="text"
                required
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                placeholder="TikTok Branded Short Video 60s"
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Kategori Media</label>
              <select
                value={kategori}
                onChange={(e) => setKategori(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
              >
                {categoriesList.map((k: any) => (
                  <option key={k.id || k.nama} value={k.nama}>
                    {k.nama}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Tipe Kuota Deal</label>
              <select
                value={tipeKuota}
                onChange={(e) => setTipeKuota(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
              >
                <option value="jumlah">Berbasis Jumlah (Artikel, Post, Video)</option>
                <option value="durasi">Berbasis Durasi (Hari, Minggu, Bulan)</option>
                <option value="impresi">Berbasis Impresi / CPM</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Satuan Unit</label>
              <input
                type="text"
                required
                value={satuan}
                onChange={(e) => setSatuan(e.target.value)}
                placeholder="Post / Artikel / Bulan"
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Slot Inventori Default</label>
              <input
                type="text"
                required
                value={slotInventori}
                onChange={(e) => setSlotInventori(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Harga Publish Rate Card (Rp)</label>
              <input
                type="number"
                required
                value={harga}
                onChange={(e) => setHarga(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
              />
            </div>
            <div className="md:col-span-3">
              <label className="block font-medium text-slate-700 mb-1">Spesifikasi Teknis & Deliverables</label>
              <input
                type="text"
                required
                value={spesifikasi}
                onChange={(e) => setSpesifikasi(e.target.value)}
                placeholder="Termasuk produksi naskah, talent in-house, dan laporan insight 7 hari setelah tayang"
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowNewProd(false)}
              className="px-4 py-2 border border-slate-300 rounded-md cursor-pointer"
            >
              Batal
            </button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-md cursor-pointer">
              Simpan Produk Rate Card
            </button>
          </div>
        </form>
      )}

      {editingPriceProd && (
        <form onSubmit={handleUpdatePrice} className="bg-amber-50 border border-amber-300 rounded-lg p-5 space-y-3 text-xs">
          <div className="font-bold text-slate-900">
            Terbitkan Versi Harga Baru untuk: {editingPriceProd.nama} ({editingPriceProd.kode})
          </div>
          <div className="text-slate-600">
            Harga Aktif Saat Ini (v{editingPriceProd.versi_harga}):{' '}
            <strong className="font-mono">{formatRupiah(editingPriceProd.harga_aktif)}</strong>. Versi baru akan menjadi{' '}
            <strong>v{editingPriceProd.versi_harga + 1}</strong> tanpa mengubah Quotation yang sudah terbit.
          </div>
          <div className="flex items-center gap-3">
            <input
              type="number"
              required
              value={newPriceVal}
              onChange={(e) => setNewPriceVal(e.target.value)}
              placeholder="Masukkan nominal harga baru..."
              className="px-3 py-2 bg-white border border-slate-300 rounded-md font-mono w-64"
            />
            <button type="submit" className="px-4 py-2 bg-slate-900 text-white font-semibold rounded-md cursor-pointer">
              Simpan Harga v{editingPriceProd.versi_harga + 1}
            </button>
            <button
              type="button"
              onClick={() => setEditingPriceProd(null)}
              className="px-3 py-2 border border-slate-300 bg-white rounded-md cursor-pointer"
            >
              Batal
            </button>
          </div>
        </form>
      )}

      {/* Category Filter Chips Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-500 mr-1 flex items-center gap-1">
          <Filter className="w-3.5 h-3.5" />
          Filter Kategori:
        </span>
        <button
          type="button"
          onClick={() => setCatFilter('ALL')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            catFilter === 'ALL'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
          }`}
        >
          Semua ({products.length})
        </button>
        {categoriesList.map((cat: any) => {
          const count = products.filter((p) => p.kategori === cat.nama).length;
          const isSelected = catFilter === cat.nama;
          return (
            <button
              key={cat.id || cat.nama}
              type="button"
              onClick={() => setCatFilter(cat.nama)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span>{cat.nama}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  isSelected ? 'bg-blue-800 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <th className="py-3 px-4 text-left">Kode & Produk</th>
              <th className="py-3 px-4 text-left">Kategori & Slot</th>
              <th className="py-3 px-4 text-left">Spesifikasi</th>
              <th className="py-3 px-4 text-left">Tipe Kuota</th>
              <th className="py-3 px-4 text-right font-mono">Harga Publish Aktif</th>
              <th className="py-3 px-4 text-left">Riwayat Versi Harga</th>
              {canUpdate && <th className="py-3 px-4 text-right">Aksi</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredProducts.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50/70">
                <td className="py-3.5 px-4">
                  <div className="font-mono font-bold text-blue-700">{p.kode}</div>
                  <div className="font-semibold text-slate-900 mt-0.5">{p.nama}</div>
                </td>
                <td className="py-3.5 px-4">
                  <div className="font-medium text-slate-900">{p.kategori}</div>
                  <div className="text-slate-500 font-mono">{p.slot_inventori}</div>
                </td>
                <td className="py-3.5 px-4 text-slate-600 max-w-xs">{p.spesifikasi}</td>
                <td className="py-3.5 px-4 capitalize text-slate-700">
                  {p.tipe_kuota} ({p.satuan})
                </td>
                <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                  {formatRupiah(p.harga_aktif)}
                  <span className="block text-[11px] font-normal text-emerald-700">Versi v{p.versi_harga}</span>
                </td>
                <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                  {(p.riwayat_harga || []).map((rh: any) => (
                    <div key={rh.id}>
                      v{rh.versi}: {formatRupiah(rh.harga)} ({rh.berlaku_dari})
                    </div>
                  ))}
                </td>
                {canUpdate && (
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => {
                        setEditingPriceProd(p);
                        setNewPriceVal(String(p.harga_aktif));
                      }}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium rounded cursor-pointer"
                    >
                      Update Versi Harga
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Bundled Packages */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-3 border-b border-slate-200">
          <Package className="w-4 h-4 text-blue-600" />
          Paket Penawaran Bundel (Template Siap Pakai di Quotation)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {packages.map((pk) => (
            <div key={pk.id} className="p-4 border border-slate-200 rounded-lg space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-blue-700">{pk.kode}</span>
                <span className="font-mono font-bold text-sm text-slate-900">{formatRupiah(pk.harga_paket)}</span>
              </div>
              <div className="text-sm font-bold text-slate-900">{pk.nama}</div>
              <p className="text-slate-600">{pk.deskripsi}</p>
              <div className="pt-2 border-t border-slate-100 text-slate-700 font-mono">
                Komponen Paket:{' '}
                {(pk.items || []).map((it: any) => `${it.qty}x ${it.nama_produk}`).join(' · ')}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 3. QUOTATION & MULTI-REVISI (With Automatic Discount Manager Approval)
// ============================================================================
export const QuotationsModule: React.FC<{
  quotations: Array<Record<string, any>>;
  clients: Array<Record<string, any>>;
  products: Array<Record<string, any>>;
  packages: Array<Record<string, any>>;
  permissions: RolePerm[];
  apiPost: (url: string, body: any) => Promise<any>;
  onRefresh: () => void;
  onPrintDocument: (type: PrintableDocType, data: Record<string, any>) => void;
  onOpenDealDetail: (dealId: number) => void;
}> = ({
  quotations,
  clients,
  products,
  packages,
  permissions,
  apiPost,
  onRefresh,
  onPrintDocument,
  onOpenDealDetail,
}) => {
  const [showCreate, setShowCreate] = useState(false);
  const [revisionTarget, setRevisionTarget] = useState<Record<string, any> | null>(null);
  const [compareTarget, setCompareTarget] = useState<Record<string, any> | null>(null);
  const [dealModalTarget, setDealModalTarget] = useState<Record<string, any> | null>(null);
  const [lostModalTarget, setLostModalTarget] = useState<Record<string, any> | null>(null);

  // Quotation Form States
  const [judulPenawaran, setJudulPenawaran] = useState('');
  const [clientId, setClientId] = useState<string>(clients[0]?.id ? String(clients[0].id) : '1');
  const [tanggalTerbit, setTanggalTerbit] = useState('2026-11-08');
  const [berlakuSampai, setBerlakuSampai] = useState('2026-12-08');
  const [diskonTipe, setDiskonTipe] = useState<'persen' | 'nominal'>('persen');
  const [diskonPersen, setDiskonPersen] = useState<number>(0);
  const [diskonNominalInput, setDiskonNominalInput] = useState<number>(0);
  const [catatanRevisi, setCatatanRevisi] = useState('');
  const [formItems, setFormItems] = useState<
    Array<{
      product_id: number;
      periode: string;
      target_kpi: string;
      qty: number;
      harga_satuan: number;
      diskon_persen: number;
    }>
  >([
    {
      product_id: products[0]?.id || 1,
      periode: 'Nov - Des 2026',
      target_kpi: '30.000 Pageviews',
      qty: 2,
      harga_satuan: products[0]?.harga_aktif || 15000000,
      diskon_persen: 0,
    },
  ]);

  // Deal / Lost Modal States
  const [noPoKlien, setNoPoKlien] = useState('PO/CLIENT/2026/1109');
  const [skemaTagih, setSkemaTagih] = useState('per_mo');
  const [alasanLost, setAlasanLost] = useState('');

  const canCreate = checkPerm(permissions, 'quotations', 'create');
  const canMarkDeal = checkPerm(permissions, 'mark_deal', 'create');

  const handleAddRow = () => {
    const firstProd = products[0] || { id: 1, harga_aktif: 15000000 };
    setFormItems([
      ...formItems,
      {
        product_id: firstProd.id,
        periode: 'Nov - Des 2026',
        target_kpi: '25.000 Impresi',
        qty: 1,
        harga_satuan: firstProd.harga_aktif,
        diskon_persen: 0,
      },
    ]);
  };

  const handleLoadPackage = (pkg: Record<string, any>) => {
    const mapped = (pkg.items || []).map((pi: any) => {
      const prod = products.find((p) => p.id === pi.product_id);
      return {
        product_id: pi.product_id,
        periode: 'Nov - Des 2026',
        target_kpi: 'Sesuai SLA Paket 360°',
        qty: Number(pi.qty),
        harga_satuan: prod ? Number(prod.harga_aktif) : 15000000,
        diskon_persen: 0,
      };
    });
    if (mapped.length > 0) {
      setFormItems(mapped);
      if (!judulPenawaran) setJudulPenawaran(pkg.nama);
    }
  };

  const subtotalForm = formItems.reduce((acc, it) => {
    const gross = Number(it.qty) * Number(it.harga_satuan);
    const disc = Math.round(gross * (Number(it.diskon_persen || 0) / 100));
    return acc + (gross - disc);
  }, 0);

  let globalDiscNom = 0;
  let globalDiscPct = 0;
  if (diskonTipe === 'nominal') {
    globalDiscNom = Math.min(subtotalForm, Math.max(0, Number(diskonNominalInput || 0)));
    globalDiscPct = subtotalForm > 0 ? Number(((globalDiscNom / subtotalForm) * 100).toFixed(2)) : 0;
  } else {
    globalDiscPct = Math.min(100, Math.max(0, Number(diskonPersen || 0)));
    globalDiscNom = Math.round(subtotalForm * (globalDiscPct / 100));
  }

  const dppForm = Math.max(0, subtotalForm - globalDiscNom);
  const ppnForm = Math.round(dppForm * 0.11);
  const grandTotalForm = dppForm + ppnForm;
  const hasAnyDiscount = globalDiscNom > 0 || formItems.some((i) => Number(i.diskon_persen) > 0);

  const handleCreateOrRevise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (revisionTarget) {
      await apiPost(`/api/quotations/${revisionTarget.id}/revisions`, {
        diskon_tipe: diskonTipe,
        diskon_persen: globalDiscPct,
        diskon_nominal: globalDiscNom,
        catatan_revisi: catatanRevisi,
        items: formItems,
      });
      setRevisionTarget(null);
    } else {
      await apiPost('/api/quotations', {
        judul_penawaran: judulPenawaran,
        client_id: Number(clientId),
        tanggal_terbit: tanggalTerbit,
        berlaku_sampai: berlakuSampai,
        diskon_tipe: diskonTipe,
        diskon_persen: globalDiscPct,
        diskon_nominal: globalDiscNom,
        catatan_revisi: catatanRevisi,
        items: formItems,
      });
      setShowCreate(false);
    }
    setJudulPenawaran('');
    setDiskonTipe('persen');
    setDiskonPersen(0);
    setDiskonNominalInput(0);
    setCatatanRevisi('');
    onRefresh();
  };

  const startRevision = (q: Record<string, any>) => {
    const av = q.active_version || {};
    setRevisionTarget(q);
    setShowCreate(false);
    const avType = (av.diskon_tipe === 'nominal' ? 'nominal' : 'persen') as 'persen' | 'nominal';
    setDiskonTipe(avType);
    setDiskonPersen(Number(av.diskon_persen || 0));
    setDiskonNominalInput(Number(av.diskon_nominal || 0));
    setCatatanRevisi(`Penyesuaian negosiasi untuk Rev.${Number(q.versi_aktif) + 1}`);
    setFormItems(
      (av.items || []).map((it: any) => ({
        product_id: it.product_id,
        periode: it.periode,
        target_kpi: it.target_kpi,
        qty: it.qty,
        harga_satuan: it.harga_satuan,
        diskon_persen: it.diskon_persen,
      }))
    );
  };

  const handleConfirmDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dealModalTarget) return;
    const res = await apiPost(`/api/quotations/${dealModalTarget.id}/status`, {
      action: 'DEAL',
      no_po_klien: noPoKlien,
      skema_tagih: skemaTagih,
      mulai_kontrak: '2026-11-08',
      berlaku_sampai: '2026-12-31',
    });
    setDealModalTarget(null);
    onRefresh();
    if (res?.deal_id) {
      onOpenDealDetail(res.deal_id);
    }
  };

  const handleConfirmLost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lostModalTarget || !alasanLost) return;
    await apiPost(`/api/quotations/${lostModalTarget.id}/status`, {
      action: 'LOST',
      alasan_lost: alasanLost,
    });
    setLostModalTarget(null);
    setAlasanLost('');
    onRefresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Quotation Penawaran & Manajemen Revisi
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Setiap diskon otomatis memicu persetujuan Manager. Dokumen yang disetujui klien dapat dikonversi menjadi Paket Deal sekali klik.
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => {
              setRevisionTarget(null);
              setShowCreate(!showCreate);
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 self-start cursor-pointer"
          >
            <FilePlus2 className="w-3.5 h-3.5" />
            {showCreate ? 'Tutup Editor Quotation' : 'Buat Quotation Baru'}
          </button>
        )}
      </div>

      {/* Form Buat Quotation atau Buat Revisi Baru */}
      {(showCreate || revisionTarget) && (
        <form onSubmit={handleCreateOrRevise} className="bg-white border border-slate-200 rounded-lg p-6 space-y-5 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
            <h2 className="text-base font-bold text-slate-900">
              {revisionTarget
                ? `Buat Revisi Baru (Rev.${Number(revisionTarget.versi_aktif) + 1}) untuk ${revisionTarget.nomor}`
                : 'Formulir Quotation Penawaran Baru'}
            </h2>
            {packages.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Muat Cepat dari Paket:</span>
                {packages.map((pk) => (
                  <button
                    key={pk.id}
                    type="button"
                    onClick={() => handleLoadPackage(pk)}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium rounded cursor-pointer"
                  >
                    + {pk.kode}
                  </button>
                ))}
              </div>
            )}
          </div>

          {!revisionTarget && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <label className="block font-medium text-slate-700 mb-1">Judul Kampanye / Penawaran</label>
                <input
                  type="text"
                  required
                  value={judulPenawaran}
                  onChange={(e) => setJudulPenawaran(e.target.value)}
                  placeholder="Kampanye Akhir Tahun & Brand Awareness 2026"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Pilih Klien</label>
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nama}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Masa Berlaku Sampai</label>
                <input
                  type="date"
                  value={berlakuSampai}
                  onChange={(e) => setBerlakuSampai(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
                />
              </div>
            </div>
          )}

          {/* Items Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800">Rincian Baris Item Media & Rate Card</span>
              <button
                type="button"
                onClick={handleAddRow}
                className="px-3 py-1 bg-slate-900 text-white font-semibold rounded cursor-pointer"
              >
                + Tambah Baris Produk
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-md">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <th className="py-2 px-3 text-left">Produk Rate Card</th>
                    <th className="py-2 px-3 text-left">Periode Tayang</th>
                    <th className="py-2 px-3 text-left">Target KPI</th>
                    <th className="py-2 px-3 text-right w-20">Qty</th>
                    <th className="py-2 px-3 text-right w-36">Harga Satuan (Rp)</th>
                    <th className="py-2 px-3 text-right w-24">Diskon Item %</th>
                    <th className="py-2 px-3 text-right font-mono">Jumlah Net</th>
                    <th className="py-2 px-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {formItems.map((row, idx) => {
                    const gross = Number(row.qty) * Number(row.harga_satuan);
                    const disc = Math.round(gross * (Number(row.diskon_persen || 0) / 100));
                    const net = gross - disc;
                    return (
                      <tr key={idx}>
                        <td className="p-2">
                          <select
                            value={row.product_id}
                            onChange={(e) => {
                              const pid = Number(e.target.value);
                              const prod = products.find((p) => p.id === pid);
                              const copy = [...formItems];
                              copy[idx] = {
                                ...copy[idx],
                                product_id: pid,
                                harga_satuan: prod ? Number(prod.harga_aktif) : copy[idx].harga_satuan,
                              };
                              setFormItems(copy);
                            }}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white"
                          >
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.nama} ({p.satuan})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.periode}
                            onChange={(e) => {
                              const copy = [...formItems];
                              copy[idx].periode = e.target.value;
                              setFormItems(copy);
                            }}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.target_kpi}
                            onChange={(e) => {
                              const copy = [...formItems];
                              copy[idx].target_kpi = e.target.value;
                              setFormItems(copy);
                            }}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            min={1}
                            value={row.qty}
                            onChange={(e) => {
                              const copy = [...formItems];
                              copy[idx].qty = Number(e.target.value);
                              setFormItems(copy);
                            }}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded text-right font-mono"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            value={row.harga_satuan}
                            onChange={(e) => {
                              const copy = [...formItems];
                              copy[idx].harga_satuan = Number(e.target.value);
                              setFormItems(copy);
                            }}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded text-right font-mono"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={row.diskon_persen}
                            onChange={(e) => {
                              const copy = [...formItems];
                              copy[idx].diskon_persen = Number(e.target.value);
                              setFormItems(copy);
                            }}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded text-right font-mono"
                          />
                        </td>
                        <td className="p-2 text-right font-mono font-semibold text-slate-900">
                          {formatRupiah(net)}
                        </td>
                        <td className="p-2 text-center">
                          {formItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setFormItems(formItems.filter((_, i) => i !== idx))}
                              className="text-red-600 hover:underline font-bold cursor-pointer"
                            >
                              ×
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-2">
            <div className="md:col-span-7 space-y-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Catatan Penawaran / Alasan Revisi</label>
                <input
                  type="text"
                  value={catatanRevisi}
                  onChange={(e) => setCatatanRevisi(e.target.value)}
                  placeholder="Catatan tambahan syarat penayangan atau negosiasi..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-md"
                />
              </div>

              {hasAnyDiscount && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-md flex items-start gap-2.5 text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Kebijakan Diskon Aktif: </span>
                    Sesuai aturan perusahaan, penawaran yang mencantumkan diskon (berapapun persentasenya) akan otomatis berstatus{' '}
                    <strong>Menunggu Persetujuan Manager</strong> sebelum dapat ditandai sebagai Deal.
                  </div>
                </div>
              )}
            </div>

            <div className="md:col-span-5 bg-slate-50 border border-slate-200 rounded-md p-4 space-y-2 font-mono">
              <div className="flex justify-between items-center">
                <span className="font-sans text-slate-600">Subtotal Item:</span>
                <span>{formatRupiah(subtotalForm)}</span>
              </div>
              <div className="space-y-1.5 pt-1 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="font-sans text-slate-600 font-medium">Metode Diskon:</span>
                  <div className="flex items-center rounded-md border border-slate-300 p-0.5 bg-slate-100 text-[11px] font-sans">
                    <button
                      type="button"
                      onClick={() => setDiskonTipe('persen')}
                      className={`px-2.5 py-0.5 rounded font-semibold transition-colors cursor-pointer ${
                        diskonTipe === 'persen'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      % Persen
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDiskonTipe('nominal');
                        if (diskonNominalInput === 0 && diskonPersen > 0) {
                          setDiskonNominalInput(globalDiscNom);
                        }
                      }}
                      className={`px-2.5 py-0.5 rounded font-semibold transition-colors cursor-pointer ${
                        diskonTipe === 'nominal'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Rp Nominal
                    </button>
                  </div>
                </div>

                {diskonTipe === 'persen' ? (
                  <div className="flex justify-between items-center">
                    <div className="font-sans text-slate-600">
                      <span>Diskon Total (%):</span>
                      {globalDiscNom > 0 && (
                        <span className="block text-[11px] text-amber-700">
                          - {formatRupiah(globalDiscNom)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={diskonPersen}
                        onChange={(e) => setDiskonPersen(Number(e.target.value))}
                        className="w-20 px-2 py-1 bg-white border border-slate-300 rounded text-right font-mono"
                      />
                      <span className="text-slate-500 font-sans">%</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-center">
                    <div className="font-sans text-slate-600">
                      <span>Diskon Total (Rp):</span>
                      {globalDiscPct > 0 && (
                        <span className="block text-[11px] text-amber-700">
                          Setara {globalDiscPct}%
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-500 font-sans text-[11px]">Rp</span>
                      <input
                        type="number"
                        min={0}
                        max={subtotalForm}
                        value={diskonNominalInput}
                        onChange={(e) => setDiskonNominalInput(Number(e.target.value))}
                        placeholder="0"
                        className="w-36 px-2 py-1 bg-white border border-slate-300 rounded text-right font-mono font-semibold"
                      />
                    </div>
                  </div>
                )}
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span className="font-sans">DPP (Setelah Diskon):</span>
                <span>{formatRupiah(dppForm)}</span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span className="font-sans">PPN 11%:</span>
                <span>{formatRupiah(ppnForm)}</span>
              </div>
              <div className="flex justify-between items-center text-sm font-bold text-slate-900 pt-2 border-t border-slate-300">
                <span className="font-sans">GRAND TOTAL:</span>
                <span>{formatRupiah(grandTotalForm)}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowCreate(false);
                setRevisionTarget(null);
              }}
              className="px-4 py-2 border border-slate-300 rounded-md cursor-pointer"
            >
              Batal
            </button>
            <button type="submit" className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md cursor-pointer">
              {revisionTarget ? `Simpan Revisi Rev.${Number(revisionTarget.versi_aktif) + 1}` : 'Terbitkan Quotation'}
            </button>
          </div>
        </form>
      )}

      {/* Modal Perbandingan Versi Revisi (Rev.1 vs Rev.2) */}
      {compareTarget && (
        <div className="bg-white border border-slate-300 rounded-lg p-6 space-y-4 text-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <GitCompare className="w-4 h-4 text-blue-600" />
              Perbandingan Histori Versi Revisi Quotation: {compareTarget.nomor}
            </h3>
            <button
              onClick={() => setCompareTarget(null)}
              className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded font-medium cursor-pointer"
            >
              Tutup Perbandingan
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(compareTarget.versions || []).map((v: any) => (
              <div
                key={v.id}
                className={`p-4 border rounded-lg space-y-2 ${
                  v.nomor_revisi === compareTarget.versi_aktif ? 'border-blue-600 bg-blue-50/20' : 'border-slate-200 bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-sm text-slate-900">
                    Revisi Rev.{v.nomor_revisi}{' '}
                    {v.nomor_revisi === compareTarget.versi_aktif ? '(Versi Aktif)' : '(Arsip Historis)'}
                  </span>
                  <span className="font-mono font-bold text-blue-700">{formatRupiah(v.grand_total)}</span>
                </div>
                <div className="text-slate-600">{v.catatan_revisi}</div>
                <div className="font-mono text-[11px] text-slate-500">
                  Subtotal: {formatRupiah(v.subtotal)} · Diskon: {v.diskon_tipe === 'nominal' ? `${formatRupiah(v.diskon_nominal)} (${v.diskon_persen}%)` : `${v.diskon_persen}% (${formatRupiah(v.diskon_nominal)})`} · PPN: {formatRupiah(v.ppn_nominal)}
                </div>
                <div className="pt-2 border-t border-slate-200 space-y-1">
                  {(v.items || []).map((it: any) => (
                    <div key={it.id} className="flex justify-between font-mono">
                      <span className="font-sans text-slate-800">
                        {it.qty} {it.satuan} × {it.nama_produk}
                      </span>
                      <span>{formatRupiah(it.jumlah)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Konversi Quotation ke Paket Deal */}
      {dealModalTarget && (
        <form onSubmit={handleConfirmDeal} className="bg-emerald-50 border border-emerald-300 rounded-lg p-6 space-y-4 text-xs">
          <div className="font-bold text-sm text-slate-900">
            Konfirmasi Konversi Quotation {dealModalTarget.nomor} Menjadi Paket Deal
          </div>
          <p className="text-slate-700">
            Seluruh baris item pada versi aktif (Rev.{dealModalTarget.versi_aktif}) akan otomatis disalin menjadi kuota kontrak pada Paket Deal.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-slate-800 mb-1">Nomor PO / Kontrak Klien</label>
              <input
                type="text"
                required
                value={noPoKlien}
                onChange={(e) => setNoPoKlien(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-800 mb-1">Pilih Skema Penagihan Invoice Deal</label>
              <select
                value={skemaTagih}
                onChange={(e) => setSkemaTagih(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md"
              >
                <option value="per_mo">Skema 1: Tagih Per Media Order (MO)</option>
                <option value="termin">Skema 2: Termin di Level Deal (DP / Progres / Pelunasan)</option>
                <option value="sekali_tagih">Skema 3: Sekali Tagih di Akhir Kampanye</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDealModalTarget(null)}
              className="px-4 py-2 bg-white border border-slate-300 rounded-md cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-md cursor-pointer"
            >
              Konfirmasi & Buat Paket Deal Sekarang
            </button>
          </div>
        </form>
      )}

      {/* Modal Tandai Lost */}
      {lostModalTarget && (
        <form onSubmit={handleConfirmLost} className="bg-red-50 border border-red-300 rounded-lg p-6 space-y-3 text-xs">
          <div className="font-bold text-sm text-slate-900">
            Tandai Quotation {lostModalTarget.nomor} Sebagai Lost
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Alasan Lost (Wajib Diisi untuk Evaluasi Pipeline)</label>
            <input
              type="text"
              required
              value={alasanLost}
              onChange={(e) => setAlasanLost(e.target.value)}
              placeholder="Contoh: Budget kampanye Q4 klien ditunda ke Q1 tahun depan..."
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setLostModalTarget(null)}
              className="px-4 py-2 bg-white border border-slate-300 rounded-md cursor-pointer"
            >
              Batal
            </button>
            <button type="submit" className="px-4 py-2 bg-red-600 text-white font-semibold rounded-md cursor-pointer">
              Simpan Status Lost
            </button>
          </div>
        </form>
      )}

      {/* Quotations Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <th className="py-3 px-4 text-left">Nomor & Revisi</th>
              <th className="py-3 px-4 text-left">Judul Penawaran & Klien</th>
              <th className="py-3 px-4 text-left">Berlaku Sampai</th>
              <th className="py-3 px-4 text-right font-mono">Diskon</th>
              <th className="py-3 px-4 text-right font-mono">Grand Total (Inc. PPN)</th>
              <th className="py-3 px-4 text-left">Status</th>
              <th className="py-3 px-4 text-right">Aksi & Dokumen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {quotations.map((q) => {
              const av = q.active_version || {};
              return (
                <tr key={q.id} className="hover:bg-slate-50/80">
                  <td className="py-3.5 px-4 font-mono">
                    <div className="font-bold text-blue-700">{q.nomor}</div>
                    <div className="text-[11px] text-slate-500">
                      Versi Aktif: Rev.{q.versi_aktif} ({(q.versions || []).length} versi)
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-slate-900">{q.judul_penawaran}</div>
                    <div className="text-slate-500 mt-0.5">
                      {q.snapshot_nama_klien} · Sales: {q.nama_sales}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-700">{formatDateId(q.berlaku_sampai)}</td>
                  <td className="py-3.5 px-4 text-right font-mono">
                    {Number(av.diskon_nominal) > 0 ? (
                      <div>
                        <span className="text-amber-700 font-semibold">
                          {av.diskon_tipe === 'nominal' ? formatRupiah(av.diskon_nominal) : `${av.diskon_persen}%`}
                        </span>
                        <div className="text-[10px] text-slate-500">
                          {av.diskon_tipe === 'nominal' ? `(${av.diskon_persen}%)` : `(-${formatRupiah(av.diskon_nominal)})`}
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-400">0%</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                    {formatRupiah(av.grand_total)}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={getStatusSemanticColor(q.status)}>{q.status}</span>
                    {q.deal && (
                      <button
                        onClick={() => onOpenDealDetail(q.deal.id)}
                        className="block font-mono text-[11px] text-blue-600 hover:underline mt-0.5 cursor-pointer"
                      >
                        → {q.deal.nomor}
                      </button>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5 flex-wrap">
                      <button
                        onClick={() => onPrintDocument('QUOTATION', q)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium rounded flex items-center gap-1 cursor-pointer"
                      >
                        <Printer className="w-3 h-3" />
                        PDF
                      </button>
                      {(q.versions || []).length > 1 && (
                        <button
                          onClick={() => setCompareTarget(q)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded cursor-pointer"
                        >
                          Bandingkan Rev
                        </button>
                      )}
                      {q.status !== 'Deal' && q.status !== 'Lost' && canCreate && (
                        <button
                          onClick={() => startRevision(q)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium rounded cursor-pointer"
                        >
                          + Revisi
                        </button>
                      )}
                      {q.status !== 'Deal' &&
                        q.status !== 'Lost' &&
                        q.status !== 'Menunggu Persetujuan' &&
                        canMarkDeal && (
                          <>
                            <button
                              onClick={() => setDealModalTarget(q)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded cursor-pointer"
                            >
                              Tandai Deal
                            </button>
                            <button
                              onClick={() => setLostModalTarget(q)}
                              className="px-2.5 py-1 bg-white hover:bg-red-50 text-red-700 border border-red-200 font-medium rounded cursor-pointer"
                            >
                              Lost
                            </button>
                          </>
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

// ============================================================================
// 4. MEDIA ORDERS (MO) & JADWAL TAYANG (With Quota Validation & Conflict Check)
// ============================================================================
export const MediaOrdersModule: React.FC<{
  mediaOrders: Array<Record<string, any>>;
  deals: Array<Record<string, any>>;
  products: Array<Record<string, any>>;
  preselectedDealId: number | null;
  permissions: RolePerm[];
  apiPost: (url: string, body: any) => Promise<any>;
  apiPatch: (url: string, body: any) => Promise<any>;
  apiGet: (url: string) => Promise<any>;
  onRefresh: () => void;
  onPrintDocument: (type: PrintableDocType, data: Record<string, any>) => void;
}> = ({
  mediaOrders,
  deals,
  products,
  preselectedDealId,
  permissions,
  apiPost,
  apiPatch,
  apiGet,
  onRefresh,
  onPrintDocument,
}) => {
  const [showCreate, setShowCreate] = useState<boolean>(Boolean(preselectedDealId));
  const [jenisMo, setJenisMo] = useState<'Reguler' | 'Bonus'>('Reguler');
  const [selectedDealId, setSelectedDealId] = useState<string>(
    preselectedDealId ? String(preselectedDealId) : deals[0]?.id ? String(deals[0].id) : ''
  );
  const [namaKampanye, setNamaKampanye] = useState('');
  const [periodeMulai, setPeriodeMulai] = useState('2026-11-12');
  const [periodeSelesai, setPeriodeSelesai] = useState('2026-11-30');
  const [briefMateri, setBriefMateri] = useState('');
  const [tautanAset, setTautanAset] = useState('https://drive.nusantaramedia.id/campaign-assets');
  const [conflicts, setConflicts] = useState<Array<Record<string, any>>>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Reschedule / Item update modal
  const [editingItem, setEditingItem] = useState<Record<string, any> | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [newTanggal, setNewTanggal] = useState('');
  const [newSlot, setNewSlot] = useState('');
  const [newUrlLive, setNewUrlLive] = useState('');
  const [alasanUbah, setAlasanUbah] = useState('');

  const canCreate = checkPerm(permissions, 'media_orders', 'create');
  const canUpdateSchedule = checkPerm(permissions, 'schedules', 'update');

  const currentDeal = deals.find((d) => String(d.id) === String(selectedDealId));
  const availableDealItems = (currentDeal?.items || []).filter((di: any) => Number(di.belum_dijadwalkan) > 0);

  const [moItemsForm, setMoItemsForm] = useState<
    Array<{
      deal_item_id: number | null;
      product_id: number;
      platform: string;
      judul_topik: string;
      tanggal_tayang: string;
      slot_jam: string;
      pic_konten: string;
      qty: number;
      catatan: string;
    }>
  >(() => {
    const firstDi = availableDealItems[0];
    return [
      {
        deal_item_id: firstDi ? firstDi.id : null,
        product_id: firstDi ? firstDi.product_id : products[0]?.id || 1,
        platform: firstDi ? firstDi.kategori : 'Website',
        judul_topik: 'Konten Penayangan Gelombang Baru',
        tanggal_tayang: '2026-11-15',
        slot_jam: '09:00 WIB - Editorial Feed',
        pic_konten: 'Bagus (Editor)',
        qty: 1,
        catatan: '',
      },
    ];
  });

  const handleCheckConflict = async (tanggal: string, slot: string) => {
    const res = await apiGet(
      `/api/schedules/check-conflict?tanggal_tayang=${encodeURIComponent(tanggal)}&slot_jam=${encodeURIComponent(slot)}`
    );
    if (res?.conflicts) {
      setConflicts(res.conflicts);
    }
  };

  const handleCreateMo = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      await apiPost('/api/media-orders', {
        deal_id: jenisMo === 'Reguler' ? Number(selectedDealId) : selectedDealId ? Number(selectedDealId) : null,
        jenis: jenisMo,
        nama_kampanye: namaKampanye || `${currentDeal?.nama_kampanye || 'Kampanye'} - Batch Baru`,
        no_po_klien: currentDeal?.no_po_klien || '-',
        pic_klien: currentDeal?.snapshot_nama_klien || 'PIC Klien',
        periode_mulai: periodeMulai,
        periode_selesai: periodeSelesai,
        brief_materi: briefMateri,
        tautan_aset: tautanAset,
        items: moItemsForm,
      });
      setShowCreate(false);
      setNamaKampanye('');
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menyimpan Media Order.');
    }
  };

  const handleSaveItemUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setErrorMsg(null);
    try {
      await apiPatch(`/api/mo-items/${editingItem.id}`, {
        status: newStatus,
        tanggal_tayang: newTanggal,
        slot_jam: newSlot,
        url_live: newUrlLive,
        alasan: alasanUbah,
      });
      setEditingItem(null);
      setAlasanUbah('');
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Media Order (MO) & Jadwal Penayangan
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Tidak ada penayangan tanpa MO. MO Reguler otomatis memvalidasi sisa kuota Deal; MO Bonus wajib persetujuan Manager.
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 self-start cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            {showCreate ? 'Tutup Form MO' : 'Buat Media Order Baru'}
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-300 rounded-lg text-xs text-red-900 flex items-center justify-between">
          <span>
            <strong>Validasi Sistem: </strong>
            {errorMsg}
          </span>
          <button onClick={() => setErrorMsg(null)} className="font-bold underline cursor-pointer">
            Tutup
          </button>
        </div>
      )}

      {showCreate && (
        <form onSubmit={handleCreateMo} className="bg-white border border-slate-200 rounded-lg p-6 space-y-5 text-xs">
          <h2 className="text-base font-bold text-slate-900 pb-3 border-b border-slate-200">
            Formulir Penerbitan Media Order (MO) & Pengambilan Kuota Deal
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Jenis Media Order</label>
              <select
                value={jenisMo}
                onChange={(e) => setJenisMo(e.target.value as 'Reguler' | 'Bonus')}
                className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
              >
                <option value="Reguler">MO Reguler (Memotong Kuota Deal)</option>
                <option value="Bonus">MO Bonus / Tambahan (Tanpa Memotong Kuota)</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block font-medium text-slate-700 mb-1">Pilih Paket Deal Induk</label>
              <select
                value={selectedDealId}
                onChange={(e) => setSelectedDealId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
              >
                {deals.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nomor} — {d.nama_kampanye} ({d.snapshot_nama_klien})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Nama Wave / Kampanye MO</label>
              <input
                type="text"
                required
                value={namaKampanye}
                onChange={(e) => setNamaKampanye(e.target.value)}
                placeholder="Wave 3: Kampanye Taktikal Akhir Bulan"
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
              />
            </div>
          </div>

          {/* Remaining Quota Reference Box */}
          {currentDeal && jenisMo === 'Reguler' && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-md space-y-1.5">
              <div className="font-semibold text-slate-800">
                Sisa Kuota Belum Dijadwalkan pada Deal {currentDeal.nomor}:
              </div>
              <div className="flex flex-wrap gap-4 font-mono">
                {(currentDeal.items || []).map((di: any) => (
                  <span key={di.id} className="text-slate-700">
                    • {di.nama_produk}:{' '}
                    <strong className={di.belum_dijadwalkan > 0 ? 'text-emerald-700' : 'text-red-600'}>
                      Sisa {di.belum_dijadwalkan} {di.satuan}
                    </strong>{' '}
                    (dari {di.qty_dibeli})
                  </span>
                ))}
              </div>
            </div>
          )}

          {conflicts.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-md text-amber-900 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Peringatan Bentrok Inventori Terdeteksi: </span>
                Slot dan tanggal yang sama sudah terisi oleh {conflicts[0].nomor_mo} ({conflicts[0].snapshot_nama_klien} — {conflicts[0].judul_topik}).
              </div>
            </div>
          )}

          {/* Schedule Items in MO */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800">Tabel Baris Jadwal Tayang Media Order</span>
              <button
                type="button"
                onClick={() => {
                  const firstDi = availableDealItems[0] || currentDeal?.items?.[0];
                  setMoItemsForm([
                    ...moItemsForm,
                    {
                      deal_item_id: firstDi ? firstDi.id : null,
                      product_id: firstDi ? firstDi.product_id : products[0]?.id || 1,
                      platform: firstDi ? firstDi.kategori : 'Website',
                      judul_topik: 'Topik Penayangan Baru',
                      tanggal_tayang: periodeMulai,
                      slot_jam: '09:00 WIB - Editorial Feed',
                      pic_konten: 'Tim Redaksi',
                      qty: 1,
                      catatan: '',
                    },
                  ]);
                }}
                className="px-3 py-1 bg-slate-900 text-white font-semibold rounded cursor-pointer"
              >
                + Tambah Baris Jadwal
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-md">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <th className="py-2 px-2.5 text-left">Baris Kuota Deal / Produk</th>
                    <th className="py-2 px-2.5 text-left">Judul / Topik Konten</th>
                    <th className="py-2 px-2.5 text-left">Tanggal Tayang</th>
                    <th className="py-2 px-2.5 text-left">Slot / Jam Inventori</th>
                    <th className="py-2 px-2.5 text-left">PIC Konten</th>
                    <th className="py-2 px-2.5 text-right w-20">Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {moItemsForm.map((row, idx) => (
                    <tr key={idx}>
                      <td className="p-2">
                        {jenisMo === 'Reguler' && currentDeal ? (
                          <select
                            value={row.deal_item_id || ''}
                            onChange={(e) => {
                              const dId = Number(e.target.value);
                              const dItem = (currentDeal.items || []).find((x: any) => x.id === dId);
                              const copy = [...moItemsForm];
                              copy[idx] = {
                                ...copy[idx],
                                deal_item_id: dId,
                                product_id: dItem ? dItem.product_id : copy[idx].product_id,
                                platform: dItem ? dItem.kategori : copy[idx].platform,
                              };
                              setMoItemsForm(copy);
                            }}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white"
                          >
                            {(currentDeal.items || []).map((di: any) => (
                              <option key={di.id} value={di.id}>
                                {di.nama_produk} (Sisa: {di.belum_dijadwalkan} {di.satuan})
                              </option>
                            ))}
                          </select>
                        ) : (
                          <select
                            value={row.product_id}
                            onChange={(e) => {
                              const copy = [...moItemsForm];
                              copy[idx].product_id = Number(e.target.value);
                              setMoItemsForm(copy);
                            }}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white"
                          >
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.nama}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          required
                          value={row.judul_topik}
                          onChange={(e) => {
                            const copy = [...moItemsForm];
                            copy[idx].judul_topik = e.target.value;
                            setMoItemsForm(copy);
                          }}
                          className="w-full px-2 py-1.5 border border-slate-300 rounded"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="date"
                          value={row.tanggal_tayang}
                          onChange={(e) => {
                            const copy = [...moItemsForm];
                            copy[idx].tanggal_tayang = e.target.value;
                            setMoItemsForm(copy);
                            handleCheckConflict(e.target.value, copy[idx].slot_jam);
                          }}
                          className="w-full px-2 py-1.5 border border-slate-300 rounded font-mono"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={row.slot_jam}
                          onChange={(e) => {
                            const copy = [...moItemsForm];
                            copy[idx].slot_jam = e.target.value;
                            setMoItemsForm(copy);
                            handleCheckConflict(copy[idx].tanggal_tayang, e.target.value);
                          }}
                          className="w-full px-2 py-1.5 border border-slate-300 rounded font-mono"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={row.pic_konten}
                          onChange={(e) => {
                            const copy = [...moItemsForm];
                            copy[idx].pic_konten = e.target.value;
                            setMoItemsForm(copy);
                          }}
                          className="w-full px-2 py-1.5 border border-slate-300 rounded"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min={1}
                          value={row.qty}
                          onChange={(e) => {
                            const copy = [...moItemsForm];
                            copy[idx].qty = Number(e.target.value);
                            setMoItemsForm(copy);
                          }}
                          className="w-full px-2 py-1.5 border border-slate-300 rounded text-right font-mono"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 border border-slate-300 rounded-md cursor-pointer"
            >
              Batal
            </button>
            <button type="submit" className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md cursor-pointer">
              Simpan Media Order & Jadwal Tayang
            </button>
          </div>
        </form>
      )}

      {/* Modal Reschedule / Update Status Item MO */}
      {editingItem && (
        <form onSubmit={handleSaveItemUpdate} className="bg-amber-50 border border-amber-300 rounded-lg p-6 space-y-4 text-xs">
          <div className="font-bold text-sm text-slate-900">
            Penjadwalan Ulang (Reschedule) / Ubah Status Item: {editingItem.judul_topik}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Status Item Jadwal</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md"
              >
                {['Terjadwal', 'Dalam Produksi', 'Siap Tayang', 'Tayang', 'Ditunda', 'Batal'].map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Tanggal Tayang</label>
              <input
                type="date"
                value={newTanggal}
                onChange={(e) => setNewTanggal(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Slot / Jam</label>
              <input
                type="text"
                value={newSlot}
                onChange={(e) => setNewSlot(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">URL Live (Bila Sudah Tayang)</label>
              <input
                type="text"
                value={newUrlLive}
                onChange={(e) => setNewUrlLive(e.target.value)}
                placeholder="https://nusantaramedia.id/..."
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md font-mono"
              />
            </div>
            <div className="md:col-span-4">
              <label className="block font-medium text-slate-700 mb-1">
                Alasan Penjadwalan Ulang / Pembatalan (Wajib Diisi & Tercatat di Audit Log)
              </label>
              <input
                type="text"
                required
                value={alasanUbah}
                onChange={(e) => setAlasanUbah(e.target.value)}
                placeholder="Contoh: Materi artikel direvisi tim komunikasi klien..."
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditingItem(null)}
              className="px-4 py-2 bg-white border border-slate-300 rounded-md cursor-pointer"
            >
              Batal
            </button>
            <button type="submit" className="px-4 py-2 bg-slate-900 text-white font-semibold rounded-md cursor-pointer">
              Simpan Perubahan & Catat Log
            </button>
          </div>
        </form>
      )}

      {/* Media Orders List */}
      <div className="space-y-4">
        {mediaOrders.map((mo) => (
          <div key={mo.id} className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
              <div>
                <div className="text-xs font-mono text-slate-500">
                  <span className="font-bold text-blue-700">{mo.nomor}</span>
                  {' · '}
                  <span>Jenis: {mo.jenis}</span>
                  {' · '}
                  <span>Ref Deal: {mo.nomor_deal || 'MO-BONUS'}</span>
                  {' · '}
                  <span className={getStatusSemanticColor(mo.status)}>{mo.status}</span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-1">{mo.nama_kampanye}</h3>
                <div className="text-xs text-slate-600 mt-0.5">
                  Klien: <span className="font-medium text-slate-900">{mo.snapshot_nama_klien}</span>
                  {' · '}
                  Periode: <span className="font-mono">{formatDateId(mo.periode_mulai)} s/d {formatDateId(mo.periode_selesai)}</span>
                  {' · '}
                  PIC Media: {mo.pic_internal}
                </div>
              </div>

              <button
                onClick={() => onPrintDocument('MEDIA_ORDER', mo)}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-md flex items-center gap-1.5 self-start cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Cetak PDF MO (A4 Landscape)
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <th className="py-2 px-3 text-left">Produk & Platform</th>
                    <th className="py-2 px-3 text-left">Judul / Topik Konten</th>
                    <th className="py-2 px-3 text-left">Tanggal & Slot Tayang</th>
                    <th className="py-2 px-3 text-left">PIC</th>
                    <th className="py-2 px-3 text-right font-mono">Qty</th>
                    <th className="py-2 px-3 text-left">Status Tayang</th>
                    {canUpdateSchedule && <th className="py-2 px-3 text-right">Aksi Jadwal</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {(mo.items || []).map((it: any) => (
                    <tr key={it.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900">{it.nama_item}</div>
                        <div className="text-[11px] text-slate-500">{it.platform}</div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-800">
                        <div>{it.judul_topik}</div>
                        {it.url_live && (
                          <div className="font-mono text-[11px] text-blue-600 truncate max-w-xs">{it.url_live}</div>
                        )}
                        {(it.logs || []).length > 0 && (
                          <div className="text-[11px] text-amber-700 mt-0.5 flex items-center gap-1">
                            <History className="w-3 h-3" />
                            Riwayat: {it.logs[0].perubahan} ({it.logs[0].nilai_lama} → {it.logs[0].nilai_baru})
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono">
                        <div className="font-semibold text-slate-900">{formatDateId(it.tanggal_tayang)}</div>
                        <div className="text-[11px] text-slate-500">{it.slot_jam}</div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">{it.pic_konten}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold">
                        {it.qty} {it.satuan}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={getStatusSemanticColor(it.status)}>{it.status}</span>
                      </td>
                      {canUpdateSchedule && (
                        <td className="py-2.5 px-3 text-right">
                          {it.status !== 'Tayang Terverifikasi' && (
                            <button
                              onClick={() => {
                                setEditingItem(it);
                                setNewStatus(it.status);
                                setNewTanggal(it.tanggal_tayang);
                                setNewSlot(it.slot_jam);
                                setNewUrlLive(it.url_live || '');
                              }}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium rounded cursor-pointer"
                            >
                              Reschedule / Status
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// 5. BUKTI TAYANG (PROOFS OF BROADCAST) & VERIFIKASI MANAGER
// ============================================================================
export const ProofsModule: React.FC<{
  proofs: Array<Record<string, any>>;
  mediaOrders: Array<Record<string, any>>;
  permissions: RolePerm[];
  currentUser: Record<string, any>;
  apiPost: (url: string, body: any) => Promise<any>;
  apiPatch?: (url: string, body: any) => Promise<any>;
  onRefresh: () => void;
  onPrintDocument: (type: PrintableDocType, data: Record<string, any>) => void;
}> = ({ proofs, mediaOrders, permissions, currentUser, apiPost, apiPatch, onRefresh, onPrintDocument }) => {
  const [showCreate, setShowCreate] = useState(false);
  const [selectedMoId, setSelectedMoId] = useState<string>(mediaOrders[0]?.id ? String(mediaOrders[0].id) : '1');
  const [periodeLaporan, setPeriodeLaporan] = useState('01 Nov 2026 - 15 Nov 2026');
  const [catatanKompensasi, setCatatanKompensasi] = useState('Seluruh item tayang sesuai jadwal dan spesifikasi Media Order.');
  const [previewImageModal, setPreviewImageModal] = useState<{ src: string; title: string } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const canCreate = checkPerm(permissions, 'proofs', 'create');
  const canUpdate = checkPerm(permissions, 'proofs', 'update') || canCreate;
  const canVerify =
    checkPerm(permissions, 'proofs', 'approve') ||
    ['manager', 'admin', 'super_admin'].includes(currentUser.role_kode);

  const selectedMo = mediaOrders.find((m) => String(m.id) === String(selectedMoId));
  const [itemProofInputs, setItemProofInputs] = useState<
    Record<
      number,
      {
        url_live: string;
        screenshot_data: string;
        screenshot_filename: string;
        catatan: string;
      }
    >
  >({});

  const isImageDataOrUrl = (val?: string) => {
    if (!val) return false;
    return (
      val.startsWith('data:image/') ||
      val.startsWith('http://') ||
      val.startsWith('https://') ||
      val.startsWith('/')
    );
  };

  const handleSelectScreenshotForForm = (moItemId: number, defaultUrlLive: string, file: File | undefined) => {
    if (!file) return;
    setUploadError(null);
    if (!file.type.startsWith('image/')) {
      setUploadError('Format file screenshot harus berupa gambar (PNG, JPG, JPEG, WebP, atau SVG).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Ukuran file screenshot maksimal 5 MB per item.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const prev = itemProofInputs[moItemId] || {
          url_live: defaultUrlLive,
          screenshot_data: '',
          screenshot_filename: '',
          catatan: 'Tayang sesuai brief',
        };
        setItemProofInputs({
          ...itemProofInputs,
          [moItemId]: {
            ...prev,
            screenshot_data: reader.result,
            screenshot_filename: file.name,
          },
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUploadScreenshotExistingItem = (proofItemId: number, file: File | undefined) => {
    if (!file || !apiPatch) return;
    setUploadError(null);
    if (!file.type.startsWith('image/')) {
      setUploadError('Format file screenshot harus berupa gambar (PNG, JPG, JPEG, WebP, atau SVG).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Ukuran file screenshot maksimal 5 MB per item.');
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result === 'string') {
        try {
          await apiPatch(`/api/proof-items/${proofItemId}/screenshot`, {
            screenshot_url: reader.result,
          });
          onRefresh();
        } catch (err: any) {
          setUploadError(err.message || 'Gagal mengunggah screenshot.');
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreateProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMo) return;

    const payloadItems = (selectedMo.items || [])
      .filter((it: any) => it.status !== 'Batal')
      .map((it: any) => {
        const inp = itemProofInputs[it.id] || {
          url_live: it.url_live || `https://nusantaramedia.id/kampanye/${it.id}`,
          screenshot_data: '',
          screenshot_filename: '',
          catatan: 'Tayang sesuai brief',
        };
        return {
          mo_item_id: it.id,
          nama_item: `${it.nama_item}: ${it.judul_topik}`,
          platform: it.platform,
          tanggal_tayang: it.tanggal_tayang,
          url_live: inp.url_live,
          screenshot_url: inp.screenshot_data || inp.screenshot_filename || `screenshot-tayang-${it.id}.png`,
          catatan: inp.catatan || 'Tayang sesuai brief',
        };
      });

    await apiPost('/api/proofs', {
      mo_id: selectedMo.id,
      periode_laporan: periodeLaporan,
      catatan_kompensasi: catatanKompensasi,
      items: payloadItems,
    });
    setShowCreate(false);
    setItemProofInputs({});
    onRefresh();
  };

  const handleVerifyProof = async (proofId: number) => {
    await apiPost(`/api/proofs/${proofId}/verify`, {});
    onRefresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Bukti Tayang & Verifikasi Penayangan
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Unggah tautan tayang dan file screenshot bukti penayangan. Saat diverifikasi oleh Manager/Admin, seluruh item terkait otomatis berstatus <strong>Tayang Terverifikasi</strong> dan menambah progres Deal.
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 self-start cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            {showCreate ? 'Tutup Form Bukti' : 'Unggah Bukti Tayang Baru'}
          </button>
        )}
      </div>

      {uploadError && (
        <div className="p-3.5 bg-red-50 border border-red-300 rounded-lg text-xs text-red-900 flex items-center justify-between">
          <span>
            <strong>Peringatan Upload: </strong>
            {uploadError}
          </span>
          <button onClick={() => setUploadError(null)} className="font-bold underline cursor-pointer">
            Tutup
          </button>
        </div>
      )}

      {/* Modal Pratinjau Gambar Screenshot Ukuran Penuh */}
      {previewImageModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/75 flex items-center justify-center p-4"
          onClick={() => setPreviewImageModal(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-lg max-w-4xl w-full p-4 space-y-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-200">
              <div className="text-xs font-bold text-slate-900">{previewImageModal.title}</div>
              <button
                onClick={() => setPreviewImageModal(null)}
                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded cursor-pointer"
              >
                Tutup Pratinjau
              </button>
            </div>
            <div className="max-h-[75vh] overflow-auto bg-slate-100 border border-slate-200 rounded flex items-center justify-center p-4">
              <img
                src={previewImageModal.src}
                alt={previewImageModal.title}
                referrerPolicy="no-referrer"
                className="max-w-full max-h-[68vh] object-contain rounded shadow-sm"
              />
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <form onSubmit={handleCreateProof} className="bg-white border border-slate-200 rounded-lg p-6 space-y-4 text-xs">
          <div className="pb-3 border-b border-slate-200">
            <h2 className="text-base font-bold text-slate-900">
              Formulir Input Bukti Tayang & Upload Screenshot per Media Order
            </h2>
            <p className="text-slate-500 mt-0.5">
              Lampirkan tautan konten tayang (Live URL) dan unggah file gambar screenshot bukti tayang untuk setiap baris jadwal MO.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Pilih Media Order (MO)</label>
              <select
                value={selectedMoId}
                onChange={(e) => setSelectedMoId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
              >
                {mediaOrders.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nomor} — {m.nama_kampanye}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Periode Laporan</label>
              <input
                type="text"
                value={periodeLaporan}
                onChange={(e) => setPeriodeLaporan(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Catatan Verifikasi / Keterangan</label>
              <input
                type="text"
                value={catatanKompensasi}
                onChange={(e) => setCatatanKompensasi(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
              />
            </div>
          </div>

          {selectedMo && (
            <div className="overflow-x-auto border border-slate-200 rounded-md">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <th className="py-2.5 px-3 text-left">Item Jadwal MO & Platform</th>
                    <th className="py-2.5 px-3 text-left w-32">Tanggal Tayang</th>
                    <th className="py-2.5 px-3 text-left">Tautan Live URL</th>
                    <th className="py-2.5 px-3 text-left">Upload File Screenshot</th>
                    <th className="py-2.5 px-3 text-left">Catatan Penayangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {(selectedMo.items || [])
                    .filter((it: any) => it.status !== 'Batal')
                    .map((it: any) => {
                      const defaultLiveUrl = it.url_live || `https://nusantaramedia.id/live/${it.id}`;
                      const inp = itemProofInputs[it.id] || {
                        url_live: defaultLiveUrl,
                        screenshot_data: '',
                        screenshot_filename: '',
                        catatan: 'Tayang sesuai brief',
                      };
                      return (
                        <tr key={it.id} className="align-top">
                          <td className="p-2.5 font-medium text-slate-900">
                            <div>{it.judul_topik}</div>
                            <span className="block text-[11px] text-slate-500">
                              {it.nama_item} · {it.platform}
                            </span>
                          </td>
                          <td className="p-2.5 font-mono text-slate-700 whitespace-nowrap">
                            {formatDateId(it.tanggal_tayang)}
                          </td>
                          <td className="p-2.5">
                            <input
                              type="text"
                              value={inp.url_live}
                              onChange={(e) =>
                                setItemProofInputs({
                                  ...itemProofInputs,
                                  [it.id]: { ...inp, url_live: e.target.value },
                                })
                              }
                              placeholder="https://..."
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono"
                            />
                          </td>
                          <td className="p-2.5">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <label className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded flex items-center gap-1.5 cursor-pointer shrink-0">
                                <Upload className="w-3.5 h-3.5" />
                                <span>{inp.screenshot_data ? 'Ganti File' : 'Pilih File Screenshot'}</span>
                                <input
                                  type="file"
                                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                                  onChange={(e) =>
                                    handleSelectScreenshotForForm(it.id, defaultLiveUrl, e.target.files?.[0])
                                  }
                                  className="hidden"
                                />
                              </label>
                              {inp.screenshot_data ? (
                                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded px-2 py-1">
                                  <img
                                    src={inp.screenshot_data}
                                    alt="Preview Screenshot"
                                    onClick={() =>
                                      setPreviewImageModal({
                                        src: inp.screenshot_data,
                                        title: `Screenshot: ${it.judul_topik}`,
                                      })
                                    }
                                    className="w-10 h-10 object-cover rounded border border-slate-300 cursor-pointer"
                                  />
                                  <div className="max-w-[140px]">
                                    <div className="font-mono text-[11px] text-emerald-700 font-semibold truncate">
                                      {inp.screenshot_filename || 'screenshot.png'}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setItemProofInputs({
                                          ...itemProofInputs,
                                          [it.id]: { ...inp, screenshot_data: '', screenshot_filename: '' },
                                        })
                                      }
                                      className="text-[10px] text-red-600 hover:underline cursor-pointer"
                                    >
                                      Hapus file
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-[11px] text-slate-400">Belum ada gambar dipilih (PNG/JPG)</span>
                              )}
                            </div>
                          </td>
                          <td className="p-2.5">
                            <input
                              type="text"
                              value={inp.catatan}
                              onChange={(e) =>
                                setItemProofInputs({
                                  ...itemProofInputs,
                                  [it.id]: { ...inp, catatan: e.target.value },
                                })
                              }
                              placeholder="Catatan bukti tayang..."
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                            />
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 border border-slate-300 rounded-md cursor-pointer"
            >
              Batal
            </button>
            <button type="submit" className="px-5 py-2 bg-blue-600 text-white font-semibold rounded-md cursor-pointer">
              Simpan & Ajukan Verifikasi Bukti Tayang
            </button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {proofs.map((pr) => (
          <div key={pr.id} className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
              <div>
                <div className="text-xs font-mono text-slate-500">
                  <span className="font-bold text-blue-700">{pr.nomor}</span>
                  {' · '}
                  <span>Ref MO: {pr.nomor_mo}</span>
                  {' · '}
                  <span>Ref Deal: {pr.nomor_deal || '-'}</span>
                  {' · '}
                  <span className={getStatusSemanticColor(pr.status)}>{pr.status}</span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  {pr.nama_kampanye} — {pr.snapshot_nama_klien}
                </h3>
                <div className="text-xs text-slate-600 mt-0.5">
                  Periode: {pr.periode_laporan} · Disusun oleh: {pr.pembuat_nama} · Verifikator:{' '}
                  <span className="font-semibold text-slate-900">
                    {pr.verifikator_nama || 'Menunggu Verifikasi'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start">
                {pr.status !== 'Terverifikasi' && canVerify && (
                  <button
                    onClick={() => handleVerifyProof(pr.id)}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-md flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Verifikasi Bukti Tayang
                  </button>
                )}
                <button
                  onClick={() => onPrintDocument('PROOF', pr)}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Cetak PDF Bukti Tayang
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <th className="py-2.5 px-3 text-left">Item Tayang & Platform</th>
                    <th className="py-2.5 px-3 text-left w-36">Tanggal Tayang</th>
                    <th className="py-2.5 px-3 text-left">Tautan Live URL</th>
                    <th className="py-2.5 px-3 text-left">File Screenshot Bukti Tayang</th>
                    <th className="py-2.5 px-3 text-left">Catatan Penayangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {(pr.items || []).map((it: any) => {
                    const hasImage = isImageDataOrUrl(it.screenshot_url);
                    return (
                      <tr key={it.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-900">{it.nama_item}</div>
                          <div className="text-[11px] text-slate-500">{it.platform}</div>
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-700 whitespace-nowrap">
                          {formatDateId(it.tanggal_tayang)}
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px]">
                          <a
                            href={it.url_live}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-700 hover:underline break-all"
                          >
                            {it.url_live}
                          </a>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-3 flex-wrap">
                            {hasImage ? (
                              <div className="flex items-center gap-2.5">
                                <img
                                  src={it.screenshot_url}
                                  alt={it.nama_item}
                                  referrerPolicy="no-referrer"
                                  onClick={() =>
                                    setPreviewImageModal({
                                      src: it.screenshot_url,
                                      title: `Bukti Tayang: ${it.nama_item} (${pr.nomor})`,
                                    })
                                  }
                                  className="w-14 h-10 object-cover rounded border border-slate-300 bg-slate-100 cursor-pointer hover:opacity-90"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPreviewImageModal({
                                      src: it.screenshot_url,
                                      title: `Bukti Tayang: ${it.nama_item} (${pr.nomor})`,
                                    })
                                  }
                                  className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded text-[11px] cursor-pointer"
                                >
                                  Lihat Screenshot
                                </button>
                              </div>
                            ) : (
                              <span className="font-mono text-[11px] text-slate-600">
                                {it.screenshot_url || 'Belum ada screenshot'}
                              </span>
                            )}

                            {canUpdate && apiPatch && (
                              <label className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium rounded text-[11px] flex items-center gap-1 cursor-pointer">
                                <Upload className="w-3 h-3" />
                                <span>{hasImage ? 'Ganti Screenshot' : 'Upload Screenshot'}</span>
                                <input
                                  type="file"
                                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                                  onChange={(e) => handleUploadScreenshotExistingItem(it.id, e.target.files?.[0])}
                                  className="hidden"
                                />
                              </label>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-slate-600">{it.catatan || 'Tayang sesuai brief'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// 6. INVOICE & PENCATATAN PEMBAYARAN (Finance Module)
// ============================================================================
export const InvoicesModule: React.FC<{
  invoices: Array<Record<string, any>>;
  deals: Array<Record<string, any>>;
  preselectedDealId: number | null;
  permissions: RolePerm[];
  apiPost: (url: string, body: any) => Promise<any>;
  onRefresh: () => void;
  onPrintDocument: (type: PrintableDocType, data: Record<string, any>) => void;
}> = ({ invoices, deals, preselectedDealId, permissions, apiPost, onRefresh, onPrintDocument }) => {
  const [showCreate, setShowCreate] = useState<boolean>(Boolean(preselectedDealId));
  const [selectedDealId, setSelectedDealId] = useState<string>(
    preselectedDealId ? String(preselectedDealId) : deals[0]?.id ? String(deals[0].id) : ''
  );
  const [skema, setSkema] = useState('per_mo');
  const [keteranganTermin, setKeteranganTermin] = useState('Tagihan Termin / Realisasi Tayang Kampanye');
  const [pph23Dipotong, setPph23Dipotong] = useState(true);
  const [meterai, setMeterai] = useState(10000);
  const [noFakturPajak, setNoFakturPajak] = useState('010.004-26.88912099');
  const [persenTagih, setPersenTagih] = useState(50);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Payment Modal State
  const [paymentTarget, setPaymentTarget] = useState<Record<string, any> | null>(null);
  const [jumlahBayar, setJumlahBayar] = useState('');
  const [metodeBayar, setMetodeBayar] = useState('Transfer Bank Mandiri Giro');
  const [referensiBank, setReferensiBank] = useState('TRX-MDR-20261108-7781');

  const canCreateInvoice = checkPerm(permissions, 'invoices', 'create');
  const canRecordPayment = checkPerm(permissions, 'payments', 'create');

  const currentDeal = deals.find((d) => String(d.id) === String(selectedDealId));

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentDeal) return;
    setErrorMsg(null);

    try {
      const ratio = skema === 'termin' ? Number(persenTagih) / 100 : 1;
      const itemsPayload = (currentDeal.items || []).map((di: any) => {
        const lineTotal = Math.round(Number(di.jumlah_total) * ratio);
        return {
          deal_item_id: di.id,
          deskripsi: `${di.nama_produk} (${skema === 'termin' ? `Termin ${persenTagih}%` : 'Penagihan Kontrak'})`,
          periode_tayang: di.periode,
          qty: di.qty_dibeli,
          satuan: di.satuan,
          harga_satuan: Math.round(Number(di.harga_satuan) * ratio),
          jumlah: lineTotal,
        };
      });

      await apiPost('/api/invoices', {
        deal_id: currentDeal.id,
        mo_id: currentDeal.media_orders?.[0]?.id || null,
        proof_id: currentDeal.proofs?.[0]?.id || null,
        skema,
        keterangan_termin: keteranganTermin,
        tanggal_terbit: '2026-11-08',
        pph23_dipotong: pph23Dipotong,
        meterai: Number(meterai),
        no_faktur_pajak: noFakturPajak,
        items: itemsPayload,
      });

      setShowCreate(false);
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentTarget || !jumlahBayar) return;
    await apiPost(`/api/invoices/${paymentTarget.id}/payments`, {
      tanggal_bayar: '2026-11-08',
      jumlah: Number(jumlahBayar),
      metode: metodeBayar,
      referensi_bank: referensiBank,
    });
    setPaymentTarget(null);
    setJumlahBayar('');
    onRefresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Invoice Penagihan, Pajak & Rekonsiliasi Pembayaran
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Mendukung 3 skema tagih (Per MO, Termin Deal, Sekali Tagih), perhitungan otomatis PPN 11%, potongan PPh 23, Bea Meterai, dan Faktur Pajak.
          </p>
        </div>
        {canCreateInvoice && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 self-start cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            {showCreate ? 'Tutup Form Invoice' : 'Terbitkan Invoice Baru'}
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-300 rounded-lg text-xs text-red-900 flex items-center justify-between">
          <span>
            <strong>Validasi Keuangan: </strong>
            {errorMsg}
          </span>
          <button onClick={() => setErrorMsg(null)} className="font-bold underline cursor-pointer">
            Tutup
          </button>
        </div>
      )}

      {showCreate && (
        <form onSubmit={handleCreateInvoice} className="bg-white border border-slate-200 rounded-lg p-6 space-y-4 text-xs">
          <h2 className="text-base font-bold text-slate-900 pb-3 border-b border-slate-200">
            Penerbitan Invoice Penagihan dari Paket Deal
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Pilih Paket Deal</label>
              <select
                value={selectedDealId}
                onChange={(e) => setSelectedDealId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
              >
                {deals.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nomor} — {d.snapshot_nama_klien} (Sisa Tagih: {formatRupiah(d.keuangan?.sisa_belum_tertagih)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Skema Penagihan</label>
              <select
                value={skema}
                onChange={(e) => setSkema(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
              >
                <option value="per_mo">Skema 1: Tagih Per Media Order (MO)</option>
                <option value="termin">Skema 2: Termin Persentase Deal</option>
                <option value="sekali_tagih">Skema 3: Sekali Tagih Penuh (100%)</option>
              </select>
            </div>
            {skema === 'termin' && (
              <div>
                <label className="block font-medium text-slate-700 mb-1">Persentase Termin (%)</label>
                <input
                  type="number"
                  min={10}
                  max={100}
                  value={persenTagih}
                  onChange={(e) => setPersenTagih(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
                />
              </div>
            )}
            <div>
              <label className="block font-medium text-slate-700 mb-1">Nomor Seri Faktur Pajak (e-Faktur)</label>
              <input
                type="text"
                value={noFakturPajak}
                onChange={(e) => setNoFakturPajak(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Bea Meterai (Rp)</label>
              <input
                type="number"
                value={meterai}
                onChange={(e) => setMeterai(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
              />
            </div>
            <div className="flex items-center pt-5">
              <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-800">
                <input
                  type="checkbox"
                  checked={pph23Dipotong}
                  onChange={(e) => setPph23Dipotong(e.target.checked)}
                  className="w-4 h-4"
                />
                Klien Memotong PPh Pasal 23 (2% dari DPP)
              </label>
            </div>
            <div className="md:col-span-3">
              <label className="block font-medium text-slate-700 mb-1">Keterangan Tagihan / Termin</label>
              <input
                type="text"
                value={keteranganTermin}
                onChange={(e) => setKeteranganTermin(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 border border-slate-300 rounded-md cursor-pointer"
            >
              Batal
            </button>
            <button type="submit" className="px-5 py-2 bg-blue-600 text-white font-semibold rounded-md cursor-pointer">
              Terbitkan Invoice Sekarang
            </button>
          </div>
        </form>
      )}

      {/* Modal Pencatatan Pembayaran */}
      {paymentTarget && (
        <form onSubmit={handleRecordPayment} className="bg-emerald-50 border border-emerald-300 rounded-lg p-6 space-y-4 text-xs">
          <div className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-emerald-700" />
            Catat Penerimaan Pembayaran untuk Invoice {paymentTarget.nomor}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block font-medium text-slate-800 mb-1">
                Nominal Pembayaran Diterima (Sisa: {formatRupiah(Number(paymentTarget.total_tagihan) - Number(paymentTarget.total_dibayar))})
              </label>
              <input
                type="number"
                required
                value={jumlahBayar}
                onChange={(e) => setJumlahBayar(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-800 mb-1">Metode & Bank Penerima</label>
              <input
                type="text"
                required
                value={metodeBayar}
                onChange={(e) => setMetodeBayar(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-800 mb-1">Nomor Referensi Transaksi / Bukti</label>
              <input
                type="text"
                required
                value={referensiBank}
                onChange={(e) => setReferensiBank(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md font-mono"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setPaymentTarget(null)}
              className="px-4 py-2 bg-white border border-slate-300 rounded-md cursor-pointer"
            >
              Batal
            </button>
            <button type="submit" className="px-5 py-2 bg-emerald-600 text-white font-semibold rounded-md cursor-pointer">
              Simpan Pembayaran & Update Status Invoice
            </button>
          </div>
        </form>
      )}

      {/* Invoices List */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <th className="py-3 px-4 text-left">Nomor Invoice & Faktur Pajak</th>
              <th className="py-3 px-4 text-left">Klien & Referensi Deal/MO</th>
              <th className="py-3 px-4 text-left">Jatuh Tempo</th>
              <th className="py-3 px-4 text-right font-mono">Subtotal & Pajak</th>
              <th className="py-3 px-4 text-right font-mono">Total Tagihan</th>
              <th className="py-3 px-4 text-right font-mono">Sudah Dibayar</th>
              <th className="py-3 px-4 text-left">Status</th>
              <th className="py-3 px-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {invoices.map((inv) => {
              const sisa = Math.max(0, Number(inv.total_tagihan) - Number(inv.total_dibayar));
              return (
                <tr key={inv.id} className="hover:bg-slate-50/70">
                  <td className="py-3.5 px-4 font-mono">
                    <div className="font-bold text-blue-700">{inv.nomor}</div>
                    <div className="text-[11px] text-slate-500">FP: {inv.no_faktur_pajak || '-'}</div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-slate-900">{inv.snapshot_nama_klien}</div>
                    <div className="text-slate-500 font-mono text-[11px]">
                      Deal: {inv.nomor_deal} {inv.nomor_mo ? `· MO: ${inv.nomor_mo}` : ''}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-800">{formatDateId(inv.jatuh_tempo)}</td>
                  <td className="py-3.5 px-4 text-right font-mono text-[11px] text-slate-600">
                    <div>DPP: {formatRupiah(inv.subtotal)}</div>
                    <div>
                      PPN: +{formatRupiah(inv.ppn_nominal)}
                      {inv.pph23_dipotong ? ` · PPh23: -${formatRupiah(inv.pph23_nominal)}` : ''}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                    {formatRupiah(inv.total_tagihan)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono">
                    <div className="font-semibold text-emerald-700">{formatRupiah(inv.total_dibayar)}</div>
                    {sisa > 0 && <div className="text-[11px] text-amber-700">Sisa: {formatRupiah(sisa)}</div>}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={getStatusSemanticColor(inv.status)}>{inv.status}</span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => onPrintDocument('INVOICE', inv)}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium rounded flex items-center gap-1 cursor-pointer"
                      >
                        <Printer className="w-3 h-3" />
                        PDF
                      </button>
                      {sisa > 0 && canRecordPayment && (
                        <button
                          onClick={() => {
                            setPaymentTarget(inv);
                            setJumlahBayar(String(sisa));
                          }}
                          className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded cursor-pointer"
                        >
                          Catat Bayar
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
