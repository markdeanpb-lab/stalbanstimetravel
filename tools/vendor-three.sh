#!/usr/bin/env sh
# One-off vendoring step (developer only — players never run this).
# Bundles three.js plus a few add-ons (BufferGeometryUtils, SkeletonUtils, Sky), the
# pmndrs `postprocessing` library (as THREE.PP) and N8AO ambient occlusion into a classic
# <script> that defines a global THREE, so the game runs from file:// as well as from a
# local server.
set -e
OUT="$(cd "$(dirname "$0")/../game/vendor" && pwd)"
WORK=$(mktemp -d)
cd "$WORK"
npm init -y >/dev/null
npm install three@0.186.1 postprocessing@6.39.5 n8ao@2.0.1 esbuild >/dev/null
cat > entry.js <<'EOF'
export * from 'three';
export * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
export * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
export { Sky } from 'three/examples/jsm/objects/Sky.js';
export * as PP from 'postprocessing';
export { N8AOPostPass } from 'n8ao';
EOF
npx esbuild entry.js --bundle --format=iife --global-name=THREE --minify \
  --legal-comments=inline --target=es2019 --outfile=three.min.js
{
  echo "/* three.js r186.1 (MIT, three.LICENSE.txt) + BufferGeometryUtils, SkeletonUtils, Sky; postprocessing 6.39.5 (Zlib, postprocessing.LICENSE.txt) as THREE.PP; n8ao 2.0.1 (CC0, n8ao.LICENSE.txt). Bundled once as a classic-script global THREE by tools/vendor-three.sh. Not a runtime build step. */"
  cat three.min.js
} > "$OUT/three.min.js"
cp node_modules/three/LICENSE "$OUT/three.LICENSE.txt"
cp node_modules/postprocessing/LICENSE.md "$OUT/postprocessing.LICENSE.txt"
cp node_modules/n8ao/LICENSE "$OUT/n8ao.LICENSE.txt"
echo "Wrote $OUT/three.min.js"
