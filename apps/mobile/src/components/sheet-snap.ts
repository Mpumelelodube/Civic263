export function sheetSnap(offset: number, velocity: number, half: number, height: number) {
  'worklet';
  const projected = offset + ((velocity / 1000) * 0.998) / (1 - 0.998);
  if (projected > half + (height - half) * 0.4) return 'dismiss';
  return projected > half / 2 ? 'collapsed' : 'expanded';
}
