let type = "expense";
let all = [];
let chart1, chart2;

const ICONS = { Food:"🍔", Travel:"✈️", Shopping:"🛍️", Entertainment:"🎬", Health:"💊", Education:"📚", Bills:"🧾", Salary:"💼", Other:"📦" };

window.onload = () => {
  document.getElementById("date").valueAsDate = new Date();
  refresh();
};

function setType(t) {
  type = t;
  document.getElementById("btn-expense").className = t === "expense" ? "active-expense" : "";
  document.getElementById("btn-income").className  = t === "income"  ? "active-income"  : "";
}

async function addTx() {
  const desc = document.getElementById("desc").value.trim();
  const amt  = parseFloat(document.getElementById("amt").value);
  const cat  = document.getElementById("cat").value;
  const date = document.getElementById("date").value;
  const msg  = document.getElementById("msg");

  if (!desc) { msg.style.color="orange"; msg.textContent="⚠️ Enter a description!"; return; }
  if (!amt || amt <= 0) { msg.style.color="orange"; msg.textContent="⚠️ Enter a valid amount!"; return; }

  await fetch("/api/transactions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, category: cat, amount: amt, description: desc, date })
  });

  msg.style.color = "green"; msg.textContent = "✅ Transaction added!";
  document.getElementById("desc").value = "";
  document.getElementById("amt").value  = "";
  setTimeout(() => msg.textContent = "", 2000);
  refresh();
}

async function refresh() {
  const [txRes, sumRes] = await Promise.all([fetch("/api/transactions"), fetch("/api/summary")]);
  all = await txRes.json();
  const sum = await sumRes.json();

  document.getElementById("t-income").textContent  = "₹" + sum.income.toFixed(2);
  document.getElementById("t-expense").textContent = "₹" + sum.expense.toFixed(2);
  const bal = document.getElementById("t-balance");
  bal.textContent = "₹" + sum.balance.toFixed(2);
  bal.style.color = sum.balance >= 0 ? "#6c63ff" : "#e74c3c";

  renderList(all);
  renderCharts(sum);
}

function renderList(list) {
  const el = document.getElementById("tx-list");
  if (!list.length) { el.innerHTML = '<div class="empty">No transactions yet 💸</div>'; return; }
  el.innerHTML = [...list].sort((a,b) => new Date(b.date)-new Date(a.date)).map(t => `
    <div class="tx-item ${t.type}">
      <div>
        <div class="tx-desc">${ICONS[t.category]||"📦"} ${t.description}</div>
        <div class="tx-meta">${t.category} • ${t.date}</div>
      </div>
      <div class="tx-right">
        <div class="tx-amount ${t.type}">${t.type==="income"?"+":"-"}₹${t.amount.toFixed(2)}</div>
        <button class="del-btn" onclick="delTx(${t.id})">✕</button>
      </div>
    </div>`).join("");
}

async function delTx(id) {
  if (!confirm("Delete this transaction?")) return;
  await fetch("/api/transactions/" + id, { method: "DELETE" });
  refresh();
}

function filterTx() {
  const q = document.getElementById("search").value.toLowerCase();
  renderList(all.filter(t => t.description.toLowerCase().includes(q) || t.category.toLowerCase().includes(q)));
}

function renderCharts(sum) {
  const cats = sum.categories || {};
  const COLORS = ["#6c63ff","#2ecc71","#e74c3c","#f39c12","#3498db","#e91e63","#9b59b6","#1abc9c","#e67e22"];

  if (chart1) chart1.destroy();
  chart1 = new Chart(document.getElementById("donut").getContext("2d"), {
    type: "doughnut",
    data: {
      labels: Object.keys(cats).length ? Object.keys(cats) : ["No data"],
      datasets: [{ data: Object.values(cats).length ? Object.values(cats) : [1], backgroundColor: COLORS, borderWidth: 2 }]
    },
    options: { responsive: true, plugins: { legend: { position: "bottom" } } }
  });

  if (chart2) chart2.destroy();
  chart2 = new Chart(document.getElementById("bar").getContext("2d"), {
    type: "bar",
    data: {
      labels: ["Income", "Expenses", "Balance"],
      datasets: [{ data: [sum.income, sum.expense, Math.max(0, sum.balance)], backgroundColor: ["#2ecc71","#e74c3c","#6c63ff"], borderRadius: 6 }]
    },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  });
}