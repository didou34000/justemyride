"""Pièces fournies avec la bibliothèque (public/bibliotheque) : extrait chaque pièce déjà faite en GLB séparé + une vignette 512 px.
Usage : python tools/bibliotheque_pieces.py [-- id …], puis compresser (meshopt + WebP 1024) comme lib/glb.ts slimGlb."""
import bpy, sys, math
from mathutils import Vector
P = "/mnt/project-files"
OUT = "/home/claude/biblio/out"
SEEDS = [
  # id, fichier source, objets gardés, ratio d'allègement, couleur unie si pas de matériau
  ("s-rouge-cooper-s", "/home/claude/justemyride/public/badges/mini.glb", ["s"], 1),
  ("badge-rond-jm", "/home/claude/justemyride/public/badges/mini.glb", ["anneau", "disque", "jm"], 1),
  ("ailes-mini", "/home/claude/justemyride/public/badges/mini.glb", ["ailes"], 1),
  ("ecriture-cooper", "/home/claude/justemyride/public/badges/mini.glb", ["cooper"], 1),
  ("aileron-m140i", f"{P}/justmyride/aileron-test/v2/aileron_v2.glb", ["JMR_Spoiler"], 1, (0.7, -1, 0.6)),
  ("roue-mini-4-ecrous", f"{P}/justmyride/roues-e7de60f3-21-10/miniature-e7de60f3-blender.glb", ["roue_AVG"], 0.25),
  ("roue-mini-michelin", f"{P}/Meshy_AI_Mini_Michelin_Wheel_1020201537_texture.glb", ["Mesh_0"], 0.06),
]
only = sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
for sid, src, keep, ratio, *view in SEEDS:
    if only and sid not in only: continue
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    bpy.ops.import_scene.gltf(filepath=src)
    objs = [o for o in bpy.data.objects if o.type == 'MESH' and (o.name in keep or o.name.split(".")[0] in keep)]
    for o in list(bpy.data.objects):
        if o not in objs: bpy.data.objects.remove(o, do_unlink=True)
    for o in objs:
        mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if ratio < 1:
        for o in objs:
            d = o.modifiers.new("d", "DECIMATE"); d.ratio = ratio
            bpy.context.view_layer.objects.active = o; bpy.ops.object.modifier_apply(modifier="d")
    # Centre à l'origine, taille d'origine gardée.
    pts = [o.matrix_world @ v.co for o in objs for v in o.data.vertices]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    c = (lo + hi) / 2
    for o in objs:
        for v in o.data.vertices: v.co -= c
    bpy.ops.export_scene.gltf(filepath=f"{OUT}/{sid}.glb", export_format='GLB', use_selection=True, export_yup=True)
    # Vignette
    size = (hi - lo).length
    sc.render.engine = "CYCLES"; sc.cycles.samples = 48; sc.cycles.use_denoising = True
    sc.render.resolution_x = sc.render.resolution_y = 512
    sc.render.film_transparent = False
    sc.view_settings.view_transform = "AgX"
    w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (0.06, 0.06, 0.065, 1)
    w.node_tree.nodes["Background"].inputs[1].default_value = 1.0
    for loc, e in (((-1, -2, 1.5), 900), ((2, -1, 2), 500), ((0, 2, 1), 400)):
        L = bpy.data.lights.new("l", "AREA"); L.energy = e * size * size / 4; L.size = size * 1.5
        lo_ = bpy.data.objects.new("l", L); sc.collection.objects.link(lo_)
        lo_.location = Vector(loc) * size; lo_.rotation_euler = (-lo_.location).to_track_quat('-Z', 'Y').to_euler()
    dims = hi - lo
    thin = min(range(3), key=lambda k: dims[k])  # axe le plus fin = on regarde de face
    d = Vector((0, 0, 0)); d[thin] = -1
    if thin != 2: d.z = 0.35
    d += Vector((0.55, 0, 0)) if thin != 0 else Vector((0, -0.55, 0))
    if view: d = Vector(view[0])
    cam = bpy.data.cameras.new("c"); cam.lens = 85
    co = bpy.data.objects.new("c", cam); sc.collection.objects.link(co); sc.camera = co
    co.location = d.normalized() * size * 2.6
    co.rotation_euler = (-co.location).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = f"{OUT}/{sid}.png"
    bpy.ops.render.render(write_still=True)
    print("OK", sid, [len(o.data.vertices) for o in objs], tuple(round(x, 3) for x in dims))
