"""Build the arena's runner character in Blender (developer-only, run once).

    blender -b --factory-startup -P tools/arena/build_runner.py -- <AnimationLibrary_Godot_Standard.glb> <out.glb>

Input: Quaternius's "Universal Animation Library" (Standard, CC0) mannequin and its animations
(opengameart.org/content/universal-animation-library). The mannequin is built from separate
wooden-doll segments, so this script:

  1. voxel-remeshes it into one continuous skin and smooths away the old seams,
  2. shapes a face (brow, eye sockets, nose, lips, chin, jaw, ears), short hair, a vest, running
     shorts and trainers by displacing the surface,
  3. transfers the mannequin's skin weights onto the new surface and smooths them,
  4. keeps only the animations the arena uses and exports a single GLB.

Colours, the club vest lettering, the race number and the painted face are applied in the game's
shader from the rest-pose position of each vertex, so they stay crisp at any mesh density.
Blender axes: Z up, the character faces -Y, and its left hand is on +X.
"""
import bpy
import bmesh
import math
import sys
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT = argv[0], argv[1]

KEEP = [
    "Idle_Loop", "Walk_Loop", "Jog_Fwd_Loop", "Sprint_Loop", "Jump_Start", "Jump_Loop", "Jump_Land",
    "Dance_Loop", "Punch_Jab", "Punch_Cross", "Roll", "Sitting_Enter", "Sitting_Idle_Loop",
    "Sitting_Exit", "Hit_Chest", "Interact", "Idle_Talking_Loop", "Crouch_Idle_Loop",
]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)

for o in list(bpy.data.objects):
    if o.name.startswith("Icosphere"):
        bpy.data.objects.remove(o, do_unlink=True)
man = bpy.data.objects["Mannequin"]
rig = bpy.data.objects["Rig"]

# ---------------------------------------------------------------- animations
for a in list(bpy.data.actions):
    base = a.name.split("|")[-1]
    if not any(base == k or base.startswith(k + "_Rig") or a.name.startswith(k) for k in KEEP):
        bpy.data.actions.remove(a)
for a in bpy.data.actions:
    if a.name.startswith("Roll_RM"):
        bpy.data.actions.remove(a)
for a in bpy.data.actions:
    a.name = a.name.replace("_Rig", "")
    a.use_fake_user = True
print("kept actions:", sorted(a.name for a in bpy.data.actions))
# park the rig in its rest pose while we model
if rig.animation_data:
    for t in list(rig.animation_data.nla_tracks):
        rig.animation_data.nla_tracks.remove(t)
    rig.animation_data.action = None
for pb in rig.pose.bones:
    pb.location = (0, 0, 0)
    pb.rotation_quaternion = (1, 0, 0, 0)
    pb.rotation_euler = (0, 0, 0)
    pb.scale = (1, 1, 1)
bpy.context.view_layer.update()

# ---------------------------------------------------------------- remesh into one skin
body = man.copy()
body.data = man.data.copy()
body.name = "Runner"
body.data.name = "Runner"
bpy.context.scene.collection.objects.link(body)
for m in list(body.modifiers):
    body.modifiers.remove(m)
body.parent = None
body.vertex_groups.clear()

def apply_all(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    for m in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)

rm = body.modifiers.new("remesh", "REMESH")
rm.mode = "VOXEL"
rm.voxel_size = 0.0065
rm.adaptivity = 0.0
rm.use_smooth_shade = True
apply_all(body)
# relax the old segment seams everywhere except the face and the fingers
vg = body.vertex_groups.new(name="relax")
for v in body.data.vertices:
    w = 1.0
    if v.co.z > 1.56:
        w = max(0.0, 1.0 - (v.co.z - 1.56) / 0.04) * 0.5 + 0.15
    if abs(v.co.x) > 0.70:
        w = 0.2
    vg.add([v.index], w, "REPLACE")
sm = body.modifiers.new("relax", "SMOOTH")
sm.iterations = 12
sm.factor = 1.0
sm.vertex_group = "relax"
apply_all(body)
body.vertex_groups.clear()
print("remeshed verts:", len(body.data.vertices))

# ---------------------------------------------------------------- shape the surface
me = body.data
bm = bmesh.new()
bm.from_mesh(me)
bm.verts.ensure_lookup_table()
bm.normal_update()

head_v = [v for v in bm.verts if v.co.z > 1.60]
hx = max(abs(v.co.x) for v in head_v)
hy0 = min(v.co.y for v in head_v)  # front of the face (-Y)
hy1 = max(v.co.y for v in head_v)
hz1 = max(v.co.z for v in bm.verts)
HC = Vector((0.0, (hy0 + hy1) * 0.5, 1.715))  # head centre
print("head: half-width %.3f front %.3f back %.3f top %.3f" % (hx, hy0, hy1, hz1))


def g2(dx, dz, sx, sz):
    return math.exp(-(dx * dx) / (sx * sx) - (dz * dz) / (sz * sz))


def smoothstep(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


EYE_Z = 1.735
moves = []
for v in bm.verts:
    p = v.co
    n = v.normal
    d = Vector((0, 0, 0))
    # ---- head and face (front is -Y)
    if p.z > 1.56:
        rel = p - HC
        front = smoothstep(0.0, 0.06, -(p.y - HC.y))  # 1 on the face side
        x, z = p.x, p.z
        f = Vector((0, -1, 0))
        # nose: bridge and tip
        nose = 0.016 * g2(x, z - 1.700, 0.013, 0.030) + 0.006 * g2(x, z - 1.735, 0.008, 0.020)
        nose += 0.004 * g2(x, z - 1.688, 0.022, 0.010)  # nostrils
        # brow ridge and eye sockets
        brow = 0.0055 * g2(abs(x) - 0.030, z - (EYE_Z + 0.022), 0.032, 0.010)
        sock = -0.0065 * g2(abs(x) - 0.032, z - EYE_Z, 0.018, 0.012)
        cheek = 0.004 * g2(abs(x) - 0.045, z - 1.700, 0.025, 0.020)
        lips = 0.0018 * g2(x, z - 1.664, 0.020, 0.005) + 0.0015 * g2(x, z - 1.652, 0.016, 0.005)
        chin = 0.003 * g2(x, z - 1.625, 0.028, 0.012) - 0.004 * g2(x, z - 1.660, 0.045, 0.02)
        d += f * (front * (nose + brow + sock + cheek + lips + chin))
        # square the jaw a little
        jaw = 0.006 * g2(abs(x) - 0.050, z - 1.640, 0.020, 0.030) * smoothstep(-0.02, 0.04, -(p.y - HC.y))
        d += Vector((math.copysign(1, x) if x else 0, 0, 0)) * jaw
        # ears
        ear = g2(p.y - (HC.y + 0.010), z - 1.712, 0.020, 0.030) * smoothstep(hx - 0.03, hx - 0.005, abs(x))
        d += Vector((math.copysign(1, x) if x else 0, 0.004, 0)) * (0.012 * ear)
        # short hair: volume on top, tight at the sides and the back of the neck
        hair_line = 1.778 - 0.03 * smoothstep(0.0, 0.06, p.y - HC.y)  # lower at the back
        hair = smoothstep(hair_line - 0.012, hair_line + 0.022, z)
        side = smoothstep(0.035, 0.07, abs(x))
        if not (front > 0.5 and z < 1.79 and abs(x) < 0.06):
            d += n * (hair * (0.010 - 0.005 * side) * (1.0 + 0.25 * smoothstep(1.80, 1.83, z)))
        # back and sides of the head: closely cropped
        crop = smoothstep(1.66, 1.70, z) * smoothstep(0.0, 0.05, p.y - HC.y) * (1 - hair)
        d += n * 0.003 * crop
    # ---- vest: a thin layer over the torso, from the waist to the shoulders
    elif 1.02 < p.z < 1.50 and abs(p.x) < 0.20:
        armhole = abs(p.x) > 0.16 - 0.06 * smoothstep(1.30, 1.46, p.z) and p.z > 1.30
        if not armhole:
            d += n * 0.004
    # ---- shorts: hips down to mid thigh, a little loose
    if 0.62 < p.z < 1.06 and abs(p.x) < 0.24:
        hem = 0.70 + 0.03 * (1 if p.y > 0 else 0)
        k = smoothstep(hem - 0.01, hem + 0.02, p.z) * (1 - smoothstep(1.03, 1.06, p.z))
        d += n * (0.008 * k)
    # ---- trainers: chunkier sole and toe box
    if p.z < 0.13:
        k = 1 - smoothstep(0.09, 0.13, p.z)
        d += n * (0.008 * k)
        if p.z < 0.02:
            d += Vector((0, 0, -0.0)) + n * 0.003
    moves.append((v, d))
for v, d in moves:
    v.co += d
# ground the soles
lo = min(v.co.z for v in bm.verts)
for v in bm.verts:
    v.co.z -= lo
bm.to_mesh(me)
bm.free()
me.update()

sm = body.modifiers.new("relax2", "LAPLACIANSMOOTH")
sm.iterations = 2
sm.lambda_factor = 0.3
sm.use_volume_preserve = True
apply_all(body)

# ---------------------------------------------------------------- reduce
dec = body.modifiers.new("decimate", "DECIMATE")
dec.decimate_type = "COLLAPSE"
dec.ratio = min(1.0, 18000.0 / len(body.data.polygons))  # about 36k triangles
apply_all(body)
print("final verts:", len(body.data.vertices), "faces:", len(body.data.polygons))

# ---------------------------------------------------------------- skin weights
for vg in man.vertex_groups:
    body.vertex_groups.new(name=vg.name)
dt = body.modifiers.new("weights", "DATA_TRANSFER")
dt.object = man
dt.use_vert_data = True
dt.data_types_verts = {"VGROUP_WEIGHTS"}
dt.vert_mapping = "POLYINTERP_NEAREST"
dt.layers_vgroup_select_src = "ALL"
dt.layers_vgroup_select_dst = "NAME"
apply_all(body)
bpy.ops.object.mode_set(mode="WEIGHT_PAINT")
bpy.ops.object.vertex_group_smooth(group_select_mode="ALL", factor=0.5, repeat=6, expand=0.0)
bpy.ops.object.vertex_group_clean(group_select_mode="ALL", limit=0.01)
bpy.ops.object.vertex_group_limit_total(group_select_mode="ALL", limit=4)
bpy.ops.object.vertex_group_normalize_all(group_select_mode="ALL", lock_active=False)
bpy.ops.object.mode_set(mode="OBJECT")

# one material; the game replaces it
mat = bpy.data.materials.new("Runner")
body.data.materials.clear()
body.data.materials.append(mat)
for poly in body.data.polygons:
    poly.material_index = 0
body.data.uv_layers.clear() if hasattr(body.data.uv_layers, "clear") else None
while body.data.uv_layers:
    body.data.uv_layers.remove(body.data.uv_layers[0])

body.parent = rig
arm = body.modifiers.new("Armature", "ARMATURE")
arm.object = rig
bpy.data.objects.remove(man, do_unlink=True)

# ---------------------------------------------------------------- export
bpy.ops.object.select_all(action="DESELECT")
rig.select_set(True)
body.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.export_scene.gltf(
    filepath=OUT,
    export_format="GLB",
    use_selection=True,
    export_animations=True,
    export_animation_mode="ACTIONS",
    export_force_sampling=True,
    export_optimize_animation_size=True,
    export_texcoords=False,
    export_normals=True,
    export_materials="PLACEHOLDER",
    export_def_bones=False,
    export_yup=True,
)
print("wrote", OUT)
