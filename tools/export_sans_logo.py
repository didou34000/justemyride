"""Exporte une copie du modèle 3D sans logo ni badge, pour le configurateur du site.

Usage : python export_sans_logo.py <modele.glb> <sortie.glb>
Garde l'orientation et les matériaux d'origine (le site s'appuie sur leurs noms).
"""
import os
import sys

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from nologo import strip_logos  # noqa: E402

SRC, DST = sys.argv[-2], sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=SRC)
originaux = set(bpy.data.objects)

# Les repères de nologo supposent la voiture mise à l'échelle (4,32 m), centrée et posée au sol, avant vers -y :
# on applique la même mise en place que customize.py le temps du repérage, sur un parent qu'on retire ensuite.
meshes = [o for o in bpy.data.objects if o.type == "MESH"]
racines = [o for o in bpy.data.objects if o.parent is None]
lo, hi = Vector((1e9,) * 3), Vector((-1e9,) * 3)
for o in meshes:
    for c in o.bound_box:
        w = o.matrix_world @ Vector(c)
        lo, hi = Vector(map(min, lo, w)), Vector(map(max, hi, w))
k = 4.32 / max(hi - lo)
pivot = bpy.data.objects.new("Pivot", None)
sc.collection.objects.link(pivot)
for o in racines:
    o.parent = pivot
pivot.scale = (k, k, k)
pivot.location = (-(lo.x + hi.x) / 2 * k, -(lo.y + hi.y) / 2 * k, -lo.z * k)
cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
cam.data.lens = 50
sc.collection.objects.link(cam)
sc.camera = cam
sc.render.resolution_x, sc.render.resolution_y = 900, 600
bpy.context.view_layer.update()


def aimer(loc, target):
    cam.location = loc
    cam.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    bpy.context.view_layer.update()


strip_logos(sc, cam, aimer)
# Les pièces « logo » sont masquées au rendu : on les supprime pour de bon dans l'export.
for o in list(bpy.data.objects):
    if o.type == "MESH" and o.hide_render:
        bpy.data.objects.remove(o)
for o in racines:
    if o.name in bpy.data.objects:
        o.parent = None
bpy.data.objects.remove(pivot)
bpy.data.objects.remove(cam)
bpy.ops.export_scene.gltf(filepath=DST, export_format="GLB")
print("exporté", DST)
