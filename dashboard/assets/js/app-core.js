/* Core helpers for post-login pages */
(function () {
	const AUTH_KEY    = "auth_user_id";
	const SESSION_KEY = "auth_session_id";
	const NAME_KEY    = "auth_name";
	const API_BASE    = "/api";
	const LOGIN_URL   = "/before_login/login.html";

	function getAuthUserId() {
		return localStorage.getItem(AUTH_KEY);
	}

	function getAuthName() {
		return localStorage.getItem(NAME_KEY) || "";
	}

	function requireAuth() {
		const userId = getAuthUserId();
		if (!userId) {
			window.location.href = LOGIN_URL;
			return null;
		}
		return userId;
	}

	function attachLogout() {
		document.querySelectorAll("[data-logout]").forEach((link) => {
			link.addEventListener("click", async (event) => {
				event.preventDefault();
				const sessionId = localStorage.getItem(SESSION_KEY);
				if (sessionId) {
					try {
						await fetch(`${API_BASE}/auth/logout`, {
							method:  "POST",
							headers: { "Content-Type": "application/json" },
							body:    JSON.stringify({ session_id: sessionId })
						});
					} catch (_) { /* 靜默忽略網路錯誤 */ }
				}
				await finalizeCurrentSession();
				localStorage.removeItem(AUTH_KEY);
				localStorage.removeItem(SESSION_KEY);
				localStorage.removeItem(NAME_KEY);
				window.location.href = LOGIN_URL;
			});
		});
	}

	// ── Cross-page session management ────────────────────────────────────────

	const SESSION_ACTIVE_KEY = "active_session_id";
	const STALE_MS           = 5 * 60 * 1000; // 5 min without a ping = stale
	let _heartbeatTimer   = null;
	let _heartbeatPayload = null; // { sessionId, sessionsData }

	function _closeSessionRecord(session, closeTime) {
		if (!session || !session.active) return;
		session.last_ping_at = formatISOWithOffset(closeTime);
		session.logout_at    = formatISOWithOffset(closeTime);
		session.duration_sec = Math.max(0, Math.floor((closeTime - new Date(session.login_at)) / 1000));
		session.active       = false;
	}

	async function startOrContinueSession(userId) {
		let sessionsData;
		try { sessionsData = await loadData("login_sessions.json"); } catch (_) { sessionsData = null; }
		if (!Array.isArray(sessionsData?.items)) sessionsData = { schema_version: 1, items: [] };

		const now      = new Date();
		const storedId = localStorage.getItem(SESSION_ACTIVE_KEY);

		let session = storedId
			? sessionsData.items.find(s => s.session_id === storedId && s.active)
			: null;

		if (session && session.last_ping_at && (now - new Date(session.last_ping_at)) > STALE_MS) {
			_closeSessionRecord(session, new Date(session.last_ping_at));
			session = null;
		}

		if (!session) {
			sessionsData.items
				.filter(s => s.user_id === userId && s.active)
				.forEach(s => _closeSessionRecord(s, s.last_ping_at ? new Date(s.last_ping_at) : new Date(s.login_at)));

			session = {
				session_id:   nextId("s_", sessionsData.items),
				user_id:      userId,
				login_at:     formatISOWithOffset(now),
				logout_at:    null,
				last_ping_at: formatISOWithOffset(now),
				duration_sec: null,
				active:       true
			};
			sessionsData.items.push(session);
			localStorage.setItem(SESSION_ACTIVE_KEY, session.session_id);
		} else {
			session.last_ping_at = formatISOWithOffset(now);
		}

		await saveData("login_sessions.json", sessionsData);
		_heartbeatPayload = { sessionId: session.session_id, sessionsData };
		return { session, sessionsData };
	}

	function startHeartbeat() {
		if (_heartbeatTimer) clearInterval(_heartbeatTimer);

		const ping = async () => {
			if (document.visibilityState !== "visible" || !_heartbeatPayload) return;
			const { sessionId, sessionsData } = _heartbeatPayload;
			const s = sessionsData.items.find(s => s.session_id === sessionId);
			if (!s || !s.active) return;
			s.last_ping_at = formatISOWithOffset(new Date());
			try { await saveData("login_sessions.json", sessionsData); } catch (_) { /* silent */ }
		};

		_heartbeatTimer = setInterval(ping, 60_000);

		document.addEventListener("visibilitychange", () => {
			if (document.visibilityState === "visible") ping();
		});

		window.addEventListener("pagehide", () => {
			if (!_heartbeatPayload) return;
			const { sessionId, sessionsData } = _heartbeatPayload;
			const s = sessionsData.items.find(s => s.session_id === sessionId);
			if (!s || !s.active) return;
			s.last_ping_at = formatISOWithOffset(new Date());
			const body = JSON.stringify(sessionsData);
			const blob = new Blob([body], { type: "application/json" });
			if (!navigator.sendBeacon?.("/api/data/login_sessions.json", blob)) {
				fetch("/api/data/login_sessions.json", { method: "PUT", headers: { "Content-Type": "application/json" }, body, keepalive: true });
			}
		});
	}

	async function finalizeCurrentSession() {
		if (!_heartbeatPayload) return;
		const { sessionId, sessionsData } = _heartbeatPayload;
		const s = sessionsData.items.find(s => s.session_id === sessionId);
		if (s) _closeSessionRecord(s, new Date());
		localStorage.removeItem(SESSION_ACTIVE_KEY);
		_heartbeatPayload = null;
		if (_heartbeatTimer) { clearInterval(_heartbeatTimer); _heartbeatTimer = null; }
		try { await saveData("login_sessions.json", sessionsData); } catch (_) { /* silent */ }
	}

	async function loadData(fileName) {
		const response = await fetch(`${API_BASE}/data/${encodeURIComponent(fileName)}`, { cache: "no-store" });
		if (!response.ok) {
			throw new Error(`Failed to load ${fileName}`);
		}
		return response.json();
	}

	async function saveData(fileName, data) {
		const response = await fetch(`${API_BASE}/data/${encodeURIComponent(fileName)}`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(data)
		});
		if (!response.ok) {
			throw new Error(`Failed to save ${fileName}`);
		}
		return response.json();
	}

	async function loadDailySuggestions(userId, date) {
		const params = new URLSearchParams({ user_id: userId });
		if (date) {
			params.set("date", date);
		}
		const response = await fetch(`${API_BASE}/daily-suggestions?${params.toString()}`, { cache: "no-store" });
		if (!response.ok) {
			throw new Error("Failed to load daily suggestions");
		}
		return response.json();
	}

	async function loadDashboardMetrics(userId, weekStart) {
		const params = new URLSearchParams({ user_id: userId });
		if (weekStart) {
			params.set("week_start", weekStart);
		}
		const response = await fetch(`${API_BASE}/dashboard/metrics?${params.toString()}`, { cache: "no-store" });
		if (!response.ok) {
			throw new Error("Failed to load dashboard metrics");
		}
		return response.json();
	}

	function nextId(prefix, items) {
		const nextNumber = items.length + 1;
		return `${prefix}${String(nextNumber).padStart(4, "0")}`;
	}

	function formatISOWithOffset(date) {
		const pad = (value) => String(value).padStart(2, "0");
		const offsetMinutes = -date.getTimezoneOffset();
		const sign = offsetMinutes >= 0 ? "+" : "-";
		const absMinutes = Math.abs(offsetMinutes);
		const offsetHours = pad(Math.floor(absMinutes / 60));
		const offsetMins = pad(absMinutes % 60);

		return (
			`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
			`T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
			`${sign}${offsetHours}:${offsetMins}`
		);
	}

	function formatDateOnly(date) {
		const pad = (value) => String(value).padStart(2, "0");
		return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
	}

	function formatTimeOnly(date) {
		const pad = (value) => String(value).padStart(2, "0");
		return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
	}

	function formatDateTimeLabel(isoString) {
		const date = new Date(isoString);
		return `${formatDateOnly(date)} ${formatTimeOnly(date)}`;
	}

	function formatDuration(seconds) {
		const total = Math.max(0, Math.floor(seconds));
		const hours = Math.floor(total / 3600);
		const minutes = Math.floor((total % 3600) / 60);
		const secs = total % 60;
		return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
	}

	function formatRemaining(targetDate) {
		const diff = targetDate.getTime() - Date.now();
		const abs = Math.abs(diff);
		const days = Math.floor(abs / (1000 * 60 * 60 * 24));
		const hours = Math.floor((abs / (1000 * 60 * 60)) % 24);
		const minutes = Math.floor((abs / (1000 * 60)) % 60);
		const label = `${days} 天 ${hours} 小時 ${minutes} 分`;
		return diff >= 0 ? `剩餘 ${label}` : `已逾期 ${label}`;
	}

	function parseDateTimeInputs(dateValue, timeValue) {
		return new Date(`${dateValue}T${timeValue}:00`);
	}

	window.App = {
		getAuthUserId,
		getAuthName,
		requireAuth,
		attachLogout,
		loadData,
		saveData,
		loadDailySuggestions,
		loadDashboardMetrics,
		startOrContinueSession,
		startHeartbeat,
		finalizeCurrentSession,
		nextId,
		formatISOWithOffset,
		formatDateOnly,
		formatTimeOnly,
		formatDateTimeLabel,
		formatDuration,
		formatRemaining,
		parseDateTimeInputs
	};

	document.addEventListener("DOMContentLoaded", attachLogout);
})();
