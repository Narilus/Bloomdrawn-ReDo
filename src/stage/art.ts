// Battle art: Bloomdrawn picks from src/assets/battle (made with `npm run art -- pick`), plus
// Gloomdrawn sprites as placeholders (Virelle, Kibane, and the portraits). Characters without art
// get a silhouette. The Bloom-Rib Hound's sprite waits for its enemy entry.
import agatheBattle from '../assets/battle/agathe.png';
import antheBattle from '../assets/battle/anthe.png';
import leonoraBattle from '../assets/battle/leonora.png';
import maeliaBattle from '../assets/battle/maelia.png';
import kibaneBattle from '../../reference/legacy-sprites/kibane-battle.png';
import kibanePortrait from '../../reference/legacy-sprites/kibane-portrait.png';
import maeliaPortrait from '../../reference/legacy-sprites/maelia-portrait.png';
import virelleBattle from '../../reference/legacy-sprites/virelle-battle.png';
import virellePortrait from '../../reference/legacy-sprites/virelle-portrait.png';

export const battleArt: Readonly<Record<string, string>> = {
  agathe: agatheBattle,
  maelia: maeliaBattle,
  anthe: antheBattle,
  leonora: leonoraBattle,
  virelle: virelleBattle,
  kibane: kibaneBattle,
};

export const portraitArt: Readonly<Record<string, string>> = {
  maelia: maeliaPortrait,
  virelle: virellePortrait,
  kibane: kibanePortrait,
};
