import { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { onSnapshotsInSync, enableNetwork, disableNetwork } from 'firebase/firestore';

export function useConectividade() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [sincronizando, setSincronizando] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      enableNetwork(db).catch(console.error);
    };
    const handleOffline = () => setIsOffline(true);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    const unsubscribeSync = onSnapshotsInSync(db, () => {
      setIsOffline(!navigator.onLine);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribeSync();
    };
  }, []);

  const forcarSincronizacao = async () => {
    if (navigator.onLine) {
      setSincronizando(true);
      try {
        await disableNetwork(db);
        await enableNetwork(db);
      } catch (err) {
        console.error('Erro ao forçar sync:', err);
      } finally {
        setTimeout(() => setSincronizando(false), 1500);
      }
    }
  };

  return { isOffline, forcarSincronizacao, sincronizando };
}
