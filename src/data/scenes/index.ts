import type { GraphScene } from '../../core/types';
import { francisScene } from './francis';
import { kabbalahScene } from './kabbalah';
import { pilgrimScene } from './pilgrim';
import { tutorialScene } from './tutorial';

export const SCENES: readonly GraphScene[] = [tutorialScene, kabbalahScene, francisScene, pilgrimScene];
export const SCENES_BY_ID: ReadonlyMap<string, GraphScene> = new Map(SCENES.map((scene) => [scene.id, scene]));

export function getScene(id: string): GraphScene {
  return SCENES_BY_ID.get(id) ?? tutorialScene;
}
