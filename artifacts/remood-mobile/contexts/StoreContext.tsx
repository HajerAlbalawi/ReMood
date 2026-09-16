import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Recommendation } from '@workspace/api-client-react';

interface StoreContextType {
  goodreadsUserId: string | null;
  setGoodreadsUserId: (id: string | null) => Promise<void>;
  history: Recommendation[];
  addRecommendation: (rec: Recommendation) => Promise<void>;
  clearHistory: () => Promise<void>;
  isReady: boolean;
}

const StoreContext = createContext<StoreContextType | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [goodreadsUserId, setGoodreadsUserIdState] = useState<string | null>(null);
  const [history, setHistory] = useState<Recommendation[]>([]);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function loadStore() {
      try {
        const storedUserId = await AsyncStorage.getItem('goodreadsUserId');
        const storedHistory = await AsyncStorage.getItem('recommendationHistory');
        
        if (storedUserId) {
          setGoodreadsUserIdState(storedUserId);
        }
        
        if (storedHistory) {
          setHistory(JSON.parse(storedHistory));
        }
      } catch (error) {
        console.error('Failed to load store', error);
      } finally {
        setIsReady(true);
      }
    }
    loadStore();
  }, []);

  const setGoodreadsUserId = async (id: string | null) => {
    try {
      setGoodreadsUserIdState(id);
      if (id) {
        await AsyncStorage.setItem('goodreadsUserId', id);
      } else {
        await AsyncStorage.removeItem('goodreadsUserId');
      }
    } catch (error) {
      console.error('Failed to set goodreadsUserId', error);
    }
  };

  const addRecommendation = async (rec: Recommendation) => {
    try {
      const newHistory = [rec, ...history];
      setHistory(newHistory);
      await AsyncStorage.setItem('recommendationHistory', JSON.stringify(newHistory));
    } catch (error) {
      console.error('Failed to save recommendation history', error);
    }
  };

  const clearHistory = async () => {
    try {
      setHistory([]);
      await AsyncStorage.removeItem('recommendationHistory');
    } catch (error) {
      console.error('Failed to clear history', error);
    }
  };

  return (
    <StoreContext.Provider value={{ goodreadsUserId, setGoodreadsUserId, history, addRecommendation, clearHistory, isReady }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
}
