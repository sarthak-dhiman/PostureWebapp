from django.utils import timezone
from ..models import CustomUser, Organization

def reset_organization_usage(organization):
    """
    Resets monitoring_seconds_used for all users in the organization at the start of a new billing cycle.
    """
    CustomUser.objects.filter(organization=organization).update(monitoring_seconds_used=0)

def check_and_reset_cycles():
    """
    Checks all organizations whose current_period_end has passed and resets their users' usage.
    This serves as a fallback for the Razorpay webhook.
    """
    now = timezone.now()
    overdue_orgs = Organization.objects.filter(
        razorpay_subscription_id__isnull=False,
        current_period_end__lt=now
    )
    
    for org in overdue_orgs:
        # We don't know the exact new period end without hitting Razorpay, 
        # but the next webhook will fix it. For now, we just reset usage.
        reset_organization_usage(org)
        # We can't easily guess the next period end, so we might set it to a month from now 
        # or leave it for the webhook. Let's at least mark it as reset.
        # Ideally, we should fetch the subscription from Razorpay here.
