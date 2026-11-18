import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import type { ReactNode, KeyboardEvent, PointerEvent } from "react";
import "./BoardZoom.css";

type Camera = { zoom: number; x: number; y: number };
const bounds = (sea: boolean) =>
  sea
    ? { x: -110, y: -175, width: 1020, height: 890 }
    : { x: 60, y: -30, width: 680, height: 600 };
function constrain(camera: Camera, sea: boolean): Camera {
  const base = bounds(sea),
    zoom = Math.max(1, Math.min(4, camera.zoom)),
    halfW = base.width / zoom / 2,
    halfH = base.height / zoom / 2;
  return {
    zoom,
    x: Math.max(
      base.x + halfW,
      Math.min(base.x + base.width - halfW, camera.x),
    ),
    y: Math.max(
      base.y + halfH,
      Math.min(base.y + base.height - halfH, camera.y),
    ),
  };
}
export function BoardZoom({
  seafarers,
  children,
  controls,
}: {
  controls?: HTMLElement | null;
  seafarers: boolean;
  children: (viewBox: string) => ReactNode;
}) {
  const [camera, setCamera] = useState<Camera>({ zoom: 1, x: 400, y: 270 }),
    [dragging, setDragging] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    pointer: number;
    x: number;
    y: number;
    camera: Camera;
    units: number;
    captured: boolean;
  } | null>(null);
  const touches = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; camera: Camera } | null>(null);
  const moved = useRef(false),
    base = bounds(seafarers);
  const width = base.width / camera.zoom,
    height = base.height / camera.zoom;
  const reset = () => {
    setCamera({ zoom: 1, x: 400, y: 270 });
    moved.current = false;
  };
  const zoom = (amount: number) =>
    setCamera((c) =>
      constrain(
        { ...c, zoom: Math.round((c.zoom + amount) * 100) / 100 },
        seafarers,
      ),
    );
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    // Native, non-passive listener keeps Ctrl+wheel local to the board.
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      setCamera((c) =>
        constrain(
          { ...c, zoom: c.zoom * (event.deltaY < 0 ? 1.12 : 1 / 1.12) },
          seafarers,
        ),
      );
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, [seafarers]);
  function down(event: PointerEvent<HTMLDivElement>) {
    moved.current = false;
    if (event.pointerType === "touch") {
      touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (touches.current.size === 2) {
        const [a, b] = [...touches.current.values()];
        pinch.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), camera };
        drag.current = null;
        moved.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        return;
      }
    }
    if (camera.zoom <= 1 || event.button !== 0 || !event.isPrimary) return;
    const svg = viewport.current?.querySelector("svg"),
      rect = svg?.getBoundingClientRect();
    if (!rect?.width || !rect.height) return;
    drag.current = {
      pointer: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      camera,
      units: Math.max(width / rect.width, height / rect.height),
      captured: false,
    };
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    if (touches.current.has(event.pointerId)) {
      touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pinch.current && touches.current.size === 2) {
        const [a, b] = [...touches.current.values()];
        if (pinch.current.distance > 0) {
          event.preventDefault();
          moved.current = true;
          setCamera(constrain({ ...pinch.current.camera, zoom: pinch.current.camera.zoom * Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.distance }, seafarers));
        }
        return;
      }
    }
    const start = drag.current;
    if (!start || event.pointerId !== start.pointer) return;
    const dx = event.clientX - start.x,
      dy = event.clientY - start.y;
    if (!start.captured) {
      if (Math.hypot(dx, dy) < 5) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      start.captured = true;
      moved.current = true;
      setDragging(true);
    }
    event.preventDefault();
    setCamera(
      constrain(
        {
          ...start.camera,
          x: start.camera.x - dx * start.units,
          y: start.camera.y - dy * start.units,
        },
        seafarers,
      ),
    );
  }
  function up(event: PointerEvent<HTMLDivElement>) {
    touches.current.delete(event.pointerId);
    if (pinch.current) {
      pinch.current = null;
      drag.current = null;
      moved.current = true;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (drag.current?.pointer !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    drag.current = null;
    setDragging(false);
  }
  function key(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      zoom(0.25);
    } else if (event.key === "-") {
      event.preventDefault();
      zoom(-0.25);
    } else if (event.key === "0" || event.key === "Home") {
      event.preventDefault();
      reset();
    } else if (
      camera.zoom > 1 &&
      ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
    ) {
      event.preventDefault();
      setCamera((c) =>
        constrain(
          {
            ...c,
            x:
              c.x +
              (event.key === "ArrowLeft"
                ? -width / 8
                : event.key === "ArrowRight"
                  ? width / 8
                  : 0),
            y:
              c.y +
              (event.key === "ArrowUp"
                ? -height / 8
                : event.key === "ArrowDown"
                  ? height / 8
                  : 0),
          },
          seafarers,
        ),
      );
    }
  }
  const toolbar = (
    <div className="board-zoom-toolbar" role="group" aria-label="תצוגת הלוח">
      <div className="zoom-buttons" dir="ltr">
        <button
          type="button"
          aria-label="הקטן את הלוח"
          disabled={camera.zoom <= 1}
          onClick={() => zoom(-0.25)}
        >
          −
        </button>
        <output aria-live="polite" aria-label="רמת הגדלה">
          {Math.round(camera.zoom * 100)}%
        </output>
        <button
          type="button"
          aria-label="הגדל את הלוח"
          disabled={camera.zoom >= 4}
          onClick={() => zoom(0.25)}
        >
          +
        </button>
      </div>
      <button type="button" className="zoom-reset" onClick={reset}>
        הצג את כל הלוח
      </button>
      <small>צביטה להגדלה · גרירה להזזה · Ctrl + גלגלת</small>
    </div>
  );
  return (
    <div className="board-zoom">
      {controls ? createPortal(toolbar, controls) : toolbar}
      <div
        ref={viewport}
        className={`board-viewport${camera.zoom > 1 ? " zoomed" : ""}${dragging ? " dragging" : ""}`}
        tabIndex={0}
        role="group"
        aria-label="לוח עם הגדלה וגרירה"
        onKeyDown={key}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onLostPointerCapture={() => {
          drag.current = null;
          setDragging(false);
        }}
        onClickCapture={(event) => {
          if (moved.current && event.detail > 0) {
            event.preventDefault();
            event.stopPropagation();
            moved.current = false;
          }
        }}
      >
        {children(
          `${camera.x - width / 2} ${camera.y - height / 2} ${width} ${height}`,
        )}
      </div>
    </div>
  );
}
