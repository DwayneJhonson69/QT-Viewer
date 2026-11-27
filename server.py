#!/usr/bin/env python3
"""Local HTTP server with static file serving + POST endpoint for saving scene adjustments."""
import http.server
import json
import os

PORT = 8080
ROOT = os.path.dirname(os.path.abspath(__file__))
ADJ_FILE = os.path.join(ROOT, "characters", "scene_adjustments.json")


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def do_POST(self):
        if self.path == "/api/save-adjustments":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)
            try:
                data = json.loads(body)
                os.makedirs(os.path.dirname(ADJ_FILE), exist_ok=True)
                with open(ADJ_FILE, "w", encoding="utf-8") as f:
                    json.dump(data, f, indent=2)
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"ok":true}')
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode())
        else:
            self.send_response(404)
            self.end_headers()


if __name__ == "__main__":
    print(f"Serving {ROOT} on http://localhost:{PORT}")
    http.server.HTTPServer(("", PORT), Handler).serve_forever()
