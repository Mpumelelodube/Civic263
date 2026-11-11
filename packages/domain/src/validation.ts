import { isCategoryId } from './categories.ts';

export function validateDraft(input: {
  categoryId: unknown;
  description: string;
  landmark: string;
}): string[] {
  const errors: string[] = [];
  if (!isCategoryId(input.categoryId)) errors.push('Choose a valid service category.');
  const description = input.description.trim();
  if (description.length < 10 || description.length > 1000)
    errors.push('Describe the issue in 10 to 1,000 characters.');
  if (!input.landmark.trim() || input.landmark.trim().length > 200)
    errors.push('Add a location or landmark of up to 200 characters.');
  return errors;
}

export function isValidCoordinate(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

export function csvCell(value: string | number | null): string {
  let safe = value === null ? '' : String(value);
  // Quoting alone does not stop spreadsheet formula execution in public exports.
  if (typeof value === 'string' && /^[\s]*[=+@-]/u.test(safe)) safe = "'" + safe;
  return '"' + safe.replaceAll('"', '""') + '"';
}
