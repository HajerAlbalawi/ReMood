#!/usr/bin/env bash
set -euo pipefail

streamlit run app.py --server.port "${PORT:-5000}" --server.address 0.0.0.0