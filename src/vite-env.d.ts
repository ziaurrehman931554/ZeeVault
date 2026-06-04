/// <reference types="vite/client" />

declare module '*.css';

declare namespace React {
  interface InputHTMLAttributes<T> {
    webkitdirectory?: string;
    directory?: string;
  }
}
