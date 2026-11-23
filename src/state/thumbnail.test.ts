import { describe, expect, it } from 'vitest';
import { createEmptyDocument } from '@/types/document';
import { bedFrame, renderProjectThumbnail, THUMB_HEIGHT, THUMB_WIDTH } from './thumbnail';

describe('bed thumbnail', () => {
  it('centers the bed inside the frame without stretching it', () => {
    const frame = bedFrame(400, 400, THUMB_WIDTH, THUMB_HEIGHT, 36);
    expect(frame.width).toBeCloseTo(frame.height, 5);
    expect(frame.scale).toBeCloseTo(408 / 400, 5);
    expect(frame.x).toBeCloseTo((THUMB_WIDTH - frame.width) / 2, 5);
    expect(frame.y).toBeCloseTo((THUMB_HEIGHT - frame.height) / 2, 5);
  });

  it('draws the bed and the artwork into an svg data url', async () => {
    const doc = createEmptyDocument('Plate');
    doc.bed = { width: 200, height: 100, showOutline: true };
    doc.canvas = {
      version: '6.5.1',
      objects: [
        {
          type: 'Rect',
          version: '6.5.1',
          originX: 'left',
          originY: 'top',
          left: 20,
          top: 15,
          width: 80,
          height: 40,
          fill: 'transparent',
          stroke: '#1234ab',
          strokeWidth: 2,
          scaleX: 1,
          scaleY: 1,
          angle: 0,
        },
      ],
    };

    const url = await renderProjectThumbnail(doc);
    expect(url.startsWith('data:image/svg+xml')).toBe(true);
    const svg = decodeURIComponent(url.slice(url.indexOf(',') + 1));
    expect(svg).toContain('width="200"');
    expect(svg).toContain('height="100"');
    // Fabric exports the hex stroke as rgb().
    expect(svg).toContain('rgb(18,52,171)');
    expect(svg).toContain('width="80"');
    expect(svg).toContain('height="40"');
  });

  it('still returns a bed preview when the document is empty', async () => {
    const url = await renderProjectThumbnail(createEmptyDocument());
    const svg = decodeURIComponent(url.slice(url.indexOf(',') + 1));
    expect(svg).toContain('fill="#ffffff"');
    expect(svg).toContain('fill="#f7f4ec"');
  });
});
