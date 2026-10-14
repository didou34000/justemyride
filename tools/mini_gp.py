"""Mini Cooper S JCW GP (R53, 2006) modélisée par script, pour tester un rendu fidèle rapide.

Usage : python mini_gp.py <dossier_sortie>   (avec le module bpy installé)
Axes : x vers l'avant, y vers la gauche, z vers le haut. Unités : mètres, échelle réelle.
"""
import math
import os
import sys

import bpy
import bmesh
from mathutils import Vector

OUT = sys.argv[-1] if len(sys.argv) > 1 and not sys.argv[-1].endswith(".py") else "."
os.makedirs(OUT, exist_ok=True)

# Dimensions réelles approximatives R53 GP
L = 3.66
FRONT_AXLE = 1.21
REAR_AXLE = FRONT_AXLE - 2.467
WHEEL_R = 0.315
TRACK_HALF = 0.735

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


# ---------- matériaux ----------
def mat(name, color, metallic=0.0, rough=0.5, coat=0.0, alpha=1.0, emission=None, transmission=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (*color, 1)
    p.inputs["Metallic"].default_value = metallic
    p.inputs["Roughness"].default_value = rough
    p.inputs["Coat Weight"].default_value = coat
    p.inputs["Coat Roughness"].default_value = 0.03
    p.inputs["Transmission Weight"].default_value = transmission
    if emission:
        p.inputs["Emission Color"].default_value = (*emission, 1)
        p.inputs["Emission Strength"].default_value = 2.0
    return m


PAINT = mat("Peinture", (0.035, 0.06, 0.11), metallic=0.6, rough=0.35, coat=1.0)  # Thunder Blue métal
ROOF = mat("Toit", (0.45, 0.46, 0.48), metallic=0.85, rough=0.3, coat=1.0)  # Pure Silver
BLACK = mat("Plastique noir", (0.02, 0.02, 0.022), rough=0.55)
GLASS = mat("Vitre", (0.01, 0.012, 0.015), metallic=0.1, rough=0.03, coat=1.0)
CHROME = mat("Chrome", (0.9, 0.9, 0.92), metallic=1.0, rough=0.06)
RED = mat("Rouge", (0.55, 0.01, 0.015), rough=0.25, coat=1.0)
TYRE = mat("Pneu", (0.015, 0.015, 0.016), rough=0.85)
RIM = mat("Jante", (0.75, 0.76, 0.78), metallic=1.0, rough=0.22)
RIM_DARK = mat("Jante sombre", (0.05, 0.05, 0.055), metallic=0.7, rough=0.35)
LENS = mat("Optique", (0.85, 0.87, 0.9), metallic=0.2, rough=0.05, coat=1.0, emission=(0.6, 0.62, 0.65))
TAIL = mat("Feu arrière", (0.5, 0.0, 0.01), rough=0.1, coat=1.0, emission=(0.3, 0.0, 0.0))
AMBER = mat("Clignotant", (0.8, 0.45, 0.1), rough=0.1, coat=1.0)
PLATE = mat("Plaque", (0.03, 0.06, 0.12), rough=0.4)
PLATE_TXT = mat("Texte plaque", (0.9, 0.9, 0.9), rough=0.4)


def link(obj, m=None):
    bpy.context.collection.objects.link(obj)
    if m:
        obj.data.materials.append(m)
    return obj


def smooth(obj, level=2):
    for p in obj.data.polygons:
        p.use_smooth = True
    if level:
        mod = obj.modifiers.new("subsurf", "SUBSURF")
        mod.levels = level
        mod.render_levels = level
    return obj


def apply_mods(obj):
    bpy.context.view_layer.objects.active = obj
    for m in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)


# ---------- loft : sections successives le long de x ----------
def interp(keys, x):
    for (x0, *a), (x1, *b) in zip(keys, keys[1:]):
        if x0 <= x <= x1:
            t = (x - x0) / (x1 - x0)
            t = t * t * (3 - 2 * t)  # lissage
            return [u + (v - u) * t for u, v in zip(a, b)]
    return list(keys[0][1:] if x < keys[0][0] else keys[-1][1:])


def superellipse(hw, zb, zt, n, m=40, top_taper=0.0):
    pts = []
    zm, hh = (zt + zb) / 2, (zt - zb) / 2
    for i in range(m):
        t = 2 * math.pi * i / m
        c, s = math.cos(t), math.sin(t)
        y = hw * math.copysign(abs(c) ** (2 / n), c)
        z = zm + hh * math.copysign(abs(s) ** (2 / n), s)
        y *= 1 - top_taper * max(0.0, (z - zm) / hh)  # épaules rentrantes
        pts.append((y, z))
    return pts


def loft(name, keys, xs, m=40, material=None, taper=0.0):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    rings = []
    for x in xs:
        hw, zb, zt, n = interp(keys, x)
        rings.append([bm.verts.new((x, y, z)) for y, z in superellipse(hw, zb, zt, n, m, taper)])
    for r0, r1 in zip(rings, rings[1:]):
        for i in range(m):
            bm.faces.new((r0[i], r0[(i + 1) % m], r1[(i + 1) % m], r1[i]))
    for ring, rev in ((rings[0], True), (rings[-1], False)):
        c = bm.verts.new(sum((v.co for v in ring), Vector()) / m)
        for i in range(m):
            f = (ring[i], ring[(i + 1) % m], c)
            bm.faces.new(f[::-1] if rev else f)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    return link(bpy.data.objects.new(name, me), material)


def frange(a, b, n):
    return [a + (b - a) * i / (n - 1) for i in range(n)]


# ---------- caisse basse ----------
# x, demi-largeur, bas, haut (ligne de caisse / capot), rondeur
BODY_KEYS = [
    (-1.835, 0.64, 0.30, 0.86, 3.2),
    (-1.80, 0.80, 0.21, 0.93, 4.5),
    (-1.68, 0.845, 0.18, 0.95, 5.5),
    (0.70, 0.85, 0.18, 0.95, 5.5),
    (1.30, 0.845, 0.18, 0.905, 5.0),
    (1.58, 0.82, 0.19, 0.84, 4.2),
    (1.74, 0.76, 0.21, 0.76, 3.6),
    (1.815, 0.66, 0.24, 0.67, 3.0),
    (1.835, 0.52, 0.28, 0.58, 2.6),
]
body = loft("Carrosserie", BODY_KEYS, frange(-1.835, 1.835, 70), material=PAINT, taper=0.05)
smooth(body, 2)
apply_mods(body)

# passages de roue
for ax in (FRONT_AXLE, REAR_AXLE):
    bpy.ops.mesh.primitive_cylinder_add(radius=0.37, depth=2.4, location=(ax, 0, WHEEL_R + 0.02), rotation=(math.pi / 2, 0, 0), vertices=64)
    cutter = bpy.context.active_object
    mod = body.modifiers.new("arch", "BOOLEAN")
    mod.operation = "DIFFERENCE"
    mod.object = cutter
    mod.solver = "EXACT"
    apply_mods(body)
    bpy.data.objects.remove(cutter)

# ---------- vitrage (vitres + montants noirs) ----------
def z_top_glass(x):
    if x > 0.22:  # pare-brise
        return 1.335 - (x - 0.22) / (0.93 - 0.22) * (1.335 - 0.93)
    if x < -1.60:  # lunette arrière quasi verticale
        return 1.335 - (-1.60 - x) / (1.745 - 1.60) * (1.335 - 0.93)
    return 1.335


GH_KEYS = []
for x in frange(-1.745, 0.93, 40):
    zt = z_top_glass(x)
    GH_KEYS.append((x, 0.80, 0.90, zt, 6.0))
gh = loft("Vitrage", GH_KEYS, frange(-1.745, 0.93, 40), material=GLASS, taper=0.17)
smooth(gh, 1)

# toit flottant argent
ROOF_KEYS = [
    (-1.72, 0.62, 1.31, 1.36, 3.0),
    (-1.64, 0.70, 1.315, 1.385, 4.0),
    (0.10, 0.70, 1.315, 1.39, 4.0),
    (0.22, 0.66, 1.30, 1.37, 3.5),
    (0.27, 0.56, 1.29, 1.34, 3.0),
]
roof = loft("Toit", ROOF_KEYS, frange(-1.72, 0.27, 30), material=ROOF)
smooth(roof, 2)

# aileron de toit GP : lame noire dans le prolongement du toit, légèrement relevée
bpy.ops.mesh.primitive_cube_add(size=1, location=(-1.80, 0, 1.345))
spoiler = bpy.context.active_object
spoiler.scale = (0.22, 1.30, 0.03)
spoiler.rotation_euler = (0, math.radians(-6), 0)
spoiler.data.materials.append(BLACK)
bev = spoiler.modifiers.new("b", "BEVEL")
bev.width = 0.012
bev.segments = 3
for y in (-0.64, 0.64):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(-1.76, y, 1.30))
    fin = bpy.context.active_object
    fin.scale = (0.16, 0.025, 0.07)
    fin.data.materials.append(BLACK)

# baguette chromée de ligne de caisse
for side in (-1, 1):
    bpy.ops.mesh.primitive_cylinder_add(radius=0.008, depth=2.55, location=(-0.40, side * 0.835, 0.935), rotation=(0, math.pi / 2, 0))
    bpy.context.active_object.data.materials.append(CHROME)


# ---------- éléments en arc (élargisseurs) ----------
def arc_tube(name, center, radius, a0, a1, y, thick, material, flat=1.8):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = thick
    cu.bevel_resolution = 4
    sp = cu.splines.new("POLY")
    n = 32
    sp.points.add(n - 1)
    for i in range(n):
        a = math.radians(a0 + (a1 - a0) * i / (n - 1))
        sp.points[i].co = (center[0] + radius * math.cos(a), y, center[1] + radius * math.sin(a), 1)
    ob = link(bpy.data.objects.new(name, cu), material)
    ob.scale = (1, 1, 1)
    return ob


for ax in (FRONT_AXLE, REAR_AXLE):
    for side in (-1, 1):
        arc_tube("Elargisseur", (ax, WHEEL_R + 0.02), 0.395, -8, 188, side * 0.855, 0.045, BLACK)

# bas de caisse noirs
for side in (-1, 1):
    bpy.ops.mesh.primitive_cube_add(size=1, location=((FRONT_AXLE + REAR_AXLE) / 2, side * 0.83, 0.235))
    sk = bpy.context.active_object
    sk.scale = (FRONT_AXLE - REAR_AXLE - 0.80, 0.07, 0.10)
    sk.data.materials.append(BLACK)
    b = sk.modifiers.new("b", "BEVEL")
    b.width = 0.03
    b.segments = 4

# boucliers bas noirs (avant/arrière)
for x, w in ((1.77, 0.80), (-1.77, 0.80)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, 0, 0.215))
    lip = bpy.context.active_object
    lip.scale = (0.10, 2 * w * 0.93, 0.05)
    lip.data.materials.append(BLACK)
    b = lip.modifiers.new("b", "BEVEL")
    b.width = 0.04
    b.segments = 4


# ---------- face avant ----------
def disc(name, loc, r, depth, material, rot=(0, math.pi / 2, 0), verts=48):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc, rotation=rot, vertices=verts)
    o = bpy.context.active_object
    o.name = name
    o.data.materials.append(material)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def ring(name, loc, r, minor, material, rot=(0, math.pi / 2, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=r, minor_radius=minor, location=loc, rotation=rot, major_segments=64, minor_segments=12)
    o = bpy.context.active_object
    o.name = name
    o.data.materials.append(material)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


# phares ronds
for side in (-1, 1):
    hl = (1.735, side * 0.565, 0.745)
    tilt = (0, math.pi / 2 - math.radians(18), side * math.radians(-12))
    ring("Phare cerclage", hl, 0.112, 0.016, CHROME, tilt)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.105, location=hl, segments=48, ring_count=24)
    lens = bpy.context.active_object
    lens.scale = (0.32, 1, 1)
    lens.rotation_euler = (0, math.radians(-18), side * math.radians(-12))
    lens.data.materials.append(LENS)
    for p in lens.data.polygons:
        p.use_smooth = True
    # clignotant sous le phare
    disc("Clignotant", (1.80, side * 0.60, 0.50), 0.045, 0.03, AMBER)

# calandre hexagonale (large, pointes sur les côtés)
gme = bpy.data.meshes.new("Calandre")
hex_yz = [(0.30, 0.555), (0.22, 0.655), (-0.22, 0.655), (-0.30, 0.555), (-0.22, 0.455), (0.22, 0.455)]
bm = bmesh.new()
front = [bm.verts.new((1.845, y, z)) for y, z in hex_yz]
back = [bm.verts.new((1.78, y * 0.95, z)) for y, z in hex_yz]
bm.faces.new(front)
bm.faces.new(back[::-1])
for i in range(6):
    bm.faces.new((front[i], back[i], back[(i + 1) % 6], front[(i + 1) % 6]))
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bm.to_mesh(gme)
bm.free()
grille = link(bpy.data.objects.new("Calandre", gme), BLACK)
b = grille.modifiers.new("b", "BEVEL")
b.width = 0.015
b.segments = 3
for i, z in enumerate((0.515, 0.555, 0.595)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(1.85, 0, z))
    bar = bpy.context.active_object
    bar.scale = (0.012, 0.50 - abs(i - 1) * 0.08, 0.012)
    bar.data.materials.append(CHROME)

# entrée d'air basse
bpy.ops.mesh.primitive_cube_add(size=1, location=(1.83, 0, 0.36))
intake = bpy.context.active_object
intake.scale = (0.05, 0.78, 0.13)
intake.data.materials.append(BLACK)
b = intake.modifiers.new("b", "BEVEL")
b.width = 0.03
b.segments = 4

# antibrouillards
for side in (-1, 1):
    ring("Antibrouillard cerclage", (1.83, side * 0.60, 0.36), 0.05, 0.012, CHROME)
    disc("Antibrouillard", (1.83, side * 0.60, 0.36), 0.045, 0.02, LENS)

# écope de capot
bpy.ops.mesh.primitive_cube_add(size=1, location=(1.40, 0, 0.905))
scoop = bpy.context.active_object
scoop.scale = (0.24, 0.36, 0.06)
scoop.rotation_euler = (0, math.radians(8), 0)
scoop.data.materials.append(PAINT)
b = scoop.modifiers.new("b", "BEVEL")
b.width = 0.03
b.segments = 4
bpy.ops.mesh.primitive_cube_add(size=1, location=(1.51, 0, 0.905))
mouth = bpy.context.active_object
mouth.scale = (0.03, 0.30, 0.035)
mouth.rotation_euler = (0, math.radians(8), 0)
mouth.data.materials.append(BLACK)

# plaque avant
bpy.ops.mesh.primitive_cube_add(size=1, location=(1.85, 0, 0.44))
pl = bpy.context.active_object
pl.scale = (0.01, 0.52, 0.11)
pl.data.materials.append(PLATE)

# ---------- arrière ----------
for side in (-1, 1):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(-1.83, side * 0.66, 0.79))
    tl = bpy.context.active_object
    tl.scale = (0.04, 0.12, 0.17)
    tl.data.materials.append(TAIL)
    b = tl.modifiers.new("b", "BEVEL")
    b.width = 0.03
    b.segments = 4
bpy.ops.mesh.primitive_cube_add(size=1, location=(-1.845, 0, 0.62))
pr = bpy.context.active_object
pr.scale = (0.01, 0.52, 0.11)
pr.data.materials.append(PLATE)
for y in (-0.05, 0.05):  # double sortie d'échappement centrale
    disc("Echappement", (-1.83, y, 0.22), 0.035, 0.12, CHROME)

# ---------- rétroviseurs (coques rouges) ----------
for side in (-1, 1):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.1, location=(0.76, side * 0.97, 1.02), segments=32, ring_count=16)
    mir = bpy.context.active_object
    mir.scale = (0.55, 1.0, 0.65)
    mir.data.materials.append(RED)
    for p in mir.data.polygons:
        p.use_smooth = True
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0.80, side * 0.86, 0.97))
    arm = bpy.context.active_object
    arm.scale = (0.12, 0.12, 0.05)
    arm.data.materials.append(BLACK)
    b = arm.modifiers.new("b", "BEVEL")
    b.width = 0.015
    b.segments = 3

# poignées de porte
for side in (-1, 1):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(-0.30, side * 0.86, 0.84))
    h = bpy.context.active_object
    h.scale = (0.16, 0.02, 0.025)
    h.data.materials.append(CHROME)
    b = h.modifiers.new("b", "BEVEL")
    b.width = 0.01
    b.segments = 3


# ---------- roues (jantes GP 18") ----------
def wheel(x, side):
    y = side * TRACK_HALF
    rot = (math.pi / 2, 0, 0)
    tyre = ring("Pneu", (x, y, WHEEL_R), WHEEL_R - 0.065, 0.068, TYRE, rot)
    tyre.scale = (1, 1, 1.45)
    disc("Flanc", (x, y, WHEEL_R), WHEEL_R - 0.05, 0.20, TYRE, rot, 64)
    face = y + side * 0.10
    disc("Fond jante", (x, face - side * 0.02, WHEEL_R), 0.225, 0.02, RIM_DARK, rot, 64)
    ring("Bord jante", (x, face, WHEEL_R), 0.228, 0.012, RIM, rot)
    # étrier rouge (avant)
    if x > 0:
        bpy.ops.mesh.primitive_cube_add(size=1, location=(x - 0.10, face - side * 0.05, WHEEL_R + 0.10))
        cal = bpy.context.active_object
        cal.scale = (0.10, 0.04, 0.14)
        cal.rotation_euler = (0, math.radians(35), 0)
        cal.data.materials.append(RED)
    # 5 doubles branches
    for k in range(5):
        for off in (-0.11, 0.11):
            a = 2 * math.pi * k / 5 + off
            bpy.ops.mesh.primitive_cube_add(size=1)
            sp = bpy.context.active_object
            sp.scale = (0.022, 0.018, 0.20)
            sp.location = (x + 0.11 * math.sin(a), face, WHEEL_R + 0.11 * math.cos(a))
            sp.rotation_euler = (0, a, 0)
            sp.data.materials.append(RIM)
            b = sp.modifiers.new("b", "BEVEL")
            b.width = 0.006
            b.segments = 2
    disc("Moyeu", (x, face + side * 0.005, WHEEL_R), 0.055, 0.03, RIM_DARK, rot)


for ax in (FRONT_AXLE, REAR_AXLE):
    for side in (-1, 1):
        wheel(ax, side)

# ---------- scène de rendu ----------
bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, 0))
ground = bpy.context.active_object
gm = mat("Sol", (0.08, 0.08, 0.085), rough=0.6)
ground.data.materials.append(gm)

world = bpy.data.worlds.new("Monde")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.05, 0.05, 0.055, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.0


def area(loc, size, energy, target=(0, 0, 0.6)):
    bpy.ops.object.light_add(type="AREA", location=loc)
    lt = bpy.context.active_object
    lt.data.size = size
    lt.data.energy = energy
    d = Vector(target) - Vector(loc)
    lt.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    return lt


area((0, 0, 6), 6, 1200)
area((5, 4, 3), 4, 700)
area((-5, -3, 3), 4, 500)
area((2, -6, 2.5), 3, 500)

cam_data = bpy.data.cameras.new("Cam")
cam_data.lens = 50
cam = bpy.data.objects.new("Cam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam


def shoot(name, loc, target=(0, 0, 0.62)):
    cam.location = loc
    d = Vector(target) - Vector(loc)
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = os.path.join(OUT, name)
    bpy.ops.render.render(write_still=True)


scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = int(os.environ.get("SAMPLES", "48"))
scene.cycles.use_denoising = True
scene.render.resolution_x = 1200
scene.render.resolution_y = 800
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Medium High Contrast"

shoot("mini_34_avant.png", (6.6, 4.4, 1.35))  # même angle que la photo (avant gauche)
if os.environ.get("ALL_VIEWS"):
    shoot("mini_profil.png", (0.0, 8.5, 1.0))
    shoot("mini_34_arriere.png", (-6.2, 4.6, 1.6))
    shoot("mini_face.png", (8.0, 0.0, 1.0))

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "mini_gp.blend"))

# exports : GLB pour le viewer web, STL pour l'impression (sans le sol)
bpy.data.objects.remove(ground)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, "mini_gp.glb"), export_apply=True, use_selection=True)
bpy.ops.wm.stl_export(filepath=os.path.join(OUT, "mini_gp.stl"), apply_modifiers=True, export_selected_objects=True)
