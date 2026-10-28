#!/usr/bin/env python3
"""Developer-only bootstrap. Downloads model/code, never reads or uploads recordings."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import urllib.request

WHISPER_COMMIT = "d1be6fde11ac6e0407606b4e42fe72d34add8037"  # v1.9.5
MODEL_REVISION = "5359861c739e955e79d9a303bcbc70fb988958b1"
MODEL_SHA256 = "60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe"
ROOT = Path(__file__).resolve().parent


def run(*args):
    subprocess.run([str(x) for x in args], check=True)


def digest(path):
    result = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            result.update(chunk)
    return result.hexdigest()


def download_model(destination):
    if destination.is_file() and digest(destination) == MODEL_SHA256:
        return
    partial = destination.with_suffix(".download")
    url = f"https://huggingface.co/ggerganov/whisper.cpp/resolve/{MODEL_REVISION}/ggml-base.bin"
    print("Downloading multilingual Whisper base (~148 MB); no audio is transmitted.", flush=True)
    try:
        with urllib.request.urlopen(url, timeout=120) as response, partial.open("wb") as output:
            shutil.copyfileobj(response, output, 1024 * 1024)
        if digest(partial) != MODEL_SHA256:
            raise RuntimeError("Model checksum mismatch; refusing to use it")
        partial.replace(destination)
    finally:
        partial.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--backend", choices=["cpu", "metal", "vulkan", "cuda"], default="metal" if os.sys.platform == "darwin" else "cpu")
    parser.add_argument("--jobs", type=int, default=4)
    args = parser.parse_args()
    if args.jobs < 1:
        parser.error("--jobs must be positive")
    for tool in ("git", "cmake", "cargo"):
        if not shutil.which(tool):
            parser.error(f"Developer prerequisite missing: {tool}")
    runtime = ROOT / ".runtime"
    runtime.mkdir(exist_ok=True)
    source = runtime / "whisper.cpp"
    if not source.exists():
        run("git", "init", source)
        run("git", "-C", source, "remote", "add", "origin", "https://github.com/ggml-org/whisper.cpp.git")
    current = subprocess.run(["git", "-C", str(source), "rev-parse", "HEAD"], capture_output=True, text=True)
    if current.returncode or current.stdout.strip() != WHISPER_COMMIT:
        run("git", "-C", source, "fetch", "--depth=1", "origin", WHISPER_COMMIT)
        run("git", "-C", source, "checkout", "--detach", WHISPER_COMMIT)
    # Backend-specific directories prevent stale CMake cache settings leaking across runs.
    build = runtime / f"build-{args.backend}"
    run("cmake", "-S", source, "-B", build, "-DCMAKE_BUILD_TYPE=Release",
        "-DWHISPER_BUILD_TESTS=OFF", "-DWHISPER_CURL=OFF", "-DGGML_NATIVE=OFF",
        f"-DGGML_METAL={'ON' if args.backend == 'metal' else 'OFF'}",
        f"-DGGML_VULKAN={'ON' if args.backend == 'vulkan' else 'OFF'}",
        f"-DGGML_CUDA={'ON' if args.backend == 'cuda' else 'OFF'}")
    run("cmake", "--build", build, "--config", "Release", "--target", "whisper-cli", "--parallel", args.jobs)
    name = "whisper-cli.exe" if os.name == "nt" else "whisper-cli"
    candidates = [build / "bin" / "Release" / name, build / "bin" / name]
    binary = next((path for path in candidates if path.is_file()), None)
    if binary is None:
        raise RuntimeError("Whisper build succeeded but executable was not found")
    model = runtime / "ggml-base.bin"
    download_model(model)
    run("cargo", "build", "--locked", "--manifest-path", ROOT / "Cargo.toml")
    manifest = {
        "whisper_commit": WHISPER_COMMIT, "whisper": str(binary), "backend": args.backend,
        "model": str(model), "model_sha256": MODEL_SHA256, "model_revision": MODEL_REVISION,
        "public_test_sample": str(source / "samples" / "jfk.wav"),
    }
    (runtime / "ready.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
