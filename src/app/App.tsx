import { Frame } from './Frame.tsx';
import { Gauntlet, gauntletRequested } from './Gauntlet.tsx';
import { Labyrinth } from './Labyrinth.tsx';

export function App() {
  return <Frame>{gauntletRequested ? <Gauntlet /> : <Labyrinth />}</Frame>;
}
