import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import {
  ArrowRight,
  BookOpen,
  Bookmark,
  BrainCircuit,
  ChevronDown,
  CircleHelp,
  Compass,
  FileText,
  Heart,
  LibraryBig,
  Microscope,
  NotebookPen,
  Play,
  Search,
  Share2,
  Sparkles,
  Stethoscope,
  X,
} from "lucide-react";
import { OrganViewer } from "./OrganViewer";
import { organById, organs, categories, type Organ, type OrganId, type CategoryId } from "../../lib/anatomy/anatomy-data";

type Modal = "lesson" | "quiz" | "animation" | "system" | null;

function OrganArt({
  organ,
  asset,
  alt,
  size,
}: {
  organ: Organ;
  asset: "thumb" | "organ" | "microscopic" | "compare" | "location";
  alt: string;
  size?: number;
}) {
  if (!organ.illustrated) {
    const labelling = alt ? { role: "img", "aria-label": alt } : { "aria-hidden": true };
    return (
      <span className="anat-art-fallback" style={{ "--art-accent": organ.accent } as React.CSSProperties} {...labelling}>
        {organ.icon}
      </span>
    );
  }
  return (
    <img
      key={`${organ.id}-${asset}`}
      src={`/anatomy/${organ.id}/${asset}.webp`}
      alt={alt}
      width={size}
      height={size}
      loading={asset === "thumb" ? "eager" : "lazy"}
      decoding="async"
    />
  );
}

export function AnatomyApp() {
  const [organId, setOrganId] = useState<OrganId>("heart");
  const [autoRotate, setAutoRotate] = useState(true);
  const [compare, setCompare] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [query, setQuery] = useState("");
  const [mobileLibrary, setMobileLibrary] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<CategoryId>>(new Set());
  const contentRef = useRef<HTMLDivElement>(null);
  const prefetched = useRef(new Set<OrganId>());
  const organ = organById[organId];
  const reference = organById[organId === "heart" ? "brain" : "heart"];
  const filteredOrgans = useMemo(
    () => organs.filter((item) => `${item.name} ${item.system}`.toLowerCase().includes(query.toLowerCase())),
    [query],
  );

  const groupedOrgans = useMemo(() => {
    const groups: { category: typeof categories[number]; organs: Organ[] }[] = [];
    for (const cat of categories) {
      const catOrgans = filteredOrgans.filter((o) => o.categoryId === cat.id);
      if (catOrgans.length > 0) {
        groups.push({ category: cat, organs: catOrgans });
      }
    }
    return groups;
  }, [filteredOrgans]);

  const toggleCategory = (id: CategoryId) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    if (!contentRef.current) return;
    gsap.fromTo(contentRef.current.querySelectorAll("[data-reveal]"),
      { opacity: 0, y: 8 },
      { opacity: 1, y: 0, duration: 0.48, stagger: 0.035, ease: "power2.out", overwrite: true },
    );
  }, [organId]);

  const selectOrgan = (id: OrganId) => {
    if (organById[id].illustrated) {
      ["organ", "microscopic", "compare", "location"].forEach((asset) => {
        const image = new Image();
        image.src = `/anatomy/${id}/${asset}.webp`;
      });
    }
    setOrganId(id);
    setMobileLibrary(false);
    setCompare(false);
  };

  const prefetchOrgan = (id: OrganId) => {
    if (id === organId || prefetched.current.has(id)) return;
    prefetched.current.add(id);
    void fetch(organById[id].model, { priority: "low" } as RequestInit).catch(() => {});
  };

  return (
    <main className="anat-app-shell">
      <header className="anat-topbar">
        <button className="anat-brand" type="button" onClick={() => selectOrgan("heart")} aria-label="Anatomy home">
          <strong>Anatomy Atelier<sup>✦</sup></strong>
          <em>Learn anatomy like an artist</em>
        </button>
        <nav className="anat-main-nav" aria-label="Primary navigation">
          <button className="active"><Compass size={17} /> Explore</button>
          <button><BrainCircuit size={17} /> Systems</button>
          <button onClick={() => setModal("lesson")}><BookOpen size={17} /> Lessons</button>
          <button><LibraryBig size={17} /> Library</button>
          <button><NotebookPen size={17} /> Notes</button>
        </nav>
        <label className="anat-search-box">
          <Search size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search organs, topics…" />
        </label>
        <button className="anat-profile" aria-label="Open learner profile"><span>MA</span><ChevronDown size={15} /></button>
        <button className="anat-mobile-library-trigger" onClick={() => setMobileLibrary(true)} aria-label="Open organ library"><LibraryBig size={20} /></button>
      </header>

      <div className="anat-workspace">
        <aside className={`anat-organ-library ${mobileLibrary ? "open" : ""}`}>
          <div className="anat-panel-heading">
            <span>Organ library</span>
            <button aria-label="Close library" className="anat-mobile-close" onClick={() => setMobileLibrary(false)}><X size={17} /></button>
            <button aria-label="Saved organs"><Bookmark size={17} /></button>
          </div>
          <div className="anat-organ-list">
            {groupedOrgans.map(({ category, organs: catOrgans }) => (
              <div key={category.id} className="anat-category-group">
                <button
                  type="button"
                  className={`anat-category-header ${expandedCategories.has(category.id) ? "expanded" : ""}`}
                  onClick={() => toggleCategory(category.id)}
                  style={{ "--cat-color": category.color } as React.CSSProperties}
                >
                  <span className="anat-category-icon">{category.icon}</span>
                  <span className="anat-category-label">{category.label}</span>
                  <span className="anat-category-count">{catOrgans.length}</span>
                  <ChevronDown size={14} className="anat-category-chevron" />
                </button>
                {expandedCategories.has(category.id) && (
                  <div className="anat-category-items">
                    {catOrgans.map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        className={`anat-organ-item ${organId === item.id ? "active" : ""}`}
                        onClick={() => selectOrgan(item.id)}
                        onPointerEnter={() => prefetchOrgan(item.id)}
                        onFocus={() => prefetchOrgan(item.id)}
                        style={{ "--item-accent": item.accent } as React.CSSProperties}
                      >
                        <span className="anat-organ-glyph">
                          <OrganArt organ={item} asset="thumb" alt={`${item.name} thumbnail`} size={47} />
                        </span>
                        <span><b>{item.name}</b><small>{item.system}</small></span>
                        {organId === item.id && <Heart className="anat-favorite" size={14} fill="currentColor" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          <button className="anat-view-all" onClick={() => setQuery("")}>View all organs <ArrowRight size={14} /></button>
          <blockquote>
            <Sparkles size={18} />
            <p>Learning is<br />an act of curiosity.</p>
            <em>Keep exploring!</em>
          </blockquote>
        </aside>

        <OrganViewer
          organ={organ}
          autoRotate={autoRotate}
          onAutoRotate={setAutoRotate}
          compare={compare}
          onCompare={() => setCompare(!compare)}
        />

        <aside className="anat-info-panel" ref={contentRef}>
          <div className="anat-info-kicker" data-reveal><Heart size={13} fill="currentColor" /> The {organ.name}</div>
          <div className="anat-info-title-row" data-reveal>
            <div><h1>{organ.name}</h1><em>{organ.poetic}</em></div>
            <span className="anat-specimen-stamp">
              <OrganArt organ={organ} asset="organ" alt={`${organ.name} anatomical illustration`} size={92} />
            </span>
          </div>
          <p className="anat-description" data-reveal>{organ.description}</p>
          <div className="anat-rule" />
          <h2 data-reveal>Key facts</h2>
          <dl className="anat-key-facts">
            <div data-reveal><dt><span>◇</span> Size</dt><dd>{organ.size}</dd></div>
            <div data-reveal><dt><span>♙</span> Weight</dt><dd>{organ.weight}</dd></div>
            <div data-reveal><dt><span>⌁</span> Daily</dt><dd>{organ.dailyFact}</dd></div>
            <div data-reveal><dt><span>⌖</span> Location</dt><dd>{organ.location}</dd></div>
            <div data-reveal><dt><span>❋</span> Blood supply</dt><dd>{organ.bloodSupply}</dd></div>
            <div data-reveal><dt><span>◈</span> Function</dt><dd>{organ.function}</dd></div>
          </dl>
          <div className="anat-medical-note" data-reveal><Stethoscope size={16} /><p><b>Medical importance</b>{organ.medical}</p></div>
          <div className="anat-fun-note" data-reveal><Sparkles size={15} /><p><b>Did you know</b>{organ.funFact}</p></div>
          <button className="anat-lesson-button" data-reveal onClick={() => setModal("lesson")}>View lesson <ArrowRight size={16} /></button>
          <div className="anat-action-grid" data-reveal>
            <button onClick={() => setModal("animation")}><Play size={15} /> Animate</button>
            <button onClick={() => setModal("quiz")}><CircleHelp size={15} /> Quiz</button>
            <button onClick={() => setCompare(!compare)} className={compare ? "active" : ""}><Share2 size={15} /> Compare</button>
          </div>
        </aside>
      </div>

      {compare && (
        <section className="anat-compare-strip" aria-label="Organ comparison">
          <div className="anat-compare-organ"><OrganArt organ={organ} asset="thumb" alt="" /><span>Comparing</span><strong>{organ.name}</strong><small>{organ.system}</small></div>
          <b>vs.</b>
          <div className="anat-compare-organ"><OrganArt organ={reference} asset="thumb" alt="" /><span>Reference</span><strong>{reference.name}</strong><small>{reference.system}</small></div>
          <dl><div><dt>Primary role</dt><dd>{organ.function}</dd></div><div><dt>Scale</dt><dd>{organ.size}</dd></div></dl>
          <button onClick={() => setCompare(false)} aria-label="Close comparison"><X size={16} /></button>
        </section>
      )}

      <section className="anat-learning-cards" aria-label={`${organ.name} learning resources`}>
        <article className="anat-curiosity-card">
          <span>✿</span><p>Learning is<br />an act of curiosity.</p><em>Keep exploring!</em>
        </article>
        <article>
          <header><div><em>Microscopic view</em><h3>{organ.tissue}</h3></div><Microscope size={17} /></header>
          <div className="anat-microscope-visual anat-organ-card-image"><OrganArt organ={organ} asset="microscopic" alt={`${organ.name} microscopic tissue view`} /></div>
          <button onClick={() => setModal("lesson")}>Explore tissue <ArrowRight size={14} /></button>
        </article>
        <article>
          <header><div><em>Compare organs</em><h3>{organ.comparison}</h3></div><Share2 size={17} /></header>
          <div className="anat-comparison-visual anat-organ-card-image"><OrganArt organ={organ} asset="compare" alt={`${organ.comparison} anatomical comparison`} /></div>
          <button onClick={() => setCompare(true)}>Open comparison <ArrowRight size={14} /></button>
        </article>
        <article>
          <header><div><em>Function animation</em><h3>{organ.function}</h3></div><Play size={17} /></header>
          <button
            type="button"
            className="anat-function-visual anat-organ-card-image"
            onClick={() => setModal("animation")}
            aria-label={`Play the ${organ.name.toLowerCase()} function animation`}
          >
            <OrganArt organ={organ} asset="organ" alt="" />
            <i className="anat-function-pulse" />
            <span className="anat-play-badge"><Play size={18} fill="currentColor" /></span>
          </button>
          <button onClick={() => setModal("animation")}>Play animation <ArrowRight size={14} /></button>
        </article>
        <article>
          <header><div><em>Clinical notes</em><h3>Common conditions</h3></div><FileText size={17} /></header>
          <ul>{organ.conditions.map((condition) => <li key={condition}>{condition}</li>)}</ul>
          <button onClick={() => setModal("lesson")}>See all <ArrowRight size={14} /></button>
        </article>
        <article className="anat-system-card">
          <header><div><em>Where it works</em><h3>{organ.system}</h3></div><BrainCircuit size={17} /></header>
          <button
            type="button"
            className="anat-system-visual anat-organ-card-image"
            onClick={() => setModal("system")}
            aria-label={`See where the ${organ.name.toLowerCase()} sits in the body`}
          >
            <OrganArt organ={organ} asset="location" alt="" />
          </button>
          <button onClick={() => setModal("system")}>See the system <ArrowRight size={14} /></button>
        </article>
      </section>

      {modal && <LearningModal type={modal} organ={organ} onClose={() => setModal(null)} />}
      {mobileLibrary && <button className="anat-drawer-backdrop" aria-label="Close library" onClick={() => setMobileLibrary(false)} />}
    </main>
  );
}

const MODAL_ICON: Record<Exclude<Modal, null>, string> = {
  quiz: "?",
  animation: "▶",
  system: "⌖",
  lesson: "✦",
};

function LearningModal({ type, organ, onClose }: { type: Exclude<Modal, null>; organ: Organ; onClose: () => void }) {
  const organName = organ.name;
  const title =
    type === "quiz" ? `${organName} quick quiz`
    : type === "animation" ? `${organName} in motion`
    : type === "system" ? `${organName} in the body`
    : `Inside the ${organName.toLowerCase()}`;
  return (
    <div className="anat-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className={`anat-learning-modal ${type === "system" ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="anat-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="anat-modal-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <span className="anat-modal-icon">{MODAL_ICON[type]}</span>
        <em>Guided discovery</em>
        <h2 id="anat-modal-title">{title}</h2>
        {type === "quiz" ? (
          <div className="anat-quiz-options">
            <p>Which statement best describes the {organName.toLowerCase()}?</p>
            <button onClick={onClose}>It plays a specialized role in maintaining the body</button>
            <button onClick={onClose}>It works completely independently</button>
            <button onClick={onClose}>It is active only during sleep</button>
          </div>
        ) : type === "system" ? (
          <>
            <p>{organ.location}. Trace how the {organName.toLowerCase()} connects to the rest of the body.</p>
            <figure className="anat-modal-figure">
              <OrganArt organ={organ} asset="location" alt={`${organName} shown in place within the ${organ.system.toLowerCase()}`} />
            </figure>
            <dl className="anat-modal-facts">
              <div><dt>System</dt><dd>{organ.system}</dd></div>
              <div><dt>Primary role</dt><dd>{organ.function}</dd></div>
              <div><dt>Blood supply</dt><dd>{organ.bloodSupply}</dd></div>
            </dl>
            <button className="anat-lesson-button" onClick={onClose}>Continue exploring <ArrowRight size={16} /></button>
          </>
        ) : (
          <>
            <p>Follow the highlighted structures, rotate the specimen, and connect form with function. This short study moment is designed to build a durable mental model.</p>
            <div className={`anat-modal-demo ${type === "animation" ? "moving" : ""}`}><OrganArt organ={organ} asset="organ" alt={`${organName} illustration`} /></div>
            <button className="anat-lesson-button" onClick={onClose}>Continue exploring <ArrowRight size={16} /></button>
          </>
        )}
      </section>
    </div>
  );
}
