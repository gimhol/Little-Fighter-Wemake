interface Window {
  runtime?: {
    WindowMinimise?(): void;
    WindowIsMaximised?(): Promise<boolean>;
    WindowToggleMaximise?(): void;
    Quit?(): void;
    WindowFullscreen?(): void;
    WindowUnfullscreen?(): void;
    WindowIsFullscreen?(): Promise<boolean>;
  }
}
declare const VERSION_NAME: string;
declare const GIT_COMMIT_ID: string;
declare const GIT_COMMIT_DIRTY: "dirty" | "";
declare const BUILD_TIME: string;
declare type FieldKeysRow<T extends object> = (keyof T | (keyof T)[]);
