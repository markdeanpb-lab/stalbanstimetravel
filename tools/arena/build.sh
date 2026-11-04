#!/usr/bin/env sh
# Developer-only: rebuild the arena's vendored three.js bundle and its runner character.
#   BLENDER=/path/to/blender tools/arena/build.sh
# Needs Node 18+, network access to npm and opengameart.org, and Blender 4.2 LTS.
set -e
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WORK=$(mktemp -d)
cd "$WORK"
npm init -y >/dev/null
npm install three@0.186.1 postprocessing@6.39.5 esbuild >/dev/null
cat > entry.js <<'JS'
export * from 'three';
export * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
export * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
export { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
export { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
export * as PP from 'postprocessing';
JS
npx esbuild entry.js --bundle --format=iife --global-name=THREE --minify --legal-comments=inline --target=es2019 --outfile="$ROOT/arena/vendor/three.min.js"
cp node_modules/three/LICENSE "$ROOT/arena/vendor/three.LICENSE.txt"
cp node_modules/postprocessing/LICENSE.md "$ROOT/arena/vendor/postprocessing.LICENSE.txt"

# Quaternius, Universal Animation Library (Standard), CC0
curl -sSL -A "Mozilla/5.0" -o ual.zip https://opengameart.org/sites/default/files/universal_animation_librarystandard.zip
mkdir ual && (cd ual && unzip -q ../ual.zip)
GLB=$(find ual -name 'AnimationLibrary_Godot_Standard.glb' | head -1)
"${BLENDER:-blender}" -b --factory-startup -P "$ROOT/tools/arena/build_runner.py" -- "$GLB" "$WORK/runner.glb"
node "$ROOT/tools/arena/pack_runner.js" "$WORK/runner.glb" "$ROOT/arena/assets/runner.glb.js"
