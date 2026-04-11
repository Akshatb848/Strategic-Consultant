import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function OAuthCallbackPage() {
  const { setUserFromOAuth } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash.slice(1); // Remove #
    const params = new URLSearchParams(hash);
    const token = params.get('token');

    if (token) {
      setUserFromOAuth(token).then(() => {
        navigate('/dashboard', { replace: true });
      });
    } else {
      navigate('/login?error=oauth_failed', { replace: true });
    }
  }, []);

  return (
    <div className="loading-screen">
      <div className="loading-spinner" />
      <p>Completing sign-in...</p>
    </div>
  );
}
