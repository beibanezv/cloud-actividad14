// src/pages/DashboardPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { TokenSender } from '../TokenSender';
import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import { useAuth } from "react-oidc-context";
import { useNavigate } from 'react-router-dom';

export function DashboardPage() {
    const isAuthenticatedAzure = useIsAuthenticated();
    const { accounts } = useMsal();
    const cognito = useAuth();
    const navigate = useNavigate();

    const devAuth = sessionStorage.getItem('dev_auth') === '1';
    const isAuthenticated = isAuthenticatedAzure || cognito.isAuthenticated || devAuth;
    const proveedor = devAuth && !isAuthenticatedAzure && !cognito.isAuthenticated ? 'Demo local' : (isAuthenticatedAzure ? 'Azure Entra ID' : 'AWS Cognito');
    // Estados del WebSocket y Telemetría
    const [wsEndpoint, setWsEndpoint] = useState('');
    const [clientId, setClientId] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    const [trucksData, setTrucksData] = useState({});
    const [logs, setLogs] = useState([]);

    const socketRef = useRef(null);

    // Proteger la ruta si no hay sesión activa y autocomecionar el clientId según el usuario
    useEffect(() => {
        if (!isAuthenticated) {
            navigate('/login');
            return;
        }
        // Auto-asignar un clientId basado en el usuario logueado actual
        if (isAuthenticatedAzure && accounts.length > 0) {
            const emailAzure = accounts[0].username || accounts[0].name || "cliente-azure";
            // Limpiamos caracteres especiales para que quede un ID válido en DynamoDB
            setClientId(emailAzure.replace(/[^a-zA-Z0-9-_]/g, "_"));
        } else if (cognito.isAuthenticated && cognito.user?.profile) {
            const emailCognito = cognito.user.profile.email || cognito.user.profile.preferred_username || "cliente-cognito";
            setClientId(emailCognito.replace(/[^a-zA-Z0-9-_]/g, "_"));
        } else if (devAuth) {
            setClientId('demo');
        }
    }, [isAuthenticated, isAuthenticatedAzure, accounts, cognito, navigate]);

    const addLog = (message) => {
        const time = new Date().toLocaleTimeString();
        setLogs(prev => [...prev.slice(-19), `[${time}] ${message}`]);
    };

    const connectWebSocket = () => {
        if (!wsEndpoint) {
            alert("Por favor ingresa la URL de tu WebSocket de API Gateway.");
            return;
        }
        if (!clientId) {
            alert("El ID del cliente no puede estar vacío.");
            return;
        }
        if (socketRef.current) {
            socketRef.current.close();
        }
        // Construimos la URL pasando el clientId que tiene la sesión activa
        const urlWithParams = `${wsEndpoint}?clientId=${encodeURIComponent(clientId)}`;
        addLog(`Conectando WebSocket con ID de Cliente: ${clientId}`);

        const ws = new WebSocket(urlWithParams);
        socketRef.current = ws;

        ws.onopen = () => {
            setIsConnected(true);
            addLog("¡Conexión WebSocket establecida exitosamente!");
        };
        ws.onmessage = (event) => {
            try {
                addLog(`Datos recibidos: ${event.data}`);
                const batch = JSON.parse(event.data);
                setTrucksData(prev => {
                    const updated = { ...prev };
                    batch.forEach(telemetry => {
                        updated[telemetry.camionId] = telemetry;
                    });
                    return updated;
                });
            } catch (e) {
                addLog(`Error parseando mensaje entrante: ${e.message}`);
            }
        };
        ws.onclose = () => {
            setIsConnected(false);
            addLog("Conexión WebSocket cerrada.");
        };
        ws.onerror = (error) => {
            addLog(`Error en el WebSocket: ${JSON.stringify(error)}`);
        };
    };

    const disconnectWebSocket = () => {
        if (socketRef.current) {
            socketRef.current.close();
            socketRef.current = null;
        }
    };

    // Limpieza de socket al desmontar
    useEffect(() => {
        return () => {
            if (socketRef.current) {
                socketRef.current.close();
            }
        };
    }, []);

    if (!isAuthenticated) return null;

    return (
        <div style={styles.body}>
            <div style={styles.container}>
                {/* Cabecera corporativa y de Sesión */}
                <header style={styles.header}>
                    <div>
                        <h2 style={{ margin: 0, color: '#f8fafc' }}>Dashboard Cloud OIDC & Telemetría</h2>
                        <span style={{ fontSize: '13px', color: '#94a3b8' }}>
                            Sesión activa con: <strong style={{ color: '#38bdf8' }}>{proveedor}</strong>
                        </span>
                    </div>
                    <span style={{ ...styles.status, backgroundColor: isConnected ? '#22c55e' : '#ef4444' }}>
                        {isConnected ? 'WebSocket Conectado' : 'WebSocket Desconectado'}
                    </span>
                </header>
                {/* Configuración de Conexión WebSocket */}
                <div style={styles.configBox}>
                    <input
                        type="text"
                        placeholder="wss://tu-api-id.execute-api.region.amazonaws.com/prod"
                        value={wsEndpoint}
                        onChange={(e) => setWsEndpoint(e.target.value)}
                        style={styles.input}
                    />
                    <input
                        type="text"
                        placeholder="ID de Cliente (Auto-asignado por sesión)"
                        value={clientId}
                        onChange={(e) => setClientId(e.target.value)}
                        style={{ ...styles.input, maxWidth: '250px' }}
                    />
                    <button onClick={connectWebSocket} style={styles.buttonBlue}>Conectar WebSocket</button>
                    <button onClick={disconnectWebSocket} style={styles.buttonRed}>Desconectar</button>
                </div>
                {/* Grid de Camiones en Tiempo Real */}
                <h2 style={{ color: "white" }}>Camiones Activos</h2>
                <div style={styles.grid}>
                    {Object.keys(trucksData).length === 0 ? (
                        <p style={{ color: '#64748b' }}>Esperando datos de telemetría en vivo para este cliente...</p>
                    ) : (
                        Object.values(trucksData).map(t => (
                            <div key={t.camionId} style={styles.card}>
                                <h3 style={{ color: '#60a5fa', marginTop: 0 }}>Camión: {t.camionId || 'N/D'}</h3>
                                <div style={styles.metric}><span>ID Registro:</span> <strong>{t.id || 'N/D'}</strong></div>
                                <div style={styles.metric}>
                                    <span>Temperatura:</span>
                                    <strong style={{ color: t.temperatura > 15 ? '#ef4444' : '#38bdf8' }}>
                                        {t.temperatura ?? 0} °C
                                    </strong>
                                </div>
                                <div style={styles.metric}><span>Humedad:</span> <strong>{t.humedad ?? 0} %</strong></div>
                                <div style={styles.metric}><span>Estado:</span> <strong>{t.estado || 'N/D'}</strong></div>
                                <div style={styles.metric}>
                                    <small style={{ color: '#94a3b8' }}>
                                        Actualizado: {new Date(t.timestamp).toLocaleTimeString()}
                                    </small>
                                </div>
                            </div>
                        ))
                    )}
                </div>
                {/* Registro de Eventos / Logs */}
                <h3 style={{ marginTop: '30px' }}>Registro de Eventos</h3>
                <div style={styles.logBox}>
                    {logs.map((log, index) => (
                        <div key={index}>{log}</div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// Estilos limpios adaptados al diseño oscuro
const styles = {
    body: { backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100vh', padding: '40px 20px', fontFamily: 'Arial, sans-serif' },
    container: { maxWidth: '900px', margin: '0 auto' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '15px', marginBottom: '20px' },
    status: { padding: '6px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold', color: 'white' },
    configBox: { background: '#1e293b', padding: '15px', borderRadius: '8px', marginBottom: '25px', display: 'flex', gap: '10px', flexWrap: 'wrap', border: '1px solid #334155' },
    input: { flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #475569', background: '#0f172a', color: 'white', minWidth: '220px' },
    buttonBlue: { padding: '10px 16px', borderRadius: '6px', border: 'none', background: '#3b82f6', color: 'white', fontWeight: 'bold', cursor: 'pointer' },
    buttonRed: { padding: '10px 16px', borderRadius: '6px', border: 'none', background: '#ef4444', color: 'white', fontWeight: 'bold', cursor: 'pointer' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '15px' },
    card: { background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '15px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' },
    metric: { display: 'flex', justifyContent: 'space-between', margin: '8px 0', fontSize: '0.95rem' },
    logBox: { background: '#090d16', border: '1px solid #1e293b', borderRadius: '8px', padding: '15px', height: '150px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.85rem', color: '#94a3b8' }
};
