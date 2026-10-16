"""Images de la boutique (accueil, exemples) : rendus de la M140i SANS logo ni badge.

Usage : python shop_shots.py <bmw-m140i.glb> <bmw_m140i_photo.blend> <dossier_sortie>
Phase A : modèle d'origine (depuis le GLB, via customize.py). Phase B : version personnalisée (le .blend de m140i_photo.py).
Les deux phases utilisent les mêmes angles de caméra, pour le comparateur avant/après.
"""
import math
import os
import sys

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from nologo import strip_logos  # noqa: E402

GLB, BLEND, OUT = sys.argv[-3], sys.argv[-2], sys.argv[-1]
os.makedirs(OUT, exist_ok=True)
SAMPLES = int(os.environ.get("SAMPLES", "64"))
ONLY = os.environ.get("ONLY", "AB")


def setup():
    sc = bpy.context.scene
    sc.cycles.samples = SAMPLES
    sc.cycles.use_denoising = True
    return sc, sc.camera


def aimer(cam, loc, target):
    cam.location = loc
    cam.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    bpy.context.view_layer.update()


def vue(az_deg, dist=8.5, h=1.6):
    # az 0 = face avant ; l'avant du modèle est vers -y
    a = math.radians(az_deg)
    fwd, side = Vector((0, -1, 0)), Vector((1, 0, 0))
    return tuple(dist * (math.cos(a) * fwd + math.sin(a) * side) + Vector((0, 0, h)))


def photo(sc, cam, nom, loc, w, h, target=(0, 0, 0.6)):
    sc.render.resolution_x, sc.render.resolution_y = w, h
    aimer(cam, loc, target)
    sc.render.filepath = os.path.join(OUT, nom)
    bpy.ops.render.render(write_still=True)


def sans_logo(sc, cam):
    sc.render.resolution_x, sc.render.resolution_y = 900, 600  # les repères de nologo sont en 900 x 600
    strip_logos(sc, cam, lambda loc, t: aimer(cam, loc, t))


def principled(nom):
    m = bpy.data.materials.get(nom)
    return m.node_tree.nodes.get("Principled BSDF") if m and m.use_nodes else None


def teinte(nom, col, met, rough):
    p = principled(nom)
    p.inputs["Base Color"].default_value = (*col, 1)
    p.inputs["Metallic"].default_value = met
    p.inputs["Roughness"].default_value = rough


HERO = (1400, 1250)
CARTE = (1200, 900)

# Phase A : origine
if "A" in ONLY:
    sys.argv = [sys.argv[0], GLB, OUT]
    code = open(os.path.join(HERE, "customize.py")).read().split("for nom, cfg in VARIANTES.items():")[0]
    exec(compile(code, "customize", "exec"))
    sc, cam = setup()
    sans_logo(sc, cam)
    photo(sc, cam, "origine_hero.png", vue(150, 7.5, 1.2), *HERO)
    photo(sc, cam, "origine_34_avant.png", vue(40), *CARTE)

# Phase B : version personnalisée (diffuseur, aileron noir, grosses sorties)
if "B" in ONLY:
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    sc, cam = setup()
    sans_logo(sc, cam)
    if "V" not in ONLY:  # ONLY=BV : seulement les variantes de couleur
        photo(sc, cam, "perso_hero.png", vue(150, 7.5, 1.2), *HERO)
        photo(sc, cam, "perso_34_avant.png", vue(40), *CARTE)
        photo(sc, cam, "perso_diffuseur.png", vue(180, 3.4, 0.5), *CARTE, target=(0, 1.9, 0.32))
        photo(sc, cam, "perso_large.png", vue(35, 8.0, 1.3), 1600, 1000)
    VARIANTES = {
        "bleu": ((0.02, 0.12, 0.55), 0.3, 0.25, (0.02, 0.02, 0.02), 0.6, (0.02, 0.15, 0.7)),
        "rouge": ((0.45, 0.01, 0.02), 0.4, 0.25, (0.7, 0.71, 0.73), 1.0, (0.03, 0.03, 0.03)),
        "noir": ((0.01, 0.01, 0.012), 0.6, 0.3, (0.35, 0.22, 0.09), 1.0, (0.75, 0.35, 0.02)),
        "nardo": ((0.075, 0.08, 0.085), 0.0, 0.35, (0.02, 0.02, 0.02), 0.6, (0.6, 0.02, 0.02)),
    }
    for nom, (paint, pm, pr, rim, rm, cal) in VARIANTES.items():
        if os.environ.get("VARIANTE", nom) != nom:
            continue
        teinte("iBody1", paint, pm, pr)
        teinte("iRim1", rim, rm, 0.3)
        teinte("iCalipers1", cal, 0.0, 0.3)
        photo(sc, cam, f"variante_{nom}.png", vue(40), *CARTE)
