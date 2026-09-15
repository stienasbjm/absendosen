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
      if (AppState.currentUser.role === "admin") {
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

  if (AppState.currentUser) {
    if (AppState.currentUser.role === "admin") {
      if (promptBanner) promptBanner.style.display = "none";
      if (loggedBanner) {
        loggedBanner.style.display = "flex";
        document.getElementById("logged-dosen-nama").textContent = AppState.currentUser.name || "Administrator";
        document.getElementById("logged-dosen-nip").textContent = "Super Admin";
      }
      if (formDosen) {
        formDosen.disabled = false;
        formDosen.classList.remove("locked-input");
      }
      if (lockedNotice) lockedNotice.style.display = "none";
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
  document.getElementById("btn-demo-login")?.addEventListener("click", fillDemoLogin);
  document.getElementById("btn-demo-login-dosen")?.addEventListener("click", fillDemoLoginDosen);
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
  document.getElementById("btn-print-presensi")?.addEventListener("click", () => window.print());

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
function handleAdminLogin(e) {
  e.preventDefault();
  const inputUser = document.getElementById("login-email").value.trim();
  const pass = document.getElementById("login-password").value;

  if (!inputUser || !pass) {
    Swal.fire({ icon: 'warning', title: 'Lengkapi Data', text: 'Username/Email dan Password wajib diisi!' });
    return;
  }

  const cleanInput = inputUser.toLowerCase();

  // 1. Cek apakah ini akun Admin (admin@kampus.ac.id / admin123)
  if ((cleanInput === "admin@kampus.ac.id" || cleanInput === "admin") && pass === "admin123") {
    loginWithDemoSession();
    return;
  }

  // 2. Cek apakah ini akun User Dosen di Master Data Dosen
  const dosenMatch = AppState.dosenList.find(d => 
    (d.username?.toLowerCase() === cleanInput || d.email?.toLowerCase() === cleanInput) &&
    (d.password === pass)
  );

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

  // 3. Jika Firebase Auth aktif, coba verifikasi ke Firebase Auth
  if (window.dbService.isFirebaseReady && window.dbService.auth && cleanInput.includes('@')) {
    Swal.fire({
      title: 'Memverifikasi Akun...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    window.dbService.auth.signInWithEmailAndPassword(inputUser, pass)
      .then((userCredential) => {
        const user = userCredential.user;
        AppState.currentUser = { email: user.email, uid: user.uid, role: "admin" };
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
          html: 'Username/Email atau password salah!<br><small style="color:#64748b">Pastikan akun Anda sudah didaftarkan oleh admin di menu Kelola Dosen.</small>'
        });
      });
    return;
  }

  // Gagal login
  Swal.fire({
    icon: 'error',
    title: 'Login Gagal',
    html: 'Username/Email atau password tidak cocok!<br><small style="color:#64748b">Dosen: Gunakan akun yang dibuatkan admin (misal: <code>hendra</code> / <code>dosen123</code>).<br>Admin: <code>admin@kampus.ac.id</code> / <code>admin123</code></small>'
  });
}

function loginWithDemoSession() {
  AppState.currentUser = { email: "admin@kampus.ac.id", role: "admin", name: "Administrator Kampus" };
  sessionStorage.setItem("presensi_user_session", JSON.stringify(AppState.currentUser));
  updateAuthUI();
  Swal.fire({
    icon: 'success',
    title: 'Login Berhasil (Akun Admin)',
    timer: 1200,
    showConfirmButton: false
  });
  showView("view-admin-dashboard");
  switchAdminTab("tab-dashboard");
}

function fillDemoLogin() {
  document.getElementById("login-email").value = "admin@kampus.ac.id";
  document.getElementById("login-password").value = "admin123";
  Swal.fire({
    toast: true,
    position: 'top-end',
    icon: 'info',
    title: 'Akun demo admin telah diisikan',
    showConfirmButton: false,
    timer: 2000
  });
}

function fillDemoLoginDosen() {
  document.getElementById("login-email").value = "hendra";
  document.getElementById("login-password").value = "dosen123";
  Swal.fire({
    toast: true,
    position: 'top-end',
    icon: 'info',
    title: 'Akun demo dosen (Dr. Hendra) telah diisikan',
    showConfirmButton: false,
    timer: 2000
  });
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
