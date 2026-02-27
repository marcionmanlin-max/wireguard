"""
IonMan DNS — Environment / credential loader.

Reads config/db.env (gitignored) and injects values into os.environ
so they are available via os.environ.get('IONMAN_DB_PASS', '').
Values already set in the process environment (e.g. from systemd
EnvironmentFile=) take priority and are not overwritten.
"""

import os

_BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_ENV_FILE = os.path.join(_BASE, 'config', 'db.env')


def load_env(path: str = _ENV_FILE) -> None:
    """Load KEY=VALUE pairs from *path* into os.environ (won't overwrite)."""
    if not os.path.exists(path):
        return
    with open(path) as f:
        for raw in f:
            line = raw.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            key, _, value = line.partition('=')
            key   = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value
