import { useEffect, useMemo, useState } from 'react';
import { EtfCatalogItem, fallbackEtfCatalog, fetchTwseEtfCatalog, mergeCatalog } from './etfCatalog';

export function useEtfCatalog() {
  const [remote, setRemote] = useState<EtfCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = async () => {
    setLoading(true);
    try {
      const list = await fetchTwseEtfCatalog();
      setRemote(list);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'TWSE ETF 主檔讀取失敗');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);
  const catalog = useMemo(() => mergeCatalog(remote, fallbackEtfCatalog), [remote]);
  return { catalog, loading, error, refresh, onlineCount: remote.length };
}
