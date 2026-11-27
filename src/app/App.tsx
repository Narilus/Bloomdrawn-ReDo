import { CardGallery, galleryRequested } from './CardGallery.tsx';
import { Frame } from './Frame.tsx';
import { Gauntlet, gauntletRequested } from './Gauntlet.tsx';
import { Game } from './Title.tsx';

export function App() {
  return <Frame>{galleryRequested ? <CardGallery /> : gauntletRequested ? <Gauntlet /> : <Game />}</Frame>;
}
