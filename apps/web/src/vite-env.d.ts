/// <reference types="vite/client" />

declare module "*.png" {
  const value: string;
  export default value;
}

declare module "qrcode" {
  interface ToDataUrlOptions {
    width?: number;
    margin?: number;
  }

  export function toDataURL(text: string, options?: ToDataUrlOptions): Promise<string>;
}
