const STORAGE_KEY = "kavenon_tasks_v1";
const $ = (selector) => document.querySelector(selector);
const taskList = $("#taskList");
let tasks = loadTasks();
let currentView = "all";
let currentFilter = "all";
let toastTimer;

function loadTasks() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch { return []; }
}
function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  render();
}
function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char]));
}
function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2300);
}
function toPolishDate(isoDate) {
  if (!isoDate) return "";
  const [year, month, day] = isoDate.split("-");
  return `${day}.${month}.${year}`;
}
function fromPolishDate(value) {
  const match = value.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (date.getFullYear() !== Number(year) || date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day)) return null;
  return `${year}-${month}-${day}`;
}
function formatDate(dateString) {
  if (!dateString) return "Bez terminu";
  return new Intl.DateTimeFormat("pl-PL", { day:"numeric", month:"short" }).format(new Date(`${dateString}T12:00:00`));
}
function isOverdue(task) {
  if (!task.deadline || task.completed) return false;
  const today = new Date(); today.setHours(0,0,0,0);
  return new Date(`${task.deadline}T00:00:00`) < today;
}
function visibleTasks() {
  const query = $("#searchInput").value.trim().toLocaleLowerCase("pl");
  let result = tasks.filter(task => {
    const matchesView = currentView === "today" ? task.deadline === new Date().toISOString().slice(0,10) && !task.completed
      : currentView === "important" ? task.priority === "high" && !task.completed
      : currentView === "completed" ? task.completed : true;
    const matchesFilter = currentFilter === "active" ? !task.completed : currentFilter === "completed" ? task.completed : true;
    const matchesSearch = `${task.title} ${task.description}`.toLocaleLowerCase("pl").includes(query);
    return matchesView && matchesFilter && matchesSearch;
  });
  const sort = $("#sortSelect").value;
  if (sort === "deadline") result.sort((a,b) => (a.deadline || "9999").localeCompare(b.deadline || "9999"));
  else if (sort === "priority") result.sort((a,b) => ({high:0,medium:1,low:2}[a.priority] - {high:0,medium:1,low:2}[b.priority]));
  else result.sort((a,b) => b.createdAt - a.createdAt);
  return result;
}
function render() {
  const completed = tasks.filter(task => task.completed).length;
  const active = tasks.length - completed;
  const progress = tasks.length ? Math.round(completed / tasks.length * 100) : 0;
  $("#statTotal").textContent = tasks.length;
  $("#statActive").textContent = active;
  $("#statDone").textContent = completed;
  $("#statProgress").textContent = `${progress}%`;
  $("#progressBar").style.width = `${progress}%`;
  $("#allCount").textContent = tasks.length;

  const labels = {all:"Wszystkie zadania",today:"Na dziś",important:"Priorytetowe",completed:"Ukończone"};
  $("#pageTitle").innerHTML = `${labels[currentView]}<span class="heading-dot">.</span>`;
  $("#breadcrumbTitle").textContent = labels[currentView];
  const list = visibleTasks();
  taskList.innerHTML = list.map(task => `
    <article class="task-card ${task.completed ? "is-complete" : ""}">
      <button class="check-button" data-action="toggle" data-id="${task.id}" aria-label="${task.completed ? "Oznacz jako aktywne" : "Oznacz jako ukończone"}">${task.completed ? "✓" : ""}</button>
      <div class="task-copy">
        <h3 class="task-title">${escapeHTML(task.title)}</h3>
        ${task.description ? `<p class="task-description">${escapeHTML(task.description)}</p>` : ""}
      </div>
      <div class="task-meta">
        <span class="priority ${task.priority}">${{high:"Wysoki",medium:"Średni",low:"Niski"}[task.priority]}</span>
        <span class="deadline ${isOverdue(task) ? "overdue" : ""}">${isOverdue(task) ? "Po terminie · " : ""}${formatDate(task.deadline)}</span>
      </div>
      <div class="task-actions">
        <button class="mini-button" data-action="edit" data-id="${task.id}" aria-label="Edytuj zadanie">✎</button>
        <button class="mini-button" data-action="delete" data-id="${task.id}" aria-label="Usuń zadanie">×</button>
      </div>
    </article>`).join("");
  $("#emptyState").classList.toggle("hidden", list.length > 0);
  taskList.classList.toggle("hidden", list.length === 0);
}
function openModal(task = null) {
  $("#taskForm").reset();
  $("#taskId").value = task?.id || "";
  $("#taskTitle").value = task?.title || "";
  $("#taskDescription").value = task?.description || "";
  $("#taskDeadline").value = toPolishDate(task?.deadline || "");
  $("#taskPriority").value = task?.priority || "medium";
  $("#modalTitle").textContent = task ? "Edytuj zadanie" : "Dodaj zadanie";
  $("#saveTask").textContent = task ? "Zapisz zmiany" : "Zapisz zadanie";
  $("#modalBackdrop").classList.remove("hidden");
  $("#taskTitle").focus();
}
function closeModal() { $("#modalBackdrop").classList.add("hidden"); }
$("#taskForm").addEventListener("submit", event => {
  event.preventDefault();
  const id = $("#taskId").value;
  const enteredDate = $("#taskDeadline").value.trim();
  const parsedDate = fromPolishDate(enteredDate);
  if (enteredDate && !parsedDate) {
    showToast("Wpisz datę w formacie dd.mm.rrrr.");
    $("#taskDeadline").focus();
    return;
  }
  const data = {
    title: $("#taskTitle").value.trim(),
    description: $("#taskDescription").value.trim(),
    deadline: parsedDate || "",
    priority: $("#taskPriority").value
  };
  if (!data.title) return;
  if (id) {
    tasks = tasks.map(task => task.id === id ? {...task, ...data} : task);
    showToast("Zadanie zostało zaktualizowane.");
  } else {
    tasks.unshift({id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), ...data, completed:false, createdAt:Date.now()});
    showToast("Dodano nowe zadanie.");
  }
  closeModal(); saveTasks();
});
taskList.addEventListener("click", event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const task = tasks.find(item => item.id === button.dataset.id);
  if (!task) return;
  if (button.dataset.action === "toggle") {
    task.completed = !task.completed;
    showToast(task.completed ? "Zadanie ukończone!" : "Przywrócono zadanie.");
    saveTasks();
  } else if (button.dataset.action === "edit") openModal(task);
  else if (button.dataset.action === "delete") {
    if (confirm(`Czy na pewno usunąć zadanie „${task.title}”?`)) {
      tasks = tasks.filter(item => item.id !== task.id);
      saveTasks(); showToast("Usunięto zadanie.");
    }
  }
});
$("#openModal").addEventListener("click", () => openModal());
$("#emptyAdd").addEventListener("click", () => openModal());
$("#closeModal").addEventListener("click", closeModal);
$("#cancelModal").addEventListener("click", closeModal);
$("#modalBackdrop").addEventListener("click", event => { if (event.target === $("#modalBackdrop")) closeModal(); });
document.addEventListener("keydown", event => { if (event.key === "Escape") closeModal(); });
$("#taskDeadline").addEventListener("input", event => {
  const digits = event.target.value.replace(/\D/g, "").slice(0, 8);
  event.target.value = digits.length > 4 ? `${digits.slice(0,2)}.${digits.slice(2,4)}.${digits.slice(4)}`
    : digits.length > 2 ? `${digits.slice(0,2)}.${digits.slice(2)}` : digits;
});
$("#searchInput").addEventListener("input", render);
$("#sortSelect").addEventListener("change", render);
document.querySelectorAll("[data-view]").forEach(button => button.addEventListener("click", () => {
  currentView = button.dataset.view;
  currentFilter = "all";
  document.querySelectorAll("[data-view]").forEach(item => item.classList.toggle("active", item === button));
  document.querySelectorAll("[data-filter]").forEach(item => item.classList.toggle("selected", item.dataset.filter === "all"));
  render();
}));
document.querySelectorAll("[data-filter]").forEach(button => button.addEventListener("click", () => {
  currentFilter = button.dataset.filter;
  document.querySelectorAll("[data-filter]").forEach(item => item.classList.toggle("selected", item === button));
  render();
}));
const now = new Date();
$("#todayLabel").textContent = new Intl.DateTimeFormat("pl-PL", {weekday:"short", day:"numeric", month:"long"}).format(now);
$("#dateGreeting").textContent = now.getHours() < 12 ? "DZIEŃ DOBRY" : now.getHours() < 18 ? "DOBREGO DNIA" : "DOBRY WIECZÓR";
render();
