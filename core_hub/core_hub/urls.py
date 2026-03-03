from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenRefreshView
from core_api.views import FlexibleTokenObtainPairView, health_check

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

    # Desktop app specific routes
    path('v1/', include('core_api.desktop_urls')),
]
