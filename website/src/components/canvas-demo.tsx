'use client';
import { useRef, useState } from 'react';
import { BrushProps, CanvasDoodle } from 'react-canvas-doodle';

export const CanvasDemo = () => {
  const [displayGrid, setDisplayGrid] = useState(true);
  const [readonly, setReadonly] = useState(false);
  const doodleRef = useRef(null);
  const [size, setSize] = useState({ width: 300, height: 300 });
  const [brushProps, setBrushProps] = useState<BrushProps>({
    brushRadius: 5,
    brushColor: 'black',
  });
  return (
    <div className="flex">
      <div className="border">
        <CanvasDoodle
          ref={doodleRef}
          gridProps={{ displayGrid: displayGrid }}
          brushProps={brushProps}
          width={size.width}
          height={size.height}
          readonly={readonly}
        />
      </div>
      <div className="flex flex-col gap-2 p-2">
        <label className="inline">
          Display grid:
          <input
            type="checkbox"
            checked={displayGrid}
            onChange={(e) => setDisplayGrid(e.currentTarget.checked)}
          />
        </label>
        <label className="inline">
          readonly:
          <input
            type="checkbox"
            checked={readonly}
            onChange={(e) => setReadonly(e.currentTarget.checked)}
          />
        </label>
        <div>
          <input
            type="range"
            min={0}
            max={20}
            value={brushProps.brushRadius}
            onChange={(e) => {
              const val = Number(e.currentTarget.value);
              if (Number.isNaN(val)) return;
              setBrushProps((prev) => ({
                ...prev,
                brushRadius: val,
              }));
            }}
          />
        </div>
        <label className="inline">
          <span>current size: {size.height}</span>
          <button
            onClick={() => {
              setSize((prev) => ({
                width: prev.width === 300 ? 500 : 300,
                height: prev.height === 300 ? 500 : 300,
              }));
            }}
          >
            change size to {size.width === 300 ? 500 : 300}
          </button>
        </label>
        <button type="button" onClick={() => doodleRef.current.undo()}>
          undo
        </button>
        <button type="button" onClick={() => doodleRef.current.clear()}>
          clear
        </button>
      </div>
    </div>
  );
};
