"""
Préparation automatique d'un modèle de voiture pour le configurateur JustMyRide.

Usage (Blender en module Python, ou `blender -b -P tools/prepare_car.py -- ...`) :
    python tools/prepare_car.py <modele.glb|.gltf|.zip|.fbx|.obj|.blend> <dossier_sortie> [--nom slug]

Ce que fait le script :
  1. importe le modèle, aplatit la hiérarchie, enlève le sol / décor ;
  2. oriente (avant vers -Y dans Blender, donc +Z dans le site), met à l'échelle (4,30 m), pose au sol ;
  3. repère carrosserie, jantes, pneus, étriers, échappement (par les noms, sinon par la géométrie) ;
  4. renomme les matériaux au format standard JMR_Paint / JMR_Rim / JMR_Tyre / JMR_Caliper / JMR_Exhaust ;
  5. ajoute des ancres JMR_Wheel_* et JMR_Exhaust_* (rayon, largeur dans les propriétés) ;
  6. exporte <slug>.glb, <slug>.json (rapport) et <slug>_apercu.png.

Le rapport dit ce qui a été trouvé et comment : il faut le relire avant d'ajouter la voiture au catalogue.
"""

import json
import math
import os
import re
import sys
import tempfile
import zipfile
from collections import defaultdict

import bpy  # noqa: I001  (bpy d'abord : il rend bmesh et mathutils importables)
import bmesh
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

LONGUEUR = 4.30  # m, longueur d'une compacte : seule l'échelle relative compte pour la 3D
MAX_TRIANGLES = 400_000

RX = {
    "skip": re.compile(r"glass|window|windshield|vitre|verre|light|lamp|phare|feu|led|interior|int_|seat|siege|dash|"
                       r"steer|volant|plate|plaque|logo|emblem|badge|carpet|leather|mirror_?glass", re.I),
    "tyre": re.compile(r"tyre|tire|pneu|rubber|reifen|gomma|neumat", re.I),
    "caliper": re.compile(r"calip|etrier|étrier|bremssattel", re.I),
    "rim": re.compile(r"(^|[^a-z])rims?([^a-z]|$)|jante|felge|alloy|wheel", re.I),
    "exhaust": re.compile(r"exhaust|muffler|tail_?pipe|echap|échap|auspuff", re.I),
    "paint": re.compile(r"paint|body|lack|carros|exterior|shell|car_?colou?r", re.I),
    "rear": re.compile(r"tail|rear|back|arri|brake_?light|stop|red", re.I),
    "front": re.compile(r"head|front|avant|projector|drl", re.I),
}

report = {"etapes": [], "alertes": []}


def log(msg):
    print("•", msg)
    report["etapes"].append(msg)


def warn(msg):
    print("⚠", msg)
    report["alertes"].append(msg)


# ---------------------------------------------------------------- import


def import_model(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    ext = os.path.splitext(path)[1].lower()
    if ext == ".zip":
        tmp = tempfile.mkdtemp()
        with zipfile.ZipFile(path) as z:
            z.extractall(tmp)
        found = [os.path.join(r, f) for r, _, fs in os.walk(tmp) for f in fs
                 if f.lower().endswith((".glb", ".gltf", ".fbx", ".obj"))]
        if not found:
            raise SystemExit("Archive sans modèle 3D lisible")
        return import_model_file(sorted(found, key=lambda p: (not p.endswith((".glb", ".gltf")), p))[0])
    return import_model_file(path)


def import_model_file(path):
    ext = os.path.splitext(path)[1].lower()
    if ext in (".glb", ".gltf"):
        bpy.ops.import_scene.gltf(filepath=path)
    elif ext == ".fbx":
        bpy.ops.import_scene.fbx(filepath=path)
    elif ext == ".obj":
        bpy.ops.wm.obj_import(filepath=path)
    elif ext == ".blend":
        bpy.ops.wm.open_mainfile(filepath=path)
    else:
        raise SystemExit(f"Format non géré : {ext}")
    log(f"Import de {os.path.basename(path)}")


def flatten():
    """Toutes les pièces en coordonnées monde, sans parent ni transformation."""
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    for o in meshes:
        chain, p = [], o
        while p:
            chain.append(p.name)
            p = p.parent
        o["jmr_label"] = " ".join(chain)
    for o in meshes:
        mw = o.matrix_world.copy()
        o.parent = None
        if o.data.users > 1:
            o.data = o.data.copy()
        o.data.transform(mw)
        o.matrix_world = Matrix.Identity(4)
    for o in list(bpy.data.objects):
        if o.type != "MESH":
            bpy.data.objects.remove(o)
    for o in meshes:
        if not o.data.polygons:
            bpy.data.objects.remove(o)
    return [o for o in bpy.data.objects if o.type == "MESH"]


def bbox(objs):
    lo = Vector((math.inf,) * 3)
    hi = Vector((-math.inf,) * 3)
    for o in objs:
        for v in o.data.vertices:
            for i in range(3):
                lo[i] = min(lo[i], v.co[i])
                hi[i] = max(hi[i], v.co[i])
    return lo, hi


def transform_all(objs, m):
    for o in objs:
        o.data.transform(m)
        o.data.update()


# ---------------------------------------------------------------- rôles par les noms


def slot_label(o, mat):
    return f"{mat.name if mat else ''} {o.get('jmr_label', o.name)}"


def name_role(label):
    if RX["tyre"].search(label):
        return "tyre"
    if RX["caliper"].search(label):
        return "caliper"
    if RX["exhaust"].search(label):
        return "exhaust"
    if RX["rim"].search(label) and not re.search(r"steer|volant", label, re.I):
        return "rim"
    return None


def face_area_by_slot(o):
    areas = defaultdict(float)
    for p in o.data.polygons:
        areas[p.material_index] += p.area
    return areas


def mat_lightness(mat):
    if not mat:
        return 0.5
    c = mat.diffuse_color
    if mat.use_nodes:
        for n in mat.node_tree.nodes:
            if n.type == "BSDF_PRINCIPLED":
                if n.inputs["Base Color"].is_linked:
                    return 0.5
                c = n.inputs["Base Color"].default_value
                break
    return (max(c[:3]) + min(c[:3])) / 2


def is_see_through(mat):
    if not mat:
        return False
    if mat.use_nodes:
        for n in mat.node_tree.nodes:
            if n.type == "BSDF_PRINCIPLED":
                if n.inputs["Alpha"].default_value < 0.99 or n.inputs["Transmission Weight"].default_value > 0.01:
                    return True
    return False


# ---------------------------------------------------------------- géométrie


def islands(o, face_filter):
    """Îlots de faces connectées (parmi les faces retenues). Renvoie des listes d'indices de faces."""
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bm.faces.ensure_lookup_table()
    keep = {f.index for f in bm.faces if face_filter(f)}
    seen, out = set(), []
    for start in keep:
        if start in seen:
            continue
        stack, isl = [start], []
        seen.add(start)
        while stack:
            fi = stack.pop()
            isl.append(fi)
            for e in bm.faces[fi].edges:
                for nf in e.link_faces:
                    if nf.index in keep and nf.index not in seen:
                        seen.add(nf.index)
                        stack.append(nf.index)
        out.append(isl)
    bm.free()
    return out


def faces_bbox(o, faces):
    lo = Vector((math.inf,) * 3)
    hi = Vector((-math.inf,) * 3)
    verts = o.data.vertices
    for fi in faces:
        for vi in o.data.polygons[fi].vertices:
            co = verts[vi].co
            for i in range(3):
                lo[i] = min(lo[i], co[i])
                hi[i] = max(hi[i], co[i])
    return lo, hi


def find_wheels(objs, L, W):
    """Roues trouvées par la forme : îlots ronds (vus de côté), posés au sol, dans les 4 coins."""
    parts = defaultdict(list)  # coin -> [(lo, hi)] de tous les îlots de la zone
    for o in objs:
        polys = o.data.polygons

        def in_zone(f):
            c = polys[f.index].center
            return c.z < 0.9 and abs(c.x) > 0.2 * W and abs(c.y) > 0.12 * L

        for isl in islands(o, in_zone):
            lo, hi = faces_bbox(o, isl)
            c = (lo + hi) / 2
            parts[("L" if c.x > 0 else "R") + ("F" if c.y < 0 else "B")].append((lo, hi, len(isl)))
    wheels = {}
    for corner, lst in parts.items():
        round_ = [(lo, hi) for lo, hi, n in lst if n >= 12 and 0.4 < (hi - lo).z < 0.95
                  and 0.8 < (hi - lo).y / (hi - lo).z < 1.25 and (hi - lo).x < 0.7 * (hi - lo).z and lo.z < 0.1]
        if not round_:
            continue
        lo, hi = max(round_, key=lambda b: (b[1] - b[0]).z)
        c, r = (lo + hi) / 2, (hi - lo).z / 2
        # Largeur : tous les morceaux contenus dans la roue (pneu, jante, flancs…).
        xs = [x for a, b, _ in lst
              if (b - a).z <= 2 * r * 1.05 and math.hypot((a + b).y / 2 - c.y, (a + b).z / 2 - c.z) < 0.15 * r
              and abs((a + b).x / 2 - c.x) < 0.3 for x in (a.x, b.x)]
        x0, x1 = min(xs), max(xs)
        width = min(max(x1 - x0, 0.12), 0.4)
        wheels[corner] = {"centre": Vector(((x0 + x1) / 2, c.y, c.z)), "rayon": r, "largeur": width}
    return wheels


# ---------------------------------------------------------------- matériaux standard


def std_material(name, base):
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    m = base.copy() if base else bpy.data.materials.new(name)
    m.name = name
    if not base:
        m["jmr_new"] = True
    return m


def set_slot(o, slot, mat):
    o.material_slots[slot].link = "DATA"
    o.material_slots[slot].material = mat


def slot_index_for(o, mat):
    for i, s in enumerate(o.material_slots):
        if s.material == mat:
            return i
    o.data.materials.append(mat)
    return len(o.material_slots) - 1


# ---------------------------------------------------------------- principal


def main(src, out_dir, slug):
    import_model(src)
    objs = flatten()

    # Sol / décor : grande pièce plate.
    lo, hi = bbox(objs)
    flat = []
    for o in objs:
        a, b = bbox([o])
        d = b - a
        if d.z < 0.02 * max(d.x, d.y):
            flat.append((o, max(d.x, d.y)))
    if flat:
        others = [o for o in objs if o not in [f for f, _ in flat]]
        if others:
            a, b = bbox(others)
            ref = max(b.x - a.x, b.y - a.y)
            for o, size in flat:
                if size > 1.2 * ref:
                    log(f"Sol/décor enlevé : {o.name}")
                    bpy.data.objects.remove(o)
            objs = [o for o in bpy.data.objects if o.type == "MESH"]

    # Axe long sur Y, échelle, centrage, sol.
    lo, hi = bbox(objs)
    d = hi - lo
    if d.x > d.y:
        transform_all(objs, Matrix.Rotation(math.pi / 2, 4, "Z"))
        lo, hi = bbox(objs)
        d = hi - lo
    s = LONGUEUR / d.y
    c = (lo + hi) / 2
    transform_all(objs, Matrix.Scale(s, 4) @ Matrix.Translation(Vector((-c.x, -c.y, -lo.z))))
    lo, hi = bbox(objs)
    L, W, H = hi.y - lo.y, hi.x - lo.x, hi.z
    log(f"Échelle ×{s:.4g} : {L:.2f} × {W:.2f} × {H:.2f} m")
    if not (1.5 < W < 2.3 and 1.0 < H < 2.0):
        warn(f"Proportions inhabituelles ({W:.2f} m de large, {H:.2f} m de haut) : vérifier l'orientation.")

    # Rôles par les noms, au niveau de chaque emplacement de matériau.
    slot_roles = {}  # (obj, slot) -> rôle
    for o in objs:
        for i, sl in enumerate(o.material_slots):
            r = name_role(slot_label(o, sl.material))
            if r:
                slot_roles[(o.name, i)] = r

    # Avant / arrière : échappement, puis feux, puis forme (le pavillon est en général plus en arrière).
    def centroid(filter_fn):
        acc, n = Vector(), 0
        for o in objs:
            for p in o.data.polygons:
                if filter_fn(o, p):
                    acc += p.center
                    n += 1
        return acc / n if n else None

    rear_hint = None
    ex = centroid(lambda o, p: slot_roles.get((o.name, p.material_index)) == "exhaust")
    if ex:
        rear_hint, how = ex.y > 0, "échappement"
    else:
        def lab(o, p):
            sl = o.material_slots[p.material_index] if o.material_slots else None
            return slot_label(o, sl.material if sl else None)
        cabin = re.compile(r"leather|interior|seat|carpet|steer|dash", re.I)
        back = centroid(lambda o, p: bool(RX["rear"].search(lab(o, p))) and not RX["front"].search(lab(o, p))
                        and not cabin.search(lab(o, p)))
        front = centroid(lambda o, p: bool(RX["front"].search(lab(o, p))) and not RX["rear"].search(lab(o, p))
                         and not cabin.search(lab(o, p)))
        if back and front and abs(back.y - front.y) > 0.5:
            rear_hint, how = back.y > front.y, "feux"
        elif back and abs(back.y) > 0.25 * L:
            rear_hint, how = back.y > 0, "feux arrière"
        elif front and abs(front.y) > 0.25 * L:
            rear_hint, how = front.y < 0, "phares"
        elif (n_pos := exhaust_from_shape(objs, W, None, 1, True)) != (n_neg := exhaust_from_shape(objs, W, None, -1, True)) \
                and 0 in (n_pos, n_neg):
            rear_hint, how = n_pos > 0, "sorties d'échappement (forme)"
        else:
            top = centroid(lambda o, p: p.center.z > 0.92 * H)
            rear_hint, how = (top.y > 0 if top else True), "forme du toit (peu fiable)"
            warn("Avant/arrière deviné par la forme du toit : vérifier sur l'aperçu.")
    if not rear_hint:
        transform_all(objs, Matrix.Rotation(math.pi, 4, "Z"))
    log(f"Orientation par {how} : avant vers -Y")

    # Roues : d'abord la géométrie (fiable même sans noms), puis les noms pour jante/pneu.
    wheels = find_wheels(objs, L, W)
    if len(wheels) < 4:
        warn(f"{len(wheels)} roue(s) trouvée(s) sur 4 par la forme.")
    log("Roues : " + ", ".join(f"{k} r={v['rayon']:.2f} m" for k, v in sorted(wheels.items())))

    # Matériaux standard.
    def base_of(role):
        for (on, i), r in slot_roles.items():
            if r == role:
                return bpy.data.objects[on].material_slots[i].material
        return None

    mats = {r: std_material(n, base_of(r)) for r, n in
            [("tyre", "JMR_Tyre"), ("rim", "JMR_Rim"), ("caliper", "JMR_Caliper"), ("exhaust", "JMR_Exhaust")]}
    named_rims = any(r == "rim" for r in slot_roles.values())
    named_tyres = any(r == "tyre" for r in slot_roles.values())
    for (on, i), r in slot_roles.items():
        set_slot(bpy.data.objects[on], i, mats[r])

    # Sans noms : on découpe chaque roue en pneu (extérieur) et jante (intérieur).
    if wheels and not (named_rims and named_tyres):
        log("Jantes/pneus séparés par la géométrie (pas de noms exploitables)")
        first = {"tyre": defaultdict(float), "rim": defaultdict(float)}
        for o in objs:
            ti = ri = None
            for p in o.data.polygons:
                for w in wheels.values():
                    cc = w["centre"]
                    rel = p.center - cc
                    if abs(rel.x) > w["largeur"] * 0.6:
                        continue
                    rad = math.hypot(rel.y, rel.z)
                    if rad > w["rayon"] * 1.02:
                        continue
                    # Côté intérieur (vers le centre de la voiture) : disques, étriers → on n'y touche pas.
                    if rel.x * math.copysign(1, cc.x) < -w["largeur"] * 0.25:
                        continue
                    cur = o.material_slots[p.material_index].material if o.material_slots else None
                    if rad > w["rayon"] * 0.70:
                        if not named_tyres:
                            first["tyre"][cur] += p.area
                            ti = slot_index_for(o, mats["tyre"]) if ti is None else ti
                            p.material_index = ti
                    elif not named_rims:
                        first["rim"][cur] += p.area
                        ri = slot_index_for(o, mats["rim"]) if ri is None else ri
                        p.material_index = ri
                    break

        # Les nouveaux matériaux reprennent l'aspect d'origine ; le pneu est forcé en caoutchouc noir.
        for role in ("rim", "tyre"):
            m = mats[role]
            src = max(first[role], key=first[role].get) if first[role] else None
            if m.get("jmr_new") and src and not src.name.startswith("JMR_"):
                copy = src.copy()
                for o in objs:
                    for sl in o.material_slots:
                        if sl.material == m:
                            sl.material = copy
                name = m.name
                bpy.data.materials.remove(m)
                copy.name = name
                mats[role] = copy
        bsdf = next((n for n in (mats["tyre"].node_tree.nodes if mats["tyre"].use_nodes else []) if n.type == "BSDF_PRINCIPLED"), None)
        if bsdf and not named_tyres:
            if bsdf.inputs["Base Color"].is_linked:
                for link in list(bsdf.inputs["Base Color"].links):
                    mats["tyre"].node_tree.links.remove(link)
            bsdf.inputs["Base Color"].default_value = (0.02, 0.02, 0.02, 1)
            bsdf.inputs["Metallic"].default_value = 0
            bsdf.inputs["Roughness"].default_value = 0.85

    # Carrosserie : nom explicite, sinon la plus grande surface colorée.
    score = defaultdict(float)
    for o in objs:
        areas = face_area_by_slot(o)
        for i, sl in enumerate(o.material_slots):
            m = sl.material
            if not m or m.name.startswith("JMR_") or (o.name, i) in slot_roles:
                continue
            label = slot_label(o, m)
            if RX["skip"].search(label) or is_see_through(m):
                continue
            if mat_lightness(m) < 0.06:
                continue
            bonus = 4 if re.search(r"paint|lack|carros", m.name, re.I) else 2 if RX["paint"].search(m.name) else 1
            score[m.name] += areas.get(i, 0) * bonus
    if score:
        paint_src = bpy.data.materials[max(score, key=score.get)]
        log(f"Carrosserie : matériau « {paint_src.name} »")
        paint_src.name = "JMR_Paint"
    else:
        warn("Carrosserie non trouvée.")

    # Ancres de roues.
    names = {"LF": "FL", "RF": "FR", "LB": "RL", "RB": "RR"}
    for corner, w in wheels.items():
        e = bpy.data.objects.new(f"JMR_Wheel_{names[corner]}", None)
        bpy.context.scene.collection.objects.link(e)
        e.location = w["centre"]
        e["radius"] = round(w["rayon"] * 0.70 if not named_rims else rim_radius(objs, w), 4)
        e["tyre_radius"] = round(w["rayon"], 4)
        e["width"] = round(w["largeur"], 4)
        e["side"] = 1 if w["centre"].x > 0 else -1

    # Ancres d'échappement : pièces nommées, sinon mesure du pare-chocs arrière au rayon.
    tips = exhaust_from_names(objs) or exhaust_from_shape(objs, W, mats["exhaust"]) or exhaust_from_bumper(objs, W)
    for side, t in tips.items():
        e = bpy.data.objects.new(f"JMR_Exhaust_{side}", None)
        bpy.context.scene.collection.objects.link(e)
        e.location = t["centre"]
        e["radius"] = round(t["rayon"], 4)
        e["found"] = t["source"]
    log("Échappement : " + (", ".join(f"{k} ({v['source']})" for k, v in tips.items()) or "rien"))

    # Allègement pour le web.
    tris = sum(len(p.vertices) - 2 for o in objs for p in o.data.polygons)
    if tris > MAX_TRIANGLES:
        ratio = MAX_TRIANGLES / tris
        for o in objs:
            if len(o.data.polygons) > 2000:
                mod = o.modifiers.new("allege", "DECIMATE")
                mod.ratio = ratio
                with bpy.context.temp_override(object=o, active_object=o, selected_objects=[o]):
                    bpy.ops.object.modifier_apply(modifier=mod.name)
        log(f"Allégé : {tris} → ~{MAX_TRIANGLES} triangles")
    report["triangles"] = sum(len(p.vertices) - 2 for o in objs for p in o.data.polygons)

    os.makedirs(out_dir, exist_ok=True)
    glb = os.path.join(out_dir, f"{slug}.glb")
    bpy.ops.export_scene.gltf(filepath=glb, export_format="GLB", export_extras=True, export_apply=True)
    log(f"Export : {glb} ({os.path.getsize(glb) / 1e6:.1f} Mo)")

    report["roues"] = len(wheels)
    report["echappement"] = {k: v["source"] for k, v in tips.items()}
    report["carrosserie"] = bool(score)
    report["etriers"] = any(r == "caliper" for r in slot_roles.values())
    preview(os.path.join(out_dir, f"{slug}_apercu.png"))
    with open(os.path.join(out_dir, f"{slug}.json"), "w") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)


def rim_radius(objs, w):
    """Rayon de la jante nommée, mesuré dans le coin de la roue."""
    cc, best = w["centre"], 0.0
    for o in objs:
        for p in o.data.polygons:
            sl = o.material_slots[p.material_index] if o.material_slots else None
            if not sl or not sl.material or sl.material.name != "JMR_Rim":
                continue
            rel = p.center - cc
            if abs(rel.x) < w["largeur"] and abs(rel.y) < w["rayon"] * 1.1 and abs(rel.z) < w["rayon"] * 1.1:
                for vi in p.vertices:
                    v = o.data.vertices[vi].co - cc
                    best = max(best, math.hypot(v.y, v.z))
    return best if 0.3 * w["rayon"] < best < w["rayon"] else w["rayon"] * 0.7


def exhaust_from_names(objs):
    pts = defaultdict(list)
    for o in objs:
        for p in o.data.polygons:
            sl = o.material_slots[p.material_index] if o.material_slots else None
            if sl and sl.material and sl.material.name == "JMR_Exhaust":
                for vi in p.vertices:
                    co = o.data.vertices[vi].co
                    pts["L" if co.x > 0 else "R"].append(co.copy())
    out = {}
    for side, ps in pts.items():
        lo = Vector((min(p.x for p in ps), min(p.y for p in ps), min(p.z for p in ps)))
        hi = Vector((max(p.x for p in ps), max(p.y for p in ps), max(p.z for p in ps)))
        r = min(hi.x - lo.x, hi.z - lo.z) / 2
        if 0.01 < r < 0.15:
            out[side] = {"centre": Vector(((lo.x + hi.x) / 2, hi.y, (lo.z + hi.z) / 2)), "rayon": r, "source": "nommé"}
    return out


def exhaust_from_shape(objs, W, mat, end=1, dry=False):
    """Sorties existantes mais pas nommées : petites pièces rondes (ou ovales), creuses, en bas à l'arrière.
    end = +1 cherche du côté +Y, -1 du côté -Y ; dry = on compte sans rien modifier."""
    ymax = max(end * v.co.y for o in objs for v in o.data.vertices)
    found = []
    for o in objs:
        polys = o.data.polygons

        def zone(f):
            c = polys[f.index].center
            if end * c.y < ymax - 0.45 or c.z > 0.65:
                return False
            sl = o.material_slots[polys[f.index].material_index] if o.material_slots else None
            m = sl.material if sl else None
            return not (m and (m.name.startswith("JMR_") or re.search(r"glass|light|lamp|red|glow|plate", slot_label(o, m), re.I)))

        for isl in islands(o, zone):
            lo, hi = faces_bbox(o, isl)
            d = hi - lo
            if 0.04 < d.x < 0.22 and 0.04 < d.z < 0.16 and 0.7 < d.x / d.z < 2.4 and d.y > 0.02:
                found.append((o, isl, (lo + hi) / 2, d))
    # Les faces intérieure et extérieure d'un même tube sont souvent deux îlots : on les regroupe.
    groups = []
    for f in found:
        for g in groups:
            a, b = g[0], f
            if math.hypot(a[2].x - b[2].x, a[2].z - b[2].z) < (min(a[3].x, a[3].z) + min(b[3].x, b[3].z)) / 2:
                g.append(f)
                break
        else:
            groups.append([f])
    if dry:
        return len(groups) if 1 <= len(groups) <= 6 else 0
    if not 1 <= len(groups) <= 6:
        if groups:
            warn(f"{len(groups)} pièces rondes à l'arrière : trop pour être sûr, échappement ignoré.")
        return {}
    out = {}
    for k, g in enumerate(sorted(groups, key=lambda g: g[0][2].x)):
        lo = Vector((min(f[2].x - f[3].x / 2 for f in g), 0, min(f[2].z - f[3].z / 2 for f in g)))
        hi = Vector((max(f[2].x + f[3].x / 2 for f in g), max(f[2].y + f[3].y / 2 for f in g), max(f[2].z + f[3].z / 2 for f in g)))
        out[str(k + 1)] = {"centre": Vector(((lo.x + hi.x) / 2, hi.y, (lo.z + hi.z) / 2)),
                           "rayon": min(hi.x - lo.x, hi.z - lo.z) / 2, "source": "forme"}
        for o, isl, _, _ in g:
            idx = slot_index_for(o, mat)
            for fi in isl:
                o.data.polygons[fi].material_index = idx
    return out


def exhaust_from_bumper(objs, W):
    """Pas d'échappement nommé : on vise le bas du pare-chocs arrière, à environ un quart de la largeur."""
    verts, polys = [], []
    for o in objs:
        base = len(verts)
        verts += [v.co.copy() for v in o.data.vertices]
        polys += [[base + i for i in p.vertices] for p in o.data.polygons]
    tree = BVHTree.FromPolygons(verts, polys)
    hi = max(v.y for v in verts)
    out = {}
    for side, sx in (("L", 1), ("R", -1)):
        x = sx * 0.22 * W
        z = 0.08
        while z < 0.7:
            hit, _, _, _ = tree.ray_cast(Vector((x, hi + 1, z)), Vector((0, -1, 0)))
            if hit and hit.y > hi - 0.35:
                out[side] = {"centre": Vector((x, hit.y + 0.005, z + 0.05)), "rayon": 0.045, "source": "pare-chocs mesuré"}
                break
            z += 0.005
    if len(out) < 2:
        warn("Bas du pare-chocs arrière introuvable : pas d'ancre d'échappement.")
        return {}
    return out


def preview(path):
    scene = bpy.context.scene
    # Cycles sur le processeur : marche sans carte graphique (serveur, conteneur).
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 24
    scene.render.resolution_x, scene.render.resolution_y = 800, 450
    world = bpy.data.worlds.new("w")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.55, 0.57, 0.6, 1)
    scene.world = world
    sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
    sun.data.energy = 3
    sun.rotation_euler = (math.radians(40), 0, math.radians(30))
    scene.collection.objects.link(sun)
    ground = bpy.data.meshes.new("sol")
    ground.from_pydata([(-20, -20, 0), (20, -20, 0), (20, 20, 0), (-20, 20, 0)], [], [(0, 1, 2, 3)])
    gobj = bpy.data.objects.new("sol", ground)
    scene.collection.objects.link(gobj)
    # Repères visibles des ancres : sphères rouges (roues) et bleues (échappement).
    for e in [o for o in bpy.data.objects if o.name.startswith("JMR_")]:
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.06 if "Wheel" in e.name else 0.04, location=e.location)
        mark = bpy.context.active_object
        mm = bpy.data.materials.new("repere")
        mm.diffuse_color = (1, 0.05, 0.05, 1) if "Wheel" in e.name else (0.1, 0.3, 1, 1)
        mm.use_nodes = True
        mm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = mm.diffuse_color
        mm.node_tree.nodes["Principled BSDF"].inputs["Emission Color"].default_value = mm.diffuse_color
        mm.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = 3
        mark.data.materials.append(mm)
    cams = []
    for i, (az, h) in enumerate([(-35, 1.4), (155, 1.1)]):
        cam = bpy.data.objects.new(f"cam{i}", bpy.data.cameras.new(f"cam{i}"))
        scene.collection.objects.link(cam)
        a = math.radians(az)
        cam.location = Vector((7.5 * math.sin(a), -7.5 * math.cos(a), h))
        direction = Vector((0, 0, 0.55)) - cam.location
        cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
        cam.data.lens = 45
        cams.append(cam)
    parts = []
    for i, cam in enumerate(cams):
        scene.camera = cam
        p = path.replace(".png", f"_{i}.png")
        scene.render.filepath = p
        bpy.ops.render.render(write_still=True)
        parts.append(p)
    # Les deux vues côte à côte.
    imgs = [bpy.data.images.load(p) for p in parts]
    w, h = imgs[0].size
    out = bpy.data.images.new("apercu", w * 2, h)
    px = [0.0] * (w * 2 * h * 4)
    for k, im in enumerate(imgs):
        src = list(im.pixels)
        for row in range(h):
            dst0 = (row * w * 2 + k * w) * 4
            px[dst0:dst0 + w * 4] = src[row * w * 4:(row + 1) * w * 4]
    out.pixels = px
    out.filepath_raw = path
    out.file_format = "PNG"
    out.save()
    for p in parts:
        os.remove(p)
    log(f"Aperçu : {path}")


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    if len(argv) < 2:
        raise SystemExit(__doc__)
    src, out_dir = argv[0], argv[1]
    slug = argv[argv.index("--nom") + 1] if "--nom" in argv else re.sub(r"[^a-z0-9]+", "-", os.path.splitext(os.path.basename(src))[0].lower()).strip("-")
    main(src, out_dir, slug)
