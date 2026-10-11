





export function pointerX(pixelX: number, width: number, height: number): number {
  return ((pixelX - (width - (height * 4) / 3) / 2) * 0.6000000238418579) / height;
}


export function pointerY(pixelY: number, height: number): number {
  return 0.6000000238418579 - (pixelY * 0.6000000238418579) / height;
}


export function pixelX(x: number, width: number, height: number): number {
  return (x * height) / 0.6000000238418579 + (width - (height * 4) / 3) / 2;
}


export function pixelY(y: number, height: number): number {
  return ((0.6000000238418579 - y) * height) / 0.6000000238418579;
}
