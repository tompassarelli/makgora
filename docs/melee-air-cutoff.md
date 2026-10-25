# Airborne decay cutoff

An airborne launch slows by a fixed decay every frame; SmashWiki "Knockback"
gives 0.051 a frame for launch speed. Attacker recoil decays the same way by
Smashcraft's recoil decay in smashcraft:ts/src/game/sim/motion.ts, which no
public page states. Once the speed falls below its decay, the channel stops
instead of decaying past zero.

The simulation decides "below the decay" by comparing the rounded squared speed
with a derived binary32 boundary instead of calling Warcraft SquareRoot, so the
decision does not depend on the native square root. This covers these two
decays only; it does not replace all square roots.

The boundary must agree with a square root computed by reciprocal-square-root
estimate and Newton refinement.
[IBM's frsqrte instruction reference](https://www.ibm.com/docs/en/aix/7.2.0?topic=set-frsqrte-floating-reciprocal-square-root-estimate-instruction)
specifies an initial relative error of at most 1/32, permitting variation across
implementations. For relative estimate error e, an exact Newton step produces
`-1.5e² - 0.5e³`. With double unit roundoff u = 2^-53, an allowance of 8u per
step bounds the rounded operations: the squared estimate contributes at most
1.064u before subtraction, the fused correction remains between about 1.936
and 2.062, and the final multiplication adds less than 1.1u in normalized
error. Multiplication by 0.5 is exact. All these double intermediates remain
normal for positive finite binary32 squared speeds.

Starting at 1/32, conservative relative error bounds after three steps are
0.00149, 0.00000334, and 0.00000000001674. Including the final multiplication
leaves the relative square-root error below 0.00000000002. This argument uses
round-to-nearest, ties-to-even.

Let d be the binary32 decay, p its previous representable value, and
M = (d+p)/2. A rounded speed is below d precisely on the lower side of M.
For these two constants M² is not a binary32 value. The closest squared speeds
on each side of M² remain on their respective sides even after the full error
bound, by exact integer cross-products:

- `below × (1+E)² < M²`
- `above × (1-E)² > M²`

Here E = 1/50000000000. Since square root is monotonic and the bound applies
to every positive finite binary32 squared speed, farther inputs cannot cross
the cutoff either. Zero squared speed is below the boundary; an empty recoil
vector skips recoil processing entirely.

Both decays lie in [1/32,1/16), with spacing U = 2^-28.
The identity `M² = d×p + U²/4` permits one binary32 fused multiply-add.
For these two fixed values that result is the first representable squared
speed above M²; comparing squared speed strictly below it therefore implements
the decision. The launch boundary is 0.0026009997818619013. They are computed
once at package initialization. Using rounded d² instead would disagree near
the boundary. Changing either decay requires revisiting this bounded identity.

## State updates below the cutoff

Below its cutoff, the simulation clears vertical launch and horizontal attacker
recoil, leaving horizontal launch and vertical recoil unchanged, so launch's
branch clears both launch axes while recoil's has a cross-channel effect. It
updates launch before recoil and skips empty recoil vectors, avoiding
accidental suppression of ordinary launches. These stores are Smashcraft's
rule in motion.ts; no public page states Melee's.
