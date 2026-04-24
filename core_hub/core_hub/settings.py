"""
Django settings for core_hub project — Multi-Tenant Digital Health & Safety OS.
"""

from pathlib import Path
from datetime import timedelta
import environ
import os

# ─── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent

# ─── Environment ──────────────────────────────────────────────────────────────
env = environ.Env(
    DEBUG=(bool, True),
    ALLOWED_HOSTS=(list, ['127.0.0.1', 'localhost']),
)
environ.Env.read_env(BASE_DIR / '.env')  # reads .env if present; silent if missing

SECRET_KEY = env('SECRET_KEY', default='django-insecure-change-me-in-production')
DEBUG = env('DEBUG')
ALLOWED_HOSTS = env('ALLOWED_HOSTS') + ['testserver']  # 'testserver' required by Django test client

# ─── Stripe ───────────────────────────────────────────────────────────────────
STRIPE_PUBLIC_KEY = env('STRIPE_PUBLIC_KEY', default='pk_test_placeholder')
STRIPE_SECRET_KEY = env('STRIPE_SECRET_KEY', default='sk_test_placeholder')
STRIPE_WEBHOOK_SECRET = env('STRIPE_WEBHOOK_SECRET', default='whsec_placeholder')

# ─── Razorpay (subscriptions, gifts, webhooks) ──────────────────────────────
RAZORPAY_KEY_ID = env('RAZORPAY_KEY_ID', default='')
RAZORPAY_KEY_SECRET = env('RAZORPAY_KEY_SECRET', default='')
RAZORPAY_WEBHOOK_SECRET = env('RAZORPAY_WEBHOOK_SECRET', default='')

# Cloudflare Turnstile secret (server-side). Keep empty in production only if
# you intend to use a different CAPTCHA provider. For local development set
# this in your .env or rely on DEBUG-mode bypass in the verifier.
TURNSTILE_SECRET_KEY = env('TURNSTILE_SECRET_KEY', default=None)


# ─── Google OAuth ─────────────────────────────────────────────────────────────
GOOGLE_OAUTH_CLIENT_ID = env('GOOGLE_OAUTH_CLIENT_ID', default='')
GOOGLE_OAUTH_CLIENT_SECRET = env('GOOGLE_OAUTH_CLIENT_SECRET', default='')
GOOGLE_OAUTH_REDIRECT_URI = env('GOOGLE_OAUTH_REDIRECT_URI', default='http://localhost:8000/api/v1/auth/google/callback/')


# ─── Application Definition ───────────────────────────────────────────────────
INSTALLED_APPS = [
    'daphne',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third-party
    'rest_framework',
    'corsheaders',
    'drf_spectacular',

    # Local (use full dotted paths because apps live inside the core_hub package)
    'core_api',
    'telemetry',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'core_hub.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'core_hub.wsgi.application'
ASGI_APPLICATION = 'core_hub.asgi.application'

# ─── Channels ────────────────────────────────────────────────────────────────
# Use in-memory channel layer — both the edge agent and the browser connect
# to the same Daphne process, so no external broker is needed for CCTV relay.
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels.layers.InMemoryChannelLayer',
    },
}

# ─── Custom User Model ────────────────────────────────────────────────────────
# Use app_label.ModelName format (app_label is the last component of AppConfig.name)
AUTH_USER_MODEL = 'core_api.CustomUser'

# ─── Database ─────────────────────────────────────────────────────────────────
# Default: SQLite for local development.
# Switch to PostgreSQL in production by setting DATABASE_URL in your .env:
#   DATABASE_URL=postgres://user:pass@host:5432/dbname
DATABASES = {
    'default': env.db(
        'DATABASE_URL',
        default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}"
    )
}

# ─── Cache ────────────────────────────────────────────────────────────────────
# Required for DRF Throttling to function across requests
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'unique-snowflake',
    }
}

# ─── Password Validation ──────────────────────────────────────────────────────
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# ─── Internationalisation ─────────────────────────────────────────────────────
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# ─── Static Files ─────────────────────────────────────────────────────────────
STATIC_URL = 'static/'
STATIC_ROOT = env('STATIC_ROOT', default=os.path.join(BASE_DIR, 'staticfiles'))

# ─── Default PK ───────────────────────────────────────────────────────────────
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ─── CORS ─────────────────────────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
CORS_ALLOW_CREDENTIALS = True

# ─── CSRF Protection for SPA ──────────────────────────────────────────────────
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
CSRF_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_HTTPONLY = False  # Allows the React frontend to read it
CSRF_USE_SESSIONS = False

# ─── Django REST Framework ────────────────────────────────────────────────────
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
        'core_api.authentication.ApiKeyAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'core_api.permissions.EnforceCSRFPermission',
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
        'rest_framework.throttling.ScopedRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '100/minute',
        'user': '1000/minute',
        'login_attempt': '5/minute',
        'register_attempt': '10/hour',
    }
}

# ─── DRF Spectacular ────────────────────────────────────────────────────────
SPECTACULAR_SETTINGS = {
    'TITLE': 'Posture Webapp API',
    'DESCRIPTION': 'Public API for Posture OS, Organization Management, and Camera Gateway.',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'COMPONENT_SPLIT_REQUEST': True,
}

# ─── Simple JWT ───────────────────────────────────────────────────────────────
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(days=7),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
}

# --- SMTP Email Configuration ---
if env('EMAIL_HOST', default=None):
    EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
    EMAIL_HOST = env('EMAIL_HOST')
    EMAIL_PORT = env.int('EMAIL_PORT', default=587)
    EMAIL_USE_TLS = env.bool('EMAIL_USE_TLS', default=True)
    EMAIL_HOST_USER = env('EMAIL_HOST_USER', default='')
    EMAIL_HOST_PASSWORD = env('EMAIL_HOST_PASSWORD', default='')
    DEFAULT_FROM_EMAIL = env('DEFAULT_FROM_EMAIL', default=EMAIL_HOST_USER)
else:
    # Output emails to the console during local development if SMTP keys aren't set
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
    DEFAULT_FROM_EMAIL = "noreply@posturewebapp.local"
