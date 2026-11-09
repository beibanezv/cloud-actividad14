// src/pages/LoginPage.jsx
import React, { useEffect } from 'react';
import { LoginButton } from '../component/LoginButton';
import { useIsAuthenticated } from "@azure/msal-react";
import { useAuth } from "react-oidc-context";
import { useNavigate } from 'react-router-dom';

export function LoginPage() {
    const isAuthenticatedAzure = useIsAuthenticated();
    const cognito = useAuth();
    const navigate = useNavigate();

    // Acceso demo local: el repo trae las credenciales del profe (AuthConfig.js),
    // sin cuenta en su tenant/pool los dos logins dan false. Solo para ver el dashboard.
    const devAuth = sessionStorage.getItem('dev_auth') === '1';
    const isAuthenticated = isAuthenticatedAzure || cognito.isAuthenticated || devAuth;
    console.log(isAuthenticated)
    // Si ya inició sesión, lo mandamos directo al dashboard
    useEffect(() => {
        if (isAuthenticated) {
            navigate('/dashboard');
        }
    }, [isAuthenticated, navigate]);

    return (
        <div style={{ padding: '60px', fontFamily: 'Arial, sans-serif', maxWidth: '500px', margin: '40px auto', textAlign: 'center', background: '#1e293b', color: 'white', borderRadius: '12px' }}>
            <h2>Iniciar Sesión</h2>
            <p style={{ color: '#94a3b8', marginBottom: '30px', fontSize: '14px' }}>
                Accede con tu cuenta corporativa (Azure Entra ID o AWS Cognito) para continuar.
            </p>
            <LoginButton />
            <button
                onClick={() => { sessionStorage.setItem('dev_auth', '1'); navigate('/dashboard'); }}
                style={{ marginTop: '20px', background: '#334155', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}
            >
                Entrar sin login (demo local)
            </button>
        </div>
    );
}
