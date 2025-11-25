import { useState, useEffect, useRef, useCallback } from 'react';
import { Send } from 'lucide-react'; // Sadece kullanılan Send bileşenini tuttuk

// Kullanıcı ve mesaj tipleri
interface Message {
  sender: string;
  text: string;
  timestamp: string;
  isMine: boolean;
}

// Yeniden bağlanma ayarları
const RECONNECT_INTERVAL = 3000; // 3 saniye
const MAX_MESSAGES = 100;

// WebSocket URL'sini otomatik olarak belirlemek daha güvenlidir.
// Eğer uygulama https'te çalışıyorsa wss:// kullanır, http'de çalışıyorsa ws:// kullanır.
const WS_HOST = window.location.host.includes('localhost')
  ? 'ws://localhost:8080/ws'
  : `wss://${window.location.host}/ws`; // Eğer bir HTTPS ortamında çalışıyorsa
  
  

const App = () => {
  // Rastgele bir kullanıcı ID'si oluştur
  const [userId] = useState(`User-${Math.floor(Math.random() * 900) + 100}`);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const ws = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Otomatik aşağı kaydırma
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Yeniden bağlanma (useCallback ile memoize edildi)
  const connect = useCallback(() => {
    if (ws.current && (ws.current.readyState === WebSocket.OPEN || ws.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    ws.current = new WebSocket(WS_HOST);

    ws.current.onopen = () => {
      console.log('WebSocket Connected!');
      setIsConnected(true);
      // Bağlantı kurulur kurulmaz ilk mesajı gönder (katılım bildirimi)
      ws.current?.send(JSON.stringify({
        sender: 'System', 
        text: `${userId} odaya katıldı.`, 
        timestamp: new Date().toLocaleTimeString(),
        isMine: false // Sistem mesajı
      }));
    };

    ws.current.onmessage = (event) => {
      const receivedData = event.data;
      
      // Gelen mesajı JSON olarak ayrıştırmaya çalış
      try {
        const messageObj = JSON.parse(receivedData);
        if (messageObj.sender && messageObj.text) {
          // Eğer mesaj zaten parse edilmiş JSON ise, sadece ekle
          const isMine = messageObj.sender === userId;
          setMessages(prev => {
            const newMessages = [...prev, { ...messageObj, isMine }];
            // Mesaj sınırını koru
            return newMessages.slice(-MAX_MESSAGES);
          });
        } else {
          // Eğer mesaj düz metin ise (Go backend'den geliyor olabilir)
          const messageText = receivedData;
          setMessages(prev => {
              const newMessages = [...prev, {
                  sender: 'Anonim', // Go'dan gelen mesajlarda sender bilgisi eksik olabilir
                  text: messageText,
                  timestamp: new Date().toLocaleTimeString(),
                  isMine: false 
              }].slice(-MAX_MESSAGES);
              return newMessages;
          });
        }
      } catch (e) {
        // Gelen veri JSON değilse (genellikle ilk denemelerde böyle olur)
        const messageText = receivedData;
        setMessages(prev => {
            const newMessages = [...prev, {
                sender: 'Anonim',
                text: messageText,
                timestamp: new Date().toLocaleTimeString(),
                isMine: false 
            }].slice(-MAX_MESSAGES);
            return newMessages;
        });
      }
    };

    ws.current.onclose = (event) => {
      console.log('WebSocket Disconnected:', event.code, event.reason);
      setIsConnected(false);
      
      // Kod 1000 normal kapanıştır. Diğer kodlarda yeniden bağlanmayı dene.
      if (event.code !== 1000) {
        // 3 saniye sonra yeniden bağlanmayı dene
        setTimeout(connect, RECONNECT_INTERVAL);
        setMessages(prev => [...prev.slice(-MAX_MESSAGES + 1), {
            sender: 'System',
            text: `Sunucu ile bağlantı kesildi. ${RECONNECT_INTERVAL / 1000}s içinde yeniden bağlanılıyor...`,
            timestamp: new Date().toLocaleTimeString(),
            isMine: false
        }]);
      }
    };

    ws.current.onerror = (err) => {
      console.error('WebSocket Error:', err);
      // Hata durumunda bağlantıyı kapat ve onclose tetiklensin
      ws.current?.close(); 
    };
  }, [userId]);


  // Bağlantı yönetimi (Component Mount/Unmount)
  useEffect(() => {
    connect();

    // TEMİZLİK FONKSİYONU
    // Component Unmount edildiğinde veya effect yeniden çalıştığında (ki bu durumda sadece bir kez çalışmalı), 
    // önceki bağlantıyı düzgünce kapat. Bu, çift bağlantı hatasını önler!
    return () => {
      if (ws.current) {
        // 1000 normal kapatma kodudur
        ws.current.close(1000, 'Component unmounting');
      }
    };
  }, [connect]); 


  // Yeni mesaj geldiğinde otomatik kaydırma
  useEffect(() => {
    scrollToBottom();
  }, [messages]);


  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputMessage.trim() === '' || !ws.current || ws.current.readyState !== WebSocket.OPEN) {
      return;
    }

    const messageData = {
      sender: userId,
      text: inputMessage.trim(),
      timestamp: new Date().toLocaleTimeString(),
    };

    // Go sunucusuna JSON string olarak gönder
    ws.current.send(JSON.stringify(messageData));
    
    // Gönderim başarılıysa input'u temizle
    setInputMessage('');
  };

  
  // UI - Tailwind CSS kullanılarak modern ve duyarlı bir arayüz
  return (
    <div className="flex flex-col h-screen antialiased text-gray-800 bg-gray-50 p-4">
      <div className="flex-1 p:2 sm:p-6 flex flex-col">
        {/* Başlık */}
        <div className="flex sm:items-center justify-between py-3 border-b-2 border-gray-200">
          <div className="relative flex items-center space-x-4">
            <div className={`flex flex-col leading-tight ${!isConnected ? 'text-gray-500' : ''}`}>
              <div className="text-2xl mt-1 flex items-center">
                <span className="text-gray-700 font-bold tracking-tight">Go WebChat</span>
                <span className={`h-3 w-3 rounded-full ml-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
              </div>
              <span className="text-lg text-gray-500">Kullanıcı: <span className="font-mono text-sm bg-gray-200 rounded px-1">{userId}</span></span>
            </div>
          </div>
        </div>

        {/* Mesaj Kutusu */}
        <div 
          className="flex flex-col space-y-4 p-3 overflow-y-auto scrollbar-thin scrollbar-thumb-rounded-full scrollbar-track-rounded-full scrollbar-thumb-gray-400 scrollbar-track-gray-100 flex-1 my-4 bg-white rounded-xl shadow-lg border border-gray-100"
        >
          {messages.map((message, index) => (
            <div key={index} className={`flex items-end ${message.isMine ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex flex-col space-y-2 text-base max-w-lg mx-2 ${message.isMine ? 'items-end' : 'items-start'}`}>
                {/* Gönderici Adı ve Zaman */}
                <span className={`text-xs font-semibold ${message.isMine ? 'text-gray-500' : 'text-indigo-500'}`}>
                    {message.sender === 'System' ? 'Sistem Bildirimi' : (message.isMine ? 'Siz' : message.sender)} 
                    <span className="text-gray-400 font-normal ml-2">{message.timestamp}</span>
                </span>
                {/* Mesaj Balonu */}
                <div 
                  className={`px-4 py-2 rounded-2xl inline-block shadow-md ${
                    message.isMine
                      ? 'bg-indigo-600 text-white rounded-br-none'
                      : (message.sender === 'System' 
                         ? 'bg-yellow-100 text-gray-800 rounded-bl-none border border-yellow-300 font-medium italic' 
                         : 'bg-gray-100 text-gray-700 rounded-tl-none')
                  }`}
                >
                  {message.text}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Mesaj Yazma Alanı */}
        <div className="border-t-2 border-gray-200 px-4 pt-4 mb-2 sm:mb-0 bg-white rounded-xl shadow-lg">
          <form onSubmit={sendMessage} className="flex flex-row items-center">
            <div className="flex-grow ml-4">
              <div className="relative w-full">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder={isConnected ? "Mesajınızı buraya yazın..." : "Bağlanılıyor... Lütfen bekleyin."}
                  disabled={!isConnected}
                  className="flex w-full border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent pl-4 h-12 text-lg transition duration-200 disabled:bg-gray-100 disabled:text-gray-400"
                />
              </div>
            </div>
            <div className="ml-4">
              <button
                type="submit"
                disabled={!isConnected}
                className={`flex items-center justify-center h-10 w-10 rounded-full text-white transition duration-200 shadow-md ${
                  isConnected
                    ? 'bg-indigo-600 hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-500 focus:ring-opacity-50'
                    : 'bg-gray-400 cursor-not-allowed'
                }`}
              >
                <Send className="h-5 w-5 transform rotate-45 -mt-1 ml-1" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default App;