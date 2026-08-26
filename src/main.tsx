import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SetupRequired } from '@/components/SetupRequired';
import { isSupabaseConfigured } from '@/lib/supabase';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>{isSupabaseConfigured ? <App /> : <SetupRequired />}</ErrorBoundary>
  </React.StrictMode>
);
