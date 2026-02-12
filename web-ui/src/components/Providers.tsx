'use client';

import { ReactNode } from 'react';
import { ModelProvider } from '@/contexts/ModelContext';

export function Providers({ children }: { children: ReactNode }) {
    return (
        <ModelProvider>
            {children}
        </ModelProvider>
    );
}
