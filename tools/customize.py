"""Personnalise un modèle de base (GLB) et rend des vues.

Usage : python customize.py <modele.glb> <dossier_sortie>
Le modèle doit avoir ses pièces séparées par matériau. ROLES fait le lien
entre nos options (peinture, jantes, étriers) et les matériaux du fichier.
"""
import math
import os
import sys

import bpy
from mathutils import Vector

SRC, OUT = sys.argv[-2], sys.argv[-1]
os.makedirs(OUT, exist_ok=True)

# Rôles → matériaux du modèle (à renseigner une fois par modèle de base)
ROLES = {"peinture": ["iBody1"], "jantes": ["iRim1"], "etriers": ["iCalipers1"]}
LONGUEUR_REELLE = 4.32  # BMW Série 1 F20, en mètres

VARIANTES = {
    "origine": {},
    "blanc_jantes_noires": {"peinture": ((0.85, 0.86, 0.87), 0.0, 0.3), "jantes": ((0.02, 0.02, 0.02), 0.6, 0.35), "etriers": ((0.6, 0.02, 0.02), 0.0, 0.3)},
    "rouge_jantes_argent": {"peinture": ((0.45, 0.01, 0.02), 0.5, 0.3), "jantes": ((0.7, 0.71, 0.73), 1.0, 0.2), "etriers": ((0.03, 0.03, 0.03), 0.0, 0.4)},
    "noir_jantes_bronze": {"peinture": ((0.01, 0.01, 0.012), 0.6, 0.3), "jantes": ((0.35, 0.22, 0.09), 1.0, 0.3), "etriers": ((0.75, 0.35, 0.02), 0.0, 0.3)},
}

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=SRC)

# Normalisation : échelle réelle, centré, posé au sol
meshes = [o for o in bpy.data.objects if o.type == "MESH"]
root = [o for o in bpy.data.objects if o.parent is None]
lo, hi = Vector((1e9,) * 3), Vector((-1e9,) * 3)
for o in meshes:
    for c in o.bound_box:
        w = o.matrix_world @ Vector(c)
        lo, hi = Vector(map(min, lo, w)), Vector(map(max, hi, w))
size = hi - lo
k = LONGUEUR_REELLE / max(size)
pivot = bpy.data.objects.new("Pivot", None)
scene.collection.objects.link(pivot)
for o in root:
    o.parent = pivot
pivot.scale = (k, k, k)
pivot.location = (-(lo.x + hi.x) / 2 * k, -(lo.y + hi.y) / 2 * k, -lo.z * k)
long_axis_y = size.y > size.x  # l'avant est vers -y dans ce modèle
bpy.context.view_layer.update()


def principled(mat_name):
    m = bpy.data.materials.get(mat_name)
    return m.node_tree.nodes.get("Principled BSDF") if m and m.use_nodes else None


ORIG = {}
for role, names in ROLES.items():
    for n in names:
        p = principled(n)
        if p:
            ORIG[n] = (tuple(p.inputs["Base Color"].default_value), p.inputs["Metallic"].default_value, p.inputs["Roughness"].default_value)
for n in ROLES["peinture"]:
    p = principled(n)
    if p:
        p.inputs["Coat Weight"].default_value = 1.0


def appliquer(config):
    for role, names in ROLES.items():
        for n in names:
            p = principled(n)
            if not p:
                continue
            if role in config:
                col, met, rough = config[role]
                p.inputs["Base Color"].default_value = (*col, 1)
                p.inputs["Metallic"].default_value = met
                p.inputs["Roughness"].default_value = rough
            else:
                col, met, rough = ORIG[n]
                p.inputs["Base Color"].default_value = col
                p.inputs["Metallic"].default_value = met
                p.inputs["Roughness"].default_value = rough


# Scène
bpy.ops.mesh.primitive_plane_add(size=60)
sol = bpy.context.active_object
gm = bpy.data.materials.new("Sol")
gm.use_nodes = True
gm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.08, 0.08, 0.085, 1)
gm.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.5
sol.data.materials.append(gm)
world = bpy.data.worlds.new("Monde")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.05, 0.05, 0.055, 1)


def area(loc, size, energy, target=(0, 0, 0.6)):
    bpy.ops.object.light_add(type="AREA", location=loc)
    lt = bpy.context.active_object
    lt.data.size, lt.data.energy = size, energy
    lt.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()


area((0, 0, 6), 7, 1500)
area((5, 5, 3), 4, 800)
area((-5, -4, 3), 4, 600)
area((5, -5, 2.5), 3, 500)

cam_data = bpy.data.cameras.new("Cam")
cam_data.lens = 50
cam = bpy.data.objects.new("Cam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = int(os.environ.get("SAMPLES", "32"))
scene.cycles.use_denoising = True
scene.render.resolution_x, scene.render.resolution_y = 1200, 800
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Medium High Contrast"


def vue(az_deg, dist=8.5, h=1.6):
    # az 0 = face avant
    a = math.radians(az_deg)
    fwd = Vector((0, -1, 0)) if long_axis_y else Vector((1, 0, 0))
    side = Vector((-fwd.y, fwd.x, 0))
    return tuple(dist * (math.cos(a) * fwd + math.sin(a) * side) + Vector((0, 0, h)))


def shoot(name, loc, target=(0, 0, 0.6)):
    cam.location = loc
    cam.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = os.path.join(OUT, name)
    bpy.ops.render.render(write_still=True)


for nom, cfg in VARIANTES.items():
    appliquer(cfg)
    shoot(f"{nom}_34_avant.png", vue(40))
appliquer({})
shoot("origine_profil.png", vue(90, 9.5, 1.0))
shoot("origine_34_arriere.png", vue(145))
