import { useEffect, useRef, useState, type ReactNode } from "react";
import { labelFor, type RoomConfig, type RoomView } from "../../lib/rooms";
import CopyButton from "../CopyButton";
import {
  ChatIcon,
  ChevronDownIcon,
  GlobeIcon,
  MapIcon,
  PhoneOffIcon,
  UsersIcon,
} from "../Icons";
import { LogoMark } from "../Logo";
import { MicButton } from "./AudioControls";
import RoomMenu from "./RoomMenu";

/**
 * Everything that used to be a banner, a header and three panels, as one slim floating bar.
 * Left: the room. Right: Chat, React | mic, the three-dot menu (People, sound, mini map, full screen), Leave.
 */
export default function RoomTopBar({
  room,
  config,
  mapTitle,
  count,
  unread,
  chatOpen,
  fullscreen,
  canFullscreen,
  onChat,
  onPeople,
  coarse,
  onFullscreen,
  onLeave,
  reactions,
  miniMap,
}: {
  room: RoomView;
  config: RoomConfig | null;
  mapTitle?: string;
  count: number;
  unread: number;
  chatOpen: boolean;
  fullscreen: boolean;
  canFullscreen: boolean;
  /** a finger, not a mouse: Leave asks for a second tap */
  coarse: boolean;
  onChat: () => void;
  onPeople: () => void;
  onFullscreen: () => void;
  onLeave: () => void;
  /** the React button and its panel; only rooms with a map have one */
  reactions?: ReactNode;
  /** only rooms with a map have a mini map */
  miniMap?: { visible: boolean; onToggle: () => void };
}) {
  const [info, setInfo] = useState(false);
  const [armed, setArmed] = useState(false);
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => void (armTimer.current && clearTimeout(armTimer.current)),
    [],
  );

  function leaveClicked() {
    if (!coarse || armed) return onLeave();
    // a thumb sliding between the icons must not drop someone out of a conversation
    setArmed(true);
    armTimer.current = setTimeout(() => setArmed(false), 3000);
  }
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!info) return;
    const onDown = (e: PointerEvent) =>
      !wrap.current?.contains(e.target as Node) && setInfo(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setInfo(false);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [info]);

  return (
    <div className="rbar">
      <div className="rbar-left" ref={wrap}>
        <button
          type="button"
          className="rpill"
          aria-expanded={info}
          aria-haspopup="dialog"
          onClick={() => setInfo((v) => !v)}
        >
          <LogoMark size={24} />
          <span className="rpill-title">{room.title}</span>
          <span className="rpill-count">
            <UsersIcon size={14} />
            {count}/{room.maxMembers}
          </span>
          <ChevronDownIcon size={15} className={info ? "flip" : ""} />
        </button>
        {info && (
          <div className="rinfo" role="dialog" aria-label="Room details">
            {room.shortDescription && (
              <p className="rinfo-desc">{room.shortDescription}</p>
            )}
            <div className="chips">
              <span className="chip">
                <GlobeIcon size={13} />
                {labelFor(config?.languages, room.language)}
              </span>
              <span className="chip chip-neutral">
                {labelFor(config?.purposes, room.purpose)}
              </span>
              {mapTitle && (
                <span className="chip chip-neutral">
                  <MapIcon size={13} />
                  {mapTitle}
                </span>
              )}
              {room.tags.map((t) => (
                <span key={t} className="chip chip-tag">
                  #{t}
                </span>
              ))}
            </div>
            <div className="rinfo-copy">
              <CopyButton value={room.id} label="Room ID" />
              {room.joinCode && (
                <CopyButton value={room.joinCode} label="Join code" />
              )}
            </div>
          </div>
        )}
      </div>

      <div className="rbar-right">
        <button
          type="button"
          className={`rbtn rbtn-chat ${chatOpen ? "is-on" : ""}`}
          aria-pressed={chatOpen}
          onClick={onChat}
        >
          <ChatIcon size={19} />
          <span className="rbtn-label">Chat</span>
          {unread > 0 && !chatOpen && (
            <span className="rbadge">{unread > 9 ? "9+" : unread}</span>
          )}
        </button>
        {reactions}
        <span className="rbar-sep" aria-hidden="true" />
        <MicButton />
        <RoomMenu
          count={count}
          onPeople={onPeople}
          miniMap={miniMap}
          canFullscreen={canFullscreen}
          fullscreen={fullscreen}
          onFullscreen={onFullscreen}
        />
        <button
          type="button"
          className={`rbtn rbtn-leave ${armed ? "is-armed" : ""}`}
          onClick={leaveClicked}
          aria-label={armed ? "Tap again to leave" : "Leave room"}
        >
          <PhoneOffIcon size={19} />
          <span className="rbtn-label">{armed ? "Tap again" : "Leave"}</span>
        </button>
      </div>
    </div>
  );
}
