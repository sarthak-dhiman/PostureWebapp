from django.urls import path
from . import desktop_views

urlpatterns = [
    # Auth
    path('auth/login', desktop_views.login_view, name='desktop-login'),
    path('auth/verify', desktop_views.verify_view, name='desktop-verify'),
    path('auth/google', desktop_views.google_auth_start, name='desktop-google-auth'),
    path('auth/google/complete', desktop_views.google_auth_complete, name='desktop-google-complete'),
    path('auth/google/poll', desktop_views.google_auth_poll, name='desktop-google-poll'),
    path('auth/google/callback', desktop_views.google_auth_callback, name='desktop-google-callback'),
    path('auth/signup', desktop_views.signup_start, name='desktop-signup-start'),
    path('auth/signup/complete', desktop_views.signup_complete, name='desktop-signup-complete'),
    
    # Org
    path('org/join', desktop_views.org_join, name='desktop-org-join'),
    path('org/create', desktop_views.org_create, name='desktop-org-create'),
]
