// App.tsx
import React from 'react';
import './App.css';
import './index.css';
import { PoseDetector } from './components/PoseDetector';

function App() {
  return (
    <div className="App">
      <header className="App-header">AI Mirror: AR Measurement Prototype</header>
      <div className="App-body">
        <PoseDetector />
      </div>
    </div>
  );
}

export default App;
