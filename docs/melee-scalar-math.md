# Melee scalar approximation

`smashcraft:ts/src/game/core/math/meleeScalarMath.ts` supplies `meleeAtan2(y, x)`,
`meleeSin(angle)`, and `meleeCos(angle)`. Inputs and intermediate results use
explicit binary32 rounding and fused multiply-add. The implementation is
independently authored from numerical approximation facts and mathematical
equations. No external implementation code is reused.

Atan uses an odd polynomial, reciprocal reduction, and five tangent-subtraction
segments. Each segment stores a split denominator offset, split numerator, and
split angle correction. Sine and cosine use nearest-quadrant reduction followed
by interleaved even and odd polynomials. The small-residual cosine branch uses
the normalized residual directly, which matters at the vertical axes. Rounding
after individual reductions and additions is observable and intentional.

The supported sine/cosine domain is finite angles within
`[-float32(pi), float32(pi)]`, including angles returned by `meleeAtan2`.
`meleeAtan2` accepts finite vectors and keeps the sign of zero when choosing
the quadrant, as the C standard's atan2 does: atan2(-0, -1) is negative
float32(pi) and atan2(-0, +0) is negative half pi. Nonfinite inputs are outside
the claim; this is not a general replacement for all platform trigonometric
functions.
