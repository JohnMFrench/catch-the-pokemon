#!/usr/bin/env python3
"""Dev server for the game, with caching switched off.

    python3 tools/dev_server.py [PORT]        # default 8088

`python3 -m http.server` sends no Cache-Control header, only Last-Modified. On a
phone that is enough for the browser to keep serving the copy of src/game.js it
already has, so you edit the game, refresh, and see the old build. This adds
no-store to every response, which makes a plain reload actually reload.
"""

from __future__ import annotations

import functools
import http.server
import os
import socketserver
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt: str, *args) -> None:  # quieter, still informative
        sys.stderr.write("%s  %s\n" % (self.address_string(), fmt % args))


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def main() -> None:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8088
    handler = functools.partial(NoCacheHandler, directory=ROOT)
    with Server(("0.0.0.0", port), handler) as httpd:
        print(f"serving {ROOT}")
        print(f"  http://127.0.0.1:{port}/   (this machine)")
        print(f"  http://<lan-ip>:{port}/    (phone on the same Wi-Fi)")
        print("no caching: every reload fetches the current files")
        httpd.serve_forever()


if __name__ == "__main__":
    main()
