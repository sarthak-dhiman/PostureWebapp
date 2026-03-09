from rest_framework.permissions import BasePermission
from django.middleware.csrf import CsrfViewMiddleware

class EnforceCSRFPermission(BasePermission):
    """
    Forces Django's CSRF validation on DRF endpoints.
    Normally, DRF bypasses CSRF checks for Session-less auth (like JWTs).
    This permission intercepts the request and runs it through the standard
    CsrfViewMiddleware validation logic before allowing access.
    """
    def has_permission(self, request, view):
        # We only need to check CSRF for mutating methods.
        # Safe methods (GET, HEAD, OPTIONS) are exempt.
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return True

        # Initialize the standard Django Csrf middleware
        csrf_middleware = CsrfViewMiddleware(get_response=lambda req: None)
        
        # Process the view: explicitly pass it through the CSRF check
        csrf_middleware.process_view(request, None, (), {})
        
        # If the middleware attached a reason (the CSRF check failed)
        reason = getattr(request, 'csrf_processing_done', False) and getattr(request, '_csrf_reject', False)
        
        if reason:
            return False
            
        return True
