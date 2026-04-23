const API_BASE_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" ? "http://localhost:3000" : ""; // Uses vercel.json rewrite in production

document.addEventListener("DOMContentLoaded", async () => {
  const logoutBtn = document.getElementById("logoutBtn");
  const adminStatus = document.getElementById("adminStatus");
  const cleanupBtn = document.getElementById("cleanupBtn");
  const cleanupStatus = document.getElementById("cleanupStatus");

  // Check auth
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/me`, { credentials: "include" });
    if (!res.ok) {
      window.location.href = "/";
      return;
    }
    const data = await res.json();
    if (data.user.role !== "admin") {
      window.location.href = "/";
      return;
    }
  } catch (err) {
    window.location.href = "/";
    return;
  }

  logoutBtn.addEventListener("click", async () => {
    await fetch(`${API_BASE_URL}/api/auth/logout`, { method: "POST", credentials: "include" });
    window.location.href = "/";
  });

  async function loadStats() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/stats`, { credentials: "include" });
      const data = await res.json();
      document.getElementById("statUsers").textContent = data.totalUsers;
      document.getElementById("statConv").textContent = data.totalConversions;
      document.getElementById("statSuccess").textContent = data.successfulConversions;
      document.getElementById("statFail").textContent = data.failedConversions;
    } catch (err) {
      adminStatus.textContent = "Failed to load stats.";
    }
  }

  async function loadUsers() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/users`, { credentials: "include" });
      const users = await res.json();
      const tbody = document.getElementById("usersTableBody");
      tbody.innerHTML = "";
      users.forEach(u => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${u.username}</td>
          <td>${u.role}</td>
          <td>${new Date(u.createdAt).toLocaleString()}</td>
        `;
        tbody.appendChild(tr);
      });
    } catch (err) {
      adminStatus.textContent = "Failed to load users.";
    }
  }

  cleanupBtn.addEventListener("click", async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/cleanup`, { method: "POST", credentials: "include" });
      const data = await res.json();
      cleanupStatus.textContent = data.message || "Cleanup triggered.";
    } catch (err) {
      cleanupStatus.textContent = "Cleanup failed.";
    }
  });

  loadStats();
  loadUsers();
});
