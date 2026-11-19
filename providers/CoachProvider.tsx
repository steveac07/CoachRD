import { createContext, type PropsWithChildren, useContext } from 'react';

import type { Tables } from '@/types/database';

export type Coach = Tables<'coaches'>;

const CoachContext = createContext<Coach | undefined>(undefined);

export function CoachProvider({ coach, children }: PropsWithChildren<{ coach: Coach }>) {
  return <CoachContext.Provider value={coach}>{children}</CoachContext.Provider>;
}

/** El coach de la sesión. Solo dentro de las pantallas de app/coach/. */
export function useCoach(): Coach {
  const coach = useContext(CoachContext);
  if (!coach) throw new Error('useCoach() debe usarse dentro de <CoachProvider> (app/coach/_layout.tsx).');
  return coach;
}
