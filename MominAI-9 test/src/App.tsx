import React from 'react';
import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import DashboardPage from './pages/DashboardPage';
import IDEPage from './pages/IDEPage';
import ProtectedRoute from './components/ProtectedRoute';

const App: React.FC = () => {
    return (
        <Routes>
            <Route path="/" element={<HomePage />} />
            <Route 
                path="/dashboard"
                element={
                    <ProtectedRoute>
                        <DashboardPage />
                    </ProtectedRoute>
                } 
            />
            <Route 
                path="/ide/:projectId"
                element={
                    <ProtectedRoute>
                        <IDEPage />
                    </ProtectedRoute>
                } 
            />
        </Routes>
    );
};

export default App;
