import { useEffect } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { trackPageView } from '../utils/analytics';

export function RouteTracker() {
  const location = useLocation();
  const { brandSlug } = useParams<{ brandSlug: string }>();

  useEffect(() => {
    trackPageView(location.pathname, brandSlug ?? 'unknown');
    window.scrollTo(0, 0);
    document.querySelectorAll('main').forEach(el => el.scrollTo(0, 0));
  }, [location.pathname, brandSlug]);

  return null;
}
