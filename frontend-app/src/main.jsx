// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

import { PublicClientApplication, EventType } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { AuthProvider } from "react-oidc-context";
import {
  msalConfig,
  cognitoOidcConfig,
  PENDING_AUTH_PROVIDER_KEY,
  AUTH_PROVIDER_COGNITO,
} from "./auth/AuthConfig";


const msalInstance = new PublicClientApplication(msalConfig);

// Registro de fallos interactivos (login/acquireToken) en consola con detalle.
msalInstance.addEventCallback((event) => {
  if (
    event.eventType === EventType.LOGIN_FAILURE ||
    event.eventType === EventType.ACQUIRE_TOKEN_FAILURE
  ) {
    console.error("Fallo de MSAL:", event.error);
  }
});

function mostrarErrorPantalla(titulo, detalle) {
  document.getElementById('root').innerHTML =
    '<div style="font-family:Arial;padding:20px">' +
    `<h3 style="color:#d83b01">${titulo}</h3>` +
    `<pre style="background:#f3f2f1;padding:10px;border-radius:4px;white-space:pre-wrap">` +
    `${detalle}\n\nRecarga la pagina para reintentar. Si el error menciona AADSTS650053 o AADSTS65001,\nrevisa la configuracion de "Expose an API" en el registro de la aplicacion de Azure.` +
    '</pre></div>';
}

function detalleError(error) {
  return [
    `codigo: ${error?.errorCode ?? "(sin codigo)"}`,
    `mensaje: ${error?.errorMessage ?? error?.message}`,
    `correlationId: ${error?.correlationId ?? "(sin correlationId)"}`,
    error?.errorDescription ? `descripcion: ${error.errorDescription}` : ""
  ].filter(Boolean).join("\n");
}

// Azure y Cognito regresan por redirect a la misma pagina con ?code=...&state=...
// en el query string. Detecta si la URL actual trae una respuesta de cualquiera
// de los dos para que solo el proveedor que la pidio intente canjear el codigo.
function hayCallbackDeAuth(search = window.location.search) {
  const params = new URLSearchParams(search);
  return Boolean((params.get("code") || params.get("error")) && params.get("state"));
}

// Tras canjear el codigo, los parametros quedan en la barra de direcciones y
// un F5 los reenvia al backend como si fueran parametros de la app.
function limpiarUrl() {
  const url = new URL(window.location.href);
  ["code", "state", "session_state", "error", "error_description", "error_uri"]
    .forEach((param) => url.searchParams.delete(param));
  window.history.replaceState(null, "", url.pathname + url.search + url.hash);
}

async function bootstrap() {
  // MSAL exige inicializar la instancia antes de cualquier interaccion.
  await msalInstance.initialize();

  const proveedorPendiente = sessionStorage.getItem(PENDING_AUTH_PROVIDER_KEY);
  // Si el redirect vino de Cognito, MSAL no debe tocar ese ?code=...&state=...:
  // no encontraria su propia solicitud en sessionStorage y podria reportarlo
  // como error. Cada proveedor canjea su propio codigo y solo uno debe hacerlo.
  const callbackDeCognito = proveedorPendiente === AUTH_PROVIDER_COGNITO;
  const callbackDeAzure = hayCallbackDeAuth() && !callbackDeCognito;

  // Procesa la respuesta si regresamos de una redireccion de Azure (login o consentimiento).
  if (callbackDeAzure) {
    try {
      const response = await msalInstance.handleRedirectPromise();
      if (response) {
        console.info("Autenticacion por redirect completada:", {
          usuario: response.account?.username,
          scopes: response.scopes
        });
      }
    } catch (error) {
      // Un fallo del protocolo (scope inexistente, consentimiento denegado, etc.)
      // llega aqui con el detalle en la descripcion: se muestra y se detiene.
      console.error("Error al procesar la respuesta de Azure:", error);
      sessionStorage.removeItem(PENDING_AUTH_PROVIDER_KEY);
      limpiarUrl();
      mostrarErrorPantalla("Azure devolvio un error al procesar el token", detalleError(error));
      return;
    }
    limpiarUrl();
  } else if (!callbackDeCognito) {
    // Callback de una pestana vieja o de otra pagina: se descarta para que
    // ningun proveedor intente canjear un codigo que no le pertenece.
    limpiarUrl();
  }

  // El marcador ya fue consumido (o la pagina nunca lanzo redirect).
  sessionStorage.removeItem(PENDING_AUTH_PROVIDER_KEY);

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      {/* skipSigninCallback evita que react-oidc-context intente canjear el
          ?code= de Azure como si fuera suyo. Con el flag ya limpio, Cognito
          vuelve a leer los parametros que el Hosted UI acaba de dejar. */}
      <AuthProvider
        {...cognitoOidcConfig}
        skipSigninCallback={!callbackDeCognito}
        onSigninCallback={limpiarUrl}
      >
        <MsalProvider instance={msalInstance}>
          <App />
        </MsalProvider>
      </AuthProvider>
    </React.StrictMode>
  );
}

bootstrap().catch((error) => {
  console.error("Error al inicializar MSAL:", error);
  mostrarErrorPantalla("No se pudo inicializar la autenticación de Azure", detalleError(error));
});
