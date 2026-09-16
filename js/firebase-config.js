/**
 * Firebase Configuration & Storage Service
 * Mendukung Cloud Firestore & Realtime Fallback (Local Storage)
 * sehingga webapp dapat langsung digunakan/diuji coba di Google Sites
 */

// Konfigurasi Default Firebase (Langsung terhubung ke proyek absen-dosen-ab081)
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDx_qqs6G6WOXEitaBzn71G8BOJZWEq0xY",
  authDomain: "absen-dosen-ab081.firebaseapp.com",
  projectId: "absen-dosen-ab081",
  storageBucket: "absen-dosen-ab081.firebasestorage.app",
  messagingSenderId: "734074860417",
  appId: "1:734074860417:web:3b08a38b951b4c06abae80"
};

// Data Awal (Seed Data) jika menggunakan Local Storage
const INITIAL_DOSEN = [
  { id: "dsn_1", nip: "198507122010121001", nama: "Dr. Hendra Wijaya, S.E., M.Ak.", status: "Tetap", username: "hendra", email: "hendra@kampus.ac.id", password: "dosen123" },
  { id: "dsn_2", nip: "198803152015042002", nama: "Siti Rahmawati, S.E., M.M.", status: "Tetap", username: "siti", email: "siti@kampus.ac.id", password: "dosen123" },
  { id: "dsn_3", nip: "199011202019031003", nama: "Budi Santoso, S.Kom., M.M.S.I.", status: "Luar Biasa", username: "budi", email: "budi@kampus.ac.id", password: "dosen123" },
  { id: "dsn_4", nip: "198205092008122001", nama: "Prof. Dr. Ir. Agus Pratama, M.B.A.", status: "Tetap", username: "agus", email: "agus@kampus.ac.id", password: "dosen123" },
  { id: "dsn_5", nip: "199201042022032005", nama: "Dewi Anggraini, S.E., M.Sc.", status: "Luar Biasa", username: "dewi", email: "dewi@kampus.ac.id", password: "dosen123" }
];

const INITIAL_MATKUL = [
  { id: "mk_1", kode: "AKT-101", nama: "Pengantar Akuntansi I", sks: 3, semester: 1, dosenNama: "Dr. Hendra Wijaya, S.E., M.Ak." },
  { id: "mk_2", kode: "MNJ-204", nama: "Manajemen Keuangan", sks: 3, semester: 3, dosenNama: "Siti Rahmawati, S.E., M.M." },
  { id: "mk_3", kode: "AKT-305", nama: "Akuntansi Biaya", sks: 3, semester: 3, dosenNama: "Dr. Hendra Wijaya, S.E., M.Ak." },
  { id: "mk_4", kode: "MNJ-302", nama: "Manajemen Pemasaran", sks: 3, semester: 3, dosenNama: "Siti Rahmawati, S.E., M.M." },
  { id: "mk_5", kode: "AKT-401", nama: "Sistem Informasi Akuntansi", sks: 3, semester: 5, dosenNama: "Budi Santoso, S.Kom., M.M.S.I." },
  { id: "mk_6", kode: "MNJ-405", nama: "Perilaku Organisasi", sks: 2, semester: 5, dosenNama: "Prof. Dr. Ir. Agus Pratama, M.B.A." }
];

const INITIAL_PRESENSI = [
  {
    id: "pres_1",
    dosenNama: "Dr. Hendra Wijaya, S.E., M.Ak.",
    matkulNama: "Pengantar Akuntansi I",
    kelas: "A",
    kelasLabel: "Kelas Akuntansi pagi",
    tanggal: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    jam: "08:00 - 10:30",
    pertemuan: 4,
    materi: "Jurnal Penyesuaian dan Neraca Lajur Perusahaan Jasa",
    jumlahMhs: 34,
    pelaksanaan: "Luring",
    keterangan: "Ruang Lab Akuntansi 201, mahasiswa aktif berdiskusi",
    createdAt: new Date(Date.now() - 86400000).toISOString()
  },
  {
    id: "pres_2",
    dosenNama: "Siti Rahmawati, S.E., M.M.",
    matkulNama: "Manajemen Keuangan",
    kelas: "B",
    kelasLabel: "Kelas Manajemen pagi",
    tanggal: new Date().toISOString().split('T')[0],
    jam: "10:30 - 13:00",
    pertemuan: 5,
    materi: "Analisis Rasio Keuangan dan Arus Kas Perusahaan",
    jumlahMhs: 38,
    pelaksanaan: "Luring",
    keterangan: "Ruang 304 Gedung B",
    createdAt: new Date().toISOString()
  },
  {
    id: "pres_3",
    dosenNama: "Budi Santoso, S.Kom., M.M.S.I.",
    matkulNama: "Sistem Informasi Akuntansi",
    kelas: "C",
    kelasLabel: "Kelas Akuntansi malam",
    tanggal: new Date().toISOString().split('T')[0],
    jam: "18:30 - 21:00",
    pertemuan: 5,
    materi: "Perancangan Database Relasional dan Siklus Penggajian",
    jumlahMhs: 29,
    pelaksanaan: "Daring",
    keterangan: "Via Google Meet & Praktikum Online",
    createdAt: new Date().toISOString()
  }
];

class DataService {
  constructor() {
    this.isFirebaseReady = false;
    this.firebaseApp = null;
    this.db = null;
    this.auth = null;
    this.init();
  }

  // Ambil Konfigurasi Firebase dari localStorage jika sudah disimpan
  getSavedConfig() {
    try {
      const saved = localStorage.getItem('presensi_firebase_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.apiKey && parsed.apiKey.trim().length > 5) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn("Gagal membaca saved firebase config", e);
    }
    return DEFAULT_FIREBASE_CONFIG;
  }

  saveConfig(config) {
    localStorage.setItem('presensi_firebase_config', JSON.stringify(config));
    return this.initFirebase(config);
  }

  init() {
    this.initLocalStorageSeed();
    const config = this.getSavedConfig();
    if (config && config.apiKey && config.projectId) {
      localStorage.setItem('presensi_firebase_config', JSON.stringify(config));
      this.initFirebase(config);
    } else {
      console.log("ℹ️ Berjalan dalam mode LocalStorage (Offline / Demo Ready).");
    }
  }

  initFirebase(config) {
    try {
      if (!window.firebase) {
        console.warn("Firebase SDK tidak termuat.");
        return false;
      }
      if (firebase.apps.length > 0) {
        firebase.app().delete();
      }
      this.firebaseApp = firebase.initializeApp(config);
      this.db = firebase.firestore();
      this.auth = firebase.auth();
      this.isFirebaseReady = true;
      console.log("✅ Firebase Firestore berhasil diinisialisasi.");
      return true;
    } catch (err) {
      console.error("Gagal menginisialisasi Firebase:", err);
      this.isFirebaseReady = false;
      return false;
    }
  }

  initLocalStorageSeed() {
    const existingDosen = localStorage.getItem('presensi_dosen_data');
    if (!existingDosen) {
      localStorage.setItem('presensi_dosen_data', JSON.stringify(INITIAL_DOSEN));
    } else {
      // Pastikan data dosen yang ada memiliki kredensial username & password
      try {
        const parsed = JSON.parse(existingDosen);
        let updated = false;
        parsed.forEach((d, idx) => {
          if (!d.username || !d.password) {
            const seed = INITIAL_DOSEN[idx] || {};
            d.username = d.username || seed.username || (d.nama.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '') + (idx+1));
            d.email = d.email || seed.email || `${d.username}@kampus.ac.id`;
            d.password = d.password || seed.password || 'dosen123';
            updated = true;
          }
        });
        if (updated) {
          localStorage.setItem('presensi_dosen_data', JSON.stringify(parsed));
        }
      } catch (e) {
        localStorage.setItem('presensi_dosen_data', JSON.stringify(INITIAL_DOSEN));
      }
    }

    const existingMatkul = localStorage.getItem('presensi_matkul_data');
    if (!existingMatkul) {
      localStorage.setItem('presensi_matkul_data', JSON.stringify(INITIAL_MATKUL));
    } else {
      try {
        const parsedMk = JSON.parse(existingMatkul);
        let updatedMk = false;
        parsedMk.forEach((m, idx) => {
          if (!m.dosenNama) {
            const seed = INITIAL_MATKUL[idx] || {};
            m.dosenNama = seed.dosenNama || "Dr. Hendra Wijaya, S.E., M.Ak.";
            updatedMk = true;
          }
        });
        if (updatedMk) {
          localStorage.setItem('presensi_matkul_data', JSON.stringify(parsedMk));
        }
      } catch (e) {
        localStorage.setItem('presensi_matkul_data', JSON.stringify(INITIAL_MATKUL));
      }
    }

    if (!localStorage.getItem('presensi_absen_records')) {
      localStorage.setItem('presensi_absen_records', JSON.stringify(INITIAL_PRESENSI));
    }
  }

  // ================= CRUD DOSEN =================
  async getDosen() {
    let localData = [];
    try {
      const data = localStorage.getItem('presensi_dosen_data');
      if (data) localData = JSON.parse(data);
    } catch (e) {
      console.warn("Gagal membaca localStorage presensi_dosen_data", e);
    }

    if (this.isFirebaseReady) {
      try {
        const snap = await this.db.collection('dosen').get();
        if (!snap.empty) {
          const cloudData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          
          // Gabungkan cloudData dan localData tanpa duplikasi
          const map = new Map();
          localData.forEach(d => {
            const key = (d.username || d.id || d.nama || '').trim().toLowerCase();
            if (key) map.set(key, d);
          });
          cloudData.forEach(d => {
            const key = (d.username || d.id || d.nama || '').trim().toLowerCase();
            if (key) map.set(key, d);
          });

          const merged = Array.from(map.values());
          localStorage.setItem('presensi_dosen_data', JSON.stringify(merged));
          return merged;
        }
      } catch (err) {
        console.warn("Firestore error saat getDosen, fallback ke LocalStorage:", err);
      }
    }
    return localData.length > 0 ? localData : INITIAL_DOSEN;
  }

  async addDosen(dosen) {
    const payload = {
      nip: (dosen.nip || '').trim(),
      nama: (dosen.nama || '').trim(),
      status: dosen.status || 'Tetap',
      username: (dosen.username || dosen.nama.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '')).trim(),
      email: (dosen.email || `${dosen.username || 'dosen'}@kampus.ac.id`).trim(),
      password: (dosen.password || 'dosen123').trim()
    };

    let docId = 'dsn_' + Date.now();
    if (this.isFirebaseReady) {
      try {
        const docRef = await this.db.collection('dosen').add({
          ...payload,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        if (docRef && docRef.id) {
          docId = docRef.id;
        }
      } catch (err) {
        console.warn("Firestore error saat addDosen, fallback ke local:", err);
      }
    }

    // Selalu simpan juga ke LocalStorage agar akun baru langsung siap login kapan pun
    try {
      const stored = localStorage.getItem('presensi_dosen_data');
      let list = stored ? JSON.parse(stored) : [];
      const newDosen = { id: docId, ...payload };
      const idx = list.findIndex(d => 
        (d.id === docId) || 
        (d.username && d.username.toLowerCase() === payload.username.toLowerCase())
      );
      if (idx !== -1) {
        list[idx] = newDosen;
      } else {
        list.unshift(newDosen);
      }
      localStorage.setItem('presensi_dosen_data', JSON.stringify(list));
      this.notifyLocalSync();
      return newDosen;
    } catch (e) {
      return { id: docId, ...payload };
    }
  }

  async updateDosen(id, updatedData) {
    if (this.isFirebaseReady) {
      try {
        await this.db.collection('dosen').doc(id).update(updatedData);
      } catch (err) {
        console.warn("Firestore error saat updateDosen:", err);
      }
    }
    try {
      const stored = localStorage.getItem('presensi_dosen_data');
      let list = stored ? JSON.parse(stored) : [];
      const idx = list.findIndex(d => d.id === id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...updatedData };
        localStorage.setItem('presensi_dosen_data', JSON.stringify(list));
        this.notifyLocalSync();
      }
    } catch (e) {}
    return true;
  }

  async deleteDosen(id) {
    if (this.isFirebaseReady) {
      try {
        await this.db.collection('dosen').doc(id).delete();
      } catch (err) {
        console.warn("Firestore error saat deleteDosen:", err);
      }
    }
    try {
      const stored = localStorage.getItem('presensi_dosen_data');
      let list = stored ? JSON.parse(stored) : [];
      list = list.filter(d => d.id !== id);
      localStorage.setItem('presensi_dosen_data', JSON.stringify(list));
      this.notifyLocalSync();
    } catch (e) {}
    return true;
  }

  // ================= CRUD MATA KULIAH =================
  async getMatkul() {
    let localData = [];
    try {
      const data = localStorage.getItem('presensi_matkul_data');
      if (data) localData = JSON.parse(data);
    } catch (e) {
      console.warn("Gagal membaca localStorage presensi_matkul_data", e);
    }

    if (this.isFirebaseReady) {
      try {
        const snap = await this.db.collection('matakuliah').orderBy('nama').get();
        if (!snap.empty) {
          const cloudData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

          // Gabungkan cloudData dan localData tanpa duplikasi
          const map = new Map();
          localData.forEach(m => {
            const key = (m.id || m.kode || m.nama || '').trim().toLowerCase();
            if (key) map.set(key, m);
          });
          cloudData.forEach(m => {
            const key = (m.id || m.kode || m.nama || '').trim().toLowerCase();
            if (key) map.set(key, m);
          });

          const merged = Array.from(map.values());
          localStorage.setItem('presensi_matkul_data', JSON.stringify(merged));
          return merged;
        } else if (localData.length > 0) {
          this.seedCollectionToFirestore('matakuliah', localData).catch(() => {});
        }
      } catch (err) {
        console.warn("Firestore error saat getMatkul, fallback ke LocalStorage:", err);
      }
    }
    return localData.length > 0 ? localData : INITIAL_MATKUL;
  }

  async addMatkul(matkul) {
    const payload = {
      kode: (matkul.kode || '').trim(),
      nama: (matkul.nama || '').trim(),
      sks: Number(matkul.sks) || 3,
      semester: Number(matkul.semester) || 1,
      dosenNama: (matkul.dosenNama || '').trim()
    };

    let docId = 'mk_' + Date.now();
    if (this.isFirebaseReady) {
      try {
        const docRef = await this.db.collection('matakuliah').add({
          ...payload,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        if (docRef && docRef.id) docId = docRef.id;
      } catch (err) {
        console.warn("Firestore error saat addMatkul, fallback ke local:", err);
      }
    }

    try {
      const stored = localStorage.getItem('presensi_matkul_data');
      let list = stored ? JSON.parse(stored) : [];
      const newMatkul = { id: docId, ...payload };
      const idx = list.findIndex(m => m.id === docId || (m.nama.toLowerCase() === payload.nama.toLowerCase() && m.kode.toLowerCase() === payload.kode.toLowerCase()));
      if (idx !== -1) {
        list[idx] = newMatkul;
      } else {
        list.unshift(newMatkul);
      }
      localStorage.setItem('presensi_matkul_data', JSON.stringify(list));
      this.notifyLocalSync();
      return newMatkul;
    } catch (e) {
      return { id: docId, ...payload };
    }
  }

  async updateMatkul(id, updatedData) {
    if (this.isFirebaseReady) {
      try {
        await this.db.collection('matakuliah').doc(id).update(updatedData);
      } catch (err) {
        console.warn("Firestore error saat updateMatkul:", err);
      }
    }
    try {
      const stored = localStorage.getItem('presensi_matkul_data');
      let list = stored ? JSON.parse(stored) : [];
      const idx = list.findIndex(m => m.id === id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...updatedData };
        localStorage.setItem('presensi_matkul_data', JSON.stringify(list));
        this.notifyLocalSync();
      }
    } catch (e) {}
    return true;
  }

  async deleteMatkul(id) {
    if (this.isFirebaseReady) {
      try {
        await this.db.collection('matakuliah').doc(id).delete();
      } catch (err) {
        console.warn("Firestore error saat deleteMatkul:", err);
      }
    }
    try {
      const stored = localStorage.getItem('presensi_matkul_data');
      let list = stored ? JSON.parse(stored) : [];
      list = list.filter(m => m.id !== id);
      localStorage.setItem('presensi_matkul_data', JSON.stringify(list));
      this.notifyLocalSync();
    } catch (e) {}
    return true;
  }

  // ================= CRUD PRESENSI =================
  async getPresensi() {
    let localData = [];
    try {
      const data = localStorage.getItem('presensi_absen_records');
      if (data) localData = JSON.parse(data);
    } catch (e) {
      console.warn("Gagal membaca localStorage presensi_absen_records", e);
    }

    if (this.isFirebaseReady) {
      try {
        const snap = await this.db.collection('presensi').orderBy('createdAt', 'desc').get();
        if (!snap.empty) {
          const cloudData = snap.docs.map(doc => {
            const d = doc.data();
            return {
              id: doc.id,
              ...d,
              createdAt: d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : (d.createdAt || new Date().toISOString())
            };
          });

          // Merge cloudData dan localData tanpa duplikasi id
          const map = new Map();
          localData.forEach(p => {
            if (p && p.id) map.set(p.id, p);
          });
          cloudData.forEach(p => {
            if (p && p.id) map.set(p.id, p);
          });

          const merged = Array.from(map.values()).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
          localStorage.setItem('presensi_absen_records', JSON.stringify(merged));
          return merged;
        } else if (localData.length > 0) {
          this.seedCollectionToFirestore('presensi', localData).catch(() => {});
        }
      } catch (err) {
        console.warn("Firestore error saat getPresensi, fallback ke LocalStorage:", err);
      }
    }
    return localData.length > 0 ? localData : INITIAL_PRESENSI;
  }

  async addPresensi(record) {
    const payload = {
      ...record,
      createdAt: new Date().toISOString()
    };

    let docId = 'pres_' + Date.now();
    if (this.isFirebaseReady) {
      try {
        const docRef = await this.db.collection('presensi').add({
          ...record,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        if (docRef && docRef.id) docId = docRef.id;
      } catch (err) {
        console.warn("Firestore error saat addPresensi:", err);
      }
    }

    payload.id = docId;

    try {
      const stored = localStorage.getItem('presensi_absen_records');
      let list = stored ? JSON.parse(stored) : [];
      list = list.filter(p => p.id !== docId);
      list.unshift(payload);
      localStorage.setItem('presensi_absen_records', JSON.stringify(list));
      this.notifyLocalSync();
    } catch (e) {
      console.warn("Gagal simpan presensi ke LocalStorage:", e);
    }
    return payload;
  }

  async deletePresensi(id) {
    if (this.isFirebaseReady) {
      try {
        await this.db.collection('presensi').doc(id).delete();
      } catch (err) {
        console.warn("Firestore error saat deletePresensi:", err);
      }
    }
    try {
      const stored = localStorage.getItem('presensi_absen_records');
      let list = stored ? JSON.parse(stored) : [];
      list = list.filter(p => p.id !== id);
      localStorage.setItem('presensi_absen_records', JSON.stringify(list));
      this.notifyLocalSync();
    } catch (e) {}
    return true;
  }

  // ================= SINKRONISASI BANTUAN =================
  notifyLocalSync() {
    try {
      localStorage.setItem('presensi_sync_signal', Date.now().toString());
    } catch (e) {}
  }

  async seedCollectionToFirestore(colName, items) {
    if (!this.isFirebaseReady || !this.db || !Array.isArray(items)) return;
    try {
      const batch = this.db.batch();
      items.forEach(item => {
        const docId = item.id || (colName.slice(0, 3) + '_' + Date.now());
        const docRef = this.db.collection(colName).doc(docId);
        const data = { ...item };
        delete data.id;
        batch.set(docRef, data, { merge: true });
      });
      await batch.commit();
      console.log(`✅ Koleksi '${colName}' berhasil di-sync ke Cloud Firestore.`);
    } catch (err) {
      console.warn(`Gagal seed '${colName}' ke Firestore:`, err);
    }
  }

  setupRealtimeListeners(callback) {
    if (!this.isFirebaseReady || !this.db) return () => {};
    const unsubs = [];
    try {
      const unsubPresensi = this.db.collection('presensi').onSnapshot(() => {
        if (typeof callback === 'function') callback('presensi');
      }, err => console.warn("Realtime presensi err:", err));
      unsubs.push(unsubPresensi);

      const unsubDosen = this.db.collection('dosen').onSnapshot(() => {
        if (typeof callback === 'function') callback('dosen');
      }, err => console.warn("Realtime dosen err:", err));
      unsubs.push(unsubDosen);

      const unsubMatkul = this.db.collection('matakuliah').onSnapshot(() => {
        if (typeof callback === 'function') callback('matakuliah');
      }, err => console.warn("Realtime matakuliah err:", err));
      unsubs.push(unsubMatkul);
    } catch (e) {
      console.warn("Gagal inisialisasi realtime listener:", e);
    }
    return () => unsubs.forEach(u => typeof u === 'function' && u());
  }

  async syncAllCollections() {
    const dosen = await this.getDosen();
    const matkul = await this.getMatkul();
    const presensi = await this.getPresensi();
    this.notifyLocalSync();
    return { dosen, matkul, presensi };
  }
}

// Instance tunggal service
window.dbService = new DataService();

