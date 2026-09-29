/* Dashboard page logic */
(function () {
	const app = window.App;

	function currentWeekStart() {
		const today = new Date();
		const dayOfWeek = (today.getDay() + 6) % 7; // Mon=0 … Sun=6
		return app.formatDateOnly(new Date(today.getFullYear(), today.getMonth(), today.getDate() - dayOfWeek));
	}

	async function ensureState(userId, stateData) {
		const weekStart = currentWeekStart();
		let state = stateData.items.find((item) => item.user_id === userId);
		if (!state) {
			state = {
				user_id: userId,
				selected_week_start: weekStart,
				show_completed_tasks: false,
				collapsed_cards: [],
				updated_at: app.formatISOWithOffset(new Date())
			};
			stateData.items.push(state);
			await app.saveData("dashboard_state.json", stateData);
		} else if (state.selected_week_start !== weekStart) {
			state.selected_week_start = weekStart;
			state.updated_at = app.formatISOWithOffset(new Date());
			await app.saveData("dashboard_state.json", stateData);
		}
		return state;
	}

	async function logAction(actionsData, userId, action, detail) {
		const entry = {
			log_id: app.nextId("dash_", actionsData.items),
			user_id: userId,
			action,
			detail,
			ts: app.formatISOWithOffset(new Date())
		};
		actionsData.items.push(entry);
		await app.saveData("dashboard_actions_log.json", actionsData);
	}

	function applyCardState(card, isCollapsed) {
		if (!card) {
			return;
		}
		card.classList.toggle("is-collapsed", isCollapsed);
		const toggle = card.querySelector("[data-action='toggle-card']");
		if (toggle) {
			toggle.textContent = isCollapsed ? "展開" : "收合";
		}
	}

	function setupCardToggles(state, stateData, actionsData, userId) {
		document.querySelectorAll("[data-card]").forEach((card) => {
			const cardId = card.getAttribute("data-card");
			const isCollapsed = state.collapsed_cards.includes(cardId);
			applyCardState(card, isCollapsed);
		});

		document.addEventListener("click", async (event) => {
			const target = event.target.closest("[data-action='toggle-card']");
			if (!target) {
				return;
			}
			event.preventDefault();
			const cardId = target.getAttribute("data-card");
			const isCollapsed = state.collapsed_cards.includes(cardId);
			state.collapsed_cards = isCollapsed
				? state.collapsed_cards.filter((id) => id !== cardId)
				: state.collapsed_cards.concat(cardId);
			state.updated_at = app.formatISOWithOffset(new Date());
			await app.saveData("dashboard_state.json", stateData);
			await logAction(actionsData, userId, "toggle_card", { card: cardId, state: isCollapsed ? "expanded" : "collapsed" });
			applyCardState(document.querySelector(`[data-card='${cardId}']`), !isCollapsed);
		});
	}

	function normalizeTasksData(tasksData) {
		if (!tasksData || !Array.isArray(tasksData.items)) {
			return { schema_version: 1, items: [] };
		}
		return tasksData;
	}

	function updateGreeting() {
		const greeting = document.querySelector("[data-role='greeting']");
		if (!greeting) {
			return;
		}
		const hour = new Date().getHours();
		if (hour < 12) {
			greeting.textContent = "Good Morning";
		} else if (hour < 18) {
			greeting.textContent = "Good Afternoon";
		} else {
			greeting.textContent = "Good Evening";
		}
	}

	function updateTaskCompletionStat(tasksData, userId) {
		const stat = document.querySelector("[data-role='stat-completed']");
		if (!stat) {
			return;
		}
		const completedCount = tasksData.items.filter((task) => task.user_id === userId && task.status === "completed").length;
		stat.textContent = String(completedCount);
	}

	function calculateStreak(sessionsData, userId) {
		if (!sessionsData || !Array.isArray(sessionsData.items)) {
			return 0;
		}
		const activeDates = new Set(
			sessionsData.items
				.filter((session) => session.user_id === userId)
				.map((session) => app.formatDateOnly(new Date(session.login_at)))
		);
		let streak = 0;
		const cursor = new Date();
		while (activeDates.has(app.formatDateOnly(cursor))) {
			streak += 1;
			cursor.setDate(cursor.getDate() - 1);
		}
		return streak;
	}

	function updateHeroStats(tasksData, sessionsData, metricsEntry, userId) {
		updateTaskCompletionStat(tasksData, userId);
		const streakEl = document.querySelector("[data-role='stat-streak']");
		if (streakEl) {
			streakEl.textContent = String(calculateStreak(sessionsData, userId));
		}
		const completionEl = document.querySelector("[data-role='stat-completion']");
		if (completionEl) {
			const values = metricsEntry && Array.isArray(metricsEntry.task_completion_rate)
				? metricsEntry.task_completion_rate
				: [];
			const avg = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
			completionEl.textContent = `${Math.round(avg)}%`;
		}
	}

	function renderTasks(tasksData, state) {
		const list = document.querySelector("[data-role='task-list']");
		updateTaskCompletionStat(tasksData, state.user_id);
		if (!list) {
			return;
		}
		const tasks = tasksData.items
			.filter((task) => task.user_id === state.user_id)
			.filter((task) => task.status !== "archived")
			.filter((task) => (state.show_completed_tasks ? true : task.status !== "completed"))
			.sort((a, b) => new Date(a.due_at || 0) - new Date(b.due_at || 0))
			.slice(0, 5);

		if (!tasks.length) {
			list.innerHTML = "<li class=\"empty-state\">目前沒有待辦工作。</li>";
			return;
		}

		list.innerHTML = tasks
			.map((task) => {
				const dueDate = task.due_at ? new Date(task.due_at) : null;
				const remaining = dueDate ? app.formatRemaining(dueDate) : "未設定截止";
				const statusLabel = task.status === "completed" ? "已完成" : "進行中";
				const statusClass = task.status === "completed" ? "badge success" : "badge";
				return `
					<li>
						<button class="task-item" type="button" data-action="task-open" data-task-id="${task.task_id}">
							<div class="title">${task.title}</div>
							<div class="meta">${dueDate ? app.formatDateTimeLabel(task.due_at) : "未設定截止"} · ${remaining}</div>
							<div class="meta"><span class="${statusClass}">${statusLabel}</span></div>
						</button>
					</li>
				`;
			})
			.join("");
	}

	function setupTaskModal(tasksData, state, actionsData, userId, onTaskComplete) {
		const modal = document.getElementById("task-modal");
		if (!modal) {
			return;
		}
		const titleEl = modal.querySelector("[data-role='task-modal-title']");
		const metaEl = modal.querySelector("[data-role='task-modal-meta']");
		const noteEl = modal.querySelector("[data-role='task-modal-note']");
		const completeButton = modal.querySelector("[data-action='task-complete']");
		let activeTaskId = null;

		// Ensure modal is hidden on initialization
		modal.classList.add("is-hidden");
		modal.setAttribute("aria-hidden", "true");
		modal.setAttribute("hidden", "");

		const closeModal = () => {
			activeTaskId = null;
			modal.classList.add("is-hidden");
			modal.setAttribute("aria-hidden", "true");
			modal.setAttribute("hidden", "");
		};

		const openModal = (task) => {
			activeTaskId = task.task_id;
			if (titleEl) {
				titleEl.textContent = task.title || "未命名工作";
			}
			if (metaEl) {
				const metaParts = [];
				if (task.course) {
					metaParts.push(task.course);
				}
				if (task.due_at) {
					metaParts.push(app.formatDateTimeLabel(task.due_at));
				}
				metaEl.textContent = metaParts.join(" · ");
			}
			if (noteEl) {
				if (task.note) {
					noteEl.textContent = `備註：${task.note}`;
					noteEl.style.display = "";
				} else {
					noteEl.textContent = "";
					noteEl.style.display = "none";
				}
			}
			if (completeButton) {
				completeButton.style.display = task.status === "completed" ? "none" : "";
			}
			modal.removeAttribute("hidden");
			modal.classList.remove("is-hidden");
			modal.setAttribute("aria-hidden", "false");
		};

		document.addEventListener("click", async (event) => {
			const openTrigger = event.target.closest("[data-action='task-open']");
			if (openTrigger) {
				event.preventDefault();
				const taskId = openTrigger.getAttribute("data-task-id");
				const task = tasksData.items.find((item) => item.task_id === taskId);
				if (!task) {
					return;
				}
				openModal(task);
				return;
			}
			const closeTrigger = event.target.closest("[data-action='modal-close']");
			if (closeTrigger) {
				event.preventDefault();
				closeModal();
				return;
			}
			const completeTrigger = event.target.closest("[data-action='task-complete']");
			if (!completeTrigger) {
				return;
			}
			event.preventDefault();
			if (!activeTaskId) {
				closeModal();
				return;
			}
			const task = tasksData.items.find((item) => item.task_id === activeTaskId);
			if (!task) {
				closeModal();
				return;
			}
			if (task.status !== "completed") {
				const now = new Date();
				task.status = "completed";
				task.completed_at = app.formatISOWithOffset(now);
				task.updated_at = app.formatISOWithOffset(now);
				await app.saveData("calendar_tasks.json", tasksData);
				await logAction(actionsData, userId, "complete_task", { task_id: task.task_id });
				renderTasks(tasksData, state);
				if (onTaskComplete) await onTaskComplete();
			}
			closeModal();
		});
	}

	function renderSuggestions(suggestionsData, userId) {
		const container = document.querySelector("[data-role='suggestion-list']");
		const meta = document.querySelector("[data-role='suggestion-meta']");
		if (!container) {
			return null;
		}
		const todayKey = app.formatDateOnly(new Date());
		const entry =
			suggestionsData.items.find((item) => item.user_id === userId && item.date === todayKey) ||
			suggestionsData.items[0];

		if (!entry) {
			container.innerHTML = "<div class=\"empty-state\">尚未建立 Daily Suggest。</div>";
			if (meta) {
				meta.textContent = "";
			}
			return null;
		}
		if (!entry.feedback) {
			entry.feedback = { done: 0, skipped: 0 };
		}

		if (meta) {
			meta.textContent = `(${entry.source} / ${entry.status})`;
		}

		container.innerHTML = entry.suggestions
			.map((text, index) => {
				return `
					<li>
						<div class="suggestion-item">
							<span class="suggestion-check"></span>
							<div class="title">${text}</div>
							<div class="inline-actions">
								<a href="#" class="button small" data-action="suggest-done" data-index="${index}">完成</a>
								<a href="#" class="button small" data-action="suggest-skip" data-index="${index}">忽略</a>
							</div>
						</div>
					</li>
				`;
			})
			.join("");
		return entry;
	}

	function setupSuggestionActions(entry, suggestionsData, actionsData, userId) {
		if (!entry) {
			return;
		}
		document.addEventListener("click", async (event) => {
			const target = event.target.closest("[data-action^='suggest-']");
			if (!target) {
				return;
			}
			event.preventDefault();
			const index = Number(target.getAttribute("data-index"));
			if (!Number.isInteger(index)) {
				return;
			}
			const action = target.getAttribute("data-action");
			if (action === "suggest-done") {
				entry.feedback.done += 1;
				entry.status = "done";
			} else if (action === "suggest-skip") {
				entry.feedback.skipped += 1;
				entry.status = "skipped";
			}
			await app.saveData("daily_suggestions.json", suggestionsData);
			await logAction(actionsData, userId, action, { index });
			renderSuggestions(suggestionsData, userId);
		});
	}

	// ===== Chart tooltip =====
	let _chartTooltip = null;

	function getChartTooltip() {
		if (!_chartTooltip) {
			_chartTooltip = document.createElement("div");
			_chartTooltip.style.cssText = [
				"position:fixed",
				"pointer-events:none",
				"z-index:500",
				"background:rgba(46,49,65,0.96)",
				"border:1px solid rgba(76,92,150,0.45)",
				"border-radius:8px",
				"padding:8px 12px",
				"font-size:0.8125rem",
				"color:#fff",
				"font-family:'Source Sans Pro',system-ui,sans-serif",
				"line-height:1.7",
				"white-space:nowrap",
				"box-shadow:0 4px 20px rgba(0,0,0,0.35)",
				"opacity:0",
				"transition:opacity 0.12s",
				"backdrop-filter:blur(8px)",
				"-webkit-backdrop-filter:blur(8px)"
			].join(";");
			document.body.appendChild(_chartTooltip);
		}
		return _chartTooltip;
	}

	function showChartTooltip(mouseX, mouseY, html) {
		const tip = getChartTooltip();
		tip.innerHTML = html;
		tip.style.opacity = "1";
		// Start near cursor; adjust after browser lays it out
		tip.style.left = (mouseX + 14) + "px";
		tip.style.top  = (mouseY - 12) + "px";
		requestAnimationFrame(() => {
			const r = tip.getBoundingClientRect();
			if (r.right > window.innerWidth - 8) {
				tip.style.left = (mouseX - r.width - 14) + "px";
			}
			if (r.top < 8) {
				tip.style.top = (mouseY + 20) + "px";
			}
		});
	}

	function hideChartTooltip() {
		if (_chartTooltip) _chartTooltip.style.opacity = "0";
	}

	function attachChartTooltip(canvas, values, maxVal, formatFn) {
		if (!canvas) return;
		const PADDING = 24;
		canvas.style.cursor = "crosshair";

		canvas.addEventListener("mousemove", (e) => {
			const rect = canvas.getBoundingClientRect();
			const mx = e.clientX - rect.left;
			const w  = rect.width;
			const cw = w - PADDING * 2;

			// Ignore mouse outside the drawable x-range
			if (mx < PADDING - 6 || mx > w - PADDING + 6) {
				hideChartTooltip();
				return;
			}

			const step = values.length > 1 ? cw / (values.length - 1) : 0;

			// Find nearest column by X distance only
			let best = 0;
			let bestDist = Infinity;
			for (let i = 0; i < values.length; i++) {
				const d = Math.abs(mx - (PADDING + step * i));
				if (d < bestDist) { bestDist = d; best = i; }
			}

			showChartTooltip(e.clientX, e.clientY, formatFn(values[best], best));
		});

		canvas.addEventListener("mouseleave", hideChartTooltip);
	}

	function formatLoginDuration(minutes) {
		const label = "<span style='color:#7985b0;font-size:0.74rem'>登入時長</span><br>";
		if (minutes <= 0) {
			return `${label}<span style='color:rgba(255,255,255,0.7)'>0 分鐘</span>`;
		}
		const h = Math.floor(minutes / 60);
		const m = minutes % 60;
		const parts = [];
		if (h > 0) parts.push(`${h} 小時`);
		if (m > 0) parts.push(`${m} 分鐘`);
		return `${label}<span style='color:#4c5c96;font-weight:600'>${parts.join(" ")}</span>`;
	}

	function drawLineChart(canvas, values, options) {
		if (!canvas) {
			return;
		}
		const ctx = canvas.getContext("2d");
		const dpr = window.devicePixelRatio || 1;
		const width = canvas.clientWidth;
		const height = canvas.clientHeight;
		canvas.width = width * dpr;
		canvas.height = height * dpr;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

		ctx.clearRect(0, 0, width, height);
		ctx.lineWidth = 1;
		ctx.strokeStyle = "rgba(255,255,255,0.15)";

		const padding = 24;
		const chartWidth = width - padding * 2;
		const chartHeight = height - padding * 2;
		const maxValue = options.max || Math.max(1, ...values);

		for (let i = 0; i <= 3; i += 1) {
			const y = padding + (chartHeight / 3) * i;
			ctx.beginPath();
			ctx.moveTo(padding, y);
			ctx.lineTo(width - padding, y);
			ctx.stroke();
		}

		ctx.strokeStyle = options.color;
		ctx.lineWidth = 2;
		ctx.beginPath();

		values.forEach((value, index) => {
			const x = padding + (chartWidth / (values.length - 1 || 1)) * index;
			const y = height - padding - (value / maxValue) * chartHeight;
			if (index === 0) {
				ctx.moveTo(x, y);
			} else {
				ctx.lineTo(x, y);
			}
		});
		ctx.stroke();

		ctx.fillStyle = options.color;
		values.forEach((value, index) => {
			const x = padding + (chartWidth / (values.length - 1 || 1)) * index;
			const y = height - padding - (value / maxValue) * chartHeight;
			ctx.beginPath();
			ctx.arc(x, y, 3, 0, Math.PI * 2);
			ctx.fill();
		});
	}

	function renderCharts(metricsEntry) {
		const entry = metricsEntry && metricsEntry.login_minutes ? metricsEntry : null;
		const loginValues = entry ? entry.login_minutes : [0, 0, 0, 0, 0, 0, 0];
		const completionValues = entry ? entry.task_completion_rate : [100, 100, 100, 100, 100, 100, 100];
		const taskCounts = (entry && Array.isArray(entry.tasks_due) && Array.isArray(entry.tasks_done))
			? { due: entry.tasks_due, done: entry.tasks_done }
			: null;

		const loginCanvas = document.getElementById("login-chart");
		const completionCanvas = document.getElementById("completion-chart");

		drawLineChart(loginCanvas, loginValues, { color: "#4c5c96" });
		drawLineChart(completionCanvas, completionValues, { color: "#7985b0", max: 100 });

		attachChartTooltip(loginCanvas, loginValues, null, (v) => formatLoginDuration(v));
		attachChartTooltip(completionCanvas, completionValues, 100, (v, i) => {
			if (!taskCounts) {
				return `<span style='color:#7985b0;font-size:0.74rem'>完成率 ${Math.round(v)}%</span>`;
			}
			const due  = taskCounts.due[i]  ?? 0;
			const done = taskCounts.done[i] ?? 0;
			return `<span style='color:rgba(255,255,255,0.8)'>需完成：${due}</span><br><span style='color:#5bbf8a'>已完成：${done}</span>`;
		});

		const totalEl = document.querySelector("[data-role='weekly-total']");
		if (totalEl) {
			const totalMinutes = loginValues.reduce((sum, value) => sum + value, 0);
			const hours = totalMinutes / 60;
			totalEl.textContent = `${hours.toFixed(1)}h`;
		}
		const completionEl = document.querySelector("[data-role='weekly-completion']");
		if (completionEl) {
			const avg = completionValues.length
				? completionValues.reduce((sum, value) => sum + value, 0) / completionValues.length
				: 0;
			completionEl.textContent = `${Math.round(avg)}%`;
		}
	}

	let timerId = null;

	function startTimer(sessionsData, userId, activeSession) {
		const timer     = document.querySelector("[data-role='login-timer']");
		const progress  = document.querySelector("[data-role='login-progress']");
		const breakHint = document.querySelector("[data-role='break-hint']");
		if (!timer) return;
		if (!activeSession) {
			timer.textContent = "00:00:00";
			if (progress)  progress.style.width = "0%";
			if (breakHint) breakHint.textContent = "";
			return;
		}
		if (timerId) window.clearInterval(timerId);

		const todayStr = app.formatDateOnly(new Date());
		const loginAt  = new Date(activeSession.login_at);

		// 今天其他已結束 session 的累積秒數
		const prevSeconds = sessionsData.items
			.filter(s => s.user_id === userId && s.session_id !== activeSession.session_id)
			.filter(s => app.formatDateOnly(new Date(s.login_at)) === todayStr)
			.reduce((sum, s) => {
				if (s.duration_sec !== null) return sum + s.duration_sec;
				if (s.last_ping_at) return sum + Math.max(0, Math.floor((new Date(s.last_ping_at) - new Date(s.login_at)) / 1000));
				return sum;
			}, 0);

		const tick = () => {
			const currentSec = Math.max(0, Math.floor((Date.now() - loginAt.getTime()) / 1000));
			const totalSec   = prevSeconds + currentSec;
			timer.textContent = app.formatDuration(totalSec);
			if (progress) {
				progress.style.width = `${((currentSec % 3600) / 3600) * 100}%`;
			}
			if (breakHint) {
				const minsUntilBreak = 60 - Math.floor((currentSec % 3600) / 60);
				breakHint.textContent = `下一次建議休息：${minsUntilBreak} 分鐘`;
			}
		};
		tick();
		timerId = window.setInterval(tick, 1000);
	}

	document.addEventListener("DOMContentLoaded", async () => {
		const userId = app.requireAuth();
		if (!userId) {
			return;
		}
		updateGreeting();
		const [tasksData, suggestionsData, stateData, actionsData] = await Promise.all([
			app.loadData("calendar_tasks.json"),
			app.loadDailySuggestions(userId),
			app.loadData("dashboard_state.json"),
			app.loadData("dashboard_actions_log.json")
		]);

		const normalizedTasksData = normalizeTasksData(tasksData);

		const { session: activeSession, sessionsData } = await app.startOrContinueSession(userId);
		app.startHeartbeat();

		const state = await ensureState(userId, stateData);
		setupCardToggles(state, stateData, actionsData, userId);

		const toggleCompleted = document.getElementById("toggle-completed");
		if (toggleCompleted) {
			toggleCompleted.checked = state.show_completed_tasks;
			toggleCompleted.addEventListener("change", async () => {
				state.show_completed_tasks = toggleCompleted.checked;
				state.updated_at = app.formatISOWithOffset(new Date());
				await app.saveData("dashboard_state.json", stateData);
				await logAction(actionsData, userId, "toggle_completed_tasks", { enabled: state.show_completed_tasks });
				renderTasks(normalizedTasksData, state);
			});
		}

		async function refreshCharts() {
			const updated = await app.loadDashboardMetrics(userId, state.selected_week_start);
			renderCharts(updated);
			updateHeroStats(normalizedTasksData, sessionsData, updated, userId);
		}

		renderTasks(normalizedTasksData, state);
		setupTaskModal(normalizedTasksData, state, actionsData, userId, refreshCharts);
		const suggestionEntry = renderSuggestions(suggestionsData, userId);
		setupSuggestionActions(suggestionEntry, suggestionsData, actionsData, userId);
		const metricsEntry = await app.loadDashboardMetrics(userId, state.selected_week_start);
		renderCharts(metricsEntry);
		updateHeroStats(normalizedTasksData, sessionsData, metricsEntry, userId);
		startTimer(sessionsData, userId, activeSession);
	});
})();
