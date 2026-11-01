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
import cartographerBattle from '../assets/battle/cartographer.png';
import cocoonedScoutBattle from '../assets/battle/cocooned-scout.png';
import expeditionLeaderBattle from '../assets/battle/expedition-leader.png';
import fieldSurgeonBattle from '../assets/battle/field-surgeon.png';
import packPorterBattle from '../assets/battle/pack-porter.png';
import quartermasterBattle from '../assets/battle/quartermaster.png';
import tentWalkerBattle from '../assets/battle/tent-walker.png';
import crownedPistilBattle from '../assets/battle/crowned-pistil.png';
import gardenerBattle from '../assets/battle/gardener.png';
import pollenQueenBattle from '../assets/battle/pollen-queen.png';
import pollinatorBattle from '../assets/battle/pollinator.png';
import seedBladderBattle from '../assets/battle/seed-bladder.png';
import stiltGrazerBattle from '../assets/battle/stilt-grazer.png';
import weaverBattle from '../assets/battle/weaver.png';
import blossomDevourerBattle from '../assets/battle/blossom-devourer.png';
import gardenHuskBattle from '../assets/battle/garden-husk.png';
import petalHorrorBattle from '../assets/battle/petal-horror.png';
import graftedStagBattle from '../assets/battle/grafted-stag.png';
import seedMotherBattle from '../assets/battle/seed-mother.png';
import motherRootBattle from '../assets/battle/mother-root.png';
import openHeartedQueenBattle from '../assets/battle/open-hearted-queen.png';
import heartBudBattle from '../assets/battle/heart-bud.png';
import grandAnatomistBattle from '../assets/battle/grand-anatomist.png';
import veiledHierophantBattle from '../assets/battle/veiled-hierophant.png';
import raisedLimbBattle from '../assets/battle/raised-limb.png';
import kirinOracleBattle from '../assets/battle/kirin-oracle.png';
import paperTalismanBattle from '../assets/battle/paper-talisman.png';
import ringmasterBattle from '../assets/battle/ringmaster.png';
import marionetteBattle from '../assets/battle/marionette.png';
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
  // Band 3, the Lost Expedition.
  'enemy.pack-porter': packPorterBattle,
  'enemy.field-surgeon': fieldSurgeonBattle,
  'enemy.cartographer': cartographerBattle,
  'enemy.tent-walker': tentWalkerBattle,
  'enemy.quartermaster': quartermasterBattle,
  'enemy.cocooned-scout': cocoonedScoutBattle,
  'enemy.expedition-leader': expeditionLeaderBattle,
  'enemy.expedition-leader-full-bloom': expeditionLeaderBattle,
  // Band 4, the Calyx.
  'enemy.pollinator': pollinatorBattle,
  'enemy.attending-pollinator': pollinatorBattle,
  'enemy.flanking-pollinator': pollinatorBattle,
  'enemy.gardener': gardenerBattle,
  'enemy.stilt-grazer': stiltGrazerBattle,
  'enemy.seed-bladder': seedBladderBattle,
  'enemy.weaver': weaverBattle,
  'enemy.pollen-queen': pollenQueenBattle,
  'enemy.crowned-pistil': crownedPistilBattle,
  'enemy.crowned-pistil-full-bloom': crownedPistilBattle,
  'enemy.blossom-devourer': blossomDevourerBattle,
  'enemy.garden-husk': gardenHuskBattle,
  'enemy.sown-husk': gardenHuskBattle,
  'enemy.petal-horror': petalHorrorBattle,
  'enemy.grown-petal-horror': petalHorrorBattle,
  'enemy.grafted-stag': graftedStagBattle,
  'enemy.seed-mother': seedMotherBattle,
  'enemy.mother-root': motherRootBattle,
  'enemy.mother-root-full-bloom': motherRootBattle,
  'enemy.open-hearted-queen': openHeartedQueenBattle,
  'enemy.open-hearted-queen-full-bloom': openHeartedQueenBattle,
  'enemy.heart-bud': heartBudBattle,
  'enemy.grand-anatomist': grandAnatomistBattle,
  'enemy.veiled-hierophant': veiledHierophantBattle,
  'enemy.raised-limb': raisedLimbBattle,
  'enemy.kirin-oracle': kirinOracleBattle,
  'enemy.paper-talisman': paperTalismanBattle,
  'enemy.ringmaster': ringmasterBattle,
  'enemy.marionette': marionetteBattle,
};

export const portraitArt: Readonly<Record<string, string>> = {
  maelia: maeliaPortrait,
};
