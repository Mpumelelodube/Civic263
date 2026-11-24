// Static image imports resolve to an asset reference for expo-image and Image.
declare module '*.png' {
  const asset: number;
  export default asset;
}
