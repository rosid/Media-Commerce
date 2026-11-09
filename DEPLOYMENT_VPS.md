# Panduan Deployment MediaFlow ERP ke VPS (Ubuntu / Debian) via GitHub

Panduan ini berisi langkah-langkah lengkap dan teruji untuk memasang dan menjalankan **MediaFlow ERP** di Virtual Private Server (VPS) berbasis Ubuntu 22.04/24.04 LTS atau Debian 12 dari repository GitHub.

---

## 1. Spesifikasi Minimum VPS Direkomendasikan

- **OS**: Ubuntu 22.04 LTS / Ubuntu 24.04 LTS / Debian 12
- **CPU**: 1 vCPU (2 vCPU direkomendasikan untuk performa optimal)
- **RAM**: 1 GB RAM minimum (2 GB RAM + 1 GB Swap direkomendasikan saat `npm run build`)
- **Disk**: 20 GB SSD
- **Port Terbuka Firewall**: 80 (HTTP), 443 (HTTPS), 22 (SSH)

---

## 2. Persiapan Sistem & Instalasi Node.js LTS

Login ke VPS Anda via SSH:
```bash
ssh root@ip_vps_anda
```

Perbarui paket sistem dan pasang dependensi build:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git build-essential python3 nginx certbot python3-certbot-nginx
```

> **Catatan Penting**: Paket `build-essential` dan `python3` wajib dipasang karena `better-sqlite3` melakukan kompilasi native C++ SQLite untuk performa database berkecepatan tinggi.

Pasang **Node.js 20 LTS atau 22 LTS**:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verifikasi versi Node.js & npm
node -v   # Minimal v20.x.x
npm -v    # Minimal v10.x.x
```

Pasang PM2 (Process Manager) secara global:
```bash
sudo npm install -g pm2
```

---

## 3. Clone Repository dari GitHub

Buat direktori aplikasi di `/var/www/` atau home directory:
```bash
sudo mkdir -p /var/www/mediaflow
sudo chown -R $USER:$USER /var/www/mediaflow
cd /var/www/mediaflow

# Clone repository Anda
git clone https://github.com/username-anda/mediaflow-erp.git .
```

---

## 4. Konfigurasi Environment (`.env`)

Salin file contoh konfigurasi:
```bash
cp .env.example .env
```

Buka file `.env` dengan nano:
```bash
nano .env
```

Hasilkan kunci rahasia acak 32-byte untuk `JWT_SECRET`:
```bash
openssl rand -hex 32
```
Salin hasilnya dan tempelkan ke `JWT_SECRET` di file `.env`.

Contoh isi `.env` di VPS:
```env
NODE_ENV="production"
PORT=3000
APP_URL="https://erp.domainanda.com"
JWT_SECRET="e98c76a4b12f83d9821a44c9b2e0f81d394a11883c5e7b219a77e5d83c21a4f0"
DB_PATH="./mediaflow.db"
```
Simpan dengan `Ctrl + O` lalu keluar dengan `Ctrl + X`.

---

## 5. Instalasi Dependensi & Build Aplikasi

Jalankan instalasi paket dan proses kompilasi frontend:
```bash
# Pasang dependensi
npm install

# Kompilasi frontend React ke folder dist/
npm run build
```

---

## 6. Menjalankan Aplikasi dengan PM2 (Otomatis & Tahan Reboot)

Jalankan aplikasi di background menggunakan PM2:
```bash
pm2 start npm --name "mediaflow-erp" -- start
```

Simpan konfigurasi agar otomatis menyala kembali jika server reboot:
```bash
pm2 save
pm2 startup
```
*(Jalankan perintah sudo yang ditampilkan oleh terminal jika diminta oleh `pm2 startup`).*

Untuk memantau log atau status:
```bash
pm2 status
pm2 logs mediaflow-erp
```

---

## 7. Konfigurasi Nginx Reverse Proxy & SSL (HTTPS)

Buat file konfigurasi Nginx untuk domain Anda:
```bash
sudo nano /etc/nginx/sites-available/mediaflow.conf
```

Isi dengan konfigurasi berikut (ganti `erp.domainanda.com` dengan domain atau subdomain Anda):

```nginx
server {
    listen 80;
    server_name erp.domainanda.com;

    # Batas ukuran upload screenshot bukti tayang & logo (misal 20MB)
    client_max_body_size 20M;

    # Keamanan Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Aktifkan konfigurasi dan restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/mediaflow.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Pasang Sertifikat SSL Gratis (Let's Encrypt):
```bash
sudo certbot --nginx -d erp.domainanda.com
```
Certbot akan otomatis mengonfigurasi pengalihan HTTP ke HTTPS yang aman.

---

## 8. Backup Otomatis Database SQLite (Cron Job)

Database SQLite `mediaflow.db` sangat praktis karena tersimpan dalam satu file mandiri. Untuk menjamin keselamatan data dari risiko kegagalan hardware VPS, aktifkan backup berkala.

Buat direktori backup:
```bash
mkdir -p /var/backups/mediaflow
```

Buka crontab:
```bash
crontab -e
```

Tambahkan baris berikut untuk melakukan backup setiap hari pukul 02:00 pagi dan menghapus cadangan yang lebih tua dari 14 hari:
```bash
0 2 * * * cp /var/www/mediaflow/mediaflow.db /var/backups/mediaflow/mediaflow_$(date +\%Y\%m\%d_\%H\%M\%S).db && find /var/backups/mediaflow/ -name "mediaflow_*.db" -mtime +14 -exec rm {} \;
```

---

## 9. Prosedur Update dari GitHub di Masa Mendatang

Jika Anda melakukan perubahan kode di komputer lokal dan telah melakukan `git push` ke GitHub, perbarui versi di VPS dengan langkah ringkas ini:

```bash
cd /var/www/mediaflow
git pull origin main
npm install
npm run build
pm2 restart mediaflow-erp
```
*(Seluruh data quotation, deal, bukti tayang, dan invoice di `mediaflow.db` tetap utuh dan aman selama update karena tidak tertimpa oleh git).*

---

## 10. Akun Administrator Default

Saat database pertama kali diinisialisasi otomatis oleh sistem, gunakan akun bawaan:
- **Email**: `superadmin@mediaflow.id`
- **Password**: `admin123`

> **Sangat Disarankan**: Segera login pertama kali dan ubah password administrator Anda melalui menu **Pengaturan Akun** atau **Master Pengguna**.
