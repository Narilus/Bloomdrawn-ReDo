import type { Registry, ResourceDef } from './defs.ts';

/** A Domain resource's definition, from whichever Domain declares it. */
export const resourceDef = (registry: Registry, id: string): ResourceDef | undefined =>
  Object.values(registry.domains)
    .flatMap((d) => d.resources)
    .find((r) => r.id === id);
