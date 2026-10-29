const STORAGE_KEY = "homeFeedingBookings:v1";

const form = document.querySelector("#booking-form");
const list = document.querySelector("#booking-list");
const count = document.querySelector("#booking-count");
const dialog = document.querySelector("#detail-dialog");
const dialogContent = document.querySelector("#dialog-content");
const toast = document.querySelector("#toast");
const visitAtInput = form.elements.visitAt;

function loadBookings() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveBookings(bookings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[char]);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric", month: "long", day: "numeric", weekday: "short",
    hour: "2-digit", minute: "2-digit"
  }).format(new Date(value));
}

function setMinimumTime() {
  const minimum = new Date(Date.now() + 30 * 60 * 1000);
  minimum.setMinutes(Math.ceil(minimum.getMinutes() / 30) * 30, 0, 0);
  const local = new Date(minimum.getTime() - minimum.getTimezoneOffset() * 60000);
  visitAtInput.min = local.toISOString().slice(0, 16);
}

function validationMessage(field) {
  const value = field.type === "checkbox" ? field.checked : field.value.trim();
  if (field.required && !value) return field.type === "checkbox" ? "请确认预约信息" : "请填写此项";
  if (!value) return "";
  if (field.name === "contactName" && (value.length < 2 || value.length > 30)) return "姓名应为 2–30 个字符";
  if (field.name === "phone" && !/^1[3-9]\d{9}$/.test(value)) return "请输入正确的中国大陆手机号";
  if (field.name === "petName" && (value.length < 1 || value.length > 30)) return "宠物名字不能超过 30 个字符";
  if (field.name === "petCount" && (!Number.isInteger(Number(value)) || Number(value) < 1 || Number(value) > 10)) return "宠物数量应为 1–10";
  if (field.name === "address" && (value.length < 5 || value.length > 120)) return "请填写 5–120 个字符的详细地址";
  if (field.name === "visitAt" && new Date(value).getTime() <= Date.now()) return "预约时间必须晚于当前时间";
  if (field.name === "feedingInstructions" && value.length < 2) return "喂养要求至少填写 2 个字符";
  return "";
}

function validateField(field) {
  const message = validationMessage(field);
  const error = field.closest("label")?.querySelector(".error");
  field.classList.toggle("invalid", Boolean(message));
  field.setAttribute("aria-invalid", String(Boolean(message)));
  if (error) error.textContent = message;
  return !message;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2800);
}

function createId() {
  return `AY-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function renderBookings() {
  const bookings = loadBookings().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const activeCount = bookings.filter((booking) => booking.status === "booked").length;
  count.textContent = activeCount;

  if (!bookings.length) {
    list.innerHTML = '<div class="empty"><b>还没有预约</b>填写上方信息，创建你的第一次上门喂养服务。</div>';
    return;
  }

  list.innerHTML = bookings.map((booking) => `
    <article class="booking-card">
      <div><small>预约编号</small><strong>${escapeHtml(booking.id)}</strong></div>
      <div><small>服务对象</small><h3>${escapeHtml(booking.petName)} · ${escapeHtml(booking.petType)} × ${escapeHtml(booking.petCount)}</h3></div>
      <div><small>上门时间</small><p>${escapeHtml(formatDate(booking.visitAt))}</p><span class="status ${booking.status === "cancelled" ? "cancelled" : ""}">${booking.status === "cancelled" ? "已取消" : "已预约"}</span></div>
      <div class="card-actions">
        <button type="button" data-action="detail" data-id="${escapeHtml(booking.id)}">详情</button>
        ${booking.status === "booked" ? `<button class="cancel" type="button" data-action="cancel" data-id="${escapeHtml(booking.id)}">取消</button>` : ""}
      </div>
    </article>
  `).join("");
}

function showDetails(booking) {
  const status = booking.status === "booked" ? "已预约" : "已取消";
  dialogContent.innerHTML = `
    <p class="eyebrow">BOOKING DETAIL</p><h2>预约详情</h2>
    <div class="detail-grid">
      <div><small>预约编号</small><strong>${escapeHtml(booking.id)}</strong></div>
      <div><small>当前状态</small><strong>${status}</strong></div>
      <div><small>联系人</small><strong>${escapeHtml(booking.contactName)}</strong></div>
      <div><small>手机号码</small><strong>${escapeHtml(booking.phone)}</strong></div>
      <div><small>宠物</small><strong>${escapeHtml(booking.petName)} · ${escapeHtml(booking.petType)} × ${escapeHtml(booking.petCount)}</strong></div>
      <div><small>上门时间</small><strong>${escapeHtml(formatDate(booking.visitAt))}</strong></div>
      <div class="wide"><small>服务地址</small><strong>${escapeHtml(booking.address)}</strong></div>
      <div class="wide"><small>喂养要求</small><strong>${escapeHtml(booking.feedingInstructions)}</strong></div>
      ${booking.notes ? `<div class="wide"><small>其他备注</small><strong>${escapeHtml(booking.notes)}</strong></div>` : ""}
    </div>`;
  dialog.showModal();
}

form.addEventListener("input", (event) => validateField(event.target));
form.addEventListener("change", (event) => validateField(event.target));

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const fields = [...form.querySelectorAll("input, select, textarea")];
  const valid = fields.map(validateField).every(Boolean);
  if (!valid) {
    form.querySelector(".invalid")?.focus();
    showToast("请检查并完善预约信息");
    return;
  }

  const data = Object.fromEntries(new FormData(form));
  const booking = {
    id: createId(), contactName: data.contactName.trim(), phone: data.phone.trim(),
    petName: data.petName.trim(), petType: data.petType, petCount: Number(data.petCount),
    address: data.address.trim(), visitAt: new Date(data.visitAt).toISOString(),
    feedingInstructions: data.feedingInstructions.trim(), notes: data.notes.trim(),
    status: "booked", createdAt: new Date().toISOString(), cancelledAt: null
  };
  saveBookings([booking, ...loadBookings()]);
  form.reset();
  [...form.querySelectorAll(".error")].forEach((error) => { error.textContent = ""; });
  setMinimumTime();
  renderBookings();
  showToast(`预约成功，编号 ${booking.id}`);
  document.querySelector("#bookings").scrollIntoView({ behavior: "smooth" });
});

list.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const bookings = loadBookings();
  const booking = bookings.find((item) => item.id === button.dataset.id);
  if (!booking) return;
  if (button.dataset.action === "detail") showDetails(booking);
  if (button.dataset.action === "cancel" && window.confirm(`确定取消 ${booking.petName} 的上门喂养预约吗？`)) {
    if (booking.status !== "booked") return;
    booking.status = "cancelled";
    booking.cancelledAt = new Date().toISOString();
    saveBookings(bookings);
    renderBookings();
    showToast("预约已取消");
  }
});

document.querySelector("#clear-cancelled").addEventListener("click", () => {
  const bookings = loadBookings();
  const cancelledCount = bookings.filter((booking) => booking.status === "cancelled").length;
  if (!cancelledCount) return showToast("暂无已取消的记录");
  if (window.confirm(`确定清理 ${cancelledCount} 条已取消记录吗？`)) {
    saveBookings(bookings.filter((booking) => booking.status !== "cancelled"));
    renderBookings();
    showToast("已清理取消记录");
  }
});

dialog.querySelector(".dialog-close").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });

setMinimumTime();
renderBookings();
