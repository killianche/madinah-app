# GitHub Actions — auto-deploy

## Установка вручную (один раз)

GitHub запрещает Claude добавлять `.github/workflows/*` без `workflow`-scope в PAT. Поэтому файл лежит в `docs/auto-deploy-workflow.yml.tpl`. Сделай руками:

```bash
mkdir -p .github/workflows
cp docs/auto-deploy-workflow.yml.tpl .github/workflows/deploy.yml
git add .github/workflows/deploy.yml
git commit -m "ci: auto-deploy workflow"
git push
```

## Что делает

При push в `main` (с изменениями в `web/`, `db/migrations/`, `.github/workflows/`):
1. Билдит Docker image для linux/amd64
2. Сохраняет в tar
3. Подключается по SSH к 72.56.15.189
4. Применяет все миграции (idempotent)
5. scp tar на сервер
6. docker load + redeploy.sh
7. Health check

## Что нужно настроить (один раз)

В **GitHub → Settings → Secrets and variables → Actions** добавить:

- **`SSH_PRIVATE_KEY`** — приватный SSH-ключ от root@72.56.15.189
  ```
  cat ~/.ssh/id_ed25519
  ```
  (вставить полностью включая `-----BEGIN/END OPENSSH PRIVATE KEY-----`)

После этого каждый push в main триггерит deploy. Длительность: ~5-7 мин.

## Manual trigger

Actions → Build and deploy → Run workflow.

## Откат

Если деплой сломал прод — `ssh root@... "docker tag madinah-web:previous madinah-web:latest && bash /opt/madinah-app/deploy/redeploy.sh"`.

(Но `previous` теги не сохраняются — если нужно, добавить в workflow `docker tag madinah-web:latest madinah-web:previous` перед load.)
