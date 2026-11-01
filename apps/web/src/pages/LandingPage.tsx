import { useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { Link, Navigate } from "react-router";
import { LogoMark } from "../components/Logo";
import WorldView from "../components/landing/WorldView";
import type { HeardState } from "../components/landing/WorldView";
import {
  AUDIENCES,
  HELLOS,
  HERO_ACTORS,
  HERO_CAMERA,
  HERO_MAP,
  SCENES,
  TRUST,
} from "../components/landing/content";
import { useAuthStore } from "../store/auth.store";
import { loadWorldMap, listWorldMaps } from "../world/maps";
import { mapThumbnail } from "../world/thumbnail";
import "./landing.css";

/* ------------------------------------------------------------------ hero */

function Hero() {
  const [hud, setHud] = useState<HeardState>({ zone: null, heard: [] });
  const [touched, setTouched] = useState(false);
  return (
    <header className="lp-hero lp-tiled">
      <nav className="lp-wrap lp-nav" aria-label="Main">
        <a href="#top" className="lp-brand">
          <LogoMark size={34} />
          Talk Space
        </a>
        <div className="lp-navlinks">
          <a href="#how">How it sounds</a>
          <a href="#worlds">Worlds</a>
          <a href="#who">Who it’s for</a>
          <a href="#safety">Safety</a>
        </div>
        <div className="lp-navcta">
          <Link to="/auth" className="lp-login">
            Log in
          </Link>
          <Link to="/auth?mode=signup" className="lp-btn lp-btn-sm">
            Join a room
          </Link>
        </div>
      </nav>

      <div className="lp-wrap lp-herotop" id="top">
        <h1 className="lp-up">
          Walk over to a <u>conversation.</u>
        </h1>
        <div className="lp-herointro lp-up lp-d1">
          <p>
            Talk Space is a voice room you can walk around in. Stand near
            someone and you hear them. Wander off and they fade out, the way a
            party works. No cameras, and no one talking over everyone.
          </p>
          <div className="lp-actions">
            <Link to="/auth?mode=signup" className="lp-btn lp-btn-brand">
              Create your account
            </Link>
            <a href="#how" className="lp-btn">
              See how it sounds
            </a>
          </div>
          <p className="lp-facts">
            Up to 8 per room · 18 languages · Voice and text chat · Works on
            phones
          </p>
        </div>
      </div>

      <div className="lp-wrap lp-up lp-d2">
        <div className="lp-frame lp-window">
          <WorldView
            className="lp-canvas"
            mapKey={HERO_MAP}
            camera={HERO_CAMERA}
            actors={HERO_ACTORS}
            followYou
            rings
            zones
            steer
            onHeard={setHud}
            onInteract={() => setTouched(true)}
            label="A live Talk Space room. Move your mouse, tap, or use the arrow keys to walk around and watch people get louder or quieter."
          />
          <span className="lp-tag">
            {touched
              ? "Keep walking. Try the campfire."
              : "A real room. Move your mouse to walk."}
          </span>
          <div className="lp-hud" aria-live="off">
            <span className="lp-hud-ico" aria-hidden="true" />
            <span className="lp-hud-text">
              <b>{hud.zone ?? "Open area"}</b>
              <small>
                {hud.heard.length
                  ? `${hud.heard.length} in earshot`
                  : "No one in earshot"}
              </small>
            </span>
            <span className="lp-stack" aria-hidden="true">
              {hud.heard.slice(0, 3).map((h) => (
                <i key={h.id} style={{ background: h.color }}>
                  {h.name[0]}
                </i>
              ))}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------- scroll story */

function Story() {
  const [step, setStep] = useState(0);
  const steps = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting)
            setStep(Number((e.target as HTMLElement).dataset.i));
      },
      { rootMargin: "-42% 0px -42% 0px" },
    );
    steps.current.forEach((n) => n && io.observe(n));
    return () => io.disconnect();
  }, []);

  const scene = SCENES[Math.min(step, SCENES.length - 1)]!;
  return (
    <section className="lp-sec lp-meadow lp-tiled" id="how">
      <div className="lp-wrap">
        <h2 className="lp-h2" data-reveal>
          A room that works like a room.
        </h2>
        <div className="lp-scroll">
          <div className="lp-steps">
            {SCENES.map((s, i) => (
              <article
                key={s.title}
                data-i={i}
                ref={(el) => {
                  steps.current[i] = el;
                }}
                className={step === i ? "lp-step is-on" : "lp-step"}
              >
                <span className="lp-stepno">0{i + 1}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </article>
            ))}
          </div>
          <div className="lp-stagecol">
            <div className="lp-frame lp-stagebox">
              <WorldView
                className="lp-canvas"
                mapKey={HERO_MAP}
                camera={scene.camera}
                actors={scene.actors}
                rings
                zones={step === 2}
                activeZone={scene.activeZone}
                label="A demonstration of how volume depends on distance and zones. People walk to new places as you scroll."
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ worlds */

function Worlds() {
  const items = useMemo(() => {
    const out: {
      key: string;
      title: string;
      blurb: string;
      zones: string[];
      img: string | null;
    }[] = [];
    for (const m of listWorldMaps()) {
      const map = loadWorldMap(m.key);
      if (!map) continue;
      out.push({
        key: map.key,
        title: map.title,
        blurb: map.description ?? "",
        zones: map.zones.map((z) => z.name),
        img: mapThumbnail(map, 1200),
      });
    }
    return out;
  }, []);
  return (
    <section className="lp-sec lp-sand lp-tiled" id="worlds">
      <div className="lp-wrap">
        <div className="lp-split" data-reveal>
          <h2 className="lp-h2">Pick a place, not a call.</h2>
          <p className="lp-sub">
            Every world has its own corners to talk in. These pictures come from
            the same engine you’ll walk around in.
          </p>
        </div>
        <div className="lp-gallery">
          {items.map((w, i) => (
            <figure
              key={w.key}
              className={`lp-world lp-world-${i % 4}`}
              data-reveal
            >
              <div className="lp-frame lp-worldimg">
                {w.img && (
                  <img
                    src={w.img}
                    alt={`Map of ${w.title}`}
                    loading="lazy"
                    draggable={false}
                  />
                )}
              </div>
              <figcaption>
                <h3>{w.title}</h3>
                <p>{w.blurb}</p>
                <span>{w.zones.join(" · ")}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------- page */

function useReveal(root: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (
      !el ||
      !("IntersectionObserver" in window) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    el.classList.add("lp-ready");
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("lp-in");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.12 },
    );
    el.querySelectorAll<HTMLElement>("[data-reveal]").forEach((n) =>
      io.observe(n),
    );
    return () => io.disconnect();
  }, [root]);
}

export default function LandingPage() {
  const root = useRef<HTMLDivElement>(null);
  const user = useAuthStore((s) => s.user);
  useReveal(root);

  const ctaImg = useMemo(() => {
    const m = loadWorldMap("beach");
    return m ? mapThumbnail(m, 1200) : null;
  }, []);

  // Signed-in people go straight to their rooms. Everyone else sees the page at once (no loading splash).
  if (user) return <Navigate to="/home" replace />;

  return (
    <div className="lp" ref={root}>
      <Hero />

      <section className="lp-hello" aria-label="Hello in 18 languages">
        <div className="lp-hello-track">
          {[0, 1].map((copy) => (
            <span
              key={copy}
              className="lp-hello-set"
              aria-hidden={copy === 1 ? true : undefined}
            >
              {HELLOS.map((h) => (
                <span key={h}>{h}</span>
              ))}
            </span>
          ))}
        </div>
      </section>

      <Story />
      <Worlds />

      <section className="lp-sec lp-sky lp-tiled" id="who">
        <div className="lp-wrap lp-whogrid">
          <div className="lp-whohead" data-reveal>
            <h2 className="lp-h2">
              Whatever you came to say, there’s a room for it.
            </h2>
            <p className="lp-sub">
              Not sure yet? Walk in and listen first. Nobody minds.
            </p>
          </div>
          <ul className="lp-rows">
            {AUDIENCES.map((a) => (
              <li key={a.title} className="lp-row" data-reveal>
                <h3>{a.title}</h3>
                <p>{a.text}</p>
                <small>{a.tags}</small>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="lp-sec lp-ink" id="safety">
        <div className="lp-wrap lp-safegrid">
          <h2 className="lp-h2" data-reveal>
            What happens to your voice.
          </h2>
          <div className="lp-safe">
            {TRUST.map((t) => (
              <div key={t.title} data-reveal>
                <h3>{t.title}</h3>
                <p>{t.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        className="lp-cta"
        style={ctaImg ? { backgroundImage: `url(${ctaImg})` } : undefined}
      >
        <div className="lp-wrap">
          <div className="lp-frame lp-ctabox" data-reveal>
            <h2>Go find a conversation.</h2>
            <p>
              Make an account, pick a name and walk in. Someone’s probably
              already talking.
            </p>
            <div className="lp-actions">
              <Link
                to="/auth?mode=signup"
                className="lp-btn lp-btn-brand lp-btn-lg"
              >
                Create your account
              </Link>
              <Link to="/auth" className="lp-btn lp-btn-lg">
                Log in
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="lp-foot">
        <div className="lp-wrap">
          <span className="lp-brand lp-brand-sm">
            <LogoMark size={26} />
            Talk Space
          </span>
          <span>The closer you stand, the clearer you hear.</span>
          <span className="lp-footlinks">
            <a href="#how">How it sounds</a>
            <a href="#safety">Safety</a>
            <Link to="/auth">Log in</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
