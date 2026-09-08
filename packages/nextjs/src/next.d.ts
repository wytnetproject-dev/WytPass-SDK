declare module 'next/headers' {
  export interface RequestCookie {
    name: string;
    value: string;
  }
  export interface ReadonlyRequestCookies {
    get(name: string): RequestCookie | undefined;
    getAll(): RequestCookie[];
    has(name: string): boolean;
  }
  export function cookies(): Promise<ReadonlyRequestCookies> | ReadonlyRequestCookies;
}
