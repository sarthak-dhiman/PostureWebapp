from django.contrib import admin
from django.urls import path, include
from django.views.generic import RedirectView
from rest_framework_simplejwt.views import TokenRefreshView
from core_api.views import FlexibleTokenObtainPairView, health_check
import drf_spectacular.views


urlpatterns = [
    path('health', health_check, name='health_check'),
    path('admin/', admin.site.urls),

    # Flexible JWT auth endpoints to support PySide6 Desktop app natively
    path('api/v1/auth/token/', FlexibleTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/v1/auth/login/', FlexibleTokenObtainPairView.as_view(), name='token_obtain_pair_alias'),
    path('api/v1/auth/login', FlexibleTokenObtainPairView.as_view(), name='token_obtain_pair_alias_noslash'),
    path('api/v1/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/v1/auth/verify/', FlexibleTokenObtainPairView.as_view(), name='token_verify'),
    path('api/v1/auth/verify', FlexibleTokenObtainPairView.as_view(), name='token_verify_noslash'),

    # core_api routes
    path('api/v1/', include('core_api.urls')),

    # Legacy fallbacks for /api/auth/login/ requests missing the /v1/ prefix
    path('api/auth/login/', FlexibleTokenObtainPairView.as_view(), name='legacy_auth_login'),
    path('api/auth/login', FlexibleTokenObtainPairView.as_view(), name='legacy_auth_login_noslash'),

    # Desktop app specific routes
    path('v1/', include('core_api.desktop_urls')),

    # Fallback/Backward compatibility for legacy Google OAuth route requested by stale clients
    path('api/auth/oauth/google/init/', RedirectView.as_view(url='/api/v1/auth/google/', permanent=False)),
    
    # OpenAPI Schema and Documentation UI
    path('api/v1/schema/', drf_spectacular.views.SpectacularAPIView.as_view(), name='schema'),
    path('api/v1/schema/swagger-ui/', drf_spectacular.views.SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/v1/schema/redoc/', drf_spectacular.views.SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
]

