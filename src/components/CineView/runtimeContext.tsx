import { createContext, useContext } from 'react';
import type { ScrollMode } from '../../types';

export interface CineViewRuntimeContextValue {
  mode: ScrollMode;
}

export const CineViewRuntimeContext = createContext<CineViewRuntimeContextValue | null>(null);

export function useCineViewRuntimeContext(): CineViewRuntimeContextValue | null {
  return useContext(CineViewRuntimeContext);
}
