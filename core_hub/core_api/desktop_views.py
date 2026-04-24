from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from .models import CustomUser, Organization
from rest_framework_simplejwt.tokens import RefreshToken
import uuid

# --- AUTH MOCKS ---

@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    """POST /v1/auth/login"""
    email = request.data.get('email')
    password = request.data.get('password')
    
    if not email or not password:
        return Response({"error": "Missing credentials"}, status=status.HTTP_400_BAD_REQUEST)

    user = CustomUser.objects.filter(email=email).first()
    
    # Mock behavior: if user doesn't exist but it's a demo, we might auto-create,
    # but the prompt implies we just return success for demo creds.
    # We will enforce actual login if the user exists, otherwise mock a 201 for generic.
    
    if not user:
        # Create a generic mock user for the desktop app to proceed if not found
        mock_org, _ = Organization.objects.get_or_create(name="Mock Organization")
        user = CustomUser.objects.create_user(
            username=email.split('@')[0] + str(uuid.uuid4())[:8],
            email=email,
            password=password,
            organization=mock_org
        )
        status_code = status.HTTP_201_CREATED
    else:
        if not user.check_password(password):
            # If it's the exact 'you@local' demo, we might bypass, but let's be somewhat secure
            if email != "you@local":
                return Response({"error": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)
        status_code = status.HTTP_200_OK

    refresh = RefreshToken.for_user(user)
    
    return Response({
        "token": str(refresh.access_token),
        "email": user.email,
        "role": user.role,
        "is_admin": user.is_superuser or user.role == 'ADMIN',
        "is_staff": user.is_staff,
        "user": {
            "id": user.id,
            "email": user.email,
            "name": f"{user.first_name} {user.last_name}".strip() or user.username,
            "role": user.role
        },
        "subscription": {
            "is_active": user.organization.is_active if user.organization else False
        }
    }, status=status_code)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def verify_view(request):
    """GET /v1/auth/verify"""
    return Response({"status": "valid", "user_id": request.user.id}, status=status.HTTP_200_OK)

@api_view(['GET'])
@permission_classes([AllowAny])
def google_auth_start(request):
    """GET /v1/auth/google"""
    session_id = str(uuid.uuid4())
    # Fix: Use the unified api/v1 prefix and the desktop-specific callback landing page
    auth_url = f"http://127.0.0.1:8000/api/v1/auth/google/callback-desktop/?session={session_id}"
    return Response({
        "url": auth_url,
        "auth_url": auth_url,
        "session": session_id,
        "session_id": session_id
    }, status=status.HTTP_200_OK)

@api_view(['GET'])
@permission_classes([AllowAny])
def google_auth_complete(request):
    """GET /v1/auth/google/complete?session=<id>"""
    session_id = request.query_params.get('session')
    if not session_id:
        return Response({"error": "Missing session"}, status=status.HTTP_400_BAD_REQUEST)
    
    # For mock purposes, just issue a token for a generic user
    mock_org, _ = Organization.objects.get_or_create(name="Google Mock Org")
    user, _ = CustomUser.objects.get_or_create(
        email=f"google_{session_id[:8]}@example.com",
        defaults={
            "username": f"google_{session_id[:8]}",
            "organization": mock_org
        }
    )
    if not user.has_usable_password():
        user.set_unusable_password()
        user.save()

    refresh = RefreshToken.for_user(user)
    return Response({
        "token": str(refresh.access_token),
        "email": user.email,
        "role": user.role,
        "is_admin": user.is_superuser or user.role == 'ADMIN',
        "is_staff": user.is_staff,
        "user": {"email": user.email, "id": user.id, "role": user.role}
    }, status=status.HTTP_200_OK)

@api_view(['GET'])
@permission_classes([AllowAny])
def google_auth_poll(request):
    """GET /v1/auth/google/poll?session=<id>"""
    session_id = request.query_params.get('session', 'mock_session')
    
    # Mock a finalized payload to match production GoogleOAuthPollView behavior
    # Status MUST be "done" for the app to pick it up.
    return Response({
        "status": "done", 
        "token": "mock_desktop_jwt_token_123",
        "email": "desktop_user@example.com",
        "role": "ADMIN",
        "is_admin": True,
        "is_staff": True,
        "user": {
            "email": "desktop_user@example.com",
            "id": 1,
            "role": "ADMIN"
        }
    }, status=status.HTTP_200_OK)

@api_view(['GET'])
@permission_classes([AllowAny])
def google_auth_callback(request):
    """GET /v1/auth/google/callback?session=<id>"""
    # This is what the user "visits" in the browser
    return Response({"message": "OAuth complete. You can close this window."}, status=status.HTTP_200_OK)

@api_view(['GET'])
@permission_classes([AllowAny])
def signup_start(request):
    """GET /v1/auth/signup"""
    return Response({"message": "Signup page mock. Call /v1/auth/signup/complete to finish."}, status=status.HTTP_200_OK)

@api_view(['GET'])
@permission_classes([AllowAny])
def signup_complete(request):
    """GET /v1/auth/signup/complete?email=..."""
    email = request.query_params.get('email')
    if not email:
         return Response({"error": "Missing email"}, status=status.HTTP_400_BAD_REQUEST)
         
    mock_org, _ = Organization.objects.get_or_create(name=f"Org for {email}")
    user, created = CustomUser.objects.get_or_create(
        email=email,
        defaults={
            "username": email.split('@')[0] + str(uuid.uuid4())[:4],
            "organization": mock_org
        }
    )
    if created:
        user.set_password('defaultpass123')
        user.save()
        
    refresh = RefreshToken.for_user(user)
    return Response({
        "token": str(refresh.access_token),
        "user": {"email": user.email, "id": user.id}
    }, status=status.HTTP_201_CREATED)

# --- ORG MOCKS ---

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def org_join(request):
    """POST /v1/org/join"""
    invite_code = request.data.get('invite_code')
    if not invite_code:
        return Response({"error": "Missing invite_code"}, status=status.HTTP_400_BAD_REQUEST)
        
    org = Organization.objects.filter(invite_code=invite_code).first()
    if not org:
        return Response({"error": "Invalid invite code"}, status=status.HTTP_404_NOT_FOUND)
        
    user = request.user
    user.organization = org
    user.save()
    
    return Response({
        "id": str(org.id),
        "name": org.name,
        "is_active": org.is_active
    }, status=status.HTTP_200_OK)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def org_create(request):
    """POST /v1/org/create"""
    org_name = request.data.get('org_name')
    if not org_name:
         return Response({"error": "Missing org_name"}, status=status.HTTP_400_BAD_REQUEST)
         
    # Unique constraint check
    if Organization.objects.filter(name=org_name).exists():
        return Response({"error": "Organization name taken"}, status=status.HTTP_400_BAD_REQUEST)
        
    org = Organization.objects.create(name=org_name)
    
    user = request.user
    user.organization = org
    user.role = 'ADMIN' # The creator gets admin privileges
    user.save()
    
    return Response({
        "id": str(org.id),
        "name": org.name,
        "invite_code": org.invite_code,
        "is_active": org.is_active
    }, status=status.HTTP_201_CREATED)
