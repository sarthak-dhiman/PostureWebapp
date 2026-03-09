from rest_framework.throttling import ScopedRateThrottle

class LoginRateThrottle(ScopedRateThrottle):
    """
    Limits the number of login attempts per IP address.
    """
    scope = 'login_attempt'

class RegistrationRateThrottle(ScopedRateThrottle):
    """
    Limits the number of registration attempts per IP address.
    """
    scope = 'register_attempt'
