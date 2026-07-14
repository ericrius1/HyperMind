import { buildScene, type SceneSeed } from '../sceneBuilder';

const seed: SceneSeed = {
  id: 'foliage',
  title: 'San Francisco Foliage Systems',
  shortTitle: 'Foliage',
  kicker: 'TREES · GRASS · LOD · TEXTURES · PERF',
  description:
    'How the San Francisco open-world foliage stack works: shared vegetation environment, compiled native trees, layered blade grass, KTX2 materials, LOD transitions, and the world systems they plug into.',
  palette: 'verdant',
  layout: 'clusters',
  shape: 'radial',
  clusters: [
    {
      name: 'Architecture',
      subclusters: [
        {
          id: 'shared-vegetation-runtime',
          label: 'Shared Vegetation Runtime',
          description:
            'One per-frame environment feeds wind, brightness, and ground displacers into every specialized foliage renderer instead of a single monolithic foliage engine.',
          concepts: [
            {
              title: 'Vegetation Environment Update',
              description:
                'updateVegetationEnvironment advances the shared wind clock, gusts, and ground displacers each frame. Trees, grass, flowers, and shrubs all read this environment rather than owning separate wind clocks.',
              tags: ['runtime', 'vegetation/runtime.ts', 'shared state'],
            },
            {
              title: 'Wind Uniforms and Gusts',
              description:
                'WIND_DIR, windStrength, windSpeed, and windGustGlobal live in vegetation/wind.ts and VEGETATION_TUNING. The same gust signal drives foliage shaders and nature wind audio so motion and sound stay coherent.',
              tags: ['wind', 'uniforms', 'tuning'],
            },
            {
              title: 'Foliage Brightness',
              description:
                'appearance.ts exposes foliageBrightness so leaf and grass response can be tuned globally without rewriting per-material constants. It pairs with MeshSSS translucency on close foliage.',
              tags: ['lighting', 'SSS', 'appearance'],
            },
            {
              title: 'Ground Displacers',
              description:
                'Up to 12 trample slots (x, z, radius, strength) bend grass and flowers around players and creatures. Displacers are environment state, not per-instance animation tracks.',
              tags: ['trample', 'displacers', 'interaction'],
            },
            {
              title: 'Cosmetic Visibility Gate',
              description:
                'FOLIAGE_TUNING.visible hard-hides all cosmetic foliage for A/B and perf isolation. Use it when measuring whether foliage is the frame-budget culprit without deleting systems.',
              tags: ['debug', 'config', 'A/B'],
            },
          ],
        },
        {
          id: 'renderers-and-sites',
          label: 'Renderers and Site Adapters',
          description:
            'Specialized renderers own look and streaming; site layouts own planting intent. Authored parks and procedural wildlands both funnel trees into NativeTreeForest.',
          concepts: [
            {
              title: 'NativeTreeForest',
              description:
                'The beauty-tree runtime: chunk residency, landscape/horizon batches, near canopy/grove rebin, lazy KTX2 leases, and shadow proxies. Almost every park and wild tree goes through createNativeTreeForest.',
              tags: ['trees', 'nativeTreeForest', 'instancing'],
            },
            {
              title: 'Tree Compiler',
              description:
                'Pure TS compileTree grows a deterministic skeleton then emits nested LOD meshes (branch + foliage interleaved buffers). Workers compile prototypes; templates.ts caches up to 48 per session.',
              tags: ['treeCompiler', 'recipes', 'prototypes'],
            },
            {
              title: 'Blade Grass Shared Look',
              description:
                'groundcover/bladeGrass.ts owns curved multi-blade and micro-blade geometry plus MeshSSSNodeMaterial. Wildlands and botanical garden share the look; each site owns placement and streaming.',
              tags: ['grass', 'bladeGrass', 'MeshSSS'],
            },
            {
              title: 'Site Layouts as Planting Intent',
              description:
                'wildlands/layout.ts, garden/layout.ts, and per-destination layouts emit slots, clearances, and avoid zones. Layouts decide where; forest and grass systems decide how far and how detailed.',
              tags: ['layout', 'wildlands', 'garden'],
            },
            {
              title: 'Lands End Cypress Exception',
              description:
                'landsEnd/cypress.ts is a legacy static icosahedron path outside NativeTreeForest. Treat it as a parallel visual hack, not the canonical native-tree architecture.',
              tags: ['exception', 'Lands End', 'legacy'],
            },
          ],
        },
      ],
    },
    {
      name: 'LODs',
      subclusters: [
        {
          id: 'tree-lod-grades',
          label: 'Tree LOD Grades',
          description:
            'Four monotonic compiler grades plus runtime chunk and near-rebin logic. Distant crowns are opaque geometry silhouettes—not billboard impostors.',
          concepts: [
            {
              title: 'Canopy Grove Landscape Horizon',
              description:
                'LOD indices 0–3: canopy and grove are near-detail textured grades; landscape and horizon are far silhouettes. Retention prunes branches/foliage monotonically so farther LODs never restore pruned structure.',
              tags: ['LOD', 'canopy', 'horizon', 'monotonic'],
            },
            {
              title: 'Silhouette Far Materials',
              description:
                'Landscape/horizon use MeshLambert with recipe palette colors, opaque, and no KTX2. This avoids alpha overdraw and texture traffic for distant forests while keeping real crown shape.',
              tags: ['silhouette', 'opaque', 'no impostors'],
            },
            {
              title: 'Near Rebin',
              description:
                'Closest trees detach into canopy/grove batches inside ~58 m (exit ~66 m, max ~24). Full detail packs load lazily; corresponding far slots hide after prepare so the tree does not double-draw.',
              tags: ['near rebin', 'detail', 'capacity'],
            },
            {
              title: 'Chunk Landscape Horizon Transition',
              description:
                'lodTransition.ts staggers landscape↔horizon with ~24 m width, ~14 m hysteresis, per-chunk lodBias, and per-slot lodRank so whole forests do not pop at one distance ring.',
              tags: ['lodTransition', 'hysteresis', 'population fade'],
            },
            {
              title: 'No Billboard Impostors',
              description:
                'The compiler and forest deliberately reject floating-leaf impostors. Support twigs stay real branch ancestry; far fill comes from pruned opaque clusters and foliageScale compensation.',
              tags: ['impostors', 'design choice', 'geometry LOD'],
            },
          ],
        },
        {
          id: 'grass-lod-layers',
          label: 'Grass Layers and Fade',
          description:
            'Wild grass is additive distance layers with rank-staggered extinction, not a single mesh swapping LODs.',
          concepts: [
            {
              title: 'Four Additive Grass Layers',
              description:
                'Wildlands far/mid/near/hero layers (≈110/60/26/12 m) stack rather than replace. Far uses micro blades and lite wind; hero uses curved blades with full wind and 12 displacer slots.',
              tags: ['grassField', 'layers', 'additive LOD'],
            },
            {
              title: 'Micro vs Curved Blades',
              description:
                'Micro blades are one-triangle silhouettes for cheap density at distance. Curved multi-blade clusters appear only in the hero ring where silhouette quality matters up close.',
              tags: ['micro blade', 'hero', 'geometry cost'],
            },
            {
              title: 'Rank Fade',
              description:
                'Streamed wild grass extinguishes whole blades via stable ranks instead of crawling dither. Fade bands (~8–18 m) keep streaming seams from shimmering as tiles load.',
              tags: ['rank fade', 'streaming', 'anti-crawl'],
            },
            {
              title: 'Density and Patchiness',
              description:
                'GRASS_TUNING.density and patchiness drive wildGrassLayerKeep with deterministic scatter (hash2, valueNoise). Spacing defaults around 0.68 m on the world grid.',
              tags: ['density', 'patchiness', 'scatter'],
            },
            {
              title: 'Botanical Near Detail Tiles',
              description:
                'Garden grass keeps a footprint base layer plus player-following near-detail tiles with meadow/path/tree clearance and slope cull. Same blade look, different residency model than wildlands rings.',
              tags: ['botanicalGrass', 'garden', 'near tiles'],
            },
          ],
        },
      ],
    },
    {
      name: 'Performance',
      subclusters: [
        {
          id: 'instancing-batching',
          label: 'Instancing, Batching, and Shadows',
          description:
            'Shared prototypes, compact instance attributes, and decoupled shadow proxies keep draw cost and LOD thrash under control.',
          concepts: [
            {
              title: 'Shared Immutable Prototypes',
              description:
                'Compiled tree geometries are shared across chunks and forests. Instance data is aTreeRoot + aTreeYaw StorageInstancedBufferAttributes—not full 4×4 matrices—so memory and upload stay compact.',
              tags: ['prototypes', 'StorageInstancedBufferAttribute', 'memory'],
            },
            {
              title: 'Compact Grass Instances',
              description:
                'Grass uses aGrassTransform + aGrassShape + aGrassColor (~36 bytes) instead of 96-byte matrices. Pipeline layout keys reuse compiled layouts across streamed tiles.',
              tags: ['grass instances', 'pipeline reuse', 'bytes'],
            },
            {
              title: 'Tree Shadow Proxies',
              description:
                'TreeShadowProxy draws shared unit trunk+crown (~66 tris) InstancedMeshes per 96 m cell on local+far shadow layers only. Beauty LOD thrash does not rewrite shadow casters every frame.',
              tags: ['shadows', 'proxy', 'decoupled'],
            },
            {
              title: 'Chunk Residency Rings',
              description:
                'Default chunk size ~176 m, visible ~520 m, with prefetch/visible/retire rings and hysteresis. Horizon switch sits around 58% of visible distance so far batches stay coarse.',
              tags: ['chunks', 'residency', 'hysteresis'],
            },
            {
              title: 'Texture Lease Caches',
              description:
                'Material-set leases are refcounted (roughly 16 materials / 64 textures). Horizon never leases packs; near detail only pulls KTX2 when canopy/grove batches need them.',
              tags: ['lease', 'cache', 'lazy load'],
            },
          ],
        },
        {
          id: 'streaming-budgets',
          label: 'Streaming and Frame Budgets',
          description:
            'Progressive grass work, cooperative yields, and lazy region activation protect the WebGPU frame budget.',
          concepts: [
            {
              title: 'Progressive Grass Streaming',
              description:
                'Wild grass sample → allocate → upload → publish runs under ~0.8 ms slice budgets with a frame scheduler. Critical nearest tiles publish first; outer rings continue after reveal.',
              tags: ['streaming', 'slice budget', 'scheduler'],
            },
            {
              title: 'Prepare Before Reveal',
              description:
                'Groundcover preparation registry admits tiles for pipeline compile before they become visible. Cooperative yieldToFrame keeps WebGPU compiles from hitching the main thread.',
              tags: ['prepare', 'WebGPU', 'compile'],
            },
            {
              title: 'Lazy Region Activation',
              description:
                'Wildlands and garden foliage can stay deferred until destinations need them. Tea Garden paths avoid waking the full Wildlands forest so local visits stay cheap.',
              tags: ['lazy load', 'destinations', 'Tea Garden'],
            },
            {
              title: 'Worker Tree Compile',
              description:
                'treeCompile.worker.ts compiles prototypes off the main thread. Session template cache avoids recompiling the same recipe/seed pairs during a play session.',
              tags: ['worker', 'compile', 'cache'],
            },
            {
              title: 'Job Retention Across Focus Moves',
              description:
                'Streaming jobs retain progress when the player focus moves slightly, so tiles near the previous ring do not restart from scratch and waste the slice budget.',
              tags: ['retention', 'focus', 'throughput'],
            },
          ],
        },
      ],
    },
    {
      name: 'Textures & Compression',
      subclusters: [
        {
          id: 'material-sets',
          label: 'Material Sets and Detail Grades',
          description:
            'Near trees lease four-map KTX2 sets; far trees never touch the manifest. Grass and flowers stay vertex-color SSS without foliage atlases.',
          concepts: [
            {
              title: 'Four-Map Material Sets',
              description:
                'Each native set: leaf-color (sRGB + cutout A), leaf-surface (N.xy, roughness, translucency), bark-color (sRGB), bark-surface (N.xy, roughness). Manifest keys are reusable IDs recipes request by name.',
              tags: ['material set', 'KTX2', 'manifest'],
            },
            {
              title: 'Near Mid Far Horizon Grades',
              description:
                'nativeTreeMaterials.ts defines four grades. Near/mid use textured MeshStandard/MeshSSS with alpha cutout; far/horizon stay opaque Lambert silhouettes without textures.',
              tags: ['grades', 'MeshSSS', 'cutout'],
            },
            {
              title: 'Shader-Owned vs Recipe-Owned Controls',
              description:
                'Manifest owns alphaCutoff, translucency, and twoSided. Geometry dimensions, wind stiffness, and bark UV scale belong to native tree recipes so texture tables do not duplicate plant parameters.',
              tags: ['ownership', 'recipes', 'shader controls'],
            },
            {
              title: 'Seasonal Variants',
              description:
                'Seasonal color variants are separate assets so they stay unloaded until selected. Content-digest filenames let immutable KTX2 stay cache-first while the manifest stays network-first.',
              tags: ['seasonal', 'cache', 'digest'],
            },
            {
              title: 'Grass Without Atlases',
              description:
                'Blade grass and flowers rely on vertex colors plus SSS. There is no shared foliage atlas for groundcover—density and color variation come from instance attributes and scatter.',
              tags: ['vertex color', 'no atlas', 'groundcover'],
            },
          ],
        },
        {
          id: 'ktx2-pipeline',
          label: 'KTX2 Pipeline and Codecs',
          description:
            'Procedural pixels bake through Sharp and toktx into a ~5.78 MiB public pack with UASTC/ETC1S choices tuned for cutout vs bark.',
          concepts: [
            {
              title: 'Build Native Foliage Textures',
              description:
                'npm run build:native-foliage-textures regenerates public/native-foliage/ and manifest.json from a deterministic procedural generator—no imported vendor art dependency.',
              tags: ['pipeline', 'build', 'procedural'],
            },
            {
              title: 'UASTC for Cutout and Normals',
              description:
                'Leaf color/surface and bark surface use UASTC + Zstd because cutout edges and packed normals show ETC1S artifacts. Larger on the wire, but GPU-native block compression avoids RGBA8 uploads.',
              tags: ['UASTC', 'Zstd', 'cutout'],
            },
            {
              title: 'ETC1S for Bark Color',
              description:
                'Bark albedo tolerates ETC1S well and stays much smaller. Hero trunks that show blocks can promote individual bark sets to UASTC without changing the whole pack contract.',
              tags: ['ETC1S', 'bark', 'size'],
            },
            {
              title: 'Mip Pyramid and Alpha Coverage',
              description:
                'Textures are 512² with a full 10-level mip pyramid, lower-left storage. Leaf mips preserve alpha coverage at the set cutoff so thin needles do not vanish under minification.',
              tags: ['mips', 'alpha coverage', '512'],
            },
            {
              title: 'Pinned Basis Transcoder',
              description:
                'Basis r185 worker/WASM ships under /native-foliage/basis-r185/ so loaders never depend on a bundler node_modules URL. detectSupport() picks BC/ETC2/ASTC; uncompressed fallback is a memory red flag.',
              tags: ['Basis', 'transcoder', 'GPU formats'],
            },
          ],
        },
      ],
    },
    {
      name: 'World Systems',
      subclusters: [
        {
          id: 'terrain-wind-interaction',
          label: 'Terrain, Wind, and Interaction',
          description:
            'Foliage seats on terrain, shares wind with audio, and responds to player/creature trampling.',
          concepts: [
            {
              title: 'fitGroundY Seating',
              description:
                'groundcover/grounding.ts samples terrain (often 5 points) to seat blades and cull steep slopes. Trees apply recipe sink so trunks bury into the ground instead of floating.',
              tags: ['terrain', 'fitGroundY', 'sink'],
            },
            {
              title: 'Shared Wind with Soundscape',
              description:
                'proceduralWind / nature soundscape reads the same windGustGlobal and WIND_DIR as shaders. Changing vegetation wind in the debug panel retunes both visuals and audio.',
              tags: ['wind audio', 'coherence', 'debug'],
            },
            {
              title: 'Trample Field',
              description:
                'setGroundDisplacers feeds player and creature positions into grass/flower bend. Interaction budget drops with grass distance layer (0 far → 12 hero) so only close blades pay the cost.',
              tags: ['trample', 'creatures', 'budget'],
            },
            {
              title: 'Flower Rings and Worley Clumps',
              description:
                'Wildflowers follow a player ring with Voronoi/worleyClump clustering and FLOWER_TUNING (density, clumpiness, reach ≤110 m). Garden flowers are authored patches on the same groundcover infra.',
              tags: ['flowers', 'worley', 'ring'],
            },
            {
              title: 'Authored Shrubs',
              description:
                'authoredShrubs.ts builds layered leaf-spray InstancedMesh shrubs that share vegetation wind but stay outside the native tree compiler path.',
              tags: ['shrubs', 'InstancedMesh', 'leaf spray'],
            },
          ],
        },
        {
          id: 'placement-collision-sites',
          label: 'Placement, Collision, and Sites',
          description:
            'Where foliage is allowed to exist, what collides, and how destinations schedule loading.',
          concepts: [
            {
              title: 'Wildlands Planting Vocabulary',
              description:
                'Groves, windrows, savannas, and flower drifts in wildlands/layout.ts place trees deterministically with avoid zones for bridges, Palace, tennis, and tea garden so foliage does not fight city props.',
              tags: ['groves', 'avoid zones', 'deterministic'],
            },
            {
              title: 'Garden Trunk Colliders',
              description:
                'Garden layouts add trunk box colliders and canopy BVH raycast proxies. Wildlands trees are primarily visual planting; shrubs and flora generally have no colliders.',
              tags: ['collision', 'BVH', 'garden'],
            },
            {
              title: 'Scatter Math',
              description:
                'groundcover/scatter.ts provides hash2, valueNoise, and worleyClump so density fields and clumps are stable across sessions and progressive streaming slices.',
              tags: ['scatter', 'hash', 'determinism'],
            },
            {
              title: 'Species Recipes and Controls',
              description:
                'nativeTreeRecipes.ts defines ~10 species with height, crownDensity, crownWidth, windResponse, and leafColorVariant. Designs map to compiled archetypes plus per-slot yaw/scale/dryness/palette.',
              tags: ['recipes', 'species', 'controls'],
            },
            {
              title: 'Debug Foliage Panel',
              description:
                'The `/` diagnostics panel exposes foliage on/off, grass density/patchiness, flower knobs, and vegetation wind—use it when validating LOD and budget changes in-world.',
              tags: ['debug', 'Tweakpane', 'validation'],
            },
          ],
        },
      ],
    },
  ],
  crossLinks: [
    ['Vegetation Environment Update', 'Wind Uniforms and Gusts'],
    ['Vegetation Environment Update', 'Shared Wind with Soundscape'],
    ['Ground Displacers', 'Trample Field'],
    ['NativeTreeForest', 'Canopy Grove Landscape Horizon'],
    ['NativeTreeForest', 'Chunk Residency Rings'],
    ['Tree Compiler', 'Shared Immutable Prototypes'],
    ['Tree Compiler', 'Worker Tree Compile'],
    ['Blade Grass Shared Look', 'Four Additive Grass Layers'],
    ['Blade Grass Shared Look', 'Compact Grass Instances'],
    ['Site Layouts as Planting Intent', 'Wildlands Planting Vocabulary'],
    ['Silhouette Far Materials', 'Near Mid Far Horizon Grades'],
    ['Near Rebin', 'Texture Lease Caches'],
    ['Near Rebin', 'Four-Map Material Sets'],
    ['Chunk Landscape Horizon Transition', 'Chunk Residency Rings'],
    ['No Billboard Impostors', 'Silhouette Far Materials'],
    ['Four Additive Grass Layers', 'Progressive Grass Streaming'],
    ['Rank Fade', 'Progressive Grass Streaming'],
    ['Micro vs Curved Blades', 'Compact Grass Instances'],
    ['Tree Shadow Proxies', 'Garden Trunk Colliders'],
    ['Four-Map Material Sets', 'Build Native Foliage Textures'],
    ['UASTC for Cutout and Normals', 'Near Mid Far Horizon Grades'],
    ['ETC1S for Bark Color', 'Four-Map Material Sets'],
    ['Pinned Basis Transcoder', 'Texture Lease Caches'],
    ['fitGroundY Seating', 'Botanical Near Detail Tiles'],
    ['Species Recipes and Controls', 'Shader-Owned vs Recipe-Owned Controls'],
    ['Lazy Region Activation', 'Site Layouts as Planting Intent'],
    ['Flower Rings and Worley Clumps', 'Scatter Math'],
    ['Cosmetic Visibility Gate', 'Debug Foliage Panel'],
  ],
  sources: [
    'sanfrancisco/src/world/vegetation/* — shared wind, tuning, appearance, authored adapters.',
    'sanfrancisco/src/world/nativeTreeForest/* — chunk residency, near rebin, LOD transition, shadow proxies.',
    'sanfrancisco/src/world/treeCompiler/* — deterministic skeleton, nested LOD meshes, wind attributes.',
    'sanfrancisco/src/world/groundcover/* — blade grass, sway, displacers, scatter, grounding.',
    'sanfrancisco/src/world/wildlands/* and garden/* — site planting, streamed grass, botanical detail.',
    'sanfrancisco/docs/NATIVE_FOLIAGE_TEXTURES.md — KTX2 packing, codecs, lease contract.',
    'sanfrancisco/docs/FOLIAGE_EPIC_HANDOFF.md — recent LOD, streaming, and perf notes.',
    'sanfrancisco/tools/build-native-foliage-textures.mjs — procedural → KTX2 bake.',
  ],
};

export const foliageScene = buildScene(seed);
