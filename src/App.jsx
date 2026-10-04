import { useLayoutEffect } from 'react';
import HomePage from './components/HomePage';
import { initializeSite } from './lib/siteController';
import './styles/site.css';

export default function App() {
  useLayoutEffect(() => initializeSite(), []);

  return <HomePage />;
}
