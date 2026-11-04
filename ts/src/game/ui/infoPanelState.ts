export class InfoPanelState {
  isOpen = false;
  first = 0;

  constructor(private readonly maxFirst = 0) {}

  open(): void {
    this.isOpen = true;
    this.first = 0;
  }

  close(): boolean {
    const was = this.isOpen;
    this.isOpen = false;
    return was;
  }

  /** Moves the first shown line by `delta` lines within the body; whether it moved. */
  scroll(delta: number): boolean {
    const next = Math.min(this.maxFirst, Math.max(0, this.first + delta));
    const moved = next !== this.first;
    this.first = next;
    return moved;
  }
}
