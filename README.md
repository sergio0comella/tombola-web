# Tombola Online 🎲

Applicazione web per gestire e giocare alla tombola online in tempo reale.
Il sistema permette di creare una partita, assegnare cartelle ai giocatori e condividere l’estrazione dei numeri tramite interfaccia web.

L'applicazione è composta da:

* **Frontend** (interfaccia utente web)
* **Backend Node.js / Express** (API e logica di gioco)
* **Docker** per il deploy
* **Nginx** come reverse proxy

---

# Architettura

```
Browser
   ↓
Nginx (HTTPS)
   ↓
Docker container
   ↓
Node.js / Express
   ↓
Frontend statico + API
```

Il frontend viene buildato e servito direttamente dal backend Express.

---

# Requisiti

Per eseguire il progetto sono necessari:

* Node.js ≥ 20
* npm
* Docker
* Nginx (per deploy in produzione)
* dominio DNS (es. DuckDNS)

---

# Struttura del progetto

```
project
│
├── web/                 # frontend
│   ├── src/
│   └── dist/
│
├── server/              # backend Node.js
│   ├── src/
│   └── dist/
│
├── Dockerfile
├── docker-compose.yml
└── README.md
```

---

# Installazione locale

Clonare il repository:

```bash
git clone https://github.com/sergio0comella/tombola-web
cd tombola-web
```

Installare dipendenze frontend:

```bash
cd web
npm install
```

Build frontend:

```bash
npm run build
```

Installare backend:

```bash
cd ../server
npm install
```

Build server:

```bash
npm run build
```

Avviare il server:

```bash
npm start
```

Applicazione disponibile su:

```
http://localhost:3001
```

---

# Avvio con Docker

Build dell'immagine:

```bash
docker build -t tombola .
```

Eseguire il container:

```bash
docker run -p 3010:3000 tombola
```

Applicazione disponibile su:

```
http://localhost:3010
```

---

# Deploy con Docker Compose

Esempio `docker-compose.yml`:

```yaml
services:

  tombola:
    image: ghcr.io/sergio0comella/tombola-web:latest
    restart: always
    ports:
      - "3010:3000"
```

Avvio:

```bash
docker compose up -d
```

---

# Configurazione Nginx

File:

```
/etc/nginx/sites-available/tombolaonline
```

Configurazione:

```
upstream tombola_backend {
    server 127.0.0.1:3010;
}

server {

    listen 80;
    server_name tombolaonline.duckdns.org;

    location / {
        proxy_pass http://tombola_backend;

        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

}
```

Abilitare il sito:

```bash
sudo ln -s /etc/nginx/sites-available/tombolaonline /etc/nginx/sites-enabled/
```

Ricaricare nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

# HTTPS con Let's Encrypt

Installare Certbot:

```bash
sudo apt install certbot python3-certbot-nginx
```

Generare certificato:

```bash
sudo certbot --nginx -d tombolaonline.duckdns.org
```

---

# Funzionalità principali

* creazione partita
* estrazione numeri casuale
* gestione cartelle
* aggiornamento in tempo reale
* interfaccia web responsive

---

# Troubleshooting

Verificare container:

```bash
docker ps
```

Test backend locale:

```bash
curl http://127.0.0.1:3010
```

Controllare log nginx:

```bash
sudo tail -f /var/log/nginx/error.log
```

---

# Licenza

Progetto open source rilasciato sotto licenza MIT.
