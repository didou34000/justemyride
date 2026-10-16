"""Retire les logos et badges de marque d'un modèle chargé dans Blender.
On vise quelques points connus à l'écran (rayons depuis la caméra), on récupère l'îlot de géométrie touché,
puis on supprime tous les îlots de même matériau et de même taille (les 4 centres de roue, les 2 badges d'aile...)."""
import bpy, bmesh
from mathutils import Vector

def ray_from_pixel(scene, cam, px, py, W, H):
    fr = cam.data.view_frame(scene=scene)  # tr, br, bl, tl
    tr, br, bl, tl = [cam.matrix_world @ v for v in fr]
    u, v = px / W, py / H
    top = tl.lerp(tr, u); bot = bl.lerp(br, u)
    p = top.lerp(bot, v)
    o = cam.matrix_world.translation
    return o, (p - o).normalized()

def islands(obj):
    bm = bmesh.new(); bm.from_mesh(obj.data); bm.faces.ensure_lookup_table()
    seen = set(); out = []
    for f in bm.faces:
        if f.index in seen: continue
        stack = [f]; isl = []; seen.add(f.index)
        while stack:
            g = stack.pop(); isl.append(g.index)
            for e in g.edges:
                for h in e.link_faces:
                    if h.index not in seen:
                        seen.add(h.index); stack.append(h)
        out.append(isl)
    return bm, out

def isl_box(obj, bm, isl):
    mw = obj.matrix_world
    pts = [mw @ v.co for i in isl for v in bm.faces[i].verts]
    lo = Vector(map(min, *pts)) if len(pts) > 1 else pts[0]
    hi = Vector(map(max, *pts)) if len(pts) > 1 else pts[0]
    return lo, hi

def remove_targets(targets, tol=0.15, maxsize=0.25):
    """targets : liste de (obj, face_index). Supprime les îlots touchés et leurs jumeaux."""
    dg = bpy.context.evaluated_depsgraph_get()
    by_obj = {}
    for obj, fi in targets:
        by_obj.setdefault(obj.name, set()).add(fi)
    for name, fset in by_obj.items():
        obj = bpy.data.objects[name]
        bm, isls = islands(obj)
        info = []
        for isl in isls:
            lo, hi = isl_box(obj, bm, isl)
            info.append((isl, hi - lo, (lo + hi) / 2, obj.data.polygons[isl[0]].material_index))
        hit = [x for x in info if fset & set(x[0])]
        kill = set()
        for isl, size, c, mi in hit:
            if max(size) > maxsize:
                print("  îlot trop grand, ignoré", name, tuple(round(s, 3) for s in size)); continue
            for isl2, size2, c2, mi2 in info:
                if mi2 == mi and max(abs(a - b) for a, b in zip(sorted(size), sorted(size2))) < tol * max(max(size), 0.01) + 0.004:
                    kill.update(isl2)
        if kill:
            bmesh.ops.delete(bm, geom=[bm.faces[i] for i in kill], context="FACES")
            bm.to_mesh(obj.data); obj.data.update()
            print("  supprimé", len(kill), "faces dans", name)
        bm.free()

def probe(scene, cam, pixels, W, H):
    dg = bpy.context.evaluated_depsgraph_get()
    out = []
    for px, py in pixels:
        o, d = ray_from_pixel(scene, cam, px, py, W, H)
        ok, loc, nor, fi, obj, _ = scene.ray_cast(dg, o, d)
        if ok:
            print("  touché", (px, py), obj.name, obj.data.materials[obj.data.polygons[fi].material_index].name)
            out.append((obj, fi))
    return out


def hit_points(scene, cam, pixels, W, H):
    dg = bpy.context.evaluated_depsgraph_get()
    pts = []
    for px, py in pixels:
        o, d = ray_from_pixel(scene, cam, px, py, W, H)
        ok, loc, *_ = scene.ray_cast(dg, o, d)
        if ok:
            pts.append(loc.copy())
    return pts


def delete_in_spheres(spheres, keep=("iBody1", "iGlass", "iTyres")):
    """Supprime, dans toutes les pièces sauf la carrosserie, les faces dont le centre tombe dans une des sphères (centre, rayon)."""
    for obj in [o for o in bpy.data.objects if o.type == "MESH"]:
        mats = [m.name if m else "" for m in obj.data.materials]
        bm = bmesh.new(); bm.from_mesh(obj.data)
        mw = obj.matrix_world
        kill = []
        for f in bm.faces:
            name = mats[f.material_index] if f.material_index < len(mats) else ""
            if any(name.startswith(k) for k in keep):
                continue
            c = mw @ f.calc_center_median()
            if any((c - p).length < r for p, r in spheres):
                kill.append(f)
        if kill:
            bmesh.ops.delete(bm, geom=kill, context="FACES")
            bm.to_mesh(obj.data); obj.data.update()
            print("  sans logo :", len(kill), "faces retirées dans", obj.name)
        bm.free()


def strip_logos(scene, cam, aim):
    """Repère les logos par des rayons depuis 4 vues fixes, puis les retire (symétrie gauche/droite comprise)."""
    W, H = 900, 600
    S = []
    aim((0, 5.0, 1.0), (0, 1.9, 0.8))
    S += [(p, 0.065) for p in hit_points(scene, cam, [(445, 283)], W, H)]
    S += [(p, 0.03) for p in hit_points(scene, cam, [(x, 310) for x in range(520, 604, 6)], W, H)]
    aim((0, -5.0, 1.0), (0, -1.9, 0.7))
    S += [(p, 0.065) for p in hit_points(scene, cam, [(447, 290)], W, H)]
    aim((-4, -1.3, 0.6), (-0.8, -1.3, 0.35))
    S += [(p, 0.03) for p in hit_points(scene, cam, [(295, 251)], W, H)]
    S += [(p, 0.05) for p in hit_points(scene, cam, [(470, 330)], W, H)]
    aim((4, 1.3, 0.6), (0.8, 1.3, 0.35))
    S += [(p, 0.05) for p in hit_points(scene, cam, [(435, 315)], W, H)]
    aim((4, -1.3, 0.6), (0.8, -1.3, 0.35))
    S += [(p, 0.03) for p in hit_points(scene, cam, [(630, 175), (636, 175), (624, 175)], W, H)]
    S += [(p, 0.05) for p in hit_points(scene, cam, [(410, 305), (400, 300), (420, 310), (410, 290), (410, 318)], W, H)]
    aim((-4, 1.3, 0.6), (-0.8, 1.3, 0.35))
    S += [(p, 0.05) for p in hit_points(scene, cam, [(445, 315), (435, 305), (455, 325), (445, 300), (445, 330)], W, H)]
    S += [(Vector((-p.x, p.y, p.z)), r) for p, r in list(S) if abs(p.x) > 0.2]
    for o in bpy.data.objects:
        if o.type == "MESH" and any(m and "Logo" in m.name for m in o.data.materials):
            o.hide_render = True
    delete_in_spheres(S)
