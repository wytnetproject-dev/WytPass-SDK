import { createContext } from 'react';
import type { WytPassContextValue } from './types.js';

export const WytPassContext = createContext<WytPassContextValue | null>(null);
