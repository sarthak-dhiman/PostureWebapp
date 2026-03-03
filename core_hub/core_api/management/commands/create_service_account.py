import sys

from django.core.management.base import BaseCommand, CommandError

from core_api.models import Organization, ServiceAccount


class Command(BaseCommand):
    help = (
        'Create a ServiceAccount for a headless client (CCTV node or ML microservice). '
        'The raw API key is printed ONCE and never stored — copy it immediately.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--org-id',
            required=True,
            help='UUID of the Organization this service account belongs to.',
        )
        parser.add_argument(
            '--name',
            required=True,
            help='Human-readable label, e.g. "Floor-2 CCTV Node".',
        )
        parser.add_argument(
            '--source-type',
            default=ServiceAccount.SourceType.CCTV_NODE,
            choices=[c.value for c in ServiceAccount.SourceType],
            help=(
                f'Source type: {ServiceAccount.SourceType.CCTV_NODE} (default) or '
                f'{ServiceAccount.SourceType.ML_SERVICE}.'
            ),
        )

    def handle(self, *args, **options):
        org_id = options['org_id']
        name = options['name']
        source_type = options['source_type']

        try:
            org = Organization.objects.get(pk=org_id)
        except Organization.DoesNotExist:
            raise CommandError(f'Organization with id "{org_id}" does not exist.')

        account, raw_key = ServiceAccount.create_with_key(
            organization=org,
            name=name,
            source_type=source_type,
        )

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('✔ Service Account created successfully.'))
        self.stdout.write('')
        self.stdout.write(f'  Name        : {account.name}')
        self.stdout.write(f'  ID          : {account.id}')
        self.stdout.write(f'  Organization: {org.name}')
        self.stdout.write(f'  Source Type : {account.source_type}')
        self.stdout.write('')
        self.stdout.write(self.style.WARNING('  ⚠  RAW API KEY (shown once — copy it now):'))
        self.stdout.write('')
        self.stdout.write(f'      {raw_key}')
        self.stdout.write('')
        self.stdout.write(
            self.style.WARNING(
                '  This key will NOT be shown again. Store it in your secrets manager.'
            )
        )
        self.stdout.write('')
        self.stdout.write('  Usage in HTTP header:')
        self.stdout.write(f'      Authorization: ApiKey {raw_key}')
        self.stdout.write('')
