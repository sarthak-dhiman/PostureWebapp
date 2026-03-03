import hashlib

from django.apps import apps
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed


class ApiKeyAuthentication(BaseAuthentication):
    """
    Custom DRF authentication class for headless clients (CCTV nodes, FastAPI backend).

    Protocol:
        Authorization: ApiKey <raw_key>

    The raw key is hashed with SHA-256 and looked up against the ServiceAccount table.
    If found and active, `request.user` is set to the ServiceAccount instance so that
    downstream views can branch on `isinstance(request.user, ServiceAccount)`.
    """

    SCHEME = 'ApiKey'

    def authenticate(self, request):
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')

        if not auth_header:
            return None  # No Authorization header — let other authenticators run.

        parts = auth_header.split()

        if len(parts) != 2:
            return None  # Malformed header — not our scheme; pass.

        scheme, raw_key = parts

        if scheme != self.SCHEME:
            return None  # Different scheme (e.g. Bearer for JWT) — not ours; pass.

        # Hash the raw key and look it up.
        key_hash = hashlib.sha256(raw_key.encode('utf-8')).hexdigest()

        ServiceAccount = apps.get_model('core_api', 'ServiceAccount')
        try:
            account = ServiceAccount.objects.select_related('organization').get(
                api_key_hash=key_hash,
                is_active=True,
            )
        except ServiceAccount.DoesNotExist:
            raise AuthenticationFailed('Invalid or inactive API key.')

        # DRF convention: return (user, auth). We use the ServiceAccount as the
        # "user" so request.user is always populated with a meaningful identity.
        return (account, None)

    def authenticate_header(self, request):
        """Returned in the WWW-Authenticate header on 401 responses."""
        return self.SCHEME
