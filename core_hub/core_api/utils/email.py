import ssl
from django.core.mail import send_mail
from django.conf import settings
from django.template.loader import render_to_string
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from django.contrib.auth.tokens import default_token_generator

def send_verification_email(user):
    """
    Generates a secure token for the given user and emails them a verification link using HTML templates.
    """
    token = default_token_generator.make_token(user)
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    
    # Strip any trailing slashes from the configured FRONTEND_URL
    base_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000').rstrip('/')
    verify_url = f"{base_url}/verify-email?uid={uid}&token={token}"
    
    subject = "Verify your Posture Webapp Account"
    
    context = {
        'subject': subject,
        'user_name': user.first_name or user.username,
        'verify_url': verify_url,
    }
    
    html_message = render_to_string('emails/verification.html', context)
    
    try:
        send_mail(
            subject=subject,
            message=f"Please verify your email at: {verify_url}", # Plain text fallback
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
            html_message=html_message
        )
        return True
    except Exception as e:
        print(f"Failed to send verification email to {user.email}: {str(e)}")
        return False


def send_billing_email(user, event_type, context=None):
    """
    Sends unified billing notification emails using HTML templates.
    """
    if context is None:
        context = {}
    
    # Common context
    context['user_name'] = user.first_name or user.username
    context['dashboard_url'] = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000') + "/dashboard"
    context['billing_url'] = context['dashboard_url'] + "/settings/billing"

    templates = {
        'payment_success': ('Payment Successful 🎉', 'emails/billing_success.html'),
        'payment_failure': ('Action Required: Payment Failed', 'emails/billing_failure.html'),
        'refund_processed': ('Refund Processed', 'emails/refund_processed.html'),
        'subscription_cancelled': ('Subscription Cancelled', 'emails/subscription_cancelled.html'),
        'plan_updated': ('Subscription Updated ⚡', 'emails/plan_updated.html'),
        'member_joined': ('New Team Member! 👋', 'emails/member_joined.html'),
        'member_pending': ('Action Required: Seat Limit Reached', 'emails/member_pending.html'),
    }

    if event_type not in templates:
        print(f"Unknown billing email event type: {event_type}")
        return False

    subject, template_name = templates[event_type]
    context['subject'] = subject
    
    html_message = render_to_string(template_name, context)

    try:
        send_mail(
            subject=subject,
            message=subject, # Simple fallback
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
            html_message=html_message
        )
        return True
    except Exception as e:
        print(f"Failed to send {event_type} email to {user.email}: {str(e)}")
        return False
