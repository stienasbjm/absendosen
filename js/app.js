/**
 * Aplikasi Presensi Mengajar Dosen - Main Logic
 * Mendukung Ekspor Excel (SheetJS), CSV, Print, SweetAlert2, Master Data
 */

// Mapping Kode Kelas dan Nama Lengkap Kelas
const KELAS_MAP = {
  "A": "Kelas Akuntansi pagi",
  "B": "Kelas Manajemen pagi",
  "C": "Kelas Akuntansi malam",
  "D": "Kelas Manajemen malam",
  "NR Akt": "Non Reguler Akuntansi",
  "NR Mnj": "Non Reguler Manajemen",
  "NR A/M": "Non Reguler Akuntansi Manajemen"
};

// State Aplikasi
const AppState = {
  currentUser: null, // null jika tamu / dosen mode biasa, object jika admin login
  dosenList: [],
  matkulList: [],
  presensiList: [],
  currentAdminTab: "tab-dashboard"
};

// Inisialisasi saat DOM siap
document.addEventListener("DOMContentLoaded", async () => {
  initRealtimeClock();
  checkAuthSession();
  await loadMasterData();
  setupEventListeners();
  setupRadioCards();
  renderPresensiTable();
  updateDashboardStats();
  updateConnectionBadge();
});

// Realtime jam & tanggal pada banner login & form
function initRealtimeClock() {
  const updateTime = () => {
    const now = new Date();
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' };
    const str = now.toLocaleDateString('id-ID', options);
    const loginClock = document.getElementById("login-current-time");
    if (loginClock) loginClock.textContent = str;
    const formClock = document.getElementById("form-current-time");
    if (formClock) formClock.textContent = str;
  };
  updateTime();
  setInterval(updateTime, 1000 * 30);
}

// Cek sesi login (Admin atau Dosen) - Default membuka halaman login jika belum masuk
function checkAuthSession() {
  const session = sessionStorage.getItem("presensi_user_session") || sessionStorage.getItem("presensi_admin_session");
  if (session) {
    try {
      AppState.currentUser = JSON.parse(session);
      updateAuthUI();
      if (AppState.currentUser.role === "admin" || AppState.currentUser.role === "superadmin" || AppState.currentUser.role === "admin_akademik") {
        showView("view-admin-dashboard");
      } else if (AppState.currentUser.role === "dosen") {
        showView("view-form-absen");
      }
    } catch (e) {
      AppState.currentUser = null;
      updateAuthUI();
      showView("view-login");
    }
  } else {
    AppState.currentUser = null;
    updateAuthUI();
    showView("view-login");
  }
}

// Update tampilan antarmuka sesuai role login
function updateAuthUI() {
  const promptBanner = document.getElementById("dosen-auth-prompt");
  const loggedBanner = document.getElementById("dosen-logged-banner");
  const formDosen = document.getElementById("form-dosen");
  const lockedNotice = document.getElementById("locked-dosen-notice");

  // Elemen Sidebar Admin
  const adminName = document.getElementById("admin-user-display-name");
  const adminRole = document.getElementById("admin-user-display-role");
  const adminAvatar = document.getElementById("admin-user-avatar");
  const sidebarSectionPengaturan = document.getElementById("sidebar-section-pengaturan");
  const sidebarLinkFirebase = document.getElementById("sidebar-link-firebase");

  if (AppState.currentUser) {
    const isSuperAdmin = AppState.currentUser.role === "superadmin" || AppState.currentUser.role === "admin";
    const isAdminAkademik = AppState.currentUser.role === "admin_akademik";

    if (isSuperAdmin || isAdminAkademik) {
      if (promptBanner) promptBanner.style.display = "none";
      if (loggedBanner) {
        loggedBanner.style.display = "flex";
        document.getElementById("logged-dosen-nama").textContent = AppState.currentUser.name || (isSuperAdmin ? "Super Administrator" : "Admin Akademik");
        document.getElementById("logged-dosen-nip").textContent = isSuperAdmin ? "Super Admin" : "Bagian Akademik (BAAK)";
      }
      if (formDosen) {
        formDosen.disabled = false;
        formDosen.classList.remove("locked-input");
      }
      if (lockedNotice) lockedNotice.style.display = "none";

      // Pengaturan Identitas Profil di Sidebar
      if (adminName) {
        adminName.textContent = isSuperAdmin ? "Super Administrator" : "Admin Akademik";
      }
      if (adminRole) {
        adminRole.textContent = isSuperAdmin ? "Full Access (Firebase Master)" : "Pengelola Data Akademik (BAAK)";
      }
      if (adminAvatar) {
        adminAvatar.innerHTML = isSuperAdmin ? `<i class="fa-solid fa-shield-halved"></i>` : `<i class="fa-solid fa-user-pen"></i>`;
      }

      // KONTROL AKSES: Sembunyikan Konfigurasi Firebase untuk Admin Akademik
      if (sidebarLinkFirebase) {
        sidebarLinkFirebase.style.display = isSuperAdmin ? "flex" : "none";
      }
      if (sidebarSectionPengaturan) {
        sidebarSectionPengaturan.style.display = isSuperAdmin ? "block" : "none";
      }
    } else if (AppState.currentUser.role === "dosen") {
      if (promptBanner) promptBanner.style.display = "none";
      if (loggedBanner) {
        loggedBanner.style.display = "flex";
        document.getElementById("logged-dosen-nama").textContent = AppState.currentUser.nama;
        document.getElementById("logged-dosen-nip").textContent = `NIDN: ${AppState.currentUser.nip || '-'}`;
      }
      if (formDosen) {
        formDosen.value = AppState.currentUser.nama;
        formDosen.disabled = true;
        formDosen.classList.add("locked-input");
      }
      if (lockedNotice) lockedNotice.style.display = "flex";
    }
  } else {
    if (promptBanner) promptBanner.style.display = "flex";
    if (loggedBanner) loggedBanner.style.display = "none";
    if (formDosen) {
      formDosen.disabled = false;
      formDosen.classList.remove("locked-input");
    }
    if (lockedNotice) lockedNotice.style.display = "none";
  }

  // Sinkronkan daftar mata kuliah di formulir sesuai status login dosen
  populateMatkulDropdown();
}

// Update status koneksi Firebase / Local
function updateConnectionBadge() {
  const badge = document.getElementById("form-firebase-status-badge");
  const text = document.getElementById("form-firebase-status-text");
  if (!badge || !text) return;

  if (window.dbService && window.dbService.isFirebaseReady) {
    badge.className = "badge-status connected";
    badge.style.background = "rgba(16, 185, 129, 0.25)";
    badge.style.color = "#ffffff";
    badge.style.borderColor = "rgba(167, 243, 208, 0.6)";
    text.textContent = "Cloud Firebase Aktif";
  } else {
    badge.className = "badge-status local";
    badge.style.background = "rgba(255, 255, 255, 0.2)";
    badge.style.color = "#ffffff";
    badge.style.borderColor = "rgba(255, 255, 255, 0.4)";
    text.textContent = "Mode Siap Pakai (Local)";
  }
}

// Muat data master dosen & mata kuliah ke state & dropdown
async function loadMasterData() {
  AppState.dosenList = await window.dbService.getDosen();
  AppState.matkulList = await window.dbService.getMatkul();
  AppState.presensiList = await window.dbService.getPresensi();

  populateDosenDropdown();
  populateMatkulDropdown();
  renderDosenTable();
  renderMatkulTable();
}

function populateDosenDropdown() {
  const select = document.getElementById("form-dosen");
  if (!select) return;
  const currentVal = select.value;
  select.innerHTML = '<option value="">-- Pilih Nama Dosen --</option>';

  AppState.dosenList.forEach(d => {
    const opt = document.createElement("option");
    opt.value = d.nama;
    opt.textContent = `${d.nama} ${d.nip ? '(' + d.nip + ')' : ''}`;
    select.appendChild(opt);
  });

  if (currentVal) select.value = currentVal;

  // Filter dosen pada tabel admin
  const filterDosen = document.getElementById("filter-dosen");
  if (filterDosen) {
    filterDosen.innerHTML = '<option value="">Semua Dosen</option>';
    AppState.dosenList.forEach(d => {
      const opt = document.createElement("option");
      opt.value = d.nama;
      opt.textContent = d.nama;
      filterDosen.appendChild(opt);
    });
  }
}

function populateMatkulDropdown() {
  const select = document.getElementById("form-matkul");
  if (!select) return;
  const currentVal = select.value;
  select.innerHTML = '';

  let listToDisplay = AppState.matkulList;
  let isDosenFilter = false;

  // Jika yang login adalah Dosen, filter mata kuliah yang diampu
  if (AppState.currentUser && AppState.currentUser.role === "dosen") {
    const dName = AppState.currentUser.nama ? AppState.currentUser.nama.trim() : "";
    const filtered = AppState.matkulList.filter(m => m.dosenNama && m.dosenNama.trim().toLowerCase() === dName.toLowerCase());
    if (filtered.length > 0) {
      listToDisplay = filtered;
      isDosenFilter = true;
    }
  }

  if (isDosenFilter) {
    select.innerHTML = `<option value="">-- Pilih Mata Kuliah Anda (${listToDisplay.length} Mata Kuliah Terdaftar) --</option>`;
  } else {
    select.innerHTML = '<option value="">-- Pilih Mata Kuliah --</option>';
  }

  listToDisplay.forEach(m => {
    const opt = document.createElement("option");
    opt.value = m.nama;
    const pengampuInfo = !isDosenFilter && m.dosenNama ? ` [Dosen: ${m.dosenNama.split(',')[0]}]` : '';
    opt.textContent = `${m.kode ? m.kode + ' - ' : ''}${m.nama} (${m.sks} SKS)${pengampuInfo}`;
    select.appendChild(opt);
  });

  // Jika dosen hanya memiliki 1 mata kuliah, otomatis pilihkan untuk kenyamanan
  if (isDosenFilter && listToDisplay.length === 1) {
    select.value = listToDisplay[0].nama;
  } else if (currentVal && listToDisplay.some(m => m.nama === currentVal)) {
    select.value = currentVal;
  }
}

// Setup Event Listeners
function setupEventListeners() {
  // Navigasi View
  document.getElementById("btn-nav-absen")?.addEventListener("click", () => showView("view-form-absen"));
  document.getElementById("btn-nav-login")?.addEventListener("click", () => {
    if (AppState.currentUser) {
      if (AppState.currentUser.role === "admin") {
        showView("view-admin-dashboard");
      } else {
        openRiwayatPresensiDosen();
      }
    } else {
      showView("view-login");
    }
  });

  // Mobile sidebar toggle
  document.getElementById("btn-sidebar-toggle")?.addEventListener("click", () => {
    document.querySelector(".admin-sidebar")?.classList.toggle("open");
  });

  // Sidebar Links
  document.querySelectorAll(".sidebar-link[data-tab]").forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const tabId = link.getAttribute("data-tab");
      switchAdminTab(tabId);
      // Close sidebar on mobile after click
      if (window.innerWidth <= 992) {
        document.querySelector(".admin-sidebar")?.classList.remove("open");
      }
    });
  });

  // Login Form
  document.getElementById("form-login")?.addEventListener("submit", handleAdminLogin);
  document.getElementById("btn-logout")?.addEventListener("click", handleLogout);
  document.getElementById("btn-sidebar-logout")?.addEventListener("click", handleLogout);

  // Form Absen Submit
  document.getElementById("form-absen-dosen")?.addEventListener("submit", handleAbsenSubmit);

  // Filter Presensi di Admin
  document.getElementById("table-search-input")?.addEventListener("input", filterPresensiTable);
  document.getElementById("filter-kelas")?.addEventListener("change", filterPresensiTable);
  document.getElementById("filter-dosen")?.addEventListener("change", filterPresensiTable);
  document.getElementById("filter-pelaksanaan")?.addEventListener("change", filterPresensiTable);
  document.getElementById("filter-tanggal")?.addEventListener("change", filterPresensiTable);

  // Tombol Unduh & Cetak
  document.getElementById("btn-export-excel")?.addEventListener("click", exportToExcel);
  document.getElementById("btn-export-csv")?.addEventListener("click", exportToCSV);
  document.getElementById("btn-print-presensi")?.addEventListener("click", openRekapCetakModal);

  // Dropdown filter perubahan pada Modal Rekap Laporan Bulanan
  document.getElementById("rekap-select-bulan")?.addEventListener("change", renderRekapLaporanBulanan);
  document.getElementById("rekap-select-tahun")?.addEventListener("change", renderRekapLaporanBulanan);
  document.getElementById("rekap-select-dosen")?.addEventListener("change", renderRekapLaporanBulanan);
  document.getElementById("rekap-select-format")?.addEventListener("change", renderRekapLaporanBulanan);

  // Master Data Buttons
  document.getElementById("btn-tambah-dosen")?.addEventListener("click", openAddDosenModal);
  document.getElementById("btn-tambah-matkul")?.addEventListener("click", openAddMatkulModal);

  // Firebase Config Form
  document.getElementById("form-firebase-config")?.addEventListener("submit", handleFirebaseConfigSave);
  document.getElementById("btn-reset-config")?.addEventListener("click", handleResetConfig);

  // Set tanggal perkuliahan default hari ini
  const tglInput = document.getElementById("form-tanggal");
  if (tglInput && !tglInput.value) {
    tglInput.value = new Date().toISOString().split('T')[0];
  }
}

// Handling Radio Cards (Pelaksanaan Luring/Daring)
function setupRadioCards() {
  document.querySelectorAll('.radio-card-label').forEach(label => {
    label.addEventListener('click', function() {
      const group = this.closest('.radio-cards-group');
      group.querySelectorAll('.radio-card-label').forEach(l => l.classList.remove('selected'));
      this.classList.add('selected');
      const radio = this.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
    });
  });
}

// Ganti Tampilan Antara Form Presensi, Login, dan Admin Dashboard
function showView(viewId) {
  document.querySelectorAll(".view-section").forEach(sec => sec.classList.remove("active"));
  const target = document.getElementById(viewId);
  if (target) {
    target.classList.add("active");
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Jika kembali ke form absen, refresh dropdown
  if (viewId === "view-form-absen") {
    populateDosenDropdown();
    populateMatkulDropdown();
  }
}

function showAdminNavbarState(isLoggedIn) {
  const btnLogin = document.getElementById("btn-nav-login");
  if (!btnLogin) return;

  if (isLoggedIn) {
    btnLogin.innerHTML = `<i class="fa-solid fa-gauge-high"></i> Dashboard Admin`;
    btnLogin.classList.add("btn-primary");
    btnLogin.classList.remove("btn-outline-primary");
  } else {
    btnLogin.innerHTML = `<i class="fa-solid fa-lock"></i> Login Admin`;
    btnLogin.classList.add("btn-outline-primary");
    btnLogin.classList.remove("btn-primary");
  }
}

// Tab Switching di Admin
function switchAdminTab(tabId) {
  // Proteksi hak akses: Admin Akademik dilarang mengakses tab-firebase
  if (tabId === "tab-firebase" && AppState.currentUser && AppState.currentUser.role === "admin_akademik") {
    Swal.fire({
      icon: 'warning',
      title: 'Akses Dibatasi',
      html: 'Menu <strong>Konfigurasi Firebase (API Key)</strong> hanya dapat diakses oleh <strong>Super Administrator</strong>.<br><small style="color:#64748b">Akun Admin Akademik hanya berwenang untuk menginput dan mengelola data presensi, dosen, dan mata kuliah.</small>',
      confirmButtonColor: '#2563eb'
    });
    return;
  }

  document.querySelectorAll(".sidebar-link").forEach(l => l.classList.remove("active"));
  const activeLink = document.querySelector(`.sidebar-link[data-tab="${tabId}"]`);
  if (activeLink) activeLink.classList.add("active");

  document.querySelectorAll(".admin-tab").forEach(tab => tab.classList.remove("active"));
  const activeTab = document.getElementById(tabId);
  if (activeTab) activeTab.classList.add("active");

  AppState.currentAdminTab = tabId;

  if (tabId === "tab-dashboard") {
    updateDashboardStats();
  } else if (tabId === "tab-monitoring") {
    renderPresensiTable();
  } else if (tabId === "tab-dosen") {
    renderDosenTable();
  } else if (tabId === "tab-matkul") {
    renderMatkulTable();
  } else if (tabId === "tab-firebase") {
    loadFirebaseConfigIntoForm();
  }
}

// ================= FORM ABSENSI DOSEN =================
async function handleAbsenSubmit(e) {
  e.preventDefault();

  // Wajib login sebagai Dosen atau Admin
  if (!AppState.currentUser) {
    Swal.fire({
      icon: 'warning',
      title: 'Harap Login Terlebih Dahulu',
      html: 'Anda harus masuk menggunakan <strong>Akun User Dosen</strong> yang telah dibuatkan oleh Admin untuk dapat melakukan absensi mengajar.',
      showCancelButton: true,
      confirmButtonColor: '#2563eb',
      confirmButtonText: '<i class="fa-solid fa-right-to-bracket"></i> Masuk Akun Dosen',
      cancelButtonText: 'Batal'
    }).then((res) => {
      if (res.isConfirmed) {
        showView('view-login');
      }
    });
    return;
  }

  // Jika Dosen login, ambil nama langsung dari akun yang terverifikasi
  let dosen = "";
  if (AppState.currentUser.role === "dosen") {
    dosen = AppState.currentUser.nama;
  } else {
    dosen = document.getElementById("form-dosen").value.trim();
  }

  const matkul = document.getElementById("form-matkul").value.trim();
  const kelas = document.getElementById("form-kelas").value;
  const tanggal = document.getElementById("form-tanggal").value;
  const jamMulai = document.getElementById("form-jam-mulai").value;
  const jamSelesai = document.getElementById("form-jam-selesai").value;
  const pertemuan = document.getElementById("form-pertemuan").value;
  const materi = document.getElementById("form-materi").value.trim();
  const jumlahMhs = document.getElementById("form-jumlah-mhs").value;
  const pelaksanaanRadio = document.querySelector('input[name="pelaksanaan"]:checked');
  const pelaksanaan = pelaksanaanRadio ? pelaksanaanRadio.value : "Luring";
  const keterangan = document.getElementById("form-keterangan").value.trim();

  // Validasi
  if (!dosen) {
    Swal.fire({ icon: 'warning', title: 'Perhatian', text: 'Silakan pilih Nama Dosen!' });
    return;
  }
  if (!matkul) {
    Swal.fire({ icon: 'warning', title: 'Perhatian', text: 'Silakan pilih Mata Kuliah!' });
    return;
  }
  if (!kelas) {
    Swal.fire({ icon: 'warning', title: 'Perhatian', text: 'Silakan pilih Kelas Perkuliahan!' });
    return;
  }
  if (!tanggal) {
    Swal.fire({ icon: 'warning', title: 'Perhatian', text: 'Tanggal perkuliahan wajib diisi!' });
    return;
  }
  if (!jamMulai || !jamSelesai) {
    Swal.fire({ icon: 'warning', title: 'Perhatian', text: 'Jam perkuliahan (Mulai s/d Selesai) wajib diisi!' });
    return;
  }
  if (!pertemuan) {
    Swal.fire({ icon: 'warning', title: 'Perhatian', text: 'Pertemuan ke- perkuliahan wajib dipilih!' });
    return;
  }
  if (!materi) {
    Swal.fire({ icon: 'warning', title: 'Perhatian', text: 'Rangkuman materi perkuliahan wajib diisi!' });
    return;
  }
  if (!jumlahMhs || jumlahMhs < 0) {
    Swal.fire({ icon: 'warning', title: 'Perhatian', text: 'Jumlah mahasiswa hadir wajib diisi!' });
    return;
  }

  const kelasLabel = KELAS_MAP[kelas] || kelas;
  const jamGabung = `${jamMulai} - ${jamSelesai}`;

  // Konfirmasi sebelum simpan
  const confirm = await Swal.fire({
    title: 'Konfirmasi Presensi Mengajar',
    html: `
      <div style="text-align: left; font-size: 0.9rem; line-height: 1.6; background: #f8fafc; padding: 1rem; border-radius: 8px; border: 1px solid #e2e8f0;">
        <p><strong>Dosen:</strong> ${escapeHtml(dosen)}</p>
        <p><strong>Mata Kuliah:</strong> ${escapeHtml(matkul)}</p>
        <p><strong>Kelas:</strong> ${kelas} (${kelasLabel})</p>
        <p><strong>Waktu:</strong> ${tanggal}, ${jamGabung}</p>
        <p><strong>Pertemuan:</strong> Ke-${pertemuan} (${pelaksanaan})</p>
        <p><strong>Jumlah Mahasiswa:</strong> ${jumlahMhs} orang</p>
      </div>
      <p style="margin-top: 10px; font-size: 0.85rem; color: #64748b;">Pastikan data yang Anda masukkan sudah benar.</p>
    `,
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#2563eb',
    cancelButtonColor: '#64748b',
    confirmButtonText: '<i class="fa-solid fa-paper-plane"></i> Ya, Kirim Presensi',
    cancelButtonText: 'Periksa Kembali'
  });

  if (!confirm.isConfirmed) return;

  Swal.fire({
    title: 'Menyimpan Presensi...',
    text: 'Mohon tunggu sebentar',
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });

  try {
    const record = {
      dosenNama: dosen,
      dosenId: AppState.currentUser.dosenId || null,
      matkulNama: matkul,
      kelas: kelas,
      kelasLabel: kelasLabel,
      tanggal: tanggal,
      jam: jamGabung,
      pertemuan: Number(pertemuan),
      materi: materi,
      jumlahMhs: Number(jumlahMhs),
      pelaksanaan: pelaksanaan,
      keterangan: keterangan || '-'
    };

    await window.dbService.addPresensi(record);
    AppState.presensiList = await window.dbService.getPresensi();

    Swal.fire({
      icon: 'success',
      title: 'Presensi Berhasil Dikirim!',
      html: `
        <p style="color: #475569; font-size: 0.95rem;">Terima kasih <strong>${escapeHtml(dosen)}</strong>, data kehadiran mengajar Anda untuk pertemuan ke-<strong>${pertemuan}</strong> kelas <strong>${kelas}</strong> telah tersimpan dalam sistem.</p>
      `,
      confirmButtonColor: '#2563eb',
      confirmButtonText: 'Selesai'
    });

    // Reset field perkuliahan (nama dosen tetap terkunci jika sedang login)
    document.getElementById("form-matkul").value = "";
    document.getElementById("form-kelas").value = "";
    document.getElementById("form-pertemuan").value = "";
    document.getElementById("form-materi").value = "";
    document.getElementById("form-jumlah-mhs").value = "";
    document.getElementById("form-keterangan").value = "";
    document.getElementById("form-tanggal").value = new Date().toISOString().split('T')[0];
    document.querySelector('.radio-card-label[data-type="Luring"]')?.click();

    updateDashboardStats();
    renderPresensiTable();
  } catch (error) {
    console.error("Gagal simpan presensi:", error);
    Swal.fire({
      icon: 'error',
      title: 'Gagal Menyimpan',
      text: 'Terjadi kesalahan sistem saat menyimpan presensi. Silakan coba lagi.'
    });
  }
}

// ================= AUTH PORTAL (ADMIN & DOSEN) =================
function findMatchingDosen(list, cleanInput, cleanPass, rawPass) {
  if (!list || !Array.isArray(list)) return null;
  return list.find(d => {
    const u = (d.username || '').trim().toLowerCase();
    const em = (d.email || '').trim().toLowerCase();
    const nip = (d.nip || '').trim().toLowerCase();
    const nama = (d.nama || '').trim().toLowerCase();
    const storedPass = String(d.password !== undefined && d.password !== null ? d.password : 'dosen123').trim();

    const usernameMatch = (
      (u && u === cleanInput) ||
      (em && em === cleanInput) ||
      (nip && nip === cleanInput) ||
      (nama && (nama === cleanInput || nama.replace(/[^a-z0-9]/g, '') === cleanInput.replace(/[^a-z0-9]/g, ''))) ||
      (cleanInput.includes('@') && em.startsWith(cleanInput.split('@')[0]))
    );

    const passwordMatch = (
      storedPass === cleanPass ||
      storedPass === rawPass ||
      (d.password && String(d.password) === rawPass)
    );

    return usernameMatch && passwordMatch;
  });
}

async function handleAdminLogin(e) {
  e.preventDefault();
  const inputUser = document.getElementById("login-email").value.trim();
  const pass = document.getElementById("login-password").value;

  if (!inputUser || !pass) {
    Swal.fire({ icon: 'warning', title: 'Lengkapi Data', text: 'Username/Email dan Password wajib diisi!' });
    return;
  }

  const cleanInput = inputUser.toLowerCase();
  const cleanPass = pass.trim();

  // 1. Cek apakah ini akun Super Admin
  const isSuperUser = (
    cleanInput === "admin@kampus.ac.id" ||
    cleanInput === "admin" ||
    cleanInput === "superadmin"
  );
  if (isSuperUser && (cleanPass === "admin123" || cleanPass === "kajimanuntung126")) {
    loginWithSuperAdminSession();
    return;
  }

  // 2. Cek apakah ini akun Admin Khusus Bagian Akademik
  const isAkademikUser = (
    cleanInput === "akademik@kampus.ac.id" ||
    cleanInput === "akademik" ||
    cleanInput === "baak" ||
    cleanInput === "adminakademik" ||
    cleanInput === "admin.akademik" ||
    cleanInput === "admin akademik" ||
    cleanInput === "stienasbjm"
  );
  if (isAkademikUser && (cleanPass === "akademik123" || cleanPass === "admin123" || cleanPass === "kajimanuntung126")) {
    loginWithAkademikSession();
    return;
  }

  // 3. Cek apakah ini akun User Dosen di Master Data Dosen
  let currentDosenList = (AppState.dosenList && AppState.dosenList.length > 0)
    ? AppState.dosenList
    : await window.dbService.getDosen();

  let dosenMatch = findMatchingDosen(currentDosenList, cleanInput, cleanPass, pass);

  // Jika belum ditemukan di state lokal, reload langsung dari database / storage
  if (!dosenMatch) {
    currentDosenList = await window.dbService.getDosen();
    AppState.dosenList = currentDosenList;
    dosenMatch = findMatchingDosen(currentDosenList, cleanInput, cleanPass, pass);
  }

  if (dosenMatch) {
    AppState.currentUser = {
      role: "dosen",
      dosenId: dosenMatch.id,
      nama: dosenMatch.nama,
      email: dosenMatch.email,
      username: dosenMatch.username,
      nip: dosenMatch.nip
    };
    sessionStorage.setItem("presensi_user_session", JSON.stringify(AppState.currentUser));
    updateAuthUI();
    Swal.fire({
      icon: 'success',
      title: 'Login Dosen Berhasil!',
      html: `Selamat datang, <strong>${escapeHtml(dosenMatch.nama)}</strong>.<br><small style="color:#64748b">Nama Anda sekarang otomatis terkunci pada form presensi mengajar.</small>`,
      timer: 2000,
      showConfirmButton: false
    });
    showView("view-form-absen");
    return;
  }

  // 4. Jika Firebase Auth aktif, coba verifikasi ke Firebase Auth
  if (window.dbService.isFirebaseReady && window.dbService.auth && cleanInput.includes('@')) {
    Swal.fire({
      title: 'Memverifikasi Akun...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    window.dbService.auth.signInWithEmailAndPassword(inputUser, pass)
      .then((userCredential) => {
        const user = userCredential.user;
        AppState.currentUser = { email: user.email, uid: user.uid, role: "superadmin", name: user.email };
        sessionStorage.setItem("presensi_user_session", JSON.stringify(AppState.currentUser));
        updateAuthUI();
        Swal.fire({
          icon: 'success',
          title: 'Login Berhasil',
          text: `Selamat datang, ${user.email}!`,
          timer: 1500,
          showConfirmButton: false
        });
        showView("view-admin-dashboard");
        switchAdminTab("tab-dashboard");
      })
      .catch(() => {
        Swal.fire({
          icon: 'error',
          title: 'Login Gagal',
          html: 'Username/Email atau kata sandi tidak cocok. Silakan periksa kembali akun Anda.'
        });
      });
    return;
  }

  // 5. Gagal login (Pesan bersih tanpa membocorkan kredensial demo)
  Swal.fire({
    icon: 'error',
    title: 'Login Gagal',
    html: 'Username/Email atau kata sandi tidak cocok. Silakan periksa kembali akun Anda.'
  });
}

function loginWithSuperAdminSession() {
  AppState.currentUser = { 
    email: "admin@kampus.ac.id", 
    role: "superadmin", 
    name: "Super Administrator", 
    title: "Super Admin",
    canManageFirebase: true 
  };
  sessionStorage.setItem("presensi_user_session", JSON.stringify(AppState.currentUser));
  updateAuthUI();
  Swal.fire({
    icon: 'success',
    title: 'Login Super Admin Berhasil',
    html: 'Selamat datang, <strong>Super Administrator</strong>.<br><small style="color:#64748b">Hak akses penuh aktif termasuk Konfigurasi Firebase API Key.</small>',
    timer: 1400,
    showConfirmButton: false
  });
  showView("view-admin-dashboard");
  switchAdminTab("tab-dashboard");
}

function loginWithAkademikSession() {
  AppState.currentUser = { 
    email: "akademik@kampus.ac.id", 
    role: "admin_akademik", 
    name: "Admin Bagian Akademik", 
    title: "Admin Akademik (BAAK)",
    canManageFirebase: false 
  };
  sessionStorage.setItem("presensi_user_session", JSON.stringify(AppState.currentUser));
  updateAuthUI();
  Swal.fire({
    icon: 'success',
    title: 'Login Admin Akademik Berhasil',
    html: 'Selamat datang, <strong>Admin Akademik (BAAK)</strong>.<br><small style="color:#64748b">Hak akses input presensi, data dosen, dan mata kuliah aktif. Menu Firebase API Key dikunci untuk keamanan sistem.</small>',
    timer: 1800,
    showConfirmButton: false
  });
  showView("view-admin-dashboard");
  switchAdminTab("tab-dashboard");
}


function handleLogout() {
  Swal.fire({
    title: 'Konfirmasi Keluar (Logout)?',
    text: 'Sesi Anda saat ini akan diakhiri.',
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    confirmButtonText: 'Ya, Logout',
    cancelButtonText: 'Batal'
  }).then((result) => {
    if (result.isConfirmed) {
      if (window.dbService.isFirebaseReady && window.dbService.auth) {
        window.dbService.auth.signOut().catch(() => {});
      }
      AppState.currentUser = null;
      sessionStorage.removeItem("presensi_user_session");
      sessionStorage.removeItem("presensi_admin_session");
      updateAuthUI();
      showView("view-login");
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Anda telah keluar',
        showConfirmButton: false,
        timer: 1500
      });
    }
  });
}

// ================= DASHBOARD & STATISTIK =================
function updateDashboardStats() {
  const total = AppState.presensiList.length;
  const todayStr = new Date().toISOString().split('T')[0];
  const todayRecords = AppState.presensiList.filter(p => p.tanggal === todayStr);

  const luringCount = AppState.presensiList.filter(p => p.pelaksanaan === "Luring").length;
  const daringCount = AppState.presensiList.filter(p => p.pelaksanaan === "Daring").length;

  document.getElementById("stat-total-presensi").textContent = total;
  document.getElementById("stat-today-presensi").textContent = todayRecords.length;
  document.getElementById("stat-total-dosen").textContent = AppState.dosenList.length;
  document.getElementById("stat-luring-daring").textContent = `${luringCount} / ${daringCount}`;

  // Render 5 presensi terbaru di dashboard
  const recentTable = document.getElementById("table-recent-presensi-body");
  if (recentTable) {
    if (AppState.presensiList.length === 0) {
      recentTable.innerHTML = `<tr><td colspan="6" class="empty-state">Belum ada data absensi mengajar.</td></tr>`;
      return;
    }
    const recents = AppState.presensiList.slice(0, 5);
    recentTable.innerHTML = recents.map(r => `
      <tr>
        <td><strong>${escapeHtml(r.dosenNama)}</strong></td>
        <td>${escapeHtml(r.matkulNama)}</td>
        <td><span class="badge-pill badge-class">${r.kelas}</span> <small style="color:#64748b">${r.kelasLabel}</small></td>
        <td>${r.tanggal} (${r.jam})</td>
        <td>Pertemuan ${r.pertemuan}</td>
        <td><span class="badge-pill ${r.pelaksanaan === 'Luring' ? 'badge-luring' : 'badge-daring'}">${r.pelaksanaan}</span></td>
      </tr>
    `).join('');
  }
}

// ================= MONITORING PRESENSI & TABEL =================
function getFilteredPresensi() {
  const query = (document.getElementById("table-search-input")?.value || "").toLowerCase().trim();
  const filterKelas = document.getElementById("filter-kelas")?.value || "";
  const filterDosen = document.getElementById("filter-dosen")?.value || "";
  const filterPelaksanaan = document.getElementById("filter-pelaksanaan")?.value || "";
  const filterTanggal = document.getElementById("filter-tanggal")?.value || "";

  return AppState.presensiList.filter(p => {
    // Search query
    if (query) {
      const matchDosen = p.dosenNama.toLowerCase().includes(query);
      const matchMatkul = p.matkulNama.toLowerCase().includes(query);
      const matchMateri = (p.materi || "").toLowerCase().includes(query);
      const matchKet = (p.keterangan || "").toLowerCase().includes(query);
      if (!matchDosen && !matchMatkul && !matchMateri && !matchKet) return false;
    }

    if (filterKelas && p.kelas !== filterKelas) return false;
    if (filterDosen && p.dosenNama !== filterDosen) return false;
    if (filterPelaksanaan && p.pelaksanaan !== filterPelaksanaan) return false;
    if (filterTanggal && p.tanggal !== filterTanggal) return false;

    return true;
  });
}

function filterPresensiTable() {
  renderPresensiTable();
}

function renderPresensiTable() {
  const tbody = document.getElementById("table-presensi-body");
  if (!tbody) return;

  const data = getFilteredPresensi();
  document.getElementById("badge-presensi-count").textContent = `${data.length} Data`;

  if (data.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9">
          <div class="empty-state">
            <i class="fa-regular fa-folder-open"></i>
            <div class="empty-state-title">Tidak ada data presensi ditemukan</div>
            <div class="empty-state-desc">Ubah filter pencarian atau belum ada absensi yang dicatat.</div>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = data.map((item, index) => `
    <tr>
      <td style="font-weight:600; text-align:center;">${index + 1}</td>
      <td>
        <div style="font-weight:700; color:#0f172a;">${escapeHtml(item.dosenNama)}</div>
        <div style="font-size:0.75rem; color:#64748b;"><i class="fa-regular fa-clock"></i> ${item.jam}</div>
      </td>
      <td>
        <div style="font-weight:600;">${escapeHtml(item.matkulNama)}</div>
        <div style="font-size:0.75rem; color:#64748b;">Tanggal: ${item.tanggal}</div>
      </td>
      <td>
        <span class="badge-pill badge-class">${item.kelas}</span>
        <div style="font-size:0.75rem; color:#64748b; margin-top:2px;">${item.kelasLabel}</div>
      </td>
      <td style="text-align:center;">
        <span class="badge-pill" style="background:#f1f5f9; color:#334155;">Ke-${item.pertemuan}</span>
      </td>
      <td style="max-width:200px;">
        <div style="font-size:0.825rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escapeHtml(item.materi)}">
          ${escapeHtml(item.materi)}
        </div>
      </td>
      <td style="text-align:center;">
        <strong>${item.jumlahMhs}</strong> Mhs
      </td>
      <td>
        <span class="badge-pill ${item.pelaksanaan === 'Luring' ? 'badge-luring' : 'badge-daring'}">
          <i class="fa-solid ${item.pelaksanaan === 'Luring' ? 'fa-building-columns' : 'fa-video'}"></i> ${item.pelaksanaan}
        </span>
      </td>
      <td style="text-align:center; white-space:nowrap;">
        <button class="btn btn-secondary btn-sm" onclick="showPresensiDetail('${item.id}')" title="Lihat Detail">
          <i class="fa-solid fa-eye"></i>
        </button>
        <button class="btn btn-danger btn-sm" onclick="deletePresensiItem('${item.id}')" title="Hapus">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

// Tampilkan modal detail presensi
window.showPresensiDetail = function(id) {
  const item = AppState.presensiList.find(p => p.id === id);
  if (!item) return;

  Swal.fire({
    title: 'Detail Presensi Mengajar',
    html: `
      <div style="text-align: left; font-size: 0.9rem; line-height: 1.7; background: #f8fafc; padding: 1.25rem; border-radius: 8px; border: 1px solid #e2e8f0;">
        <p><strong>Nama Dosen:</strong> ${escapeHtml(item.dosenNama)}</p>
        <p><strong>Mata Kuliah:</strong> ${escapeHtml(item.matkulNama)}</p>
        <p><strong>Kelas:</strong> ${item.kelas} - ${item.kelasLabel}</p>
        <p><strong>Waktu:</strong> ${item.tanggal} (${item.jam})</p>
        <p><strong>Pertemuan:</strong> Ke-${item.pertemuan}</p>
        <p><strong>Pelaksanaan:</strong> ${item.pelaksanaan}</p>
        <p><strong>Jumlah Mahasiswa Hadir:</strong> ${item.jumlahMhs} orang</p>
        <hr style="margin: 0.75rem 0; border: none; border-top: 1px solid #cbd5e1;">
        <p><strong>Materi Perkuliahan:</strong><br><span style="color:#1e293b; white-space: pre-wrap;">${escapeHtml(item.materi)}</span></p>
        <hr style="margin: 0.75rem 0; border: none; border-top: 1px solid #cbd5e1;">
        <p><strong>Keterangan Tambahan:</strong><br><span style="color:#64748b;">${escapeHtml(item.keterangan || '-')}</span></p>
      </div>
    `,
    confirmButtonColor: '#2563eb',
    confirmButtonText: 'Tutup'
  });
};

// Hapus presensi
window.deletePresensiItem = async function(id) {
  const confirm = await Swal.fire({
    title: 'Hapus Catatan Presensi?',
    text: 'Data yang dihapus tidak dapat dikembalikan lagi.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    confirmButtonText: 'Ya, Hapus Data',
    cancelButtonText: 'Batal'
  });

  if (confirm.isConfirmed) {
    await window.dbService.deletePresensi(id);
    AppState.presensiList = await window.dbService.getPresensi();
    renderPresensiTable();
    updateDashboardStats();
    Swal.fire({
      icon: 'success',
      title: 'Data Berhasil Dihapus',
      timer: 1500,
      showConfirmButton: false
    });
  }
};

// ================= EKSPOR DATA PRESENSI =================
// 1. Ekspor ke Excel (.xlsx) dengan SheetJS
function exportToExcel() {
  const data = getFilteredPresensi();
  if (data.length === 0) {
    Swal.fire({ icon: 'info', title: 'Data Kosong', text: 'Tidak ada data presensi untuk diunduh.' });
    return;
  }

  try {
    const formattedData = data.map((item, idx) => ({
      "No": idx + 1,
      "Tanggal": item.tanggal,
      "Jam Perkuliahan": item.jam,
      "Nama Dosen": item.dosenNama,
      "Mata Kuliah": item.matkulNama,
      "Kode Kelas": item.kelas,
      "Keterangan Kelas": item.kelasLabel,
      "Pertemuan Ke": item.pertemuan,
      "Pelaksanaan": item.pelaksanaan,
      "Jumlah Mahasiswa": item.jumlahMhs,
      "Materi Pembahasan": item.materi,
      "Keterangan": item.keterangan || "-"
    }));

    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Presensi Dosen");

    // Atur lebar kolom otomatis
    worksheet["!cols"] = [
      { wch: 5 },  // No
      { wch: 12 }, // Tanggal
      { wch: 16 }, // Jam
      { wch: 32 }, // Dosen
      { wch: 28 }, // Matkul
      { wch: 12 }, // Kode Kelas
      { wch: 26 }, // Ket Kelas
      { wch: 14 }, // Pertemuan
      { wch: 12 }, // Pelaksanaan
      { wch: 16 }, // Jml Mhs
      { wch: 45 }, // Materi
      { wch: 25 }  // Ket
    ];

    const todayStr = new Date().toISOString().split('T')[0];
    const filename = `Presensi_Mengajar_Dosen_${todayStr}.xlsx`;
    XLSX.writeFile(workbook, filename);

    Swal.fire({
      icon: 'success',
      title: 'File Excel Berhasil Diunduh!',
      text: `File tersimpan dengan nama: ${filename}`,
      timer: 2000,
      showConfirmButton: false
    });
  } catch (err) {
    console.error("Gagal export excel:", err);
    Swal.fire({ icon: 'error', title: 'Gagal Mengunduh', text: 'Gagal membuat file Excel. Silakan coba ekspor CSV.' });
  }
}

// 2. Ekspor ke CSV
function exportToCSV() {
  const data = getFilteredPresensi();
  if (data.length === 0) {
    Swal.fire({ icon: 'info', title: 'Data Kosong', text: 'Tidak ada data presensi untuk diunduh.' });
    return;
  }

  const headers = ["No", "Tanggal", "Jam", "Nama Dosen", "Mata Kuliah", "Kode Kelas", "Nama Kelas", "Pertemuan", "Pelaksanaan", "Jumlah Mahasiswa", "Materi", "Keterangan"];
  const rows = data.map((item, idx) => [
    idx + 1,
    `"${item.tanggal}"`,
    `"${item.jam}"`,
    `"${(item.dosenNama || '').replace(/"/g, '""')}"`,
    `"${(item.matkulNama || '').replace(/"/g, '""')}"`,
    `"${item.kelas}"`,
    `"${(item.kelasLabel || '').replace(/"/g, '""')}"`,
    item.pertemuan,
    `"${item.pelaksanaan}"`,
    item.jumlahMhs,
    `"${(item.materi || '').replace(/"/g, '""')}"`,
    `"${(item.keterangan || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  const todayStr = new Date().toISOString().split('T')[0];
  link.setAttribute("download", `Presensi_Mengajar_Dosen_${todayStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  Swal.fire({
    icon: 'success',
    title: 'File CSV Berhasil Diunduh!',
    timer: 2000,
    showConfirmButton: false
  });
}

// ================= REKAPITULASI LAPORAN MENGAJAR DOSEN (1 BULAN) =================
const NAMA_BULAN = [
  "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

function openRekapCetakModal() {
  const modal = document.getElementById("modal-rekap-laporan");
  if (!modal) return;

  const yearSelect = document.getElementById("rekap-select-tahun");
  const monthSelect = document.getElementById("rekap-select-bulan");
  const dosenSelect = document.getElementById("rekap-select-dosen");

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12

  // Ambil list tahun dari data presensi
  const existingYears = new Set();
  existingYears.add(currentYear);
  AppState.presensiList.forEach(p => {
    if (p.tanggal) {
      const yr = parseInt(p.tanggal.split('-')[0], 10);
      if (!isNaN(yr)) existingYears.add(yr);
    }
  });

  const sortedYears = Array.from(existingYears).sort((a, b) => b - a);
  if (yearSelect) {
    yearSelect.innerHTML = sortedYears.map(y => `<option value="${y}">${y}</option>`).join('');
    yearSelect.value = currentYear;
  }

  if (monthSelect) {
    monthSelect.value = currentMonth;
  }

  // Populate dropdown filter dosen
  if (dosenSelect) {
    dosenSelect.innerHTML = '<option value="">Semua Dosen (Seluruhnya)</option>';
    AppState.dosenList.forEach(d => {
      const opt = document.createElement("option");
      opt.value = d.nama;
      opt.textContent = `${d.nama} ${d.nip ? '(' + d.nip + ')' : ''}`;
      dosenSelect.appendChild(opt);
    });
  }

  // Render laporan bulanan
  renderRekapLaporanBulanan();

  modal.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeRekapModal() {
  const modal = document.getElementById("modal-rekap-laporan");
  if (modal) {
    modal.classList.remove("open");
    document.body.style.overflow = "";
  }
}

function renderRekapLaporanBulanan() {
  const monthSelect = document.getElementById("rekap-select-bulan");
  const yearSelect = document.getElementById("rekap-select-tahun");
  const dosenSelect = document.getElementById("rekap-select-dosen");
  const formatSelect = document.getElementById("rekap-select-format");
  const container = document.getElementById("printable-paper-sheet");
  if (!container) return;

  const bulan = parseInt(monthSelect ? monthSelect.value : 9, 10);
  const tahun = parseInt(yearSelect ? yearSelect.value : new Date().getFullYear(), 10);
  const filterDosen = dosenSelect ? dosenSelect.value.trim() : "";
  const formatMode = formatSelect ? formatSelect.value : "lengkap";

  const namaBulan = NAMA_BULAN[bulan] || `Bulan ke-${bulan}`;
  const prefixBulan = `${tahun}-${String(bulan).padStart(2, '0')}`;

  // Filter presensi yang berada pada bulan & tahun tersebut
  let recordsBulan = AppState.presensiList.filter(p => p.tanggal && p.tanggal.startsWith(prefixBulan));

  if (filterDosen) {
    recordsBulan = recordsBulan.filter(p => p.dosenNama && p.dosenNama.trim().toLowerCase() === filterDosen.toLowerCase());
  }

  // Urutkan berdasarkan tanggal menaik lalu jam
  recordsBulan.sort((a, b) => (a.tanggal + a.jam).localeCompare(b.tanggal + b.jam));

  // Hitung Agregasi Rekap per Dosen
  // Map key: namaDosen + '___' + matkulNama + '___' + kelas
  const dosenAgregat = {};
  recordsBulan.forEach(r => {
    const key = `${r.dosenNama}___${r.matkulNama}___${r.kelas}`;
    if (!dosenAgregat[key]) {
      const masterDsn = AppState.dosenList.find(d => d.nama === r.dosenNama);
      dosenAgregat[key] = {
        dosenNama: r.dosenNama,
        nip: masterDsn ? masterDsn.nip : '-',
        status: masterDsn ? masterDsn.status : 'Tetap',
        matkulNama: r.matkulNama,
        kelas: r.kelas,
        kelasLabel: r.kelasLabel || KELAS_MAP[r.kelas] || r.kelas,
        totalPertemuan: 0,
        luringCount: 0,
        daringCount: 0,
        totalMhs: 0,
        pertemuanList: []
      };
    }
    dosenAgregat[key].totalPertemuan += 1;
    if (r.pelaksanaan === "Luring") dosenAgregat[key].luringCount += 1;
    else dosenAgregat[key].daringCount += 1;
    dosenAgregat[key].totalMhs += (Number(r.jumlahMhs) || 0);
    if (r.pertemuan) dosenAgregat[key].pertemuanList.push(r.pertemuan);
  });

  const agregatList = Object.values(dosenAgregat);
  const totalSesi = recordsBulan.length;
  const totalDosenAktif = new Set(recordsBulan.map(r => r.dosenNama)).size;
  const totalMhsSemua = recordsBulan.reduce((acc, c) => acc + (Number(c.jumlahMhs) || 0), 0);
  const totalLuring = recordsBulan.filter(r => r.pelaksanaan === "Luring").length;
  const totalDaring = recordsBulan.filter(r => r.pelaksanaan === "Daring").length;

  const now = new Date();
  const tglCetak = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  // Render HTML ke sheet
  let html = `
    <!-- KOP SURAT / HEADER RESMI -->
    <div class="kop-surat">
      <div class="kop-logo">
        <i class="fa-solid fa-graduation-cap"></i>
      </div>
      <div class="kop-text">
        <div class="kop-instansi">SISTEM INFORMASI AKADEMIK PERGURUAN TINGGI</div>
        <div class="kop-subinstansi">BAGIAN ADMINISTRASI AKADEMIK &amp; KEMAHASISWAAN (BAAK)</div>
        <div class="kop-alamat">Laporan Akuntabilitas Kinerja Pengajaran Dosen Terverifikasi Sistem</div>
      </div>
    </div>

    <!-- JUDUL LAPORAN -->
    <div class="laporan-title-block">
      <div class="laporan-title">REKAPITULASI LAPORAN PRESENSI MENGAJAR DOSEN</div>
      <div class="laporan-periode"><i class="fa-regular fa-calendar"></i> Periode: Bulan ${namaBulan.toUpperCase()} ${tahun}</div>
      ${filterDosen ? `<div style="margin-top:0.4rem; font-size:0.85rem; font-weight:700; color:#334155;">Dosen: ${escapeHtml(filterDosen)}</div>` : ''}
    </div>

    <!-- RINGKASAN INDIKATOR -->
    <div class="rekap-summary-boxes">
      <div class="rekap-box">
        <div class="rekap-box-val">${totalDosenAktif}</div>
        <div class="rekap-box-lbl">Dosen Mengajar</div>
      </div>
      <div class="rekap-box">
        <div class="rekap-box-val">${totalSesi}</div>
        <div class="rekap-box-lbl">Total Pertemuan / Sesi</div>
      </div>
      <div class="rekap-box">
        <div class="rekap-box-val">${totalLuring} / ${totalDaring}</div>
        <div class="rekap-box-lbl">Sesi Luring / Daring</div>
      </div>
      <div class="rekap-box">
        <div class="rekap-box-val">${totalMhsSemua}</div>
        <div class="rekap-box-lbl">Akumulasi Mahasiswa</div>
      </div>
    </div>
  `;

  if (recordsBulan.length === 0) {
    html += `
      <div style="text-align:center; padding:3rem 1rem; border:1px dashed #cbd5e1; border-radius:8px; background:#f8fafc; margin-bottom:2rem;">
        <i class="fa-solid fa-calendar-xmark" style="font-size:2.5rem; color:#94a3b8; margin-bottom:0.75rem;"></i>
        <div style="font-weight:700; font-size:1rem; color:#1e293b;">Tidak Ada Data Presensi pada Bulan ${namaBulan} ${tahun}</div>
        <div style="font-size:0.82rem; color:#64748b; margin-top:0.35rem;">Belum ada catatan presensi mengajar yang masuk pada periode bulan ini. Silakan pilih bulan lain di bagian atas.</div>
      </div>
    `;
  } else {
    // TABEL 1: REKAPITULASI DOSEN
    if (formatMode === "lengkap" || formatMode === "rekap") {
      html += `
        <div class="laporan-section-title">
          <i class="fa-solid fa-table-list" style="color:#2563eb;"></i>
          <strong>I. TABEL REKAPITULASI DOSEN MENGAJAR (BULAN ${namaBulan.toUpperCase()} ${tahun})</strong>
        </div>
        <table class="laporan-table">
          <thead>
            <tr>
              <th style="text-align:center; width:35px;">No</th>
              <th>Nama Dosen &amp; NIDN</th>
              <th>Mata Kuliah Diampu</th>
              <th style="text-align:center;">Kelas</th>
              <th style="text-align:center; width:90px;">Jml Pertemuan</th>
              <th style="text-align:center; width:90px;">Pelaksanaan</th>
              <th style="text-align:center; width:80px;">Total Mhs</th>
              <th style="text-align:center; width:90px;">Pertemuan Ke</th>
            </tr>
          </thead>
          <tbody>
            ${agregatList.map((item, idx) => `
              <tr>
                <td style="text-align:center; font-weight:600;">${idx + 1}</td>
                <td>
                  <strong>${escapeHtml(item.dosenNama)}</strong>
                  <div style="font-size:0.72rem; color:#64748b;">NIDN: ${escapeHtml(item.nip || '-')} | ${item.status}</div>
                </td>
                <td>${escapeHtml(item.matkulNama)}</td>
                <td style="text-align:center;">
                  <strong>${item.kelas}</strong>
                  <div style="font-size:0.7rem; color:#64748b;">${escapeHtml(item.kelasLabel)}</div>
                </td>
                <td style="text-align:center; font-weight:700; color:#1e40af;">
                  ${item.totalPertemuan}x
                </td>
                <td style="text-align:center; font-size:0.75rem;">
                  ${item.luringCount > 0 ? `<span>${item.luringCount} Luring</span>` : ''}
                  ${item.luringCount > 0 && item.daringCount > 0 ? '<br>' : ''}
                  ${item.daringCount > 0 ? `<span>${item.daringCount} Daring</span>` : ''}
                </td>
                <td style="text-align:center; font-weight:600;">${item.totalMhs}</td>
                <td style="text-align:center; font-size:0.75rem; color:#475569;">
                  Ke: ${item.pertemuanList.sort((a, b) => a - b).join(', ')}
                </td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="background:#f1f5f9; font-weight:700;">
              <td colspan="4" style="text-align:right;">TOTAL KESELURUHAN PERIODE ${namaBulan.toUpperCase()}:</td>
              <td style="text-align:center; color:#1e40af; font-size:0.9rem;">${totalSesi} Sesi</td>
              <td style="text-align:center; font-size:0.75rem;">${totalLuring} L / ${totalDaring} D</td>
              <td style="text-align:center;">${totalMhsSemua} Mhs</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      `;
    }

    // TABEL 2: RINCIAN LOG SESI MENGAJAR
    if (formatMode === "lengkap" || formatMode === "rincian") {
      html += `
        <div class="laporan-section-title" style="margin-top: ${formatMode === 'lengkap' ? '2rem' : '0'};">
          <i class="fa-solid fa-list-check" style="color:#2563eb;"></i>
          <strong>${formatMode === 'lengkap' ? 'II. ' : ''}RINCIAN CATATAN PRESENSI MENGAJAR SELURUHNYA</strong>
        </div>
        <table class="laporan-table">
          <thead>
            <tr>
              <th style="text-align:center; width:30px;">No</th>
              <th style="width:110px;">Tanggal &amp; Jam</th>
              <th>Nama Dosen</th>
              <th>Mata Kuliah</th>
              <th style="text-align:center; width:50px;">Kelas</th>
              <th style="text-align:center; width:45px;">Ke</th>
              <th>Pokok Bahasan / Materi</th>
              <th style="text-align:center; width:45px;">Mhs</th>
              <th style="text-align:center; width:65px;">Metode</th>
              <th>Keterangan</th>
            </tr>
          </thead>
          <tbody>
            ${recordsBulan.map((r, idx) => `
              <tr>
                <td style="text-align:center; font-weight:600;">${idx + 1}</td>
                <td>
                  <div style="font-weight:600;">${formatTanggalIndo(r.tanggal)}</div>
                  <div style="font-size:0.7rem; color:#64748b;">${escapeHtml(r.jam)}</div>
                </td>
                <td><strong>${escapeHtml(r.dosenNama)}</strong></td>
                <td>${escapeHtml(r.matkulNama)}</td>
                <td style="text-align:center;"><strong>${r.kelas}</strong></td>
                <td style="text-align:center; font-weight:700;">${r.pertemuan}</td>
                <td style="font-size:0.78rem;">${escapeHtml(r.materi)}</td>
                <td style="text-align:center; font-weight:600;">${r.jumlahMhs}</td>
                <td style="text-align:center; font-size:0.75rem;">
                  <span style="font-weight:600; color:${r.pelaksanaan === 'Luring' ? '#047857' : '#2563eb'}">${r.pelaksanaan}</span>
                </td>
                <td style="font-size:0.72rem; color:#475569;">${escapeHtml(r.keterangan || '-')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }
  }

  // LEMBAR PENGESAHAN / TANDA TANGAN RESMI
  html += `
    <div class="tanda-tangan-block">
      <div class="ttd-box">
        <div>Mengetahui,</div>
        <div style="font-weight:700; margin-top:0.2rem;">Ketua Program Studi</div>
        <div class="ttd-line">( .................................................... )</div>
        <div style="font-size:0.75rem; color:#64748b; margin-top:0.2rem;">NIDN. .........................................</div>
      </div>

      <div class="ttd-box">
        <div>Dicetak pada: ${tglCetak}</div>
        <div style="font-weight:700; margin-top:0.2rem;">Bagian Administrasi Akademik</div>
        <div class="ttd-line">( ${escapeHtml(AppState.currentUser?.name || 'Administrator Akademik')} )</div>
        <div style="font-size:0.75rem; color:#64748b; margin-top:0.2rem;">SIAKAD Presensi Mengajar Dosen</div>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

function printLaporanBulanan() {
  window.print();
}

// Ekspor Rekap Bulanan ke Excel (.xlsx) dengan SheetJS
function exportRekapExcelBulanan() {
  const monthSelect = document.getElementById("rekap-select-bulan");
  const yearSelect = document.getElementById("rekap-select-tahun");
  const dosenSelect = document.getElementById("rekap-select-dosen");

  const bulan = parseInt(monthSelect ? monthSelect.value : 9, 10);
  const tahun = parseInt(yearSelect ? yearSelect.value : new Date().getFullYear(), 10);
  const filterDosen = dosenSelect ? dosenSelect.value.trim() : "";
  const namaBulan = NAMA_BULAN[bulan] || `Bulan_${bulan}`;
  const prefixBulan = `${tahun}-${String(bulan).padStart(2, '0')}`;

  let records = AppState.presensiList.filter(p => p.tanggal && p.tanggal.startsWith(prefixBulan));
  if (filterDosen) {
    records = records.filter(p => p.dosenNama && p.dosenNama.trim().toLowerCase() === filterDosen.toLowerCase());
  }

  if (records.length === 0) {
    Swal.fire({ icon: 'info', title: 'Data Kosong', text: `Tidak ada data presensi pada bulan ${namaBulan} ${tahun} untuk diekspor.` });
    return;
  }

  records.sort((a, b) => (a.tanggal + a.jam).localeCompare(b.tanggal + b.jam));

  try {
    const workbook = XLSX.utils.book_new();

    // 1. Sheet Rekap Dosen
    const dosenAgregat = {};
    records.forEach(r => {
      const key = `${r.dosenNama}___${r.matkulNama}___${r.kelas}`;
      if (!dosenAgregat[key]) {
        const masterDsn = AppState.dosenList.find(d => d.nama === r.dosenNama);
        dosenAgregat[key] = {
          "Nama Dosen": r.dosenNama,
          "NIDN": masterDsn ? masterDsn.nip : "-",
          "Mata Kuliah": r.matkulNama,
          "Kelas": r.kelas,
          "Keterangan Kelas": r.kelasLabel || KELAS_MAP[r.kelas] || r.kelas,
          "Total Pertemuan (Bulan Ini)": 0,
          "Luring": 0,
          "Daring": 0,
          "Total Mahasiswa Hadir": 0,
          "Daftar Pertemuan Ke": []
        };
      }
      dosenAgregat[key]["Total Pertemuan (Bulan Ini)"] += 1;
      if (r.pelaksanaan === "Luring") dosenAgregat[key]["Luring"] += 1;
      else dosenAgregat[key]["Daring"] += 1;
      dosenAgregat[key]["Total Mahasiswa Hadir"] += (Number(r.jumlahMhs) || 0);
      if (r.pertemuan) dosenAgregat[key]["Daftar Pertemuan Ke"].push(r.pertemuan);
    });

    const sheetRekapData = Object.values(dosenAgregat).map((item, idx) => ({
      "No": idx + 1,
      "Nama Dosen": item["Nama Dosen"],
      "NIDN": item["NIDN"],
      "Mata Kuliah": item["Mata Kuliah"],
      "Kelas": item["Kelas"],
      "Keterangan Kelas": item["Keterangan Kelas"],
      "Total Pertemuan": item["Total Pertemuan (Bulan Ini)"],
      "Luring": item["Luring"],
      "Daring": item["Daring"],
      "Total Mahasiswa": item["Total Mahasiswa Hadir"],
      "Pertemuan Ke": item["Daftar Pertemuan Ke"].sort((a, b) => a - b).join(', ')
    }));

    const wsRekap = XLSX.utils.json_to_sheet(sheetRekapData);
    XLSX.utils.book_append_sheet(workbook, wsRekap, "Rekap Bulanan Dosen");

    // 2. Sheet Rincian Sesi Lengkap
    const sheetRincianData = records.map((r, idx) => ({
      "No": idx + 1,
      "Tanggal": r.tanggal,
      "Jam Perkuliahan": r.jam,
      "Nama Dosen": r.dosenNama,
      "Mata Kuliah": r.matkulNama,
      "Kode Kelas": r.kelas,
      "Nama Kelas": r.kelasLabel || KELAS_MAP[r.kelas] || r.kelas,
      "Pertemuan Ke": r.pertemuan,
      "Metode Pelaksanaan": r.pelaksanaan,
      "Jumlah Mahasiswa": r.jumlahMhs,
      "Materi Perkuliahan": r.materi,
      "Keterangan": r.keterangan || "-"
    }));

    const wsRincian = XLSX.utils.json_to_sheet(sheetRincianData);
    XLSX.utils.book_append_sheet(workbook, wsRincian, "Rincian Log Mengajar");

    const filename = `Rekap_Presensi_Dosen_${namaBulan}_${tahun}.xlsx`;
    XLSX.writeFile(workbook, filename);

    Swal.fire({
      icon: 'success',
      title: 'Rekap Bulanan Berhasil Diunduh!',
      text: `File tersimpan dengan nama: ${filename}`,
      timer: 2000,
      showConfirmButton: false
    });
  } catch (e) {
    console.error("Gagal export rekap bulanan:", e);
    Swal.fire({ icon: 'error', title: 'Gagal Mengunduh', text: 'Terjadi kendala saat mengekspor ke Excel.' });
  }
}

// Helper format tanggal Indonesia (YYYY-MM-DD -> DD Bulan YYYY)
function formatTanggalIndo(tglStr) {
  if (!tglStr) return "-";
  const parts = tglStr.split('-');
  if (parts.length !== 3) return tglStr;
  const blnIndex = parseInt(parts[1], 10);
  const blnNama = NAMA_BULAN[blnIndex] || parts[1];
  return `${parts[2]} ${blnNama} ${parts[0]}`;
}

// ================= KELOLA MASTER DATA DOSEN =================
function renderDosenTable() {
  const tbody = document.getElementById("table-dosen-body");
  if (!tbody) return;

  if (AppState.dosenList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">Belum ada data dosen. Silakan klik 'Tambah Dosen Baru'.</td></tr>`;
    return;
  }

  tbody.innerHTML = AppState.dosenList.map((d, index) => {
    // Hitung total jam/kehadiran dosen bersangkutan
    const countPresensi = AppState.presensiList.filter(p => p.dosenNama === d.nama).length;
    return `
      <tr>
        <td style="text-align:center; font-weight:600;">${index + 1}</td>
        <td><code>${escapeHtml(d.nip || '-')}</code></td>
        <td><strong>${escapeHtml(d.nama)}</strong></td>
        <td><span class="badge-pill" style="background:#e0f2fe; color:#0369a1;">${escapeHtml(d.status || 'Tetap')}</span></td>
        <td>
          <div style="font-weight:700; color:#1e293b;"><i class="fa-regular fa-user" style="color:#64748b;"></i> ${escapeHtml(d.username || '-')}</div>
          <div style="font-size:0.75rem; color:#64748b;">${escapeHtml(d.email || '-')}</div>
          <div style="margin-top:3px;">
            <span class="badge-pill" style="background:#fef3c7; color:#92400e; font-size:0.72rem;">
              <i class="fa-solid fa-key"></i> ${escapeHtml(d.password || 'dosen123')}
            </span>
          </div>
        </td>
        <td style="text-align:center;">
          <span class="badge-pill" style="background:#f1f5f9; color:#475569;">${countPresensi}x Mengajar</span>
        </td>
        <td style="text-align:center; white-space:nowrap;">
          <button class="btn btn-secondary btn-sm" onclick="openEditDosenModal('${d.id}')" title="Edit Akun & Data Dosen">
            <i class="fa-solid fa-user-pen"></i> Edit
          </button>
          <button class="btn btn-danger btn-sm" onclick="deleteDosenItem('${d.id}')" title="Hapus Dosen">
            <i class="fa-solid fa-trash-can"></i> Hapus
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

async function openAddDosenModal() {
  const { value: formValues } = await Swal.fire({
    title: 'Tambah Dosen & Buat Akun User',
    html: `
      <div style="text-align:left; font-size:0.875rem;">
        <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:6px; padding:0.65rem; margin-bottom:1rem; color:#1e40af; font-size:0.8rem;">
          <i class="fa-solid fa-circle-info"></i> User dosen yang dibuat di sini dapat langsung digunakan oleh dosen bersangkutan untuk login dan mengisi presensi.
        </div>

        <label style="font-weight:600; color:#334155; margin-bottom:3px; display:block;">Nama Lengkap & Gelar <span style="color:red">*</span></label>
        <input id="swal-dosen-nama" class="swal2-input" placeholder="Contoh: Dr. Ir. Ahmad Sudrajat, M.M." style="margin:0 0 0.85rem 0; width:100%; box-sizing:border-box;">
        
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; margin-bottom:0.85rem;">
          <div>
            <label style="font-weight:600; color:#334155; margin-bottom:3px; display:block;">NIDN / NIP</label>
            <input id="swal-dosen-nip" class="swal2-input" placeholder="19850101..." style="margin:0; width:100%; box-sizing:border-box;">
          </div>
          <div>
            <label style="font-weight:600; color:#334155; margin-bottom:3px; display:block;">Status Kepegawaian</label>
            <select id="swal-dosen-status" class="swal2-select" style="margin:0; width:100%; display:block;">
              <option value="Tetap">Dosen Tetap</option>
              <option value="Luar Biasa">Dosen Luar Biasa (LB)</option>
              <option value="Praktisi">Praktisi / Dosen Tamu</option>
            </select>
          </div>
        </div>

        <hr style="margin:0.75rem 0; border:none; border-top:1px solid #e2e8f0;">
        <div style="font-weight:700; color:#1e293b; margin-bottom:0.5rem;"><i class="fa-solid fa-id-card-clip"></i> Kredensial Akun Login Dosen:</div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; margin-bottom:0.85rem;">
          <div>
            <label style="font-weight:600; color:#334155; margin-bottom:3px; display:block;">Username Login <span style="color:red">*</span></label>
            <input id="swal-dosen-user" class="swal2-input" placeholder="Contoh: ahmad" style="margin:0; width:100%; box-sizing:border-box;">
          </div>
          <div>
            <label style="font-weight:600; color:#334155; margin-bottom:3px; display:block;">Kata Sandi (Password) <span style="color:red">*</span></label>
            <input id="swal-dosen-pass" class="swal2-input" value="dosen123" placeholder="Minimal 6 karakter" style="margin:0; width:100%; box-sizing:border-box;">
          </div>
        </div>

        <label style="font-weight:600; color:#334155; margin-bottom:3px; display:block;">Email Akun</label>
        <input id="swal-dosen-email" class="swal2-input" placeholder="ahmad@kampus.ac.id" style="margin:0; width:100%; box-sizing:border-box;">
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonColor: '#2563eb',
    confirmButtonText: '<i class="fa-solid fa-user-plus"></i> Simpan Dosen & Buat Akun',
    cancelButtonText: 'Batal',
    didOpen: () => {
      // Auto-generate username & email saat nama diketik
      const namaInput = document.getElementById('swal-dosen-nama');
      const userInput = document.getElementById('swal-dosen-user');
      const emailInput = document.getElementById('swal-dosen-email');
      namaInput.addEventListener('input', () => {
        if (!userInput.dataset.manual) {
          const firstWord = namaInput.value.trim().split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
          userInput.value = firstWord;
          emailInput.value = firstWord ? `${firstWord}@kampus.ac.id` : '';
        }
      });
      userInput.addEventListener('input', () => {
        userInput.dataset.manual = "true";
      });
    },
    preConfirm: () => {
      const nama = document.getElementById('swal-dosen-nama').value.trim();
      const nip = document.getElementById('swal-dosen-nip').value.trim();
      const status = document.getElementById('swal-dosen-status').value;
      const username = document.getElementById('swal-dosen-user').value.trim();
      const password = document.getElementById('swal-dosen-pass').value.trim();
      const email = document.getElementById('swal-dosen-email').value.trim();

      if (!nama) {
        Swal.showValidationMessage('Nama Dosen wajib diisi!');
        return false;
      }
      if (!username) {
        Swal.showValidationMessage('Username akun dosen wajib diisi!');
        return false;
      }
      if (!password) {
        Swal.showValidationMessage('Password akun dosen wajib diisi!');
        return false;
      }

      // Cek duplikasi username
      const isExist = AppState.dosenList.some(d => d.username?.toLowerCase() === username.toLowerCase());
      if (isExist) {
        Swal.showValidationMessage(`Username "${username}" sudah digunakan dosen lain!`);
        return false;
      }

      return {
        nama,
        nip,
        status,
        username,
        password,
        email: email || `${username}@kampus.ac.id`
      };
    }
  });

  if (formValues) {
    await window.dbService.addDosen(formValues);
    await loadMasterData();
    Swal.fire({
      icon: 'success',
      title: 'Dosen & Akun Berhasil Dibuat!',
      html: `
        Dosen <strong>${escapeHtml(formValues.nama)}</strong> telah didaftarkan.<br>
        Username: <code>${escapeHtml(formValues.username)}</code><br>
        Password: <code>${escapeHtml(formValues.password)}</code>
      `,
      confirmButtonColor: '#2563eb'
    });
  }
}

window.openEditDosenModal = async function(id) {
  const d = AppState.dosenList.find(item => item.id === id);
  if (!d) return;

  const { value: formValues } = await Swal.fire({
    title: 'Edit Data & Akun Dosen',
    html: `
      <div style="text-align:left; font-size:0.875rem;">
        <label style="font-weight:600; color:#334155; margin-bottom:3px; display:block;">Nama Lengkap & Gelar</label>
        <input id="swal-dosen-nama" class="swal2-input" value="${escapeHtml(d.nama)}" style="margin:0 0 0.85rem 0; width:100%; box-sizing:border-box;">
        
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; margin-bottom:0.85rem;">
          <div>
            <label style="font-weight:600; color:#334155; margin-bottom:3px; display:block;">NIDN / NIP</label>
            <input id="swal-dosen-nip" class="swal2-input" value="${escapeHtml(d.nip || '')}" style="margin:0; width:100%; box-sizing:border-box;">
          </div>
          <div>
            <label style="font-weight:600; color:#334155; margin-bottom:3px; display:block;">Status</label>
            <select id="swal-dosen-status" class="swal2-select" style="margin:0; width:100%; display:block;">
              <option value="Tetap" ${d.status === 'Tetap' ? 'selected' : ''}>Dosen Tetap</option>
              <option value="Luar Biasa" ${d.status === 'Luar Biasa' ? 'selected' : ''}>Dosen Luar Biasa (LB)</option>
              <option value="Praktisi" ${d.status === 'Praktisi' ? 'selected' : ''}>Praktisi / Dosen Tamu</option>
            </select>
          </div>
        </div>

        <hr style="margin:0.75rem 0; border:none; border-top:1px solid #e2e8f0;">
        <div style="font-weight:700; color:#1e293b; margin-bottom:0.5rem;"><i class="fa-solid fa-key"></i> Pengaturan Akun User Dosen:</div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; margin-bottom:0.85rem;">
          <div>
            <label style="font-weight:600; color:#334155; margin-bottom:3px; display:block;">Username Login</label>
            <input id="swal-dosen-user" class="swal2-input" value="${escapeHtml(d.username || '')}" style="margin:0; width:100%; box-sizing:border-box;">
          </div>
          <div>
            <label style="font-weight:600; color:#334155; margin-bottom:3px; display:block;">Kata Sandi (Password)</label>
            <input id="swal-dosen-pass" class="swal2-input" value="${escapeHtml(d.password || 'dosen123')}" style="margin:0; width:100%; box-sizing:border-box;">
          </div>
        </div>

        <label style="font-weight:600; color:#334155; margin-bottom:3px; display:block;">Email Akun</label>
        <input id="swal-dosen-email" class="swal2-input" value="${escapeHtml(d.email || '')}" style="margin:0; width:100%; box-sizing:border-box;">
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonColor: '#2563eb',
    confirmButtonText: 'Perbarui Data & Akun',
    cancelButtonText: 'Batal',
    preConfirm: () => {
      const nama = document.getElementById('swal-dosen-nama').value.trim();
      const nip = document.getElementById('swal-dosen-nip').value.trim();
      const status = document.getElementById('swal-dosen-status').value;
      const username = document.getElementById('swal-dosen-user').value.trim();
      const password = document.getElementById('swal-dosen-pass').value.trim();
      const email = document.getElementById('swal-dosen-email').value.trim();

      if (!nama) {
        Swal.showValidationMessage('Nama Dosen wajib diisi!');
        return false;
      }
      if (!username) {
        Swal.showValidationMessage('Username wajib diisi!');
        return false;
      }
      if (!password) {
        Swal.showValidationMessage('Password wajib diisi!');
        return false;
      }

      return {
        nama,
        nip,
        status,
        username,
        password,
        email: email || `${username}@kampus.ac.id`
      };
    }
  });

  if (formValues) {
    await window.dbService.updateDosen(id, formValues);
    await loadMasterData();
    // Jika dosen yang sedang login diedit sendiri, update sesinya
    if (AppState.currentUser && AppState.currentUser.dosenId === id) {
      AppState.currentUser = { ...AppState.currentUser, ...formValues };
      sessionStorage.setItem("presensi_user_session", JSON.stringify(AppState.currentUser));
      updateAuthUI();
    }
    Swal.fire({ icon: 'success', title: 'Data Dosen & Akun Diperbarui!', timer: 1500, showConfirmButton: false });
  }
};

// Modal Riwayat Presensi Saya Khusus Dosen yang sedang Login
window.openRiwayatPresensiDosen = function() {
  if (!AppState.currentUser || AppState.currentUser.role !== "dosen") {
    Swal.fire({ icon: 'info', title: 'Perhatian', text: 'Fitur ini hanya untuk dosen yang sedang login.' });
    return;
  }

  const myPresensi = AppState.presensiList.filter(p => p.dosenNama === AppState.currentUser.nama);
  
  const tableRows = myPresensi.length > 0
    ? myPresensi.map((p, idx) => `
        <tr>
          <td style="text-align:center;">${idx + 1}</td>
          <td><strong>${p.tanggal}</strong><br><small style="color:#64748b;">${p.jam}</small></td>
          <td>${escapeHtml(p.matkulNama)}</td>
          <td><span class="badge-pill badge-class">${p.kelas}</span></td>
          <td style="text-align:center;">Ke-${p.pertemuan}</td>
          <td><span class="badge-pill ${p.pelaksanaan === 'Luring' ? 'badge-luring' : 'badge-daring'}">${p.pelaksanaan}</span></td>
          <td>${p.jumlahMhs} Mhs</td>
        </tr>
      `).join('')
    : `<tr><td colspan="7" class="empty-state">Anda belum memiliki riwayat presensi mengajar.</td></tr>`;

  Swal.fire({
    title: `Riwayat Presensi: ${AppState.currentUser.nama}`,
    html: `
      <div style="text-align:left;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; padding:0.75rem; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0;">
          <div>
            <strong>NIDN/NIP:</strong> ${escapeHtml(AppState.currentUser.nip || '-')}<br>
            <strong>Total Pertemuan Terlaksana:</strong> ${myPresensi.length} kali
          </div>
          <button type="button" class="btn btn-success btn-sm" id="btn-export-personal-excel">
            <i class="fa-solid fa-file-excel"></i> Unduh Excel Saya
          </button>
        </div>
        <div style="max-height:300px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:6px;">
          <table class="modern-table" style="font-size:0.8rem;">
            <thead>
              <tr>
                <th>No</th>
                <th>Waktu</th>
                <th>Mata Kuliah</th>
                <th>Kelas</th>
                <th>Pertemuan</th>
                <th>Pelaksanaan</th>
                <th>Kehadiran</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </div>
      </div>
    `,
    width: '750px',
    didOpen: () => {
      document.getElementById('btn-export-personal-excel')?.addEventListener('click', () => {
        exportPersonalExcel(myPresensi);
      });
    },
    confirmButtonColor: '#2563eb',
    confirmButtonText: 'Tutup'
  });
};

function exportPersonalExcel(records) {
  if (!records || records.length === 0) {
    Swal.fire({ icon: 'info', title: 'Kosong', text: 'Tidak ada data untuk diunduh.' });
    return;
  }
  const formatted = records.map((item, idx) => ({
    "No": idx + 1,
    "Tanggal": item.tanggal,
    "Jam": item.jam,
    "Nama Dosen": item.dosenNama,
    "Mata Kuliah": item.matkulNama,
    "Kelas": `${item.kelas} (${item.kelasLabel})`,
    "Pertemuan": item.pertemuan,
    "Pelaksanaan": item.pelaksanaan,
    "Jumlah Mahasiswa": item.jumlahMhs,
    "Materi": item.materi,
    "Keterangan": item.keterangan || "-"
  }));
  const ws = XLSX.utils.json_to_sheet(formatted);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Presensi Saya");
  const filename = `Presensi_${AppState.currentUser.nama.split(' ')[0]}_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, filename);
}

window.deleteDosenItem = async function(id) {
  const d = AppState.dosenList.find(item => item.id === id);
  if (!d) return;

  const confirm = await Swal.fire({
    title: 'Hapus Dosen?',
    text: `Yakin ingin menghapus dosen "${d.nama}" dari sistem?`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    confirmButtonText: 'Ya, Hapus',
    cancelButtonText: 'Batal'
  });

  if (confirm.isConfirmed) {
    await window.dbService.deleteDosen(id);
    await loadMasterData();
    Swal.fire({ icon: 'success', title: 'Dosen Berhasil Dihapus', timer: 1500, showConfirmButton: false });
  }
};

// ================= KELOLA MASTER DATA MATA KULIAH =================
// ================= KELOLA MASTER DATA MATA KULIAH =================
function renderMatkulTable() {
  const tbody = document.getElementById("table-matkul-body");
  if (!tbody) return;

  if (AppState.matkulList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">Belum ada data mata kuliah. Silakan klik 'Tambah Mata Kuliah'.</td></tr>`;
    return;
  }

  tbody.innerHTML = AppState.matkulList.map((m, index) => `
    <tr>
      <td style="text-align:center; font-weight:600;">${index + 1}</td>
      <td><code>${escapeHtml(m.kode || '-')}</code></td>
      <td><strong>${escapeHtml(m.nama)}</strong></td>
      <td>
        <span class="badge-pill" style="background:#eff6ff; color:#1d4ed8; font-weight:600; font-size:0.8rem;">
          <i class="fa-solid fa-chalkboard-user"></i> ${escapeHtml(m.dosenNama || 'Belum Ditentukan')}
        </span>
      </td>
      <td style="text-align:center;"><span class="badge-pill" style="background:#fef3c7; color:#92400e;">${m.sks} SKS</span></td>
      <td style="text-align:center;">Semester ${m.semester || '-'}</td>
      <td style="text-align:center; white-space:nowrap;">
        <button class="btn btn-secondary btn-sm" onclick="openEditMatkulModal('${m.id}')" title="Edit Mata Kuliah">
          <i class="fa-solid fa-pen-to-square"></i> Edit
        </button>
        <button class="btn btn-danger btn-sm" onclick="deleteMatkulItem('${m.id}')" title="Hapus Mata Kuliah">
          <i class="fa-solid fa-trash-can"></i> Hapus
        </button>
      </td>
    </tr>
  `).join('');
}

async function openAddMatkulModal() {
  const { value: formValues } = await Swal.fire({
    title: 'Tambah Mata Kuliah & Pilih Dosen',
    html: `
      <div style="text-align:left; font-size:0.875rem;">
        <label style="font-weight:600; color:#334155; margin-bottom:4px; display:block;">Nama Mata Kuliah <span style="color:red">*</span></label>
        <input id="swal-mk-nama" class="swal2-input" placeholder="Contoh: Akuntansi Perpajakan" style="margin:0 0 0.85rem 0; width:100%; box-sizing:border-box;">
        
        <label style="font-weight:600; color:#334155; margin-bottom:4px; display:block;">Kode Mata Kuliah</label>
        <input id="swal-mk-kode" class="swal2-input" placeholder="Contoh: AKT-205" style="margin:0 0 0.85rem 0; width:100%; box-sizing:border-box;">
        
        <label style="font-weight:600; color:#334155; margin-bottom:4px; display:block;">Dosen Pengampu (Terdaftar) <span style="color:red">*</span></label>
        <select id="swal-mk-dosen" class="swal2-select" style="margin:0 0 0.85rem 0; width:100%; display:block;">
          <option value="">-- Pilih Dosen Pengampu --</option>
          ${AppState.dosenList.map(d => `<option value="${escapeHtml(d.nama)}">${escapeHtml(d.nama)} (${escapeHtml(d.status || 'Dosen')})</option>`).join('')}
        </select>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
          <div>
            <label style="font-weight:600; color:#334155; margin-bottom:4px; display:block;">Bobot SKS</label>
            <input type="number" id="swal-mk-sks" class="swal2-input" value="3" min="1" max="6" style="margin:0; width:100%; box-sizing:border-box;">
          </div>
          <div>
            <label style="font-weight:600; color:#334155; margin-bottom:4px; display:block;">Semester</label>
            <input type="number" id="swal-mk-sem" class="swal2-input" value="1" min="1" max="8" style="margin:0; width:100%; box-sizing:border-box;">
          </div>
        </div>
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonColor: '#2563eb',
    confirmButtonText: '<i class="fa-solid fa-plus"></i> Simpan Mata Kuliah',
    cancelButtonText: 'Batal',
    preConfirm: () => {
      const nama = document.getElementById('swal-mk-nama').value.trim();
      const kode = document.getElementById('swal-mk-kode').value.trim();
      const dosenNama = document.getElementById('swal-mk-dosen').value;
      const sks = document.getElementById('swal-mk-sks').value;
      const semester = document.getElementById('swal-mk-sem').value;
      
      if (!nama) {
        Swal.showValidationMessage('Nama Mata Kuliah wajib diisi!');
        return false;
      }
      if (!dosenNama) {
        Swal.showValidationMessage('Silakan pilih Dosen Pengampu mata kuliah!');
        return false;
      }
      return { nama, kode, dosenNama, sks: Number(sks) || 3, semester: Number(semester) || 1 };
    }
  });

  if (formValues) {
    await window.dbService.addMatkul(formValues);
    await loadMasterData();
    Swal.fire({ icon: 'success', title: 'Mata Kuliah Berhasil Ditambahkan!', timer: 1500, showConfirmButton: false });
  }
}

window.openEditMatkulModal = async function(id) {
  const m = AppState.matkulList.find(item => item.id === id);
  if (!m) return;

  const { value: formValues } = await Swal.fire({
    title: 'Edit Data Mata Kuliah',
    html: `
      <div style="text-align:left; font-size:0.875rem;">
        <label style="font-weight:600; color:#334155; margin-bottom:4px; display:block;">Nama Mata Kuliah</label>
        <input id="swal-mk-nama" class="swal2-input" value="${escapeHtml(m.nama)}" style="margin:0 0 0.85rem 0; width:100%; box-sizing:border-box;">
        
        <label style="font-weight:600; color:#334155; margin-bottom:4px; display:block;">Kode Mata Kuliah</label>
        <input id="swal-mk-kode" class="swal2-input" value="${escapeHtml(m.kode || '')}" style="margin:0 0 0.85rem 0; width:100%; box-sizing:border-box;">
        
        <label style="font-weight:600; color:#334155; margin-bottom:4px; display:block;">Dosen Pengampu</label>
        <select id="swal-mk-dosen" class="swal2-select" style="margin:0 0 0.85rem 0; width:100%; display:block;">
          <option value="">-- Pilih Dosen Pengampu --</option>
          ${AppState.dosenList.map(d => `<option value="${escapeHtml(d.nama)}" ${d.nama === m.dosenNama ? 'selected' : ''}>${escapeHtml(d.nama)}</option>`).join('')}
        </select>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
          <div>
            <label style="font-weight:600; color:#334155; margin-bottom:4px; display:block;">Bobot SKS</label>
            <input type="number" id="swal-mk-sks" class="swal2-input" value="${m.sks || 3}" min="1" max="6" style="margin:0; width:100%; box-sizing:border-box;">
          </div>
          <div>
            <label style="font-weight:600; color:#334155; margin-bottom:4px; display:block;">Semester</label>
            <input type="number" id="swal-mk-sem" class="swal2-input" value="${m.semester || 1}" min="1" max="8" style="margin:0; width:100%; box-sizing:border-box;">
          </div>
        </div>
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonColor: '#2563eb',
    confirmButtonText: 'Perbarui Data',
    cancelButtonText: 'Batal',
    preConfirm: () => {
      const nama = document.getElementById('swal-mk-nama').value.trim();
      const kode = document.getElementById('swal-mk-kode').value.trim();
      const dosenNama = document.getElementById('swal-mk-dosen').value;
      const sks = document.getElementById('swal-mk-sks').value;
      const semester = document.getElementById('swal-mk-sem').value;
      
      if (!nama) {
        Swal.showValidationMessage('Nama Mata Kuliah wajib diisi!');
        return false;
      }
      if (!dosenNama) {
        Swal.showValidationMessage('Silakan pilih Dosen Pengampu!');
        return false;
      }
      return { nama, kode, dosenNama, sks: Number(sks) || 3, semester: Number(semester) || 1 };
    }
  });

  if (formValues) {
    await window.dbService.updateMatkul(id, formValues);
    await loadMasterData();
    Swal.fire({ icon: 'success', title: 'Data Mata Kuliah Diperbarui!', timer: 1500, showConfirmButton: false });
  }
};

window.deleteMatkulItem = async function(id) {
  const m = AppState.matkulList.find(item => item.id === id);
  if (!m) return;

  const confirm = await Swal.fire({
    title: 'Hapus Mata Kuliah?',
    text: `Yakin ingin menghapus "${m.nama}"?`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    confirmButtonText: 'Ya, Hapus',
    cancelButtonText: 'Batal'
  });

  if (confirm.isConfirmed) {
    await window.dbService.deleteMatkul(id);
    await loadMasterData();
    Swal.fire({ icon: 'success', title: 'Mata Kuliah Berhasil Dihapus', timer: 1500, showConfirmButton: false });
  }
};

// ================= KONFIGURASI FIREBASE =================
function loadFirebaseConfigIntoForm() {
  const config = window.dbService.getSavedConfig();
  if (!config) return;
  document.getElementById("fb-apiKey").value = config.apiKey || "";
  document.getElementById("fb-authDomain").value = config.authDomain || "";
  document.getElementById("fb-projectId").value = config.projectId || "";
  document.getElementById("fb-storageBucket").value = config.storageBucket || "";
  document.getElementById("fb-messagingSenderId").value = config.messagingSenderId || "";
  document.getElementById("fb-appId").value = config.appId || "";
}

function handleFirebaseConfigSave(e) {
  e.preventDefault();

  // Proteksi hak akses: Admin Akademik dilarang mengubah API Key Firebase
  if (AppState.currentUser && AppState.currentUser.role === "admin_akademik") {
    Swal.fire({
      icon: 'error',
      title: 'Aksi Ditolak',
      html: 'Admin Akademik <strong>tidak memiliki hak akses</strong> untuk mengubah konfigurasi Firebase API Key!<br><small style="color:#64748b">Hanya Super Administrator yang berhak mengatur koneksi basis data cloud.</small>'
    });
    return;
  }

  const config = {
    apiKey: document.getElementById("fb-apiKey").value.trim(),
    authDomain: document.getElementById("fb-authDomain").value.trim(),
    projectId: document.getElementById("fb-projectId").value.trim(),
    storageBucket: document.getElementById("fb-storageBucket").value.trim(),
    messagingSenderId: document.getElementById("fb-messagingSenderId").value.trim(),
    appId: document.getElementById("fb-appId").value.trim()
  };

  const success = window.dbService.saveConfig(config);
  updateConnectionBadge();

  if (success) {
    Swal.fire({
      icon: 'success',
      title: 'Firebase Terhubung!',
      text: 'Aplikasi sekarang berhasil tersinkronisasi dengan Google Cloud Firestore & Firebase Auth.',
      confirmButtonColor: '#2563eb'
    });
    loadMasterData();
  } else {
    Swal.fire({
      icon: 'warning',
      title: 'Tersimpan (Mode Siaga)',
      text: 'Konfigurasi telah disimpan. Pastikan Anda telah membuat database Firestore di Firebase Console dan mengaktifkan Authentication jika diperlukan.'
    });
  }
}

function handleResetConfig() {
  // Proteksi hak akses
  if (AppState.currentUser && AppState.currentUser.role === "admin_akademik") {
    Swal.fire({
      icon: 'error',
      title: 'Aksi Ditolak',
      text: 'Admin Akademik tidak memiliki wewenang untuk mereset konfigurasi Firebase!'
    });
    return;
  }

  Swal.fire({
    title: 'Reset Konfigurasi Firebase?',
    text: 'Aplikasi akan kembali ke mode lokal bawaan (Local Storage).',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#f59e0b',
    confirmButtonText: 'Reset ke Default'
  }).then((r) => {
    if (r.isConfirmed) {
      localStorage.removeItem('presensi_firebase_config');
      window.location.reload();
    }
  });
}

// Utility: Escape HTML agar aman dari XSS
function escapeHtml(string) {
  if (!string) return '';
  return String(string)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
