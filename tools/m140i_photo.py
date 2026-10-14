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


def boite(nom, centre, taille, mat, biseau=0.006):
    bpy.ops.mesh.primitive_cube_add(size=1, location=centre)
    o = bpy.context.active_object
    o.name = nom
    o.scale = taille
    o.data.materials.append(mat)
    b = o.modifiers.new("b", "BEVEL")
    b.width = biseau
    b.segments = 2
    return o


# Diffuseur : plaque inclinée sous le bouclier, entre les deux sorties (l'arrière est vers +y)
Y_AR = 2.07
plaque = boite("Diffuseur", (0, Y_AR - 0.14, 0.225), (0.70, 0.24, 0.016), noir)
plaque.rotation_euler = (-0.18, 0, 0)
for i in range(7):
    x = -0.30 + i * 0.10
    ail = boite(f"Ailette {i}", (x, Y_AR - 0.09, 0.26), (0.010, 0.18, 0.07), noir, 0.003)
    ail.rotation_euler = (-0.18, 0, 0)
boite("Feu antibrouillard", (0, Y_AR - 0.005, 0.29), (0.10, 0.012, 0.022), feu, 0.004)
# lames latérales sous les sorties
for side in (-1, 1):
    boite("Lame latérale", (side * 0.60, Y_AR - 0.22, 0.215), (0.26, 0.14, 0.012), noir)
bpy.context.view_layer.update()

shoot("photo_arriere.png", vue(180, 6.0, 0.9), target=(0, 0, 0.55))
shoot("photo_34_arriere.png", vue(150, 7.5, 1.2))
shoot("photo_34_avant.png", vue(40))
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "bmw_m140i_photo.blend"))
