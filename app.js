(function () {
  'use strict';

  /* ---------- Helpers ---------- */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var pad = function (n) { return String(n).padStart(2, '0'); };

  var mem = {};
  var store = {
    get: function (k, d) {
      try { var v = localStorage.getItem('rrk:' + k); if (v !== null) return JSON.parse(v); } catch (e) {}
      return k in mem ? mem[k] : d;
    },
    set: function (k, v) { mem[k] = v; try { localStorage.setItem('rrk:' + k, JSON.stringify(v)); } catch (e) {} },
    del: function (k) { delete mem[k]; try { localStorage.removeItem('rrk:' + k); } catch (e) {} }
  };

  var iso = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  var todayISO = function () { return iso(new Date()); };
  var addDays = function (s, n) { var d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return iso(d); };
  var fmtLong = function (s) { return new Date(s + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); };
  var fmtShort = function (s) { return new Date(s + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); };
  var fmtRange = function (s, e) { return pad(s) + '.00–' + pad(e) + '.00'; };
  var isPast = function (date, h) { return date < todayISO() || (date === todayISO() && h <= new Date().getHours()); };

  /* ---------- Data ---------- */
  var DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  var ROOM_TYPES = ['Diskusi', 'Rapat', 'Kelas', 'Aula'];
  var ROOMS_V = 2;
  var MON_FRI = [1, 2, 3, 4, 5], MON_SAT = [1, 2, 3, 4, 5, 6];
  function rm(id, name, gedung, type, cap, fas, days) {
    return { id: id, name: name, gedung: gedung, type: type, cap: cap, fas: fas, days: days || MON_FRI, open: 8, close: 17 };
  }
  var DEFAULT_ROOMS = [
    rm('d11', 'Ruang Diskusi A1.1', 'Gedung A', 'Diskusi', 4, ['Papan tulis', 'AC'], MON_SAT),
    rm('d12', 'Ruang Diskusi A1.2', 'Gedung A', 'Diskusi', 5, ['Papan tulis', 'AC', 'Colokan meja'], MON_SAT),
    rm('baca', 'Ruang Belajar Kelompok A1.3', 'Gedung A', 'Diskusi', 12, ['Papan tulis', 'AC', 'Colokan meja'], MON_SAT),
    rm('d21', 'Ruang Diskusi A2.1', 'Gedung A', 'Diskusi', 10, ['Papan tulis', 'AC', 'Colokan meja'], MON_SAT),
    rm('d22', 'Ruang Diskusi A2.2', 'Gedung A', 'Diskusi', 10, ['Papan tulis', 'AC', 'Colokan meja'], MON_SAT),
    rm('lab', 'Lab Presentasi A3.1', 'Gedung A', 'Kelas', 30, ['Proyektor', 'Sound system', 'AC']),
    rm('d13', 'Ruang Diskusi B1.1', 'Gedung B', 'Diskusi', 8, ['Papan tulis', 'AC'], MON_SAT),
    rm('d14', 'Ruang Diskusi B1.2', 'Gedung B', 'Diskusi', 6, ['Papan tulis', 'AC'], MON_SAT),
    rm('mm', 'Studio Multimedia B2.1', 'Gedung B', 'Kelas', 16, ['Proyektor', 'Sound system', 'Colokan meja']),
    rm('r34', 'Ruang Rapat B3.1', 'Gedung B', 'Rapat', 20, ['Proyektor', 'AC', 'Video conference']),
    rm('aula', 'Aula Mini C1.1', 'Gedung C', 'Aula', 60, ['Panggung kecil', 'Sound system', 'Proyektor'], MON_SAT),
    rm('sem', 'Ruang Seminar C1.2', 'Gedung C', 'Aula', 40, ['Proyektor', 'Sound system', 'AC']),
    rm('kb', 'Ruang Kuliah Besar C2.1', 'Gedung C', 'Kelas', 40, ['Proyektor', 'AC', 'Colokan meja']),
    rm('r21', 'Ruang Rapat C2.2', 'Gedung C', 'Rapat', 15, ['Proyektor', 'AC', 'Video conference']),
    rm('sid', 'Ruang Sidang C3.1', 'Gedung C', 'Rapat', 14, ['Proyektor', 'AC', 'Video conference'])
  ];
  var ROOMS = [];
  function roomKey(r) { var m = /(\d+)\.(\d+)/.exec(r.name); return m ? [parseInt(m[1], 10), parseInt(m[2], 10)] : [99, 0]; }
  function sortRooms(list) {
    return list.slice().sort(function (a, b) {
      if (a.gedung !== b.gedung) return a.gedung < b.gedung ? -1 : 1;
      var x = roomKey(a), y = roomKey(b);
      return x[0] - y[0] || x[1] - y[1] || a.name.localeCompare(b.name);
    });
  }
  function loadRooms() { ROOMS = sortRooms(store.get('rooms', DEFAULT_ROOMS)); }
  function seedRooms() {
    if (store.get('roomsv', 0) !== ROOMS_V) { store.set('rooms', DEFAULT_ROOMS); store.set('roomsv', ROOMS_V); }
  }
  var SLOT_HOURS = [8, 9, 10, 11, 13, 14, 15, 16]; // 12.00–13.00 istirahat
  var MAX_HOURS = 3;
  var STATUS = { pending: 'Menunggu', approved: 'Disetujui', rejected: 'Ditolak', cancelled: 'Dibatalkan' };
  var SLOT_LABEL = { free: 'Kosong', pending: 'Menunggu', booked: 'Terisi', past: 'Lewat', closed: 'Tutup' };
  var slotCls = function (st) { return st === 'closed' ? 'past' : st; };
  var ROUTES = { design: 'Design System', login: 'Login', rooms: 'Daftar Ruangan', book: 'Form Booking', admin: 'Dashboard Admin', roadmap: 'Increment' };

  var GONE = { id: '', name: '(ruangan dihapus)', gedung: '-', type: '-', cap: 0, fas: [], days: [], open: 8, close: 8 };
  var roomById = function (id) { return ROOMS.filter(function (r) { return r.id === id; })[0] || GONE; };
  var isAdmin = function () { var u = currentUser(); return !!(u && u.role === 'admin'); };
  var dayLabel = function (d) { return d === todayISO() ? 'hari ini' : d === addDays(todayISO(), 1) ? 'besok' : fmtShort(d); };
  var daysLabel = function (days) {
    var k = days.slice().sort().join('');
    if (k === '12345') return 'Senin\u2013Jumat';
    if (k === '123456') return 'Senin\u2013Sabtu';
    return [1, 2, 3, 4, 5, 6, 0].filter(function (d) { return days.indexOf(d) > -1; }).map(function (d) { return DAY_NAMES[d].slice(0, 3); }).join(', ') || 'Tidak ada';
  };
  var shortName = function (n) { return n.replace('Ruang ', 'R. '); };
  var users = function () { return store.get('users', []); };
  var bookings = function () { return store.get('bookings', []); };

  function mk(id, email, name, org, roomId, date, s, e, purpose, people, status, reason) {
    return { id: id, email: email, name: name, org: org, roomId: roomId, date: date, start: s, end: e, purpose: purpose, people: people, status: status, reason: reason || '', createdAt: Date.now() };
  }
  function seed() {
    if (store.get('seeded', false)) return;
    var t = todayISO();
    store.set('users', [
      { email: 'admin@kampus.ac.id', name: 'Admin Ruang', org: 'Biro Akademik', pass: 'admin123', role: 'admin' },
      { email: 'mahasiswa@kampus.ac.id', name: 'Rani Pratama', org: 'HMTI', pass: 'mahasiswa123', role: 'user' }
    ]);
    store.set('bookings', [
      mk('b1', 'mahasiswa@kampus.ac.id', 'Rani Pratama', 'HMTI', 'd21', t, 10, 11, 'Rapat divisi acara', 8, 'pending'),
      mk('b2', 'budi@kampus.ac.id', 'Budi Santoso', 'Pribadi', 'r34', t, 13, 14, 'Diskusi kelompok skripsi', 6, 'approved'),
      mk('b3', 'sari@kampus.ac.id', 'Sari Wulandari', 'BEM', 'd21', t, 16, 17, 'Evaluasi program kerja', 9, 'rejected', 'Ruangan dipakai untuk kegiatan fakultas.'),
      mk('b4', 'dimas@kampus.ac.id', 'Dimas Aryo', 'Himpunan Mesin', 'd21', t, 9, 10, 'Latihan presentasi lomba', 5, 'approved'),
      mk('b5', 'lina@kampus.ac.id', 'Lina Maharani', 'UKM Fotografi', 'd21', t, 13, 14, 'Review portofolio anggota', 7, 'approved')
    ]);
    store.set('seeded', true);
  }

  /* ---------- State ---------- */
  var theme = store.get('theme', 'dark');
  var authMode = 'login';
  var nextRoute = null;
  var rs = { gedung: '', type: '', cap: 0, roomId: 'd21', date: '', fas: [], now: false };
  var draft = { roomId: 'd21', date: '', start: 8, end: 9, people: '', purpose: '' };
  var af = { status: 'pending', date: '' };
  var mineF = 'all';
  var adminTab = 'req';
  var as = { date: todayISO() };

  var currentUser = function () {
    var e = store.get('session', null);
    if (!e) return null;
    return users().filter(function (u) { return u.email === e; })[0] || null;
  };

  /* ---------- Notifikasi ---------- */
  var notifs = function () { return store.get('notifs', []); };
  function unread(u) { return notifs().filter(function (n) { return n.email === u.email && !n.read; }).length; }
  function pushNotif(b, status, reason) {
    store.set('notifs', notifs().concat([{
      id: Date.now(), email: b.email, kind: status, read: false,
      text: 'Reservasi ' + roomById(b.roomId).name + (status === 'approved' ? ' disetujui.' : ' ditolak.'),
      sub: fmtShort(b.date) + ', ' + fmtRange(b.start, b.end) + (reason ? '. Alasan: ' + reason : '')
    }]));
  }

  var isEnded = function (b) { return b.date < todayISO() || (b.date === todayISO() && b.end <= new Date().getHours()); };
  function openDay(r, date) { return r.days.indexOf(new Date(date + 'T00:00:00').getDay()) > -1; }
  function openHour(r, date, h) { return openDay(r, date) && h >= r.open && h < r.close; }
  function hasBookable(date) {
    return ROOMS.some(function (r) { return SLOT_HOURS.some(function (h) { return openHour(r, date, h) && !isPast(date, h); }); });
  }
  function defaultDate() {
    var d = todayISO();
    for (var i = 0; i < 14 && !hasBookable(d); i++) d = addDays(d, 1);
    return d;
  }
  function slotMap(roomId, date) {
    var m = {}, r = roomById(roomId);
    SLOT_HOURS.forEach(function (h) { if (!openHour(r, date, h)) m[h] = 'closed'; });
    bookings().forEach(function (b) {
      if (b.roomId === roomId && b.date === date && (b.status === 'pending' || b.status === 'approved')) {
        for (var h = b.start; h < b.end; h++) m[h] = b.status;
      }
    });
    return m;
  }
  function slotState(date, h, m) {
    if (m[h]) return m[h] === 'approved' ? 'booked' : m[h] === 'pending' ? 'pending' : 'closed';
    return isPast(date, h) ? 'past' : 'free';
  }
  function freeCount(roomId, date) {
    var m = slotMap(roomId, date);
    return SLOT_HOURS.filter(function (h) { return slotState(date, h, m) === 'free'; }).length;
  }
  function freeNow(r) {
    var h = new Date().getHours();
    return SLOT_HOURS.indexOf(h) > -1 && slotState(todayISO(), h, slotMap(r.id, todayISO())) === 'free';
  }
  function endOptions(s, roomId, date) {
    var out = [], r = roomById(roomId);
    for (var e = s + 1; e <= s + MAX_HOURS; e++) {
      if (SLOT_HOURS.indexOf(e - 1) === -1) break;
      if (!openHour(r, date, e - 1)) break;
      out.push(e);
    }
    return out;
  }
  function outsideReason(room, date, start, end) {
    var day = new Date(date + 'T00:00:00').getDay();
    if (room.days.indexOf(day) === -1) return room.name + ' tidak beroperasi pada hari ' + DAY_NAMES[day] + '.';
    if (start < room.open || end > room.close) return 'Di luar jam operasional ' + room.name + ' (' + fmtRange(room.open, room.close) + ').';
    for (var h = start; h < end; h++) if (SLOT_HOURS.indexOf(h) === -1) return 'Jam ' + fmtRange(start, end) + ' melewati waktu istirahat 12.00\u201313.00. Pilih jam lain.';
    return '';
  }
  function findClash(roomId, date, start, end) {
    return bookings().filter(function (o) {
      return (o.status === 'pending' || o.status === 'approved') && o.roomId === roomId && o.date === date && start < o.end && o.start < end;
    })[0];
  }
  function timeProblem(roomId, date, start, end) {
    if (!ROOMS.some(function (r) { return r.id === roomId; })) return 'Ruangan tidak ditemukan. Pilih ruangan lain.';
    if (!(end > start)) return 'Jam selesai harus lebih besar dari jam mulai.';
    if (end - start > MAX_HOURS) return 'Durasi maksimal ' + MAX_HOURS + ' jam per pengajuan.';
    if (isPast(date, start)) return 'Jam mulai sudah lewat. Pilih jam lain atau tanggal lain.';
    var out = outsideReason(roomById(roomId), date, start, end);
    if (out) return out;
    var c = findClash(roomId, date, start, end);
    if (c) return 'Jam ' + fmtRange(start, end) + ' bentrok dengan reservasi lain (' + fmtRange(c.start, c.end) + ', ' + STATUS[c.status].toLowerCase() + '). Pilih slot hijau di kolom Ketersediaan.';
    return '';
  }

  /* ---------- UI utilities ---------- */
  function toast(msg, kind) {
    var el = document.createElement('div');
    el.className = 'toast ' + (kind || '');
    el.textContent = msg;
    $('#toasts').appendChild(el);
    setTimeout(function () { el.remove(); }, 3800);
  }
  function applyTheme() { document.documentElement.setAttribute('data-theme', theme); }
  function setErr(id, msg) {
    var el = $('#' + id); if (el) el.textContent = msg || '';
  }
  function markInvalid(ids, bad) {
    ids.forEach(function (id) {
      var el = $('#' + id); if (!el) return;
      if (bad) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
    });
  }
  var main = $('#main');

  var tabsFor = function (u) { return u && u.role === 'admin' ? ['admin', 'rooms', 'roadmap', 'design'] : ['rooms', 'book']; };
  /* ---------- Chrome ---------- */
  function renderChrome(r) {
    var u = currentUser();
    var fb = document.querySelector('.site-foot a[href="#/book"]'); if (fb && fb.parentNode) fb.parentNode.hidden = !!(u && u.role === 'admin');
    $('#tabs').innerHTML = tabsFor(u).map(function (k) {
      var label = (k === 'login' && u) ? 'Akun' : ROUTES[k];
      return '<a href="#/' + k + '"' + (k === r ? ' aria-current="page"' : '') + '>' + label + '</a>';
    }).join('');
    $('#who').innerHTML =
      (u ? '<a class="who-name" href="#/login" style="text-decoration:none" title="Lihat akun">' + esc(u.name) + '</a><span>' + (u.role === 'admin' ? 'Admin' : 'Mahasiswa / Organisasi') + '</span>' +
           '<button class="link bell" data-act="notif" aria-label="Notifikasi, ' + unread(u) + ' belum dibaca">🔔' + (unread(u) ? '<b>' + unread(u) + '</b>' : '') + '</button>' +
           '<button class="link" data-act="logout">Keluar</button>'
         : '<span>Belum masuk</span><a class="link" href="#/login">Masuk</a>') +
      '<button class="link" data-act="theme">' + (theme === 'dark' ? 'Tema terang' : 'Tema gelap') + '</button>';
  }

  /* ---------- View: Design System ---------- */
  function viewDesign() {
    if (!isAdmin()) {
      guard('Halaman ini khusus admin', 'Halaman Design System hanya dapat dilihat oleh admin.', '<a class="btn btn-primary btn-block" href="#/rooms">Kembali ke Daftar Ruangan</a>');
      return;
    }
    var cs = getComputedStyle(document.documentElement);
    var tokens = [
      ['--ink', 'Ink', 'Teks utama'],
      ['--accent', 'Accent', 'Aksi utama (CTA)'],
      ['--ok', 'Success', 'Disetujui, slot kosong'],
      ['--warn', 'Pending', 'Menunggu persetujuan'],
      ['--bad', 'Danger', 'Ditolak atau bentrok'],
      ['--bg', 'Latar', 'Latar halaman'],
      ['--surface', 'Surface', 'Kartu dan panel'],
      ['--line', 'Garis', 'Border dan pemisah']
    ];
    var sw = tokens.map(function (t) {
      var hex = cs.getPropertyValue(t[0]).trim();
      return '<li><button type="button" data-act="copy-hex" data-hex="' + esc(hex) + '" aria-label="Salin ' + esc(t[1]) + ' ' + esc(hex) + '">' +
        '<span class="box" style="background:var(' + t[0] + ')"></span>' +
        '<span><b>' + t[1] + '</b><span class="d">' + t[2] + '</span></span><code>' + esc(hex) + '</code></button></li>';
    }).join('');
    main.innerHTML =
      '<div class="grid-2">' +
        '<section class="card"><h2 class="h">Warna</h2><p class="sec-note">Klik warna untuk menyalin kode.</p><ul class="swatches">' + sw + '</ul></section>' +
        '<section class="card"><h2 class="h">Tipografi</h2>' +
          '<div class="specimen">' +
            '<div><div class="big">Fraunces</div><p class="muted small">Judul halaman dan nama ruangan. Memberi kesan formal-kampus.</p></div>' +
            '<div><div class="h2s">Judul bagian, 21 px</div><p class="muted small">Fraunces 600, untuk H2 dan nama kartu.</p></div>' +
            '<div><p style="font-weight:600">Inter, isi dan komponen UI</p><p class="muted">Teks isi, label, tombol, dan tabel memakai Inter 15 px. Input memakai 16 px agar tidak ter-zoom di iPhone.</p></div>' +
          '</div></section>' +
      '</div>' +
      '<section class="card"><h2 class="h">Komponen</h2>' +
        '<p class="comp-label">Tombol</p>' +
        '<div class="comp-row"><button class="btn btn-primary">Ajukan reservasi</button><button class="btn btn-ghost">Batal</button><button class="btn btn-ok btn-sm">Setujui</button><button class="btn btn-danger btn-sm">Tolak</button><button class="btn btn-primary" disabled>Tidak aktif</button></div>' +
        '<p class="comp-label">Label status</p>' +
        '<div class="comp-row"><span class="badge pending">Menunggu</span><span class="badge approved">Disetujui</span><span class="badge rejected">Ditolak</span></div>' +
        '<p class="comp-label">Slot jadwal</p>' +
        '<div class="slots">' +
          ['free', 'pending', 'booked', 'past'].map(function (k, i) { return '<div class="slot ' + k + '"><span class="t">' + fmtRange(8 + i, 9 + i) + '</span><span class="s">' + SLOT_LABEL[k] + '</span></div>'; }).join('') +
        '</div>' +
        '<p class="comp-label">Kolom isian</p>' +
        '<div class="row2" style="margin-top:12px"><div class="field"><label for="dsA">Normal</label><input id="dsA" placeholder="nama@kampus.ac.id"></div><div class="field"><label for="dsB">Salah isi</label><input id="dsB" value="abc" aria-invalid="true" aria-describedby="dsBe"><span class="err" id="dsBe">Format email belum benar.</span></div></div>' +
        '<ul class="rules"><li>Satu tombol utama (biru) per layar. Tombol lain memakai gaya garis.</li><li>Status selalu memakai teks, tidak hanya warna.</li><li>Nama aksi sama di seluruh alur: tombol "Ajukan reservasi" menghasilkan pesan "Pengajuan terkirim".</li></ul>' +
      '</section>';
  }

  /* ---------- View: Login / Akun ---------- */
  function viewLogin() {
    var u = currentUser();
    if (u) {
      main.innerHTML =
        '<div class="auth"><section class="card auth-card"><h2 class="h">Halo, ' + esc(u.name) + '</h2>' +
        '<p class="muted" style="margin-bottom:0">Anda masuk sebagai ' + (u.role === 'admin' ? 'admin' : 'mahasiswa atau organisasi') + '.</p>' +
        '<dl class="kv"><dt>Email</dt><dd>' + esc(u.email) + '</dd><dt>Organisasi</dt><dd>' + esc(u.org || 'Pribadi') + '</dd></dl>' +
        '<div class="acct-actions">' + (u.role === 'admin' ? '<a class="btn btn-primary" href="#/admin">Dashboard admin</a>' : '<a class="btn btn-primary" href="#/book">Ajukan reservasi</a>') + '<a class="btn btn-ghost" href="#/rooms">Lihat ruangan</a>' +
        '<button class="btn btn-ghost" data-act="logout">Keluar</button></div></section></div>';
      return;
    }
    if (authMode === 'register') {
      main.innerHTML =
        '<div class="auth"><section class="card auth-card"><h2 class="h">Daftar</h2><p class="muted">Buat akun untuk mengajukan reservasi ruangan.</p>' +
        '<form id="regForm" novalidate>' +
          '<div class="field"><label for="rName">Nama lengkap</label><input id="rName" autocomplete="name" required><span class="err" id="rNameE"></span></div>' +
          '<div class="field"><label for="rOrg">Organisasi atau unit</label><input id="rOrg" placeholder="HMTI, BEM, atau Pribadi" autocomplete="organization"></div>' +
          '<div class="field"><label for="rEmail">Email</label><input id="rEmail" type="email" placeholder="nama@kampus.ac.id" autocomplete="email" required><span class="err" id="rEmailE"></span></div>' +
          '<div class="field"><label for="rPass">Kata sandi</label><div class="pw"><input id="rPass" type="password" autocomplete="new-password" required><button type="button" class="link" data-act="toggle-pass" data-target="rPass">Tampilkan</button></div><span class="hint">Minimal 6 karakter.</span><span class="err" id="rPassE"></span></div>' +
          '<button class="btn btn-primary btn-block" type="submit">Buat akun</button>' +
        '</form>' +
        '<p class="switch">Sudah punya akun? <button type="button" class="link" data-act="to-login">Masuk</button></p></section></div>';
      return;
    }
    main.innerHTML =
      '<div class="auth"><section class="card auth-card"><h2 class="h">Masuk</h2><p class="muted">Gunakan akun kampus untuk melanjutkan.</p>' +
      '<form id="loginForm" novalidate>' +
        '<div class="field"><label for="lEmail">Email</label><input id="lEmail" type="email" placeholder="nama@kampus.ac.id" autocomplete="username" required></div>' +
        '<div class="field"><label for="lPass">Kata sandi</label><div class="pw"><input id="lPass" type="password" autocomplete="current-password" required><button type="button" class="link" data-act="toggle-pass" data-target="lPass">Tampilkan</button></div></div>' +
        '<div class="field"><label for="lRole">Masuk sebagai</label><select id="lRole"><option value="user">Mahasiswa / Organisasi</option><option value="admin">Admin</option></select></div>' +
        '<p class="err" id="authErr" role="alert" style="margin-bottom:12px"></p>' +
        '<button class="btn btn-primary btn-block" type="submit">Masuk</button>' +
      '</form>' +
      '<p class="switch">Belum punya akun? <button type="button" class="link" data-act="to-register">Daftar</button></p>' +
      '<div class="demo"><p>Untuk mencoba, isi otomatis dengan akun demo:</p><div class="btns"><button type="button" class="btn btn-ghost btn-sm" data-act="fill-demo" data-role="user">Mahasiswa</button><button type="button" class="btn btn-ghost btn-sm" data-act="fill-demo" data-role="admin">Admin</button></div></div>' +
      '</section></div>';
  }

  function afterAuth(u) {
    var n = unread(u);
    if (n) setTimeout(function () { toast('Kamu punya ' + n + ' notifikasi baru. Klik 🔔 untuk melihat.'); }, 700);
    var dest = nextRoute || (u.role === 'admin' ? '#/admin' : '#/rooms');
    if (u.role === 'admin' && dest === '#/book') dest = '#/admin';
    if (u.role !== 'admin' && (dest === '#/admin' || dest === '#/roadmap' || dest === '#/design')) dest = '#/rooms';
    nextRoute = null;
    var same = location.hash === dest;
    location.hash = dest;
    if (same) render();
  }
  function doLogin() {
    var email = $('#lEmail').value.trim().toLowerCase();
    var pass = $('#lPass').value;
    var role = $('#lRole').value;
    var u = users().filter(function (x) { return x.email.toLowerCase() === email; })[0];
    var msg = '';
    if (!email || !pass) msg = 'Isi email dan kata sandi dulu.';
    else if (!u || u.pass !== pass) msg = 'Email atau kata sandi salah. Periksa lagi, lalu coba masuk.';
    else if (role === 'admin' && u.role !== 'admin') msg = 'Akun ini bukan akun admin. Ubah "Masuk sebagai" ke Mahasiswa / Organisasi.';
    else if (role === 'user' && u.role === 'admin') msg = 'Ini akun admin. Ubah "Masuk sebagai" ke Admin.';
    setErr('authErr', msg);
    if (msg) return;
    store.set('session', u.email);
    toast('Selamat datang, ' + u.name + '.', 'ok');
    afterAuth(u);
  }
  function doRegister() {
    var name = $('#rName').value.trim(), org = $('#rOrg').value.trim();
    var email = $('#rEmail').value.trim().toLowerCase(), pass = $('#rPass').value;
    var e = { rName: '', rEmail: '', rPass: '' };
    if (name.length < 2) e.rName = 'Isi nama lengkap.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.rEmail = 'Format email belum benar. Contoh: nama@kampus.ac.id';
    else if (users().some(function (x) { return x.email.toLowerCase() === email; })) e.rEmail = 'Email ini sudah terdaftar. Silakan masuk.';
    if (pass.length < 6) e.rPass = 'Kata sandi minimal 6 karakter.';
    setErr('rNameE', e.rName); setErr('rEmailE', e.rEmail); setErr('rPassE', e.rPass);
    markInvalid(['rName'], !!e.rName); markInvalid(['rEmail'], !!e.rEmail); markInvalid(['rPass'], !!e.rPass);
    var first = ['rName', 'rEmail', 'rPass'].filter(function (k) { return e[k]; })[0];
    if (first) { $('#' + first).focus(); return; }
    var u = { email: email, name: name, org: org || 'Pribadi', pass: pass, role: 'user' };
    store.set('users', users().concat([u]));
    store.set('session', u.email);
    toast('Akun dibuat. Selamat datang, ' + name + '.', 'ok');
    afterAuth(u);
  }

  /* ---------- View: Daftar Ruangan ---------- */
  function heroHTML() {
    var free = ROOMS.reduce(function (a, r) { return a + freeCount(r.id, rs.date); }, 0);
    var pend = bookings().filter(function (b) { return b.status === 'pending'; }).length;
    return '<section class="hero"><h2>Ruang kosong? Cek dan ajukan dalam satu menit.</h2><p>Pilih ruangan, lihat jam yang masih kosong, lalu kirim pengajuan. Statusnya bisa dipantau langsung.</p>' +
      '<div class="hero-foot"><div class="hero-stats"><div><b>' + ROOMS.length + '</b><span>ruangan</span></div><div><b>' + free + '</b><span>slot kosong ' + dayLabel(rs.date) + '</span></div><div><b>' + pend + '</b><span>menunggu persetujuan</span></div></div>' +
      (isAdmin() ? '' : '<a class="btn btn-primary" href="#/book">Ajukan reservasi</a>') + '</div></section>';
  }
  function faqHTML() {
    var Q = [
      ['Kenapa saya harus mengajukan reservasi?', 'Supaya satu ruangan tidak dipakai dua kelompok di jam yang sama, dan admin tahu siapa pemakainya.'],
      ['Bagaimana cara mengajukan reservasi?', 'Pilih ruangan dan klik slot kosong (hijau). Masuk dengan akunmu, isi jumlah peserta dan keperluan, lalu klik Ajukan reservasi.'],
      ['Bagaimana saya tahu pengajuan disetujui?', 'Status berubah di Form Booking, bagian Pengajuan saya, dan kamu menerima notifikasi di ikon 🔔. Kalau ditolak, alasannya ikut ditampilkan.'],
      ['Bisakah saya membatalkan pengajuan?', 'Bisa, selama statusnya masih Menunggu. Klik Batalkan pengajuan di bagian Pengajuan saya, maka slot kembali kosong.'],
      ['Berapa lama ruangan bisa dipakai?', 'Maksimal ' + MAX_HOURS + ' jam per pengajuan. Jam layanan 08.00–12.00 dan 13.00–17.00; 12.00–13.00 istirahat.'],
      ['Apakah saya bisa memakai ruangan tanpa reservasi?', 'Sebaiknya tidak. Ruangan yang tampak kosong bisa saja sudah diajukan orang lain, dan pengajuan yang masih menunggu pun menahan slotnya.']
    ];
    return '<section class="faq" aria-labelledby="faqT"><h2 class="h" id="faqT">Pertanyaan seputar reservasi</h2>' + Q.map(function (q) { return '<details><summary>' + esc(q[0]) + '</summary><p>' + esc(q[1]) + '</p></details>'; }).join('') + '</section>';
  }
  function searchHTML() {
    return '<form id="qForm" class="searchbar" role="search"><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><input id="fQ" type="search" aria-label="Cari nama ruangan" placeholder="Cari nama ruangan..." autocomplete="off" value="' + esc(rs.q || '') + '"><button class="btn btn-primary btn-sm" type="submit">Cari</button></form>';
  }
  function viewRooms() { viewRooms0(); main.insertAdjacentHTML('afterbegin', heroHTML() + searchHTML()); main.insertAdjacentHTML('beforeend', faqHTML()); }
  function viewRooms0() {
    var gedungs = ROOMS.map(function (r) { return r.gedung; }).filter(function (g, i, a) { return a.indexOf(g) === i; });
    main.innerHTML =
      '<div class="filters">' +
        '<div class="field"><label for="fGedung">Gedung</label><select id="fGedung"><option value="">Semua gedung</option>' +
          gedungs.map(function (g) { return '<option' + (rs.gedung === g ? ' selected' : '') + '>' + g + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label for="fJenis">Jenis ruangan</label><select id="fJenis"><option value="">Semua jenis</option>' +
          ROOM_TYPES.map(function (t) { return '<option' + (rs.type === t ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label for="fCap">Kapasitas minimum</label><input id="fCap" type="number" min="1" inputmode="numeric" placeholder="cth. 10 orang" value="' + (rs.cap || '') + '"></div>' +
      '</div>' +
      '<fieldset class="checks"><legend>Fasilitas</legend>' +
        ROOMS.reduce(function (a, r) { return a.concat(r.fas.filter(function (f) { return a.indexOf(f) < 0; })); }, []).map(function (f) {
          return '<label><input type="checkbox" name="fas" value="' + esc(f) + '"' + (rs.fas.indexOf(f) > -1 ? ' checked' : '') + '>' + esc(f) + '</label>';
        }).join('') +
        '<label><input type="checkbox" id="fNow"' + (rs.now ? ' checked' : '') + '>Tersedia sekarang</label></fieldset>' +
      '<div class="rooms" id="roomList"></div>' +
      '<section class="card" id="schedule" aria-live="polite"></section>';
    drawRooms();
  }
  var EYE = '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  var CAL = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18M9 15l2 2 4-4"/></svg>';
  function roomArt(r) {
    var own = store.get('photos', {})[r.id], src = own || r.img;
    if (src) return '<img src="' + esc(src) + '" alt="' + esc(r.name) + '" style="object-fit:cover">';
    var C = { d21: ['#2f6f7e', '#183a44', 'b'], r34: ['#5b4c9a', '#241e45', 's'], d13: ['#a0683a', '#43291a', 'b'], lab: ['#2f68a8', '#152f4d', 's'], aula: ['#a1405f', '#3b1526', 't'], d22: ['#3f7a5a', '#1b3b2b', 'b'], d14: ['#7a4f8f', '#2f1d3b', 'b'], baca: ['#3d6a99', '#1a3149', 'b'], r21: ['#8a6a2f', '#3a2c12', 's'], sid: ['#6b3f4f', '#2c161f', 's'], mm: ['#2d7a8c', '#12363f', 's'], sem: ['#8f4a3a', '#3a1a14', 't'] }[r.id] || ['#4a5a7a', '#1e2638', 'b'];
    var o = '<svg viewBox="0 0 400 220" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Ilustrasi ' + esc(r.name) + '"><rect width="400" height="220" fill="' + C[0] + '"/><rect y="140" width="400" height="80" fill="' + C[1] + '"/><rect width="400" height="140" fill="#fff" opacity=".06"/>';
    if (C[2] === 'b') o += '<rect x="110" y="26" width="180" height="82" rx="6" fill="#f4f6fa"/><path d="M130 52h80M130 70h120M130 88h60" stroke="#8b96ad" stroke-width="5" stroke-linecap="round"/>';
    else if (C[2] === 's') o += '<rect x="90" y="24" width="220" height="92" rx="4" fill="#0e1424"/><rect x="100" y="34" width="200" height="72" fill="#7fb4ff" opacity=".35"/><circle cx="200" cy="70" r="16" fill="#fff" opacity=".6"/>';
    else o += '<rect x="30" y="20" width="340" height="14" fill="#000" opacity=".25"/><path d="M30 34l20 100h-20zM370 34l-20 100h20z" fill="#e8b4c4" opacity=".5"/><rect x="60" y="100" width="280" height="34" rx="4" fill="#5a2438"/>';
    if (C[2] === 't') { for (var row = 0; row < 3; row++) for (var i = 0; i < 9; i++) o += '<circle cx="' + (50 + i * 37) + '" cy="' + (164 + row * 22) + '" r="' + (7 + row) + '" fill="#f1d6df" opacity="' + (0.55 + row * 0.15) + '"/>'; }
    else { var n = Math.max(4, Math.min(10, Math.round(r.cap / 3))); o += '<rect x="60" y="150" width="280" height="22" rx="6" fill="#e9dcc8"/>'; for (var k = 0; k < n; k++) o += '<circle cx="' + (80 + k * (240 / (n - 1))) + '" cy="192" r="12" fill="#101828" opacity=".55"/>'; }
    return o + '</svg>';
  }
  function decorateRooms() {
    Array.prototype.forEach.call(document.querySelectorAll('#roomList .room'), function (a) {
      var det = a.querySelector('[data-act="detail"]'); if (!det) return;
      var r = roomById(det.dataset.id), free = freeCount(r.id, rs.date);
      a.setAttribute('data-act', 'pick-room'); a.setAttribute('data-id', r.id);
      a.insertAdjacentHTML('afterbegin', '<div class="ph">' + roomArt(r) + '<span class="pill l">' + esc(r.gedung) + '</span><span class="pill r">' + free + ' kosong</span></div>');
      a.querySelector('.room-foot').innerHTML = '<span class="avail">' + free + ' dari ' + SLOT_HOURS.length + ' slot kosong</span><div class="btnrow"><button type="button" class="btn btn-ghost eye" data-act="detail" data-id="' + r.id + '" aria-label="Detail ' + esc(r.name) + '">' + EYE + '</button>' + (isAdmin() ? '<button type="button" class="btn btn-primary grow" data-act="pick-room" data-id="' + r.id + '">Lihat jadwal</button>' : '<button type="button" class="btn btn-primary grow" data-act="reserve" data-id="' + r.id + '" aria-label="Reservasi ' + esc(r.name) + '">' + CAL + 'Reservasi</button>') + '</div>';
    });
  }
  function drawRooms() { drawRooms0(); decorateRooms(); }
  function drawRooms0() {
    var list = ROOMS.filter(function (r) {
      return (!rs.q || r.name.toLowerCase().indexOf(rs.q.toLowerCase()) > -1) && (!rs.gedung || r.gedung === rs.gedung) && (!rs.type || r.type === rs.type) && (!rs.cap || r.cap >= rs.cap) &&
        rs.fas.every(function (f) { return r.fas.indexOf(f) > -1; }) && (!rs.now || freeNow(r));
    });
    var el = $('#roomList'), sch = $('#schedule');
    if (!list.length) {
      el.innerHTML = '<div class="card empty"><p>Tidak ada ruangan yang cocok dengan filter ini.</p><button class="btn btn-ghost btn-sm" data-act="reset-rooms">Tampilkan semua ruangan</button></div>';
      sch.hidden = true; sch.innerHTML = '';
      return;
    }
    sch.hidden = false;
    if (!list.some(function (r) { return r.id === rs.roomId; })) rs.roomId = list[0].id;
    el.innerHTML = list.map(function (r) {
      var free = freeCount(r.id, rs.date);
      return '<article class="room' + (r.id === rs.roomId ? ' sel' : '') + '">' +
        '<div><h3 class="h">' + esc(r.name) + '</h3><p class="muted small">' + esc(r.type) + ', ' + esc(r.gedung) + ', kapasitas ' + r.cap + ' orang</p></div>' +
        '<ul class="chips">' + r.fas.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul>' +
        '<div class="room-foot"><span class="avail">' + free + ' dari ' + SLOT_HOURS.length + ' slot kosong</span><span style="display:flex;gap:6px">' +
        '<button class="btn btn-ghost btn-sm" data-act="detail" data-id="' + r.id + '">Detail</button>' +
        '<button class="btn btn-ghost btn-sm" data-act="pick-room" data-id="' + r.id + '" aria-pressed="' + (r.id === rs.roomId) + '">Lihat jadwal</button></span></div></article>';
    }).join('');
    drawSchedule();
  }
  function weekHTML() {
    var t = todayISO(), out = '';
    for (var i = 0; i < 7; i++) {
      var d = addDays(t, i), f = freeCount(rs.roomId, d), dt = new Date(d + 'T00:00:00');
      out += '<button type="button" class="wd' + (d === rs.date ? ' cur' : '') + '" style="--p:' + (f / SLOT_HOURS.length).toFixed(2) + '" data-act="pick-day" data-date="' + d + '" aria-label="' + fmtLong(d) + ', ' + f + ' slot kosong"><span>' + dt.toLocaleDateString('id-ID', { weekday: 'short' }) + '</span><b>' + dt.getDate() + '</b><span>' + f + ' kosong</span></button>';
    }
    return '<h3 class="h" style="margin:22px 0 10px">7 hari ke depan</h3><div class="week">' + out + '</div>';
  }
  function drawSchedule() { drawSchedule0(); $('#schedule').insertAdjacentHTML('beforeend', weekHTML()); }
  function drawSchedule0() {
    var room = roomById(rs.roomId), m = slotMap(rs.roomId, rs.date), t = todayISO();
    $('#schedule').innerHTML =
      '<div class="sched-head"><div><h2 class="h">Jadwal ' + esc(room.name) + '</h2><p class="sec-note">' + fmtLong(rs.date) + (isAdmin() ? '.' : '. Pilih slot kosong untuk mulai mengajukan reservasi.') + '</p></div>' +
      '<div class="datenav"><button class="btn btn-ghost" data-act="day-prev" aria-label="Hari sebelumnya"' + (rs.date <= t ? ' disabled' : '') + '>‹</button>' +
      '<input type="date" id="schedDate" aria-label="Tanggal jadwal" min="' + t + '" value="' + rs.date + '">' +
      '<button class="btn btn-ghost" data-act="day-next" aria-label="Hari berikutnya">›</button></div></div>' +
      '<div class="slots">' + SLOT_HOURS.map(function (h) {
        var st = slotState(rs.date, h, m);
        var inner = '<span class="t">' + fmtRange(h, h + 1) + '</span><span class="s">' + SLOT_LABEL[st] + '</span>';
        return st === 'free' && !isAdmin()
          ? '<button type="button" class="slot free" data-act="pick-slot" data-hour="' + h + '" aria-label="' + fmtRange(h, h + 1) + ', kosong. Ajukan reservasi">' + inner + '</button>'
          : '<div class="slot ' + slotCls(st) + '">' + inner + '</div>';
      }).join('') + '</div>' +
      '<ul class="legend"><li class="free"><i></i>Kosong</li><li class="pending"><i></i>Menunggu persetujuan</li><li class="booked"><i></i>Terisi</li><li class="past"><i></i>Sudah lewat atau tutup</li><li>Istirahat 12.00–13.00</li></ul>';
  }

  /* ---------- View: Form Booking ---------- */
  function guard(title, text, extra) {
    main.innerHTML = '<div class="auth"><section class="card auth-card"><h2 class="h">' + title + '</h2><p class="muted" style="margin-bottom:18px">' + text + '</p>' + extra + '</section></div>';
  }
  function viewBook() {
    var u = currentUser();
    if (!u) {
      nextRoute = '#/book';
      guard('Masuk untuk mengajukan reservasi', 'Pengajuan dicatat atas nama akun Anda, supaya admin tahu siapa pemakainya.', '<a class="btn btn-primary btn-block" href="#/login">Masuk atau daftar</a>');
      return;
    }
    if (u.role === 'admin') {
      guard('Halaman ini khusus mahasiswa', 'Admin tidak membuat reservasi. Tinjau dan kelola pengajuan di Dashboard Admin.', '<a class="btn btn-primary btn-block" href="#/admin">Buka Dashboard Admin</a>');
      return;
    }
    if (!ROOMS.some(function (r) { return r.id === draft.roomId; })) draft.roomId = ROOMS[0].id;
    if (!draft.date || draft.date < todayISO()) draft.date = defaultDate();
    var roomOpts = ROOMS.map(function (r) { return '<option value="' + r.id + '"' + (r.id === draft.roomId ? ' selected' : '') + '>' + esc(r.name) + ' (' + r.gedung + ', maks. ' + r.cap + ')</option>'; }).join('');
    main.innerHTML =
      '<div class="book-grid">' +
        '<section class="card"><h2 class="h">Ajukan reservasi</h2><p class="sec-note" style="margin-bottom:18px">Maksimal ' + MAX_HOURS + ' jam per pengajuan. Admin akan menyetujui atau menolak.</p>' +
        '<form id="bookForm" novalidate>' +
          '<div class="field"><label for="bRoom">Ruangan</label><select id="bRoom">' + roomOpts + '</select></div>' +
          '<div class="field"><label for="bDate">Tanggal</label><input type="date" id="bDate" min="' + todayISO() + '" value="' + draft.date + '"><span class="err" id="bDateE"></span></div>' +
          '<div class="row2"><div class="field"><label for="bStart">Mulai</label><select id="bStart"></select></div><div class="field"><label for="bEnd">Selesai</label><select id="bEnd"></select></div></div>' +
          '<span class="err" id="bTimeE" style="display:block;margin:-6px 0 14px"></span>' +
          '<div class="field"><label for="bPeople">Jumlah peserta</label><input type="number" id="bPeople" min="1" inputmode="numeric" value="' + esc(draft.people) + '" placeholder="cth. 8"><span class="err" id="bPeopleE"></span></div>' +
          '<div class="field"><label for="bPurpose">Keperluan</label><textarea id="bPurpose" maxlength="200" placeholder="cth. Rapat divisi acara">' + esc(draft.purpose) + '</textarea><span class="err" id="bPurposeE"></span></div>' +
          '<div class="field"><label for="bWho">Atas nama</label><input id="bWho" readonly value="' + esc(u.name + ' — ' + (u.org || 'Pribadi')) + '"></div>' +
          '<button class="btn btn-primary" type="submit">Ajukan reservasi</button> <a class="btn btn-ghost" href="#/rooms">Batal</a>' +
        '</form></section>' +
        '<div><section class="card"><h2 class="h">Ketersediaan</h2><p class="sec-note" id="stripNote"></p><div class="slots" id="strip"></div>' +
          '<ul class="legend"><li class="free"><i></i>Kosong</li><li class="pending"><i></i>Menunggu</li><li class="booked"><i></i>Terisi</li><li class="past"><i></i>Lewat atau tutup</li></ul></section>' +
        '<section class="card"><h2 class="h">Pengajuan saya</h2><ul class="mine" id="mine"></ul></section></div>' +
      '</div>';
    fillStart(); fillEnd(); drawStrip(); drawMine();
  }
  function fillStart() {
    var room = roomById(draft.roomId);
    var off = function (h) { return isPast(draft.date, h) || !openHour(room, draft.date, h); };
    $('#bStart').innerHTML = SLOT_HOURS.map(function (h) {
      return '<option value="' + h + '"' + (h === draft.start ? ' selected' : '') + (off(h) ? ' disabled' : '') + '>' + pad(h) + '.00</option>';
    }).join('');
    if (off(draft.start)) {
      var f = SLOT_HOURS.filter(function (h) { return !off(h); })[0];
      if (f) { draft.start = f; $('#bStart').value = String(f); }
    }
  }
  function fillEnd() {
    var opts = endOptions(draft.start, draft.roomId, draft.date);
    if (!opts.length) opts = [draft.start + 1];
    if (opts.indexOf(draft.end) === -1) draft.end = opts[0];
    $('#bEnd').innerHTML = opts.map(function (e) { return '<option value="' + e + '"' + (e === draft.end ? ' selected' : '') + '>' + pad(e) + '.00</option>'; }).join('');
  }
  function drawStrip() {
    var room = roomById(draft.roomId), m = slotMap(draft.roomId, draft.date);
    $('#stripNote').textContent = room.name + ', ' + fmtLong(draft.date) + '. Pilih slot kosong untuk mengisi jam mulai.';
    $('#strip').innerHTML = SLOT_HOURS.map(function (h) {
      var st = slotState(draft.date, h, m), sel = h >= draft.start && h < draft.end;
      var inner = '<span class="t">' + fmtRange(h, h + 1) + '</span><span class="s">' + SLOT_LABEL[st] + '</span>';
      return st === 'free'
        ? '<button type="button" class="slot free' + (sel ? ' sel' : '') + '" data-act="strip-slot" data-hour="' + h + '" aria-pressed="' + sel + '">' + inner + '</button>'
        : '<div class="slot ' + slotCls(st) + '">' + inner + '</div>';
    }).join('');
  }
  function drawMine() {
    var u = currentUser(); if (!u || u.role === 'admin') return;
    var all = bookings().filter(function (b) { return b.email === u.email; }).sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : b.start - a.start; });
    var cnt = function (k) { return k === 'all' ? all.length : all.filter(function (b) { return b.status === k; }).length; };
    var seg = ['all', 'pending', 'approved', 'rejected', 'cancelled'].map(function (k) {
      return '<button type="button" class="btn btn-ghost btn-sm" data-act="mine-f" data-k="' + k + '" aria-pressed="' + (mineF === k) + '">' + (k === 'all' ? 'Semua' : STATUS[k]) + ' (' + cnt(k) + ')</button>';
    }).join('');
    var mine = all.filter(function (b) { return mineF === 'all' || b.status === mineF; });
    $('#mine').innerHTML = '<li style="border:0;padding:0"><div class="seg" style="margin:0">' + seg + '</div></li>' + (mine.length ? mine.map(function (b) {
      var canCancel = (b.status === 'pending' || b.status === 'approved') && !isEnded(b);
      return '<li><div class="top2"><div><div class="nm">' + esc(roomById(b.roomId).name) + '</div><div class="muted small">' + fmtShort(b.date) + ', ' + fmtRange(b.start, b.end) + '</div></div><span class="badge ' + b.status + '">' + STATUS[b.status] + '</span></div>' +
        '<div class="small muted">' + esc(b.purpose) + '</div>' +
        (b.status === 'rejected' && b.reason ? '<div class="reason">Alasan: ' + esc(b.reason) + '</div>' : '') +
        (canCancel ? '<div><button class="btn btn-danger btn-sm" data-act="cancel-booking" data-id="' + b.id + '">' + (b.status === 'pending' ? 'Batalkan pengajuan' : 'Batalkan reservasi') + '</button></div>' : '') + '</li>';
    }).join('') : '<li class="muted small" style="border-style:dashed">Tidak ada pengajuan dengan status ini.</li>');
  }
  function submitBook() {
    var u = currentUser(); if (!u || u.role !== 'user') return;
    var d = draft, room = roomById(d.roomId), e = {};
    if (!d.date) e.date = 'Pilih tanggal.';
    else if (d.date < todayISO()) e.date = 'Tanggal tidak boleh sudah lewat.';
    if (!e.date) e.time = timeProblem(d.roomId, d.date, d.start, d.end);
    var raw = String(d.people == null ? '' : d.people).trim(), p = Number(raw);
    if (!raw) e.people = 'Isi jumlah peserta.';
    else if (!Number.isInteger(p)) e.people = 'Jumlah peserta harus bilangan bulat.';
    else if (p < 1) e.people = 'Jumlah peserta minimal 1 orang.';
    else if (p > room.cap) e.people = 'Jumlah peserta melebihi kapasitas ruangan (maks. ' + room.cap + ' orang).';
    if ((d.purpose || '').trim().length < 5) e.purpose = 'Tulis keperluan singkat, minimal 5 karakter.';
    setErr('bDateE', e.date); setErr('bTimeE', e.time); setErr('bPeopleE', e.people); setErr('bPurposeE', e.purpose);
    markInvalid(['bDate'], !!e.date); markInvalid(['bStart', 'bEnd'], !!e.time); markInvalid(['bPeople'], !!e.people); markInvalid(['bPurpose'], !!e.purpose);
    var order = [['date', 'bDate'], ['time', 'bStart'], ['people', 'bPeople'], ['purpose', 'bPurpose']];
    var bad = order.filter(function (o) { return e[o[0]]; })[0];
    if (bad) { $('#' + bad[1]).focus(); return; }
    var b = mk('b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), u.email, u.name, u.org || 'Pribadi', d.roomId, d.date, d.start, d.end, d.purpose.trim(), p, 'pending');
    store.set('bookings', bookings().concat([b]));
    users().filter(function (a) { return a.role === 'admin'; }).forEach(function (a) {
      store.set('notifs', notifs().concat([{ id: Date.now() + Math.random(), email: a.email, kind: 'pending', read: false, text: 'Pengajuan baru dari ' + u.name + '.', sub: room.name + ', ' + fmtShort(d.date) + ', ' + fmtRange(d.start, d.end) }]));
    });
    draft.people = ''; draft.purpose = '';
    $('#bPeople').value = ''; $('#bPurpose').value = '';
    drawStrip(); drawMine();
    toast('Pengajuan terkirim. Status akan berubah setelah admin meninjau.', 'ok');
  }

  /* ---------- View: Dashboard Admin ---------- */
  var ADMIN_TABS = [['req', 'Pengajuan'], ['sched', 'Jadwal semua ruangan'], ['rooms', 'Kelola ruangan'], ['log', 'Riwayat keputusan']];
  function viewAdmin() { viewAdmin0(); if ($('#adminPane')) { main.insertAdjacentHTML('afterbegin', '<div class="stats" id="stats"></div>'); drawStats(); } }
  function drawStats() {
    var all = bookings(), c = function (k) { return all.filter(function (b) { return b.status === k; }).length; };
    var t = todayISO(), used = all.filter(function (b) { return b.date === t && b.status === 'approved'; }).reduce(function (a, b) { return a + b.end - b.start; }, 0);
    var el = $('#stats'); if (!el) return;
    el.innerHTML = '<div class="stat w"><b>' + c('pending') + '</b><span>Menunggu keputusan</span></div><div class="stat o"><b>' + c('approved') + '</b><span>Disetujui</span></div><div class="stat r"><b>' + c('rejected') + '</b><span>Ditolak</span></div><div class="stat"><b>' + Math.round(used / (ROOMS.length * SLOT_HOURS.length) * 100) + '%</b><span>Ruang terpakai hari ini</span></div>';
  }
  function viewAdmin0() {
    var u = currentUser();
    if (!u) {
      nextRoute = '#/admin';
      guard('Masuk sebagai admin', 'Dashboard ini hanya untuk pengelola ruangan.', '<a class="btn btn-primary btn-block" href="#/login">Masuk</a>');
      return;
    }
    if (u.role !== 'admin') {
      guard('Halaman ini khusus admin', 'Akun Anda terdaftar sebagai mahasiswa atau organisasi. Anda bisa melihat status pengajuan di halaman Form Booking.', '<a class="btn btn-primary btn-block" href="#/book">Buka Form Booking</a>');
      return;
    }
    main.innerHTML = '<div class="seg" id="adminSeg" style="margin:0 0 16px"></div><div id="adminPane"></div>';
    drawAdminPane();
  }
  function drawAdminPane() {
    $('#adminSeg').innerHTML = ADMIN_TABS.map(function (t) {
      return '<button type="button" class="btn btn-ghost btn-sm" data-act="admin-tab" data-k="' + t[0] + '" aria-pressed="' + (adminTab === t[0]) + '">' + t[1] + '</button>';
    }).join('');
    if (adminTab === 'req') {
      $('#adminPane').innerHTML =
        '<div class="filters">' +
          '<div class="field"><label for="aStatus">Status</label><select id="aStatus"><option value="">Semua</option>' +
            Object.keys(STATUS).map(function (k) { return '<option value="' + k + '"' + (af.status === k ? ' selected' : '') + '>' + STATUS[k] + '</option>'; }).join('') + '</select></div>' +
          '<div class="field"><label for="aDate">Tanggal</label><input type="date" id="aDate" value="' + af.date + '"></div>' +
        '</div>' +
        '<section class="card"><p id="adminSummary" tabindex="-1" aria-live="polite"></p><div class="tbl-wrap" id="adminTable"></div></section>';
      drawAdmin();
    } else if (adminTab === 'sched') drawAdminSched();
    else if (adminTab === 'rooms') drawAdminRooms();
    else drawAdminLog();
  }
  function drawAdmin() { drawAdmin0(); drawStats(); }
  function drawAdmin0() {
    if (!$('#adminSummary')) return;
    var all = bookings();
    var rows = all.filter(function (b) { return (!af.status || b.status === af.status) && (!af.date || b.date === af.date); });
    var rank = { pending: 0, approved: 1, rejected: 2, cancelled: 3 };
    rows.sort(function (a, b) { return rank[a.status] - rank[b.status] || (a.date < b.date ? -1 : a.date > b.date ? 1 : a.start - b.start); });
    var pend = all.filter(function (b) { return b.status === 'pending'; }).length;
    var filtered = af.status || af.date;
    $('#adminSummary').innerHTML = (pend ? pend + ' pengajuan menunggu keputusan.' : 'Tidak ada pengajuan yang menunggu keputusan.') +
      (filtered ? ' Menampilkan ' + rows.length + ' dari ' + all.length + '. <button class="link" data-act="clear-admin">Hapus filter</button>' : '');
    if (!rows.length) { $('#adminTable').innerHTML = '<p class="muted" style="padding:12px 0">' + (filtered ? 'Tidak ada pengajuan dengan filter ini.' : 'Belum ada pengajuan masuk.') + '</p>'; return; }
    $('#adminTable').innerHTML =
      '<table class="tbl"><thead><tr><th>Pemohon</th><th>Ruangan</th><th>Tanggal</th><th>Jam</th><th>Status</th><th>Aksi</th></tr></thead><tbody>' +
      rows.map(function (b) {
        return '<tr><td data-label="Pemohon"><div><span class="nm">' + esc(b.name) + '</span><small>' + esc(b.org) + ', ' + b.people + ' orang</small><small>' + esc(b.purpose) + '</small></div></td>' +
          '<td data-label="Ruangan"><div>' + esc(shortName(roomById(b.roomId).name)) + '</div></td>' +
          '<td data-label="Tanggal" class="nowrap"><div>' + fmtShort(b.date) + '</div></td>' +
          '<td data-label="Jam" class="nowrap"><div>' + fmtRange(b.start, b.end) + '</div></td>' +
          '<td data-label="Status"><div><span class="badge ' + b.status + '">' + STATUS[b.status] + '</span>' + (b.status === 'rejected' && b.reason ? '<small>' + esc(b.reason) + '</small>' : '') + (b.decidedBy ? '<small>Oleh ' + esc(b.decidedBy) + '</small>' : '') + '</div></td>' +
          '<td data-label="Aksi">' + (b.status === 'pending'
            ? '<div class="act"><button class="btn btn-ok btn-sm" data-act="approve" data-id="' + b.id + '">Setujui</button><button class="btn btn-danger btn-sm" data-act="reject" data-id="' + b.id + '">Tolak</button></div>'
            : '<div class="muted">\u2014</div>') + '</td></tr>';
      }).join('') + '</tbody></table>';
  }
  function addAudit(adm, action, target, note) {
    store.set('audit', store.get('audit', []).concat([{ id: Date.now() + Math.random(), at: Date.now(), adminEmail: adm.email, adminName: adm.name, action: action, target: target, note: note || '' }]));
  }
  function bookingText(b) { return b.name + ', ' + roomById(b.roomId).name + ', ' + fmtShort(b.date) + ', ' + fmtRange(b.start, b.end); }
  function setStatus(id, status, reason) {
    var adm = currentUser();
    if (!adm || adm.role !== 'admin') { toast('Hanya admin yang dapat memutuskan pengajuan.', 'bad'); return false; }
    reason = (reason || '').trim();
    if (status === 'rejected' && !reason) { toast('Alasan penolakan wajib diisi.', 'bad'); return false; }
    var hit, now = Date.now();
    var list = bookings().map(function (b) {
      if (b.id === id && b.status === 'pending') { b.status = status; b.reason = reason; b.decidedBy = adm.name; b.decidedByEmail = adm.email; b.decidedAt = now; hit = b; }
      return b;
    });
    if (!hit) { toast('Pengajuan ini sudah diputuskan atau tidak ditemukan.', 'bad'); drawAdmin(); return false; }
    store.set('bookings', list);
    pushNotif(hit, status, reason);
    addAudit(adm, status, bookingText(hit), reason);
    drawAdmin();
    var sm = $('#adminSummary'); if (sm) sm.focus();
    return true;
  }
  function drawAdminSched() {
    var d = as.date, act = bookings().filter(function (b) { return b.date === d && (b.status === 'pending' || b.status === 'approved'); });
    var head = '<tr><th>Ruangan</th>' + SLOT_HOURS.map(function (h) { return '<th>' + pad(h) + '.00</th>'; }).join('') + '</tr>';
    var body = ROOMS.map(function (r) {
      return '<tr><td data-label="Ruangan"><div><span class="nm">' + esc(shortName(r.name)) + '</span><small>' + esc(r.gedung) + '</small></div></td>' + SLOT_HOURS.map(function (h) {
        var b = act.filter(function (x) { return x.roomId === r.id && h >= x.start && h < x.end; })[0], cell;
        if (b) cell = '<span class="badge ' + b.status + '">' + (b.status === 'approved' ? SLOT_LABEL.booked : SLOT_LABEL.pending) + '</span><small>' + esc(b.name) + '</small>';
        else if (!openHour(r, d, h)) cell = '<span class="muted">Tutup</span>';
        else cell = '<span class="muted">\u2014</span>';
        return '<td data-label="' + fmtRange(h, h + 1) + '"><div>' + cell + '</div></td>';
      }).join('') + '</tr>';
    }).join('');
    $('#adminPane').innerHTML = '<section class="card"><div class="sched-head"><div><h2 class="h">Jadwal semua ruangan</h2><p class="sec-note">' + fmtLong(d) + '. Pengajuan menunggu dan reservasi yang disetujui.</p></div>' +
      '<div class="datenav"><button class="btn btn-ghost" data-act="admin-day-prev" aria-label="Hari sebelumnya">\u2039</button>' +
      '<input type="date" id="aSchedDate" aria-label="Tanggal jadwal" value="' + d + '">' +
      '<button class="btn btn-ghost" data-act="admin-day-next" aria-label="Hari berikutnya">\u203a</button></div></div>' +
      '<div class="tbl-wrap"><table class="tbl"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div></section>';
  }
  function drawAdminRooms() {
    $('#adminPane').innerHTML = '<section class="card"><div class="sched-head"><div><h2 class="h">Kelola ruangan</h2><p class="sec-note">Tambah, ubah, atau hapus ruangan, dan atur hari serta jam operasionalnya.</p></div>' +
      '<button type="button" class="btn btn-primary btn-sm" data-act="room-add">Tambah ruangan</button></div>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Ruangan</th><th>Jenis</th><th>Kapasitas</th><th>Operasional</th><th>Aksi</th></tr></thead><tbody>' +
      ROOMS.map(function (r) {
        return '<tr><td data-label="Ruangan"><div><span class="nm">' + esc(r.name) + '</span><small>' + esc(r.gedung) + '</small></div></td>' +
          '<td data-label="Jenis"><div>' + esc(r.type) + '</div></td>' +
          '<td data-label="Kapasitas" class="nowrap"><div>' + r.cap + ' orang</div></td>' +
          '<td data-label="Operasional"><div>' + esc(daysLabel(r.days)) + '<small>' + fmtRange(r.open, r.close) + '</small></div></td>' +
          '<td data-label="Aksi"><div class="act"><button class="btn btn-ghost btn-sm" data-act="room-edit" data-id="' + r.id + '">Ubah</button><button class="btn btn-danger btn-sm" data-act="room-del" data-id="' + r.id + '">Hapus</button></div></td></tr>';
      }).join('') + '</tbody></table></div></section>';
  }
  var AUDIT_LABEL = { approved: 'Disetujui', rejected: 'Ditolak', 'room-add': 'Ruangan ditambah', 'room-edit': 'Ruangan diubah', 'room-del': 'Ruangan dihapus' };
  function drawAdminLog() {
    var log = store.get('audit', []).slice().reverse();
    var fmtAt = function (t) { return new Date(t).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };
    $('#adminPane').innerHTML = '<section class="card"><h2 class="h">Riwayat keputusan</h2><p class="sec-note" style="margin-bottom:12px">Setiap keputusan admin tercatat beserta waktu dan keterangannya.</p>' +
      (log.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Waktu</th><th>Admin</th><th>Keputusan</th><th>Rincian</th><th>Keterangan</th></tr></thead><tbody>' +
        log.map(function (a) {
          var cls = a.action === 'approved' ? 'approved' : a.action === 'rejected' ? 'rejected' : 'pending';
          return '<tr><td data-label="Waktu" class="nowrap"><div>' + fmtAt(a.at) + '</div></td>' +
            '<td data-label="Admin"><div><span class="nm">' + esc(a.adminName) + '</span><small>' + esc(a.adminEmail) + '</small></div></td>' +
            '<td data-label="Keputusan"><div><span class="badge ' + cls + '">' + esc(AUDIT_LABEL[a.action] || a.action) + '</span></div></td>' +
            '<td data-label="Rincian"><div>' + esc(a.target) + '</div></td>' +
            '<td data-label="Keterangan"><div>' + (a.note ? esc(a.note) : '<span class="muted">\u2014</span>') + '</div></td></tr>';
        }).join('') + '</tbody></table></div>'
        : '<p class="muted" style="padding:12px 0">Belum ada keputusan yang tercatat.</p>') + '</section>';
  }
  function roomFormHTML(r) {
    var hrs = function (from, to, sel) { var o = ''; for (var h = from; h <= to; h++) o += '<option value="' + h + '"' + (h === sel ? ' selected' : '') + '>' + pad(h) + '.00</option>'; return o; };
    var gl = ROOMS.map(function (x) { return x.gedung; }).filter(function (g, i, a) { return a.indexOf(g) === i; });
    return '<h2 class="h" style="margin-bottom:12px">' + (r.id ? 'Ubah ruangan' : 'Tambah ruangan') + '</h2>' +
      '<form id="roomForm" novalidate data-id="' + esc(r.id) + '">' +
        '<div class="field"><label for="rfName">Nama ruangan</label><input id="rfName" maxlength="60" placeholder="cth. Ruang Diskusi A1.4" value="' + esc(r.name) + '"><span class="err" id="rfNameE"></span></div>' +
        '<div class="row2"><div class="field"><label for="rfGedung">Gedung</label><input id="rfGedung" list="rfGedungList" placeholder="cth. Gedung A" value="' + esc(r.gedung) + '"><datalist id="rfGedungList">' + gl.map(function (g) { return '<option value="' + esc(g) + '">'; }).join('') + '</datalist><span class="err" id="rfGedungE"></span></div>' +
        '<div class="field"><label for="rfType">Jenis</label><select id="rfType">' + ROOM_TYPES.map(function (t) { return '<option' + (r.type === t ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select></div></div>' +
        '<div class="field"><label for="rfCap">Kapasitas (orang)</label><input type="number" id="rfCap" min="1" inputmode="numeric" value="' + esc(r.cap) + '"><span class="err" id="rfCapE"></span></div>' +
        '<div class="field"><label for="rfFas">Fasilitas</label><input id="rfFas" placeholder="Proyektor, AC, Papan tulis" value="' + esc(r.fas.join(', ')) + '"><span class="hint">Pisahkan dengan koma.</span></div>' +
        '<fieldset class="checks"><legend>Hari operasional</legend>' + [1, 2, 3, 4, 5, 6, 0].map(function (d) { return '<label><input type="checkbox" name="rfDay" value="' + d + '"' + (r.days.indexOf(d) > -1 ? ' checked' : '') + '>' + DAY_NAMES[d] + '</label>'; }).join('') + '</fieldset><span class="err" id="rfDaysE" style="display:block;margin:-8px 0 14px"></span>' +
        '<div class="row2"><div class="field"><label for="rfOpen">Jam buka</label><select id="rfOpen">' + hrs(8, 16, r.open) + '</select></div><div class="field"><label for="rfClose">Jam tutup</label><select id="rfClose">' + hrs(9, 17, r.close) + '</select></div></div>' +
        '<span class="err" id="rfTimeE" style="display:block;margin:-6px 0 14px"></span>' +
        '<button class="btn btn-primary" type="submit">Simpan ruangan</button>' +
      '</form>';
  }
  function saveRoom() {
    var adm = currentUser();
    if (!adm || adm.role !== 'admin') { toast('Hanya admin yang dapat mengelola ruangan.', 'bad'); return; }
    var id = $('#roomForm').dataset.id, old = id ? roomById(id) : null;
    var name = $('#rfName').value.trim(), gedung = $('#rfGedung').value.trim(), type = $('#rfType').value;
    var capRaw = $('#rfCap').value.trim(), cap = Number(capRaw);
    var fas = $('#rfFas').value.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
    var days = Array.prototype.map.call(document.querySelectorAll('input[name="rfDay"]:checked'), function (i) { return parseInt(i.value, 10); });
    var open = parseInt($('#rfOpen').value, 10), close = parseInt($('#rfClose').value, 10), e = {};
    if (name.length < 3) e.name = 'Isi nama ruangan (minimal 3 karakter).';
    else if (ROOMS.some(function (r) { return r.id !== id && r.name.toLowerCase() === name.toLowerCase(); })) e.name = 'Nama ruangan ini sudah dipakai.';
    if (!gedung) e.gedung = 'Isi nama gedung.';
    if (!capRaw || !Number.isInteger(cap) || cap < 1) e.cap = 'Kapasitas harus bilangan bulat, minimal 1.';
    else if (cap > 500) e.cap = 'Kapasitas maksimal 500 orang.';
    if (!days.length) e.days = 'Pilih minimal satu hari operasional.';
    if (!(close > open)) e.time = 'Jam tutup harus lebih besar dari jam buka.';
    else if (old && !e.days) {
      var cand = { name: old.name, days: days, open: open, close: close };
      var n = bookings().filter(function (b) { return b.roomId === id && (b.status === 'pending' || b.status === 'approved') && !isEnded(b) && outsideReason(cand, b.date, b.start, b.end); }).length;
      if (n) e.time = 'Ada ' + n + ' reservasi aktif di luar hari atau jam baru. Tolak atau batalkan dulu reservasi itu.';
    }
    setErr('rfNameE', e.name); setErr('rfGedungE', e.gedung); setErr('rfCapE', e.cap); setErr('rfDaysE', e.days); setErr('rfTimeE', e.time);
    markInvalid(['rfName'], !!e.name); markInvalid(['rfGedung'], !!e.gedung); markInvalid(['rfCap'], !!e.cap);
    var first = [['name', 'rfName'], ['gedung', 'rfGedung'], ['cap', 'rfCap'], ['days', 'rfOpen'], ['time', 'rfOpen']].filter(function (o) { return e[o[0]]; })[0];
    if (first) { $('#' + first[1]).focus(); return; }
    var room = { id: id || 'r' + Date.now().toString(36), name: name, gedung: gedung, type: type, cap: cap, fas: fas, days: days, open: open, close: close };
    var list = id ? ROOMS.map(function (r) { return r.id === id ? room : r; }) : ROOMS.concat([room]);
    store.set('rooms', list); loadRooms();
    addAudit(adm, id ? 'room-edit' : 'room-add', name + ', ' + gedung, '');
    $('#infoDlg').close();
    drawAdminRooms();
    toast(id ? 'Ruangan diperbarui.' : 'Ruangan ditambahkan.', 'ok');
  }

  function viewRoadmap() {
    var cu = currentUser();
    if (!cu || cu.role !== 'admin') {
      guard('Halaman ini khusus admin', 'Rencana pengembangan hanya dapat dilihat oleh admin.', '<a class="btn btn-primary btn-block" href="#/rooms">Kembali ke Daftar Ruangan</a>');
      return;
    }
    var INC = [
      ['Increment 1: Akun dan ruangan', 'Daftar, masuk, daftar ruangan dengan filter gedung, kapasitas, dan fasilitas.', 1],
      ['Increment 2: Jadwal dan booking', 'Slot per jam, form pengajuan, cek bentrok, dan pembatalan pengajuan.', 1],
      ['Increment 3: Persetujuan admin', 'Dashboard admin, setujui atau tolak dengan alasan, dan notifikasi ke pemohon.', 1],
      ['Increment 4: Wawasan dan kenyamanan', 'Statistik admin, ketersediaan 7 hari, penjaga bentrok saat menyetujui, tampilan baru.', 1],
      ['Increment 5: Siap produksi', 'Database dan login kampus (SSO), pengajuan berulang, ekspor rekap, dan check-in QR.', 0]
    ];
    main.innerHTML = '<section class="card"><h2 class="h">Rencana pengembangan bertahap</h2><p class="sec-note">Setiap increment menghasilkan versi yang sudah bisa dipakai. Increment berikutnya menambah fitur tanpa membongkar yang sudah jalan.</p><ul class="inc">' +
      INC.map(function (i) { return '<li><div class="hd"><b>' + i[0] + '</b><span class="badge ' + (i[2] ? 'approved' : 'pending') + '">' + (i[2] ? 'Sudah rilis' : 'Berikutnya') + '</span></div><p>' + i[1] + '</p></li>'; }).join('') + '</ul></section>';
  }
  /* ---------- Router ---------- */
  function route() {
    var h = (location.hash || '').replace('#/', '');
    if (!h) return isAdmin() ? 'admin' : 'rooms';
    return ROUTES[h] ? h : (isAdmin() ? 'admin' : 'rooms');
  }
  var VIEWS = { design: viewDesign, login: viewLogin, rooms: viewRooms, book: viewBook, admin: viewAdmin, roadmap: viewRoadmap };
  function renderGate() {
    document.body.classList.add('gate');
    viewLogin();
    main.insertAdjacentHTML('afterbegin', '<div class="gate-brand"><div style="font-size:34px" aria-hidden="true">🏫</div><h1 class="brand-title">Reservasi Ruang Kampus</h1><p class="brand-sub" style="margin:8px auto 0">Masuk dulu untuk mengecek jadwal ruangan, mengajukan pemakaian, dan menerima notifikasi persetujuan.</p><button class="link" data-act="theme" style="margin-top:8px">' + (theme === 'dark' ? 'Tema terang' : 'Tema gelap') + '</button></div>');
    main.insertAdjacentHTML('beforeend', '<p class="switch"><a class="link" href="#/rooms">← Lihat ruangan tanpa masuk</a></p>');
    document.title = 'Masuk · Reservasi Ruang Kampus';
  }
  function render() {
    if (!currentUser() && route() === 'login') { renderGate(); return; }
    document.body.classList.remove('gate');
    render0();
  }
  function render0() {
    var r = route();
    renderChrome(r);
    VIEWS[r]();
    document.title = ROUTES[r] + ' · Reservasi Ruang Kampus';
  }
  window.addEventListener('hashchange', function () { render(); window.scrollTo(0, 0); main.focus({ preventScroll: true }); });

  /* ---------- Events ---------- */
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ACTIONS = {
    'theme': function () { theme = theme === 'dark' ? 'light' : 'dark'; store.set('theme', theme); applyTheme(); render(); },
    'logout': function () {
      store.del('session'); toast('Anda sudah keluar.');
      if (route() === 'login') render();
      else if (route() === 'rooms') render();
      else location.hash = '#/rooms';
    },
    'to-register': function () { authMode = 'register'; render(); var i = $('#rName'); if (i) i.focus(); },
    'to-login': function () { authMode = 'login'; render(); var i = $('#lEmail'); if (i) i.focus(); },
    'toggle-pass': function (el) {
      var i = $('#' + el.dataset.target), show = i.type === 'password';
      i.type = show ? 'text' : 'password'; el.textContent = show ? 'Sembunyikan' : 'Tampilkan';
    },
    'fill-demo': function (el) {
      var admin = el.dataset.role === 'admin';
      $('#lEmail').value = admin ? 'admin@kampus.ac.id' : 'mahasiswa@kampus.ac.id';
      $('#lPass').value = admin ? 'admin123' : 'mahasiswa123';
      $('#lRole').value = admin ? 'admin' : 'user';
      $('#lEmail').focus();
    },
    'copy-hex': function (el) {
      var hex = el.dataset.hex;
      try { navigator.clipboard.writeText(hex).then(function () { toast('Warna ' + hex + ' disalin.', 'ok'); }, function () { toast('Salin manual: ' + hex); }); }
      catch (e) { toast('Salin manual: ' + hex); }
    },
    'reset-rooms': function () { rs.gedung = ''; rs.type = ''; rs.cap = 0; rs.fas = []; rs.now = false; viewRooms(); },
    'pick-room': function (el) {
      rs.roomId = el.dataset.id; drawRooms();
      var b = $('[data-act="pick-room"][data-id="' + rs.roomId + '"]'); if (b) b.focus({ preventScroll: true });
      $('#schedule').scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
    },
    'day-prev': function () {
      if (rs.date <= todayISO()) return;
      rs.date = addDays(rs.date, -1); drawRooms();
      var b = $('[data-act="day-prev"]');
      if (b && !b.disabled) b.focus(); else { b = $('[data-act="day-next"]'); if (b) b.focus(); }
    },
    'day-next': function () { rs.date = addDays(rs.date, 1); drawRooms(); var b = $('[data-act="day-next"]'); if (b) b.focus(); },
    'pick-slot': function (el) {
      if (isAdmin()) return;
      var h = parseInt(el.dataset.hour, 10);
      draft.roomId = rs.roomId; draft.date = rs.date; draft.start = h; draft.end = h + 1;
      if (!currentUser()) { nextRoute = '#/book'; toast('Masuk dulu untuk mengajukan reservasi.'); location.hash = '#/login'; return; }
      location.hash = '#/book';
    },
    'strip-slot': function (el) {
      draft.start = parseInt(el.dataset.hour, 10); draft.end = draft.start + 1;
      fillStart(); fillEnd(); drawStrip(); setErr('bTimeE', ''); markInvalid(['bStart', 'bEnd'], false);
      var b = $('[data-act="strip-slot"][data-hour="' + draft.start + '"]'); if (b) b.focus();
    },
    'cancel-booking': function (el) {
      var u = currentUser(); if (!u || u.role !== 'user') return;
      var b = bookings().filter(function (x) { return x.id === el.dataset.id; })[0];
      if (!b || b.email !== u.email) { toast('Reservasi ini bukan milik Anda.', 'bad'); return; }
      if (b.status !== 'pending' && b.status !== 'approved') return;
      if (isEnded(b)) { toast('Reservasi ini sudah lewat dan tidak bisa dibatalkan.', 'bad'); return; }
      if (b.status === 'approved' && !window.confirm('Batalkan reservasi yang sudah disetujui ini?')) return;
      store.set('bookings', bookings().map(function (x) { if (x.id === b.id) { x.status = 'cancelled'; x.cancelledAt = Date.now(); } return x; }));
      users().filter(function (a) { return a.role === 'admin'; }).forEach(function (a) {
        store.set('notifs', notifs().concat([{ id: Date.now() + Math.random(), email: a.email, kind: 'cancelled', read: false, text: u.name + ' membatalkan reservasi.', sub: roomById(b.roomId).name + ', ' + fmtShort(b.date) + ', ' + fmtRange(b.start, b.end) }]));
      });
      drawMine(); drawStrip(); toast('Reservasi dibatalkan. Slot kembali kosong.');
    },
    'approve': function (el) {
      var b = bookings().filter(function (x) { return x.id === el.dataset.id; })[0];
      if (setStatus(el.dataset.id, 'approved')) toast('Pengajuan ' + b.name + ' disetujui.', 'ok');
    },
    'reject': function (el) {
      if (!isAdmin()) { toast('Hanya admin yang dapat menolak pengajuan.', 'bad'); return; }
      var b = bookings().filter(function (x) { return x.id === el.dataset.id; })[0];
      if (!b || b.status !== 'pending') { toast('Pengajuan ini sudah diputuskan.', 'bad'); drawAdmin(); return; }
      var dlg = $('#dlg');
      setErr('dlgReasonE', ''); markInvalid(['dlgReason'], false);
      $('#dlgText').textContent = shortName(roomById(b.roomId).name) + ', ' + fmtShort(b.date) + ', ' + fmtRange(b.start, b.end) + ', atas nama ' + b.name + '.';
      $('#dlgReason').value = ''; dlg.returnValue = '';
      var onClose = function () {
        dlg.removeEventListener('close', onClose);
        if (dlg.returnValue === 'ok') { if (setStatus(b.id, 'rejected', $('#dlgReason').value.trim())) toast('Pengajuan ' + b.name + ' ditolak.', 'bad'); }
        else { el.focus(); }
      };
      dlg.addEventListener('close', onClose);
      dlg.showModal();
    },
    'clear-admin': function () { af.status = ''; af.date = ''; $('#aStatus').value = ''; $('#aDate').value = ''; drawAdmin(); },
    'close-info': function () { $('#infoDlg').close(); },
    'mine-f': function (el) {
      mineF = el.dataset.k; drawMine();
      var b = $('[data-act="mine-f"][data-k="' + mineF + '"]'); if (b) b.focus();
    },
    'detail': function (el) {
      var r = roomById(el.dataset.id);
      $('#infoBody').innerHTML = '<h2 class="h">' + esc(r.name) + '</h2><p class="muted small" style="margin-bottom:14px">' + esc(r.type) + ', ' + esc(r.gedung) + ', kapasitas ' + r.cap + ' orang. Operasional ' + esc(daysLabel(r.days)) + ', ' + fmtRange(r.open, r.close) + '.</p>' +
        '<h3 class="h" style="font-size:15px;margin-bottom:8px">Fasilitas</h3><ul class="chips">' + r.fas.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul>' +
        '<h3 class="h" style="font-size:15px;margin:16px 0 0">Aturan penggunaan</h3>' +
        '<ul class="rules"><li>Maksimal ' + MAX_HOURS + ' jam per reservasi.</li><li>Wajib menjaga kebersihan dan merapikan ruangan.</li><li>Reservasi harus mendapat persetujuan admin.</li></ul>';
      $('#infoDlg').showModal();
    },
    'notif': function () {
      var u = currentUser(); if (!u) return;
      var list = notifs().filter(function (n) { return n.email === u.email; }).reverse();
      $('#infoBody').innerHTML = '<h2 class="h" style="margin-bottom:12px">Notifikasi</h2>' + (list.length
        ? '<ul class="mine nlist">' + list.map(function (n) {
            return '<li class="' + (n.read ? '' : 'unread') + '"><div class="nm">' + (n.kind === 'approved' ? '🟢 ' : n.kind === 'pending' ? '🟡 ' : '🔴 ') + esc(n.text) + '</div><div class="small muted">' + esc(n.sub) + '</div></li>';
          }).join('') + '</ul>'
        : '<p class="muted">Belum ada notifikasi.</p>');
      store.set('notifs', notifs().map(function (n) { if (n.email === u.email) n.read = true; return n; }));
      $('#infoDlg').showModal();
      renderChrome(route());
    }
  };
  ACTIONS['pick-day'] = function (el) { rs.date = el.dataset.date; drawRooms(); var b = $('[data-act="pick-day"][data-date="' + rs.date + '"]'); if (b) b.focus(); };
  ACTIONS.reserve = function (el) {
    if (isAdmin()) return;
    var id = el.dataset.id, m = slotMap(id, rs.date);
    var h = SLOT_HOURS.filter(function (x) { return slotState(rs.date, x, m) === 'free'; })[0];
    draft.roomId = id; draft.date = rs.date;
    if (h !== undefined) { draft.start = h; draft.end = h + 1; }
    if (!currentUser()) { nextRoute = '#/book'; toast('Masuk dulu untuk mengajukan reservasi.'); location.hash = '#/login'; return; }
    location.hash = '#/book';
  };
  var pick0 = ACTIONS['pick-room'];
  ACTIONS['pick-room'] = function (el) { var d = $('#infoDlg'); if (d.open) d.close(); pick0(el); };
  var reset0 = ACTIONS['reset-rooms'];
  ACTIONS['reset-rooms'] = function (el) { rs.q = ''; reset0(el); };
  var detail0 = ACTIONS.detail;
  ACTIONS.detail = function (el) {
    var r = roomById(el.dataset.id); detail0(el);
    $('#infoBody').insertAdjacentHTML('afterbegin', '<div class="ph">' + roomArt(r) + '</div>');
    var adm = currentUser(), own = store.get('photos', {})[r.id];
    $('#infoBody').insertAdjacentHTML('beforeend', '<div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn btn-primary btn-sm" data-act="pick-room" data-id="' + r.id + '">Lihat jadwal ruangan ini</button>' +
      (adm && adm.role === 'admin' ? '<button type="button" class="btn btn-ghost btn-sm" data-act="photo-pick">Ganti foto dari galeri</button>' + (own ? '<button type="button" class="btn btn-danger btn-sm" data-act="photo-del" data-id="' + r.id + '">Hapus foto</button>' : '') + '<input type="file" id="photoIn" accept="image/*" data-id="' + r.id + '" hidden>' : '') + '</div>');
  };
  ACTIONS['photo-pick'] = function () { var i = $('#photoIn'); if (i) i.click(); };
  ACTIONS['photo-del'] = function (el) {
    var ph = store.get('photos', {}); delete ph[el.dataset.id]; store.set('photos', ph);
    $('#infoDlg').close(); if ($('#roomList')) drawRooms(); toast('Foto kembali ke ilustrasi bawaan.');
  };
  function loadPhoto(file, id) {
    if (!/^image\//.test(file.type)) { toast('Pilih file gambar (JPG, PNG, atau WebP).', 'bad'); return; }
    var fr = new FileReader();
    fr.onload = function () {
      var im = new Image();
      im.onload = function () {
        var w = Math.min(900, im.width), h = Math.round(im.height * w / im.width), c = document.createElement('canvas');
        c.width = w; c.height = h; c.getContext('2d').drawImage(im, 0, 0, w, h);
        var ph = store.get('photos', {}); ph[id] = c.toDataURL('image/jpeg', 0.8); store.set('photos', ph);
        var box = $('#infoBody .ph'); if (box) box.innerHTML = roomArt(roomById(id));
        if ($('#roomList')) drawRooms();
        toast('Foto ruangan diperbarui.', 'ok');
      };
      im.onerror = function () { toast('File itu tidak bisa dibaca sebagai gambar.', 'bad'); };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  }
  ACTIONS.legal = function (el) {
    var syarat = el.dataset.k === 'syarat';
    $('#infoBody').innerHTML = '<h2 class="h" style="margin-bottom:10px">' + (syarat ? 'Syarat & Ketentuan' : 'Pernyataan Privasi') + '</h2>' + (syarat
      ? '<ul class="rules"><li>Pengajuan dibuat dengan akun sendiri dan dicatat atas nama pemohon.</li><li>Maksimal ' + MAX_HOURS + ' jam per pengajuan, dan wajib disetujui admin.</li><li>Admin dapat menolak pengajuan jika ruangan dipakai untuk kegiatan kampus.</li><li>Pemakai wajib menjaga kebersihan dan merapikan ruangan setelah dipakai.</li></ul>'
      : '<ul class="rules"><li>Nama, email, dan organisasi hanya dipakai untuk mencatat dan memproses pengajuan.</li><li>Pada versi demo ini data tersimpan di browser perangkat ini saja dan tidak dikirim ke server.</li><li>Untuk pemakaian sungguhan, web perlu dihubungkan ke database dan login kampus.</li></ul>');
    $('#infoDlg').showModal();
  };
  ACTIONS['admin-tab'] = function (el) {
    if (!isAdmin()) return;
    adminTab = el.dataset.k; drawAdminPane();
    var b = $('[data-act="admin-tab"][data-k="' + adminTab + '"]'); if (b) b.focus();
  };
  ACTIONS['admin-day-prev'] = function () { if (!isAdmin()) return; as.date = addDays(as.date, -1); drawAdminSched(); var b = $('[data-act="admin-day-prev"]'); if (b) b.focus(); };
  ACTIONS['admin-day-next'] = function () { if (!isAdmin()) return; as.date = addDays(as.date, 1); drawAdminSched(); var b = $('[data-act="admin-day-next"]'); if (b) b.focus(); };
  ACTIONS['room-add'] = function () {
    if (!isAdmin()) { toast('Hanya admin yang dapat mengelola ruangan.', 'bad'); return; }
    $('#infoBody').innerHTML = roomFormHTML({ id: '', name: '', gedung: '', type: 'Diskusi', cap: '', fas: [], days: [1, 2, 3, 4, 5], open: 8, close: 17 });
    $('#infoDlg').showModal();
  };
  ACTIONS['room-edit'] = function (el) {
    if (!isAdmin()) { toast('Hanya admin yang dapat mengelola ruangan.', 'bad'); return; }
    var r = ROOMS.filter(function (x) { return x.id === el.dataset.id; })[0]; if (!r) return;
    $('#infoBody').innerHTML = roomFormHTML(r);
    $('#infoDlg').showModal();
  };
  ACTIONS['room-del'] = function (el) {
    var adm = currentUser();
    if (!adm || adm.role !== 'admin') { toast('Hanya admin yang dapat mengelola ruangan.', 'bad'); return; }
    var r = ROOMS.filter(function (x) { return x.id === el.dataset.id; })[0]; if (!r) return;
    if (ROOMS.length <= 1) { toast('Minimal harus ada satu ruangan.', 'bad'); return; }
    var n = bookings().filter(function (b) { return b.roomId === r.id && (b.status === 'pending' || b.status === 'approved') && !isEnded(b); }).length;
    if (n) { toast(r.name + ' masih punya ' + n + ' reservasi aktif. Tolak atau batalkan dulu.', 'bad'); return; }
    if (!window.confirm('Hapus ' + r.name + '? Tindakan ini tidak bisa dibatalkan.')) return;
    store.set('rooms', ROOMS.filter(function (x) { return x.id !== r.id; })); loadRooms();
    var ph = store.get('photos', {}); if (ph[r.id]) { delete ph[r.id]; store.set('photos', ph); }
    addAudit(adm, 'room-del', r.name + ', ' + r.gedung, '');
    drawAdminRooms(); toast('Ruangan dihapus.');
  };
  var approve0 = ACTIONS.approve;
  ACTIONS.approve = function (el) {
    if (!isAdmin()) { toast('Hanya admin yang dapat menyetujui pengajuan.', 'bad'); return; }
    var b = bookings().filter(function (x) { return x.id === el.dataset.id; })[0];
    if (!b || b.status !== 'pending') { toast('Pengajuan ini sudah diputuskan.', 'bad'); drawAdmin(); return; }
    var clash = bookings().filter(function (o) { return o.id !== b.id && o.status === 'approved' && o.roomId === b.roomId && o.date === b.date && b.start < o.end && o.start < b.end; })[0];
    if (clash) { toast('Bentrok dengan reservasi ' + clash.name + ' (' + fmtRange(clash.start, clash.end) + '). Tolak pengajuan ini atau minta pemohon pilih jam lain.', 'bad'); return; }
    approve0(el);
  };
  document.addEventListener('click', function (e) {
    var okb = e.target.closest('#dlgForm button[value="ok"]');
    if (okb && !$('#dlgReason').value.trim()) {
      e.preventDefault();
      setErr('dlgReasonE', 'Alasan penolakan wajib diisi.'); markInvalid(['dlgReason'], true); $('#dlgReason').focus();
      return;
    }
    var el = e.target.closest('[data-act]');
    if (el && ACTIONS[el.dataset.act]) ACTIONS[el.dataset.act](el, e);
  });
  document.addEventListener('submit', function (e) {
    var id = e.target.id;
    if (id === 'loginForm') { e.preventDefault(); doLogin(); }
    else if (id === 'regForm') { e.preventDefault(); doRegister(); }
    else if (id === 'bookForm') { e.preventDefault(); submitBook(); }
    else if (id === 'roomForm') { e.preventDefault(); saveRoom(); }
  });
  document.addEventListener('input', function (e) {
    var id = e.target.id;
    if (id === 'fCap') { rs.cap = parseInt(e.target.value, 10) || 0; drawRooms(); }
    else if (id === 'bPeople') draft.people = e.target.value;
    else if (id === 'bPurpose') draft.purpose = e.target.value;
    else if (id === 'dlgReason') { setErr('dlgReasonE', ''); markInvalid(['dlgReason'], false); }
  });
  document.addEventListener('change', function (e) {
    var id = e.target.id, v = e.target.value;
    if (id === 'fGedung') { rs.gedung = v; drawRooms(); }
    else if (id === 'fJenis') { rs.type = v; drawRooms(); }
    else if (e.target.name === 'fas') {
      rs.fas = Array.prototype.map.call(document.querySelectorAll('input[name="fas"]:checked'), function (i) { return i.value; });
      drawRooms();
    }
    else if (id === 'fNow') { rs.now = e.target.checked; drawRooms(); }
    else if (id === 'schedDate') {
      if (v && v >= todayISO()) { rs.date = v; drawRooms(); var d = $('#schedDate'); if (d) d.focus(); }
      else { e.target.value = rs.date; }
    }
    else if (id === 'bRoom') { draft.roomId = v; fillStart(); fillEnd(); drawStrip(); setErr('bTimeE', ''); markInvalid(['bStart', 'bEnd'], false); }
    else if (id === 'bDate') { if (v) { draft.date = v; fillStart(); fillEnd(); drawStrip(); } }
    else if (id === 'bStart') { draft.start = parseInt(v, 10); fillEnd(); drawStrip(); }
    else if (id === 'bEnd') { draft.end = parseInt(v, 10); drawStrip(); }
    else if (id === 'aStatus') { af.status = v; drawAdmin(); }
    else if (id === 'aDate') { af.date = v; drawAdmin(); }
    else if (id === 'aSchedDate') { if (v && isAdmin()) { as.date = v; drawAdminSched(); var sd = $('#aSchedDate'); if (sd) sd.focus(); } }
  });

  document.addEventListener('change', function (e) { if (e.target.id === 'photoIn' && e.target.files[0]) { loadPhoto(e.target.files[0], e.target.dataset.id); e.target.value = ''; } });
  document.addEventListener('input', function (e) { if (e.target.id === 'fQ') { rs.q = e.target.value.trim(); drawRooms(); } });
  document.addEventListener('submit', function (e) { if (e.target.id === 'qForm') { e.preventDefault(); drawRooms(); } });
  window.addEventListener('storage', function () { if (currentUser()) renderChrome(route()); });

  /* ---------- Init ---------- */
  applyTheme();
  seedRooms();
  seed();
  loadRooms();
  rs.date = draft.date = defaultDate();
  render();
})();
