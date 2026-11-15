// Pick photos on the phone (camera roll or camera) and shrink them before upload so posting is quick on a cell signal.
export function pickImages(max: number): Promise<File[]> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') return resolve([]);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = max > 1;
    input.style.display = 'none';
    input.onchange = () => { resolve(Array.from(input.files ?? []).slice(0, max)); input.remove(); };
    document.body.appendChild(input);
    input.click();
  });
}

export async function shrink(file: File, maxSide = 1600): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => bad(new Error('That photo could not be opened. Try a different one.'));
      i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
    return await new Promise<Blob>((ok, bad) => canvas.toBlob((b) => (b ? ok(b) : bad(new Error('Photo problem.'))), 'image/jpeg', 0.85));
  } finally {
    URL.revokeObjectURL(url);
  }
}
