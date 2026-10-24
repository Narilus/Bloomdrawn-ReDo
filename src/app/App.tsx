import { Frame } from './Frame.tsx';
import { Gauntlet, gauntletRequested } from './Gauntlet.tsx';
import { Game } from './Title.tsx';

export function App() {
  return <Frame>{gauntletRequested ? <Gauntlet /> : <Game />}</Frame>;
}
