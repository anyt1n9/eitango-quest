"""
海の3D背景（src/ocean/oceanScene.ts）で使う3Dモデルを、Blender をプログラムで動かして作る。

画像や購入品を使わず、形・色・物陰の暗さ(AO)まで、このファイルだけで作る（権利の心配が無く、
数値を変えれば何度でも作り直せる）。アプリが読むのは src/ocean/assets/ocean.glb（数値を詰めたもの）。
手順は CLAUDE.md の「海の3D背景」。

  python scripts/blender/make_ocean_assets.py <出力フォルダ> [--preview]

1つの GLB にまとめる。名前の末尾 _0/_1/_2 は画質の 高/中/低 で使う細かさ:
  manta      … マンタ。羽ばたきは three.js 側で付けるので形だけ（前が +Z、上が +Y）
  staghorn_a / staghorn_b … 枝サンゴ（ミドリイシの仲間）
  brain      … 脳サンゴ（ノウサンゴ）
  fan        … ウミウチワ（扇形のヤギ類）
  rock_a / rock_b … 岩
  seagrass   … 海草の株（リュウキュウスガモのような細い葉）
色は頂点ごとに持つ（材質や画像は使わない）。--preview を付けると Cycles で確認用の画像も描き出す。
"""
import bpy, bmesh, math, random, sys, os
from mathutils import Vector, Matrix, noise
from mathutils.bvhtree import BVHTree

args = [a for a in sys.argv[1:] if not a.startswith('--')]
OUT = args[0] if args else '.'
PREVIEW = '--preview' in sys.argv
os.makedirs(OUT, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
LODS = [1.0, 0.4, 0.16]   # 高・中・低で残す面の割合


# ---------------------------------------------------------------- helpers
def link(name, me):
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    return ob


def from_bmesh(name, bm):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    return link(name, me)


def bake_modifiers(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    old = ob.data
    ob.modifiers.clear()
    ob.data = me
    bpy.data.meshes.remove(old)


def smooth(ob):
    for p in ob.data.polygons:
        p.use_smooth = True


def smoothstep(a, b, x):
    t = min(max((x - a) / (b - a), 0.0), 1.0)
    return t * t * (3 - 2 * t)


def mix(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


def fbm(p, octaves=4):
    s, a, f = 0.0, 0.5, 1.0
    for _ in range(octaves):
        s += a * noise.noise(p * f)
        a *= 0.5
        f *= 2.03
    return s


HEMI = []
_rnd = random.Random(3)
for _ in range(28):  # cosine-weighted directions around +Z
    u1, u2 = _rnd.random(), _rnd.random()
    r, th = math.sqrt(u1), 2 * math.pi * u2
    HEMI.append(Vector((r * math.cos(th), r * math.sin(th), math.sqrt(1 - u1))))


def ambient_occlusion(ob, dist):
    """各頂点から半球状に光線を飛ばし、自分自身に当たった割合で暗くする"""
    me = ob.data
    bvh = BVHTree.FromPolygons([v.co for v in me.vertices], [p.vertices for p in me.polygons])
    out = []
    for v in me.vertices:
        n = v.normal
        rot = n.to_track_quat('Z', 'Y').to_matrix()
        o = v.co + n * 0.004
        hit = 0
        for d in HEMI:
            loc, *_ = bvh.ray_cast(o, rot @ d, dist)
            if loc is not None:
                hit += 1
        out.append(1.0 - 0.85 * hit / len(HEMI))
    return out


def paint(ob, fn, ao=None):
    """fn(co, normal) -> (r, g, b) を頂点色にする（AO があれば掛ける）"""
    me = ob.data
    attr = me.color_attributes.new('Color', 'FLOAT_COLOR', 'POINT')
    for i, v in enumerate(me.vertices):
        c = fn(v.co, v.normal)
        k = ao[i] if ao else 1.0
        attr.data[i].color = (c[0] * k, c[1] * k, c[2] * k, 1.0)
    me.color_attributes.active_color = attr
    me.color_attributes.render_color_index = 0


def make_lods(ob, base, lods=LODS):
    """面を減らした高・中・低を作り、名前を base_0/_1/_2 にそろえる"""
    if lods[0] < 1.0:
        mod = ob.modifiers.new('dec', 'DECIMATE')
        mod.ratio = lods[0]
        bake_modifiers(ob)
        smooth(ob)
    ob.name = f'{base}_0'
    ob.data.name = f'{base}_0'
    out = [ob]
    for i, ratio in enumerate(lods[1:], start=1):
        cp = ob.copy()
        cp.data = ob.data.copy()
        scene.collection.objects.link(cp)
        mod = cp.modifiers.new('dec', 'DECIMATE')
        mod.ratio = ratio / lods[0]
        bake_modifiers(cp)
        smooth(cp)
        cp.name = f'{base}_{i}'
        cp.data.name = f'{base}_{i}'
        out.append(cp)
    return out


def tri_count(ob):
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)


# ---------------------------------------------------------------- manta
def build_manta(S=2.1, L=1.15):
    """前が -Y（glTF に書き出すと +Z）、翼の幅 2S、体長 2L（尾を除く）"""
    NU, NV = 56, 36

    def front(s):
        y = L * (0.55 - 0.75 * s ** 2.2) + 0.2 * L * math.exp(-((s - 0.165) / 0.045) ** 2)
        if s < 0.1:
            y -= 0.06 * L * (1 - s / 0.1)
        return y

    def back(s):
        return L * (-0.6 + 0.37 * s ** 0.55)

    def thick(s, v):
        env = math.sqrt(max(0.0, 1 - v * v))
        core = max(0.0, 1 - s / 0.34) ** 1.6
        return (0.13 * L * core + 0.018 * L * (1 - s)) * env

    bm = bmesh.new()
    for sgn in (1, -1):
        rows = []
        for j in range(NV + 1):
            v = 1 - 2 * j / NV
            row = []
            for i in range(2 * NU + 1):
                u = -1 + i / NU
                s = abs(u)
                yf, yb = front(s), back(s)
                fy = yb + (yf - yb) * (v + 1) / 2
                t = thick(s, v)
                z = t if sgn > 0 else -0.55 * t
                z -= 0.07 * L * s * s
                z -= 0.05 * L * math.exp(-((s - 0.165) / 0.045) ** 2) * max(0.0, (v - 0.6) / 0.4)
                row.append(bm.verts.new((u * S, -fy, z)))
            rows.append(row)
        for j in range(NV):
            for i in range(2 * NU):
                a, b, c, d = rows[j][i], rows[j][i + 1], rows[j + 1][i + 1], rows[j + 1][i]
                bm.faces.new((a, b, c, d) if sgn > 0 else (a, d, c, b))
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    # 細い尾
    tail = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=True, segments=8, radius1=0.035, radius2=0.004, depth=1.1,
                                 matrix=Matrix.Translation((0, 0.6 * L + 0.5, -0.02)) @ Matrix.Rotation(math.radians(-90), 4, 'X'))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = from_bmesh('manta', bm)
    smooth(ob)

    dark, belly = (0.03, 0.035, 0.045), (0.8, 0.8, 0.78)

    def color(co, n):
        x, y, z = co
        s = min(abs(x) / S, 1.0)
        fy = -y
        if fy < back(0) - 0.01:          # 尾
            return dark
        yf, yb = front(s), back(s)
        v = max(-1.0, min(1.0, ((fy - yb) / max(yf - yb, 1e-4)) * 2 - 1))
        if n.z >= 0:                     # 背中：黒地に肩の白い模様（ナンヨウマンタの特徴）
            line = 0.72 - 1.7 * (s - 0.12)
            shoulder = math.exp(-((v - line) / 0.16) ** 2) * smoothstep(0.08, 0.16, s) * (1 - smoothstep(0.38, 0.5, s))
            c = mix(dark, (0.5, 0.52, 0.53), shoulder * 0.8)
            return mix(c, (0.12, 0.13, 0.15), smoothstep(0.75, 1.0, s) * 0.5)
        # お腹：白地。翼の縁は黒く、体の中央に個体ごとの黒い斑点、えらの切れ込み
        c = belly
        c = mix(c, dark, smoothstep(0.82, 0.97, s))
        c = mix(c, dark, smoothstep(-0.7, -0.92, v) * 0.85)
        spot = smoothstep(0.45, 0.6, noise.noise(Vector((x * 6, y * 6, 1.7))))
        c = mix(c, dark, spot * (1 - smoothstep(0.3, 0.4, s)) * smoothstep(-0.6, -0.2, v) * 0.9)
        if 0.07 < s < 0.17 and 0.05 < v < 0.5 and ((v - 0.05) / 0.09) % 1.0 < 0.22:
            c = mix(c, (0.25, 0.25, 0.27), 0.7)
        if s < 0.12 and v > 0.85:          # 口
            c = mix(c, dark, 0.8)
        return c

    paint(ob, color)
    return make_lods(ob, 'manta')


# ---------------------------------------------------------------- branching coral (staghorn)
def build_staghorn(name, seed, height=0.9):
    rnd = random.Random(seed)
    bm = bmesh.new()
    skin = bm.verts.layers.skin.verify()

    def grow(parent, pos, direction, radius, depth):
        steps = rnd.randint(2, 4)
        seg = height * (0.08 + 0.03 * rnd.random())
        last = parent
        for k in range(steps):
            direction = (direction + Vector((rnd.uniform(-0.25, 0.25), rnd.uniform(-0.25, 0.25), 0.18))).normalized()
            pos = pos + direction * seg
            v = bm.verts.new(pos)
            r = max(radius * (1 - 0.08 * (k + 1)), 0.022)
            v[skin].radius = (r, r)
            bm.edges.new((last, v))
            last = v
        if depth < 2:
            for _ in range(rnd.randint(2, 3)):
                axis = Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), 0)).normalized()
                ang = math.radians(rnd.uniform(22, 42))
                nd = (Matrix.Rotation(ang, 3, axis) @ direction).normalized()
                grow(last, pos, nd, radius * 0.8, depth + 1)

    root = bm.verts.new((0, 0, 0))
    root[skin].radius = (0.09, 0.09)
    root[skin].use_root = True
    for _ in range(rnd.randint(6, 8)):
        d = Vector((rnd.uniform(-0.9, 0.9), rnd.uniform(-0.9, 0.9), 1)).normalized()
        grow(root, Vector((0, 0, 0)), d, 0.05, 0)
    ob = from_bmesh(name, bm)
    ob.modifiers.new('skin', 'SKIN')
    sub = ob.modifiers.new('sub', 'SUBSURF')
    sub.levels = 1
    bake_modifiers(ob)
    smooth(ob)
    ao = ambient_occlusion(ob, 0.35)
    top = max(v.co.z for v in ob.data.vertices)
    base_col, tip_col = (0.38, 0.27, 0.16), (0.78, 0.62, 0.36)

    def color(co, n):
        h = co.z / top
        c = mix(base_col, tip_col, smoothstep(0.2, 0.95, h))
        return mix(c, (0.7, 0.75, 0.95), smoothstep(0.9, 1.0, h) * 0.6)  # 伸びている先端は白っぽい

    paint(ob, color, ao)
    return make_lods(ob, name, [0.5, 0.2, 0.08])


# ---------------------------------------------------------------- brain coral
def build_brain(name, seed):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=5, radius=1.0)
    off = Vector((seed * 3.1, seed * 1.7, 0))
    grooves = []
    for v in bm.verts:
        p = v.co.copy()
        warp = Vector((noise.noise(p * 1.3 + off), noise.noise(p * 1.3 + off + Vector((5, 0, 0))), 0)) * 0.25
        n = noise.noise((p + warp) * 3.2 + off)
        g = math.exp(-(n / 0.09) ** 2)          # 0 のところが溝（迷路状の模様）
        r = 1 + 0.07 * fbm(p * 0.9 + off, 2) - 0.035 * g
        q = p * r
        if q.z < -0.05:
            q.z = -0.05 + (q.z + 0.05) * 0.15
        v.co = Vector((q.x, q.y, q.z * 0.72))
        grooves.append(g)
    ob = from_bmesh(name, bm)
    smooth(ob)
    ao = ambient_occlusion(ob, 0.25)
    me = ob.data

    def color(co, n):
        return (0.0, 0.0, 0.0)

    paint(ob, color)
    attr = me.color_attributes['Color']
    for i, v in enumerate(me.vertices):
        g = grooves[i]
        c = mix((0.62, 0.55, 0.26), (0.24, 0.3, 0.14), g)
        k = ao[i]
        attr.data[i].color = (c[0] * k, c[1] * k, c[2] * k, 1.0)
    return make_lods(ob, name)


# ---------------------------------------------------------------- sea fan
def build_fan(name, seed):
    rnd = random.Random(seed)
    bm = bmesh.new()
    skin = bm.verts.layers.skin.verify()

    def grow(parent, pos, ang, radius, depth, length):
        last = parent
        steps = 4
        for k in range(steps):
            ang += rnd.uniform(-0.18, 0.18)
            pos = pos + Vector((math.sin(ang), rnd.uniform(-0.01, 0.01), math.cos(ang))) * (length / steps)
            v = bm.verts.new(pos)
            r = max(radius * (1 - 0.06 * (k + 1)), 0.005)
            v[skin].radius = (r, r)
            bm.edges.new((last, v))
            last = v
        if depth < 6:
            spread = 0.34 - depth * 0.02
            grow(last, pos, ang - spread * rnd.uniform(0.6, 1.0), radius * 0.8, depth + 1, length * 0.78)
            grow(last, pos, ang + spread * rnd.uniform(0.6, 1.0), radius * 0.8, depth + 1, length * 0.78)

    root = bm.verts.new((0, 0, 0))
    root[skin].radius = (0.035, 0.035)
    root[skin].use_root = True
    for a0 in (-0.55, -0.18, 0.18, 0.55):
        grow(root, Vector((0, 0, 0)), a0, 0.022, 0, 0.2)
    ob = from_bmesh(name, bm)
    ob.modifiers.new('skin', 'SKIN')
    bake_modifiers(ob)
    smooth(ob)

    def color(co, n):
        return mix((0.45, 0.08, 0.18), (0.78, 0.25, 0.42), smoothstep(0.0, 1.2, co.z))

    paint(ob, color)
    return make_lods(ob, name, [0.55, 0.22, 0.08])


# ---------------------------------------------------------------- rocks
def build_rock(name, seed):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=5, radius=1.0)
    off = Vector((seed * 7.3, seed * 2.9, seed * 1.1))
    for v in bm.verts:
        p = v.co.copy()
        cell = noise.voronoi(p * 2.4 + off)[0]
        crack = smoothstep(0.0, 0.08, cell[1] - cell[0])
        r = 1 + 0.38 * fbm(p * 1.1 + off) + 0.07 * fbm(p * 4.0 + off, 3) - 0.05 * (1 - crack)
        q = p * r
        if q.z < -0.2:
            q.z = -0.2 + (q.z + 0.2) * 0.2
        v.co = Vector((q.x * 1.15, q.y, q.z * 0.7))
    ob = from_bmesh(name, bm)
    smooth(ob)
    ao = ambient_occlusion(ob, 0.6)

    def color(co, n):
        g = 0.5 + 0.5 * fbm(co * 3.0 + off, 3)
        c = mix((0.33, 0.31, 0.28), (0.5, 0.47, 0.42), g)
        c = mix(c, (0.32, 0.4, 0.2), smoothstep(0.45, 0.85, n.z) * 0.55)          # 上面の藻
        pink = smoothstep(0.55, 0.7, noise.noise(co * 2.0 + off + Vector((9, 9, 9))))
        return mix(c, (0.72, 0.42, 0.48), pink * smoothstep(0.2, 0.6, n.z) * 0.6)  # 石灰藻のピンク

    paint(ob, color, ao)
    return make_lods(ob, name)


# ---------------------------------------------------------------- seagrass
def build_seagrass(name, seed):
    """細い葉が十数枚集まった海草の株。葉は先が細く丸まり、中央に筋があって外へしなる。
    細かさは面を減らすのではなく、葉の枚数と節の数で作り分ける（細い帯は減らすと崩れるため）"""
    out = []
    for lod, (blades, segs) in enumerate([(18, 10), (12, 6), (7, 3)]):
        rnd = random.Random(seed)
        bm = bmesh.new()
        for _ in range(blades):
            ang = rnd.uniform(0, 2 * math.pi)
            r0 = rnd.uniform(0, 0.07)
            base = Vector((math.cos(ang) * r0, math.sin(ang) * r0, 0))
            length = rnd.uniform(0.3, 0.75)
            width = rnd.uniform(0.012, 0.022)
            lean = rnd.uniform(0.15, 0.55)
            out_dir = Vector((math.cos(ang), math.sin(ang), 0))
            tw0, tw_rate = rnd.uniform(0, math.pi), rnd.uniform(-1.2, 1.2)
            rows = []
            for k in range(segs + 1):
                t = k / segs
                c = base + Vector((0, 0, length * t * (1 - 0.25 * lean * t))) + out_dir * (lean * length * t * t * 0.6)
                tw = tw0 + tw_rate * t
                side = Vector((math.cos(tw), math.sin(tw), 0))
                w = width * (1.0 if t < 0.85 else max(0.15, (1 - t) / 0.15))
                rib = side.cross(Vector((0, 0, 1))).normalized() * w * 0.18
                rows.append((bm.verts.new(c - side * w / 2), bm.verts.new(c + rib), bm.verts.new(c + side * w / 2)))
            for k in range(segs):
                a, b = rows[k], rows[k + 1]
                bm.faces.new((a[0], a[1], b[1], b[0]))
                bm.faces.new((a[1], a[2], b[2], b[1]))
        ob = from_bmesh(f'{name}_{lod}', bm)
        smooth(ob)
        off = Vector((seed, 0, 0))

        def color(co, n):
            h = min(co.z / 0.75, 1.0)
            c = mix((0.08, 0.16, 0.05), (0.3, 0.46, 0.13), smoothstep(0.0, 0.8, h))
            brown = smoothstep(0.5, 0.75, noise.noise(co * 7.0 + off))   # 先の方に付く茶色い付着物
            return mix(c, (0.42, 0.38, 0.18), brown * smoothstep(0.5, 1.0, h) * 0.7)

        paint(ob, color)
        out.append(ob)
    return out


# ---------------------------------------------------------------- build all
groups = {
    'manta': build_manta(),
    'staghorn_a': build_staghorn('staghorn_a', 11),
    'staghorn_b': build_staghorn('staghorn_b', 23, height=0.7),
    'brain': build_brain('brain', 4),
    'fan': build_fan('fan', 8),
    'rock_a': build_rock('rock_a', 2),
    'rock_b': build_rock('rock_b', 5),
    'seagrass': build_seagrass('seagrass', 13),
}
for base, obs in groups.items():
    print(base, [tri_count(o) for o in obs])

# ---------------------------------------------------------------- export
bpy.ops.object.select_all(action='DESELECT')
for obs in groups.values():
    for o in obs:
        o.select_set(True)
glb = os.path.join(OUT, 'ocean_assets.glb')
bpy.ops.export_scene.gltf(
    filepath=glb, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
    export_materials='NONE', export_vertex_color='ACTIVE', export_normals=True, export_tangents=False,
)
print('wrote', glb, os.path.getsize(glb), 'bytes')

# ---------------------------------------------------------------- preview render (Cycles, CPU)
if PREVIEW:
    for obs in groups.values():
        for o in obs[1:]:
            o.hide_render = True
    layout = [('manta', (0, 0, 1.4), 0.75), ('staghorn_a', (-2.6, 0.4, 0), 1.3), ('staghorn_b', (-1.4, 1.2, 0), 1.3),
              ('brain', (1.4, 0.6, 0.2), 0.5), ('fan', (2.6, 1.4, 0), 1.6), ('rock_a', (-0.2, 1.8, 0.1), 0.7), ('rock_b', (3.6, 0.2, 0.1), 0.5), ('seagrass', (0.9, -1.2, 0), 1.8)]
    mat = bpy.data.materials.new('vc')
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes['Principled BSDF']
    attr = nt.nodes.new('ShaderNodeVertexColor')
    attr.layer_name = 'Color'
    nt.links.new(attr.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.6
    for base, pos, sc in layout:
        o = groups[base][0]
        o.location = pos
        o.scale = (sc, sc, sc)
        if base == 'manta':
            o.rotation_euler = (math.radians(35), 0, math.radians(20))
        o.data.materials.append(mat)
    gbm = bmesh.new()
    bmesh.ops.create_grid(gbm, x_segments=1, y_segments=1, size=15)
    bmesh.ops.translate(gbm, verts=gbm.verts, vec=(0, 0, -0.05))
    ground = from_bmesh('ground', gbm)
    gm = bpy.data.materials.new('sand')
    gm.use_nodes = True
    gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.55, 0.5, 0.4, 1)
    ground.data.materials.append(gm)
    world = bpy.data.worlds.new('w')
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.35, 0.55, 0.7, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.6
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
    sun.data.energy = 3.5
    sun.rotation_euler = (math.radians(40), math.radians(15), math.radians(30))
    scene.collection.objects.link(sun)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    cam.location = (0.4, -7.5, 3.2)
    cam.rotation_euler = (math.radians(70), 0, 0)
    cam.data.lens = 32
    scene.collection.objects.link(cam)
    scene.camera = cam
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 24
    scene.cycles.use_denoising = False
    scene.render.resolution_x, scene.render.resolution_y = 1200, 600
    scene.render.filepath = os.path.join(OUT, 'preview.png')
    bpy.ops.render.render(write_still=True)
    print('preview', scene.render.filepath)
