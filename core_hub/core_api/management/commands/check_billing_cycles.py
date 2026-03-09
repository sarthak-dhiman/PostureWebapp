from django.core.management.base import BaseCommand
from core_api.utils.billing_logic import check_and_reset_cycles

class Command(BaseCommand):
    help = 'Checks for organizations whose billing cycle has ended and resets their user quotas.'

    def handle(self, *args, **options):
        self.stdout.write("Checking billing cycles...")
        check_and_reset_cycles()
        self.stdout.write(self.style.SUCCESS("Billing cycle check complete."))
