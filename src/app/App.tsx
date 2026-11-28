import { CardGallery, galleryRequested } from './CardGallery.tsx';
import { Frame } from './Frame.tsx';
import { Gauntlet, gauntletRequested } from './Gauntlet.tsx';
import { MapGallery, mapGalleryRequested } from './MapGallery.tsx';
import { Game } from './Title.tsx';

export function App() {
  return <Frame>{galleryRequested ? <CardGallery /> : mapGalleryRequested ? <MapGallery /> : gauntletRequested ? <Gauntlet /> : <Game />}</Frame>;
}
