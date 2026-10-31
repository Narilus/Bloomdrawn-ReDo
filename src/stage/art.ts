// Battle art: Bloomdrawn picks from src/assets/battle (made with `npm run art -- pick`), plus
// Maelia's Gloomdrawn portrait as a placeholder. Characters without art
// get a silhouette. Keyed by character ID, or by enemy ID for enemies (who otherwise get a dummy).
import agatheBattle from '../assets/battle/agathe.png';
import antheBattle from '../assets/battle/anthe.png';
import hesterBattle from '../assets/battle/hester.png';
import isadoraBattle from '../assets/battle/isadora.png';
import kibaneBattle from '../assets/battle/kibane.png';
import houndBattle from '../assets/battle/bloom-rib-hound.png';
import whelpBattle from '../assets/battle/bloom-rib-whelp.png';
import acolyteBattle from '../assets/battle/censer-acolyte.png';
import hollowAbbessBattle from '../assets/battle/hollow-abbess.png';
import houndMotherBattle from '../assets/battle/hound-mother.png';
import surveyorBattle from '../assets/battle/lantern-surveyor.png';
import leonoraBattle from '../assets/battle/leonora.png';
import maeliaBattle from '../assets/battle/maelia.png';
import podThrowerBattle from '../assets/battle/pod-thrower.png';
import rootMatBattle from '../assets/battle/root-mat.png';
import rootSwornNoviceBattle from '../assets/battle/root-sworn-novice.png';
import seedlingBattle from '../assets/battle/seedling.png';
import matronBattle from '../assets/battle/thorn-wall-matron.png';
import virelleBattle from '../assets/battle/virelle.png';
import beeKnotBattle from '../assets/battle/bloom-bee-knot.png';
import gatheredBeastBattle from '../assets/battle/gathered-beast.png';
import heronStalkBattle from '../assets/battle/heron-stalk.png';
import hiveBearBattle from '../assets/battle/hive-bear.png';
import kitBattle from '../assets/battle/kit.png';
import litterMoundBattle from '../assets/battle/litter-mound.png';
import mothMantleBattle from '../assets/battle/moth-mantle.png';
import thornbackBoarBattle from '../assets/battle/thornback-boar.png';
import threeThroatedWolfBattle from '../assets/battle/three-throated-wolf.png';
import maeliaPortrait from '../../reference/legacy-sprites/maelia-portrait.png';

export const battleArt: Readonly<Record<string, string>> = {
  agathe: agatheBattle,
  maelia: maeliaBattle,
  anthe: antheBattle,
  leonora: leonoraBattle,
  virelle: virelleBattle,
  isadora: isadoraBattle,
  hester: hesterBattle,
  kibane: kibaneBattle,
  'enemy.bloom-rib-hound': houndBattle,
  'enemy.bloom-rib-whelp': whelpBattle,
  'enemy.censer-acolyte': acolyteBattle,
  // Full Bloom shares her sprite until Bloomed art exists.
  'enemy.hollow-abbess': hollowAbbessBattle,
  'enemy.hollow-abbess-full-bloom': hollowAbbessBattle,
  'enemy.hound-mother': houndMotherBattle,
  'enemy.lantern-surveyor': surveyorBattle,
  'enemy.pod-thrower': podThrowerBattle,
  'enemy.root-mat': rootMatBattle,
  'enemy.root-sworn-novice': rootSwornNoviceBattle,
  'enemy.seedling': seedlingBattle,
  'enemy.thorn-wall-matron': matronBattle,
  // Band 2, the Thicket.
  'enemy.heron-stalk': heronStalkBattle,
  'enemy.thornback-boar': thornbackBoarBattle,
  'enemy.moth-mantle': mothMantleBattle,
  'enemy.litter-mound': litterMoundBattle,
  'enemy.kit': kitBattle,
  'enemy.three-throated-wolf': threeThroatedWolfBattle,
  'enemy.hive-bear': hiveBearBattle,
  'enemy.bloom-bee-knot': beeKnotBattle,
  'enemy.gathered-beast': gatheredBeastBattle,
  'enemy.gathered-beast-full-bloom': gatheredBeastBattle,
};

export const portraitArt: Readonly<Record<string, string>> = {
  maelia: maeliaPortrait,
};
