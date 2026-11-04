
// THEME TOGGLE (LIGHT / DARK MODE WITH LOCALSTORAGE)
const themeToggleBtn = document.getElementById("theme-toggle");
const currentTheme = localStorage.getItem("flexgym_theme") || "dark";

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("flexgym_theme", theme);
  if (themeToggleBtn) {
    const icon = themeToggleBtn.querySelector("i");
    if (icon) {
      if (theme === "light") {
        icon.className = "fa-solid fa-sun";
        icon.style.color = "#f59e0b";
      } else {
        icon.className = "fa-solid fa-moon";
        icon.style.color = "#38bdf8";
      }
    }
  }
}

// Initial theme apply
applyTheme(currentTheme);

if (themeToggleBtn) {
  themeToggleBtn.addEventListener("click", () => {
    const active = document.documentElement.getAttribute("data-theme");
    const nextTheme = active === "light" ? "dark" : "light";
    applyTheme(nextTheme);
  });
}

// NAVIGATION
const sections = document.querySelectorAll(".section-content");
const navLinks = document.querySelectorAll("[data-section]");

function showSection(sectionId) {
  sections.forEach((sec) => sec.classList.remove("active"));
  const target = document.getElementById("section-" + sectionId);
  if (target) target.classList.add("active");
  document.querySelectorAll(".sidebar li, header nav a").forEach((el) => {
    el.classList.toggle("active", el.dataset.section === sectionId);
  });
}

navLinks.forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    const section = link.dataset.section;
    if (section) showSection(section);
  });
});

// SEARCH FILTER
const searchInput = document.getElementById("search");
if (searchInput) {
  searchInput.addEventListener("input", function () {
    const term = this.value.toLowerCase();
    document.querySelectorAll("tbody tr").forEach((row) => {
      row.style.display = row.innerText.toLowerCase().includes(term) ? "" : "none";
    });
  });
}

// 1. DASHBOARD LOADER
function loadDashboard() {
  fetch("/api/dashboard/stats")
    .then(async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load dashboard");
      return data;
    })
    .then((data) => {
      document.getElementById("total-members").textContent = data.totalMembers ?? 0;
      document.getElementById("active-classes").textContent = data.totalClasses ?? 0;
      document.getElementById("available-trainers").textContent = data.availableTrainers ?? 0;
      document.getElementById("total-revenue").textContent =
        "₹" + (data.revenue || 0).toLocaleString("en-IN");
      document.getElementById("attendance").textContent = (data.attendance || 0) + "%";

      const tbody = document.getElementById("recent-members-body");
      if (tbody) {
        if (!data.recentMembers || data.recentMembers.length === 0) {
          tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:#64748b; padding:18px;">No registered members yet.</td></tr>`;
        } else {
          tbody.innerHTML = data.recentMembers
            .map(
              (m) => `
            <tr>
              <td><strong>${escapeHtml(m.name)}</strong></td>
              <td>${escapeHtml(m.plan)}</td>
              <td><span class="status ${m.status === "Active" ? "active-status" : "expire-status"}">${m.status}</span></td>
            </tr>
          `
            )
            .join("");
        }
      }

      const container = document.getElementById("upcoming-classes");
      if (container) {
        if (!data.upcomingClasses || data.upcomingClasses.length === 0) {
          container.innerHTML = `<p style="color:#64748b; padding:15px 0;">No classes scheduled yet.</p>`;
        } else {
          container.innerHTML = data.upcomingClasses
            .map(
              (c) => `
            <div class="class-box">
              <h4>${escapeHtml(c.title)}</h4>
              <p><i class="fa-solid fa-clock"></i> ${escapeHtml(c.timing)} — Trainer: ${escapeHtml(c.trainer)}</p>
            </div>
          `
            )
            .join("");
        }
      }
    })
    .catch((err) => {
      console.error("Dashboard Error:", err.message);
    });
}

// 2. MEMBERS LOADER & CRUD
function loadMembers() {
  fetch("/api/members")
    .then(async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load members");
      return data;
    })
    .then((members) => {
      const tbody = document.querySelector("#members-table tbody");
      if (!tbody) return;
      if (!Array.isArray(members) || members.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#64748b; padding:20px;">No registered members in database.</td></tr>`;
        return;
      }
      tbody.innerHTML = members
        .map(
          (m) => `
        <tr>
          <td><strong>${escapeHtml(m.name)}</strong></td>
          <td>${escapeHtml(m.email)}</td>
          <td>${escapeHtml(m.plan)}</td>
          <td><span class="badge yellow">${escapeHtml(m.paymentMethod || "UPI")}</span></td>
          <td><span class="status ${m.status === "Active" ? "active-status" : "expire-status"}">${m.status}</span></td>
          <td>
            <button onclick="toggleMember('${m._id}')" class="btna" style="padding:6px 12px; background:#3b82f6;">Toggle</button>
            <button onclick="deleteMember('${m._id}')" class="btna" style="padding:6px 12px; background:#ef4444; margin-left:6px;">Delete</button>
          </td>
        </tr>
      `
        )
        .join("");
    })
    .catch((err) => console.error("Members error:", err));
}

function toggleMember(id) {
  fetch(`/api/members/${id}/toggle`, { method: "PATCH" })
    .then(() => {
      loadMembers();
      loadDashboard();
      loadReports();
    })
    .catch((err) => alert("Error toggling status: " + err.message));
}

function deleteMember(id) {
  if (!confirm("Are you sure you want to remove this member?")) return;
  fetch(`/api/members/${id}`, { method: "DELETE" })
    .then(() => {
      loadMembers();
      loadDashboard();
      loadPayments();
      loadReports();
    })
    .catch((err) => alert("Error deleting member: " + err.message));
}

// 3. CLASSES LOADER & CRUD
function loadClasses() {
  fetch("/api/classes")
    .then(async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load classes");
      return data;
    })
    .then((classes) => {
      const tbody = document.querySelector("#classes-table tbody");
      if (!tbody) return;
      if (!Array.isArray(classes) || classes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#64748b; padding:20px;">No classes scheduled yet.</td></tr>`;
        return;
      }
      tbody.innerHTML = classes
        .map(
          (c) => `
        <tr>
          <td><strong>${escapeHtml(c.title)}</strong></td>
          <td>${escapeHtml(c.trainer)}</td>
          <td><span class="badge green">${escapeHtml(c.timing)}</span></td>
          <td><span class="badge yellow">${c.booked}/${c.total} Slots</span></td>
          <td>
            ${
              c.booked < c.total
                ? `<button onclick="bookClass('${c._id}')" class="btna" style="padding:6px 12px;">Book Slot</button>`
                : `<span class="btna" style="padding:6px 12px; background:gray; pointer-events:none;">Full</span>`
            }
            <button onclick="deleteClass('${c._id}')" class="btna" style="padding:6px 12px; background:#ef4444; margin-left:6px;">Delete</button>
          </td>
        </tr>
      `
        )
        .join("");
    })
    .catch((err) => console.error("Classes error:", err));
}

function bookClass(id) {
  fetch(`/api/classes/${id}/book`, { method: "PATCH" })
    .then(async (res) => {
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Booking failed");
      loadClasses();
      loadDashboard();
    })
    .catch((err) => alert(err.message));
}

function deleteClass(id) {
  if (!confirm("Delete this class?")) return;
  fetch(`/api/classes/${id}`, { method: "DELETE" })
    .then(() => {
      loadClasses();
      loadDashboard();
      loadReports();
    })
    .catch((err) => alert("Error deleting class: " + err.message));
}

// 4. TRAINERS LOADER & CRUD
function loadTrainers() {
  fetch("/api/trainers")
    .then(async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load trainers");
      return data;
    })
    .then((trainers) => {
      const tbody = document.querySelector("#trainers-table tbody");
      if (!tbody) return;
      if (!Array.isArray(trainers) || trainers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#64748b; padding:20px;">No trainers registered yet.</td></tr>`;
        return;
      }
      tbody.innerHTML = trainers
        .map(
          (t) => `
        <tr>
          <td><strong>${escapeHtml(t.name)}</strong></td>
          <td>${escapeHtml(t.specialty)}</td>
          <td><span class="status ${t.status === "Available" ? "active-status" : "expire-status"}">${t.status}</span></td>
          <td><button onclick="deleteTrainer('${t._id}')" class="btna" style="padding:6px 12px; background:#ef4444;">Delete</button></td>
        </tr>
      `
        )
        .join("");
    })
    .catch((err) => console.error("Trainers error:", err));
}

function deleteTrainer(id) {
  if (!confirm("Delete this trainer?")) return;
  fetch(`/api/trainers/${id}`, { method: "DELETE" })
    .then(() => {
      loadTrainers();
      loadDashboard();
    })
    .catch((err) => alert("Error deleting trainer: " + err.message));
}

// 5. MEMBERSHIP PLANS
function loadMembership() {
  const plans = [
    { name: "Monthly", price: 1000, duration: "1 Month Validity", desc: "Full Gym Access + Standard Cardio" },
    { name: "Quarterly", price: 2500, duration: "3 Months Validity", desc: "All Gym Access + Free Trainer Consultation" },
    { name: "Annual", price: 8000, duration: "12 Months Validity", desc: "VIP Access + Dietician & Locker Included" },
  ];
  const container = document.getElementById("plans-container");
  if (container) {
    container.innerHTML = plans
      .map(
        (p) => `
      <div class="mini-card" style="text-align:center; padding: 26px 20px;">
        <h3 style="color:#38bdf8; font-size:20px; font-weight:700;">${p.name}</h3>
        <h2 style="font-size:38px; margin:14px 0; font-weight:800; color:#fff;">₹${p.price.toLocaleString("en-IN")}</h2>
        <p style="color:#10b981; font-weight:600; margin-bottom:8px;">${p.duration}</p>
        <p style="color:#94a3b8; font-size:13px; margin-bottom:18px;">${p.desc}</p>
        <button onclick="selectPlanFromCard('${p.name}')" class="btn" style="padding:10px 16px; font-size:13px;">
          Choose ${p.name}
        </button>
      </div>
    `
      )
      .join("");
  }
}

function selectPlanFromCard(planName) {
  showSection("members");
  const select = document.getElementById("member-plan-select");
  if (select) select.value = planName;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// 6. PAYMENTS AUDIT
function loadPayments() {
  fetch("/api/payments")
    .then(async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load payments");
      return data;
    })
    .then((payments) => {
      const tbody = document.querySelector("#payments-table tbody");
      if (!tbody) return;
      if (!Array.isArray(payments) || payments.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#64748b; padding:20px;">No payment records recorded.</td></tr>`;
        return;
      }
      tbody.innerHTML = payments
        .map(
          (p) => `
        <tr>
          <td><strong>${p.member ? escapeHtml(p.member.name) : "Deleted Member"}</strong></td>
          <td>${escapeHtml(p.plan)}</td>
          <td><strong>₹${(p.amount || 0).toLocaleString("en-IN")}</strong></td>
          <td><span class="badge yellow">${escapeHtml(p.paymentMethod || "UPI")}</span></td>
          <td><span class="status ${p.status === "Completed" ? "active-status" : "expire-status"}">${p.status}</span></td>
          <td>${new Date(p.createdAt).toLocaleDateString()}</td>
        </tr>
      `
        )
        .join("");
    })
    .catch((err) => console.error("Payments error:", err));
}

// 7. REPORTS
function loadReports() {
  fetch("/api/reports")
    .then(async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load reports");
      return data;
    })
    .then((data) => {
      const container = document.getElementById("reports-container");
      if (container) {
        container.innerHTML = `
          <div class="mini-card"><h4>Total Members</h4><h2>${data.totalMembers || 0}</h2></div>
          <div class="mini-card"><h4>Active Members</h4><h2>${data.activeMembers || 0}</h2></div>
          <div class="mini-card"><h4>Total Classes</h4><h2>${data.totalClasses || 0}</h2></div>
          <div class="mini-card"><h4>Total Revenue</h4><h2>₹${(data.totalRevenue || 0).toLocaleString("en-IN")}</h2></div>
        `;
      }
      const dist = document.getElementById("plan-distribution");
      if (dist) {
        if (!data.planDistribution || data.planDistribution.length === 0) {
          dist.innerHTML = `<li style="color:#64748b;">No member plans recorded yet.</li>`;
        } else {
          dist.innerHTML = data.planDistribution
            .map(
              (p) => `
            <li style="background:rgba(30,41,59,0.7); margin:8px 0; padding:14px 18px; border-radius:10px; display:flex; justify-content:space-between; border:1px solid rgba(255,255,255,0.06);">
              <span><strong>${escapeHtml(p._id)} Plan</strong></span>
              <span class="badge green">${p.count} Members</span>
            </li>
          `
            )
            .join("");
        }
      }
    })
    .catch((err) => console.error("Reports error:", err));
}

// 8. PAYMENT & LIVE UPI INTEGRATION (QR + APP DEEP-LINKING)
const paymentModal = document.getElementById("payment-modal");
const closeModalBtn = document.querySelector(".close-modal");
const paymentStatus = document.getElementById("payment-status");
const paymentMsg = document.getElementById("payment-message");

let pendingMember = null;
let selectedPaymentMethod = "UPI QR";

function getPlanAmount(plan) {
  if (plan === "Quarterly") return 2500;
  if (plan === "Annual") return 8000;
  return 1000;
}

function showPaymentModal(memberData) {
  pendingMember = memberData;
  const amount = getPlanAmount(memberData.plan);

  document.getElementById("modal-member-name").textContent = memberData.name;
  document.getElementById("modal-member-plan").textContent = memberData.plan;
  document.getElementById("modal-member-amount").textContent = "₹" + amount.toLocaleString("en-IN");

  const gymUPI = "flexgym@upi"; // FlexGym receiver UPI ID
  const note = encodeURIComponent(`FlexGym ${memberData.plan} - ${memberData.name}`);
  const genericUPI = `upi://pay?pa=${gymUPI}&pn=FlexGym&am=${amount}&cu=INR&tn=${note}`;

  // Automatically render the UPI QR Code as soon as modal opens
  const qrWrapper = document.getElementById("qr-image-wrapper");
  if (qrWrapper) {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(genericUPI)}`;
    qrWrapper.innerHTML = `
      <img src="${qrUrl}" alt="Scan UPI QR" width="180" height="180" style="border-radius:10px; background:white; padding:8px; box-shadow:0 4px 15px rgba(0,0,0,0.2);" />
    `;
  }

  // Set default direct UPI link
  const directLinkBtn = document.getElementById("direct-upi-link");
  if (directLinkBtn) {
    directLinkBtn.href = genericUPI;
  }

  paymentModal.style.display = "flex";
  if (paymentStatus) paymentStatus.style.display = "none";
}

function closePaymentModal() {
  paymentModal.style.display = "none";
  pendingMember = null;
}

if (closeModalBtn) closeModalBtn.addEventListener("click", closePaymentModal);
if (paymentModal) {
  paymentModal.addEventListener("click", (e) => {
    if (e.target === paymentModal) closePaymentModal();
  });
}

// REAL FULL APP LAUNCH FOR GPAY / PHONEPE / PAYTM / ANY UPI APP
function triggerUPI(appType) {
  if (!pendingMember) return;
  const amount = getPlanAmount(pendingMember.plan);
  const gymUPI = "flexgym@upi"; // FlexGym receiver UPI
  const note = encodeURIComponent(`FlexGym ${pendingMember.plan} - ${pendingMember.name}`);
  const upiQuery = `pa=${gymUPI}&pn=FlexGym&am=${amount}&cu=INR&tn=${note}`;
  const genericUPI = `upi://pay?${upiQuery}`;
  
  let deepLink = genericUPI;
  const isAndroid = /android/i.test(navigator.userAgent);

  if (appType === "gpay") {
    selectedPaymentMethod = "Google Pay";
    if (isAndroid) {
      // Direct Android package intent to launch full GPay app
      deepLink = `intent://pay?${upiQuery}#Intent;scheme=upi;package=com.google.android.apps.nbu.paisa.user;end`;
    } else {
      deepLink = `tez://upi/pay?${upiQuery}`;
    }
  } else if (appType === "phonepe") {
    selectedPaymentMethod = "PhonePe";
    if (isAndroid) {
      // Direct Android package intent to launch full PhonePe app
      deepLink = `intent://pay?${upiQuery}#Intent;scheme=upi;package=com.phonepe.app;end`;
    } else {
      deepLink = `phonepe://pay?${upiQuery}`;
    }
  } else if (appType === "paytm") {
    selectedPaymentMethod = "Paytm";
    if (isAndroid) {
      // Direct Android package intent to launch full Paytm app
      deepLink = `intent://pay?${upiQuery}#Intent;scheme=upi;package=net.one97.paytm;end`;
    } else {
      deepLink = `paytmmp://pay?${upiQuery}`;
    }
  } else {
    selectedPaymentMethod = "UPI App";
    deepLink = genericUPI;
  }

  const directLinkBtn = document.getElementById("direct-upi-link");
  if (directLinkBtn) {
    directLinkBtn.href = deepLink;
    directLinkBtn.innerHTML = `<i class="fa-solid fa-arrow-up-right-from-square"></i> Open in ${selectedPaymentMethod}`;
  }

  // Open the full app directly
  window.location.href = deepLink;
}

function confirmPaymentSuccess() {
  if (!pendingMember) return;
  if (paymentStatus) {
    paymentStatus.style.display = "block";
    paymentMsg.innerHTML = '<span style="color:#10b981;"><i class="fa-solid fa-spinner fa-spin"></i> Payment Confirmed! Registering member in database...</span>';
  }
  
  setTimeout(() => {
    pendingMember.paymentMethod = selectedPaymentMethod;
    submitMember(pendingMember);
  }, 900);
}

// 9. SUBMIT MEMBER (API with Robust Error Handling)
function submitMember(data) {
  const msgEl = document.getElementById("member-message");
  fetch("/api/members", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
    .then(async (res) => {
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Failed to register member");
      }
      return result;
    })
    .then((member) => {
      closePaymentModal();
      const form = document.getElementById("member-form");
      if (form) form.reset();
      loadMembers();
      loadDashboard();
      loadPayments();
      loadReports();
      if (msgEl) {
        msgEl.innerHTML = `<p style="color:#34d399; font-weight:600; padding:10px 14px; background:rgba(16,185,129,0.15); border-radius:8px; border:1px solid rgba(16,185,129,0.3);">✓ Member "${escapeHtml(member.name)}" registered & activated successfully!</p>`;
        setTimeout(() => (msgEl.innerHTML = ""), 6000);
      }
    })
    .catch((err) => {
      closePaymentModal();
      if (msgEl) {
        msgEl.innerHTML = `<p style="color:#fb7185; font-weight:600; padding:10px 14px; background:rgba(244,63,94,0.15); border-radius:8px; border:1px solid rgba(244,63,94,0.3);">✗ Registration Failed: ${err.message}</p>`;
      }
    });
}

// FORMS HANDLERS
const memberForm = document.getElementById("member-form");
if (memberForm) {
  memberForm.addEventListener("submit", function (e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(this));
    if (!data.name || !data.email) {
      document.getElementById("member-message").innerHTML =
        '<p style="color:#fb7185; font-weight:600;">Please fill all required fields.</p>';
      return;
    }
    showPaymentModal(data);
  });
}

const classForm = document.getElementById("class-form");
if (classForm) {
  classForm.addEventListener("submit", function (e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(this));
    const msgEl = document.getElementById("class-message");
    fetch("/api/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
      .then(async (res) => {
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "Failed to add class");
        return result;
      })
      .then(() => {
        this.reset();
        loadClasses();
        loadDashboard();
        loadReports();
        if (msgEl) {
          msgEl.innerHTML = '<p style="color:#34d399; font-weight:600;">✓ Class added successfully!</p>';
          setTimeout(() => (msgEl.innerHTML = ""), 3000);
        }
      })
      .catch((err) => {
        if (msgEl) msgEl.innerHTML = `<p style="color:#fb7185; font-weight:600;">✗ ${err.message}</p>`;
      });
  });
}

const trainerForm = document.getElementById("trainer-form");
if (trainerForm) {
  trainerForm.addEventListener("submit", function (e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(this));
    const msgEl = document.getElementById("trainer-message");
    fetch("/api/trainers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
      .then(async (res) => {
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "Failed to add trainer");
        return result;
      })
      .then(() => {
        this.reset();
        loadTrainers();
        loadDashboard();
      })
      .catch((err) => {
        if (msgEl) msgEl.innerHTML = `<p style="color:#fb7185; font-weight:600;">✗ ${err.message}</p>`;
      });
  });
}

function resetAllData() {
  if (!confirm("Are you sure you want to completely clear all members, classes, trainers and payments from database?")) return;
  fetch("/api/reset-data", { method: "POST" })
    .then(() => {
      loadDashboard();
      loadMembers();
      loadClasses();
      loadTrainers();
      loadPayments();
      loadReports();
      alert("Database reset completed. All entries are now 0.");
    })
    .catch((err) => alert("Failed to reset: " + err.message));
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// INITIALIZATION
document.addEventListener("DOMContentLoaded", () => {
  loadDashboard();
  loadMembers();
  loadClasses();
  loadTrainers();
  loadMembership();
  loadPayments();
  loadReports();
});
