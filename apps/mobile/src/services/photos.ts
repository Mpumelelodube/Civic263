import { uuid } from 'expo';
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { ImagePickerAsset } from 'expo-image-picker';
import { PHOTO_LIMITS, type DraftPhoto } from '@civic263/domain';

export async function compressPhoto(asset: ImagePickerAsset): Promise<DraftPhoto> {
  const context = ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width, asset.height) > PHOTO_LIMITS.maxSide)
    context.resize(
      asset.width >= asset.height
        ? { width: PHOTO_LIMITS.maxSide }
        : { height: PHOTO_LIMITS.maxSide },
    );
  const image = await context.renderAsync();
  try {
    for (const quality of [0.78, 0.6, 0.42, 0.25]) {
      const result = await image.saveAsync({ compress: quality, format: SaveFormat.JPEG });
      const temporary = new File(result.uri);
      const bytes = (await temporary.bytes()).length;
      if (bytes > 0 && bytes <= PHOTO_LIMITS.maxBytes) {
        const id = uuid.v4();
        const directory = new Directory(Paths.document, 'civic263-photos');
        directory.create({ idempotent: true, intermediates: true });
        const persistent = new File(directory, `${id}.jpg`);
        await temporary.move(persistent);
        return {
          id,
          uri: persistent.uri,
          bytes,
          width: result.width,
          height: result.height,
        };
      }
      temporary.delete();
    }
    throw new Error('This photo is still too large after compression. Please choose another.');
  } finally {
    image.release();
    context.release();
  }
}

export function removePhotoFile(photo: DraftPhoto) {
  const directory = new Directory(Paths.document, 'civic263-photos');
  if (!photo.uri.startsWith(directory.uri.replace(/\/$/u, '') + '/')) return;
  const file = new File(photo.uri);
  if (file.exists) file.delete();
}
