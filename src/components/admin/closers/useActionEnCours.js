import { useCallback, useRef, useState } from 'react'

/**
 * Une action à la fois dans une vue. `enCours` est la clé de l'action lancée
 * (l'id d'une commission, d'un closer ou d'un client), ou null.
 *
 * Le verrou est posé avant l'appel, dans le même clic : un second clic, même
 * immédiat, ne relance rien. La confirmation éventuelle est demandée avant de
 * le poser, et un refus n'envoie rien.
 */
export function useActionEnCours() {
  const verrou = useRef(null)
  const [enCours, setEnCours] = useState(null)

  const lancer = useCallback(async (cle, action, { confirmation } = {}) => {
    if (verrou.current !== null) return
    if (confirmation && !window.confirm(confirmation)) return
    verrou.current = cle
    setEnCours(cle)
    try {
      await action()
    } finally {
      verrou.current = null
      setEnCours(null)
    }
  }, [])

  return { enCours, lancer }
}
