// Battle art: Bloomdrawn picks from src/assets/battle (made with `npm run art -- pick`), plus
// Maelia's Gloomdrawn portrait as a placeholder. Characters without art
// get a silhouette. Keyed by character ID, or by enemy ID for enemies (who otherwise get a dummy).
import agatheBattle from '../assets/battle/agathe.png';
import antheBattle from '../assets/battle/anthe.png';
import houndBattle from '../assets/battle/bloom-rib-hound.png';
import leonoraBattle from '../assets/battle/leonora.png';
import maeliaBattle from '../assets/battle/maelia.png';
import maeliaPortrait from '../../reference/legacy-sprites/maelia-portrait.png';

export const battleArt: Readonly<Record<string, string>> = {
  agathe: agatheBattle,
  maelia: maeliaBattle,
  anthe: antheBattle,
  leonora: leonoraBattle,
  'enemy.bloom-rib-hound': houndBattle,
};

export const portraitArt: Readonly<Record<string, string>> = {
  maelia: maeliaPortrait,
};
