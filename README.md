# Integration System — Client

Frontend aplikasi **Integration System** untuk pengelolaan data siswa, absensi, jadwal guru, penilaian, dan rekap nilai sekolah.

## Teknologi

- Angular 21
- TypeScript
- Angular Reactive Forms
- CSS/PostCSS
- Vercel untuk deployment

## Menjalankan secara lokal

### Prasyarat

- Node.js 20 atau lebih baru
- Backend berjalan di `http://localhost:3000`

### Instalasi dan start

```bash
npm install
npm start
```

Frontend tersedia di `http://localhost:4200`.

Request `/api/*` diteruskan oleh `proxy.conf.json` ke backend lokal `http://localhost:3000`.

Jalankan backend dari terminal lain:

```bash
cd ../server
npm run dev
```

Atau dari folder root:

```bash
npm run dev
```

## Build production

```bash
npm run build
```

Hasil build berada di `dist/client`.

## Deployment Vercel

Pastikan project sudah terhubung ke project frontend Vercel, lalu jalankan:

```bash
vercel --prod
```

Frontend menggunakan rewrite pada `vercel.json` agar request API diarahkan ke:

```text
https://be-alwildan.vercel.app/api/*
```

Backend harus memiliki `CLIENT_ORIGIN` berikut:

```text
https://fe-alwildan.vercel.app
```

## Role pengguna

### Admin Cabang

- Dashboard sekolah
- Data siswa
- Siswa nonaktif
- Absensi guru dan siswa
- Jadwal guru
- Master data
- Penilaian dan rekap nilai
- Approval tahap cabang untuk izin guru

### Admin Pusat

- Melihat pengajuan izin dari seluruh cabang
- Approval tahap pusat

### Guru

- Dashboard guru
- Data siswa sesuai penugasan
- Check-in dan check-out
- Pengajuan sakit, izin, atau tugas dengan bukti
- Jadwal mengajar
- Input nilai tugas dan ujian
- Input perilaku dan kehadiran siswa
- Rekap nilai sesuai mata pelajaran atau kelas wali

## Alur penilaian guru

1. Guru membuka menu **Penilaian Siswa**.
2. Guru memilih tab **Nilai tugas & ujian**, **Perilaku**, atau **Kehadiran**.
3. Pada nilai tugas dan ujian, guru membuat assessment dengan memilih jenis, semester, kelas, mata pelajaran, bobot, dan nilai maksimum.
4. Guru mengisi nilai siswa satu per satu atau mengunggah CSV.
5. Assessment disimpan sebagai `DRAFT` dan dapat diperiksa kembali.
6. Setelah seluruh siswa memiliki nilai, guru menerbitkan assessment menjadi `PUBLISHED`.
7. Nilai yang sudah `PUBLISHED` masuk ke rekap nilai dan tidak dapat diubah oleh guru.

Guru hanya dapat menilai kelas dan mata pelajaran yang menjadi penugasannya. Wali kelas dapat melihat nilai yang sudah diterbitkan oleh guru lain pada kelas walinya.

### Perhitungan rekap nilai

Semua assessment `PUBLISHED` seperti tugas, kuis, UTS, UAS, praktik, dan proyek dapat masuk rekap. Nilai akhir mata pelajaran dihitung menggunakan bobot assessment:

```text
jumlah (persentase nilai × bobot) ÷ jumlah bobot
```

Bobot final ditentukan otomatis berdasarkan jenis assessment: Tugas 18%, Kuis 9%, Praktik 13,5%, Proyek 13,5%, UTS 13,5%, dan UAS 22,5%. Total bobot akademik adalah 90%. Jika terdapat beberapa assessment dengan jenis yang sama, sistem menormalisasi bobot berdasarkan total assessment yang tersedia.

Rekap akhir juga memasukkan kehadiran siswa dengan bobot 10%; nilai akademik berbobot 90%. Persentase kehadiran dihitung dari catatan Hadir dan Terlambat dibandingkan seluruh catatan kehadiran yang tersedia.

## Alur absensi dan izin guru

- Check-in sebelum atau tepat pukul 07:15 → **Hadir**.
- Check-in setelah pukul 07:15 → **Terlambat**.
- Check-out sebelum pukul 17:00 → ditandai **Pulang cepat**.
- Hadir, terlambat, dan check-out langsung tercatat tanpa approval.
- Sakit, izin, dan tugas sekolah wajib menyertakan bukti.

Alur persetujuan izin:

```text
Guru mengajukan + bukti
  → Menunggu Admin Cabang
  → Disetujui Cabang
  → Menunggu Admin Pusat
  → Disetujui Pusat
  → Final
```

Jika ditolak pada tahap cabang atau pusat, guru dapat memperbaiki pengajuan dan mengirim ulang.

## Akun demo

Semua akun demo menggunakan password:

```text
Integration123!
```

Contoh akun:

```text
Admin Cabang : admin@integration.sch.id
Admin Pusat  : admin.pusat@integration.sch.id
Guru         : guru@integration.sch.id
```

## Troubleshooting

### Pesan “Permintaan tidak dapat diproses”

Pastikan backend lokal berjalan di port `3000`:

```bash
cd ../server
npm run dev
```

Jika menggunakan deployment, pastikan `CLIENT_ORIGIN` backend sama persis dengan domain frontend, tanpa tanda `/` di akhir.

### API gagal dari browser

- Periksa `proxy.conf.json` saat lokal.
- Periksa rewrite `vercel.json` saat production.
- Logout lalu login kembali setelah deployment.
- Lakukan hard refresh dengan `Ctrl + Shift + R`.
