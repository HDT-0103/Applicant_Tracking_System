"""Pytest bootstrap: đảm bảo import được cả `modules.*` (src/backend) và
`backend.*` (src) dù pytest chạy từ thư mục nào."""
import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))   # .../src/backend
_SRC = os.path.dirname(_HERE)                          # .../src
for _p in (_HERE, _SRC):
    if _p not in sys.path:
        sys.path.insert(0, _p)
