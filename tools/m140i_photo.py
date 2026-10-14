"""M140i reproduite d'après la photo client : blanche, logos noirs, bas de bouclier noir brillant,
diffuseur à ailettes. Réutilise customize.py (import, échelle, scène).

Usage : python m140i_photo.py <modele.glb> <dossier_sortie>
"""
import os
import sys

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
code = open(os.path.join(HERE, "customize.py")).read().split("for nom, cfg in VARIANTES.items():")[0]
exec(compile(code, "customize", "exec"))

# Couleurs
appliquer({"peinture": ((0.86, 0.87, 0.88), 0.0, 0.25)})
NOIR_BRILLANT = ((0.008, 0.008, 0.009), 0.0, 0.12)
for n, (col, met, rough) in {"iBody_Dark_Metallic1": NOIR_BRILLANT, "iLogo_Blue1": NOIR_BRILLANT}.items():
    p = principled(n)
    p.inputs["Base Color"].default_value = (*col, 1)
    p.inputs["Metallic"].default_value = met
    p.inputs["Roughness"].default_value = rough
    p.inputs["Coat Weight"].default_value = 1.0

noir = bpy.data.materials.new("Diffuseur noir")
noir.use_nodes = True
pb = noir.node_tree.nodes["Principled BSDF"]
pb.inputs["Base Color"].default_value = (0.006, 0.006, 0.007, 1)
pb.inputs["Roughness"].default_value = 0.15
pb.inputs["Coat Weight"].default_value = 1.0
feu = bpy.data.materials.new("Feu central")
feu.use_nodes = True
pf = feu.node_tree.nodes["Principled BSDF"]
pf.inputs["Base Color"].default_value = (0.5, 0.0, 0.01, 1)
pf.inputs["Roughness"].default_value = 0.1
pf.inputs["Emission Color"].default_value = (0.6, 0.0, 0.0, 1)
pf.inputs["Emission Strength"].default_value = 1.5


import bmesh


def surface(nom, f, nu, nv, mat, epaisseur, biseau=0.003):
    """Surface paramétrique f(u, v) -> (x, y, z), u et v dans [0, 1], épaissie."""
    me = bpy.data.meshes.new(nom)
    bm = bmesh.new()
    grid = [[bm.verts.new(f(i / (nu - 1), j / (nv - 1))) for j in range(nv)] for i in range(nu)]
    for i in range(nu - 1):
        for j in range(nv - 1):
            bm.faces.new((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]))
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(nom, me)
    scene.collection.objects.link(o)
    o.data.materials.append(mat)
    so = o.modifiers.new("ep", "SOLIDIFY")
    so.thickness = epaisseur
    so.offset = 0
    bv = o.modifiers.new("b", "BEVEL")
    bv.width = biseau
    bv.segments = 2
    bv.limit_method = "ANGLE"
    return o


def lerp(a, b, t):
    return a + (b - a) * t


# Relevés sur le modèle (mètres, arrière vers +y) :
# dessous de caisse z ≈ 0.214 (y=1.6) → 0.27 (y=2.0) ; bord du bouclier y ≈ 2.09 − 0.25·x² à z=0.28
def y_bord(x):
    return 2.09 - 0.25 * x * x


def z_dessous(y):
    return lerp(0.214, 0.272, min(1.0, max(0.0, (y - 1.6) / 0.42)))


DEPASSE = 0.065  # débord du diffuseur derrière le bouclier
TX, TZ, TR = 0.47, 0.268, 0.055  # sorties : plus écartées et plus basses que d’origine, comme la photo
Z_PIED = 0.175  # bas du diffuseur
XB = 0.40  # demi-largeur du pont central


# Pont central : barre haute entre les sorties, qui descend en arc autour de chaque sortie
def z_pont(x):
    ax = abs(x)
    if ax <= TX - TR - 0.065:
        return 0.352
    d = min(1.0, (ax - (TX - TR - 0.065)) / 0.065)
    return lerp(0.352, TZ - 0.01, math.sin(d * math.pi / 2))


def pont(u, v):
    x = lerp(-XB, XB, u)
    return (x, y_bord(x) + DEPASSE, lerp(z_pont(x) - 0.024, z_pont(x), v))


surface("Diffuseur pont", pont, 61, 3, noir, 0.016)


# Fond vertical en retrait, contre le bouclier
def fond(u, v):
    x = lerp(-XB, XB, u)
    return (x, y_bord(x) + 0.004, lerp(Z_PIED, z_pont(x), v))


surface("Diffuseur fond", fond, 41, 4, noir, 0.008)


# Pied : barre basse continue sous le pont et sous les sorties, jusqu’aux coins
def pied(u, v):
    x = lerp(-0.64, 0.64, u)
    y1 = y_bord(x) + DEPASSE
    return (x, lerp(y1 - 0.06, y1, v), Z_PIED + 0.006 * (abs(x) / 0.64) ** 2)


surface("Diffuseur pied", pied, 61, 3, noir, 0.012)


# Ailettes verticales entre le fond et le pont, prolongées sous la voiture en biseau
def ailette(x0, ep):
    y_f, y_r = y_bord(x0) - 0.16, y_bord(x0) + DEPASSE

    def f(u, v):
        y = lerp(y_f, y_r, u)
        t = min(1.0, (y - y_f) / (y_r - 0.02 - y_f))
        haut = z_pont(x0) if y > y_bord(x0) - 0.01 else z_dessous(y) - 0.004
        return (x0, y, lerp(haut, lerp(haut, Z_PIED, t), v))

    return surface(f"Ailette {x0:+.2f}", f, 16, 2, noir, ep, 0.002)


for x0 in (-0.30, -0.20, -0.10, 0.0, 0.10, 0.20, 0.30):
    ailette(x0, 0.010)

# Lames latérales sous le bouclier, de la sortie d'échappement jusqu'à la roue, avec ailette verticale au bout
for side in (-1, 1):
    def lame(u, v, side=side):
        x = side * lerp(0.56, 0.80, u)
        yr = (y_bord(x) if abs(x) < 0.72 else lerp(y_bord(0.72), 1.83, (abs(x) - 0.72) / 0.08)) + 0.03
        y = lerp(yr - 0.16, yr, v)
        return (x, y, z_dessous(y) - 0.006)

    surface("Lame latérale", lame, 14, 4, noir, 0.012)

    def winglet(u, v, side=side):
        x = side * 0.79
        y = lerp(1.80, 1.93, u)
        return (x, y, lerp(z_dessous(y) - 0.006, 0.19 + 0.04 * (1 - u), v))

    surface("Winglet", winglet, 6, 2, noir, 0.012)

# Sorties d'échappement plus grosses (centres relevés : x ±0.413, z 0.288, bout à y 2.085)
inox = bpy.data.materials.new("Inox")
inox.use_nodes = True
pi = inox.node_tree.nodes["Principled BSDF"]
pi.inputs["Base Color"].default_value = (0.55, 0.55, 0.57, 1)
pi.inputs["Metallic"].default_value = 1.0
pi.inputs["Roughness"].default_value = 0.25
pi.inputs["Base Color"].default_value = (0.32, 0.32, 0.34, 1)
for side in (-1, 1):
    bpy.ops.mesh.primitive_cylinder_add(radius=TR, depth=0.12, location=(side * TX, y_bord(TX) + DEPASSE - 0.05, TZ), rotation=(math.pi / 2, 0, 0), vertices=64, end_fill_type="NOTHING")
    tube = bpy.context.active_object
    tube.data.materials.append(inox)
    so = tube.modifiers.new("ep", "SOLIDIFY")
    so.thickness = 0.005
    bv = tube.modifiers.new("b", "BEVEL")
    bv.width = 0.002
    for poly in tube.data.polygons:
        poly.use_smooth = True
    bpy.ops.mesh.primitive_circle_add(radius=TR - 0.003, location=(side * TX, y_bord(TX) + DEPASSE - 0.07, TZ), rotation=(math.pi / 2, 0, 0), vertices=64, fill_type="NGON")
    bpy.context.active_object.data.materials.append(noir)

# masque les sorties d’origine
for o in meshes:
    if o.data.materials[0].name == "iDarkChrome1":
        o.hide_render = True
        o.hide_viewport = True
# logo entièrement sombre, comme la photo
principled("iLogo_White1").inputs["Base Color"].default_value = (0.08, 0.08, 0.085, 1)

# Aileron de toit noir : faces de la carrosserie en haut à l'arrière
body = [o for o in meshes if o.data.materials[0].name == "iBody1"][0]
body.data.materials.append(noir)
idx = len(body.data.materials) - 1
mw = body.matrix_world
for poly in body.data.polygons:
    c = mw @ poly.center
    if c.y > 1.50 and c.z > 1.25:
        poly.material_index = idx
bpy.context.view_layer.update()

shoot("photo_arriere.png", vue(180, 6.0, 0.9), target=(0, 0, 0.55))
shoot("photo_diffuseur.png", vue(180, 3.2, 0.45), target=(0, 1.9, 0.3))
shoot("photo_meme_angle.png", vue(180, 5.2, 0.8), target=(0, 0, 0.6))
shoot("photo_34_arriere.png", vue(150, 7.5, 1.2))
shoot("photo_34_avant.png", vue(40))
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "bmw_m140i_photo.blend"))
