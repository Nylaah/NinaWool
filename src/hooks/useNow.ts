import { useEffect, useState } from 'react'

/** Renvoie l'heure courante, rafraîchie toutes les secondes tant que `active` est vrai. */
export function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [active])
  return now
}
