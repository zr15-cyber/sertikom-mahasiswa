const state = {
  user: null,
  documents: [],
  notifications: [],
  schedules: [],
  users: []
};

const authScreen = document.getElementById('authScreen');
const appScreen = document.getElementById('appScreen');
const loginPanel = document.getElementById('loginPanel');
const registerPanel = document.getElementById('registerPanel');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const logoutBtn = document.getElementById('logoutBtn');
const notifCount = document.getElementById('notifCount');
const userName = document.getElementById('userName');
const userRole = document.getElementById('userRole');
const userAvatar = document.getElementById('userAvatar');
const fileTableBody = document.getElementById('fileTableBody');
const notificationList = document.getElementById('notificationList');
const scheduleList = document.getElementById('scheduleList');
const userTableBody = document.getElementById('userTableBody');
const verifyTableBody = document.getElementById('verifyTableBody');
const recentActivity = document.getElementById('recentActivity');
const verifyModal = document.getElementById('verifyModal');
const verifyForm = document.getElementById('verifyForm');

function setActiveMode(mode) {
  document.querySelectorAll('.mode-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  loginPanel.classList.toggle('active-panel', mode === 'login');
  registerPanel.classList.toggle('active-panel', mode === 'register');
}

function getInitials(name) {
  return name.split(' ').map((word) => word[0]).join('').slice(0, 2).toUpperCase();
}

function showAuthScreen() {
  authScreen.classList.remove('hidden');
  appScreen.classList.add('hidden');
}

function showAppScreen() {
  authScreen.classList.add('hidden');
  appScreen.classList.remove('hidden');
}

async function fetchSession() {
  try {
    const response = await fetch('/api/session');
    const data = await response.json();
    state.user = data.user;

    if (state.user) {
      renderUserInfo();
      await loadDashboard();
      await loadDocuments();
      await loadNotifications();
      await loadSchedules();
      if (state.user.role === 'admin') {
        await loadUsers();
        await loadVerifyDocuments();
      }
      document.body.classList.toggle('role-admin', state.user.role === 'admin');
      showAppScreen();
    } else {
      document.body.classList.remove('role-admin');
      showAuthScreen();
    }
  } catch (error) {
    console.error('Session error:', error);
    showAuthScreen();
  }
}

async function loadDashboard() {
  try {
    const response = await fetch('/api/dashboard');
    const data = await response.json();
    const stats = data.stats || {};
    document.getElementById('totalMahasiswa').textContent = stats.totalMahasiswa ?? 0;
    document.getElementById('totalFiles').textContent = stats.totalFiles ?? 0;
    document.getElementById('totalSchedule').textContent = stats.totalSchedule ?? 0;
    document.getElementById('totalNotif').textContent = stats.totalNotif ?? 0;
    notifCount.textContent = stats.totalNotif ?? 0;

    recentActivity.innerHTML = '';
    (data.recentActivity || []).forEach((item) => {
      const li = document.createElement('li');
      li.textContent = item;
      recentActivity.appendChild(li);
    });
  } catch (error) {
    console.error('Dashboard error:', error);
  }
}

async function loadDocuments() {
  try {
    const response = await fetch('/api/documents');
    const data = await response.json();
    state.documents = data.documents || [];
    fileTableBody.innerHTML = '';
    
    if (state.documents.length === 0) {
      fileTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #999;">Belum ada file</td></tr>';
      return;
    }

    state.documents.forEach((doc) => {
      const tr = document.createElement('tr');
      const uploadDate = new Date(doc.uploaded_at).toLocaleDateString('id-ID');
      const statusClass = doc.status === 'Terverifikasi' ? 'success' : (doc.status === 'Ditolak' ? 'danger' : 'pending');
      tr.innerHTML = `
        <td>${doc.title}</td>
        <td>${doc.type}</td>
        <td><span class="status-badge ${statusClass}">${doc.status}</span></td>
        <td>${uploadDate}</td>
      `;
      fileTableBody.appendChild(tr);
    });
  } catch (error) {
    console.error('Documents error:', error);
  }
}

async function loadNotifications() {
  try {
    const response = await fetch('/api/notifications');
    const data = await response.json();
    state.notifications = data.notifications || [];
    notificationList.innerHTML = '';
    
    if (state.notifications.length === 0) {
      notificationList.innerHTML = '<li style="color: #999;">Belum ada notifikasi</li>';
      return;
    }

    state.notifications.forEach((item) => {
      const li = document.createElement('li');
      li.textContent = item.message || item;
      notificationList.appendChild(li);
    });
    
    notifCount.textContent = state.notifications.length;
  } catch (error) {
    console.error('Notifications error:', error);
  }
}

async function loadSchedules() {
  try {
    const response = await fetch('/api/schedules');
    const data = await response.json();
    state.schedules = data.schedules || [];
    scheduleList.innerHTML = '';
    
    if (state.schedules.length === 0) {
      scheduleList.innerHTML = '<li style="color: #999;">Belum ada jadwal</li>';
      return;
    }

    state.schedules.forEach((item) => {
      const li = document.createElement('li');
      const schedDate = new Date(item.date).toLocaleDateString('id-ID');
      li.textContent = `${item.title} - ${schedDate} ${item.time}`;
      scheduleList.appendChild(li);
    });
  } catch (error) {
    console.error('Schedules error:', error);
  }
}

async function loadUsers() {
  try {
    const response = await fetch('/api/users');
    const data = await response.json();
    state.users = data.users || [];
    userTableBody.innerHTML = '';
    
    if (state.users.length === 0) {
      userTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #999;">Tidak ada pengguna</td></tr>';
      return;
    }

    state.users.forEach((user) => {
      const tr = document.createElement('tr');
      const status = user.role === 'admin' ? 'Aktif' : 'Online';
      tr.innerHTML = `
        <td>${user.name}</td>
        <td>${user.email}</td>
        <td><span class="status-badge success">${user.role.charAt(0).toUpperCase() + user.role.slice(1)}</span></td>
        <td>${status}</td>
      `;
      userTableBody.appendChild(tr);
    });
  } catch (error) {
    console.error('Users error:', error);
  }
}

async function loadVerifyDocuments() {
  try {
    const response = await fetch('/api/documents');
    const data = await response.json();
    const docs = data.documents || [];
    verifyTableBody.innerHTML = '';
    
    const pendingDocs = docs.filter(d => d.status === 'Terkirim' || d.status === 'Diproses');
    
    if (pendingDocs.length === 0) {
      verifyTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #999;">Belum ada dokumen untuk diverifikasi</td></tr>';
      return;
    }

    pendingDocs.forEach((doc) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${doc.user_email}</td>
        <td>${doc.title}</td>
        <td><span class="status-badge pending">${doc.status}</span></td>
        <td>
          <div class="btn-group">
            <button class="btn-small btn-verify" onclick="openVerifyModal('${doc.id}')">✓ Verifikasi</button>
            <button class="btn-small btn-reject" onclick="openVerifyModal('${doc.id}')">✕ Tolak</button>
          </div>
        </td>
      `;
      verifyTableBody.appendChild(tr);
    });
  } catch (error) {
    console.error('Verify documents error:', error);
  }
}

function renderUserInfo() {
  if (!state.user) return;
  userName.textContent = state.user.name;
  userRole.textContent = state.user.role === 'admin' ? 'Admin' : 'User';
  userAvatar.textContent = getInitials(state.user.name);
}

document.querySelectorAll('.mode-btn').forEach((btn) => {
  btn.addEventListener('click', () => setActiveMode(btn.dataset.mode));
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Login gagal');
    alert(result.message);
    loginForm.reset();
    await fetchSession();
  } catch (error) {
    alert(error.message);
  }
});

registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = document.getElementById('registerName').value.trim();
  const email = document.getElementById('registerEmail').value.trim();
  const password = document.getElementById('registerPassword').value;

  try {
    const response = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Registrasi gagal');
    alert(result.message);
    registerForm.reset();
    setActiveMode('login');
    await fetchSession();
  } catch (error) {
    alert(error.message);
  }
});

logoutBtn.addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  state.user = null;
  document.body.classList.remove('role-admin');
  showAuthScreen();
  setActiveMode('login');
});

document.querySelectorAll('.nav-btn').forEach((button) => {
  button.addEventListener('click', () => {
    const target = button.dataset.target;
    document.querySelectorAll('.nav-btn').forEach((btn) => btn.classList.remove('active'));
    button.classList.add('active');
    document.querySelectorAll('.panel').forEach((panel) => panel.classList.remove('active-panel'));
    const selectedPanel = document.getElementById(target);
    if (selectedPanel) selectedPanel.classList.add('active-panel');
    document.getElementById('pageTitle').textContent = button.textContent.trim();
  });
});

document.getElementById('uploadForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const fileInput = document.getElementById('fileInput');
  const file = fileInput.files[0];
  const title = document.getElementById('docTitle').value.trim();
  const type = document.getElementById('docType').value;

  if (!file || !title || !type) {
    alert('Judul, jenis, dan file wajib diisi.');
    return;
  }

  const formData = new FormData();
  formData.append('title', title);
  formData.append('type', type);
  formData.append('file', file);

  try {
    const response = await fetch('/api/documents', { method: 'POST', body: formData });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Upload gagal');
    alert(result.message);
    document.getElementById('uploadForm').reset();
    await loadDocuments();
    await loadNotifications();
    await loadDashboard();
  } catch (error) {
    alert(error.message);
  }
});

document.getElementById('scheduleForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const title = document.getElementById('scheduleTitle').value.trim();
  const date = document.getElementById('scheduleDate').value;
  const time = document.getElementById('scheduleTime').value;
  const description = document.getElementById('scheduleDesc').value || '';

  try {
    const response = await fetch('/api/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, date, time, description })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Gagal menyimpan jadwal');
    alert(result.message);
    document.getElementById('scheduleForm').reset();
    await loadSchedules();
    await loadNotifications();
    await loadDashboard();
  } catch (error) {
    alert(error.message);
  }
});

function openVerifyModal(docId) {
  document.getElementById('verifyDocId').value = docId;
  document.getElementById('verifyStatus').value = '';
  document.getElementById('verifyNotes').value = '';
  verifyModal.classList.remove('hidden');
}

function closeVerifyModal() {
  verifyModal.classList.add('hidden');
  verifyForm.reset();
}

verifyForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const docId = document.getElementById('verifyDocId').value;
  const status = document.getElementById('verifyStatus').value;
  const notes = document.getElementById('verifyNotes').value;

  if (!status) {
    alert('Pilih status verifikasi terlebih dahulu');
    return;
  }

  try {
    const response = await fetch(`/api/documents/${docId}/verify`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, notes })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Verifikasi gagal');
    alert(result.message);
    closeVerifyModal();
    await loadVerifyDocuments();
    await loadDashboard();
  } catch (error) {
    alert(error.message);
  }
});

fetchSession();
