/** Engine-derived Diablo I hero action timing. No reference-table rows are copied here. */
import type { ProjectRule } from '@/lib/catalog/canon/types';

export const DIABLO1_HERO_ANIMATION_LAWS: readonly ProjectRule[] = [
  {
    id: 'd1-hero-attack-timing-law',
    profile: 'diablo1',
    category: 'game',
    scope: 'characters',
    title: 'Attack timing by class and weapon',
    body: 'Hero attack timing, derived from the engine: class and weapon graphic supply frames and a one-based contact marker. The pre-advance handler hits at currentFrame == marker - 1, offset marker - 1 ticks, and ends at offset frames - 1 ticks. Quick, Fast, Faster and Fastest melee skip 1, 2, 3 and 4 initial frames from both offsets; vanilla bows skip 1 or 2 only for Quick or Fast. Base speed belongs to class and graphic.',
    refs: ['.reference/devilutionX/Source/player.cpp:174-228', '.reference/devilutionX/Source/player.cpp:778-901', '.reference/devilutionX/Source/player.cpp:2985-3072'],
  },
  {
    id: 'd1-hero-casting-timing-law',
    profile: 'diablo1',
    category: 'game',
    scope: 'characters',
    title: 'Casting timing',
    body: 'Hero casting timing, derived from the engine: fire, lightning and magic graphics use the class frame count and release marker. A cast starts after its mode check and advances in that same tick; DoSpell releases at currentFrame == marker, offset marker ticks, and ends when the last frame is active, offset frames - 1 ticks. Casting skips no frames, and attack-speed effects do not shorten it.',
    refs: ['.reference/devilutionX/Source/player.cpp:248-282', '.reference/devilutionX/Source/player.cpp:1007-1025', '.reference/devilutionX/Source/player.cpp:2985-3072'],
  },
  {
    id: 'd1-hero-block-timing-law',
    profile: 'diablo1',
    category: 'game',
    scope: 'characters',
    title: 'Block timing',
    body: 'Hero block timing, derived from the engine: the class table supplies the frame count and every nonfinal frame costs three game ticks. The final frame ends the mode before its delay, so elapsed duration is (frames - 1) * 3 + 1 ticks. Fast Block starts on the penultimate frame and therefore lasts 4 ticks. The class table has no block action marker.',
    refs: ['.reference/devilutionX/Source/player.cpp:951-959', '.reference/devilutionX/Source/player.cpp:2605-2623', '.reference/devilutionX/Source/engine/animationinfo.cpp:139-157'],
  },
];
