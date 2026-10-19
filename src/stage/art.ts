// Battle art: Bloomdrawn picks from src/assets/battle (made with `npm run art -- pick`), plus
// Maelia's Gloomdrawn portrait as a placeholder. Characters without art
// get a silhouette. Keyed by character ID, or by enemy ID for enemies (who otherwise get a dummy).
import agatheBattle from '../assets/battle/agathe.png';
import antheBattle from '../assets/battle/anthe.png';
import houndBattle from '../assets/battle/bloom-rib-hound.png';
import whelpBattle from '../assets/battle/bloom-rib-whelp.png';
import acolyteBattle from '../assets/battle/censer-acolyte.png';
import houndMotherBattle from '../assets/battle/hound-mother.png';
import surveyorBattle from '../assets/battle/lantern-surveyor.png';
import leonoraBattle from '../assets/battle/leonora.png';
import maeliaBattle from '../assets/battle/maelia.png';
import podThrowerBattle from '../assets/battle/pod-thrower.png';
import rootMatBattle from '../assets/battle/root-mat.png';
import seedlingBattle from '../assets/battle/seedling.png';
import matronBattle from '../assets/battle/thorn-wall-matron.png';
import maeliaPortrait from '../../reference/legacy-sprites/maelia-portrait.png';

export const battleArt: Readonly<Record<string, string>> = {
  agathe: agatheBattle,
  maelia: maeliaBattle,
  anthe: antheBattle,
  leonora: leonoraBattle,
  'enemy.bloom-rib-hound': houndBattle,
  'enemy.bloom-rib-whelp': whelpBattle,
  'enemy.censer-acolyte': acolyteBattle,
  'enemy.hound-mother': houndMotherBattle,
  'enemy.lantern-surveyor': surveyorBattle,
  'enemy.pod-thrower': podThrowerBattle,
  'enemy.root-mat': rootMatBattle,
  'enemy.seedling': seedlingBattle,
  'enemy.thorn-wall-matron': matronBattle,
};

export const portraitArt: Readonly<Record<string, string>> = {
  maelia: maeliaPortrait,
};
