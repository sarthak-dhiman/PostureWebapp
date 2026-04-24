/**
 * Global CSRF Fetch Wrapper for Posture OS
 *
 * This utility intercepts fetch requests to inject Django's CSRF token for mutating
 * methods (POST, PUT, DELETE, PATCH). It handles calling the /api/v1/auth/csrf/ endpoint
 * if a token isn't already present in cookies.
 */

// Backend API server URL (Django/DRF)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Constructs the full backend API URL from a relative path.
 * Ensures frontend calls go to the backend server, not to itself.
 */
export function getApiUrl(path: string): string {
    if (path.startsWith('http')) {
        return path; // Already absolute
    }
    return `${API_BASE_URL}${path}`;
}

export function getCookie(name: string): string | null {
    if (typeof document === "undefined") return null; // Server-side check
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
    return null;
}

export async function ensureCsrfToken(baseUrl: string) {
    let token = getCookie('csrftoken');
    if (!token) {
        try {
            await fetch(`${baseUrl}/api/v1/auth/csrf/`, {
                method: 'GET',
                // This 'include' ensures cookies (like the CSRF token) are saved
                credentials: 'include',
            });
            token = getCookie('csrftoken');
        } catch (error) {
            console.error("Failed to fetch initial CSRF token", error);
        }
    }
    return token;
}

export async function apiFetch(url: string | URL | Request, options: RequestInit = {}) {
    // Only intercept client-side requests (window is defined)
    if (typeof window !== "undefined") {
        // Safe methods don't need CSRF tokens
        const method = (options.method || 'GET').toUpperCase();
        const requiresCsrf = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

        if (requiresCsrf) {
            // Same-origin relative URLs are resolved against the page; use API base for backend CSRF.
            const baseUrl = typeof url === 'string' && url.startsWith('http')
                ? new URL(url).origin
                : API_BASE_URL;

            const token = await ensureCsrfToken(baseUrl);

            if (token) {
                options.headers = {
                    ...options.headers,
                    'X-CSRFToken': token,
                };
            }

            // Ensure we send cookies along so Django can match the header to the cookie
            options.credentials = 'include';
        }
        // For same-origin/API requests, include credentials by default so GET requests
        // that rely on session cookies (authenticated endpoints) work without needing
        // callers to explicitly set `credentials` each time.
        if (!options.credentials) {
            options.credentials = 'include';
        }
    }

    return fetch(url, options);
}
