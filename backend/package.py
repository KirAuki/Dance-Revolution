"""Prepare a release with a private app, public assets and the .com redirect."""
import shutil
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from .validation import ROOT


def main():
    name = "host0-" + datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    target = ROOT / "release" / name
    app, public = target / "application", target / "public"
    if not (ROOT / "dist" / "index.html").is_file():
        raise SystemExit("Run npm run build first")
    app.mkdir(parents=True, exist_ok=False)
    public.mkdir()
    for directory in ("backend", "shared"):
        shutil.copytree(ROOT / directory, app / directory, ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
    (app / "dist" / "admin").mkdir(parents=True)
    for name in ("index.html", "admin/index.html"):
        shutil.copy2(ROOT / "dist" / name, app / "dist" / name)
    for directory in ("assets", "bundles", "docs"):
        shutil.copytree(ROOT / "dist" / directory, public / directory)
    for name in ("requirements.txt", "requirements.lock"):
        shutil.copy2(ROOT / name, app / name)
    shutil.copy2(ROOT / "deploy" / "host0" / ".env.example", app / ".env.example")
    for name in ("passenger_wsgi.py", ".htaccess"):
        shutil.copy2(ROOT / "deploy" / "host0" / name, public / name)
    (target / "redirect-com").mkdir()
    shutil.copy2(ROOT / "deploy" / "host0" / "redirect-com.htaccess", target / "redirect-com" / ".htaccess")
    shutil.copy2(ROOT / "docs" / "hosting-reg-ru.md", target / "READ-ME.md")
    archive = target.with_suffix(".zip")
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as bundle:
        for filename in target.rglob("*"):
            if filename.is_file():
                bundle.write(filename, filename.relative_to(target).as_posix())
    print("Release: " + str(archive))
    print("Existing database and uploads are NOT included. Follow READ-ME.md to import them.")
    if not (public / "assets" / "hero-video.mp4").is_file():
        print("Hero video is absent; the poster will be shown until it is uploaded separately.")


if __name__ == "__main__":
    main()
