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
    const isSeeded = localStorage.getItem('presensi_seed_done');
    if (!isSeeded) {
      if (localStorage.getItem('presensi_dosen_data') === null) {
        localStorage.setItem('presensi_dosen_data', JSON.stringify(INITIAL_DOSEN));
      }
      if (localStorage.getItem('presensi_matkul_data') === null) {
        localStorage.setItem('presensi_matkul_data', JSON.stringify(INITIAL_MATKUL));
      }
      if (localStorage.getItem('presensi_absen_records') === null) {
        localStorage.setItem('presensi_absen_records', JSON.stringify(INITIAL_PRESENSI));
      }
      localStorage.setItem('presensi_seed_done', 'true');
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

    if (this.isFirebaseReady && this.db) {
      try {
        const snap = await this.db.collection('dosen').get();
        if (!snap.empty) {
          const cloudData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          localStorage.setItem('presensi_dosen_data', JSON.stringify(cloudData));
          localStorage.setItem('presensi_cloud_dosen_seeded', 'true');
          return cloudData;
        } else {
          // Jika Firestore dosen masih kosong dan belum pernah di-seed
          const isCloudSeeded = localStorage.getItem('presensi_cloud_dosen_seeded');
          if (!isCloudSeeded && localData.length > 0) {
            await this.seedCollectionToFirestore('dosen', localData);
            localStorage.setItem('presensi_cloud_dosen_seeded', 'true');
            return localData;
          }
          // Kembalikan data lokal yang ada (jangan timpa paksa ke [])
          return localData;
        }
      } catch (err) {
        console.warn("Firestore error saat getDosen, fallback ke LocalStorage:", err);
      }
    }
    return localData;
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
    if (this.isFirebaseReady && this.db) {
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

    // Simpan ke LocalStorage sebagai cache lokal
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
      localStorage.setItem('presensi_cloud_dosen_seeded', 'true');
      this.notifyLocalSync();
      return newDosen;
    } catch (e) {
      return { id: docId, ...payload };
    }
  }

  async updateDosen(id, updatedData) {
    if (this.isFirebaseReady && this.db) {
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

  async deleteDosen(id, dosenObj = null) {
    // 1. Eksekusi Hapus dari LocalStorage terlebih dahulu (Instan & Pasti)
    try {
      const stored = localStorage.getItem('presensi_dosen_data');
      let list = stored ? JSON.parse(stored) : [];
      list = list.filter(d => {
        if (d.id === id) return false;
        if (dosenObj) {
          if (dosenObj.id && d.id === dosenObj.id) return false;
          if (dosenObj.username && d.username && d.username.trim().toLowerCase() === dosenObj.username.trim().toLowerCase()) return false;
          if (dosenObj.nama && d.nama && d.nama.trim().toLowerCase() === dosenObj.nama.trim().toLowerCase()) return false;
          if (dosenObj.nip && d.nip && d.nip.trim() === dosenObj.nip.trim()) return false;
          if (dosenObj.email && d.email && d.email.trim().toLowerCase() === dosenObj.email.trim().toLowerCase()) return false;
        }
        return true;
      });
      localStorage.setItem('presensi_dosen_data', JSON.stringify(list));
      this.notifyLocalSync();
    } catch (e) {
      console.warn("Error update local presensi_dosen_data saat deleteDosen:", e);
    }

    // 2. Eksekusi Hapus dari Cloud Firestore secara menyeluruh
    if (this.isFirebaseReady && this.db) {
      try {
        // Hapus langsung berdasarkan ID dokumen
        await this.db.collection('dosen').doc(id).delete().catch(() => {});

        // Cari dan bersihkan dokumen apapun yang identik di Firestore (menghindari duplikasi id/username)
        const snap = await this.db.collection('dosen').get();
        if (!snap.empty) {
          const deletePromises = [];
          snap.forEach(doc => {
            const data = doc.data();
            let shouldDelete = (doc.id === id);
            if (dosenObj) {
              if (dosenObj.id && doc.id === dosenObj.id) shouldDelete = true;
              if (dosenObj.username && data.username && data.username.trim().toLowerCase() === dosenObj.username.trim().toLowerCase()) shouldDelete = true;
              if (dosenObj.nama && data.nama && data.nama.trim().toLowerCase() === dosenObj.nama.trim().toLowerCase()) shouldDelete = true;
              if (dosenObj.nip && data.nip && data.nip.trim() === dosenObj.nip.trim()) shouldDelete = true;
              if (dosenObj.email && data.email && data.email.trim().toLowerCase() === dosenObj.email.trim().toLowerCase()) shouldDelete = true;
            }
            if (shouldDelete) {
              deletePromises.push(doc.ref.delete().catch(() => {}));
            }
          });
          if (deletePromises.length > 0) {
            await Promise.all(deletePromises);
          }
        }
      } catch (err) {
        console.warn("Firestore error saat deleteDosen:", err);
      }
    }

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

    if (this.isFirebaseReady && this.db) {
      try {
        const snap = await this.db.collection('matakuliah').orderBy('nama').get();
        if (!snap.empty) {
          const cloudData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          localStorage.setItem('presensi_matkul_data', JSON.stringify(cloudData));
          localStorage.setItem('presensi_cloud_matkul_seeded', 'true');
          return cloudData;
        } else {
          const isCloudSeeded = localStorage.getItem('presensi_cloud_matkul_seeded');
          if (!isCloudSeeded && localData.length > 0) {
            await this.seedCollectionToFirestore('matakuliah', localData);
            localStorage.setItem('presensi_cloud_matkul_seeded', 'true');
            return localData;
          }
          return localData;
        }
      } catch (err) {
        console.warn("Firestore error saat getMatkul, fallback ke LocalStorage:", err);
      }
    }
    return localData;
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
      localStorage.setItem('presensi_cloud_matkul_seeded', 'true');
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

  async deleteMatkul(id, matkulObj = null) {
    // 1. Eksekusi Hapus dari LocalStorage terlebih dahulu (Instan & Pasti)
    try {
      const stored = localStorage.getItem('presensi_matkul_data');
      let list = stored ? JSON.parse(stored) : [];
      list = list.filter(m => {
        if (m.id === id) return false;
        if (matkulObj) {
          if (matkulObj.id && m.id === matkulObj.id) return false;
          if (matkulObj.nama && m.nama && m.nama.trim().toLowerCase() === matkulObj.nama.trim().toLowerCase()) return false;
          if (matkulObj.kode && m.kode && m.kode.trim().toLowerCase() === matkulObj.kode.trim().toLowerCase()) return false;
        }
        return true;
      });
      localStorage.setItem('presensi_matkul_data', JSON.stringify(list));
      this.notifyLocalSync();
    } catch (e) {
      console.warn("Error update local presensi_matkul_data saat deleteMatkul:", e);
    }

    // 2. Eksekusi Hapus dari Cloud Firestore secara menyeluruh
    if (this.isFirebaseReady && this.db) {
      try {
        await this.db.collection('matakuliah').doc(id).delete().catch(() => {});

        const snap = await this.db.collection('matakuliah').get();
        if (!snap.empty) {
          const deletePromises = [];
          snap.forEach(doc => {
            const data = doc.data();
            let shouldDelete = (doc.id === id);
            if (matkulObj) {
              if (matkulObj.id && doc.id === matkulObj.id) shouldDelete = true;
              if (matkulObj.nama && data.nama && data.nama.trim().toLowerCase() === matkulObj.nama.trim().toLowerCase()) shouldDelete = true;
              if (matkulObj.kode && data.kode && data.kode.trim().toLowerCase() === matkulObj.kode.trim().toLowerCase()) shouldDelete = true;
            }
            if (shouldDelete) {
              deletePromises.push(doc.ref.delete().catch(() => {}));
            }
          });
          if (deletePromises.length > 0) {
            await Promise.all(deletePromises);
          }
        }
      } catch (err) {
        console.warn("Firestore error saat deleteMatkul:", err);
      }
    }

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

    if (this.isFirebaseReady && this.db) {
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
          localStorage.setItem('presensi_absen_records', JSON.stringify(cloudData));
          localStorage.setItem('presensi_cloud_presensi_seeded', 'true');
          return cloudData;
        } else {
          const isCloudSeeded = localStorage.getItem('presensi_cloud_presensi_seeded');
          if (!isCloudSeeded && localData.length > 0) {
            await this.seedCollectionToFirestore('presensi', localData);
            localStorage.setItem('presensi_cloud_presensi_seeded', 'true');
            return localData;
          }
          return localData;
        }
      } catch (err) {
        console.warn("Firestore error saat getPresensi, fallback ke LocalStorage:", err);
      }
    }
    return localData;
  }

  async addPresensi(record) {
    const payload = {
      ...record,
      createdAt: new Date().toISOString()
    };

    let docId = 'pres_' + Date.now();
    if (this.isFirebaseReady && this.db) {
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
      localStorage.setItem('presensi_cloud_presensi_seeded', 'true');
      this.notifyLocalSync();
    } catch (e) {
      console.warn("Gagal simpan presensi ke LocalStorage:", e);
    }
    return payload;
  }

  async deletePresensi(id) {
    // 1. Eksekusi Hapus dari LocalStorage terlebih dahulu (Instan & Pasti)
    try {
      const stored = localStorage.getItem('presensi_absen_records');
      let list = stored ? JSON.parse(stored) : [];
      list = list.filter(p => p.id !== id);
      localStorage.setItem('presensi_absen_records', JSON.stringify(list));
      this.notifyLocalSync();
    } catch (e) {
      console.warn("Error update local presensi_absen_records saat deletePresensi:", e);
    }

    // 2. Eksekusi Hapus dari Cloud Firestore
    if (this.isFirebaseReady && this.db) {
      try {
        await this.db.collection('presensi').doc(id).delete().catch(() => {});

        const snap = await this.db.collection('presensi').get();
        if (!snap.empty) {
          const deletePromises = [];
          snap.forEach(doc => {
            const d = doc.data();
            if (doc.id === id || (d && d.id === id)) {
              deletePromises.push(doc.ref.delete().catch(() => {}));
            }
          });
          if (deletePromises.length > 0) {
            await Promise.all(deletePromises);
          }
        }
      } catch (err) {
        console.warn("Firestore error saat deletePresensi:", err);
      }
    }

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

