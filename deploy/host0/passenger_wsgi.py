"""Place this file in the domain document root; keep the app outside it."""
import os
import sys
from pathlib import Path

# Change these two paths if the hosting account uses another directory layout.
APP_ROOT = Path.home() / "dance-revolution"
INTERPRETER = Path.home() / "dance-venv" / "bin" / "python"
# A venv's python is often a symlink to the system binary. Compare the
# environment, not the resolved executable, or its dependencies won't load.
if Path(sys.prefix).resolve() != INTERPRETER.parent.parent.resolve():
    os.execl(str(INTERPRETER), str(INTERPRETER), *sys.argv)
sys.path.insert(0, str(APP_ROOT))
os.environ.setdefault("APP_ENV", "production")
os.environ.setdefault("PUBLIC_DIR", str(Path(__file__).resolve().parent))
from backend.app import create_app

application = create_app()
