# Sertikom Mahasiswa v2.0

Aplikasi web Sertifikasi Mahasiswa dengan fitur lengkap:

## Fitur Utama
- ✅ Login & Registrasi (Email + Password)
- ✅ Role Admin & User
- ✅ Upload Dokumen Sertifikasi
- ✅ **Verifikasi Dokumen oleh Admin** (NEW)
- ✅ Dashboard Admin & User
- ✅ Jadwal Kegiatan
- ✅ Notifikasi Real-time
- ✅ Manajemen Pengguna
- ✅ Logout
- ✅ Keamanan Session & Password Hash
- ✅ **Database MySQL/PostgreSQL** (NEW)
- ✅ **UI Modern & Responsif** (NEW)

## Setup Database

### Menggunakan MySQL
```bash
mysql -u root -p
CREATE DATABASE sertikom;
```

### Environment Variables
Buat file `.env`:
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=sertikom
PORT=3000
```

## Instalasi & Menjalankan

```bash
npm install
npm start
```

Akses di: `http://localhost:3000`

## Demo Akun
- **Admin**: admin@sertikom.com / admin123
- **User**: user@sertikom.com / user123

## Struktur Folder
```
sertikom-mahasiswa/
├── public/
│   ├── assets/
│   │   └── styles.css
│   ├── js/
│   │   ├── main.js
│   │   ├── auth.js
│   │   ├── dashboard.js
│   │   ├── documents.js
│   │   └── admin.js
│   ├── pages/
│   │   ├── dashboard.html
│   │   ├── documents.html
│   │   ├── admin-documents.html
│   │   ├── admin-users.html
│   │   └── admin-schedules.html
│   └── index.html
├── uploads/
├── server.js
├── package.json
└── README.md
```
