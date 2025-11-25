package main

import (
	"log"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
)

// WebSocket ayarları için sabitler
const (
    // İstemciden okuma zaman aşımı süresi
	readWait = 60 * time.Second 
    // İstemciden Pong yanıtını beklerken Ping mesajının gönderileceği periyot. 
	pingPeriod = 5 * time.Second // Ping periyodunu 5 saniyeye sabitledim. Bu, readWait'ten çok daha kısa olmalıdır.
    // Pong mesajı geldikten sonra bir sonraki Ping'i beklemek için izin verilen süre. (Bu genelde readWait ile aynıdır)
	pongWait = 5 * time.Second // Yazma zaman aşımı için kullanılacak

)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	// CheckOrigin her zaman true döndürerek CORS sorunlarını önler.
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type Client struct {
	conn *websocket.Conn
	send chan []byte
}

type Hub struct {
	clients    map[*Client]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
}

func newHub() *Hub {
	return &Hub{
		broadcast:  make(chan []byte),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		clients:    make(map[*Client]bool),
	}
}

func (h *Hub) run() {
	for {
		select {
		case client := <-h.register:
			h.clients[client] = true
			log.Printf("New client connected. Total clients: %d", len(h.clients))
		case client := <-h.unregister:
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
				log.Printf("Client disconnected. Total clients: %d", len(h.clients))
			}
		case message := <-h.broadcast:
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
		}
	}
}

func serveWs(hub *Hub, w http.ResponseWriter, r *http.Request) {
	// İstek geldiğinde loglama
	log.Printf("Incoming WebSocket connection request from %s", r.RemoteAddr)

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("WebSocket Upgrade Error:", err)
		return
	}
	// Bağlantı başarıyla kurulduysa loglama
	log.Printf("WebSocket connection established with %s", conn.RemoteAddr())

	client := &Client{conn: conn, send: make(chan []byte, 256)}
	hub.register <- client

	go client.writePump()
	client.readPump(hub)
}

func (c *Client) readPump(hub *Hub) {
	defer func() {
		hub.unregister <- c
		c.conn.Close()
	}()
	c.conn.SetReadLimit(512)
    
    // YENİ AYAR: readWait ve Pong Handler kullanılıyor
	c.conn.SetReadDeadline(time.Now().Add(readWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(readWait))
		return nil
	})
    
	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("Read error for client %s: %v", c.conn.RemoteAddr(), err)
			}
			break
		}
        // İstemciden gelen mesajları yayınla
		hub.broadcast <- message
	}
}

func (c *Client) writePump() {
    // Ping periyodu readWait'ten daha kısa olmalıdır.
	ticker := time.NewTicker(pingPeriod) 
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()
	for {
		select {
		case message, ok := <-c.send:
			// Mesaj yazma zaman aşımı
			c.conn.SetWriteDeadline(time.Now().Add(pongWait))
			if !ok {
				// Hub kanalı kapattı. Bağlantı kapatma mesajını gönder.
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				log.Printf("Write error (message) for client %s: %v", c.conn.RemoteAddr(), err)
				return
			}

		case <-ticker.C:
			// Ping mesajı yazma zaman aşımı
			c.conn.SetWriteDeadline(time.Now().Add(pongWait)) 
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				log.Printf("Write error (ping) for client %s: %v", c.conn.RemoteAddr(), err)
				return
			}
		}
	}
}


func main() {
	hub := newHub()
	go hub.run()

	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		serveWs(hub, w, r)
	})

	log.Println("Go WebSocket server started on :8080")
	err := http.ListenAndServe(":8080", nil)
	if err != nil {
		log.Fatal("ListenAndServe: ", err)
	}
}