import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './style.css';

// Sem StrictMode: o double-invoke de efeitos do modo dev abriria duas
// conexoes Peer para a mesma sala, o que nao faz sentido para um app
// de tempo real.
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
