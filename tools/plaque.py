"""Plaque d'immatriculation en 3D (lettres en relief), posée à l'avant et à l'arrière d'une voiture.
Mêmes styles et mêmes couleurs que l'aperçu du site (lib/plaques.ts, components/PlatePreview.tsx).

  python tools/plaque.py -- entree.glb sortie.glb --style fr --texte "AM-864-BH" --dep 34 \
      --avant 0,-2.032,0.47 --arriere 0,1.494,0.822

--avant / --arriere : le dos de la plaque (x, y, z en mètres, repère Blender, avant de la voiture vers -Y).
Sur la Mini e7de60f3 : avant sur le pare-chocs sous la barre chromée, arrière dans le renfoncement du hayon.
Les .glb du site sont en meshopt : décompresser avant (lib/glb readGlb + writeGlb), Blender ne le lit pas.
"""
import argparse, math, sys

import bpy, mathutils

a = argparse.ArgumentParser()
a.add_argument("entree"); a.add_argument("sortie")
a.add_argument("--style", default="fr", choices=["fr", "fr-noire", "de", "uk", "floride", "californie", "aucune"])
a.add_argument("--texte", default="AB-123-CD"); a.add_argument("--dep", default="")
a.add_argument("--avant", default=""); a.add_argument("--arriere", default="")
a.add_argument("--police", default="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")
args = a.parse_args(sys.argv[sys.argv.index("--") + 1:])

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=args.entree)
if args.style == "aucune":
    bpy.ops.export_scene.gltf(filepath=args.sortie, export_format="GLB", export_yup=True)
    sys.exit(0)


def hexa(h):  # couleur du site (sRGB) → linéaire pour Blender
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


MATS = {}
def mat(h, metal=0.0, rough=0.4):
    if h not in MATS:
        m = bpy.data.materials.new(f"plaque_{h[1:]}"); m.use_nodes = True
        b = m.node_tree.nodes["Principled BSDF"]
        b.inputs["Base Color"].default_value = (*hexa(h), 1)
        b.inputs["Metallic"].default_value = metal; b.inputs["Roughness"].default_value = rough
        MATS[h] = m
    return MATS[h]


pieces = []
MM = 0.001
def boite(sx, sz, ep, x, z, y, m, bevel=0.0):
    """Pavé dans le plan XZ (mm, origine au centre de la plaque), face visible vers -Y, y = dos de la pièce."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x * MM, (y - ep / 2) * MM, z * MM))
    o = bpy.context.object; o.scale = (sx * MM, ep * MM, sz * MM)
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        bv = o.modifiers.new("b", "BEVEL"); bv.width = bevel * MM; bv.segments = 4
        bpy.ops.object.modifier_apply(modifier="b")
    o.data.materials.append(m); pieces.append(o)


def disque(r, x, z, y, ep, m):
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=r * MM, depth=ep * MM, location=(x * MM, (y - ep / 2) * MM, z * MM), rotation=(math.pi / 2, 0, 0))
    bpy.context.object.data.materials.append(m); pieces.append(bpy.context.object)


def texte(t, x, z, y, haut, larg_max, ep, m, serre=0.78, italique=False):
    if not t.strip():
        return
    bpy.ops.object.text_add()
    o = bpy.context.object; o.data.body = t; o.data.font = bpy.data.fonts.load(args.police)
    o.data.align_x = "CENTER"; o.data.align_y = "CENTER"; o.data.extrude = 0.05  # profondeur ramenée à ep plus bas
    if italique:
        o.data.shear = 0.25
    bpy.ops.object.convert(target="MESH"); o = bpy.context.object
    xs = [v.co.x for v in o.data.vertices]; ys = [v.co.y for v in o.data.vertices]
    sh = haut / (max(ys) - min(ys)); sw = min(sh * serre, larg_max / (max(xs) - min(xs)))
    cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
    for v in o.data.vertices:  # texte couché (XY) → debout, tourné vers -Y
        v.co = mathutils.Vector(((v.co.x - cx) * sw * MM, -v.co.z / 0.05 * ep / 2 * MM, (v.co.y - cy) * sh * MM))
    o.location = (x * MM, (y - ep / 2) * MM, z * MM)
    o.data.materials.clear(); o.data.materials.append(m); pieces.append(o)


def bande_ue(xc, lettre, y):
    boite(42, 98, 0.4, xc, 0, y, mat("#0b2a8c"))
    for i in range(12):
        ang = i * math.pi / 6
        disque(2.4, xc + 12 * math.cos(ang), 21 + 12 * math.sin(ang), y - 0.4, 0.4, mat("#ffcc00"))
    texte(lettre, xc, -25, y - 0.4, 22, 34, 0.4, mat("#ffffff"))


S, T = args.style, args.texte.upper()
E = 3.0  # épaisseur de la plaque (mm)
if S in ("floride", "californie"):  # format américain 305 × 152 mm
    L, H = 305, 152
    boite(L, H, E, 0, 0, 0, mat("#fbfbf7"), bevel=10)
    if S == "floride":
        ink = mat("#0d6b3a")
        a_, b_ = (T.split(" ", 1) if " " in T else (T[: (len(T) + 1) // 2], T[(len(T) + 1) // 2:]))
        texte("MYFLORIDA.COM", 0, 54, -E, 12, 150, 0.6, ink)
        texte(a_, -84, 0, -E, 62, 100, 0.8, ink); texte(b_, 84, 0, -E, 62, 100, 0.8, ink)
        disque(20, 0, 0, -E, 1.0, mat("#f28c1b"))
        texte("SUNSHINE STATE", 0, -57, -E, 12, 170, 0.6, ink)
    else:
        ink = mat("#1d2f6f")
        texte("California", 0, 48, -E, 24, 160, 0.6, mat("#c8102e"), serre=1.0, italique=True)
        texte(T, 0, -12, -E, 66, 270, 0.8, ink)
        texte("DMV.CA.GOV", 0, -60, -E, 10, 110, 0.6, ink)
else:  # format européen 520 × 110 mm
    L, H = 520, 110
    fond = {"fr": "#fbfbf9", "fr-noire": "#111111", "de": "#fbfbf9", "uk": "#f6c800"}[S]
    encre = mat("#d9d9d6", metal=0.6, rough=0.3) if S == "fr-noire" else mat("#111111")
    boite(L, H, E, 0, 0, 0, mat(fond, rough=0.3), bevel=6)
    f = 1.5  # liseré
    for sx, sz, x, z in ((L - 12, f, 0, H / 2 - 5), (L - 12, f, 0, -H / 2 + 5), (f, H - 12, -L / 2 + 5, 0), (f, H - 12, L / 2 - 5, 0)):
        boite(sx, sz, 0.4, x, z, -E, encre)
    x0, x1 = -L / 2 + 14, L / 2 - 14
    if S in ("fr", "de"):
        bande_ue(-L / 2 + 27, "D" if S == "de" else "F", -E); x0 = -L / 2 + 52
    if S == "fr":
        xb = L / 2 - 27
        boite(42, 98, 0.4, xb, 0, -E, mat("#0b2a8c"))
        # logo de région simplifié (2 mm sur une 1:43)
        boite(26, 26, 0.4, xb, 21, -E - 0.4, mat("#b3141b"))
        boite(16, 3, 0.3, xb, 21, -E - 0.8, mat("#ffcc00")); boite(3, 16, 0.3, xb, 21, -E - 0.8, mat("#ffcc00"))
        texte(args.dep or "", xb, -25, -E - 0.4, 20, 36, 0.4, mat("#ffffff"))
        x1 = L / 2 - 52
    # lettres de 75 mm, police serrée comme les vraies plaques
    texte(T, (x0 + x1) / 2, 0, -E, 75, x1 - x0 - 12, 0.8, encre)

bpy.ops.object.select_all(action="DESELECT")
for o in pieces:
    o.select_set(True)
bpy.context.view_layer.objects.active = pieces[0]
bpy.ops.object.join()
pl = bpy.context.object; pl.name = f"plaque_{S}"


def pose(o, txt, arriere):
    x, y, z = (float(v) for v in txt.split(","))
    o.location = (x, y, z)
    if arriere:
        o.rotation_euler = (0, 0, math.pi)


poses = [(p, arr) for p, arr in ((args.avant, False), (args.arriere, True)) if p]
if not poses:
    poses = [("0,0,0", False)]
for i, (p, arr) in enumerate(poses):
    o = pl if i == 0 else pl.copy()
    if i:
        o.data = pl.data; bpy.context.scene.collection.objects.link(o)
    o.name = "plaque_arriere" if arr else "plaque_avant"
    pose(o, p, arr)
bpy.ops.export_scene.gltf(filepath=args.sortie, export_format="GLB", export_yup=True)
print("plaque", S, T, args.dep)
