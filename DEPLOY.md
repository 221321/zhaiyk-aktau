# Деплой

После мержа изменений в `main` — на сервере:

```bash
cd /var/www/zhaiyk-aktau && git pull && npm install --omit=dev && pm2 restart zhaiyk-aktau
```

`npm install --omit=dev` нужен, если менялись зависимости в `package.json`
(на случай, если пропустить — обычно не страшно, но лучше выполнять каждый раз).
Процесс в pm2 называется `zhaiyk-aktau`.
