// RN-web turns dataSet into data-* attributes, which the global CSS uses (fonts, phone vs desktop layout).
// The prop isn't in React Native's types, so it is passed through this helper.
export const webData = (key: string) => ({ dataSet: { [key]: '1' } }) as object;
