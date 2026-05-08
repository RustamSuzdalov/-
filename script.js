// ========================
//   ВОДНЫЙ БАЛАНС PRO — ПОЛНАЯ ВЕРСИЯ
// ========================

const STORAGE_KEY = "water_balance_pro";
const DEFAULT_GOAL_ML = 2000;

// Глобальное состояние
let currentData = {
    date: getTodayStr(),
    totalMl: 0,
    logs: [],
    goal: DEFAULT_GOAL_ML,
    history: {}, // { "2024-01-01": { total: 500, logs: [] } }
    achievements: {},
    streak: 0,
    lastDate: null
};

let chart = null;
let notificationInterval = null;

// DOM элементы
const dateDisplaySpan = document.getElementById("dateDisplay");
const goalValueDisplay = document.getElementById("goalValueDisplay");
const consumedMlSpan = document.getElementById("consumedMl");
const remainingMlSpan = document.getElementById("remainingMl");
const progressFillDiv = document.getElementById("progressFill");
const consumedPercentMsg = document.getElementById("consumedPercentMsg");
const statusEmojiSpan = document.getElementById("statusEmoji");
const statusMessageSpan = document.getElementById("statusMessage");
const adviceIconSpan = document.getElementById("adviceIcon");
const historyListDiv = document.getElementById("historyList");
const resetDayBtn = document.getElementById("resetDayBtn");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const addCustomBtn = document.getElementById("addCustomBtn");
const customAmountInput = document.getElementById("customAmount");
const themeToggle = document.getElementById("themeToggle");

// Вкладки
const tabBtns = document.querySelectorAll(".tab-btn");
const tabContents = document.querySelectorAll(".tab-content");

// Статистика
const bestDaySpan = document.getElementById("bestDay");
const avgWaterSpan = document.getElementById("avgWater");
const streakSpan = document.getElementById("streak");
const motivationMsg = document.getElementById("motivationMessage");

// Настройки
const notifyPermissionBtn = document.getElementById("notifyPermissionBtn");
const reminderTime1 = document.getElementById("reminderTime1");
const reminderTime2 = document.getElementById("reminderTime2");
const reminderTime3 = document.getElementById("reminderTime3");
const saveRemindersBtn = document.getElementById("saveRemindersBtn");
const exportDataBtn = document.getElementById("exportDataBtn");
const importDataBtn = document.getElementById("importDataBtn");
const importFileInput = document.getElementById("importFileInput");
const goalInput = document.getElementById("goalInput");
const saveGoalBtn = document.getElementById("saveGoalBtn");
const clearAllDataBtn = document.getElementById("clearAllDataBtn");

// ---- Вспомогательные функции ----
function getTodayStr() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getCurrentTimeStr() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

// Инициализация достижений
const ACHIEVEMENTS = [
    { id: "first_drink", name: "💧 Первый глоток", desc: "Выпить первую порцию воды", condition: (total, logs) => logs.length >= 1, emoji: "💧" },
    { id: "half_goal", name: "🎯 Половина пути", desc: "Выпить 50% дневной нормы", condition: (total, goal) => total >= goal * 0.5, emoji: "🎯" },
    { id: "full_goal", name: "🏆 Цель достигнута", desc: "Выполнить дневную норму", condition: (total, goal) => total >= goal, emoji: "🏆" },
    { id: "over_goal", name: "⭐ Супер гидратация", desc: "Выпить на 30% больше нормы", condition: (total, goal) => total >= goal * 1.3, emoji: "⭐" },
    { id: "week_streak", name: "📅 Недельный рекорд", desc: "Пить воду 7 дней подряд", condition: (total, goal, streak) => streak >= 7, emoji: "📅" },
    { id: "early_bird", name: "🌅 Ранняя пташка", desc: "Выпить воду до 9 утра", condition: (total, goal, logs) => logs.some(log => parseInt(log.timeStr.split(":")[0]) < 9), emoji: "🌅" }
];

// Загрузка данных
function loadData() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
        return {
            date: getTodayStr(),
            totalMl: 0,
            logs: [],
            goal: DEFAULT_GOAL_ML,
            history: {},
            achievements: {},
            streak: 0,
            lastDate: null
        };
    }
    try {
        const parsed = JSON.parse(raw);
        if (parsed.date !== getTodayStr()) {
            // Сохраняем историю за вчера
            if (!parsed.history) parsed.history = {};
            parsed.history[parsed.date] = { total: parsed.totalMl, logs: parsed.logs };
            
            // Проверка серии
            const yesterday = parsed.date;
            const today = getTodayStr();
            const yesterdayTotal = parsed.history[yesterday]?.total || 0;
            if (yesterdayTotal >= parsed.goal) {
                parsed.streak = (parsed.streak || 0) + 1;
            } else {
                parsed.streak = 0;
            }
            
            return {
                date: today,
                totalMl: 0,
                logs: [],
                goal: parsed.goal || DEFAULT_GOAL_ML,
                history: parsed.history || {},
                achievements: parsed.achievements || {},
                streak: parsed.streak || 0,
                lastDate: yesterday
            };
        }
        return {
            date: parsed.date,
            totalMl: parsed.totalMl || 0,
            logs: parsed.logs || [],
            goal: parsed.goal || DEFAULT_GOAL_ML,
            history: parsed.history || {},
            achievements: parsed.achievements || {},
            streak: parsed.streak || 0,
            lastDate: parsed.lastDate
        };
    } catch(e) {
        return {
            date: getTodayStr(),
            totalMl: 0,
            logs: [],
            goal: DEFAULT_GOAL_ML,
            history: {},
            achievements: {},
            streak: 0,
            lastDate: null
        };
    }
}

function persistData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
        date: currentData.date,
        totalMl: currentData.totalMl,
        logs: currentData.logs,
        goal: currentData.goal,
        history: currentData.history,
        achievements: currentData.achievements,
        streak: currentData.streak,
        lastDate: currentData.lastDate
    }));
}

// Проверка достижений
function checkAchievements() {
    let newUnlocked = [];
    for (let ach of ACHIEVEMENTS) {
        if (!currentData.achievements[ach.id]) {
            let isUnlocked = false;
            if (ach.id === "week_streak") {
                isUnlocked = ach.condition(currentData.totalMl, currentData.goal, currentData.streak);
            } else if (ach.id === "early_bird") {
                isUnlocked = ach.condition(currentData.totalMl, currentData.goal, currentData.logs);
            } else {
                isUnlocked = ach.condition(currentData.totalMl, currentData.goal);
            }
            if (isUnlocked) {
                currentData.achievements[ach.id] = { unlockedAt: new Date().toISOString() };
                newUnlocked.push(ach);
                if (Notification.permission === "granted") {
                    new Notification(`🏆 Новое достижение!`, { body: `${ach.emoji} ${ach.name} — ${ach.desc}` });
                }
            }
        }
    }
    if (newUnlocked.length > 0) {
        renderAchievements();
        if (motivationMsg) motivationMsg.innerHTML = `🎉 Поздравляю! Вы получили: ${newUnlocked.map(a => a.name).join(", ")}! 🎉`;
        setTimeout(() => updateMotivation(), 3000);
    }
}

// Добавление воды
function addWater(amount) {
    if (!amount || amount <= 0) {
        alert("Введите корректное количество");
        return;
    }
    const nowTimeStr = getCurrentTimeStr();
    const timestamp = Date.now();
    const newLog = { amount, timestamp, timeStr: nowTimeStr };
    currentData.logs.push(newLog);
    currentData.totalMl += amount;
    
    persistData();
    checkAchievements();
    renderAll();
    updateChart();
    updateMotivation();
    
    if (currentData.totalMl >= currentData.goal && Notification.permission === "granted") {
        new Notification("🎉 Отлично! Цель достигнута!", { body: `Вы выпили ${currentData.totalMl} мл воды!` });
    }
}

// Экспорт данных
function exportData() {
    const dataStr = JSON.stringify(currentData, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `water_balance_backup_${getTodayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    alert("✅ Данные экспортированы!");
}

// Импорт данных
function importData(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const imported = JSON.parse(e.target.result);
            if (imported && typeof imported === "object") {
                currentData = imported;
                persistData();
                renderAll();
                updateChart();
                alert("✅ Данные импортированы!");
            }
        } catch(err) {
            alert("❌ Ошибка при импорте файла");
        }
    };
    reader.readAsText(file);
}

// Уведомления
function requestNotificationPermission() {
    if ("Notification" in window) {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                alert("🔔 Уведомления разрешены!");
                scheduleReminders();
            }
        });
    } else {
        alert("Ваш браузер не поддерживает уведомления");
    }
}

function scheduleReminders() {
    if (notificationInterval) clearInterval(notificationInterval);
    
    const times = [reminderTime1.value, reminderTime2.value, reminderTime3.value];
    localStorage.setItem("reminder_times", JSON.stringify(times));
    
    setInterval(() => {
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
        if (times.includes(currentTime)) {
            if (Notification.permission === "granted") {
                new Notification("💧 Напоминание о воде!", { body: "Не забудьте выпить стакан воды 💦" });
            }
        }
    }, 60000); // Проверка каждую минуту
}

// График
function updateChart() {
    const ctx = document.getElementById('waterChart').getContext('2d');
    const last7Days = [];
    const last7Data = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        last7Days.push(dateStr.slice(5));
        let total = 0;
        if (dateStr === currentData.date) {
            total = currentData.totalMl;
        } else if (currentData.history[dateStr]) {
            total = currentData.history[dateStr].total;
        }
        last7Data.push(total);
    }
    
    if (chart) chart.destroy();
    chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: last7Days,
            datasets: [{
                label: 'Выпито воды (мл)',
                data: last7Data,
                backgroundColor: 'rgba(15, 103, 177, 0.6)',
                borderColor: '#0f67b1',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { position: 'top' }
            }
        }
    });
    
    // Статистика
    const bestDayValue = Math.max(...last7Data);
    const bestDayIndex = last7Data.indexOf(bestDayValue);
    if (bestDayIndex !== -1) bestDaySpan.textContent = `${last7Days[bestDayIndex]} (${bestDayValue} мл)`;
    const avg = (last7Data.reduce((a,b) => a+b, 0) / 7).toFixed(0);
    avgWaterSpan.textContent = avg;
    streakSpan.textContent = currentData.streak || 0;
}

// Мотивация
function updateMotivation() {
    const percent = (currentData.totalMl / currentData.goal) * 100;
    let message = "";
    if (percent === 0) message = "💪 Начните день с воды! Выпите стакан прямо сейчас.";
    else if (percent < 30) message = "🌊 Отличное начало! Осталось совсем немного до первой цели.";
    else if (percent < 70) message = "😊 Вы на полпути! Продолжайте в том же духе.";
    else if (percent < 100) message = "🎉 Остался последний рывок! Вы почти у цели!";
    else if (percent >= 100) message = "🏆 Вы герой! Цель достигнута! Отличная работа!";
    if (motivationMsg) motivationMsg.innerHTML = `💬 ${message}`;
}

// Рендер достижений
function renderAchievements() {
    const container = document.getElementById("achievementsList");
    if (!container) return;
    container.innerHTML = "";
    for (let ach of ACHIEVEMENTS) {
        const unlocked = currentData.achievements[ach.id];
        const card = document.createElement("div");
        card.className = `achievement-card ${unlocked ? "unlocked" : "locked"}`;
        card.innerHTML = `
            <div class="achievement-emoji">${ach.emoji}</div>
            <div class="achievement-title">${ach.name}</div>
            <div class="achievement-desc">${ach.desc}</div>
            ${unlocked ? '<span style="font-size:0.7rem;">✅ Получено!</span>' : '<span style="font-size:0.7rem;">🔒 Не получено</span>'}
        `;
        container.appendChild(card);
    }
}

// Переключение темы
function toggleTheme() {
    document.body.classList.toggle("dark-theme");
    const isDark = document.body.classList.contains("dark-theme");
    localStorage.setItem("dark_theme", isDark);
    themeToggle.textContent = isDark ? "☀️" : "🌙";
}

// Рендер всего
function renderAll() {
    dateDisplaySpan.innerText = `📅 ${new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}`;
    goalValueDisplay.innerText = `${currentData.goal} мл`;
    const total = currentData.totalMl;
    const goal = currentData.goal;
    const remaining = Math.max(0, goal - total);
    consumedMlSpan.innerText = total;
    remainingMlSpan.innerText = remaining;
    const percent = Math.min(100, Math.floor((total / goal) * 100));
    progressFillDiv.style.width = `${percent}%`;
    progressFillDiv.innerText = percent >= 12 ? `${percent}%` : '';
    consumedPercentMsg.innerHTML = `💧 ${percent}% от нормы (${total} / ${goal} мл)`;
    
    // Статус
    if (total === 0) {
        statusEmojiSpan.innerText = "😴";
        statusMessageSpan.innerText = "Начните день со стакана воды!";
    } else if (percent < 50) {
        statusEmojiSpan.innerText = "🌊";
        statusMessageSpan.innerText = "Хорошее начало, пейте больше!";
    } else if (percent < 100) {
        statusEmojiSpan.innerText = "😊";
        statusMessageSpan.innerText = "Отлично! Вы на пути к цели!";
    } else {
        statusEmojiSpan.innerText = "🏆";
        statusMessageSpan.innerText = "Цель достигнута! Вы молодец!";
    }
    
    // История
    renderHistory();
    updateMotivation();
}

function renderHistory() {
    historyListDiv.innerHTML = "";
    if (!currentData.logs.length) {
        historyListDiv.innerHTML = '<div class="empty-log">Нет записей, добавьте воду 🥤</div>';
        return;
    }
    const sorted = [...currentData.logs].sort((a,b) => b.timestamp - a.timestamp);
    for (let i = 0; i < sorted.length; i++) {
        const log = sorted[i];
        const originalIndex = currentData.logs.findIndex(l => l.timestamp === log.timestamp);
        const div = document.createElement("div");
        div.className = "log-item";
        div.innerHTML = `
            <div><span class="log-amount">+${log.amount} мл</span> <span class="log-time">${log.timeStr}</span></div>
            <button class="delete-log" data-index="${originalIndex}">✖</button>
        `;
        historyListDiv.appendChild(div);
    }
    document.querySelectorAll(".delete-log").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const idx = btn.getAttribute("data-index");
            if (idx !== null) deleteLog(parseInt(idx, 10));
        });
    });
}

function deleteLog(index) {
    if (index >= 0 && index < currentData.logs.length) {
        currentData.totalMl -= currentData.logs[index].amount;
        currentData.logs.splice(index, 1);
        persistData();
        renderAll();
        updateChart();
    }
}

function resetDay() {
    if (confirm("Сбросить сегодняшнюю статистику?")) {
        currentData.totalMl = 0;
        currentData.logs = [];
        persistData();
        renderAll();
        updateChart();
    }
}

function clearHistory() {
    if (confirm("Удалить все записи?")) {
        currentData.totalMl = 0;
        currentData.logs = [];
        persistData();
        renderAll();
        updateChart();
    }
}

function changeGoal() {
    const newGoal = parseInt(goalInput.value, 10);
    if (newGoal > 0 && newGoal <= 10000) {
        currentData.goal = newGoal;
        persistData();
        renderAll();
        alert("Цель обновлена!");
    } else {
        alert("Введите корректное значение (1-10000 мл)");
    }
}

function clearAllData() {
    if (confirm("⚠️ ВНИМАНИЕ! Это удалит ВСЕ данные навсегда. Продолжить?")) {
        localStorage.clear();
        location.reload();
    }
}

// Инициализация событий
function initEventListeners() {
    document.querySelectorAll(".water-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const ml = parseInt(btn.getAttribute("data-ml"), 10);
            addWater(ml);
        });
    });
    
    addCustomBtn.addEventListener("click", () => {
        let val = parseInt(customAmountInput.value, 10);
        if (val > 0) addWater(val);
        customAmountInput.value = "150";
    });
    
    resetDayBtn.addEventListener("click", resetDay);
    clearHistoryBtn.addEventListener("click", clearHistory);
    themeToggle.addEventListener("click", toggleTheme);
    
    // Вкладки
    tabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const tabId = btn.getAttribute("data-tab");
            tabBtns.forEach(b => b.classList.remove("active"));
            tabContents.forEach(c => c.classList.remove("active"));
            btn.classList.add("active");
            document.getElementById(`${tabId}Tab`).classList.add("active");
            if (tabId === "stats") updateChart();
            if (tabId === "achievements") renderAchievements();
        });
    });
    
    // Настройки
    notifyPermissionBtn.addEventListener("click", requestNotificationPermission);
    saveRemindersBtn.addEventListener("click", scheduleReminders);
    exportDataBtn.addEventListener("click", exportData);
    importDataBtn.addEventListener("click", () => importFileInput.click());
    importFileInput.addEventListener("change", (e) => {
        if (e.target.files[0]) importData(e.target.files[0]);
    });
    saveGoalBtn.addEventListener("click", changeGoal);
    clearAllDataBtn.addEventListener("click", clearAllData);
}

// Инициализация
function init() {
    currentData = loadData();
    renderAll();
    initEventListeners();
    
    // Восстановление темы
    if (localStorage.getItem("dark_theme") === "true") {
        document.body.classList.add("dark-theme");
        themeToggle.textContent = "☀️";
    }
    
    // Восстановление напоминаний
    const savedReminders = localStorage.getItem("reminder_times");
    if (savedReminders) {
        const times = JSON.parse(savedReminders);
        if (times[0]) reminderTime1.value = times[0];
        if (times[1]) reminderTime2.value = times[1];
        if (times[2]) reminderTime3.value = times[2];
    }
    
    if (Notification.permission === "granted") scheduleReminders();
    
    updateMotivation();
}

init();