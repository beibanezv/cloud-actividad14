// src/LoginButton.jsx
import React from 'react';
import { useMsal } from "@azure/msal-react";
import { useAuth } from "react-oidc-context";
import {
    loginRequest,
    signOutRedirect,
    PENDING_AUTH_PROVIDER_KEY,
    AUTH_PROVIDER_AZURE,
    AUTH_PROVIDER_COGNITO,
} from "../auth/AuthConfig";

export function LoginButton() {
    const { instance, accounts } = useMsal();
    const cognito = useAuth();

    const handleLogin = () => {
        // Flujo por redireccion: navega a la pagina de login de Microsoft y vuelve a la app.
        // Es mas fiable que el popup (evita bloqueos del navegador y popups que no se cierran).
        // Se marca el proveedor para que main.jsx sepa que el ?code= que vuelve es de Azure.
        sessionStorage.setItem(PENDING_AUTH_PROVIDER_KEY, AUTH_PROVIDER_AZURE);
        instance.loginRedirect(loginRequest).catch(e => {
            sessionStorage.removeItem(PENDING_AUTH_PROVIDER_KEY);
            console.error("Error en el inicio de sesión:", e);
        });
    };

    const handleLogout = () => {
        // Cierra sesión
        instance.logoutRedirect().catch(e => {
            console.error("Error al cerrar sesión:", e);
        });
    };

    // Equivalente en Cognito: mismo flujo por redireccion contra el Hosted UI.
    // react-oidc-context ya usa el UserManager configurado con el authority del
    // user pool, asi que alcanza con disparar signinRedirect.
    const handleLoginCognito = async () => {
        sessionStorage.setItem(PENDING_AUTH_PROVIDER_KEY, AUTH_PROVIDER_COGNITO);
        try {
            await cognito.signinRedirect();
        } catch (e) {
            sessionStorage.removeItem(PENDING_AUTH_PROVIDER_KEY);
            console.error("Error en el inicio de sesión de AWS Cognito:", e);
        }
    };

    // Cierre de sesión en el Hosted UI de Cognito (ver signOutRedirect en AuthConfig).
    // A diferencia de Azure, no pasa por el UserManager: es una navegacion directa
    // al endpoint /logout, que es justamente lo que hace falta para invalidar la
    // sesion del lado de Cognito y no solo la del navegador.
    //
    // OJO: hay que limpiar la sesion local ANTES de navegar. signOutRedirect()
    // solo borra la cookie de Cognito; el User que oidc-client-ts guarda en
    // sessionStorage seguiria ahi, asi que al volver a la pagina la app se
    // leeria como autenticada y el botodo de "Iniciar sesion" no reapareceria.
    // removeUser() borra ese User del sessionStorage y actualiza el estado de
    // React, que es el equivalente a lo que hace logoutRedirect() por su cuenta.
    const handleLogoutCognito = async () => {
        try {
            await cognito.removeUser();
        } catch (e) {
            console.error("Error al limpiar la sesion local de Cognito:", e);
        }
        signOutRedirect();
    };

    const sesionAzure = accounts.length > 0;
    const sesionCognito = cognito.isAuthenticated;
    const correoCognito = cognito.user?.profile?.email || cognito.user?.profile?.phone_number;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {/* --- Azure Entra ID --- */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                {sesionAzure ? (
                    <>
                        <span style={{ fontSize: '14px', color: '#333' }}>
                            Hola, <strong>{accounts[0].name}</strong> (Microsoft)
                        </span>
                        <button
                            onClick={handleLogout}
                            style={{ ...botonStyle, backgroundColor: '#d83b01' }}
                        >
                            Cerrar Sesión
                        </button>
                    </>
                ) : (
                    <button onClick={handleLogin} style={botonStyle}>
                        {/* Pequeño icono simulado de Microsoft */}
                        <span style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 6px)', gap: '2px' }}>
                            <span style={{ backgroundColor: '#f25022', width: '6px', height: '6px' }}></span>
                            <span style={{ backgroundColor: '#7fba00', width: '6px', height: '6px' }}></span>
                            <span style={{ backgroundColor: '#00a4ef', width: '6px', height: '6px' }}></span>
                            <span style={{ backgroundColor: '#ffb900', width: '6px', height: '6px' }}></span>
                        </span>
                        Iniciar sesión con Microsoft
                    </button>
                )}
            </div>

            {/* --- AWS Cognito --- */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                {sesionCognito ? (
                    <>
                        <span style={{ fontSize: '14px', color: '#333' }}>
                            Hola, <strong>{correoCognito || 'usuario Cognito'}</strong> (AWS)
                        </span>
                        <button
                            onClick={handleLogoutCognito}
                            style={{ ...botonStyle, backgroundColor: '#d83b01' }}
                        >
                            Cerrar Sesión
                        </button>
                    </>
                ) : (
                    <button
                        onClick={handleLoginCognito}
                        disabled={cognito.isLoading}
                        style={{ ...botonStyle, backgroundColor: '#232f3e' }}
                    >
                        {/* Pequeño icono simulado de AWS */}
                        <span style={{ display: 'flex', gap: '2px', alignItems: 'flex-end', height: '12px' }}>
                            <span style={{ backgroundColor: '#ff9900', width: '4px', height: '8px', borderRadius: '1px 1px 0 0' }}></span>
                            <span style={{ backgroundColor: '#ff9900', width: '4px', height: '11px', borderRadius: '1px 1px 0 0' }}></span>
                            <span style={{ backgroundColor: '#ff9900', width: '4px', height: '6px', borderRadius: '1px 1px 0 0' }}></span>
                        </span>
                        {cognito.isLoading ? 'Iniciando sesión...' : 'Iniciar sesión con AWS'}
                    </button>
                )}
            </div>

            {cognito.error && (
                <p style={{ color: '#d83b01', fontSize: '13px', margin: 0 }}>
                    Error de AWS Cognito: {cognito.error.message}
                </p>
            )}
        </div>
    );
}

// Estilo auxiliar para no repetir codigo en los botones
const botonStyle = {
    backgroundColor: '#2f2f2f',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
};
