from django.urls import path
from .views import LogIngestView, UserProfileView, GoogleOAuthBeginView, GoogleOAuthCallbackView, GoogleOAuthPollView, UserRegistrationView, GoogleOAuthWebVerifyView, JoinOrganizationView, OrganizationDetailView, UpgradeToOrganizationView
from .billing import CreateCheckoutSessionView, CustomerPortalView, StripeWebhookView, GiftCheckoutSessionView
from . import cctv_views

app_name = 'core_api'

urlpatterns = [
    # Telemetry
    path('logs/ingest/', LogIngestView.as_view(), name='log-ingest'),
    
    # User / Auth Sync
    path('auth/register/', UserRegistrationView.as_view(), name='auth-register'),
    path('auth/google/', GoogleOAuthBeginView.as_view(), name='auth-google-begin'),
    path('auth/google/callback/', GoogleOAuthCallbackView.as_view(), name='auth-google-callback'),
    path('auth/google/verify/', GoogleOAuthWebVerifyView.as_view(), name='auth-google-verify'),
    path('auth/google/poll/', GoogleOAuthPollView.as_view(), name='auth-google-poll'),
    path('users/me/', UserProfileView.as_view(), name='user-profile'),
    path('orgs/join/', JoinOrganizationView.as_view(), name='org-join'),
    path('orgs/me/', OrganizationDetailView.as_view(), name='org-detail'),
    path('orgs/upgrade/', UpgradeToOrganizationView.as_view(), name='org-upgrade'),
    
    # Billing
    path('billing/checkout/', CreateCheckoutSessionView.as_view(), name='billing-checkout'),
    path('billing/gift/checkout/', GiftCheckoutSessionView.as_view(), name='billing-gift-checkout'),
    path('billing/customer-portal/', CustomerPortalView.as_view(), name='billing-portal'),
    path('billing/webhook/', StripeWebhookView.as_view(), name='billing-webhook'),

    # --- CCTV Cloud Edge APIs ---
    path('cctv/nodes/register/', cctv_views.CCTVNodeRegisterView.as_view(), name='cctv_register'),
    path('cctv/nodes/telemetry/', cctv_views.CCTVNodeTelemetryView.as_view(), name='cctv_telemetry'),
    path('cctv/events/log/', cctv_views.CCTVEventLogView.as_view(), name='cctv_events'),
]
