# Деплой

После мержа изменений в `main` — на сервере:

```bash
cd /var/www/zhaiyk-aktau && npm run backup && git pull && npm install --omit=dev && pm2 restart zhaiyk-aktau
```

`npm run backup` (см. `scripts/backup-db.sh`) снимает копию `db.json` и
`uploads/` в `backups/` ПЕРЕД обновлением кода — если что-то пойдёт не
так после деплоя, есть на что откатиться. Хранится 30 дней, старые копии
удаляются автоматически. Тот же скрипт стоит на ежедневном cron
(`0 3 * * * cd /var/www/zhaiyk-aktau && ./scripts/backup-db.sh >> backups/backup.log 2>&1`) —
шаг перед деплоем ему не замена, а дополнительная точка перед конкретным
риском (новый код), а не только по расписанию.

`npm install --omit=dev` нужен, если менялись зависимости в `package.json`
(на случай, если пропустить — обычно не страшно, но лучше выполнять каждый раз).
Процесс в pm2 называется `zhaiyk-aktau`.
