#!/usr/bin/env sh
# One-off vendoring step (developer only — players never run this).
# Bundles three.js plus BufferGeometryUtils into a classic <script> that defines
# a global THREE, so the game runs from file:// as well as from a local server.
set -e
OUT="$(cd "$(dirname "$0")/../game/vendor" && pwd)"
WORK=$(mktemp -d)
cd "$WORK"
npm init -y >/dev/null
npm install three@0.186.1 esbuild >/dev/null
cat > entry.js <<'EOF'
export * from 'three';
export * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
EOF
npx esbuild entry.js --bundle --format=iife --global-name=THREE --minify \
  --legal-comments=inline --target=es2019 --outfile=three.min.js
{
  echo "/* three.js r186.1 (MIT, see three.LICENSE.txt) + BufferGeometryUtils, bundled once as a classic-script global THREE by tools/vendor-three.sh. Not a runtime build step. */"
  cat three.min.js
} > "$OUT/three.min.js"
cp node_modules/three/LICENSE "$OUT/three.LICENSE.txt"
echo "Wrote $OUT/three.min.js"
