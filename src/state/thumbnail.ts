import { util, type FabricObject } from 'fabric';

export const THUMB_WIDTH = 640;
export const THUMB_HEIGHT = 480;
const THUMB_PAD = 36;

export interface BedFrame {
  /** Pixels per millimetre in the thumbnail. */
  scale: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ThumbDoc {
  bedWidth: number;
  bedHeight: number;
  objects: Record<string, unknown>[];
}

/**
 * Fit the laser bed inside a thumbnail, centered, with a cream margin.
 * The bed keeps its aspect ratio.
 */
export function bedFrame(
  bedWidth: number,
  bedHeight: number,
  viewWidth: number,
  viewHeight: number,
  padding: number,
): BedFrame {
  const bw = Math.max(bedWidth, 1);
  const bh = Math.max(bedHeight, 1);
  const innerW = Math.max(1, viewWidth - padding * 2);
  const innerH = Math.max(1, viewHeight - padding * 2);
  const scale = Math.min(innerW / bw, innerH / bh);
  const width = bw * scale;
  const height = bh * scale;
  return {
    scale,
    width,
    height,
    x: (viewWidth - width) / 2,
    y: (viewHeight - height) / 2,
  };
}

function asThumbDoc(input: unknown): ThumbDoc {
  const record = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const bed = record.bed && typeof record.bed === 'object' ? (record.bed as Record<string, unknown>) : {};
  const width = Number(bed.width);
  const height = Number(bed.height);
  const canvas = record.canvas && typeof record.canvas === 'object' ? (record.canvas as { objects?: unknown }) : {};
  const objects = Array.isArray(canvas.objects)
    ? canvas.objects.filter(
        (obj): obj is Record<string, unknown> =>
          !!obj && typeof obj === 'object' && (obj as { visible?: unknown }).visible !== false,
      )
    : [];
  return {
    bedWidth: Number.isFinite(width) && width > 0 ? width : 400,
    bedHeight: Number.isFinite(height) && height > 0 ? height : 400,
    objects,
  };
}

function num(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  return String(rounded);
}

function gridMarkup(bedWidth: number, bedHeight: number, scale: number): string {
  const step = 10;
  if (step * scale < 6) return '';
  const lines: string[] = [];
  for (let x = step; x < bedWidth - 0.01; x += step) {
    const major = Math.round(x / step) % 5 === 0;
    const stroke = major ? 'rgba(55,46,36,0.18)' : 'rgba(55,46,36,0.08)';
    const width = (major ? 1 : 0.6) / scale;
    lines.push(
      `<line x1="${num(x)}" y1="0" x2="${num(x)}" y2="${num(bedHeight)}" stroke="${stroke}" stroke-width="${num(width)}"/>`,
    );
  }
  for (let y = step; y < bedHeight - 0.01; y += step) {
    const major = Math.round(y / step) % 5 === 0;
    const stroke = major ? 'rgba(55,46,36,0.18)' : 'rgba(55,46,36,0.08)';
    const width = (major ? 1 : 0.6) / scale;
    lines.push(
      `<line x1="0" y1="${num(y)}" x2="${num(bedWidth)}" y2="${num(y)}" stroke="${stroke}" stroke-width="${num(width)}"/>`,
    );
  }
  return lines.join('');
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** A coarse shape used when Fabric cannot revive one object. */
function fallbackShape(json: Record<string, unknown>): string {
  const stroke = typeof json.stroke === 'string' && json.stroke ? json.stroke : '#372e24';
  const fill = typeof json.fill === 'string' && json.fill && json.fill !== 'transparent' ? json.fill : 'none';
  const left = Number(json.left) || 0;
  const top = Number(json.top) || 0;
  const width = Math.abs(Number(json.width) || 0);
  const height = Math.abs(Number(json.height) || 0);
  const type = String(json.type || '').toLowerCase();
  if (type === 'ellipse' || type === 'circle') {
    const rx = Math.abs(Number(json.rx) || width / 2);
    const ry = Math.abs(Number(json.ry) || height / 2);
    return `<ellipse cx="${num(left + rx)}" cy="${num(top + ry)}" rx="${num(rx)}" ry="${num(ry)}" fill="${escapeXml(fill)}" stroke="${escapeXml(stroke)}"/>`;
  }
  if (type.includes('text') && typeof json.text === 'string') {
    const size = Number(json.fontSize) || 10;
    return `<text x="${num(left)}" y="${num(top + size)}" fill="${escapeXml(typeof json.fill === 'string' ? json.fill : stroke)}" font-size="${num(size)}">${escapeXml(json.text)}</text>`;
  }
  if (width <= 0 || height <= 0) return '';
  return `<rect x="${num(left)}" y="${num(top)}" width="${num(width)}" height="${num(height)}" fill="${escapeXml(fill)}" stroke="${escapeXml(stroke)}"/>`;
}

type StrokeObject = FabricObject & {
  getObjects?: () => FabricObject[];
  strokeUniform?: boolean;
};

function thickenStrokes(obj: StrokeObject, min: number): void {
  const kids = obj.getObjects?.() ?? [];
  for (const kid of kids) thickenStrokes(kid as StrokeObject, min);
  const stroke = obj.stroke;
  if (typeof stroke !== 'string' || !stroke || stroke === 'transparent' || stroke === 'none') return;
  const width = Number(obj.strokeWidth ?? 0);
  obj.set({
    strokeUniform: false,
    strokeWidth: Number.isFinite(width) ? Math.max(width, min) : min,
  });
}

async function artworkMarkup(objects: Record<string, unknown>[], minStroke: number): Promise<string> {
  const parts: string[] = [];
  for (const json of objects) {
    if (json.excludeFromExport === true) continue;
    try {
      const [obj] = await util.enlivenObjects<FabricObject>([json]);
      if (!obj) {
        parts.push(fallbackShape(json));
        continue;
      }
      thickenStrokes(obj as StrokeObject, minStroke);
      parts.push(obj.toSVG());
    } catch {
      parts.push(fallbackShape(json));
    }
  }
  return parts.join('');
}

function svgDocument(doc: ThumbDoc, artwork: string): string {
  const frame = bedFrame(doc.bedWidth, doc.bedHeight, THUMB_WIDTH, THUMB_HEIGHT, THUMB_PAD);
  const hairline = 1 / frame.scale;
  const origin = 14 / frame.scale;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${THUMB_WIDTH}" height="${THUMB_HEIGHT}" viewBox="0 0 ${THUMB_WIDTH} ${THUMB_HEIGHT}">
  <rect width="100%" height="100%" fill="#f7f4ec"/>
  <g transform="translate(${num(frame.x)} ${num(frame.y)}) scale(${num(frame.scale)})">
    <rect width="${num(doc.bedWidth)}" height="${num(doc.bedHeight)}" fill="#ffffff" stroke="#6b6258" stroke-width="${num(hairline)}"/>
    ${gridMarkup(doc.bedWidth, doc.bedHeight, frame.scale)}
    <g stroke="#c47a2c" stroke-width="${num(1.5 / frame.scale)}" fill="none">
      <line x1="${num(-origin)}" y1="0" x2="${num(origin)}" y2="0"/>
      <line x1="0" y1="${num(-origin)}" x2="0" y2="${num(origin)}"/>
    </g>
    <clipPath id="sunburn-bed"><rect width="${num(doc.bedWidth)}" height="${num(doc.bedHeight)}"/></clipPath>
    <g clip-path="url(#sunburn-bed)">${artwork}</g>
  </g>
</svg>`;
}

export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Preview of the project's artwork on the bed, as an SVG data URL.
 * Fabric draws each shape the same way the editor does; a simple outline
 * stands in for any object Fabric cannot revive.
 */
export async function renderProjectThumbnail(input: unknown): Promise<string> {
  const doc = asThumbDoc(input);
  const minStroke = Math.max(doc.bedWidth, doc.bedHeight) / 180;
  let artwork = '';
  try {
    artwork = await artworkMarkup(doc.objects, minStroke);
  } catch {
    artwork = doc.objects.map(fallbackShape).join('');
  }
  return svgToDataUrl(svgDocument(doc, artwork));
}
