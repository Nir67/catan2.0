import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import type { Resource, DevelopmentType, Track } from "../../shared/engine.js";
import cardArt from "../assets/cards/card-art.png";
import expansionArt from "../assets/cards/expansion-art.png";
import "./Cards.css";

type CardKind = Resource | DevelopmentType | Track;
const cards: Record<
  CardKind,
  {
    atlas?: boolean;
    column: number;
    row: number;
    title: string;
    subtitle: string;
    description: string;
    tone: string;
  }
> = {
  paper: {
    atlas: true,
    column: 0,
    row: 0,
    title: "נייר",
    subtitle: "סחורה · מדע",
    description: "סחורה המופקת בעיר הסמוכה ליער, לפיתוח מדע.",
    tone: "#52795d",
  },
  cloth: {
    atlas: true,
    column: 1,
    row: 0,
    title: "בד",
    subtitle: "סחורה · מסחר",
    description: "סחורה המופקת בעיר הסמוכה למרעה, לפיתוח מסחר.",
    tone: "#b9963a",
  },
  coin: {
    atlas: true,
    column: 2,
    row: 0,
    title: "מטבעות",
    subtitle: "סחורה · פוליטיקה",
    description: "סחורה המופקת בעיר הסמוכה להרים, לפיתוח פוליטיקה.",
    tone: "#527393",
  },
  science: {
    atlas: true,
    column: 0,
    row: 1,
    title: "מדע",
    subtitle: "קלף התקדמות",
    description: "המצאות ופיתוח ערים",
    tone: "#52795d",
  },
  politics: {
    atlas: true,
    column: 1,
    row: 1,
    title: "פוליטיקה",
    subtitle: "קלף התקדמות",
    description: "אבירים והגנת קטאן",
    tone: "#527393",
  },
  trade: {
    atlas: true,
    column: 2,
    row: 1,
    title: "מסחר",
    subtitle: "קלף התקדמות",
    description: "סוחרים וסחורות",
    tone: "#b9963a",
  },
  wood: {
    column: 0,
    row: 0,
    title: "עץ",
    subtitle: "קלף משאב",
    description: "עצים מהיער משמשים לסלילת דרכים ולהקמת יישובים.",
    tone: "#3d6242",
  },
  brick: {
    column: 1,
    row: 0,
    title: "לבנים",
    subtitle: "קלף משאב",
    description: "לבנים מהגבעות משמשות לבניית דרכים ויישובים.",
    tone: "#a35235",
  },
  sheep: {
    column: 2,
    row: 0,
    title: "צמר",
    subtitle: "קלף משאב",
    description: "צמר משדות המרעה נדרש ליישובים ולקלפי פיתוח.",
    tone: "#78915d",
  },
  wheat: {
    column: 3,
    row: 0,
    title: "חיטה",
    subtitle: "קלף משאב",
    description: "תבואה מהשדות נדרשת ליישובים, לערים ולקלפי פיתוח.",
    tone: "#a17c2f",
  },
  stone: {
    column: 4,
    row: 0,
    title: "מחצבים",
    subtitle: "קלף משאב",
    description: "מחצבים מההרים משמשים לשדרוג ערים ולרכישת קלפי פיתוח.",
    tone: "#536675",
  },
  knight: {
    column: 0,
    row: 1,
    title: "אביר",
    subtitle: "קלף פיתוח",
    description:
      "הזז את השודד וגנוב משאב אחד משחקן סמוך. שלושה אבירים עשויים לזכות אותך בצבא הגדול.",
    tone: "#485d76",
  },
  victory: {
    column: 1,
    row: 1,
    title: "נקודת ניצחון",
    subtitle: "קלף פיתוח",
    description:
      "נקודה אחת שנשמרת בסוד מהיריבים. היא נספרת מיד, והניצחון מוכרע רק בתורך.",
    tone: "#a38135",
  },
  "road-building": {
    column: 2,
    row: 1,
    title: "בניית דרכים",
    subtitle: "קלף פיתוח",
    description:
      "הצב עד שתי דרכים חוקיות ללא תשלום משאבים, בהתאם למלאי חלקי הדרך שלך.",
    tone: "#8c6b48",
  },
  plenty: {
    column: 3,
    row: 1,
    title: "שנת שפע",
    subtitle: "קלף פיתוח",
    description: "קבל שני משאבים לבחירתך מתוך הקלפים הזמינים בבנק.",
    tone: "#7e873e",
  },
  monopoly: {
    column: 4,
    row: 1,
    title: "מונופול",
    subtitle: "קלף פיתוח",
    description:
      "בחר סוג משאב וקבל את כל הקלפים מאותו סוג שבידי השחקנים האחרים.",
    tone: "#875d49",
  },
};
const resourceKinds: CardKind[] = ["wood", "brick", "sheep", "wheat", "stone"];
const developmentKinds: CardKind[] = [
  "knight",
  "victory",
  "road-building",
  "plenty",
  "monopoly",
];

export function CardArt({ kind }: { kind: CardKind }) {
  const card = cards[kind];
  return (
    <span
      aria-hidden="true"
      className="card-illustration"
      style={{
        backgroundImage: `url(${card.atlas ? expansionArt : cardArt})`,
        backgroundSize: card.atlas ? "300% 200%" : "500% 200%",
        backgroundPosition: `${card.column * (card.atlas ? 50 : 25)}% ${card.row * 100}%`,
      }}
    />
  );
}

export function PlayingCard({
  kind,
  count,
  status,
  showDescription = false,
}: {
  kind: CardKind;
  count?: number;
  status?: string;
  showDescription?: boolean;
}) {
  const card = cards[kind];
  return (
    <span
      className={`playing-card ${card.row === 0 ? "resource-card" : "development-card"}`}
      style={{ "--card-tone": card.tone } as CSSProperties}
    >
      <span className="card-print">
        <CardArt kind={kind} />
        <span className="card-caption">
          <span className="card-category">{card.subtitle}</span>
          <strong>{card.title}</strong>
        </span>
      </span>
      {count !== undefined && (
        <span className="card-quantity" aria-label={`${count} קלפים`}>
          {count}
          <small>קלפים</small>
        </span>
      )}
      {showDescription && (
        <span className="card-description">{card.description}</span>
      )}
      {status && <span className="card-status">{status}</span>}
    </span>
  );
}

export function CardGallery({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="card-gallery"
      aria-labelledby="card-gallery-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) dialog.current?.close();
      }}
    >
      <header>
        <div>
          <span className="eyebrow">הקלפים של האי</span>
          <h2 id="card-gallery-title">כל קלף מספר סיפור</h2>
        </div>
        <button
          aria-label="סגור את גלריית הקלפים"
          onClick={() => dialog.current?.close()}
        >
          ×
        </button>
      </header>
      <p className="gallery-intro">
        איורים מקוריים בסגנון משחק קופסה. בגלריה אפשר להכיר את הקלפים; היד
        האישית שלך מוצגת רק לך בזמן המשחק.
      </p>
      <section>
        <h3>משאבים</h3>
        <div className="gallery-cards">
          {resourceKinds.map((kind) => (
            <PlayingCard key={kind} kind={kind} showDescription />
          ))}
        </div>
      </section>
      <section>
        <h3>קלפי פיתוח</h3>
        <div className="gallery-cards">
          {developmentKinds.map((kind) => (
            <PlayingCard key={kind} kind={kind} showDescription />
          ))}
        </div>
      </section>
      <p className="gallery-footnote">
        במשחק הבסיס: קלף פעולה אחד בתור, החל מהתור שאחרי הרכישה. נקודות ניצחון
        נספרות אוטומטית.
      </p>
      <section>
        <h3>ערים ואבירים · סחורות ותחומי התקדמות</h3>
        <div className="gallery-cards">
          {(
            [
              "paper",
              "cloth",
              "coin",
              "science",
              "politics",
              "trade",
            ] as CardKind[]
          ).map((kind) => (
            <PlayingCard key={kind} kind={kind} showDescription />
          ))}
        </div>
        <p className="gallery-footnote">
          בהרחבה: 54 קלפי התקדמות בשלושה תחומים. ניתן לשחק כמה קלפים בתורך אחרי
          הגלגול; אלכימאי לפני הגלגול. נקודות ניצחון מקלפי התקדמות גלויות מיד.
        </p>
      </section>
    </dialog>
  );
}
