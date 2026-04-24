import requests
from django.conf import settings

def verify_turnstile_token(token: str, ip: str = None) -> bool:
    """
    Verifies a Cloudflare Turnstile token with the Cloudflare API.
    Returns True if valid, False otherwise.
    """
    if not token:
        # Allow bypassing CAPTCHA during local development if DEBUG=True
        if getattr(settings, 'DEBUG', False):
            return True
        return False
        
    secret_key = getattr(settings, 'TURNSTILE_SECRET_KEY', None)

    # If the secret key is not configured, allow a safe bypass during local
    # development when `DEBUG=True`. This keeps developer workflow fast while
    # preserving security in production (where DEBUG is False and a secret is
    # expected). If you need stricter behaviour locally, set a real secret in
    # your .env or docker-compose.
    if not secret_key:
        if getattr(settings, 'DEBUG', False):
            print("WARNING: TURNSTILE_SECRET_KEY not set — bypassing verification in DEBUG mode.")
            return True
        else:
            print("ERROR: TURNSTILE_SECRET_KEY is not set. Rejecting request for security.")
            return False # Reject requests when secret key is not configured
        
    data = {
        'secret': secret_key,
        'response': token
    }
    
    if ip:
        data['remoteip'] = ip
        
    try:
        res = requests.post(
            'https://challenges.cloudflare.com/turnstile/v0/siteverify',
            data=data,
            timeout=5
        )
        if res.ok:
            result = res.json()
            if result.get('success'):
                return True
            else:
                print(f"Turnstile verification failed: {result.get('error-codes')}")
    except requests.exceptions.RequestException as e:
        print(f"Error connecting to Cloudflare: {e}")
        # In the event Cloudflare is down, we must fail open or fail closed. 
        # Typically fail closed for security.
        pass
        
    return False
