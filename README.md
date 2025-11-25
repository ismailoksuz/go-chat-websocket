💬 Go WebSocket Chat Uygulaması (go-chat-websocket)

Bu proje, Go (Golang) backend'i ile çalışan ve React/TypeScript/Vite frontend'i kullanan basit, gerçek zamanlı bir WebSocket sohbet uygulamasıdır. Tailwind CSS ile modern bir arayüze sahiptir.

⚙️ Gereksinimler

Go: Go programlama dilinin kurulu olması.

Node.js & npm: Frontend bağımlılıklarını yönetmek için Node.js ve npm'in kurulu olması.

Git: Projeyi klonlamak için Git.

🚀 Kurulum ve Çalıştırma

Proje, backend ve frontend olarak iki ana bölümden oluşur. Her birinin ayrı ayrı çalıştırılması gerekir.

1. Klonlama ve Go Bağımlılıkları

Projeyi yerel makinenize klonlayın ve Go modüllerini indirin:

# Projeyi klonlayın
git clone https://github.com/ismailoksuz/go-chat-websocket
cd go-chat-websocket

# Go backend bağımlılıklarını indirin
go mod tidy


2. Frontend Kurulumu (React/Vite)

Frontend, frontend/ klasöründe bulunur. Bağımlılıkları kurun:

cd frontend
npm install


3. Uygulamayı Başlatma

Uygulamanın çalışması için iki ayrı terminal penceresi gereklidir: biri Go backend, diğeri React frontend için.

A. Go Backend'i Başlatma

Ana proje dizininde (go-chat-websocket):

# Sunucu 8080 portunda çalışacaktır
go run main.go


B. React Frontend'i Başlatma

frontend/ dizininde:

# Geliştirme sunucusunu 5173 portunda başlatır
npm run dev


🌐 Kullanım

Her iki sunucu da çalışmaya başladıktan sonra, tarayıcınızda şu adresi açın:

👉 http://localhost:5173/

Uygulama otomatik olarak Go backend'e WebSocket bağlantısı kuracak ve mesajlaşmaya başlayabilirsiniz.

📂 Proje Yapısı

backend/: Go (Golang) ile yazılmış WebSocket sunucusu kodu.

frontend/: React, TypeScript, Vite ve Tailwind CSS ile oluşturulmuş sohbet arayüzü kodu.

main.go: Go backend'in ana giriş noktası.
