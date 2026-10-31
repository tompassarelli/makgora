


import { EDITBOX_CAPACITY, type EditboxFailure, EditboxSession, pauseLabel } from "../game/netcode/journal/editbox";
import { trampoline } from "wisp/src/platform/dispatch";
import { readChunk, writeLine } from "wisp/src/platform/fileio";
import { nativeChatFile } from "../game/core/gameFiles";
import { createEvents, onEvents } from "wisp/game/events";
import { addFrameEvent, createFrameByType, Frame, frameChild, frameChildCount, FrameEvent, frameName, FramePoint, frameText, frameTextLimit, frameVisible, originFrame, OriginFrame, setFrameAbsPoint, setFrameAlpha, setFrameFocus, setFrameSize, setFrameText, setFrameTextLimit, setFrameVisible } from "wisp/game/frames";
import { windowFocused } from "wisp/game/input";


export const EDITBOX_ENTER = "journal.editboxEnter";

// Warcraft 3.0 chat entry shape: recipient leaf plus four-child edit box whose first child has five.
function isChatEntry(frame: Frame): boolean {
  if (frameName(frame) !== "" || frameChildCount(frame) !== 2) return false;
  const label = frameChild(frame, 0);
  const entry = frameChild(frame, 1);
  if (frameName(label) !== "" || frameChildCount(label) !== 0) return false;
  if (frameName(entry) !== "" || frameChildCount(entry) !== 4) return false;
  const text = frameChild(entry, 0);
  return frameName(text) === "" && frameChildCount(text) === 5;
}


function chatEntry(gameUi: Frame): Frame | undefined {
  let found: Frame | undefined;
  const count = frameChildCount(gameUi);
  for (let index = 0; index < count; index++) {
    const candidate = frameChild(gameUi, index);
    if (!isChatEntry(candidate)) continue;
    if (found !== undefined) return undefined;
    found = candidate;
  }
  return found;
}

export function findWarcraftChat(): Frame | false {
  return chatEntry(originFrame(OriginFrame.gameUi, 0)) ?? false;
}

export function warcraftChatOpen(chat: Frame | false | undefined): boolean {
  return chat !== undefined && chat !== false && frameVisible(chat);
}






export class EditboxIngress {
  private readonly box: Frame;
  private readonly hint: Frame;
  private readonly chat: Frame | undefined;
  private session: EditboxSession | undefined;
  private observedChat: boolean | undefined;
  private chatEpoch: number | undefined;
  private chatRevision = 0;

  constructor() {
    const gameUi = originFrame(OriginFrame.gameUi, 0);
    this.chat = chatEntry(gameUi);
    this.box = createFrameByType("EDITBOX", "JournalControllerInput", gameUi, "EscMenuEditBoxTemplate", 969);
    setFrameAbsPoint(this.box, FramePoint.topLeft, 0.03999999910593033, 0.550000011920929);
    setFrameSize(this.box, 0.7200000286102295, 0.03500000014901161);
    setFrameTextLimit(this.box, EDITBOX_CAPACITY);
    setFrameAlpha(this.box, 0);
    setFrameVisible(this.box, false);
    this.hint = createFrameByType("TEXT", "JournalPauseHelp", gameUi, "", 970);
    setFrameAbsPoint(this.hint, FramePoint.topLeft, 0.6100000143051147, 0.49000000953674316);
    setFrameSize(this.hint, 0.15000000596046448, 0.02500000037252903);
    setFrameVisible(this.hint, false);
    const entered = createEvents();
    addFrameEvent(entered, this.box, FrameEvent.editboxEnter);
    onEvents(entered, trampoline(EDITBOX_ENTER));
  }

  private writeReceipt(session: EditboxSession): void {
    const { name, line } = session.receipt(this.chat !== undefined);
    writeLine(name, line);
  }


  private take(): void {
    setFrameText(this.box, "");
    setFrameVisible(this.box, true);
    setFrameFocus(this.box, true);
  }

  beginEpoch(build: string, epoch: number, slot: number): void {
    const session = new EditboxSession(build, epoch, slot, frameTextLimit(this.box));
    this.session = session;
    this.take();
    setFrameVisible(this.hint, true);
    this.writeReceipt(session);
  }

  endEpoch(): void {
    const { session } = this;
    if (session === undefined) return;
    this.writeReceipt(session);
    this.session = undefined;
    setFrameFocus(this.box, false);
    setFrameVisible(this.box, false);
    setFrameVisible(this.hint, false);
    setFrameText(this.box, "");
  }


  failure(): EditboxFailure | undefined {
    return this.session?.failure;
  }


  chatOpen(): boolean {
    return this.chat !== undefined && frameVisible(this.chat);
  }


  publishChat(build: string, slot: number, epoch: number | undefined): void {
    const open = this.chatOpen();
    const receiptEpoch = epoch ?? 0;
    if (this.observedChat === open && this.chatEpoch === receiptEpoch) return;
    this.observedChat = open;
    this.chatEpoch = receiptEpoch;
    this.chatRevision++;
    writeLine(nativeChatFile(build, slot), `SMASHCRAFT CHAT v=1 build=${build} slot=${slot} epoch=${receiptEpoch} revision=${this.chatRevision} available=${this.chat !== undefined ? 1 : 0} open=${open ? 1 : 0}`);
  }


  chatSerial(): number | undefined {
    return this.session?.chatSerial;
  }


  takePauseControls(): string {
    if (this.session?.chat !== "receiving" || !windowFocused()) return "";
    const text = frameText(this.box);
    let journal = "";
    let controls = "";
    let cursor = 0;
    while (cursor < text.length) {
      if (text.charAt(cursor) === "@") {
        const end = text.indexOf(";", cursor);
        if (end < 0) {
          journal += text.substring(cursor);
          break;
        }
        journal += text.substring(cursor, end + 1);
        cursor = end + 1;
      } else {
        const key = text.charAt(cursor);
        if ("ijklop-=g enu".includes(key)) controls += key;
        else journal += key;
        cursor++;
      }
    }
    if (journal !== text) setFrameText(this.box, journal);
    return controls;
  }






  peek(): string | undefined {
    const { session } = this;
    if (session === undefined || !session.receiving() || !windowFocused()) return undefined;
    const text = frameText(this.box);
    const rest = session.drain(text);
    if (rest !== text) setFrameText(this.box, rest);
    return session.failure === undefined ? session.stream.next() : undefined;
  }


  consumed(): boolean {
    return this.session?.consume() === true;
  }

  requestChat(serial: number): void {
    const { session } = this;
    if (session === undefined || !session.requestChat(serial)) return;
    setFrameFocus(this.box, true);
    this.writeReceipt(session);
  }





  serviceChat(paused: boolean): boolean {
    const { session, chat } = this;
    if (session === undefined) return false;
    switch (session.chat) {
      case "requested":

        if (!paused || readChunk(session.chatFile()) !== "Q") return false;
        setFrameFocus(this.box, false);
        setFrameVisible(this.box, false);
        session.chat = "released";
        break;
      case "released":
        if (chat === undefined || !frameVisible(chat)) return false;
        session.chat = "chatting";
        break;
      case "chatting":
        if (chat !== undefined && frameVisible(chat)) return false;
        this.take();
        session.chat = "receiving";
        this.writeReceipt(session);
        return true;
      case "receiving":
        return false;
    }
    this.writeReceipt(session);
    return false;
  }


  tick(): void {
    const { session } = this;
    if (session?.tick() === true) this.writeReceipt(session);
  }


  flushReceipt(): void {
    if (this.session !== undefined) this.writeReceipt(this.session);
  }

  updatePauseHint(paused: boolean, pending: boolean, targetPaused: boolean, hideHud: boolean): void {
    if (this.session === undefined) return;
    setFrameVisible(this.hint, !hideHud);
    setFrameText(this.hint, pauseLabel(this.session.chat, paused, pending, targetPaused));
  }
}
