"""Epic sword. Blue fire grows, dies, and travels so the loop reads as motion.

  blender -b --python build_epic.py -- --frames 12
"""

import math
import os
import sys

import bpy
from mathutils import Vector

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(ROOT, "out")
LOOP = 12

BLADE_LEN = 1.22
BLADE_HALF_W = 0.074
BLADE_HALF_T = 0.014


def args_after():
    if "--" not in sys.argv:
        return []
    return sys.argv[sys.argv.index("--") + 1 :]


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def emit(name, color, strength):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    nodes.clear()
    node = nodes.new("ShaderNodeEmission")
    node.inputs["Color"].default_value = (color[0], color[1], color[2], 1.0)
    node.inputs["Strength"].default_value = strength
    out = nodes.new("ShaderNodeOutputMaterial")
    mat.node_tree.links.new(node.outputs["Emission"], out.inputs["Surface"])
    return mat


def diffuse(name, color):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    nodes.clear()
    node = nodes.new("ShaderNodeBsdfDiffuse")
    node.inputs["Color"].default_value = (color[0], color[1], color[2], 1.0)
    node.inputs["Roughness"].default_value = 1.0
    out = nodes.new("ShaderNodeOutputMaterial")
    mat.node_tree.links.new(node.outputs["BSDF"], out.inputs["Surface"])
    return mat


def steel_material():
    mat = bpy.data.materials.new("steel")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()
    geom = nodes.new("ShaderNodeNewGeometry")
    sep = nodes.new("ShaderNodeSeparateXYZ")
    add = nodes.new("ShaderNodeMath")
    add.operation = "ADD"
    add.inputs[1].default_value = 1.0
    mul = nodes.new("ShaderNodeMath")
    mul.operation = "MULTIPLY"
    mul.inputs[1].default_value = 0.5
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.22
    ramp.color_ramp.elements[0].color = (0.32, 0.36, 0.43, 1)
    ramp.color_ramp.elements[1].position = 0.82
    ramp.color_ramp.elements[1].color = (0.94, 0.91, 0.80, 1)
    mid = ramp.color_ramp.elements.new(0.52)
    mid.color = (0.66, 0.70, 0.75, 1)
    diff = nodes.new("ShaderNodeBsdfDiffuse")
    diff.inputs["Roughness"].default_value = 1.0
    out = nodes.new("ShaderNodeOutputMaterial")
    links.new(geom.outputs["Normal"], sep.inputs["Vector"])
    links.new(sep.outputs["X"], add.inputs[0])
    links.new(add.outputs["Value"], mul.inputs[0])
    links.new(mul.outputs["Value"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], diff.inputs["Color"])
    links.new(diff.outputs["BSDF"], out.inputs["Surface"])
    return mat


def mesh_object(name, verts, faces, material):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    return obj


def box(name, loc, scale, material):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    obj.data.materials.append(material)
    return obj


def cylinder(name, loc, radius, depth, material):
    bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=radius, depth=depth, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(material)
    return obj


def gem_sphere(name, loc, radius, material):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=radius, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(material)
    return obj


def build_sword():
    steel = steel_material()
    steel_dk = diffuse("steel_dk", (0.38, 0.42, 0.48))
    leather = diffuse("leather", (0.58, 0.32, 0.16))
    leather_dk = diffuse("leather_dk", (0.30, 0.15, 0.08))
    gem = emit("gem", (0.12, 0.40, 0.98), 1.2)
    glint = emit("glint", (0.90, 0.96, 1.0), 1.45)

    section = [
        (-1.0, 0.0),
        (-0.2, 1.0),
        (0.0, 0.25),
        (0.2, 1.0),
        (1.0, 0.0),
        (0.2, -1.0),
        (0.0, -0.25),
        (-0.2, -1.0),
    ]
    rings = 9
    verts = []
    for i in range(rings):
        t = i / (rings - 1)
        taper = max(1.0 - (t ** 1.7), 0.02)
        z = BLADE_LEN * t
        for x, y in section:
            verts.append((x * BLADE_HALF_W * taper, y * BLADE_HALF_T * taper, z))
    n = len(section)
    faces = [tuple(range(n - 1, -1, -1))]
    for i in range(rings - 1):
        for k in range(n):
            a = i * n + k
            b = i * n + (k + 1) % n
            c = (i + 1) * n + (k + 1) % n
            d = (i + 1) * n + k
            faces.append((a, b, c, d))
    mesh_object("blade", verts, faces, steel)
    box("fuller", (0.006, -0.011, BLADE_LEN * 0.46), (0.010, 0.005, BLADE_LEN * 0.70), steel_dk)
    box("guard", (0, 0, -0.006), (0.44, 0.034, 0.026), steel)
    cylinder("grip", (0, 0, -0.145), 0.032, 0.20, leather)
    for i, z in enumerate((-0.075, -0.115, -0.155, -0.195)):
        cylinder(f"wrap_{i}", (0, 0, z), 0.036, 0.016, leather_dk)
    cylinder("bolster", (0, 0, -0.052), 0.040, 0.024, steel_dk)
    cylinder("pommel_lip", (0, 0, -0.252), 0.042, 0.020, steel)
    gem_sphere("pommel", (0, 0, -0.308), 0.044, gem)
    gem_sphere("pommel_glint", (-0.012, -0.016, -0.286), 0.010, glint)


def half_width(z):
    t = max(0.0, min(1.0, z / BLADE_LEN))
    return BLADE_HALF_W * max(1.0 - (t ** 1.7), 0.02)


def flame_volume(name, samples, width0, width1, material):
    verts = []
    count = len(samples)
    for i, (x, y, z) in enumerate(samples):
        t = i / (count - 1)
        w = width0 * (1.0 - t) + width1 * t
        d = max(w * 0.28, 0.004)
        verts.extend(
            (
                (x - w, y - d, z),
                (x + w, y - d, z),
                (x + w, y + d, z),
                (x - w, y + d, z),
            )
        )
    faces = [(0, 3, 2, 1)]
    for i in range(count - 1):
        a = i * 4
        b = (i + 1) * 4
        faces.extend(
            (
                (a, a + 1, b + 1, b),
                (a + 1, a + 2, b + 2, b + 1),
                (a + 2, a + 3, b + 3, b + 2),
                (a + 3, a, b, b + 3),
            )
        )
    last = (count - 1) * 4
    faces.append((last, last + 1, last + 2, last + 3))
    return mesh_object(name, verts, faces, material)


def tongue(side, z0, length, lean):
    pts = []
    steps = 6
    for i in range(steps):
        t = i / (steps - 1)
        z = z0 + length * (t ** 0.85)
        edge = half_width(min(z, BLADE_LEN)) * 0.35
        x = side * (edge + 0.012 + lean * t)
        pts.append((x, -0.02, z))
    return pts


def burst(phase, offset):
    """0 when this tongue is out, 1 at its peak. Peaks are spread around the loop."""
    return math.sin(((phase + offset) % 1.0) * math.pi) ** 2


def build_fire(frame_index):
    phase = (frame_index % LOOP) / LOOP
    hot = emit(f"fire_hot_{frame_index}", (0.82, 0.95, 1.0), 1.5)
    mid = emit(f"fire_mid_{frame_index}", (0.18, 0.55, 1.0), 1.25)
    deep = emit(f"fire_deep_{frame_index}", (0.05, 0.22, 0.82), 1.1)
    mote = emit(f"mote_{frame_index}", (0.25, 0.55, 1.0), 1.35)
    mote_hot = emit(f"mote_hot_{frame_index}", (0.75, 0.92, 1.0), 1.5)

    # Small tongues stay on the steel and only breathe. Nothing pops on or off,
    # so the blade itself does not appear to jump.
    tongues = [
        (-1, 0.00, 0.34, 0.045, 0.00, 0.026),
        (-1, 0.16, 0.26, 0.035, 0.18, 0.020),
        (-1, 0.36, 0.22, 0.030, 0.40, 0.016),
        (-1, 0.56, 0.18, 0.022, 0.62, 0.014),
        (-1, 0.76, 0.14, 0.018, 0.78, 0.012),
        (1, 0.04, 0.30, 0.040, 0.10, 0.024),
        (1, 0.22, 0.24, 0.032, 0.30, 0.018),
        (1, 0.42, 0.20, 0.026, 0.52, 0.016),
        (1, 0.62, 0.16, 0.020, 0.70, 0.013),
        (1, 0.82, 0.12, 0.016, 0.88, 0.011),
    ]
    for i, (side, z0, length, lean, offset, width) in enumerate(tongues):
        breathe = 0.72 + 0.28 * math.sin((phase + offset) * math.tau)
        flame_volume(
            f"out_{i}",
            tongue(side, z0, length * breathe, lean),
            width,
            width * 0.18,
            deep if i % 2 == 0 else mid,
        )
        flame_volume(
            f"core_{i}",
            tongue(side, z0 + 0.03, length * breathe * 0.62, lean * 0.45),
            width * 0.42,
            width * 0.1,
            hot if i % 3 == 0 else mid,
        )

    # A thin brighter lick travels up each edge, one after the other.
    for side, offset in ((-1, 0.0), (1, 0.5)):
        travel = (phase + offset) % 1.0
        flame_volume(
            f"lick_{side}",
            tongue(side, 0.05 + travel * 0.7, 0.16, 0.03),
            0.012,
            0.002,
            hot,
        )

    # Motes drift upward in a slow loop. They stay near the blade.
    for c in range(10):
        t = (phase * 0.65 + c / 10.0) % 1.0
        fade = math.sin(t * math.pi)
        if fade < 0.2:
            continue
        z = 0.08 + t * 1.15
        x = math.sin(c * 1.7) * (0.12 + t * 0.08)
        gem_sphere(
            f"mote_{c}",
            (x, -0.02, z),
            (0.012 if c % 3 else 0.008) * (0.6 + fade),
            mote if c % 2 == 0 else mote_hot,
        )


def look_at(obj, target):
    direction = (target - obj.location).normalized()
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def add_camera():
    data = bpy.data.cameras.new("cam")
    data.type = "ORTHO"
    data.ortho_scale = 2.55
    cam = bpy.data.objects.new("cam", data)
    bpy.context.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    dist = 4.4
    pitch = math.radians(12.0)
    target = Vector((0.0, 0.0, 0.40))
    cam.location = Vector((0.16, -dist * math.cos(pitch), target.z + dist * math.sin(pitch)))
    look_at(cam, target)


def add_lights():
    sun_data = bpy.data.lights.new("key", "SUN")
    sun_data.energy = 3.2
    sun_data.color = (1.0, 0.96, 0.88)
    sun = bpy.data.objects.new("key", sun_data)
    bpy.context.collection.objects.link(sun)
    sun.rotation_euler = (math.radians(42), math.radians(-18), math.radians(28))

    fill_data = bpy.data.lights.new("fill", "AREA")
    fill_data.energy = 180
    fill_data.color = (0.55, 0.72, 1.0)
    fill_data.size = 2.2
    fill = bpy.data.objects.new("fill", fill_data)
    bpy.context.collection.objects.link(fill)
    fill.location = (1.1, 1.5, 0.5)
    look_at(fill, Vector((0, 0, 0.4)))


def configure():
    scene = bpy.context.scene
    for name in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"):
        try:
            scene.render.engine = name
            break
        except TypeError:
            continue
    scene.render.resolution_x = 768
    scene.render.resolution_y = 1024
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    try:
        scene.view_settings.view_transform = "Standard"
    except TypeError:
        pass
    eevee = getattr(scene, "eevee", None)
    if eevee is not None and hasattr(eevee, "taa_render_samples"):
        eevee.taa_render_samples = 16
    world = bpy.data.worlds.new("world")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (0.02, 0.025, 0.04, 1)
        bg.inputs[1].default_value = 0.12


def render_one(frame_index, path):
    reset_scene()
    configure()
    build_sword()
    build_fire(frame_index)
    add_lights()
    add_camera()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print("RENDERED", path)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    argv = args_after()
    count = 12
    if "--frames" in argv:
        count = int(argv[argv.index("--frames") + 1])
    for i in range(count):
        render_one(i, os.path.join(OUT_DIR, f"raw_{i:02d}.png"))


if __name__ == "__main__":
    main()
