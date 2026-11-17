export function RankedChoice({
  ranked,
  onChange,
  disabled,
}: {
  ranked: boolean;
  onChange: (value: boolean) => void;
  disabled: boolean;
}) {
  return (
    <fieldset className="ranked-choice" disabled={disabled}>
      <legend>על מה משחקים?</legend>
      <div role="group" aria-label="סוג המשחק">
        <button
          type="button"
          aria-pressed={!ranked}
          className={!ranked ? "selected" : ""}
          onClick={() => onChange(false)}
        >
          <strong>משחק חברים</strong>
          <small>משחקים בשביל המשחק</small>
        </button>
        <button
          type="button"
          aria-pressed={ranked}
          className={ranked ? "selected" : ""}
          onClick={() => onChange(true)}
        >
          <strong>משחק מדורג</strong>
          <small>התוצאה נכנסת לדירוג</small>
        </button>
      </div>
      <p>
        {ranked
          ? "כולם מוזמנים, גם אורחים. חשבונות מחוברים שומרים נקודות; אורחים מופיעים בתוצאות החדר."
          : "ללא שינוי בנקודות או בדירוג האישי."}
      </p>
    </fieldset>
  );
}
