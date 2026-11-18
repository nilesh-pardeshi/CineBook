import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api';

const CityCtx = createContext(null);
export const useCity = () => useContext(CityCtx);

export function CityProvider({ children }) {
  const [cities, setCities] = useState([]);
  const [city, setCityState] = useState(localStorage.getItem('cb_city') || 'Pune');

  useEffect(() => {
    api
      .get('/cities')
      .then((list) => {
        setCities(list);
        if (list.length && !list.includes(city)) setCityState(list[0]);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(
    () => ({
      city,
      cities,
      setCity: (c) => {
        localStorage.setItem('cb_city', c);
        setCityState(c);
      },
    }),
    [city, cities]
  );
  return <CityCtx.Provider value={value}>{children}</CityCtx.Provider>;
}
