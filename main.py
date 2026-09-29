import json
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

from api import auth, dashboard, calendar, game, psych, ai

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# 依 prefix 對應到各模組的 handle()
ROUTE_MAP = {
    "/api/auth/":             auth.handle,
    "/api/data/":             dashboard.handle,
    "/api/dashboard/":        dashboard.handle,
    "/api/daily-suggestions": dashboard.handle,
    "/api/health":            dashboard.handle,
    "/api/calendar/":         calendar.handle,
    "/api/game/":             game.handle,
    "/api/psych/":            psych.handle,
    "/api/ai/":               ai.handle,
}


def _send_json(handler, status, payload):
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.end_headers()
    handler.wfile.write(body)


def _read_body(handler):
    content_length = int(handler.headers.get("Content-Length", "0"))
    if content_length <= 0:
        return None
    raw = handler.rfile.read(content_length).decode("utf-8")
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


class AppHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def log_message(self, _format, *_args):
        pass

    def end_headers(self):
        path = urlparse(self.path).path
        if path.endswith(('.html', '.js', '.css')):
            self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path in {"/", ""}:
            self.send_response(302)
            self.send_header("Location", "/before_login/final.html")
            self.end_headers()
            return
        if parsed.path in {"/dashboard", "/dashboard/"}:
            self.send_response(302)
            self.send_header("Location", "/dashboard/dashboard.html")
            self.end_headers()
            return
        if parsed.path in {"/calnader", "/calnader/", "/calendar", "/calendar/"}:
            self.send_response(302)
            self.send_header("Location", "/calnader/calendar.html")
            self.end_headers()
            return
        if parsed.path in {"/game", "/game/"}:
            self.send_response(302)
            self.send_header("Location", "/game/game.html")
            self.end_headers()
            return
        if parsed.path in {"/psych", "/psych/"}:
            self.send_response(302)
            self.send_header("Location", "/psych/psych_index.html")
            self.end_headers()
            return
        if parsed.path in {"/ai-assistant", "/ai-assistant/"}:
            self.send_response(302)
            self.send_header("Location", "/ai-assistant/ai-assistant.html")
            self.end_headers()
            return
        if parsed.path.startswith("/api/"):
            self._dispatch("GET", parsed)
            return
        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/"):
            self._dispatch("POST", parsed)
            return
        self.send_error(405)

    def do_PUT(self):
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/"):
            self._dispatch("PUT", parsed)
            return
        self.send_error(405)

    def do_DELETE(self):
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/"):
            self._dispatch("DELETE", parsed)
            return
        self.send_error(405)

    def _dispatch(self, method, parsed):
        path   = parsed.path
        params = parse_qs(parsed.query)
        body   = _read_body(self) if method in ("POST", "PUT") else None

        handler_fn = None
        for prefix, fn in ROUTE_MAP.items():
            if path == prefix or path.startswith(prefix):
                handler_fn = fn
                break

        if handler_fn is None:
            return _send_json(self, 404, {"error": "Unknown API route."})

        try:
            status, payload = handler_fn(method, path, body, params)
        except Exception as exc:
            return _send_json(self, 500, {"error": str(exc)})

        _send_json(self, status, payload)


def run():
    port   = int(os.getenv("PORT", "8000"))
    server = ThreadingHTTPServer(("0.0.0.0", port), AppHandler)
    print(f"Server running at http://localhost:{port}")
    print(f"  Landing  : http://localhost:{port}/")
    print(f"  Login    : http://localhost:{port}/before_login/login.html")
    print(f"  Dashboard: http://localhost:{port}/dashboard/dashboard.html")
    print(f"  Game     : http://localhost:{port}/game/game.html")
    print(f"  Psych    : http://localhost:{port}/psych/psych_index.html")
    print(f"  AI助手   : http://localhost:{port}/ai-assistant/ai-assistant.html")
    server.serve_forever()


if __name__ == "__main__":
    run()
