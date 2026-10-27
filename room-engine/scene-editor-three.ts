import * as THREE from 'three';

/** Actual engine constructors, explicitly limited to official UI/TransformControls/GLTF needs.
 * No second Three import graph and no editor or addon implementation on startup. */
export function sceneEditorThree() {
  return {
    REVISION: THREE.REVISION, Scene: THREE.Scene, Camera: THREE.Camera,
    AnimationClip: THREE.AnimationClip, AnimationMixer: THREE.AnimationMixer,
    Bone: THREE.Bone, Box3: THREE.Box3, BoxGeometry: THREE.BoxGeometry,
    BufferAttribute: THREE.BufferAttribute, BufferGeometry: THREE.BufferGeometry,
    ClampToEdgeWrapping: THREE.ClampToEdgeWrapping, Color: THREE.Color, ColorManagement: THREE.ColorManagement,
    Controls: THREE.Controls, CylinderGeometry: THREE.CylinderGeometry, DirectionalLight: THREE.DirectionalLight,
    DoubleSide: THREE.DoubleSide, Euler: THREE.Euler, FileLoader: THREE.FileLoader,
    Float32BufferAttribute: THREE.Float32BufferAttribute, FrontSide: THREE.FrontSide,
    Group: THREE.Group, ImageBitmapLoader: THREE.ImageBitmapLoader, InstancedMesh: THREE.InstancedMesh,
    InstancedBufferAttribute: THREE.InstancedBufferAttribute, InterleavedBuffer: THREE.InterleavedBuffer,
    InterleavedBufferAttribute: THREE.InterleavedBufferAttribute, Interpolant: THREE.Interpolant,
    InterpolateDiscrete: THREE.InterpolateDiscrete, InterpolateLinear: THREE.InterpolateLinear,
    Line: THREE.Line, LineBasicMaterial: THREE.LineBasicMaterial, LineLoop: THREE.LineLoop, LineSegments: THREE.LineSegments,
    LinearFilter: THREE.LinearFilter, LinearMipmapLinearFilter: THREE.LinearMipmapLinearFilter,
    LinearMipmapNearestFilter: THREE.LinearMipmapNearestFilter, LinearSRGBColorSpace: THREE.LinearSRGBColorSpace,
    Loader: THREE.Loader, LoaderUtils: THREE.LoaderUtils, LoadingManager: THREE.LoadingManager,
    Material: THREE.Material, MathUtils: THREE.MathUtils, Matrix4: THREE.Matrix4,
    Mesh: THREE.Mesh, MeshBasicMaterial: THREE.MeshBasicMaterial, MeshPhysicalMaterial: THREE.MeshPhysicalMaterial,
    MeshStandardMaterial: THREE.MeshStandardMaterial, MirroredRepeatWrapping: THREE.MirroredRepeatWrapping,
    NearestFilter: THREE.NearestFilter, NearestMipmapLinearFilter: THREE.NearestMipmapLinearFilter,
    NearestMipmapNearestFilter: THREE.NearestMipmapNearestFilter, NumberKeyframeTrack: THREE.NumberKeyframeTrack,
    Object3D: THREE.Object3D, OctahedronGeometry: THREE.OctahedronGeometry, OrthographicCamera: THREE.OrthographicCamera,
    PerspectiveCamera: THREE.PerspectiveCamera, PlaneGeometry: THREE.PlaneGeometry, PointLight: THREE.PointLight,
    Points: THREE.Points, PointsMaterial: THREE.PointsMaterial, PropertyBinding: THREE.PropertyBinding,
    Quaternion: THREE.Quaternion, QuaternionKeyframeTrack: THREE.QuaternionKeyframeTrack, Raycaster: THREE.Raycaster,
    RepeatWrapping: THREE.RepeatWrapping, Skeleton: THREE.Skeleton, SkeletonHelper: THREE.SkeletonHelper,
    SkinnedMesh: THREE.SkinnedMesh, Sphere: THREE.Sphere, SphereGeometry: THREE.SphereGeometry,
    SpotLight: THREE.SpotLight, Texture: THREE.Texture, TextureLoader: THREE.TextureLoader,
    TorusGeometry: THREE.TorusGeometry, TriangleFanDrawMode: THREE.TriangleFanDrawMode,
    TriangleStripDrawMode: THREE.TriangleStripDrawMode, TrianglesDrawMode: THREE.TrianglesDrawMode,
    Vector2: THREE.Vector2, Vector3: THREE.Vector3, VectorKeyframeTrack: THREE.VectorKeyframeTrack,
    SRGBColorSpace: THREE.SRGBColorSpace,
  };
}
export type SceneEditorRuntime = ReturnType<typeof sceneEditorThree>;
