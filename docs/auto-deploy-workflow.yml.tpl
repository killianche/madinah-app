name: Build and deploy to TimeWeb

on:
  push:
    branches: [main]
    paths:
      - 'web/**'
      - 'db/migrations/**'
      - '.github/workflows/deploy.yml'
  workflow_dispatch: {}

concurrency:
  group: deploy-prod
  cancel-in-progress: false

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build image (linux/amd64)
        run: |
          docker buildx build \
            --platform linux/amd64 \
            --load \
            -t madinah-web:latest \
            ./web

      - name: Save image
        run: |
          docker save madinah-web:latest -o /tmp/madinah-web.tar
          ls -lh /tmp/madinah-web.tar

      - name: Set up SSH
        run: |
          mkdir -p ~/.ssh
          echo "${{ secrets.SSH_PRIVATE_KEY }}" > ~/.ssh/id_ed25519
          chmod 600 ~/.ssh/id_ed25519
          ssh-keyscan -H 72.56.15.189 >> ~/.ssh/known_hosts

      - name: Apply pending migrations
        run: |
          ssh root@72.56.15.189 'export DATABASE_URL=$(grep ^DATABASE_URL /opt/madinah-app/web/.env.production | cut -d= -f2-); cd /opt/madinah-app && git pull && for f in db/migrations/*.sql; do echo "=== $f ==="; psql "$DATABASE_URL" -f "$f" 2>&1 | tail -3 || true; done' || true

      - name: scp image
        run: |
          scp -o StrictHostKeyChecking=no -C /tmp/madinah-web.tar root@72.56.15.189:/tmp/madinah-web.tar

      - name: docker load + redeploy
        run: |
          ssh root@72.56.15.189 'docker load -i /tmp/madinah-web.tar && bash /opt/madinah-app/deploy/redeploy.sh'

      - name: Health check
        run: |
          sleep 5
          curl -s -o /dev/null -w 'health:%{http_code}\n' --max-time 15 https://app.madinah.ru/api/health
