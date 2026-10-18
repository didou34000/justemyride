import bpy, bmesh, math, sys
from mathutils import Vector

out = sys.argv[sys.argv.index("--") + 1]
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene

metal = bpy.data.materials.new("Badge")
metal.use_nodes = True
b = metal.node_tree.nodes["Principled BSDF"]
b.inputs["Base Color"].default_value = (0.22, 0.22, 0.24, 1)
b.inputs["Metallic"].default_value = 0.4
b.inputs["Roughness"].default_value = 0.35

def mat(name, rgb, rough, metal_=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    n = m.node_tree.nodes["Principled BSDF"]
    n.inputs["Base Color"].default_value = (*rgb, 1)
    n.inputs["Roughness"].default_value = rough
    n.inputs["Metallic"].default_value = metal_
    return m

# Chromé = gris clair mat (règle du propriétaire), plus le noir et le rouge des badges.
GRIS = mat("Gris", (0.33, 0.33, 0.34), 0.6)
NOIR = mat("Noir", (0.015, 0.015, 0.018), 0.4)
ROUGE = mat("Rouge", (0.55, 0.02, 0.03), 0.4)
CUR = [GRIS]

def finish(o, depth=0.12, bevel=0.03):
    o.data.materials.append(CUR[0])
    return o

def poly_obj(name, polys, depth=0.12):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    for p in polys:
        vs = [bm.verts.new((x, y, 0)) for x, y in p]
        bm.faces.new(vs)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me)
    sc.collection.objects.link(o)
    s = o.modifiers.new("s", "SOLIDIFY"); s.thickness = depth; s.offset = 1
    bv = o.modifiers.new("b", "BEVEL"); bv.width = 0.025; bv.segments = 3; bv.limit_method = "ANGLE"
    return finish(o)

def circle(r, n=96, cx=0, cy=0):
    return [(cx + r * math.cos(2 * math.pi * i / n), cy + r * math.sin(2 * math.pi * i / n)) for i in range(n)]

def ring(name, r_out, r_in, cx=0, depth=0.14):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    n = 128
    o_ = [bm.verts.new((cx + r_out * math.cos(2*math.pi*i/n), r_out * math.sin(2*math.pi*i/n), 0)) for i in range(n)]
    i_ = [bm.verts.new((cx + r_in * math.cos(2*math.pi*i/n), r_in * math.sin(2*math.pi*i/n), 0)) for i in range(n)]
    for k in range(n):
        bm.faces.new((o_[k], o_[(k+1)%n], i_[(k+1)%n], i_[k]))
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); sc.collection.objects.link(o)
    s = o.modifiers.new("s", "SOLIDIFY"); s.thickness = depth; s.offset = 1
    bv = o.modifiers.new("b", "BEVEL"); bv.width = 0.02; bv.segments = 3; bv.limit_method = "ANGLE"
    return finish(o)

def text(name, body, font, size, x, y=0, depth=0.07, italic_shear=0.0):
    cu = bpy.data.curves.new(name, "FONT")
    cu.body = body
    cu.font = bpy.data.fonts.load(font)
    cu.size = size
    cu.align_x = "CENTER"; cu.align_y = "CENTER"
    cu.extrude = depth
    cu.bevel_depth = 0.012; cu.bevel_resolution = 3
    cu.shear = italic_shear
    o = bpy.data.objects.new(name, cu); sc.collection.objects.link(o)
    o.location = (x, y, depth)
    return finish(o)

# 1) Monogramme ailé générique (pas le logo MINI) : anneau + disque + 3 plumes par côté, centre « JM ».
CX = -4.2
ring("anneau", 1.0, 0.82, CX)
CUR[0] = NOIR
poly_obj("disque", [circle(0.78, cx=CX)], depth=0.08)
CUR[0] = GRIS
text("jm", "JM", "/usr/share/fonts/opentype/inter/InterDisplay-Black.otf", 0.62, CX, 0, depth=0.08).location.z = 0.16
feathers = []
for side in (-1, 1):
    for k, (y, L) in enumerate([(0.45, 1.55), (0.12, 1.3), (-0.21, 1.0)]):
        x0 = CX + side * 0.98
        x1 = CX + side * (0.98 + L)
        h = 0.2
        pts = [(x0, y + h/2), (x1, y + h/2 - 0.02), (x1 - side * 0.18, y - h/2), (x0, y - h/2)]
        if side < 0: pts = pts[::-1]
        feathers.append(pts)
poly_obj("ailes", feathers, depth=0.1)

# 2) Badge « S » : la lettre seule en relief.
CUR[0] = ROUGE
text("s", "S", "/usr/share/fonts/opentype/inter/Inter-Black.otf", 2.3, 0.9, depth=0.14)
CUR[0] = GRIS

# 3) Écriture « Cooper S », police neutre penchée.
text("cooper", "Cooper", "/usr/share/fonts/opentype/inter/InterDisplay-BoldItalic.otf", 1.15, 4.75, depth=0.1)
CUR[0] = ROUGE
text("cooper_s", "S", "/usr/share/fonts/opentype/inter/InterDisplay-BoldItalic.otf", 1.15, 6.72, depth=0.1)
CUR[0] = GRIS

# Lumières et caméra : un peu de biais pour que Meshy voie le relief.
world = bpy.data.worlds.new("w"); sc.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (1, 1, 1, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 0.55
for loc, e in [((-6, -6, 10), 900), ((8, -4, 6), 500), ((0, 8, 6), 300)]:
    l = bpy.data.lights.new("l", "AREA"); l.energy = e; l.size = 6
    lo = bpy.data.objects.new("l", l); lo.location = loc; sc.collection.objects.link(lo)
    lo.rotation_euler = (Vector((0.5, 0, 0)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()

cam = bpy.data.cameras.new("c"); cam.type = "ORTHO"; cam.ortho_scale = 16.5
co = bpy.data.objects.new("c", cam); sc.collection.objects.link(co); sc.camera = co
co.location = (0, -5.5, 14)
co.rotation_euler = (Vector((0, 0, 0)) - co.location).to_track_quat("-Z", "Y").to_euler()

sc.render.engine = "CYCLES"; sc.cycles.samples = 64; sc.cycles.device = "CPU"
sc.render.resolution_x = 2400; sc.render.resolution_y = 900
sc.render.film_transparent = True
sc.view_settings.view_transform = "Standard"
sc.render.filepath = out
bpy.ops.render.render(write_still=True)

# Export 3D des badges (sans caméra ni lumières), un objet par pièce, avec leurs couleurs.
glb = out.rsplit(".", 1)[0] + ".glb"
from mathutils import Matrix
# Debout, face vers l'avant (+Z en glTF) : plus simple à poser sur la carrosserie.
rx = Matrix.Rotation(math.radians(90), 4, "X")
for o in sc.objects:
    if o.type in {"MESH", "FONT"}:
        o.matrix_world = rx @ o.matrix_world
for o in sc.objects:
    o.select_set(o.type in {"MESH", "FONT"})
bpy.ops.export_scene.gltf(filepath=glb, use_selection=True, export_apply=True, export_format="GLB")
