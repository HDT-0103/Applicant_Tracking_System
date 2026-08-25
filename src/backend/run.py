"""
Launcher script that ensures psycopg3-compatible event loop on Windows.

Problem: Python 3.14 on Windows defaults to ProactorEventLoop.
         psycopg3 (async) refuses to run on ProactorEventLoop.
         uvicorn.run() creates its own loop, ignoring prior policy changes.

Solution: Use winloop (a Windows-compatible libuv loop, like uvloop on Linux)
          and pass it as the loop_factory to asyncio.run(), which uvicorn.Server
          will then inherit.
"""
import os
import sys
import asyncio

# Replicate uvicorn's --app-dir behaviour: add the backend source root
# to sys.path so that "apps.main:app" resolves correctly.
backend_dir = os.path.join(os.path.dirname(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import uvicorn


def main():
    config = uvicorn.Config(
        "apps.main:app",
        host="0.0.0.0",
        port=8000,
    )
    server = uvicorn.Server(config)

    if sys.platform == "win32":
        try:
            import winloop
            # asyncio.run with loop_factory is the Python 3.12+ way
            # to control which event loop is used. This is NOT deprecated.
            asyncio.run(server.serve(), loop_factory=winloop.new_event_loop)
            return
        except ImportError:
            pass

    asyncio.run(server.serve())


if __name__ == "__main__":
    main()
