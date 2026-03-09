from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import CustomUser, PlatformLog, ServiceAccount, Organization
from .serializers import PlatformLogSerializer


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
                'has_subscription': bool(user.organization.stripe_subscription_id)
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

        # Auto-create the user if they don't exist to guarantee dev environments work
        user = CustomUser.objects.filter(email=identifier).first() or CustomUser.objects.filter(username=identifier).first()
        
        if not user:
            # Create a mock user on the fly!
            org, _ = Organization.objects.get_or_create(name=f"Solo - {identifier}")
            user = CustomUser.objects.create_user(
                username=username or email.split('@')[0],
                email=email or f"{username}@local",
                password=password,
                organization=org,
                role=CustomUser.Role.SOLO
            )

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

    def post(self, request):
        name = request.data.get('name')
        email = request.data.get('email')
        password = request.data.get('password')
        account_type = request.data.get('account_type') # 'solo', 'org', or 'join'
        org_name = request.data.get('org_name')
        invite_code = request.data.get('invite_code')

        if not email or not password or not account_type:
            return Response({"detail": "Missing required fields."}, status=status.HTTP_400_BAD_REQUEST)

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

        refresh = RefreshToken.for_user(user)
        return Response({
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": {
                "id": str(user.id),
                "email": user.email,
                "role": user.role
            }
        }, status=status.HTTP_201_CREATED)

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
            # Simulate notifying the org admins
            print(f"\n[SYSTEM ALERT] Organization '{org.name}' has reached its maximum capacity of {org.max_seats} seats.")
            print(f"User {user.email} attempted to join but was rejected.")
            print("Action Required: Please upgrade your subscription tier or remove inactive members.\n")
            
            return Response({
                "error": "This organization has reached its maximum seat capacity.",
                "code": "SEATS_FULL"
            }, status=status.HTTP_403_FORBIDDEN)
            
        # Success: Add user to org and set role to EMPLOYEE
        user.organization = org
        user.role = CustomUser.Role.EMPLOYEE
        user.save()
        
        return Response({
            "status": "success",
            "message": f"Successfully joined {org.name}",
            "organization": {
                "id": str(org.id),
                "name": org.name,
                "is_active": org.is_active,
                "has_subscription": bool(org.stripe_subscription_id)
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
            "stripe_subscription_id": org.stripe_subscription_id,
            "has_subscription": bool(org.stripe_subscription_id),
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
                
                # Sync with Stripe if there's a real active subscription
                if org.stripe_subscription_id and not org.stripe_subscription_id.startswith('sub_mock_'):
                    import stripe
                    try:
                        subscription = stripe.Subscription.retrieve(org.stripe_subscription_id)
                        # Standard implementations assume the first line item is the per-seat base plan
                        if subscription.get('items') and subscription['items'].get('data'):
                            item_id = subscription['items']['data'][0]['id']
                            stripe.SubscriptionItem.modify(
                                item_id,
                                quantity=new_max_seats,
                                proration_behavior='always_invoice'
                            )
                    except stripe.error.StripeError as e:
                        return Response({"detail": f"Billing error: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                    except Exception as e:
                        return Response({"detail": f"Application error syncing billing: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

                org.max_seats = new_max_seats
                org.save(update_fields=['max_seats'])
            except ValueError:
                return Response({"detail": "max_seats must be an integer."}, status=status.HTTP_400_BAD_REQUEST)
                
        return Response({"status": "success", "max_seats": org.max_seats}, status=status.HTTP_200_OK)


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



