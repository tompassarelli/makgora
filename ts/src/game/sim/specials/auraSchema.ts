/** While on, foes within `radius` take `damage` every `every` frames and run at `slowScale` for `slowFrames`; its user takes `selfDamage` every `selfEvery`. */
export interface ToggleAura<Patch> { readonly frame: number; readonly radius: number; readonly every: number; readonly damage: number; readonly slowScale: number; readonly slowFrames: number; readonly selfEvery: number; readonly selfDamage: number; readonly trail?: AuraTrail<Patch> | undefined }

export interface AuraTrail<Patch> { readonly patch: Patch; readonly every: number; readonly minTravel: number; readonly limit: number }
