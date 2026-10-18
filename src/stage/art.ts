// Placeholder art for the M0 spike: Gloomdrawn sprites. Characters without art get a silhouette.
import kibaneBattle from '../../reference/legacy-sprites/kibane-battle.png';
import kibanePortrait from '../../reference/legacy-sprites/kibane-portrait.png';
import maeliaBattle from '../../reference/legacy-sprites/maelia-battle.png';
import maeliaPortrait from '../../reference/legacy-sprites/maelia-portrait.png';
import virelleBattle from '../../reference/legacy-sprites/virelle-battle.png';
import virellePortrait from '../../reference/legacy-sprites/virelle-portrait.png';

export const battleArt: Readonly<Record<string, string>> = {
  maelia: maeliaBattle,
  virelle: virelleBattle,
  kibane: kibaneBattle,
};

export const portraitArt: Readonly<Record<string, string>> = {
  maelia: maeliaPortrait,
  virelle: virellePortrait,
  kibane: kibanePortrait,
};
