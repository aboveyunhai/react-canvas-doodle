import React, {
  CSSProperties,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  clearCanvas,
  drawGrid,
  getPointerPos,
  pointBtw,
  setCanvasSize,
} from './utils';

export type Point = {
  x: number;
  y: number;
  type?: 'erase' | string;
};

export interface Line {
  brushRadius: number;
  brushColor: string;
  points: Point[];
}

export type BrushProps = {
  brushRadius?: number;
  brushColor?: CSSProperties['color'];
};

export type GridProps = {
  displayGrid?: boolean;
  gridColor?: CSSProperties['color'];
};

const basicStyles: React.CSSProperties = {
  display: 'block',
  position: 'absolute',
  width: '100%',
  height: '100%',
};

type CanvasData = {
  lines: Array<Line>;
  width: number;
  height: number;
};

export interface CanvasProps {
  onChange?: () => void;
  loadTimeOffset?: number;
  brushProps?: BrushProps;
  gridProps?: GridProps;
  backgroundColor?: CSSProperties['backgroundColor'];
  width: number;
  height: number;
  disabled?: boolean;
  imgSrc?: string;
  initData?: CanvasData;
  immediateLoading?: boolean;
  readonly?: boolean;
  erase?: boolean;
  autoScaleOnResize?: boolean;
  pressure?: boolean;
}

export interface CanvasRefProps {
  undo: () => void;
  clear: () => void;
}

// this component is client side only
// use dynamic import for next.js
const Doodle = forwardRef<CanvasRefProps, CanvasProps>(
  (
    {
      onChange = null,
      brushProps,
      erase = false,
      gridProps,
      backgroundColor = '#FFF',
      width = 400,
      height = 400,
      disabled = false,
      initData,
      immediateLoading = false,
      readonly = false,
      loadTimeOffset = 5,
      pressure = true,
    },
    ref,
  ) => {
    const displayGrid = gridProps?.displayGrid ?? true;
    const gridColor = gridProps?.gridColor ?? 'rgba(150,150,150,0.3)';

    // prev
    const [prevRect, setPrevRect] = useState({
      width,
      height,
    });

    const containerRef = useRef<HTMLDivElement>(null);

    const gridRef = useRef<HTMLCanvasElement>(null);
    const drawingRef = useRef<HTMLCanvasElement>(null);
    const tempRef = useRef<HTMLCanvasElement>(null);
    const interfaceRef = useRef<HTMLCanvasElement>(null);

    const brushRef = useRef({
      brushColor: brushProps?.brushColor ?? '#444',
      brushRadius: brushProps?.brushRadius ?? 10,
    });

    const valuesChangedRef = useRef<boolean>(true);
    const isDrawingRef = useRef<boolean>(false);
    const isPressingRef = useRef<boolean>(false);

    const pointsRef = useRef<Array<Point>>([]);
    const linesRef = useRef<Array<Line>>([]);

    const triggerOnChange = useCallback(() => {
      onChange && onChange();
    }, [onChange]);

    const drawInterface = useCallback(
      (
        canvas: HTMLCanvasElement,
        { pointer, brush }: { pointer: Point; brush: Point },
      ) => {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        // Color brush preview according to erase prop
        const bColor = erase ? '#dbb7bb' : brushRef.current.brushColor;

        // Draw mouse point (the one directly at the cursor)
        ctx.beginPath();
        ctx.fillStyle = bColor;
        ctx.arc(
          pointer.x,
          pointer.y,
          brushRef.current.brushRadius,
          0,
          Math.PI * 2,
          true,
        );
        ctx.fill();

        // Draw brush preview
        ctx.beginPath();
        ctx.fillStyle = bColor;
        ctx.arc(
          brush.x,
          brush.y,
          brushRef.current.brushRadius,
          0,
          Math.PI * 2,
          true,
        );
        ctx.fill();
      },
      [erase],
    );

    const paintCursor = useCallback(
      (evt: PointerEvent) => {
        if (!readonly && interfaceRef.current) {
          const rect = interfaceRef.current?.getBoundingClientRect();
          if (!rect) {
            return;
          }
          const pointer = {
            x: evt.clientX - rect.left,
            y: evt.clientY - rect.top,
          };
          drawInterface(interfaceRef.current, { pointer, brush: pointer });
        }
      },
      [drawInterface, readonly],
    );

    type PointContext = {
      temp: CanvasRenderingContext2D;
      drawing: CanvasRenderingContext2D;
    };

    const drawPoints = useCallback(
      (
        points: Array<Point>,
        ctx: PointContext,
        {
          brushColor,
          brushRadius,
        }: {
          brushColor: NonNullable<CSSProperties['color']>;
          brushRadius: number;
          pointerEvent?: PointerEvent;
          immediate?: boolean;
        },
      ) => {
        ctx.temp.lineJoin = 'round';
        ctx.temp.lineCap = 'round';
        ctx.temp.strokeStyle = brushColor === 'erase' ? '#dbb7bb' : brushColor;

        ctx.drawing.globalCompositeOperation =
          brushColor === 'erase' ? 'destination-out' : 'source-over';

        // ctx.temp.clearRect(0, 0, ctx.temp.canvas.width, ctx.temp.canvas.height);

        // ctxTemp.lineWidth = getLineWidth(brushRadius, pointerEvent);
        ctx.temp.lineWidth = brushRadius * 2;

        let p1 = points[0];
        let p2 = points[1];

        if (!p1 || !p2) {
          return;
        }
        ctx.drawing.moveTo(p2.x, p2.y);
        ctx.temp.beginPath();

        for (let i = 1; i < points.length; i++) {
          // we pick the point between pi+1 & pi+2 as
          // end point and p1 as our control point
          if (!p1 || !p2) {
            return;
          }
          const midPoint = pointBtw(p1, p2, 1 / 2);
          ctx.temp.quadraticCurveTo(p1.x, p1.y, midPoint.x, midPoint.y);
          p1 = points[i];
          p2 = points[i + 1];
          ctx.temp.stroke();
        }

        // Draw last line as a straight line while
        // we wait for the next point to be able to calculate
        // the bezier control point
        // ctx.temp.quadraticCurveTo(midPoint.x, midPoint.y, p1.x, p1.y);
        // ctx.temp.lineTo(p1.x, p1.y);
        // ctx.temp.stroke();
      },
      [],
    );

    const saveLine = useCallback(
      ({ brushColor: bColor, brushRadius: bRadius }: BrushProps = {}) => {
        if (pointsRef.current.length < 2) return;

        if (pointsRef.current[0]?.type === 'erase') {
          bColor = 'erase';
        }

        // Save as new line

        linesRef.current = [
          ...linesRef.current,
          {
            points: [...pointsRef.current],
            brushColor: bColor || brushRef.current.brushColor,
            brushRadius: bRadius || brushRef.current.brushRadius,
          },
        ];

        // Reset points array
        pointsRef.current = [];

        if (!tempRef.current || !drawingRef.current) return;

        const width = tempRef.current.width;
        const height = tempRef.current.height;

        // Copy the line to the drawing canvas
        const ctxDrawing = drawingRef.current.getContext('2d');
        ctxDrawing?.drawImage(tempRef.current, 0, 0, width, height);

        // Clear the temporary line-drawing canvas
        const ctxTemp = tempRef.current.getContext('2d');
        ctxTemp?.clearRect(0, 0, width, height);

        triggerOnChange();
      },
      [triggerOnChange],
    );

    // painting
    const simulateDrawingLines = useCallback(
      (lines: Array<Line>, ctx: PointContext, immediate?: boolean) => {
        // Simulate live-drawing of the loaded lines
        // TODO use a generator
        let curTime = 0;
        const timeoutGap = immediate ? 0 : loadTimeOffset;
        lines.forEach((line) => {
          const { points, brushColor, brushRadius } = line;

          // Draw all at once if immediate flag is set, instead of using setTimeout
          if (immediate) {
            // Draw the points
            drawPoints(points, ctx, {
              brushColor,
              brushRadius,
            });

            // Save line with the drawn points
            pointsRef.current = points;
            saveLine({ brushColor, brushRadius });
            return;
          }

          // Use timeout to draw
          for (let i = 1; i < points.length; i++) {
            curTime += timeoutGap;
            window.setTimeout(() => {
              drawPoints(points.slice(i, i + 4), ctx, {
                brushColor,
                brushRadius,
              });
            }, curTime);
          }

          curTime += timeoutGap;
          window.setTimeout(() => {
            // Save this line with its props instead of this.props
            pointsRef.current = points;
            saveLine({ brushColor, brushRadius });
          }, curTime);
        });
      },
      [drawPoints, loadTimeOffset, saveLine],
    );

    const clear = useCallback(() => {
      linesRef.current = [];
      valuesChangedRef.current = true;
      // clear temporary and drawing canvas
      if (!drawingRef.current || !tempRef.current) return;
      const ctxDrawing = drawingRef.current.getContext('2d');
      const ctxTemp = tempRef.current.getContext('2d');
      if (!ctxDrawing || !ctxTemp) return;
      ctxDrawing.clearRect(
        0,
        0,
        drawingRef.current.width,
        drawingRef.current.height,
      );
      ctxTemp.clearRect(0, 0, tempRef.current.width, tempRef.current.height);
      triggerOnChange();
    }, [triggerOnChange]);

    const paintData = useCallback(
      (data: CanvasData, ctx: PointContext) => {
        const { lines, width: canvasWidth, height: canvasHeight } = data;
        if (!lines || typeof lines.push !== 'function') {
          return;
        }

        clear();

        if (width === canvasWidth && height === canvasHeight) {
          simulateDrawingLines(lines, ctx);
        } else {
          // we need to rescale the lines based on saved & current dimensions
          const scaleX = canvasWidth / width;
          const scaleY = canvasHeight / height;

          const scaleAvg = (scaleX + scaleY) / 2;

          simulateDrawingLines(
            lines.map((line) => ({
              ...line,
              points: line.points.map((p) => ({
                x: p.x * scaleX,
                y: p.y * scaleY,
              })),
              brushRadius: line.brushRadius * scaleAvg,
            })),
            ctx,
          );
        }
      },
      [clear, height, simulateDrawingLines, width],
    );

    const handlePointerMove = useCallback(
      (ev: PointerEvent, x: number, y: number) => {
        if (disabled) return;
        // Add erase type to the first point in eraser lines
        const point = {
          ...(erase ? { type: 'erase' } : {}),
          x,
          y,
        };

        const tempCtx = tempRef.current?.getContext('2d');
        const drawingCtx = drawingRef.current?.getContext('2d');

        if (!tempCtx || !drawingCtx) {
          return;
        }

        if (isPressingRef.current && !isDrawingRef.current) {
          // Start drawing and add point
          isDrawingRef.current = true;
          pointsRef.current.push(point);
        }

        if (isDrawingRef.current) {
          pointsRef.current.push(point);
          // Draw current points
          drawPoints(
            pointsRef.current.slice(-6),
            {
              temp: tempCtx,
              drawing: drawingCtx,
            },
            {
              brushColor:
                point.type === 'erase' ? 'erase' : brushRef.current.brushColor,
              brushRadius: brushRef.current.brushRadius,
              pointerEvent: ev,
            },
          );
        }
      },
      [disabled, drawPoints, erase],
    );

    const handleDrawStart = useCallback(
      (ev: PointerEvent) => {
        ev.preventDefault();
        if (!interfaceRef.current) return;
        if (!disabled) {
          interfaceRef.current.focus();
        }
        // Start drawing
        isPressingRef.current = true;

        const { x, y } = getPointerPos(ev, interfaceRef.current);
        // lazyRef.current?.update({ x, y }, { both: true });
        // Ensure the initial down position gets added to our line
        handlePointerMove(ev, x, y);
      },
      [disabled, handlePointerMove],
    );

    const handleDrawMove = useCallback(
      (ev: PointerEvent) => {
        ev.preventDefault();

        if (!interfaceRef.current || !drawingRef.current || !tempRef.current) {
          return;
        }

        const { x, y } = getPointerPos(ev, interfaceRef.current);
        handlePointerMove(ev, x, y);
      },
      [handlePointerMove],
    );

    const handleDrawEnd = useCallback(
      (ev: PointerEvent) => {
        ev.preventDefault();

        // Draw to this end pos
        // handleDrawMove(e);

        // Stop drawing & save the drawn line
        isDrawingRef.current = false;
        isPressingRef.current = false;
        saveLine();
      },
      [saveLine],
    );

    const handleDrawLeave = useCallback((ev: PointerEvent) => {
      ev.preventDefault();
      // Stop drawing & save the drawn line
      isDrawingRef.current = false;
      isPressingRef.current = false;
    }, []);

    const undo = useCallback(() => {
      const prev = linesRef.current.slice(0, -1);
      clear();
      const tempCtx = tempRef.current?.getContext('2d');
      const drawingCtx = drawingRef.current?.getContext('2d');
      if (tempCtx && drawingCtx) {
        simulateDrawingLines(
          prev,
          {
            temp: tempCtx,
            drawing: drawingCtx,
          },
          true,
        );
      }
      triggerOnChange();
    }, [clear, simulateDrawingLines, triggerOnChange]);

    const getLineWidth = useCallback(
      (brushRadius: number, ev?: PointerEvent) => {
        switch (ev?.pointerType) {
          case 'touch': {
            if (ev.width < 10 && ev.height < 10) {
              return (ev.width + ev.height) * 2 + 10;
            } else {
              return (ev.width + ev.height - 40) / 2;
            }
          }
          case 'pen':
            return ev.pressure * 8;
          default:
            return brushRadius;
        }
      },
      [],
    );

    // on mount
    useEffect(() => {
      const interfaceCanvas = interfaceRef.current;

      function cursorMove(evt: PointerEvent) {
        window.requestAnimationFrame(() => {
          paintCursor(evt);
        });
      }

      interfaceCanvas?.addEventListener('pointermove', cursorMove);

      return function cleanUp() {
        interfaceCanvas?.removeEventListener('pointermove', cursorMove);
      };
    }, [paintCursor]);

    useEffect(() => {
      const canvas = interfaceRef.current;
      if (!canvas || readonly) return;

      function drawBasedOnFramerate(evt: PointerEvent) {
        window.requestAnimationFrame(() => {
          handleDrawMove(evt);
        });
      }

      canvas.addEventListener('pointerdown', handleDrawStart);
      canvas.addEventListener('pointermove', drawBasedOnFramerate);
      canvas.addEventListener('pointerup', handleDrawEnd);
      canvas.addEventListener('pointerleave', handleDrawLeave);

      return function cleanUp() {
        canvas.removeEventListener('pointerdown', handleDrawStart);
        canvas.removeEventListener('pointermove', drawBasedOnFramerate);
        canvas.removeEventListener('pointerup', handleDrawEnd);
        canvas.removeEventListener('pointerleave', handleDrawLeave);
      };
    }, [
      handleDrawEnd,
      handleDrawLeave,
      handleDrawMove,
      handleDrawStart,
      readonly,
    ]);

    // div container resize causes rerender
    // use requestAnimationFrame to handle canvas element flicking issue
    useLayoutEffect(
      function interfaceAndPrevRect() {
        setPrevRect({
          width,
          height,
        });
        const rid = window.requestAnimationFrame(() => {
          if (interfaceRef.current) {
            setCanvasSize(interfaceRef.current, width, height);
          }
        });
        return function cleanUp() {
          window.cancelAnimationFrame(rid);
        };
      },
      [height, width],
    );

    useLayoutEffect(
      function gridCanvas() {
        const rid = window.requestAnimationFrame(() => {
          if (gridRef.current) {
            setCanvasSize(gridRef.current, width, height);
            if (displayGrid) {
              drawGrid(gridRef.current, gridColor);
            }
          }
        });
        return function cleanUp() {
          window.cancelAnimationFrame(rid);
        };
      },
      [displayGrid, gridColor, height, width],
    );

    useLayoutEffect(
      function tempAndDrawingCanvas() {
        const rid = window.requestAnimationFrame(() => {
          if (tempRef.current) {
            setCanvasSize(tempRef.current, width, height);
          }
          if (drawingRef.current) {
            setCanvasSize(drawingRef.current, width, height);
          }
          const tempCtx = tempRef.current?.getContext('2d');
          const drawingCtx = drawingRef.current?.getContext('2d');
          if (tempCtx && drawingCtx) {
            paintData(
              { lines: linesRef.current, width, height },
              {
                temp: tempCtx,
                drawing: drawingCtx,
              },
            );
          }
        });
        return function cleanUp() {
          window.cancelAnimationFrame(rid);
        };
      },
      [height, paintData, width],
    );

    // // utilities
    useImperativeHandle(
      ref,
      () => ({
        undo: undo,
        clear: clear,
      }),
      [clear, undo],
    );

    return (
      <div
        style={{
          display: 'block',
          position: 'relative',
          background: backgroundColor,
          touchAction: 'none',
          width: width,
          height: height,
        }}
        ref={containerRef}
      >
        <canvas
          ref={gridRef}
          key="grid"
          style={{
            ...basicStyles,
            zIndex: 10,
            visibility: displayGrid ? 'visible' : 'hidden',
          }}
        />
        <canvas
          ref={drawingRef}
          key="drawing"
          style={{ ...basicStyles, zIndex: 11 }}
        />
        {/* holds temporary lines draw by pen before they were added into the drawing panel */}
        <canvas
          ref={tempRef}
          key="temp"
          style={{ ...basicStyles, zIndex: 12 }}
        />
        {/* hold pen/cursor info */}
        <canvas
          ref={interfaceRef}
          key="interface"
          tabIndex={!disabled ? -1 : undefined}
          style={{
            ...basicStyles,
            zIndex: 15,
            display: readonly ? 'none' : 'block',
          }}
        />
        {/* new canvas */}
      </div>
    );
  },
);

Doodle.displayName = 'Doodle';

export const CanvasDoodle = React.memo(Doodle);
