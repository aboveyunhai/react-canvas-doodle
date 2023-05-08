'use client';
import { useRef, useState } from 'react';
import { CanvasPanel } from 'react-canvas-doodle';

export const Canvas = () => {
  const [chainLength, setChainLength] = useState(0);
  const [displayGrid, setDisplayGrid] = useState(true);
  const [readonly, setReadonly] = useState(false);
  const doodleRef = useRef(null);
  return (
    <div className="flex">
      <CanvasPanel
        ref={doodleRef}
        initProps={{ chainLength: 0 }}
        gridProps={{ displayGrid: displayGrid }}
        readonly={readonly}
      />
      <div className="flex flex-col gap-2 p-2">
        <label>
          Chain Length:
          <input
            type="range"
            min={0}
            max={200}
            value={chainLength}
            onChange={(e) => {
              setChainLength(Number(e.currentTarget.value));
              doodleRef.current.setChainLength(Number(e.currentTarget.value));
            }}
          />
          <div>{chainLength}</div>
        </label>
        <label>
          Display grid:
          <input
            type="checkbox"
            checked={displayGrid}
            onChange={(e) => setDisplayGrid(e.currentTarget.checked)}
          />
        </label>
        <label>
          readonly:
          <input
            type="checkbox"
            checked={readonly}
            onChange={(e) => setReadonly(e.currentTarget.checked)}
          />
        </label>
        <label>
          <button
            type="button"
            onClick={() => doodleRef.current.undo() }
          >undo </button>
        </label>
      </div>
    </div>
  );
};
