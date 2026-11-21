import { UUID_PATTERN } from '@civic263/domain';

export function draftPhotoPath(id: string): string {
  if (typeof id !== 'string' || !UUID_PATTERN.test(id)) throw new Error('Invalid saved photo.');
  return `civic263-photos/${id}.jpg`;
}

export function restoreDraftPhotoUri(
  photo: { id: string; uri: string },
  documentUri: string,
): string {
  const path = draftPhotoPath(photo.id);
  const current = `${documentUri.replace(/\/$/u, '')}/${path}`;
  // iOS can relocate Documents on update; recover only our exact generated photo path.
  const legacy =
    typeof photo.uri === 'string'
      ? /^file:\/\/\/(?:private\/)?var\/mobile\/Containers\/Data\/Application\/[a-f\d-]{36}\/Documents\/(.*)$/iu.exec(
          photo.uri,
        )
      : null;
  if (photo.uri === path || photo.uri === current || legacy?.[1] === path) return current;
  throw new Error('A saved photo could not be read. Its file has been preserved.');
}
