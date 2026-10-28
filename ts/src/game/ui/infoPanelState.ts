export class InfoPanelState {
  isOpen = false;

  open(): void {
    this.isOpen = true;
  }

  close(): boolean {
    const was = this.isOpen;
    this.isOpen = false;
    return was;
  }
}
