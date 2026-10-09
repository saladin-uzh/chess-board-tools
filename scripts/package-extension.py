#!/usr/bin/env python3
"""Build a deterministic store ZIP from the working tree or a verified Git tag."""

import argparse
import hashlib
from html.parser import HTMLParser
import io
import json
from pathlib import Path, PurePosixPath
import re
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parent.parent
FILES = (
    "manifest.json", "settings.js", "content.js", "popup.html", "popup.css",
    "popup.js", "fog-popup.js", "fog-visibility.js", "fog-board.js",
    "fog-content.js", "fog-bridge.js", "fog.css", "assist-popup.js",
    "assist-board.js", "assist-content.js", "assist-bridge.js", "assist-timer.js",
    "assist.css", "icons/icon-16.png", "icons/icon-32.png",
    "icons/icon-48.png", "icons/icon-128.png",
)


def git(*args):
    return subprocess.check_output(["git", "-C", str(ROOT), *args])


class References(HTMLParser):
    def __init__(self):
        super().__init__()
        self.paths = []

    def handle_starttag(self, tag, attrs):
        for key, value in attrs:
            if value and (key == "src" or (tag == "link" and key == "href")):
                self.paths.append(value)


def validate(files):
    manifest = json.loads(files["manifest.json"])
    if manifest["manifest_version"] != 3 or manifest["name"] != "Chess Board Tools":
        raise ValueError("Expected a Manifest V3 Chess Board Tools package")
    if not re.fullmatch(r"\d+\.\d+\.\d+", manifest["version"]):
        raise ValueError("Expected a three-component release version")
    refs = list(manifest["icons"].values()) + [manifest["action"]["default_popup"]]
    for script in manifest["content_scripts"]:
        refs.extend(script.get("js", []))
        refs.extend(script.get("css", []))
    parser = References()
    parser.feed(files["popup.html"].decode())
    refs.extend(parser.paths)
    for name, data in files.items():
        if name.endswith(".css"):
            for ref in re.findall(r"url\(\s*['\"]?([^)'\"\s]+)", data.decode()):
                refs.append(str(PurePosixPath(name).parent / ref))
    for ref in refs:
        if ref not in files:
            raise ValueError(f"Missing or non-local runtime reference: {ref}")
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ref", help="Signed tag; its target commit must also be signed")
    parser.add_argument("--output-dir", type=Path, default=ROOT / "build")
    args = parser.parse_args()
    if args.ref:
        if args.ref.startswith("-"):
            parser.error("Invalid Git reference")
        subprocess.run(["git", "-C", str(ROOT), "verify-tag", args.ref], check=True)
        commit = git("rev-parse", f"{args.ref}^{{commit}}").decode().strip()
        subprocess.run(["git", "-C", str(ROOT), "verify-commit", commit], check=True)
        files = {name: git("show", f"{commit}:{name}") for name in FILES}
    else:
        commit = git("rev-parse", "HEAD").decode().strip()
        files = {name: (ROOT / name).read_bytes() for name in FILES}
    manifest = validate(files)
    if args.ref and args.ref != f"v{manifest['version']}":
        raise ValueError("Tag does not match manifest version")
    suffix = "" if args.ref else "-candidate"
    name = f"chess-board-tools-v{manifest['version']}{suffix}.zip"
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path, data in sorted(files.items()):
            entry = zipfile.ZipInfo(path, date_time=(1980, 1, 1, 0, 0, 0))
            entry.compress_type = zipfile.ZIP_DEFLATED
            entry.external_attr = 0o100644 << 16
            archive.writestr(entry, data)
    payload = buffer.getvalue()
    with zipfile.ZipFile(io.BytesIO(payload)) as archive:
        if archive.testzip() is not None or set(archive.namelist()) != set(FILES):
            raise ValueError("ZIP integrity or membership check failed")
        for path, data in files.items():
            if archive.read(path) != data:
                raise ValueError(f"ZIP content mismatch: {path}")
    checksum = hashlib.sha256(payload).hexdigest()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    output = args.output_dir / name
    output.write_bytes(payload)
    output.with_suffix(".zip.sha256").write_text(f"{checksum}  {name}\n")
    output.with_suffix(".zip.provenance.json").write_text(json.dumps({
        "version": manifest["version"], "sourceCommit": commit,
        "signedTag": args.ref, "candidate": args.ref is None,
        "sha256": checksum,
        "files": {path: hashlib.sha256(data).hexdigest() for path, data in sorted(files.items())},
    }, indent=2) + "\n")
    print(f"{output}\nSHA-256: {checksum}\nRuntime files: {len(files)}")


if __name__ == "__main__":
    main()
