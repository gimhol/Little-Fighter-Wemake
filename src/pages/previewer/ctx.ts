import type { LFW } from "@/LFW";
import { createContext, useContext } from "react";

export interface IPreviewerContext {
  lfw?: LFW;
  ready: boolean;
}

export const PreviewerContext = createContext<IPreviewerContext>({ ready: false });

export function usePreviewer(): IPreviewerContext {
  return useContext(PreviewerContext);
}
