#!/usr/bin/env bash
set -euo pipefail

DIR="${VOX_LOCAL_MODELS_DIR:-$HOME/Library/Application Support/com.voxagent.desktop/models}"
mkdir -p "$DIR/speakers"

get() {
  local url="$1" out="$2"
  [ -s "$out" ] && return 0
  curl -fL --progress-bar ${HF_TOKEN:+-H "Authorization: Bearer $HF_TOKEN"} -o "$out.part" "$url"
  mv "$out.part" "$out"
}

get https://huggingface.co/Cactus-Compute/whistle/resolve/main/whistle.cact "$DIR/whistle.cact"
get https://huggingface.co/Cactus-Compute/needle3/resolve/main/needle3.cact "$DIR/needle3.cact"

: "${HF_TOKEN:?NeuTTS-2E is gated: accept the licences on huggingface.co/neuphonic/neutts-2e-q4-gguf and neuphonic/neucodec-onnx-decoder-int8, then export HF_TOKEN}"
get https://huggingface.co/neuphonic/neutts-2e-q4-gguf/resolve/main/neutts-2e-Q4_0.gguf "$DIR/neutts-2e-Q4_0.gguf"
get https://huggingface.co/neuphonic/neucodec-onnx-decoder-int8/resolve/main/model.onnx "$DIR/neucodec-decoder.onnx"

base=https://raw.githubusercontent.com/neuphonic/neutts/main/samples
for name in emily paul sophie steven; do
  get "$base/$name.txt" "$DIR/speakers/$name.txt"
  if [ ! -s "$DIR/speakers/$name.codes" ]; then
    get "$base/$name.pt" "$DIR/speakers/$name.pt"
    python3 -I - "$DIR/speakers/$name.pt" "$DIR/speakers/$name.codes" <<'PY'
import sys, zipfile
z = zipfile.ZipFile(sys.argv[1])
member = next(n for n in z.namelist() if n.endswith("/data/0"))
open(sys.argv[2], "wb").write(z.read(member))
PY
    rm "$DIR/speakers/$name.pt"
  fi
done

echo "models ready in $DIR"
