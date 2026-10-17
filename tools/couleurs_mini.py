import bpy, sys, math, numpy as np
OUT='/tmp/claude-0/-home-claude-justemyride/540305f1-e73e-51bb-970f-6d6db3beadfe/scratchpad/mini'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=f'{OUT}/in.glb')
ob=[o for o in bpy.data.objects if o.type=='MESH'][0]; me=ob.data
n=len(me.polygons)
C=np.empty(n*3,np.float32); me.polygons.foreach_get('center',C); C=C.reshape(-1,3)
N=np.empty(n*3,np.float32); me.polygons.foreach_get('normal',N); N=N.reshape(-1,3)
# normales lissées (moyenne des normales de sommets) pour éviter les bords en dents de scie
VN=np.empty(len(me.vertices)*3,np.float32); me.vertex_normals.foreach_get('vector',VN); VN=VN.reshape(-1,3)
LT=np.empty(len(me.loop_triangles)*3,np.int32) if False else None
PV=np.empty(n*3,np.int32); me.polygons.foreach_get('vertices',PV) if all(len(p.vertices)==3 for p in me.polygons[:10]) else None
PV=PV.reshape(-1,3); SN=VN[PV].mean(1); SN/=np.linalg.norm(SN,axis=1,keepdims=True)+1e-9
N=SN
x,y,z=C.T; nx,ny,nz=N.T; ay=np.abs(y)

def srgb(h):
    h=h.lstrip('#'); c=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(((v+0.055)/1.055)**2.4 if v>0.04045 else v/12.92 for v in c)
# name: (couleur sRGB, metallic, roughness)
MATS=dict(
 carrosserie=('#363940',0.7,0.34),
 toit=('#c3c5c7',0.85,0.3),
 chrome=('#f2f2f2',1.0,0.06),
 vitre=('#0b0d10',0.0,0.12),
 phare=('#d9dde0',0.6,0.08),
 plastique_noir=('#111214',0.0,0.55),
 pneu=('#141414',0.0,0.85),
 jante=('#a7a9ab',1.0,0.3),
 passage_roue=('#26272a',0.0,0.65),
 clignotant=('#e9c9a6',0.2,0.1),
 rouge_S=('#c4161c',0.1,0.3),
 feu_arriere=('#9c0f12',0.1,0.15),
)
names=list(MATS)
me.materials.clear()
for k in names:
    col,met,rough=MATS[k]
    m=bpy.data.materials.new('JMR_'+k); m.use_nodes=True
    b=m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value=(*srgb(col),1)
    b.inputs['Metallic'].default_value=met; b.inputs['Roughness'].default_value=rough
    if k=='carrosserie' or k=='toit':
        b.inputs['Coat Weight'].default_value=0.6; b.inputs['Coat Roughness'].default_value=0.05
    me.materials.append(m)
I={k:i for i,k in enumerate(names)}
mat=np.full(n,I['carrosserie'],np.int32)
def put(mask,k): mat[mask]=I[k]

def frontness(mask, cell=0.008, tol=0.004, axis=0, sign=1):
    """True for faces near the outermost surface along axis within (y,z) cells: separates bars from recesses."""
    idx=np.where(mask)[0]
    if len(idx)==0: return mask
    other=[a for a in (0,1,2) if a!=axis]
    k=np.floor(C[idx][:,other]/cell).astype(np.int64)
    key=k[:,0]*100000+k[:,1]
    d=-sign*C[idx,axis]  # larger = more outward
    uniq,inv=np.unique(key,return_inverse=True)
    mx=np.full(len(uniq),-1e9); np.maximum.at(mx,inv,d)
    res=np.zeros(n,bool); res[idx]=d>=mx[inv]-tol
    return res

# --- toit (tout ce qui est au-dessus des vitres) + aileron
roof=(z>0.205)&~((x<-0.06)&(nz<0.8)&(nx<-0.3))
put(roof,'toit')
put((x>0.74)&(z>0.12),'toit')
# antenne
put((z>0.275)&(ay<0.06),'plastique_noir')

# --- vitres
# bord avant de la vitre de porte (vue de profil) : de (x=-0.2625,z=0.04) à (x=-0.119,z=0.206)
L1=-0.2625+(z-0.04)*(0.1435/0.166)
spoiler=(x>0.74)&(z>0.12)
seal=(z>0.038)&(z<0.058)&(x>=L1)&(x<0.74)&(ay>0.3)&(nz<0.9)
put(seal,'plastique_noir')
side_glass=(z>0.05)&(z<=0.205)&(x>=L1)&(np.abs(ny)>0.5)&~spoiler
rear_glass=(z>0.042)&(x>0.6)&(nx>0.3)&(((z<=0.205)&~spoiler)|((x>0.7)&(nx>0.4)&(z<0.235)&((ay<0.16)|((ay>0.225)&(ay<0.33)))))
wind=(z>0.025)&(z<0.25)&(x<L1+0.01)&(x>-0.47)&(np.abs(ny)<=0.55)&(nx<-0.3)&(nz<0.85)
put(side_glass|rear_glass|wind,'vitre')
# essuie-glaces : ce qui dépasse devant la surface du pare-brise
wi=np.where(wind)[0]
A=np.stack([np.ones(len(wi)),y[wi],z[wi],y[wi]**2,z[wi]**2,y[wi]*z[wi]],1)
coef,*_=np.linalg.lstsq(A,x[wi],rcond=None)
fx=np.stack([np.ones(n),y,z,y**2,z**2,y*z],1)@coef
wip=(z>-0.005)&(z<0.09)&(x<fx-0.006)&(x>-0.5)&(ay<0.36)&(x>fx-0.06)
put(wip,'plastique_noir')

# --- roues
for xc in (-0.6125,0.65):
    r=np.hypot(x-xc,z+0.275)
    side=ay>0.30
    put(side&(r<0.160),'pneu')
    put(side&(r<0.120)&(ay>0.33),'jante')
    put((ay>0.22)&(ay<=0.33)&(r<0.12),'plastique_noir')
    put((ay>0.36)&(np.abs(ny)>0.35)&(r>=0.160)&(r<0.196)&(z>-0.33),'passage_roue')

# --- phares avant : axe propre à chaque phare (ils regardent un peu vers l'extérieur)
for yc in (0.3025,-0.3025):
    r2=np.hypot(y-yc,z+0.1025)
    core=(x<-0.7)&(nx<-0.3)&(r2<0.035)
    cc=C[core]; c0=cc.mean(0); ax=N[core].mean(0); ax/=np.linalg.norm(ax)
    v=C-c0; along=v@ax; rad=np.linalg.norm(v-np.outer(along,ax),axis=1)
    near=(along>-0.05)&(along<0.03)&(x<-0.6)
    put(near&(rad<0.0615),'chrome')
    put(near&(rad<0.049),'phare')

# --- calandre (forme en arche)
ztop=-0.1275-0.0175*(y/0.19)**2
gb=(x<-0.75)&(ay<0.19)&(z<ztop)&(z>-0.178)&(nx<-0.2)
bars=frontness(gb,cell=0.012,tol=0.0035)
put(gb,'plastique_noir'); put(bars,'chrome')
ring=(x<-0.75)&(nx<-0.2)&(ay<0.2)&(z<ztop+0.006)&(z>-0.184)&~gb
put(ring,'chrome')
# S rouge (côté gauche conducteur = -Y), dessiné par une courbe
t=np.linspace(0,1,200)
sy=-0.122+0.007*np.cos(t*2*math.pi*0.75+math.pi*0.25)*np.where(t<0.5,1,-1)
sz=-0.148-0.026*t
ss=np.stack([sy,sz],1)
cand=np.where(gb&(y<-0.10)&(y>-0.145))[0]
if len(cand):
    P=C[cand][:,1:3]
    d=np.min(np.linalg.norm(P[:,None,:]-ss[None,:,:],axis=2),axis=1)
    put(np.isin(np.arange(n),cand[d<0.0028]),'rouge_S')

# --- prise d'air du capot (ouverture)
scoop=(x<-0.55)&(((y/0.093)**2+((z+0.0675)/0.0095)**2)<1)&(nx<0.3)
put(scoop,'plastique_noir')
# grilles d'auvent au pied du pare-brise
cowl=(x>-0.45)&(x<-0.22)&(ay>0.09)&(ay<0.27)&(z>-0.01)&(z<0.035)&(nz>0.5)
put(cowl,'plastique_noir')

# --- pare-chocs avant
fb=(x<-0.7)&(nx<-0.3)
plate=fb&(ay<0.127)&(z<-0.2025)&(z>-0.2575)
strip=fb&(z<-0.1935)&(z>-0.2245)&(y<0.215)&(y>-0.225)&~plate
put(strip,'chrome')
put(fb&(ay<0.215)&(z<-0.252)&(z>-0.318),'plastique_noir')   # grande entrée d'air
put(plate,'plastique_noir')   # plaque laissée vierge, sans texte
for yc in (0.295,-0.295):
    put(fb&(np.hypot(y-yc,z+0.205)<0.017),'clignotant')
    put(fb&(ay>0.225)&(ay<0.345)&(z<-0.25)&(z>-0.305),'plastique_noir')
    put((x<-0.7)&(np.hypot(y-yc*0.963,z+0.275)<0.016),'phare')

# --- rétros
mir=(x>-0.27)&(x<-0.13)&(z>-0.01)&(z<0.08)&(ay>0.38)
put(mir,'chrome'); put(mir&(ay<0.40),'plastique_noir')
# répétiteurs latéraux + trappe à carburant
put((x>-0.49)&(x<-0.38)&(z>-0.077)&(z<-0.045)&(ay>0.35),'chrome')
put((y<-0.3)&(np.hypot(x-0.519,z+0.019)<0.044),'chrome')

# --- arrière
back=x>0.8
for yc in (0.287,-0.287):
    put(back&(np.hypot(y-yc,z+0.172)<0.04),'feu_arriere')
put(back&(ay<0.052)&(z<0.012)&(z>-0.013),'chrome')
put(back&(ay<0.122)&(z<-0.203)&(z>-0.252),'plastique_noir')
put(back&(z<-0.33),'plastique_noir')

me.polygons.foreach_set('material_index',mat)
me.update()
print({k:int((mat==I[k]).sum()) for k in names})
np.save(f'{OUT}/mat.npy',mat)
bpy.ops.export_scene.gltf(filepath=f'{OUT}/mini_couleurs.glb',export_format='GLB',export_yup=True)
