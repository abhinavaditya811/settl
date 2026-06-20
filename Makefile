PY := .venv/bin/python

.PHONY: test demo setup
test:    ; $(PY) -m pytest -q
demo:    ; PYTHONPATH=src $(PY) demo.py
setup:   ; python3 -m venv .venv && $(PY) -m pip install -q -e ".[dev,api]"
