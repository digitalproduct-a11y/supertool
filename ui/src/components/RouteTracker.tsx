import { useEffect } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { trackPageView } from '../utils/analytics';

export function RouteTracker() {
  const location = useLocation();
  const { brandSlug } = useParams<{ brandSlug: string }>();

  useEffect(() => {
    trackPageView(location.pathname, brandSlug ?? 'unknown');
  }, [location.pathname, brandSlug]);

  return null;
}
