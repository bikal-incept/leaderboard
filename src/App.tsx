import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Benchmarks from './pages/Benchmarks';
import Evaluations from './pages/Evaluations';
import LookAtData from './pages/LookAtData';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/leaderboards" replace />} />
          <Route path="leaderboards" element={<Benchmarks />} />
          <Route path="evaluations" element={<Evaluations />} />
          <Route path="look-at-data" element={<LookAtData />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
