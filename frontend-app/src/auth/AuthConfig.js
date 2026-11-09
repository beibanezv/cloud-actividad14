// ---------------------------------------------------------------------------
// AZURE ENTRA ID
// ---------------------------------------------------------------------------

export const msalConfig = {
    // auth: {
    //     clientId: "57750927-6116-478c-a047-d06caa8fcd00",       // Reemplaza con el Application (client) ID de tu registro en Azure AD / Entra ID
    //     authority: "https://login.microsoftonline.com/e5372bf0-c5e3-4286-887c-79069f209c1f", // Reemplaza con tu Directory (tenant) ID o usa "common" si es multi-tenant
    //     redirectUri: "https://9qc1pyqai1.execute-api.us-east-1.amazonaws.com/desarrollo/",    // Debe coincidir exactamente con la URL configurada en las Redirect URIs de Azure
    //     postLogoutRedirectUri: "https://9qc1pyqai1.execute-api.us-east-1.amazonaws.com/desarrollo/",
    // },
     auth: {
        clientId: "57750927-6116-478c-a047-d06caa8fcd00",       // Reemplaza con el Application (client) ID de tu registro en Azure AD / Entra ID
        authority: "https://login.microsoftonline.com/e5372bf0-c5e3-4286-887c-79069f209c1f", // Reemplaza con tu Directory (tenant) ID o usa "common" si es multi-tenant
        redirectUri: "http://localhost:5173",    // Debe coincidir exactamente con la URL configurada en las Redirect URIs de Azure
        postLogoutRedirectUri: "http://localhost:5173",
    },
    cache: {
        cacheLocation: "sessionStorage",         // Dónde se guardan los datos de la sesión ("sessionStorage" o "localStorage")
        storeAuthStateInCookie: false,           // Set to true if you have issues on older browsers
    },
};

// Permisos (scopes) que solicitas al iniciar sesion
export const loginRequest = {
    scopes: ["User.Read"] // Permiso basico para leer el perfil del usuario autenticado de Microsoft Graph
};

// Scopes para consumir TU PROPIO backend (resource server).
// Requiere haber configurado "Expose an API" en el registro de la app en Azure:
// Application ID URI: api://e5ece131-cd6a-469c-b21b-c69aa689316f y scope .read-write .
// Un token con este scope SI es un JWT firmado por el tenant que Spring puede validar;
// los de Graph vienen encriptados y siempre fallarian.
export const apiRequest = {
    scopes: ["api://57750927-6116-478c-a047-d06caa8fcd00/desarrollo/write-read"]
};

// ---------------------------------------------------------------------------
// AWS Cognito
// ---------------------------------------------------------------------------

// Configuracion de la aplicacion cliente del user pool us-east-1_u22bP0W2s.
// El backend valida este mismo issuer: https://cognito-idp.us-east-1.amazonaws.com/us-east-1_u22bP0W2s
export const cognitoAuthConfig = {
    authority: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_u22bP0W2s",
    client_id: "56t4jmnrbmllfp93n818329lq8",
    redirect_uri: "http://localhost:5173",
    response_type: "code",
    scope: "phone openid email",
};

// Dominio de la UI alojada (Hosted UI) del user pool, que es adonde Cognito manda
// al usuario durante el login.
export const cognitoDomain = "https://us-east-1u22bP0W2s.auth.us-east-1.amazoncognito.com";

// A donde regresa el usuario tras cerrar sesion. Debe estar incluida en las
// "URL de salida de sesion permitidas" del cliente de la app en Cognito.
export const cognitoLogoutUri = "http://localhost:5173";

// Cierre de sesion en el Hosted UI de Cognito: ademas de borrar la sesion del
// navegador, invalida la sesion en Cognito. Es el equivalente al logoutRedirect
// de MSAL, por eso no hace falta ninguna libreria para disparar la salida.
export const signOutRedirect = () => {
    const clientId = "56t4jmnrbmllfp93n818329lq8";
    const logoutUri = cognitoLogoutUri;
    window.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`;
};

// Ajustes que consume el <AuthProvider> de react-oidc-context.
// response_type "code" + PKCE: Cognito no admite el flujo implicito.
export const cognitoOidcConfig = {
    ...cognitoAuthConfig,
    post_logout_redirect_uri: cognitoLogoutUri,
    loadUserInfo: false,        // el ID token ya trae email/phone, no hace falta /userInfo
    monitorSession: false,      // el token se renueva a mano, no con iframes silenciosos
    automaticSilentRenew: false
};

// ---------------------------------------------------------------------------
// Sincronizacion entre Azure y Cognito
// ---------------------------------------------------------------------------
// Los dos proveedores regresan por redirect a la MISMA pagina con un ?code=...&state=...
// en el query string. Si los dos lo leen, uno se apropia del codigo del otro y el
// login falla. Por eso se marca en sessionStorage quienategio el redirect y en
// main.jsx solo ese proveedor procesa la respuesta.
export const PENDING_AUTH_PROVIDER_KEY = "pending_auth_provider";
export const AUTH_PROVIDER_AZURE = "azure";
export const AUTH_PROVIDER_COGNITO = "cognito";
