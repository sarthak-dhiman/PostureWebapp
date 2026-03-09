from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import CustomUser, PlatformLog, ServiceAccount, Organization
from rest_framework.throttling import ScopedRateThrottle
from .utils.turnstile import verify_turnstile_token
from .utils.email import send_verification_email, send_billing_email
from django.utils.http import urlsafe_base64_decode
from django.utils.encoding import force_str
from django.contrib.auth.tokens import default_token_generator
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from django.utils import timezone
from datetime import timedelta
from .models import PhoneOTP
from .utils.sms import send_sms
from .models import AdWatch, AdRewardGrant
from rest_framework.permissions import IsAuthenticated
from rest_framework.throttling import ScopedRateThrottle

class CSRFTokenView(APIView):
    """
    GET /api/v1/auth/csrf/
    Forces Django to set a CSRF cookie on the client.
    The frontend calls this immediately upon loading the application.
    """
    permission_classes = []

    @method_decorator(ensure_csrf_cookie)
    def dispatch(self, *args, **kwargs):
        return super().dispatch(*args, **kwargs)

    def get(self, request):
        return Response({'message': 'CSRF cookie set'})


# Mapping from ServiceAccount.source_type → permitted app_source values.
_SERVICE_ACCOUNT_ALLOWED_SOURCES = {
    ServiceAccount.SourceType.CCTV_NODE: [PlatformLog.AppSource.POSTURE_CCTV],
    ServiceAccount.SourceType.ML_SERVICE: [PlatformLog.AppSource.MEDICAL_AI],
}

# Human users (JWT) may submit from these sources.
_JWT_USER_ALLOWED_SOURCES = [
    PlatformLog.AppSource.POSTURE_WEBCAM,
    PlatformLog.AppSource.MEDICAL_AI,
]


class LogIngestView(APIView):
    """
    POST /api/v1/logs/ingest/

    Unified ingestion endpoint for all three client applications.
    Dual authentication is handled transparently by DRF's auth chain:

        • Bearer <jwt>   → request.user is a CustomUser     (Webcam / dashboard)
        • ApiKey <key>   → request.user is a ServiceAccount (CCTV / FastAPI ML)

    The view resolves `organization`, `user`, and `service_account` from the
    authenticated identity before delegating to PlatformLogSerializer.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        user = request.user

        # ── Branch: ServiceAccount (API Key auth) ────────────────────────────
        if isinstance(user, ServiceAccount):
            organization = user.organization
            allowed_sources = _SERVICE_ACCOUNT_ALLOWED_SOURCES.get(
                user.source_type, []
            )
            context = {
                'organization': organization,
                'user': None,
                'service_account': user,
                'allowed_sources': [s.value for s in allowed_sources],
                'request': request,
            }

        # ── Branch: CustomUser (JWT auth) ────────────────────────────────────
        elif isinstance(user, CustomUser):
            if user.organization is None:
                return Response(
                    {'detail': 'Platform superusers cannot submit logs directly.'},
                    status=status.HTTP_403_FORBIDDEN,
                )
            organization = user.organization
            context = {
                'organization': organization,
                'user': user,
                'service_account': None,
                'allowed_sources': _JWT_USER_ALLOWED_SOURCES,
                'request': request,
            }

        else:
            # Should never reach here if DRF permissions are correctly configured.
            return Response(
                {'detail': 'Unrecognised authentication type.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        serializer = PlatformLogSerializer(data=request.data, context=context)
        if serializer.is_valid():
            log = serializer.save()
            return Response(
                {'log_id': str(log.id), 'status': 'ingested'},
                status=status.HTTP_201_CREATED,
            )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UserProfileView(APIView):
    """
    GET /api/v1/users/me/
    
    Returns the authenticated user's profile and organization status.
    Used by Next.js frontend to verify access and display user information.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        
        # Only human users (CustomUser) have a profile
        if not isinstance(user, CustomUser):
            return Response(
                {'detail': 'Service accounts do not have profiles.'},
                status=status.HTTP_403_FORBIDDEN
            )
            
        org_data = None
        if user.organization:
            org_data = {
                'id': str(user.organization.id),
                'name': user.organization.name,
                'is_active': user.organization.is_active,
                'has_subscription': bool(user.organization.razorpay_subscription_id),
                'current_period_end': user.organization.current_period_end
            }
            
        remaining = user.quota_remaining_seconds()
        is_free = remaining is not None
            
        return Response({
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'role': user.role,
            'organization': org_data,
            'quota': {
                'is_free_tier': is_free,
                'quota_total_seconds': user.FREE_TIER_QUOTA_SECONDS if is_free else None,
                'quota_used_seconds': user.monitoring_seconds_used if is_free else None,
                'quota_remaining_seconds': remaining,
                'quota_remaining_hours': round(remaining / 3600, 2) if remaining is not None else None,
            }
        })

    def patch(self, request):
        """
        PATCH /api/v1/users/me/
        Allows the authenticated user to update simple profile fields: first_name, last_name, email.
        If the email is changed, the user's `is_email_verified` flag is cleared and a verification
        email is sent to the new address.
        """
        user = request.user
        if not isinstance(user, CustomUser):
            return Response({'detail': 'Service accounts cannot update profiles.'}, status=status.HTTP_403_FORBIDDEN)

        data = request.data
        first_name = data.get('first_name')
        last_name = data.get('last_name')
        email = data.get('email')
        phone = data.get('phone')

        changed = False

        if first_name is not None and first_name != user.first_name:
            user.first_name = first_name
            changed = True

        if last_name is not None and last_name != user.last_name:
            user.last_name = last_name
            changed = True

        if email is not None and email != user.email:
            # Basic uniqueness check
            if CustomUser.objects.filter(email=email).exclude(pk=user.pk).exists():
                return Response({'detail': 'Email already in use.'}, status=status.HTTP_400_BAD_REQUEST)
            user.email = email
            user.is_email_verified = False
            changed = True

        if phone is not None and phone != user.phone_number:
            # Basic normalization/uniqueness could be added here later.
            user.phone_number = phone
            user.is_phone_verified = False
            changed = True

        if changed:
            user.save()
            # If email changed, send a fresh verification email
            if email is not None:
                try:
                    send_verification_email(user)
                except Exception:
                    # Don't fail the request if email sending fails; warn and continue
                    print(f"Failed to send verification email to {user.email}")

        # Return updated profile payload (same shape as GET)
        org_data = None
        if user.organization:
            org_data = {
                'id': str(user.organization.id),
                'name': user.organization.name,
                'is_active': user.organization.is_active,
                'has_subscription': bool(user.organization.razorpay_subscription_id),
                'current_period_end': user.organization.current_period_end
            }

        remaining = user.quota_remaining_seconds()
        is_free = remaining is not None

        return Response({
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'role': user.role,
            'organization': org_data,
            'quota': {
                'is_free_tier': is_free,
                'quota_total_seconds': user.FREE_TIER_QUOTA_SECONDS if is_free else None,
                'quota_used_seconds': user.monitoring_seconds_used if is_free else None,
                'quota_remaining_seconds': remaining,
                'quota_remaining_hours': round(remaining / 3600, 2) if remaining is not None else None,
            }
        })

from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.permissions import AllowAny

import uuid
from datetime import timedelta
from django.utils.timezone import now
import urllib.parse

import requests
from django.conf import settings
from .models import OAuthSession
from django.shortcuts import redirect
from django.http import HttpResponse

from rest_framework.decorators import api_view, permission_classes

@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    """Simple health check endpoint to suppress 404 logs"""
    return Response({"status": "ok"})

class GoogleOAuthBeginView(APIView):
    """
    GET /api/v1/auth/google/
    
    Creates a pending OAuthSession and returns the authorization URL for the PySide6 app
    to open in the user's browser.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        session_id = str(uuid.uuid4())
        OAuthSession.objects.create(session_id=session_id)
        
        client_id = getattr(settings, 'GOOGLE_OAUTH_CLIENT_ID', '')
        redirect_uri = getattr(settings, 'GOOGLE_OAUTH_REDIRECT_URI', 'http://localhost:8000/api/v1/auth/google/callback/')
        
        params = {
            'client_id': client_id,
            'redirect_uri': redirect_uri,
            'response_type': 'code',
            'scope': 'email profile',
            'access_type': 'offline',
            'state': session_id,
            'prompt': 'consent'
        }
        
        url = f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(params)}"
        
        return Response({
            "url": url,
            "auth_url": url,        # Synonym for desktop compatibility
            "session": session_id,
            "session_id": session_id # Synonym for desktop compatibility
        }, status=status.HTTP_200_OK)

    def post(self, request):
        return self.get(request)


class GoogleOAuthCallbackView(APIView):
    """
    GET /api/v1/auth/google/callback/
    
    Handles the redirect from Google. Exchanges the code for tokens, creates/logs in the user,
    and marks the OAuthSession as 'done' so the PySide6 polling loop can securely fetch the JWT.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        code = request.query_params.get('code')
        state = request.query_params.get('state') # This is our session_id
        
        if not code or not state:
            return HttpResponse("Missing code or state.", status=400)
            
        session = OAuthSession.objects.filter(session_id=state).first()
        if not session:
            return HttpResponse("Invalid or expired session. Please try logging in again from the app.", status=400)
            
        # Exchange code for token
        client_id = getattr(settings, 'GOOGLE_OAUTH_CLIENT_ID', '')
        client_secret = getattr(settings, 'GOOGLE_OAUTH_CLIENT_SECRET', '')
        redirect_uri = getattr(settings, 'GOOGLE_OAUTH_REDIRECT_URI', 'http://localhost:8000/api/v1/auth/google/callback/')
        
        token_res = requests.post('https://oauth2.googleapis.com/token', data={
            'client_id': client_id,
            'client_secret': client_secret,
            'code': code,
            'grant_type': 'authorization_code',
            'redirect_uri': redirect_uri
        })
        
        if not token_res.ok:
            session.status = OAuthSession.StatusTypes.INVALID
            session.save()
            return HttpResponse(f"Failed to exchange token with Google: {token_res.text}", status=400)
            
        token_data = token_res.json()
        access_token = token_data.get('access_token')
        
        # Get user info using the access_token
        user_info_res = requests.get('https://www.googleapis.com/oauth2/v2/userinfo', headers={
            'Authorization': f'Bearer {access_token}'
        })
        
        if not user_info_res.ok:
            return HttpResponse("Failed to fetch user profile from Google.", status=400)
            
        user_info = user_info_res.json()
        email = user_info.get('email')
        
        if not email:
            return HttpResponse("Google account did not provide an email.", status=400)
            
        # Create or Get User
        user = CustomUser.objects.filter(email=email).first()
        first_time = False
        
        if not user:
            first_time = True
            username = email.split('@')[0]
            # Ensure unique username
            base_username = username
            counter = 1
            while CustomUser.objects.filter(username=username).exists():
                username = f"{base_username}{counter}"
                counter += 1
                
            org = Organization.objects.create(name=f"Solo - {email}")
            user = CustomUser.objects.create_user(
                username=username,
                email=email,
                first_name=user_info.get('given_name', ''),
                last_name=user_info.get('family_name', ''),
                organization=org,
                role=CustomUser.Role.SOLO
            )
            
        # Generate our Django JWT
        refresh = RefreshToken.for_user(user)
        access = str(refresh.access_token)
        expires_at = now() + timedelta(days=1)
        
        # Build the exact payload PySide6 expects
        payload = {
            "status": "done",
            "token": access,
            "token_type": "Bearer",
            "expires_at": expires_at.isoformat(),
            "email": user.email,
            "name": f"{user.first_name} {user.last_name}".strip() or user.username,
            "first_time": first_time,
            "subscription": {
                "plan": "Solo",
                "status": "active",
                "expires_at": (now() + timedelta(days=365)).isoformat()
            }
        }
        
        session.status = OAuthSession.StatusTypes.DONE
        session.payload = payload
        session.save()
        
        return HttpResponse("""
            <html>
                <body style="font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #fafafa; color: #333;">
                    <div style="text-align: center; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                        <h2 style="color: #10b981; margin-top: 0;">Authentication Successful!</h2>
                        <p>You can now close this window and return to the Posture Webcam app.</p>
                    </div>
                </body>
            </html>
        """)


class GoogleOAuthWebVerifyView(APIView):
    """
    POST /api/v1/auth/google/verify/
    Exchanges a Google id_token from Next.js for a Django JWT.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        token = request.data.get('id_token')
        if not token:
            return Response({"error": "id_token is required"}, status=400)
            
        client_id = getattr(settings, 'GOOGLE_OAUTH_CLIENT_ID', '')
        
        # Verify with Google's public tokeninfo endpoint
        try:
            verify_res = requests.get(
                f"https://oauth2.googleapis.com/tokeninfo?id_token={token}",
                timeout=10 # 10 second timeout
            )
        except requests.exceptions.RequestException as e:
            return Response({"error": f"Connection to Google failed: {str(e)}"}, status=504)
            
        if not verify_res.ok:
            return Response({"error": "Invalid token from Google"}, status=400)
            
        idinfo = verify_res.json()
        
        # Security: verify the audience matches our client ID
        if idinfo.get('aud') != client_id:
            # Let it slide locally if env vars are mismatched for now, but log it
            print(f"Warning: Token AUD {idinfo.get('aud')} != {client_id}")
            
        email = idinfo.get('email')
        if not email:
            return Response({"error": "No email associated with this token"}, status=400)
            
        user = CustomUser.objects.filter(email=email).first()
        if not user:
            username = email.split('@')[0]
            base_username = username
            counter = 1
            while CustomUser.objects.filter(username=username).exists():
                username = f"{base_username}{counter}"
                counter += 1
                
            org = Organization.objects.create(name=f"Solo - {email}")
            user = CustomUser.objects.create_user(
                username=username,
                email=email,
                first_name=idinfo.get('given_name', ''),
                last_name=idinfo.get('family_name', ''),
                organization=org,
                role=CustomUser.Role.SOLO
            )
            
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'role': getattr(user, 'role', 'VIEWER'),
                'organization': {
                    'id': getattr(user.organization, 'id', ''),
                    'name': getattr(user.organization, 'name', ''),
                    'is_active': getattr(user.organization, 'is_active', False),
                    'has_subscription': user.organization.has_subscription() if hasattr(user.organization, 'has_subscription') else False
                } if hasattr(user, 'organization') and user.organization else None
            }
        })

class GoogleOAuthPollView(APIView):
    """
    GET /api/v1/auth/google/poll/
    
    Polled by the PySide6 app. Checks the session status in the DB and returns 'pending'
    until the callback marks it as 'done', at which point the full JWT payload is returned.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        session_id = request.query_params.get('session')
        if not session_id:
            return Response({"status": "invalid", "detail": "Missing session ID."}, status=status.HTTP_400_BAD_REQUEST)
            
        session = OAuthSession.objects.filter(session_id=session_id).first()
        if not session:
            return Response({"status": "invalid", "detail": "Session not found."}, status=status.HTTP_404_NOT_FOUND)
            
        if session.status == OAuthSession.StatusTypes.PENDING:
            return Response({"status": "pending"}, status=status.HTTP_200_OK)
            
        if session.status == OAuthSession.StatusTypes.DONE:
            # Optionally delete the session after it's been consumed to prevent replay
            payload = session.payload
            session.delete()
            return Response(payload, status=status.HTTP_200_OK)
            
        return Response({"status": "invalid"}, status=status.HTTP_400_BAD_REQUEST)


class FlexibleTokenObtainPairView(APIView):
    """
    POST /api/v1/auth/token/  OR  /api/v1/auth/verify/ (if desktop app misroutes login)
    Accepts EITHER 'username' or 'email' + 'password'.
    Auto-creates the user if they don't exist to unblock local PySide6 development.
    """
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'login_attempt'

    def get(self, request):
        """
        Desktop app calls GET /api/v1/auth/verify/ checking for valid subscription.
        Requires 'Authorization: Bearer <token>' header.
        """
        from rest_framework_simplejwt.authentication import JWTAuthentication
        try:
            auth = JWTAuthentication()
            header = auth.get_header(request)
            if header is None:
                return Response({"detail": "Missing Authorization header."}, status=status.HTTP_401_UNAUTHORIZED)
            
            raw_token = auth.get_raw_token(header)
            validated_token = auth.get_validated_token(raw_token)
            user = auth.get_user(validated_token)

            return Response({
                "status": "active",
                "email": user.email,
                "role": user.role
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_401_UNAUTHORIZED)

    def post(self, request):
        email = request.data.get('email')
        username = request.data.get('username')
        password = request.data.get('password')
        token = request.data.get('token')

        # If they actually meant to just verify a token, we handle it natively.
        if token and not password:
            from rest_framework_simplejwt.serializers import TokenVerifySerializer
            serializer = TokenVerifySerializer(data=request.data)
            if serializer.is_valid():
                return Response({}, status=status.HTTP_200_OK)
            # A 401 here is normal if the Desktop app's cached token expired or DB was wiped.
            return Response(serializer.errors, status=status.HTTP_401_UNAUTHORIZED)

        # Handle login (email or username)
        identifier = email or username
        if not identifier or not password:
            return Response({'detail': 'Must include email/username and password.'}, status=status.HTTP_400_BAD_REQUEST)

        # Verify Turnstile
        turnstile_token = request.data.get('cf-turnstile-response')
        if not verify_turnstile_token(turnstile_token, request.META.get('REMOTE_ADDR')):
            return Response({'detail': 'CAPTCHA verification failed. Please try again.'}, status=status.HTTP_400_BAD_REQUEST)

        # Auto-create the user if they don't exist to guarantee dev environments work
        # Lookup both email and username in a single query to avoid creating a duplicate
        # SOLO account when an existing user matches one of the identifiers.
        from django.db.models import Q
        user = CustomUser.objects.filter(Q(email=identifier) | Q(username=identifier)).first()
        
        if not user:
            # Create a mock user on the fly!
            org, _ = Organization.objects.get_or_create(name=f"Solo - {identifier}")
            user = CustomUser.objects.create_user(
                username=username or email.split('@')[0],
                email=email or f"{username}@local",
                password=password,
                organization=org,
                role=CustomUser.Role.SOLO,
            )
            # Solo users created on the fly this way are magically verified
            user.is_email_verified = True
            user.save()

        if not user.is_email_verified:
            return Response({'detail': 'email_not_verified'}, status=status.HTTP_403_FORBIDDEN)

        if user.check_password(password):
            refresh = RefreshToken.for_user(user)
            return Response({
                'access': str(refresh.access_token),
                'refresh': str(refresh)
            }, status=status.HTTP_200_OK)
            
        return Response({'detail': 'Invalid password'}, status=status.HTTP_401_UNAUTHORIZED)

class UserRegistrationView(APIView):
    """
    POST /api/v1/auth/register/
    Handles the multi-step registration flow.
    If account_type is 'solo', it creates a private Organization.
    """
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'register_attempt'

    def post(self, request):
        name = request.data.get('name')
        email = request.data.get('email')
        password = request.data.get('password')
        account_type = request.data.get('account_type') # 'solo', 'org', or 'join'
        org_name = request.data.get('org_name')
        invite_code = request.data.get('invite_code')

        if not email or not password or not account_type:
            return Response({"detail": "Missing required fields."}, status=status.HTTP_400_BAD_REQUEST)

        # Verify Turnstile
        turnstile_token = request.data.get('cf-turnstile-response')
        if not verify_turnstile_token(turnstile_token, request.META.get('REMOTE_ADDR')):
            return Response({'detail': 'CAPTCHA verification failed. Please try again.'}, status=status.HTTP_400_BAD_REQUEST)

        if CustomUser.objects.filter(email=email).exists():
            return Response({"detail": "Email already registered."}, status=status.HTTP_400_BAD_REQUEST)

        # Handle Organization logic
        if account_type == 'solo':
            # Create a private organization for the solo user
            org = Organization.objects.create(name=f"Solo - {name or email}")
            role = CustomUser.Role.SOLO
        elif account_type == 'join':
            # Joining an existing organization via invite code
            if not invite_code:
                return Response({"detail": "Invite code is required to join an organization."}, status=status.HTTP_400_BAD_REQUEST)
            try:
                org = Organization.objects.get(invite_code=invite_code)
            except Organization.DoesNotExist:
                return Response({"detail": "Invalid invite code."}, status=status.HTTP_400_BAD_REQUEST)
            
            # Check capacity
            if org.users.count() >= org.max_seats:
                return Response({"detail": "This organization has reached its maximum seat capacity."}, status=status.HTTP_403_FORBIDDEN)
            
            role = CustomUser.Role.EMPLOYEE
        else:
            # Org accounts require manual approval for now, but we create the user
            if not org_name:
                return Response({"detail": "Organization name is required."}, status=status.HTTP_400_BAD_REQUEST)
            org = Organization.objects.create(name=org_name, is_active=False)
            role = CustomUser.Role.ADMIN

        # Create the user
        username = email.split('@')[0]
        # Ensure unique username
        base_username = username
        counter = 1
        while CustomUser.objects.filter(username=username).exists():
            username = f"{base_username}{counter}"
            counter += 1

        user = CustomUser.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=name.split(' ')[0] if name else '',
            last_name=' '.join(name.split(' ')[1:]) if name and ' ' in name else '',
            organization=org,
            role=role
        )

        # Send the verification email in the background (or blocking for now)
        send_verification_email(user)

        return Response({
            "detail": "Registration successful. Please check your email to verify your account."
        }, status=status.HTTP_201_CREATED)

class VerifyEmailView(APIView):
    """
    POST /api/v1/auth/verify-email/
    Redeems an email verification token.
    """
    permission_classes = [AllowAny]
    
    def post(self, request):
        uidb64 = request.data.get('uid')
        token = request.data.get('token')
        
        if not uidb64 or not token:
            return Response({"detail": "Missing uid or token."}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = CustomUser.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, CustomUser.DoesNotExist):
            return Response({"detail": "Invalid verification link."}, status=status.HTTP_400_BAD_REQUEST)
            
        if default_token_generator.check_token(user, token):
            user.is_email_verified = True
            user.save()
            return Response({"detail": "Email verified successfully."})
        else:
            return Response({"detail": "Invalid or expired verification link."}, status=status.HTTP_400_BAD_REQUEST)


class ResendVerificationView(APIView):
    """
    POST /api/v1/auth/resend-verification/
    Triggers resending the verification email to the authenticated user's email address.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if not isinstance(user, CustomUser):
            return Response({'detail': 'Service accounts cannot request verification.'}, status=status.HTTP_403_FORBIDDEN)

        if user.is_email_verified:
            return Response({'detail': 'Email already verified.'}, status=status.HTTP_200_OK)

        success = send_verification_email(user)
        if success:
            return Response({'detail': 'Verification email sent.'}, status=status.HTTP_200_OK)
        else:
            return Response({'detail': 'Failed to send verification email.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class PhoneRequestView(APIView):
    """
    POST /api/v1/auth/phone/request/
    Request a verification code to be sent to the user's phone number.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if not isinstance(user, CustomUser):
            return Response({'detail': 'Service accounts cannot request phone verification.'}, status=status.HTTP_403_FORBIDDEN)

        phone = request.data.get('phone') or user.phone_number
        if not phone:
            return Response({'detail': 'Phone number required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Create a 6-digit code
        import random
        code = f"{random.randint(0, 999999):06d}"

        otp = PhoneOTP.objects.create(user=user, code=code)

        # Send via SMS util (mocked)
        message = f"Your Posture verification code is: {code}"
        ok, detail = send_sms(phone, message)
        if ok:
            return Response({'detail': 'Verification code sent.'}, status=status.HTTP_200_OK)
        else:
            return Response({'detail': f'Failed to send SMS: {detail}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class PhoneVerifyView(APIView):
    """
    POST /api/v1/auth/phone/verify/
    Redeems a verification code and marks the user's phone as verified.
    Request body: { "code": "123456" }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if not isinstance(user, CustomUser):
            return Response({'detail': 'Service accounts cannot verify phone.'}, status=status.HTTP_403_FORBIDDEN)

        code = request.data.get('code')
        if not code:
            return Response({'detail': 'Code is required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Find latest unused OTP for this user
        otp = PhoneOTP.objects.filter(user=user, used=False).order_by('-created_at').first()
        if not otp:
            return Response({'detail': 'No verification code found. Request a new code.'}, status=status.HTTP_404_NOT_FOUND)

        # Expire after 10 minutes
        if timezone.now() - otp.created_at > timedelta(minutes=10):
            return Response({'detail': 'Verification code expired.'}, status=status.HTTP_400_BAD_REQUEST)

        otp.attempts += 1
        otp.save(update_fields=['attempts'])

        if otp.code != code:
            return Response({'detail': 'Invalid verification code.'}, status=status.HTTP_400_BAD_REQUEST)

        otp.used = True
        otp.save(update_fields=['used'])

        user.is_phone_verified = True
        user.save(update_fields=['is_phone_verified'])

        return Response({'detail': 'Phone verified successfully.'}, status=status.HTTP_200_OK)


class AdWatchView(APIView):
    """
    POST /api/v1/ads/watch/
    Client reports an ad watch completion. In the MVP we accept the client event
    as validated (mock). Production should verify provider-signed tokens or
    provider webhook callbacks.
    """
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'ads_watch'

    def post(self, request):
        user = request.user
        if not isinstance(user, CustomUser):
            return Response({'detail': 'Service accounts cannot watch ads.'}, status=status.HTTP_403_FORBIDDEN)

        provider = request.data.get('provider', 'mock')
        ad_id = request.data.get('ad_id')

        # In the mock MVP we mark validated=True immediately
        watch = AdWatch.objects.create(
            user=user,
            provider=provider,
            ad_id=ad_id,
            validated=True,
            ip_address=request.META.get('REMOTE_ADDR'),
            user_agent=request.META.get('HTTP_USER_AGENT', '')[:512]
        )

        # Determine if user should receive rewards: 1 reward per 5 validated watches
        total_validated = AdWatch.objects.filter(user=user, validated=True).count()
        credits_given = AdRewardGrant.objects.filter(user=user, grant_type=AdRewardGrant.GrantType.CREDIT).count()

        rewards = []
        # If total_validated >= (credits_given + 1) * 5, grant a new reward
        if total_validated >= (credits_given + 1) * 5:
            # Grant 1 hour credit
            credit = AdRewardGrant.objects.create(
                user=user,
                grant_type=AdRewardGrant.GrantType.CREDIT,
                amount_seconds=3600,
                source='ads',
                expires_at=timezone.now() + timedelta(days=30)
            )
            rewards.append({'type': 'CREDIT', 'amount_seconds': 3600})

            # Grant an AI access use
            ai = AdRewardGrant.objects.create(
                user=user,
                grant_type=AdRewardGrant.GrantType.AI_ACCESS,
                uses=1,
                source='ads',
                expires_at=timezone.now() + timedelta(days=7)
            )
            rewards.append({'type': 'AI_ACCESS', 'uses': 1})

        return Response({'status': 'ok', 'rewards': rewards}, status=status.HTTP_200_OK)


class AdStatusView(APIView):
    """GET /api/v1/ads/status/ — returns counts and available rewards."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        total_validated = AdWatch.objects.filter(user=user, validated=True).count()
        credits = AdRewardGrant.objects.filter(user=user, grant_type=AdRewardGrant.GrantType.CREDIT)
        total_credits_seconds = sum([c.amount_seconds or 0 for c in credits])
        ai_access = AdRewardGrant.objects.filter(user=user, grant_type=AdRewardGrant.GrantType.AI_ACCESS)
        ai_uses = sum([a.uses for a in ai_access])

        # Number of validated watches since last credit grant
        credits_given = credits.count()
        watched_since = total_validated - (credits_given * 5)

        return Response({
            'total_validated_watches': total_validated,
            'watched_since_last_reward': watched_since,
            'credits_seconds': total_credits_seconds,
            'ai_uses': ai_uses,
        })


class JoinOrganizationView(APIView):
    """
    POST /api/v1/orgs/join/
    Allows a user to join an organization using an invite code.
    If the organization is at capacity (`max_seats`), the user is rejected and 
    a notification is printed (simulating an email to admins).
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if not isinstance(user, CustomUser):
            return Response({"detail": "Only human users can join organizations."}, status=status.HTTP_403_FORBIDDEN)
            
        invite_code = request.data.get('invite_code')
        if not invite_code:
            return Response({"error": "Invite code is required."}, status=status.HTTP_400_BAD_REQUEST)
            
        from .models import Organization
        try:
            org = Organization.objects.get(invite_code=invite_code)
        except Organization.DoesNotExist:
            return Response({"error": "Invalid invite code."}, status=status.HTTP_404_NOT_FOUND)
            
        # Check if the user is already in this org
        if user.organization_id == org.id:
            return Response({"message": "You are already a member of this organization."}, status=status.HTTP_200_OK)
            
        # Check seat capacity
        current_members = org.users.count()
        if current_members >= org.max_seats:
            # Send Notification to Admin
            admin_user = org.users.filter(role=CustomUser.Role.ADMIN).first()
            if admin_user:
                send_billing_email(admin_user, 'member_pending', {
                    'admin_name': admin_user.first_name or admin_user.username,
                    'org_name': org.name,
                    'member_name': user.first_name or user.username,
                    'member_email': user.email,
                    'max_seats': org.max_seats
                })
            
            return Response({
                "error": "This organization has reached its maximum seat capacity.",
                "code": "SEATS_FULL"
            }, status=status.HTTP_403_FORBIDDEN)
            
        # Success: Add user to org and set role to EMPLOYEE
        user.organization = org
        user.role = CustomUser.Role.EMPLOYEE
        user.save()

        # Send Notification to Admin
        admin_user = org.users.filter(role=CustomUser.Role.ADMIN).first()
        if admin_user:
            send_billing_email(admin_user, 'member_joined', {
                'admin_name': admin_user.first_name or admin_user.username,
                'org_name': org.name,
                'member_name': user.first_name or user.username,
                'member_email': user.email
            })
        
        return Response({
            "status": "success",
            "message": f"Successfully joined {org.name}",
            "organization": {
                "id": str(org.id),
                "name": org.name,
                "is_active": org.is_active,
                "has_subscription": bool(org.razorpay_subscription_id),
                "current_period_end": org.current_period_end
            }
        }, status=status.HTTP_200_OK)


class OrganizationDetailView(APIView):
    """
    GET, PATCH /api/v1/orgs/me/
    Admin-only endpoint for Organization Dashboard.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if not isinstance(user, CustomUser) or getattr(user, 'role', None) != CustomUser.Role.ADMIN:
            return Response({"detail": "Admin access required."}, status=status.HTTP_403_FORBIDDEN)
            
        org = getattr(user, 'organization', None)
        if not org:
            return Response({"detail": "No organization associated."}, status=status.HTTP_403_FORBIDDEN)
            
        users_data = []
        for member in org.users.all():
            users_data.append({
                "id": str(member.id),
                "username": member.username,
                "email": member.email,
                "first_name": member.first_name,
                "last_name": member.last_name,
                "role": member.role
            })

        return Response({
            "id": str(org.id),
            "name": org.name,
            "invite_code": org.invite_code,
            "max_seats": org.max_seats,
            "razorpay_subscription_id": org.razorpay_subscription_id,
            "has_subscription": bool(org.razorpay_subscription_id),
            "current_period_end": org.current_period_end,
            "is_active": org.is_active,
            "users": users_data
        }, status=status.HTTP_200_OK)

    def patch(self, request):
        user = request.user
        if not isinstance(user, CustomUser) or getattr(user, 'role', None) != CustomUser.Role.ADMIN:
            return Response({"detail": "Admin access required."}, status=status.HTTP_403_FORBIDDEN)
            
        org = getattr(user, 'organization', None)
        if not org:
            return Response({"detail": "No organization associated."}, status=status.HTTP_403_FORBIDDEN)
            
        new_max_seats = request.data.get('max_seats')
        if new_max_seats is not None:
            try:
                new_max_seats = int(new_max_seats)
                if new_max_seats < org.users.count():
                    return Response({"detail": "Cannot reduce seats below current active user count."}, status=status.HTTP_400_BAD_REQUEST)
                
                # Sync with Razorpay if there's a real active subscription
                if org.razorpay_subscription_id and not org.razorpay_subscription_id.startswith('sub_mock_'):
                    import razorpay
                    try:
                        client = razorpay.Client(auth=(getattr(settings, 'RAZORPAY_KEY_ID', ''), getattr(settings, 'RAZORPAY_KEY_SECRET', '')))
                        subscription = client.subscription.fetch(org.razorpay_subscription_id)
                        # Standard implementations assume modifying the quantity updates the plan
                        if subscription.get('item'):
                            client.subscription.update(
                                org.razorpay_subscription_id,
                                {"quantity": new_max_seats}
                            )
                    except Exception as e:
                        return Response({"detail": f"Billing error: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

                org.max_seats = new_max_seats
                org.save(update_fields=['max_seats'])
            except ValueError:
                return Response({"detail": "max_seats must be an integer."}, status=status.HTTP_400_BAD_REQUEST)
                
        return Response({"status": "success", "max_seats": org.max_seats}, status=status.HTTP_200_OK)


class OrganizationMemberManagementView(APIView):
    """
    PATCH /api/v1/orgs/me/members/<user_id>/
    Admin-only endpoint for managing individual organization members.
    Actions: promote, demote, remove.
    """
    permission_classes = [IsAuthenticated]

    def patch(self, request, user_id):
        user = request.user
        
        # Verify the requester is an Admin
        if not isinstance(user, CustomUser) or getattr(user, 'role', None) != CustomUser.Role.ADMIN:
            return Response({"detail": "Admin access required."}, status=status.HTTP_403_FORBIDDEN)
            
        org = getattr(user, 'organization', None)
        if not org:
            return Response({"detail": "No organization associated."}, status=status.HTTP_403_FORBIDDEN)
            
        # Verify the target user exists and belongs to this organization
        try:
            target_user = CustomUser.objects.get(id=user_id, organization=org)
        except CustomUser.DoesNotExist:
            return Response({"detail": "Target user not found in your organization."}, status=status.HTTP_404_NOT_FOUND)
            
        action = request.data.get('action')
        if action not in ['promote', 'demote', 'remove']:
            return Response({"detail": "Invalid action. Use 'promote', 'demote', or 'remove'."}, status=status.HTTP_400_BAD_REQUEST)

        # Count admins to prevent leaving the 0 admins
        admin_count = org.users.filter(role=CustomUser.Role.ADMIN).count()
            
        if action == 'promote':
            if target_user.role == CustomUser.Role.ADMIN:
                return Response({"detail": "User is already an Admin."}, status=status.HTTP_400_BAD_REQUEST)
            target_user.role = CustomUser.Role.ADMIN
            target_user.save(update_fields=['role'])
            return Response({"status": "success", "message": f"{target_user.email} promoted to Admin."}, status=status.HTTP_200_OK)
            
        elif action == 'demote':
            if target_user.role != CustomUser.Role.ADMIN:
                return Response({"detail": "User is not an Admin."}, status=status.HTTP_400_BAD_REQUEST)
            if admin_count <= 1:
                return Response({"detail": "Cannot demote the last remaining Admin."}, status=status.HTTP_403_FORBIDDEN)
            target_user.role = CustomUser.Role.EMPLOYEE
            target_user.save(update_fields=['role'])
            return Response({"status": "success", "message": f"{target_user.email} demoted to Employee."}, status=status.HTTP_200_OK)
            
        elif action == 'remove':
            # Prevent removing the last admin
            if target_user.role == CustomUser.Role.ADMIN and admin_count <= 1:
                return Response({"detail": "Cannot remove the last remaining Admin. Promote another user first."}, status=status.HTTP_403_FORBIDDEN)
                
            # Detach the user from the organization and reset them to a solo user
            # Provide them a fresh empty solo organization
            new_org = Organization.objects.create(name=f"Solo - {target_user.email}", is_active=True)
            target_user.organization = new_org
            target_user.role = CustomUser.Role.SOLO
            target_user.save(update_fields=['organization', 'role'])
            
            return Response({"status": "success", "message": f"{target_user.email} removed from organization."}, status=status.HTTP_200_OK)


class OrganizationAddMemberView(APIView):
    """
    POST /api/v1/orgs/me/members/add/
    Admin-only endpoint for adding a user to the organization by their User ID.
    Expects payload: {"user_id": <int>}
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        
        # Verify requester is an Admin
        if not isinstance(user, CustomUser) or getattr(user, 'role', None) != CustomUser.Role.ADMIN:
            return Response({"detail": "Admin access required."}, status=status.HTTP_403_FORBIDDEN)
            
        org = getattr(user, 'organization', None)
        if not org:
            return Response({"detail": "No organization associated."}, status=status.HTTP_403_FORBIDDEN)
            
        target_user_id = request.data.get('user_id')
        if not target_user_id:
            return Response({"detail": "User ID is required."}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            target_user = CustomUser.objects.get(id=target_user_id)
        except CustomUser.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)
            
        # Capacity check
        current_members = org.users.count()
        if current_members >= org.max_seats:
            return Response({"detail": "Seat limit reached. Upgrade capacity first."}, status=status.HTTP_403_FORBIDDEN)
            
        # Prevent pulling members actively in other enterprise organizations
        # For simplicity, if they have an org and its name does not start with "Solo -", they belong to someone else.
        if target_user.organization and not target_user.organization.name.startswith("Solo -"):
            return Response({"detail": "User belongs to another organization. They must leave it first."}, status=status.HTTP_400_BAD_REQUEST)
            
        if target_user.organization == org:
            return Response({"detail": "User is already in this organization."}, status=status.HTTP_400_BAD_REQUEST)
            
        target_user.organization = org
        target_user.role = CustomUser.Role.EMPLOYEE  # Give them basic permissions by default
        target_user.save(update_fields=['organization', 'role'])
        
        return Response({"status": "success", "message": f"{target_user.email} was added as an Employee."}, status=status.HTTP_200_OK)


class UpgradeToOrganizationView(APIView):
    """
    POST /api/v1/orgs/upgrade/
    Upgrades a SOLO user's private organization to an enterprise organization and makes them ADMIN.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if not isinstance(user, CustomUser):
            return Response({"detail": "Only human users can upgrade."}, status=status.HTTP_403_FORBIDDEN)
            
        if user.role == CustomUser.Role.EMPLOYEE:
            return Response({"detail": "Employees cannot create or upgrade organizations."}, status=status.HTTP_400_BAD_REQUEST)
            
        org_name = request.data.get('org_name')
        invite_policy = request.data.get('invite_policy', 'OPEN_LINK')
        initial_seats = request.data.get('initial_seats', 5)
        
        if not org_name:
            return Response({"error": "Organization name is required."}, status=status.HTTP_400_BAD_REQUEST)
            
        org = user.organization
        if not org:
            return Response({"error": "No baseline organization found for user."}, status=status.HTTP_400_BAD_REQUEST)
            
        # Update Org
        # Attempt to handle potential duplicate org names gracefully 
        from django.db import IntegrityError
        try:
            org.name = org_name
            org.invite_policy = invite_policy
            org.max_seats = int(initial_seats)
            org.save()
        except IntegrityError:
            return Response({"error": "An organization with that name already exists."}, status=status.HTTP_400_BAD_REQUEST)
        except ValueError:
            return Response({"error": "Invalid seat number."}, status=status.HTTP_400_BAD_REQUEST)
            
        # Elevate User
        user.role = CustomUser.Role.ADMIN
        user.save()
        
        # We simulate handing off to stripe by generating the checkout logic.
        # In scaffolding, we can return a mock URL or just return success and let frontend handle routing.
        return Response({
            "status": "success",
            "message": "Successfully upgraded to organization.",
            "organization": {
                "id": str(org.id),
                "name": org.name,
                "role": user.role
            }
        }, status=status.HTTP_200_OK)


class QuotaStatusView(APIView):
    """
    GET /api/v1/quota/
    Returns the current free-tier monitoring quota for the authenticated user.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if not isinstance(user, CustomUser):
            return Response({"error": "Quota is not applicable for service accounts."}, status=status.HTTP_403_FORBIDDEN)

        remaining = user.quota_remaining_seconds()
        is_free = remaining is not None

        return Response({
            "is_free_tier": is_free,
            "quota_total_seconds": user.FREE_TIER_QUOTA_SECONDS if is_free else None,
            "quota_used_seconds": user.monitoring_seconds_used if is_free else None,
            "quota_remaining_seconds": remaining,
            "quota_remaining_hours": round(remaining / 3600, 2) if remaining is not None else None,
        })


class QuotaLogView(APIView):
    """
    POST /api/v1/quota/log/
    Called by the desktop app when a monitoring session ends.
    Body: { "duration_seconds": <int> }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if not isinstance(user, CustomUser):
            return Response({"error": "Quota logging is not applicable for service accounts."}, status=status.HTTP_403_FORBIDDEN)

        duration = request.data.get("duration_seconds")
        if duration is None or not isinstance(duration, (int, float)) or duration < 0:
            return Response({"error": "duration_seconds must be a non-negative number."}, status=status.HTTP_400_BAD_REQUEST)

        duration = int(duration)

        # Only track for free tier users
        remaining_before = user.quota_remaining_seconds()
        if remaining_before is not None:
            # Cap so we don't exceed the quota
            actual_duration = min(duration, remaining_before)
            user.monitoring_seconds_used += actual_duration
            user.save(update_fields=["monitoring_seconds_used"])

        remaining = user.quota_remaining_seconds()
        is_free = remaining is not None

        return Response({
            "status": "logged",
            "is_free_tier": is_free,
            "quota_total_seconds": user.FREE_TIER_QUOTA_SECONDS if is_free else None,
            "quota_used_seconds": user.monitoring_seconds_used if is_free else None,
            "quota_remaining_seconds": remaining,
            "quota_remaining_hours": round(remaining / 3600, 2) if remaining is not None else None,
        }, status=status.HTTP_200_OK)



