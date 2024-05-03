import { CSSProperties } from 'react';
import { Point } from '.';

export function setCanvasSize(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
) {
  canvas.width = width;
  canvas.height = height;
}

export function pointBtw(p1: Point, p2: Point, proportion: number) {
  return {
    x: p1.x + (p2.x - p1.x) * proportion,
    y: p1.y + (p2.y - p1.y) * proportion,
  };
}

export function getPointerPos(ev: PointerEvent, canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect();

  // use cursor pos as default
  const clientX = ev.clientX;
  const clientY = ev.clientY;

  // return mouse/touch position inside canvas
  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
  };
}

export function clearCanvas(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

export function drawGrid(
  canvas: HTMLCanvasElement,
  color: NonNullable<CSSProperties['color']>,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.5;

  const gridSize = 25;

  let countX = 0;
  while (countX < ctx.canvas.width) {
    countX += gridSize;
    ctx.moveTo(countX, 0);
    ctx.lineTo(countX, ctx.canvas.height);
  }
  ctx.stroke();

  let countY = 0;
  while (countY < ctx.canvas.height) {
    countY += gridSize;
    ctx.moveTo(0, countY);
    ctx.lineTo(ctx.canvas.width, countY);
  }
  ctx.stroke();
}

export function getLineWidth(brushRadius: number, ev?: PointerEvent) {
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
}

/**
 * Original from: https://stackoverflow.com/questions/21961839/simulation-background-size-cover-in-canvas
 * Original By Ken Fyrstenberg Nilsen
 *
 * Note: img must be fully loaded or have correct width & height set.
 */

type DrawImageProps = {
  ctx: CanvasRenderingContext2D;
  img: HTMLImageElement;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  offsetX?: number;
  offsetY?: number;
};

export default function drawImageProp({
  ctx,
  img,
  x = 0,
  y = 0,
  w = ctx.canvas.width,
  h = ctx.canvas.height,
  offsetX = 0.5,
  offsetY = 0.5,
}: DrawImageProps) {
  // keep bounds [0.0, 1.0]
  if (offsetX < 0) offsetX = 0;
  if (offsetY < 0) offsetY = 0;
  if (offsetX > 1) offsetX = 1;
  if (offsetY > 1) offsetY = 1;

  const iw = img.width,
    ih = img.height,
    r = Math.min(w / iw, h / ih);
  let nw = iw * r, // new prop. width
    nh = ih * r, // new prop. height
    ar = 1;

  // decide which gap to fill
  if (nw < w) ar = w / nw;
  if (Math.abs(ar - 1) < 1e-14 && nh < h) ar = h / nh; // updated
  nw *= ar;
  nh *= ar;

  // calc source rectangle
  let cw = iw / (nw / w);
  let ch = ih / (nh / h);

  let cx = (iw - cw) * offsetX;
  let cy = (ih - ch) * offsetY;

  // make sure source rectangle is valid
  if (cx < 0) cx = 0;
  if (cy < 0) cy = 0;
  if (cw > iw) cw = iw;
  if (ch > ih) ch = ih;

  // fill image in dest. rectangle
  ctx.drawImage(img, cx, cy, cw, ch, x, y, w, h);
}
