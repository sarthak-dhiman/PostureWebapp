from django.urls import path
from .views import LogIngestView, UserProfileView, GoogleOAuthBeginView, GoogleOAuthCallbackView, GoogleOAuthPollView, UserRegistrationView, GoogleOAuthWebVerifyView, JoinOrganizationView, OrganizationDetailView, UpgradeToOrganizationView, QuotaStatusView, QuotaLogView, OrganizationMemberManagementView, OrganizationAddMemberView, VerifyEmailView, CSRFTokenView
from . import billing
from . import views
from . import cctv_views
from . import desktop_views
from . import views_dev

app_name = 'core_api'

urlpatterns = [
    # --- Developer Dashboard & Monitoring ---
    path('dev/metrics/', views_dev.DevMetricsView.as_view(), name='dev-metrics'),
    path('dev/logs/', views_dev.DevLogStreamView.as_view(), name='dev-logs'),
    path('dev/support/', views_dev.SupportPortalDevView.as_view(), name='dev-support-portal'),
    
    # --- User Support ---
    path('support/tickets/', views_dev.SupportTicketView.as_view(), name='support-tickets'),
    path('support/tickets/<uuid:ticket_id>/', views_dev.SupportTicketView.as_view(), name='support-ticket-detail'),
    # Telemetry
    path('logs/ingest/', LogIngestView.as_view(), name='log-ingest'),
    
    # User / Auth Sync
    path('auth/csrf/', CSRFTokenView.as_view(), name='auth-csrf'),
    path('auth/register/', UserRegistrationView.as_view(), name='auth-register'),
    path('auth/verify-email/', VerifyEmailView.as_view(), name='auth-verify-email'),
    path('auth/google/', GoogleOAuthBeginView.as_view(), name='auth-google-begin'),
    path('auth/google/callback/', GoogleOAuthCallbackView.as_view(), name='auth-google-callback'),
    path('auth/google/verify/', GoogleOAuthWebVerifyView.as_view(), name='auth-google-verify'),
    path('auth/google/poll/', GoogleOAuthPollView.as_view(), name='auth-google-poll'),
    path('auth/resend-verification/', views.ResendVerificationView.as_view(), name='auth-resend-verification'),
    path('auth/phone/request/', views.PhoneRequestView.as_view(), name='auth-phone-request'),
    path('auth/phone/verify/', views.PhoneVerifyView.as_view(), name='auth-phone-verify'),
    path('ads/watch/', views.AdWatchView.as_view(), name='ads-watch'),
    path('ads/status/', views.AdStatusView.as_view(), name='ads-status'),
    
    # Desktop Mock Compatibility
    path('auth/google/complete/', desktop_views.google_auth_complete, name='auth-google-complete'),
    path('auth/google/complete', desktop_views.google_auth_complete, name='auth-google-complete-noslash'),
    path('auth/google/callback-desktop/', desktop_views.google_auth_callback, name='auth-google-callback-desktop'),
    path('users/me/', UserProfileView.as_view(), name='user-profile'),
    path('orgs/join/', JoinOrganizationView.as_view(), name='org-join'),
    path('orgs/me/', OrganizationDetailView.as_view(), name='org-detail'),
    path('orgs/me/members/add/', OrganizationAddMemberView.as_view(), name='org-member-add'),
    path('orgs/me/members/<int:user_id>/', OrganizationMemberManagementView.as_view(), name='org-member-manage'),
    path('orgs/upgrade/', UpgradeToOrganizationView.as_view(), name='org-upgrade'),
    
    # Quota
    path('quota/', QuotaStatusView.as_view(), name='quota-status'),
    path('quota/log/', QuotaLogView.as_view(), name='quota-log'),

    # Billing
    path('billing/checkout/', billing.CreateSubscriptionView.as_view(), name='billing-checkout'),
    path('billing/gift/checkout/', billing.GiftCheckoutSessionView.as_view(), name='billing-gift-checkout'),
    path('billing/customer-portal/', billing.CustomerPortalView.as_view(), name='billing-customer-portal'),
    path('billing/webhook/', billing.RazorpayWebhookView.as_view(), name='billing-webhook'),
    path('billing/mock-success/', billing.MockBillingActionView.as_view(), name='billing-mock-success'),
    path('billing/refund/', billing.CreateRefundView.as_view(), name='billing-refund'),
    path('billing/invoices/', billing.InvoiceListView.as_view(), name='billing-invoices'),

    # --- CCTV Cloud Edge APIs ---
    path('cctv/nodes/register/', cctv_views.CCTVNodeRegisterView.as_view(), name='cctv_register'),
    path('cctv/nodes/telemetry/', cctv_views.CCTVNodeTelemetryView.as_view(), name='cctv_telemetry'),
    path('cctv/nodes/<uuid:node_id>/', cctv_views.CCTVNodeDetailView.as_view(), name='cctv_node_detail'),
    path('cctv/events/log/', cctv_views.CCTVEventLogView.as_view(), name='cctv_events'),
    path('cctv/dashboard/nodes/', cctv_views.CCTVDashboardNodesView.as_view(), name='cctv_dashboard_nodes'),
]
