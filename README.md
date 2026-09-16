# WebApp Presensi Mengajar Dosen (Firebase + Github Pages Ready)

Aplikasi web modern, responsif, dan elegan untuk pencatatan berita acara dan presensi mengajar dosen, dirancang khusus agar mudah disematkan (*embedded*) ke dalam **Github Pages**.

---

## 🌟 Fitur Utama

1. **Formulir Absen Mengajar Dosen (Otentikasi Mandiri)**:
   - **Otentikasi Dosen**: Dosen login menggunakan akun yang telah dibuatkan admin.
   - **Nama Dosen Terkunci Otomatis**: Saat dosen login, nama dosen langsung terkunci pada formulir sehingga tidak dapat diubah-ubah.
   - **Riwayat Presensi Dosen**: Dosen dapat melihat catatan perkuliahan yang telah dilaksanakannya dan mengunduh rekap pribadinya ke Excel.
   - **Pilihan Kelas Spesifik**:
     - `A = Kelas Akuntansi pagi`
     - `B = Kelas Manajemen pagi`
     - `C = Kelas Akuntansi malam`
     - `D = Kelas Manajemen malam`
     - `NR Akt = Non Reguler Akuntansi`
     - `NR Mnj = Non Reguler Manajemen`
     - `NR A/M = Non Reguler Akuntansi Manajemen`
   - Tanggal perkuliahan, rentang jam perkuliahan, pertemuan ke-(1 s/d 16).
   - Materi pengajaran, jumlah mahasiswa hadir, pelaksanaan (Luring / Daring), serta catatan tambahan.
   - Validasi dan dialog konfirmasi interaktif menggunakan **SweetAlert2**.

2. **Panel Khusus Admin (dengan Sidebar Menu)**:
   - **Dashboard & Statistik**: Ringkasan total presensi, dosen aktif, perkuliahan hari ini, dan perbandingan Luring vs Daring.
   - **Monitoring Presensi**: Tabel rekaman absensi dengan pencarian instan dan multi-filter (Kelas, Dosen, Pelaksanaan, Tanggal).
   - **Fitur Ekspor / Unduh**:
     - Unduh ke format **Microsoft Excel (.xlsx)** menggunakan SheetJS.
     - Unduh ke format **CSV**.
     - **Cetak Laporan / Cetak PDF** yang rapi dengan print styling khusus.
   - **Kelola Dosen & Pembuatan Akun User Dosen**:
     - Admin dapat menambahkan dosen baru sekaligus membuat **Username**, **Email**, dan **Password**.
     - Admin dapat melihat kredensial akun dosen dan mereset password akun dosen sewaktu-waktu.
   - **Kelola Master Data Mata Kuliah & Penugasan Dosen**:
     - Saat admin menambahkan atau mengedit mata kuliah, admin **memilih Dosen Pengampu** dari daftar dosen yang telah didaftarkan.
     - Tabel mata kuliah menampilkan kolom **Dosen Pengampu**.
     - **Sinkronisasi Otomatis saat Absensi**: Saat dosen bersangkutan login, formulir absensi secara otomatis hanya menampilkan mata kuliah yang diampu oleh dosen tersebut (dan auto-select jika hanya mengampu 1 mata kuliah).
   - **Konfigurasi Firebase**: Form input credentials Firebase langsung melalui antarmuka web tanpa perlu mengedit kode.

3. **Smart Hybrid Storage (Local & Cloud)**:
   - Siap pakai langsung (*Out-of-the-box*) dengan data awal (*seed*) di penyimpanan lokal browser.
   - Otomatis tersinkronisasi dengan **Cloud Firestore & Firebase Auth** setelah memasukkan API keys.

---

## 🔐 Akun Login Demo untuk Pengujian Cepat

Halaman login portal mendukung login bertingkat (*multi-role*):

### 1. Akun Super Admin (Akses Penuh termasuk Konfigurasi Firebase API Key):
- **Email / Username**: `admin@kampus.ac.id` (atau `admin`, `superadmin`)
- **Password**: `admin123` (atau `kajimanuntung126`)
- **Hak Akses**: Mengelola seluruh sistem, Dashboard, Monitoring & Rekap Presensi, Kelola Dosen & Akun User, Kelola Mata Kuliah, serta **Akses Penuh mengubah Firebase API Key & Project ID**.

### 2. Akun Admin Khusus Bagian Akademik / BAAK (Input & Kelola Data, Tanpa API Key):
- **Email / Username**: `akademik` (atau `akademik@kampus.ac.id`, `baak`, `adminakademik`, `stienasbjm`)
- **Password**: `akademik123` (atau `kajimanuntung126`, `admin123`)
- **Hak Akses**: Menginput data presensi mengajar dosen, memantau kehadiran, mengunduh rekap & mencetak laporan, mengelola dosen & mata kuliah. **Menu dan hak akses Konfigurasi Firebase disembunyikan & dikunci demi keamanan sistem**.

### 3. Akun Dosen Contoh (Untuk Mengisi Absen Mandiri):
- **Dosen 1**: `hendra` / `dosen123` (Dr. Hendra Wijaya, S.E., M.Ak.)
- **Dosen 2**: `siti` / `dosen123` (Siti Rahmawati, S.E., M.M.)
- **Dosen 3**: `budi` / `dosen123` (Budi Santoso, S.Kom., M.M.S.I.)
- **Dosen 4**: `agus` / `dosen123` (Prof. Dr. Ir. Agus Pratama, M.B.A.)
- **Dosen 5**: `dewi` / `dosen123` (Dewi Anggraini, S.E., M.Sc.)

---

## 🌐 Panduan Memasukkan ke Github Pages (Embed)

Ada 2 cara mudah untuk menampilkan webapp ini pada Github Pages:

### Metode 1: Host Webapp lalu Sematkan via URL (Direkomendasikan)
1. Unggah berkas proyek ini ke hosting gratis seperti **Firebase Hosting**, **GitHub Pages**, **Vercel**, atau **Netlify**.
2. Buka editor **Github Pages** Anda.
3. Di panel sebelah kanan, klik menu **Sematkan** (*Embed*).
4. Pilih tab **Menurut URL** (*By URL*).
5. Masukkan link website hasil hosting Anda (misal: `https://presensi-dosen.web.app`).
6. Pilih **Seluruh halaman** (*Whole page*) dan klik **Sisipkan** (*Insert*).
7. Atur lebar dan tinggi blok sematan agar nyaman dilihat di tampilan desktop maupun HP.

### Metode 2: Sematkan via Kode (Embed Code)
Jika Anda memiliki URL hosting dan ingin memasukkannya dalam tag iframe manual:
```html
<iframe 
  src="https://URL-WEBSITE-ANDA.web.app" 
  width="100%" 
  height="900px" 
  frameborder="0" 
  style="border:none; border-radius:12px; overflow:hidden;"
  allow="clipboard-write">
</iframe>
```

---

## ☁️ Menghubungkan ke Proyek Firebase Anda

1. Buka [Firebase Console](https://console.firebase.google.com).
2. Buat proyek baru (misal: `presensi-dosen-kampus`).
3. Masuk ke menu **Build > Firestore Database**, lalu klik **Create database** (pilih mode *Start in test mode* untuk kemudahan awal).
4. Masuk ke **Project Settings** (ikon gerigi) > **General** > **Your apps** > klik ikon web `</>`.
5. Daftarkan aplikasi web untuk mendapatkan konfigurasi `firebaseConfig`:
   - `apiKey`
   - `authDomain`
   - `projectId`
   - `storageBucket`
   - `messagingSenderId`
   - `appId`
6. Buka webapp presensi ini > Login ke **Admin Panel** > Klik menu **Konfigurasi Firebase**.
7. Masukkan parameter-parameter tersebut dan klik **Simpan & Hubungkan Firebase**.

### Contoh Aturan Keamanan Firestore (Firestore Security Rules):
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Izinkan dosen mencatat presensi dan membaca master data
    match /presensi/{document} {
      allow read, write: if true;
    }
    match /dosen/{document} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /matakuliah/{document} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

---

## 📁 Struktur Berkas

```
d:/VM/
├── index.html              # Antarmuka SPA utama (Navbar, Form Presensi, Login, Admin Dashboard)
├── css/
│   └── style.css           # Desain modern, tema universitas, responsive, print stylesheet
├── js/
│   ├── firebase-config.js  # Layanan Firestore, LocalStorage fallback, seed master data
│   └── app.js              # Logika aplikasi, SweetAlert2 modals, export Excel & CSV, tabel filter
└── README.md               # Dokumentasi lengkap instalasi dan penggunaan
```
